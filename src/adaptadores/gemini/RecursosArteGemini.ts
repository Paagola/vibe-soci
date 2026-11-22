/**
 * Estudio de arte · recursos gráficos generados con Nano Banana Pro (Gemini de imagen). NUNCA el producto: el plato va
 * siempre recortado de su foto real. Dos recursos:
 * - ESCENA: un fondo fotográfico sin comida, sin vajilla, sin personas y sin texto (superficie, luz, atmósfera).
 * - GARABATO: trazos a mano a tinta negra sobre blanco que el código convierte en un recurso recortable (la tinta es
 *   la máscara) del color de la marca.
 * Cada uno se registra como activo GENERADO · SOLO_PRUEBA_COMPOSICION del local, con su prompt, su modelo y su coste, y
 * se reutiliza si ya existe con el mismo prompt (el id sale de su huella). El gasto lo vigila GeneradorFotoGemini.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { Activo } from '../../dominio/activos.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { GeneradorFoto } from '../../puertos/Foto.js';

export function promptDeEscena(describe: string, luz: string): string {
  return [
    `Photographic background plate for a vertical 3:4 food poster. ${describe}.`,
    'Completely empty scene: absolutely no food, no plates, no bowls, no cutlery, no glasses, no bottles, no people, no hands, no text, no letters, no numbers, no logos, no signage.',
    'Keep the center and the lower half calm and uncluttered: a product photo will be placed on top later.',
    `Lighting: ${luz}, consistent with a professional food photograph. Photorealistic material texture, natural depth of field, no vignette, no border.`,
  ].join(' ');
}

export function promptDeGarabato(describe: string): string {
  return [
    `Hand-drawn doodle illustration in black ink on a pure white background: ${describe}.`,
    'Bold loose marker or brush-pen strokes, like a designer drawing by hand over a poster. Only black lines on pure white: no gray, no shading, no fills, no texture, no paper grain.',
    'The marks surround an EMPTY center: the middle 60 % of the image stays pure white (a product photo will be placed there later).',
    'Absolutely no food, no objects, no characters, no faces, no text, no letters, no numbers, no logos. Square composition.',
  ].join(' ');
}

/** Un elemento gráfico (estilo «trazo» o «forma») en negro sobre blanco; con `centroVacio`, rodea un hueco central. */
export function promptDeElemento(describe: string, estilo: 'trazo' | 'forma', centroVacio: boolean): string {
  const base =
    estilo === 'forma'
      ? `A single flat solid black graphic shape on a pure white background: ${describe}. Crisp clean edges, no outlines, no texture, no gradients, no shading, no 3D.`
      : `Hand-drawn doodle illustration in black ink on a pure white background: ${describe}. Bold loose marker or brush-pen strokes, like a designer drawing by hand over a poster. Only black lines on pure white: no gray, no shading, no fills, no texture, no paper grain.`;
  return [
    base,
    centroVacio ? 'The marks surround an EMPTY center: the middle 60 % of the image stays pure white (a product photo will be placed there later).' : 'The drawing is centered and fills most of the square, with a little white margin.',
    'Absolutely no food, no objects, no characters, no faces, no text, no letters, no numbers, no logos. Square composition.',
  ].join(' ');
}

/** La instrucción para dibujar elementos sobre una pieza terminada sin tocar nada más (el código protege el resto). */
export function promptDeInsercion(instruccion: string, conReferencia: boolean): string {
  return [
    '@image1 is a finished Instagram food poster. Give it the final finish a senior art director would before publishing, so it looks much more professional: change only the background, the light and shadows around the food, the badges and the decorative graphics, as described here.',
    instruccion,
    'Keep the food photo and every word, letter and number exactly as they are (same content, position, size and color). Keep the same layout, framing and size: do not crop, zoom or shift the image. Do not add any new text, letters or numbers.',
    ...(conReferencia ? ['@image2 is the style reference the poster is based on: use it only as a cue for the graphic style, never copy its content.'] : []),
  ].join(' ');
}

/** La tinta de un dibujo en negro sobre blanco como máscara (255 = tinta), con su caja. */
export async function tintaComoMascara(bytes: Buffer): Promise<{ mascara: Buffer; ancho: number; alto: number; bbox?: { x: number; y: number; w: number; h: number } }> {
  const gris = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = gris.info;
  const mascara = Buffer.alloc(w * h);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < w * h; i++) {
    // Umbral suave: el blanco del papel (≥ 215) no cuenta; el negro (≤ 65) es tinta plena.
    const v = Math.max(0, Math.min(255, Math.round(((215 - gris.data[i]!) / 150) * 255)));
    mascara[i] = v;
    if (v > 60) {
      const x = i % w;
      const y = Math.floor(i / w);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { mascara, ancho: w, alto: h, ...(x1 > x0 && y1 > y0 ? { bbox: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } } : {}) };
}

export class RecursosArteGemini {
  constructor(
    private readonly generador: GeneradorFoto,
    private readonly activos: AlmacenActivos,
    private readonly modelo: string,
    private readonly informar: (linea: string) => void = (l) => console.log(l),
  ) {}

  private idDe(tipo: string, ...partes: string[]): string {
    return `arte-${tipo}-${createHash('sha256').update([this.modelo, ...partes].join('\n')).digest('hex').slice(0, 10)}`;
  }

  private generacion(local: string, id: string, prompt: string, foto: { modelo: string; costeUsd: number; detalle: string }, parametros: Record<string, unknown>) {
    const ahora = new Date().toISOString();
    return {
      generacion: { modelo: foto.modelo, requestId: id, promptArchivo: `datos/locales/${local}/activos/${id}/prompt.txt`, prompt, parametros, referencias: [], costeEstimadoUsd: foto.costeUsd, tarifa: foto.detalle, generadoEn: ahora },
      ahora,
    };
  }

  async escena(describe: string, c: { local: string; luz: string }): Promise<ActivoDisponible> {
    const prompt = promptDeEscena(describe, c.luz);
    const id = this.idDe('escena', prompt);
    if (await this.activos.existe(c.local, id)) return this.activos.obtener(c.local, id);
    const foto = await this.generador.generar({ id, prompt, referencias: [], aspectRatio: '3:4', tamano: '1K' });
    const png = await sharp(foto.bytes).png().toBuffer();
    const meta = await sharp(png).metadata();
    const sha = createHash('sha256').update(png).digest('hex');
    const { generacion, ahora } = this.generacion(c.local, id, prompt, foto, { aspectRatio: '3:4', tamano: '1K' });
    await this.activos.crear(
      Activo.parse({
        id,
        localSlug: c.local,
        tipo: 'GENERADO',
        uso: 'SOLO_PRUEBA_COMPOSICION',
        descripcion: `Recurso gráfico generado por el estudio de arte: escena de fondo SIN comida (no es producto). «${describe}»`,
        archivo: 'original.png',
        ancho: meta.width!,
        alto: meta.height!,
        sha256: sha,
        procedencia: { ruta: `datos/locales/${c.local}/activos/${id}/original.png`, sha256: sha, copiadoEn: ahora, generacion },
      }),
      { 'original.png': png, 'prompt.txt': Buffer.from(`${prompt}\n`) },
    );
    this.informar(`  escena ${id}: ${foto.costeUsd.toFixed(3)} USD`);
    return this.activos.obtener(c.local, id);
  }

  /** Un elemento gráfico del director: dibujo o forma en negro sobre blanco → recurso recortable del color pedido. */
  async elemento(describe: string, c: { local: string; color: string; estilo: 'trazo' | 'forma'; centroVacio: boolean }): Promise<ActivoDisponible> {
    return this.recursoDeTinta(promptDeElemento(describe, c.estilo, c.centroVacio), describe, 'elemento', c);
  }

  /**
   * Inserción en contexto: el modelo dibuja sobre la pieza terminada (y ve la referencia, si la hay). Devuelve los bytes
   * de la imagen editada; quien llama protege después las capas de la pieza (adaptadores/imagen/insercion.ts).
   */
  async insertar(pieza: string, instruccion: string, c: { id: string; referencia?: string }): Promise<{ bytes: Buffer; prompt: string; costeUsd: number; modelo: string }> {
    const prompt = promptDeInsercion(instruccion, Boolean(c.referencia));
    const foto = await this.generador.generar({
      id: c.id,
      prompt,
      referencias: [{ ruta: pieza, etiqueta: '@image1' }, ...(c.referencia ? [{ ruta: c.referencia, etiqueta: '@image2' }] : [])],
      aspectRatio: '3:4',
      tamano: '1K',
    });
    this.informar(`  inserción ${c.id}: ${foto.costeUsd.toFixed(3)} USD`);
    return { bytes: foto.bytes, prompt, costeUsd: foto.costeUsd, modelo: foto.modelo };
  }

  async garabato(describe: string, c: { local: string; color: string }): Promise<ActivoDisponible> {
    return this.recursoDeTinta(promptDeGarabato(describe), describe, 'garabato', c);
  }

  private async recursoDeTinta(prompt: string, describe: string, tipo: string, c: { local: string; color: string }): Promise<ActivoDisponible> {
    const id = this.idDe(tipo, prompt, c.color);
    if (await this.activos.existe(c.local, id)) return this.activos.obtener(c.local, id);
    const foto = await this.generador.generar({ id, prompt, referencias: [], aspectRatio: '1:1', tamano: '1K' });
    const { mascara, ancho, alto, bbox } = await tintaComoMascara(foto.bytes);
    if (!bbox) throw new Error(`el ${tipo} salió vacío (sin tinta)`);
    const pngMascara = await sharp(mascara, { raw: { width: ancho, height: alto, channels: 1 } }).png().toBuffer();
    // La imagen del recurso es el color liso; la máscara (la tinta) lo recorta.
    const pngColor = await sharp({ create: { width: ancho, height: alto, channels: 3, background: c.color } }).png().toBuffer();
    const sha = createHash('sha256').update(pngColor).update(pngMascara).digest('hex');
    const { generacion, ahora } = this.generacion(c.local, id, prompt, foto, { aspectRatio: '1:1', tamano: '1K', color: c.color });
    await this.activos.crear(
      Activo.parse({
        id,
        localSlug: c.local,
        tipo: 'GENERADO',
        uso: 'SOLO_PRUEBA_COMPOSICION',
        descripcion: `Recurso gráfico generado por el estudio de arte (${tipo}) en ${c.color}, no es producto: «${describe}»`,
        archivo: 'original.png',
        ancho,
        alto,
        sha256: sha,
        mascara: { archivo: 'mascara.png', metodo: 'UMBRAL', creadaEn: ahora, bbox, incluye: 'los trazos del dibujo (umbral de luminancia de la tinta)' },
        procedencia: { ruta: `datos/locales/${c.local}/activos/${id}/original.png`, sha256: sha, copiadoEn: ahora, generacion },
      }),
      { 'original.png': pngColor, 'mascara.png': pngMascara, 'dibujo.png': await sharp(foto.bytes).png().toBuffer(), 'prompt.txt': Buffer.from(`${prompt}\n`) },
    );
    this.informar(`  ${tipo} ${id}: ${foto.costeUsd.toFixed(3)} USD (${foto.modelo})`);
    return this.activos.obtener(c.local, id);
  }
}
