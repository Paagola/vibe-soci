import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import { guardarEncargo, leerEncargo, type DepsPost } from './ordenPost.js';

/**
 * Pone (o cambia) la referencia del encargo mientras la orden está en el paso REFERENCIA.
 * Es lo que la línea de comandos pide hacer a mano («ponla en "referencia" de post.json»). Después ya no se cambia:
 * la propuesta del director se escribe mirando esa referencia.
 */
export async function elegirReferencia(deps: DepsPost, proyecto: string, referencia: string): Promise<EncargoPost> {
  const e = await leerEncargo(deps, proyecto);
  if (e.paso !== 'REFERENCIA') {
    throw new ErrorDeUsuario('La referencia se elige antes de la propuesta de foto: este encargo ya ha pasado ese paso.');
  }
  await deps.referencias.referencias.obtener(e.local, referencia); // tiene que estar registrada en el local
  if (e.referencia === referencia) return e;
  const cambiado: EncargoPost = { ...e, referencia, historial: [...e.historial, { fecha: deps.ahora(), paso: e.paso, nota: `Referencia elegida: ${referencia}.` }] };
  await guardarEncargo(deps, cambiado);
  return cambiado;
}
