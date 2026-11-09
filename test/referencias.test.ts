/**
 * F1.6 · Referencia obligatoria, fichas de referencia, lectura de enlaces y fidelidad del perfil.
 * Sin red (el lector de enlaces usa un fetch simulado) y sin gasto.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { z } from 'zod';
import { ObtenedorEnlacesHttp, metaImagen } from '../src/adaptadores/enlaces/ObtenedorEnlacesHttp.js';
import { MotorTexto } from '../src/adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenReferenciasFicheros } from '../src/adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../src/adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { PiezasHechasFicheros } from '../src/adaptadores/ficheros/PiezasHechasFicheros.js';
import { anadirCaptura } from '../src/aplicacion/referencias/anadirCaptura.js';
import { comprobarReferencia } from '../src/aplicacion/referencias/comprobarReferencia.js';
import type { DepsReferencias } from '../src/aplicacion/referencias/dependencias.js';
import { guardarFicha } from '../src/aplicacion/referencias/guardarFicha.js';
import { registrarReferencia } from '../src/aplicacion/referencias/registrarReferencia.js';
import { RAIZ } from '../src/config.js';
import { PerfilDeMarca, perfilDesdeMarca } from '../src/dominio/marca/perfil.js';
import { Marca, type Pieza } from '../src/dominio/modelos.js';
import {
  FamiliaBiblioteca,
  FichaReferencia,
  PiezaHecha,
  ReferenciaLocal,
  UMBRAL_REFERENCIA_OBLIGATORIA,
  comprobarPasoAConcepto,
  piezasQueCuentan,
  piezasRealesDelLocal,
  plataformaDe,
  proponerFamilias,
} from '../src/dominio/referencia.js';
import type { AlmacenPiezas } from '../src/puertos/Almacenes.js';

const biblioteca = new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(RAIZ, 'biblioteca', 'referencias'));
const pieza = (local: string, origen?: 'API' | 'SIMULADO') =>
  ({ localSlug: local, generaciones: origen ? [{ origen }] : [] }) as unknown as Pieza;

describe('F1.6 · regla de la referencia obligatoria', () => {
  const ficha = async () => biblioteca.ficha('post-11');
  const referencia = async (cambios: Partial<ReferenciaLocal> = {}): Promise<ReferenciaLocal> =>
    ReferenciaLocal.parse({ id: 'ref-1', local: 'x', origen: { tipo: 'IMAGEN', archivo: 'imagen.jpg' }, ficha: await ficha(), creadaEn: '2026-11-07', ...cambios });

  it('el umbral por defecto es 5', () => assert.equal(UMBRAL_REFERENCIA_OBLIGATORIA, 5));

  it('con menos de 5 piezas reales no pasa a concepto sin referencia; con 5 sí', () => {
    const sin = comprobarPasoAConcepto({ piezasReales: 4 });
    assert.equal(sin.puede, false);
    assert.equal(!sin.puede && sin.falta, 'REFERENCIA');
    assert.equal(comprobarPasoAConcepto({ piezasReales: 5 }).puede, true);
    assert.equal(comprobarPasoAConcepto({ piezasReales: 2 }, 2).puede, true, 'el umbral es configurable');
  });

  it('una referencia sin ficha o un enlace que pide captura no bastan; con ficha, sí', async () => {
    const sinFicha = comprobarPasoAConcepto({ piezasReales: 0, referencia: { ...(await referencia()), ficha: undefined } });
    assert.equal(!sinFicha.puede && sinFicha.falta, 'FICHA');
    const pideCaptura = comprobarPasoAConcepto({
      piezasReales: 0,
      referencia: await referencia({ origen: { tipo: 'ENLACE', url: 'https://www.canva.com/design/x/view', plataforma: 'CANVA', estado: 'PIDE_CAPTURA', motivo: 'HTTP 403' } }),
    });
    assert.equal(!pideCaptura.puede && pideCaptura.falta, 'CAPTURA');
    assert.match(pideCaptura.motivo, /captura/);
    const conFicha = comprobarPasoAConcepto({ piezasReales: 0, referencia: await referencia() });
    assert.equal(conFicha.puede, true);
  });

  it('solo cuentan las piezas reales del local (ni otros locales ni las simuladas)', () => {
    const piezas = [pieza('etx'), pieza('etx', 'API'), pieza('dak'), pieza('etx', 'SIMULADO')];
    assert.equal(piezasRealesDelLocal(piezas, 'etx'), 2);
  });

  it('propone tres familias que encajan con el local y con fondos distintos', async () => {
    const familias = await biblioteca.familias();
    const etx = proponerFamilias(familias, ['sobrio', 'artesano', 'fuego']).map((f) => f.id);
    assert.deepEqual(etx, ['F4', 'F7', 'F6']);
    const sinTonos = proponerFamilias(familias, []);
    assert.equal(sinTonos.length, 3);
    assert.equal(new Set(sinTonos.map((f) => f.fondo)).size, 3, 'tres fondos distintos');
    assert.deepEqual(proponerFamilias(familias, ['sobrio', 'artesano', 'fuego']), proponerFamilias(familias, ['sobrio', 'artesano', 'fuego']), 'estable');
  });

  it('reconoce Canva y Pinterest por el dominio', () => {
    assert.equal(plataformaDe('https://www.canva.com/design/abc/view'), 'CANVA');
    assert.equal(plataformaDe('https://pin.it/xyz'), 'PINTEREST');
    assert.equal(plataformaDe('https://es.pinterest.com/pin/123/'), 'PINTEREST');
    assert.equal(plataformaDe('https://example.com/a.jpg'), 'OTRA');
  });
});

describe('F1.6 · fichas y familias de la biblioteca', () => {
  it('las 29 fichas son válidas y cada post está en una sola familia, la misma que dice su ficha', async () => {
    const familias = await biblioteca.familias();
    const posts = familias.flatMap((f) => f.posts);
    assert.equal(posts.length, 29);
    assert.equal(new Set(posts).size, 29, 'ningún post repetido');
    for (const familia of familias) {
      for (const post of familia.posts) {
        const ficha = await biblioteca.ficha(post);
        assert.equal(ficha.familia, familia.id, `${post}: ficha ${ficha.familia} y familia ${familia.id}`);
        await readFile(biblioteca.rutaImagen(post));
      }
    }
  });

  it('una ficha sin lectura de tres niveles o con un HEX mal escrito no es válida', async () => {
    const buena = await biblioteca.ficha('post-12');
    assert.ok(FichaReferencia.safeParse(buena).success);
    assert.equal(FichaReferencia.safeParse({ ...buena, lectura: ['a', 'b'] }).success, false);
    assert.equal(FichaReferencia.safeParse({ ...buena, paleta: [{ hex: 'azul', rol: 'fondo' }] }).success, false);
    assert.ok(z.array(FamiliaBiblioteca).safeParse(await biblioteca.familias()).success);
  });
});

describe('F1.6 · lectura de enlaces (fetch simulado)', () => {
  const html = (meta: string) => new Response(`<html><head>${meta}</head></html>`, { headers: { 'content-type': 'text/html' } });
  const imagen = () => new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  const lector = (respuestas: Record<string, () => Response>) =>
    new ObtenedorEnlacesHttp((async (url: string | URL | Request) => {
      const clave = String(url);
      const r = respuestas[clave];
      if (!r) throw new Error(`sin respuesta para ${clave}`);
      return r();
    }) as typeof fetch);

  it('lee og:image con los atributos en cualquier orden', () => {
    assert.equal(metaImagen('<meta content="https://i.pinimg.com/736x/a.jpg" property="og:image">'), 'https://i.pinimg.com/736x/a.jpg');
    assert.equal(metaImagen('<meta name="twitter:image" content="/b.png">'), '/b.png');
    assert.equal(metaImagen('<meta name="description" content="x">'), undefined);
  });

  it('un pin con su imagen se obtiene; el sitio que bloquea pide captura', async () => {
    const ok = await lector({
      'https://www.pinterest.es/pin/1/': () => html('<meta property="og:image" content="https://i.pinimg.com/736x/aa/bb.jpg">'),
      'https://i.pinimg.com/736x/aa/bb.jpg': imagen,
    }).obtener('https://www.pinterest.es/pin/1/');
    assert.equal(ok.estado, 'OBTENIDA');
    const bloqueado = await lector({ 'https://www.canva.com/design/x/view': () => new Response('no', { status: 403 }) }).obtener('https://www.canva.com/design/x/view');
    assert.deepEqual(bloqueado, { estado: 'PIDE_CAPTURA', motivo: 'el sitio respondió HTTP 403' });
  });

  it('no confunde la imagen genérica de Pinterest con el post (comprobado en real el 07/11/2026)', async () => {
    const generica = await lector({
      'https://pin.it/abc': () => html('<meta property="og:image" content="https://s.pinimg.com/images/facebook_share_image.png">'),
    }).obtener('https://pin.it/abc');
    assert.equal(generica.estado, 'PIDE_CAPTURA');
    const otroHost = await lector({
      'https://www.pinterest.com/pin/2/': () => html('<meta property="og:image" content="https://cdn.example.com/x.jpg">'),
    }).obtener('https://www.pinterest.com/pin/2/');
    assert.equal(otroHost.estado, 'PIDE_CAPTURA');
    const sinImagen = await lector({ 'https://www.pinterest.com/pin/3/': () => html('') }).obtener('https://www.pinterest.com/pin/3/');
    assert.match(sinImagen.estado === 'PIDE_CAPTURA' ? sinImagen.motivo : '', /no publica una imagen/);
  });

  it('un enlace directo a una imagen se obtiene sin más', async () => {
    const r = await lector({ 'https://example.com/post.jpg': imagen }).obtener('https://example.com/post.jpg');
    assert.equal(r.estado, 'OBTENIDA');
  });
});

describe('F1.6 · casos de uso de referencias (carpetas temporales)', () => {
  let carpeta: string;
  let deps: DepsReferencias;
  const piezas: Pieza[] = [];

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-f16-'));
    const locales = new AlmacenLocalesFicheros(join(carpeta, 'locales'));
    await locales.guardar(Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8'))));
    await writeFile(join(carpeta, 'captura.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    deps = {
      piezas: { listar: async () => piezas } as unknown as AlmacenPiezas,
      locales,
      referencias: new AlmacenReferenciasFicheros(join(carpeta, 'locales')),
      biblioteca,
      enlaces: { obtener: async () => ({ estado: 'PIDE_CAPTURA', motivo: 'el sitio respondió HTTP 403' }) },
      leerArchivo: (ruta) => readFile(ruta),
      ahora: () => '2026-11-07T12:00:00.000Z',
    };
  });
  after(() => rm(carpeta, { recursive: true, force: true }));

  it('sin referencia, el paso a concepto se bloquea y propone tres familias del local', async () => {
    const estado = await comprobarReferencia(deps, { local: 'asador-etxebarri' });
    assert.equal(estado.paso.puede, false);
    assert.deepEqual(estado.propuestas.map((f) => f.id), ['F4', 'F7', 'F6']);
  });

  it('un post de la biblioteca llega con su ficha y desbloquea el paso', async () => {
    const r = await registrarReferencia(deps, { local: 'asador-etxebarri', id: 'post-11', deBiblioteca: 'post-11' });
    assert.equal(r.ficha?.familia, 'F4');
    const estado = await comprobarReferencia(deps, { local: 'asador-etxebarri', referencia: 'post-11' });
    assert.equal(estado.paso.puede, true);
    await assert.rejects(registrarReferencia(deps, { local: 'asador-etxebarri', id: 'post-11', deBiblioteca: 'post-12' }), /ya tiene/);
  });

  it('un enlace bloqueado pide captura: no se puede analizar hasta subirla, y después sí', async () => {
    const r = await registrarReferencia(deps, { local: 'asador-etxebarri', id: 'canva-1', enlace: 'https://www.canva.com/design/x/view' });
    assert.equal(r.origen.tipo === 'ENLACE' && r.origen.estado, 'PIDE_CAPTURA');
    const ficha = await biblioteca.ficha('post-30');
    await assert.rejects(guardarFicha(deps, { local: 'asador-etxebarri', id: 'canva-1', ficha }), /captura/);
    await anadirCaptura(deps, { local: 'asador-etxebarri', id: 'canva-1', imagen: join(carpeta, 'captura.png') });
    const conFicha = await guardarFicha(deps, { local: 'asador-etxebarri', id: 'canva-1', ficha });
    assert.equal(conFicha.ficha?.familia, 'F7');
    assert.equal((await comprobarReferencia(deps, { local: 'asador-etxebarri', referencia: 'canva-1' })).paso.puede, true);
  });

  it('con 5 piezas reales ya no hace falta referencia', async () => {
    piezas.push(...Array.from({ length: 5 }, () => pieza('asador-etxebarri', 'API')));
    const estado = await comprobarReferencia(deps, { local: 'asador-etxebarri' });
    assert.equal(estado.paso.puede, true);
    assert.deepEqual(estado.propuestas, []);
  });

  it('solo admite imágenes como referencia subida', async () => {
    await assert.rejects(registrarReferencia(deps, { local: 'asador-etxebarri', id: 'pdf', imagen: join(carpeta, 'menu.pdf') }), /imagen/);
  });
});

describe('F1.6 · fidelidad en el perfil de marca', () => {
  it('por defecto es FLEXIBLE (decisión del 07/11/2026) y un local puede pedir ESTRICTA', async () => {
    const marca = Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8')));
    assert.equal(perfilDesdeMarca(marca, 'x').fidelidad.valor, 'FLEXIBLE');
    const etx = PerfilDeMarca.parse(JSON.parse(await readFile(join(RAIZ, 'marcas', 'asador-etxebarri', 'perfil.json'), 'utf8')));
    assert.equal(etx.fidelidad.valor, 'FLEXIBLE');
    assert.ok(PerfilDeMarca.safeParse({ ...etx, fidelidad: { ...etx.fidelidad, valor: 'ESTRICTA' } }).success);
  });
});

describe('F1.6 · fuentes nuevas del catálogo', () => {
  it('Bodoni Moda, Ballet y Kaushan Script componen texto en castellano con acentos y eñe', () => {
    const motor = new MotorTexto(new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias')));
    for (const fuente of ['bodoni-moda', 'bodoni-moda-italica', 'ballet', 'kaushan-script']) {
      const bloque = motor.componer({
        texto: 'Gamba roja de Palamós, ¿señor?',
        estilo: { fuente, ejes: {}, caso: 'tal-cual', tracking: 0, interlineado: 1 },
        caja: { x: 0, y: 0, w: 900, h: 200 },
        ajuste: 'caja',
        alinear: 'izquierda',
        vertical: 'arriba',
      });
      assert.ok(bloque.lineas.length >= 1 && bloque.tamano > 10, fuente);
    }
  });
});

describe('F1.6 · piezas hechas con herramientas (cuentan para el umbral desde el 09/11/2026)', () => {
  it('cuentan junto a las de la app, solo las del local', () => {
    const hechas = [
      PiezaHecha.parse({ proyecto: 'p/a', local: 'etx', fecha: '2026-11-07', referencia: 'ref-post-30' }),
      PiezaHecha.parse({ proyecto: 'p/b', local: 'dak', fecha: '2026-11-07' }),
    ];
    assert.deepEqual(piezasQueCuentan([pieza('etx', 'API'), pieza('etx', 'SIMULADO')], hechas, 'etx'), { app: 1, herramientas: 1, total: 2 });
  });

  it('el lector de proyectos solo cuenta los planes que declaran `pieza` (no los experimentos)', async () => {
    const carpeta = await mkdtemp(join(tmpdir(), 'estudio-piezas-'));
    try {
      const plan = async (ruta: string, contenido: object) => {
        await mkdir(join(carpeta, ruta), { recursive: true });
        await writeFile(join(carpeta, ruta, 'plan.json'), JSON.stringify(contenido));
      };
      await plan('posts/etx', { local: 'etx', marca: 'x', diapositivas: [], pieza: { fecha: '2026-11-07', referencia: 'ref-post-30' } });
      await plan('carrusel', { local: 'etx', marca: 'x', diapositivas: [], pieza: { fecha: '2026-11-08' } });
      await plan('benchmark', { local: 'etx', marca: 'x', diapositivas: [] });
      const piezas = await new PiezasHechasFicheros(carpeta).listar();
      assert.deepEqual(piezas.map((p) => p.proyecto).sort(), ['carrusel', join('posts', 'etx')]);
      await plan('mala', { local: 'etx', pieza: { fecha: 'ayer' } });
      await assert.rejects(new PiezasHechasFicheros(carpeta).listar(), /pieza/);
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });

  it('con las piezas hechas con herramientas se llega al umbral y ya no hace falta referencia', async () => {
    const hechas = Array.from({ length: 4 }, (_, i) => PiezaHecha.parse({ proyecto: `p${i}`, local: 'etx', fecha: '2026-11-07' }));
    const deps = {
      piezas: { listar: async () => [pieza('etx', 'API')] },
      piezasHechas: { listar: async () => hechas },
      locales: { obtener: async () => ({ tonos: ['sobrio'] }) },
      referencias: { obtener: async () => undefined },
      biblioteca,
    } as unknown as DepsReferencias;
    const estado = await comprobarReferencia(deps, { local: 'etx' });
    assert.equal(estado.paso.puede, true);
    assert.deepEqual(estado.desglose, { app: 1, herramientas: 4 });
  });
});

describe('F1.6 · «referencia comprobar» solo lee (09/11/2026)', () => {
  it('sin referencia nombra las familias pero no escribe ningún archivo; «propuestas» sí pinta la hoja', async () => {
    const datos = await mkdtemp(join(tmpdir(), 'estudio-comprobar-'));
    try {
      const marca = Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8')));
      await new AlmacenLocalesFicheros(join(datos, 'locales')).guardar(marca);
      const antes = await readdir(join(datos, 'locales', marca.slug));
      const orden = (sub: string) =>
        execFileSync(process.execPath, ['--import', 'tsx', join(RAIZ, 'src', 'herramientas', 'referencia.ts'), sub, '--local', marca.slug], {
          cwd: RAIZ,
          env: { ...process.env, ESTUDIO_DATOS: datos },
          encoding: 'utf8',
        });
      const salida = orden('comprobar');
      assert.match(salida, /Familias propuestas/);
      assert.deepEqual(await readdir(join(datos, 'locales', marca.slug)), antes, 'comprobar no debe crear nada');
      orden('propuestas');
      assert.ok((await readdir(join(datos, 'locales', marca.slug, 'referencias'))).includes('propuestas.jpg'));
    } finally {
      await rm(datos, { recursive: true, force: true });
    }
  });
});
