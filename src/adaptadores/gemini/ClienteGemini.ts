/**
 * Cliente REST mínimo de Gemini (generateContent) con salida JSON.
 * Valida la respuesta con zod y, si no cuadra, le devuelve el error una vez para que la corrija.
 * Si el modelo principal está saturado (503, 429 o no responde), pasa al de respaldo.
 */
import { z } from 'zod';
import { ErrorDeServicio, ErrorDeUsuario } from '../../dominio/errores.js';
import { describirProblemas } from '../../dominio/validacion.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const SERVICIO = 'Gemini';
const PAUSAS_REINTENTO_MS = [3000];
/** Mirar varias fotos y pensar puede tardar, pero nunca debe quedarse colgado. */
const TIEMPO_MAXIMO_PETICION_MS = 90_000;

export type ParteGemini = { text: string } | { inlineData: { mimeType: string; data: string } };

interface Mensaje {
  role: 'user' | 'model';
  parts: ParteGemini[];
}

const Respuesta = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })).optional() }).optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  modelVersion: z.string().optional(),
  usageMetadata: z
    .object({ promptTokenCount: z.number().default(0), candidatesTokenCount: z.number().default(0), thoughtsTokenCount: z.number().default(0) })
    .optional(),
});

/** Lo que gastó una llamada, tal como lo cuenta la API (para el registro de gasto cuando hay facturación). */
export interface UsoGemini {
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  tokensRazonamiento: number;
}

export interface OpcionesClienteGemini {
  fetch?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
  avisar?: (mensaje: string) => void;
  /** Se llama tras cada respuesta con su recuento de tokens. */
  alUsar?: (uso: UsoGemini) => void;
}

export class ClienteGemini {
  private readonly fetch: typeof fetch;
  private readonly dormir: (ms: number) => Promise<void>;
  private readonly avisar: (mensaje: string) => void;
  private readonly alUsar: (uso: UsoGemini) => void;
  /** Si un modelo falla, las siguientes llamadas de esta ejecución empiezan por el de respaldo. */
  private primerModelo = 0;

  /** `modelos`: el principal primero y después los de respaldo. */
  constructor(
    private readonly apiKey: string,
    private readonly modelos: string[],
    opciones: OpcionesClienteGemini = {},
  ) {
    this.fetch = opciones.fetch ?? fetch;
    this.dormir = opciones.dormir ?? ((ms) => new Promise((resolver) => setTimeout(resolver, ms)));
    this.avisar = opciones.avisar ?? (() => {});
    this.alUsar = opciones.alUsar ?? (() => {});
  }

  async generarJson<T>(instrucciones: string, partes: ParteGemini[], esquema: z.ZodType<T>): Promise<T> {
    let conversacion: Mensaje[] = [{ role: 'user', parts: partes }];

    for (let intento = 1; ; intento++) {
      const texto = await this.generar(instrucciones, conversacion);
      const resultado = interpretarJson(texto, esquema);
      if (resultado.ok) return resultado.datos;
      if (intento >= 2) throw new ErrorDeServicio(SERVICIO, `la respuesta no tiene el formato pedido (${resultado.problema})`, true);

      conversacion = [
        ...conversacion,
        { role: 'model', parts: [{ text: texto }] },
        { role: 'user', parts: [{ text: `Tu respuesta no es válida: ${resultado.problema}. Devuelve solo el JSON corregido, con la forma pedida.` }] },
      ];
    }
  }

  private async generar(instrucciones: string, conversacion: Mensaje[]): Promise<string> {
    const respuesta = await this.pedir({
      systemInstruction: { parts: [{ text: instrucciones }] },
      contents: conversacion,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const datos = Respuesta.parse(await respuesta.json());
    if (datos.usageMetadata) {
      this.alUsar({
        modelo: datos.modelVersion ?? '¿?',
        tokensEntrada: datos.usageMetadata.promptTokenCount,
        tokensSalida: datos.usageMetadata.candidatesTokenCount,
        tokensRazonamiento: datos.usageMetadata.thoughtsTokenCount,
      });
    }

    if (datos.promptFeedback?.blockReason) {
      throw new ErrorDeServicio(SERVICIO, `ha bloqueado la petición (${datos.promptFeedback.blockReason})`, false);
    }
    const candidato = datos.candidates?.[0];
    const texto = (candidato?.content?.parts ?? [])
      .filter((parte) => !parte.thought)
      .map((parte) => parte.text ?? '')
      .join('');
    if (!texto) throw new ErrorDeServicio(SERVICIO, `respuesta vacía (${candidato?.finishReason ?? 'sin motivo'})`, true);
    return texto;
  }

  private async pedir(cuerpo: unknown): Promise<Response> {
    for (let i = this.primerModelo; i < this.modelos.length; i++) {
      const modelo = this.modelos[i]!;
      try {
        return await this.pedirAModelo(modelo, cuerpo);
      } catch (error) {
        const siguiente = this.modelos[i + 1];
        if (!(error instanceof ErrorDeServicio && error.reintentable) || !siguiente) throw error;
        this.avisar(`${modelo} no responde ahora (${error.message.slice(0, 120)}). Sigo con ${siguiente}.`);
        this.primerModelo = i + 1;
      }
    }
    throw new ErrorDeUsuario('No hay ningún modelo de Gemini configurado (GEMINI_MODELO).');
  }

  private async pedirAModelo(modelo: string, cuerpo: unknown): Promise<Response> {
    const url = `${BASE}/${encodeURIComponent(modelo)}:generateContent`;
    for (let intento = 0; ; intento++) {
      let respuesta: Response | undefined;
      try {
        respuesta = await this.fetch(url, {
          method: 'POST',
          headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
          signal: AbortSignal.timeout(TIEMPO_MAXIMO_PETICION_MS),
        });
      } catch (error) {
        // Si no contesta en el tiempo máximo, no se repite: se pasa al modelo de respaldo.
        const agotado = (error as Error).name === 'TimeoutError';
        if (agotado || intento >= PAUSAS_REINTENTO_MS.length) {
          throw new ErrorDeServicio(SERVICIO, agotado ? 'no contesta a tiempo' : `sin conexión: ${(error as Error).message}`, true);
        }
      }

      if (respuesta?.ok) return respuesta;
      if (respuesta) {
        if (respuesta.status === 400 || respuesta.status === 403) {
          throw new ErrorDeUsuario(`Gemini rechaza la petición (HTTP ${respuesta.status}). Revisa GEMINI_API_KEY y GEMINI_MODELO.`, [
            (await respuesta.text()).slice(0, 400),
          ]);
        }
        if (respuesta.status === 404) throw new ErrorDeUsuario(`Gemini no conoce el modelo «${modelo}». Cambia GEMINI_MODELO en .env.`);
        const reintentable = respuesta.status === 429 || respuesta.status >= 500;
        if (!reintentable || intento >= PAUSAS_REINTENTO_MS.length) {
          throw new ErrorDeServicio(SERVICIO, `HTTP ${respuesta.status}: ${(await respuesta.text()).replace(/\s+/g, ' ').slice(0, 200)}`, reintentable);
        }
      }
      await this.dormir(PAUSAS_REINTENTO_MS[intento] ?? 0);
    }
  }
}

type Interpretacion<T> = { ok: true; datos: T } | { ok: false; problema: string };

export function interpretarJson<T>(texto: string, esquema: z.ZodType<T>): Interpretacion<T> {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let datos: unknown;
  try {
    datos = JSON.parse(limpio);
  } catch {
    return { ok: false, problema: 'no es JSON válido' };
  }
  const resultado = esquema.safeParse(datos);
  return resultado.success ? { ok: true, datos: resultado.data } : { ok: false, problema: describirProblemas(resultado.error).join('; ') };
}
