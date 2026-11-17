import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { BriefDelEncargo } from '../../dominio/brief.js';
import type { EncargoPost, PasoPost } from '../../dominio/post.js';

export type Via = 'web' | 'terminal';
/** Lo que el gancho ve de la acción del usuario (solo lectura: el gancho nunca confirma). */
export interface AccionVista {
  readonly revision?: string;
  readonly confirmo?: boolean;
  readonly rechazo?: string;
  readonly importar?: string;
  readonly via?: Via;
  readonly portadaToma?: number;
  readonly sinToma?: readonly number[];
}
export interface ResultadoAntes { parar?: string; notas?: string[] }
export interface ResultadoTras {
  notas?: string[];
  /** Se añade (tras un salto de línea) al texto de la parada que ya da el paso. */
  textoParada?: string;
  /** Para la orden aunque el paso no parase. */
  parar?: string;
}
export interface GanchosDeOrden {
  leerBrief?(proyecto: string): Promise<BriefDelEncargo | undefined>;
  prepararEditorial?(encargo: Readonly<EncargoPost>): Promise<void>;
  registrarCorreccion?(proyecto: string, paso: PasoPost, datos: Record<string, unknown>): Promise<void>;
  antesDePaso(paso: PasoPost, encargo: Readonly<EncargoPost>, accion: AccionVista): Promise<ResultadoAntes>;
  trasPaso(paso: PasoPost, anterior: Readonly<EncargoPost>, encargo: Readonly<EncargoPost>, accion: AccionVista, parada: string | undefined): Promise<ResultadoTras>;
}

/**
 * La «via» de una acción de la línea de comandos.
 * - Si no confirma ni rechaza: undefined.
 * - Si el productor está encendido y la terminal NO es interactiva: lanza ErrorDeUsuario con el mensaje
 *   'Con el productor encendido, --confirmo y --rechazo solo valen desde una terminal interactiva: las paradas las confirma el usuario, no un script. Confírmalo tú en una terminal o en la web.'
 * - Si la terminal es interactiva: 'terminal'.
 * - Si no (productor apagado y sin terminal): undefined (como hasta ahora).
 */
export function viaDeLaTerminal(p: { productor: boolean; confirmaORechaza: boolean; interactiva: boolean }): Via | undefined {
  if (!p.confirmaORechaza) return undefined;
  if (p.productor && !p.interactiva) {
    throw new ErrorDeUsuario('Con el productor encendido, --confirmo y --rechazo solo valen desde una terminal interactiva: las paradas las confirma el usuario, no un script. Confírmalo tú en una terminal o en la web.');
  }
  return p.interactiva ? 'terminal' : undefined;
}
