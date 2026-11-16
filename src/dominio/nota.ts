/**
 * F3.3: la nota del dueño manda sobre cómo se llama cada cosa del plato.
 * En la v003 de Sushita el director de foto describió «rollitos de papel de arroz con tartar de toro» donde el dueño
 * había escrito «gunkan de toro»; esa descripción se confirmó, la toma generada la siguió (y pasó, porque se comprobó
 * contra esa misma lista) y el detalle publicó «envueltos en papel de arroz». Dos reglas lo frenan:
 * - un elemento que comparte ingrediente con un plato de la nota pero dice OTRA preparación (gunkan / rollito de papel
 *   de arroz) es una contradicción: no se puede confirmar sin corregirlo;
 * - el título de un detalle sale de la nota del dueño cuando la nota nombra ese elemento.
 * Dominio puro.
 */

/** Palabras de preparación: cambian lo que es el bocado (no el ingrediente). */
const PREPARACIONES = [
  'nigiri', 'gunkan', 'maki', 'uramaki', 'futomaki', 'hosomaki', 'temaki', 'sashimi', 'rollito', 'rollo', 'papel de arroz',
  'tempura', 'gyoza', 'tataki', 'tartar', 'carpaccio', 'ceviche', 'croqueta', 'brocheta', 'onigiri', 'poke',
];

const GRAMATICALES = new Set(['con', 'del', 'las', 'los', 'para', 'por', 'sin', 'una', 'unos', 'unas']);

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palabras = (t: string) => normal(t).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 2 && !GRAMATICALES.has(p));
/** La misma palabra o su plural (nigiri / nigiris, rollito / rollitos). */
const igual = (a: string, b: string) => a === b || (Math.min(a.length, b.length) > 3 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2);

export function preparacionesDe(t: string): string[] {
  const n = ` ${normal(t)} `;
  return PREPARACIONES.filter((p) => new RegExp(`[^a-z]${p}(e?s)?[^a-z]`).test(n));
}

/** Lo que queda de un texto sin sus preparaciones: los ingredientes («toro», «salmón», «foie»). */
function ingredientesDe(t: string): string[] {
  const prep = new Set(PREPARACIONES.flatMap((p) => p.split(' ')));
  return palabras(t).filter((p) => ![...prep].some((x) => igual(x, p)) && !['arroz', 'papel', 'salsa', 'cobertura', 'cremosa'].includes(p));
}

/** Los platos que nombra la nota: lo que va tras los dos puntos, partido por comas y por la «y» que abre otro plato. */
export function segmentosDeLaNota(nota: string): string[] {
  const cuerpo = nota.includes(':') ? nota.slice(nota.indexOf(':') + 1) : nota;
  const otra = PREPARACIONES.map((p) => p.replace(' ', '\\s+')).join('|');
  return cuerpo
    .split(new RegExp(`,|;|\\s+y\\s+(?=(?:${otra})\\b)`, 'i'))
    .map((s) => s.trim().replace(/[.]+$/, ''))
    .filter((s) => s.length > 2);
}

/** El plato de la nota que nombra ese elemento (comparte un ingrediente con él), si lo hay. */
export function segmentoDelElemento(nota: string, elemento: string): string | undefined {
  const suyos = ingredientesDe(elemento);
  return segmentosDeLaNota(nota)
    .map((s) => ({ s, n: ingredientesDe(s).filter((p) => suyos.some((q) => igual(p, q))).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0]?.s;
}

/** Elementos que la nota nombra con otra preparación: el dueño dice «gunkan de toro» y el director, «rollitos de papel de arroz…». */
export function contradiccionesConLaNota(nota: string, elementos: Array<{ nombre: string; estado: string }>): string[] {
  const problemas: string[] = [];
  for (const e of elementos) {
    const segmento = segmentoDelElemento(nota, e.nombre);
    if (!segmento) continue;
    const delDueno = preparacionesDe(segmento);
    const delElemento = preparacionesDe(`${e.nombre} ${e.estado}`);
    if (!delDueno.length || !delElemento.length) continue;
    const comparten = delDueno.some((p) => delElemento.includes(p));
    if (!comparten) {
      problemas.push(
        `«${e.nombre}» (${e.estado}) contradice la nota del dueño, que dice «${segmento}»: otra preparación (${delElemento.join(', ')} frente a ${delDueno.join(', ')}). Corrige el elemento con lo que se ve y como lo llama el dueño.`,
      );
    }
  }
  return problemas;
}

/** La primera letra en mayúscula y el resto tal cual: los títulos de una serie, todos igual. */
export function conMayuscula(t: string): string {
  return t ? t[0]!.toLocaleUpperCase('es') + t.slice(1) : t;
}
