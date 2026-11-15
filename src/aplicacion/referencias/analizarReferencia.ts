import { ErrorDeUsuario } from '../../dominio/errores.js';
import { decidirAptitud, FichaReferencia, ReferenciaLocal } from '../../dominio/referencia.js';
import { describirProblemas } from '../../dominio/validacion.js';
import type { AnalistaDeReferencias } from '../../puertos/AnalistaDeReferencias.js';
import type { DepsReferencias } from './dependencias.js';

/**
 * Puntos 3 y 4 (15/11): la ficha de una referencia, escrita por el analista (Gemini visión) contra el esquema de
 * FichaReferencia. Antes de nada se mira si la imagen es un post publicado: un mockup, una marca de agua o un collage se
 * rechazan (sin ficha, y la orden pide otra referencia); una captura con la interfaz de la app se acepta con aviso.
 * Antes, una referencia nueva bloqueaba la orden hasta que alguien escribía su ficha a mano.
 */
export async function analizarReferencia(deps: DepsReferencias & { analista: AnalistaDeReferencias }, entrada: { local: string; id: string }): Promise<ReferenciaLocal> {
  const referencia = await deps.referencias.obtener(entrada.local, entrada.id);
  const archivo = referencia.origen.tipo === 'IMAGEN' ? referencia.origen.archivo : referencia.origen.estado === 'OBTENIDA' ? referencia.origen.archivo : undefined;
  if (!archivo) throw new ErrorDeUsuario(`La referencia «${entrada.id}» no tiene imagen todavía: sube la captura antes de analizarla.`);
  const { aptitud, ficha } = await deps.analista.analizar(deps.referencias.rutaArchivo(entrada.local, entrada.id, archivo));
  const decision = decidirAptitud(aptitud);
  const analisis = { fecha: deps.ahora(), analista: deps.analista.nombre, aptitud, decision };
  if (decision === 'RECHAZA') {
    const rechazada = ReferenciaLocal.parse({ ...referencia, analisis });
    await deps.referencias.guardar(rechazada);
    return rechazada;
  }
  const completa = FichaReferencia.safeParse({ ...ficha, esquema: 'referencia/ficha@1', analizadaPor: 'GEMINI', analizadaEn: deps.ahora().slice(0, 10) });
  if (!completa.success) throw new ErrorDeUsuario('La ficha automática no cumple el esquema.', describirProblemas(completa.error));
  const actualizada = ReferenciaLocal.parse({ ...referencia, ficha: completa.data, analisis });
  await deps.referencias.guardar(actualizada);
  return actualizada;
}
