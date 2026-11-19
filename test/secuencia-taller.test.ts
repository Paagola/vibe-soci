import { strict as assert } from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import sharp from 'sharp';
import { ClienteGemini } from '../src/adaptadores/gemini/ClienteGemini.js';
import { directorPortadaGemini, directorSecuenciaGemini } from '../src/adaptadores/gemini/DirectorSecuenciaGemini.js';
import { guardarToma, leerToma, promptDeToma } from '../src/aplicacion/taller/secuencia.js';
import { postsRecientes } from '../src/aplicacion/post/historialFotografico.js';
import { EncargoPost } from '../src/dominio/post.js';
import { DireccionSecuencia, direccionSecuenciaSimulada, directorCarruselSimulado, GuionEditorial, SecuenciaTaller, soloFotografia, type FotoDePagina } from '../src/dominio/secuenciaTaller.js';
import { maquetarCarrusel } from '../src/aplicacion/taller/maquetarCarrusel.js';
import { leerSerie } from '../src/aplicacion/taller/serie.js';
import { huella } from '../src/aplicacion/taller/direccion.js';
import { RAIZ } from '../src/config.js';

const foto = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#B05E36' } }).png().toBuffer();

it('dirige en Hydrogen con dos fotos etiquetadas y exige un cambio de plano, cámara y gesto', async () => {
  let llamadas = 0;
  const cliente = new ClienteGemini('prueba', ['gemini-4-hydrogen'], { fetch: async (url, init) => {
    llamadas++;
    assert.match(String(url), /gemini-4-hydrogen:generateContent/);
    const carga = JSON.parse(String(init?.body));
    assert.deepEqual(carga.contents[0].parts.filter((p: { inlineData?: { mimeType: string } }) => p.inlineData)
      .map((p: { inlineData: { mimeType: string } }) => p.inlineData.mimeType), ['image/jpeg', 'image/jpeg']);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(direccionSecuenciaSimulada) }] } }] });
  } });
  const original = await foto(720, 540), portada = await foto(720, 900);
  const plan = await directorSecuenciaGemini(cliente)({ original, portada, producto: 'Croquetas enteras', encargo: 'La primera croqueta' });
  assert.equal(llamadas, 1);
  assert.equal(plan.modelo, 'gemini-4-hydrogen');
  assert.equal(plan.direccion.detalle.vista, 'RASANTE');
  assert.equal(plan.direccion.cierre.vista, 'CENITAL');
  assert.equal(DireccionSecuencia.safeParse({ ...plan.direccion, cierre: plan.direccion.detalle }).success, false);
  const prompt = promptDeToma({ ...plan, huella: 'f'.repeat(64), baseSha256: 'e'.repeat(64), comanda: 'd'.repeat(64), version: 1, tomas: { detalle: {}, cierre: {} } }, 'cierre');
  assert.match(prompt, /Imagen 1: evidencia del alimento/);
  assert.match(prompt, /Imagen 2: portada aprobada/);
  assert.match(prompt, /CENITAL/);
  assert.match(prompt, /90°/);
  assert.match(prompt, /ventana lateral[\s\S]*dominante amarilla/);
  assert.match(promptDeToma({ ...plan, luz: 'ESTUDIO', huella: 'f'.repeat(64), baseSha256: 'e'.repeat(64), comanda: 'd'.repeat(64), version: 1, tomas: { detalle: {}, cierre: {} } }, 'detalle'), /foco neutro[\s\S]*1,5 y 2 pasos/);
});

it('entrega a los dos directores las seis piezas terminadas más recientes del local, con sus fotos si están disponibles', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'historial-foto-'));
  const proyectos = join(raiz, 'proyectos');
  const original = await foto(400, 500);
  const encargo = (n: number, cambios: Partial<EncargoPost> = {}) => EncargoPost.parse({
    esquema: 'post/encargo@1', proyecto: 'post-' + n, local: 'cafe', plato: 'Tarta ' + n,
    paso: 'HECHO', fotoSubida: 'subida.png', creadoEn: '2026-01-' + String(n).padStart(2, '0'), ...cambios,
  });
  try {
    await writeFile(join(raiz, 'subida.png'), original);
    const actual = encargo(11);
    const piezas = [1, 2, 3, 4, 5, 6, 7].map(n => encargo(n)).concat([
      encargo(8, { local: 'otro' }), encargo(9, { paso: 'CONFIRMAR_FOTO' }), encargo(10, { simulado: true }), actual,
    ]);
    for (const e of piezas) {
      const carpeta = join(proyectos, e.proyecto);
      await mkdir(carpeta, { recursive: true });
      await writeFile(join(carpeta, 'post.json'), JSON.stringify(e));
    }
    // Estas piezas históricas se aprobaron usando la foto original.
    const recientes = await postsRecientes({ raiz, proyectos } as Parameters<typeof postsRecientes>[0], actual);
    assert.deepEqual(recientes.map(e => e.pieza), ['post-7', 'post-6', 'post-5', 'post-4', 'post-3', 'post-2']);
    assert.ok(recientes.every(e => e.miniatura?.length));

    let llamadas = 0;
    const portada = { ...direccionSecuenciaSimulada.detalle, idea: 'El corte diagonal sobre la mesa.', luz: 'ESTUDIO' };
    const cliente = new ClienteGemini('prueba', ['gemini-4-hydrogen'], { fetch: async (_url, init) => {
      const carga = JSON.parse(String(init?.body));
      const partes = carga.contents[0].parts as Array<{ text?: string; inlineData?: { mimeType: string } }>;
      const indices = partes.filter(p => p.text?.startsWith('Post reciente '));
      assert.equal(indices.length, 6);
      assert.doesNotMatch(JSON.stringify(indices), /post-(?:8|9|10|11)"/);
      assert.equal(partes.filter(p => p.inlineData?.mimeType === 'image/jpeg').length, llamadas === 0 ? 7 : 8);
      const respuesta = llamadas++ === 0 ? portada : direccionSecuenciaSimulada;
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(respuesta) }] } }] });
    } });
    assert.deepEqual(await directorPortadaGemini(cliente)({ original, encargo: 'Nueva tarta', tipo: 'PRODUCTO', recientes }), portada);
    await directorSecuenciaGemini(cliente)({ original, portada: original, encargo: 'Nueva tarta', producto: 'Tarta entera', recientes, luz: 'ESTUDIO' });
    assert.equal(llamadas, 2);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

it('normaliza el 4:5 del proveedor y deja la foto pendiente de la revisión humana', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'secuencia-taller-'));
  try {
    const candidata = await guardarToma(dir, await foto(928, 1152), 'imagen', 'SOLO_PRUEBA_COMPOSICION');
    assert.equal(candidata.aprobada, false);
    assert.equal(candidata.uso, 'SOLO_PRUEBA_COMPOSICION');
    const { width, height } = await sharp(await leerToma(dir, candidata.sha256)).metadata();
    assert.deepEqual([width, height], [1080, 1350]);
    await assert.rejects(guardarToma(dir, await foto(720, 720), 'imagen', 'PUBLICABLE'), /foto 4:5/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it('maqueta un guion variable con ventana arqueada, dos fotos en una lámina y apertura sin texto', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'carrusel-editorial-'));
  try {
    const base = await foto(720, 900);
    const { direccion, modelo } = await directorCarruselSimulado({ original: base, portada: base, encargo: 'Pasta con setas', producto: 'Pasta con setas', nombre: 'Pasta' });
    assert.equal(soloFotografia('Pasta', 'Quiero una apertura sin texto.'), false);
    assert.equal(soloFotografia('Pasta', 'Toda la serie sin texto.'), true);
    assert.equal(GuionEditorial.safeParse({ ...direccion, paginas: direccion.paginas.map(p => p.tratamiento === 'DIPTICO' ? { ...p, fotos: ['base', 'base'] } : p) }).success, false);
    const sha = huella(base), comanda = 'c'.repeat(64);
    const secuencia = SecuenciaTaller.parse({ huella: 'd'.repeat(64), comanda, version: 1, baseSha256: sha, modelo, luz: 'NATURAL', direccion, tomas: { detalle: {}, cierre: {}, extra: {} } });
    assert.match(promptDeToma(secuencia, 'extra'), /cuadrada 1:1[\s\S]*ventana arqueada/);
    const cuadrada = await guardarToma(dir, await foto(450, 450), 'prueba', 'PUBLICABLE', '1:1');
    const detalle = await foto(928, 1152), cierre = await foto(800, 1000);
    const fotos = new Map<FotoDePagina, { bytes: Buffer; sha256: string }>([
      ['base', { bytes: base, sha256: sha }],
      ['detalle', { bytes: detalle, sha256: huella(detalle) }],
      ['cierre', { bytes: cierre, sha256: huella(cierre) }],
      ['extra', { bytes: await leerToma(dir, cuadrada.sha256), sha256: cuadrada.sha256 }],
    ]);
    const serie = await maquetarCarrusel(RAIZ, dir, { baseSha256: sha, fotoSha256: sha, comanda, uso: 'PUBLICABLE', origen: 'ORIGINAL', versionBase: 1 }, secuencia, direccion,
      direccion.paginas.map((p, i) => ({ funcion: i === 0 ? 'PORTADA' : i === 3 ? 'CIERRE' : 'DETALLE',
        titulo: p.titulo, apoyo: p.apoyo, nota: p.nota, enfoque: { x: .5, y: .5 } })), fotos);
    assert.equal(serie.guionSha256, secuencia.huella);
    assert.deepEqual(serie.paginas.slice(0, 3).map(p => p.tratamiento), ['FOTO', 'MARCO_ARQUEADO', 'DIPTICO']);
    assert.deepEqual(serie.paginas[0]?.medidas, []);
    assert.deepEqual(serie.paginas[2]?.fotosSha256, [huella(detalle), cuadrada.sha256]);
    const { width, height } = await sharp(await leerSerie(dir, serie, 3)).metadata();
    assert.deepEqual([width, height], [1080, 1350]);
    const zip = await leerSerie(dir, serie);
    assert.ok(zip.includes(Buffer.from('3.svg')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
