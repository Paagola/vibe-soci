/**
 * Generación de imagen con los modelos de imagen de Gemini (Nano Banana Pro = gemini-3-pro-image), por la API
 * de Gemini. Es el modelo que el método DirectorIA del repositorio Society usa para fotos de comida guiadas por
 * referencias; en la API de Higgsfield no está (diseno/ARQUITECTURA.md).
 *
 * Aquí solo hay funciones puras: construir la petición, estimar el precio y leer la respuesta. La llamada vive
 * en herramientas/generarGeminiImagen.ts, con tope y registro de gasto.
 */
import { z } from 'zod';

export type TamanoImagen = '1K' | '2K' | '4K';

export interface Tarifa {
  /** USD por millón de tokens de entrada (texto e imagen). */
  entrada: number;
  /** USD por millón de tokens de salida de texto y de razonamiento. */
  salidaTexto: number;
  /** USD por millón de tokens de imagen generada. */
  salidaImagen: number;
  /** Tokens que cuesta cada imagen generada, por tamaño. */
  tokensImagen: Record<TamanoImagen, number>;
  fuente: string;
}

/** Solo modelos con la tarifa comprobada en la página oficial. */
export const TARIFAS: Readonly<Record<string, Tarifa>> = {
  'gemini-3-pro-image': {
    entrada: 2,
    salidaTexto: 12,
    salidaImagen: 120,
    tokensImagen: { '1K': 1120, '2K': 1120, '4K': 2000 },
    fuente: 'aistudio.google.com/docs/pricing, consultado el 07/11/2026 (sin capa gratuita)',
  },
};

/** El razonamiento no se conoce antes de enviar: se reserva este máximo para que la estimación no se quede corta. */
export const RESERVA_RAZONAMIENTO_TOKENS = 2000;

export interface ReferenciaImagen {
  /** Cómo se nombra en el prompt, p. ej. «@image1». */
  etiqueta: string;
  bytes: Buffer;
  mime: string;
}

/**
 * Cada imagen va precedida de su etiqueta en texto, para que «@image1» del prompt apunte a la imagen correcta
 * (orden deliberado: la primera pesa más). El brief va al final.
 */
export function construirContenido(prompt: string, referencias: ReferenciaImagen[]): Array<{ role: 'user'; parts: unknown[] }> {
  const partes: unknown[] = [];
  for (const referencia of referencias) {
    partes.push({ text: `${referencia.etiqueta}:` });
    partes.push({ inline_data: { mime_type: referencia.mime, data: referencia.bytes.toString('base64') } });
  }
  partes.push({ text: prompt });
  return [{ role: 'user', parts: partes }];
}

export function construirPeticion(prompt: string, referencias: ReferenciaImagen[], aspectRatio: string, imageSize: TamanoImagen) {
  return {
    contents: construirContenido(prompt, referencias),
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio, imageSize } },
  };
}

function tarifaDe(modelo: string): Tarifa {
  const tarifa = TARIFAS[modelo];
  if (!tarifa) throw new Error(`No hay tarifa comprobada para ${modelo}: sin precio no se puede vigilar el tope.`);
  return tarifa;
}

/** Estimación por arriba: entrada contada por la API + una imagen + la reserva de razonamiento. */
export function estimarUsd(modelo: string, tokensEntrada: number, tamano: TamanoImagen): number {
  const t = tarifaDe(modelo);
  return (tokensEntrada * t.entrada + RESERVA_RAZONAMIENTO_TOKENS * t.salidaTexto + t.tokensImagen[tamano] * t.salidaImagen) / 1e6;
}

const DetalleModalidad = z.object({ modality: z.string(), tokenCount: z.number().default(0) });

export const Uso = z.object({
  promptTokenCount: z.number().default(0),
  candidatesTokenCount: z.number().default(0),
  thoughtsTokenCount: z.number().default(0),
  candidatesTokensDetails: z.array(DetalleModalidad).default([]),
});
export type Uso = z.infer<typeof Uso>;

/** Lo que cuesta de verdad una respuesta, con el recuento de tokens que devuelve la propia API. */
export function costeRealUsd(modelo: string, uso: Uso): number {
  const t = tarifaDe(modelo);
  const imagen = uso.candidatesTokensDetails.filter((d) => d.modality === 'IMAGE').reduce((s, d) => s + d.tokenCount, 0);
  const textoCandidato = Math.max(0, uso.candidatesTokenCount - imagen);
  return (uso.promptTokenCount * t.entrada + (textoCandidato + uso.thoughtsTokenCount) * t.salidaTexto + imagen * t.salidaImagen) / 1e6;
}

/** Una línea del registro datos/gasto/gemini.jsonl. `estimadoUsd` es siempre el precio de pago, como referencia. */
export const GastoGemini = z.object({
  fecha: z.string(),
  receta: z.string(),
  activo: z.string(),
  modelo: z.string(),
  /** GRATUITO: clave sin facturación activada; no cobra y no cuenta para el tope. */
  tier: z.enum(['GRATUITO', 'PAGO']).default('PAGO'),
  estimadoUsd: z.number(),
  realUsd: z.number().optional(),
  estado: z.enum(['ENVIADO', 'COMPLETADO', 'SIN_IMAGEN', 'FALLIDO']),
  detalle: z.string().optional(),
});
export type GastoGemini = z.infer<typeof GastoGemini>;

/**
 * Lo gastado, por envío (receta + activo; gana la última línea): el coste real si se conoce; si no, el estimado.
 * Cuentan 0 el tier gratuito y lo FALLIDO (rechazo HTTP, no cobra). Lo ENVIADO sin respuesta cuenta su estimado.
 */
export function sumarGasto(lineas: string[]): number {
  const porEnvio = new Map<string, GastoGemini>();
  for (const linea of lineas.filter((l) => l.trim())) {
    const gasto = GastoGemini.parse(JSON.parse(linea));
    const clave = `${gasto.receta}|${gasto.activo}`;
    porEnvio.set(clave, { ...porEnvio.get(clave), ...gasto });
  }
  let suma = 0;
  for (const g of porEnvio.values()) {
    if (g.tier === 'GRATUITO' || g.estado === 'FALLIDO') continue;
    suma += g.realUsd ?? g.estimadoUsd;
  }
  return suma;
}

const Respuesta = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z
              .array(
                z.object({
                  text: z.string().optional(),
                  thought: z.boolean().optional(),
                  inlineData: z.object({ mimeType: z.string(), data: z.string() }).optional(),
                }),
              )
              .default([]),
          })
          .optional(),
      }),
    )
    .default([]),
  usageMetadata: Uso.optional(),
});

export type LecturaRespuesta =
  | { ok: true; bytes: Buffer; mime: string; texto: string[]; uso?: Uso }
  | { ok: false; motivo: string; texto: string[]; uso?: Uso };

/** La última imagen que no sea de razonamiento; si no hay, el motivo (p. ej. finishReason de seguridad). */
export function leerRespuesta(json: unknown): LecturaRespuesta {
  const r = Respuesta.parse(json);
  const candidato = r.candidates[0];
  const partes = candidato?.content?.parts ?? [];
  const texto = partes.filter((p) => p.text && !p.thought).map((p) => p.text as string);
  const imagenes = partes.filter((p) => p.inlineData && !p.thought);
  const imagen = imagenes[imagenes.length - 1]?.inlineData;
  const uso = r.usageMetadata;
  if (!imagen) return { ok: false, motivo: `sin imagen (finishReason: ${candidato?.finishReason ?? 'desconocido'})`, texto, ...(uso ? { uso } : {}) };
  return { ok: true, bytes: Buffer.from(imagen.data, 'base64'), mime: imagen.mimeType, texto, ...(uso ? { uso } : {}) };
}
