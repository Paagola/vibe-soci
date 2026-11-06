/**
 * Geometría del lienzo: retícula, cajas y zona segura. Funciones puras.
 * La IA (y quien escribe una intención a mano) habla en celdas; esto lo pasa a píxeles.
 */
import { RECORTE_4_5_PX, TAMANO_PROPORCION } from '../reglas.js';
import type { Caja, Reticula } from './intencion.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Lienzo {
  ancho: number;
  alto: number;
}

export function lienzoDe(formato: 'FEED_3_4' | 'HISTORIA_9_16'): Lienzo {
  const { ancho, alto } = TAMANO_PROPORCION[formato === 'HISTORIA_9_16' ? '9:16' : '3:4'];
  return { ancho, alto };
}

/** Una caja de la intención en píxeles del lienzo. Las fracciones pueden salirse del lienzo (sangrado). */
export function rectDeCaja(caja: Caja, lienzo: Lienzo, reticula: Reticula): Rect {
  if ('x' in caja) return { x: caja.x * lienzo.ancho, y: caja.y * lienzo.alto, w: caja.w * lienzo.ancho, h: caja.h * lienzo.alto };
  const [c0, c1] = caja.col;
  const [f0, f1] = caja.fila;
  const { columnas, filas, margen, medianil } = reticula;
  if (c0 < 1 || c1 > columnas || c0 > c1) throw new RangeError(`Columnas fuera de la retícula: ${c0}–${c1} (hay ${columnas}).`);
  if (f0 < 1 || f1 > filas || f0 > f1) throw new RangeError(`Filas fuera de la retícula: ${f0}–${f1} (hay ${filas}).`);
  const anchoColumna = (lienzo.ancho - 2 * margen - (columnas - 1) * medianil) / columnas;
  const altoFila = (lienzo.alto - 2 * margen - (filas - 1) * medianil) / filas;
  return {
    x: margen + (c0 - 1) * (anchoColumna + medianil),
    y: margen + (f0 - 1) * (altoFila + medianil),
    w: (c1 - c0 + 1) * anchoColumna + (c1 - c0) * medianil,
    h: (f1 - f0 + 1) * altoFila + (f1 - f0) * medianil,
  };
}

/**
 * Donde puede ir el texto que no sangra a propósito.
 * Feed: márgenes de la retícula a los lados y, arriba y abajo, además lo que recorta la exportación 4:5.
 * Historias: el 14 % de arriba y el 20 % de abajo quedan para la interfaz de Instagram.
 */
export function zonaSegura(lienzo: Lienzo, margen: number): Rect {
  if (lienzo.alto > lienzo.ancho * 1.5) {
    const arriba = lienzo.alto * 0.14;
    const abajo = lienzo.alto * 0.2;
    return { x: margen, y: arriba, w: lienzo.ancho - 2 * margen, h: lienzo.alto - arriba - abajo };
  }
  const vertical = margen + RECORTE_4_5_PX;
  return { x: margen, y: vertical, w: lienzo.ancho - 2 * margen, h: lienzo.alto - 2 * vertical };
}

export function dentroDe(interior: Rect, exterior: Rect, tolerancia = 0.5): boolean {
  return (
    interior.x >= exterior.x - tolerancia &&
    interior.y >= exterior.y - tolerancia &&
    interior.x + interior.w <= exterior.x + exterior.w + tolerancia &&
    interior.y + interior.h <= exterior.y + exterior.h + tolerancia
  );
}

/** Coloca un rectángulo de tamaño (w, h) dentro de una caja según una alineación de 9 posiciones. */
export function alinearEn(caja: Rect, w: number, h: number, alinear: string): { x: number; y: number } {
  const [vertical, horizontal = 'centro'] = alinear === 'centro' ? ['centro', 'centro'] : alinear.split('-');
  const x = horizontal === 'izquierda' ? caja.x : horizontal === 'derecha' ? caja.x + caja.w - w : caja.x + (caja.w - w) / 2;
  const y = vertical === 'arriba' ? caja.y : vertical === 'abajo' ? caja.y + caja.h - h : caja.y + (caja.h - h) / 2;
  return { x, y };
}
