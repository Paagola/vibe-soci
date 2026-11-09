/**
 * Lee la imagen pública de un enlace (Canva, Pinterest u otro). No busca en esas plataformas ni inicia sesión:
 * si el sitio no deja leer la imagen, lo dice y se pide una captura. Nunca se inventa el contenido de un enlace.
 */
export type ResultadoEnlace =
  | { estado: 'OBTENIDA'; bytes: Buffer; tipo: string; urlImagen: string }
  | { estado: 'PIDE_CAPTURA'; motivo: string };

export interface ObtenedorEnlaces {
  obtener(url: string): Promise<ResultadoEnlace>;
}
