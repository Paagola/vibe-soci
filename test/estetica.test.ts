/**
 * Punto 10 · La estética del encargo: una dirección que leen la foto, el diseño, el crítico y el compositor.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { textoEstetica } from '../src/adaptadores/gemini/instruccionesDiseno.js';
import { textoFotoNueva } from '../src/adaptadores/gemini/instruccionesFoto.js';
import { choqueConFamilia, ESTETICAS, Estetica, esteticaDeFamilia, frasePrompt } from '../src/dominio/diseno/estetica.js';
import { problemasDeOficio, type MedidasDeOficio } from '../src/dominio/diseno/oficio.js';
import { montarPromptFotoNueva } from '../src/dominio/fotoNueva.js';

describe('Punto 10 · catálogo de estéticas', () => {
  it('cada familia F1–F10 tiene su estética, y cada estética sale de familias reales', () => {
    const familias = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'] as const;
    for (const f of familias) assert.ok(ESTETICAS[esteticaDeFamilia(f)].familias.includes(f), f);
    for (const e of Estetica.options) assert.ok(ESTETICAS[e].familias.length > 0 && ESTETICAS[e].diseno.mecanismos.length > 0, e);
    assert.equal(esteticaDeFamilia('F3'), 'COLOR_POP');
    assert.equal(esteticaDeFamilia('F4'), 'EDITORIAL_OSCURO');
  });

  it('avisa si la estética elegida choca con la familia de la referencia', () => {
    assert.equal(choqueConFamilia('COLOR_POP', 'F3'), undefined);
    assert.match(choqueConFamilia('EDITORIAL_SERENO', 'F3') ?? '', /no es la de la referencia \(familia F3/);
  });

  it('los límites de oficio miden contra la estética: lo que en editorial avisa, en maximalismo cabe', () => {
    const m: MedidasDeOficio = { saltoDeEscala: 3, palabras: 38, niveles: 4, voces: 3, gestos: 2, recursos: 4, aire: 0.3, todoCentrado: false };
    assert.deepEqual(problemasDeOficio(m).map((p) => p.tipo).sort(), ['DENSIDAD', 'GESTOS', 'GESTOS', 'JERARQUIA']);
    assert.deepEqual(problemasDeOficio(m, 'FEED_3_4', ESTETICAS.MAXIMALISMO.diseno.limites), []);
  });

  it('la foto: la frase de la estética va en el prompt y el director de foto la conoce', () => {
    const huecos = { plato: 'a sushi board', origen: 'from a restaurant', elementos: 'four nigiri', recuento: 'Exactly four nigiri.', camara: { anguloGrados: 40, descripcion: 'a high three-quarter view', objetivoMm: 50, apertura: 8 }, ideaGrafica: 'the board low, clean space above', luz: 'Bright studio light', colorDominante: 'salmon the only strong colour' };
    const p = montarPromptFotoNueva(huecos, { estetica: 'COLOR_POP' });
    assert.ok(p.includes(frasePrompt('COLOR_POP')));
    assert.match(p, /clean, plain, uniform background/);
    assert.notEqual(montarPromptFotoNueva(huecos, { estetica: 'EDITORIAL_OSCURO' }), p, 'otra estética, otra foto');
    assert.match(textoFotoNueva({ plato: 'sushi', archivo: 'x.jpg', ancho: 1000, alto: 1000, alGenerador: { estetica: 'COLOR_POP' } }), /Estética del post: Color pop con recorte/);
  });

  it('el diseño: el director recibe los mecanismos, el color y los límites de la estética', () => {
    const t = textoEstetica('COLOR_POP');
    assert.match(t, /PLATO_SOBRE_COLOR/);
    assert.match(t, /salto de escala ≥ 3.5/);
  });
});
