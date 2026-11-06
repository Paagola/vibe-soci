import type { Marca, Pieza } from '../dominio/modelos.js';

export interface AlmacenPiezas {
  existe(id: string): Promise<boolean>;
  obtener(id: string): Promise<Pieza>;
  /** Solo para crear una pieza nueva. Para cambiar una que existe, usa `actualizar`. */
  guardar(pieza: Pieza): Promise<void>;
  /**
   * Lee lo último guardado, aplica el cambio y lo guarda, sin que otra escritura de la misma
   * pieza se cuele en medio. Así un trabajo largo no pisa un voto o una importación hechos mientras tanto.
   * Devuelve la pieza tal como queda.
   */
  actualizar(id: string, cambio: (pieza: Pieza) => Pieza | Promise<Pieza>): Promise<Pieza>;
  listar(): Promise<Pieza[]>;

  /** Ruta absoluta de un archivo de la pieza (p. ej. fotos/01-plato.jpg). */
  rutaArchivo(id: string, archivo: string): string;
  copiarArchivo(id: string, origenAbsoluto: string, archivo: string): Promise<void>;
  escribirArchivo(id: string, archivo: string, contenido: Buffer | string): Promise<void>;
}

export interface AlmacenLocales {
  existe(slug: string): Promise<boolean>;
  obtener(slug: string): Promise<Marca>;
  guardar(marca: Marca): Promise<void>;
  listar(): Promise<Marca[]>;
}
