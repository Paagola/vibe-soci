/**
 * Mide una foto para el director de diseño (dominio/diseno/mapaDeFoto.ts): la reduce tal como caerá en el lienzo
 * (a sangre, cubriéndolo y centrada), lee sus píxeles y los de su máscara, y le pasa los números al dominio.
 */
import sharp from 'sharp';
import { construirMapa, type MapaDeFoto } from '../../dominio/diseno/mapaDeFoto.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { MedidorDeFoto } from '../../puertos/DirectorDeDiseno.js';

/** Píxeles de muestra por celda de la retícula: con 10 basta para medir detalle y color, y es instantáneo. */
const MUESTRA_POR_CELDA = 10;

export class MedidorDeFotoSharp implements MedidorDeFoto {
  async medir(foto: ActivoDisponible, reticula: { columnas: number; filas: number } = { columnas: 12, filas: 16 }): Promise<MapaDeFoto> {
    const ancho = reticula.columnas * MUESTRA_POR_CELDA;
    const alto = reticula.filas * MUESTRA_POR_CELDA;
    const rgb = await sharp(foto.ruta).rotate().removeAlpha().resize(ancho, alto, { fit: 'cover', position: 'centre' }).raw().toBuffer();
    // La máscara se lleva antes al tamaño de su foto (puede venir a otra resolución) y después se encuadra igual.
    const mascara = foto.rutaMascara
      ? await sharp(await sharp(foto.rutaMascara).resize(foto.activo.ancho, foto.activo.alto, { fit: 'fill' }).png().toBuffer())
          .resize(ancho, alto, { fit: 'cover', position: 'centre' })
          .extractChannel(0)
          .raw()
          .toBuffer()
      : undefined;
    return construirMapa({ ancho, alto, rgb: new Uint8Array(rgb), ...(mascara ? { mascara: new Uint8Array(mascara) } : {}), columnas: reticula.columnas, filas: reticula.filas });
  }
}
