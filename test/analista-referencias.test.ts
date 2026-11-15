/**
 * Puntos 3 y 4 · La ficha automática de una referencia y el aviso de lo que no es un post (mockups, marcas de agua…).
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ComponedorProyectos } from '../src/adaptadores/compositor/ComponedorProyectos.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenReferenciasFicheros } from '../src/adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../src/adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { PiezasHechasFicheros } from '../src/adaptadores/ficheros/PiezasHechasFicheros.js';
import { AnalistaReferenciasGemini, instruccionesAnalista } from '../src/adaptadores/gemini/AnalistaReferenciasGemini.js';
import { ClienteGemini } from '../src/adaptadores/gemini/ClienteGemini.js';
import { AnalistaReferenciasSimulado, FICHA_SIMULADA } from '../src/adaptadores/simulado/AnalistaSimulado.js';
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from '../src/adaptadores/simulado/FotoSimulada.js';
import { avanzar, crearEncargo, type DepsPost } from '../src/aplicacion/post/ordenPost.js';
import { analizarReferencia } from '../src/aplicacion/referencias/analizarReferencia.js';
import type { DepsReferencias } from '../src/aplicacion/referencias/dependencias.js';
import { registrarReferencia } from '../src/aplicacion/referencias/registrarReferencia.js';
import { RAIZ } from '../src/config.js';
import { Marca } from '../src/dominio/modelos.js';
import { comprobarPasoAConcepto, decidirAptitud } from '../src/dominio/referencia.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');
let carpeta: string;
let refs: DepsReferencias;

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-analista-'));
  const locales = new AlmacenLocalesFicheros(join(carpeta, 'locales'));
  await locales.guardar(Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8'))));
  refs = {
    piezas: { listar: async () => [] } as unknown as DepsReferencias['piezas'],
    piezasHechas: new PiezasHechasFicheros(join(carpeta, 'proyectos')),
    locales,
    referencias: new AlmacenReferenciasFicheros(join(carpeta, 'locales')),
    biblioteca: new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(RAIZ, 'biblioteca', 'referencias')),
    enlaces: { obtener: async () => ({ estado: 'PIDE_CAPTURA', motivo: 'x' }) },
    leerArchivo: (ruta) => readFile(ruta),
    ahora: () => '2026-11-15T10:00:00.000Z',
  };
});
after(() => rm(carpeta, { recursive: true, force: true }));

describe('Puntos 3 y 4 · ficha automática y aptitud de la imagen', () => {
  it('un mockup, una marca de agua o un collage se rechazan; una captura con interfaz se acepta con aviso', () => {
    assert.equal(decidirAptitud({ tipo: 'POST', problemas: [] }), 'ACEPTA');
    assert.equal(decidirAptitud({ tipo: 'CAPTURA_CON_INTERFAZ', problemas: ['iconos de Pinterest abajo'] }), 'AVISA');
    for (const tipo of ['MOCKUP', 'MARCA_DE_AGUA', 'COLLAGE'] as const) assert.equal(decidirAptitud({ tipo, problemas: [] }), 'RECHAZA');
  });

  it('un post limpio recibe su ficha (GEMINI); un mockup con marca de agua se rechaza y la orden pide otra referencia', async () => {
    await registrarReferencia(refs, { local: 'asador-etxebarri', id: 'ref-limpia', imagen: FOTO });
    await registrarReferencia(refs, { local: 'asador-etxebarri', id: 'ref-mockup', imagen: FOTO });
    const analista = new AnalistaReferenciasSimulado([{ aptitud: { tipo: 'POST', problemas: [] } }, { aptitud: { tipo: 'MARCA_DE_AGUA', problemas: ['«Xtreme Flyers» en diagonal sobre todo el post'] } }]);
    const limpia = await analizarReferencia({ ...refs, analista }, { local: 'asador-etxebarri', id: 'ref-limpia' });
    assert.equal(limpia.ficha?.analizadaPor, 'GEMINI');
    assert.equal(limpia.ficha?.titulo, FICHA_SIMULADA.titulo);
    assert.equal(comprobarPasoAConcepto({ piezasReales: 0, referencia: limpia }).puede, true);
    const mockup = await analizarReferencia({ ...refs, analista }, { local: 'asador-etxebarri', id: 'ref-mockup' });
    assert.equal(mockup.ficha, undefined);
    const paso = comprobarPasoAConcepto({ piezasReales: 0, referencia: mockup });
    assert.equal(paso.puede, false);
    assert.match(paso.motivo, /no es un post publicado \(MARCA_DE_AGUA: «Xtreme Flyers»/);
  });

  it('la orden ya no se para por una referencia sin ficha: el analista la escribe y sigue', async () => {
    await registrarReferencia(refs, { local: 'asador-etxebarri', id: 'ref-nueva', imagen: FOTO });
    const d: DepsPost = {
      raiz: RAIZ,
      proyectos: join(carpeta, 'proyectos'),
      activos: new AlmacenActivosFicheros(join(carpeta, 'datos', 'locales')),
      referencias: refs,
      director: new DirectorFotoSimulado(),
      generador: new GeneradorFotoSimulado(),
      revisor: new RevisorVisualSimulado(),
      segmentador: new SegmentadorSimulado(),
      componedor: new ComponedorProyectos(RAIZ, join(carpeta, 'datos')),
      analista: new AnalistaReferenciasSimulado(),
      ahora: () => '2026-11-15T10:00:00.000Z',
    };
    await crearEncargo(d, { proyecto: 'con-ref-nueva', local: 'asador-etxebarri', plato: 'Gamba roja de Palamós a la brasa', foto: FOTO, referencia: 'ref-nueva', simulado: true });
    const r = await avanzar(d, 'con-ref-nueva');
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.ok(r.mensajes.some((m) => /Ficha automática de ref-nueva/.test(m)));
    assert.equal(r.encargo.estetica, 'EDITORIAL_OSCURO', 'la estética sale de la familia de la ficha automática (F4)');
  });

  it('el analista de Gemini lleva las familias, el ejemplo y el esquema, y valida la respuesta', async () => {
    const familias = await refs.biblioteca.familias();
    const t = instruccionesAnalista(familias, FICHA_SIMULADA);
    assert.match(t, /F3 · Color plano de oferta con recurso/);
    assert.match(t, /MARCA_DE_AGUA/);
    const fetchFalso: typeof fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ aptitud: { tipo: 'MOCKUP', problemas: ['un móvil'] }, ficha: FICHA_SIMULADA }) }] } }] }), { status: 200 });
    const r = await new AnalistaReferenciasGemini(new ClienteGemini('k', ['m'], { fetch: fetchFalso, dormir: async () => {} }), ['m'], familias).analizar(FOTO);
    assert.equal(r.aptitud.tipo, 'MOCKUP');
  });
});
