/**
 * La dominante amarilla de las fotos generadas: el tono cálido que delata una imagen de IA (Torre de Vega, 23/11: los
 * blancos de la mesa con R−B de 107 y 135, frente a 11 en la foto real del cliente y 6–11 en el carrusel de la ensalada).
 *
 * Se mide en los blancos (el 3 % más claro de la imagen), que en una foto bien equilibrada son neutros: R ≈ G ≈ B. La
 * comida y la madera pueden ser cálidas; los blancos, no. Con una dominante moderada, el código la neutraliza escalando
 * los canales; con una excesiva, la foto se repite.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

export interface Dominante {
  /** Rojo menos azul en los blancos (0 = neutro; positivo = amarillo o naranja). */
  blancosRB: number;
  /** Los blancos (media del 3 % más claro), en sRGB 0–255. */
  blancos: [number, number, number];
}

/** Hasta aquí, neutra; hasta EXCESIVA, la corrige el código; por encima, se repite la foto. */
export const DOMINANTE_TOLERABLE = 30;
export const DOMINANTE_EXCESIVA = 90;

export type JuicioDeDominante = 'NEUTRA' | 'CORREGIBLE' | 'EXCESIVA';

export function juzgarDominante(d: Pick<Dominante, 'blancosRB'>): JuicioDeDominante {
  return d.blancosRB <= DOMINANTE_TOLERABLE ? 'NEUTRA' : d.blancosRB <= DOMINANTE_EXCESIVA ? 'CORREGIBLE' : 'EXCESIVA';
}

export async function medirDominante(entrada: string | Buffer): Promise<Dominante> {
  const { data } = await sharp(entrada).rotate().removeAlpha().resize(320, 320, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const pix: Array<[number, number, number, number]> = [];
  for (let i = 0; i < data.length; i += 3) pix.push([0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!, data[i]!, data[i + 1]!, data[i + 2]!]);
  pix.sort((a, b) => b[0] - a[0]);
  const top = pix.slice(0, Math.max(1, Math.floor(pix.length * 0.03)));
  const media = (k: 1 | 2 | 3) => top.reduce((s, p) => s + p[k], 0) / top.length;
  const blancos: [number, number, number] = [media(1), media(2), media(3)];
  return { blancosRB: Math.round(blancos[0] - blancos[2]), blancos: blancos.map((v) => Math.round(v)) as [number, number, number] };
}

/**
 * Neutraliza la dominante: escala rojo y azul para que los blancos queden casi neutros (con un punto de calidez,
 * `objetivoRB`, para que no se vea fría). Los factores van acotados: corrige un tono, no repinta la foto.
 * Devuelve la medida antes y después, o nada si no hacía falta.
 */
export async function neutralizarDominante(ruta: string, objetivoRB = 8): Promise<{ antes: number; despues: number } | undefined> {
  const antes = await medirDominante(ruta);
  if (juzgarDominante(antes) === 'NEUTRA') return undefined;
  const [r, g, b] = antes.blancos;
  const acotar = (v: number, a: number, z: number) => Math.min(z, Math.max(a, v));
  const kR = acotar((g + objetivoRB / 2) / Math.max(1, r), 0.8, 1.02);
  const kB = acotar((g - objetivoRB / 2) / Math.max(1, b), 0.98, 1.45);
  const bytes = await sharp(ruta).rotate().removeAlpha().linear([kR, 1, kB], [0, 0, 0]).png().toBuffer();
  await writeFile(ruta, bytes);
  return { antes: antes.blancosRB, despues: (await medirDominante(bytes)).blancosRB };
}
