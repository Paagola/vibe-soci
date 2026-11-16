/**
 * Explicación en castellano llano de un bloqueo de la orden (para la web y la parada): qué ha pasado y qué puedes hacer.
 * Sin comandos ni nombres de fichero.
 */
import { MAX_INTENTOS_SEGUIDOS, descartesSeguidos, type EncargoPost } from './post.js';

export interface Explicacion { queHaPasado: string; quePuedesHacer: string[] }

const REGLAS_DE_MOTIVO: ReadonlyArray<{ patron: RegExp; frase: (m: RegExpMatchArray) => string }> = [
  { patron: /^falta: (.+)$/, frase: (m) => `falta «${m[1]}» en la foto` },
  { patron: /^añadido: (.+)$/, frase: (m) => `aparece algo que no está en el plato: ${m[1]}` },
  { patron: /^cambiado respecto a la foto real: (.+)$/, frase: (m) => `sale distinto que en la foto real: ${m[1]}` },
  { patron: /^anatomía[^:]* de (.+?): (.+)$/, frase: (m) => `no salen bien las piezas de «${m[1]}» (${m[2]})` },
  { patron: /^texto nuevo: (.+)$/, frase: (m) => `la foto lleva texto: ${m[1]}` },
  { patron: /^copiado de la referencia: (.+)$/, frase: (m) => `copia algo del post de referencia: ${m[1]}` },
  { patron: /^rechazada por ti: (.+)$/, frase: (m) => `la rechazaste tú: ${m[1]}` },
];

/** Un motivo de la comprobación, en castellano llano. Reglas (la primera que encaje):
 *  /^falta: (.+)$/ → `falta «$1» en la foto`
 *  /^añadido: (.+)$/ → `aparece algo que no está en el plato: $1`
 *  /^cambiado respecto a la foto real: (.+)$/ → `sale distinto que en la foto real: $1`
 *  /^anatomía[^:]* de (.+?): (.+)$/ → `no salen bien las piezas de «$1» ($2)`
 *  /^texto nuevo: (.+)$/ → `la foto lleva texto: $1`
 *  /^copiado de la referencia: (.+)$/ → `copia algo del post de referencia: $1`
 *  /^rechazada por ti: (.+)$/ → `la rechazaste tú: $1`
 *  si no, el motivo tal cual. */
export function motivoLlano(m: string): string {
  for (const { patron, frase } of REGLAS_DE_MOTIVO) {
    const coincide = patron.exec(m);
    if (coincide) return frase(coincide);
  }
  return m;
}

/**
 * Qué ha pasado y qué puedes hacer cuando la orden se para tras los descartes (para la web: sin comandos ni nombres de fichero).
 * undefined si `e.bloqueo` no está. k = descartesSeguidos(e.intentos); motivos = los de los k últimos intentos, con motivoLlano, sin repetidos.
 * queHaPasado = `Se han hecho ${k} fotos seguidas y la comprobación automática las ha descartado, así que la orden se ha parado para no gastar más. Motivos: ${motivos.join('; ')}.`
 * quePuedesHacer = [
 *   'Mira en la lista de esta parada si la toma nueva deja sitio a todo lo que hay en el plato: si falta algo en la foto, cambia la toma (más abierta o desde más arriba) o quita ese elemento de la lista si no tiene que salir.',
 *   'Corrige la lista o la toma en el formulario de esta parada y guarda la corrección.',
 *   `Cuando esté bien, vuelve a confirmar: se harán como mucho ${MAX_INTENTOS_SEGUIDOS} fotos más${est > 0 ? ` (≤ ${(est * MAX_INTENTOS_SEGUIDOS).toFixed(2)} USD)` : ''}.`,
 * ]  con est = e.autorizacion?.estimadoPorIntentoUsd ?? 0.
 */
export function explicarBloqueo(e: Pick<EncargoPost, 'bloqueo' | 'intentos' | 'autorizacion'>): Explicacion | undefined {
  if (!e.bloqueo) return undefined;
  const k = descartesSeguidos(e.intentos);
  // slice(-0) devolvería la lista entera: con k = 0 no hay intentos descartados que contar.
  const ultimos = k > 0 ? e.intentos.slice(-k) : [];
  const motivos = [...new Set(ultimos.flatMap((i) => i.motivos).map(motivoLlano))];
  const est = e.autorizacion?.estimadoPorIntentoUsd ?? 0;
  return {
    queHaPasado: `Se han hecho ${k} fotos seguidas y la comprobación automática las ha descartado, así que la orden se ha parado para no gastar más. Motivos: ${motivos.join('; ')}.`,
    quePuedesHacer: [
      'Mira en la lista de esta parada si la toma nueva deja sitio a todo lo que hay en el plato: si falta algo en la foto, cambia la toma (más abierta o desde más arriba) o quita ese elemento de la lista si no tiene que salir.',
      'Corrige la lista o la toma en el formulario de esta parada y guarda la corrección.',
      `Cuando esté bien, vuelve a confirmar: se harán como mucho ${MAX_INTENTOS_SEGUIDOS} fotos más${est > 0 ? ` (≤ ${(est * MAX_INTENTOS_SEGUIDOS).toFixed(2)} USD)` : ''}.`,
    ],
  };
}
