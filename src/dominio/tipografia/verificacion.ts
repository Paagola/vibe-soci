/**
 * Verificación determinista de una receta de tipografía especial (Fase C del creador de estilos).
 *
 * Antes de que un estilo nuevo llegue a la biblioteca se pinta una hoja de muestras (la palabra del encargo y una de
 * control, en varias fuentes y sobre fondo oscuro y claro) y se mide en código:
 * - validez: esquema y grafo (problemasDeReceta);
 * - lectura: un OCR tiene que leer lo que pone (normalizado con `normalizarLectura`);
 * - conservación de la letra frente a la letra limpia (`medirForma`): que el efecto no se coma la forma ni lo llene todo;
 * - tiempo de render por panel y determinismo (dos renders, el mismo hash).
 *
 * Aquí solo hay cálculo puro: pintar y leer lo hacen los adaptadores (PintorDeMuestras, LectorDeTexto).
 * Los umbrales salen de medir las 4 recetas aprobadas y el borrador de brasa (diseno/tipografia-especial/FASE-C.md).
 */
import type { Receta } from './receta.js';

export type PapelFuente = 'marca' | 'grotesca' | 'serif';
export type Fondo = 'oscuro' | 'claro';

/** Un panel de la hoja: una palabra, en una fuente, sobre un fondo. */
export interface PanelDeMuestra {
  indice: number;
  palabra: string;
  rol: 'encargo' | 'control';
  fuente: { id: string; familia: string; papel: PapelFuente };
  fondo: Fondo;
  colorFondo: string;
  colorTexto: string;
}

export interface MedidasDePanel {
  panel: PanelDeMuestra;
  /** El compositor pintó el estilo (y no la letra limpia por la ficha: fuente no apta o cuerpo pequeño). */
  aplicado: boolean;
  avisos: string[];
  /** Altura de mayúscula del panel, en px. */
  cap: number;
  /** Lo que leyó el OCR, línea a línea, y si coincide con la palabra. */
  leido: string[];
  coincide: boolean;
  conservacion: number;
  relleno: number;
  msRender: number;
  hash: string;
  hashRepetido: string;
}

/**
 * Umbrales, medidos el 19/11/2026 (valores exactos en diseno/tipografia-especial/FASE-C.md):
 * - las 4 recetas aprobadas sin marca y con la marca de un local donde encajan (antigua en Asador Etxebarri, derretida
 *   en Casa Aranda y Torre de Vega, neón en DAK Burger y Mesón Lo Güeno, papel en Torre de Vega y Café Albor);
 * - el borrador de brasa y cuatro recetas hechas mal a propósito: «goma» (erosiona 0,06 cap), «tenue» (la letra al
 *   25 %), «mancha» (engorda 0,2 cap: las letras se funden) y «niebla» (desenfoque 0,15 cap).
 */
export const UMBRALES = {
  /** Diferencia con el fondo (máximo de los tres canales, 0–255) a partir de la cual un píxel cuenta como «tinta». */
  tinta: 64,
  /**
   * Lo que queda de la letra limpia. Aprobadas: 0,72 como mínimo (neón sobre Anybody extendida y negra, donde el halo
   * no llega al centro de los trazos gruesos), casi siempre 1. Rotas: goma 0,15–0,40, tenue 0, brasa sobre fondo oscuro 0,24–0,29.
   */
  conservacionMinima: 0.6,
  /**
   * Tinta sólida fuera de la letra respecto a su área. Aprobadas: 0,47 como máximo (el alma del neón con Lora), las
   * demás por debajo de 0,16 (gotas de la derretida, canto y sombra del papel). Rota: mancha 0,88–1,25.
   */
  rellenoMaximo: 0.65,
  /** Tiempo de render de un panel (el más lento de las aprobadas: papel con Bebas Neue, unos 1,3 s). */
  msMaximo: 2000,
} as const;

/**
 * Lo que se compara del OCR. Criterio:
 * - mayúsculas: el caso lo decide el estilo de la marca (muchas fuerzan mayúsculas) y el OCR confunde c/C, o/O, s/S,
 *   v/V, w/W, x/X y z/Z, que tienen la misma forma y solo cambian de tamaño;
 * - sin tildes ni diéresis: son marcas pequeñas que los efectos (gotas, halos) hacen que el OCR omita aunque la letra
 *   se lea; una persona lee «MESON» como «MESÓN». La letra base sí tiene que estar;
 * - sin espacios ni signos: el OCR parte las palabras en líneas a su manera («CASA», «ARANDA»), y un punto suelto en
 *   una gota no es una letra. Las letras y los números sí cuentan todos: una letra de más (una gota leída como «I»), de
 *   menos o cambiada es un error, y solo se perdonan los de `erroresPermitidos`.
 */
export function normalizarLectura(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleUpperCase('es-ES')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Distancia de edición (Levenshtein): letras cambiadas, de más o de menos. */
export function distanciaDeEdicion(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0]!;
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j]!;
      fila[j] = Math.min(arriba + 1, fila[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length]!;
}

/**
 * Letras que se le perdonan al OCR: una por cada 8 de la palabra (normalizada), ninguna por debajo de 8.
 * Por qué: Apple Vision se usa sin corrección de idioma (lee letra a letra, sin contexto) y una persona sí lee con
 * contexto. En la derretida aprobada, la gota que cuelga de la «o» final de «Queso» le hace leer «Quesp» o «Quesq»
 * (4 de 8 paneles sin marca); nadie lo lee así. Dos letras mal en la misma palabra ya no es una letra ambigua sino una
 * forma confundida: el borrador de brasa da «FAMONY OUESO» y «TORRE DEVENN».
 */
export function erroresPermitidos(esperado: string): number {
  return Math.floor(normalizarLectura(esperado).length / 8);
}

export function coincideLectura(esperado: string, leidas: string[]): boolean {
  const e = normalizarLectura(esperado);
  return e.length > 0 && distanciaDeEdicion(normalizarLectura(leidas.join(' ')), e) <= erroresPermitidos(esperado);
}

export interface Imagen {
  datos: Uint8Array;
  ancho: number;
  alto: number;
  canales: number;
}

/** Dilatación cuadrada de radio r (px) con una imagen integral: O(n) sea cual sea el radio. */
function dilatar(m: Uint8Array, ancho: number, alto: number, r: number): Uint8Array {
  const w1 = ancho + 1;
  const integral = new Uint32Array(w1 * (alto + 1));
  for (let y = 0; y < alto; y++) {
    let fila = 0;
    for (let x = 0; x < ancho; x++) {
      fila += m[y * ancho + x]!;
      integral[(y + 1) * w1 + x + 1] = integral[y * w1 + x + 1]! + fila;
    }
  }
  const salida = new Uint8Array(m.length);
  for (let y = 0; y < alto; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(alto, y + r + 1);
    for (let x = 0; x < ancho; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(ancho, x + r + 1);
      const suma = integral[y1 * w1 + x1]! - integral[y0 * w1 + x1]! - integral[y1 * w1 + x0]! + integral[y0 * w1 + x0]!;
      salida[y * ancho + x] = suma > 0 ? 1 : 0;
    }
  }
  return salida;
}

/** Diferencia de un píxel con el fondo: el máximo de los tres canales (0–255). */
function diferencias(img: Imagen, fondo: [number, number, number]): Uint8Array {
  const d = new Uint8Array(img.ancho * img.alto);
  for (let i = 0, p = 0; p < d.length; p++, i += img.canales) {
    d[p] = Math.max(Math.abs(img.datos[i]! - fondo[0]), Math.abs(img.datos[i + 1]! - fondo[1]), Math.abs(img.datos[i + 2]! - fondo[2]));
  }
  return d;
}

/**
 * Conservación de la letra: se compara el panel tratado con el mismo panel pintado limpio (misma fuente, tamaño y
 * color, sin estilo). L = píxeles de la letra limpia (tinta: más de UMBRALES.tinta de diferencia con el fondo).
 * - conservacion = |T ∩ D(L)| / |L|: cuánto de la letra sigue entintado en el panel tratado (T, con el mismo umbral).
 *   D(L) es la letra dilatada 1/40 de cap, que perdona el canto rasgado o desplazado (papel, antigua) y el giro de
 *   cada letra, que mueven el borde un par de píxeles sin comerse nada. Si un efecto vacía la letra, la erosiona o
 *   la deja casi transparente, baja; también si el estilo pinta la letra de un color que no se separa del fondo
 *   (el carbón de la brasa sobre fondo oscuro).
 * - relleno = |S fuera de D(L)| / |L|: tinta SÓLIDA fuera de la letra (gotas, sombras, cantos y letras engordadas o
 *   fundidas en manchas), en proporción al área de la letra. «Sólida» es al menos la mitad de la diferencia típica
 *   (mediana) de la letra limpia con el fondo: así un halo suave (neón) no cuenta como relleno y una mancha sí.
 */
export function medirForma(limpia: Imagen, tratada: Imagen, fondo: [number, number, number], cap: number): { conservacion: number; relleno: number } {
  if (limpia.ancho !== tratada.ancho || limpia.alto !== tratada.alto) throw new RangeError('Las dos imágenes tienen que medir lo mismo.');
  const { ancho, alto } = limpia;
  const dl = diferencias(limpia, fondo);
  const dt = diferencias(tratada, fondo);
  const L = new Uint8Array(dl.length);
  const deLaLetra: number[] = [];
  for (let p = 0; p < dl.length; p++) {
    if (dl[p]! > UMBRALES.tinta) {
      L[p] = 1;
      deLaLetra.push(dl[p]!);
    }
  }
  if (deLaLetra.length === 0) return { conservacion: 0, relleno: 0 };
  deLaLetra.sort((a, b) => a - b);
  const solido = deLaLetra[deLaLetra.length >> 1]! * 0.5;
  const cerca = dilatar(L, ancho, alto, Math.max(1, Math.round(cap / 40)));
  let dentro = 0;
  let fuera = 0;
  for (let p = 0; p < L.length; p++) {
    if (cerca[p]) {
      if (dt[p]! > UMBRALES.tinta) dentro++;
    } else if (dt[p]! > solido) fuera++;
  }
  return { conservacion: Math.min(1, dentro / deLaLetra.length), relleno: fuera / deLaLetra.length };
}

/** Si un panel, por sí solo, cumple todo (para pintarlo en verde o rojo en la hoja). */
export function panelPasa(m: MedidasDePanel): boolean {
  return m.aplicado && m.coincide && m.conservacion >= UMBRALES.conservacionMinima && m.relleno <= UMBRALES.rellenoMaximo && m.msRender <= UMBRALES.msMaximo && m.hash === m.hashRepetido;
}

export interface InformeDeVerificacion {
  esquema: 'tipografia/verificacion@1';
  receta: { id: string; version: number };
  pasa: boolean;
  /** Problemas de esquema o de grafo (si los hay, no se pinta nada). */
  validez: string[];
  lector: string;
  paneles: MedidasDePanel[];
  resumen: {
    lecturas: { marca: string; resto: string };
    conservacion: { minima: number; media: number };
    relleno: { maximo: number; medio: number };
    msMaximo: number;
    deterministas: boolean;
  };
  fallos: string[];
  umbrales: typeof UMBRALES;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * El dictamen. Pasa si:
 * - la lectura coincide en TODOS los paneles de la fuente de la marca (si no hay marca, de la primera fuente) y en la
 *   mayoría estricta del resto;
 * - el estilo se ha podido pintar en todos los paneles (la ficha no lo deja limpio en ninguna de las fuentes);
 * - ningún panel baja de la conservación mínima ni pasa del relleno máximo;
 * - ningún panel tarda más de 2 s y los dos renders de cada panel son idénticos.
 */
export function dictaminar(receta: Pick<Receta, 'id' | 'version'>, paneles: MedidasDePanel[], lector: string): InformeDeVerificacion {
  const fallos: string[] = [];
  const principal = paneles.some((m) => m.panel.fuente.papel === 'marca') ? 'marca' : paneles[0]?.panel.fuente.papel;
  const dePrincipal = paneles.filter((m) => m.panel.fuente.papel === principal);
  const resto = paneles.filter((m) => m.panel.fuente.papel !== principal);
  const etiqueta = (m: MedidasDePanel) => `«${m.panel.palabra}» en ${m.panel.fuente.familia} sobre fondo ${m.panel.fondo}`;
  const leido = (m: MedidasDePanel) => `«${m.leido.join(' / ') || '(nada)'}»`;

  for (const m of paneles.filter((m) => !m.aplicado)) fallos.push(`No se ha podido pintar el estilo en ${etiqueta(m)}: ${m.avisos.join(' ') || 'el compositor lo dejó limpio'}.`);
  for (const m of dePrincipal.filter((m) => !m.coincide)) fallos.push(`El OCR lee ${leido(m)} en ${etiqueta(m)} (fuente ${principal === 'marca' ? 'de la marca' : 'principal'}: tiene que leerse en todos sus paneles).`);
  const bienResto = resto.filter((m) => m.coincide).length;
  if (resto.length && bienResto * 2 <= resto.length) {
    fallos.push(`El OCR solo lee bien ${bienResto} de ${resto.length} paneles del resto de fuentes (hace falta la mayoría): ${resto.filter((m) => !m.coincide).map((m) => `${leido(m)} en ${etiqueta(m)}`).join('; ')}.`);
  }
  for (const m of paneles) {
    if (m.aplicado && m.conservacion < UMBRALES.conservacionMinima) fallos.push(`El efecto se come la letra en ${etiqueta(m)}: queda el ${(m.conservacion * 100).toFixed(0)} % (mínimo ${UMBRALES.conservacionMinima * 100} %).`);
    if (m.aplicado && m.relleno > UMBRALES.rellenoMaximo) fallos.push(`El efecto lo llena todo en ${etiqueta(m)}: la tinta sólida fuera de la letra es el ${(m.relleno * 100).toFixed(0)} % del área de la letra (máximo ${UMBRALES.rellenoMaximo * 100} %).`);
    if (m.msRender > UMBRALES.msMaximo) fallos.push(`El panel ${etiqueta(m)} tarda ${m.msRender.toFixed(0)} ms en pintarse (máximo ${UMBRALES.msMaximo} ms).`);
    if (m.hash !== m.hashRepetido) fallos.push(`El panel ${etiqueta(m)} no es determinista: dos renders dan píxeles distintos.`);
  }

  const conservaciones = paneles.map((m) => m.conservacion);
  const rellenos = paneles.map((m) => m.relleno);
  const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    esquema: 'tipografia/verificacion@1',
    receta: { id: receta.id, version: receta.version },
    pasa: fallos.length === 0,
    validez: [],
    lector,
    paneles,
    resumen: {
      lecturas: { marca: `${dePrincipal.filter((m) => m.coincide).length}/${dePrincipal.length}`, resto: `${bienResto}/${resto.length}` },
      conservacion: { minima: r3(Math.min(...conservaciones)), media: r3(media(conservaciones)) },
      relleno: { maximo: r3(Math.max(...rellenos)), medio: r3(media(rellenos)) },
      msMaximo: Math.round(Math.max(...paneles.map((m) => m.msRender))),
      deterministas: paneles.every((m) => m.hash === m.hashRepetido),
    },
    fallos,
    umbrales: UMBRALES,
  };
}

/** El informe de una receta que no es válida: no se pinta nada. */
export function informeDeInvalida(receta: { id?: string; version?: number }, problemas: string[], lector: string): InformeDeVerificacion {
  return {
    esquema: 'tipografia/verificacion@1',
    receta: { id: receta.id ?? '¿?', version: receta.version ?? 0 },
    pasa: false,
    validez: problemas,
    lector,
    paneles: [],
    resumen: { lecturas: { marca: '0/0', resto: '0/0' }, conservacion: { minima: 0, media: 0 }, relleno: { maximo: 0, medio: 0 }, msMaximo: 0, deterministas: false },
    fallos: problemas.map((p) => `Receta no válida: ${p}`),
    umbrales: UMBRALES,
  };
}
