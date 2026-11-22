/**
 * Estudio de arte · inserción en contexto con protección. Un modelo de edición (Nano Banana 2) dibuja elementos sobre la
 * pieza ya hecha; después, el código vuelve a poner encima, píxel a píxel, las capas protegidas de la pieza original
 * (el producto recortado, los textos, el patrón, los sellos y los filetes). Así el modelo solo puede añadir en el
 * fondo: nunca cambia el plato ni las letras, aunque lo intente.
 *
 * Mide también cuánto cambió el modelo dentro de lo protegido (lo que habría estropeado) y fuera (lo que añadió).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Tipos de capa de la intención que se protegen (todo lo que no es fondo, foto, degradado o textura). */
const PROTEGIDAS = new Set(['recorte', 'sombra', 'texto', 'patron', 'sello', 'forma', 'trazo', 'niveles', 'circulo-texto']);

export interface ResultadoInsercion {
  png: Buffer;
  /** Fracción de la superficie protegida (producto y textos) que el modelo habría cambiado. */
  cambioDentro: number;
  /** Fracción de la superficie libre que el modelo cambió (lo que añadió). */
  cambioFuera: number;
  /** Fracción del lienzo protegida. */
  protegido: number;
}

/** Una capa protegida: entera o, con `soloColor`, solo sus píxeles de ese color (las letras de un sello). */
export type CapaProtegida = string | { ruta: string; soloColor: string };

/**
 * Las capas a proteger de una versión pintada (carpeta con intencion.json y capas/NN-id.png). Con `reestilizar` que
 * incluye «sello», de cada sello se protegen solo sus letras (su color): el modelo puede rehacer la forma (relieve,
 * troquel, tinta) pero las cifras y las palabras quedan exactas.
 */
export async function capasProtegidas(carpetaVersion: string, reestilizar: string[] = []): Promise<CapaProtegida[]> {
  const intencion = JSON.parse(await readFile(join(carpetaVersion, 'intencion.json'), 'utf8')) as {
    capas: Array<{ id: string; tipo: string; activo?: string; color?: string }>;
    tokens?: { colores?: Record<string, string> };
  };
  const { readdir } = await import('node:fs/promises');
  const archivos = await readdir(join(carpetaVersion, 'capas'));
  const hex = (c?: string) => (c?.startsWith('@') ? intencion.tokens?.colores?.[c.slice(1)] : c);
  const rutas: CapaProtegida[] = [];
  for (const c of intencion.capas) {
    // Los recursos recortados (garabatos, elementos) no se protegen: el modelo puede redibujar alrededor de ellos.
    if (!PROTEGIDAS.has(c.tipo) || (c.tipo === 'recorte' && c.activo && c.activo !== 'foto')) continue;
    const archivo = archivos.find((a) => a.replace(/^\d+-/, '').replace(/\.png$/, '') === c.id);
    if (!archivo) continue;
    const ruta = join(carpetaVersion, 'capas', archivo);
    const letras = hex(c.color);
    if (c.tipo === 'sello' && reestilizar.includes('sello') && letras) rutas.push({ ruta, soloColor: letras });
    else rutas.push(ruta);
  }
  return rutas;
}

/** El alfa de una capa protegida (con `soloColor`, solo donde el píxel es de ese color, con tolerancia). */
async function alfaDe(capa: CapaProtegida, ancho: number, alto: number): Promise<Buffer> {
  const ruta = typeof capa === 'string' ? capa : capa.ruta;
  const { data } = await sharp(ruta).resize(ancho, alto, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alfa = Buffer.alloc(ancho * alto);
  if (typeof capa === 'string') {
    for (let i = 0; i < ancho * alto; i++) alfa[i] = data[i * 4 + 3]!;
    return alfa;
  }
  const h = capa.soloColor.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
  for (let i = 0; i < ancho * alto; i++) {
    const d = Math.abs(data[i * 4]! - r!) + Math.abs(data[i * 4 + 1]! - g!) + Math.abs(data[i * 4 + 2]! - b!);
    alfa[i] = d < 90 ? data[i * 4 + 3]! : 0;
  }
  return alfa;
}

export async function componerProtegido(original: string, editada: Buffer, capas: CapaProtegida[], ancho = 1080, alto = 1440): Promise<ResultadoInsercion> {
  const base = await sharp(original).resize(ancho, alto, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const nueva = await sharp(editada).resize(ancho, alto, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  // La máscara de protección: la unión de los alfas de las capas, ensanchada 3 px (los bordes antialias también).
  const union = Buffer.alloc(ancho * alto);
  for (const c of capas) {
    const a = await alfaDe(c, ancho, alto);
    for (let i = 0; i < union.length; i++) if (a[i]! > union[i]!) union[i] = a[i]!;
  }
  const ancha = await sharp(union, { raw: { width: ancho, height: alto, channels: 1 } }).blur(2).linear(3, 0).extractChannel(0).raw().toBuffer();
  const salida = Buffer.alloc(ancho * alto * 3);
  let dentro = 0;
  let cambiadoDentro = 0;
  let fuera = 0;
  let cambiadoFuera = 0;
  for (let i = 0; i < ancho * alto; i++) {
    const m = Math.min(255, ancha[i]!) / 255;
    const d = Math.max(Math.abs(base[i * 3]! - nueva[i * 3]!), Math.abs(base[i * 3 + 1]! - nueva[i * 3 + 1]!), Math.abs(base[i * 3 + 2]! - nueva[i * 3 + 2]!));
    if (m > 0.5) {
      dentro++;
      if (d > 40) cambiadoDentro++;
    } else {
      fuera++;
      if (d > 40) cambiadoFuera++;
    }
    for (let k = 0; k < 3; k++) salida[i * 3 + k] = Math.round(nueva[i * 3 + k]! * (1 - m) + base[i * 3 + k]! * m);
  }
  return {
    png: await sharp(salida, { raw: { width: ancho, height: alto, channels: 3 } }).png().toBuffer(),
    cambioDentro: dentro ? Math.round((cambiadoDentro / dentro) * 1000) / 1000 : 0,
    cambioFuera: fuera ? Math.round((cambiadoFuera / fuera) * 1000) / 1000 : 0,
    protegido: Math.round((dentro / (ancho * alto)) * 1000) / 1000,
  };
}
