/**
 * API del chat:
 *   GET  /api/chat                          conversaciones (la más reciente primero)
 *   GET  /api/chat/locales                  los locales con marca y tokens
 *   POST /api/chat                          nueva conversación
 *   GET  /api/chat/:id                      la conversación entera
 *   GET  /api/chat/:id/eventos              la conversación cada vez que cambia (Server-Sent Events)
 *   POST /api/chat/:id/mensajes             { texto, imagenes: [{ nombre, datos (base64) }], formato, esfuerzo }
 *   POST /api/chat/:id/tarjetas/:b/hechos   { confirmar, hechos?, formato?, esfuerzo? }
 *   POST /api/chat/:id/tarjetas/:b/plan     { aprobar }
 *   POST /api/chat/:id/tarjetas/:b/referencias { eleccion: id | auto | ninguna }  la estética de referencia
 *   POST /api/chat/:id/tarjetas/:b/conceptos   { eleccion: 0 | 1 | 2 | auto }  el concepto de la serie
 *   GET  /api/chat/:id/archivos/<ruta>      imágenes de la conversación y piezas
 *   GET  /api/chat/herramientas             el catálogo de herramientas (formularios rápidos)
 *   GET  /api/chat/biblioteca               las familias de referencias de la biblioteca · /biblioteca/:post su imagen
 *   GET  /api/chat/estilos                  los estilos de tipografía especial · /estilos/:id/hoja su hoja de muestras
 *   POST /api/chat/:id/herramientas/:h      abre una herramienta { valores? }
 *   POST /api/chat/:id/tarjetas/:b/herramienta  la lanza { valores } o la descarta { descartar: true }
 *   POST /api/chat/:id/encargos             abre una tarjeta de encargo paso a paso { modo? }
 *   POST /api/chat/:id/tarjetas/:b/encargo  le pone el encargo creado o retomado { proyecto }
 */
import express from 'express';
import { z } from 'zod';
import type { ServicioChat } from '../../aplicacion/chat/servicioChat.js';
import { Esfuerzo, Formato } from '../../dominio/chat.js';

const Selectores = { formato: z.union([Formato, z.literal('auto')]).optional(), esfuerzo: Esfuerzo.optional() };
const MensajeNuevo = z.object({ texto: z.string().max(4000).default(''), imagenes: z.array(z.object({ nombre: z.string().min(1).max(200), datos: z.string().min(1) })).max(6).default([]), ...Selectores });

/** Lo que la web necesita de las herramientas para sus selectores. */
export interface HerramientasDeLaWeb {
  biblioteca(): Promise<Array<{ id: string; nombre: string; posts: string[] }>>;
  estilos(): Array<{ id: string; nombre: string; estado: string; hoja: boolean; identidades: string[] }>;
  rutaHojaDeEstilo(id: string): string;
  rutaDeBiblioteca(post: string): string;
}

export function rutasDelChat(chat: ServicioChat, herramientas?: HerramientasDeLaWeb): express.Router {
  const rutas = express.Router();
  // Las fotos van en base64 dentro del JSON: el límite general de la API (1 MB) no basta.
  rutas.use(express.json({ limit: '60mb' }));

  rutas.get('/', async (_req, res) => {
    res.json({ conversaciones: await chat.listar() });
  });

  rutas.get('/locales', async (_req, res) => {
    res.json({ locales: await chat.locales() });
  });

  rutas.get('/herramientas', (_req, res) => {
    res.json({ herramientas: chat.catalogo() });
  });

  rutas.get('/biblioteca', async (_req, res) => {
    res.json({ familias: herramientas ? await herramientas.biblioteca() : [] });
  });

  rutas.get('/biblioteca/:post', (req, res) => {
    if (!herramientas || !/^post-\d{2}$/.test(req.params.post)) return res.status(404).end();
    res.sendFile(herramientas.rutaDeBiblioteca(req.params.post));
  });

  rutas.get('/estilos', (_req, res) => {
    res.json({ estilos: herramientas ? herramientas.estilos() : [] });
  });

  rutas.get('/estilos/:estilo/hoja', (req, res) => {
    if (!herramientas || !/^[a-z0-9-]+$/.test(req.params.estilo)) return res.status(404).end();
    res.sendFile(herramientas.rutaHojaDeEstilo(req.params.estilo), (e) => e && !res.headersSent && res.status(404).end());
  });

  rutas.post('/', async (_req, res) => {
    res.status(201).json({ conversacion: await chat.crear() });
  });

  rutas.get('/:id', async (req, res) => {
    res.json({ conversacion: await chat.leer(req.params.id) });
  });

  rutas.get('/:id/eventos', async (req, res) => {
    const inicial = await chat.leer(req.params.id);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const enviar = (c: unknown) => res.write(`data: ${JSON.stringify(c)}\n\n`);
    enviar(inicial);
    const dejar = chat.suscribir(req.params.id, enviar);
    const latido = setInterval(() => res.write(': latido\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(latido);
      dejar();
    });
  });

  rutas.post('/:id/mensajes', async (req, res) => {
    const m = MensajeNuevo.parse(req.body);
    await chat.enviar(req.params.id, {
      texto: m.texto,
      imagenes: m.imagenes.map((i) => ({ nombre: i.nombre, bytes: Buffer.from(i.datos.replace(/^data:[^,]*,/, ''), 'base64') })),
      ...(m.formato ? { formato: m.formato } : {}),
      ...(m.esfuerzo ? { esfuerzo: m.esfuerzo } : {}),
    });
    res.status(202).json({ ok: true });
  });

  rutas.post('/:id/tarjetas/:bloque/hechos', async (req, res) => {
    const r = z.object({ confirmar: z.boolean(), hechos: z.unknown().optional(), ...Selectores }).parse(req.body);
    await chat.responderHechos(req.params.id, req.params.bloque, { confirmar: r.confirmar, ...(r.hechos ? { hechos: r.hechos } : {}), ...(r.formato ? { formato: r.formato } : {}), ...(r.esfuerzo ? { esfuerzo: r.esfuerzo } : {}) });
    res.status(202).json({ ok: true });
  });

  rutas.post('/:id/tarjetas/:bloque/plan', async (req, res) => {
    const r = z.object({ aprobar: z.boolean() }).parse(req.body);
    await chat.responderPlan(req.params.id, req.params.bloque, r.aprobar);
    res.status(202).json({ ok: true });
  });

  rutas.post('/:id/tarjetas/:bloque/conceptos', async (req, res) => {
    const r = z.object({ eleccion: z.union([z.literal('auto'), z.number().int().min(0).max(2)]) }).parse(req.body);
    await chat.elegirConcepto(req.params.id, req.params.bloque, r.eleccion);
    res.status(202).json({ ok: true });
  });

  rutas.post('/:id/tarjetas/:bloque/referencias', async (req, res) => {
    const r = z.object({ eleccion: z.string().regex(/^(auto|ninguna|[a-z0-9-]{1,80})$/) }).parse(req.body);
    await chat.elegirEstetica(req.params.id, req.params.bloque, r.eleccion);
    res.status(202).json({ ok: true });
  });

  rutas.post('/:id/imagenes', async (req, res) => {
    const r = z.object({ imagenes: z.array(z.object({ nombre: z.string().min(1).max(200), datos: z.string().min(1) })).min(1).max(6) }).parse(req.body);
    const ids = await chat.subirImagenes(req.params.id, r.imagenes.map((i) => ({ nombre: i.nombre, bytes: Buffer.from(i.datos.replace(/^data:[^,]*,/, ''), 'base64') })));
    res.status(201).json({ imagenes: ids });
  });

  rutas.post('/:id/herramientas/:herramienta', async (req, res) => {
    const r = z.object({ valores: z.record(z.string(), z.unknown()).default({}) }).parse(req.body ?? {});
    res.status(201).json({ bloque: await chat.abrirHerramienta(req.params.id, req.params.herramienta, r.valores) });
  });

  rutas.post('/:id/tarjetas/:bloque/herramienta', async (req, res) => {
    const r = z.object({ valores: z.record(z.string(), z.unknown()).default({}), descartar: z.boolean().default(false) }).parse(req.body ?? {});
    await chat.ejecutarHerramienta(req.params.id, req.params.bloque, r.valores, r.descartar);
    res.status(202).json({ ok: true });
  });

  rutas.post('/:id/encargos', async (req, res) => {
    const r = z.object({ modo: z.string().max(40).optional() }).parse(req.body ?? {});
    res.status(201).json({ bloque: await chat.abrirEncargo(req.params.id, r.modo) });
  });

  rutas.post('/:id/tarjetas/:bloque/encargo', async (req, res) => {
    const r = z.object({ proyecto: z.string().min(1).max(120) }).parse(req.body);
    await chat.vincularEncargo(req.params.id, req.params.bloque, r.proyecto);
    res.json({ ok: true });
  });

  rutas.get('/:id/archivos/*ruta', async (req, res) => {
    const segmentos = (req.params as unknown as { ruta: string[] }).ruta;
    res.sendFile(chat.rutaArchivo(req.params.id, segmentos.join('/')));
  });

  return rutas;
}
