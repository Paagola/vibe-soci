/**
 * Generador de la foto nueva con Gemini de imagen de pago (vía de producción elegida el 09/11/2026).
 * - Sin facturación activada (GEMINI_FACTURACION=no) no envía nada: la API no tiene tier gratuito de imagen (429).
 * - Antes de cada envío suma lo gastado en datos/gasto/gemini.jsonl y se niega si se pasaría del tope (GEMINI_TOPE_USD).
 *   El tope lo pone el código porque un presupuesto de Google Cloud solo avisa.
 * - No reintenta: Gemini no tiene clave de idempotencia y un reintento podría cobrar dos veces.
 * - Apunta el coste real con el recuento de tokens de la respuesta.
 */
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { FotoGenerada, GeneradorFoto, PeticionFoto } from '../../puertos/Foto.js';
import { construirContenido, construirPeticion, costeRealUsd, estimarUsd, GastoGemini, leerRespuesta, sumarGasto, TARIFAS, type ReferenciaImagen } from './imagenGemini.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIEMPO_MAXIMO_MS = 240_000;

class RespuestaHttpGemini extends Error {
  constructor(readonly estado: number, detalle: string) {
    super(`Gemini HTTP ${estado}: ${detalle}`);
  }
}

const reservas = new Map<string, Promise<void>>();

/** Varios encargos del mismo proceso comparten el tope y reservan el importe por turnos. */
async function reservarGasto(registro: string, tarea: () => Promise<void>): Promise<void> {
  const anterior = reservas.get(registro);
  let liberar!: () => void;
  const turno = new Promise<void>((resolver) => { liberar = resolver; });
  reservas.set(registro, turno);
  try {
    await anterior;
    await tarea();
  } finally {
    liberar();
    if (reservas.get(registro) === turno) reservas.delete(registro);
  }
}

export async function pedirGemini(clave: string, url: string, cuerpo: unknown, f: typeof fetch = fetch): Promise<unknown> {
  const respuesta = await f(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (!respuesta.ok) throw new RespuestaHttpGemini(respuesta.status, (await respuesta.text()).replace(/\s+/g, ' ').slice(0, 2000));
  return respuesta.json();
}

export async function gastoAcumuladoGemini(registro: string): Promise<number> {
  const existe = await stat(registro).then(() => true, () => false);
  return existe ? sumarGasto((await readFile(registro, 'utf8')).split('\n')) : 0;
}

export async function apuntarGastoGemini(registro: string, gasto: GastoGemini): Promise<void> {
  await mkdir(dirname(registro), { recursive: true });
  await appendFile(registro, `${JSON.stringify(GastoGemini.parse(gasto))}\n`);
}

/** Igual que prepararReferencia (recetaGemini.ts): JPEG de calidad 95, lado largo de 2048 como mucho. */
async function referencia(ruta: string, etiqueta: string): Promise<ReferenciaImagen> {
  const bytes = await sharp(ruta).rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
  return { etiqueta, bytes, mime: 'image/jpeg' };
}

export interface OpcionesGeneradorGemini {
  apiKey?: string;
  modelo: string;
  facturacion: boolean;
  topeUsd: number;
  carpetaDatos: string;
  /** Para el registro de gasto: de dónde sale la petición. */
  origen: string;
  fetch?: typeof fetch;
}

export class GeneradorFotoGemini implements GeneradorFoto {
  readonly nombre: string;
  readonly reservaEnEnvio = true;
  private readonly registro: string;

  constructor(private readonly o: OpcionesGeneradorGemini) {
    this.nombre = `Gemini ${o.modelo} (de pago)`;
    this.registro = resolve(o.carpetaDatos, 'gasto', 'gemini.jsonl');
  }

  disponible(): { ok: true } | { ok: false; motivo: string } {
    if (!this.o.apiKey) return { ok: false, motivo: 'falta GEMINI_API_KEY en .env' };
    if (!this.o.facturacion) {
      return {
        ok: false,
        motivo: 'la facturación de Gemini no está activada (GEMINI_FACTURACION=no). La API no tiene imagen gratis: actívala en Google y pon GEMINI_FACTURACION=si, o genera a mano e importa con --importar <imagen>',
      };
    }
    if (!TARIFAS[this.o.modelo]) return { ok: false, motivo: `no hay tarifa comprobada para ${this.o.modelo}: sin precio no se puede vigilar el tope` };
    return { ok: true };
  }

  async estimarUsd(p: PeticionFoto): Promise<number> {
    const refs = await Promise.all(p.referencias.map((r) => referencia(r.ruta, r.etiqueta)));
    const conteo = await pedirGemini(this.o.apiKey ?? '', `${BASE}/${this.o.modelo}:countTokens`, { contents: construirContenido(p.prompt, refs) }, this.o.fetch);
    const tokens = z.object({ totalTokens: z.number() }).parse(conteo).totalTokens;
    // countTokens cuenta menos por imagen que lo que factura la tarifa (560 por imagen): se suman por si acaso.
    return estimarUsd(this.o.modelo, tokens + refs.length * 560, p.tamano);
  }

  async generar(p: PeticionFoto): Promise<FotoGenerada> {
    const disponible = this.disponible();
    if (!disponible.ok) throw new ErrorDeUsuario(`No se puede generar: ${disponible.motivo}.`);
    const estimado = await this.estimarUsd(p);
    if (p.estimadoMaximoUsd !== undefined && estimado > p.estimadoMaximoUsd) {
      throw new ErrorDeUsuario(`La nueva estimación de Gemini (${estimado.toFixed(4)} USD) supera el importe aprobado por foto (${p.estimadoMaximoUsd.toFixed(4)} USD).`);
    }
    const refs = await Promise.all(p.referencias.map((r) => referencia(r.ruta, r.etiqueta)));
    const base = { receta: this.o.origen, activo: p.id, modelo: this.o.modelo, tier: 'PAGO' as const, estimadoUsd: estimado };
    await reservarGasto(this.registro, async () => {
      const gastado = await gastoAcumuladoGemini(this.registro);
      if (gastado + estimado > this.o.topeUsd) {
        throw new ErrorDeUsuario(`Se pasaría del tope de Gemini: ${gastado.toFixed(3)} ya gastados + ${estimado.toFixed(3)} > ${this.o.topeUsd} USD (GEMINI_TOPE_USD).`);
      }
      await p.antesDeEnviar?.();
      await apuntarGastoGemini(this.registro, { ...base, fecha: new Date().toISOString(), estado: 'ENVIADO' });
    });
    let json: unknown;
    try {
      json = await pedirGemini(this.o.apiKey ?? '', `${BASE}/${this.o.modelo}:generateContent`, construirPeticion(p.prompt, refs, p.aspectRatio, p.tamano), this.o.fetch);
    } catch (error) {
      // Un rechazo 4xx (salvo timeout) no cobra. Sin confirmación de rechazo queda ENVIADO y cuenta el estimado.
      const mensaje = (error as Error).message;
      const rechazado = error instanceof RespuestaHttpGemini && error.estado >= 400 && error.estado < 500 && error.estado !== 408;
      await apuntarGastoGemini(this.registro, { ...base, fecha: new Date().toISOString(), estado: rechazado ? 'FALLIDO' : 'ENVIADO', detalle: mensaje.slice(0, 2000) });
      throw error;
    }
    const lectura = leerRespuesta(json);
    const realUsd = lectura.uso ? costeRealUsd(this.o.modelo, lectura.uso) : undefined;
    const consumo = lectura.uso ? { uso: lectura.uso, realUsd } : {};
    if (!lectura.ok) {
      await apuntarGastoGemini(this.registro, { ...base, ...consumo, fecha: new Date().toISOString(), estado: 'SIN_IMAGEN', detalle: lectura.motivo });
      throw new Error(`Gemini no devolvió imagen: ${lectura.motivo}. ${lectura.texto.join(' ').slice(0, 300)}`);
    }
    await apuntarGastoGemini(this.registro, { ...base, ...consumo, fecha: new Date().toISOString(), estado: 'COMPLETADO' });
    const version = z.object({ modelVersion: z.string().optional() }).safeParse(json);
    return {
      bytes: lectura.bytes,
      modelo: (version.success && version.data.modelVersion) || this.o.modelo,
      costeUsd: realUsd ?? estimado,
      tier: 'PAGO',
      detalle: TARIFAS[this.o.modelo]?.fuente ?? '',
    };
  }
}
