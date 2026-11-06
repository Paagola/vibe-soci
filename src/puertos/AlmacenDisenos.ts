import type { Intencion } from '../dominio/diseno/intencion.js';
import type { Resuelto } from '../dominio/diseno/resuelto.js';
import type { Renderizado } from './Compositor.js';

export interface VersionGuardada {
  /** Carpeta de la versión. */
  carpeta: string;
  archivos: string[];
}

/**
 * Guarda cada versión de un diseño entera y aparte: intención, documento resuelto, render, capas y SVG.
 * Una versión nunca se sobrescribe; editar crea la siguiente.
 */
export interface AlmacenDisenos {
  guardar(destino: string, intencion: Intencion, resuelto: Resuelto, renderizado: Renderizado): Promise<VersionGuardada>;
  /** Ruta absoluta de un archivo dentro de la carpeta de un diseño. */
  ruta(destino: string, archivo: string): string;
}
