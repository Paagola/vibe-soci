import type { DocumentoConocimiento } from '../dominio/conocimiento.js';

/** De dónde lee el director los oficios, principios, rúbrica y fichas de referencia. */
export interface FuenteConocimiento {
  documentos(): Promise<DocumentoConocimiento[]>;
}
