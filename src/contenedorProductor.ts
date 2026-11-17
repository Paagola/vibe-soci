import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProductorEditorial } from './aplicacion/productor/editorial.js';
import type { Orquestador } from './aplicacion/productor/orquestador.js';
import { AlmacenBriefFicheros } from './adaptadores/ficheros/AlmacenBriefFicheros.js';
import { analistaConPresupuesto, criticoConBrief, directorDisenoConBrief, directorFotoConBrief, revisorConInventario } from './adaptadores/productor/decoradores.js';
import { crearOrquestador } from './aplicacion/productor/orquestador.js';
import type { DepsPost } from './aplicacion/post/ordenPost.js';
import type { QuienLlama } from './puertos/FuenteDelBrief.js';

/** Enciende el productor sobre unas dependencias de la orden: los ganchos y los especialistas envueltos. No cambia nada más. */
export function conProductor<T extends DepsPost>(deps: T, opciones: {
  proyecto: string; editorial?: ProductorEditorial; conectarTransporte?: (orquestador: Orquestador) => void;
  alIntervenir?: (especialista: QuienLlama) => void;
}): T {
  const orq = crearOrquestador({
    proyectos: deps.proyectos,
    almacen: new AlmacenBriefFicheros(deps.proyectos),
    locales: deps.referencias.locales,
    ahora: deps.ahora,
    ...(opciones.editorial ? { direccion: {
      productor: opciones.editorial,
      foto: e => deps.activos.obtener(e.local, e.activoReal!),
      oficio: () => readFile(join(deps.raiz, 'conocimiento', 'referencias', 'oficio-en-redes.md'), 'utf8'),
      ficha: async e => e.referencia ? JSON.stringify((await deps.referencias.referencias.obtener(e.local, e.referencia)).ficha) : undefined,
    } } : {}),
    presupuestoEnTransporte: Boolean(opciones.conectarTransporte),
    alIntervenir: opciones.alIntervenir,
  });
  opciones.conectarTransporte?.(orq);
  const f = orq.fuente(opciones.proyecto);
  const critico = deps.criticoEditorial;
  return {
    ...deps,
    productor: orq,
    ...(critico ? { criticoEditorial: {
      get modelo() { return critico.modelo; },
      revisar: async (entrada: Parameters<typeof critico.revisar>[0]) => {
        await f.antesDeLlamar('critico');
        return critico.revisar(entrada);
      },
    } } : {}),
    director: directorFotoConBrief(deps.director, f),
    revisor: revisorConInventario(deps.revisor, f),
    ...(deps.analista ? { analista: analistaConPresupuesto(deps.analista, f) } : {}),
    ...(deps.disenador
      ? {
          disenador: {
            ...deps.disenador,
            director: directorDisenoConBrief(deps.disenador.director, f),
            ...(deps.disenador.critico ? { critico: criticoConBrief(deps.disenador.critico, f) } : {}),
          },
        }
      : {}),
  };
}
