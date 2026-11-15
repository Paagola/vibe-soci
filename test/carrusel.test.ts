/**
 * F3.3 (punto 11): las diapositivas de detalle del carrusel con su propia foto (dominio puro).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diapositivasDeCarrusel } from '../src/dominio/diseno/carrusel.js';
import type { CapaPropuesta, HechosDeLaPieza, Maqueta } from '../src/dominio/diseno/propuesta.js';

const hechos: HechosDeLaPieza = {
  plato: 'Tabla de sushi',
  elementos: [
    { nombre: 'nigiri de salmón flameado con foie', estado: 'salmón marcado con soplete, con foie', recuento: 4 },
    { nombre: 'uramaki con salsa verde', estado: 'bañados en salsa verde', recuento: 5 },
    { nombre: 'rollitos de tartar de toro', estado: 'en papel de arroz', recuento: 2 },
  ],
  local: { nombre: 'Sushita', ciudad: 'Madrid', descripcion: 'sushi', tonos: [], instagram: 'sushita' },
};
const entorno = {
  colores: [
    { token: 'rojo', hex: '#D7262E' },
    { token: 'crema', hex: '#F4EBDD' },
    { token: 'negro', hex: '#151515' },
  ],
  voces: { titular: 'titular', firma: 'firma', anotacion: 'mano' },
  conDiagonal: true,
};
const portada = (capas: CapaPropuesta[]): Maqueta =>
  ({ idea: 'x', seToma: ['x'], noSeCopia: ['x'], textos: [{ clave: 'titular', texto: 'NIGIRI', fuente: 'ELEMENTO', cita: 'nigiri de salmón flameado con foie' }], capas }) as unknown as Maqueta;
const toma = { papel: 'detalle1', elemento: hechos.elementos[0]! };

describe('F3.3 · detalles del carrusel con su propia foto', () => {
  it('con la portada recortada, la toma va recortada con el mismo filo y el mismo fondo (patrón flojo y papel)', () => {
    const p = portada([
      { tipo: 'fondo', color: '@rojo' },
      { tipo: 'patron', motivo: 'olas', color: '@crema', suave: true },
      { tipo: 'plato', caja: { col: [1, 12], fila: [9, 16] }, ancho: 1, filo: '@crema' },
      { tipo: 'textura', recurso: 'papel', intensidad: 0.1 },
    ] as CapaPropuesta[]);
    const { diapositivas, problemas } = diapositivasDeCarrusel(p, undefined, hechos, entorno, [toma]);
    assert.deepEqual(problemas, []);
    const d = diapositivas[0]!;
    assert.equal(d.id, 'detalle-1');
    const plato = d.maqueta.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }>;
    assert.equal(plato.activo, 'detalle1');
    assert.equal(plato.filo, '@crema');
    assert.ok(d.maqueta.capas.some((c) => c.tipo === 'patron' && c.motivo === 'olas'));
    assert.ok(d.maqueta.capas.some((c) => c.tipo === 'textura'));
    assert.equal(d.maqueta.textos.find((t) => t.clave === 'titular')?.cita, 'nigiri de salmón flameado con foie', 'el título sale del elemento confirmado');
    assert.equal(diapositivas.at(-1)!.id, 'cierre');
  });

  it('con dos tomas, ningún detalle es un recorte de la portada; con una, el recorte completa la serie', () => {
    const p = portada([{ tipo: 'fondo', color: '@rojo' }, { tipo: 'plato', caja: { col: [1, 12], fila: [9, 16] }, ancho: 1 }] as CapaPropuesta[]);
    const conClaves = { ...p, textos: [...p.textos, { clave: 'uramaki', texto: 'Uramaki con salsa verde', fuente: 'ELEMENTO', cita: 'uramaki con salsa verde' }] } as Maqueta;
    const carrusel = { detalles: [{ texto: 'uramaki', punto: { x: 0.4, y: 0.5 } }] };
    const toro = { papel: 'detalle2', elemento: hechos.elementos[2]! };
    const dos = diapositivasDeCarrusel(conClaves, carrusel, hechos, entorno, [toma, toro]);
    const detalles = dos.diapositivas.filter((d) => d.id.startsWith('detalle'));
    assert.equal(detalles.length, 2, 'sin el recorte del uramaki');
    assert.ok(detalles.every((d) => d.maqueta.capas.some((c) => c.tipo === 'plato')));
    const una = diapositivasDeCarrusel(conClaves, carrusel, hechos, entorno, [toma]);
    assert.equal(una.diapositivas.filter((d) => d.id.startsWith('detalle')).length, 2, 'la toma y el recorte del uramaki');
  });

  it('con la portada en foto, la toma va en una banda de foto', () => {
    const p = portada([{ tipo: 'fondo', color: '@rojo' }, { tipo: 'foto', encuadre: 'sangre' }] as CapaPropuesta[]);
    const { diapositivas } = diapositivasDeCarrusel(p, undefined, hechos, entorno, [toma]);
    const foto = diapositivas[0]!.maqueta.capas.find((c) => c.tipo === 'foto') as Extract<CapaPropuesta, { tipo: 'foto' }>;
    assert.equal(foto.activo, 'detalle1');
    assert.ok(!diapositivas[0]!.maqueta.capas.some((c) => c.tipo === 'plato'));
  });
});
