/** F3.3 (punto 14) · Huella tipográfica del local y regla de mezcla con la referencia. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { efectosDeLaReferencia, huellaDelLocal, textoDeHuella } from '../src/dominio/diseno/huella.js';
import { Intencion, Tokens } from '../src/dominio/diseno/intencion.js';
import type { FichaReferencia } from '../src/dominio/referencia.js';

const tokens = Tokens.parse({ colores: { negro: '#111111', crema: '#F2F2F2' }, estilos: { titular: { fuente: 'bebas-neue', color: '@crema' }, rotulo: { fuente: 'montserrat', caso: 'mayusculas', tracking: 0.16, color: '@crema' }, acento: { fuente: 'ballet', color: '@crema' } } });
const pieza = (capas: unknown[]) => Intencion.parse({ esquema: 'diseno/intencion@1', id: 'p', titulo: 't', marca: 'local', activos: {}, capas });

describe('F3.3 · huella tipográfica', () => {
  it('cuenta los efectos del local en sus piezas y los de la referencia, y da la regla de mezcla', () => {
    const piezas = [
      pieza([{ id: 'titular', tipo: 'texto', texto: 'ENTRECOT', estilo: 'titular', caja: { x: 0, y: 0, w: 1, h: 0.2 }, sangrado: true }, { id: 'a', tipo: 'texto', texto: 'de Galicia', estilo: 'acento', caja: { x: 0, y: 0, w: 1, h: 0.1 }, giro: -4 }, { id: 'f', tipo: 'texto', texto: 'TORRE', estilo: 'rotulo', caja: { x: 0, y: 0.9, w: 1, h: 0.05 } }]),
      pieza([{ id: 'titular', tipo: 'texto', texto: 'ENSALADA', estilo: 'titular', caja: { x: 0, y: 0, w: 1, h: 0.2 } }]),
    ];
    const h = huellaDelLocal('local', piezas, tokens, (f) => f === 'ballet');
    assert.equal(h.piezas, 2);
    assert.equal(h.efectos.SANGRADO, 1);
    assert.equal(h.efectos.SCRIPT_QUE_CRUZA, 1);
    assert.equal(h.efectos.VERSALITAS_ESPACIADAS, 1);
    assert.equal(h.efectos.MEZCLA_DE_VOCES, 1);
    assert.equal(h.fuentes[0], 'bebas-neue');
    const ref = efectosDeLaReferencia({ mecanismos: ['PALABRA_GIRADA'], tipografia: [{ rol: 'TITULAR', clasificacion: 'pincel de trazo seco' }], tratamiento: ['TINTA'] } as unknown as FichaReferencia);
    assert.deepEqual(ref.sort(), ['GIRO', 'SCRIPT_QUE_CRUZA', 'TINTA_IMPRESA']);
    const t = textoDeHuella(h, ref);
    assert.match(t, /la identidad del local manda/);
    assert.match(t, /titular que sangra \(1 de 2\)/);
    assert.match(t, /candidatos: tinta impresa\)/, 'el giro ya es del local: no es un gesto nuevo');
    assert.match(textoDeHuella(huellaDelLocal('nuevo', [], tokens, () => false), []), /sin piezas anteriores: solo su marca/);
  });
});
