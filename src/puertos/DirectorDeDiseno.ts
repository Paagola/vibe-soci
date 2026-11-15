/**
 * F3 · El director de diseño: escribe la propuesta de diseño (dominio/diseno/propuesta.ts) a partir de los hechos de la
 * pieza, la ficha de la referencia y el mapa de la foto. El código la comprueba y la compila en una intención.
 */
import type { MapaDeFoto } from '../dominio/diseno/mapaDeFoto.js';
import type { HechosDeLaPieza, PropuestaDeDiseno } from '../dominio/diseno/propuesta.js';
import type { FichaReferencia } from '../dominio/referencia.js';
import type { Estetica } from '../dominio/diseno/estetica.js';
import type { ActivoDisponible } from './Compositor.js';

/** Mide la foto (dónde está el plato, dónde hay aire, qué colores manda) sin gastar visión. */
export interface MedidorDeFoto {
  medir(foto: ActivoDisponible, reticula?: { columnas: number; filas: number }): Promise<MapaDeFoto>;
}

/** Un color que el director puede usar: su token (sin la arroba), su HEX y de dónde sale. */
export interface ColorDisponible {
  token: string;
  hex: string;
  papel: string;
}

/** Una voz tipográfica que el director puede usar: su id y cómo es (familia, peso, caso). */
export interface VozDisponible {
  id: string;
  descripcion: string;
}

export interface EncargoDeDiseno {
  /** Lo único que la pieza puede decir. */
  hechos: HechosDeLaPieza;
  /** La referencia del post: su ficha (oficio) y su imagen, si la hay. Nunca sus textos. */
  referencia?: { id: string; ficha?: FichaReferencia; imagen?: string };
  /** Ruta de la foto nueva confirmada (para que el director la vea en pequeño). */
  foto: string;
  mapa: MapaDeFoto;
  colores: ColorDisponible[];
  voces: VozDisponible[];
  /** El encargo permite UN titular creativo (palabra de acción o sensorial que no es un dato). */
  titularCreativo: boolean;
  /** Punto 10: la estética del encargo (manda sobre la foto y el diseño). */
  estetica?: Estetica;
}

export interface DirectorDeDiseno {
  readonly nombre: string;
  /** `problemasPrevios`: lo que falló en la propuesta anterior (vacío la primera vez). */
  proponer(encargo: EncargoDeDiseno, problemasPrevios: string[]): Promise<PropuestaDeDiseno>;
}

/** Lo que dice la crítica visual: si la pieza llega al oficio de la referencia y, si no, la propuesta corregida. */
export interface CriticaDeDiseno {
  llega: boolean;
  motivos: string[];
  propuesta?: PropuestaDeDiseno;
}

/** Mira la pieza pintada junto a la referencia: lo que solo se ve (el oficio), no lo que se mide. */
export interface CriticoDeDiseno {
  readonly nombre: string;
  criticar(encargo: EncargoDeDiseno, propuesta: PropuestaDeDiseno, pieza: string): Promise<CriticaDeDiseno>;
}
