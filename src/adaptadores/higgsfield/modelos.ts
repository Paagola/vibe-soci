/**
 * Una estrategia por modelo de Higgsfield (decisión E6): cada uno tiene sus parámetros y límites.
 * Fuente: creacion-contenido/agent-prompt/*.md (documentación de la API).
 * Ads Studio no está a propósito: impone su propia creatividad.
 */
import type { Formato } from '../../dominio/modelos.js';

export type Resolucion = '1k' | '2k' | '4k';

export interface EntradaModelo {
  prompt: string;
  /** URLs públicas de las referencias, en orden. */
  urls: string[];
  formato: Formato;
  resolucion: Resolucion;
}

export interface EstrategiaModelo {
  readonly id: string;
  readonly maxReferencias: number;
  readonly maxCaracteresPrompt?: number;
  construirCuerpo(entrada: EntradaModelo): Record<string, unknown>;
}

const esHistoria = (formato: Formato) => formato === 'HISTORIA';

/**
 * El feed se pide siempre a 3:4 (1080 × 1440, decisión del 06/11/2026); la exportación 4:5 recorta el centro.
 * Comprobado en open.higgsfield.ai el 06/11/2026: los tres modelos admiten 3:4 y 9:16.
 */

/** Modo directo (enhance_prompt: false): edita con hasta 16 referencias. */
const marketingStudio: EstrategiaModelo = {
  id: 'marketing-studio/image',
  maxReferencias: 16,
  maxCaracteresPrompt: 5000,
  construirCuerpo: ({ prompt, urls, formato, resolucion }) => ({
    prompt,
    image_urls: urls,
    resolution: resolucion,
    aspect_ratio: esHistoria(formato) ? '9:16' : '3:4',
    quality: 'high',
    enhance_prompt: false,
  }),
};

/** Muy bueno con el texto, pero solo admite una imagen de entrada: menos fidelidad al plato. */
const ideogram: EstrategiaModelo = {
  id: 'ideogram/v4.0',
  maxReferencias: 1,
  maxCaracteresPrompt: 2048,
  construirCuerpo: ({ prompt, urls, formato }) => ({
    prompt,
    ...(urls[0] ? { image_url: urls[0] } : {}),
    aspect_ratio: esHistoria(formato) ? '9:16' : '3:4',
    rendering_speed: 'QUALITY',
  }),
};

/** Edición precisa, máximo 2K. */
const grok: EstrategiaModelo = {
  id: 'xai/grok-imagine-image-2.0',
  maxReferencias: 10,
  construirCuerpo: ({ prompt, urls, formato, resolucion }) => ({
    prompt,
    image_urls: urls,
    resolution: resolucion === '1k' ? '1k' : '2k',
    aspect_ratio: esHistoria(formato) ? '9:16' : '3:4',
    quality: 'medium',
  }),
};

export const MODELOS_HIGGSFIELD: Readonly<Record<string, EstrategiaModelo>> = Object.fromEntries(
  [marketingStudio, ideogram, grok].map((estrategia) => [estrategia.id, estrategia]),
);

export const MODELO_POR_DEFECTO = marketingStudio.id;
