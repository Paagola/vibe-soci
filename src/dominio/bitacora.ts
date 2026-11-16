/**
 * Productor (fase 1): esquema de la bitácora del orquestador. Dominio puro.
 */
import { z } from 'zod';
import { PasoPost } from './post.js';

export const QuienEnBitacora = z.enum(['productor', 'director-foto', 'generador', 'revisor', 'director-diseno', 'critico', 'analista', 'codigo', 'usuario']);
export type QuienEnBitacora = z.infer<typeof QuienEnBitacora>;

export const TipoEnBitacora = z.enum(['ENCARGO', 'INFORME', 'COTEJO', 'CONFLICTO', 'DECISION', 'PARADA', 'CONFIRMACION', 'DEGRADADO', 'PRESUPUESTO', 'LLAMADA']);
export type TipoEnBitacora = z.infer<typeof TipoEnBitacora>;

export const EntradaBitacora = z.object({
  fecha: z.string().min(1),
  quien: QuienEnBitacora,
  paso: PasoPost,
  tipo: TipoEnBitacora,
  texto: z.string().min(1),
  datos: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type EntradaBitacora = z.infer<typeof EntradaBitacora>;

/** Valida y devuelve la entrada con la fecha puesta. */
export function nuevaEntrada(e: Omit<EntradaBitacora, 'fecha'>, fecha: string): EntradaBitacora {
  return EntradaBitacora.parse({ ...e, fecha });
}
