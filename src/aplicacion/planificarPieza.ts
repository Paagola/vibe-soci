import { ErrorDeUsuario } from '../dominio/errores.js';
import type { Plan } from '../dominio/modelos.js';
import { problemasDelPlan } from '../dominio/reglas.js';
import { construirContexto } from './contextoCreativo.js';
import type { Dependencias } from './dependencias.js';
import { renderizarPlan } from './planMarkdown.js';
import { sinProgreso, type AlProgresar } from './progreso.js';

const MAX_INTENTOS = 3;
const YA_TIENE_IMAGENES = 'Esta pieza ya tiene imágenes de otro plan. Crea una pieza nueva para no mezclar versiones.';

/**
 * El director escribe el plan del concepto elegido. Si el plan rompe una regla
 * (cifras inventadas, fotos que no existen…), se le devuelve el problema y lo vuelve a intentar.
 */
export async function planificarPieza(
  deps: Pick<Dependencias, 'piezas' | 'locales' | 'biblioteca' | 'director'>,
  piezaId: string,
  numeroConcepto: number,
  opciones: { alProgresar?: AlProgresar } = {},
): Promise<Plan> {
  const alProgresar = opciones.alProgresar ?? sinProgreso;
  const pieza = await deps.piezas.obtener(piezaId);
  const concepto = pieza.conceptos[numeroConcepto - 1];
  if (!concepto) {
    throw new ErrorDeUsuario(`La pieza tiene ${pieza.conceptos.length} conceptos; elige un número entre 1 y ${pieza.conceptos.length}.`);
  }
  if (pieza.generaciones.length > 0) throw new ErrorDeUsuario(YA_TIENE_IMAGENES);

  const contexto = await construirContexto(deps, pieza);
  let problemas: string[] = [];

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    alProgresar({
      mensaje: intento === 1 ? 'El director está escribiendo el plan…' : `El plan no cumplía las reglas; el director lo corrige (intento ${intento} de ${MAX_INTENTOS})…`,
      hechas: 0,
      total: 0,
      pasosRestantes: { director: 1, tandas: 0 },
    });
    const plan = await deps.director().planificar(contexto, concepto, problemas);
    problemas = problemasDelPlan(pieza, plan);
    if (problemas.length === 0) {
      const actualizada = await deps.piezas.actualizar(pieza.id, (actual) => {
        if (actual.generaciones.length > 0) throw new ErrorDeUsuario(YA_TIENE_IMAGENES);
        return { ...actual, conceptoElegido: concepto, plan };
      });
      await deps.piezas.escribirArchivo(pieza.id, 'plan.md', renderizarPlan(actualizada, contexto.marca));
      return plan;
    }
  }
  throw new ErrorDeUsuario('El director no ha conseguido un plan válido. Vuelve a intentarlo o elige otro concepto.', problemas);
}
