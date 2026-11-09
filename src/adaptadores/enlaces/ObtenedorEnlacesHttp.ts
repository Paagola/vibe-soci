import { plataformaDe } from '../../dominio/referencia.js';
import type { ObtenedorEnlaces, ResultadoEnlace } from '../../puertos/ObtenedorEnlaces.js';

const TIEMPO_MS = 15_000;
/**
 * Imágenes que una plataforma pone en páginas que no son un post (su logotipo para compartir).
 * Comprobado el 07/11/2026: pinterest.com y pin.it sin pin válido devuelven s.pinimg.com/images/facebook_share_image.png.
 */
const IMAGENES_GENERICAS = [/facebook_share_image/i, /og[-_]?default/i, /default[-_]?(og|share)/i, /\/(logo|brand)[^/]*\.(png|jpe?g|svg)$/i];
const TAMANO_MAXIMO = 15 * 1024 * 1024;

/**
 * Intenta leer la imagen pública de un enlace: la página (o un enlace directo a una imagen) y su og:image.
 * Sin sesión, sin API y sin buscar en la plataforma. Si el sitio responde con error, exige iniciar sesión
 * o no publica una imagen, devuelve PIDE_CAPTURA con el motivo.
 */
export class ObtenedorEnlacesHttp implements ObtenedorEnlaces {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async obtener(url: string): Promise<ResultadoEnlace> {
    let respuesta: Response;
    try {
      respuesta = await this.pedir(url);
    } catch (error) {
      return { estado: 'PIDE_CAPTURA', motivo: `no se pudo abrir el enlace (${(error as Error).message})` };
    }
    if (!respuesta.ok) return descartar(respuesta, `el sitio respondió HTTP ${respuesta.status}`);
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (tipo.startsWith('image/')) return this.imagen(respuesta, url);
    if (!tipo.includes('html')) return descartar(respuesta, `el enlace no es una página ni una imagen (${tipo || 'sin tipo'})`);

    const html = (await respuesta.text()).slice(0, 2_000_000);
    const encontrada = metaImagen(html);
    if (!encontrada) return { estado: 'PIDE_CAPTURA', motivo: 'la página no publica una imagen (puede pedir sesión o cargarla con JavaScript)' };
    const urlImagen = new URL(encontrada, respuesta.url || url).toString();
    if (IMAGENES_GENERICAS.some((r) => r.test(urlImagen))) {
      return { estado: 'PIDE_CAPTURA', motivo: 'la página solo publica la imagen genérica de la plataforma, no la del post' };
    }
    if (plataformaDe(url) === 'PINTEREST' && new URL(urlImagen).hostname !== 'i.pinimg.com') {
      return { estado: 'PIDE_CAPTURA', motivo: 'Pinterest no publica la imagen del pin en esta página' };
    }
    let respuestaImagen: Response;
    try {
      respuestaImagen = await this.pedir(urlImagen);
    } catch (error) {
      return { estado: 'PIDE_CAPTURA', motivo: `no se pudo descargar la imagen de la página (${(error as Error).message})` };
    }
    if (!respuestaImagen.ok) return descartar(respuestaImagen, `la imagen de la página respondió HTTP ${respuestaImagen.status}`);
    if (!(respuestaImagen.headers.get('content-type') ?? '').startsWith('image/')) return descartar(respuestaImagen, 'lo que publica la página como imagen no es una imagen');
    return this.imagen(respuestaImagen, urlImagen);
  }

  private pedir(url: string): Promise<Response> {
    return this.fetchFn(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'estudio-contenido/0.1 (lector de referencias)', Accept: 'text/html,image/*;q=0.9,*/*;q=0.5' },
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
  }

  private async imagen(respuesta: Response, urlImagen: string): Promise<ResultadoEnlace> {
    const bytes = Buffer.from(await respuesta.arrayBuffer());
    if (bytes.length === 0) return { estado: 'PIDE_CAPTURA', motivo: 'la imagen llegó vacía' };
    if (bytes.length > TAMANO_MAXIMO) return { estado: 'PIDE_CAPTURA', motivo: 'la imagen es demasiado grande' };
    return { estado: 'OBTENIDA', bytes, tipo: respuesta.headers.get('content-type') ?? 'image/jpeg', urlImagen };
  }
}

/** Cierra el cuerpo que no se va a leer (si no, la conexión queda abierta y el proceso no termina). */
async function descartar(respuesta: Response, motivo: string): Promise<ResultadoEnlace> {
  await respuesta.body?.cancel().catch(() => undefined);
  return { estado: 'PIDE_CAPTURA', motivo };
}

/** og:image o twitter:image de una página (en cualquier orden de atributos). */
export function metaImagen(html: string): string | undefined {
  for (const etiqueta of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const nombre = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(etiqueta)?.[1]?.toLowerCase();
    if (nombre !== 'og:image' && nombre !== 'og:image:url' && nombre !== 'twitter:image') continue;
    const contenido = /content\s*=\s*["']([^"']+)["']/i.exec(etiqueta)?.[1];
    if (contenido) return contenido.replace(/&amp;/g, '&');
  }
  return undefined;
}
