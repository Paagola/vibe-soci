/**
 * Ganchos del productor en la orden única, y la «via» de la confirmación (terminal interactiva con el productor encendido).
 * Mismo andamiaje que orden-post.test.ts: director, generador, revisor y máscara simulados, en carpetas temporales. Sin red ni gasto.
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
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from '../src/adaptadores/simulado/FotoSimulada.js';
import { viaDeLaTerminal, type AccionVista, type GanchosDeOrden } from '../src/aplicacion/post/ganchos.js';
import { avanzar, crearEncargo, type DepsPost } from '../src/aplicacion/post/ordenPost.js';
import { registrarReferencia } from '../src/aplicacion/referencias/registrarReferencia.js';
import type { DepsReferencias } from '../src/aplicacion/referencias/dependencias.js';
import { RAIZ } from '../src/config.js';
import { ErrorDeUsuario } from '../src/dominio/errores.js';
import { Marca } from '../src/dominio/modelos.js';
import type { PasoPost } from '../src/dominio/post.js';
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
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-ganchos-'));
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

/** Un productor de prueba: cada método es opcional y, si no se da, no hace nada. */
function gancho(partes: { antes?: GanchosDeOrden['antesDePaso']; tras?: GanchosDeOrden['trasPaso'] } = {}): GanchosDeOrden {
  return {
    antesDePaso: partes.antes ?? (async () => ({})),
    trasPaso: partes.tras ?? (async () => ({})),
  };
}

describe('Ganchos · viaDeLaTerminal', () => {
  it('con el productor encendido, confirmar desde un script (sin terminal interactiva) lanza un error de usuario', () => {
    assert.throws(
      () => viaDeLaTerminal({ productor: true, confirmaORechaza: true, interactiva: false }),
      (error: unknown) => error instanceof ErrorDeUsuario && /terminal interactiva/.test(error.message),
    );
  });

  it('con terminal interactiva, la confirmación viene de la terminal', () => {
    assert.equal(viaDeLaTerminal({ productor: true, confirmaORechaza: true, interactiva: true }), 'terminal');
  });

  it('con el productor apagado y sin terminal, no hay via (como hasta ahora)', () => {
    assert.equal(viaDeLaTerminal({ productor: false, confirmaORechaza: true, interactiva: false }), undefined);
  });

  it('sin confirmar ni rechazar, no hay via aunque sea una terminal interactiva', () => {
    assert.equal(viaDeLaTerminal({ productor: true, confirmaORechaza: false, interactiva: true }), undefined);
    assert.equal(viaDeLaTerminal({ productor: false, confirmaORechaza: false, interactiva: false }), undefined);
  });
});

describe('Ganchos · en la orden', () => {
  it('antesDePaso puede parar la orden antes de un paso, con notas que quedan en el historial guardado', async () => {
    const d: DepsPost = {
      ...deps(),
      productor: gancho({
        antes: async (paso) => (paso === 'PROPUESTA' ? { parar: 'ALTO DEL PRODUCTOR', notas: ['nota previa'] } : {}),
      }),
    };
    await nuevo(d, 'gancho-antes', 'ref-post-30');
    const r = await avanzar(d, 'gancho-antes');
    assert.equal(r.parada, 'ALTO DEL PRODUCTOR');
    assert.equal(r.encargo.paso, 'PROPUESTA');
    assert.ok(r.mensajes.includes('nota previa'));
    const guardado = JSON.parse(await readFile(join(carpeta, 'proyectos', 'gancho-antes', 'post.json'), 'utf8'));
    assert.equal(guardado.paso, 'PROPUESTA');
    assert.ok(guardado.historial.some((h: { nota: string }) => h.nota === 'nota previa'));
  });

  it('trasPaso añade su texto a la parada que ya da el paso', async () => {
    const d: DepsPost = {
      ...deps(),
      productor: gancho({
        tras: async (_paso, _anterior, _encargo, _accion, parada) => (parada ? { textoParada: 'TEXTO EXTRA' } : {}),
      }),
    };
    await nuevo(d, 'gancho-texto', 'ref-post-30');
    const r = await avanzar(d, 'gancho-texto');
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.match(r.parada, /CONFIRMA LOS ELEMENTOS Y EL GASTO/);
    assert.ok(r.parada.endsWith('\nTEXTO EXTRA'), r.parada);
  });

  it('trasPaso puede parar la orden tras un paso que no paraba; el encargo ya está en el paso siguiente', async () => {
    const d: DepsPost = {
      ...deps(),
      productor: gancho({
        tras: async (paso) => (paso === 'FOTO_REAL' ? { parar: 'PARO TRAS FOTO_REAL' } : {}),
      }),
    };
    await nuevo(d, 'gancho-paro', 'ref-post-30');
    const r = await avanzar(d, 'gancho-paro');
    assert.equal(r.parada, 'PARO TRAS FOTO_REAL');
    assert.equal(r.encargo.paso, 'PROPUESTA', 'el paso FOTO_REAL se completó');
    const guardado = JSON.parse(await readFile(join(carpeta, 'proyectos', 'gancho-paro', 'post.json'), 'utf8'));
    assert.equal(guardado.paso, 'PROPUESTA');
  });

  it('el gancho ve la acción: la confirmación y su via en el paso confirmado, y acción vacía en los siguientes', async () => {
    const vistos: Array<{ paso: PasoPost; accion: AccionVista }> = [];
    const d: DepsPost = {
      ...deps(),
      productor: gancho({
        antes: async (paso, _encargo, accion) => {
          vistos.push({ paso, accion: { ...accion } });
          return {};
        },
      }),
    };
    await nuevo(d, 'gancho-accion', 'ref-post-30');
    await avanzar(d, 'gancho-accion');
    vistos.length = 0;

    await avanzar(d, 'gancho-accion', { confirmo: true, via: 'terminal' });

    const confirmar = vistos.find((v) => v.paso === 'CONFIRMAR_ELEMENTOS');
    assert.ok(confirmar, 'antesDePaso vio CONFIRMAR_ELEMENTOS');
    assert.equal(confirmar.accion.via, 'terminal');
    assert.equal(confirmar.accion.confirmo, true);
    const siguientes = vistos.filter((v) => v.paso !== 'CONFIRMAR_ELEMENTOS');
    assert.ok(siguientes.length > 0, 'hay pasos después de la confirmación en la misma llamada');
    for (const v of siguientes) assert.deepEqual(v.accion, {}, `en ${v.paso} la acción ya está usada`);
  });

  it('sin productor, la orden no cambia: para en CONFIRMAR_ELEMENTOS con su parada de siempre', async () => {
    const d = deps();
    await nuevo(d, 'sin-productor', 'ref-post-30');
    const r = await avanzar(d, 'sin-productor');
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.match(r.parada, /CONFIRMA LOS ELEMENTOS Y EL GASTO/);
    assert.ok(!r.parada.includes('TEXTO EXTRA'));
  });
});
