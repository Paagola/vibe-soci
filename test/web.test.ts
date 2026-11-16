/**
 * La API web de punta a punta en modo simulado, con fetch contra un servidor en un puerto aleatorio.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { RAIZ } from '../src/config.js';
import { crearEstudio } from '../src/web/estudio.js';
import { crearApp } from '../src/web/servidor.js';

describe('API web (simulado)', () => {
  let carpeta: string;
  let servidor: Server;
  let base: string;
  let jpeg: Buffer;

  const pedir = async (metodo: string, ruta: string, cuerpo?: unknown) => {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: respuesta.status, datos: (await respuesta.json().catch(() => ({}))) as Record<string, any> };
  };

  const subir = async (nombre: string, bytes: Buffer) => {
    const respuesta = await fetch(`${base}/api/subidas`, { method: 'POST', headers: { 'X-Nombre-Archivo': encodeURIComponent(nombre) }, body: new Uint8Array(bytes) });
    return (await respuesta.json()) as { subida: { id: string } };
  };

  /** Lanza un trabajo y espera a que termine consultando su estado, como el frontend. */
  const esperarTrabajo = async (respuesta: { status: number; datos: Record<string, any> }) => {
    assert.equal(respuesta.status, 202, JSON.stringify(respuesta.datos));
    for (;;) {
      const { datos } = await pedir('GET', `/api/trabajos/${respuesta.datos.trabajo.id}`);
      if (datos.trabajo.estado !== 'EN_CURSO') return datos.trabajo;
      await new Promise((r) => setTimeout(r, 30));
    }
  };

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-web-'));
    const biblioteca = join(carpeta, 'biblioteca');
    await mkdir(biblioteca);
    await writeFile(join(biblioteca, 'principios.md'), '# Principios de prueba');
    jpeg = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#8a2b1b' } }).jpeg().toBuffer();

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

  it('recorre el flujo entero: local → pieza → conceptos → plan → generar → cambio → voto → exportar', async () => {
    assert.equal((await pedir('GET', '/api/estudio')).datos.simulado, true);

    const local = await pedir('POST', '/api/locales', { marca: { slug: 'el-boqueron', nombre: 'Bar El Boquerón Dorado', ciudad: 'Málaga', tonos: ['canalla'] } });
    assert.equal(local.status, 201);

    const { subida } = await subir('plato.jpg', jpeg);
    const creada = await pedir('POST', '/api/piezas', {
      localSlug: 'el-boqueron',
      formato: 'CARRUSEL',
      numDiapositivas: 3,
      idea: 'Boquerones fritos recién hechos para el aperitivo',
      tipo: 'PLATO_ESTRELLA',
      fotos: [{ subidaId: subida.id, papel: 'PLATO', nota: 'boquerones' }],
    });
    assert.equal(creada.status, 201, JSON.stringify(creada.datos));
    const id = creada.datos.pieza.id as string;

    const conceptos = await esperarTrabajo(await pedir('POST', `/api/piezas/${id}/conceptos`));
    assert.equal(conceptos.estado, 'TERMINADO');
    assert.equal((await pedir('GET', `/api/piezas/${id}`)).datos.pieza.conceptos.length, 3);

    const plan = await esperarTrabajo(await pedir('POST', `/api/piezas/${id}/plan`, { concepto: 2 }));
    assert.equal(plan.estado, 'TERMINADO', JSON.stringify(plan.error));

    const presupuesto = await pedir('GET', `/api/piezas/${id}/presupuesto?accion=generar`);
    assert.equal(presupuesto.datos.presupuesto.imagenes, 3);
    assert.equal((await pedir('POST', `/api/piezas/${id}/generar`, {})).datos.error.code, 'CONFIRMACION_NECESARIA');

    const generado = await esperarTrabajo(await pedir('POST', `/api/piezas/${id}/generar`, { confirmado: true }));
    assert.equal(generado.estado, 'TERMINADO');
    assert.deepEqual([generado.hechas, generado.total], [3, 3]);
    assert.equal(generado.quedanSegundos, 0);

    const detalle = (await pedir('GET', `/api/piezas/${id}`)).datos;
    const archivo = detalle.pieza.generaciones[0].archivo as string;
    assert.ok(detalle.pieza.generaciones.every((g: { terminadaEn?: string }) => g.terminadaEn), 'se guarda cuándo terminó cada imagen');
    const imagen = await fetch(`${base}/archivos/piezas/${id}/${archivo}`);
    assert.equal(imagen.status, 200);
    assert.match(imagen.headers.get('content-type') ?? '', /image/);

    const manual = await esperarTrabajo(await pedir('POST', `/api/piezas/${id}/diapositivas/2/corregir`, { comentario: 'Texto más grande', manual: true }));
    assert.equal(manual.estado, 'TERMINADO');
    assert.equal(manual.resultado.generacion.estado, 'PENDIENTE_MANUAL');
    const importada = await pedir('POST', `/api/piezas/${id}/diapositivas/2/importar`, { subidaId: (await subir('a-mano.jpg', jpeg)).subida.id });
    assert.equal(importada.status, 201);

    const voto = await pedir('POST', `/api/piezas/${id}/diapositivas/1/valorar`, { veredicto: 'GUSTA', motivo: 'La palabra detrás del plato funciona' });
    assert.equal(voto.status, 200);

    const exportado = await pedir('POST', `/api/piezas/${id}/exportar`);
    assert.equal(exportado.datos.archivos.length, 3 * 2 + 1, '3 diapositivas a 3:4 y a 4:5, y el pie');
    assert.deepEqual(exportado.datos.sinAprobar, [2, 3]);
    const descarga = await fetch(`${base}${exportado.datos.archivos[0].url}?descargar`);
    assert.match(descarga.headers.get('content-disposition') ?? '', /attachment/);

    const lista = await pedir('GET', '/api/piezas');
    assert.equal(lista.datos.piezas[0].fase, 'LISTA');
  });

  it('carga los ejemplos de plantillas/ con las fotos reales', async () => {
    const post = await pedir('POST', '/api/ejemplos', { plantilla: 'post' });
    assert.equal(post.status, 201, JSON.stringify(post.datos));
    assert.match(post.datos.pieza.id, /gamba/);

    const carrusel = await pedir('POST', '/api/ejemplos', { plantilla: 'carrusel' });
    assert.equal(carrusel.status, 201, JSON.stringify(carrusel.datos));
    const detalle = (await pedir('GET', `/api/piezas/${carrusel.datos.pieza.id}`)).datos;
    assert.deepEqual([detalle.pieza.localSlug, detalle.pieza.numDiapositivas, detalle.pieza.fotos.length], ['cafe-albor', 3, 2]);
  });

  it('responde con el formato de error de la API', async () => {
    const { status, datos } = await pedir('POST', '/api/piezas', { localSlug: 'el-boqueron', formato: 'POST', idea: 'corta', tipo: 'NOVEDAD', fotos: [] });
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(datos.error).sort(), ['code', 'detalles', 'message', 'retryable']);
    assert.equal((await pedir('GET', '/api/no-existe')).status, 404);
  });

  it('no sirve archivos fuera de la carpeta de la pieza', async () => {
    const { datos } = await pedir('GET', '/api/piezas');
    const id = datos.piezas[0].id as string;
    for (const ruta of [`/archivos/piezas/${id}/%2E%2E/%2E%2E/duraciones.json`, `/archivos/piezas/..%2Flocales/marca.json`, `/archivos/piezas/${id}/no-existe.png`]) {
      const respuesta = await fetch(`${base}${ruta}`);
      assert.ok([400, 404].includes(respuesta.status), `${ruta} → ${respuesta.status}`);
    }
  });

  it('rechaza subidas que no son fotos', async () => {
    const respuesta = await fetch(`${base}/api/subidas`, { method: 'POST', headers: { 'X-Nombre-Archivo': 'virus.exe' }, body: 'x' });
    assert.equal(respuesta.status, 400);
  });
});
