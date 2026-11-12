/**
 * Azar determinista. Todo lo «imperfecto» del compositor (grano, tinta irregular, pulso de un trazo a mano) sale de aquí:
 * la misma semilla da siempre el mismo resultado, así que una pieza se puede repetir, cachear y auditar.
 * La semilla por defecto de una capa sale de su identidad (semillaDe), no del reloj: reintentar no cambia las marcas.
 */

/** Generador pseudoaleatorio con semilla (mulberry32). Devuelve números en [0, 1). */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla estable a partir de un texto (FNV-1a de 32 bits): la identidad de la capa decide sus imperfecciones. */
export function semillaDe(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Azar de una celda entera (x, y) con una semilla: siempre el mismo valor en [0, 1). */
function celda(semilla: number, x: number, y: number): number {
  let h = (semilla ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const suave = (t: number) => t * t * (3 - 2 * t);

/**
 * Ruido de valor en dos dimensiones, suave y continuo, en [0, 1]. Las coordenadas van en «celdas»: para manchas de
 * unos 80 px se llama con (x / 80, y / 80). Con y = 0 sirve de ruido en una dimensión (el pulso de un trazo).
 */
export function ruidoDeValor(semilla: number): (x: number, y: number) => number {
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = suave(x - x0);
    const ty = suave(y - y0);
    const a = celda(semilla, x0, y0);
    const b = celda(semilla, x0 + 1, y0);
    const c = celda(semilla, x0, y0 + 1);
    const d = celda(semilla, x0 + 1, y0 + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}
