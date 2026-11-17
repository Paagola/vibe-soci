import type { ElementoComparable } from '../dominio/inventario.js';

export type QuienLlama = 'productor' | 'director-foto' | 'revisor' | 'director-diseno' | 'critico' | 'analista';

/** Lo que el productor da a los especialistas de un encargo. */
export interface FuenteDelBrief {
  /** El brief en texto; undefined si el encargo aún no tiene brief. */
  contexto(): Promise<string | undefined>;
  /** El inventario confirmado por el usuario; undefined si aún no está confirmado. */
  inventarioConfirmado(): Promise<readonly ElementoComparable[] | undefined>;
  /** Antes de cada llamada de texto o visión; lanza (ErrorDeUsuario) si el presupuesto de llamadas se ha acabado. */
  antesDeLlamar(quien: QuienLlama): Promise<void>;
}
