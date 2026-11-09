import type { FamiliaBiblioteca, FichaReferencia } from '../dominio/referencia.js';

/** Las familias y fichas de los posts de referencia del estudio (conocimiento/referencias/ y biblioteca/referencias/). */
export interface BibliotecaDeReferencias {
  familias(): Promise<FamiliaBiblioteca[]>;
  /** Ficha de un post (p. ej. «post-11»). */
  ficha(post: string): Promise<FichaReferencia>;
  rutaImagen(post: string): string;
}
