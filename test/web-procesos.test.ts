/**
 * GET /api/procesos: el estado de los encargos para el diorama del panel. Solo lectura, en simulado, con un servidor en
 * un puerto aleatorio y carpetas temporales. Comprueba que lo que enseña la escena sale de los datos guardados y del
 * registro de trabajos (paso, intentos, recorrido, propuestas del director de diseño), y que consultar no cambia nada.
 */
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { RAIZ } from '../src/config.js';
import { crearEstudio } from '../src/web/estudio.js';
import { crearApp } from '../src/web/servidor.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');

describe('API web · procesos para el diorama (simulado, solo lectura)', () => {
  let carpeta: string;
  let servidor: Server;
  let base: string;

  const pedir = async (metodo: string, ruta: string, cuerpo?: unknown) => {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: respuesta.status, datos: (await respuesta.json().catch(() => ({}))) as Record<string, any> };
  };
  const esperar = async (trabajo: { id: string }) => {
    for (;;) {
      const { datos } = await pedir('GET', `/api/trabajos/${trabajo.id}`);
      if (datos.trabajo.estado !== 'EN_CURSO') return datos.trabajo;
      await new Promise((r) => setTimeout(r, 30));
    }
  };
  const avanzar = async (proyecto: string, cuerpo: Record<string, unknown> = {}) => {
    const r = await pedir('POST', `/api/encargos/${proyecto}/avanzar`, cuerpo);
    assert.equal(r.status, 202, JSON.stringify(r.datos));
    assert.equal((await esperar(r.datos.trabajo)).estado, 'TERMINADO');
  };
  const procesos = async () => {
    const r = await pedir('GET', '/api/procesos');
    assert.equal(r.status, 200, JSON.stringify(r.datos));
    return r.datos;
  };

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-web-procesos-'));
    const biblioteca = join(carpeta, 'biblioteca');
    await mkdir(join(biblioteca, 'referencias'), { recursive: true });
    await writeFile(join(biblioteca, 'principios.md'), '# Principios de prueba');
    await copyFile(join(RAIZ, 'biblioteca', 'referencias', 'post-30.jpg'), join(biblioteca, 'referencias', 'post-30.jpg'));
    const estudio = crearEstudio(
      {
        geminiModelo: 'x',
        geminiFacturacion: false,
        geminiTopeUsd: 1,
        geminiModeloImagen: 'gemini-3-pro-image',
        hfModelo: 'marketing-studio/image',
        hfResolucion: '2k',
        limiteImagenesDia: 40,
        carpetaDatos: join(carpeta, 'datos'),
        carpetaDatosSimulado: join(carpeta, 'datos-simulado'),
        carpetaBiblioteca: biblioteca,
        zonaHoraria: 'Europe/Madrid',
        productor: false,
      },
      { simuladoAlArrancar: true, carpetaPlantillas: join(RAIZ, 'plantillas') },
    );
    servidor = crearApp(estudio).listen(0, '127.0.0.1');
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise((r) => servidor.close(r));
    await rm(carpeta, { recursive: true, force: true });
  });

  it('sin encargos, la escena queda en reposo: lista vacía', async () => {
    const p = await procesos();
    assert.equal(p.modo, 'SIMULADO');
    assert.deepEqual(p.encargos, []);
  });

  it('sigue un encargo por sus pasos reales, con el rechazo de la foto y el director de diseño, sin escribir nada', async () => {
    assert.equal((await pedir('POST', '/api/locales/ejemplo')).status, 201);
    const subida = (await (await fetch(`${base}/api/subidas`, { method: 'POST', headers: { 'X-Nombre-Archivo': 'gamba.png' }, body: new Uint8Array(await readFile(FOTO)) })).json()) as { subida: { id: string } };
    const abierto = await pedir('POST', '/api/encargos', { subidaId: subida.subida.id, local: 'asador-etxebarri', plato: 'Rodaballo a la parrilla con su pil-pil' });
    const proyecto = abierto.datos.encargo.proyecto as string;
    await esperar(abierto.datos.trabajo);

    // Se para en la referencia: lo dice el paso y el último trabajo terminó bien.
    let e = (await procesos()).encargos[0];
    assert.equal(e.proyecto, proyecto);
    assert.equal(e.paso, 'REFERENCIA');
    assert.equal(e.nombreLocal, 'Asador Etxebarri');
    assert.equal(e.trabajo.estado, 'TERMINADO');
    assert.equal(e.trabajo.error, null);
    assert.equal(e.diseno, null);

    // Consultar no escribe: post.json no cambia entre dos consultas.
    const postJson = join(carpeta, 'datos-simulado', 'proyectos', proyecto, 'post.json');
    const antes = (await stat(postJson)).mtimeMs;
    await procesos();
    await procesos();
    assert.equal((await stat(postJson)).mtimeMs, antes);

    await pedir('PUT', `/api/encargos/${proyecto}/referencia`, { biblioteca: 'post-30' });
    await avanzar(proyecto);
    e = (await procesos()).encargos[0];
    assert.equal(e.paso, 'CONFIRMAR_ELEMENTOS');
    const pasos = e.recorrido.map((r: { paso: string }) => r.paso);
    for (const paso of ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA']) assert.ok(pasos.includes(paso), `el recorrido pasa por ${paso}: ${pasos.join(' ')}`);

    await avanzar(proyecto, { confirmo: 'CONFIRMAR_ELEMENTOS' });
    await avanzar(proyecto, { rechazo: 'La gamba sale demasiado pequeña' });
    e = (await procesos()).encargos[0];
    assert.equal(e.paso, 'CONFIRMAR_FOTO');
    assert.deepEqual(e.intentos.map((i: { final: string }) => i.final), ['RECHAZADA', 'PASA']);
    // El rechazo devolvió la foto al generador: el recorrido vuelve de CONFIRMAR_FOTO a GENERAR.
    const vuelta = e.recorrido.map((r: { paso: string }) => r.paso).join(' ');
    assert.match(vuelta, /CONFIRMAR_FOTO.*GENERAR/);

    await avanzar(proyecto, { confirmo: 'CONFIRMAR_FOTO' });
    e = (await procesos()).encargos[0];
    assert.equal(e.paso, 'HECHO');
    assert.equal(e.fotoElegida, true);
    assert.ok(e.diseno.propuestas >= 1 && e.diseno.propuestas <= 2, JSON.stringify(e.diseno));
    assert.equal(e.diseno.pasa, true);

    // Las imágenes reales del encargo para las estaciones de la oficina: cada ruta sirve una miniatura de verdad.
    const imagenes = [e.imagenes.subida, e.imagenes.referencia, ...e.imagenes.intentos.map((i: { url: string }) => i.url), e.imagenes.mascara, e.imagenes.post];
    assert.equal(imagenes.filter(Boolean).length, 6, JSON.stringify(e.imagenes));
    for (const url of imagenes) {
      const r = await fetch(`${base}${url}`);
      assert.equal(r.status, 200, url);
      assert.match(r.headers.get('content-type') ?? '', /^image\//, url);
    }
    assert.ok(e.recorrido.every((r: { nota: string }) => typeof r.nota === 'string'));
    // El post terminado entra en la exposición de la galería.
    const { galeria } = await procesos();
    assert.deepEqual(galeria.map((g: { proyecto: string }) => g.proyecto), [proyecto]);
  });
});
