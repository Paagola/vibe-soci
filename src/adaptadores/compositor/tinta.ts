/**
 * Tinta impresa y papel (F3): lo que separa un texto «de pantalla» de uno que parece estampado.
 *
 * Un vector perfecto (canto de navaja, color uniforme) es justo lo que hace que una pieza parezca generada. En una
 * impresión real la tinta no cubre igual en todas partes, el canto se rompe donde el rodillo iba seco y, si hay dos
 * pasadas, no caen exactamente una sobre otra. Aquí se hacen esas tres cosas sobre el PNG de UNA capa, tocando solo su
 * transparencia, con ruido determinista: la misma semilla da siempre las mismas marcas.
 * Los márgenes razonables están en dominio/diseno/intencion.ts (Tinta).
 */
import sharp from 'sharp';
import { mulberry32, ruidoDeValor } from '../../dominio/diseno/azar.js';
import { hexARgb } from '../../dominio/diseno/color.js';
import type { TintaResuelta } from '../../dominio/diseno/resuelto.js';

/** Aplica la tinta impresa al PNG de una capa (RGBA). Lo que no tiene tinta no cambia. */
export async function aplicarTinta(png: Buffer, tinta: TintaResuelta): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const alfa = new Uint8Array(w * h);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]!;
      alfa[y * w + x] = a;
      if (a > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return png; // capa vacía
  const margen = 4;
  x0 = Math.max(0, x0 - margen);
  y0 = Math.max(0, y0 - margen);
  x1 = Math.min(w - 1, x1 + margen);
  y1 = Math.min(h - 1, y1 + margen);

  // 1. Canto reseco: el borde de la tinta se vuelve a cortar con un umbral que tiembla, y dentro quedan poros.
  if (tinta.bordeSeco > 0) {
    const difuso = await sharp(Buffer.from(alfa), { raw: { width: w, height: h, channels: 1 } }).blur(2.2).raw().toBuffer();
    const medio = ruidoDeValor(tinta.semilla ^ 0x1b873593);
    const fino = ruidoDeValor(tinta.semilla ^ 0x85ebca6b);
    const amplitud = Math.min(110, tinta.bordeSeco * 255 * 7);
    const poro = 1 - tinta.bordeSeco * 3.5;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        const b = difuso[i]!;
        if (b === 0) {
          alfa[i] = 0;
          continue;
        }
        const umbral = 127.5 + (medio(x / 7, y / 7) - 0.5) * 2 * amplitud;
        let a = Math.max(0, Math.min(1, (b - umbral) / 28 + 0.5)) * 255;
        if (a > 200 && fino(x / 1.7, y / 1.7) > poro) a *= 0.3;
        alfa[i] = a;
      }
    }
  }

  // 2. Cobertura irregular: manchas anchas donde la tinta cargó menos, más un grano fino.
  if (tinta.densidad > 0) {
    const ancho = ruidoDeValor(tinta.semilla ^ 0xc2b2ae35);
    const mediano = ruidoDeValor(tinta.semilla ^ 0x27d4eb2f);
    const grano = ruidoDeValor(tinta.semilla ^ 0x165667b1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (alfa[i] === 0) continue;
        const falta = 0.5 * ancho(x / 120, y / 120) + 0.25 * mediano(x / 38, y / 38) + 0.25 * grano(x / 1.4, y / 1.4);
        alfa[i] = alfa[i]! * (1 - tinta.densidad * falta);
      }
    }
  }

  // 3. Fuera de registro: una segunda impresión desplazada, debajo de la principal.
  const salida = Buffer.from(data);
  const registro = tinta.registro;
  const fantasma = registro ? hexARgb(registro.color) : undefined;
  const dx = registro ? Math.round(registro.dx) : 0;
  const dy = registro ? Math.round(registro.dy) : 0;
  const yDesde = Math.max(0, y0 + Math.min(0, dy));
  const yHasta = Math.min(h - 1, y1 + Math.max(0, dy));
  const xDesde = Math.max(0, x0 + Math.min(0, dx));
  const xHasta = Math.min(w - 1, x1 + Math.max(0, dx));
  for (let y = yDesde; y <= yHasta; y++) {
    for (let x = xDesde; x <= xHasta; x++) {
      const i = y * w + x;
      const a = alfa[i]! / 255;
      let g = 0;
      if (registro && fantasma) {
        const xs = x - dx;
        const ys = y - dy;
        if (xs >= 0 && xs < w && ys >= 0 && ys < h) g = (alfa[ys * w + xs]! / 255) * registro.opacidad;
      }
      if (g === 0) {
        salida[i * 4 + 3] = Math.round(a * 255);
        continue;
      }
      const total = a + g * (1 - a);
      for (let c = 0; c < 3; c++) salida[i * 4 + c] = Math.round((salida[i * 4 + c]! * a + fantasma![c]! * g * (1 - a)) / total);
      salida[i * 4 + 3] = Math.round(total * 255);
    }
  }
  return sharp(salida, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/**
 * Papel sin estucar: moteado suave a dos escalas y fibras cortas. Es una capa casi blanca pensada para fusionar en
 * «multiply»: oscurece muy poco y de forma desigual, que es lo que le quita a un color plano el aspecto de pantalla.
 */
export async function papel(lienzo: { ancho: number; alto: number }, intensidad: number, escala: number, semilla: number): Promise<Buffer> {
  const w = lienzo.ancho;
  const h = lienzo.alto;
  const nube = ruidoDeValor(semilla);
  const mota = ruidoDeValor(semilla ^ 0x9e3779b9);
  const sombra = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) sombra[y * w + x] = 0.6 * nube(x / (150 * escala), y / (150 * escala)) + 0.4 * mota(x / (22 * escala), y / (22 * escala));
  }
  // Fibras: trazos cortos y finos en cualquier dirección, unas más oscuras y otras más claras que el papel.
  const azar = mulberry32(semilla ^ 0x7f4a7c15);
  const fibras = Math.round((w * h) / 2600);
  for (let f = 0; f < fibras; f++) {
    let x = azar() * w;
    let y = azar() * h;
    const angulo = azar() * Math.PI * 2;
    const largo = (5 + azar() * 22) * escala;
    const peso = (azar() - 0.35) * 0.9;
    const giro = (azar() - 0.5) * 0.08;
    let a = angulo;
    for (let s = 0; s < largo; s++) {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi >= 0 && xi < w && yi >= 0 && yi < h) sombra[yi * w + xi] = sombra[yi * w + xi]! + peso;
      a += giro;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  const datos = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(255 - intensidad * 255 * Math.max(0, sombra[i]!))));
    datos[i * 4] = v;
    datos[i * 4 + 1] = v;
    datos[i * 4 + 2] = v;
    datos[i * 4 + 3] = 255;
  }
  return sharp(datos, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
