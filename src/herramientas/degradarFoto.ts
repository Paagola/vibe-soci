/**
 * Hace una versión «mala» de una foto real, como la que subiría un hostelero con prisa: pequeña, torcida,
 * con luz fría, poco contraste, algo movida y muy comprimida. Sirve para comprobar (benchmark de la F1.6)
 * que la foto nueva sale profesional aunque la de partida no lo sea. Determinista y sin coste.
 *
 * Uso: tsx src/herramientas/degradarFoto.ts --local L --desde ID --id NUEVO [--ancho 1000] [--giro -6]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { Activo } from '../dominio/activos.js';
import { RAIZ, leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';

const { values } = parseArgs({
  options: { local: { type: 'string' }, desde: { type: 'string' }, id: { type: 'string' }, ancho: { type: 'string', default: '1000' }, giro: { type: 'string', default: '-6' } },
});

async function principal(): Promise<void> {
  const { local, desde, id } = values;
  if (!local || !desde || !id) throw new Error('Faltan --local --desde --id');
  const ancho = Number(values.ancho);
  const giro = Number(values.giro);
  const carpetaActivos = join(leerConfig().carpetaDatos, 'locales', local, 'activos');
  const carpeta = join(carpetaActivos, id);
  if (await stat(join(carpeta, 'activo.json')).then(() => true, () => false)) throw new Error(`El activo ${id} ya existe.`);
  const origen = Activo.parse(JSON.parse(await readFile(join(carpetaActivos, desde, 'activo.json'), 'utf8')));

  // Torcida y recortada para que no se vean las esquinas del giro; después, pequeña.
  const girada = await sharp(join(carpetaActivos, desde, origen.archivo)).rotate(giro, { background: '#ffffff' }).toBuffer({ resolveWithObject: true });
  const margen = Math.round(Math.abs(Math.sin((giro * Math.PI) / 180)) * Math.max(origen.ancho, origen.alto)) + 20;
  const recortada = await sharp(girada.data)
    .extract({ left: margen, top: margen, width: girada.info.width - 2 * margen, height: girada.info.height - 2 * margen })
    .png()
    .toBuffer();
  const bytes = await sharp(recortada)
    .resize(ancho)
    // Luz fría de fluorescente: menos rojo, más azul, contraste bajo y un velo gris.
    .recomb([
      [0.86, 0.06, 0.04],
      [0.02, 0.95, 0.05],
      [0.02, 0.08, 1.08],
    ])
    .linear(0.78, 34)
    .modulate({ saturation: 0.82 })
    .blur(1.1)
    .jpeg({ quality: 55, chromaSubsampling: '4:2:0' })
    .toBuffer();
  const meta = await sharp(bytes).metadata();
  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, 'original.jpg'), bytes);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const activo = Activo.parse({
    id,
    localSlug: local,
    tipo: 'REAL',
    uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: `Versión degradada de ${desde} (pequeña, torcida ${giro}°, luz fría, poco contraste, movida, JPEG 55) para el benchmark de foto nueva. No es para publicar.`,
    archivo: 'original.jpg',
    ancho: meta.width,
    alto: meta.height,
    sha256: sha,
    procedencia: {
      ruta: relative(RAIZ, join(carpeta, 'original.jpg')),
      sha256: sha,
      copiadoEn: new Date().toISOString(),
      derivacion: { operacion: 'degradar-como-foto-de-movil', entradas: { desde }, parametros: { ancho, giro, recomb: 'fría', linear: [0.78, 34], saturacion: 0.82, desenfoque: 1.1, jpeg: 55 } },
    },
    alteraciones: ['foto degradada a propósito: no representa la calidad del producto'],
    niveles: [],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  console.log(`Activo ${id}: ${meta.width} × ${meta.height} → ${relative(RAIZ, carpeta)}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
