import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DIFERENCIA_MINIMA_GRADOS, esOtraToma, montarPromptFotoNueva, problemasFotoNueva, type PropuestaFotoNueva, DescripcionFoto, recuentosQueMirar, ROL_DE_LA_REFERENCIA } from '../src/dominio/fotoNueva.js';
import { instruccionesFoto, textoFotoNueva } from '../src/adaptadores/gemini/instruccionesFoto.js';

// Los huecos del prompt de la gamba que gustó: el montaje tiene que dar ese mismo prompt.
const gamba: PropuestaFotoNueva = {
  descripcion: {
    anguloGrados: 45, encuadre: 'plato entero', luz: 'luz de día plana',
    elementos: [{ nombre: 'gamba roja', estado: 'a la brasa, con sal gruesa', recuento: 2 }],
    defectos: ['mancha en el mantel'], utilizable: true, motivo: 'se ven todos los elementos',
  },
  huecos: {
    plato: 'red prawns from Palamós grilled whole',
    origen: 'at a Basque wood-fire grill restaurant',
    elementos: 'two whole deep red prawns lying one over the other with heads, long antennae and legs, shells glistening with coarse salt and light grill marks, the square pale frosted glass plate, the white tablecloth',
    recuento: 'Exactly two prawns, correct anatomy.',
    camara: { anguloGrados: 10, descripcion: 'a near table-level side view at 10 degrees', objetivoMm: 100, apertura: 4 },
    ideaGrafica: 'the two prawn heads large in the lower left, the antennae drawn as fine red lines arching across the dark upper part of the frame, the edge of the frosted glass plate glowing as a thin line of light',
    luz: 'Low-key, one narrow back-side light from the upper right, everything else near black',
    colorDominante: 'red the only strong colour',
  },
  decisiones: ['—'],
};

describe('Plantilla de foto nueva', () => {
  it('monta el prompt con la estructura del de la gamba', () => {
    const p = montarPromptFotoNueva(gamba.huecos);
    assert.ok(p.startsWith('@image1 is a real photo of red prawns from Palamós grilled whole at a Basque wood-fire grill restaurant. Use it only as the list of elements, not as a layout to copy.'));
    assert.match(p, /The new photograph must contain the same real elements: two whole deep red prawns .* the white tablecloth\. Exactly two prawns, correct anatomy\. Nothing else added\./);
    assert.match(p, /New composition by a professional food photographer: a near table-level side view at 10 degrees, 100 mm lens at f\/4, the two prawn heads/);
    assert.match(p, /Low-key, one narrow back-side light from the upper right, everything else near black, red the only strong colour\./);
    assert.ok(p.endsWith('Photographic realism, no text.'));
  });

  it(`la cámara nueva tiene que quedar a más de ${DIFERENCIA_MINIMA_GRADOS}° de la foto subida`, () => {
    assert.deepEqual(problemasFotoNueva(gamba, { ancho: 4043, alto: 2887 }), []);
    const v3 = { ...gamba, huecos: { ...gamba.huecos, camara: { ...gamba.huecos.camara, anguloGrados: 25 } } };
    assert.match(problemasFotoNueva(v3, { ancho: 4043, alto: 2887 })[0] ?? '', /a 20° de la foto subida/);
    const justo = { ...gamba, huecos: { ...gamba.huecos, camara: { ...gamba.huecos.camara, anguloGrados: 75 } } };
    assert.equal(problemasFotoNueva(justo, { ancho: 4043, alto: 2887 }).length, 1, '30° justos no bastan');
  });

  it('otra toma sin subir 30°: dos cambios entre lado, distancia y altura (09/11, caso DAK a 5°)', () => {
    const dak = { ...gamba.descripcion, anguloGrados: 5, distancia: 'MEDIO' as const };
    const base = { anguloGrados: 20, descripcion: 'x', objetivoMm: 100, apertura: 11 };
    assert.equal(esOtraToma(dak, { ...base, giroGrados: 45, distancia: 'PRIMER_PLANO' }).otra, true, 'gira, se acerca y sube 15°');
    assert.equal(esOtraToma(dak, { ...base, anguloGrados: 8, giroGrados: 45, distancia: 'PRIMER_PLANO' }).otra, true, 'gira y se acerca');
    assert.equal(esOtraToma(dak, { ...base, anguloGrados: 8, giroGrados: 45 }).otra, false, 'solo gira: no basta');
    assert.equal(esOtraToma(dak, { ...base, anguloGrados: 15 }).otra, false, 'el intento 1 de DAK (unos 10–15°, mismo lado y distancia)');
    assert.equal(esOtraToma({ ...dak, anguloGrados: 45 }, { ...base, anguloGrados: 85, giroGrados: 90 }).otra, true, 'cenital: basta la altura');
    assert.equal(esOtraToma({ ...dak, anguloGrados: 70 }, { ...base, anguloGrados: 88, giroGrados: 90 }).otra, false, 'cerca del cenital el giro no cuenta');
    const sinDatos = { ...gamba, huecos: { ...gamba.huecos, camara: { ...gamba.huecos.camara, anguloGrados: 35, giroGrados: 90 } } };
    assert.match(problemasFotoNueva(sinDatos, { ancho: 4043, alto: 2887 })[0] ?? '', /No es otra toma.*solo cambia lado/);
  });

  it('una foto pequeña obliga a anotar la resolución en los defectos', () => {
    assert.match(problemasFotoNueva(gamba, { ancho: 382, alto: 510 }).join(), /382 × 510/);
    const anotada = { ...gamba, descripcion: { ...gamba.descripcion, defectos: ['resolución baja: 382 px'] } };
    assert.deepEqual(problemasFotoNueva(anotada, { ancho: 382, alto: 510 }), []);
  });

  it('las instrucciones de foto van aparte de las de diseño y no fijan macro, 10° ni clave baja', () => {
    const guia = { principios: 'P', ejemplos: ['E'], valoraciones: [], referencias: [] };
    const i = instruccionesFoto(guia);
    assert.doesNotMatch(i, /Foto y texto en una sola imagen/);
    assert.match(i, /más de 30°/);
    const t = textoFotoNueva({ plato: 'salmón', archivo: 'fotos/01-plato.jpg', ancho: 1920, alto: 1279 });
    assert.match(t, /Paso 1: describe la foto subida/);
    assert.match(t, /1920 × 1279 px/);
    assert.doesNotMatch(t, /macro (lens|close)|low-key|clave baja|10 degrees/i, 'MACRO solo aparece como una de las distancias posibles');
  });
});

describe('Texto en arco (F10): circulo-texto con arco parcial', async () => {
  const { join } = await import('node:path');
  const { RAIZ } = await import('../src/config.js');
  const { CatalogoTipografico } = await import('../src/adaptadores/compositor/tipografias.js');
  const { MotorTexto } = await import('../src/adaptadores/compositor/MotorTexto.js');
  const motor = new MotorTexto(new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias')));
  const estilo = { fuente: 'work-sans', ejes: { wght: 700 }, tracking: 0.1 };
  const ys = (svg: string) => [...svg.matchAll(/[ML]\s*([-\d.]+)[ ,]([-\d.]+)/g)].map((m) => Number(m[2]));

  it('con arco 180 y giro −90 todas las letras quedan en la mitad de arriba (se leen derechas)', () => {
    const svg = motor.trazarCircular(estilo, 'CAFÉ DE ESPECIALIDAD', 40, 500, 500, 200, -90, 180);
    const y = ys(svg);
    assert.ok(y.length > 20);
    assert.ok(Math.max(...y) < 500 + 45, 'nada baja de la línea del centro (más el alto de una letra)');
  });

  it('sin arco sigue siendo la vuelta entera, como un sello', () => {
    const svg = motor.trazarCircular(estilo, 'CAFÉ DE ESPECIALIDAD', 40, 500, 500, 200, -90);
    assert.ok(Math.max(...ys(svg)) > 650, 'hay letras en la mitad de abajo');
  });
});

describe('F3.2 (punto 5) · recuento: piezas enteras, cortadas por el borde y dudosas', () => {
  it('lo cortado y lo dudoso se dice aparte para que lo mire una persona', () => {
    const d = DescripcionFoto.parse({
      anguloGrados: 30,
      encuadre: 'tabla en ¾',
      luz: 'natural',
      elementos: [
        { nombre: 'rollito de atún', estado: 'con cebollino', recuento: 2, cortados: 1 },
        { nombre: 'rollito blanco con huevas', estado: 'con huevas', recuento: 1, dudoso: true, nota: 'medio tapado por la flor' },
        { nombre: 'nigiri de salmón', estado: 'flambeado', recuento: 4 },
      ],
      defectos: [],
      utilizable: true,
      motivo: 'sirve',
    });
    assert.deepEqual(recuentosQueMirar(d), [
      'rollito de atún: 2 enteros y 1 cortado(s) por el borde',
      'rollito blanco con huevas: 1 enteros (dudoso) · medio tapado por la flor',
    ]);
  });
});

describe('F3.2 (punto 9) · la referencia al generador como @image2, solo de estilo', () => {
  const huecos = {
    plato: 'a sushi board', origen: 'from a Japanese restaurant', elementos: 'four salmon nigiri with foie', recuento: 'Exactly four salmon nigiri.',
    camara: { anguloGrados: 30, descripcion: 'a three-quarter view', objetivoMm: 85, apertura: 8 },
    ideaGrafica: 'the board in the lower half, clean space above', luz: 'Soft window light from the left', colorDominante: 'salmon the only strong colour',
  };
  it('sin opciones, el prompt es el de siempre; con «estiloDeReferencia», lleva el papel de @image2 tal cual', () => {
    assert.doesNotMatch(montarPromptFotoNueva(huecos), /@image2/);
    const p = montarPromptFotoNueva(huecos, { estiloDeReferencia: true });
    assert.ok(p.includes(ROL_DE_LA_REFERENCIA));
    assert.match(p, /Never copy its food, props, text, logos/);
  });
  it('con una referencia F1 o F3 pide un fondo limpio y uniforme para recortar', () => {
    assert.match(montarPromptFotoNueva(huecos, { familia: 'F3' }), /clean, plain, uniform background/);
    assert.doesNotMatch(montarPromptFotoNueva(huecos, { familia: 'F4' }), /uniform background/);
  });
  it('el director de foto sabe que el generador verá la referencia', () => {
    const t = textoFotoNueva({ plato: 'sushi', archivo: 'x.jpg', ancho: 1000, alto: 1000, referencia: { id: 'ref-pin-34', resumen: 'flyer' }, alGenerador: { estiloDeReferencia: true, familia: 'F3' } });
    assert.match(t, /EL GENERADOR TAMBIÉN VERÁ LA REFERENCIA/);
    assert.match(t, /familia F3: el plato irá RECORTADO/);
  });
});
