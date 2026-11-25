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

  /**
   * Estudio de arte: la silueta del sujeto dentro de su caja, en una rejilla (fracción de cada celda que es sujeto).
   * Con ella el código sabe qué celdas del lienzo pisa el producto recortado de verdad, no su rectángulo: los textos
   * pequeños caben en los «hombros» de una hamburguesa o al lado del tentáculo.
   */
  async silueta(foto: ActivoDisponible, lado = 32): Promise<{ columnas: number; filas: number; ocupacion: number[] } | undefined> {
    const bbox = foto.activo.mascara?.bbox;
    if (!foto.rutaMascara || !bbox || bbox.w < 2 || bbox.h < 2) return undefined;
    const completa = await sharp(foto.rutaMascara).resize(foto.activo.ancho, foto.activo.alto, { fit: 'fill' }).extractChannel(0).png().toBuffer();
    const valores = await sharp(completa)
      .extract({ left: bbox.x, top: bbox.y, width: Math.min(bbox.w, foto.activo.ancho - bbox.x), height: Math.min(bbox.h, foto.activo.alto - bbox.y) })
      .resize(lado, lado, { fit: 'fill', kernel: 'cubic' })
      // sharp devuelve 3 canales al leer en crudo un gris: se pide uno (si no, la rejilla sale con el triple de valores).
      .extractChannel(0)
      .raw()
      .toBuffer();
    return { columnas: lado, filas: lado, ocupacion: Array.from(valores, (v) => Math.round((v / 255) * 100) / 100) };
  }
}
