/**
 * Estudio de arte · puertos del director de arte, del crítico y del comparador (los implementa un modelo con visión).
 */
import type { Critica } from '../dominio/arte/rubrica.js';
import type { ElementoGrafico, PropuestaDeDirecciones, PropuestaInspirada, Receta } from '../dominio/arte/receta.js';
import type { MapaDeFoto } from '../dominio/diseno/mapaDeFoto.js';
import type { HechosDeLaPieza } from '../dominio/diseno/propuesta.js';
import type { ColorDisponible, VozDisponible } from './DirectorDeDiseno.js';

export interface EncargoDeArte {
  hechos: HechosDeLaPieza;
  /** Para qué es la pieza (presentar el producto estrella, una novedad, un aviso, un ritual…). */
  mensaje: string;
  /** Se permite copy CREATIVO (sin cita, sin reclamos). */
  creativo: boolean;
  /** Ruta de la foto del producto. */
  foto: string;
  mapa: MapaDeFoto;
  /** Por dónde corta la foto al producto (si toca un borde, recortado se ve el corte recto). */
  cortes: string[];
  colores: ColorDisponible[];
  voces: Array<VozDisponible & { papel: string }>;
  referencias: Array<{ ruta: string; texto: string }>;
  /** Cuántas direcciones. */
  direcciones: number;
  /** Direcciones ya hechas para este local (sus huellas): no repetirlas. */
  anteriores?: string[];
  /** Modo referencia: el post que eligió el cliente (imagen y ficha). Las direcciones parten de él y lo mejoran. */
  referencia?: { id: string; ruta: string; ficha?: unknown };
}

export interface PiezaPintada {
  receta: Receta;
  /** PNG a 1080 × 1440. */
  png: string;
  /** PNG a 360 px de ancho. */
  movil: string;
  /** Lo que mide el código: avisos del compositor, lectura por OCR a 360 px. */
  medidas: string[];
}

export interface DirectorDeArte {
  readonly nombre: string;
  proponer(encargo: EncargoDeArte, devolver: string[]): Promise<PropuestaDeDirecciones>;
  /** Corrige UNA dirección que no compila, sin cambiar su idea. */
  reparar(encargo: EncargoDeArte, receta: Receta, problemas: string[]): Promise<Receta>;
  /** Modo referencia: estudia la referencia y propone direcciones hermanas que la mejoran. */
  inspirar?(encargo: EncargoDeArte, devolver: string[]): Promise<PropuestaInspirada>;
  /** Mira una pieza ya pintada y propone elementos gráficos dibujados que le añadan oficio o carácter. */
  enriquecer?(encargo: EncargoDeArte, pieza: { png: string; receta: Receta; mapa?: string }): Promise<{ mejoras: Array<{ categoria: string; que: string; instruccion: string }>; elementos: ElementoGrafico[]; porque: string; insercion: string; reestilizar: string[] }>;
}

export interface CriticoDeArte {
  readonly nombre: string;
  criticar(encargo: EncargoDeArte, pieza: PiezaPintada): Promise<Critica>;
}

export interface ComparadorDeArte {
  /** Con `referencia`, la ve primero y premia el parentesco que mejora. */
  comparar(piezas: Array<{ letra: string; movil: string }>, referencia?: string): Promise<{ orden: string[]; plantilla: string[][]; motivo: string }>;
}
