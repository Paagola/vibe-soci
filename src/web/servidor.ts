/**
 * Aplicación Express: el chat del estudio en /api/chat, el resto de la API JSON en /api (piezas, encargos, procesos y
 * panel), archivos en /archivos y la interfaz del chat (web/, compilada con Vite en web/dist).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { describirError, ErrorHttp } from './errores.js';
import type { Estudio } from './estudio.js';
import type { ServicioChat } from '../aplicacion/chat/servicioChat.js';
import { RAIZ } from '../config.js';
import { crearAgenciaWeb } from './agencia.js';
import { rutasDeAgencia } from './rutas/agencia.js';
import { rutasDeArchivos } from './rutas/archivos.js';
import { rutasDelChat, type HerramientasDeLaWeb } from './rutas/chat.js';
import { rutasDeEncargos } from './rutas/encargos.js';
import { rutasDelPanel } from './rutas/panel.js';
import { rutasDelEstudio } from './rutas/estudio.js';
import { rutasDePiezas } from './rutas/piezas.js';
import { rutasDeProcesos } from './rutas/procesos.js';

/** La interfaz del chat, compilada (npm run web:build). */
const CARPETA_WEB = join(RAIZ, 'web', 'dist');

export function crearApp(estudio: Estudio, chat?: ServicioChat, herramientas?: HerramientasDeLaWeb, agencia = crearAgenciaWeb(estudio, chat)): express.Express {
  const app = express();
  // El chat lleva su propio límite (las fotos van dentro del JSON): va antes del lector general.
  if (chat) app.use('/api/chat', rutasDelChat(chat, herramientas));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/agencia', rutasDeAgencia(agencia));
  app.use('/api', rutasDelEstudio(estudio));
  app.use('/api/piezas', rutasDePiezas(estudio));
  app.use('/api/encargos', rutasDeEncargos(estudio));
  app.use('/api/procesos', rutasDeProcesos(estudio));
  app.use('/api', rutasDelPanel(estudio));
  app.use('/api', () => {
    throw new ErrorHttp(404, 'NO_ENCONTRADO', 'Esa ruta de la API no existe.');
  });
  app.use('/archivos', rutasDeArchivos(estudio));
  app.use(express.static(CARPETA_WEB));
  // Las rutas de página (/, /c/<conversación>) son la interfaz del chat (una sola página). Un archivo que no existe, o
  // algo de /api o /archivos, no: eso es un 404 (nunca la página en su lugar).
  app.get('/{*resto}', (req, res, next) => {
    if (/^\/(api|archivos)(\/|$)/.test(req.path) || /\.[a-z0-9]+$/i.test(req.path)) return next();
    if (existsSync(join(CARPETA_WEB, 'index.html'))) res.sendFile(join(CARPETA_WEB, 'index.html'));
    else res.status(503).type('text/plain').send('La interfaz no está compilada: npm run web:build');
  });

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('No existe.');
  });

  const manejarError: ErrorRequestHandler = (error, _req, res, _next) => {
    const { status, error: cuerpo } = describirError(error);
    res.status(status).json({ error: cuerpo });
  };
  app.use(manejarError);
  return app;
}
