import assert from 'node:assert/strict';
import { join } from 'node:path';
import { it } from 'node:test';
import sharp from 'sharp';
import { exigirTomaNueva } from '../src/adaptadores/imagen/copiaDeReferencia.js';
import { RAIZ } from '../src/config.js';

const cruffin = join(RAIZ, 'referencias-pinterest/seleccion-profesional/02-lune-cruffin-arandano-enebro');
const bandeja = join(cruffin, '01-2024-02-02-bandeja.jpg');
const corte = join(cruffin, '02-2024-02-05-corte.jpg');

it('detecta la fotografía tras recompresión, espejo, giro, exposición y recorte centrado para el feed', async () => {
  const base = await sharp(bandeja).autoOrient().resize(840, 560, { fit: 'cover' }).png().toBuffer();
  const reescalada = await sharp(base).resize(540).jpeg({ quality: 65 }).toBuffer();
  const espejo = await sharp(base).flop().modulate({ brightness: 1.08 }).jpeg().toBuffer();
  const giro = await sharp(base).rotate(90).jpeg().toBuffer();
  const tresCuatro = await sharp(base).resize(300, 400, { fit: 'cover', position: 'centre' }).jpeg({ quality: 75 }).toBuffer();
  const cuatroCinco = await sharp(base).resize(320, 400, { fit: 'cover', position: 'centre' }).linear(0.92, 12).jpeg().toBuffer();
  const zoom = await sharp(base).extract({ left: 84, top: 56, width: 672, height: 448 }).resize(600).jpeg().toBuffer();
  const cropConZoom = await sharp(base).extract({ left: 252, top: 56, width: 336, height: 448 }).resize(300).jpeg().toBuffer();
  const giroExif = await sharp(base).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  for (const [nombre, imagen] of Object.entries({ reescalada, espejo, giro, giroExif, tresCuatro, cuatroCinco, zoom, cropConZoom })) {
    await assert.rejects(exigirTomaNueva(imagen, [base]), /reproduce una referencia/, nombre);
  }
});

it('permite una toma diferente del mismo producto y colores planos próximos con píxeles distintos', async () => {
  await exigirTomaNueva(corte, [bandeja]);
  const plano = (color: string) => sharp({ create: { width: 160, height: 200, channels: 3, background: color } }).png().toBuffer();
  const gris = await plano('#787878');
  await exigirTomaNueva(await plano('#797879'), [gris]);
  await assert.rejects(exigirTomaNueva(gris, [gris]), /reproduce una referencia/);
});
