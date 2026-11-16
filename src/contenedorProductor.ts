/**
 * Productor (fase 1): enciende el orquestador sobre las dependencias de la orden. Con el productor encendido, la orden
 * recibe los ganchos (antesDePaso / trasPaso) y los especialistas van envueltos en sus decoradores: el brief llega a los
 * directores y al crítico, el revisor compara contra el inventario confirmado y las llamadas de texto y visión pasan por
 * el presupuesto. No cambia nada más (el generador, el segmentador y el componedor siguen igual). Se enciende con
 * ESTUDIO_PRODUCTOR=si o con la opción --productor; apagado, las dependencias quedan como estaban. La fase 1 no hace
 * ninguna llamada de IA nueva: el productor es solo código.
 */
import { AlmacenBriefFicheros } from './adaptadores/ficheros/AlmacenBriefFicheros.js';
import { analistaConPresupuesto, criticoConBrief, directorDisenoConBrief, directorFotoConBrief, revisorConInventario } from './adaptadores/productor/decoradores.js';
import { crearOrquestador } from './aplicacion/productor/orquestador.js';
import type { DepsPost } from './aplicacion/post/ordenPost.js';

/** Enciende el productor sobre unas dependencias de la orden: los ganchos y los especialistas envueltos. No cambia nada más. */
export function conProductor<T extends DepsPost>(deps: T, opciones: { proyecto: string }): T {
  const orq = crearOrquestador({
    proyectos: deps.proyectos,
    almacen: new AlmacenBriefFicheros(deps.proyectos),
    locales: deps.referencias.locales,
    ahora: deps.ahora,
  });
  const f = orq.fuente(opciones.proyecto);
  return {
    ...deps,
    productor: orq,
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
