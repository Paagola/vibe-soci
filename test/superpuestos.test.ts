/**
 * Web en simulado: los locales y referencias reales se ven en solo lectura; lo que se escribe va a los simulados.
 * Sin red y sin gasto: carpetas temporales, almacenes de ficheros de verdad.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenReferenciasFicheros } from '../src/adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { LocalesSuperpuestos, ReferenciasSuperpuestas } from '../src/adaptadores/ficheros/Superpuestos.js';
import { crearDepsPost } from '../src/contenedorPost.js';
import { leerConfig, RAIZ } from '../src/config.js';
import { Marca } from '../src/dominio/modelos.js';
import { ReferenciaLocal } from '../src/dominio/referencia.js';

let raiz: string;
let real: string;
let simulada: string;
let marcaBase: Marca;

const marcaTorre = (): Marca => Marca.parse({ ...marcaBase, slug: 'torre-de-prueba', nombre: 'Torre de prueba' });

const referencia = (cambios: Record<string, unknown> = {}): ReferenciaLocal =>
  ReferenciaLocal.parse({ id: 'ref-1', local: 'torre-de-prueba', origen: { tipo: 'IMAGEN', archivo: 'imagen.jpg' }, creadaEn: '2026-11-07', ...cambios });

const almacenLocales = (carpeta: string) => new AlmacenLocalesFicheros(join(carpeta, 'locales'));
const almacenReferencias = (carpeta: string) => new AlmacenReferenciasFicheros(join(carpeta, 'locales'));

before(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'superpuestos-'));
  real = join(raiz, 'real');
  simulada = join(raiz, 'simulada');
  marcaBase = Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8')));
});

after(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('LocalesSuperpuestos', () => {
  it('une los locales de los dos almacenes y obtiene el de solo lectura', async () => {
    await almacenLocales(real).guardar(marcaTorre());
    await almacenLocales(simulada).guardar(marcaBase);
    const locales = new LocalesSuperpuestos(almacenLocales(simulada), almacenLocales(real));

    const listados = await locales.listar();
    assert.deepEqual(
      listados.map((m) => m.slug),
      ['asador-etxebarri', 'torre-de-prueba'],
    );
    assert.equal(await locales.esDeSoloLectura('torre-de-prueba'), true);
    assert.equal(await locales.esDeSoloLectura('asador-etxebarri'), false);
    assert.equal((await locales.obtener('torre-de-prueba')).nombre, 'Torre de prueba');
  });

  it('solo lectura: guardar escribe en la simulada y el marca.json real no cambia', async () => {
    const locales = new LocalesSuperpuestos(almacenLocales(simulada), almacenLocales(real));
    const rutaReal = join(real, 'locales', 'torre-de-prueba', 'marca.json');
    const antes = await readFile(rutaReal);

    await locales.guardar(Marca.parse({ ...marcaTorre(), nombre: 'Torre modificada' }));

    assert.deepEqual(await readFile(rutaReal), antes);
    assert.equal((await locales.obtener('torre-de-prueba')).nombre, 'Torre modificada');
    assert.equal(await locales.esDeSoloLectura('torre-de-prueba'), false);
    assert.equal((await almacenLocales(simulada).obtener('torre-de-prueba')).nombre, 'Torre modificada');
  });
});

describe('ReferenciasSuperpuestas', () => {
  it('lista, obtiene y resuelve archivos desde la real; lo guardado va a la simulada', async () => {
    const reales = almacenReferencias(real);
    await reales.guardar(referencia({ nota: 'original' }));
    await reales.escribirArchivo('torre-de-prueba', 'ref-1', 'imagen.jpg', Buffer.from('imagen real'));
    const referenciasReal = join(real, 'locales', 'torre-de-prueba', 'referencias', 'ref-1', 'referencia.json');
    const antesJson = await readFile(referenciasReal);

    const refs = new ReferenciasSuperpuestas(almacenReferencias(simulada), reales);
    assert.deepEqual((await refs.listar('torre-de-prueba')).map((r) => r.id), ['ref-1']);
    assert.equal((await refs.obtener('torre-de-prueba', 'ref-1')).nota, 'original');
    assert.equal(refs.rutaArchivo('torre-de-prueba', 'ref-1', 'imagen.jpg'), join(real, 'locales', 'torre-de-prueba', 'referencias', 'ref-1', 'imagen.jpg'));

    await refs.guardar(referencia({ nota: 'cambiada' }));

    assert.equal((await refs.obtener('torre-de-prueba', 'ref-1')).nota, 'cambiada');
    assert.deepEqual(await readFile(referenciasReal), antesJson);
    assert.equal((await almacenReferencias(simulada).obtener('torre-de-prueba', 'ref-1')).nota, 'cambiada');
    assert.equal(
      refs.rutaArchivo('torre-de-prueba', 'ref-1', 'imagen.jpg'),
      join(real, 'locales', 'torre-de-prueba', 'referencias', 'ref-1', 'imagen.jpg'),
    );
  });
});

describe('crearDepsPost en la web (simulado, DEL_MODO)', () => {
  const entorno = () => ({ ESTUDIO_DATOS: real, ESTUDIO_DATOS_SIMULADO: simulada });

  it('ve los locales reales en solo lectura', async () => {
    const deps = await crearDepsPost(leerConfig(entorno()), { simular: true, proyecto: 'x', datosDeReferencia: 'DEL_MODO' });
    const slugs = (await deps.referencias.locales.listar()).map((m) => m.slug);
    assert.ok(slugs.includes('torre-de-prueba'));
  });

  it('con REALES sigue como antes (lee de los reales)', async () => {
    const deps = await crearDepsPost(leerConfig(entorno()), { simular: true, proyecto: 'x', datosDeReferencia: 'REALES' });
    const slugs = (await deps.referencias.locales.listar()).map((m) => m.slug);
    assert.ok(slugs.includes('torre-de-prueba'));
    assert.equal(deps.referencias.locales instanceof LocalesSuperpuestos, false);
  });
});
