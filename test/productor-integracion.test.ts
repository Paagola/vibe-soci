/**
 * Productor (fase 1), integración de punta a punta en simulado: la orden única con el productor encendido o apagado,
 * con dobles propios para el director de foto, el revisor y el director de diseño. Carpetas temporales, sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ComponedorProyectos } from '../src/adaptadores/compositor/ComponedorProyectos.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenReferenciasFicheros } from '../src/adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../src/adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { PiezasHechasFicheros } from '../src/adaptadores/ficheros/PiezasHechasFicheros.js';
import { MedidorDeFotoSharp } from '../src/adaptadores/imagen/MedidorDeFotoSharp.js';
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from '../src/adaptadores/simulado/FotoSimulada.js';
import { corregirPropuesta } from '../src/aplicacion/post/corregirPropuesta.js';
import { avanzar, crearEncargo, type DepsPost } from '../src/aplicacion/post/ordenPost.js';
import { registrarReferencia } from '../src/aplicacion/referencias/registrarReferencia.js';
import type { DepsReferencias } from '../src/aplicacion/referencias/dependencias.js';
import { crearDepsPost } from '../src/contenedorPost.js';
import { conProductor } from '../src/contenedorProductor.js';
import { leerConfig, RAIZ } from '../src/config.js';
import type { ChecklistVisual } from '../src/dominio/comprobacionSalida.js';
import { ErrorDeServicio } from '../src/dominio/errores.js';
import type { PropuestaFotoNueva } from '../src/dominio/fotoNueva.js';
import { Marca } from '../src/dominio/modelos.js';
import type { PropuestaDeDiseno } from '../src/dominio/diseno/propuesta.js';
import type { DirectorDeDiseno, EncargoDeDiseno } from '../src/puertos/DirectorDeDiseno.js';
import type { DirectorDeFoto, EncargoDeFoto } from '../src/puertos/Foto.js';
import type { ParDeFotos, RevisorVisual } from '../src/puertos/RevisorVisual.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');
const GAMBA = 'Gamba roja de Palamós a la brasa con sal gruesa';
const NOTA = 'Tabla de sushi: nigiris de salmón, gunkan de toro y uramaki de atún';
const AHORA = '2026-11-09T21:00:00.000Z';
let carpeta: string;
let refs: DepsReferencias;

/** Director de foto propio: los elementos de la tabla de sushi (el gunkan de toro es el que la foto cambia). */
class DirectorSushi implements DirectorDeFoto {
  readonly nombre = 'director sushi simulado';
  private readonly base = new DirectorFotoSimulado();

  async proponer(e: EncargoDeFoto): Promise<PropuestaFotoNueva> {
    const propuesta = await this.base.proponer(e);
    return {
      ...propuesta,
      descripcion: {
        ...propuesta.descripcion,
        elementos: [
          { nombre: 'nigiri de salmón', estado: 'salmón sobre arroz', recuento: 4, ingles: 'salmon nigiri on rice', enEncuadre: true },
          { nombre: 'gunkan de toro', estado: 'tartar de toro sobre arroz y alga', recuento: 2, ingles: 'toro tartare gunkan with rice and seaweed', enEncuadre: true },
        ],
      },
    };
  }
}

/** Revisor propio: el simulado, pero si recibe el inventario confirmado con el gunkan de toro, dice que la foto lo cambió por rollitos. */
class RevisorRollitos implements RevisorVisual {
  readonly nombre = 'revisor rollitos simulado';
  readonly listas: string[] = [];
  private readonly simulado = new RevisorVisualSimulado();

  async comprobarElementos(fotos: ParDeFotos, lista: string): Promise<ChecklistVisual> {
    this.listas.push(lista);
    const checklist = await this.simulado.comprobarElementos(fotos, lista);
    if (lista.includes('INVENTARIO CONFIRMADO POR EL DUEÑO') && lista.includes('gunkan de toro')) {
      return { ...checklist, cambiados: ['rollitos de papel de arroz en lugar del gunkan de toro'] };
    }
    return checklist;
  }

  compararToma() {
    return this.simulado.compararToma();
  }

  contarAnatomia(generada: string, piezas: Array<{ nombre: string; esperado: number }>) {
    return this.simulado.contarAnatomia(generada, piezas);
  }
}

/** Director de diseño que solo graba el encargo que recibe y no responde (la orden lo deja en borrador y se para). */
class GrabadorDeEncargo implements DirectorDeDiseno {
  readonly nombre = 'grabador de encargos';
  readonly encargos: EncargoDeDiseno[] = [];

  async proponer(e: EncargoDeDiseno): Promise<PropuestaDeDiseno> {
    this.encargos.push(e);
    throw new ErrorDeServicio('Gemini', 'simulado: sin respuesta', false);
  }
}

function deps(opciones: { director?: DirectorDeFoto; revisor?: RevisorVisual; disenador?: DepsPost['disenador'] } = {}): DepsPost {
  return {
    raiz: RAIZ,
    proyectos: join(carpeta, 'proyectos'),
    activos: new AlmacenActivosFicheros(join(carpeta, 'datos', 'locales')),
    referencias: refs,
    director: opciones.director ?? new DirectorFotoSimulado(),
    generador: new GeneradorFotoSimulado(),
    revisor: opciones.revisor ?? new RevisorVisualSimulado(),
    segmentador: new SegmentadorSimulado(),
    componedor: new ComponedorProyectos(RAIZ, join(carpeta, 'datos')),
    ...(opciones.disenador ? { disenador: opciones.disenador } : {}),
    ahora: () => AHORA,
  };
}

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-productor-'));
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
    ahora: () => AHORA,
  };
  await registrarReferencia(refs, { local: 'asador-etxebarri', id: 'ref-post-30', deBiblioteca: 'post-30' });
});
after(() => rm(carpeta, { recursive: true, force: true }));

const nuevo = (d: DepsPost, proyecto: string, plato = GAMBA) =>
  crearEncargo(d, { proyecto, local: 'asador-etxebarri', plato, foto: FOTO, referencia: 'ref-post-30', simulado: true });

const carpetaDe = (proyecto: string) => join(carpeta, 'proyectos', proyecto);
const existe = (ruta: string) => stat(ruta).then(() => true, () => false);
const bitacora = async (proyecto: string) =>
  (await readFile(join(carpetaDe(proyecto), 'bitacora.jsonl'), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((linea) => JSON.parse(linea) as { quien: string; tipo: string; texto: string });

describe('Productor · apagado es como antes', () => {
  it('sin productor, la gamba llega a HECHO igual que siempre y no escribe brief.json ni bitacora.jsonl', async () => {
    const d = deps();
    await nuevo(d, 'apagado');
    await avanzar(d, 'apagado');
    await avanzar(d, 'apagado', { confirmo: true });
    await avanzar(d, 'apagado', { confirmo: true });
    const intenciones = join(carpetaDe('apagado'), 'intenciones');
    await copyFile(join(intenciones, 'post.borrador.json'), join(intenciones, 'post.json'));
    const r = await avanzar(d, 'apagado');
    assert.equal(r.parada, 'HECHO');
    assert.equal(await existe(join(carpetaDe('apagado'), 'brief.json')), false);
    assert.equal(await existe(join(carpetaDe('apagado'), 'bitacora.jsonl')), false);
  });
});

describe('Productor · el revisor compara contra el inventario confirmado', () => {
  it('con productor, el intento 1 sale DESCARTA por el cambio del gunkan; el revisor recibió el inventario', async () => {
    const revisor = new RevisorRollitos();
    const d = conProductor(deps({ director: new DirectorSushi(), revisor }), { proyecto: 'rollitos' });
    await nuevo(d, 'rollitos', NOTA);
    const r1 = await avanzar(d, 'rollitos');
    assert.equal(r1.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    const r2 = await avanzar(d, 'rollitos', { confirmo: true, via: 'terminal' });
    const intento1 = r2.encargo.intentos[0];
    assert.equal(intento1?.final, 'DESCARTA');
    assert.match(intento1?.motivos.join(' | ') ?? '', /cambiado respecto a la foto real/);
    assert.ok(revisor.listas.some((l) => l.includes('INVENTARIO CONFIRMADO POR EL DUEÑO')));
  });

  it('sin productor, la lista no lleva el inventario y el intento 1 sale PASA', async () => {
    const revisor = new RevisorRollitos();
    const d = deps({ director: new DirectorSushi(), revisor });
    await nuevo(d, 'rollitos-sin', NOTA);
    await avanzar(d, 'rollitos-sin');
    const r = await avanzar(d, 'rollitos-sin', { confirmo: true });
    assert.equal(r.encargo.intentos[0]?.final, 'PASA');
    assert.ok(revisor.listas.length > 0);
    assert.ok(revisor.listas.every((l) => !l.includes('INVENTARIO CONFIRMADO POR EL DUEÑO')));
  });
});

describe('Productor · la confirmación necesita vía', () => {
  it('con productor, confirmar los elementos sin vía se rechaza y la orden sigue en CONFIRMAR_ELEMENTOS', async () => {
    const d = conProductor(deps(), { proyecto: 'sin-via' });
    await nuevo(d, 'sin-via');
    await avanzar(d, 'sin-via');
    const r = await avanzar(d, 'sin-via', { confirmo: true });
    assert.match(r.parada, /CONFIRMACIÓN RECHAZADA/);
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
  });
});

describe('Productor · la toma de jamón se valida antes de gastar', () => {
  const nota = 'Pata de jamón y dos platos blancos de lonchas en espiral';
  const jamon = { nombre: 'Pata de jamón', estado: 'sobre el jamonero', recuento: 1, ingles: 'ham leg on the ham stand', enEncuadre: true };
  const platos = { nombre: 'Platos blancos', estado: 'con lonchas en espiral', recuento: 2, ingles: 'white plates with ham slices in a spiral', enEncuadre: true };
  const base = new DirectorFotoSimulado();

  async function propuestaDeJamon(e: EncargoDeFoto): Promise<PropuestaFotoNueva> {
    const propuesta = await base.proponer(e);
    propuesta.descripcion.elementos = [{ ...jamon }, { ...platos }];
    propuesta.huecos.plato = 'ham on a stand';
    // Un texto antiguo o del modelo que omite los platos no es la lista que se envía al generador.
    propuesta.huecos.elementos = 'only the ham leg on the ham stand';
    propuesta.huecos.recuento = 'un texto viejo';
    return propuesta;
  }

  const casos: Array<{ id: string; cambiar: (p: PropuestaFotoNueva) => void; problema: RegExp }> = [
    {
      id: 'jamon-inventado',
      cambiar(p) {
        p.huecos.plato = 'acorn-fed ibérico ham';
        p.huecos.origen = 'in a bodega';
      },
      problema: /iberico.*acorn-fed.*bodega/s,
    },
    {
      id: 'jamon-sin-frase',
      cambiar(p) { delete p.descripcion.elementos[1]!.ingles; },
      problema: /Platos blancos» no tiene su frase/,
    },
    {
      id: 'jamon-fuera-de-toma',
      cambiar(p) { p.descripcion.elementos[1]!.enEncuadre = false; },
      problema: /deja fuera «Platos blancos»/,
    },
    {
      id: 'jamon-encuadre-sin-revisar',
      cambiar(p) { delete p.descripcion.elementos[1]!.enEncuadre; },
      problema: /No consta si «Platos blancos» entra/,
    },
  ];

  for (const { id, cambiar, problema } of casos) {
    it(`detiene ${id} antes de generar, aunque se intente confirmar`, async () => {
      const generador = new GeneradorFotoSimulado();
      const motivosDeRevision: string[][] = [];
      const director: DirectorDeFoto = {
        nombre: 'director jamón simulado',
        async proponer(e, problemas) {
          motivosDeRevision.push(problemas);
          const propuesta = await propuestaDeJamon(e);
          cambiar(propuesta);
          return propuesta;
        },
      };
      const d = conProductor({ ...deps({ director }), generador }, { proyecto: id });
      await nuevo(d, id, nota);
      const primera = await avanzar(d, id);
      assert.equal(primera.encargo.paso, 'CONFIRMAR_ELEMENTOS');
      assert.equal(motivosDeRevision.length, 2);
      assert.match(motivosDeRevision[1]!.join(' '), problema);

      const confirmada = await avanzar(d, id, { confirmo: true, via: 'web' });
      assert.equal(confirmada.encargo.paso, 'CONFIRMAR_ELEMENTOS');
      assert.match(confirmada.parada, problema);
      assert.equal(generador.peticiones.length, 0);
      assert.ok(!(await bitacora(id)).some((e) => e.tipo === 'CONFIRMACION'));
    });
  }

  it('monta el prompt desde el inventario y usa la corrección guardada tras confirmar', async () => {
    const id = 'jamon-corregido';
    const generador = new GeneradorFotoSimulado();
    const director = { nombre: 'director jamón simulado', proponer: propuestaDeJamon };
    const d = conProductor({ ...deps({ director }), generador }, { proyecto: id });
    await nuevo(d, id, nota);
    const r = await avanzar(d, id);
    assert.equal(r.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.match(r.encargo.propuesta?.prompt ?? '', /2 × white plates with ham slices in a spiral/);
    assert.equal(generador.peticiones.length, 0);

    const archivo = join(carpetaDe(id), 'foto', 'propuesta.json');
    const { propuesta } = JSON.parse(await readFile(archivo, 'utf8')) as { propuesta: PropuestaFotoNueva };
    const elemento = propuesta.descripcion.elementos[1]!;
    elemento.estado = 'lonchas finas en espiral';
    delete elemento.ingles;
    const correccion = await corregirPropuesta(d, id, propuesta);
    assert.deepEqual(correccion.problemas, []);
    assert.match(correccion.prompt, /2 × Platos blancos, lonchas finas en espiral/);

    const segunda = await avanzar(d, id, { confirmo: true, via: 'web' });
    assert.equal(segunda.encargo.paso, 'CONFIRMAR_FOTO');
    assert.equal(generador.peticiones.length, 1);
    assert.equal(generador.peticiones[0]?.prompt, correccion.prompt);
  });
});

describe('Productor · el brief llega al director de diseño', () => {
  const grabador = new GrabadorDeEncargo();

  it('el encargo de diseño lleva el inventario confirmado y la nota del dueño', async () => {
    const d = conProductor(deps({ director: new DirectorSushi(), disenador: { director: grabador, medidor: new MedidorDeFotoSharp() } }), { proyecto: 'diseno' });
    await nuevo(d, 'diseno', NOTA);
    await avanzar(d, 'diseno');
    await avanzar(d, 'diseno', { confirmo: true, via: 'terminal' });
    const r = await avanzar(d, 'diseno', { confirmo: true, via: 'terminal' });
    assert.match(r.parada, /FALTA LA INTENCIÓN DE DISEÑO/);
    assert.equal(grabador.encargos.length, 1);
    const contexto = grabador.encargos[0]?.contexto ?? '';
    assert.match(contexto, /CONFIRMADO por el usuario/);
    assert.match(contexto, /Nota del dueño/);
  });

  it('al final de ese caso, la bitácora tiene ENCARGO, CONFIRMACION de usuario, INFORME de revisor y LLAMADAS de revisor', async () => {
    const entradas = await bitacora('diseno');
    const indice = (quien: string, tipo: string) => entradas.findIndex((x) => x.quien === quien && x.tipo === tipo);
    const encargo = indice('productor', 'ENCARGO');
    const confirmacion = indice('usuario', 'CONFIRMACION');
    const informe = indice('revisor', 'INFORME');
    const llamada = entradas.findIndex((x) => x.quien === 'revisor' && x.tipo === 'LLAMADA');
    assert.ok(encargo >= 0, 'hay ENCARGO');
    assert.ok(confirmacion > encargo, 'la confirmación del usuario viene después del encargo');
    assert.ok(informe > confirmacion, 'el informe del revisor viene después de la confirmación');
    assert.ok(llamada > confirmacion, 'hay una llamada del revisor tras la confirmación');
  });
});

describe('Productor · el contenedor lo enciende con la configuración', () => {
  it('ESTUDIO_PRODUCTOR=si enciende; sin variable, apagado; con la opción productor, encendido', async () => {
    const encendido = await crearDepsPost(leerConfig({ ESTUDIO_PRODUCTOR: 'si' }), { simular: true, proyecto: 'x' });
    assert.ok(encendido.productor);
    const apagado = await crearDepsPost(leerConfig({}), { simular: true, proyecto: 'x' });
    assert.equal(apagado.productor, undefined);
    const porOpcion = await crearDepsPost(leerConfig({}), { simular: true, proyecto: 'x', productor: true });
    assert.ok(porOpcion.productor);
  });
});
