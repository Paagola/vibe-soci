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

/** Explica un bloqueo por descartes para el formulario y la terminal. */
export function explicarBloqueo(e: Pick<EncargoPost, 'bloqueo' | 'intentos' | 'autorizacion'>): Explicacion | undefined {
  if (!e.bloqueo) return undefined;
  const k = descartesSeguidos(e.intentos);
  if (!k) return undefined;
  const ultimos = e.intentos.slice(-k);
  const motivos = [...new Set(ultimos.flatMap((i) => i.motivos).map(motivoLlano))];
  const quien = ultimos.every((i) => i.final === 'DESCARTA') ? 'la comprobación automática las ha descartado' : 'han sido descartadas';
  const est = e.autorizacion?.estimadoPorIntentoUsd ?? 0;
  return {
    queHaPasado: `Se han hecho ${k} fotos seguidas y ${quien}, así que la orden se ha parado para no gastar más.${motivos.length ? ` Motivos: ${motivos.join('; ')}.` : ''}`,
    quePuedesHacer: [
      'Comprueba que todo lo que hay en el plato cabe en la toma. Si algo queda fuera, prueba un plano más abierto o una cámara más alta.',
      'Corrige la lista o la toma y guarda la corrección antes de confirmar.',
      `Cuando esté bien, vuelve a confirmar: se podrán hacer hasta ${MAX_INTENTOS_SEGUIDOS} intentos de la foto principal${est > 0 ? ` (≤ ${(est * MAX_INTENTOS_SEGUIDOS).toFixed(2)} USD)` : ''}.`,
    ],
  };
}
