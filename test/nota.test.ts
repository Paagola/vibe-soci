/**
 * F3.3: la nota del dueño manda sobre cómo se llama cada cosa (el «papel de arroz» del detalle 2 de Sushita v003).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decidirSalida } from '../src/dominio/comprobacionSalida.js';
import { conMayuscula, contradiccionesConLaNota, segmentoDelElemento, segmentosDeLaNota } from '../src/dominio/nota.js';
import { textoChecklist } from '../src/adaptadores/gemini/RevisorVisualGemini.js';

const NOTA = 'Tabla de sushi para compartir: nigiri de salmón con foie y trufa, gunkan de toro y maki de atún picante';

describe('F3.3 · la nota del dueño y los elementos', () => {
  it('parte la nota en sus platos sin romper «foie y trufa»', () => {
    assert.deepEqual(segmentosDeLaNota(NOTA), ['nigiri de salmón con foie y trufa', 'gunkan de toro', 'maki de atún picante']);
  });

  it('el caso de Sushita: «rollitos de papel de arroz con tartar de toro» contradice «gunkan de toro»; el nigiri no', () => {
    const problemas = contradiccionesConLaNota(NOTA, [
      { nombre: 'nigiri de salmón flameado con foie y trufa', estado: 'salmón marcado con soplete' },
      { nombre: 'rollitos de papel de arroz con tartar de toro', estado: 'envueltos en papel de arroz traslúcido, coronados con tartar' },
      { nombre: 'uramaki con cobertura de salsa cremosa verde', estado: 'bañados en salsa' },
    ]);
    assert.equal(problemas.length, 1);
    assert.match(problemas[0]!, /gunkan de toro/);
    // Corregido como lo llama el dueño, ya no.
    assert.deepEqual(contradiccionesConLaNota(NOTA, [{ nombre: 'gunkan de toro', estado: 'tartar de toro picado encima, con sésamo y brotes' }]), []);
  });

  it('el título de un detalle sale de la nota cuando la nota nombra el elemento', () => {
    assert.equal(segmentoDelElemento(NOTA, 'nigiri de salmón flameado con foie y trufa'), 'nigiri de salmón con foie y trufa');
    assert.equal(segmentoDelElemento(NOTA, 'uramaki con cobertura de salsa cremosa verde'), undefined);
    assert.equal(conMayuscula('nigiri de salmón'), 'Nigiri de salmón');
  });

  it('la comprobación de una foto pregunta por los cambios frente a la foto real (manda la foto, no la lista) y los descarta', () => {
    assert.match(textoChecklist('dos rollitos'), /"cambiados".*MANDA LA IMAGEN 1/s);
    const d = decidirSalida({ elementos: [{ nombre: 'rollitos', esperado: 2, visto: 2, presente: true, nota: '' }], anatomia: [], anadidos: [], textoNuevo: [], cambiados: ['rollitos: envueltos en papel de arroz; en la foto real son de arroz'], copiadoDeReferencia: [], seguro: true });
    assert.equal(d.final, 'DESCARTA');
    assert.match(d.motivos.join(), /cambiado respecto a la foto real/);
  });
});
