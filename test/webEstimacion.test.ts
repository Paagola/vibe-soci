import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Generacion, Pieza } from '../src/dominio/modelos.js';
import { DURACION_POR_DEFECTO_MS, mediaDeImagenes, restanteMs } from '../src/web/estimacion.js';
import { RegistroTrabajos } from '../src/web/trabajos.js';

const generacion = (creada: string, terminada: string | undefined, cambios: Partial<Generacion> = {}): Generacion => ({
  diapositiva: 1,
  version: 1,
  origen: 'API',
  modelo: 'm',
  prompt: 'p',
  referencias: [],
  estado: 'COMPLETADA',
  creadaEn: creada,
  terminadaEn: terminada,
  ...cambios,
});

const piezaCon = (generaciones: Generacion[]) => ({ generaciones }) as unknown as Pieza;

describe('estimación del tiempo restante', () => {
  it('usa la media real de las imágenes terminadas de ese origen', () => {
    const piezas = [
      piezaCon([
        generacion('2026-11-03T10:00:00Z', '2026-11-03T10:01:00Z'),
        generacion('2026-11-03T11:00:00Z', '2026-11-03T11:02:00Z'),
        generacion('2026-11-03T12:00:00Z', '2026-11-03T12:00:01Z', { origen: 'SIMULADO' }),
        generacion('2026-11-03T13:00:00Z', undefined),
        generacion('2026-11-03T14:00:00Z', '2026-11-03T14:09:00Z', { estado: 'FALLIDA' }),
      ]),
    ];
    assert.equal(mediaDeImagenes(piezas, 'API'), 90_000);
    assert.equal(mediaDeImagenes(piezas, 'SIMULADO'), 1_000);
    assert.equal(mediaDeImagenes([], 'API'), undefined);
  });

  it('cuenta el director y las tandas de imágenes (las de una tanda van en paralelo)', () => {
    assert.equal(restanteMs({ director: 1, tandas: 2 }, { directorMs: 60_000, imagenMs: 90_000 }), 240_000);
  });

  it('el registro da una cuenta atrás, no baja de 0 y avisa de «casi listo»', async () => {
    let ahora = 0;
    const registro = new RegistroTrabajos(() => ahora);
    let avanzar!: () => void;
    const fin = new Promise<void>((r) => (avanzar = r));

    const trabajo = registro.lanzar({
      tipo: 'GENERAR',
      piezaId: 'p',
      medias: { directorMs: 60_000, imagenMs: DURACION_POR_DEFECTO_MS.imagen.API },
      ejecutar: async (alProgresar) => {
        alProgresar({ mensaje: 'Generando la portada…', hechas: 0, total: 3, pasosRestantes: { director: 0, tandas: 2 } });
        await fin;
      },
    });
    await Promise.resolve();
    assert.equal(registro.vista(trabajo).quedanSegundos, 180);

    ahora = 60_000;
    assert.equal(registro.vista(trabajo).quedanSegundos, 120);

    ahora = 400_000;
    assert.deepEqual([registro.vista(trabajo).quedanSegundos, registro.vista(trabajo).casiListo], [0, true]);
    assert.throws(() => registro.lanzar({ tipo: 'GENERAR', piezaId: 'p', medias: { directorMs: 1, imagenMs: 1 }, ejecutar: async () => {} }), /en curso/);

    avanzar();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(registro.vista(trabajo).estado, 'TERMINADO');
    assert.equal(registro.vista(trabajo).fraccion, 1);
  });

  it('los avisos van al trabajo en curso y los errores se guardan con el formato de la API', async () => {
    const registro = new RegistroTrabajos();
    const trabajo = registro.lanzar({
      tipo: 'CONCEPTOS',
      piezaId: 'q',
      medias: { directorMs: 1, imagenMs: 1 },
      ejecutar: async () => {
        registro.avisar('gemini-3.8-flash no responde ahora. Sigo con gemini-3.5-flash.');
        throw new Error('boom');
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(trabajo.avisos, ['gemini-3.8-flash no responde ahora. Sigo con gemini-3.5-flash.']);
    assert.equal(trabajo.estado, 'ERROR');
    assert.equal(trabajo.error?.code, 'ERROR_INTERNO');
    assert.equal(registro.avisar('suelto'), false);
  });
});
