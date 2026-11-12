/**
 * Los encargos de la orden única desde la web, de punta a punta en modo simulado: lo mismo que `npm run post`,
 * con sus dos paradas, contra un servidor en un puerto aleatorio y carpetas temporales. Sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { RAIZ } from '../src/config.js';
import { crearEstudio } from '../src/web/estudio.js';
import { crearApp } from '../src/web/servidor.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');

describe('API web · encargos de la orden única (simulado)', () => {
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
  const subir = async (nombre: string, bytes: Buffer) => {
    const respuesta = await fetch(`${base}/api/subidas`, { method: 'POST', headers: { 'X-Nombre-Archivo': encodeURIComponent(nombre) }, body: new Uint8Array(bytes) });
    return ((await respuesta.json()) as { subida: { id: string } }).subida;
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
    const final = await esperar(r.datos.trabajo);
    assert.equal(final.estado, 'TERMINADO', JSON.stringify(final.error));
    return final;
  };
  const detalle = async (proyecto: string) => (await pedir('GET', `/api/encargos/${proyecto}`)).datos;
  const archivo = async (ruta: string) => {
    const r = await fetch(`${base}${ruta}`);
    return { status: r.status, tipo: r.headers.get('content-type') ?? '', bytes: Buffer.from(await r.arrayBuffer()) };
  };

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-web-encargos-'));
    // La biblioteca, con lo mínimo: los principios y la imagen del post que se toma como referencia.
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

  it('de la foto subida al post exportado, con la referencia, las dos paradas y la intención', async () => {
    // El local de la plantilla (solo en simulado) y sus tokens de marca, que están en marcas/.
    assert.equal((await pedir('POST', '/api/locales/ejemplo')).status, 201);
    const { locales } = (await pedir('GET', '/api/locales')).datos;
    assert.deepEqual(locales.map((l: { slug: string; tokens: boolean }) => [l.slug, l.tokens]), [['asador-etxebarri', true]]);

    // Abrir: corre sola hasta la primera parada; sin piezas y sin referencia, la pide.
    const subida = await subir('gamba.png', await readFile(FOTO));
    const abierto = await pedir('POST', '/api/encargos', { subidaId: subida.id, local: 'asador-etxebarri', plato: 'Gamba roja de Palamós a la brasa' });
    assert.equal(abierto.status, 201, JSON.stringify(abierto.datos));
    const proyecto = abierto.datos.encargo.proyecto as string;
    await esperar(abierto.datos.trabajo);
    let d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'REFERENCIA');
    assert.equal(d.fase, 'REFERENCIA');
    assert.ok(d.referencia.biblioteca.length > 0, 'enseña las familias de la biblioteca');
    assert.ok(d.referencia.estado.propuestas.length > 0, 'propone familias para el local');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/subida?lado=320`)).tipo, 'image/jpeg');
    assert.equal((await archivo('/archivos/biblioteca/post-30')).status, 200);

    // Confirmar fuera de paso no confirma nada.
    assert.equal((await pedir('POST', `/api/encargos/${proyecto}/avanzar`, { confirmo: 'CONFIRMAR_FOTO' })).status, 409);

    // Referencia de la biblioteca: se registra con su ficha y se elige.
    const elegida = await pedir('PUT', `/api/encargos/${proyecto}/referencia`, { biblioteca: 'post-30' });
    assert.equal(elegida.status, 200, JSON.stringify(elegida.datos));
    assert.equal(elegida.datos.encargo.referencia, 'ref-post-30');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/referencia?lado=320`)).status, 200);

    // ■ Parada 1: elementos, prompt y gasto.
    await avanzar(proyecto);
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'CONFIRMAR_ELEMENTOS');
    assert.equal(d.propuesta.valida, true);
    assert.ok(d.propuesta.prompt.length > 50);
    assert.equal(d.propuesta.toma.otra, true);
    const { presupuesto } = (await pedir('GET', `/api/encargos/${proyecto}/presupuesto`)).datos;
    assert.equal(presupuesto.disponible, true);
    assert.equal(presupuesto.tope, null, 'en simulado no hay tope que vigilar');

    // Corregir la propuesta a mano (la lista de elementos) y confirmar.
    const corregida = structuredClone(d.propuesta.contenido);
    corregida.descripcion.elementos[0].nombre = 'gamba roja';
    assert.equal((await pedir('PUT', `/api/encargos/${proyecto}/propuesta`, { propuesta: corregida })).status, 200);
    assert.equal((await detalle(proyecto)).propuesta.contenido.descripcion.elementos[0].nombre, 'gamba roja');
    await avanzar(proyecto, { confirmo: 'CONFIRMAR_ELEMENTOS' });

    // ■ Parada 2: la foto nueva, con la comprobación automática; se rechaza una y se confirma la siguiente.
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'CONFIRMAR_FOTO');
    assert.equal(d.intentos.length, 1);
    assert.equal(d.intentos[0].revision.final, 'PASA');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/activos/${d.intentos[0].activo}?lado=640`)).tipo, 'image/jpeg');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/activos/otro-activo`)).status, 404, 'solo los activos del encargo');
    await avanzar(proyecto, { rechazo: 'La gamba sale demasiado pequeña' });
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'CONFIRMAR_FOTO');
    assert.deepEqual(d.intentos.map((i: { final: string }) => i.final), ['RECHAZADA', 'PASA']);
    await avanzar(proyecto, { confirmo: 'CONFIRMAR_FOTO' });

    // Diseño: la orden deja un borrador de intención y se para; vista previa sin guardar; guardar compone.
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'INTENCION');
    assert.equal(d.diseno.intencion.esBorrador, true);
    const intencion = d.diseno.intencion.contenido;
    const vista = await pedir('POST', `/api/encargos/${proyecto}/vista-previa`, { intencion });
    assert.equal(vista.status, 200, JSON.stringify(vista.datos));
    assert.deepEqual(vista.datos.vista.errores, []);
    assert.equal((await archivo(`${vista.datos.vista.base}${vista.datos.vista.diseno}`)).status, 200);

    const guardada = await pedir('PUT', `/api/encargos/${proyecto}/intencion`, { intencion });
    assert.equal(guardada.status, 202, JSON.stringify(guardada.datos));
    assert.equal((await esperar(guardada.datos.trabajo)).estado, 'TERMINADO');

    // Resultado: el post compuesto y exportado a 3:4 y 4:5, que sale como portada en la lista.
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'HECHO');
    assert.equal(d.diseno.vigente, 1);
    const [version] = d.diseno.versiones;
    assert.deepEqual(version.exportadas.map((x: { proporcion: string }) => x.proporcion), ['3:4', '4:5']);
    for (const x of version.exportadas) assert.equal((await archivo(`/archivos/encargos/${proyecto}/disenos/${x.archivo}`)).status, 200);
    const lista = (await pedir('GET', '/api/encargos')).datos.encargos;
    assert.equal(lista[0].proyecto, proyecto);
    assert.equal(lista[0].fase, 'RESULTADO');
    assert.match(lista[0].miniatura, /\/disenos\/.*4x5\.jpg$/);

    // Una versión nueva de un encargo terminado se recompone sin tocar la anterior; la misma versión no se sobrescribe.
    assert.equal((await pedir('PUT', `/api/encargos/${proyecto}/intencion`, { intencion })).status, 202);
    const repetida = await esperar((await pedir('GET', `/api/encargos/${proyecto}`)).datos.trabajo);
    assert.equal(repetida.estado, 'ERROR');
    assert.match(repetida.error.message, /no se sobrescribe/);
    const v2 = await pedir('PUT', `/api/encargos/${proyecto}/intencion`, { intencion: { ...intencion, version: 2 } });
    assert.equal((await esperar(v2.datos.trabajo)).estado, 'TERMINADO');
    assert.deepEqual((await detalle(proyecto)).diseno.versiones.map((v: { version: number }) => v.version), [1, 2]);
  });

  it('el local de ejemplo solo existe en simulado y las rutas no salen de su carpeta', async () => {
    await pedir('PUT', '/api/estudio', { simulado: false });
    try {
      assert.equal((await pedir('POST', '/api/locales/ejemplo')).status, 409);
    } finally {
      await pedir('PUT', '/api/estudio', { simulado: true });
    }
    assert.equal((await archivo('/archivos/biblioteca/..%2Fprincipios.md')).status, 400);
    assert.equal((await archivo('/archivos/encargos/NO-VALIDO/subida')).status, 400);
    assert.equal((await pedir('GET', '/api/encargos/no-existe')).status, 404);
  });
});
