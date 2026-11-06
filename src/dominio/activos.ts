/**
 * Un activo es una imagen que puede entrar en un diseño, con su procedencia.
 * La foto real del restaurante es la fuente de verdad del producto. Una imagen generada se marca con
 * lo que cambia respecto a la real, y no se publica sin autorización (fidelidad ESTRICTA por defecto).
 */
import { z } from 'zod';

const RectPx = z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int().positive(), h: z.number().int().positive() });

export const Activo = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  localSlug: z.string(),
  tipo: z.enum(['REAL', 'GENERADO']),
  /** Solo los activos PUBLICABLE pueden ir en una pieza comercial. */
  uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']),
  descripcion: z.string(),
  /** Copia de trabajo dentro de la carpeta del activo; el original no se toca. */
  archivo: z.string(),
  ancho: z.number().int().positive(),
  alto: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  procedencia: z.object({
    /** Ruta del original, relativa al proyecto. */
    ruta: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    copiadoEn: z.string(),
    generador: z.object({ modelo: z.string(), pieza: z.string(), version: z.number().int() }).optional(),
  }),
  /** Lo que cambia respecto al producto real. Vacío en una foto real. */
  alteraciones: z.array(z.string()).default([]),
  mascara: z
    .object({
      archivo: z.string(),
      metodo: z.enum(['APPLE_VISION', 'GEMINI', 'MANUAL']),
      creadaEn: z.string(),
      /** Caja del sujeto en píxeles de la imagen. */
      bbox: RectPx,
      /** Qué entra en la máscara (p. ej. «burger y papel; no la tabla»). */
      incluye: z.string(),
    })
    .optional(),
  /** Alturas de partes del sujeto (0 = arriba de la caja del sujeto, 1 = abajo), anotadas a mano o por el análisis. */
  niveles: z.array(z.object({ id: z.string(), y: z.number().min(0).max(1), nombre: z.string() })).default([]),
});
export type Activo = z.infer<typeof Activo>;
