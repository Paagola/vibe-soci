import { ErrorDeUsuario } from '../dominio/errores.js';
import type { Generacion, Pieza } from '../dominio/modelos.js';
import { posicionesSinImagen } from '../dominio/reglas.js';
import type { GeneradorImagen } from '../puertos/GeneradorImagen.js';
import type { Dependencias } from './dependencias.js';
import { autorizarGasto, enviarDiapositiva, esperarGeneraciones, type Confirmar } from './ejecutarGeneracion.js';
import { sinProgreso, type AlProgresar } from './progreso.js';
import { exigirPlan, trabajoDelPlan } from './trabajoDeDiapositiva.js';

export interface OpcionesGenerar {
  /** Diapositivas a generar. Por defecto, las que aún no tienen imagen. */
  posiciones?: number[];
  confirmar: Confirmar;
  alProgresar?: AlProgresar;
}

export interface ResultadoGenerar {
  cancelado: boolean;
  terminadas: Generacion[];
}

/** Qué haría «generar» sin gastar nada: imágenes nuevas y trabajos que solo hay que retomar. */
export interface Encargo {
  /** Diapositivas que se envían (cuestan una imagen cada una). */
  posiciones: number[];
  /** Generaciones ya enviadas que se retoman sin pagar otra vez. */
  enCurso: Generacion[];
}

type DepsGenerar = Pick<Dependencias, 'piezas' | 'generador' | 'reloj' | 'limiteImagenesDia' | 'zonaHoraria' | 'avisar'>;

export function calcularEncargo(pieza: Pieza, origen: GeneradorImagen['origen'], posiciones?: number[]): Encargo {
  const plan = exigirPlan(pieza);
  const enCurso = pieza.generaciones.filter((g) => g.estado === 'ENVIADA' && g.origen === origen);
  const pedidas = (posiciones ?? posicionesSinImagen(pieza)).filter((posicion) => !enCurso.some((g) => g.diapositiva === posicion));
  comprobarPosiciones(pedidas, plan.diapositivas.length);
  return { posiciones: pedidas, enCurso };
}

/**
 * Genera las diapositivas del plan.
 * 1. Retoma las que quedaron ENVIADA (no se vuelven a pagar).
 * 2. La portada va primero: las demás la llevan como referencia de coherencia (R10).
 * 3. El resto se envía y se espera en paralelo.
 */
export async function generarDiapositivas(deps: DepsGenerar, piezaId: string, opciones: OpcionesGenerar): Promise<ResultadoGenerar> {
  let pieza = await deps.piezas.obtener(piezaId);
  const plan = exigirPlan(pieza);
  const generador = deps.generador();
  const { posiciones, enCurso } = calcularEncargo(pieza, generador.origen, opciones.posiciones);
  const alProgresar = opciones.alProgresar ?? sinProgreso;

  if (posiciones.length === 0 && enCurso.length === 0) {
    throw new ErrorDeUsuario('No hay nada que generar: todas las diapositivas tienen imagen. Usa «Pedir cambio» para cambiar una.');
  }
  if (posiciones.length > 0 && !(await autorizarGasto(deps, generador, posiciones.length, opciones.confirmar))) {
    return { cancelado: true, terminadas: [] };
  }

  const portadaPrimero = posiciones.includes(1) && plan.diapositivas.length > 1;
  const tandas = (portadaPrimero ? [[1], posiciones.filter((p) => p !== 1)] : [posiciones]).filter((t) => t.length > 0);
  const total = enCurso.length + posiciones.length;
  const terminadas: Generacion[] = [];
  let tandasRestantes = tandas.length + (enCurso.length > 0 ? 1 : 0);

  const informar = (mensaje: string) =>
    alProgresar({ mensaje, hechas: terminadas.length, total, pasosRestantes: { director: 0, tandas: tandasRestantes } });
  const esperar = async (mensaje: string, generaciones: Generacion[]) => {
    informar(mensaje);
    const resultado = await esperarGeneraciones(deps, generador, pieza, generaciones, (terminada) => {
      terminadas.push(terminada);
      informar(mensaje);
    });
    tandasRestantes--;
    return resultado.pieza;
  };

  if (enCurso.length > 0) {
    deps.avisar(`Retomo ${enCurso.length} imagen(es) que ya estaban enviadas.`);
    pieza = await esperar('Retomando las imágenes que ya estaban enviadas…', enCurso);
  }

  for (const tanda of tandas) {
    if (tanda !== tandas[0] && terminadas.some((g) => g.diapositiva === 1 && g.estado !== 'COMPLETADA')) {
      deps.avisar('La portada no ha salido: genero el resto cuando la tengas, para que lleven su estilo.');
      break;
    }
    for (const posicion of tanda) {
      pieza = await enviarDiapositiva(deps, generador, pieza, trabajoDelPlan(pieza, posicion));
    }
    const enviadas = pieza.generaciones.filter((g) => g.estado === 'ENVIADA' && tanda.includes(g.diapositiva));
    pieza = await esperar(describirTanda(tanda, portadaPrimero), enviadas);
  }
  return { cancelado: false, terminadas };
}

function describirTanda(tanda: number[], esPortada: boolean): string {
  if (esPortada && tanda.length === 1 && tanda[0] === 1) return 'Generando la portada…';
  if (tanda.length === 1) return `Generando la diapositiva ${tanda[0]}…`;
  return `Generando las diapositivas ${tanda.join(', ')} a la vez…`;
}

function comprobarPosiciones(posiciones: number[], total: number): void {
  const fuera = posiciones.filter((p) => !Number.isInteger(p) || p < 1 || p > total);
  if (fuera.length > 0) throw new ErrorDeUsuario(`Diapositivas fuera del plan: ${fuera.join(', ')}. El plan tiene ${total}.`);
}
