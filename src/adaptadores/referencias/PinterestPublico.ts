/**
 * Búsqueda en Pinterest con su buscador público (el mismo con el que se montó el corpus de referencias-pinterest/).
 * Solo para estudiar el oficio: las imágenes se guardan como referencia de la conversación y nunca se publican.
 * Sin sesión ni datos del usuario: un agente de navegador genérico.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { z } from 'zod';

const AGENTE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

export interface PinDePinterest {
  id: string;
  titulo: string;
  /** Dónde se publicó (el enlace del pin) o, si no tiene, la búsqueda de Pinterest que lo trajo. */
  enlace: string;
  miniatura: string;
  grande: string;
  ancho: number;
  alto: number;
}

const Imagen = z.object({ url: z.string().url(), width: z.number().optional(), height: z.number().optional() });
const Respuesta = z.object({
  resource_response: z.object({
    data: z.object({
      results: z.array(
        z
          .object({
            id: z.union([z.string(), z.number()]).transform(String),
            grid_title: z.string().nullish(),
            title: z.string().nullish(),
            description: z.string().nullish(),
            link: z.string().nullish(),
            images: z.record(z.string(), Imagen).nullish(),
          })
          .passthrough(),
      ),
    }),
  }),
});

export class PinterestPublico {
  constructor(private readonly f: typeof fetch = fetch) {}

  async buscar(consulta: string, cuantos = 25): Promise<PinDePinterest[]> {
    const data = JSON.stringify({ options: { query: consulta, scope: 'pins', page_size: Math.min(50, cuantos) }, context: {} });
    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(`/search/pins/?q=${consulta}`)}&data=${encodeURIComponent(data)}`;
    const r = await this.f(url, { headers: { 'User-Agent': AGENTE, Accept: 'application/json', 'X-Pinterest-PWS-Handler': 'www/search/[scope].js' }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Pinterest respondió ${r.status} a «${consulta}».`);
    const leida = Respuesta.safeParse(await r.json());
    if (!leida.success) throw new Error('Pinterest cambió el formato de su búsqueda.');
    return leida.data.resource_response.data.results.flatMap((x) => {
      const grande = x.images?.['736x'] ?? x.images?.orig;
      const miniatura = x.images?.['236x'] ?? grande;
      if (!grande || !miniatura) return [];
      return [{ id: x.id, titulo: (x.grid_title || x.title || x.description || '').trim().slice(0, 160), enlace: x.link && /^https:\/\//.test(x.link) ? x.link.slice(0, 500) : `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(consulta)}`, miniatura: miniatura.url, grande: grande.url, ancho: grande.width ?? 0, alto: grande.height ?? 0 }];
    });
  }

  /** Descarga una imagen de Pinterest (solo de i.pinimg.com) y comprueba que es una imagen de verdad. */
  async descargar(url: string, ruta: string): Promise<void> {
    if (!/^https:\/\/i\.pinimg\.com\//.test(url)) throw new Error('Solo se descargan imágenes de i.pinimg.com.');
    const r = await this.f(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`No se pudo descargar ${url} (${r.status}).`);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > 15 * 1024 * 1024) throw new Error('Imagen demasiado grande.');
    // Se reescribe con sharp: si no es una imagen, falla aquí y no se guarda nada.
    await writeFile(ruta, await sharp(bytes).rotate().jpeg({ quality: 88 }).toBuffer());
  }
}
