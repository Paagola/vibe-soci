import { extname } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { ReferenciaLocal } from '../../dominio/referencia.js';
import { EXTENSIONES_IMAGEN, type DepsReferencias } from './dependencias.js';

/** Para un enlace que no se pudo leer: el usuario sube la captura y la referencia queda lista para analizar. */
export async function anadirCaptura(deps: DepsReferencias, entrada: { local: string; id: string; imagen: string }): Promise<ReferenciaLocal> {
  const referencia = await deps.referencias.obtener(entrada.local, entrada.id);
  if (referencia.origen.tipo !== 'ENLACE' || referencia.origen.estado !== 'PIDE_CAPTURA') {
    throw new ErrorDeUsuario(`La referencia «${entrada.id}» ya tiene imagen.`);
  }
  const ext = extname(entrada.imagen).toLowerCase();
  if (!EXTENSIONES_IMAGEN.includes(ext as (typeof EXTENSIONES_IMAGEN)[number])) throw new ErrorDeUsuario('La captura tiene que ser una imagen.');
  const archivo = `captura${ext === '.jpeg' ? '.jpg' : ext}`;
  await deps.referencias.escribirArchivo(entrada.local, entrada.id, archivo, await deps.leerArchivo(entrada.imagen));
  const actualizada = ReferenciaLocal.parse({
    ...referencia,
    origen: { ...referencia.origen, estado: 'OBTENIDA', archivo, motivo: `captura subida por el usuario (el enlace no se pudo leer: ${referencia.origen.motivo ?? 'sin detalle'})` },
  });
  await deps.referencias.guardar(actualizada);
  return actualizada;
}
