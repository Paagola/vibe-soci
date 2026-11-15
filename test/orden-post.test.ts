/**
 * Orden única de punta a punta (09/11/2026), con director, generador, revisor y máscara simulados, en carpetas temporales.
 * El compositor es el de verdad. Sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { ComponedorProyectos } from '../src/adaptadores/compositor/ComponedorProyectos.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenReferenciasFicheros } from '../src/adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../src/adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { PiezasHechasFicheros } from '../src/adaptadores/ficheros/PiezasHechasFicheros.js';
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from '../src/adaptadores/simulado/FotoSimulada.js';
import { avanzar, cortarPorPalabras, crearEncargo, type DepsPost } from '../src/aplicacion/post/ordenPost.js';
import { registrarReferencia } from '../src/aplicacion/referencias/registrarReferencia.js';
import type { DepsReferencias } from '../src/aplicacion/referencias/dependencias.js';
import { RAIZ } from '../src/config.js';
import { Marca } from '../src/dominio/modelos.js';
import { descartesSeguidos, trasComprobar } from '../src/dominio/post.js';
import type { GeneradorFoto } from '../src/puertos/Foto.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');
let carpeta: string;
let refs: DepsReferencias;

function deps(opciones: { revisor?: RevisorVisualSimulado; generador?: GeneradorFoto } = {}): DepsPost {
  return {
    raiz: RAIZ,
    proyectos: join(carpeta, 'proyectos'),
    activos: new AlmacenActivosFicheros(join(carpeta, 'datos', 'locales')),
    referencias: refs,
    director: new DirectorFotoSimulado(),
    generador: opciones.generador ?? new GeneradorFotoSimulado(),
    revisor: opciones.revisor ?? new RevisorVisualSimulado(),
    segmentador: new SegmentadorSimulado(),
    componedor: new ComponedorProyectos(RAIZ, join(carpeta, 'datos')),
    ahora: () => '2026-11-09T21:00:00.000Z',
  };
}

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-orden-'));
  const locales = new AlmacenLocalesFicheros(join(carpeta, 'locales'));
  await locales.guardar(Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8')))); // asador-etxebarri
  refs = {
    piezas: { listar: async () => [] } as unknown as DepsReferencias['piezas'],
    piezasHechas: new PiezasHechasFicheros(join(carpeta, 'proyectos')),
    locales,
    referencias: new AlmacenReferenciasFicheros(join(carpeta, 'locales')),
    biblioteca: new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(RAIZ, 'biblioteca', 'referencias')),
    enlaces: { obtener: async () => ({ estado: 'PIDE_CAPTURA', motivo: 'x' }) },
    leerArchivo: (ruta) => readFile(ruta),
    ahora: () => '2026-11-09T21:00:00.000Z',
  };
  await registrarReferencia(refs, { local: 'asador-etxebarri', id: 'ref-post-30', deBiblioteca: 'post-30' });
});
after(() => rm(carpeta, { recursive: true, force: true }));

const nuevo = (d: DepsPost, proyecto: string, referencia?: string) =>
  crearEncargo(d, { proyecto, local: 'asador-etxebarri', plato: 'Gamba roja de Palamós a la brasa con sal gruesa', foto: FOTO, ...(referencia ? { referencia } : {}), simulado: true });

describe('Orden única · reglas del dominio', () => {
  it('dos descartes seguidos bloquean; uno vuelve a generar; PASA y REVISAR van a tu parada', () => {
    const i = (final: 'PASA' | 'DESCARTA' | 'RECHAZADA') => ({ n: 1, activo: 'x', final, motivos: [], costeUsd: 0 });
    assert.equal(descartesSeguidos([i('PASA'), i('DESCARTA'), i('RECHAZADA')]), 2);
    assert.equal(trasComprobar('DESCARTA', [i('DESCARTA')]).paso, 'GENERAR');
    assert.match(trasComprobar('DESCARTA', [i('DESCARTA'), i('DESCARTA')]).bloqueo ?? '', /2 fotos descartadas/);
    assert.equal(trasComprobar('REVISAR', [i('DESCARTA')]).paso, 'CONFIRMAR_FOTO');
    assert.equal(cortarPorPalabras('Gamba roja de Palamós a la brasa con sal gruesa', 40), 'Gamba roja de Palamós a la brasa con sal');
  });
});

describe('Orden única · de punta a punta (simulada)', () => {
  it('sin referencia, con menos de 5 piezas, se bloquea y propone familias', async () => {
    const d = deps();
    await nuevo(d, 'sin-referencia');
    let r = await avanzar(d, 'sin-referencia');
    assert.equal(r.encargo.paso, 'REFERENCIA');
    assert.match(r.parada, /FALTA LA REFERENCIA.*Familias propuestas: F4/);
    // Al poner la referencia en post.json, la orden sigue sin más.
    const ruta = join(carpeta, 'proyectos', 'sin-referencia', 'post.json');
    const encargo = JSON.parse(await readFile(ruta, 'utf8'));
    await writeFile(ruta, JSON.stringify({ ...encargo, referencia: 'ref-post-30' }));
    r = await avanzar(d, 'sin-referencia');
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
  });

  it('recorre todo: paradas de elementos y de foto, borrador de intención, composición y pieza que cuenta', async () => {
    const d = deps();
    await nuevo(d, 'gamba', 'ref-post-30');
    let r = await avanzar(d, 'gamba');
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.match(r.parada, /CONFIRMA LOS ELEMENTOS Y EL GASTO/);
    r = await avanzar(d, 'gamba', { confirmo: true });
    assert.equal(r.encargo.paso, 'CONFIRMAR_FOTO', 'confirmar elementos no confirma también la foto');
    assert.equal(r.encargo.intentos[0]?.final, 'PASA');
    r = await avanzar(d, 'gamba', { confirmo: true });
    assert.equal(r.encargo.paso, 'INTENCION');
    assert.match(r.parada, /FALTA LA INTENCIÓN DE DISEÑO/);
    const foto = await d.activos.obtener('asador-etxebarri', 'gamba-foto-1');
    assert.equal(foto.activo.fidelidad?.veredicto, 'CONSERVA', 'tu confirmación queda como veredicto humano');
    assert.equal(foto.activo.revisionAutomatica?.final, 'PASA');
    assert.ok(foto.activo.mascara);

    const intenciones = join(carpeta, 'proyectos', 'gamba', 'intenciones');
    await copyFile(join(intenciones, 'post.borrador.json'), join(intenciones, 'post.json'));
    r = await avanzar(d, 'gamba');
    assert.equal(r.parada, 'HECHO');
    const plan = JSON.parse(await readFile(join(carpeta, 'proyectos', 'gamba', 'plan.json'), 'utf8'));
    assert.deepEqual(plan.pieza, { fecha: '2026-11-09', referencia: 'ref-post-30' });
    const hechas = await new PiezasHechasFicheros(join(carpeta, 'proyectos')).listar();
    assert.ok(hechas.some((p) => p.proyecto === 'gamba'), 'la pieza cuenta para el umbral');
    await readFile(join(carpeta, 'datos', 'disenos', 'gamba', 'post', 'v001', 'exportadas', '4x5.jpg'));
  });

  it('dos fotos descartadas seguidas: se para; al volver a confirmar, otros dos intentos', async () => {
    const revisor = new RevisorVisualSimulado([{ checklist: { anadidos: ['un posavasos'] } }, { toma: { mismoPuntoDeVista: true } }, {}]);
    const generador = new GeneradorFotoSimulado();
    const d = deps({ revisor, generador });
    await nuevo(d, 'descartes', 'ref-post-30');
    await avanzar(d, 'descartes');
    let r = await avanzar(d, 'descartes', { confirmo: true });
    assert.equal(generador.peticiones.length, 2, 'dos intentos, y no más');
    assert.match(r.parada, /BLOQUEADO en CONFIRMAR_ELEMENTOS: 2 fotos descartadas/);
    assert.deepEqual(r.encargo.intentos.map((i) => i.final), ['DESCARTA', 'DESCARTA']);
    r = await avanzar(d, 'descartes');
    assert.match(r.parada, /BLOQUEADO/, 'sin --confirmo no sigue');
    r = await avanzar(d, 'descartes', { confirmo: true });
    assert.equal(generador.peticiones.length, 3);
    assert.equal(r.encargo.paso, 'CONFIRMAR_FOTO');
  });

  it('si rechazas la foto, vuelve a generar', async () => {
    const generador = new GeneradorFotoSimulado();
    const d = deps({ generador });
    await nuevo(d, 'rechazo', 'ref-post-30');
    await avanzar(d, 'rechazo');
    await avanzar(d, 'rechazo', { confirmo: true });
    const r = await avanzar(d, 'rechazo', { rechazo: 'la gamba está cortada' });
    assert.equal(r.encargo.intentos[0]?.final, 'RECHAZADA');
    assert.equal(generador.peticiones.length, 2);
    assert.equal(r.encargo.paso, 'CONFIRMAR_FOTO');
  });

  it('sin facturación no genera nada: explica cómo seguir y acepta una foto importada a mano', async () => {
    const sinFacturacion: GeneradorFoto = {
      nombre: 'Gemini sin facturación',
      disponible: () => ({ ok: false, motivo: 'la facturación de Gemini no está activada (GEMINI_FACTURACION=no)' }),
      estimarUsd: async () => {
        throw new Error('no debe estimar');
      },
      generar: async () => {
        throw new Error('no debe generar');
      },
    };
    const d = deps({ generador: sinFacturacion });
    await nuevo(d, 'manual', 'ref-post-30');
    await avanzar(d, 'manual');
    let r = await avanzar(d, 'manual', { confirmo: true });
    assert.equal(r.encargo.paso, 'GENERAR');
    assert.match(r.parada, /No puedo generar: la facturación de Gemini no está activada.*--importar/);
    r = await avanzar(d, 'manual', { importar: FOTO });
    assert.equal(r.encargo.paso, 'CONFIRMAR_FOTO');
    const foto = await d.activos.obtener('asador-etxebarri', 'manual-foto-1');
    assert.match(String(foto.activo.procedencia.generacion?.modelo), /importada a mano/);
  });
});

describe('F3.2 (punto 9) · la orden manda la referencia como @image2 solo si el encargo lo pide', () => {
  it('con «estiloDeReferencia»: la referencia reducida a 768 px va como @image2 y el prompt dice su papel', async () => {
    const generador = new GeneradorFotoSimulado();
    const d = deps({ generador });
    await crearEncargo(d, { proyecto: 'estilo', local: 'asador-etxebarri', plato: 'Gamba roja de Palamós a la brasa con sal gruesa', foto: FOTO, referencia: 'ref-post-30', simulado: true, estiloDeReferencia: true });
    await avanzar(d, 'estilo');
    await avanzar(d, 'estilo', { confirmo: true });
    const p = generador.peticiones[0]!;
    assert.equal(p.referencias.length, 2);
    assert.match(p.referencias[1]!.etiqueta, /^@image2/);
    const meta = await sharp(p.referencias[1]!.ruta).metadata();
    assert.ok(Math.max(meta.width ?? 0, meta.height ?? 0) <= 768);
    assert.match(p.prompt, /@image2 is a published reference post used ONLY as a style reference/);
    // Sin la opción, como siempre: solo la foto real.
    const g2 = new GeneradorFotoSimulado();
    const d2 = deps({ generador: g2 });
    await nuevo(d2, 'sin-estilo', 'ref-post-30');
    await avanzar(d2, 'sin-estilo');
    await avanzar(d2, 'sin-estilo', { confirmo: true });
    assert.equal(g2.peticiones[0]!.referencias.length, 1);
  });
});
