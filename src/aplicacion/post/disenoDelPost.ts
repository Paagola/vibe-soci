/**
 * La intención de diseño de un encargo desde la web: verla compuesta en borrador, guardarla y volver a componer.
 *
 * Hasta que el director la escriba (F3), la intención la escribe una persona. La línea de comandos lo resuelve editando
 * intenciones/post.json y lanzando `npm run carrusel -- <proyecto> --borrador`; aquí se hace lo mismo con los mismos
 * adaptadores: el borrador se compone en la carpeta temporal y una versión guardada no se sobrescribe nunca.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { escribirJsonAtomico } from '../../adaptadores/ficheros/escribirJsonAtomico.js';
import { comprobarEdicionEditorial } from '../productor/componerEditorial.js';
import { Intencion } from '../../dominio/diseno/intencion.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import { validar } from '../../dominio/validacion.js';
import type { PiezaCompuesta } from '../../puertos/ComponedorDePiezas.js';
import type { GaleriaDeDisenos, VersionDeDiseno } from '../../puertos/GaleriaDeDisenos.js';
import { leerPlan, rutasDeIntencion, type DepsConsultasPost } from './consultasPost.js';
import { guardarEncargo, leerEncargo } from './ordenPost.js';

export interface DepsDisenoPost extends DepsConsultasPost {
  /** Lectura de lo que el componedor deja en su carpeta de borradores. */
  galeriaDeBorradores: GaleriaDeDisenos;
}

export interface VistaPrevia {
  /** Carpeta del borrador dentro de la galería de borradores. */
  clave: string;
  version: VersionDeDiseno;
  /** Los ERROR del compositor: con alguno, la intención no se puede guardar como versión. */
  errores: string[];
}

const PASOS_DE_DISENO: ReadonlyArray<EncargoPost['paso']> = ['INTENCION', 'COMPONER', 'HECHO'];

/** Carpeta del borrador del encargo en la galería de borradores. Cada modo tiene la suya: no se pisan. */
export const claveDeBorrador = (e: Pick<EncargoPost, 'proyecto' | 'simulado'>) => `${e.simulado ? 'simulado' : 'real'}--${e.proyecto}`;
const existe = (ruta: string) => stat(ruta).then(() => true, () => false);
const erroresDe = (version: VersionDeDiseno) => version.problemas.filter((p) => p.gravedad === 'ERROR').map((p) => `${p.tipo}: ${p.mensaje}`);

/** El compositor avisa de los fallos de la intención con RangeError: aquí se dicen como errores que la persona puede corregir. */
async function componer<T>(tarea: () => Promise<T>): Promise<T> {
  try {
    return await tarea();
  } catch (error) {
    if (error instanceof RangeError) throw new ErrorDeUsuario('El compositor no puede resolver la intención.', [error.message]);
    throw error;
  }
}

async function comprobarIntencion(deps: DepsDisenoPost, e: EncargoPost, entrada: unknown): Promise<Intencion> {
  if (e.taller) throw new ErrorDeUsuario('Este cartel se corrige desde la revisión de su imagen en el taller.');
  if (!PASOS_DE_DISENO.includes(e.paso)) throw new ErrorDeUsuario('La intención de diseño se escribe cuando la foto nueva está confirmada.');
  const intencion = validar(Intencion, entrada, 'La intención de diseño no es válida.');
  if (intencion.marca !== e.local) {
    throw new ErrorDeUsuario(`La intención es de «${intencion.marca}» y el encargo es de «${e.local}»: el campo "marca" tiene que ser el local del encargo.`);
  }
  if (e.productorEditorial) {
    const brief = await deps.productor?.leerBrief?.(e.proyecto);
    if (!brief?.editorial) throw new ErrorDeUsuario('Falta el plan confirmado para corregir la composición.');
    comprobarEdicionEditorial(intencion, e, brief);
  }
  const faltan: string[] = [];
  for (const [papel, id] of Object.entries(intencion.activos)) {
    if (!(await deps.activos.existe(e.local, id))) faltan.push(`«${papel}» apunta al activo «${id}», que no existe en el local.`);
  }
  if (faltan.length) throw new ErrorDeUsuario('La intención usa activos que no existen.', faltan);
  return intencion;
}

async function rutaDeTokens(deps: DepsDisenoPost, e: EncargoPost): Promise<string> {
  const tokens = join(deps.raiz, 'marcas', e.local, 'tokens.json');
  if (!(await existe(tokens))) throw new ErrorDeUsuario(`Falta marcas/${e.local}/tokens.json (los colores y estilos de la marca para el compositor).`);
  return tokens;
}

/** Compone la intención en borrador (carpeta temporal, se sobrescribe) y devuelve lo que ha salido. No guarda ninguna versión. */
async function componerBorrador(deps: DepsDisenoPost, e: EncargoPost, intencion: Intencion, entrada: unknown): Promise<VistaPrevia> {
  const tokens = await rutaDeTokens(deps, e);
  // Un proyecto temporal con el mismo plan que escribe la orden, apuntando a esta intención sin guardar.
  const clave = claveDeBorrador(e);
  const carpeta = join(tmpdir(), 'estudio-contenido-vistas', clave);
  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, 'plan.json'), `${JSON.stringify({ nota: `Vista previa del encargo ${e.proyecto}.`, local: e.local, marca: tokens, diapositivas: [{ intencion: 'intencion.json' }] }, null, 2)}\n`);
  await writeFile(join(carpeta, 'intencion.json'), `${JSON.stringify(entrada, null, 2)}\n`);

  await componer(() => deps.componedor.componer(carpeta, { borrador: true, etiqueta: 'vista-previa' }));
  const version = (await deps.galeriaDeBorradores.versiones(clave, intencion.id)).find((v) => v.version === intencion.version);
  if (!version) throw new Error('El componedor no dejó el borrador donde se esperaba.');
  return { clave, version, errores: erroresDe(version) };
}

/** Vista previa de una intención sin guardar: sirve para afinar sin llenar el historial de versiones. */
export async function vistaPreviaDelDiseno(deps: DepsDisenoPost, proyecto: string, entrada: unknown): Promise<VistaPrevia> {
  const e = await leerEncargo(deps, proyecto);
  const intencion = await comprobarIntencion(deps, e, entrada);
  return componerBorrador(deps, e, intencion, entrada);
}

export interface IntencionGuardada {
  encargo: EncargoPost;
  archivo: string;
  id: string;
  version: number;
}

/**
 * Guarda la intención como la versión que se va a componer. Antes la compone en borrador: si el compositor da errores,
 * no se guarda (una versión compuesta no se puede corregir, solo sustituir por la siguiente).
 */
export async function guardarIntencion(deps: DepsDisenoPost, proyecto: string, entrada: unknown): Promise<IntencionGuardada> {
  const e = await leerEncargo(deps, proyecto);
  const intencion = await comprobarIntencion(deps, e, entrada);
  const compuestas = await deps.galeria.versiones(e.proyecto, intencion.id);
  if (compuestas.some((v) => v.version === intencion.version)) {
    const siguiente = Math.max(...compuestas.map((v) => v.version)) + 1;
    if (!e.productorEditorial || intencion.version !== siguiente - 1) {
      throw new ErrorDeUsuario(`La versión ${intencion.version} de «${intencion.id}» ya está compuesta y no se sobrescribe: guarda la versión ${siguiente}.`);
    }
    intencion.padre = intencion.version;
    intencion.version = siguiente;
  }
  const vista = await componerBorrador(deps, e, intencion, intencion);
  if (vista.errores.length) throw new ErrorDeUsuario('El compositor da errores con esta intención: no se guarda como versión.', vista.errores);

  const plan = await leerPlan(deps, e.proyecto);
  let { final } = rutasDeIntencion(deps, e.proyecto, plan);
  if (plan?.diapositivas?.length && (e.productorEditorial || plan.diapositivas.length > 1)) {
    let encontrada = false;
    for (const [indice] of plan.diapositivas.entries()) {
      const ruta = rutasDeIntencion(deps, e.proyecto, plan, indice);
      const previa = Intencion.parse(JSON.parse(await readFile(join(deps.proyectos, e.proyecto, ruta.final), 'utf8')));
      if (previa.id !== intencion.id) continue;
      final = ruta.final;
      encontrada = true;
      break;
    }
    if (!encontrada) throw new ErrorDeUsuario('La diapositiva que quieres corregir no pertenece al plan.');
  }
  const ruta = join(deps.proyectos, e.proyecto, final);
  await mkdir(join(ruta, '..'), { recursive: true });
  await escribirJsonAtomico(ruta, intencion);
  const encargo: EncargoPost = { ...e, ...(e.productorEditorial && e.paso === 'HECHO' ? { paso: 'COMPONER' } : {}), historial: [...e.historial, { fecha: deps.ahora(), paso: e.paso, nota: `Intención de diseño guardada: ${intencion.id} v${intencion.version} (${final}).` }] };
  await guardarEncargo(deps, encargo);
  await deps.productor?.registrarCorreccion?.(proyecto, e.paso, {
    destino: intencion.id, archivo: final, version: intencion.version, foto: e.fotoElegida,
  });
  return { encargo, archivo: final, id: intencion.id, version: intencion.version };
}

export interface PostRecompuesto {
  diapositivas: Array<{ id: string; version: number; reutilizada: boolean }>;
  errores: string[];
}

/**
 * Compone una versión nueva de un encargo ya terminado (después de guardar su intención con la versión subida).
 * Es `npm run carrusel -- <proyecto>` desde la web: las versiones anteriores se quedan como están.
 */
export async function recomponerPost(deps: DepsDisenoPost, proyecto: string): Promise<PostRecompuesto> {
  const e = await leerEncargo(deps, proyecto);
  if (e.paso !== 'HECHO') throw new ErrorDeUsuario('Solo se recompone un encargo terminado: hasta entonces, la orden compone al seguir.');
  const pieza: PiezaCompuesta = await componer(() => deps.componedor.componer(join(deps.proyectos, e.proyecto), { etiqueta: 'orden-post' }));
  const errores = pieza.diapositivas.flatMap((d) => d.problemas.filter((p) => p.gravedad === 'ERROR').map((p) => `${d.id} v${d.version}: ${p.tipo}: ${p.mensaje}`));
  const ahora = deps.ahora();
  const notas = pieza.diapositivas
    .filter((d) => !d.reutilizada)
    .map((d) => ({ fecha: ahora, paso: e.paso, nota: `Versión nueva compuesta: ${d.id} v${d.version}${errores.length ? `, con errores: ${errores.join(' | ')}` : ' (3:4 y 4:5)'}.` }));
  if (notas.length) await guardarEncargo(deps, { ...e, historial: [...e.historial, ...notas] });
  return { diapositivas: pieza.diapositivas.map((d) => ({ id: d.id, version: d.version, reutilizada: d.reutilizada })), errores };
}
