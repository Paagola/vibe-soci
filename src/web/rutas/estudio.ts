/** Ajustes del estudio, locales, subidas de fotos, ejemplos y consulta de trabajos. */
import express, { Router } from 'express';
import { z } from 'zod';
import { crearLocal } from '../../aplicacion/crearLocal.js';
import { validar } from '../../dominio/validacion.js';
import { ErrorHttp } from '../errores.js';
import type { Estudio } from '../estudio.js';
import { cargarEjemplo, PLANTILLAS_DE_PIEZA, type PlantillaDePieza } from '../plantillas.js';

/** Las fotos llegan en crudo; el límite real (10 MB) lo comprueba crearPieza. Se deja un margen. */
const LIMITE_SUBIDA = '11mb';

const CuerpoModo = z.object({ simulado: z.boolean() });
const CuerpoLocal = z.object({ marca: z.unknown(), sobrescribir: z.boolean().default(false) });
const CuerpoEjemplo = z.object({ plantilla: z.enum(Object.keys(PLANTILLAS_DE_PIEZA) as [PlantillaDePieza, ...PlantillaDePieza[]]) });

export function rutasDelEstudio(estudio: Estudio): Router {
  const rutas = Router();

  rutas.get('/estudio', (_req, res) => {
    const { config } = estudio;
    res.json({
      simulado: estudio.simulado(),
      modelos: { director: config.geminiModelo, directorRespaldo: config.geminiModeloRespaldo ?? null, imagen: config.hfModelo },
      claves: { gemini: Boolean(config.geminiApiKey), higgsfield: Boolean(config.hfKey) },
      limiteImagenesDia: config.limiteImagenesDia,
    });
  });

  rutas.put('/estudio', (req, res) => {
    estudio.cambiarModo(validar(CuerpoModo, req.body, 'Indica si quieres el modo simulado.').simulado);
    res.json({ simulado: estudio.simulado() });
  });

  rutas.get('/locales', async (_req, res) => {
    res.json({ locales: await estudio.deps().locales.listar() });
  });

  rutas.post('/locales', async (req, res) => {
    const { marca, sobrescribir } = validar(CuerpoLocal, req.body, 'La petición no es válida.');
    res.status(201).json({ local: await crearLocal(estudio.deps(), marca, { sobrescribir }) });
  });

  rutas.post('/ejemplos', async (req, res) => {
    const { plantilla } = validar(CuerpoEjemplo, req.body, 'Elige la plantilla «post» o «carrusel».');
    const pieza = await cargarEjemplo(estudio.deps(), estudio.carpetaPlantillas, plantilla);
    res.status(201).json({ pieza: { id: pieza.id } });
  });

  rutas.post('/subidas', express.raw({ type: () => true, limit: LIMITE_SUBIDA }), async (req, res) => {
    const nombre = decodeURIComponent(req.get('x-nombre-archivo') ?? '');
    if (!nombre || !Buffer.isBuffer(req.body)) throw new ErrorHttp(400, 'SUBIDA_NO_VALIDA', 'Falta el archivo o su nombre (cabecera X-Nombre-Archivo).');
    res.status(201).json({ subida: await estudio.subidas.guardar(nombre, req.body) });
  });

  rutas.get('/trabajos/:id', (req, res) => {
    const trabajo = estudio.registro.obtener(req.params.id);
    if (!trabajo) throw new ErrorHttp(404, 'TRABAJO_NO_ENCONTRADO', 'Ese trabajo ya no existe (¿se reinició el servidor?).');
    res.json({ trabajo: estudio.registro.vista(trabajo) });
  });

  return rutas;
}
