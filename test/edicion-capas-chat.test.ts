import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import sharp from 'sharp';
import { CompositorSharp } from '../src/adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../src/adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { crearEditorDeDiseno } from '../src/aplicacion/chat/editarDiseno.js';
import { RAIZ } from '../src/config.js';
import { EdicionDeCapas } from '../src/dominio/diseno/edicionChat.js';
import { Intencion, Tokens } from '../src/dominio/diseno/intencion.js';
import type { Resuelto } from '../src/dominio/diseno/resuelto.js';
import { dentroDe } from '../src/dominio/diseno/reticula.js';
import type { AlmacenActivos } from '../src/puertos/AlmacenActivos.js';
import type { ActivoDisponible } from '../src/puertos/Compositor.js';

it('edita el render real, conserva los píxeles de fondo y el acabado, y añade una sola imagen como capa editable', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'edicion-capas-'));
  try {
    const ruta = (p: string) => join(carpeta, p);
    await sharp({ create: { width: 1080, height: 1440, channels: 3, background: '#331133' } }).png().toFile(ruta('base.png'));
    await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffa322' } }).png().toFile(ruta('chip.png'));
    const activo = (id: string): ActivoDisponible => ({
      ruta: ruta(id === 'toma' ? 'base.png' : 'chip.png'),
      activo: { id, tipo: 'GENERADO', ancho: id === 'toma' ? 1080 : 100, alto: id === 'toma' ? 1440 : 100, uso: 'SOLO_PRUEBA_COMPOSICION', sha256: id.padEnd(64, '0'), alteraciones: [] },
    } as unknown as ActivoDisponible);
    const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos/tipografias'));
    let chips = 0;
    let parche = EdicionDeCapas.parse({
      capas: [{ id: 'titulo', campos: { tipo: 'texto', texto: 'Croquetas', estilo: 'titular', caja: { x: 0.1, y: 0.2, w: 0.8, h: 0.2 }, tamano: 80 } }],
    });
    const editor = crearEditorDeDiseno({
      activos: { obtener: async (_l: string, id: string) => activo(id) } as AlmacenActivos,
      compositor: new CompositorSharp(new MotorTexto(catalogo), catalogo), fuentes: catalogo.familias(),
      dirigir: async () => parche,
      chip: async () => { chips++; return { activo: activo('detalle'), costeUsd: 0.05 }; },
    });
    const original = { n: 1, foto: 'toma', png: 'base.png', soloFoto: true, capas: [], decisiones: [], problemas: [] };
    const o = { ruta, local: 'prueba', tokens: Tokens.parse({ estilos: { titular: { fuente: 'anybody', color: '#ffffff' } } }), conChips: false, pedido: 'Añade el titular' };
    const uno = await editor({ ...o, lamina: original, carpeta: 'v1' });
    assert.equal(chips, 0);
    // Un acabado anterior (mancha azul en la esquina) que no existe en las capas limpias.
    const conAcabado = 'acabado.png';
    await sharp(ruta(uno.lamina.png!)).composite([{ input: await sharp({ create: { width: 10, height: 10, channels: 3, background: '#0000ff' } }).png().toBuffer(), left: 0, top: 0 }]).png().toFile(ruta(conAcabado));
    parche = EdicionDeCapas.parse({ capas: [{ id: 'titulo', campos: { alinear: 'centro', estilo: 'otra' } }], estilos: { otra: { fuente: 'plex-mono', color: '#ffffff' } } });
    const dos = await editor({ ...o, lamina: { ...uno.lamina, png: conAcabado }, carpeta: 'v2' });
    assert.equal(chips, 0);
    assert.equal(dos.lamina.foto, original.foto);
    const doc = Intencion.parse(JSON.parse(await readFile(ruta(dos.lamina.intencion!), 'utf8')));
    assert.deepEqual(doc.activos, { foto: 'toma' });
    assert.equal(doc.tokens.estilos.otra?.fuente, 'plex-mono');
    assert.deepEqual(doc.capas[1], { ...Intencion.parse(JSON.parse(await readFile(ruta(uno.lamina.intencion!), 'utf8'))).capas[1], alinear: 'centro', estilo: 'otra' });
    assert.deepEqual(await readFile(ruta(uno.lamina.capas[0]!)), await readFile(ruta(dos.lamina.capas[0]!)));
    const pixel = await sharp(ruta(dos.lamina.png!)).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel], [0, 0, 255]);
    parche = EdicionDeCapas.parse({ chips: [{ id: 'chip', descripcion: 'Detalle del pan', caja: { x: 0.7, y: 0.7, w: 0.2, h: 0.2 } }] });
    await assert.rejects(editor({ ...o, lamina: dos.lamina, carpeta: 'sin-permiso' }), /imagen de pago/);
    const tres = await editor({ ...o, conChips: true, lamina: dos.lamina, carpeta: 'v3' });
    assert.equal(chips, 1);
    assert.equal(tres.lamina.capas.length, 3);
    assert.equal(tres.costeUsd, 0.05);
    const final = Intencion.parse(JSON.parse(await readFile(ruta(tres.lamina.intencion!), 'utf8')));
    assert.deepEqual(final.activos, { foto: 'toma', chip: 'detalle' });
    assert.deepEqual(final.capas.slice(0, 2), doc.capas);

    // El director coloca la línea pegada a la esquina. Se ajusta su tinta al margen de 4:5 sin regenerar el chip.
    parche = EdicionDeCapas.parse({ capas: [{ id: 'titulo', campos: { alinear: 'izquierda', caja: { x: -0.02, y: 0 } } }] });
    const cuatro = await editor({ ...o, pedido: 'Pon el texto arriba a la izquierda con margen', lamina: tres.lamina, carpeta: 'v4' });
    const resuelto: Resuelto = JSON.parse(await readFile(ruta(cuatro.lamina.intencion!.replace('intencion.json', 'resuelto.json')), 'utf8'));
    const titulo = resuelto.capas.find(c => c.id === 'titulo');
    assert.ok(titulo?.tipo === 'texto');
    assert.ok(dentroDe(titulo.caja, resuelto.zonaSegura));
    assert.ok(Math.abs(titulo.caja.x - resuelto.zonaSegura.x) < 1);
    assert.ok(Math.abs(titulo.caja.y - resuelto.zonaSegura.y) < 1);
    assert.deepEqual(await readFile(ruta(tres.lamina.capas[2]!)), await readFile(ruta(cuatro.lamina.capas[2]!)));
    assert.equal(chips, 1);
    assert.equal(cuatro.costeUsd, 0);

    const archivoPrevio = await readFile(ruta(cuatro.lamina.png!));
    parche = EdicionDeCapas.parse({ capas: [{ id: 'titulo', campos: { tamano: 480, ajuste: 'fijo' } }] });
    await assert.rejects(editor({ ...o, lamina: cuatro.lamina, carpeta: 'imposible' }), /versión anterior.*«titulo» ocupa x .* px/);
    assert.deepEqual(await readFile(ruta(cuatro.lamina.png!)), archivoPrevio);
    await assert.rejects(readFile(ruta('imposible/final.png')), { code: 'ENOENT' });
    assert.equal(chips, 1);

    // Un gesto intencionado puede estar entre el margen y el borde sin que se pierdan letras.
    parche = EdicionDeCapas.parse({ capas: [{ id: 'titulo', campos: { sangrado: true, caja: { x: 0.015, y: 0.02 } } }] });
    const cinco = await editor({ ...o, lamina: cuatro.lamina, carpeta: 'sangrado' });
    const idSangrado = cinco.lamina.intencion!;
    const docSangrado = Intencion.parse(JSON.parse(await readFile(ruta(idSangrado), 'utf8')));
    const tintaSangrado: Resuelto = JSON.parse(await readFile(ruta(idSangrado.replace('intencion.json', 'resuelto.json')), 'utf8'));
    const sangrado = tintaSangrado.capas.find(c => c.id === 'titulo');
    assert.ok(sangrado?.tipo === 'texto' && sangrado.caja.x < tintaSangrado.zonaSegura.x);
    assert.equal(tintaSangrado.problemas.some(p => p.tipo === 'LETRA_PERDIDA'), false);

    // Una entrega antigua puede tener los mismos píxeles sin la marca «sangrado». Cambiar otra capa conserva ese titular.
    const antiguo = docSangrado.capas.find(c => c.id === 'titulo');
    assert.ok(antiguo?.tipo === 'texto');
    antiguo.sangrado = false;
    await writeFile(ruta(idSangrado), JSON.stringify(docSangrado));
    parche = EdicionDeCapas.parse({ capas: [{ id: 'chip', campos: { caja: { x: 0.58 } } }] });
    const seis = await editor({ ...o, lamina: cinco.lamina, carpeta: 'archivo-legacy' });
    const docSeis = Intencion.parse(JSON.parse(await readFile(ruta(seis.lamina.intencion!), 'utf8')));
    assert.deepEqual(docSeis.capas.find(c => c.id === 'titulo'), antiguo);
    assert.equal(chips, 1);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});

it('los parches parciales conservan dimensiones, rechazan propiedades desconocidas y quitan solo capas nombradas', async () => {
  const { aplicarEdicion } = await import('../src/dominio/diseno/edicionChat.js');
  const base = Intencion.parse({
    esquema: 'diseno/intencion@1', id: 'lamina', titulo: 'Post', marca: 'marca', activos: { foto: 'toma' },
    tokens: { estilos: { compartido: { fuente: 'anybody', color: '#223311', tracking: 0.08 } } },
    capas: [
      { id: 'foto', tipo: 'imagen', activo: 'foto', caja: { x: 0, y: 0, w: 1, h: 1 } },
      { id: 'titulo', tipo: 'texto', texto: 'Uno', estilo: 'compartido', caja: { col: [1, 8], fila: [2, 4] }, tamano: 48 },
      { id: 'firma', tipo: 'texto', texto: 'Dos', estilo: 'compartido', caja: { x: 0.2, y: 0.4, w: 0.3, h: 0.1 }, tamano: 20 },
    ], relaciones: [{ tipo: 'contrasteMinimo', texto: 'firma', ratio: 3 }],
  });
  const aplicar = (parche: unknown) => aplicarEdicion(base, EdicionDeCapas.parse(parche), {});
  const parcial = aplicar({ capas: [{ id: 'titulo', campos: { caja: { x: 0.25 } }, fuente: 'plex-mono' }, { id: 'firma', campos: { caja: { y: 0.6 } } }] });
  assert.equal(parcial.capas[1]!.tipo, 'texto');
  if (parcial.capas[1]?.tipo === 'texto') {
    assert.ok('x' in parcial.capas[1].caja && parcial.capas[1].caja.x === 0.25 && parcial.capas[1].caja.w > 0.5);
    assert.deepEqual(parcial.tokens.estilos[parcial.capas[1].estilo], { ...base.tokens.estilos.compartido, fuente: 'plex-mono' });
  }
  assert.deepEqual(parcial.capas[2], { ...base.capas[2], caja: { x: 0.2, y: 0.6, w: 0.3, h: 0.1 } });
  assert.deepEqual(parcial.tokens.estilos.compartido, base.tokens.estilos.compartido);
  assert.throws(() => aplicar({ capas: [{ id: 'titulo', campos: { caja: { x: 0.2, anchoMalEscrito: 0.3 } } }] }), /desconocido/);
  assert.throws(() => aplicar({ capas: [{ id: 'titulo', campos: { grosorr: 3 } }] }), /desconocido/);
  const sinFirma = aplicar({ quitar: ['firma'] });
  assert.deepEqual(sinFirma.capas, base.capas.slice(0, 2));
  assert.deepEqual(sinFirma.relaciones, []);
  const delante = aplicar({ capas: [{ id: 'titulo', campos: {}, despuesDe: 'firma' }] });
  assert.deepEqual(delante.capas.map(c => c.id), ['foto', 'firma', 'titulo']);
  assert.deepEqual(delante.capas[2], base.capas[1]);
  assert.throws(() => aplicar({ capas: [{ id: 'titulo', campos: {}, antesDe: 'foto', despuesDe: 'firma' }] }), /una sola posición/);
  assert.throws(() => aplicar({ capas: [{ id: 'titulo', campos: {}, despuesDe: 'ausente' }] }), /No encuentro/);
  const triangulo = { forma: 'poligono', puntos: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] };
  const conVentana = aplicar({ capas: [{ id: 'foto', campos: { ventana: triangulo } }] });
  assert.deepEqual(conVentana.capas[0], { ...base.capas[0], ventana: triangulo });
  const sinVentana = aplicarEdicion(conVentana, EdicionDeCapas.parse({ capas: [{ id: 'foto', campos: { ventana: null } }] }), {});
  assert.ok(sinVentana.capas[0]?.tipo === 'imagen' && !sinVentana.capas[0].ventana);
  assert.deepEqual(sinVentana.activos, base.activos);
  assert.deepEqual(sinVentana.capas.slice(1), base.capas.slice(1));
});
