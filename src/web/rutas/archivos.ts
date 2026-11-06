/** Sirve los archivos de una pieza (fotos, generadas, exportadas, plan.md), nunca nada fuera de su carpeta. */
import { stat } from 'node:fs/promises';
import { Router } from 'express';
import { ErrorHttp } from '../errores.js';
import type { Estudio } from '../estudio.js';

const ID_PIEZA = /^[a-z0-9][a-z0-9-]*$/;

export function rutasDeArchivos(estudio: Estudio): Router {
  const rutas = Router();

  rutas.get('/piezas/:id/*ruta', async (req, res) => {
    const { id } = req.params;
    const segmentos = ([] as string[]).concat(req.params.ruta);
    if (!ID_PIEZA.test(id) || segmentos.some((s) => s === '..' || s === '.' || s === '')) {
      throw new ErrorHttp(400, 'RUTA_NO_VALIDA', 'Ruta de archivo no válida.');
    }
    const { piezas } = estudio.deps();
    if (!(await piezas.existe(id))) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'No existe esa pieza.');

    // rutaArchivo vuelve a comprobar que la ruta queda dentro de la carpeta de la pieza.
    const ruta = piezas.rutaArchivo(id, segmentos.join('/'));
    const esArchivo = await stat(ruta).then((info) => info.isFile(), () => false);
    if (!esArchivo) throw new ErrorHttp(404, 'NO_ENCONTRADO', 'No existe ese archivo.');

    if (req.query.descargar !== undefined) res.download(ruta);
    else res.sendFile(ruta, { headers: { 'Cache-Control': 'no-cache' } });
  });

  return rutas;
}
