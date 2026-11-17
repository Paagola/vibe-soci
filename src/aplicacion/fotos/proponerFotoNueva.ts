import sharp from 'sharp';
import { revisarPropuesta } from '../../dominio/promptFiel.js';
import type { OpcionesDePrompt, PropuestaFotoNueva } from '../../dominio/fotoNueva.js';
import type { DirectorDeFoto, EncargoDeFoto } from '../../puertos/Foto.js';

export interface ResultadoPropuesta {
  propuesta: PropuestaFotoNueva;
  prompt: string;
  /** Lo que sigue sin cumplir tras el reintento (vacío si todo cumple). */
  problemas: string[];
  intentos: Array<{ problemas: string[] }>;
  /** Cómo se montó el prompt (se guarda con la propuesta para volver a montarlo igual). */
  opcionesPrompt: OpcionesDePrompt;
}

/**
 * El director rellena la plantilla; el código comprueba lo comprobable (otra toma, recuento, sin texto, resolución)
 * y, si falla, se lo devuelve una vez con los problemas. El prompt lo monta el código.
 */
export async function proponerFotoNueva(director: DirectorDeFoto, encargo: EncargoDeFoto, hechos: { marca?: string } = {}): Promise<ResultadoPropuesta> {
  const meta = await sharp(encargo.foto).metadata();
  const lado = { ancho: meta.width ?? 0, alto: meta.height ?? 0 };
  let problemas: string[] = [];
  let propuesta: PropuestaFotoNueva | undefined;
  let prompt = '';
  const intentos: Array<{ problemas: string[] }> = [];
  for (let intento = 1; intento <= 2; intento++) {
    propuesta = await director.proponer(encargo, problemas);
    const r = revisarPropuesta(propuesta, encargo.alGenerador, { lado, nota: encargo.plato, ...(hechos.marca ? { marca: hechos.marca } : {}) });
    problemas = r.problemas;
    prompt = r.prompt;
    intentos.push({ problemas });
    if (problemas.length === 0) break;
  }
  if (!propuesta) throw new Error('El director no respondió.');
  return { propuesta, prompt, problemas, intentos, opcionesPrompt: encargo.alGenerador ?? {} };
}
