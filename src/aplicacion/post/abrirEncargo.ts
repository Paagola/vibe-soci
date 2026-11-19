/**
 * Abre un encargo de la orden única a partir de una foto recién subida (la puerta de entrada de la web).
 * Hace lo que en la línea de comandos se hace a mano con `npm run post -- nuevo <proyecto> --foto <ruta>`:
 * da nombre al proyecto, guarda la foto dentro de él y crea el encargo. No llama a ninguna IA.
 */
import { copyFile, mkdir, rm, rmdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import { idDePieza, problemaDeFoto } from '../../dominio/reglas.js';
import { validar } from '../../dominio/validacion.js';
import { Estetica } from '../../dominio/diseno/estetica.js';
import { crearEncargo, type DepsPost } from './ordenPost.js';

export const DatosNuevoEncargo = z.object({
  arte: z.enum(['EDITORIAL', 'INTEGRADO', 'CAPAS']).optional(),
  productorEditorial: z.literal(true).optional(),
  elegirReferenciaAlAbrir: z.literal(true).optional(),
  local: z.string().min(1, 'Elige el local.'),
  /** La nota del dueño al subir la foto: qué plato es. */
  plato: z.string().trim().min(3, 'Describe el plato o el espacio (mínimo 3 caracteres).').max(300),
  /** Id de una referencia ya registrada para el local. */
  referencia: z.string().min(1).optional(),
  usoFotoReal: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']).default('PUBLICABLE'),
  /** Punto 1: un post o un carrusel. */
  formato: z.enum(['post', 'carrusel']).default('post'),
  /** Punto 10: la estética. Sin ella, la de la familia de la referencia. */
  estetica: Estetica.optional(),
  /** Nombre del proyecto. Si no se da, sale de la fecha y de la nota. */
  proyecto: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones.')
    .max(80)
    .optional(),
});

export interface OpcionesAbrirEncargo {
  /** Ruta absoluta de la foto subida. */
  foto: string;
  simulado: boolean;
  zonaHoraria: string;
}

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

export async function abrirEncargo(deps: DepsPost, entrada: unknown, opciones: OpcionesAbrirEncargo): Promise<EncargoPost> {
  const datos = validar(DatosNuevoEncargo, entrada, 'No se puede abrir el encargo.');

  if (datos.arte === 'INTEGRADO' && datos.formato !== 'post') throw new ErrorDeUsuario('El cartel integrado se realiza como post individual.');

  // Todo se comprueba antes de escribir nada.
  await deps.referencias.locales.obtener(datos.local);
  if (datos.referencia) await deps.referencias.referencias.obtener(datos.local, datos.referencia);
  const bytes = await stat(opciones.foto).then((info) => (info.isFile() ? info.size : undefined), () => undefined);
  const problema = problemaDeFoto(basename(opciones.foto), bytes);
  if (problema) throw new ErrorDeUsuario('No se puede usar esa foto.', [problema]);
  const meta = await sharp(opciones.foto).metadata().catch(() => undefined);
  if (!meta?.width || !meta.height) throw new ErrorDeUsuario('No se puede usar esa foto.', ['El archivo no se abre como imagen: vuelve a exportarlo como JPG o PNG.']);

  const libre = async (proyecto: string) => !(await existe(join(deps.proyectos, proyecto))) && !(await deps.activos.existe(datos.local, `${proyecto}-real`));
  let proyecto = datos.proyecto;
  if (proyecto) {
    if (!(await libre(proyecto))) throw new ErrorDeUsuario(`Ya hay un proyecto «${proyecto}»: elige otro nombre.`);
  } else {
    const base = idDePieza(new Date(deps.ahora()), datos.plato, opciones.zonaHoraria);
    proyecto = base;
    for (let n = 2; !(await libre(proyecto)); n++) proyecto = `${base}-${n}`;
  }

  // La foto se queda dentro del proyecto: es de donde sale el activo real y lo que apunta su procedencia.
  const carpeta = join(deps.proyectos, proyecto);
  const destino = join(carpeta, 'foto', `subida${extname(opciones.foto).toLowerCase()}`);
  await mkdir(join(carpeta, 'foto'), { recursive: true });
  await copyFile(opciones.foto, destino);
  try {
    const relativa = relative(deps.raiz, destino);
    return await crearEncargo(deps, {
      proyecto,
      arte: datos.arte,
      elegirReferenciaAlAbrir: datos.elegirReferenciaAlAbrir,
      ...(datos.productorEditorial ? { productorEditorial: true } : {}),
      local: datos.local,
      plato: datos.plato,
      foto: relativa.startsWith('..') ? destino : relativa,
      usoFotoReal: datos.usoFotoReal,
      formato: datos.formato,
      ...(datos.estetica ? { estetica: datos.estetica } : {}),
      simulado: opciones.simulado,
      ...(datos.referencia ? { referencia: datos.referencia } : {}),
    });
  } catch (error) {
    // Se deshace solo lo que se acaba de crear (rmdir no borra carpetas con contenido).
    await rm(destino, { force: true });
    await rmdir(join(carpeta, 'foto')).catch(() => undefined);
    await rmdir(carpeta).catch(() => undefined);
    throw error;
  }
}
