import type { Activo } from '../dominio/activos.js';
import type { Intencion } from '../dominio/diseno/intencion.js';
import type { Resuelto } from '../dominio/diseno/resuelto.js';

/** Un activo listo para usar: sus datos y dónde están sus archivos. */
export interface ActivoDisponible {
  activo: Activo;
  /** Ruta absoluta de la imagen. */
  ruta: string;
  /** Ruta absoluta de la máscara (PNG en escala de grises), si tiene. */
  rutaMascara?: string;
  mascaraSha256?: string;
}

export interface CapaRenderizada {
  id: string;
  z: number;
  /** PNG del tamaño del lienzo, con transparencia: la capa sola. */
  png: Buffer;
  /** true si se reutilizó de un render anterior porque no cambió. */
  reutilizada: boolean;
}

export interface Renderizado {
  /** La pieza compuesta, en PNG. */
  png: Buffer;
  capas: CapaRenderizada[];
  /** SVG por capas con el texto como <text>: para abrirlo y retocarlo en Figma o Illustrator. */
  svgEditable: string;
  /** SVG por capas con el texto como trazos: igual que el PNG. */
  svgExacto: string;
  /** Contraste medido de cada texto con lo que tiene detrás (ratio WCAG, peor 10 % de sus píxeles). */
  contraste: Record<string, number>;
}

/**
 * Compone un diseño: primero lo resuelve (de la intención a píxeles) y después lo pinta por capas.
 * Separado en dos pasos para poder revisar y guardar el documento resuelto antes de pintarlo.
 */
export interface Compositor {
  resolver(intencion: Intencion, activos: Record<string, ActivoDisponible>): Promise<Resuelto>;
  renderizar(resuelto: Resuelto, activos: Record<string, ActivoDisponible>): Promise<Renderizado>;
}
