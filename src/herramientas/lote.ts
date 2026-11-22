/**
 * Lotes de contenido del estudio de arte: varios posts y carruseles por local, de tipos variados (cartel, plato,
 * ambiente, gente celebrando, proceso…), para medir el nivel estético del sistema.
 *
 *   npm run lote -- plan banco/arte/*.json --corrida lote-1 [--paralelo 3]
 *       Hydrogen planifica el lote de cada local → datos/arte/<corrida>/<encargo>/plan.json y pedidos.json (las fotos
 *       que hay que generar, con su prompt final y su referencia).
 *   (las fotos de pedidos.json se generan fuera, p. ej. con el conector de Higgsfield, y se dejan en
 *    datos/arte/<corrida>/<encargo>/generadas/<id>.png con un <id>.json de procedencia: modelo, trabajo, prompt)
 *   npm run lote -- componer --corrida lote-1
 *       registra las fotos generadas como activos (SOLO_PRUEBA_COMPOSICION, con máscara de Apple Vision), maqueta cada
 *       visual con su receta y monta posts, carruseles, hojas y el índice.
 *   npm run lote -- evaluar --corrida lote-1
 *       Hydrogen audita la hoja de cada local (nivel por pieza, fortalezas, debilidades, veredicto).
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { z } from 'zod';
import { CompositorSharp } from '../adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../adaptadores/compositor/tipografias.js';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenDisenosFicheros } from '../adaptadores/ficheros/AlmacenDisenosFicheros.js';
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { EstudioArteGemini } from '../adaptadores/gemini/EstudioArteGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { franjasPlanas } from '../adaptadores/imagen/franjas.js';
import { fotoConMascaraPrincipal } from '../adaptadores/imagen/mascaraPrincipal.js';
import { MedidorDeFotoSharp } from '../adaptadores/imagen/MedidorDeFotoSharp.js';
import { ProcesadorSharp } from '../adaptadores/imagen/ProcesadorSharp.js';
import { SegmentadorVision } from '../adaptadores/imagen/SegmentadorVision.js';
import { estudioDeArte, prepararEncargo, type EntradaEstudioDeArte, type Pintura } from '../aplicacion/arte/estudioDeArte.js';
import { componerDiseno } from '../aplicacion/diseno/componerDiseno.js';
import { PlanDeLote, problemasDelPlan, visualesDe, type Visual } from '../dominio/arte/lote.js';
import type { Receta } from '../dominio/arte/receta.js';
import { leerCorpus } from '../dominio/arte/referencias.js';
import { Activo } from '../dominio/activos.js';
import { Tokens, type Intencion } from '../dominio/diseno/intencion.js';
import { problemasDeTextos } from '../dominio/diseno/propuesta.js';
import { Marca } from '../dominio/modelos.js';
import type { ActivoDisponible } from '../puertos/Compositor.js';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DATOS = join(RAIZ, 'datos');
const CORPUS = join(RAIZ, 'referencias-pinterest', 'diseno-visual');
const AJENOS = /^(ACTIVO|FIDELIDAD|RESOLUCION)$/;

const EncargoDelBanco = z.object({
  id: z.string(),
  local: z.string(),
  activo: z.string(),
  plato: z.string(),
  elementos: z.array(
    z.object({
      nombre: z.string(),
      estado: z.string(),
      recuento: z.number().nullable(),
    }),
  ),
  mensaje: z.string(),
  creativo: z.boolean().default(false),
  referencia: z.string().optional(),
});

const Pedido = z.object({
  id: z.string(),
  encargo: z.string(),
  local: z.string(),
  tipo: z.string(),
  conPlato: z.boolean(),
  prompt: z.string(),
  referencia: z.string().optional(),
  aspecto: z.string(),
});
type Pedido = z.infer<typeof Pedido>;

function opcion(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}

/** El prompt final para el modelo de imagen: el del director más las reglas de fidelidad y de imagen sin texto. */
export function promptFinal(v: NonNullable<Visual['generar']>, local: { nombre: string; ciudad: string; descripcion: string }): string {
  return [
    v.conPlato
      ? '@image1 is the real dish from this restaurant. Keep the dish exactly as it is: the same food, the same ingredients and quantities, the same plate and garnish; do not add, remove or restyle anything on the plate. You may change the camera angle slightly, the surroundings, the props and the light.'
      : '',
    v.prompt,
    `The place: ${local.descripcion} (${local.ciudad}).`,
    'Photorealistic professional editorial photograph, vertical 3:4. People, if any, are anonymous adults, natural and candid. Absolutely no text, letters, numbers, signs, menus, logos or watermarks anywhere in the image.',
    // Nano Banana Pro tomó «clean dark shadow space in the upper area» al pie de la letra y pintó una franja negra
    // plana (Lo Güeno, lote-1): el aire para el texto tiene que salir de la propia escena.
    'Any calm area left for typography must be part of the real scene (a dark wall, deep shadow, sky, tablecloth or an out-of-focus background) and the photograph must fill the whole frame: never a flat empty band, border, frame or letterbox.',
  ]
    .filter(Boolean)
    .join(' ');
}

async function existe(ruta: string) {
  return stat(ruta).then(
    () => true,
    () => false,
  );
}

async function main() {
  const accion = process.argv[2];
  const corrida = opcion('corrida', 'lote');
  const clave = process.env.GEMINI_API_KEY;
  const modelos = [process.env.GEMINI_MODELO_ARTE ?? 'gemini-4-hydrogen', process.env.GEMINI_MODELO ?? 'gemini-3.8-flash'];
  const facturacion = process.env.GEMINI_FACTURACION === 'si';
  const carpetaCorrida = join(DATOS, 'arte', corrida);
  const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
  const motor = new MotorTexto(catalogo);
  const compositor = new CompositorSharp(motor, catalogo);
  const activos = new AlmacenActivosFicheros(join(DATOS, 'locales'));
  const procesador = new ProcesadorSharp();
  const medidor = new MedidorDeFotoSharp();
  const corpus = {
    piezas: leerCorpus(await readFile(join(CORPUS, 'README.md'), 'utf8')),
    ruta: (a: string) => join(CORPUS, a),
  };
  const gemini = (motivo: string, proyecto?: string) => {
    if (!clave) throw new Error('Falta GEMINI_API_KEY en .env.');
    return new EstudioArteGemini(
      new ClienteGemini(clave, modelos, {
        alUsar: registradorDeUso(DATOS, motivo, facturacion, proyecto),
        tiempoMaximoMs: 300_000,
      }),
      modelos,
    );
  };

  /** Lo común de un encargo del banco: marca, tokens, foto (con su máscara limpia), hechos y referencia. */
  const cargar = async (archivo: string) => {
    const e = EncargoDelBanco.parse(JSON.parse(await readFile(resolve(archivo), 'utf8')));
    const marca = Marca.parse(JSON.parse(await readFile(join(DATOS, 'locales', e.local, 'marca.json'), 'utf8')));
    const tokensMarca = Tokens.parse(JSON.parse(await readFile(join(RAIZ, 'marcas', e.local, 'tokens.json'), 'utf8')));
    const foto = await fotoConMascaraPrincipal(activos, e.local, await activos.obtener(e.local, e.activo));
    const hechos = {
      plato: e.plato,
      elementos: e.elementos,
      local: {
        nombre: marca.nombre,
        ciudad: marca.ciudad,
        descripcion: marca.descripcion,
        tonos: marca.tonos,
        ...(marca.instagram ? { instagram: marca.instagram } : {}),
        ...(marca.web ? { web: marca.web } : {}),
      },
    };
    let referencia: { id: string; ruta: string; ficha?: unknown } | undefined;
    if (e.referencia) {
      const carpetaRef = join(DATOS, 'locales', e.local, 'referencias', e.referencia);
      const ref = JSON.parse(await readFile(join(carpetaRef, 'referencia.json'), 'utf8')) as { ficha?: unknown; origen?: { archivo?: string } };
      referencia = {
        id: e.referencia,
        ruta: join(carpetaRef, ref.origen?.archivo ?? 'imagen.jpg'),
        ...(ref.ficha ? { ficha: ref.ficha } : {}),
      };
    }
    const entrada = (foto2: ActivoDisponible, salida: string): EntradaEstudioDeArte => ({
      id: e.id,
      local: e.local,
      foto: foto2,
      hechos,
      tokensMarca,
      mensaje: e.mensaje,
      creativo: e.creativo,
      direcciones: 1,
      vueltas: 0,
      salida,
      ...(referencia ? { referencia } : {}),
    });
    return { e, marca, tokensMarca, foto, hechos, referencia, entrada };
  };

  if (accion === 'plan') {
    const archivos = process.argv.slice(3).filter((a) => a.endsWith('.json'));
    const paralelo = Math.max(1, Number(opcion('paralelo', '3')));
    let siguiente = 0;
    const trabajar = async () => {
      for (let k = siguiente++; k < archivos.length; k = siguiente++) {
        try {
          const { e, foto, hechos, entrada, marca } = await cargar(archivos[k]!);
          const salida = join(carpetaCorrida, e.id);
          await mkdir(salida, { recursive: true });
          const { encargo } = await prepararEncargo({ medidor, silueta: (f) => medidor.silueta(f), corpus }, entrada(foto, salida));
          const estudio = gemini('estudio-de-arte/lote', e.id);
          let devolver: string[] = [];
          let plan: PlanDeLote | undefined;
          for (let intento = 1; intento <= 2; intento++) {
            console.log(`[${e.id}] · Plan del lote${intento > 1 ? ' (segunda vuelta)' : ''}…`);
            plan = await estudio.planificarLote(encargo, devolver);
            const problemas = [...problemasDelPlan(plan)];
            for (const v of visualesDe(plan))
              problemas.push(
                ...problemasDeTextos(v.visual.receta.textos, hechos, {
                  titularCreativo: e.creativo,
                  creativo: { maxPalabras: 4, maxTextos: 2 },
                }).map((x) => `«${v.id}»: ${x}`),
              );
            for (const x of problemas) console.log(`[${e.id}]   ! ${x}`);
            if (!problemas.length) break;
            devolver = problemas;
          }
          await writeFile(join(salida, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
          const pedidos: Pedido[] = visualesDe(plan!)
            .filter((v) => v.visual.foto === 'generada' && v.visual.generar)
            .map((v) => ({
              id: v.id,
              encargo: e.id,
              local: e.local,
              tipo: v.visual.generar!.tipo,
              conPlato: v.visual.generar!.conPlato,
              prompt: promptFinal(v.visual.generar!, {
                nombre: marca.nombre,
                ciudad: marca.ciudad,
                descripcion: marca.descripcion,
              }),
              ...(v.visual.generar!.conPlato ? { referencia: foto.ruta } : {}),
              aspecto: '3:4',
            }));
          await writeFile(join(salida, 'pedidos.json'), `${JSON.stringify(pedidos, null, 2)}\n`);
          console.log(`[${e.id}] → ${plan!.posts.length} posts, ${plan!.carruseles.length} carrusel(es), ${pedidos.length} fotos que generar. ${plan!.estrategia}`);
        } catch (error) {
          console.error(`✖ ${archivos[k]}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(paralelo, archivos.length) }, trabajar));
    return;
  }

  if (accion === 'componer') {
    const segmentador = new SegmentadorVision(RAIZ);
    // --encargos a,b: solo esos (los demás conservan su hoja).
    const soloEstos = opcion('encargos', '').split(',').filter(Boolean);
    const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const encargos = (await readdir(carpetaCorrida)).filter((n) => !n.includes('.') && (!soloEstos.length || soloEstos.includes(n)));
    for (const id of encargos) {
      const salida = join(carpetaCorrida, id);
      if (!(await existe(join(salida, 'plan.json')))) continue;
      const plan = PlanDeLote.parse(JSON.parse(await readFile(join(salida, 'plan.json'), 'utf8')));
      const pedidos = z.array(Pedido).parse(JSON.parse(await readFile(join(salida, 'pedidos.json'), 'utf8')));
      const banco = join(RAIZ, 'banco', 'arte', `${id}.json`);
      const { e, foto, tokensMarca, entrada, marca } = await cargar(banco);
      console.log(`\n══ ${id} · ${marca.nombre}`);

      // 1. Las fotos generadas, como activos del local (con máscara y procedencia). Una foto que se repite (otro
      // archivo con el mismo nombre) es otro activo: el id lleva su huella si el primero ya existe con otros bytes.
      const generadas = new Map<string, ActivoDisponible>();
      const defectosDeFoto = new Map<string, string>();
      for (const p of pedidos) {
        const archivo = (await readdir(join(salida, 'generadas')).catch(() => [] as string[])).find((a) => a.startsWith(`${p.id}.`) && /\.(png|jpe?g|webp)$/i.test(a));
        if (!archivo) {
          console.log(`  ! falta la foto generada «${p.id}»`);
          continue;
        }
        const ruta = join(salida, 'generadas', archivo);
        const bytes = await sharp(ruta).png().toBuffer();
        const sha = createHash('sha256').update(bytes).digest('hex');
        let idActivo = `${corrida}-${id}-${p.id}`.replace(/[^a-z0-9-]/g, '-').slice(0, 80);
        if ((await activos.existe(e.local, idActivo)) && (await activos.obtener(e.local, idActivo)).activo.sha256 !== sha) idActivo = `${idActivo}-${sha.slice(0, 8)}`;
        const franjas = await franjasPlanas(bytes);
        if (Math.max(franjas.arriba, franjas.abajo) >= 0.15) {
          const defecto = `la foto generada tiene una franja plana ${franjas.arriba >= franjas.abajo ? `arriba (${Math.round(franjas.arriba * 100)} %)` : `abajo (${Math.round(franjas.abajo * 100)} %)`}: el modelo pintó el «aire» en vez de una escena; hay que repetirla`;
          defectosDeFoto.set(p.id, defecto);
          console.log(`  ! «${p.id}»: ${defecto}`);
        }
        if (!(await activos.existe(e.local, idActivo))) {
          const meta = await sharp(bytes).metadata();
          const procedencia = JSON.parse(await readFile(join(salida, 'generadas', `${p.id}.json`), 'utf8').catch(() => '{}')) as { modelo?: string; trabajo?: string; prompt?: string };
          const mascara = await segmentador.mascara(ruta).catch(() => undefined);
          let bbox: { x: number; y: number; w: number; h: number } | undefined;
          if (mascara) {
            const { data, info } = await sharp(mascara).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
            let x0 = info.width,
              y0 = info.height,
              x1 = -1,
              y1 = -1;
            for (let i = 0; i < data.length; i++)
              if (data[i]! >= 128) {
                const x = i % info.width,
                  y = (i - x) / info.width;
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
              }
            if (x1 > x0 && y1 > y0) bbox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
          }
          const ahora = new Date().toISOString();
          await activos.crear(
            Activo.parse({
              id: idActivo,
              localSlug: e.local,
              tipo: 'GENERADO',
              uso: 'SOLO_PRUEBA_COMPOSICION',
              descripcion: `Foto generada para el lote ${corrida} (${p.tipo}${p.conPlato ? ', con el plato real de referencia' : ''}). Prueba estética: no es una foto del local.`,
              archivo: 'original.png',
              ancho: meta.width!,
              alto: meta.height!,
              sha256: sha,
              ...(mascara && bbox
                ? {
                    mascara: {
                      archivo: 'mascara.png',
                      metodo: 'APPLE_VISION',
                      creadaEn: ahora,
                      bbox,
                      incluye: 'lo que detecte Apple Vision',
                    },
                  }
                : {}),
              procedencia: {
                ruta: relative(RAIZ, ruta),
                sha256: sha,
                copiadoEn: ahora,
                generacion: {
                  modelo: procedencia.modelo ?? 'Higgsfield MCP',
                  requestId: procedencia.trabajo ?? p.id,
                  promptArchivo: relative(RAIZ, join(salida, 'pedidos.json')),
                  prompt: p.prompt,
                  parametros: { aspecto: p.aspecto },
                  referencias: p.conPlato ? [{ activo: foto.activo.id, sha256: foto.activo.sha256 }] : [],
                  generadoEn: ahora,
                },
              },
            }),
            {
              'original.png': bytes,
              ...(mascara ? { 'mascara.png': mascara } : {}),
            },
          );
        }
        generadas.set(p.id, await activos.obtener(e.local, idActivo));
      }

      // 2. Cada visual con su receta, sobre su foto (sin modelos: el director ya decidió).
      const pintar = async (intencion: Intencion, carpeta: string): Promise<Pintura> => {
        await mkdir(carpeta, { recursive: true });
        const r = await componerDiseno(
          {
            compositor,
            activos,
            disenos: new AlmacenDisenosFicheros(carpeta),
            procesador,
          },
          intencion,
          'pieza',
          { tokensMarca },
        );
        const png = join(r.guardado.carpeta, 'diseno.png');
        const movil = join(carpeta, 'movil.png');
        await sharp(png).resize(360).png().toFile(movil);
        const problemas = r.resuelto.problemas.filter((x) => !AJENOS.test(String(x.tipo)));
        return {
          png,
          movil,
          errores: problemas.filter((x) => x.gravedad === 'ERROR').map((x) => `${x.tipo}: ${x.mensaje}`),
          avisos: problemas.filter((x) => x.gravedad !== 'ERROR').map((x) => `${x.tipo}: ${x.mensaje}`),
        };
      };
      // La receta del plan se escribió antes de que existiera la foto generada: si no cabe en la foto de verdad (no
      // compila) o, ya pintada, el código mide errores (contraste, solape), Hydrogen la repara VIENDO esa foto, como en
      // el flujo normal (proponer → compilar → reparar). Sin clave, la receta va tal cual.
      const reparador = clave && !process.argv.includes('--sin-reparar') ? gemini('estudio-de-arte/lote-reparar', id) : undefined;
      const neutra = { nivel: 2, motivo: 'sin crítica: composición del lote' };
      type Resultado = {
        png?: string;
        problemas: string[];
        reparada: boolean;
        receta: Receta;
        foto?: string;
        plan?: string;
        defectoDeFoto?: string;
      };
      const resultados = new Map<string, Resultado>();
      // Lo que ya reparó Hydrogen en otra composición vale mientras no cambien ni la foto ni la receta del plan: se
      // parte de la receta reparada y no se vuelve a pagar la reparación.
      const anteriores = new Map(Object.entries(JSON.parse(await readFile(join(salida, 'resultados.json'), 'utf8').catch(() => '{}')) as Record<string, Resultado>));
      // --visuales a,b: solo se recomponen esos; los demás se quedan como estaban (su pieza ya pintada).
      const soloVisuales = opcion('visuales', '').split(',').filter(Boolean);
      for (const v of visualesDe(plan)) {
        const anterior = anteriores.get(v.id);
        if (soloVisuales.length && !soloVisuales.includes(v.id) && anterior) {
          resultados.set(v.id, anterior);
          continue;
        }
        const fotoDeEsta = v.visual.foto === 'real' ? foto : generadas.get(v.id);
        if (!fotoDeEsta) {
          resultados.set(v.id, {
            problemas: ['sin foto generada'],
            reparada: false,
            receta: v.visual.receta,
          });
          continue;
        }
        const huellaPlan = createHash('sha256').update(JSON.stringify(v.visual.receta)).digest('hex').slice(0, 16);
        const previa = anteriores.get(v.id);
        const reutiliza = previa?.reparada && previa.foto === fotoDeEsta.activo.sha256 && previa.plan === huellaPlan;
        let receta = reutiliza ? previa.receta : v.visual.receta;
        let pendientes: string[] = [];
        let mejor: Resultado | undefined;
        try {
          for (let pasada = 1; pasada <= (reparador ? 2 : 1); pasada++) {
            let reparada = pasada > 1 || Boolean(reutiliza);
            const r = await estudioDeArte(
              {
                director: {
                  nombre: 'plan del lote',
                  proponer: async (enc) => ({
                    direcciones: [pendientes.length && reparador ? await reparador.reparar(enc, receta, pendientes) : receta],
                  }),
                  reparar: async (enc, r0, problemas) => {
                    if (!reparador) return r0;
                    reparada = true;
                    return reparador.reparar(enc, r0, problemas);
                  },
                },
                critico: {
                  nombre: 'sin crítica',
                  criticar: async () => ({
                    primeraLectura: 'sin crítica',
                    puntuaciones: {
                      idea: neutra,
                      composicion: neutra,
                      tipografia: neutra,
                      relacion: neutra,
                      identidad: neutra,
                      acabado: neutra,
                    },
                    defectoPrincipal: '—',
                    parches: [],
                  }),
                },
                medidor,
                silueta: (f) => medidor.silueta(f),
                pintar,
                metricas: {
                  ancho: (est, t, n) => motor.medir(est, t, n).ancho,
                  mayusculas: (est) => motor.alturaMayusculas(est, 1000) / 1000,
                },
                corpus,
              },
              // Cada composición en su carpeta fechada: el almacén de diseños no sobrescribe versiones.
              {
                ...entrada(fotoDeEsta, join(salida, 'piezas', v.id, sello, `p${pasada}`)),
                referencia: undefined,
              },
            );
            const vuelta = r.direcciones[0]?.mejor ?? r.direcciones[0]?.vueltas[0];
            const esta = {
              ...(vuelta?.png ? { png: vuelta.png } : {}),
              problemas: vuelta?.problemas ?? ['no compila'],
              reparada,
              receta: vuelta?.receta ?? receta,
            };
            // Se queda la pasada pintada con menos errores (una reparación que empeora no sustituye a la anterior).
            if (!mejor || (esta.png && (!mejor.png || esta.problemas.length < mejor.problemas.length))) mejor = esta;
            // Lo que sigue sin compilar después de la reparación de dentro también tiene una segunda vuelta.
            if (!esta.problemas.length) break;
            pendientes = esta.problemas;
            receta = esta.receta;
          }
        } catch (error) {
          // Un fallo en una pieza no para el lote: se queda la versión anterior, si la había.
          const mensaje = error instanceof Error ? error.message : String(error);
          console.log(`  ✖ ${v.id}: ${mensaje.slice(0, 200)}${anterior?.png ? ' (se queda la versión anterior)' : ''}`);
          resultados.set(
            v.id,
            anterior?.png
              ? anterior
              : {
                  problemas: [`error: ${mensaje.slice(0, 300)}`],
                  reparada: false,
                  receta: v.visual.receta,
                },
          );
          continue;
        }
        const defectoDeFoto = defectosDeFoto.get(v.id);
        resultados.set(v.id, {
          ...mejor!,
          foto: fotoDeEsta.activo.sha256,
          plan: huellaPlan,
          ...(defectoDeFoto ? { defectoDeFoto } : {}),
        });
        console.log(
          `  ${mejor!.png ? '■' : '✖'} ${v.id} (${v.visual.foto}${v.visual.generar ? ` · ${v.visual.generar.tipo}` : ''}, ${mejor!.receta.esqueleto}${mejor!.reparada ? `, reparada${reutiliza ? ' antes' : ''}` : ''})${mejor!.problemas.length ? ` · ${mejor!.problemas.slice(0, 2).join(' · ')}` : ''}`,
        );
      }

      // 3. Posts y carruseles en su carpeta; la hoja del local.
      await mkdir(join(salida, 'posts'), { recursive: true });
      // En la hoja, cada pieza en su sitio (la que no compila deja su hueco, para que el orden de lectura siga
      // casando con los ids que se le dan al evaluador) y marcada en rojo si el código midió errores.
      const enHoja = (id: string, ruta?: string): PiezaDeHoja => (ruta ? { ruta, ...(resultados.get(id)?.problemas.length ? { conErrores: true } : {}) } : { falta: true });
      const filas: Array<{ titulo: string; imagenes: PiezaDeHoja[] }> = [];
      const postsListos: PiezaDeHoja[] = [];
      for (const p of plan.posts) {
        const png = resultados.get(p.id)?.png;
        if (png) await copyFile(png, join(salida, 'posts', `${p.id}.png`));
        postsListos.push(enHoja(p.id, png ? join(salida, 'posts', `${p.id}.png`) : undefined));
      }
      filas.push({ titulo: `Posts · ${plan.posts.map((p) => `${p.id} (${p.tipo})`).join(' · ')}`, imagenes: postsListos });
      for (const c of plan.carruseles) {
        const dir = join(salida, 'carruseles', c.id);
        await mkdir(dir, { recursive: true });
        const slides: PiezaDeHoja[] = [];
        for (const [i] of c.diapositivas.entries()) {
          const png = resultados.get(`${c.id}-${i + 1}`)?.png;
          const destino = join(dir, `${String(i + 1).padStart(2, '0')}.png`);
          if (png) await copyFile(png, destino);
          slides.push(enHoja(`${c.id}-${i + 1}`, png ? destino : undefined));
        }
        filas.push({ titulo: `Carrusel ${c.id} (${c.tipo}) · ${c.idea}`, imagenes: slides });
      }
      const hoja = join(salida, 'hoja.jpg');
      await hojaDeLote(hoja, `${marca.nombre} · ${plan.estrategia}`, filas);
      await writeFile(join(salida, 'resultados.json'), `${JSON.stringify(Object.fromEntries(resultados), null, 2)}\n`);
      console.log(`→ ${relative(RAIZ, hoja)}`);
    }
    // El índice, con todos los encargos que tienen hoja (también los que no se recompusieron esta vez).
    const indice = [`# Lote ${corrida}`, ''];
    for (const id of (await readdir(carpetaCorrida)).filter((n) => !n.includes('.'))) if (await existe(join(carpetaCorrida, id, 'hoja.jpg'))) indice.push(`## ${id}`, '', `![${id}](${id}/hoja.jpg)`, '');
    await writeFile(join(carpetaCorrida, 'indice.md'), indice.join('\n'));
    return;
  }

  if (accion === 'evaluar') {
    const encargos = (await readdir(carpetaCorrida)).filter((n) => !n.includes('.'));
    const lineas = [`# Evaluación del lote ${corrida} (Hydrogen, a tamaño de móvil)`, ''];
    for (const id of encargos) {
      const salida = join(carpetaCorrida, id);
      if (!(await existe(join(salida, 'hoja.jpg')))) continue;
      const plan = PlanDeLote.parse(JSON.parse(await readFile(join(salida, 'plan.json'), 'utf8')));
      const ids = [...plan.posts.map((p) => `${p.id} (post, ${p.tipo})`), ...plan.carruseles.flatMap((c) => c.diapositivas.map((d, i) => `${c.id}-${i + 1} (carrusel, ${d.papel})`))];
      const marca = Marca.parse(JSON.parse(await readFile(join(DATOS, 'locales', (await readFile(join(RAIZ, 'banco', 'arte', `${id}.json`), 'utf8').then((t) => JSON.parse(t) as { local: string })).local, 'marca.json'), 'utf8')));
      const ev = await gemini('estudio-de-arte/evaluar-lote', id).evaluarLote(
        join(salida, 'hoja.jpg'),
        ids,
        `Restaurante: ${marca.nombre} (${marca.ciudad}). ${marca.descripcion} Tonos: ${marca.tonos.join(', ')}. Estrategia del lote: ${plan.estrategia}\nEn la hoja, un hueco gris «NO COMPILA» es una pieza que no se pudo maquetar (nivel 0), y un marco rojo «ERRORES MEDIDOS» marca una pieza en la que el código midió defectos (contraste o solape): puntúala como se ve, sin tener en cuenta el marco.`,
      );
      await writeFile(join(salida, 'evaluacion.json'), `${JSON.stringify(ev, null, 2)}\n`);
      const media = ev.piezas.length ? Math.round((ev.piezas.reduce((a, p) => a + p.nivel, 0) / ev.piezas.length) * 10) / 10 : 0;
      console.log(`${id}: media ${media}/4 · feed profesional: ${ev.pareceFeedProfesional ? 'sí' : 'no'} · ${ev.veredicto}`);
      lineas.push(
        `## ${marca.nombre} · media ${media}/4 · feed profesional: ${ev.pareceFeedProfesional ? 'sí' : 'no'}`,
        '',
        `![hoja](${id}/hoja.jpg)`,
        '',
        ev.veredicto,
        '',
        '**Fortalezas:**',
        ...ev.fortalezas.map((x) => `- ${x}`),
        '',
        '**Debilidades:**',
        ...ev.debilidades.map((x) => `- ${x}`),
        '',
        '| Pieza | Nivel | Comentario |',
        '|---|---|---|',
        ...ev.piezas.map((p) => `| ${p.id} | ${p.nivel}/4 | ${p.comentario.replace(/\|/g, '/')} |`),
        '',
      );
    }
    await writeFile(join(carpetaCorrida, 'evaluacion.md'), `${lineas.join('\n')}\n`);
    return;
  }

  throw new Error('Uso: npm run lote -- plan|componer|evaluar … --corrida <nombre>');
}

type PiezaDeHoja = { ruta: string; conErrores?: boolean } | { falta: true };

/** Una fila por grupo (los posts, cada carrusel), a 300 px, con su título. */
async function hojaDeLote(ruta: string, titulo: string, filas: Array<{ titulo: string; imagenes: PiezaDeHoja[] }>) {
  const ancho = 300;
  const alto = 400;
  const cabeza = 34;
  const columnas = Math.max(4, ...filas.map((f) => f.imagenes.length));
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const capas: OverlayOptions[] = [
    {
      input: Buffer.from(`<svg width="${columnas * (ancho + 10) + 10}" height="40"><text x="10" y="27" font-size="18" font-family="Helvetica" font-weight="bold" fill="#111">${esc(titulo.slice(0, 150))}</text></svg>`),
      left: 0,
      top: 0,
    },
  ];
  let top = 44;
  for (const f of filas) {
    capas.push({
      input: Buffer.from(`<svg width="${columnas * (ancho + 10) + 10}" height="${cabeza}"><text x="10" y="22" font-size="14" font-family="Helvetica" fill="#333">${esc(f.titulo.slice(0, 170))}</text></svg>`),
      left: 0,
      top,
    });
    top += cabeza;
    for (const [i, img] of f.imagenes.entries()) {
      const left = 10 + i * (ancho + 10);
      if ('falta' in img) {
        capas.push({ input: Buffer.from(`<svg width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="#d6d6d6"/><text x="50%" y="50%" text-anchor="middle" font-size="18" font-family="Helvetica" font-weight="bold" fill="#777">NO COMPILA</text></svg>`), left, top });
        continue;
      }
      capas.push({ input: await sharp(img.ruta).resize(ancho, alto, { fit: 'contain', background: '#ddd' }).png().toBuffer(), left, top });
      if (img.conErrores)
        capas.push({ input: Buffer.from(`<svg width="${ancho}" height="${alto}"><rect x="3" y="3" width="${ancho - 6}" height="${alto - 6}" fill="none" stroke="#e01010" stroke-width="6"/><rect x="0" y="${alto - 28}" width="${ancho}" height="28" fill="#e01010"/><text x="10" y="${alto - 9}" font-size="14" font-family="Helvetica" font-weight="bold" fill="#fff">ERRORES MEDIDOS</text></svg>`), left, top });
    }
    top += alto + 14;
  }
  await sharp({
    create: {
      width: columnas * (ancho + 10) + 10,
      height: top,
      channels: 3,
      background: '#f2f2f2',
    },
  })
    .composite(capas)
    .jpeg({ quality: 85 })
    .toFile(ruta);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
