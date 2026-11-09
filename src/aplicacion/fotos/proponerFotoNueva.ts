import sharp from 'sharp';
import { montarPromptFotoNueva, problemasFotoNueva, type PropuestaFotoNueva } from '../../dominio/fotoNueva.js';
import type { DirectorDeFoto, EncargoDeFoto } from '../../puertos/Foto.js';

export interface ResultadoPropuesta {
  propuesta: PropuestaFotoNueva;
  prompt: string;
  /** Lo que sigue sin cumplir tras el reintento (vacío si todo cumple). */
  problemas: string[];
  intentos: Array<{ problemas: string[] }>;
}

/**
 * El director rellena la plantilla; el código comprueba lo comprobable (otra toma, recuento, sin texto, resolución)
 * y, si falla, se lo devuelve una vez con los problemas. El prompt lo monta el código.
 */
export async function proponerFotoNueva(director: DirectorDeFoto, encargo: EncargoDeFoto): Promise<ResultadoPropuesta> {
  const meta = await sharp(encargo.foto).metadata();
  const lado = { ancho: meta.width ?? 0, alto: meta.height ?? 0 };
  let problemas: string[] = [];
  let propuesta: PropuestaFotoNueva | undefined;
  const intentos: Array<{ problemas: string[] }> = [];
  for (let intento = 1; intento <= 2; intento++) {
    propuesta = await director.proponer(encargo, problemas);
    problemas = problemasFotoNueva(propuesta, lado);
    intentos.push({ problemas });
    if (problemas.length === 0) break;
  }
  if (!propuesta) throw new Error('El director no respondió.');
  return { propuesta, prompt: montarPromptFotoNueva(propuesta.huecos), problemas, intentos };
}
