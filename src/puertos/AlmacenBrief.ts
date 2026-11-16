import type { BriefDelEncargo } from '../dominio/brief.js';
import type { EntradaBitacora } from '../dominio/bitacora.js';

export interface AlmacenBrief {
  /** undefined si el encargo no tiene brief. */
  leer(proyecto: string): Promise<BriefDelEncargo | undefined>;
  /** Escribe brief.json y su copia brief.v00N.json (N = version, 3 cifras). Sin brief previo, version tiene que ser 1; con uno, la anterior + 1. Si no, lanza Error. */
  guardar(brief: BriefDelEncargo): Promise<void>;
  /** Añade una línea a bitacora.jsonl (la valida con EntradaBitacora). */
  anotar(proyecto: string, entrada: EntradaBitacora): Promise<void>;
  /** Las entradas de bitacora.jsonl, en orden ([] si no hay). Lanza si una línea no es válida. */
  bitacora(proyecto: string): Promise<EntradaBitacora[]>;
}
