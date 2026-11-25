import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { exigirTomaNueva } from '../../adaptadores/imagen/copiaDeReferencia.js';
import { Intencion } from '../../dominio/diseno/intencion.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import type { DepsPost } from './ordenPost.js';

export async function referenciasFotograficas(deps: Pick<DepsPost, 'raiz' | 'referencias'>, e: EncargoPost): Promise<string[]> {
  const rutas = [e.fotoSubida, ...e.fotosExtra.map(f => f.ruta)].map(ruta => resolve(deps.raiz, ruta));
  if (e.referencia) {
    const ref = await deps.referencias.referencias.obtener(e.local, e.referencia);
    if (ref.origen.archivo) rutas.push(deps.referencias.referencias.rutaArchivo(e.local, ref.id, ref.origen.archivo));
  }
  return rutas;
}

export function comprobarActivosDeSalida(e: EncargoPost, ids: string[]): void {
  const entradas = new Set([e.activoReal, ...e.fotosExtra.map(f => f.activo), ...e.tomas.filter(t => t.real).map(t => t.elegida)].filter(Boolean));
  if (ids.some(id => entradas.has(id))) throw new ErrorDeUsuario('La composición usa una fotografía de referencia. Selecciona una toma nueva antes de componer.');
}

type DepsFuentes = Pick<DepsPost, 'raiz' | 'referencias' | 'activos'>;

export async function comprobarFotosDeSalida(deps: DepsFuentes, e: EncargoPost, ids: string[]): Promise<void> {
  comprobarActivosDeSalida(e, ids);
  const referencias = await referenciasFotograficas(deps, e);
  for (const id of new Set(ids)) {
    const { activo, ruta } = await deps.activos.obtener(e.local, id);
    if (activo.tipo === 'REAL') throw new ErrorDeUsuario('La fotografía seleccionada es una referencia. Elige una toma nueva.');
    comprobarActivosDeSalida(e, Object.values(activo.procedencia.derivacion?.entradas ?? {}));
    await exigirTomaNueva(ruta, referencias);
  }
}

export async function comprobarFuentesDelPlan(deps: DepsFuentes, carpeta: string, e: EncargoPost): Promise<void> {
  const plan = JSON.parse(await readFile(join(carpeta, 'plan.json'), 'utf8')) as { diapositivas: { intencion: string }[] };
  const ids: string[] = [];
  for (const d of plan.diapositivas) {
    const pagina = Intencion.parse(JSON.parse(await readFile(resolve(carpeta, d.intencion), 'utf8')));
    ids.push(...Object.values(pagina.activos));
  }
  await comprobarFotosDeSalida(deps, e, ids);
}
