import { extname } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { ReferenciaLocal, plataformaDe } from '../../dominio/referencia.js';
import { EXTENSIONES_IMAGEN, extensionDeTipo, type DepsReferencias } from './dependencias.js';

export type EntradaReferencia =
  | { local: string; id: string; imagen: string; nota?: string }
  | { local: string; id: string; enlace: string; nota?: string }
  | { local: string; id: string; deBiblioteca: string; nota?: string };

/**
 * Guarda una referencia con el local: una imagen o captura, un enlace (se intenta leer su imagen pública; si el sitio
 * lo bloquea, queda pidiendo captura) o un post de la biblioteca del estudio (llega ya con su ficha).
 */
export async function registrarReferencia(deps: DepsReferencias, entrada: EntradaReferencia): Promise<ReferenciaLocal> {
  const { local, id } = entrada;
  if (!(await deps.locales.existe(local))) throw new ErrorDeUsuario(`No existe el local «${local}».`);
  if (await deps.referencias.existe(local, id)) throw new ErrorDeUsuario(`El local «${local}» ya tiene una referencia «${id}»: usa otro id.`);
  const base = { id, local, creadaEn: deps.ahora(), ...(entrada.nota ? { nota: entrada.nota } : {}) };

  if ('imagen' in entrada) {
    const ext = extname(entrada.imagen).toLowerCase();
    if (!EXTENSIONES_IMAGEN.includes(ext as (typeof EXTENSIONES_IMAGEN)[number])) throw new ErrorDeUsuario(`La referencia tiene que ser una imagen (${EXTENSIONES_IMAGEN.join(', ')}).`);
    const archivo = `imagen${ext === '.jpeg' ? '.jpg' : ext}`;
    await deps.referencias.escribirArchivo(local, id, archivo, await deps.leerArchivo(entrada.imagen));
    const referencia = ReferenciaLocal.parse({ ...base, origen: { tipo: 'IMAGEN', archivo } });
    await deps.referencias.guardar(referencia);
    return referencia;
  }

  if ('deBiblioteca' in entrada) {
    const ficha = await deps.biblioteca.ficha(entrada.deBiblioteca);
    await deps.referencias.escribirArchivo(local, id, 'imagen.jpg', await deps.leerArchivo(deps.biblioteca.rutaImagen(entrada.deBiblioteca)));
    const referencia = ReferenciaLocal.parse({ ...base, origen: { tipo: 'IMAGEN', archivo: 'imagen.jpg', deBiblioteca: entrada.deBiblioteca }, ficha });
    await deps.referencias.guardar(referencia);
    return referencia;
  }

  let url: URL;
  try {
    url = new URL(entrada.enlace);
  } catch {
    throw new ErrorDeUsuario(`«${entrada.enlace}» no es un enlace válido.`);
  }
  const plataforma = plataformaDe(url.toString());
  const resultado = await deps.enlaces.obtener(url.toString());
  if (resultado.estado === 'OBTENIDA') {
    const archivo = `imagen${extensionDeTipo(resultado.tipo)}`;
    await deps.referencias.escribirArchivo(local, id, archivo, resultado.bytes);
    const referencia = ReferenciaLocal.parse({ ...base, origen: { tipo: 'ENLACE', url: url.toString(), plataforma, estado: 'OBTENIDA', archivo } });
    await deps.referencias.guardar(referencia);
    return referencia;
  }
  const referencia = ReferenciaLocal.parse({ ...base, origen: { tipo: 'ENLACE', url: url.toString(), plataforma, estado: 'PIDE_CAPTURA', motivo: resultado.motivo } });
  await deps.referencias.guardar(referencia);
  return referencia;
}
