/**
 * Cambios sobre una intención. Cada uno devuelve una versión nueva (la anterior no se toca)
 * y solo cambia lo que dice: el resto de capas se reutiliza al pintar.
 */
import type { EstiloTexto, Intencion, Tokens } from './intencion.js';

function nuevaVersion(intencion: Intencion, cambios: Partial<Intencion>): Intencion {
  return { ...intencion, ...cambios, version: intencion.version + 1, padre: intencion.version };
}

/** Cambia un texto («@clave»). No regenera la foto ni mueve las demás capas. */
export function conTexto(intencion: Intencion, clave: string, valor: string): Intencion {
  if (!(clave in intencion.textos)) throw new RangeError(`La intención no tiene el texto «${clave}».`);
  return nuevaVersion(intencion, { textos: { ...intencion.textos, [clave]: valor } });
}

/** Cambia la foto de un papel (p. ej. «plato»): la composición se recalcula con la nueva máscara. */
export function conActivo(intencion: Intencion, papel: string, activoId: string): Intencion {
  if (!(papel in intencion.activos)) throw new RangeError(`La intención no tiene el activo «${papel}».`);
  return nuevaVersion(intencion, { activos: { ...intencion.activos, [papel]: activoId } });
}

/** Cambia un color de la paleta. */
export function conColor(intencion: Intencion, token: string, hex: string): Intencion {
  return nuevaVersion(intencion, { tokens: { ...intencion.tokens, colores: { ...intencion.tokens.colores, [token]: hex } } });
}

/**
 * Junta los tokens de la marca (constantes) con los de la intención (variables de esta pieza).
 * Lo de la intención manda.
 */
export function conTokensDeMarca(intencion: Intencion, marca: Tokens): Intencion {
  const estilos: Record<string, EstiloTexto> = { ...marca.estilos, ...intencion.tokens.estilos };
  return { ...intencion, tokens: { colores: { ...marca.colores, ...intencion.tokens.colores }, estilos } };
}
