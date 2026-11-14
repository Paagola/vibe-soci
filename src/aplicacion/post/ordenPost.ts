/**
 * ORDEN ÚNICA de punta a punta (09/11/2026): de la foto subida al post exportado, con paradas para confirmar.
 *
 *   REFERENCIA       exige la referencia mientras el local tenga menos de 5 piezas (comprobarReferencia)
 *   FOTO_REAL        registra la foto subida como activo REAL
 *   PROPUESTA        el director rellena la plantilla de foto nueva; el código comprueba «otra toma» y lo demás
 *   CONFIRMAR_ELEMENTOS  ■ parada: confirmas los elementos, el prompt y el gasto (como mucho 2 intentos)
 *   GENERAR          la foto nueva (Gemini de pago, con el tope del código), o la que importes a mano
 *   COMPROBAR        comprobación de salida automática; DESCARTA → otro intento; 2 seguidos → se para
 *   CONFIRMAR_FOTO   ■ parada: confirmas la foto (o la rechazas con motivo)
 *   MASCARA          la máscara del sujeto
 *   INTENCION        la intención de diseño: la escribe el director de diseño (F3) desde la ficha de la referencia y el
 *                    mapa de la foto, y pasa a post.json solo si cumple todo lo comprobable; si no hay director o no
 *                    pasa, deja un borrador y se para (la escribe una persona)
 *   COMPONER         compositor, exportación 3:4 y 4:5, hojas de revisión
 *   HECHO            el plan se marca como pieza (cuenta para el umbral de 5)
 *
 * Cada llamada a `avanzar` sigue hasta la siguiente parada o bloqueo y guarda el estado en <proyecto>/post.json.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { Activo } from '../../dominio/activos.js';
import { Intencion, Tokens } from '../../dominio/diseno/intencion.js';
import type { HechosDeLaPieza } from '../../dominio/diseno/propuesta.js';
import { ErrorDeServicio, ErrorDeUsuario } from '../../dominio/errores.js';
import type { Marca } from '../../dominio/modelos.js';
import { proponerDiseno, type DepsProponerDiseno, type EntradaDiseno, type PruebaDeIntencion, type ResultadoDiseno } from '../diseno/proponerDiseno.js';
import { montarPromptFotoNueva, problemasFotoNueva, PropuestaFotoNueva } from '../../dominio/fotoNueva.js';
import { EncargoPost, MAX_INTENTOS_SEGUIDOS, PARADAS, trasComprobar, type IntentoFoto, type PasoPost } from '../../dominio/post.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ComponedorDePiezas } from '../../puertos/ComponedorDePiezas.js';
import type { DirectorDeFoto, GeneradorFoto, PeticionFoto, Segmentador } from '../../puertos/Foto.js';
import type { RevisorVisual } from '../../puertos/RevisorVisual.js';
import { comprobarFotoNueva } from '../fotos/comprobarFotoNueva.js';
import { proponerFotoNueva } from '../fotos/proponerFotoNueva.js';
import { comprobarReferencia } from '../referencias/comprobarReferencia.js';
import type { DepsReferencias } from '../referencias/dependencias.js';

export interface DepsPost {
  /** Raíz del repositorio (para marcas/ y rutas relativas). */
  raiz: string;
  /** Carpeta de los proyectos (proyectos/ o, en simulado, datos-simulado/proyectos/). */
  proyectos: string;
  activos: AlmacenActivos;
  referencias: DepsReferencias;
  director: DirectorDeFoto;
  generador: GeneradorFoto;
  revisor: RevisorVisual;
  segmentador: Segmentador;
  componedor: ComponedorDePiezas;
  /**
   * F3: el director de diseño y el medidor de la foto. Sin ellos, INTENCION deja un borrador y se para (la escribe una
   * persona). La prueba en el compositor la pone la orden, con el mismo componedor.
   */
  disenador?: Omit<DepsProponerDiseno, 'probar'>;
  ahora: () => string;
}

export interface Accion {
  confirmo?: boolean;
  rechazo?: string;
  /** Ruta de una foto hecha a mano para el paso GENERAR (sin facturación, o por el MCP). */
  importar?: string;
}

export interface ResultadoAvance {
  encargo: EncargoPost;
  /** Lo que ha pasado, en orden. */
  mensajes: string[];
  /** Por qué se ha parado (parada, bloqueo o fin). */
  parada: string;
}

const ASPECTO = '3:4';
const TAMANO = '2K';
const ETIQUETA_REAL = '@image1 (real photograph of the dish)';

export const rutaEncargo = (deps: DepsPost, proyecto: string) => join(deps.proyectos, proyecto, 'post.json');
const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

export async function leerEncargo(deps: Pick<DepsPost, 'proyectos'>, proyecto: string): Promise<EncargoPost> {
  const ruta = join(deps.proyectos, proyecto, 'post.json');
  if (!(await existe(ruta))) throw new ErrorDeUsuario(`No existe el encargo «${proyecto}». Créalo con: npm run post -- nuevo ${proyecto} --local … --foto … --plato "…" --referencia …`);
  return EncargoPost.parse(JSON.parse(await readFile(ruta, 'utf8')));
}

export async function guardarEncargo(deps: DepsPost, e: EncargoPost): Promise<void> {
  await mkdir(join(deps.proyectos, e.proyecto), { recursive: true });
  await writeFile(rutaEncargo(deps, e.proyecto), `${JSON.stringify(EncargoPost.parse(e), null, 2)}\n`);
}

export async function crearEncargo(
  deps: DepsPost,
  datos: {
    proyecto: string;
    local: string;
    plato: string;
    foto: string;
    referencia?: string;
    usoFotoReal?: 'PUBLICABLE' | 'SOLO_PRUEBA_COMPOSICION';
    simulado?: boolean;
    titularCreativo?: boolean;
  },
): Promise<EncargoPost> {
  if (await existe(rutaEncargo(deps, datos.proyecto))) throw new ErrorDeUsuario(`El encargo «${datos.proyecto}» ya existe: continúa con npm run post -- ${datos.proyecto}`);
  if (!(await existe(resolve(deps.raiz, datos.foto)))) throw new ErrorDeUsuario(`No encuentro la foto «${datos.foto}».`);
  await deps.referencias.locales.obtener(datos.local); // el local tiene que existir y ser válido
  const ahora = deps.ahora();
  const encargo = EncargoPost.parse({
    esquema: 'post/encargo@1',
    proyecto: datos.proyecto,
    local: datos.local,
    plato: datos.plato,
    fotoSubida: datos.foto,
    usoFotoReal: datos.usoFotoReal ?? 'PUBLICABLE',
    ...(datos.referencia ? { referencia: datos.referencia } : {}),
    simulado: datos.simulado ?? false,
    titularCreativo: datos.titularCreativo ?? false,
    creadoEn: ahora,
    historial: [{ fecha: ahora, paso: 'REFERENCIA', nota: 'encargo creado' }],
  });
  await guardarEncargo(deps, encargo);
  return encargo;
}

export interface OpcionesAvance {
  /** Se llama justo antes de ejecutar cada paso: para que la capa de entrada (la web) enseñe por dónde va. */
  alEmpezarPaso?: (paso: PasoPost, encargo: EncargoPost) => void;
}

/** Avanza el encargo hasta la siguiente parada o bloqueo. */
export async function avanzar(deps: DepsPost, proyecto: string, accion: Accion = {}, opciones: OpcionesAvance = {}): Promise<ResultadoAvance> {
  let e = await leerEncargo(deps, proyecto);
  const mensajes: string[] = [];
  const nota = (texto: string) => {
    mensajes.push(texto);
    e.historial.push({ fecha: deps.ahora(), paso: e.paso, nota: texto });
  };
  let usada = false; // la acción (--confirmo, --rechazo, --importar) vale para un solo paso

  for (let vueltas = 0; vueltas < 30; vueltas++) {
    if (e.bloqueo && !(accion.confirmo && e.paso === 'CONFIRMAR_ELEMENTOS' && !usada)) {
      await guardarEncargo(deps, e);
      return { encargo: e, mensajes, parada: `BLOQUEADO en ${e.paso}: ${e.bloqueo}` };
    }
    const paso: PasoPost = e.paso;
    if (paso === 'HECHO') {
      await guardarEncargo(deps, e);
      return { encargo: e, mensajes, parada: 'HECHO' };
    }
    const accionAhora = usada ? {} : accion;
    opciones.alEmpezarPaso?.(paso, e);
    const r = await PASOS[paso](deps, e, accionAhora, nota);
    if (r.usaAccion) usada = true;
    e = r.encargo;
    await guardarEncargo(deps, e);
    if (r.parar) return { encargo: e, mensajes, parada: r.parar };
  }
  throw new Error('La orden no avanza (más de 30 pasos seguidos).');
}

type Nota = (texto: string) => void;
type ResultadoPaso = { encargo: EncargoPost; parar?: string; usaAccion?: boolean };
type Paso = (deps: DepsPost, e: EncargoPost, accion: Accion, nota: Nota) => Promise<ResultadoPaso>;

const ir = (e: EncargoPost, paso: PasoPost, cambios: Partial<EncargoPost> = {}): EncargoPost => ({ ...e, ...cambios, paso });

const PASOS: Record<Exclude<PasoPost, 'HECHO'>, Paso> = {
  async REFERENCIA(deps, e, _a, nota) {
    const estado = await comprobarReferencia(deps.referencias, { local: e.local, ...(e.referencia ? { referencia: e.referencia } : {}) });
    if (!estado.paso.puede) {
      const familias = estado.propuestas.map((f) => `${f.id} ${f.nombre} (${f.posts.join(', ')})`).join(' · ');
      // No se guarda como bloqueo: se vuelve a comprobar cada vez, así que basta con registrar la referencia y relanzar.
      return {
        encargo: e,
        parar: `FALTA LA REFERENCIA: ${estado.paso.motivo}${familias ? ` Familias propuestas: ${familias}.` : ''} Regístrala (npm run referencia -- registrar …), ponla en "referencia" de post.json y vuelve a lanzar la orden.`,
      };
    }
    nota(`Referencia: ${estado.paso.motivo} (${estado.piezasReales} piezas del local; obligatoria hasta ${estado.umbral}).`);
    return { encargo: ir(e, 'FOTO_REAL') };
  },

  async FOTO_REAL(deps, e, _a, nota) {
    const id = `${e.proyecto}-real`;
    if (!(await deps.activos.existe(e.local, id))) {
      const origen = resolve(deps.raiz, e.fotoSubida);
      const bytes = await readFile(origen);
      const meta = await sharp(bytes).metadata();
      const sha = createHash('sha256').update(bytes).digest('hex');
      const archivo = `original${extname(origen).toLowerCase() || '.jpg'}`;
      await deps.activos.crear(
        Activo.parse({
          id,
          localSlug: e.local,
          tipo: 'REAL',
          uso: e.usoFotoReal,
          descripcion: `Foto subida para el encargo ${e.proyecto}: ${e.plato}`,
          archivo,
          ancho: meta.width,
          alto: meta.height,
          sha256: sha,
          procedencia: { ruta: relative(deps.raiz, origen), sha256: sha, copiadoEn: deps.ahora() },
          alteraciones: [],
          niveles: [],
        }),
        { [archivo]: bytes },
      );
      nota(`Foto subida registrada como activo ${id} (${meta.width} × ${meta.height} px).`);
    }
    return { encargo: ir(e, 'PROPUESTA', { activoReal: id }) };
  },

  async PROPUESTA(deps, e, _a, nota) {
    const real = await deps.activos.obtener(e.local, e.activoReal as string);
    let referencia: { id: string; resumen: string; imagen?: string } | undefined;
    if (e.referencia) {
      const r = await deps.referencias.referencias.obtener(e.local, e.referencia);
      const f = r.ficha;
      const imagen = r.origen.archivo; // la imagen o captura guardada (en un enlace bloqueado, no hay)
      referencia = {
        id: r.id,
        resumen: f ? [f.titulo, f.familia, `capas: ${f.capas.join(' / ')}`, `retícula: ${f.reticula}`].join(' · ') : 'sin ficha',
        ...(imagen ? { imagen: deps.referencias.referencias.rutaArchivo(e.local, r.id, imagen) } : {}),
      };
    }
    const resultado = await proponerFotoNueva(deps.director, { foto: real.ruta, plato: e.plato, ...(referencia ? { referencia } : {}) });
    const archivo = 'foto/propuesta.json';
    await mkdir(join(deps.proyectos, e.proyecto, 'foto'), { recursive: true });
    await writeFile(join(deps.proyectos, e.proyecto, archivo), `${JSON.stringify({ director: deps.director.nombre, fecha: deps.ahora(), ...resultado }, null, 2)}\n`);
    nota(`Propuesta del director (${resultado.intentos.length} intento(s))${resultado.problemas.length ? `, con problemas: ${resultado.problemas.join(' | ')}` : ''}.`);
    return { encargo: ir(e, 'CONFIRMAR_ELEMENTOS', { propuesta: { archivo, prompt: resultado.prompt, problemas: resultado.problemas } }) };
  },

  async CONFIRMAR_ELEMENTOS(deps, e, accion, nota) {
    // La propuesta se puede corregir a mano (huecos y descripción) antes de confirmar: se vuelve a leer y a comprobar.
    const ruta = join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? 'foto/propuesta.json');
    const guardada = JSON.parse(await readFile(ruta, 'utf8')) as { propuesta: unknown };
    const propuesta = PropuestaFotoNueva.parse(guardada.propuesta);
    const real = await deps.activos.obtener(e.local, e.activoReal as string);
    const problemas = problemasFotoNueva(propuesta, { ancho: real.activo.ancho, alto: real.activo.alto });
    const prompt = montarPromptFotoNueva(propuesta.huecos);
    await writeFile(ruta, `${JSON.stringify({ ...guardada, propuesta, prompt, problemas }, null, 2)}\n`);
    const encargo = { ...e, propuesta: { archivo: e.propuesta?.archivo ?? 'foto/propuesta.json', prompt, problemas } };

    const disponible = deps.generador.disponible();
    const estimado = disponible.ok ? await deps.generador.estimarUsd(peticion(e, real.ruta, prompt, 0)) : 0;
    const elementos = propuesta.descripcion.elementos.map((x) => `${x.nombre}${x.recuento !== null ? ` ×${x.recuento}` : ''} (${x.estado})`).join('; ');
    if (!accion.confirmo) {
      return {
        encargo,
        parar: [
          'CONFIRMA LOS ELEMENTOS Y EL GASTO',
          `  Elementos: ${elementos}`,
          `  Cámara: de ${propuesta.descripcion.anguloGrados}° a ${propuesta.huecos.camara.anguloGrados}° · ${propuesta.huecos.camara.descripcion}`,
          `  Prompt: ${prompt}`,
          problemas.length ? `  PROBLEMAS (hay que corregirlos en ${relative(deps.raiz, ruta)} antes de confirmar): ${problemas.join(' | ')}` : '  Cumple la plantilla y la regla «otra toma».',
          disponible.ok
            ? `  Gasto: ≤ ${estimado.toFixed(3)} USD por intento con ${deps.generador.nombre}, como mucho ${MAX_INTENTOS_SEGUIDOS} intentos seguidos.`
            : `  Generación por la API no disponible: ${disponible.motivo}.`,
          `  Para corregir: edita ${relative(deps.raiz, ruta)} («propuesta»). Para seguir: --confirmo`,
        ].join('\n'),
      };
    }
    if (problemas.length) return { encargo, parar: `No se puede confirmar con problemas: ${problemas.join(' | ')}. Corrige ${relative(deps.raiz, ruta)}.`, usaAccion: true };
    nota(`Confirmado: elementos, prompt y hasta ${MAX_INTENTOS_SEGUIDOS} intentos${disponible.ok ? ` (≤ ${estimado.toFixed(3)} USD cada uno)` : ''}.`);
    const { bloqueo: _fuera, ...sinBloqueo } = encargo;
    return {
      encargo: ir(sinBloqueo as EncargoPost, 'GENERAR', { autorizacion: { fecha: deps.ahora(), maxIntentos: MAX_INTENTOS_SEGUIDOS, estimadoPorIntentoUsd: estimado } }),
      usaAccion: true,
    };
  },

  async GENERAR(deps, e, accion, nota) {
    const real = await deps.activos.obtener(e.local, e.activoReal as string);
    const n = e.intentos.length + 1;
    const id = `${e.proyecto}-foto-${n}`;
    const prompt = e.propuesta?.prompt ?? '';
    let bytes: Buffer;
    let generacion: { modelo: string; costeUsd: number; tarifa: string };
    if (accion.importar) {
      bytes = await readFile(resolve(deps.raiz, accion.importar));
      generacion = { modelo: 'importada a mano (fuera de la orden)', costeUsd: 0, tarifa: `importada de ${accion.importar}; el coste, si lo hubo, no pasa por la orden` };
      nota(`Foto del intento ${n} importada de ${accion.importar}.`);
    } else {
      const disponible = deps.generador.disponible();
      if (!disponible.ok) {
        return { encargo: e, parar: `No puedo generar: ${disponible.motivo}. Prompt para generarla a mano: ${relative(deps.raiz, join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? ''))}. Después: --importar <imagen>` };
      }
      const foto = await deps.generador.generar(peticion(e, real.ruta, prompt, n));
      bytes = foto.bytes;
      generacion = { modelo: foto.modelo, costeUsd: foto.costeUsd, tarifa: foto.detalle };
      nota(`Intento ${n} generado con ${deps.generador.nombre} (${foto.modelo}): ${foto.costeUsd.toFixed(4)} USD.`);
    }
    const meta = await sharp(bytes).metadata();
    const extension = meta.format === 'jpeg' ? 'jpg' : (meta.format ?? 'png');
    const archivo = `original.${extension}`;
    const sha = createHash('sha256').update(bytes).digest('hex');
    await deps.activos.crear(
      Activo.parse({
        id,
        localSlug: e.local,
        tipo: 'GENERADO',
        uso: 'SOLO_PRUEBA_COMPOSICION',
        descripcion: `Foto nueva del encargo ${e.proyecto}, intento ${n}: ${e.plato}`,
        archivo,
        ancho: meta.width,
        alto: meta.height,
        sha256: sha,
        procedencia: {
          ruta: relative(deps.raiz, join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? '')),
          sha256: sha,
          copiadoEn: deps.ahora(),
          generacion: {
            modelo: generacion.modelo,
            requestId: `sin-id-${sha.slice(0, 12)}`,
            promptArchivo: relative(deps.raiz, join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? '')),
            prompt,
            parametros: { aspectRatio: ASPECTO, imageSize: TAMANO, intento: n, orden: 'post' },
            referencias: [{ activo: e.activoReal as string, sha256: real.activo.sha256 }],
            costeEstimadoUsd: generacion.costeUsd,
            tarifa: generacion.tarifa,
            generadoEn: deps.ahora(),
          },
        },
        alteraciones: ['Cámara, luz, encuadre y colocación nuevos (plantilla de foto nueva, regla «otra toma»).', 'Superficie y fondo libres.'],
        niveles: [],
      }),
      { [archivo]: bytes },
    );
    const intento: IntentoFoto = { n, activo: id, final: 'PENDIENTE', motivos: [], costeUsd: generacion.costeUsd };
    return { encargo: ir(e, 'COMPROBAR', { intentos: [...e.intentos, intento] }), usaAccion: Boolean(accion.importar) };
  },

  async COMPROBAR(deps, e, _a, nota) {
    const ultimo = e.intentos[e.intentos.length - 1] as IntentoFoto;
    const guardada = JSON.parse(await readFile(join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? ''), 'utf8')) as { propuesta: unknown };
    const propuesta = PropuestaFotoNueva.parse(guardada.propuesta);
    const lista = `${propuesta.huecos.elementos.replace(/[.\s]+$/, '')}. ${propuesta.huecos.recuento}`;
    const piezas = propuesta.descripcion.elementos.filter((x) => x.recuento !== null && x.recuento > 0).map((x) => ({ nombre: x.nombre, esperado: x.recuento as number }));
    const revision = await comprobarFotoNueva(
      { activos: deps.activos, revisor: deps.revisor, ahora: deps.ahora },
      { local: e.local, generado: ultimo.activo, real: e.activoReal as string, lista, piezas },
    );
    const intentos = e.intentos.map((i) => (i.n === ultimo.n ? { ...i, final: revision.final, motivos: revision.motivos } : i));
    nota(`Comprobación del intento ${ultimo.n}: ${revision.final}${revision.motivos.length ? ` (${revision.motivos.join('; ')})` : ''}.`);
    const siguiente = trasComprobar(revision.final, intentos, e.autorizacion?.maxIntentos);
    return { encargo: ir(e, siguiente.paso, { intentos, ...(siguiente.bloqueo ? { bloqueo: siguiente.bloqueo } : {}) }) };
  },

  async CONFIRMAR_FOTO(deps, e, accion, nota) {
    const ultimo = e.intentos[e.intentos.length - 1] as IntentoFoto;
    const foto = await deps.activos.obtener(e.local, ultimo.activo);
    if (accion.rechazo) {
      const intentos = e.intentos.map((i) => (i.n === ultimo.n ? { ...i, final: 'RECHAZADA' as const, motivos: [...i.motivos, `rechazada por ti: ${accion.rechazo}`] } : i));
      nota(`Intento ${ultimo.n} rechazado: ${accion.rechazo}.`);
      const siguiente = trasComprobar('DESCARTA', intentos, e.autorizacion?.maxIntentos);
      return { encargo: ir(e, siguiente.paso, { intentos, ...(siguiente.bloqueo ? { bloqueo: siguiente.bloqueo } : {}) }), usaAccion: true };
    }
    if (!accion.confirmo) {
      return {
        encargo: e,
        parar: [
          'MIRA LA FOTO Y CONFIRMA',
          `  Foto: ${relative(deps.raiz, foto.ruta)}`,
          `  Comprobación automática: ${ultimo.final}${ultimo.motivos.length ? ` · ${ultimo.motivos.join('; ')}` : ''}`,
          '  Si los elementos y la toma están bien: --confirmo · si no: --rechazo "motivo"',
        ].join('\n'),
      };
    }
    await deps.activos.actualizar(e.local, ultimo.activo, {
      fidelidad: {
        frente: e.activoReal as string,
        veredicto: 'CONSERVA',
        metodo: `revisión humana en la orden única, tras la comprobación automática (${ultimo.final})`,
        medidas: {},
        notas: ultimo.motivos,
        revisadoEn: deps.ahora(),
      },
    });
    nota(`Foto del intento ${ultimo.n} confirmada.`);
    return { encargo: ir(e, 'MASCARA', { fotoElegida: ultimo.activo }), usaAccion: true };
  },

  async MASCARA(deps, e, _a, nota) {
    const foto = await deps.activos.obtener(e.local, e.fotoElegida as string);
    if (!foto.activo.mascara) {
      const png = await deps.segmentador.mascara(foto.ruta);
      const recortada = await sharp(png).trim({ background: '#000000', threshold: 40 }).toBuffer({ resolveWithObject: true });
      const bbox = { x: -(recortada.info.trimOffsetLeft ?? 0), y: -(recortada.info.trimOffsetTop ?? 0), w: recortada.info.width, h: recortada.info.height };
      await deps.activos.actualizar(
        e.local,
        foto.activo.id,
        { mascara: { archivo: 'mascara.png', metodo: deps.segmentador.metodo, creadaEn: deps.ahora(), bbox, incluye: `lo que detecte ${deps.segmentador.metodo}` } },
        { 'mascara.png': png },
      );
      nota(`Máscara del sujeto (${deps.segmentador.metodo}): caja ${bbox.w} × ${bbox.h} px.`);
    }
    return { encargo: ir(e, 'INTENCION') };
  },

  async INTENCION(deps, e, _a, nota) {
    const carpeta = join(deps.proyectos, e.proyecto);
    const tokens = join(deps.raiz, 'marcas', e.local, 'tokens.json');
    if (!(await existe(tokens))) return { encargo: e, parar: `Falta marcas/${e.local}/tokens.json (los colores y estilos de la marca para el compositor).` };
    const plan = join(carpeta, 'plan.json');
    if (!(await existe(plan))) {
      await writeFile(
        plan,
        `${JSON.stringify({ nota: `Encargo ${e.proyecto} (orden única). Referencia: ${e.referencia ?? 'ninguna'}.`, local: e.local, marca: relative(carpeta, tokens), diapositivas: [{ intencion: 'intenciones/post.json' }] }, null, 2)}\n`,
      );
    }
    const intencion = join(carpeta, 'intenciones', 'post.json');
    if (!(await existe(intencion))) {
      await mkdir(join(carpeta, 'intenciones'), { recursive: true });
      const borrador = join(carpeta, 'intenciones', 'post.borrador.json');
      const marca = await deps.referencias.locales.obtener(e.local);
      let motivo = 'no hay director de diseño';
      // F3: la escribe el director. Una propuesta solo pasa a post.json si cumple todo lo comprobable.
      if (deps.disenador) {
        const archivoPropuesta = join(carpeta, 'intenciones', 'post.propuesta.json');
        if (await existe(archivoPropuesta)) {
          motivo = `ya hay una propuesta del director que no pasó (${relative(deps.raiz, archivoPropuesta)}); bórrala para pedir otra`;
        } else {
          try {
            const r = await disenarIntencion(deps, deps.disenador, e, marca, tokens);
            await writeFile(
              archivoPropuesta,
              `${JSON.stringify({ director: deps.disenador.director.nombre, critico: deps.disenador.critico?.nombre ?? null, fecha: deps.ahora(), propuesta: r.propuesta, problemas: r.problemas, avisos: r.avisos, critica: r.critica ?? null, intentos: r.intentos, mapa: { sujeto: r.mapa.sujeto, libres: r.mapa.libres, vivo: r.mapa.vivo } }, null, 2)}\n`,
            );
            if (r.intencion && r.problemas.length === 0) {
              await writeFile(intencion, `${JSON.stringify(r.intencion, null, 2)}\n`);
              const critica = r.critica ? ` Crítica visual: ${r.critica.llega ? 'llega al oficio de la referencia' : `no llega (${r.critica.motivos.join('; ')})`}${r.critica.adoptada ? '; se adopta su corrección' : ''}.` : '';
              nota(`Intención escrita por ${deps.disenador.director.nombre} (${r.intentos.length} propuesta(s))${r.avisos.length ? `, con avisos: ${r.avisos.join(' | ')}` : ''}.${critica}`);
              return { encargo: ir(e, 'COMPONER') };
            }
            if (r.intencion) await writeFile(borrador, `${JSON.stringify(r.intencion, null, 2)}\n`);
            motivo = `la propuesta del director no pasa las comprobaciones: ${r.problemas.join(' | ')}`;
          } catch (error) {
            if (!(error instanceof ErrorDeServicio || error instanceof ErrorDeUsuario)) throw error;
            motivo = `el director de diseño no ha podido responder (${error.message})`;
          }
        }
      }
      if (!(await existe(borrador))) await writeFile(borrador, `${JSON.stringify(intencionBorrador(e, marca.nombre), null, 2)}\n`);
      nota(`Falta la intención de diseño: ${motivo}. Hay un borrador.`);
      return {
        encargo: e,
        parar: `FALTA LA INTENCIÓN DE DISEÑO: ${motivo}. Parte de la ficha de la referencia ${e.referencia ?? ''} y del borrador ${relative(deps.raiz, borrador)}; guárdala como ${relative(deps.raiz, intencion)} y vuelve a lanzar la orden.`,
      };
    }
    Intencion.parse(JSON.parse(await readFile(intencion, 'utf8')));
    return { encargo: ir(e, 'COMPONER') };
  },

  async COMPONER(deps, e, _a, nota) {
    const carpeta = join(deps.proyectos, e.proyecto);
    const pieza = await deps.componedor.componer(carpeta, { etiqueta: 'orden-post' });
    const errores = pieza.diapositivas.flatMap((d) => d.problemas.filter((p) => p.gravedad === 'ERROR').map((p) => `${d.id} v${d.version}: ${p.tipo}: ${p.mensaje}`));
    if (errores.length) {
      return { encargo: e, parar: `El compositor da errores: ${errores.join(' | ')}. Corrige la intención, sube su versión y vuelve a lanzar la orden.` };
    }
    const plan = join(carpeta, 'plan.json');
    const contenido = JSON.parse(await readFile(plan, 'utf8')) as Record<string, unknown>;
    await writeFile(plan, `${JSON.stringify({ ...contenido, pieza: { fecha: deps.ahora().slice(0, 10), ...(e.referencia ? { referencia: e.referencia } : {}) } }, null, 2)}\n`);
    for (const d of pieza.diapositivas) nota(`Compuesta ${d.id} v${d.version}: ${relative(deps.raiz, join(d.carpeta, 'exportadas'))} (3:4 y 4:5).`);
    nota(`Hojas de revisión: ${relative(deps.raiz, pieza.revision)}. La pieza cuenta para el umbral de referencia.`);
    return { encargo: ir(e, 'HECHO') };
  },
};

/** Reúne lo que el director de diseño necesita (hechos, referencia, foto, tokens) y le pide la intención. */
async function disenarIntencion(deps: DepsPost, disenador: Omit<DepsProponerDiseno, 'probar'>, e: EncargoPost, marca: Marca, rutaTokens: string): Promise<ResultadoDiseno> {
  const foto = await deps.activos.obtener(e.local, e.fotoElegida as string);
  const guardada = JSON.parse(await readFile(join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? 'foto/propuesta.json'), 'utf8')) as { propuesta: unknown };
  const propuestaFoto = PropuestaFotoNueva.parse(guardada.propuesta);
  const hechos: HechosDeLaPieza = {
    plato: e.plato,
    elementos: propuestaFoto.descripcion.elementos.map((x) => ({ nombre: x.nombre, estado: x.estado, recuento: x.recuento })),
    local: {
      nombre: marca.nombre,
      ciudad: marca.ciudad,
      descripcion: marca.descripcion,
      tonos: marca.tonos,
      ...(marca.instagram ? { instagram: marca.instagram } : {}),
      ...(marca.web ? { web: marca.web } : {}),
    },
  };
  let referencia: EntradaDiseno['referencia'];
  if (e.referencia) {
    const r = await deps.referencias.referencias.obtener(e.local, e.referencia);
    const imagen = r.origen.archivo;
    referencia = { id: r.id, ...(r.ficha ? { ficha: r.ficha } : {}), ...(imagen ? { imagen: deps.referencias.referencias.rutaArchivo(e.local, r.id, imagen) } : {}) };
  }
  const tokensMarca = Tokens.parse(JSON.parse(await readFile(rutaTokens, 'utf8')));
  return proponerDiseno(
    { ...disenador, probar: (intencion) => probarIntencion(deps, e, rutaTokens, intencion) },
    {
      id: 'post',
      version: 1,
      titulo: `${marca.nombre} · ${cortarPorPalabras(e.plato, 60)}`,
      marca: e.local,
      foto,
      hechos,
      tokensMarca,
      ...(referencia ? { referencia } : {}),
      titularCreativo: e.titularCreativo,
    },
  );
}

/**
 * Compone la intención en borrador (carpeta temporal, se sobrescribe) y devuelve lo que dice el compositor:
 * los ERROR (y los fallos de resolución) impiden usarla; los AVISO se le devuelven al director.
 */
async function probarIntencion(deps: DepsPost, e: EncargoPost, rutaTokens: string, intencion: Intencion): Promise<PruebaDeIntencion> {
  const carpeta = join(tmpdir(), 'estudio-contenido-propuestas', `${e.simulado ? 'simulado' : 'real'}--${e.proyecto}`);
  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, 'plan.json'), `${JSON.stringify({ nota: `Prueba de la propuesta del director para ${e.proyecto}.`, local: e.local, marca: rutaTokens, diapositivas: [{ intencion: 'intencion.json' }] }, null, 2)}\n`);
  await writeFile(join(carpeta, 'intencion.json'), `${JSON.stringify(intencion, null, 2)}\n`);
  try {
    const pieza = await deps.componedor.componer(carpeta, { borrador: true, etiqueta: 'propuesta' });
    const problemas = pieza.diapositivas.flatMap((d) => d.problemas);
    const png = pieza.diapositivas[0]?.png;
    return {
      errores: problemas.filter((p) => p.gravedad === 'ERROR').map((p) => `${p.tipo}: ${p.mensaje}`),
      avisos: problemas.filter((p) => p.gravedad === 'AVISO').map((p) => `${p.tipo}: ${p.mensaje}`),
      ...(png ? { png } : {}),
    };
  } catch (error) {
    if (error instanceof RangeError) return { errores: [`El compositor no puede resolverla: ${error.message}`], avisos: [] };
    throw error;
  }
}

/** La petición que la orden manda al generador para el intento `n` (también sirve para estimar su coste antes de autorizarlo). */
export function peticion(e: EncargoPost, rutaReal: string, prompt: string, n: number): PeticionFoto {
  return { id: `${e.proyecto}-foto-${n}`, prompt, referencias: [{ ruta: rutaReal, etiqueta: ETIQUETA_REAL }], aspectRatio: ASPECTO, tamano: TAMANO };
}

/** Como mucho `max` caracteres, sin partir palabras. */
export function cortarPorPalabras(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max + 1).lastIndexOf(' ');
  return texto.slice(0, corte > 0 ? corte : max).trim();
}

/** Un punto de partida válido para el compositor, NO un diseño: la persona lo rehace desde la ficha de la referencia. */
export function intencionBorrador(e: EncargoPost, nombreLocal: string) {
  return {
    esquema: 'diseno/intencion@1',
    id: 'post',
    version: 1,
    titulo: `${nombreLocal} · ${e.plato}`,
    notas: `BORRADOR de la orden única: la foto a sangre, un titular y la marca. Rehazlo desde la ficha de la referencia ${e.referencia ?? ''} (qué se toma y qué no se copia) antes de componer.`,
    marca: e.local,
    tokens: {
      colores: { fondo: '#111111', claro: '#F2EEE8' },
      estilos: {
        titular: { fuente: 'archivo', ejes: { wdth: 75, wght: 800 }, caso: 'mayusculas', tracking: 0, interlineado: 0.9, color: '@claro' },
        firma: { fuente: 'archivo', ejes: { wdth: 62, wght: 600 }, caso: 'mayusculas', tracking: 0.2, interlineado: 1.3, color: '@claro' },
      },
    },
    activos: { foto: e.fotoElegida },
    textos: { titular: cortarPorPalabras(e.plato, 40), firma: nombreLocal },
    capas: [
      { id: 'fondo', tipo: 'relleno', color: '@fondo' },
      { id: 'foto', tipo: 'imagen', activo: 'foto', caja: { x: 0, y: 0, w: 1, h: 1 } },
      { id: 'velo', tipo: 'degradado', forma: 'lineal', caja: { x: 0, y: 0.6, w: 1, h: 0.4 }, angulo: 90, paradas: [{ en: 0, color: '@fondo', opacidad: 0 }, { en: 1, color: '@fondo', opacidad: 0.85 }] },
      { id: 'titular', tipo: 'texto', texto: '@titular', estilo: 'titular', caja: { x: 0.067, y: 0.76, w: 0.866, h: 0.1 }, ajuste: 'ancho' },
      { id: 'firma', tipo: 'texto', texto: '@firma', estilo: 'firma', caja: { x: 0.067, y: 0.885, w: 0.866, h: 0.024 }, ajuste: 'fijo', tamano: 34 },
    ],
  };
}

export { PARADAS };
