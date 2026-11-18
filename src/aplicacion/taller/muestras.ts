import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { ComandaDeArte, SeleccionDeMuestras } from '../../dominio/taller.js';
import { huella } from './direccion.js';

type Muestras = NonNullable<ComandaDeArte['muestras']>;
const FONDO = '#f3f2ef';

export async function componerMuestras(fuente: Buffer, seleccion: SeleccionDeMuestras): Promise<Buffer> {
  const { width, height } = await sharp(fuente).metadata();
  // La fuente JPEG se ha orientado antes de medir los rectángulos. Recorta en sus coordenadas visibles.
  const recortes = await Promise.all(seleccion.recortes.map(async (r, i) => {
    const left = Math.min(width - 1, Math.round(r.x * width));
    const top = Math.min(height - 1, Math.round(r.y * height));
    const ancho = Math.max(1, Math.min(width - left, Math.round(r.ancho * width)));
    const alto = Math.max(1, Math.min(height - top, Math.round(r.alto * height)));
    const input = await sharp(fuente).extract({ left, top, width: ancho, height: alto })
      .resize({ width: 360, height: 335, fit: 'contain', background: FONDO }).jpeg({ quality: 94 }).toBuffer();
    return { input, left: 24 + i * 372, top: 24 };
  }));
  return sharp({ create: { width: 36 + recortes.length * 372, height: 383, channels: 3, background: FONDO } })
    .composite(recortes).jpeg({ quality: 94 }).toBuffer();
}

export async function guardarMuestras(carpeta: string, fuente: Buffer, seleccion: SeleccionDeMuestras): Promise<Muestras> {
  const bytes = await componerMuestras(fuente, seleccion);
  const sha256 = huella(bytes);
  await mkdir(carpeta, { recursive: true });
  const ruta = join(carpeta, sha256 + '.jpg');
  const temporal = join(carpeta, randomUUID() + '.tmp');
  try {
    await writeFile(temporal, bytes);
    await rename(temporal, ruta);
  } finally {
    await rm(temporal, { force: true });
  }
  return { ...seleccion, sha256 };
}

export async function leerMuestras(carpeta: string, comanda: ComandaDeArte, sha256: string): Promise<Buffer> {
  if (comanda.muestras?.sha256 !== sha256) throw new ErrorDeUsuario('La lámina solicitada no pertenece a la dirección vigente.');
  const bytes = await readFile(join(carpeta, sha256 + '.jpg'));
  if (huella(bytes) !== sha256) throw new ErrorDeUsuario('La lámina ya no coincide con los píxeles revisados.');
  return bytes;
}
