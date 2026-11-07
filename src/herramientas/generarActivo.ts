/**
 * Genera un activo con la API de Higgsfield a partir de una receta versionada (F1.5).
 *
 * La receta (JSON en el proyecto) dice el modelo, sus parámetros, el archivo del prompt y las referencias.
 * Antes de enviar nada:
 *   1. pide a la API el precio estimado (/estimate, gratis);
 *   2. suma lo ya gastado en el registro de gasto y se niega si se pasa del tope;
 *   3. el envío lleva una Idempotency-Key derivada de la receta: repetir el comando no paga dos veces.
 * El resultado se guarda como activo GENERADO y SOLO_PRUEBA_COMPOSICION: no pasa a PUBLICABLE hasta que
 * la comprobación de fidelidad (herramientas/fidelidad.ts) diga que conserva el producto.
 *
 * Uso: tsx --env-file=.env src/herramientas/generarActivo.ts <receta.json> [--tope 5] [--solo-estimar]
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import { Activo } from '../dominio/activos.js';
import { RAIZ, leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';
import { ClienteHiggsfield } from '../adaptadores/higgsfield/ClienteHiggsfield.js';

const Receta = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  local: z.string(),
  descripcion: z.string(),
  modelo: z.string(),
  /** Parámetros del modelo tal cual los documenta su página (sin prompt ni image_urls). */
  parametros: z.record(z.string(), z.unknown()),
  promptArchivo: z.string(),
  referencias: z
    .array(
      z.object({
        activo: z.string(),
        /** Recorte en píxeles del activo antes de subirlo (p. ej. para pedir la misma proporción). */
        recorte: z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
        /** Lado largo máximo de lo que se sube. */
        ladoMaximo: z.number().int().positive().default(3072),
      }),
    )
    .default([]),
  /** Lo que se sabe que cambia respecto a la foto real (se completa tras revisarla). */
  alteraciones: z.array(z.string()).default([]),
});
type Receta = z.infer<typeof Receta>;

const Gasto = z.object({
  fecha: z.string(),
  receta: z.string(),
  activo: z.string(),
  modelo: z.string(),
  requestId: z.string(),
  estimadoUsd: z.number().optional(),
  estado: z.enum(['ENVIADO', 'COMPLETADO', 'FALLIDO']),
});

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { tope: { type: 'string', default: '5' }, 'solo-estimar': { type: 'boolean', default: false } },
});

async function principal(): Promise<void> {
  const rutaReceta = positionals[0];
  if (!rutaReceta) throw new Error('Uso: generarActivo.ts <receta.json> [--tope 5] [--solo-estimar]');
  const receta = Receta.parse(JSON.parse(await readFile(resolve(rutaReceta), 'utf8')));
  const config = leerConfig();
  if (!config.hfKey) throw new Error('Falta HF_KEY en .env');
  const cliente = new ClienteHiggsfield(config.hfKey);

  const carpeta = join(config.carpetaDatos, 'locales', receta.local, 'activos', receta.id);
  if (await existe(join(carpeta, 'activo.json'))) throw new Error(`El activo ${receta.id} ya existe: un activo no se sobrescribe.`);

  const prompt = (await readFile(resolve(RAIZ, receta.promptArchivo), 'utf8')).trim();
  const referencias = await Promise.all(receta.referencias.map((r) => prepararReferencia(config.carpetaDatos, receta.local, r)));
  const cuerpoSinUrls = { prompt, ...receta.parametros };
  const urlsFicticias = referencias.map(() => 'https://example.com/referencia.jpg');
  const estimacion = await cliente.estimar(receta.modelo, { ...cuerpoSinUrls, ...(referencias.length ? { image_urls: urlsFicticias } : {}) });
  const registro = join(config.carpetaDatos, 'gasto', 'higgsfield.jsonl');
  const gastado = await gastoAcumulado(registro);
  const tope = Number(values.tope);
  console.log(`${receta.modelo}: estimado ${estimacion.usd ?? '¿?'} USD · ya gastado ${gastado.toFixed(3)} USD · tope ${tope} USD`);
  if (estimacion.usd === undefined) {
    throw new Error(`El modelo no da un importe cerrado (${estimacion.tarifa ?? 'sin tarifa'}). Sin importe no se puede vigilar el tope: elige otro modelo.`);
  }
  if (gastado + estimacion.usd > tope) throw new Error(`Se pasaría del tope: ${gastado.toFixed(3)} + ${estimacion.usd} > ${tope} USD.`);
  if (values['solo-estimar']) return;

  const urls: string[] = [];
  for (const referencia of referencias) urls.push(await cliente.subirArchivo(referencia.bytes, 'image/jpeg'));
  const cuerpo = { ...cuerpoSinUrls, ...(urls.length ? { image_urls: urls } : {}) };
  // La clave depende de la receta y de lo que se sube, no de las URLs (cambian en cada subida).
  const clave = createHash('sha256')
    .update(JSON.stringify({ id: receta.id, modelo: receta.modelo, cuerpoSinUrls, refs: referencias.map((r) => r.sha256) }))
    .digest('hex');
  const trabajo = await cliente.enviar(receta.modelo, cuerpo, clave);
  const fecha = new Date().toISOString();
  await apuntar(registro, { fecha, receta: relative(RAIZ, resolve(rutaReceta)), activo: receta.id, modelo: receta.modelo, requestId: trabajo.requestId, estimadoUsd: estimacion.usd, estado: 'ENVIADO' });
  console.log(`Enviado ${trabajo.requestId}; esperando…`);

  let url: string;
  try {
    url = await cliente.esperar(trabajo.urlEstado);
  } catch (error) {
    await apuntar(registro, { fecha: new Date().toISOString(), receta: relative(RAIZ, resolve(rutaReceta)), activo: receta.id, modelo: receta.modelo, requestId: trabajo.requestId, estado: 'FALLIDO' });
    throw error;
  }
  const estado = await cliente.consultar(trabajo.urlEstado);
  const { bytes } = await cliente.descargar(url);
  const meta = await sharp(bytes).metadata();
  const extension = meta.format === 'jpeg' ? 'jpg' : (meta.format ?? 'png');
  await mkdir(carpeta, { recursive: true });
  const archivo = `original.${extension}`;
  await writeFile(join(carpeta, archivo), bytes);
  await escribirJson(join(carpeta, 'respuesta-api.json'), estado);
  for (const [i, referencia] of referencias.entries()) await writeFile(join(carpeta, `referencia-${i + 1}.jpg`), referencia.bytes);
  const sha = createHash('sha256').update(bytes).digest('hex');

  const activo = Activo.parse({
    id: receta.id,
    localSlug: receta.local,
    tipo: 'GENERADO',
    uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: receta.descripcion,
    archivo,
    ancho: meta.width,
    alto: meta.height,
    sha256: sha,
    procedencia: {
      ruta: relative(RAIZ, join(carpeta, archivo)),
      sha256: sha,
      copiadoEn: new Date().toISOString(),
      generacion: {
        modelo: receta.modelo,
        requestId: trabajo.requestId,
        promptArchivo: receta.promptArchivo,
        prompt,
        parametros: receta.parametros,
        referencias: referencias.map((r) => ({ activo: r.activo, sha256: r.sha256 })),
        costeEstimadoUsd: estimacion.usd,
        generadoEn: fecha,
      },
    },
    alteraciones: receta.alteraciones,
    niveles: [],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  await apuntar(registro, { fecha: new Date().toISOString(), receta: relative(RAIZ, resolve(rutaReceta)), activo: receta.id, modelo: receta.modelo, requestId: trabajo.requestId, estimadoUsd: estimacion.usd, estado: 'COMPLETADO' });
  console.log(`Activo ${receta.id}: ${meta.width} × ${meta.height} → ${relative(RAIZ, carpeta)}`);
}

async function prepararReferencia(carpetaDatos: string, local: string, referencia: Receta['referencias'][number]) {
  const carpeta = join(carpetaDatos, 'locales', local, 'activos', referencia.activo);
  const activo = Activo.parse(JSON.parse(await readFile(join(carpeta, 'activo.json'), 'utf8')));
  let imagen = sharp(join(carpeta, activo.archivo)).rotate();
  if (referencia.recorte) imagen = imagen.extract({ left: referencia.recorte.x, top: referencia.recorte.y, width: referencia.recorte.w, height: referencia.recorte.h });
  const bytes = await imagen
    .resize(referencia.ladoMaximo, referencia.ladoMaximo, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return { activo: referencia.activo, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Lo gastado: lo completado y lo que sigue en curso (lo fallido se devuelve). */
async function gastoAcumulado(registro: string): Promise<number> {
  if (!(await existe(registro))) return 0;
  const porPeticion = new Map<string, z.infer<typeof Gasto>>();
  for (const linea of (await readFile(registro, 'utf8')).split('\n').filter(Boolean)) {
    const gasto = Gasto.parse(JSON.parse(linea));
    const previo = porPeticion.get(gasto.requestId);
    porPeticion.set(gasto.requestId, { ...previo, ...gasto, estimadoUsd: gasto.estimadoUsd ?? previo?.estimadoUsd });
  }
  return [...porPeticion.values()].filter((g) => g.estado !== 'FALLIDO').reduce((suma, g) => suma + (g.estimadoUsd ?? 0), 0);
}

async function apuntar(registro: string, gasto: z.infer<typeof Gasto>): Promise<void> {
  await mkdir(dirname(registro), { recursive: true });
  await appendFile(registro, `${JSON.stringify(Gasto.parse(gasto))}\n`);
}

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
