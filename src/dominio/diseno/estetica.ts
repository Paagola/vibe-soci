/**
 * Punto 10 (15/11): la ESTÉTICA del encargo, una dirección artística que manda a la vez sobre la foto y sobre el diseño
 * («si el post está en maximalismo, se tendrá que crear en base a eso tanto la colocación de la tipografía como los
 * elementos y la creación de la imagen»). La leen el director de foto (luz, fondo, atrezo, saturación, encuadre, aire),
 * el director de diseño y su crítico (mecanismos, recursos, color) y el compositor (los umbrales de oficio).
 *
 * No se inventa: cada estética agrupa familias de las referencias del usuario (conocimiento/referencias/familias.md,
 * F1–F10) y toma sus umbrales de diseno/f3/INVESTIGACION.md §3.1. Las de editorial son las de siempre; las de color y
 * maximalismo los aflojan donde su oficio pide justo lo contrario (más recursos, más gestos, titulares que se pisan).
 * Dominio puro.
 */
import { z } from 'zod';
import type { Familia, Tratamiento } from '../referencia.js';
import type { Mecanismo } from './propuesta.js';

export const Estetica = z.enum(['EDITORIAL_SERENO', 'EDITORIAL_OSCURO', 'COLOR_POP', 'MAXIMALISMO', 'MEDITERRANEO_LUMINOSO', 'RUSTICO_FUEGO']);
export type Estetica = z.infer<typeof Estetica>;

/** Los límites de oficio que mide el compositor (oficio.ts). */
export interface LimitesDeOficio {
  /** Salto de escala mínimo (texto mayor / menor). */
  saltoMinimo: number;
  palabrasMaximas: number;
  nivelesMaximos: number;
  vocesMaximas: number;
  /** Familias de gesto a mano distintas. */
  gestosMaximos: number;
  /** Sellos y patrones. */
  recursosMaximos: number;
}

/** Los de siempre (INVESTIGACION.md §3.1): sirven a las estéticas editoriales. */
export const LIMITES_EDITORIALES: LimitesDeOficio = { saltoMinimo: 3.5, palabrasMaximas: 30, nivelesMaximos: 4, vocesMaximas: 3, gestosMaximos: 1, recursosMaximos: 2 };

export interface ParametrosDeEstetica {
  nombre: string;
  /** En una frase, para las personas y los directores. */
  idea: string;
  /** Las familias de referencia de las que sale. */
  familias: Familia[];
  /** Para el director de foto y el prompt (en inglés, va al generador). Nada de esto añade comida: la fidelidad manda. */
  foto: { luz: string; fondo: string; atrezo: string; color: string; encuadre: string };
  diseno: {
    /** Mecanismos que caben, de más a menos propio. */
    mecanismos: Mecanismo[];
    /** Recursos que caben además del titular: sello, anotaciones, tinta impresa, diagonal de color… */
    recursos: Array<'sello' | 'anotaciones' | 'tinta' | 'diagonal' | 'acento'>;
    /** Cómo se usa el color, para el director. */
    color: string;
    limites: LimitesDeOficio;
    /**
     * F3.3 (punto 13): elementos gráficos que le corresponden y cuántos como mucho. Los colocan los mecanismos, cada uno
     * con un papel en la composición (enmarcar el plato, llenar un vacío, separar niveles), nunca de adorno suelto.
     */
    graficos: { tipos: Grafico[]; maximo: number };
    /** F3.3 (punto 12): los tratamientos de la referencia que esta estética sabe reproducir con el compositor. */
    tratamientos: Tratamiento[];
  };
}

/** Elementos gráficos que el compositor sabe pintar y los mecanismos saben colocar. */
export type Grafico = 'circulo' | 'mancha' | 'filete' | 'puntos';

export const ESTETICAS: Record<Estetica, ParametrosDeEstetica> = {
  EDITORIAL_SERENO: {
    nombre: 'Editorial sereno',
    idea: 'Claro, aire y un solo gesto: el plato y una palabra, como una revista de cocina (F6, F8).',
    familias: ['F6', 'F8'],
    foto: {
      luz: 'soft diffused daylight, gentle shadows',
      fondo: 'a pale stone or off-white surface with generous empty space',
      atrezo: 'no props beyond the real tableware',
      color: 'natural, slightly muted colours',
      encuadre: 'the dish small to medium in the frame, cut by one edge, lots of calm negative space',
    },
    diseno: { mecanismos: ['ANOTACIONES', 'TITULAR_DETRAS'], recursos: ['anotaciones'], color: 'Fondo claro, una sola tinta oscura y, como mucho, un acento pequeño.', limites: LIMITES_EDITORIALES, graficos: { tipos: ['filete'], maximo: 1 }, tratamientos: ['PAPEL'] },
  },
  EDITORIAL_OSCURO: {
    nombre: 'Editorial oscuro',
    idea: 'Clave baja, luz lateral y un logotipo tipográfico de script con didona (F4, F5).',
    familias: ['F4', 'F5'],
    foto: {
      luz: 'low-key light, a single hard side light or flash, deep shadows',
      fondo: 'a dark, almost black environment',
      atrezo: 'no props beyond the real tableware',
      color: 'rich but controlled colours, the dish the only bright area',
      encuadre: 'the dish in three-quarter view in the lower part, dark air above for the title',
    },
    diseno: { mecanismos: ['TITULAR_CON_ACENTO', 'TITULAR_DETRAS', 'ANOTACIONES'], recursos: ['acento', 'tinta'], color: 'Negro de fondo; texto claro y un acento de la marca en el script.', limites: LIMITES_EDITORIALES, graficos: { tipos: ['filete'], maximo: 1 }, tratamientos: ['TINTA'] },
  },
  COLOR_POP: {
    nombre: 'Color pop con recorte',
    idea: 'Color plano saturado de la marca, producto recortado enorme y una palabra gigante (F1, F3).',
    familias: ['F1', 'F3'],
    foto: {
      luz: 'bright, even studio light with crisp contact shadows',
      fondo: 'a clean, plain, uniform background that makes the dish easy to cut out',
      atrezo: 'no props: only the dish on its real tableware',
      color: 'saturated, punchy colours',
      encuadre: 'the whole dish inside the frame, not cut by any edge, from a slightly high three-quarter view',
    },
    diseno: {
      mecanismos: ['PLATO_SOBRE_COLOR', 'TITULAR_DETRAS'],
      recursos: ['diagonal', 'sello'],
      color: 'Campos planos de dos colores de la marca partidos en diagonal; el producto es el único color fotográfico.',
      limites: { ...LIMITES_EDITORIALES, recursosMaximos: 3, vocesMaximas: 3 },
      graficos: { tipos: ['circulo', 'puntos'], maximo: 2 },
      tratamientos: ['PEGATINA', 'PAPEL', 'PINCEL', 'TINTA', 'ILUSTRADO'],
    },
  },
  MAXIMALISMO: {
    nombre: 'Maximalismo / collage',
    idea: 'Capas, pegatinas, sellos y flechas, saturación y titulares que se pisan: mucho, pero con jerarquía (F2, F9).',
    familias: ['F2', 'F9'],
    foto: {
      luz: 'bright direct daylight flash, hard and joyful',
      fondo: 'a bold coloured surface or patterned tablecloth',
      atrezo: 'everyday table props are welcome only if they were already in the real photo; never add food',
      color: 'very saturated, high contrast',
      encuadre: 'the dish large and close, cut by the frame, slightly tilted',
    },
    diseno: {
      mecanismos: ['PLATO_SOBRE_COLOR', 'ANOTACIONES', 'TITULAR_DETRAS'],
      recursos: ['sello', 'anotaciones', 'tinta', 'diagonal'],
      color: 'Todos los colores de la marca a la vez, en bloques; tinta impresa y sellos.',
      limites: { saltoMinimo: 2.5, palabrasMaximas: 45, nivelesMaximos: 5, vocesMaximas: 3, gestosMaximos: 3, recursosMaximos: 5 },
      graficos: { tipos: ['mancha', 'circulo', 'puntos', 'filete'], maximo: 4 },
      tratamientos: ['PEGATINA', 'PAPEL', 'PINCEL', 'TINTA', 'ILUSTRADO', 'TRAMA', 'COLLAGE'],
    },
  },
  MEDITERRANEO_LUMINOSO: {
    nombre: 'Cenital luminoso mediterráneo',
    idea: 'Cenital a sangre con luz de mediodía, para compartir; el texto sigue la forma (F10).',
    familias: ['F10'],
    foto: {
      luz: 'warm midday sunlight with crisp shadows',
      fondo: 'a light linen or whitewashed table seen from above',
      atrezo: 'only the real tableware',
      color: 'bright, warm and fresh colours',
      encuadre: 'straight top-down, the dish centred with room around it',
    },
    diseno: { mecanismos: ['ANOTACIONES', 'TITULAR_DETRAS'], recursos: ['anotaciones', 'sello'], color: 'Claros cálidos de la marca; tinta oscura legible sobre la luz.', limites: LIMITES_EDITORIALES, graficos: { tipos: ['circulo'], maximo: 1 }, tratamientos: ['TINTA'] },
  },
  RUSTICO_FUEGO: {
    nombre: 'Rústico de fuego',
    idea: 'Macro a sangre, madera y brasa, papel y un logotipo tipográfico (F7).',
    familias: ['F7'],
    foto: {
      luz: 'warm low firelight from one side, glowing highlights',
      fondo: 'dark rustic wood or embers, out of focus',
      atrezo: 'only the real tableware',
      color: 'warm, deep ambers and browns',
      encuadre: 'macro, the food filling the frame, cut by the edges',
    },
    diseno: { mecanismos: ['TITULAR_DETRAS', 'TITULAR_CON_ACENTO'], recursos: ['tinta', 'acento'], color: 'Fondos de la foto; texto claro con tinta impresa.', limites: LIMITES_EDITORIALES, graficos: { tipos: [], maximo: 0 }, tratamientos: ['PAPEL', 'TINTA'] },
  },
};

/** La estética que sale de la familia de la ficha de referencia (por defecto, editorial oscuro: la más frecuente, F4). */
export function esteticaDeFamilia(familia: Familia | undefined): Estetica {
  if (!familia) return 'EDITORIAL_OSCURO';
  const encontrada = (Object.entries(ESTETICAS) as Array<[Estetica, ParametrosDeEstetica]>).find(([, p]) => p.familias.includes(familia));
  return encontrada?.[0] ?? 'EDITORIAL_OSCURO';
}

/** Si la estética elegida no es la de la familia de la referencia, lo dice (no lo prohíbe: se avisa al crear el encargo). */
export function choqueConFamilia(estetica: Estetica, familia: Familia | undefined): string | undefined {
  if (!familia || ESTETICAS[estetica].familias.includes(familia)) return undefined;
  const propia = esteticaDeFamilia(familia);
  return `La estética «${ESTETICAS[estetica].nombre}» no es la de la referencia (familia ${familia}, que es «${ESTETICAS[propia].nombre}»): la foto y el diseño seguirán la estética, y de la referencia solo se tomará lo que encaje.`;
}

/** La frase de estética que se añade al prompt de la foto. */
export function frasePrompt(e: Estetica): string {
  const f = ESTETICAS[e].foto;
  return `Overall aesthetic: ${f.luz}; ${f.fondo}; ${f.atrezo}; ${f.color}; ${f.encuadre}.`;
}
