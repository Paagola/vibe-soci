/**
 * Color: funciones puras para medir y derivar colores, sin depender de ninguna librería de imagen.
 *
 * - Contraste WCAG 2 (el que usa el compositor para comprobar la legibilidad).
 * - OKLab / OKLCH (Björn Ottosson, 2020): un espacio perceptual en el que mezclar, aclarar y agrupar colores da
 *   resultados que el ojo considera uniformes (en RGB, el punto medio entre dos colores sale sucio).
 * - Paleta dominante de una foto (k-medias en OKLab, determinista): de ahí sale «el color del plato», para que el
 *   acento de una pieza nazca del producto y no de un catálogo (la idea de Casa da Música que cita la propuesta, y la
 *   regla de «un solo color de acento, sacado de la comida» de los carteles editoriales de comida).
 */
import { mulberry32 } from './azar.js';

export type Rgb = [number, number, number];
export interface Oklab {
  L: number;
  a: number;
  b: number;
}

export function hexARgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbAHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const aLineal = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const deLineal = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Luminancia relativa (WCAG 2). */
export function luminancia(r: number, g: number, b: number): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Ratio de contraste WCAG entre dos colores (de 1 a 21). */
export function contraste(hexA: string, hexB: string): number {
  const la = luminancia(...hexARgb(hexA));
  const lb = luminancia(...hexARgb(hexB));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function rgbAOklab([r, g, b]: Rgb): Oklab {
  const R = aLineal(r);
  const G = aLineal(g);
  const B = aLineal(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabARgb({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const recortar = (v: number) => Math.max(0, Math.min(255, deLineal(v)));
  return [
    recortar(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    recortar(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    recortar(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Viveza de un color (croma en OKLCH): 0 es gris; por encima de 0,12 ya se lee como «color». */
export function croma(hex: string): number {
  const { a, b } = rgbAOklab(hexARgb(hex));
  return Math.hypot(a, b);
}

/** Mezcla perceptual de dos colores (t = 0 da el primero; t = 1, el segundo). */
export function mezclar(hexA: string, hexB: string, t: number): string {
  const p = rgbAOklab(hexARgb(hexA));
  const q = rgbAOklab(hexARgb(hexB));
  return rgbAHex(oklabARgb({ L: p.L + (q.L - p.L) * t, a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t }));
}

/** Cambia la claridad de un color sin tocar su tono (delta positivo aclara). Claridad OKLab de 0 a 1. */
export function conClaridad(hex: string, delta: number): string {
  const c = rgbAOklab(hexARgb(hex));
  return rgbAHex(oklabARgb({ ...c, L: Math.max(0, Math.min(1, c.L + delta)) }));
}

export type Temperatura = 'CALIDA' | 'FRIA' | 'NEUTRA';

/** ¿El color tira a cálido (rojos, ámbar) o a frío (azules, verdes fríos)? Se mira su posición en el plano a-b de OKLab. */
export function temperaturaDe(hex: string): Temperatura {
  const { a, b } = rgbAOklab(hexARgb(hex));
  const calor = b * 0.8 + a * 0.45;
  return calor > 0.018 ? 'CALIDA' : calor < -0.012 ? 'FRIA' : 'NEUTRA';
}

export interface ColorDominante {
  hex: string;
  /** Fracción de los píxeles de la muestra que caen en este color (0–1). */
  peso: number;
  /** Viveza (croma OKLCH). */
  croma: number;
}

/**
 * Los colores dominantes de una imagen: k-medias en OKLab sobre una muestra de píxeles RGB.
 * Determinista (misma muestra, misma paleta). Los grupos muy parecidos se funden. Orden: de más a menos peso.
 * `pixeles` son ternas RGB seguidas; `validos`, opcional, marca qué píxeles cuentan (p. ej. solo los del sujeto).
 */
export function paletaDominante(pixeles: Uint8Array, k = 5, validos?: Uint8Array): ColorDominante[] {
  const puntos: Oklab[] = [];
  const total = Math.floor(pixeles.length / 3);
  for (let i = 0; i < total; i++) {
    if (validos && validos[i]! < 128) continue;
    puntos.push(rgbAOklab([pixeles[i * 3]!, pixeles[i * 3 + 1]!, pixeles[i * 3 + 2]!]));
  }
  if (puntos.length === 0) return [];
  const d2 = (p: Oklab, q: Oklab) => (p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;

  // Arranque k-medias++ con azar de semilla fija: centros bien separados y siempre los mismos.
  const azar = mulberry32(20261111);
  const centros: Oklab[] = [puntos[Math.floor(azar() * puntos.length)]!];
  const minimos = new Float64Array(puntos.length).fill(Infinity);
  while (centros.length < Math.min(k, puntos.length)) {
    const ultimo = centros[centros.length - 1]!;
    let suma = 0;
    for (let i = 0; i < puntos.length; i++) {
      minimos[i] = Math.min(minimos[i]!, d2(puntos[i]!, ultimo));
      suma += minimos[i]!;
    }
    if (suma === 0) break;
    let objetivo = azar() * suma;
    let elegido = puntos.length - 1;
    for (let i = 0; i < puntos.length; i++) {
      objetivo -= minimos[i]!;
      if (objetivo <= 0) {
        elegido = i;
        break;
      }
    }
    centros.push(puntos[elegido]!);
  }

  const grupo = new Int32Array(puntos.length);
  for (let vuelta = 0; vuelta < 14; vuelta++) {
    const sumas = centros.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < puntos.length; i++) {
      let mejor = 0;
      let distancia = Infinity;
      for (let c = 0; c < centros.length; c++) {
        const d = d2(puntos[i]!, centros[c]!);
        if (d < distancia) {
          distancia = d;
          mejor = c;
        }
      }
      grupo[i] = mejor;
      const s = sumas[mejor]!;
      s.L += puntos[i]!.L;
      s.a += puntos[i]!.a;
      s.b += puntos[i]!.b;
      s.n++;
    }
    for (let c = 0; c < centros.length; c++) {
      const s = sumas[c]!;
      if (s.n > 0) centros[c] = { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n };
    }
  }

  const cuentas = new Array<number>(centros.length).fill(0);
  for (let i = 0; i < puntos.length; i++) cuentas[grupo[i]!]!++;
  // Se funden los grupos que el ojo no distingue (distancia OKLab < 0,05).
  const fundidos: Array<{ c: Oklab; n: number }> = [];
  for (const [i, c] of centros.entries()) {
    const n = cuentas[i]!;
    if (n === 0) continue;
    const parecido = fundidos.find((f) => Math.sqrt(d2(f.c, c)) < 0.05);
    if (parecido) {
      const t = n / (parecido.n + n);
      parecido.c = { L: parecido.c.L + (c.L - parecido.c.L) * t, a: parecido.c.a + (c.a - parecido.c.a) * t, b: parecido.c.b + (c.b - parecido.c.b) * t };
      parecido.n += n;
    } else fundidos.push({ c, n });
  }
  return fundidos
    .sort((p, q) => q.n - p.n)
    .map(({ c, n }) => ({ hex: rgbAHex(oklabARgb(c)), peso: Math.round((n / puntos.length) * 1000) / 1000, croma: Math.round(Math.hypot(c.a, c.b) * 1000) / 1000 }));
}

/**
 * El color más vivo de una paleta con peso suficiente: el candidato a «acento sacado del plato».
 * Devuelve undefined si la foto no tiene ningún color con carácter (todo grises o marrones apagados).
 */
export function colorVivo(paleta: ColorDominante[], pesoMinimo = 0.04, cromaMinima = 0.09): ColorDominante | undefined {
  return paleta.filter((c) => c.peso >= pesoMinimo && c.croma >= cromaMinima).sort((p, q) => q.croma * Math.sqrt(q.peso) - p.croma * Math.sqrt(p.peso))[0];
}

/** De varias tintas, la que más contrasta con un fondo; undefined si ninguna llega al mínimo pedido. */
export function mejorTinta(fondo: string, tintas: string[], minimo = 4.5): { hex: string; ratio: number } | undefined {
  const mejor = tintas.map((hex) => ({ hex, ratio: contraste(fondo, hex) })).sort((p, q) => q.ratio - p.ratio)[0];
  return mejor && mejor.ratio >= minimo ? { hex: mejor.hex, ratio: Math.round(mejor.ratio * 100) / 100 } : undefined;
}
