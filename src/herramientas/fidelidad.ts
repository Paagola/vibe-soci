/**
 * Comprueba si una imagen generada conserva el producto de la foto real (fidelidad ESTRICTA).
 *
 * Mide, dentro de la zona del producto (la máscara de la foto real, ensanchada), cuánto se parecen los bordes
 * de las dos imágenes: correlación normalizada de los gradientes, buscando el mejor desplazamiento de ±12 px.
 * Una pata que cambia, una antena que desaparece o una gamba que se mueve bajan la correlación.
 * Además saca una hoja con recortes ampliados lado a lado (real | generada) para mirarlos: la medida avisa,
 * el veredicto lo da quien mira.
 *
 * Uso:
 *   tsx src/herramientas/fidelidad.ts --local L --generado ID --real ID [--recorte x,y,w,h] \
 *     [--zona nombre:x,y,w,h]… [--veredicto CONSERVA|ALTERA --nota "…"]…
 * Las zonas van en fracciones de la imagen real recortada (0–1).
 */
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { Activo } from '../dominio/activos.js';
import { leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';

const { values } = parseArgs({
  options: {
    local: { type: 'string' },
    generado: { type: 'string' },
    real: { type: 'string' },
    recorte: { type: 'string' },
    zona: { type: 'string', multiple: true, default: [] },
    veredicto: { type: 'string' },
    nota: { type: 'string', multiple: true, default: [] },
  },
});

const ANCHO = 1600;

async function principal(): Promise<void> {
  const { local, generado, real } = values;
  if (!local || !generado || !real) throw new Error('Faltan --local --generado --real');
  const carpetaActivos = join(leerConfig().carpetaDatos, 'locales', local, 'activos');
  const leer = async (id: string) => Activo.parse(JSON.parse(await readFile(join(carpetaActivos, id, 'activo.json'), 'utf8')));
  const [activoGen, activoReal] = await Promise.all([leer(generado), leer(real)]);
  const recorte = values.recorte ? values.recorte.split(',').map(Number) : [0, 0, activoReal.ancho, activoReal.alto];
  const [rx = 0, ry = 0, rw = activoReal.ancho, rh = activoReal.alto] = recorte;
  const alto = Math.round((ANCHO * rh) / rw);

  const rutaReal = join(carpetaActivos, real, activoReal.archivo);
  const rutaGen = join(carpetaActivos, generado, activoGen.archivo);
  const realRgb = await sharp(rutaReal).extract({ left: rx, top: ry, width: rw, height: rh }).resize(ANCHO, alto).removeAlpha().raw().toBuffer();
  const genRgb = await sharp(rutaGen).resize(ANCHO, alto, { fit: "fill" }).removeAlpha().raw().toBuffer();

  // Zona del producto: la máscara de la foto real, ensanchada para incluir antenas y patas que la máscara pierde.
  if (!activoReal.mascara) throw new Error(`${real} no tiene máscara`);
  // sharp admite un solo cambio de tamaño por cadena: la máscara se lleva al tamaño de la foto en un paso y se recorta en otro.
  const mascaraCompleta = await sharp(join(carpetaActivos, real, activoReal.mascara.archivo))
    .resize(activoReal.ancho, activoReal.alto, { fit: 'fill' })
    .extractChannel(0)
    .png()
    .toBuffer();
  const mascaraRecortada = await sharp(mascaraCompleta).extract({ left: rx, top: ry, width: rw, height: rh }).png().toBuffer();
  const zona = await sharp(mascaraRecortada).resize(ANCHO, alto, { fit: 'fill' }).blur(12).threshold(20).extractChannel(0).raw().toBuffer();

  const [gReal, gGen] = await Promise.all([gradiente(realRgb), gradiente(genRgb)]);
  const mejor = mejorDesplazamiento(gReal, gGen, zona, ANCHO, alto, 12);
  const propia = correlacion(gReal, gReal, zona, ANCHO, alto, 0, 0);
  const medidas = { correlacionBordes: redondear(mejor.r), desplazamientoX: mejor.dx, desplazamientoY: mejor.dy, referenciaPropia: redondear(propia) };
  console.log(`${generado} frente a ${real}: correlación de bordes ${medidas.correlacionBordes} (desplazamiento ${mejor.dx}, ${mejor.dy} px a ${ANCHO} px)`);

  // Hoja: imagen completa y zonas ampliadas, real a la izquierda y generada a la derecha.
  const zonas = values.zona.length > 0 ? values.zona : ['todo:0,0,1,1'];
  const filas: Buffer[] = [];
  const anchoCelda = 800;
  for (const definicion of zonas) {
    const [nombre = 'zona', caja = '0,0,1,1'] = definicion.split(':');
    const [fx = 0, fy = 0, fw = 1, fh = 1] = caja.split(',').map(Number);
    const area = { left: Math.round(fx * ANCHO), top: Math.round(fy * alto), width: Math.round(fw * ANCHO), height: Math.round(fh * alto) };
    const altoCelda = Math.round((anchoCelda * area.height) / area.width);
    const celda = (rgb: Buffer) => sharp(rgb, { raw: { width: ANCHO, height: alto, channels: 3 } }).extract(area).resize(anchoCelda, altoCelda).png().toBuffer();
    const [a, b] = await Promise.all([celda(realRgb), celda(genRgb)]);
    const rotulo = Buffer.from(
      `<svg width="${anchoCelda * 2 + 12}" height="34"><rect width="100%" height="100%" fill="#111"/><text x="10" y="24" font-family="Helvetica" font-size="20" fill="#eee">${nombre} · real | ${generado}</text></svg>`,
    );
    filas.push(
      await sharp({ create: { width: anchoCelda * 2 + 12, height: altoCelda + 34, channels: 3, background: '#111' } })
        .composite([{ input: rotulo, top: 0, left: 0 }, { input: a, top: 34, left: 0 }, { input: b, top: 34, left: anchoCelda + 12 }])
        .png()
        .toBuffer(),
    );
  }
  const metas = await Promise.all(filas.map((f) => sharp(f).metadata()));
  const altoHoja = metas.reduce((suma, m) => suma + (m.height ?? 0) + 12, 0);
  let y = 0;
  const capas = filas.map((f, i) => {
    const capa = { input: f, top: y, left: 0 };
    y += (metas[i]?.height ?? 0) + 12;
    return capa;
  });
  const salida = join(carpetaActivos, generado, 'fidelidad');
  await mkdir(salida, { recursive: true });
  await sharp({ create: { width: anchoCelda * 2 + 12, height: altoHoja, channels: 3, background: '#000' } }).composite(capas).jpeg({ quality: 88 }).toFile(join(salida, `hoja-${real}.jpg`));
  console.log(`Hoja: ${join(salida, `hoja-${real}.jpg`)}`);

  if (values.veredicto) {
    if (values.veredicto !== 'CONSERVA' && values.veredicto !== 'ALTERA') throw new Error('--veredicto es CONSERVA o ALTERA');
    const actualizado = Activo.parse({
      ...activoGen,
      // Solo pasa a publicable si conserva el producto; si lo altera, queda para pruebas de composición.
      uso: values.veredicto === 'CONSERVA' ? 'PUBLICABLE' : 'SOLO_PRUEBA_COMPOSICION',
      fidelidad: {
        frente: real,
        veredicto: values.veredicto,
        metodo: 'correlación de bordes en la zona del producto (±12 px) + revisión visual de recortes ampliados',
        medidas,
        notas: values.nota,
        revisadoEn: new Date().toISOString(),
      },
    });
    await escribirJson(join(carpetaActivos, generado, 'activo.json'), actualizado);
    console.log(`Veredicto ${values.veredicto} guardado; uso: ${actualizado.uso}`);
  }
}

/** Magnitud del gradiente (Sobel) en escala de grises, como Float32Array. */
async function gradiente(rgb: Buffer): Promise<Float32Array> {
  const meta = { raw: { width: ANCHO, height: 0, channels: 3 as const } };
  const alto = rgb.length / 3 / ANCHO;
  meta.raw.height = alto;
  const gris = await sharp(rgb, meta).greyscale().raw().toBuffer();
  const salida = new Float32Array(ANCHO * alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ANCHO - 1; x++) {
      const p = (dx: number, dy: number) => gris[(y + dy) * ANCHO + (x + dx)] ?? 0;
      const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
      const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
      salida[y * ANCHO + x] = Math.hypot(gx, gy);
    }
  }
  return salida;
}

function correlacion(a: Float32Array, b: Float32Array, zona: Buffer, ancho: number, alto: number, dx: number, dy: number): number {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = 16; y < alto - 16; y += 2) {
    for (let x = 16; x < ancho - 16; x += 2) {
      if ((zona[y * ancho + x] ?? 0) < 128) continue;
      const va = a[y * ancho + x] ?? 0;
      const vb = b[(y + dy) * ancho + (x + dx)] ?? 0;
      n++; sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
    }
  }
  const cov = sab - (sa * sb) / n;
  const den = Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n));
  return den === 0 ? 0 : cov / den;
}

function mejorDesplazamiento(a: Float32Array, b: Float32Array, zona: Buffer, ancho: number, alto: number, radio: number) {
  let mejor = { r: -1, dx: 0, dy: 0 };
  for (let dy = -radio; dy <= radio; dy += 3) {
    for (let dx = -radio; dx <= radio; dx += 3) {
      const r = correlacion(a, b, zona, ancho, alto, dx, dy);
      if (r > mejor.r) mejor = { r, dx, dy };
    }
  }
  // Afina alrededor del mejor.
  const base = { ...mejor };
  for (let dy = base.dy - 2; dy <= base.dy + 2; dy++) {
    for (let dx = base.dx - 2; dx <= base.dx + 2; dx++) {
      const r = correlacion(a, b, zona, ancho, alto, dx, dy);
      if (r > mejor.r) mejor = { r, dx, dy };
    }
  }
  return mejor;
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
