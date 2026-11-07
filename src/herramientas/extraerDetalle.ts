/**
 * Saca un detalle de una foto (p. ej. un grano de sal) como activo propio, con su máscara por umbral.
 * El detalle es la foto real recortada: no se dibuja ni se genera nada. La máscara sale del brillo de un canal
 * (el verde separa bien la sal blanca del caparazón rojo) y se suaviza un poco el borde.
 *
 * Uso: tsx src/herramientas/extraerDetalle.ts --local L --id NUEVO --desde ID --recorte x,y,w,h \
 *        --canal g --desde-valor 120 --hasta-valor 175 --descripcion "…"
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
  options: {
    local: { type: 'string' },
    id: { type: 'string' },
    desde: { type: 'string' },
    recorte: { type: 'string' },
    canal: { type: 'string', default: 'g' },
    'desde-valor': { type: 'string', default: '120' },
    'hasta-valor': { type: 'string', default: '175' },
    descripcion: { type: 'string' },
  },
});

async function principal(): Promise<void> {
  const { local, id, desde, recorte, descripcion } = values;
  if (!local || !id || !desde || !recorte || !descripcion) throw new Error('Faltan --local --id --desde --recorte --descripcion');
  const [x = 0, y = 0, w = 1, h = 1] = recorte.split(',').map(Number);
  const canal = { r: 0, g: 1, b: 2 }[values.canal as 'r' | 'g' | 'b'] ?? 1;
  const bajo = Number(values['desde-valor']);
  const alto = Number(values['hasta-valor']);
  const carpetaActivos = join(leerConfig().carpetaDatos, 'locales', local, 'activos');
  const carpeta = join(carpetaActivos, id);
  if (await stat(join(carpeta, 'activo.json')).then(() => true, () => false)) throw new Error(`El activo ${id} ya existe.`);
  const origen = Activo.parse(JSON.parse(await readFile(join(carpetaActivos, desde, 'activo.json'), 'utf8')));

  const rgb = await sharp(join(carpetaActivos, desde, origen.archivo)).extract({ left: x, top: y, width: w, height: h }).removeAlpha().raw().toBuffer();
  const mascara = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = rgb[i * 3 + canal] ?? 0;
    mascara[i] = Math.round(255 * Math.min(1, Math.max(0, (v - bajo) / (alto - bajo))));
  }
  const mascaraPng = await sharp(mascara, { raw: { width: w, height: h, channels: 1 } }).blur(0.6).extractChannel(0).png().toBuffer();
  const imagenPng = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, 'original.png'), imagenPng);
  await writeFile(join(carpeta, 'mascara.png'), mascaraPng);
  const recortada = await sharp(mascaraPng).trim({ background: '#000000', threshold: 40 }).toBuffer({ resolveWithObject: true });
  const bbox = { x: -(recortada.info.trimOffsetLeft ?? 0), y: -(recortada.info.trimOffsetTop ?? 0), w: recortada.info.width, h: recortada.info.height };
  const sha = createHash('sha256').update(imagenPng).digest('hex');

  const activo = Activo.parse({
    id,
    localSlug: local,
    tipo: origen.tipo,
    uso: origen.uso,
    descripcion,
    archivo: 'original.png',
    ancho: w,
    alto: h,
    sha256: sha,
    procedencia: {
      ruta: relative(RAIZ, join(carpeta, 'original.png')),
      sha256: sha,
      copiadoEn: new Date().toISOString(),
      derivacion: { operacion: 'recorte-con-mascara-por-umbral', entradas: { desde }, parametros: { recorte: { x, y, w, h }, canal: values.canal, bajo, alto } },
    },
    alteraciones: origen.alteraciones,
    mascara: { archivo: 'mascara.png', metodo: 'UMBRAL', creadaEn: new Date().toISOString(), bbox, incluye: `píxeles con el canal ${values.canal} por encima de ${bajo}` },
    niveles: [],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  console.log(`Activo ${id}: ${w} × ${h}, detalle en ${JSON.stringify(bbox)} → ${relative(RAIZ, carpeta)}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
