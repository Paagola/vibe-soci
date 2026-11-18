import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { enviosDisponibles, GeneradorCartelOpenAI, reservarEnvio } from '../src/adaptadores/openai/GeneradorCartel.js';
import { coincideTexto, dirigir } from '../src/aplicacion/taller/direccion.js';
import { dirigirToma, instruccionDeToma } from '../src/aplicacion/taller/toma.js';
import { ComandaDeArte, SeleccionDeMuestras } from '../src/dominio/taller.js';
import { RAIZ } from '../src/config.js';
import { Marca } from '../src/dominio/modelos.js';
import { EncargoPost } from '../src/dominio/post.js';
import { FichaReferencia } from '../src/dominio/referencia.js';

it('dirige desde el plato y la ficha, conserva los hechos y extrae un nombre de la nota', async () => {
  const marca = Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas/marca.ejemplo.json'), 'utf8')));
  marca.nombre = 'Torre de Vega';
  const ficha = async (id: string) => FichaReferencia.parse(JSON.parse(await readFile(join(RAIZ, 'conocimiento/referencias/fichas', id + '.json'), 'utf8')));
  const base = EncargoPost.parse({ esquema: 'post/encargo@1', proyecto: 'taller', local: marca.slug, plato: 'Pulpo a la gallega. Foto de la cocina.', fotoSubida: 'foto', usoFotoReal: 'PUBLICABLE', creadoEn: '2026-11-18', referencia: 'ref-16', taller: {} });
  const medidas = { temperatura: 'CALIDA', dominantes: ['#994322'], luz: 0.5, aire: 'arriba' };
  const pulpo = dirigir(base, marca, 'a'.repeat(64), medidas, 'Oficio del cartel.', await ficha('post-16'));
  assert.deepEqual(pulpo.textos.map(b => b.texto), ['PULPO', 'TORRE DE VEGA', 'A LA', 'gallega']);
  assert.equal(pulpo.direccion.gesto, 'EMERGER');
  assert.match(pulpo.direccion.sujeto, /ventosas/);
  assert.match(pulpo.prompt, /contacto/);
  assert.doesNotMatch(pulpo.prompt, /FREE|SPAGHETTI/);
  const { toma, ...comandaAnterior } = pulpo;
  assert.equal(ComandaDeArte.parse(comandaAnterior).toma, undefined);
  assert.match(toma!.camara.evidencia, /ventosas/);
  assert.equal(toma!.seleccion.origen, undefined);
  assert.ok(toma!.alternativa);
  assert.match(pulpo.prompt, /posición|perspectiva/);
  assert.throws(() => dirigir(base, marca, 'a'.repeat(64), medidas, 'oficio', undefined, pulpo.direccion, 'Happy hour'), /literal/);
  const cafe = dirigir({ ...base, plato: 'Café solo', referencia: 'ref-11' }, marca, 'b'.repeat(64), medidas, 'Oficio.', await ficha('post-11'));
  assert.equal(cafe.direccion.gesto, 'LUZ_Y_SOMBRA');
  assert.match(cafe.prompt, /didona|luz lateral/i);
  assert.doesNotMatch(cafe.direccion.escena, /papel|ventosas/i);
  assert.ok(coincideTexto(['CAFÉ', 'Torre'], ['Torre', 'CAFE\u0301']));
  assert.ok(!coincideTexto(['CAFÉ'], ['cafe']));
  assert.ok(!coincideTexto(['CAFÉ'], ['café']));
  assert.ok(!coincideTexto(['CAFÉ'], ['CAFÉ', 'GRATIS']));
});

it('resuelve la cámara según producto, referencia y observación del origen, incluso en vista cenital', () => {
  const cenital = { anguloGrados: 88, distancia: 'MEDIO' } as const;
  assert.throws(() => dirigirToma('Gamba roja', 'RITMO', { opcion: 'CENITAL', origen: cenital }), /repite/);
  const gamba = dirigirToma('Gamba roja', 'LUZ_Y_SOMBRA', { opcion: 'AUTO', origen: cenital });
  assert.equal(gamba.camara.vista, 'RASANTE');
  assert.equal(gamba.alternativa, undefined);
  assert.match(gamba.camara.evidencia, /cabeza.*oculta/);
  assert.match(gamba.conservar, /Cuenta las piezas/);
  const sopa = dirigirToma('Caldo de pescado', 'MACRO', { opcion: 'AUTO', plano: 'MACRO', luz: 'Ventana difusa desde el fondo.', accionProducto: 'La curva del cuenco conduce la mirada.' }, 'Cenital de un cuenco');
  assert.equal(sopa.camara.vista, 'CENITAL');
  assert.equal(sopa.camara.distancia, 'MACRO');
  assert.match(sopa.camara.evidencia, /boca.*planta/);
  assert.match(instruccionDeToma(sopa), /Ventana difusa/);
  assert.equal(sopa.alternativa?.vista, 'RASANTE');
  assert.doesNotMatch(dirigirToma('Arroz con pulpo', 'EMERGER').conservar, /ventosas/);
  assert.match(dirigirToma('Café solo', 'LUZ_Y_SOMBRA').conservar, /Recipiente/);
  assert.doesNotMatch(dirigirToma('Helado de café', 'MACRO').conservar, /líquido|espuma/);
  assert.doesNotMatch(dirigirToma('Gambas peladas al ajillo', 'RITMO').foco, /antenas/);
});

it('acepta solo detalles distintos dentro de la foto y un recuento positivo de la fuente', () => {
  const uno = { x: .80, y: .34, ancho: .16, alto: .24 };
  const dos = { x: .44, y: .62, ancho: .18, alto: .29 };
  const seleccion = { recuento: 2, unidad: 'gambas enteras', colocacion: 'Separadas sobre el mismo plano.', recortes: [uno, dos] };
  assert.deepEqual(SeleccionDeMuestras.parse(seleccion), seleccion);
  for (const recortes of [[uno], [uno, uno], [uno, { ...dos, x: .99 }], [uno, { x: 0, y: 0, ancho: 1, alto: 1 }]]) {
    assert.equal(SeleccionDeMuestras.safeParse({ ...seleccion, recortes }).success, false);
  }
  assert.equal(SeleccionDeMuestras.safeParse({ ...seleccion, recuento: 0 }).success, false);
});

it('reserva atómicamente la dirección una vez, respeta el cupo global y no reintenta envíos inciertos', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'taller-presupuesto-'));
  try {
    const envio = (huella: string) => reservarEnvio(carpeta, 2, huella, 'cartel', '2026-11-18');
    const simultaneos = await Promise.allSettled(Array.from({ length: 8 }, () => envio('primera')));
    assert.equal(simultaneos.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await enviosDisponibles(carpeta, 2), 1);
    assert.equal(await envio('segunda'), 2);
    await assert.rejects(() => envio('tercera'), /agotado/);
    assert.deepEqual((await readdir(carpeta)).sort(), ['1.json', '2.json']);
    let peticiones = 0;
    const roto = new GeneradorCartelOpenAI('prueba', async () => { peticiones++; return new Response('', { status: 503 }); });
    await assert.rejects(roto.generar('Una imagen', Buffer.from('foto')), /503/);
    assert.equal(peticiones, 1);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});

it('Images API recibe una única edición con foto JPEG y la dirección completa', async () => {
  const fuente = Buffer.from('foto de prueba');
  const adjuntos: string[] = [];
  const proveedor = new GeneradorCartelOpenAI('clave-de-prueba', async (url, init) => {
    assert.equal(String(url), 'https://api.openai.com/v1/images/edits');
    const cuerpo = init?.body;
    assert.ok(cuerpo instanceof FormData);
    assert.equal(cuerpo.get('prompt'), 'Comanda exacta');
    assert.equal(cuerpo.get('size'), '1088x1360');
    assert.equal(cuerpo.get('quality'), 'high');
    assert.equal(cuerpo.get('n'), '1');
    assert.equal(cuerpo.get('model'), 'gpt-image-2');
    const foto = cuerpo.get('image');
    assert.ok(foto instanceof File);
    assert.equal(cuerpo.getAll('image').length, 1);
    adjuntos.push(foto.name);
    assert.deepEqual(Buffer.from(await foto.arrayBuffer()), fuente);
    return Response.json({ data: [{ b64_json: Buffer.from('resultado').toString('base64') }] });
  });
  assert.equal((await proveedor.generar('Comanda exacta', fuente)).toString(), 'resultado');
  assert.equal((await proveedor.generar('Comanda exacta', fuente, 'muestras.jpg')).toString(), 'resultado');
  assert.deepEqual(adjuntos, ['producto.jpg', 'muestras.jpg']);
});

it('elige la dirección editorial según el asunto y la tarea, con la procedencia de cada referencia', async () => {
  const marca = Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas/marca.ejemplo.json'), 'utf8')));
  const foto = { temperatura: 'CALIDA', dominantes: ['#443322'], luz: 0.4, aire: 'arriba' };
  const resolver = (plato: string) => dirigir(EncargoPost.parse({ esquema: 'post/encargo@1', proyecto: 'editorial', local: marca.slug, plato,
    fotoSubida: 'fuente', creadoEn: '2026-11-18', taller: { seleccionEditorial: true } }), marca, 'a'.repeat(64), foto, 'Oficio del cartel.');
  for (const nota of ['Barra de pan de masa madre', 'Café solo', 'Croquetas sin letras']) {
    const c = resolver(nota);
    assert.equal(c.editorial?.ruta, 'FOTO_PLATO');
    assert.deepEqual(c.textos, []);
    assert.equal(ComandaDeArte.safeParse(c).success, true);
    assert.ok(c.editorial.evidencias.length >= 2);
    assert.ok(c.editorial.evidencias.every(e => e.pagina.startsWith('https://') && !c.prompt.includes(e.imagen)));
    assert.equal(c.prompt.indexOf(c.direccion.escena), c.prompt.lastIndexOf(c.direccion.escena));
  }
  assert.notDeepEqual(resolver('Café solo').toma?.camara, resolver('Croquetas').toma?.camara);
  const sala = resolver('Post de la terraza al anochecer');
  assert.equal(sala.editorial?.ruta, 'FOTO_ESPACIO');
  assert.equal(sala.toma?.camara.distancia, 'GENERAL');
  assert.doesNotMatch(sala.prompt, /anatomía|alimento fotografiado|nombre impreso/);
  const sobria = resolver('Tosta de aguacate. Añade el nombre en un titular pequeño sin efectos.');
  assert.deepEqual(sobria.textos.map(b => b.texto), ['Tosta de aguacate']);
  assert.equal(sobria.editorial?.ruta, 'TIPO_SOBRIA');
  const cartel = resolver('Pulpo a la gallega. Cartel expresivo con papel rasgado');
  assert.equal(cartel.editorial?.ruta, 'CARTEL_EXPRESIVO');
  assert.equal(cartel.direccion.gesto, 'EMERGER');
  assert.match(cartel.prompt, /sombra de contacto/);
  const corpus = JSON.parse(await readFile(join(RAIZ, 'conocimiento/referencias/corpus-editorial.json'), 'utf8')) as Array<{id: string; sha256: string; lectura: string}>;
  assert.ok(corpus.length >= 200);
  for (const clave of ['id', 'sha256', 'lectura'] as const) assert.equal(new Set(corpus.map(f => f[clave])).size, corpus.length);
  assert.ok([cartel, sobria, sala].every(c => c.editorial?.evidencias.every(ref => corpus.some(f => f.id === ref.id && f.lectura === ref.lectura))));
});
