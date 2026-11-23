import type { EstiloTexto } from '../dominio/diseno/intencion.js';
import type { Receta } from '../dominio/tipografia/receta.js';
import type { Imagen, PanelDeMuestra } from '../dominio/tipografia/verificacion.js';

/** El estilo de texto de un panel (sin color: lo pone el panel). */
export type EstiloDePanel = Omit<EstiloTexto, 'color'>;

export interface PanelPintado {
  /** El panel tratado, recortado a la franja del texto, en PNG (lo que lee el OCR y va a la hoja). */
  png: Buffer;
  /** Los píxeles del panel tratado y del mismo panel con la letra limpia, para medir la conservación. */
  tratada: Imagen;
  limpia: Imagen;
  cap: number;
  /** Si el compositor llegó a pintar el estilo (la ficha puede dejar la letra limpia). */
  aplicado: boolean;
  avisos: string[];
  msRender: number;
  hash: string;
  hashRepetido: string;
}

/**
 * Pinta los paneles de la hoja de muestras de una receta con el compositor de verdad y compone la hoja.
 * Determinista: misma receta y panel, mismos píxeles.
 */
export interface PintorDeMuestras {
  /** Nombre de la familia y etiquetas (grotesca, serif, alto-contraste…) de una fuente del catálogo. */
  familia(fuente: string): string;
  clasificacion(fuente: string): string[];
  pintarPanel(receta: Receta, panel: PanelDeMuestra, estilo: EstiloDePanel): Promise<PanelPintado>;
  /**
   * La hoja entera: los paneles en una rejilla (fila por fuente y palabra, columna por fondo), con su rótulo.
   * `nota`: dos líneas separadas por «\n»; si empieza por «✓» el rótulo va en verde.
   */
  componerHoja(paneles: Array<{ panel: PanelDeMuestra; png: Buffer; nota: string }>, titulo: string): Promise<Buffer>;
}
