/**
 * Genera un activo con Nano Banana Pro (gemini-3-pro-image) por la API de Gemini, a partir de una receta.
 * Mismo contrato que generarActivo.ts (Higgsfield):
 *   1. cuenta los tokens de entrada con countTokens (gratis) y estima por arriba (entrada + imagen + reserva de razonamiento);
 *   2. suma lo ya gastado en datos/gasto/gemini.jsonl y se niega si se pasa del tope (por defecto 1 USD, el tope que autorizaste);
 *   3. la petición NO se reintenta: Gemini no tiene clave de idempotencia y un reintento podría cobrar dos veces;
 *   4. el coste real se calcula con el recuento de tokens que devuelve la respuesta y se apunta.
 * El resultado se guarda como activo GENERADO y SOLO_PRUEBA_COMPOSICION.
 *
 * --gratuito: la clave no tiene facturación activada (tier gratuito). No cobra: se apunta con coste 0 y el precio de pago
 *   solo como referencia. Si el modelo no está en el tier gratuito, la API responde con un error de cuota y no se reintenta.
 *
 * Uso: tsx --env-file=.env src/herramientas/generarGeminiImagen.ts <receta.json> [--tope 1] [--solo-contar] [--gratuito]
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
import { construirContenido, construirPeticion, costeRealUsd, estimarUsd, GastoGemini, leerRespuesta, sumarGasto, TARIFAS } from '../adaptadores/gemini/imagenGemini.js';
import { leerReceta, prepararReferencia } from '../adaptadores/gemini/recetaGemini.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIEMPO_MAXIMO_MS = 240_000;

type Gasto = GastoGemini;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { tope: { type: 'string', default: '1' }, 'solo-contar': { type: 'boolean', default: false }, gratuito: { type: 'boolean', default: false } },
});

async function principal(): Promise<void> {
  const rutaReceta = positionals[0];
  if (!rutaReceta) throw new Error('Uso: generarGeminiImagen.ts <receta.json> [--tope 1] [--solo-contar] [--gratuito]');
  const receta = await leerReceta(resolve(rutaReceta));
  const config = leerConfig();
  if (!config.geminiApiKey) throw new Error('Falta GEMINI_API_KEY en .env');
  if (!TARIFAS[receta.modelo]) throw new Error(`No hay tarifa comprobada para ${receta.modelo}.`);

  const carpeta = join(config.carpetaDatos, 'locales', receta.local, 'activos', receta.id);
  if (await existe(join(carpeta, 'activo.json'))) throw new Error(`El activo ${receta.id} ya existe: un activo no se sobrescribe.`);

  const prompt = (await readFile(resolve(RAIZ, receta.promptArchivo), 'utf8')).trim();
  const referencias = await Promise.all(receta.referencias.map((r) => prepararReferencia(RAIZ, config.carpetaDatos, receta.local, r)));
  const { aspectRatio, imageSize } = receta.parametros;

  // 1. Recuento gratuito de la entrada.
  const conteo = await pedir(config.geminiApiKey, `${BASE}/${receta.modelo}:countTokens`, { contents: construirContenido(prompt, referencias) });
  const tokensEntrada = z.object({ totalTokens: z.number() }).parse(conteo).totalTokens;
  // countTokens cuenta menos por imagen que lo que factura la tarifa (560 por imagen): se suman por si acaso.
  const estimado = estimarUsd(receta.modelo, tokensEntrada + referencias.length * 560, imageSize);

  // 2. Tope.
  const registro = join(config.carpetaDatos, 'gasto', 'gemini.jsonl');
  const gastado = await gastoAcumulado(registro);
  const tope = Number(values.tope);
  const gratuito = values.gratuito === true;
  const tier = gratuito ? 'GRATUITO' : 'PAGO';
  const aCuenta = gratuito ? 0 : estimado;
  console.log(
    `${receta.modelo} ${imageSize} ${aspectRatio}: ${tokensEntrada} tokens de entrada · estimado ≤ ${estimado.toFixed(3)} USD en pago` +
      `${gratuito ? ' (tier gratuito: cuenta 0)' : ''} · ya gastado ${gastado.toFixed(3)} USD · tope ${tope} USD`,
  );
  if (gastado + aCuenta > tope) throw new Error(`Se pasaría del tope: ${gastado.toFixed(3)} + ${estimado.toFixed(3)} > ${tope} USD.`);
  if (values['solo-contar']) return;

  // 3. Envío, sin reintentos.
  const base = { receta: relative(RAIZ, resolve(rutaReceta)), activo: receta.id, modelo: receta.modelo, tier, estimadoUsd: estimado } as const;
  const fecha = new Date().toISOString();
  await apuntar(registro, { ...base, fecha, estado: 'ENVIADO' });
  let json: unknown;
  try {
    json = await pedir(config.geminiApiKey, `${BASE}/${receta.modelo}:generateContent`, construirPeticion(prompt, referencias, aspectRatio, imageSize));
  } catch (error) {
    // Un rechazo HTTP no cobra (FALLIDO cuenta 0). Si se corta sin respuesta, puede haber cobrado: queda ENVIADO y cuenta el estimado.
    const mensaje = (error as Error).message;
    const rechazada = mensaje.startsWith('Gemini HTTP');
    await apuntar(registro, { ...base, fecha: new Date().toISOString(), estado: rechazada ? 'FALLIDO' : 'ENVIADO', detalle: mensaje.slice(0, 2000) });
    throw error;
  }
  const lectura = leerRespuesta(json);
  const realUsd = lectura.uso ? costeRealUsd(receta.modelo, lectura.uso) : undefined;
  const sinImagen = { ...(json as Record<string, unknown>), candidates: undefined };
  if (!lectura.ok) {
    await apuntar(registro, { ...base, fecha: new Date().toISOString(), ...(realUsd !== undefined ? { realUsd } : {}), estado: 'SIN_IMAGEN', detalle: lectura.motivo });
    throw new Error(`Gemini no devolvió imagen: ${lectura.motivo}. ${lectura.texto.join(' ').slice(0, 300)}`);
  }

  // 4. Activo con procedencia.
  const meta = await sharp(lectura.bytes).metadata();
  const extension = meta.format === 'jpeg' ? 'jpg' : (meta.format ?? 'png');
  await mkdir(carpeta, { recursive: true });
  const archivo = `original.${extension}`;
  await writeFile(join(carpeta, archivo), lectura.bytes);
  await escribirJson(join(carpeta, 'respuesta-api.json'), { ...sinImagen, textoDelModelo: lectura.texto });
  for (const [i, referencia] of referencias.entries()) await writeFile(join(carpeta, `referencia-${i + 1}.jpg`), referencia.bytes);
  const sha = createHash('sha256').update(lectura.bytes).digest('hex');

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
        requestId: `sin-id-${sha.slice(0, 12)}`,
        promptArchivo: receta.promptArchivo,
        prompt,
        parametros: receta.parametros,
        referencias: referencias.map((r) => ({ activo: r.origen, sha256: r.sha256 })),
        costeEstimadoUsd: gratuito ? 0 : (realUsd ?? estimado),
        tarifa: gratuito
          ? `tier gratuito de Gemini, sin facturación; en pago habría costado ${(realUsd ?? estimado).toFixed(4)} USD (${TARIFAS[receta.modelo]?.fuente})`
          : TARIFAS[receta.modelo]?.fuente,
        generadoEn: fecha,
      },
    },
    alteraciones: receta.alteraciones,
    niveles: [],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  await apuntar(registro, { ...base, fecha: new Date().toISOString(), ...(realUsd !== undefined ? { realUsd } : {}), estado: 'COMPLETADO' });
  console.log(`Activo ${receta.id}: ${meta.width} × ${meta.height} · ${gratuito ? 'tier gratuito, 0 USD; en pago' : 'coste real'} ${realUsd?.toFixed(4) ?? '¿?'} USD → ${relative(RAIZ, carpeta)}`);
}

async function pedir(clave: string, url: string, cuerpo: unknown): Promise<unknown> {
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (!respuesta.ok) throw new Error(`Gemini HTTP ${respuesta.status}: ${(await respuesta.text()).replace(/\s+/g, ' ').slice(0, 2000)}`);
  return respuesta.json();
}

async function gastoAcumulado(registro: string): Promise<number> {
  if (!(await existe(registro))) return 0;
  return sumarGasto((await readFile(registro, 'utf8')).split('\n'));
}

async function apuntar(registro: string, gasto: Gasto): Promise<void> {
  await mkdir(dirname(registro), { recursive: true });
  await appendFile(registro, `${JSON.stringify(GastoGemini.parse(gasto))}\n`);
}

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
