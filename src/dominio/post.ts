/**
 * Orden única de punta a punta (09/11/2026): el estado de un encargo de post y sus reglas de paso.
 * El encargo vive en <proyectos>/<proyecto>/post.json y avanza paso a paso; se para donde hace falta tu confirmación.
 *
 *   REFERENCIA → FOTO_REAL → PROPUESTA → [CONFIRMAR_ELEMENTOS] → GENERAR → COMPROBAR → [CONFIRMAR_FOTO]
 *   → MASCARA → INTENCION → COMPONER → HECHO
 *
 * Desde F3, INTENCION la escribe el director de diseño (aplicacion/diseno/proponerDiseno.ts); si no hay director o
 * su propuesta no pasa las comprobaciones, deja un borrador y se para, como antes.
 */
import { z } from 'zod';
import type { VeredictoFinal } from './comprobacionSalida.js';
import { Estetica } from './diseno/estetica.js';

export const PasoPost = z.enum(['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'CONFIRMAR_FOTO', 'MASCARA', 'INTENCION', 'COMPONER', 'HECHO']);
export type PasoPost = z.infer<typeof PasoPost>;

/** Los pasos en los que la orden se para y espera `--confirmo` (o `--rechazo`). */
export const PARADAS: readonly PasoPost[] = ['CONFIRMAR_ELEMENTOS', 'CONFIRMAR_FOTO'];

/** Regla de gasto del estudio: se para tras dos fotos descartadas seguidas. */
export const MAX_INTENTOS_SEGUIDOS = 2;

export const IntentoFoto = z.object({
  n: z.number().int().positive(),
  activo: z.string(),
  /** PENDIENTE hasta que pasa la comprobación de salida. RECHAZADA: la descartaste tú en la parada. */
  final: z.enum(['PENDIENTE', 'PASA', 'DESCARTA', 'REVISAR', 'RECHAZADA']),
  motivos: z.array(z.string()).default([]),
  costeUsd: z.number().nonnegative(),
});
export type IntentoFoto = z.infer<typeof IntentoFoto>;

/** F3.3 (punto 11): la foto propia de una diapositiva de detalle del carrusel (un intento; si no pasa, recorte). */
export const TomaDelEncargo = z.object({
  n: z.number().int().positive(),
  elemento: z.string(),
  prompt: z.string(),
  intento: IntentoFoto.optional(),
  /** El activo confirmado para su diapositiva. */
  elegida: z.string().optional(),
});
export type TomaDelEncargo = z.infer<typeof TomaDelEncargo>;

export const EncargoPost = z.object({
  esquema: z.literal('post/encargo@1'),
  proyecto: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'minúsculas, números y guiones'),
  local: z.string(),
  /** La nota del dueño al subir la foto. */
  plato: z.string().min(3),
  /** Ruta de la foto subida (absoluta o relativa a la raíz del proyecto). */
  fotoSubida: z.string(),
  /** Una foto del dueño es publicable; una de internet, no. */
  usoFotoReal: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']).default('PUBLICABLE'),
  /** Id de la referencia registrada con `npm run referencia` (obligatoria en las 5 primeras piezas). */
  referencia: z.string().optional(),
  /**
   * Punto 9 (15/11): el generador recibe también la imagen de la referencia como @image2, solo de estilo. Por defecto,
   * no: se activa por encargo hasta que la prueba A/B diga que no copia (diseno/f3/img/sushita-ab-image2.jpg).
   */
  estiloDeReferencia: z.boolean().default(false),
  /**
   * Punto 10: la estética del post, que manda a la vez sobre la foto y sobre el diseño. Si no se elige, se deduce de la
   * familia de la ficha de referencia en el paso REFERENCIA y se guarda aquí.
   */
  estetica: Estetica.optional(),
  /** Punto 1: un post suelto o un carrusel (portada, dos o tres detalles de la misma foto y cierre con la firma). */
  formato: z.enum(['post', 'carrusel']).default('post'),
  /** F3: el encargo permite UN titular creativo (una palabra de acción o sensorial que no es un dato). Por defecto, no. */
  titularCreativo: z.boolean().default(false),
  /** Con director, generador, revisor y máscara simulados: no gasta ni llama a nada. Los datos van aparte. */
  simulado: z.boolean().default(false),
  paso: PasoPost.default('REFERENCIA'),
  /** Si está, la orden no sigue hasta que lo resuelvas (lo dice el texto). */
  bloqueo: z.string().optional(),
  activoReal: z.string().optional(),
  propuesta: z.object({ archivo: z.string(), prompt: z.string(), problemas: z.array(z.string()) }).optional(),
  /** Lo que autorizaste en la parada de elementos. */
  autorizacion: z.object({ fecha: z.string(), maxIntentos: z.number().int().positive(), estimadoPorIntentoUsd: z.number().nonnegative() }).optional(),
  intentos: z.array(IntentoFoto).default([]),
  /** F3.3: las tomas de detalle de un carrusel (una foto por diapositiva de detalle). */
  tomas: z.array(TomaDelEncargo).default([]),
  fotoElegida: z.string().optional(),
  historial: z.array(z.object({ fecha: z.string(), paso: PasoPost, nota: z.string() })).default([]),
  creadoEn: z.string(),
});
export type EncargoPost = z.infer<typeof EncargoPost>;

/** Intentos descartados seguidos al final de la lista (por la comprobación o por ti). */
export function descartesSeguidos(intentos: IntentoFoto[]): number {
  let n = 0;
  for (let i = intentos.length - 1; i >= 0; i--) {
    const f = intentos[i]!.final;
    if (f === 'DESCARTA' || f === 'RECHAZADA') n++;
    else break;
  }
  return n;
}

/**
 * Tras la comprobación de salida: PASA o REVISAR van a tu parada (REVISAR, con el aviso); DESCARTA vuelve a generar
 * si quedan intentos autorizados, y si no, se bloquea.
 */
export function trasComprobar(final: VeredictoFinal, intentos: IntentoFoto[], maxIntentos = MAX_INTENTOS_SEGUIDOS): { paso: PasoPost; bloqueo?: string } {
  if (final !== 'DESCARTA') return { paso: 'CONFIRMAR_FOTO' };
  if (descartesSeguidos(intentos) >= maxIntentos) {
    return {
      paso: 'CONFIRMAR_ELEMENTOS',
      bloqueo: `${maxIntentos} fotos descartadas seguidas: paro, como dice la regla de gasto. Revisa la propuesta (prompt y elementos) y vuelve a confirmar con --confirmo para otros ${maxIntentos} intentos.`,
    };
  }
  return { paso: 'GENERAR' };
}
