import type { Activo } from '../dominio/activos.js';
import type { RevisionAutomatica } from '../dominio/comprobacionSalida.js';
import type { ActivoDisponible } from './Compositor.js';

export interface AlmacenActivos {
  /** El activo con las rutas absolutas de su imagen y su máscara. */
  obtener(localSlug: string, id: string): Promise<ActivoDisponible>;
  existe(localSlug: string, id: string): Promise<boolean>;
  /** Crea un activo nuevo con sus archivos (p. ej. original.png). Un activo no se sobrescribe. */
  crear(activo: Activo, archivos: Record<string, Buffer>): Promise<void>;
  /** Cambia campos de un activo (y añade archivos, p. ej. su máscara), conservando los campos que el esquema no conoce. */
  actualizar(localSlug: string, id: string, cambios: Partial<Activo>, archivos?: Record<string, Buffer>): Promise<void>;
  /** Guarda la comprobación de salida en el activo (sustituye a la anterior; el resto del activo no cambia). */
  anotarRevision(localSlug: string, id: string, revision: RevisionAutomatica): Promise<void>;
}
