import type { ReferenciaLocal } from '../dominio/referencia.js';

/** Las referencias de diseño de cada local (datos/locales/<slug>/referencias/<id>/). Una referencia no se sobrescribe salvo para añadir su ficha. */
export interface AlmacenReferencias {
  existe(local: string, id: string): Promise<boolean>;
  obtener(local: string, id: string): Promise<ReferenciaLocal>;
  guardar(referencia: ReferenciaLocal): Promise<void>;
  listar(local: string): Promise<ReferenciaLocal[]>;
  escribirArchivo(local: string, id: string, archivo: string, contenido: Buffer): Promise<void>;
  rutaArchivo(local: string, id: string, archivo: string): string;
}
