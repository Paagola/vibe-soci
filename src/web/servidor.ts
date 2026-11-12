/** Aplicación Express: API JSON en /api (piezas del generador antiguo y encargos de la orden única), archivos en /archivos y el frontend estático. */
import { fileURLToPath } from 'node:url';
import express, { type ErrorRequestHandler } from 'express';
import { describirError, ErrorHttp } from './errores.js';
import type { Estudio } from './estudio.js';
import { rutasDeArchivos } from './rutas/archivos.js';
import { rutasDeEncargos } from './rutas/encargos.js';
import { rutasDelEstudio } from './rutas/estudio.js';
import { rutasDePiezas } from './rutas/piezas.js';

const CARPETA_PUBLICA = fileURLToPath(new URL('./publico/', import.meta.url));

export function crearApp(estudio: Estudio): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', rutasDelEstudio(estudio));
  app.use('/api/piezas', rutasDePiezas(estudio));
  app.use('/api/encargos', rutasDeEncargos(estudio));
  app.use('/api', () => {
    throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Esa ruta de la API no existe.');
  });
  app.use('/archivos', rutasDeArchivos(estudio));
  app.use(express.static(CARPETA_PUBLICA));

  const manejarError: ErrorRequestHandler = (error, _req, res, _next) => {
    const { status, error: cuerpo } = describirError(error);
    res.status(status).json({ error: cuerpo });
  };
  app.use(manejarError);
  return app;
}
