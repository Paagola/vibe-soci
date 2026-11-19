/**
 * Tipos mínimos de fontkit 2 (la librería no trae los suyos).
 * Solo declara lo que usa el compositor: abrir fuentes, variaciones, maquetar una línea y los trazos de cada glifo.
 */
declare module 'fontkit' {
  export interface Caja {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export interface Trazo {
    readonly commands: ReadonlyArray<{ command: string; args: number[] }>;
    readonly bbox: Caja;
    scale(x: number, y?: number): Trazo;
    translate(x: number, y: number): Trazo;
    transform(m0: number, m1: number, m2: number, m3: number, m4: number, m5: number): Trazo;
    toSVG(): string;
  }

  export interface Glifo {
    readonly id: number;
    readonly path: Trazo;
    readonly bbox: Caja;
    readonly advanceWidth: number;
    /** Los caracteres Unicode que representa (una ligadura «fi» lleva dos). */
    readonly codePoints: number[];
  }

  export interface PosicionGlifo {
    xAdvance: number;
    yAdvance: number;
    xOffset: number;
    yOffset: number;
  }

  export interface Linea {
    readonly glyphs: Glifo[];
    readonly positions: PosicionGlifo[];
    readonly advanceWidth: number;
  }

  export interface Eje {
    name: string;
    min: number;
    default: number;
    max: number;
  }

  export interface Fuente {
    readonly postscriptName: string;
    readonly familyName: string;
    readonly unitsPerEm: number;
    readonly ascent: number;
    readonly descent: number;
    readonly capHeight: number;
    readonly xHeight: number;
    readonly variationAxes: Record<string, Eje>;
    /** Rasgos OpenType que tiene la fuente (liga, smcp, swsh, ss01…). */
    readonly availableFeatures: string[];
    getVariation(ejes: Record<string, number>): Fuente;
    layout(texto: string, features?: string[] | Record<string, boolean>): Linea;
  }

  export function openSync(ruta: string, postscriptName?: string): Fuente;
}
