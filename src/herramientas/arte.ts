/**
 * Estudio de arte (src/aplicacion/arte/estudioDeArte.ts): de un encargo del banco a varias direcciones pintadas,
 * criticadas y corregidas, con su hoja de contactos y su informe.
 *
 *   npm run arte -- banco/arte/dak-manhattan.json [--direcciones 3] [--vueltas 1] [--corrida nombre] [--referencias 5]
 *   npm run arte -- banco/arte/*.json …           varios encargos seguidos (la misma corrida)
 *
 * Salida: datos/arte/<corrida>/<encargo>/ (una carpeta por dirección y vuelta, resultado.json, informe.md, hoja.jpg).
 * Director, crítico y comparador: Gemini (GEMINI_MODELO_ARTE, por defecto gemini-4-hydrogen). El gasto de texto se
 * apunta en datos/gasto/gemini-texto.jsonl. Las ESCENAS (fondos sin comida) se generan con Nano Banana Pro
 * (GEMINI_MODELO_IMAGEN), se registran como activos SOLO_PRUEBA_COMPOSICION del local con su procedencia y se apuntan en
 * datos/gasto/gemini.jsonl, con un presupuesto propio por ejecución (ARTE_PRESUPUESTO_USD, por defecto 8 USD sobre lo ya
 * gastado). No publica nada.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { z } from 'zod';
import { CompositorSharp } from '../adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../adaptadores/compositor/tipografias.js';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenDisenosFicheros } from '../adaptadores/ficheros/AlmacenDisenosFicheros.js';
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { gastoAcumuladoGemini, GeneradorFotoGemini } from '../adaptadores/gemini/GeneradorFotoGemini.js';
import { RecursosArteGemini } from '../adaptadores/gemini/RecursosArteGemini.js';
import { capasProtegidas, componerProtegido } from '../adaptadores/imagen/insercion.js';
import { fotoConMascaraPrincipal } from '../adaptadores/imagen/mascaraPrincipal.js';
import { EstudioArteGemini } from '../adaptadores/gemini/EstudioArteGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { leerCartel } from '../adaptadores/imagen/lecturaCartel.js';
import { MedidorDeFotoSharp } from '../adaptadores/imagen/MedidorDeFotoSharp.js';
import { ProcesadorSharp } from '../adaptadores/imagen/ProcesadorSharp.js';
import { estudioDeArte, type Pintura, type ResultadoEstudioDeArte } from '../aplicacion/arte/estudioDeArte.js';
import { componerDiseno } from '../aplicacion/diseno/componerDiseno.js';
import { Receta } from '../dominio/arte/receta.js';
import { leerCorpus } from '../dominio/arte/referencias.js';
import { DIMENSIONES, huella } from '../dominio/arte/rubrica.js';
import { Tokens, type Intencion } from '../dominio/diseno/intencion.js';
import { Activo } from '../dominio/activos.js';
import { Marca } from '../dominio/modelos.js';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DATOS = join(RAIZ, 'datos');
const CORPUS = join(RAIZ, 'referencias-pinterest', 'diseno-visual');
const AJENOS = /^(ACTIVO|FIDELIDAD|RESOLUCION)$/;

const EncargoDelBanco = z.object({
  id: z.string(),
  local: z.string(),
  activo: z.string(),
  plato: z.string(),
  elementos: z.array(z.object({ nombre: z.string(), estado: z.string(), recuento: z.number().nullable() })),
  mensaje: z.string(),
  creativo: z.boolean().default(false),
  /** La pieza que ya hizo el sistema anterior para este local: la mejor dirección nueva se enfrenta a ella a ciegas. */
  previa: z.string().optional(),
  /** La referencia del flujo principal (datos/locales/<local>/referencias/<id>): con --referencia, el modo referencia. */
  referencia: z.string().optional(),
});

function opcion(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : porDefecto;
}

async function main() {
  const archivos = process.argv.slice(2).filter((a, i, todos) => a.endsWith('.json') && !todos[i - 1]?.startsWith('--'));
  if (!archivos.length) throw new Error('Uso: npm run arte -- banco/arte/<encargo>.json [--direcciones 3] [--vueltas 1] [--corrida nombre]');
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new Error('Falta GEMINI_API_KEY en .env.');
  // --recompilar r3: las recetas que escribió el director en la corrida r3, compiladas y pintadas con el código de ahora,
  // sin llamar a ningún modelo (valida los cambios del compilador con las mismas decisiones).
  const recompilar = process.argv.includes('--recompilar') ? opcion('recompilar', '') : undefined;
  // --receta <archivo>: pinta una receta escrita a mano (sin modelos de texto): línea base y pruebas sin créditos.
  const recetaAMano = process.argv.includes('--receta') ? opcion('receta', '') : undefined;
  const corrida = recompilar ? `${recompilar}-recompilada` : opcion('corrida', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
  const direcciones = Number(opcion('direcciones', '3'));
  const vueltas = Number(opcion('vueltas', '1'));
  const nReferencias = Number(opcion('referencias', '5'));
  const modelos = [process.env.GEMINI_MODELO_ARTE ?? 'gemini-4-hydrogen', process.env.GEMINI_MODELO ?? 'gemini-3.8-flash'];
  const facturacion = process.env.GEMINI_FACTURACION === 'si';

  const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
  const motor = new MotorTexto(catalogo);
  const compositor = new CompositorSharp(motor, catalogo);
  const activos = new AlmacenActivosFicheros(join(DATOS, 'locales'));
  const procesador = new ProcesadorSharp();
  const medidor = new MedidorDeFotoSharp();
  const corpus = { piezas: leerCorpus(await readFile(join(CORPUS, 'README.md'), 'utf8')), ruta: (a: string) => join(CORPUS, a) };
  const presupuesto = Number(process.env.ARTE_PRESUPUESTO_USD ?? '8');
  const gastadoAlEmpezar = await gastoAcumuladoGemini(join(DATOS, 'gasto', 'gemini.jsonl'));
  // Los recursos gráficos (escenas, garabatos, elementos, inserción) van con Nano Banana 2: Nano Banana Pro es caro y
  // es para la foto del plato.
  const modeloImagen = process.env.ARTE_MODELO_RECURSOS ?? 'gemini-3.1-flash-image';
  const conReferencia = process.argv.includes('--referencia');
  const referenciaForzada = conReferencia && process.argv[process.argv.indexOf('--referencia') + 1] && !process.argv[process.argv.indexOf('--referencia') + 1]!.startsWith('--') && !process.argv[process.argv.indexOf('--referencia') + 1]!.endsWith('.json') ? process.argv[process.argv.indexOf('--referencia') + 1] : undefined;
  const enriquecer: boolean | 'todas' = process.argv.includes('--enriquecer') ? (process.argv[process.argv.indexOf('--enriquecer') + 1] === 'todas' ? 'todas' : true) : false;
  const generador = new GeneradorFotoGemini({ apiKey: clave, modelo: modeloImagen, facturacion: process.env.GEMINI_FACTURACION === 'si', topeUsd: gastadoAlEmpezar + presupuesto, carpetaDatos: DATOS, origen: 'estudio-de-arte/escena' });
  console.log(`Recursos gráficos: ${modeloImagen}, presupuesto ${presupuesto} USD sobre ${gastadoAlEmpezar.toFixed(2)} ya gastados.`);
  const recursos = new RecursosArteGemini(generador, activos, modeloImagen);
  const generarEscena = (describe: string, c: { local: string; luz: string }) => recursos.escena(describe, c);
  const generarGarabato = (describe: string, c: { local: string; color: string }) => recursos.garabato(describe, c);
  const generarElemento = (describe: string, c: { local: string; color: string; estilo: 'trazo' | 'forma'; centroVacio: boolean }) => recursos.elemento(describe, c);
  /** Inserción en contexto con protección: el modelo dibuja sobre la pieza; el código restaura producto y textos. */
  const insertarProtegido = async (pieza: { png: string }, instruccion: string, c: { id: string; referencia?: string; carpeta: string; reestilizar?: string[] }) => {
    await mkdir(c.carpeta, { recursive: true });
    const editada = await recursos.insertar(pieza.png, instruccion, { id: c.id, ...(c.referencia ? { referencia: c.referencia } : {}) });
    await writeFile(join(c.carpeta, 'editada-por-el-modelo.png'), await sharp(editada.bytes).png().toBuffer());
    await writeFile(join(c.carpeta, 'prompt.txt'), `${editada.prompt}\n`);
    const r = await componerProtegido(pieza.png, editada.bytes, await capasProtegidas(dirname(pieza.png), c.reestilizar ?? []));
    const png = join(c.carpeta, 'diseno.png');
    await writeFile(png, r.png);
    const movil = join(c.carpeta, 'movil.png');
    await sharp(r.png).resize(360).png().toFile(movil);
    return {
      png,
      movil,
      medidas: [
        `INSERCION: el modelo (${editada.modelo}) habría cambiado el ${Math.round(r.cambioDentro * 100)} % del producto y los textos (restaurados por el código) y añadió en el ${Math.round(r.cambioFuera * 100)} % del resto; ${editada.costeUsd.toFixed(3)} USD.`,
      ],
    };
  };
  const resumen: Array<{ id: string; local: string; r: ResultadoEstudioDeArte }> = [];
  const paralelo = Math.max(1, Number(opcion('paralelo', '1')));
  const hechos: Array<{ id: string; local: string; r: ResultadoEstudioDeArte } | undefined> = archivos.map(() => undefined);
  let siguiente = 0;
  const trabajar = async () => {
    for (let k = siguiente++; k < archivos.length; k = siguiente++) {
      try {
        hechos[k] = await unEncargo(archivos[k]!);
      } catch (error) {
        console.error(`✖ ${archivos[k]}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  const unEncargo = async (archivo: string) => {
    const e = EncargoDelBanco.parse(JSON.parse(await readFile(resolve(archivo), 'utf8')));
    const salida = join(DATOS, 'arte', corrida, e.id);
    await mkdir(salida, { recursive: true });
    const marca = Marca.parse(JSON.parse(await readFile(join(DATOS, 'locales', e.local, 'marca.json'), 'utf8')));
    const tokensMarca = Tokens.parse(JSON.parse(await readFile(join(RAIZ, 'marcas', e.local, 'tokens.json'), 'utf8')));
    const foto = await fotoConMascaraPrincipal(activos, e.local, await activos.obtener(e.local, e.activo));
    const cliente = new ClienteGemini(clave, modelos, {
      avisar: (m) => console.log(`  (${m})`),
      alUsar: registradorDeUso(DATOS, 'estudio-de-arte', facturacion, e.id),
      tiempoMaximoMs: 240_000,
    });
    const estudio = new EstudioArteGemini(cliente, modelos);

    const pintar = async (intencion: Intencion, carpeta: string): Promise<Pintura> => {
      await mkdir(carpeta, { recursive: true });
      await writeFile(join(carpeta, 'intencion.json'), `${JSON.stringify(intencion, null, 2)}\n`);
      try {
        const r = await componerDiseno({ compositor, activos, disenos: new AlmacenDisenosFicheros(carpeta), procesador }, intencion, 'pieza', { tokensMarca });
        const png = join(r.guardado.carpeta, 'diseno.png');
        const movil = join(carpeta, 'movil.png');
        await sharp(png).resize(360).png().toFile(movil);
        const problemas = r.resuelto.problemas.filter((p) => !AJENOS.test(String(p.tipo)));
        return {
          png,
          movil,
          errores: problemas.filter((p) => p.gravedad === 'ERROR').map((p) => `${p.tipo}: ${p.mensaje}`),
          avisos: problemas.filter((p) => p.gravedad !== 'ERROR').map((p) => `${p.tipo}: ${p.mensaje}`),
        };
      } catch (error) {
        if (error instanceof RangeError) {
          const vacio = join(carpeta, 'vacio.png');
          await sharp({ create: { width: 1080, height: 1440, channels: 3, background: '#888' } }).png().toFile(vacio);
          return { png: vacio, movil: vacio, errores: [`El compositor no puede resolverla: ${error.message}`], avisos: [] };
        }
        throw error;
      }
    };

    // Modo referencia: la referencia del encargo (o la forzada) con su imagen y su ficha.
    const idReferencia = conReferencia ? (referenciaForzada ?? e.referencia) : undefined;
    let referencia: { id: string; ruta: string; ficha?: unknown } | undefined;
    if (idReferencia) {
      const carpetaRef = join(DATOS, 'locales', e.local, 'referencias', idReferencia);
      const ref = JSON.parse(await readFile(join(carpetaRef, 'referencia.json'), 'utf8')) as { ficha?: unknown; origen?: { archivo?: string } };
      referencia = { id: idReferencia, ruta: join(carpetaRef, ref.origen?.archivo ?? 'imagen.jpg'), ...(ref.ficha ? { ficha: ref.ficha } : {}) };
    }
    console.log(`\n══ ${e.id} · ${marca.nombre} · ${e.activo}${referencia ? ` · referencia ${referencia.id}` : ''}`);
    const inicio = Date.now();
    const r = await estudioDeArte(
      {
        ...(recompilar
          ? await sinModelos(join(DATOS, 'arte', recompilar, e.id, 'resultado.json'))
          : recetaAMano
            ? enriquecer
              // Una receta guardada + crítica, comparación y acabado reales (Hydrogen y Nano Banana 2).
              ? { director: { ...(await sinModelos(resolve(recetaAMano))).director, enriquecer: (en: Parameters<NonNullable<typeof estudio.enriquecer>>[0], p: Parameters<NonNullable<typeof estudio.enriquecer>>[1]) => estudio.enriquecer(en, p) }, critico: estudio, comparador: estudio }
              : await sinModelos(resolve(recetaAMano))
            : { director: estudio, critico: estudio, comparador: estudio }),
        medidor,
        silueta: (f) => medidor.silueta(f),
        escena: generarEscena,
        garabato: generarGarabato,
        elemento: generarElemento,
        insertar: insertarProtegido,
        metricas: {
          ancho: (estilo, texto, tamano) => motor.medir(estilo, texto, tamano).ancho,
          mayusculas: (estilo) => motor.alturaMayusculas(estilo, 1000) / 1000,
        },
        pintar,
        leer: async (png) => (await leerCartel(png, [])).lineas,
        corpus,
        informar: (l) => console.log(paralelo > 1 ? `[${e.id}] ${l}` : l),
      },
      {
        id: e.id,
        local: e.local,
        foto,
        hechos: {
          plato: e.plato,
          elementos: e.elementos,
          local: { nombre: marca.nombre, ciudad: marca.ciudad, descripcion: marca.descripcion, tonos: marca.tonos, ...(marca.instagram ? { instagram: marca.instagram } : {}), ...(marca.web ? { web: marca.web } : {}) },
        },
        tokensMarca,
        mensaje: e.mensaje,
        creativo: e.creativo,
        direcciones,
        vueltas: recompilar || recetaAMano ? 0 : vueltas,
        salida,
        referencias: nReferencias,
        ...(referencia ? { referencia } : {}),
        ...(enriquecer ? { enriquecer } : {}),
        ...(process.argv.includes('--aislados') ? { aislados: true } : {}),
      },
    );
    // Enfrentamiento a ciegas con la pieza previa: la mejor dirección (la primera del comparador) contra ella.
    let contraPrevia: { gana: 'nueva' | 'previa'; direccion: string; motivo: string } | undefined;
    const ganadora = r.comparacion ? r.direcciones.find((d) => d.nombre === r.comparacion!.letras[r.comparacion!.orden[0] ?? '']) : r.direcciones.find((d) => d.mejor?.movil);
    if (e.previa && ganadora?.mejor?.movil && !recompilar && !recetaAMano) {
      const previaMovil = join(salida, 'previa-movil.png');
      await sharp(resolve(RAIZ, e.previa)).resize(360).png().toFile(previaMovil);
      const nuevaPrimero = createHash('sha256').update(e.id).digest()[0]! % 2 === 0;
      const par = nuevaPrimero ? [{ letra: 'A', movil: ganadora.mejor.movil }, { letra: 'B', movil: previaMovil }] : [{ letra: 'A', movil: previaMovil }, { letra: 'B', movil: ganadora.mejor.movil }];
      const c = await estudio.comparar(par);
      const gana = c.orden[0] === (nuevaPrimero ? 'A' : 'B') ? 'nueva' : 'previa';
      contraPrevia = { gana, direccion: ganadora.nombre, motivo: c.motivo };
      console.log(`  contra la pieza previa: gana la ${gana} («${ganadora.nombre}»)`);
    }
    const { mapa: _m, encargo, ...resto } = r;
    await writeFile(join(salida, 'resultado.json'), `${JSON.stringify({ corrida, modelos, segundos: Math.round((Date.now() - inicio) / 1000), encargo: { ...encargo, mapa: undefined }, ...resto, ...(contraPrevia ? { contraPrevia } : {}) }, null, 2)}\n`);
    await hoja(join(salida, 'hoja.jpg'), r, marca.nombre);
    for (const [k, en] of (r.enriquecimientos ?? []).entries()) await hojaEnriquecida(join(salida, `enriquecida${(r.enriquecimientos ?? []).length > 1 ? `-${k + 1}` : ''}.jpg`), r, en);
    await writeFile(join(salida, 'informe.md'), `${informe(r, e.id, marca.nombre, salida)}${contraPrevia ? `\n## Contra la pieza previa (a ciegas, 360 px)\n\nGana la **${contraPrevia.gana}** («${contraPrevia.direccion}» frente a \`${e.previa}\`). ${contraPrevia.motivo}\n` : ''}`);
    console.log(`→ ${relative(RAIZ, salida)} (${Math.round((Date.now() - inicio) / 1000)} s)`);
    return { id: e.id, local: marca.nombre, r };
  };
  try {
    await Promise.all(Array.from({ length: Math.min(paralelo, archivos.length) }, trabajar));
  } finally {
    resumen.push(...hechos.filter((x): x is NonNullable<typeof x> => Boolean(x)));
  }
  if (resumen.length) await hojaDeCorrida(join(DATOS, 'arte', corrida, 'resumen.jpg'), resumen);
  if (resumen.length >= 3 && !recompilar && !recetaAMano) await pruebaDePlantilla(join(DATOS, 'arte', corrida), resumen, clave, modelos, facturacion);
}

/**
 * Prueba de plantilla (informe de dirección de arte, §6.2): todas las piezas de la corrida, de locales distintos,
 * barajadas y a ciegas; un juez agrupa las que parecen la misma plantilla. Si sus grupos coinciden con nuestros
 * esqueletos, el sistema se delata.
 */
async function pruebaDePlantilla(carpeta: string, filas: Array<{ id: string; local: string; r: ResultadoEstudioDeArte }>, clave: string, modelos: string[], facturacion: boolean) {
  const piezas = filas.flatMap((f) => f.r.direcciones.filter((d) => d.mejor?.movil).map((d) => ({ encargo: f.id, direccion: d.nombre, esqueleto: d.mejor!.receta.esqueleto, movil: d.mejor!.movil! })));
  // Barajadas con una semilla fija para que la prueba se pueda repetir.
  const orden = piezas.map((p, i) => ({ p, k: createHash('sha256').update(`${p.encargo}/${p.direccion}/${i}`).digest('hex') })).sort((a, b) => (a.k < b.k ? -1 : 1)).map((x) => x.p);
  const letras = orden.map((_, i) => `P${String(i + 1).padStart(2, '0')}`);
  const cliente = new ClienteGemini(clave, modelos, { alUsar: registradorDeUso(DATOS, 'estudio-de-arte/plantilla', facturacion), tiempoMaximoMs: 240_000 });
  const r = await new EstudioArteGemini(cliente, modelos).agrupar(orden.map((p, i) => ({ letra: letras[i]!, movil: p.movil })));
  const de = (l: string) => orden[letras.indexOf(l)];
  const grupos = r.grupos.map((g) => ({ rasgo: g.rasgo, piezas: g.piezas.map((l) => ({ letra: l, ...(de(l) ? { encargo: de(l)!.encargo, direccion: de(l)!.direccion, esqueleto: de(l)!.esqueleto } : {}) })) }));
  // Cuántas parejas agrupadas comparten esqueleto (el sistema se delata) frente a las que no.
  let mismas = 0;
  let parejas = 0;
  for (const g of grupos) for (let i = 0; i < g.piezas.length; i++) for (let j = i + 1; j < g.piezas.length; j++) {
    parejas++;
    if (g.piezas[i]!.esqueleto && g.piezas[i]!.esqueleto === g.piezas[j]!.esqueleto) mismas++;
  }
  const lineas = [
    `# Prueba de plantilla · ${basename(carpeta)}`,
    '',
    `${piezas.length} piezas de ${filas.length} locales, barajadas y a ciegas (a 320 px).`,
    '',
    `**Parejas agrupadas como la misma plantilla:** ${parejas}; **de ellas, con el mismo esqueleto del estudio:** ${mismas}.`,
    '',
    ...grupos.flatMap((g) => [`- ${g.rasgo}: ${g.piezas.map((p) => `${p.letra} (${p.encargo ?? '?'} · ${p.direccion ?? '?'} · ${p.esqueleto ?? '?'})`).join(', ')}`]),
    '',
    `**¿Parecen de un mismo sistema?** ${r.sistema}`,
    '',
  ];
  await writeFile(join(carpeta, 'plantilla.md'), lineas.join('\n'));
  await writeFile(join(carpeta, 'plantilla.json'), `${JSON.stringify({ piezas: orden.map((p, i) => ({ letra: letras[i], ...p })), grupos, sistema: r.sistema, parejas, mismas }, null, 2)}\n`);
  console.log(`Prueba de plantilla: ${parejas} parejas agrupadas, ${mismas} con el mismo esqueleto → ${relative(RAIZ, join(carpeta, 'plantilla.md'))}`);
}

/** La corrida entera: una fila por encargo con la mejor versión de cada dirección, a 360 px. */
async function hojaDeCorrida(ruta: string, filas: Array<{ id: string; local: string; r: ResultadoEstudioDeArte }>) {
  const ancho = 300;
  const alto = 400;
  const pie = 44;
  const cabeza = 30;
  const columnas = Math.max(1, ...filas.map((f) => f.r.direcciones.length));
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const capas: OverlayOptions[] = [];
  const altoFila = cabeza + alto + pie + 16;
  for (const [i, f] of filas.entries()) {
    const top = i * altoFila;
    capas.push({ input: Buffer.from(`<svg width="${columnas * (ancho + 10) + 10}" height="${cabeza}"><text x="10" y="22" font-size="17" font-family="Helvetica" font-weight="bold" fill="#111">${esc(f.local)} · ${esc(f.r.encargo.mensaje)}</text></svg>`), left: 0, top });
    for (const [j, d] of f.r.direcciones.entries()) {
      const v = d.mejor;
      const left = 10 + j * (ancho + 10);
      if (v?.movil) capas.push({ input: await sharp(v.movil).resize(ancho, alto, { fit: 'contain', background: '#ddd' }).png().toBuffer(), left, top: top + cabeza });
      const texto = v ? `${d.nombre} · ${v.receta.esqueleto} · ${v.nota ?? '—'}/100${v.n > 1 ? ` (v${v.n})` : ''}` : `${d.nombre} · no compila`;
      capas.push({ input: Buffer.from(`<svg width="${ancho}" height="${pie}"><rect width="100%" height="100%" fill="#222"/><text x="8" y="27" font-size="14" font-family="Helvetica" fill="#fff">${esc(texto.slice(0, 44))}</text></svg>`), left, top: top + cabeza + alto });
    }
  }
  await sharp({ create: { width: columnas * (ancho + 10) + 10, height: filas.length * altoFila, channels: 3, background: '#f2f2f2' } }).composite(capas).jpeg({ quality: 84 }).toFile(ruta);
  console.log(`Resumen de la corrida → ${relative(RAIZ, ruta)}`);
}


/** Director, crítico y comparador que no llaman a nada: devuelven las recetas de una corrida guardada (la primera versión de cada dirección). */
async function sinModelos(ruta: string) {
  // Un resultado.json de una corrida (la primera versión de cada dirección) o un archivo con una receta o una lista.
  const guardado = JSON.parse(await readFile(ruta, 'utf8')) as { direcciones?: Array<{ vueltas: Array<{ receta: unknown }> }> } | unknown[];
  const recetas = Array.isArray(guardado)
    ? guardado.map((r) => Receta.parse(r))
    : guardado.direcciones
      ? guardado.direcciones.map((d) => Receta.parse(d.vueltas[0]!.receta))
      : [Receta.parse(guardado)];
  const neutra = { nivel: 2, motivo: 'sin crítica: recompilación sin modelos' };
  return {
    director: { nombre: 'recetas guardadas', proponer: async () => ({ direcciones: recetas }), reparar: async (_e: unknown, r: Receta) => r },
    critico: {
      nombre: 'sin crítica',
      criticar: async () => ({ primeraLectura: 'sin crítica', puntuaciones: { idea: neutra, composicion: neutra, tipografia: neutra, relacion: neutra, identidad: neutra, acabado: neutra }, defectoPrincipal: 'sin crítica (recompilación)', parches: [] }),
    },
  };
}

/** Referencia, pieza base y versiones enriquecidas, una al lado de otra, con su nota y el orden del comparador. */
async function hojaEnriquecida(ruta: string, r: ResultadoEstudioDeArte, e: NonNullable<ResultadoEstudioDeArte['enriquecimientos']>[number]) {
  const items = [...(r.encargo.referencia ? [{ nombre: `Referencia ${r.encargo.referencia.id}`, png: r.encargo.referencia.ruta, nota: undefined as number | undefined }] : []), ...e.versiones.map((v) => ({ nombre: v.nombre, png: v.png ?? '', nota: v.nota }))];
  const ancho = 360;
  const alto = 480;
  const pie = 40;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const posicion = (nombre: string) => {
    const letra = Object.entries(e.comparacion?.letras ?? {}).find(([, n]) => n === nombre)?.[0];
    const i = letra ? (e.comparacion?.orden ?? []).indexOf(letra) : -1;
    return i >= 0 ? ` · ${i + 1}.º a ciegas` : '';
  };
  const capas: OverlayOptions[] = [];
  for (const [i, it] of items.entries()) {
    const left = 10 + i * (ancho + 10);
    if (it.png) capas.push({ input: await sharp(it.png).resize(ancho, alto, { fit: 'contain', background: '#ddd' }).png().toBuffer(), left, top: 10 });
    const texto = `${it.nombre}${it.nota !== undefined ? ` · ${it.nota}/100` : ''}${posicion(it.nombre)}`;
    capas.push({ input: Buffer.from(`<svg width="${ancho}" height="${pie}"><rect width="100%" height="100%" fill="#222"/><text x="8" y="26" font-size="15" font-family="Helvetica" fill="#fff">${esc(texto.slice(0, 48))}</text></svg>`), left, top: 10 + alto });
  }
  await sharp({ create: { width: items.length * (ancho + 10) + 10, height: alto + pie + 20, channels: 3, background: '#f2f2f2' } }).composite(capas).jpeg({ quality: 86 }).toFile(ruta);
}

/** Una fila por dirección: cada vuelta a 360 px con su nota; la mejor, marcada. */
async function hoja(ruta: string, r: ResultadoEstudioDeArte, local: string) {
  const ancho = 360;
  const alto = 480;
  const pie = 64;
  const cabeza = 40;
  const filas = r.direcciones.length;
  const columnas = Math.max(1, ...r.direcciones.map((d) => d.vueltas.length));
  const capas: OverlayOptions[] = [];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  capas.push({ input: Buffer.from(`<svg width="${columnas * (ancho + 12) + 12}" height="${cabeza}"><text x="12" y="27" font-size="20" font-family="Helvetica" font-weight="bold" fill="#111">${esc(local)} · ${esc(r.encargo.mensaje)}</text></svg>`), left: 0, top: 0 });
  for (const [i, d] of r.direcciones.entries()) {
    for (const [j, v] of d.vueltas.entries()) {
      const left = 12 + j * (ancho + 12);
      const top = cabeza + i * (alto + pie + 12);
      if (v.movil) capas.push({ input: await sharp(v.movil).resize(ancho, alto, { fit: 'contain', background: '#ddd' }).png().toBuffer(), left, top });
      const mejor = d.mejor === v;
      const linea1 = `${d.nombre} · v${v.n} · ${v.receta.esqueleto}${v.nota !== undefined ? ` · ${v.nota}/100` : ''}${mejor ? ' ★' : ''}`;
      const linea2 = v.critica ? v.critica.defectoPrincipal : v.problemas[0] ?? '';
      capas.push({
        input: Buffer.from(`<svg width="${ancho}" height="${pie}"><rect width="100%" height="100%" fill="${mejor ? '#111' : '#444'}"/><text x="8" y="22" font-size="15" font-family="Helvetica" font-weight="bold" fill="#fff">${esc(linea1.slice(0, 46))}</text><text x="8" y="44" font-size="12" font-family="Helvetica" fill="#ddd">${esc(linea2.slice(0, 58))}</text><text x="8" y="59" font-size="12" font-family="Helvetica" fill="#ddd">${esc(linea2.slice(58, 116))}</text></svg>`),
        left,
        top: top + alto,
      });
    }
  }
  await sharp({ create: { width: columnas * (ancho + 12) + 12, height: cabeza + filas * (alto + pie + 12), channels: 3, background: '#f2f2f2' } }).composite(capas).jpeg({ quality: 85 }).toFile(ruta);
}

function informe(r: ResultadoEstudioDeArte, id: string, local: string, salida: string): string {
  const rel = (p?: string) => (p ? relative(salida, p) : '');
  const lineas = [
    `# Estudio de arte · ${id}`,
    '',
    `**${local}** · ${r.encargo.mensaje} · foto \`${basename(r.encargo.foto)}\`${r.encargo.cortes.length ? ` (cortada por ${r.encargo.cortes.join(' y ')})` : ''}.`,
    '',
    `Propuestas del director: ${r.propuestas}${r.devuelto.length ? ` (se le devolvieron ${r.devuelto.length} problemas)` : ''}. Referencias que vio: ${r.referencias.map((p) => `\`${p.archivo}\``).join(', ')}.`,
    '',
    '![hoja](hoja.jpg)',
    '',
    '| Dirección | Esqueleto | Idea | Notas por vuelta | Primera lectura (mejor) |',
    '|---|---|---|---|---|',
    ...r.direcciones.map((d) => `| ${d.nombre} | ${d.vueltas[0]!.receta.esqueleto}${d.mejor && d.mejor.receta.esqueleto !== d.vueltas[0]!.receta.esqueleto ? ` → ${d.mejor.receta.esqueleto}` : ''} | ${d.vueltas[0]!.receta.idea.replace(/\|/g, '/')} | ${d.vueltas.map((v) => `v${v.n}: ${v.nota ?? '✖'}${v.adoptada === false ? ' (descartada)' : ''}`).join(' · ')} | ${d.mejor?.critica?.primeraLectura.replace(/\|/g, '/') ?? '—'} |`),
    '',
  ];
  if (r.analisis) {
    const a = r.analisis as { queLaHaceFuncionar?: string[]; mejorable?: string[]; estructura?: string; elementosDibujados?: string[] };
    lineas.push(`## La referencia, estudiada por el director (${r.encargo.referencia?.id})`, '', `**Estructura:** ${a.estructura ?? '—'}`, '', '**Qué la hace funcionar:**', ...(a.queLaHaceFuncionar ?? []).map((x) => `- ${x}`), '', '**Qué se puede mejorar:**', ...(a.mejorable ?? []).map((x) => `- ${x}`), '', ...(a.elementosDibujados?.length ? ['**Elementos dibujados:**', ...a.elementosDibujados.map((x) => `- ${x}`), ''] : []));
    for (const d of r.direcciones) {
      const rc = d.vueltas[0]?.receta;
      if (rc?.parentesco || rc?.mejora) lineas.push(`- **${d.nombre}** · parentesco: ${rc.parentesco ?? '—'} · mejora: ${rc.mejora ?? '—'}`);
    }
    lineas.push('');
  }
  for (const [k, e] of (r.enriquecimientos ?? []).entries()) {
    const l = (x: string) => e.comparacion?.letras[x] ?? x;
    const hojaE = `enriquecida${(r.enriquecimientos ?? []).length > 1 ? `-${k + 1}` : ''}.jpg`;
    lineas.push(`## Acabado de «${e.direccion}»`, '', `![enriquecida](${hojaE})`, '', `**Por qué:** ${e.porque}`, '', ...(e.mejoras ?? []).map((m) => `- **${m.categoria}**: ${m.que}`), '', `**Instrucción para Nano Banana 2:** ${e.insercion}`, '');
    for (const v of e.versiones) lineas.push(`- **${v.nombre}**: ${v.nota ?? '—'}/100${v.critica ? ` · ${v.critica.defectoPrincipal}` : ''}${v.medidas.filter((m) => /^INSERCION/.test(m)).map((m) => ` · ${m}`).join('')}`);
    if (e.comparacion) lineas.push('', `A ciegas: ${e.comparacion.orden.map(l).join(' > ')}. ${e.comparacion.motivo}`);
    lineas.push('');
  }
  if (r.comparacion) {
    const l = (x: string) => r.comparacion!.letras[x] ?? x;
    lineas.push('## Comparación a ciegas (360 px)', '', `Orden: ${r.comparacion.orden.map(l).join(' > ')}.`, '', r.comparacion.plantilla.length ? `Parecen la misma plantilla: ${r.comparacion.plantilla.map((p) => p.map(l).join(' = ')).join('; ')}.` : 'Ninguna pareja parece la misma plantilla.', '', r.comparacion.motivo, '');
  }
  for (const d of r.direcciones) {
    lineas.push(`## ${d.nombre}`, '');
    for (const v of d.vueltas) {
      lineas.push(`### v${v.n}${d.mejor === v ? ' ★' : ''}${v.nota !== undefined ? ` · ${v.nota}/100` : ''}`, '');
      if (v.png) lineas.push(`![v${v.n}](${rel(v.png)})`, '');
      lineas.push(`Huella: ${Object.values(huella(v.receta)).join(' · ')}.`, '');
      lineas.push(`Lecturas: ${v.receta.lecturas.join(' → ')}.`, '');
      if (v.problemas.length) lineas.push('Problemas:', ...v.problemas.map((p) => `- ${p}`), '');
      if (v.medidas.length) lineas.push('Medidas:', ...v.medidas.map((p) => `- ${p}`), '');
      if (v.critica) {
        lineas.push(
          `Crítica: primera lectura «${v.critica.primeraLectura}».`,
          '',
          ...Object.keys(DIMENSIONES).map((k) => `- **${k}** ${v.critica!.puntuaciones[k as keyof typeof DIMENSIONES].nivel}/4: ${v.critica!.puntuaciones[k as keyof typeof DIMENSIONES].motivo}`),
          '',
          `Defecto principal: ${v.critica.defectoPrincipal}`,
          '',
          ...(v.critica.parches.length ? ['Parches:', ...v.critica.parches.map((p) => `- (${p.mejora}) ${p.cambio}`), ''] : []),
        );
      }
    }
  }
  return `${lineas.join('\n')}\n`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
