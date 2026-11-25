import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { agentesGemini, agentesSimulados } from '../src/aplicacion/agencia/agentes.js';
import { problemasDeCalendario, SolicitudCampana, type ContextoCampana } from '../src/dominio/campana.js';
import type { ClienteGemini } from '../src/adaptadores/gemini/ClienteGemini.js';

const contexto: ContextoCampana = {
  nombreLocal: 'Casa Pilar', voz: 'cercana y directa', hechos: { nombre: 'Casa Pilar', carta: 'Gamba roja de Palamós a la plancha.' },
  solicitud: { objetivo: 'Que más vecinos nos conozcan', inicio: '2027-01-01', semanas: 2 }, historial: [],
};

function cliente(...respuestas: unknown[]): Pick<ClienteGemini, 'generarJson'> {
  return {
    async generarJson<T>(_i: string, _p: unknown, esquema: z.ZodType<T>): Promise<T> {
      assert.ok(respuestas.length, 'Llamada adicional imprevista');
      return esquema.parse(respuestas.shift());
    },
  };
}

test('la agenda simulada cubre cada semana con hechos propios, fechas reales y guion completo', async () => {
  const plan = await agentesSimulados().planificar(contexto);
  assert.equal(plan.piezas.length, 4);
  assert.deepEqual(problemasDeCalendario(plan, contexto), []);
  assert.ok(plan.piezas.some(p => p.formato === 'carrusel' && p.guion.length === p.laminas));
  assert.ok(plan.piezas.every(p => p.texto.includes(p.llamada) && Object.hasOwn(contexto.hechos, p.fuente)));
  assert.deepEqual(plan, await agentesSimulados().planificar(contexto));
  assert.equal(SolicitudCampana.safeParse({ ...contexto.solicitud, inicio: '2027-02-29' }).success, false);
  assert.equal(SolicitudCampana.safeParse({ ...contexto.solicitud, inicio: '2028-02-29' }).success, true);
  await assert.rejects(agentesSimulados().planificar({ ...contexto, hechos: {} }), /dato confirmado/);
});

test('el calendario rechaza días repetidos, fuente heredada, semanas vacías y formatos incoherentes', async () => {
  const plan = await agentesSimulados().planificar(contexto);
  const pieza = plan.piezas[0]!;
  const problemas = problemasDeCalendario({ ...plan, piezas: [pieza, { ...pieza, formato: 'carrusel', fuente: 'constructor' }, { ...pieza, dia: 15 }] }, contexto);
  assert.ok(problemas.some(p => p.includes('cronológico')));
  assert.ok(problemas.some(p => p.includes('fuentes confirmadas')));
  assert.ok(problemas.some(p => p.includes('fuera')));
  assert.ok(problemas.some(p => p.includes('Semana 2')));
  assert.ok(problemas.some(p => p.includes('tres a seis')));
});

test('Argon vuelve a revisar la edición de Hydrogen y rechaza si persiste el defecto', async () => {
  const plan = await agentesSimulados().planificar(contexto);
  const copias = { piezas: plan.piezas };
  const defecto = { incidencias: ['Sobra una afirmación en la portada.'], cambiarEstrategia: false };
  const aprobada = await agentesGemini(cliente(plan, defecto, { incidencias: [], cambiarEstrategia: false }), cliente(copias, copias)).planificar(contexto);
  assert.deepEqual(aprobada, plan);
  await assert.rejects(agentesGemini(cliente(plan, defecto, defecto), cliente(copias, copias)).planificar(contexto), /pendiente de revisión/);
});

test('la edición conserva el calendario y rechaza precios ajenos a la fuente antes de revisar', async () => {
  const plan = await agentesSimulados().planificar(contexto);
  const primera = plan.piezas[0]!;
  const alteradas = (cambio: object) => ({ piezas: [{ ...primera, ...cambio }, ...plan.piezas.slice(1)] });
  await assert.rejects(agentesGemini(cliente(plan), cliente(alteradas({ dia: 5 }))).planificar(contexto), /días asignados/);
  await assert.rejects(agentesGemini(cliente(plan), cliente(alteradas({ texto: 'Solo 8 €. ' + primera.llamada }))).planificar(contexto), /no consta en su fuente/);
  await assert.rejects(agentesGemini(cliente(plan), cliente(alteradas({ guion: ['Una', 'Otra'] }))).planificar(contexto), /paso por lámina/);
});

test('el dato narrativo abre un carrusel aunque se haya añadido el último a la ficha', async () => {
  const hechos = { 'marca.nombre': 'Casa Pilar', 'marca.ciudad': 'Madrid', 'propietario.dato': 'Los jueves servimos guiso de garbanzos.' };
  const encargo = { ...contexto, hechos, solicitud: { ...contexto.solicitud, semanas: 1 } };
  const plan = await agentesSimulados().planificar(encargo);
  assert.equal(plan.piezas.find(p => p.formato === 'carrusel')?.fuente, 'propietario.dato');
  assert.deepEqual(plan, await agentesSimulados().planificar({ ...encargo, hechos: Object.fromEntries(Object.entries(hechos).reverse()) }));
});

test('una mención o enlace nuevo en la invitación no se admite y el editor conserva la acción acordada', async () => {
  const plan = await agentesSimulados().planificar(contexto);
  const primera = plan.piezas[0]!;
  for (const llamada of ['Pásate por @casapilar', 'Mira ejemplo.com/carta', 'Escribe a @casa2']) {
    const piezas = [{ ...primera, llamada, texto: llamada }, ...plan.piezas.slice(1)];
    await assert.rejects(agentesGemini(cliente({ ...plan, piezas }), cliente({ piezas })).planificar(contexto), /no consta en su fuente/);
  }
  const llamada = 'Comenta lo que quieras saber.';
  const copias = { piezas: [{ ...primera, llamada, texto: llamada }, ...plan.piezas.slice(1)] };
  await assert.rejects(agentesGemini(cliente(plan), cliente(copias)).planificar(contexto), /conserva la llamada/);
});

test('una historia nace de su propósito y conserva ese motivo tras la edición', async () => {
  const ctx = { ...contexto, solicitud: { ...contexto.solicitud, objetivo: 'Recibir preguntas en historias', semanas: 1 } };
  const plan = await agentesSimulados().planificar(ctx);
  const historia = plan.piezas.find(p => p.formato === 'historia');
  assert.ok(plan.fundamento && historia?.motivoFormato);
  assert.equal(historia.laminas, 1);
  const aprobado = await agentesGemini(cliente(plan, { incidencias: [], cambiarEstrategia: false }), cliente({ piezas: plan.piezas })).planificar(ctx);
  assert.deepEqual(aprobado, plan);
});
