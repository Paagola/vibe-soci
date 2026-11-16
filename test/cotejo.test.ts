/**
 * Productor (fase 1): huella del inventario, cotejo determinista y esquema de la bitácora.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ElementoComparable, huellaDelInventario, normalizarTexto, textoDelInventario } from '../src/dominio/inventario.js';
import { cotejarPropuestaFoto, cotejarTextos, diferenciaDeInventario, listaConInventario } from '../src/dominio/cotejo.js';
import { EntradaBitacora, nuevaEntrada } from '../src/dominio/bitacora.js';

const NOTA = 'Tabla de sushi: nigiris de salmón, gunkan de toro y uramaki de atún';
const INV: ElementoComparable[] = [
  { nombre: 'nigiri de salmón', estado: 'salmón sobre arroz', recuento: 4 },
  { nombre: 'gunkan de toro', estado: 'tartar de toro sobre arroz envuelto en alga', recuento: 2 },
];
const HUELLA = huellaDelInventario(INV);

describe('Productor · huella del inventario', () => {
  it('no cambia con el orden, las tildes ni las mayúsculas; sí con un recuento o cortados', () => {
    const invertido = [INV[1]!, INV[0]!];
    const sinTildes: ElementoComparable[] = [
      { nombre: 'NIGIRI DE SALMON', estado: 'Salmon sobre arroz', recuento: 4 },
      { nombre: 'Gunkan de toro', estado: 'tartar de toro sobre arroz envuelto en alga', recuento: 2 },
    ];
    assert.equal(huellaDelInventario(invertido), HUELLA);
    assert.equal(huellaDelInventario(sinTildes), HUELLA);
    assert.notEqual(huellaDelInventario([INV[0]!, { ...INV[1]!, recuento: 3 }]), HUELLA);
    assert.notEqual(huellaDelInventario([INV[0]!, { ...INV[1]!, cortados: 1 }]), HUELLA);
    assert.equal(normalizarTexto('  Rollitos   DE Papel  '), 'rollitos de papel');
  });

  it('textoDelInventario sigue el formato de la especificación', () => {
    assert.equal(
      textoDelInventario([{ nombre: 'gunkan de toro', estado: 'sobre arroz', recuento: 2, cortados: 1 }, { nombre: 'salsa', estado: 'por encima', recuento: null }]),
      'gunkan de toro (sobre arroz) ×2 (+1 cortado); salsa (por encima)',
    );
  });
});

describe('Productor · diferencia de inventario', () => {
  it('detecta un añadido, un quitado y un cambio de recuento', () => {
    const propuesto: ElementoComparable[] = [
      { nombre: 'nigiri de salmón', estado: 'salmón sobre arroz', recuento: 6 },
      { nombre: 'uramaki de atún', estado: 'entero', recuento: 1 },
    ];
    const d = diferenciaDeInventario(INV, propuesto);
    assert.deepEqual(d.anadidos, ['uramaki de atún']);
    assert.deepEqual(d.quitados, ['gunkan de toro']);
    assert.deepEqual(d.cambiados, ['nigiri de salmón: «salmon sobre arroz» ×4 → «salmon sobre arroz» ×6']);
  });
});

describe('Productor · caso rollitos (propuesta de foto)', () => {
  const rollitos: ElementoComparable[] = [
    INV[0]!,
    { nombre: 'rollitos de papel de arroz con tartar de toro', estado: 'enteros', recuento: 2 },
  ];

  it('CONFIRMADO: cambio de inventario y contradicción con la nota', () => {
    const problemas = cotejarPropuestaFoto({ estado: 'CONFIRMADO', elementos: INV, huella: HUELLA }, NOTA, { elementos: rollitos, tomas: [] });
    assert.ok(problemas.some((p) => p.startsWith('La propuesta de foto cambia el inventario') && p.includes('añadidos') && p.includes('quitados')), problemas.join('\n'));
    assert.ok(problemas.some((p) => p.includes('contradice la nota del dueño')), problemas.join('\n'));
  });

  it('PROPUESTO: sin problema de inventario, pero sí la contradicción con la nota', () => {
    const problemas = cotejarPropuestaFoto({ estado: 'PROPUESTO', elementos: INV, huella: HUELLA }, NOTA, { elementos: rollitos, tomas: [] });
    assert.equal(problemas.some((p) => p.includes('cambia el inventario')), false);
    assert.ok(problemas.some((p) => p.includes('contradice la nota del dueño')), problemas.join('\n'));
  });

  it('tomas: una del inventario pasa; una ajena genera «La toma de detalle»', () => {
    const identica = { elementos: INV, tomas: ['gunkan de toro'] };
    assert.deepEqual(cotejarPropuestaFoto({ estado: 'CONFIRMADO', elementos: INV, huella: HUELLA }, NOTA, identica), []);
    const ajena = cotejarPropuestaFoto({ estado: 'CONFIRMADO', elementos: INV, huella: HUELLA }, NOTA, { elementos: INV, tomas: ['rollito de papel de arroz'] });
    assert.equal(ajena.length, 1);
    assert.ok(ajena[0]!.startsWith('La toma de detalle'));
  });
});

describe('Productor · cotejo de textos', () => {
  it('«Rollitos de papel de arroz» se marca; «Gunkan de toro» no', () => {
    const malos = cotejarTextos(['Rollitos de papel de arroz'], { nota: NOTA, elementos: INV });
    assert.ok(malos.some((p) => p.includes('papel de arroz') || p.includes('rollito')), malos.join('\n'));
    assert.deepEqual(cotejarTextos(['Gunkan de toro'], { nota: NOTA, elementos: INV }), []);
  });

  it('precio: sin constar en la nota se marca; con la cifra en la nota no', () => {
    const sinConstar = cotejarTextos(['Tabla a 12,50 €'], { nota: NOTA, elementos: INV });
    assert.ok(sinConstar.some((p) => p.includes('lleva un precio')), sinConstar.join('\n'));
    assert.deepEqual(cotejarTextos(['Tabla a 12,50 €'], { nota: `${NOTA}, 12,50`, elementos: INV }), []);
  });

  it('afirmación comercial: se marca salvo que conste en la marca', () => {
    const sinMarca = cotejarTextos(['Premiado en 2025'], { nota: NOTA, elementos: INV });
    assert.equal(sinMarca.length, 1);
    assert.deepEqual(cotejarTextos(['Premiado en 2025'], { nota: NOTA, elementos: INV, marca: 'Restaurante premiado' }), []);
  });
});

describe('Productor · lista con inventario', () => {
  it('añade el inventario confirmado debajo de la lista', () => {
    const texto = listaConInventario('x', INV);
    assert.ok(texto.includes('INVENTARIO CONFIRMADO POR EL DUEÑO'));
    assert.ok(texto.includes('gunkan de toro'));
  });
});

describe('Productor · bitácora', () => {
  const base = { quien: 'usuario', paso: 'CONFIRMAR_ELEMENTOS', tipo: 'CONFIRMACION', texto: 'ok' } as const;

  it('rechaza una clave extra', () => {
    assert.throws(() => EntradaBitacora.parse({ ...base, fecha: '2026-11-16T10:00:00.000Z', extra: 1 }));
  });

  it('nuevaEntrada pone la fecha dada', () => {
    const e = nuevaEntrada({ ...base }, '2026-11-16T10:00:00.000Z');
    assert.equal(e.fecha, '2026-11-16T10:00:00.000Z');
  });
});
