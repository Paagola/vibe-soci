import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Agencia, PedidoAgencia } from '../src/aplicacion/agencia/servicio.js';
import { agentesSimulados } from '../src/aplicacion/agencia/agentes.js';
import { Marca } from '../src/dominio/modelos.js';
import type { ContextoCampana } from '../src/dominio/campana.js';
import { RAIZ, leerConfig } from '../src/config.js';
import { crearEstudio } from '../src/web/estudio.js';
import { crearApp } from '../src/web/servidor.js';

const marca = Marca.parse({ slug: 'la-plaza', nombre: 'La Plaza', ciudad: 'Málaga', tonos: ['cercano'] });
const pedido = PedidoAgencia.parse({ solicitud: { inicio: '2026-11-25', semanas: 1, objetivo: 'Darnos a conocer en el barrio' },
  hecho: 'Esta semana servimos patatas con níscalos.', renovar: true, anticipar: true });

test('la agencia conserva las mediciones y permisos al reiniciar, recupera un fallo y prepara una vez el periodo vigente', async t => {
  const carpeta = await mkdtemp(join(tmpdir(), 'agencia-cartera-'));
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const contextos: ContextoCampana[] = [];
  let fecha = new Date('2026-11-24T23:10:00Z'); // Ya es 25 en Madrid.
  let cae = false;
  const avisos: string[] = [];
  const abiertos: string[] = [];
  const agencia = () => new Agencia({
    carpeta, marca: async () => marca, zonaHoraria: 'Europe/Madrid', ahora: () => fecha,
    agentes: () => ({
      async planificar(ctx) {
        contextos.push(ctx);
        if (cae) throw new Error('Servicio temporalmente ocupado');
        const plan = await agentesSimulados().planificar(ctx);
        plan.piezas[0]!.fuente = 'plato:ejemplo';
        return plan;
      },
    }),
    productor: {
      locales: async () => [{ slug: marca.slug, nombre: marca.nombre, ciudad: marca.ciudad }],
      leer: async () => { throw new Error('Conversación de prueba'); },
      hechosParaCampana: async () => ({ 'plato:ejemplo': 'Tortilla de patatas.' }),
      abrirPiezaDeCampana: async (id, encargo) => {
        assert.equal(encargo.origen, 'ejemplo');
        assert.equal(encargo.evidenciaOrigen, 'Tortilla de patatas.');
        assert.ok(encargo.indicaciones.includes('Objetivo del dueño: ' + pedido.solicitud.objetivo));
        abiertos.push(id);
        return id;
      },
    },
  });
  let app = agencia();
  const id = randomUUID();
  const respuestas = await Promise.all([app.crear(marca.slug, id, pedido), app.crear(marca.slug, id, pedido)]);
  assert.deepEqual(respuestas[0], respuestas[1]);
  assert.equal(contextos.length, 1);
  await assert.rejects(app.crear(marca.slug, id, { ...pedido, hecho: 'Otro dato' }), /otros datos/);
  await Promise.all([app.resultado(marca.slug, id, 0, { valor: 0, nota: 'Llovía' }), app.renovarPendientes(m => avisos.push(m))]);
  assert.equal(abiertos.length, 1);
  app = agencia();
  await app.renovarPendientes(m => avisos.push(m));
  let cartera = await app.listar(marca.slug);
  assert.equal(cartera.campanas[0]?.piezas[0]?.resultado?.valor, 0);
  assert.equal(cartera.campanas[0]?.piezas[0]?.conversacion, abiertos[0]);
  assert.equal(cartera.renovacion?.proxima, '2026-12-02');
  assert.equal(abiertos.length, 1);
  fecha = new Date('2026-12-13T23:15:00Z');
  cae = true;
  await app.renovarPendientes(m => avisos.push(m));
  assert.match((await app.listar(marca.slug)).renovacion?.error ?? '', /ocupado/);
  await app.renovarPendientes(m => avisos.push(m));
  assert.equal(avisos.length, 1);
  cae = false;
  fecha = new Date(+fecha + 3600001);
  await Promise.all([app.renovarPendientes(m => avisos.push(m)), app.renovarPendientes(m => avisos.push(m))]);
  cartera = await app.listar(marca.slug);
  assert.equal(cartera.campanas.length, 2);
  assert.equal(cartera.campanas[0]!.solicitud.inicio, '2026-12-14');
  assert.equal(cartera.renovacion?.proxima, '2026-12-21');
  assert.equal(contextos.at(-1)?.hechos['propietario.dato'], undefined);
  assert.ok(contextos.at(-1)?.historial.some(h => h.includes('"valor":0')));
  assert.equal(contextos.length, 3);
  assert.equal(abiertos.length, 2);
  await app.cancelarRenovacion(marca.slug);
  fecha = new Date('2027-01-01T12:00:00Z');
  await app.renovarPendientes(m => avisos.push(m));
  assert.equal((await app.listar(marca.slug)).renovacion, null);
  assert.equal(contextos.length, 3);
});

test('la API sirve el calendario del local, aísla la simulación y rechaza una petición con el modo obsoleto', async t => {
  const carpeta = await mkdtemp(join(tmpdir(), 'api-agencia-'));
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const config = leerConfig({ ESTUDIO_DATOS: join(carpeta, 'real'), ESTUDIO_DATOS_SIMULADO: join(carpeta, 'simulado') });
  const estudio = crearEstudio(config, { simuladoAlArrancar: true, carpetaPlantillas: join(RAIZ, 'plantillas') });
  const server = crearApp(estudio).listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  t.after(() => new Promise<void>((r, reject) => server.close(e => e ? reject(e) : r())));
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const enviar = (metodo: string, ruta: string, datos: unknown) => fetch(base + ruta,
    { method: metodo, headers: { 'Content-Type': 'application/json', 'X-Agencia-Modo': 'simulado' }, body: JSON.stringify(datos) });
  for (const slug of [marca.slug, 'otra']) {
    assert.equal((await enviar('POST', '/api/locales', { marca: { ...marca, slug } })).status, 201);
  }
  const ruta = '/api/agencia/' + marca.slug;
  const clave = randomUUID();
  const crear = { ...pedido.solicitud, hecho: pedido.hecho, renovar: true, clave };
  assert.equal((await enviar('POST', ruta, { ...crear, inicio: '2026-02-31' })).status, 400);
  const respuesta = await enviar('POST', ruta, crear);
  assert.equal(respuesta.status, 200);
  const { campana } = await respuesta.json();
  assert.equal(campana.id, clave);
  assert.equal(campana.piezas[0].fecha, crear.inicio);
  assert.ok(campana.piezas[0].evidencia);
  assert.equal((await enviar('POST', ruta + '/' + clave + '/piezas/0/abrir', {})).status, 400);
  const posicion = '/' + clave + '/piezas/0/resultado';
  assert.equal((await enviar('PUT', ruta + posicion, { valor: -1 })).status, 400);
  assert.equal((await enviar('PUT', ruta + posicion, { valor: 12 })).status, 200);
  assert.equal((await enviar('PUT', '/api/agencia/otra' + posicion, { valor: 4 })).status, 400);
  assert.equal((await (await fetch(base + '/api/agencia/otra')).json()).campanas.length, 0);
  assert.equal((await (await fetch(base + ruta)).json()).campanas[0].piezas[0].resultado.valor, 12);
  assert.equal((await fetch(base + ruta + '/renovacion', { method: 'DELETE' })).status, 200);
  estudio.cambiarModo(false);
  assert.equal((await enviar('POST', ruta, crear)).status, 409);
  assert.deepEqual(await (await fetch(base + '/api/agencia/locales')).json(), { locales: [], simulado: false });
});

test('el siguiente calendario aprende solo de recuentos comparables, también cuando uno es cero', async t => {
  const carpeta = await mkdtemp(join(tmpdir(), 'agencia-aprendizaje-'));
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const agencia = new Agencia({ carpeta, marca: async () => marca, zonaHoraria: 'Europe/Madrid',
    ahora: () => new Date('2026-12-20T12:00:00Z'), agentes: () => ({
      planificar: ctx => agentesSimulados().planificar({ ...ctx, historial: [] }),
    }) });
  const crear = (inicio: string, objetivo = pedido.solicitud.objetivo) => agencia.crear(marca.slug, randomUUID(), {
    ...pedido, renovar: false, solicitud: { ...pedido.solicitud, inicio, objetivo },
  });
  for (const [fecha, valor, semanal] of [['2026-10-01', 0, true], ['2026-10-15', 8, true], ['2026-11-01', 99, false]] as const) {
    const c = await crear(fecha);
    await agencia.resultado(marca.slug, c.id, 0, { valor, nota: '', primerosSieteDias: semanal });
  }
  const otra = await crear('2026-12-01', 'Que vuelvan');
  assert.equal(otra.referenciaSemanal, undefined);
  const siguiente = await crear('2026-12-15');
  assert.equal(siguiente.referenciaSemanal?.muestras, 2);
  assert.equal(siguiente.referenciaSemanal.mediana, 4);
  assert.equal(siguiente.piezas[0]!.metrica, siguiente.referenciaSemanal.metrica);
  assert.deepEqual((await agencia.listar(marca.slug)).campanas[0]!.referenciaSemanal, siguiente.referenciaSemanal);
});
