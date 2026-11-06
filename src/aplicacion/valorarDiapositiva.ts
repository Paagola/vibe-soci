import { z } from 'zod';
import { ErrorDeUsuario } from '../dominio/errores.js';
import { Veredicto, type Valoracion } from '../dominio/modelos.js';
import { generacionesDe, ultimaCompletada } from '../dominio/reglas.js';
import { validar } from '../dominio/validacion.js';
import type { Dependencias } from './dependencias.js';
import { conGeneracion } from './ejecutarGeneracion.js';

const EntradaValoracion = z.object({
  veredicto: Veredicto,
  motivo: z.string().trim().min(3).max(300),
});

/**
 * Guarda si una imagen gusta o no y por qué. El motivo es lo que aprende el director:
 * se añade a biblioteca/valoraciones.jsonl y lo lee en la siguiente pieza.
 */
export async function valorarDiapositiva(
  deps: Pick<Dependencias, 'piezas' | 'biblioteca' | 'reloj'>,
  piezaId: string,
  posicion: number,
  entrada: { veredicto: string; motivo: string; version?: number },
): Promise<Valoracion> {
  const { veredicto, motivo } = validar(EntradaValoracion, entrada, 'La valoración no es válida.');
  const pieza = await deps.piezas.obtener(piezaId);

  const generacion =
    entrada.version === undefined
      ? ultimaCompletada(pieza, posicion)
      : generacionesDe(pieza, posicion).find((g) => g.version === entrada.version && g.estado === 'COMPLETADA');
  if (!generacion?.archivo) throw new ErrorDeUsuario(`No hay ninguna imagen terminada de la diapositiva ${posicion} con esa versión.`);

  const valoracion: Valoracion = {
    fecha: deps.reloj().toISOString(),
    localSlug: pieza.localSlug,
    piezaId: pieza.id,
    diapositiva: posicion,
    version: generacion.version,
    veredicto,
    motivo,
    prompt: generacion.prompt,
    archivo: generacion.archivo,
    origen: 'HUMANA', // este caso de uso lo usa la web: vota una persona
  };
  await deps.biblioteca.registrarValoracion(valoracion);
  // Se apunta sobre lo último guardado: si hay un trabajo en marcha, el voto no se pierde cuando termine.
  await deps.piezas.actualizar(piezaId, (actual) => {
    const votada = generacionesDe(actual, posicion).find((g) => g.version === generacion.version);
    if (!votada) throw new ErrorDeUsuario(`La versión ${generacion.version} de la diapositiva ${posicion} ya no existe.`);
    return conGeneracion(actual, { ...votada, valoracion: { veredicto, motivo } });
  });
  return valoracion;
}
