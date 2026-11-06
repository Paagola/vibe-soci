/**
 * Prepara un activo para el compositor (F1):
 * 1. copia la imagen a datos/locales/<local>/activos/<id>/ (el original no se toca) y comprueba que la copia es idéntica;
 * 2. crea la máscara del sujeto con Apple Vision (solo macOS, en local, sin red);
 * 3. guarda activo.json con su procedencia, sus alteraciones y la caja del sujeto.
 * Las alturas de las partes del plato («niveles») se anotan después a mano en activo.json.
 *
 * Uso:
 *   tsx src/herramientas/prepararActivo.ts --local dak-burger --id dak-real-manhattan \
 *     --desde datos/piezas/…/fotos/01-plato.jpg --tipo REAL --uso PUBLICABLE \
 *     --descripcion "…" --incluye "…" [--alteracion "…"]… [--generador modelo,pieza,version]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
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
    tipo: { type: 'string' },
    uso: { type: 'string' },
    descripcion: { type: 'string' },
    incluye: { type: 'string', default: 'el sujeto principal que detecta Apple Vision' },
    alteracion: { type: 'string', multiple: true, default: [] },
    generador: { type: 'string' },
  },
});

async function principal(): Promise<void> {
  const { local, id, desde, tipo, uso, descripcion } = values;
  if (!local || !id || !desde || !tipo || !uso || !descripcion) throw new Error('Faltan argumentos: --local --id --desde --tipo --uso --descripcion');
  const config = leerConfig();
  const carpeta = join(config.carpetaDatos, 'locales', local, 'activos', id);
  if (await stat(join(carpeta, 'activo.json')).then(() => true, () => false)) {
    throw new Error(`El activo ${id} ya existe en ${carpeta}. Un activo no se sobrescribe: usa otro id.`);
  }
  const origen = resolve(RAIZ, desde);
  const archivo = `original${extname(origen).toLowerCase()}`;
  await mkdir(carpeta, { recursive: true });
  await copyFile(origen, join(carpeta, archivo));
  const huella = async (ruta: string) => createHash('sha256').update(await readFile(ruta)).digest('hex');
  const [shaOrigen, shaCopia] = await Promise.all([huella(origen), huella(join(carpeta, archivo))]);
  if (shaOrigen !== shaCopia) throw new Error('La copia no es idéntica al original.');

  const { info } = await sharp(origen).rotate().toBuffer({ resolveWithObject: true });
  const herramienta = await compilarMascara();
  execFileSync(herramienta, [join(carpeta, archivo), join(carpeta, 'mascara.png')], { stdio: 'inherit' });
  const mascara = await sharp(join(carpeta, 'mascara.png')).resize(info.width, info.height, { fit: 'fill' }).extractChannel(0).png().toBuffer();
  const recorte = await sharp(mascara).trim({ background: '#000000', threshold: 40 }).toBuffer({ resolveWithObject: true });
  const bbox = { x: -(recorte.info.trimOffsetLeft ?? 0), y: -(recorte.info.trimOffsetTop ?? 0), w: recorte.info.width, h: recorte.info.height };

  const [modelo, pieza, version] = (values.generador ?? '').split(',');
  const activo = Activo.parse({
    id,
    localSlug: local,
    tipo,
    uso,
    descripcion,
    archivo,
    ancho: info.width,
    alto: info.height,
    sha256: shaCopia,
    procedencia: {
      ruta: relative(RAIZ, origen),
      sha256: shaOrigen,
      copiadoEn: new Date().toISOString(),
      ...(modelo ? { generador: { modelo, pieza, version: Number(version) } } : {}),
    },
    alteraciones: values.alteracion,
    mascara: { archivo: 'mascara.png', metodo: 'APPLE_VISION', creadaEn: new Date().toISOString(), bbox, incluye: values.incluye },
    niveles: [],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  console.log(`Activo ${id}: ${info.width} × ${info.height}, sujeto en ${JSON.stringify(bbox)} → ${relative(RAIZ, carpeta)}`);
}

/** Compila la herramienta de Apple Vision una vez y la deja en node_modules/.cache. */
async function compilarMascara(): Promise<string> {
  const salida = join(RAIZ, 'node_modules', '.cache', 'estudio-contenido', 'mascara');
  if (await stat(salida).then(() => true, () => false)) return salida;
  await mkdir(join(salida, '..'), { recursive: true });
  execFileSync('swiftc', ['-O', join(RAIZ, 'src', 'herramientas', 'mascara.swift'), '-o', salida], { stdio: 'inherit' });
  return salida;
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
