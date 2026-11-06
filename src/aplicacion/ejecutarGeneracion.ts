/**
 * Pasos comunes a generar y corregir: comprobar el gasto, enviar y esperar.
 * Regla de oro (R8): el trabajo se guarda como ENVIADA *antes* de esperar.
 * Si el proceso se corta, la próxima vez se retoma la espera en lugar de pagar otra imagen.
 */
import { ErrorDeServicio, ErrorDeUsuario } from '../dominio/errores.js';
import type { Generacion, Pieza } from '../dominio/modelos.js';
import { imagenesPorApiDelDia, rutaGenerada, siguienteVersion } from '../dominio/reglas.js';
import type { GeneradorImagen } from '../puertos/GeneradorImagen.js';
import type { Dependencias } from './dependencias.js';
import type { TrabajoDeDiapositiva } from './trabajoDeDiapositiva.js';

export interface ResumenGasto {
  imagenes: number;
  modelo: string;
  origen: GeneradorImagen['origen'];
  usadasHoy: number;
  limite: number;
}

export type Confirmar = (resumen: ResumenGasto) => Promise<boolean>;

type DepsGeneracion = Pick<Dependencias, 'piezas' | 'reloj' | 'limiteImagenesDia' | 'zonaHoraria'>;

/** Cuántas imágenes se van a pedir, con qué modelo y cuántas van hoy. No gasta nada. */
export async function calcularResumenGasto(deps: DepsGeneracion, generador: GeneradorImagen, imagenes: number): Promise<ResumenGasto> {
  const usadasHoy = generador.origen === 'API' ? imagenesPorApiDelDia(await deps.piezas.listar(), deps.reloj(), deps.zonaHoraria) : 0;
  return { imagenes, modelo: generador.modelo, origen: generador.origen, usadasHoy, limite: deps.limiteImagenesDia };
}

/** Comprueba el límite del día y pide confirmación. Devuelve false si el usuario cancela. */
export async function autorizarGasto(
  deps: DepsGeneracion,
  generador: GeneradorImagen,
  imagenes: number,
  confirmar: Confirmar,
): Promise<boolean> {
  const resumen = await calcularResumenGasto(deps, generador, imagenes);
  if (resumen.origen === 'API' && resumen.usadasHoy + imagenes > resumen.limite) {
    throw new ErrorDeUsuario(
      `Hoy ya llevas ${resumen.usadasHoy} imágenes por la API y el límite es ${resumen.limite}. ` +
        'Cámbialo en LIMITE_IMAGENES_DIA si de verdad lo necesitas.',
    );
  }
  return confirmar(resumen);
}

/**
 * Envía una diapositiva y guarda la generación como ENVIADA.
 * La versión sale de lo último guardado, no de la copia que trae quien llama: mientras tanto
 * puede haber entrado una importación. Devuelve la pieza tal como queda guardada.
 */
export async function enviarDiapositiva(
  deps: Pick<Dependencias, 'piezas' | 'reloj'>,
  generador: GeneradorImagen,
  pieza: Pieza,
  trabajo: TrabajoDeDiapositiva,
): Promise<Pieza> {
  const version = siguienteVersion(await deps.piezas.obtener(pieza.id), trabajo.posicion);
  const enviado = await generador.enviar({
    prompt: trabajo.prompt,
    referencias: trabajo.referencias.map((archivo) => deps.piezas.rutaArchivo(pieza.id, archivo)),
    formato: pieza.formato,
    claveIdempotencia: `${pieza.id}-d${trabajo.posicion}-v${version}`,
  });

  const generacion: Generacion = {
    diapositiva: trabajo.posicion,
    version,
    origen: generador.origen,
    modelo: generador.modelo,
    prompt: trabajo.prompt,
    referencias: trabajo.referencias,
    comentario: trabajo.comentario,
    estado: 'ENVIADA',
    requestId: enviado.requestId,
    urlEstado: enviado.urlEstado,
    creadaEn: deps.reloj().toISOString(),
  };
  return deps.piezas.actualizar(pieza.id, (actual) => {
    // Si una importación ocupó esa versión mientras se enviaba, esta pasa a la siguiente libre.
    const ocupada = actual.generaciones.some((g) => g.diapositiva === trabajo.posicion && g.version === version);
    return conGeneracion(actual, ocupada ? { ...generacion, version: siguienteVersion(actual, trabajo.posicion) } : generacion);
  });
}

/**
 * Espera varias generaciones a la vez. Cada una se guarda en cuanto termina, sobre lo último guardado:
 * un voto o una importación hechos mientras tanto no se pierden. `alTerminarUna` avisa de cada una.
 */
export async function esperarGeneraciones(
  deps: Pick<Dependencias, 'piezas' | 'reloj'>,
  generador: GeneradorImagen,
  pieza: Pieza,
  generaciones: Generacion[],
  alTerminarUna: (generacion: Generacion) => void = () => {},
): Promise<{ pieza: Pieza; terminadas: Generacion[] }> {
  const terminadas = await Promise.all(
    generaciones.map(async (generacion) => {
      const terminada = await esperarUna(deps, generador, pieza.id, generacion);
      await deps.piezas.actualizar(pieza.id, (actual) => conGeneracion(actual, terminada));
      alTerminarUna(terminada);
      return terminada;
    }),
  );
  return { pieza: await deps.piezas.obtener(pieza.id), terminadas };
}

async function esperarUna(
  deps: Pick<Dependencias, 'piezas' | 'reloj'>,
  generador: GeneradorImagen,
  piezaId: string,
  generacion: Generacion,
): Promise<Generacion> {
  if (!generacion.requestId || generacion.urlEstado === undefined) {
    return { ...generacion, estado: 'FALLIDA', error: 'La generación no tiene requestId.' };
  }
  try {
    const imagen = await generador.esperarResultado({ requestId: generacion.requestId, urlEstado: generacion.urlEstado });
    const archivo = rutaGenerada(generacion.diapositiva, generacion.version, imagen.extension);
    await deps.piezas.escribirArchivo(piezaId, archivo, imagen.bytes);
    return { ...generacion, estado: 'COMPLETADA', archivo, error: undefined, terminadaEn: deps.reloj().toISOString() };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    // Un fallo reintentable (p. ej. se agotó la espera) deja el trabajo ENVIADA: se retoma sin pagar otra vez.
    if (error instanceof ErrorDeServicio && error.reintentable) return { ...generacion, estado: 'ENVIADA', error: mensaje };
    return { ...generacion, estado: 'FALLIDA', error: mensaje, terminadaEn: deps.reloj().toISOString() };
  }
}

/** Devuelve la pieza con la generación añadida o sustituida (misma diapositiva y versión). */
export function conGeneracion(pieza: Pieza, generacion: Generacion): Pieza {
  const resto = pieza.generaciones.filter(
    (g) => !(g.diapositiva === generacion.diapositiva && g.version === generacion.version),
  );
  const generaciones = [...resto, generacion].sort((a, b) => a.diapositiva - b.diapositiva || a.version - b.version);
  return { ...pieza, generaciones };
}
