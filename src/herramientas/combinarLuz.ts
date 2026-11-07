/**
 * Combina dos imágenes alineadas del mismo plato: la luz de una y el detalle de otra (separación de frecuencias).
 *
 * Para qué: un modelo puede dar la luz buscada a una resolución baja y otro el detalle a 4K, y ninguno de los dos
 * ser bueno solo. Las dos tienen que haber pasado la comprobación de fidelidad (CONSERVA) y estar alineadas con la
 * foto real; la combinación no inventa nada que no esté en ellas.
 *
 *   resultado = detalle × (borrosa(luz) mezclada con borrosa(detalle) en «relleno») ÷ borrosa(detalle)
 *
 * La ganancia se limita para que no aparezcan halos ni aspecto de HDR.
 *
 * Uso: tsx src/herramientas/combinarLuz.ts --local L --id NUEVO --luz ID --detalle ID [--sigma 5] [--relleno 0.3] --descripcion "…"
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { Activo } from '../dominio/activos.js';
import { RAIZ, leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';

const GANANCIA = { minima: 0.15, maxima: 1.35 };

const { values } = parseArgs({
  options: {
    local: { type: 'string' },
    id: { type: 'string' },
    luz: { type: 'string' },
    detalle: { type: 'string' },
    sigma: { type: 'string', default: '5' },
    relleno: { type: 'string', default: '0.3' },
    descripcion: { type: 'string' },
  },
});

async function principal(): Promise<void> {
  const { local, id, luz, detalle, descripcion } = values;
  if (!local || !id || !luz || !detalle || !descripcion) throw new Error('Faltan --local --id --luz --detalle --descripcion');
  const sigma = Number(values.sigma);
  const relleno = Number(values.relleno);
  const carpetaActivos = join(leerConfig().carpetaDatos, 'locales', local, 'activos');
  const carpeta = join(carpetaActivos, id);
  if (await stat(join(carpeta, 'activo.json')).then(() => true, () => false)) throw new Error(`El activo ${id} ya existe.`);

  const leer = async (activo: string) => Activo.parse(JSON.parse(await readFile(join(carpetaActivos, activo, 'activo.json'), 'utf8')));
  const [aLuz, aDetalle] = await Promise.all([leer(luz), leer(detalle)]);
  for (const a of [aLuz, aDetalle]) {
    if (a.fidelidad?.veredicto !== 'CONSERVA') throw new Error(`${a.id} no ha pasado la comprobación de fidelidad (CONSERVA): no se combina.`);
  }
  const { ancho: W, alto: H } = aDetalle;
  const cargar = (a: Activo) => sharp(join(carpetaActivos, a.id, a.archivo)).resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  const [pLuz, pDetalle] = await Promise.all([cargar(aLuz), cargar(aDetalle)]);
  const borrosa = (buf: Buffer) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).blur(sigma).raw().toBuffer();
  const [bLuz, bDetalle] = await Promise.all([borrosa(pLuz), borrosa(pDetalle)]);

  const salida = Buffer.alloc(W * H * 3);
  for (let p = 0; p < salida.length; p++) {
    const objetivo = (bLuz[p] ?? 0) * (1 - relleno) + (bDetalle[p] ?? 0) * relleno;
    const ganancia = Math.min(GANANCIA.maxima, Math.max(GANANCIA.minima, (objetivo + 2) / ((bDetalle[p] ?? 0) + 2)));
    salida[p] = Math.max(0, Math.min(255, Math.round((pDetalle[p] ?? 0) * ganancia)));
  }
  await mkdir(carpeta, { recursive: true });
  const bytes = await sharp(salida, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  await writeFile(join(carpeta, 'original.png'), bytes);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const activo = Activo.parse({
    id,
    localSlug: local,
    tipo: 'GENERADO',
    uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion,
    archivo: 'original.png',
    ancho: W,
    alto: H,
    sha256: sha,
    procedencia: {
      ruta: relative(RAIZ, join(carpeta, 'original.png')),
      sha256: sha,
      copiadoEn: new Date().toISOString(),
      derivacion: {
        operacion: 'luz-de-una-detalle-de-otra',
        entradas: { luz, detalle },
        parametros: { sigma, relleno, ganancia: GANANCIA },
      },
    },
    alteraciones: [...new Set([...aLuz.alteraciones, ...aDetalle.alteraciones])],
    niveles: [],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  console.log(`Activo ${id}: ${W} × ${H} (luz de ${luz}, detalle de ${detalle}) → ${relative(RAIZ, carpeta)}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
