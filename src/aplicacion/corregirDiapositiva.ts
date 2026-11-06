import { z } from 'zod';
import { ErrorDeUsuario } from '../dominio/errores.js';
import type { DiapositivaPlan, Generacion, Pieza } from '../dominio/modelos.js';
import { MAX_CORRECCIONES, correccionesUsadas, problemasDeCorreccion, siguienteVersion, ultimaCompletada } from '../dominio/reglas.js';
import { validar } from '../dominio/validacion.js';
import { construirContexto } from './contextoCreativo.js';
import type { Dependencias } from './dependencias.js';
import { autorizarGasto, conGeneracion, enviarDiapositiva, esperarGeneraciones, type Confirmar } from './ejecutarGeneracion.js';
import { MODELO_MANUAL } from './importarImagen.js';
import { sinProgreso, type AlProgresar } from './progreso.js';
import { exigirDiapositiva, trabajoDeCorreccion } from './trabajoDeDiapositiva.js';

export interface OpcionesCorregir {
  /** true: solo prepara el prompt para generarlo a mano y luego importar. */
  manual: boolean;
  confirmar: Confirmar;
  alProgresar?: AlProgresar;
}

export interface ResultadoCorregir {
  cancelado: boolean;
  generacion?: Generacion;
}

const Comentario = z.string().trim().min(3).max(300);

const MAX_INTENTOS = 3;

/**
 * Pide un cambio sobre la última imagen de una diapositiva (R9).
 * El director reescribe el prompt; la imagen anterior va como Image 1 («keep image 1 almost exactly»).
 * Lo que propone pasa las reglas del plan antes de gastar nada (cifras, textos literales, cantidad de texto).
 * Si no las cumple, se le devuelven los problemas, como al escribir el plan.
 */
export async function corregirDiapositiva(
  deps: Pick<Dependencias, 'piezas' | 'locales' | 'biblioteca' | 'director' | 'generador' | 'reloj' | 'limiteImagenesDia' | 'zonaHoraria'>,
  piezaId: string,
  posicion: number,
  comentarioEscrito: string,
  opciones: OpcionesCorregir,
): Promise<ResultadoCorregir> {
  const comentario = validar(Comentario, comentarioEscrito, 'El comentario tiene que tener entre 3 y 300 caracteres.');
  const pieza = await deps.piezas.obtener(piezaId);
  const { diapositiva, anterior } = comprobarCorreccion(pieza, posicion);
  const alProgresar = opciones.alProgresar ?? sinProgreso;
  const tandas = opciones.manual ? 0 : 1;

  const contexto = await construirContexto(deps, pieza);
  const peticion = {
    diapositiva,
    promptAnterior: anterior.prompt,
    comentario,
    imagenAnterior: {
      ruta: deps.piezas.rutaArchivo(pieza.id, anterior.archivo),
      archivo: anterior.archivo,
      descripcion: 'versión generada que hay que corregir',
    },
  };
  let problemas: string[] = [];
  let nuevoPrompt: string | undefined;
  for (let intento = 1; intento <= MAX_INTENTOS && nuevoPrompt === undefined; intento++) {
    alProgresar({
      mensaje: intento === 1 ? 'El director está revisando la imagen…' : `El cambio no cumplía las reglas; el director lo corrige (intento ${intento} de ${MAX_INTENTOS})…`,
      hechas: 0,
      total: tandas,
      pasosRestantes: { director: 1, tandas },
    });
    const propuesta = await deps.director().corregir(contexto, peticion, problemas);
    problemas = problemasDeCorreccion(pieza, propuesta, comentario);
    if (problemas.length === 0) nuevoPrompt = propuesta.prompt;
  }
  if (nuevoPrompt === undefined) {
    throw new ErrorDeUsuario('El director no ha conseguido un cambio que cumpla las reglas. No se ha generado nada: reformula el comentario o inténtalo de nuevo.', problemas);
  }
  const trabajo = trabajoDeCorreccion(pieza, posicion, nuevoPrompt, anterior.archivo, comentario);

  if (opciones.manual) {
    const base: Omit<Generacion, 'version'> = {
      diapositiva: posicion,
      origen: 'MANUAL',
      modelo: MODELO_MANUAL,
      prompt: trabajo.prompt,
      referencias: trabajo.referencias,
      comentario,
      estado: 'PENDIENTE_MANUAL',
      creadaEn: deps.reloj().toISOString(),
    };
    // La versión se decide sobre lo último guardado, por si mientras pensaba el director entró otra.
    let pendiente!: Generacion;
    await deps.piezas.actualizar(pieza.id, (actual) => {
      pendiente = { ...base, version: siguienteVersion(actual, posicion) };
      return conGeneracion(actual, pendiente);
    });
    return { cancelado: false, generacion: pendiente };
  }

  const generador = deps.generador();
  if (!(await autorizarGasto(deps, generador, 1, opciones.confirmar))) return { cancelado: true };

  alProgresar({ mensaje: 'Generando la nueva versión…', hechas: 0, total: 1, pasosRestantes: { director: 0, tandas: 1 } });
  const enviada = await enviarDiapositiva(deps, generador, pieza, trabajo);
  const nueva = enviada.generaciones.filter((g) => g.diapositiva === posicion && g.estado === 'ENVIADA');
  const { terminadas } = await esperarGeneraciones(deps, generador, enviada, nueva, () =>
    alProgresar({ mensaje: 'Generando la nueva versión…', hechas: 1, total: 1, pasosRestantes: { director: 0, tandas: 1 } }),
  );
  return { cancelado: false, generacion: terminadas.at(-1) };
}

/** Lo que hay que cumplir para pedir un cambio. Se puede comprobar antes de pedir confirmación. */
export function comprobarCorreccion(pieza: Pieza, posicion: number): { diapositiva: DiapositivaPlan; anterior: Generacion & { archivo: string } } {
  const diapositiva = exigirDiapositiva(pieza, posicion);
  if (correccionesUsadas(pieza, posicion) >= MAX_CORRECCIONES) {
    throw new ErrorDeUsuario(`La diapositiva ${posicion} ya ha usado sus ${MAX_CORRECCIONES} cambios.`);
  }
  const anterior = ultimaCompletada(pieza, posicion);
  if (!anterior?.archivo) {
    throw new ErrorDeUsuario(`La diapositiva ${posicion} aún no tiene imagen. Genera o importa una antes de corregirla.`);
  }
  return { diapositiva, anterior: { ...anterior, archivo: anterior.archivo } };
}
