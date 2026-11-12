import { MAX_INTENTOS_SEGUIDOS } from '../../dominio/post.js';
import { leerEncargo, peticion, type DepsPost } from './ordenPost.js';

export interface PresupuestoDeFoto {
  generador: string;
  disponible: boolean;
  /** Por qué no se puede generar por la API (sin facturación, sin clave…). */
  motivo: string | null;
  /** Estimación por arriba de un intento, o null si no se puede generar. */
  estimadoPorIntentoUsd: number | null;
  /** Intentos seguidos que autoriza confirmar la parada de elementos. */
  maxIntentos: number;
  intentosHechos: number;
  /** Lo que ya ha costado este encargo. */
  gastadoUsd: number;
}

/**
 * Lo que costaría la foto nueva del encargo, para enseñarlo antes de confirmar la parada de elementos.
 * No gasta nada: como mucho, el generador cuenta los tokens de la petición (gratis).
 */
export async function presupuestoDeFoto(deps: DepsPost, proyecto: string): Promise<PresupuestoDeFoto> {
  const e = await leerEncargo(deps, proyecto);
  const disponible = deps.generador.disponible();
  let estimado: number | null = null;
  if (disponible.ok && e.activoReal && e.propuesta) {
    const real = await deps.activos.obtener(e.local, e.activoReal);
    estimado = await deps.generador.estimarUsd(peticion(e, real.ruta, e.propuesta.prompt, 0));
  }
  return {
    generador: deps.generador.nombre,
    disponible: disponible.ok,
    motivo: disponible.ok ? null : disponible.motivo,
    estimadoPorIntentoUsd: estimado,
    maxIntentos: MAX_INTENTOS_SEGUIDOS,
    intentosHechos: e.intentos.length,
    gastadoUsd: e.intentos.reduce((suma, intento) => suma + intento.costeUsd, 0),
  };
}
