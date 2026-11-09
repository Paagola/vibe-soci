import { ErrorDeUsuario } from '../../dominio/errores.js';
import { FichaReferencia, ReferenciaLocal } from '../../dominio/referencia.js';
import { validar } from '../../dominio/validacion.js';
import type { DepsReferencias } from './dependencias.js';

/** Añade la ficha de análisis a una referencia. No se analiza lo que no se ha visto: hace falta la imagen. */
export async function guardarFicha(deps: DepsReferencias, entrada: { local: string; id: string; ficha: unknown }): Promise<ReferenciaLocal> {
  const referencia = await deps.referencias.obtener(entrada.local, entrada.id);
  const sinImagen = referencia.origen.tipo === 'ENLACE' && referencia.origen.estado === 'PIDE_CAPTURA';
  if (sinImagen) throw new ErrorDeUsuario(`La referencia «${entrada.id}» no tiene imagen todavía: sube la captura antes de analizarla.`);
  const ficha = validar(FichaReferencia, entrada.ficha, 'La ficha de la referencia no es válida.');
  const actualizada = ReferenciaLocal.parse({ ...referencia, ficha });
  await deps.referencias.guardar(actualizada);
  return actualizada;
}
