/**
 * La dominante amarilla de las fotos generadas (Torre de Vega, 23/11): se mide en los blancos, se neutraliza si es
 * moderada y se repite la foto si es excesiva. Y los prompts no piden la luz cálida que la provoca.
 */
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { juzgarDominante, medirDominante, neutralizarDominante } from '../src/adaptadores/imagen/dominante.js';
import { promptFinal, sinLuzCalida } from '../src/aplicacion/arte/pieza.js';

/** Una «foto»: un plato blanco (con la dominante dada) sobre madera. */
async function foto(ruta: string, blanco: [number, number, number]) {
  const plato = await sharp({ create: { width: 60, height: 60, channels: 3, background: { r: blanco[0], g: blanco[1], b: blanco[2] } } }).png().toBuffer();
  await sharp({ create: { width: 200, height: 260, channels: 3, background: { r: 120, g: 80, b: 50 } } }).composite([{ input: plato, left: 70, top: 100 }]).png().toFile(ruta);
}

describe('dominante amarilla', () => {
  it('mide los blancos: neutra, corregible o excesiva', async () => {
    const d = await mkdtemp(join(tmpdir(), 'dom-'));
    for (const [nombre, blanco, juicio] of [
      ['neutra', [236, 234, 228], 'NEUTRA'],
      ['crema', [250, 232, 190], 'CORREGIBLE'],
      ['naranja', [245, 190, 120], 'EXCESIVA'],
    ] as const) {
      await foto(join(d, `${nombre}.png`), [...blanco]);
      assert.equal(juzgarDominante(await medirDominante(join(d, `${nombre}.png`))), juicio, nombre);
    }
  });

  it('neutraliza una dominante moderada (los blancos vuelven a ser blancos) y deja en paz una foto neutra', async () => {
    const d = await mkdtemp(join(tmpdir(), 'dom-'));
    await foto(join(d, 'crema.png'), [250, 232, 190]);
    const r = await neutralizarDominante(join(d, 'crema.png'));
    assert.ok(r && r.antes >= 55 && r.antes <= 62 && r.despues <= 15, JSON.stringify(r));
    assert.equal(juzgarDominante(await medirDominante(join(d, 'crema.png'))), 'NEUTRA');
    await foto(join(d, 'neutra.png'), [236, 234, 228]);
    assert.equal(await neutralizarDominante(join(d, 'neutra.png')), undefined);
  });

  it('los prompts no piden luz cálida (pero respetan el dorado de la comida) y piden blancos neutros', () => {
    const p = 'Warm editorial photo, warm golden ambient dining light, warm amber side light, golden-brown crust, golden hour glow.';
    const limpio = sinLuzCalida(p);
    assert.doesNotMatch(limpio, /\bwarm\b|\bamber\b|golden(?!-brown)/i);
    assert.match(limpio, /golden-brown crust/);
    assert.match(limpio, /soft daylight/);
    const final = promptFinal({ tipo: 'plato', prompt: `${p} ${'x '.repeat(30)}`, conPlato: true }, { nombre: 'Torre de Vega', ciudad: 'La Alquería', descripcion: 'Asador' });
    assert.match(final, /Neutral daylight white balance/);
    assert.match(final, /No yellow, orange, amber or golden colour cast/);
  });
});
