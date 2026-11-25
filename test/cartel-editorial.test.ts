import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { ComponedorProyectos } from '../src/adaptadores/compositor/ComponedorProyectos.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { MedidorDeFotoSharp } from '../src/adaptadores/imagen/MedidorDeFotoSharp.js';
import { Activo } from '../src/dominio/activos.js';
import { RAIZ } from '../src/config.js';
import { BriefDelEncargo, confirmarInventario, crearBrief } from '../src/dominio/brief.js';
import { Intencion, Tokens } from '../src/dominio/diseno/intencion.js';
import { EncargoPost } from '../src/dominio/post.js';
import type { DiapositivaEditorial } from '../src/dominio/editorial.js';
import { componerCartel } from '../src/aplicacion/productor/componerCartel.js';
import { comprobarEdicionEditorial, materializarEditorial } from '../src/aplicacion/productor/componerEditorial.js';
import { CriticoEditorialSimulado, esquemaDeCriticaEditorial, revisarEstructuraDelCartel } from '../src/aplicacion/productor/criticaEditorial.js';
import { revisarEntrega } from '../src/aplicacion/productor/revisarEntrega.js';
import { cartelDePortada, direccionParaLaFoto, fichaDeCartel } from '../src/aplicacion/productor/editorial.js';

const fecha = '2026-11-17T17:00:00Z';
const elementos = [
  { nombre: 'tabla de madera', estado: 'redonda', recuento: 1 },
  { nombre: 'tentáculo de pulpo', estado: 'asado', recuento: 1 },
];
const encargo = EncargoPost.parse({ esquema: 'post/encargo@1', local: 'torre-de-vega', proyecto: 'cartel-de-prueba',
  plato: 'Pulpo a la gallega', fotoSubida: 'fuente.jpg', fotoElegida: 'foto-elegida', activoReal: 'foto-real', creadoEn: fecha });
const heredada: DiapositivaEditorial = { n: 1, papel: 'portada', tratamiento: 'FOTO_TEXTO_AL_BORDE',
  borde: 'INFERIOR', gesto: 'ANUNCIO', texto: { fuente: 'ELEMENTO', indice: 1 } };
const limpia: DiapositivaEditorial = { n: 1, papel: 'portada', tratamiento: 'FOTO_LIMPIA' };
const tokens = join(RAIZ, 'marcas', encargo.local, 'tokens.json');

async function briefDe(ficha: string, pagina: DiapositivaEditorial = heredada) {
  const inicial = crearBrief({ proyecto: encargo.proyecto, local: encargo.local, formato: 'post', nota: encargo.plato,
    usoFotoReal: 'PUBLICABLE', marca: { nombre: 'Casa del Río', ciudad: 'Cádiz', descripcion: '', tonos: [] }, elementos, tomas: [] }, fecha);
  const confirmado = confirmarInventario(inicial, { elementos, tomas: [] }, 'web', fecha, { fotos: 1, llamadasTexto: 1 });
  return BriefDelEncargo.parse({ ...confirmado, modo: 'PRODUCTOR', editorial: { modelo: 'prueba', briefVersion: 1,
    inventarioSha256: confirmado.hechos.inventario.huella, fotoSha256: 'a'.repeat(64),
    fichaReferencia: await readFile(join(RAIZ, 'conocimiento/referencias/fichas', ficha + '.json'), 'utf8'),
    plan: { esquema: 'post/editorial@1', hiloVisual: 'COLOR', diapositivas: [pagina] } } });
}

async function fotografiarFigura(carpeta: string) {
  const almacen = new AlmacenActivosFicheros(join(carpeta, 'locales'));
  const pintar = (fondo: string, sujeto: string) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960">
    <rect width="720" height="960" fill="${fondo}"/><ellipse cx="550" cy="550" rx="225" ry="270" fill="${sujeto}"/></svg>`)).png().toBuffer();
  const foto = await pintar('#DBD7D1', '#923513');
  const mascara = await pintar('black', 'white');
  const sha256 = createHash('sha256').update(foto).digest('hex');
  await almacen.crear(Activo.parse({ id: 'foto-elegida', localSlug: encargo.local, tipo: 'REAL', uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: 'Figura de prueba con un canto cortado', archivo: 'foto.png', ancho: 720, alto: 960, sha256,
    procedencia: { ruta: 'fixture', sha256, copiadoEn: fecha },
    mascara: { archivo: 'mascara.png', metodo: 'MANUAL', creadaEn: fecha, incluye: 'figura', bbox: { x: 325, y: 280, w: 395, h: 540 } },
  }), { 'foto.png': foto, 'mascara.png': mascara });
  const fuente = await pintar('#5c4d3e', '#6f2714');
  const huellaFuente = createHash('sha256').update(fuente).digest('hex');
  await almacen.crear(Activo.parse({ id: 'foto-real', localSlug: encargo.local, tipo: 'REAL', uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: 'Referencia del plato', archivo: 'fuente.png', ancho: 720, alto: 960, sha256: huellaFuente,
    procedencia: { ruta: 'fixture-fuente', sha256: huellaFuente, copiadoEn: fecha },
  }), { 'fuente.png': fuente });
  return almacen;
}

describe('Cartel editorial', () => {
  it('compila el plan archivado con la foto elegida, conserva el nombre y respeta una corrección al reanudar', async () => {
    const brief = await briefDe('post-16');
    const carpeta = await mkdtemp(join(tmpdir(), 'cartel-'));
    try {
      const proyecto = join(carpeta, encargo.proyecto);
      const activos = await fotografiarFigura(carpeta);
      const medidor = new MedidorDeFotoSharp();
      const medidas: string[] = [];
      await materializarEditorial(proyecto, tokens, encargo, brief, async id => {
        medidas.push(id);
        return medidor.medir(await activos.obtener(encargo.local, id));
      });
      assert.deepEqual(medidas, ['foto-elegida']);
      const ruta = join(proyecto, 'intenciones/post.json');
      const arte = Intencion.parse(JSON.parse(await readFile(ruta, 'utf8')));
      assert.equal(arte.activos.foto, encargo.fotoElegida);
      assert.equal(arte.capas.find(c => c.tipo === 'texto' && c.rotacion === -90)?.id, 'titular');
      assert.ok(arte.capas.some(c => c.tipo === 'recorte'));
      assert.equal(arte.textos.nombre?.replace(/\s+/g, ' '), elementos[1]!.nombre);
      assert.deepEqual(Object.values(arte.textos), ['tentáculo de\npulpo', brief.marca.nombre]);
      assert.match(direccionParaLaFoto(brief), /vertical space/);
      assert.doesNotMatch(JSON.stringify(arte), /FREE|SPAGHETTI|#D04D59|#F9CF3F/i);
      comprobarEdicionEditorial(arte, encargo, brief);
      const sinInflexion = { ...arte, capas: arte.capas.filter(c => c.id !== 'inflexion') };
      assert.throws(() => comprobarEdicionEditorial(sinInflexion, encargo, brief), /dato completo/);
      assert.equal(revisarEstructuraDelCartel(brief, heredada, arte), undefined);
      const banda = { ...arte, capas: arte.capas.filter(c => c.id === 'firma' || c.tipo === 'imagen') };
      assert.equal(revisarEstructuraDelCartel(brief, heredada, banda)?.correccion.tipo, 'REVISION_HUMANA');

      const entrega = await new ComponedorProyectos(RAIZ, carpeta).componer(proyecto);
      const render = entrega.diapositivas[0]!;
      assert.deepEqual(render.problemas.filter(p => p.gravedad === 'ERROR'), []);
      assert.ok(render.problemas.some(p => p.tipo === 'FIDELIDAD'));
      const resuelto = JSON.parse(await readFile(join(render.carpeta, 'resuelto.json'), 'utf8'));
      assert.equal(resuelto.capas.find((c: { id: string }) => c.id === 'titular').texto, 'pulpo');
      assert.ok(resuelto.medidas.contraste.titular >= 3 && resuelto.medidas.contraste.firma >= 4.5);
      for (const [archivo, alto] of [['3x4', 1440], ['4x5', 1350]] as const) {
        const jpeg = await sharp(join(render.carpeta, 'exportadas', archivo + '.jpg')).metadata();
        assert.deepEqual([jpeg.width, jpeg.height], [1080, alto]);
      }

      const critico = new CriticoEditorialSimulado([{ id: 'post', version: 1, motivo: 'La silueta roza el pie de una letra.',
        correccion: { tipo: 'DESPEJAR_TITULAR' } }]);
      const deps = { proyectos: carpeta, activos, criticoEditorial: critico };
      assert.equal(await revisarEntrega(deps, encargo, brief, entrega), 'COMPONER');
      const segunda = Intencion.parse(JSON.parse(await readFile(ruta, 'utf8')));
      assert.equal(segunda.padre, 1);
      assert.deepEqual(segunda.textos, arte.textos);
      assert.deepEqual(segunda.activos, arte.activos);
      const entregaCorregida = await new ComponedorProyectos(RAIZ, carpeta).componer(proyecto);
      const revision = await revisarEntrega({ ...deps, criticoEditorial: new CriticoEditorialSimulado() }, encargo, brief, entregaCorregida);
      assert.ok(revision !== 'COMPONER' && revision.estado === 'CORREGIDA');

      const corregida = { ...segunda, notas: 'Cambio de posición aceptado', version: 3, padre: 2 };
      await writeFile(ruta, JSON.stringify(corregida));
      await materializarEditorial(proyecto, tokens, encargo, brief, async () => assert.fail('No debe volver a medir una página editada'));
      assert.deepEqual(JSON.parse(await readFile(ruta, 'utf8')), corregida);
    } finally { await rm(carpeta, { recursive: true, force: true }); }
  });

  it('preserva la portada sobria y elige el producto que nombró la persona para una portada gráfica nueva', async () => {
    const sobria = await briefDe('post-11', limpia);
    assert.equal(cartelDePortada(limpia, fichaDeCartel(sobria.editorial!.fichaReferencia), sobria, true), undefined);
    const grafica = await briefDe('post-16', limpia);
    const ficha = fichaDeCartel(grafica.editorial!.fichaReferencia);
    assert.equal(cartelDePortada(limpia, ficha, grafica), undefined);
    const cartel = cartelDePortada(limpia, ficha, grafica, true)!;
    assert.deepEqual(cartel.texto, { fuente: 'ELEMENTO', indice: 1 });
    const marca = Tokens.parse(JSON.parse(await readFile(tokens, 'utf8')));
    const foto = componerCartel({ ...cartel, estructura: 'CABECERA', superficie: 'FOTOGRAFIA' }, grafica, marca, 'foto-elegida');
    assert.ok(foto.capas.some(c => c.tipo === 'imagen'));
    assert.ok(foto.capas.every(c => c.tipo !== 'recorte'));
    assert.ok(foto.capas.some(c => c.tipo === 'texto' && c.id === 'titular' && !c.rotacion));
    assert.equal(foto.relaciones.filter(r => r.tipo === 'contrasteMinimo').length, 3);
  });

  it('acepta el ajuste de lectura del cartel y conserva los ajustes de banda en planes anteriores sin cartel', async () => {
    const incidencia = (tipo: 'DESPEJAR_TITULAR' | 'AJUSTAR_MARGEN') => ({ incidencias: [{ id: 'post', version: 1,
      motivo: 'La última letra pierde su pie', correccion: tipo === 'AJUSTAR_MARGEN' ? { tipo, margen: 0.09 } : { tipo } }] });
    const paginas = [{ id: 'post', version: 1, bytes: Uint8Array.of(1) }];
    const cartel = esquemaDeCriticaEditorial({ brief: await briefDe('post-16'), paginas });
    const ordinario = esquemaDeCriticaEditorial({ brief: await briefDe('post-11'), paginas });
    assert.ok(cartel.safeParse(incidencia('DESPEJAR_TITULAR')).success);
    assert.ok(!cartel.safeParse(incidencia('AJUSTAR_MARGEN')).success);
    assert.ok(ordinario.safeParse(incidencia('AJUSTAR_MARGEN')).success);
    assert.ok(!ordinario.safeParse(incidencia('DESPEJAR_TITULAR')).success);
  });
});
