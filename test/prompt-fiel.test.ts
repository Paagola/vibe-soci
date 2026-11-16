import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { explicarBloqueo, motivoLlano } from '../src/dominio/explicaciones.js';
import { montarPromptFotoNueva, PropuestaFotoNueva, problemasFotoNueva, TomaDeDetalle } from '../src/dominio/fotoNueva.js';
import { fraseDelElemento, huecosDeTomaEfectivos, huecosEfectivos, problemasDelInventario, revisarPropuesta } from '../src/dominio/promptFiel.js';

const NOTA = 'Jamón con pata cortado a cuchillo en el jamonero, servido en platos blancos en espiral';
const MARCA = 'Torre de Vega La Alquería Restaurante desde 1980, gran variedad de carnes a la brasa, comida en familia y platos de toda la vida.';

const ELEMENTO_JAMON = {
  nombre: 'Pata de jamón curado en jamonero',
  estado: 'iniciada, corte plano brillante',
  recuento: 1,
  ingles: 'the cured ham leg on its ham stand, freshly cut flat face',
  enEncuadre: true,
};
const ELEMENTO_PLATOS = {
  nombre: 'Platos blancos con lonchas en espiral',
  estado: 'lonchas en espiral',
  recuento: 2,
  ingles: 'white plates with ham slices arranged in a spiral',
  enEncuadre: true,
};

const CAMARA = { anguloGrados: 90, distancia: 'PRIMER_PLANO', descripcion: 'a top-down close view of the ham leg', objetivoMm: 50, apertura: 8, giroGrados: 0 };

/** Propuesta de Torre de Vega; `sobre` cambia lo que haga falta (elementos, plato, origen). */
function propuesta(sobre: { elementos?: unknown[]; plato?: string; origen?: string } = {}): PropuestaFotoNueva {
  return PropuestaFotoNueva.parse({
    descripcion: {
      anguloGrados: 45,
      distancia: 'MEDIO',
      encuadre: 'plato entero',
      luz: 'luz de día plana',
      elementos: sobre.elementos ?? [ELEMENTO_JAMON, ELEMENTO_PLATOS],
      defectos: [],
      utilizable: true,
      motivo: 'se ven todos los elementos',
    },
    huecos: {
      plato: sobre.plato ?? 'cured ham leg, hand-carved on the ham stand',
      origen: sobre.origen ?? 'at a family restaurant',
      elementos: 'the cured ham leg on its ham stand, freshly cut flat face, white plates with ham slices arranged in a spiral',
      recuento: 'Exactly one ham leg and two plates.',
      camara: CAMARA,
      ideaGrafica: 'the ham leg across the frame, plates at the lower right, clean space at the top',
      luz: 'soft window light from the left, warm and even',
      colorDominante: 'warm red-brown of the ham',
    },
    decisiones: ['x'],
  });
}

const LADO_GRANDE = { ancho: 1200, alto: 1200 };
const CONSTANCIA = { nota: NOTA, marca: MARCA };
const sinEnEncuadre = (e: Record<string, unknown>) => {
  const { enEncuadre: _omitido, ...resto } = e;
  return resto;
};

describe('El prompt sale del inventario', () => {
  it('huecosEfectivos: sin opciones devuelve p.huecos; con desdeElInventario, elementos y recuento salen de la lista', () => {
    const p = propuesta();
    assert.equal(huecosEfectivos(p), p.huecos);
    assert.equal(huecosEfectivos(p, {}), p.huecos);

    const h = huecosEfectivos(p, { desdeElInventario: true });
    assert.equal(
      h.elementos,
      'the cured ham leg on its ham stand, freshly cut flat face; white plates with ham slices arranged in a spiral',
    );
    assert.equal(h.recuento, 'Exactly 1 × the cured ham leg on its ham stand, freshly cut flat face; 2 × white plates with ham slices arranged in a spiral.');
  });

  it('recuento sin elementos contables usa la frase fija', () => {
    const p = propuesta({ elementos: [{ ...ELEMENTO_JAMON, recuento: null }] });
    assert.equal(huecosEfectivos(p, { desdeElInventario: true }).recuento, 'Exactly the elements listed above, no more.');
  });

  it('quitar un elemento de la lista lo saca del prompt; añadir uno sin frase pone «Pan, tostado»', () => {
    const o = { desdeElInventario: true };
    const quitado = propuesta({ elementos: [ELEMENTO_JAMON] });
    const prompt = revisarPropuesta(quitado, o, { lado: LADO_GRANDE, ...CONSTANCIA }).prompt;
    assert.ok(!prompt.includes('white plates'));
    assert.ok(prompt.includes('the cured ham leg on its ham stand'));

    const añadido = propuesta({ elementos: [ELEMENTO_JAMON, ELEMENTO_PLATOS, { nombre: 'Pan', estado: 'tostado', recuento: null, enEncuadre: true }] });
    const promptPan = revisarPropuesta(añadido, o, { lado: LADO_GRANDE, ...CONSTANCIA }).prompt;
    assert.ok(promptPan.includes('Pan, tostado'));
  });

  it('huecosDeTomaEfectivos cambia elementos por la frase y deja el recuento de la toma', () => {
    const p = propuesta();
    const t = TomaDeDetalle.parse({ elemento: 'Platos blancos con lonchas en espiral', huecos: { ...p.huecos, elementos: 'lista vieja de la toma', recuento: 'Exactly two plates.' } });
    const h = huecosDeTomaEfectivos(p, t, { desdeElInventario: true });
    assert.equal(h.elementos, 'white plates with ham slices arranged in a spiral');
    assert.equal(h.recuento, 'Exactly two plates.');
    assert.equal(huecosDeTomaEfectivos(p, t), t.huecos);
  });

  it('sin desdeElInventario, revisarPropuesta da el mismo prompt y los mismos problemas de antes', () => {
    const p = propuesta();
    const o = { familia: 'F1' };
    const lado = { ancho: 800, alto: 600 };
    const r = revisarPropuesta(p, o, { lado, ...CONSTANCIA });
    assert.equal(r.prompt, montarPromptFotoNueva(p.huecos, o));
    assert.deepEqual(r.problemas, problemasFotoNueva(p, lado));
    assert.ok(r.problemas.length > 0);
  });

  it('fraseDelElemento usa el inglés recortado o «nombre, estado» si no hay', () => {
    assert.equal(fraseDelElemento({ nombre: 'Pan', estado: 'tostado', ingles: '  toasted bread  ' }), 'toasted bread');
    assert.equal(fraseDelElemento({ nombre: 'Pan', estado: 'tostado' }), 'Pan, tostado');
  });
});

describe('Lo inventado en el prompt se detecta', () => {
  it('acorn-fed, ibérico, bodega, spanish y traditional sin constar en la nota ni en la lista dan problema', () => {
    const p = propuesta({ plato: 'hand-carved acorn-fed ibérico ham', origen: 'at a traditional Spanish bodega' });
    const problemas = problemasDelInventario(p, CONSTANCIA);
    for (const palabra of ['acorn', 'iberic', 'bodega', 'spanish', 'traditional']) {
      assert.ok(problemas.some((m) => m.includes(palabra)), `falta un problema con «${palabra}»`);
    }
  });

  it('un plato y un local sin afirmaciones no dan problemas', () => {
    const p = propuesta({ plato: 'cured ham leg, hand-carved on the ham stand', origen: 'at a family restaurant' });
    assert.deepEqual(problemasDelInventario(p, CONSTANCIA), []);
  });

  it('«grilled» no da problema cuando la marca dice «brasa»', () => {
    const p = propuesta({ plato: 'grilled cured ham leg, hand-carved on the ham stand' });
    assert.ok(!problemasDelInventario(p, CONSTANCIA).some((m) => m.includes('grilled')));
  });
});

describe('Elemento sin frase o fuera del encuadre', () => {
  it('un elemento sin ingles da «no tiene su frase para el prompt»', () => {
    const { ingles: _omitido, ...sinFrase } = ELEMENTO_PLATOS;
    const p = propuesta({ elementos: [ELEMENTO_JAMON, sinFrase] });
    const problemas = problemasDelInventario(p, CONSTANCIA);
    assert.ok(problemas.some((m) => m.includes('Platos blancos con lonchas en espiral') && m.includes('no tiene su frase')));
  });

  it('enEncuadre false da «La toma nueva deja fuera»; si falta, «No consta si»', () => {
    const fuera = propuesta({ elementos: [ELEMENTO_JAMON, { ...ELEMENTO_PLATOS, enEncuadre: false }] });
    const pf = problemasDelInventario(fuera, CONSTANCIA);
    assert.ok(pf.some((m) => m.startsWith('La toma nueva deja fuera «Platos blancos con lonchas en espiral»')));

    const sinDato = propuesta({ elementos: [ELEMENTO_JAMON, sinEnEncuadre(ELEMENTO_PLATOS)] });
    const ps = problemasDelInventario(sinDato, CONSTANCIA);
    assert.ok(ps.some((m) => m.startsWith('No consta si «Platos blancos con lonchas en espiral» entra en la toma nueva')));
  });

  it('ningún problema del inventario lleva «--» ni nombres de fichero', () => {
    const escenarios = [
      propuesta({ plato: 'hand-carved acorn-fed ibérico ham', origen: 'at a traditional Spanish bodega', elementos: [ELEMENTO_JAMON, { ...sinEnEncuadre(ELEMENTO_PLATOS), enEncuadre: false }] }),
      propuesta({ elementos: [ELEMENTO_JAMON, sinEnEncuadre(ELEMENTO_PLATOS)] }),
    ];
    for (const p of escenarios) {
      for (const m of problemasDelInventario(p, CONSTANCIA)) {
        assert.ok(!m.includes('--'), m);
        assert.ok(!/\.(json|jsonl|jpg|png|webp)\b/.test(m), m);
      }
    }
  });
});

describe('Bloqueo explicado en castellano llano', () => {
  const MOTIVOS = [
    'falta: Platos blancos con lonchas en espiral',
    'anatomía por teselas de Platos blancos con lonchas en espiral: 0 cuerpos (se esperan 2)',
  ];

  it('motivoLlano traduce las reglas y deja el resto tal cual', () => {
    assert.equal(motivoLlano('falta: pan'), 'falta «pan» en la foto');
    assert.equal(motivoLlano('texto nuevo: SALE'), 'la foto lleva texto: SALE');
    assert.equal(motivoLlano('otra cosa'), 'otra cosa');
  });

  it('sin bloqueo no hay explicación', () => {
    assert.equal(explicarBloqueo({ intentos: [] }), undefined);
  });

  it('con bloqueo: un solo «falta» en el relato, el coste de los dos intentos y sin comandos', () => {
    const intento = (n: number) => ({ n, activo: 'x', final: 'DESCARTA' as const, motivos: MOTIVOS, costeUsd: 0.161 });
    const e = {
      bloqueo: 'dos descartes seguidos',
      intentos: [intento(1), intento(2)],
      autorizacion: { fecha: 'x', maxIntentos: 2, estimadoPorIntentoUsd: 0.161 },
    };
    const r = explicarBloqueo(e);
    assert.ok(r);
    const falta = 'falta «Platos blancos con lonchas en espiral» en la foto';
    assert.equal(r.queHaPasado.split(falta).length - 1, 1);
    assert.ok(r.queHaPasado.includes('Se han hecho 2 fotos seguidas'));
    assert.ok(r.quePuedesHacer[2]!.includes('≤ 0.32 USD'));
    const todo = [r.queHaPasado, ...r.quePuedesHacer].join(' ');
    assert.ok(!todo.includes('--'));
    assert.ok(!/\.(json|jsonl|jpg|png|webp)\b/.test(todo));
  });
});
