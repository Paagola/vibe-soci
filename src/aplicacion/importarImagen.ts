import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { ErrorDeUsuario } from '../dominio/errores.js';
import type { Generacion } from '../dominio/modelos.js';
import { generacionesDe, problemaDeFoto, rutaGenerada, siguienteVersion } from '../dominio/reglas.js';
import type { Dependencias } from './dependencias.js';
import { comprobarFotoDePieza, conGeneracion } from './ejecutarGeneracion.js';
import { trabajoDelPlan } from './trabajoDeDiapositiva.js';

export const MODELO_MANUAL = 'manual (web de Higgsfield)';

/**
 * Vía manual: registra una imagen generada fuera (p. ej. Nano Banana Pro en la web de Higgsfield).
 * Si había una corrección pendiente para esa diapositiva, la completa con su prompt.
 */
export async function importarImagen(
  deps: Pick<Dependencias, 'piezas' | 'reloj'>,
  piezaId: string,
  posicion: number,
  rutaOrigen: string,
): Promise<Generacion> {
  trabajoDelPlan(await deps.piezas.obtener(piezaId), posicion); // falla pronto si la pieza no tiene esa diapositiva

  const bytes = await stat(rutaOrigen).then((info) => (info.isFile() ? info.size : undefined), () => undefined);
  const problema = problemaDeFoto(bytes === undefined ? rutaOrigen : basename(rutaOrigen), bytes);
  if (problema) throw new ErrorDeUsuario(problema);

  // La versión se decide y el archivo se copia con la pieza bloqueada: si a la vez se está generando
  // esa diapositiva, cada una se queda con su propia versión.
  let generacion!: Generacion;
  await deps.piezas.actualizar(piezaId, async (pieza) => {
    const trabajo = trabajoDelPlan(pieza, posicion);
    await comprobarFotoDePieza(deps, pieza, rutaOrigen);
    const pendiente = generacionesDe(pieza, posicion).findLast((g) => g.estado === 'PENDIENTE_MANUAL');
    const version = pendiente?.version ?? siguienteVersion(pieza, posicion);
    const archivo = rutaGenerada(posicion, version, extname(rutaOrigen).slice(1).toLowerCase());
    generacion = pendiente
      ? { ...pendiente, estado: 'COMPLETADA', archivo }
      : {
          diapositiva: posicion,
          version,
          origen: 'MANUAL',
          modelo: MODELO_MANUAL,
          prompt: trabajo.prompt,
          referencias: trabajo.referencias,
          estado: 'COMPLETADA',
          archivo,
          creadaEn: deps.reloj().toISOString(),
        };
    await deps.piezas.copiarArchivo(pieza.id, rutaOrigen, archivo);
    return conGeneracion(pieza, generacion);
  });
  return generacion;
}
