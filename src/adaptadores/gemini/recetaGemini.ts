/**
 * Receta de una imagen de Gemini (Nano Banana Pro) y preparación de sus referencias.
 * La comparten el envío por API (herramientas/generarGeminiImagen.ts), el paquete para la app de Gemini
 * (herramientas/paqueteManual.ts) y la importación de lo generado a mano (herramientas/importarManual.ts):
 * las tres preparan las referencias igual, así que su huella (sha256) coincide.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { Activo } from '../../dominio/activos.js';
import type { ReferenciaImagen } from './imagenGemini.js';

export const RecetaGemini = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  local: z.string(),
  descripcion: z.string(),
  modelo: z.string().default('gemini-3-pro-image'),
  parametros: z.object({ aspectRatio: z.string().default('3:4'), imageSize: z.enum(['1K', '2K', '4K']).default('2K') }),
  promptArchivo: z.string(),
  /** En el orden de @image1, @image2…: un activo del local o un archivo del proyecto (p. ej. una referencia sin texto). */
  referencias: z
    .array(
      z
        .object({
          activo: z.string().optional(),
          archivo: z.string().optional(),
          etiqueta: z.string(),
          /** Para la nota del paquete manual, en español: qué es, qué gobierna y qué no se copia. */
          rol: z.object({ nombre: z.string(), gobierna: z.string(), noSeCopia: z.string() }).optional(),
          ladoMaximo: z.number().int().positive().default(2048),
        })
        .refine((r) => Boolean(r.activo) !== Boolean(r.archivo), 'cada referencia es un activo o un archivo, no las dos cosas'),
    )
    .default([]),
  alteraciones: z.array(z.string()).default([]),
});
export type RecetaGemini = z.infer<typeof RecetaGemini>;

export type ReferenciaPreparada = ReferenciaImagen & { origen: string; sha256: string };

export async function leerReceta(ruta: string): Promise<RecetaGemini> {
  return RecetaGemini.parse(JSON.parse(await readFile(ruta, 'utf8')));
}

/** JPEG de calidad 95 con el lado largo limitado: lo mismo que se sube a la API o se adjunta en la app. */
export async function prepararReferencia(raiz: string, carpetaDatos: string, local: string, r: RecetaGemini['referencias'][number]): Promise<ReferenciaPreparada> {
  let ruta: string;
  let origen: string;
  if (r.activo) {
    const carpeta = join(carpetaDatos, 'locales', local, 'activos', r.activo);
    const activo = Activo.parse(JSON.parse(await readFile(join(carpeta, 'activo.json'), 'utf8')));
    ruta = join(carpeta, activo.archivo);
    origen = r.activo;
  } else {
    ruta = resolve(raiz, r.archivo as string);
    origen = `archivo:${r.archivo}`;
  }
  const bytes = await sharp(ruta)
    .rotate()
    .resize(r.ladoMaximo, r.ladoMaximo, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return { etiqueta: r.etiqueta, bytes, mime: 'image/jpeg', origen, sha256: createHash('sha256').update(bytes).digest('hex') };
}
