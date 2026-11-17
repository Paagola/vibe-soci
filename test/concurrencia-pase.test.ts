import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pausa } from 'node:timers/promises';
import { it } from 'node:test';
import { leerConfig, RAIZ } from '../src/config.js';
import { crearEstudio } from '../src/web/estudio.js';
import { crearApp } from '../src/web/servidor.js';

function senal() {
  let resolver!: () => void;
  const promise = new Promise<void>((r) => { resolver = r; });
  return { promise, resolve: resolver };
}

it('el cierre del navegador no permite aprobar mientras se guarda una corrección de la comanda', { timeout: 20_000 }, async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'pase-concurrencia-'));
  const config = leerConfig({ ESTUDIO_DATOS: join(carpeta, 'datos'), ESTUDIO_DATOS_SIMULADO: join(carpeta, 'simulado') });
  const estudio = crearEstudio(config, { simuladoAlArrancar: true, carpetaPlantillas: join(RAIZ, 'plantillas') });
  const continuar = senal();
  const iniciada = senal();
  const desconectada = senal();
  const app = crearApp(estudio);
  const servidor = createServer((req, res) => {
    if (req.method === 'PUT' && req.url?.endsWith('/propuesta')) res.once('close', () => desconectada.resolve());
    app(req, res);
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolver) => servidor.once('listening', resolver));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
  const enviar = (metodo: string, ruta: string, datos?: unknown, signal = AbortSignal.timeout(5_000)) => fetch(url + ruta, {
    method: metodo, signal,
    ...(datos === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }),
  });
  const pedir = async (metodo: string, ruta: string, datos?: unknown) => {
    const respuesta = await enviar(metodo, ruta, datos);
    const cuerpo = await respuesta.json();
    assert.ok(respuesta.ok, JSON.stringify(cuerpo));
    return cuerpo;
  };
  async function esperarHasta<T>(leer: () => Promise<T>, cumple: (valor: T) => boolean): Promise<T> {
    for (let intento = 0; intento < 100; intento++) {
      const valor = await leer();
      if (cumple(valor)) return valor;
      await pausa(25);
    }
    throw new Error('El encargo simulado no llegó al estado esperado.');
  }
  const trabajo = (id: string) => esperarHasta(
    async () => (await pedir('GET', `/trabajos/${id}`)).trabajo,
    (t) => t.estado !== 'EN_CURSO',
  );

  try {
    await pedir('POST', '/locales/ejemplo');
    const foto = await readFile(join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png'));
    const subida = await fetch(url + '/subidas', {
      method: 'POST', headers: { 'X-Nombre-Archivo': 'gamba.png' }, body: new Uint8Array(foto),
    });
    assert.ok(subida.ok);
    const { subida: { id } } = await subida.json();
    const nuevo = await pedir('POST', '/encargos', { productorEditorial: true, local: 'asador-etxebarri', plato: 'Gamba a la brasa', subidaId: id });
    assert.equal((await trabajo(nuevo.trabajo.id)).estado, 'TERMINADO');
    const ruta = `/encargos/${nuevo.encargo.proyecto}`;
    await pedir('PUT', ruta + '/referencia', { biblioteca: 'post-30' });
    const avance = await pedir('POST', ruta + '/avanzar', {});
    assert.equal((await trabajo(avance.trabajo.id)).estado, 'TERMINADO');
    const antes = await pedir('GET', ruta);
    assert.equal(antes.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.match(antes.revision, /^[a-f0-9]{64}$/);

    const abrir = estudio.post;
    estudio.post = async (...args) => {
      estudio.post = abrir;
      iniciada.resolve();
      await continuar.promise;
      return abrir(...args);
    };
    const controlador = new AbortController();
    const propuesta = structuredClone(antes.propuesta.contenido);
    propuesta.huecos.luz += ' with a soft reflected fill';
    const edicion = assert.rejects(enviar('PUT', ruta + '/propuesta', { propuesta, revision: antes.revision }, controlador.signal), { name: 'AbortError' });
    await iniciada.promise;
    controlador.abort();
    await edicion;
    await desconectada.promise;

    const accion = { confirmo: 'CONFIRMAR_ELEMENTOS', revision: antes.revision };
    const enParalelo = await enviar('POST', ruta + '/avanzar', accion);
    assert.equal(enParalelo.status, 409);
    assert.equal((await enParalelo.json()).error.code, 'TRABAJO_EN_CURSO');

    continuar.resolve();
    const vigente = await esperarHasta(() => pedir('GET', ruta), (c) => c.revision !== antes.revision);
    assert.equal(vigente.propuesta.contenido.huecos.luz, propuesta.huecos.luz);
    const obsoleta = await esperarHasta(async () => {
      const respuesta = await enviar('POST', ruta + '/avanzar', accion);
      return { status: respuesta.status, codigo: (await respuesta.json()).error?.code };
    }, (r) => r.codigo !== 'TRABAJO_EN_CURSO');
    assert.equal(obsoleta.status, 409);
    assert.equal(obsoleta.codigo, 'REVISION_OBSOLETA');
    assert.equal((await pedir('GET', ruta)).intentos.length, 0);
  } finally {
    continuar.resolve();
    servidor.closeAllConnections();
    await new Promise<void>((resolver) => servidor.close(() => resolver()));
    await rm(carpeta, { recursive: true, force: true });
  }
});
