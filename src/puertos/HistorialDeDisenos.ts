import type { Intencion } from '../dominio/diseno/intencion.js';
import type { HuellaTipografica } from '../dominio/diseno/huella.js';

/** F3.3 (punto 14): las piezas anteriores de un local, para su huella tipográfica, y dónde se guarda la huella. */
export interface HistorialDeDisenos {
  /** La última versión de cada diapositiva compuesta del local. */
  intencionesDelLocal(local: string): Promise<Intencion[]>;
  guardarHuella(local: string, huella: HuellaTipografica): Promise<void>;
}
