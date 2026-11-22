/**
 * Franjas planas en los bordes de una foto generada. Un modelo de imagen al que se le pide «aire para el texto» puede
 * pintar una franja lisa (negra o de un color) en vez de una pared o una sombra de verdad: en la pieza se ve como un
 * recuadro (Lo Güeno, lote-1: el 28 % de arriba, negro plano). Una franja así no tiene textura: cada fila, reducida a
 * 120 px, varía como mucho unos pocos niveles de gris de punta a punta; una pared oscura real tiene grano y degradado.
 */
import sharp from 'sharp';

export interface FranjasPlanas {
  /** Fracción del alto, desde cada borde, que es una franja plana. */
  arriba: number;
  abajo: number;
}

/** Variación máxima (niveles de gris, 0-255) de una fila para contar como plana. */
const RANGO_PLANO = 6;

export async function franjasPlanas(ruta: string | Buffer): Promise<FranjasPlanas> {
  const { data, info } = await sharp(ruta).greyscale().resize(120, 160, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const plana = (y: number) => {
    let mn = 255;
    let mx = 0;
    for (let x = 0; x < info.width; x++) {
      const v = data[(y * info.width + x) * info.channels]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return mx - mn <= RANGO_PLANO;
  };
  let arriba = 0;
  while (arriba < info.height && plana(arriba)) arriba++;
  let abajo = 0;
  while (abajo < info.height - arriba && plana(info.height - 1 - abajo)) abajo++;
  return { arriba: Math.round((arriba / info.height) * 100) / 100, abajo: Math.round((abajo / info.height) * 100) / 100 };
}
