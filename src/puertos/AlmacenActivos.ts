import type { ActivoDisponible } from './Compositor.js';

export interface AlmacenActivos {
  /** El activo con las rutas absolutas de su imagen y su máscara. */
  obtener(localSlug: string, id: string): Promise<ActivoDisponible>;
}
