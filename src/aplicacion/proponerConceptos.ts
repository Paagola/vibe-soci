import type { Concepto } from '../dominio/modelos.js';
import { construirContexto } from './contextoCreativo.js';
import type { Dependencias } from './dependencias.js';
import { sinProgreso, type AlProgresar } from './progreso.js';

/** Pide 3 conceptos nuevos al director. Los anteriores cuentan como descartados para no repetirlos. */
export async function proponerConceptos(
  deps: Pick<Dependencias, 'piezas' | 'locales' | 'biblioteca' | 'director'>,
  piezaId: string,
  opciones: { alProgresar?: AlProgresar } = {},
): Promise<Concepto[]> {
  const pieza = await deps.piezas.obtener(piezaId);
  (opciones.alProgresar ?? sinProgreso)({
    mensaje: 'El director está mirando las fotos…',
    hechas: 0,
    total: 0,
    pasosRestantes: { director: 1, tandas: 0 },
  });
  const contexto = await construirContexto(deps, pieza);
  const nuevos = await deps.director().proponerConceptos(contexto, pieza.conceptos);

  await deps.piezas.actualizar(piezaId, (actual) => ({ ...actual, conceptos: [...actual.conceptos, ...nuevos] }));
  return nuevos;
}
