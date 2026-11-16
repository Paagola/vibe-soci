/**
 * Productor (fase 1): el orquestador en código, con la orden única simulada (director, generador, revisor y máscara
 * simulados, compositor de verdad) en carpetas temporales. Sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ComponedorProyectos } from '../src/adaptadores/compositor/ComponedorProyectos.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenBriefFicheros } from '../src/adaptadores/ficheros/AlmacenBriefFicheros.js';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenReferenciasFicheros } from '../src/adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../src/adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { PiezasHechasFicheros } from '../src/adaptadores/ficheros/PiezasHechasFicheros.js';
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from '../src/adaptadores/simulado/FotoSimulada.js';
import { crearOrquestador, type Orquestador } from '../src/aplicacion/productor/orquestador.js';
import { avanzar, crearEncargo, type Accion, type DepsPost } from '../src/aplicacion/post/ordenPost.js';
import { registrarReferencia } from '../src/aplicacion/referencias/registrarReferencia.js';
import type { DepsReferencias } from '../src/aplicacion/referencias/dependencias.js';
import { RAIZ } from '../src/config.js';
import { cambiarBrief } from '../src/dominio/brief.js';
import { Marca } from '../src/dominio/modelos.js';
import type { GeneradorFoto } from '../src/puertos/Foto.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');
const AHORA = '2026-11-09T21:00:00.000Z';
let carpeta: string;
let carpetaProyectos: string;
let refs: DepsReferencias;

function deps(opciones: { revisor?: RevisorVisualSimulado; generador?: GeneradorFoto } = {}): DepsPost {
  return {
    raiz: RAIZ,
    proyectos: carpetaProyectos,
    activos: new AlmacenActivosFicheros(join(carpeta, 'datos', 'locales')),
    referencias: refs,
    director: new DirectorFotoSimulado(),
    generador: opciones.generador ?? new GeneradorFotoSimulado(),
    revisor: opciones.revisor ?? new RevisorVisualSimulado(),
    segmentador: new SegmentadorSimulado(),
    componedor: new ComponedorProyectos(RAIZ, join(carpeta, 'datos')),
    ahora: () => AHORA,
  };
}

/** El orquestador sobre los mismos proyectos que la orden. */
function conOrq(d: DepsPost): { d: DepsPost; orq: Orquestador } {
  const orq = crearOrquestador({
    proyectos: d.proyectos,
    almacen: new AlmacenBriefFicheros(d.proyectos),
    locales: refs.locales,
    ahora: d.ahora,
  });
  return { d: { ...d, productor: orq }, orq };
}

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-orquestador-'));
  carpetaProyectos = join(carpeta, 'proyectos');
  const locales = new AlmacenLocalesFicheros(join(carpeta, 'locales'));
  await locales.guardar(Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8')))); // asador-etxebarri
  refs = {
    piezas: { listar: async () => [] } as unknown as DepsReferencias['piezas'],
    piezasHechas: new PiezasHechasFicheros(carpetaProyectos),
    locales,
    referencias: new AlmacenReferenciasFicheros(join(carpeta, 'locales')),
    biblioteca: new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(RAIZ, 'biblioteca', 'referencias')),
    enlaces: { obtener: async () => ({ estado: 'PIDE_CAPTURA', motivo: 'x' }) },
    leerArchivo: (ruta) => readFile(ruta),
    ahora: () => AHORA,
  };
  await registrarReferencia(refs, { local: 'asador-etxebarri', id: 'ref-post-30', deBiblioteca: 'post-30' });
});
after(() => rm(carpeta, { recursive: true, force: true }));

const nuevo = (d: DepsPost, proyecto: string) =>
  crearEncargo(d, { proyecto, local: 'asador-etxebarri', plato: 'Gamba roja de Palamós a la brasa con sal gruesa', foto: FOTO, referencia: 'ref-post-30', simulado: true });

const ruta = (proyecto: string, archivo: string) => join(carpetaProyectos, proyecto, archivo);
const leerJson = async (proyecto: string, archivo: string) => JSON.parse(await readFile(ruta(proyecto, archivo), 'utf8'));
type EntradaLeida = { quien: string; paso: string; tipo: string; texto: string };
const bitacora = async (proyecto: string): Promise<EntradaLeida[]> =>
  (await readFile(ruta(proyecto, 'bitacora.jsonl'), 'utf8')).split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as EntradaLeida);

const CONFIRMO_TERMINAL: Accion = { confirmo: true, via: 'terminal' };

describe('Productor (fase 1) · el orquestador', () => {
  it('1. encargo nuevo con productor: para en elementos con el brief v1 escrito por el código', async () => {
    const p = 'orq-uno';
    const base = deps();
    await nuevo(base, p);
    const { d } = conOrq(base);
    const r = await avanzar(d, p);
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.match(r.parada, /CONFIRMA LOS ELEMENTOS Y EL GASTO/);
    assert.match(r.parada, /Inventario que congela tu --confirmo/);

    const brief = await leerJson(p, 'brief.json');
    assert.equal(brief.version, 1);
    assert.equal(brief.modo, 'CODIGO');
    assert.equal(brief.idea, null);
    assert.equal(brief.hechos.inventario.estado, 'PROPUESTO');

    const bit = await bitacora(p);
    assert.ok(bit.some((x) => x.tipo === 'ENCARGO' && x.quien === 'productor'));
    assert.ok(bit.some((x) => x.tipo === 'DEGRADADO'));
    assert.ok(bit.some((x) => x.tipo === 'INFORME' && x.quien === 'director-foto'));
  });

  it('2. confirmar sin vía: la parada es CONFIRMACIÓN RECHAZADA, el encargo y el brief no se mueven', async () => {
    const p = 'orq-dos';
    const base = deps();
    await nuevo(base, p);
    const { d } = conOrq(base);

    const r = await avanzar(d, p, { confirmo: true });
    assert.match(r.parada, /CONFIRMACIÓN RECHAZADA/);
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    const brief = await leerJson(p, 'brief.json');
    assert.equal(brief.version, 1);
    assert.equal(brief.hechos.inventario.estado, 'PROPUESTO');

    const r2 = await avanzar(d, p, { confirmo: true, via: 'script' as never });
    assert.match(r2.parada, /CONFIRMACIÓN RECHAZADA/);
    assert.equal(r2.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.equal((await leerJson(p, 'brief.json')).version, 1);
  });

  it('3. confirmar desde la terminal: congela el inventario en el brief v2 y llega a CONFIRMAR_FOTO', async () => {
    const p = 'orq-tres';
    const base = deps();
    await nuevo(base, p);
    const { d } = conOrq(base);
    await avanzar(d, p);

    const r = await avanzar(d, p, CONFIRMO_TERMINAL);
    assert.equal(r.encargo.paso, 'CONFIRMAR_FOTO');
    const brief = await leerJson(p, 'brief.json');
    assert.equal(brief.version, 2);
    assert.equal(brief.hechos.inventario.estado, 'CONFIRMADO');
    assert.equal(brief.hechos.inventario.confirmadoPor.via, 'terminal');
    assert.ok((await bitacora(p)).some((x) => x.tipo === 'CONFIRMACION' && x.quien === 'usuario'));
  });

  it('4. inventario cambiado tras confirmar (rollitos): CONFLICTO CON EL BRIEF y el encargo se queda en CONFIRMAR_FOTO', async () => {
    const p = 'orq-cuatro';
    const base = deps();
    await nuevo(base, p);
    const { d } = conOrq(base);
    await avanzar(d, p);
    assert.equal((await avanzar(d, p, CONFIRMO_TERMINAL)).encargo.paso, 'CONFIRMAR_FOTO');

    const rutaPropuesta = ruta(p, 'foto/propuesta.json');
    const json = JSON.parse(await readFile(rutaPropuesta, 'utf8'));
    json.propuesta.descripcion.elementos[0].nombre = 'rollitos de papel de arroz';
    await writeFile(rutaPropuesta, `${JSON.stringify(json, null, 2)}\n`);

    const r = await avanzar(d, p, CONFIRMO_TERMINAL);
    assert.match(r.parada, /CONFLICTO CON EL BRIEF/);
    assert.equal(r.encargo.paso, 'CONFIRMAR_FOTO');
    assert.ok((await bitacora(p)).some((x) => x.tipo === 'CONFLICTO'));
  });

  it('5. encargo empezado sin productor y seguido con productor: no se crea brief y la parada no lo menciona', async () => {
    const p = 'orq-cinco';
    const base = deps();
    await nuevo(base, p);
    assert.equal((await avanzar(base, p)).encargo.paso, 'CONFIRMAR_ELEMENTOS');

    const { d } = conOrq(base);
    const r = await avanzar(d, p);
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.ok(!r.parada.includes('PRODUCTOR'));
    await assert.rejects(stat(ruta(p, 'brief.json')));
  });

  it('6. presupuesto de llamadas de texto: la segunda llamada se corta y queda en la bitácora', async () => {
    const p = 'orq-seis';
    const base = deps();
    await nuevo(base, p);
    const { d, orq } = conOrq(base);
    await avanzar(d, p);

    const almacen = new AlmacenBriefFicheros(carpetaProyectos);
    const brief = await almacen.leer(p);
    assert.ok(brief);
    await almacen.guardar(cambiarBrief(brief, { ...brief, presupuesto: { ...brief.presupuesto, llamadasTexto: 1 } }, AHORA));

    await orq.fuente(p).antesDeLlamar('revisor');
    await assert.rejects(orq.fuente(p).antesDeLlamar('revisor'), /Presupuesto de llamadas/);

    const bit = await bitacora(p);
    assert.ok(bit.some((x) => x.tipo === 'LLAMADA'));
    assert.ok(bit.some((x) => x.tipo === 'PRESUPUESTO'));
  });

  it('7. textos (rollitos): COTEJO DE TEXTOS para la intención que nombra lo que la nota no dice; con «Gamba roja» llega a HECHO', async () => {
    const p = 'orq-siete';
    const base = deps();
    await nuevo(base, p);
    const { d } = conOrq(base);
    await avanzar(d, p);
    await avanzar(d, p, CONFIRMO_TERMINAL);
    const enIntencion = await avanzar(d, p, CONFIRMO_TERMINAL);
    assert.match(enIntencion.parada, /FALTA LA INTENCIÓN DE DISEÑO/);

    const intenciones = ruta(p, 'intenciones');
    const borrador = JSON.parse(await readFile(join(intenciones, 'post.borrador.json'), 'utf8'));
    borrador.textos.titular = 'Rollitos de papel de arroz';
    await writeFile(join(intenciones, 'post.json'), `${JSON.stringify(borrador, null, 2)}\n`);

    const r = await avanzar(d, p);
    assert.match(r.parada, /COTEJO DE TEXTOS/);
    assert.equal(r.encargo.paso, 'COMPONER');

    borrador.textos.titular = 'Gamba roja';
    await writeFile(join(intenciones, 'post.json'), `${JSON.stringify(borrador, null, 2)}\n`);
    const fin = await avanzar(d, p);
    assert.equal(fin.parada, 'HECHO');
  });

  it('8. fuente: el contexto solo con brief; el inventario confirmado solo después de confirmar', async () => {
    const p = 'orq-ocho';
    const base = deps();
    await nuevo(base, p);
    const { d, orq } = conOrq(base);
    const fuente = orq.fuente(p);
    assert.equal(await fuente.contexto(), undefined);
    assert.equal(await fuente.inventarioConfirmado(), undefined);

    await avanzar(d, p);
    assert.match(await fuente.contexto() ?? '', /Nota del dueño/);
    assert.equal(await fuente.inventarioConfirmado(), undefined);

    await avanzar(d, p, CONFIRMO_TERMINAL);
    const confirmado = await fuente.inventarioConfirmado();
    assert.ok(confirmado && confirmado.length > 0);
  });
});
