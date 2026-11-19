/**
 * Utilidades de imagen que comparten el resolutor (para medir) y el renderizador (para pintar).
 */
import sharp from 'sharp';
import type { CapaResuelta } from '../../dominio/diseno/resuelto.js';
import type { Lienzo, Rect } from '../../dominio/diseno/reticula.js';
import type { MotorTexto } from './MotorTexto.js';

export type CapaTextoResuelta = Extract<CapaResuelta, { tipo: 'texto' }>;
export type CapaRecorteResuelta = Extract<CapaResuelta, { tipo: 'recorte' }>;

export function documentoSvg(lienzo: Lienzo, cuerpo: string, escala = 1, defs = ''): string {
  const w = Math.round(lienzo.ancho * escala);
  const h = Math.round(lienzo.alto * escala);
  const grupo = escala === 1 ? cuerpo : `<g transform="scale(${escala})">${cuerpo}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}${grupo}</svg>`;
}

export const escaparXml = (texto: string) =>
  texto.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c);

/** Trazo de todas las líneas de un texto resuelto, en el sistema del bloque. */
export function trazoDeTexto(motor: MotorTexto, capa: CapaTextoResuelta): string {
  const estilo = { fuente: capa.estilo.fuente, ejes: capa.estilo.ejes, tracking: capa.estilo.tracking, ...(capa.estilo.rasgos ? { rasgos: capa.estilo.rasgos } : {}) };
  return capa.lineas.map((linea) => motor.trazar(estilo, linea.texto, linea.tamano, linea.x, linea.base)).join('');
}

/** Alfa (0–255) de un SVG pintado a w × h. */
export async function alfaDeSvg(svg: string, w: number, h: number): Promise<Uint8Array> {
  const { data } = await sharp(Buffer.from(svg)).resize(w, h, { fit: 'fill' }).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

/**
 * Alfa de la máscara del sujeto colocada en el lienzo, a escala `escala`.
 * La máscara se recorta a la zona del sujeto en la imagen original (`origen`) y se lleva a su sitio (`destino`).
 * Con `giro`, el sujeto va girado alrededor del centro de `destino` (igual que lo pinta el renderizador).
 */
export async function alfaDelSujeto(rutaMascara: string, origen: Rect, destino: Rect, lienzo: Lienzo, escala: number, anchoImagen: number, altoImagen: number, giro = 0): Promise<Uint8Array> {
  const W = Math.round(lienzo.ancho * escala);
  const H = Math.round(lienzo.alto * escala);
  let w = Math.max(1, Math.round(destino.w * escala));
  let h = Math.max(1, Math.round(destino.h * escala));
  let recorte = await sharp(await mascaraAlTamano(rutaMascara, anchoImagen, altoImagen))
    .extract(redondear(origen, anchoImagen, altoImagen))
    .resize(w, h, { fit: 'fill' })
    .extractChannel(0)
    .raw()
    .toBuffer();
  let x0 = Math.round(destino.x * escala);
  let y0 = Math.round(destino.y * escala);
  if (giro !== 0) {
    const girado = await sharp(recorte, { raw: { width: w, height: h, channels: 1 } }).rotate(giro, { background: '#000000' }).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
    x0 = Math.round((destino.x + destino.w / 2) * escala - girado.info.width / 2);
    y0 = Math.round((destino.y + destino.h / 2) * escala - girado.info.height / 2);
    w = girado.info.width;
    h = girado.info.height;
    recorte = girado.data;
  }
  const lienzoAlfa = new Uint8Array(W * H);
  for (let j = 0; j < h; j++) {
    const y = y0 + j;
    if (y < 0 || y >= H) continue;
    for (let i = 0; i < w; i++) {
      const x = x0 + i;
      if (x >= 0 && x < W) lienzoAlfa[y * W + x] = recorte[j * w + i]!;
    }
  }
  return lienzoAlfa;
}

const mascaras = new Map<string, Promise<Buffer>>();

/**
 * La máscara (un canal) al tamaño exacto de su imagen, en PNG. Va en un paso aparte porque sharp
 * solo admite un resize por cadena: así después se puede recortar y escalar sin sorpresas.
 */
export function mascaraAlTamano(ruta: string, ancho: number, alto: number): Promise<Buffer> {
  const clave = `${ruta}|${ancho}|${alto}`;
  let mascara = mascaras.get(clave);
  if (!mascara) {
    mascara = sharp(ruta).resize(ancho, alto, { fit: 'fill' }).extractChannel(0).png().toBuffer();
    mascaras.set(clave, mascara);
    mascara.catch(() => mascaras.delete(clave));
  }
  return mascara;
}

export interface MedidorCobertura {
  /** Fracción de los píxeles del texto que tapa el sujeto, con el texto desplazado `dy` filas. */
  media(dy: number): number;
  /**
   * La peor franja vertical: el texto se parte en `franjas` columnas y se da la más tapada.
   * Es lo que importa para leer: una media del 30 % puede esconder una letra tapada al 60 %.
   */
  maxima(dy: number): number;
}

export function medidorDeCobertura(texto: Uint8Array, sujeto: Uint8Array, W: number, H: number, franjas = 10): MedidorCobertura {
  const xs: number[] = [];
  const ys: number[] = [];
  let minX = W;
  let maxX = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (texto[y * W + x]! < 128) continue;
      xs.push(x);
      ys.push(y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  const ancho = Math.max(1, maxX - minX + 1);
  const franja = xs.map((x) => Math.min(franjas - 1, Math.floor(((x - minX) / ancho) * franjas)));
  const totales = new Array<number>(franjas).fill(0);
  for (const f of franja) totales[f]!++;
  const contar = (dy: number) => {
    const tapados = new Array<number>(franjas).fill(0);
    for (let i = 0; i < xs.length; i++) {
      const y = ys[i]! + dy;
      if (y >= 0 && y < H && sujeto[y * W + xs[i]!]! >= 128) tapados[franja[i]!]!++;
    }
    return tapados;
  };
  return {
    media: (dy) => (xs.length === 0 ? 0 : contar(dy).reduce((a, b) => a + b, 0) / xs.length),
    maxima: (dy) => {
      const tapados = contar(dy);
      // Las franjas casi vacías (huecos entre letras) no cuentan.
      return Math.max(0, ...tapados.map((t, i) => (totales[i]! > xs.length / (franjas * 4) ? t / totales[i]! : 0)));
    },
  };
}

/** Fracción de los píxeles del texto que tapa el sujeto, con el texto desplazado `dy` filas. */
export function cobertura(texto: Uint8Array, sujeto: Uint8Array, W: number, H: number, dy = 0): number {
  let total = 0;
  let tapados = 0;
  for (let y = 0; y < H; y++) {
    const ys = y + dy;
    for (let x = 0; x < W; x++) {
      if (texto[y * W + x]! < 128) continue;
      total++;
      if (ys >= 0 && ys < H && sujeto[ys * W + x]! >= 128) tapados++;
    }
  }
  return total === 0 ? 0 : tapados / total;
}

/** Rectángulo en píxeles enteros dentro de la imagen (sharp no admite fracciones ni salirse). */
export function redondear(rect: Rect, ancho: number, alto: number): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.min(ancho - 1, Math.round(rect.x)));
  const top = Math.max(0, Math.min(alto - 1, Math.round(rect.y)));
  const width = Math.max(1, Math.min(ancho - left, Math.round(rect.w)));
  const height = Math.max(1, Math.min(alto - top, Math.round(rect.h)));
  return { left, top, width, height };
}

/**
 * Pone una imagen RGBA en un lienzo transparente del tamaño de la pieza, aunque se salga por los bordes.
 * Así cada capa es un PNG del tamaño del lienzo que se puede revisar o abrir sola.
 */
export async function enLienzo(imagen: Buffer, x: number, y: number, lienzo: Lienzo): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(imagen).metadata();
  const left = Math.round(x);
  const top = Math.round(y);
  const x0 = Math.max(0, -left);
  const y0 = Math.max(0, -top);
  const x1 = Math.min(width, lienzo.ancho - left);
  const y1 = Math.min(height, lienzo.alto - top);
  const vacio = sharp({ create: { width: lienzo.ancho, height: lienzo.alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  if (x1 <= x0 || y1 <= y0) return vacio.png().toBuffer();
  const visible = await sharp(imagen).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  return vacio.composite([{ input: visible, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
}

/** Multiplica el alfa de una imagen RGBA (opacidad de la capa). */
export async function conOpacidad(imagen: Buffer, opacidad: number): Promise<Buffer> {
  if (opacidad >= 1) return imagen;
  return sharp(imagen).ensureAlpha().linear([1, 1, 1, opacidad], [0, 0, 0, 0]).png().toBuffer();
}

/** Recorta la tinta con el alfa alineado de la fotografía. */
export async function aplicarMascaraDeSujeto(png: Buffer, sujeto: Uint8Array, modo: 'dentro' | 'fuera'): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < info.width * info.height; i++) {
    const s = sujeto[i]!;
    data[i * 4 + 3] = Math.round((data[i * 4 + 3]! * (modo === 'dentro' ? s : 255 - s)) / 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
