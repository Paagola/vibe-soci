/**
 * Cliente HTTP mínimo de la API de Higgsfield (docs.higgsfield.ai):
 *   subida   POST /files/generate-upload-url → PUT a upload_url → public_url
 *   envío    POST /<modelo> con Idempotency-Key → { request_id, status_url }
 *   estado   GET status_url hasta completed | failed | nsfw | canceled (2 s × 1,5, máx. 10 s)
 */
import { z } from 'zod';
import { ErrorDeServicio, ErrorDeUsuario } from '../../dominio/errores.js';
import type { TrabajoEnviado } from '../../puertos/GeneradorImagen.js';

const BASE = 'https://api.higgsfield.ai';
const SERVICIO = 'Higgsfield';
/** Ninguna petición suelta debe colgar el estudio; la espera larga es el sondeo, no una petición. */
const TIEMPO_MAXIMO_PETICION_MS = 60_000;

const RespuestaSubida = z.object({
  public_url: z.string(),
  upload_url: z.string(),
  upload_headers: z.record(z.string(), z.string()).optional(),
});

const RespuestaEnvio = z.object({
  request_id: z.string(),
  status_url: z.string().optional(),
});

const RespuestaEstado = z.object({
  status: z.string(),
  images: z.array(z.object({ url: z.string() })).optional(),
  error: z.string().optional(),
});

const RespuestaEstimacion = z.object({
  usd: z.string().optional(),
  credits: z.string().optional(),
  pricing_description: z.string().optional(),
});

/** Lo que devuelve /estimate: importe en USD cuando el modelo tiene precio fijo; si cobra por tokens, solo la tarifa. */
export interface Estimacion {
  usd?: number;
  creditos?: number;
  tarifa?: string;
}

export interface OpcionesCliente {
  fetch?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
  /** Cuánto se espera a un trabajo antes de dejarlo para la próxima vez. */
  esperaMaximaMs?: number;
}

export class ClienteHiggsfield {
  private readonly fetch: typeof fetch;
  private readonly dormir: (ms: number) => Promise<void>;
  private readonly esperaMaximaMs: number;

  constructor(
    private readonly credencial: string,
    opciones: OpcionesCliente = {},
  ) {
    this.fetch = opciones.fetch ?? fetch;
    this.dormir = opciones.dormir ?? ((ms) => new Promise((resolver) => setTimeout(resolver, ms)));
    this.esperaMaximaMs = opciones.esperaMaximaMs ?? 15 * 60_000;
  }

  /** Sube un archivo y devuelve su URL pública para usarla como referencia. */
  async subirArchivo(bytes: Buffer, tipo: string): Promise<string> {
    const subida = await this.pedirJson('POST', `${BASE}/files/generate-upload-url`, RespuestaSubida, { content_type: tipo });
    // A la URL firmada no se le mandan nuestras credenciales: solo las cabeceras que pide.
    const respuesta = await this.fetch(subida.upload_url, {
      method: 'PUT',
      headers: subida.upload_headers ?? { 'Content-Type': tipo },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_PETICION_MS),
    });
    if (!respuesta.ok) throw new ErrorDeServicio(SERVICIO, `no se pudo subir la imagen (HTTP ${respuesta.status})`, respuesta.status >= 500);
    return subida.public_url;
  }

  /**
   * Precio de una petición antes de enviarla (POST /estimate/<modelo>, no genera ni cobra).
   * Algunos modelos cobran por tokens y solo devuelven la descripción de la tarifa, sin importe.
   */
  async estimar(modelo: string, cuerpo: Record<string, unknown>): Promise<Estimacion> {
    const respuesta = await this.pedirJson('POST', `${BASE}/estimate/${modelo}`, RespuestaEstimacion, cuerpo);
    const usd = respuesta.usd === undefined ? undefined : Number(respuesta.usd);
    return {
      ...(usd !== undefined && Number.isFinite(usd) ? { usd } : {}),
      ...(respuesta.credits !== undefined ? { creditos: Number(respuesta.credits) } : {}),
      ...(respuesta.pricing_description ? { tarifa: respuesta.pricing_description } : {}),
    };
  }

  async enviar(modelo: string, cuerpo: Record<string, unknown>, claveIdempotencia: string): Promise<TrabajoEnviado> {
    const envio = await this.pedirJson('POST', `${BASE}/${modelo}`, RespuestaEnvio, cuerpo, { 'Idempotency-Key': claveIdempotencia });
    return { requestId: envio.request_id, urlEstado: envio.status_url ?? `${BASE}/requests/${envio.request_id}/status` };
  }

  /** Consulta el estado hasta que termina y devuelve la URL de la imagen. */
  async esperar(urlEstado: string): Promise<string> {
    const limite = Date.now() + this.esperaMaximaMs;
    let pausa = 2000;

    for (;;) {
      const estado = await this.pedirJson('GET', urlEstado, RespuestaEstado);
      switch (estado.status) {
        case 'completed': {
          const url = estado.images?.[0]?.url;
          if (!url) throw new ErrorDeServicio(SERVICIO, 'el trabajo terminó sin imagen', false);
          return url;
        }
        case 'nsfw':
          throw new ErrorDeServicio(SERVICIO, 'MODERACION: la imagen no cumple las normas del proveedor', false);
        case 'failed':
          throw new ErrorDeServicio(SERVICIO, `el trabajo falló: ${estado.error ?? 'sin detalle'}`, false);
        case 'canceled':
          throw new ErrorDeServicio(SERVICIO, 'el trabajo se canceló', false);
      }
      if (Date.now() > limite) {
        throw new ErrorDeServicio(SERVICIO, 'se agotó la espera; el trabajo sigue en curso y se retoma con «generar»', true);
      }
      await this.dormir(pausa + Math.random() * 500);
      pausa = Math.min(pausa * 1.5, 10_000);
    }
  }

  /** El estado completo de una petición tal como lo devuelve la API, para guardarlo como procedencia. */
  async consultar(urlEstado: string): Promise<Record<string, unknown>> {
    return this.pedirJson('GET', urlEstado, z.record(z.string(), z.unknown()));
  }

  async descargar(url: string): Promise<{ bytes: Buffer; tipo: string }> {
    const respuesta = await this.conReintentos(() => this.fetch(url, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_PETICION_MS) }));
    if (!respuesta.ok) throw new ErrorDeServicio(SERVICIO, `no se pudo descargar la imagen (HTTP ${respuesta.status})`, true);
    return { bytes: Buffer.from(await respuesta.arrayBuffer()), tipo: respuesta.headers.get('content-type') ?? '' };
  }

  private async pedirJson<T>(
    metodo: 'GET' | 'POST',
    url: string,
    esquema: z.ZodType<T>,
    cuerpo?: Record<string, unknown>,
    cabeceras: Record<string, string> = {},
  ): Promise<T> {
    // Reintentar un POST es seguro: el envío lleva Idempotency-Key y pedir una URL de subida no cobra.
    const respuesta = await this.conReintentos(() =>
      this.fetch(url, {
        method: metodo,
        headers: { Authorization: `Key ${this.credencial}`, 'Content-Type': 'application/json', ...cabeceras },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_PETICION_MS),
      }),
    );
    if (respuesta.status === 401) throw new ErrorDeUsuario('Higgsfield rechaza la clave (401). Revisa HF_KEY en .env (formato KEY_ID:KEY_SECRET).');
    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).slice(0, 300);
      const reintentable = respuesta.status === 429 || respuesta.status >= 500;
      throw new ErrorDeServicio(SERVICIO, `HTTP ${respuesta.status} en ${url}: ${detalle}`, reintentable);
    }
    const resultado = esquema.safeParse(await respuesta.json());
    if (!resultado.success) throw new ErrorDeServicio(SERVICIO, `respuesta inesperada de ${url}`, false);
    return resultado.data;
  }

  /** Reintenta fallos de red, 429 y 5xx (3 intentos: 1 s y 3 s de pausa). */
  private async conReintentos(peticion: () => Promise<Response>): Promise<Response> {
    const pausas = [1000, 3000];
    for (let intento = 0; ; intento++) {
      try {
        const respuesta = await peticion();
        const reintentable = respuesta.status === 429 || respuesta.status >= 500;
        if (!reintentable || intento >= pausas.length) return respuesta;
      } catch (error) {
        if (intento >= pausas.length) throw new ErrorDeServicio(SERVICIO, `sin conexión: ${(error as Error).message}`, true);
      }
      await this.dormir(pausas[intento] ?? 0);
    }
  }
}
