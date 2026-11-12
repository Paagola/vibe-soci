import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import { registrarReferencia } from '../referencias/registrarReferencia.js';
import { guardarEncargo, leerEncargo, type DepsPost } from './ordenPost.js';

/** Un post de la biblioteca del estudio: «post-07», «post-30»… */
const POST_DE_BIBLIOTECA = /^post-\d{2}$/;

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

/**
 * Toma como referencia un post de la biblioteca del estudio: lo registra en el local con su ficha (si aún no lo
 * estaba, con el id «ref-post-NN», el mismo que usa `npm run referencia`) y lo elige para el encargo.
 * De la referencia se toma el oficio, nunca sus textos ni sus marcas.
 */
export async function usarReferenciaDeBiblioteca(deps: DepsPost, proyecto: string, post: string): Promise<EncargoPost> {
  if (!POST_DE_BIBLIOTECA.test(post)) throw new ErrorDeUsuario(`«${post}» no es un post de la biblioteca (post-NN).`);
  const e = await leerEncargo(deps, proyecto);
  if (e.paso !== 'REFERENCIA') {
    throw new ErrorDeUsuario('La referencia se elige antes de la propuesta de foto: este encargo ya ha pasado ese paso.');
  }
  const id = `ref-${post}`;
  if (!(await deps.referencias.referencias.existe(e.local, id))) {
    await registrarReferencia(deps.referencias, { local: e.local, id, deBiblioteca: post });
  }
  return elegirReferencia(deps, proyecto, id);
}
