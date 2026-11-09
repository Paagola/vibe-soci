/**
 * Añade una máscara a un activo que ya existe (p. ej. una foto nueva generada sobre fondo controlado).
 *
 * - luminancia: para fotos sobre un fondo oscuro liso (carbón). Todo lo que brilla más que el fondo es sujeto:
 *   el producto, la vajilla clara y los detalles finos (antenas), que Apple Vision suele perder.
 * - vision: Apple Vision (macOS, local), como en prepararActivo.
 * - combinada: el máximo de las dos (hay que crear antes ambas). Comprobado en el benchmark F1.6: Vision rellena el
 *   cuerpo de las gambas, pero deja fuera el plato de cristal; la de luminancia guarda plato y antenas, pero se agujerea
 *   en las manchas oscuras. Juntas no pierden nada.
 *
 * Uso: tsx src/herramientas/crearMascara.ts --local L --id ID --metodo luminancia|vision|combinada [--desde 28] [--hasta 60]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { Activo } from '../dominio/activos.js';
import { RAIZ, leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';
import { SegmentadorVision } from '../adaptadores/imagen/SegmentadorVision.js';

const { values } = parseArgs({
  options: { local: { type: 'string' }, id: { type: 'string' }, metodo: { type: 'string', default: 'luminancia' }, desde: { type: 'string', default: '28' }, hasta: { type: 'string', default: '60' } },
});

async function principal(): Promise<void> {
  const { local, id } = values;
  if (!local || !id) throw new Error('Faltan --local --id');
  const carpeta = join(leerConfig().carpetaDatos, 'locales', local, 'activos', id);
  const activo = Activo.parse(JSON.parse(await readFile(join(carpeta, 'activo.json'), 'utf8')));
  const ruta = join(carpeta, activo.archivo);
  const archivo = `mascara-${values.metodo}.png`;

  if (values.metodo === 'vision') {
    await writeFile(join(carpeta, archivo), await new SegmentadorVision(RAIZ).mascara(ruta));
  } else if (values.metodo === 'luminancia') {
    const desde = Number(values.desde);
    const hasta = Number(values.hasta);
    const { data, info } = await sharp(ruta).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const m = Buffer.alloc(info.width * info.height);
    for (let i = 0, p = 0; i < m.length; i++, p += 3) {
      // El canal más alto: los rojos del producto y el cristal claro superan de largo al carbón del fondo.
      const v = Math.max(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0);
      m[i] = Math.round(255 * Math.min(1, Math.max(0, (v - desde) / (hasta - desde))));
    }
    await sharp(m, { raw: { width: info.width, height: info.height, channels: 1 } }).blur(0.8).extractChannel(0).png().toFile(join(carpeta, archivo));
  } else if (values.metodo === 'combinada') {
    const [a, b] = await Promise.all(['mascara-vision.png', 'mascara-luminancia.png'].map((f) => sharp(join(carpeta, f)).extractChannel(0).raw().toBuffer()));
    if (!a || !b || a.length !== b.length) throw new Error('Crea antes las máscaras vision y luminancia, del mismo tamaño.');
    const m = Buffer.alloc(a.length);
    for (let i = 0; i < m.length; i++) m[i] = Math.max(a[i] ?? 0, b[i] ?? 0);
    await sharp(m, { raw: { width: activo.ancho, height: activo.alto, channels: 1 } }).png().toFile(join(carpeta, archivo));
  } else {
    throw new Error('--metodo es luminancia, vision o combinada');
  }

  const recortada = await sharp(join(carpeta, archivo)).trim({ background: '#000000', threshold: 40 }).toBuffer({ resolveWithObject: true });
  const bbox = { x: -(recortada.info.trimOffsetLeft ?? 0), y: -(recortada.info.trimOffsetTop ?? 0), w: recortada.info.width, h: recortada.info.height };
  const actualizado = Activo.parse({
    ...activo,
    mascara: {
      archivo,
      metodo: values.metodo === 'vision' ? 'APPLE_VISION' : values.metodo === 'combinada' ? 'MANUAL' : 'UMBRAL',
      creadaEn: new Date().toISOString(),
      bbox,
      incluye: values.metodo === 'vision' ? 'lo que detecte Apple Vision' : values.metodo === 'combinada' ? 'Apple Vision + luminancia: gambas, antenas y plato' : `todo lo que brilla más que el fondo oscuro (canal máximo ${values.desde}–${values.hasta})`,
    },
  });
  await escribirJson(join(carpeta, 'activo.json'), actualizado);
  console.log(`Máscara ${values.metodo} de ${id}: sujeto en ${JSON.stringify(bbox)}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
