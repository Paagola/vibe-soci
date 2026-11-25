/**
 * Franjas planas en fotos generadas: el modelo de imagen a veces pinta el «aire para el texto» como una franja lisa
 * (Lo Güeno, lote-1). Se detecta por la falta de textura de las filas del borde.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { franjasPlanas } from '../src/adaptadores/imagen/franjas.js';

/** Una foto de 300 × 400 con grano y degradado; con `negroArriba`, esa fracción de arriba en negro liso. */
async function foto(negroArriba = 0, oscura = false): Promise<Buffer> {
  const ancho = 300;
  const alto = 400;
  const rgb = Buffer.alloc(ancho * alto * 3);
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const base = oscura ? 18 + (x / ancho) * 10 : 60 + (y / alto) * 120;
      const v = y < negroArriba * alto ? 4 : Math.round(base + (azar() - 0.5) * 30);
      rgb.fill(Math.max(0, Math.min(255, v)), (y * ancho + x) * 3, (y * ancho + x) * 3 + 3);
    }
  }
  return sharp(rgb, { raw: { width: ancho, height: alto, channels: 3 } }).png().toBuffer();
}

describe('franjas planas de las fotos generadas', () => {
  it('mide la franja negra lisa de arriba', async () => {
    const f = await franjasPlanas(await foto(0.29));
    assert.ok(Math.abs(f.arriba - 0.29) <= 0.02, `arriba ${f.arriba}`);
    assert.equal(f.abajo, 0);
  });

  it('una foto con grano, aunque sea oscura, no tiene franjas', async () => {
    assert.deepEqual(await franjasPlanas(await foto(0)), { arriba: 0, abajo: 0 });
    assert.deepEqual(await franjasPlanas(await foto(0, true)), { arriba: 0, abajo: 0 });
  });
});
