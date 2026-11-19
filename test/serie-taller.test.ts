import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import sharp from 'sharp';
import { RAIZ } from '../src/config.js';
import { Marca } from '../src/dominio/modelos.js';
import { EncargoPost } from '../src/dominio/post.js';
import { AccionTaller, ComandaDeArte, type SeleccionDeToma } from '../src/dominio/taller.js';
import { SecuenciaDeSerie, SerieDelTaller } from '../src/dominio/serieTaller.js';
import { Intencion } from '../src/dominio/diseno/intencion.js';
import { dirigir, huella } from '../src/aplicacion/taller/direccion.js';
import { leerSerie, maquetarSerie } from '../src/aplicacion/taller/serie.js';

it('la puesta cambia el alcance de la evidencia sin transferir instrucciones al texto público', async () => {
  const marca = Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas/marca.ejemplo.json'), 'utf8')));
  const base = EncargoPost.parse({ esquema: 'post/encargo@1', proyecto: 'origen', local: marca.slug, plato: 'Croquetas. Sin letras.', fotoSubida: 'foto', usoFotoReal: 'SOLO_PRUEBA_COMPOSICION', creadoEn: '2026-11-19', taller: { seleccionEditorial: true } });
  const direccion = (toma: SeleccionDeToma) => ComandaDeArte.parse(dirigir(base, marca, 'a'.repeat(64), { temperatura: 'CALIDA', dominantes: ['#774433'], luz: .5, aire: 'arriba' }, '', undefined, undefined, undefined, undefined, toma));
  const editorial = direccion({ opcion: 'AUTO', escenaFuente: { modo: 'EDITORIAL', puesta: 'Gesto en la mesa. '.padEnd(320, 'x'), evidencia: 'Croqueta entera con rebozado dorado.'.padEnd(220, 'x') } });
  const documental = direccion({ opcion: 'AUTO', escenaFuente: { modo: 'DOCUMENTAL' } });
  assert.notEqual(editorial.huella, documental.huella);
  assert.equal(editorial.fotoSha256, documental.fotoSha256);
  assert.deepEqual(editorial.textos, []);
  assert.match(editorial.puesta!.sugerencia!, /mano adulta/);
  assert.match(editorial.prompt, /entero|enteras/);
  assert.match(editorial.prompt, /caras fuera de cuadro/);
  assert.doesNotMatch(editorial.prompt, /Preserva los rótulos físicos|rótulos presentes en la imagen del local/);
  assert.match(documental.prompt, /personas, rótulos y objetos/);
  assert.match(documental.prompt, /Mantén el punto de vista documentado/);
  assert.equal(documental.puesta!.vajilla, 'ORIGINAL');
  assert.equal(editorial.uso, 'SOLO_PRUEBA_COMPOSICION');
});

it('la ficha cambia el tratamiento de la misma imagen y permite editar el literal sin regenerar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'serie-ficha-'));
  try {
    const ruta = join(dir, 'foto.png');
    const base = await sharp({ create: { width: 540, height: 675, channels: 3, background: '#533323' } }).png().toBuffer();
    await writeFile(ruta, base);
    const fuente = { baseSha256: huella(base), fotoSha256: huella('fuente'), comanda: huella('comanda'), versionBase: 1, uso: 'SOLO_PRUEBA_COMPOSICION', origen: 'IMPORTACION' } as const;
    const paginas = SecuenciaDeSerie.parse([{ funcion: 'PORTADA', titulo: 'Croquetas' }, { funcion: 'CIERRE' }]);
    const sobria = await maquetarSerie(RAIZ, dir, 'estudio', fuente, ruta, paginas);
    const conFicha = { ...fuente, referencia: { id: 'ensayo-ritmo', voces: [], mecanismos: ['PATRON_REPETIDO'] } };
    const eco = SerieDelTaller.parse(await maquetarSerie(RAIZ, dir, 'estudio', conFicha, ruta, paginas));
    assert.equal(sobria.paginas[0]!.tratamiento, 'TITULO_EN_AIRE');
    assert.equal(eco.paginas[0]!.tratamiento, 'ECO_EN_CONTORNO');
    assert.match(eco.paginas[0]!.motivo, /ensayo-ritmo/);
    assert.equal(eco.paginas[1]!.tratamiento, 'FOTO');
    assert.deepEqual(eco.paginas[1]!.medidas, []);
    assert.notEqual(eco.huella, sobria.huella);
    assert.equal(eco.paginas[1]!.sha256, sobria.paginas[1]!.sha256);
    assert.equal(eco.paginas[0]!.medidas.length, 1);
    assert.ok(eco.paginas[0]!.medidas[0]!.contraste >= 4.5);
    const carpeta = join(dir, 'series', eco.huella);
    const intencion = Intencion.parse(JSON.parse(await readFile(join(carpeta, '1.json'), 'utf8')));
    assert.deepEqual(intencion.textos, { titulo: 'Croquetas' });
    assert.ok(intencion.capas.some(c => c.tipo === 'texto' && c.contorno));
    const svg = await readFile(join(carpeta, '1.svg'), 'utf8');
    assert.match(svg, /viewBox="0 45 1080 1350"/);
    assert.match(svg, /<text /);
    const png = await leerSerie(dir, eco, 1);
    const meta = await sharp(png).metadata();
    assert.deepEqual([meta.width, meta.height], [1080, 1350]);
    const paquete = await leerSerie(dir, eco, undefined, base);
    for (const archivo of ['base.png', 'serie.json', '1.svg', '1.json', '1.png', '2.png']) assert.ok(paquete.includes(Buffer.from(archivo)));
    await writeFile(join(carpeta, '1.png'), 'alterada');
    await assert.rejects(() => leerSerie(dir, eco, 1), /no coincide/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('acepta apoyos sin título, conserva el pie en zona segura y mantiene foto limpia en el cierre', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'serie-pie-'));
  try {
    const ruta = join(RAIZ, 'conocimiento/referencias/piloto-capas/hamburguesa-base.png');
    const sha = huella(await readFile(ruta));
    const paginas = [{ funcion: 'PORTADA', titulo: 'Hamburguesa', apoyo: 'A la mesa' }, { funcion: 'DETALLE', apoyo: 'Capas a la vista', zoom: 1.37 }, { funcion: 'CIERRE' }];
    const accion = { accion: 'MAQUETAR_SERIE', version: 1, revision: 'rev', paginas };
    assert.equal(AccionTaller.safeParse(accion).success, false);
    assert.equal(AccionTaller.safeParse({ ...accion, confirmoTextos: true }).success, true);
    const resultado = await maquetarSerie(RAIZ, dir, 'ensayo', { baseSha256: sha, fotoSha256: sha, comanda: huella('ensayo'), versionBase: 1, uso: 'SOLO_PRUEBA_COMPOSICION', origen: 'ORIGINAL' }, ruta, SecuenciaDeSerie.parse(paginas));
    assert.deepEqual(resultado.paginas.map(p => p.tratamiento), ['ACENTO_INCLINADO', 'PIE_DE_FOTO', 'FOTO']);
    assert.ok(resultado.paginas[1]!.medidas[0]!.cuerpoMovil >= 12);
    assert.equal(resultado.paginas[0]!.medidas.length, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
