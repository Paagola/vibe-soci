/**
 * Estudio de arte · el bibliotecario de operaciones: lee el corpus de referencias visuales
 * (referencias-pinterest/diseno-visual/README.md, el que se curó a mano) y elige qué piezas enseñarle al director.
 *
 * El índice sale del README (no hay un segundo fichero que se desincronice). Se eligen piezas que enseñen operaciones que
 * el estudio sabe ejecutar, del mismo tipo de local primero, y que no repitan operación entre ellas: el director tiene que
 * ver un repertorio, no una receta.
 */
import type { TipoDeOperacion } from './receta.js';

export interface PiezaDeReferencia {
  /** Ruta relativa a la carpeta del corpus. */
  archivo: string;
  carpeta: string;
  contiene: string;
  decision: string;
  operaciones: string[];
  formato: string;
}

/** Las etiquetas del corpus que el estudio sabe ejecutar hoy, y con qué parte de la receta. */
export const EJECUTABLES: Record<string, string> = {
  OCLUSION: 'titular «detras» del producto (CARTEL, PRODUCTO_SOBRE_COLOR, FOTO_A_SANGRE)',
  TIPOGRAFIA_MONUMENTAL: 'titular «monumental» (CARTEL)',
  ENTRELAZADO: 'titular «contorno» o «detras»',
  REPETICION: 'operación REPETICION',
  ANOTACION: 'operación ANOTACIONES',
  SALE_DEL_MARCO: 'esqueleto MARCO',
  RETICULA_ASIMETRICA: 'esqueleto PARTIDA',
  CRUCE_DE_ZONAS: 'esqueleto PARTIDA',
  RETICULA_EDITORIAL: 'esqueleto EDITORIAL (+ FILETES)',
  VACIO: 'esqueleto EDITORIAL, producto «contenida»',
  RECORTE_PEGATINA: 'producto con «filo»',
  RECORTE: 'producto recortado (PRODUCTO_SOBRE_COLOR)',
  COLOR_PLANO: 'esqueleto PRODUCTO_SOBRE_COLOR',
  ESCALA: 'producto «enorme»',
  SANGRADO: 'producto «enorme» o titular que sangra',
  RISOGRAFIA: 'tinta «impresa»/«gastada» con «registro», TEXTURA papel',
  SEMITONO: 'TRAMA puntos',
  TIPOGRAFIA_MANUSCRITA: 'acentoManuscrito',
  LETTERING: 'acentoManuscrito en voz de pincel',
  ACENTO_UNICO: 'un solo acento: SELLO o FORMA_DETRAS',
  TIPOGRAFIA_DE_FONDO: 'REPETICION o CARTEL',
};

export const OPERACION_DE_ETIQUETA: Partial<Record<string, TipoDeOperacion>> = {
  REPETICION: 'REPETICION',
  ANOTACION: 'ANOTACIONES',
  RISOGRAFIA: 'TEXTURA',
  SEMITONO: 'TRAMA',
  RETICULA_EDITORIAL: 'FILETES',
};

/** Lee las filas de las tablas del README: | [archivo](carpeta/archivo) | contiene | decisión | `OPS` | formato | … */
export function leerCorpus(readme: string): PiezaDeReferencia[] {
  const piezas: PiezaDeReferencia[] = [];
  for (const linea of readme.split('\n')) {
    const m = /^\| \[[^\]]+\]\(([^)]+\.(?:jpe?g|png|webp))\) \| ([^|]+) \| ([^|]+) \| `([^`]+)` \| ([^|]+) \|/.exec(linea);
    if (!m) continue;
    const archivo = m[1]!;
    piezas.push({
      archivo,
      carpeta: archivo.split('/')[0] ?? '',
      contiene: m[2]!.trim(),
      decision: m[3]!.trim(),
      operaciones: m[4]!.split(',').map((x) => x.trim()).filter(Boolean),
      formato: m[5]!.trim(),
    });
  }
  return piezas;
}

/** Hamburguesería → hamburgueserias; el resto, por su tipo. */
export function carpetaDelLocal(descripcion: string): string[] {
  const d = descripcion.toLowerCase();
  if (/hamburgues|burger/.test(d)) return ['hamburgueserias', 'restaurantes'];
  if (/cóctel|coctel|bar de copas/.test(d)) return ['coctelerias'];
  if (/caf[eé]|churr|desayun/.test(d)) return ['cafeterias', 'panaderias-postres'];
  if (/sushi|pizz/.test(d)) return ['pizza-sushi-otros', 'restaurantes'];
  return ['restaurantes', 'pizza-sushi-otros'];
}

/** Generador pseudoaleatorio con semilla (para que la misma pieza vea las mismas referencias al repetirla). */
function azar(semilla: string): () => number {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Elige `n` piezas: solo posts (las historias y los carruseles se usan en su formato), con al menos una operación
 * ejecutable, primero del tipo de local, sin repetir la operación ejecutable principal de otra ya elegida.
 */
export function elegirReferencias(corpus: PiezaDeReferencia[], opciones: { carpetas: string[]; n: number; semilla: string; excluir?: string[] }): PiezaDeReferencia[] {
  const r = azar(opciones.semilla);
  const ejecutables = (p: PiezaDeReferencia) => p.operaciones.filter((o) => o in EJECUTABLES);
  const candidatas = corpus
    .filter((p) => p.carpeta !== 'historias-verticales' && p.carpeta !== 'carruseles' && ejecutables(p).length > 0 && !(opciones.excluir ?? []).includes(p.archivo))
    .map((p) => ({ p, orden: (opciones.carpetas.includes(p.carpeta) ? 0 : 1) + r() * 1.4 }))
    .sort((a, b) => a.orden - b.orden);
  const elegidas: PiezaDeReferencia[] = [];
  const vistas = new Set<string>();
  for (const { p } of candidatas) {
    if (elegidas.length >= opciones.n) break;
    const nuevas = ejecutables(p).filter((o) => !vistas.has(o));
    if (!nuevas.length) continue;
    elegidas.push(p);
    for (const o of ejecutables(p)) vistas.add(o);
  }
  return elegidas;
}

/** Cómo se le cuenta una referencia al director: qué decisión enseña y con qué parte de la receta se ejecuta. */
export function referenciaEnTexto(p: PiezaDeReferencia, i: number): string {
  const como = [...new Set(p.operaciones.filter((o) => o in EJECUTABLES).map((o) => EJECUTABLES[o]!))].join('; ');
  return `REF ${i + 1} (${p.carpeta}): ${p.contiene} — Decisión: ${p.decision} — Se ejecuta con: ${como}.`;
}
