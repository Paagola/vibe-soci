/**
 * Sirve los archivos de una pieza (fotos, generadas, exportadas, plan.md) y los de un encargo de la orden única
 * (foto subida, intentos, referencia, diseños y vista previa), nunca nada fuera de su carpeta.
 * También las miniaturas de la biblioteca de referencias del estudio.
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';
import { rutaDeRecurso, type RecursoDeEncargo } from '../../aplicacion/post/consultasPost.js';
import { claveDeBorrador } from '../../aplicacion/post/disenoDelPost.js';
import { leerEncargo } from '../../aplicacion/post/ordenPost.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { ErrorHttp } from '../errores.js';
import type { Estudio } from '../estudio.js';

const ID_PIEZA = /^[a-z0-9][a-z0-9-]*$/;
const PROYECTO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ACTIVO = /^[a-z0-9][a-z0-9-]*$/;
const POST_DE_BIBLIOTECA = /^post-\d{2}$/;
/** Lados permitidos para las miniaturas (para no dejar que cualquiera pida tamaños arbitrarios). */
const LADOS = new Set([320, 640, 1080]);

const segmentosDe = (req: Request): string[] => ([] as string[]).concat(req.params.ruta ?? []);
const rutaValida = (segmentos: string[]) => segmentos.length > 0 && !segmentos.some((s) => s === '..' || s === '.' || s === '');
const esArchivo = (ruta: string) => stat(ruta).then((info) => info.isFile(), () => false);

/** Envía una imagen tal cual o, con ?lado=, reducida a JPEG (para las rejillas y los encargos con fotos de 2K). */
async function enviar(req: Request, res: Response, ruta: string): Promise<void> {
  if (!(await esArchivo(ruta))) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'No existe ese archivo.');
  if (req.query.descargar !== undefined) return res.download(ruta);
  const lado = Number(req.query.lado);
  if (LADOS.has(lado) && /\.(jpe?g|png|webp)$/i.test(ruta)) {
    const miniatura = await sharp(ruta).rotate().resize(lado, lado, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' }).send(miniatura);
    return;
  }
  res.sendFile(ruta, { headers: { 'Cache-Control': 'no-cache' } });
}

/** Los errores de «no es suyo» de las consultas pasan a 404: no se dice más de lo necesario. */
async function resolver<T>(tarea: () => Promise<T>): Promise<T> {
  try {
    return await tarea();
  } catch (error) {
    if (error instanceof ErrorDeUsuario) throw new ErrorHttp(404, 'NO_ENCONTRADO', error.message);
    throw error;
  }
}

export function rutasDeArchivos(estudio: Estudio): Router {
  const rutas = Router();

  rutas.get('/piezas/:id/*ruta', async (req, res) => {
    const { id } = req.params;
    const segmentos = segmentosDe(req);
    if (!ID_PIEZA.test(id) || !rutaValida(segmentos)) {
      throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    }
    const { piezas } = estudio.deps();
    if (!(await piezas.existe(id))) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'No existe esa pieza.');

    // rutaArchivo vuelve a comprobar que la ruta queda dentro de la carpeta de la pieza.
    const ruta = piezas.rutaArchivo(id, segmentos.join('/'));
    if (!(await esArchivo(ruta))) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'No existe ese archivo.');

    if (req.query.descargar !== undefined) res.download(ruta);
    else res.sendFile(ruta, { headers: { 'Cache-Control': 'no-cache' } });
  });

  // ---------------------------------------------------------------- Encargos de la orden única

  const encargo = async (req: Request) => {
    const proyecto = String(req.params.proyecto);
    if (!PROYECTO.test(proyecto)) throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    return { proyecto, deps: await estudio.post(proyecto) };
  };
  const recurso = async (req: Request, res: Response, cual: RecursoDeEncargo) => {
    const { proyecto, deps } = await encargo(req);
    await enviar(req, res, await resolver(() => rutaDeRecurso(deps, proyecto, cual)));
  };

  rutas.get('/encargos/:proyecto/subida', (req, res) => recurso(req, res, { tipo: 'SUBIDA' }));

  rutas.get('/encargos/:proyecto/activos/:activo', async (req, res) => {
    const activo = String(req.params.activo);
    if (!ACTIVO.test(activo)) throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    await recurso(req, res, { tipo: 'ACTIVO', activo, mascara: req.query.mascara !== undefined });
  });

  rutas.get('/encargos/:proyecto/referencia', (req, res) => recurso(req, res, { tipo: 'REFERENCIA' }));

  rutas.get('/encargos/:proyecto/referencias/:id', async (req, res) => {
    const id = String(req.params.id);
    if (!ACTIVO.test(id)) throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    await recurso(req, res, { tipo: 'REFERENCIA', id });
  });

  rutas.get('/encargos/:proyecto/disenos/*ruta', async (req, res) => {
    const segmentos = segmentosDe(req);
    if (!rutaValida(segmentos)) throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    await recurso(req, res, { tipo: 'DISENO', archivo: segmentos.join('/') });
  });

  /** El último borrador compuesto con «Vista previa»: vive en la carpeta temporal y se sobrescribe cada vez. */
  rutas.get('/encargos/:proyecto/vista-previa/*ruta', async (req, res) => {
    const segmentos = segmentosDe(req);
    if (!rutaValida(segmentos) || !/\.(png|jpe?g|svg)$/i.test(segmentos.at(-1) ?? '')) throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    const { proyecto, deps } = await encargo(req);
    const e = await resolver(() => leerEncargo(deps, proyecto));
    const ruta = await resolver(async () => deps.galeriaDeBorradores.rutaArchivo(claveDeBorrador(e), segmentos.join('/')));
    await enviar(req, res, ruta);
  });

  // ---------------------------------------------------------------- Biblioteca de referencias del estudio

  rutas.get('/biblioteca/:post', async (req, res) => {
    const post = String(req.params.post).replace(/\.jpg$/, '');
    if (!POST_DE_BIBLIOTECA.test(post)) throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    await enviar(req, res, join(estudio.config.carpetaBiblioteca, 'referencias', `${post}.jpg`));
  });

  return rutas;
}
