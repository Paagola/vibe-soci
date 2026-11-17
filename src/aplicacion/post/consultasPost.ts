/**
 * Lectura de los encargos de la orden única para la web: la lista y todo lo que hace falta para pintar un encargo
 * (referencia, propuesta del director, intentos de foto, intención de diseño y versiones compuestas).
 *
 * No llama a ninguna IA ni escribe nada: solo lee los ficheros del encargo y aplica las reglas puras del dominio.
 * Así la pantalla se puede abrir cuantas veces haga falta sin gastar ni cambiar el estado.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { leerRevisionEntrega, type RevisionEntrega } from '../productor/revisarEntrega.js';
import { direccionParaLaFoto } from '../productor/editorial.js';
import { generacionPendienteDeImportacion } from './recuperarGeneracion.js';
import { revisionDeEncargo } from '../productor/revision.js';
import type { BriefDelEncargo } from '../../dominio/brief.js';
import type { Activo } from '../../dominio/activos.js';
import { Intencion, Tokens } from '../../dominio/diseno/intencion.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { esOtraToma, PropuestaFotoNueva, type OpcionesDePrompt } from '../../dominio/fotoNueva.js';
import { explicarBloqueo, type Explicacion } from '../../dominio/explicaciones.js';
import type { Marca } from '../../dominio/modelos.js';
import { opcionesDeRevision, revisarPropuesta, textoDeMarca } from '../../dominio/promptFiel.js';
import { EncargoPost, MAX_INTENTOS_SEGUIDOS, type IntentoFoto, type PasoPost } from '../../dominio/post.js';
import type { FamiliaBiblioteca, ReferenciaLocal } from '../../dominio/referencia.js';
import { esExtensionDeFoto } from '../../dominio/reglas.js';
import { describirProblemas } from '../../dominio/validacion.js';
import type { GaleriaDeDisenos, HojasDeRevision, VersionDeDiseno } from '../../puertos/GaleriaDeDisenos.js';
import { comprobarReferencia, type EstadoReferencia } from '../referencias/comprobarReferencia.js';
import { leerEncargo, type DepsPost } from './ordenPost.js';

/** La orden única más la lectura de los diseños compuestos. */
export interface DepsConsultasPost extends DepsPost {
  galeria: GaleriaDeDisenos;
}

/** Los once pasos de la orden, agrupados en las cinco fases que ve la persona. Las dos paradas cierran ELEMENTOS y FOTO. */
export type FasePost = 'REFERENCIA' | 'ELEMENTOS' | 'FOTO' | 'DISENO' | 'RESULTADO';
export const FASES_POST: readonly FasePost[] = ['REFERENCIA', 'ELEMENTOS', 'FOTO', 'DISENO', 'RESULTADO'];

export function faseDe(paso: PasoPost): FasePost {
  switch (paso) {
    case 'REFERENCIA':
      return 'REFERENCIA';
    case 'FOTO_REAL':
    case 'PROPUESTA':
    case 'CONFIRMAR_ELEMENTOS':
      return 'ELEMENTOS';
    case 'GENERAR':
    case 'COMPROBAR':
    case 'CONFIRMAR_FOTO':
      return 'FOTO';
    case 'MASCARA':
    case 'INTENCION':
    case 'COMPONER':
      return 'DISENO';
    case 'HECHO':
      return 'RESULTADO';
  }
}

/** Qué espera el encargo para seguir. Lo decide el estado guardado, sin llamar a nada. */
export type EsperaPost =
  /** Falta la referencia o no vale (sin ficha, enlace sin captura). */
  | { tipo: 'REFERENCIA'; motivo: string }
  /** ■ Parada 1: confirmar los elementos, el prompt y el gasto. Con `bloqueo`, tras dos fotos descartadas seguidas (y su explicación en llano). */
  | { tipo: 'CONFIRMAR_ELEMENTOS'; bloqueo?: string; explicacion?: Explicacion }
  /** No se puede generar por la API: hay que importar una foto hecha a mano. */
  | { tipo: 'IMPORTAR_FOTO'; motivo: string }
  /** ■ Parada 2: confirmar o rechazar la foto nueva. */
  | { tipo: 'CONFIRMAR_FOTO' }
  /** Faltan los tokens de la marca para el compositor (marcas/<local>/tokens.json). */
  | { tipo: 'TOKENS'; archivo: string }
  /** Falta la intención de diseño: la escribe una persona (hay un borrador). */
  | { tipo: 'INTENCION' }
  /** La última composición dio errores: hay que corregir la intención y subir su versión. */
  | { tipo: 'COMPOSICION'; errores: string[] }
  /** No hay nada que confirmar: la orden se quedó a medias y puede seguir sola. */
  | { tipo: 'CONTINUAR'; paso: PasoPost }
  | { tipo: 'HECHO' };

export type PortadaDeEncargo = { tipo: 'DISENO'; archivo: string } | { tipo: 'ACTIVO'; activo: string } | { tipo: 'SUBIDA' };

export interface ResumenEncargo {
  proyecto: string;
  local: string;
  nombreLocal: string | null;
  plato: string;
  paso: PasoPost;
  fase: FasePost;
  bloqueado: boolean;
  simulado: boolean;
  referencia: string | null;
  intentos: number;
  creadoEn: string;
  /** Fecha de la última nota del historial. */
  actualizadoEn: string;
  portada: PortadaDeEncargo | null;
}

export interface DetalleIntento extends IntentoFoto {
  /** false si el activo ya no está (se borró a mano). */
  disponible: boolean;
  ancho: number;
  alto: number;
  modelo: string | null;
  importada: boolean;
  generadoEn: string | null;
  revision: Activo['revisionAutomatica'] | null;
  fidelidad: Activo['fidelidad'] | null;
  mascara: Activo['mascara'] | null;
  elegida: boolean;
}

export interface DetallePropuesta {
  archivo: string;
  director: string | null;
  fecha: string | null;
  valida: boolean;
  /** Si no es válida: qué campos fallan. */
  errores: string[];
  /** Con el productor, el prompt sale del inventario (y se revisa antes de gastar). */
  desdeElInventario: boolean;
  /** La propuesta tal como está guardada (válida o no), para poder corregirla. */
  contenido: unknown;
  /** El prompt montado por el código con los huecos actuales. Vacío si la propuesta no es válida. */
  prompt: string;
  /** Lo que no cumple la plantilla (otra toma, recuento, sin texto, resolución). */
  problemas: string[];
  toma: { otra: boolean; cambios: string[] } | null;
}

export interface DetalleIntencion {
  archivo: string;
  esBorrador: boolean;
  contenido: unknown;
  valida: boolean;
  errores: string[];
  id: string | null;
  version: number | null;
}

export interface DetalleDiseno {
  diapositivas: Array<{ id: string; papel: string; intencion: DetalleIntencion; versiones: VersionDeDiseno[] }>;
  tokens: { archivo: string; existe: boolean; valido: boolean; contenido: unknown };
  /** Si el plan ya declara la pieza, cuenta para el umbral de referencia. */
  pieza: { fecha: string; referencia?: string } | null;
  intencion: DetalleIntencion | null;
  versiones: VersionDeDiseno[];
  /** La versión más reciente sin errores del compositor. */
  vigente: number | null;
  /** La versión que toca guardar: las compuestas no se sobrescriben. */
  siguienteVersion: number;
  hojas: HojasDeRevision[];
  /** Fuentes del catálogo del compositor (recursos/tipografias/catalogo.json). */
  fuentes: Array<{ id: string; familia: string; clasificacion: string[] }>;
}

export interface DetalleEncargo {
  revision: string;
  revisionEditorial: RevisionEntrega | null;
  brief: BriefDelEncargo | null;
  editorial: NonNullable<BriefDelEncargo['editorial']> | null;
  encargo: EncargoPost;
  fase: FasePost;
  espera: EsperaPost;
  local: Marca | null;
  referencia: {
    estado: EstadoReferencia | null;
    elegida: ReferenciaLocal | null;
    conImagen: boolean;
    error: string | null;
    /** Las referencias que el local ya tiene registradas (para elegir una sin salir de la web). */
    registradas: ResumenReferencia[];
    /** Las familias de la biblioteca del estudio, con sus posts: de ahí se registra una referencia nueva. */
    biblioteca: FamiliaBiblioteca[];
  };
  fotoSubida: { disponible: boolean; ancho: number; alto: number; uso: EncargoPost['usoFotoReal']; registrada: boolean };
  propuesta: DetallePropuesta | null;
  generador: { nombre: string; disponible: boolean; motivo: string | null; maxIntentos: number };
  intentos: DetalleIntento[];
  diseno: DetalleDiseno;
}

export interface ResumenReferencia {
  id: string;
  titulo: string | null;
  familia: string | null;
  /** Post de la biblioteca del estudio del que sale, si es de ahí. */
  deBiblioteca: string | null;
  conImagen: boolean;
  /** Si se puede usar ya: con ficha y, si es un enlace, con su imagen. */
  usable: boolean;
}

const resumirReferencia = (r: ReferenciaLocal): ResumenReferencia => ({
  id: r.id,
  titulo: r.ficha?.titulo ?? null,
  familia: r.ficha?.familia ?? null,
  deBiblioteca: r.origen.tipo === 'IMAGEN' ? (r.origen.deBiblioteca ?? null) : null,
  conImagen: Boolean(r.origen.archivo),
  // Sin ficha también vale: la orden la analiza sola (puntos 3 y 4). No vale sin imagen ni si se rechazó.
  usable: !(r.origen.tipo === 'ENLACE' && r.origen.estado === 'PIDE_CAPTURA') && r.analisis?.decision !== 'RECHAZA',
});

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);
const mensajeDe = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function leerJsonSiExiste(ruta: string): Promise<unknown | undefined> {
  if (!(await existe(ruta))) return undefined;
  return JSON.parse(await readFile(ruta, 'utf8')) as unknown;
}

/** Los encargos de la carpeta de proyectos del modo, del más reciente al más antiguo. Un post.json roto se salta. */
export async function listarEncargos(deps: Pick<DepsPost, 'proyectos'>): Promise<EncargoPost[]> {
  const entradas = await readdir(deps.proyectos, { withFileTypes: true }).catch(() => []);
  const encargos: EncargoPost[] = [];
  for (const entrada of entradas.filter((e) => e.isDirectory())) {
    const crudo = await leerJsonSiExiste(join(deps.proyectos, entrada.name, 'post.json')).catch(() => undefined);
    const encargo = EncargoPost.safeParse(crudo);
    // La carpeta manda: un post.json copiado a otra carpeta no es ese encargo.
    if (encargo.success && encargo.data.proyecto === entrada.name) encargos.push(encargo.data);
  }
  return encargos.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function resumirEncargos(deps: DepsConsultasPost): Promise<ResumenEncargo[]> {
  const encargos = await listarEncargos(deps);
  const locales = new Map((await deps.referencias.locales.listar().catch(() => [])).map((m) => [m.slug, m.nombre]));
  return Promise.all(
    encargos.map(async (e) => ({
      proyecto: e.proyecto,
      local: e.local,
      nombreLocal: locales.get(e.local) ?? null,
      plato: e.plato,
      paso: e.paso,
      fase: faseDe(e.paso),
      bloqueado: Boolean(e.bloqueo),
      simulado: e.simulado,
      referencia: e.referencia ?? null,
      intentos: e.intentos.length,
      creadoEn: e.creadoEn,
      actualizadoEn: e.historial.at(-1)?.fecha ?? e.creadoEn,
      portada: await portadaDe(deps, e),
    })),
  );
}

/** La imagen que mejor representa el encargo ahora: el post compuesto, la foto nueva o la foto subida. */
async function portadaDe(deps: DepsConsultasPost, e: EncargoPost): Promise<PortadaDeEncargo | null> {
  const intencion = await leerIntencion(deps, e).catch(() => null);
  if (intencion?.id) {
    const versiones = await deps.galeria.versiones(e.proyecto, intencion.id).catch(() => []);
    const ultima = versiones.filter((v) => !v.problemas.some((p) => p.gravedad === 'ERROR')).at(-1) ?? versiones.at(-1);
    if (ultima) return { tipo: 'DISENO', archivo: ultima.exportadas.find((x) => x.proporcion === '4:5')?.archivo ?? ultima.exportadas[0]?.archivo ?? ultima.diseno };
  }
  const activo = e.fotoElegida ?? e.intentos.at(-1)?.activo ?? e.activoReal;
  if (activo && (await deps.activos.existe(e.local, activo))) return { tipo: 'ACTIVO', activo };
  return (await rutaDeLaSubida(deps, e)) ? { tipo: 'SUBIDA' } : null;
}

export async function detalleDeEncargo(deps: DepsConsultasPost, proyecto: string): Promise<DetalleEncargo> {
  const e = await leerEncargo(deps, proyecto);
  const local = await deps.referencias.locales.obtener(e.local).catch(() => null);

  // ---------------------------------------------------------------- Referencia
  let estado: EstadoReferencia | null = null;
  let elegida: ReferenciaLocal | null = null;
  let errorReferencia: string | null = null;
  try {
    if (e.referencia) elegida = await deps.referencias.referencias.obtener(e.local, e.referencia);
    estado = await comprobarReferencia(deps.referencias, { local: e.local, ...(e.referencia ? { referencia: e.referencia } : {}) });
  } catch (error) {
    errorReferencia = mensajeDe(error);
  }
  const registradas = (await deps.referencias.referencias.listar(e.local).catch(() => [])).map(resumirReferencia);
  const biblioteca = await deps.referencias.biblioteca.familias().catch(() => []);

  // ---------------------------------------------------------------- Foto subida y propuesta
  const real = e.activoReal ? await deps.activos.obtener(e.local, e.activoReal).catch(() => null) : null;
  let fotoSubida = { disponible: Boolean(real), ancho: real?.activo.ancho ?? 0, alto: real?.activo.alto ?? 0, uso: e.usoFotoReal, registrada: Boolean(real) };
  if (!real) {
    const ruta = await rutaDeLaSubida(deps, e);
    const meta = ruta ? await sharp(ruta).metadata().catch(() => null) : null;
    fotoSubida = { ...fotoSubida, disponible: Boolean(meta), ancho: meta?.width ?? 0, alto: meta?.height ?? 0 };
  }
  const propuesta = await leerPropuesta(deps, e, { ancho: fotoSubida.ancho, alto: fotoSubida.alto }, local);

  // ---------------------------------------------------------------- Intentos
  const intentos: DetalleIntento[] = await Promise.all(
    e.intentos.map(async (intento) => {
      const foto = await deps.activos.obtener(e.local, intento.activo).catch(() => null);
      const generacion = foto?.activo.procedencia.generacion;
      return {
        ...intento,
        disponible: Boolean(foto),
        ancho: foto?.activo.ancho ?? 0,
        alto: foto?.activo.alto ?? 0,
        modelo: generacion?.modelo ?? null,
        importada: Boolean(generacion?.modelo.startsWith('importada')),
        generadoEn: generacion?.generadoEn ?? null,
        revision: foto?.activo.revisionAutomatica ?? null,
        fidelidad: foto?.activo.fidelidad ?? null,
        mascara: foto?.activo.mascara ?? null,
        elegida: e.fotoElegida === intento.activo,
      };
    }),
  );

  // ---------------------------------------------------------------- Diseño
  const diseno = await leerDiseno(deps, e);
  const disponible = deps.generador.disponible();
  const generador = { nombre: deps.generador.nombre, disponible: disponible.ok, motivo: disponible.ok ? null : disponible.motivo, maxIntentos: MAX_INTENTOS_SEGUIDOS };

  const reservaPendiente = await generacionPendienteDeImportacion(deps.proyectos, e);
  const revisionEditorial = e.productorEditorial ? await leerRevisionEntrega(join(deps.proyectos, proyecto)) ?? null : null;
  const espera: EsperaPost = e.paso === 'COMPONER' && revisionEditorial?.estado === 'REVISION_HUMANA'
    ? { tipo: 'COMPOSICION', errores: revisionEditorial.incidencias.map(i => `${i.id} v${i.version}: ${i.motivo}`) }
    : reservaPendiente && !await deps.activos.existe(e.local, `${e.proyecto}-foto-${e.intentos.length + 1}`)
    ? { tipo: 'IMPORTAR_FOTO', motivo: 'El envío quedó reservado sin imagen recuperable. Importa la candidata para seguir.' }
    : queEspera(e, { estado, errorReferencia, generador, diseno });
  const brief = await deps.productor?.leerBrief?.(proyecto);
  return { revisionEditorial, revision: await revisionDeEncargo(deps.proyectos, e, brief), brief: brief ?? null, editorial: brief?.editorial ?? null, encargo: e, fase: faseDe(e.paso), espera, local, referencia: { estado, elegida, conImagen: Boolean(elegida?.origen.archivo), error: errorReferencia, registradas, biblioteca }, fotoSubida, propuesta, generador, intentos, diseno };
}

function queEspera(
  e: EncargoPost,
  contexto: { estado: EstadoReferencia | null; errorReferencia: string | null; generador: DetalleEncargo['generador']; diseno: DetalleDiseno },
): EsperaPost {
  const { estado, errorReferencia, generador, diseno } = contexto;
  switch (e.paso) {
    case 'REFERENCIA':
      if (errorReferencia) return { tipo: 'REFERENCIA', motivo: errorReferencia };
      if (estado && !estado.paso.puede) return { tipo: 'REFERENCIA', motivo: estado.paso.motivo };
      return { tipo: 'CONTINUAR', paso: e.paso };
    case 'CONFIRMAR_ELEMENTOS': {
      const explicacion = explicarBloqueo(e);
      return { tipo: 'CONFIRMAR_ELEMENTOS', ...(e.bloqueo ? { bloqueo: e.bloqueo } : {}), ...(explicacion !== undefined ? { explicacion } : {}) };
    }
    case 'GENERAR':
      return generador.disponible ? { tipo: 'CONTINUAR', paso: e.paso } : { tipo: 'IMPORTAR_FOTO', motivo: generador.motivo ?? 'el generador no está disponible' };
    case 'CONFIRMAR_FOTO':
      return { tipo: 'CONFIRMAR_FOTO' };
    case 'INTENCION':
      if (!diseno.tokens.existe) return { tipo: 'TOKENS', archivo: diseno.tokens.archivo };
      // Sin borrador todavía, la orden lo crea al seguir. Con la intención escrita y válida, compone.
      if (!diseno.intencion) return { tipo: 'CONTINUAR', paso: e.paso };
      return !diseno.intencion.esBorrador && diseno.intencion.valida ? { tipo: 'CONTINUAR', paso: e.paso } : { tipo: 'INTENCION' };
    case 'COMPONER': {
      const errores = (diseno.versiones.at(-1)?.problemas ?? []).filter((p) => p.gravedad === 'ERROR').map((p) => `${p.tipo}: ${p.mensaje}`);
      // Con errores hay que subir la versión; si la intención guardada ya es una versión nueva, se puede componer.
      const pendiente = diseno.intencion?.version !== null && diseno.intencion?.version !== undefined && !diseno.versiones.some((v) => v.version === diseno.intencion?.version);
      return errores.length && !pendiente ? { tipo: 'COMPOSICION', errores } : { tipo: 'CONTINUAR', paso: e.paso };
    }
    case 'HECHO':
      return { tipo: 'HECHO' };
    default:
      return { tipo: 'CONTINUAR', paso: e.paso };
  }
}

async function leerPropuesta(deps: DepsPost, e: EncargoPost, lado: { ancho: number; alto: number }, marca: Marca | null): Promise<DetallePropuesta | null> {
  const archivo = e.propuesta?.archivo ?? 'foto/propuesta.json';
  let guardada: { director?: unknown; fecha?: unknown; propuesta?: unknown; opcionesPrompt?: OpcionesDePrompt } | undefined;
  try {
    guardada = (await leerJsonSiExiste(join(deps.proyectos, e.proyecto, archivo))) as typeof guardada;
  } catch (error) {
    return { archivo, director: null, fecha: null, valida: false, errores: [`El archivo no es JSON válido: ${mensajeDe(error)}`], desdeElInventario: false, contenido: null, prompt: '', problemas: [], toma: null };
  }
  if (!guardada) return null;
  const base = { archivo, director: typeof guardada.director === 'string' ? guardada.director : null, fecha: typeof guardada.fecha === 'string' ? guardada.fecha : null };
  const leida = PropuestaFotoNueva.safeParse(guardada.propuesta);
  if (!leida.success) return { ...base, valida: false, errores: describirProblemas(leida.error), desdeElInventario: false, contenido: guardada.propuesta ?? null, prompt: '', problemas: [], toma: null };
  const opciones = opcionesDeRevision(guardada.opcionesPrompt, e.paso === 'CONFIRMAR_ELEMENTOS' && Boolean(deps.productor));
  const revision = revisarPropuesta(leida.data, opciones, { lado, nota: e.plato, ...(marca ? { marca: textoDeMarca(marca) } : {}) });
  return {
    ...base,
    valida: true,
    errores: [],
    desdeElInventario: Boolean(opciones?.desdeElInventario),
    contenido: leida.data,
    prompt: revision.prompt + (e.productorEditorial ? direccionParaLaFoto(await deps.productor?.leerBrief?.(e.proyecto)) : ''),
    problemas: revision.problemas,
    toma: esOtraToma(leida.data.descripcion, leida.data.huecos.camara),
  };
}

/** Lo que la web lee del plan del proyecto (plan.json). */
export interface PlanDelEncargo {
  marca?: unknown;
  diapositivas?: Array<{ intencion?: unknown; papel?: unknown }>;
  pieza?: unknown;
}

/** Dónde está la intención del encargo: la que apunta el plan (o intenciones/post.json) y, si aún no existe, su borrador. */
export function rutasDeIntencion(deps: Pick<DepsPost, 'proyectos'>, proyecto: string, plan?: PlanDelEncargo, indice = 0): { final: string; borrador: string } {
  const declarada = plan?.diapositivas?.[indice]?.intencion;
  const final = typeof declarada === 'string' && declarada ? declarada : 'intenciones/post.json';
  const base = resolve(deps.proyectos, proyecto);
  const ruta = resolve(base, final);
  if (!ruta.startsWith(base + sep)) throw new ErrorDeUsuario(`El plan apunta a una intención fuera del proyecto: ${final}`);
  return { final, borrador: final.replace(/\.json$/, '.borrador.json') };
}

export async function leerPlan(deps: Pick<DepsPost, 'proyectos'>, proyecto: string): Promise<PlanDelEncargo | undefined> {
  const plan = await leerJsonSiExiste(join(deps.proyectos, proyecto, 'plan.json')).catch(() => undefined);
  return plan && typeof plan === 'object' ? (plan as PlanDelEncargo) : undefined;
}

export async function leerIntencion(deps: Pick<DepsPost, 'proyectos'>, e: EncargoPost): Promise<DetalleIntencion | null> {
  const rutas = rutasDeIntencion(deps, e.proyecto, await leerPlan(deps, e.proyecto));
  return leerIntencionDeRuta(join(deps.proyectos, e.proyecto), rutas);
}

async function leerIntencionDeRuta(carpeta: string, rutas: {final: string; borrador: string}): Promise<DetalleIntencion | null> {
  for (const [archivo, esBorrador] of [[rutas.final, false], [rutas.borrador, true]] as const) {
    let contenido: unknown;
    try {
      contenido = await leerJsonSiExiste(join(carpeta, archivo));
    } catch (error) {
      return { archivo, esBorrador, contenido: null, valida: false, errores: [`El archivo no es JSON válido: ${mensajeDe(error)}`], id: null, version: null };
    }
    if (contenido === undefined) continue;
    const leida = Intencion.safeParse(contenido);
    return {
      archivo,
      esBorrador,
      contenido,
      valida: leida.success,
      errores: leida.success ? [] : describirProblemas(leida.error),
      id: leida.success ? leida.data.id : null,
      version: leida.success ? leida.data.version : null,
    };
  }
  return null;
}

async function leerDiseno(deps: DepsConsultasPost, e: EncargoPost): Promise<DetalleDiseno> {
  const archivoTokens = `marcas/${e.local}/tokens.json`;
  let tokens: unknown;
  let tokensLegibles = true;
  try {
    tokens = await leerJsonSiExiste(join(deps.raiz, archivoTokens));
  } catch {
    tokensLegibles = false;
  }
  const plan = await leerPlan(deps, e.proyecto);
  const pieza = plan?.pieza && typeof plan.pieza === 'object' ? (plan.pieza as { fecha: string; referencia?: string }) : null;
  const intencion = await leerIntencion(deps, e).catch(() => null);
  const versiones = intencion?.id ? await deps.galeria.versiones(e.proyecto, intencion.id) : [];
  const vigente = versiones.filter((v) => !v.problemas.some((p) => p.gravedad === 'ERROR')).at(-1)?.version ?? null;
  return {
    diapositivas: await Promise.all((plan?.diapositivas ?? []).map(async (d, indice) => {
      const rutas = rutasDeIntencion(deps, e.proyecto, plan, indice);
      const pagina = indice === 0 ? intencion : await leerIntencionDeRuta(join(deps.proyectos, e.proyecto), rutas);
      if (!pagina?.id) return null;
      return {
        id: pagina.id, papel: typeof d.papel === 'string' ? d.papel : indice === 0 ? 'portada' : pagina.id === 'cierre' ? 'cierre' : 'detalle',
        intencion: pagina, versiones: indice === 0 ? versiones : await deps.galeria.versiones(e.proyecto, pagina.id),
      };
    })).then(paginas => paginas.filter(p => p !== null)),
    tokens: { archivo: archivoTokens, existe: tokens !== undefined || !tokensLegibles, valido: tokens !== undefined && Tokens.safeParse(tokens).success, contenido: tokens ?? null },
    pieza,
    intencion,
    versiones,
    vigente,
    siguienteVersion: Math.max(0, ...versiones.map((v) => v.version)) + 1,
    hojas: await deps.galeria.hojasDeRevision(e.proyecto),
    fuentes: await leerFuentes(deps.raiz),
  };
}

async function leerFuentes(raiz: string): Promise<DetalleDiseno['fuentes']> {
  try {
    const catalogo = (await leerJsonSiExiste(join(raiz, 'recursos', 'tipografias', 'catalogo.json'))) as { fuentes?: Array<{ id?: unknown; familia?: unknown; clasificacion?: unknown }> } | undefined;
    return (catalogo?.fuentes ?? [])
      .filter((f): f is { id: string; familia: string; clasificacion?: unknown } => typeof f.id === 'string' && typeof f.familia === 'string')
      .map((f) => ({ id: f.id, familia: f.familia, clasificacion: Array.isArray(f.clasificacion) ? f.clasificacion.map(String) : [] }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- Archivos del encargo

/** La foto tal como se subió, mientras aún no es un activo. Solo si es una imagen que existe. */
async function rutaDeLaSubida(deps: Pick<DepsPost, 'raiz'>, e: EncargoPost): Promise<string | undefined> {
  const ruta = resolve(deps.raiz, e.fotoSubida);
  if (!esExtensionDeFoto(ruta)) return undefined;
  return (await stat(ruta).then((info) => info.isFile(), () => false)) ? ruta : undefined;
}

export type RecursoDeEncargo =
  /** La foto que subió el local (el activo real si ya está registrado; si no, el archivo subido). */
  | { tipo: 'SUBIDA' }
  /** La imagen de uno de los activos del encargo (la foto real o un intento), o su máscara. */
  | { tipo: 'ACTIVO'; activo: string; mascara?: boolean }
  /** La imagen de la referencia elegida o, con `id`, la de otra referencia registrada del mismo local. */
  | { tipo: 'REFERENCIA'; id?: string }
  /** Un archivo de los diseños compuestos o de las hojas de revisión. */
  | { tipo: 'DISENO'; archivo: string };

/** Ruta absoluta de un archivo que pertenece al encargo. Nada que no sea suyo. */
export async function rutaDeRecurso(deps: DepsConsultasPost, proyecto: string, recurso: RecursoDeEncargo): Promise<string> {
  const e = await leerEncargo(deps, proyecto);
  const noEsta = (que: string) => new ErrorDeUsuario(`El encargo «${proyecto}» no tiene ${que}.`);
  switch (recurso.tipo) {
    case 'SUBIDA': {
      if (e.activoReal && (await deps.activos.existe(e.local, e.activoReal))) return (await deps.activos.obtener(e.local, e.activoReal)).ruta;
      const ruta = await rutaDeLaSubida(deps, e);
      if (!ruta) throw noEsta('la foto subida');
      return ruta;
    }
    case 'ACTIVO': {
      const suyos = new Set([e.activoReal, e.fotoElegida, ...e.intentos.map((i) => i.activo)].filter(Boolean));
      if (!suyos.has(recurso.activo) || !(await deps.activos.existe(e.local, recurso.activo))) throw noEsta(`el activo «${recurso.activo}»`);
      const activo = await deps.activos.obtener(e.local, recurso.activo);
      if (!recurso.mascara) return activo.ruta;
      if (!activo.rutaMascara) throw noEsta(`la máscara de «${recurso.activo}»`);
      return activo.rutaMascara;
    }
    case 'REFERENCIA': {
      const id = recurso.id ?? e.referencia;
      if (!id) throw noEsta('referencia');
      if (!(await deps.referencias.referencias.existe(e.local, id))) throw noEsta(`la referencia «${id}»`);
      const referencia = await deps.referencias.referencias.obtener(e.local, id);
      if (!referencia.origen.archivo) throw noEsta('la imagen de la referencia (el enlace no se pudo leer)');
      return deps.referencias.referencias.rutaArchivo(e.local, referencia.id, referencia.origen.archivo);
    }
    case 'DISENO': {
      if (!['.png', '.jpg', '.jpeg', '.svg', '.json'].includes(extname(recurso.archivo).toLowerCase())) throw noEsta(`el archivo «${recurso.archivo}»`);
      return deps.galeria.rutaArchivo(e.proyecto, recurso.archivo);
    }
  }
}
