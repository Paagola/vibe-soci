import { UMBRAL_REFERENCIA_OBLIGATORIA, comprobarPasoAConcepto, piezasRealesDelLocal, proponerFamilias, type FamiliaBiblioteca, type PasoAConcepto } from '../../dominio/referencia.js';
import type { DepsReferencias } from './dependencias.js';

export interface EstadoReferencia {
  paso: PasoAConcepto;
  piezasReales: number;
  umbral: number;
  /** Si falta la referencia: tres familias de la biblioteca para que el usuario elija. */
  propuestas: FamiliaBiblioteca[];
}

/**
 * Lo que tiene que preguntar cualquier flujo (la línea de comandos hoy; la web cuando se apruebe) antes de pasar
 * una pieza de brief a concepto.
 */
export async function comprobarReferencia(deps: DepsReferencias, entrada: { local: string; referencia?: string }): Promise<EstadoReferencia> {
  const umbral = deps.umbral ?? UMBRAL_REFERENCIA_OBLIGATORIA;
  const piezasReales = piezasRealesDelLocal(await deps.piezas.listar(), entrada.local);
  const referencia = entrada.referencia ? await deps.referencias.obtener(entrada.local, entrada.referencia) : undefined;
  const paso = comprobarPasoAConcepto({ piezasReales, ...(referencia ? { referencia } : {}) }, umbral);
  let propuestas: FamiliaBiblioteca[] = [];
  if (!paso.puede && paso.falta === 'REFERENCIA') {
    const marca = await deps.locales.obtener(entrada.local);
    propuestas = proponerFamilias(await deps.biblioteca.familias(), marca.tonos);
  }
  return { paso, piezasReales, umbral, propuestas };
}
