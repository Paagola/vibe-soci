import type { RevisionAutomatica } from '../dominio/comprobacionSalida.js';
import type { ActivoDisponible } from './Compositor.js';

export interface AlmacenActivos {
  /** El activo con las rutas absolutas de su imagen y su máscara. */
  obtener(localSlug: string, id: string): Promise<ActivoDisponible>;
  /** Guarda la comprobación de salida en el activo (sustituye a la anterior; el resto del activo no cambia). */
  anotarRevision(localSlug: string, id: string, revision: RevisionAutomatica): Promise<void>;
}
