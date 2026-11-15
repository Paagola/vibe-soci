/** Ajustes del estudio, locales, subidas de fotos, ejemplos y consulta de trabajos. */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import express, { Router } from 'express';
import { z } from 'zod';
import { crearLocal } from '../../aplicacion/crearLocal.js';
import { prepararMarca } from '../../aplicacion/prepararMarca.js';
import { GoogleFontsGithub } from '../../adaptadores/fuentes/GoogleFontsGithub.js';
import { RAIZ } from '../../config.js';
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
      // La foto nueva de la orden única: Gemini de imagen de pago, solo con la facturación activada y con tope.
      fotoNueva: { modelo: config.geminiModeloImagen, facturacion: config.geminiFacturacion, topeUsd: config.geminiTopeUsd },
    });
  });

  rutas.put('/estudio', (req, res) => {
    estudio.cambiarModo(validar(CuerpoModo, req.body, 'Indica si quieres el modo simulado.').simulado);
    res.json({ simulado: estudio.simulado() });
  });

  rutas.get('/locales', async (_req, res) => {
    const locales = await estudio.deps().locales.listar();
    // Sin marcas/<local>/tokens.json el compositor no puede montar el post: se avisa al abrir el encargo.
    const conTokens = await Promise.all(locales.map((m) => stat(join(RAIZ, 'marcas', m.slug, 'tokens.json')).then(() => true, () => false)));
    res.json({ locales: locales.map((m, i) => ({ ...m, tokens: conTokens[i] })) });
  });

  /** Solo en simulado: da de alta el local de la plantilla (plantillas/marca.ejemplo.json) para probar la orden sin datos reales. */
  rutas.post('/locales/ejemplo', async (_req, res) => {
    if (!estudio.simulado()) throw new ErrorHttp(409, 'SOLO_SIMULADO', 'El local de ejemplo solo se da de alta en el modo simulado.');
    const marca = JSON.parse(await readFile(join(estudio.carpetaPlantillas, 'marca.ejemplo.json'), 'utf8')) as { slug: string };
    const deps = estudio.deps();
    const local = (await deps.locales.existe(marca.slug)) ? await deps.locales.obtener(marca.slug) : await crearLocal(deps, marca);
    res.status(201).json({ local });
  });

  rutas.post('/locales', async (req, res) => {
    const { marca, sobrescribir } = validar(CuerpoLocal, req.body, 'La petición no es válida.');
    const local = await crearLocal(estudio.deps(), marca, { sobrescribir });
    // Punto 2: sus tokens y sus fuentes (Google Fonts, OFL), solo en real: en simulado no se escribe en marcas/ ni se descarga.
    const preparada = estudio.simulado() ? undefined : await prepararMarca({ raiz: RAIZ, proveedor: new GoogleFontsGithub(), hoy: () => new Date().toISOString().slice(0, 10) }, local);
    res.status(201).json({ local, ...(preparada ? { marca: preparada } : {}) });
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
