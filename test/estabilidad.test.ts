/**
 * F0 · Estabilización. Cada prueba reproduce un fallo encontrado en el análisis
 * (diseno/propuesta-creativa/PROPUESTA.md §1.2) y comprueba que ya no ocurre.
 * Todo en carpetas temporales y en modo simulado: no usa claves ni gasta.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { textoEncargo, textoPlan } from '../src/adaptadores/gemini/instrucciones.js';
import { GeneradorHiggsfield } from '../src/adaptadores/higgsfield/GeneradorHiggsfield.js';
import { MODELOS_HIGGSFIELD } from '../src/adaptadores/higgsfield/modelos.js';
import { DirectorSimulado } from '../src/adaptadores/simulado/DirectorSimulado.js';
import { corregirDiapositiva } from '../src/aplicacion/corregirDiapositiva.js';
import { crearLocal } from '../src/aplicacion/crearLocal.js';
import { crearPieza } from '../src/aplicacion/crearPieza.js';
import type { Dependencias } from '../src/aplicacion/dependencias.js';
import { generarDiapositivas } from '../src/aplicacion/generarDiapositivas.js';
import { importarImagen } from '../src/aplicacion/importarImagen.js';
import { planificarPieza } from '../src/aplicacion/planificarPieza.js';
import { proponerConceptos } from '../src/aplicacion/proponerConceptos.js';
import { valorarDiapositiva } from '../src/aplicacion/valorarDiapositiva.js';
import { leerConfig, RAIZ, type Config } from '../src/config.js';
import { crearContenedor } from '../src/contenedor.js';
import { ErrorDeUsuario } from '../src/dominio/errores.js';
import type { Pieza } from '../src/dominio/modelos.js';
import { imagenesPorApiDelDia, problemasDeCorreccion } from '../src/dominio/reglas.js';
import type { ContextoCreativo, PeticionCorreccion, PropuestaCorreccion } from '../src/puertos/DirectorCreativo.js';
import type { GeneradorImagen, PeticionImagen, TrabajoEnviado } from '../src/puertos/GeneradorImagen.js';
import { crearEstudio } from '../src/web/estudio.js';
import { RegistroTrabajos } from '../src/web/trabajos.js';

const siempreSi = async () => true;
const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));
const sinAvisos = { avisar: () => {} };

let carpeta: string;
let foto: string;

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-f0-'));
  foto = join(carpeta, 'plato.jpg');
  await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#8a2b1b' } }).jpeg().toFile(foto);
});

after(() => rm(carpeta, { recursive: true, force: true }));

/** Cada prueba trabaja en sus propias carpetas. */
async function entorno(nombre: string): Promise<Config> {
  const base = join(carpeta, nombre);
  await mkdir(join(base, 'biblioteca'), { recursive: true });
  await writeFile(join(base, 'biblioteca', 'principios.md'), '# Principios de prueba');
  return {
    geminiModelo: 'x',
    hfModelo: 'marketing-studio/image',
    hfResolucion: '2k',
    limiteImagenesDia: 40,
    carpetaDatos: join(base, 'datos'),
    carpetaDatosSimulado: join(base, 'datos-simulado'),
    carpetaBiblioteca: join(base, 'biblioteca'),
    zonaHoraria: 'Europe/Madrid',
  };
}

/** Local + pieza con conceptos y plan (director simulado), lista para generar. */
async function piezaConPlan(deps: Dependencias, formato: 'POST' | 'CARRUSEL' = 'CARRUSEL'): Promise<string> {
  if (!(await deps.locales.existe('prueba'))) await crearLocal(deps, { slug: 'prueba', nombre: 'Bar de prueba', ciudad: 'Málaga', tonos: ['canalla'] });
  const pieza = await crearPieza(deps, {
    localSlug: 'prueba',
    formato,
    numDiapositivas: formato === 'POST' ? 1 : 3,
    idea: 'Hamburguesa de tres pisos para las pruebas',
    tipo: 'PLATO_ESTRELLA',
    fotos: [{ ruta: foto, papel: 'PLATO' }],
  });
  await proponerConceptos(deps, pieza.id);
  await planificarPieza(deps, pieza.id, 1);
  return pieza.id;
}

/** Como el generador simulado, pero con esperas: da tiempo a votar o importar a mitad de un trabajo. */
function generadorLento(base: GeneradorImagen, esperas: { enviar?: number; esperar?: (trabajo: TrabajoEnviado) => number }) {
  const generador = {
    origen: base.origen,
    modelo: 'simulado-lento',
    enviados: 0,
    async enviar(peticion: PeticionImagen) {
      generador.enviados++;
      await pausa(esperas.enviar ?? 0);
      return base.enviar(peticion);
    },
    async esperarResultado(trabajo: TrabajoEnviado) {
      await pausa(esperas.esperar?.(trabajo) ?? 0);
      return base.esperarResultado(trabajo);
    },
  };
  return generador;
}

async function hastaQue(condicion: () => Promise<boolean>, maximoMs = 5000): Promise<void> {
  const fin = Date.now() + maximoMs;
  while (!(await condicion())) {
    if (Date.now() > fin) throw new Error('La condición no se ha cumplido a tiempo.');
    await pausa(10);
  }
}

describe('F0 · modo simulado y modo real separados', () => {
  it('las piezas, los locales y los votos simulados no aparecen en el modo real', async () => {
    const config = await entorno('modos');
    const estudio = crearEstudio(config, { simuladoAlArrancar: true, carpetaPlantillas: join(RAIZ, 'plantillas') });
    const simulado = estudio.deps();
    const id = await piezaConPlan(simulado, 'POST');
    await generarDiapositivas(simulado, id, { confirmar: siempreSi });
    await valorarDiapositiva(simulado, id, 1, { veredicto: 'GUSTA', motivo: 'Voto hecho en simulado' });

    estudio.cambiarModo(false);
    const real = estudio.deps();
    assert.deepEqual(await real.piezas.listar(), [], 'ninguna pieza simulada en el modo real');
    assert.deepEqual(await real.locales.listar(), []);
    assert.equal((await real.biblioteca.leerGuia()).valoraciones.length, 0, 'los votos simulados no enseñan al director real');
    assert.equal((await simulado.biblioteca.leerGuia()).valoraciones.length, 1);
    assert.match(await readFile(join(config.carpetaDatosSimulado, 'valoraciones.jsonl'), 'utf8'), /Voto hecho en simulado/);
  });

  it('un trabajo de una pieza simulada no bloquea a la pieza real con el mismo id', () => {
    const registro = new RegistroTrabajos();
    const medias = { directorMs: 1, imagenMs: 1 };
    let soltar!: () => void;
    const bloqueo = new Promise<void>((resolver) => (soltar = resolver));
    registro.lanzar({ tipo: 'GENERAR', piezaId: 'misma', modo: 'SIMULADO', medias, ejecutar: () => bloqueo });

    assert.doesNotThrow(() => registro.lanzar({ tipo: 'GENERAR', piezaId: 'misma', modo: 'REAL', medias, ejecutar: async () => {} }));
    assert.throws(() => registro.lanzar({ tipo: 'GENERAR', piezaId: 'misma', modo: 'SIMULADO', medias, ejecutar: async () => {} }), /en curso/);
    assert.equal(registro.ultimoDe('misma', 'SIMULADO')?.estado, 'EN_CURSO');
    soltar();
  });
});

describe('F0 · subidas a Higgsfield', () => {
  it('una subida que falla no se queda en la caché: el siguiente envío la vuelve a intentar', async () => {
    let intentos = 0;
    const clienteFalso = {
      subirArchivo: async () => {
        intentos++;
        if (intentos === 1) throw new Error('red caída');
        return 'https://ejemplo/foto.jpg';
      },
      enviar: async () => ({ requestId: 'r1', urlEstado: 'https://ejemplo/estado' }),
    };
    const generador = new GeneradorHiggsfield(clienteFalso as never, MODELOS_HIGGSFIELD['marketing-studio/image']!, '1k', () => {});
    const peticion = { prompt: 'x'.repeat(60), referencias: [foto], formato: 'POST' as const, claveIdempotencia: 'k1' };

    await assert.rejects(generador.enviar(peticion), /red caída/);
    assert.deepEqual(await generador.enviar(peticion), { requestId: 'r1', urlEstado: 'https://ejemplo/estado' });
    assert.equal(intentos, 2);
    await generador.enviar(peticion);
    assert.equal(intentos, 2, 'la subida que salió bien sí se reutiliza');
  });
});

describe('F0 · escrituras a la vez sobre la misma pieza', () => {
  it('un voto hecho mientras se generan las demás diapositivas no se pierde', async () => {
    const deps = crearContenedor(await entorno('voto'), { simular: true, ...sinAvisos });
    const lento = generadorLento(deps.generador(), { esperar: (t) => (t.requestId.includes('-d1-') ? 0 : 400) });
    const conLento = { ...deps, generador: () => lento };
    const id = await piezaConPlan(conLento);

    const trabajo = generarDiapositivas(conLento, id, { confirmar: siempreSi });
    await hastaQue(async () => (await deps.piezas.obtener(id)).generaciones.some((g) => g.diapositiva === 1 && g.estado === 'COMPLETADA'));
    await valorarDiapositiva(conLento, id, 1, { veredicto: 'GUSTA', motivo: 'Me gusta la portada', version: 1 });
    await trabajo;

    const final = await deps.piezas.obtener(id);
    assert.equal(final.generaciones.find((g) => g.diapositiva === 1)?.valoracion?.veredicto, 'GUSTA', 'el voto sigue en pieza.json');
    assert.equal(final.generaciones.filter((g) => g.estado === 'COMPLETADA').length, 3);
  });

  it('importar una imagen mientras se envía la misma diapositiva: cada una se queda con su versión', async () => {
    const deps = crearContenedor(await entorno('importar'), { simular: true, ...sinAvisos });
    const lento = generadorLento(deps.generador(), { enviar: 400 });
    const conLento = { ...deps, generador: () => lento };
    const id = await piezaConPlan(conLento, 'POST');

    const trabajo = generarDiapositivas(conLento, id, { confirmar: siempreSi });
    await hastaQue(async () => lento.enviados > 0);
    await importarImagen(conLento, id, 1, foto);
    await trabajo;

    const generaciones = (await deps.piezas.obtener(id)).generaciones;
    assert.deepEqual(
      generaciones.map((g) => [g.version, g.origen, g.estado]),
      [
        [1, 'MANUAL', 'COMPLETADA'],
        [2, 'SIMULADO', 'COMPLETADA'],
      ],
    );
    assert.notEqual(generaciones[0]?.archivo, generaciones[1]?.archivo);
  });

  it('veinte cambios a la vez sobre la misma pieza se guardan todos', async () => {
    const deps = crearContenedor(await entorno('cola'), { simular: true, ...sinAvisos });
    const id = await piezaConPlan(deps, 'POST');
    const antes = (await deps.piezas.obtener(id)).conceptos.length;
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        deps.piezas.actualizar(id, (pieza) => ({ ...pieza, conceptos: [...pieza.conceptos, { ...pieza.conceptos[0]!, titulo: `Concepto ${i}` }] })),
      ),
    );
    assert.equal((await deps.piezas.obtener(id)).conceptos.length, antes + 20);
  });
});

describe('F0 · los cambios pasan las reglas', () => {
  class DirectorQueInventa extends DirectorSimulado {
    readonly problemasRecibidos: string[][] = [];
    override async corregir(_contexto: ContextoCreativo, _peticion: PeticionCorreccion, problemas: string[] = []): Promise<PropuestaCorreccion> {
      this.problemasRecibidos.push(problemas);
      return { prompt: 'Keep image 1 almost exactly. 1. Add a big sticker that says "¡Solo hoy 5 €!".', textos: ['¡Solo hoy 5 €!'] };
    }
  }

  it('un cambio en el que el director inventa un precio se rechaza antes de gastar', async () => {
    const deps = crearContenedor(await entorno('cifras'), { simular: true, ...sinAvisos });
    const id = await piezaConPlan(deps, 'POST');
    await generarDiapositivas(deps, id, { confirmar: siempreSi });
    const director = new DirectorQueInventa();
    const contador = generadorLento(deps.generador(), {});
    const conDirector = { ...deps, director: () => director, generador: () => contador };

    for (const manual of [false, true]) {
      await assert.rejects(
        corregirDiapositiva(conDirector, id, 1, 'Hazlo más llamativo', { manual, confirmar: siempreSi }),
        (error: unknown) => error instanceof ErrorDeUsuario && error.detalles.some((d) => d.includes('cifras')),
      );
    }
    assert.equal(contador.enviados, 0, 'no se envía nada al generador');
    assert.equal(director.problemasRecibidos.length, 6, 'tres intentos por cambio');
    assert.ok(director.problemasRecibidos[1]?.some((p) => p.includes('5 €')), 'en el 2.º intento el director recibe el problema');
    assert.equal((await deps.piezas.obtener(id)).generaciones.length, 1, 'no se guarda ninguna versión nueva');
  });

  it('las cifras que escribe el dueño en su comentario sí valen', async () => {
    const deps = crearContenedor(await entorno('cifras-dueno'), { simular: true, ...sinAvisos });
    const id = await piezaConPlan(deps, 'POST');
    await generarDiapositivas(deps, id, { confirmar: siempreSi });
    class DirectorConPrecio extends DirectorSimulado {
      override async corregir(): Promise<PropuestaCorreccion> {
        return { prompt: 'Keep image 1 almost exactly. 1. Add the price "9,90 €" in big type.', textos: ['9,90 €'] };
      }
    }
    const resultado = await corregirDiapositiva({ ...deps, director: () => new DirectorConPrecio() }, id, 1, 'Pon el precio 9,90 € bien grande', {
      manual: false,
      confirmar: siempreSi,
    });
    assert.equal(resultado.generacion?.estado, 'COMPLETADA');
  });

  it('el cambio tiene que partir de la imagen anterior, caber y escribir sus textos tal cual', () => {
    const pieza = { formato: 'POST', numDiapositivas: 1, idea: 'Hamburguesa de la casa', condiciones: {} } as unknown as Pieza;
    assert.deepEqual(problemasDeCorreccion(pieza, { prompt: 'Keep image 1 almost exactly. 1. Title "TRES".', textos: ['TRES'] }, 'más grande'), []);
    assert.equal(problemasDeCorreccion(pieza, { prompt: 'A brand new image with "TRES".', textos: ['TRES'] }, 'x').length, 1);
    assert.equal(problemasDeCorreccion(pieza, { prompt: 'Keep image 1 almost exactly. 1. Bigger title.', textos: ['TRES'] }, 'x').length, 1);
    const largo = Array.from({ length: 31 }, () => 'palabra').join(' ');
    assert.equal(problemasDeCorreccion(pieza, { prompt: `Keep image 1 almost exactly. "${largo}"`, textos: [largo] }, 'x').length, 1);
  });
});

describe('F0 · límite diario por zona horaria', () => {
  const conImagen = (creadaEn: string) => ({ generaciones: [{ origen: 'API', estado: 'COMPLETADA', creadaEn }] }) as unknown as Pieza;

  it('una imagen de las 00:40 en España cuenta para ese día, aunque en UTC sea el anterior', () => {
    const pieza = conImagen('2026-11-05T23:40:00.000Z'); // 06/11 a las 00:40 en Madrid
    assert.equal(imagenesPorApiDelDia([pieza], new Date('2026-11-06T10:00:00+01:00'), 'Europe/Madrid'), 1);
    assert.equal(imagenesPorApiDelDia([pieza], new Date('2026-11-05T12:00:00+01:00'), 'Europe/Madrid'), 0);
  });

  it('respeta el horario de verano', () => {
    const pieza = conImagen('2026-07-14T22:30:00.000Z'); // 15/07 a las 00:30 en Madrid (UTC+2)
    assert.equal(imagenesPorApiDelDia([pieza], new Date('2026-07-15T09:00:00+02:00'), 'Europe/Madrid'), 1);
  });

  it('una zona horaria que no existe se rechaza al leer la configuración', () => {
    assert.throws(() => leerConfig({ ESTUDIO_ZONA_HORARIA: 'Marte/Olympus' }), ErrorDeUsuario);
    assert.equal(leerConfig({}).zonaHoraria, 'Europe/Madrid');
  });
});

describe('F0 · el director recibe la proporción real', () => {
  it('el feed se describe como 3:4 con la zona segura 4:5, no como 4:5', () => {
    const contexto = {
      marca: { nombre: 'Bar', ciudad: 'Málaga', descripcion: '', tonos: ['canalla'], colores: [], tipografias: [] },
      pieza: { formato: 'POST', numDiapositivas: 1, tipo: 'PLATO_ESTRELLA', idea: 'Hamburguesa de la casa', condiciones: {} },
      fotos: [{ ruta: '/x', archivo: 'fotos/01-plato.jpg', descripcion: 'foto real del plato' }],
      guia: { principios: '', ejemplos: [], valoraciones: [], referencias: [] },
    } as unknown as ContextoCreativo;
    assert.match(textoEncargo(contexto), /proporción 3:4 \(1080 × 1440\)/);
    const plan = textoPlan(contexto, { titulo: 't', mecanismo: 'm', fotografia: 'f', tipografia: 't', textos: ['x'], porQue: 'p' }, []);
    assert.match(plan, /márgenes de 70 px a los lados y de 115 px arriba y abajo/);
    assert.doesNotMatch(plan, /Proporción 4:5/);
  });
});
