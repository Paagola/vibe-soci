import { decidirSalida, RevisionAutomatica, type AireMedido } from '../../dominio/comprobacionSalida.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { RevisorVisual } from '../../puertos/RevisorVisual.js';

export interface DepsComprobacion {
  activos: AlmacenActivos;
  revisor: RevisorVisual;
  ahora: () => string;
}

export interface EntradaComprobacion {
  local: string;
  /** Activo de la foto nueva (GENERADO). */
  generado: string;
  /** Activo de la foto real que subió el restaurante. */
  real: string;
  /** Lista confirmada de elementos, tal como se pidió al generador. */
  lista: string;
  /** Piezas que se cuentan con la pasada de anatomía (C). Vacío: no se hace. */
  piezas?: Array<{ nombre: string; esperado: number }>;
  /** false: no se pregunta la toma (p. ej. una foto hecha solo con texto, sin foto real). */
  comprobarToma?: boolean;
  /** false: no se guarda en el activo (para ensayos). */
  guardar?: boolean;
  /** La referencia que vio el generador como @image2: se comprueba que no se haya copiado nada de ella. */
  referencia?: string;
  /** El aire que pidió el director de foto, ya medido con el mapa de la foto nueva. */
  aire?: AireMedido;
}

/**
 * Comprobación de salida de una foto nueva: el revisor contesta (checklist, toma y anatomía) y el dominio decide.
 * Se guarda en el activo generado (revisionAutomatica). No cambia su `fidelidad` (el veredicto humano) ni su `uso`.
 */
export async function comprobarFotoNueva(deps: DepsComprobacion, e: EntradaComprobacion): Promise<RevisionAutomatica> {
  const [generado, real] = await Promise.all([deps.activos.obtener(e.local, e.generado), deps.activos.obtener(e.local, e.real)]);
  if (generado.activo.tipo !== 'GENERADO') throw new Error(`«${e.generado}» no es una foto generada.`);
  const fotos = { real: real.ruta, generada: generado.ruta, ...(e.referencia ? { referencia: e.referencia } : {}) };

  const checklist = await deps.revisor.comprobarElementos(fotos, e.lista);
  const toma = e.comprobarToma === false ? undefined : await deps.revisor.compararToma(fotos);
  const anatomia = e.piezas?.length ? await deps.revisor.contarAnatomia(generado.ruta, e.piezas) : undefined;
  const decision = decidirSalida(checklist, toma, anatomia, e.aire);

  const revision = RevisionAutomatica.parse({
    fecha: deps.ahora(),
    revisor: deps.revisor.nombre,
    frente: e.real,
    lista: e.lista,
    ...decision,
    respuestas: { checklist, ...(toma ? { toma } : {}), ...(anatomia ? { anatomia } : {}), ...(e.aire ? { aire: e.aire } : {}) },
  });
  if (e.guardar !== false) await deps.activos.anotarRevision(e.local, e.generado, revision);
  return revision;
}
