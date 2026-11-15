/**
 * F3.3 (punto 14): la HUELLA TIPOGRÁFICA de un local, sacada de sus piezas anteriores (sus intenciones) y de su marca,
 * y los efectos tipográficos de la referencia. El director recibe las dos y una regla de mezcla: la identidad del local
 * manda y la referencia aporta uno o dos gestos. Así la pieza no calca la referencia. Dominio puro.
 */
import type { FichaReferencia } from '../referencia.js';
import type { Intencion, Tokens } from './intencion.js';

export const EFECTOS = ['CONTORNO', 'CORTE', 'GIRO', 'SANGRADO', 'MEZCLA_DE_VOCES', 'SCRIPT_QUE_CRUZA', 'VERSALITAS_ESPACIADAS', 'TINTA_IMPRESA'] as const;
export type Efecto = (typeof EFECTOS)[number];

export interface HuellaTipografica {
  local: string;
  /** Piezas de las que sale (0: solo la marca). */
  piezas: number;
  /** En cuántas piezas aparece cada efecto. */
  efectos: Partial<Record<Efecto, number>>;
  /** Las fuentes que ha usado, de más a menos. */
  fuentes: string[];
  /** Lo que dice la marca (tokens): voces y versalitas. */
  deMarca: string[];
}

const NOMBRES: Record<Efecto, string> = {
  CONTORNO: 'texto en contorno',
  CORTE: 'palabra cortada',
  GIRO: 'texto girado',
  SANGRADO: 'titular que sangra',
  MEZCLA_DE_VOCES: 'mezcla de voces',
  SCRIPT_QUE_CRUZA: 'una script que cruza',
  VERSALITAS_ESPACIADAS: 'versalitas espaciadas',
  TINTA_IMPRESA: 'tinta impresa',
};

/** `esScript`: si una fuente del catálogo es manuscrita, de pincel o caligráfica. */
export function huellaDelLocal(local: string, intenciones: Intencion[], tokens: Tokens | undefined, esScript: (fuente: string) => boolean): HuellaTipografica {
  const efectos: Partial<Record<Efecto, number>> = {};
  const usoDeFuentes = new Map<string, number>();
  const contar = (e: Efecto) => (efectos[e] = (efectos[e] ?? 0) + 1);
  for (const i of intenciones) {
    const estilos = { ...(tokens?.estilos ?? {}), ...i.tokens.estilos };
    const vistos = new Set<Efecto>();
    const fuentes = new Set<string>();
    for (const c of i.capas) {
      if (c.tipo !== 'texto') continue;
      const e = estilos[c.estilo];
      if (e) fuentes.add(e.fuente);
      if (c.contorno) vistos.add('CONTORNO');
      if (c.corte) vistos.add('CORTE');
      if (c.giro || c.rotacion) vistos.add('GIRO');
      if (c.sangrado) vistos.add('SANGRADO');
      if (c.tinta) vistos.add('TINTA_IMPRESA');
      if (e && e.caso === 'mayusculas' && e.tracking >= 0.12) vistos.add('VERSALITAS_ESPACIADAS');
      if (e && esScript(e.fuente) && (c.giro || c.recortarCon)) vistos.add('SCRIPT_QUE_CRUZA');
    }
    if (fuentes.size >= 2) vistos.add('MEZCLA_DE_VOCES');
    for (const f of fuentes) usoDeFuentes.set(f, (usoDeFuentes.get(f) ?? 0) + 1);
    for (const v of vistos) contar(v);
  }
  const deMarca = Object.entries(tokens?.estilos ?? {}).map(([id, e]) => `${id}: ${e.fuente}${e.caso === 'mayusculas' ? ', mayúsculas' : ''}${e.tracking >= 0.12 ? ' espaciadas' : ''}`);
  return { local, piezas: intenciones.length, efectos, fuentes: [...usoDeFuentes.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f), deMarca };
}

/** Los efectos tipográficos de una referencia, por su ficha (mecanismos, tipografía y tratamiento). */
export function efectosDeLaReferencia(f: FichaReferencia | undefined): Efecto[] {
  if (!f) return [];
  const e = new Set<Efecto>();
  if (f.mecanismos.includes('CONTORNO_AL_CRUZAR')) e.add('CONTORNO');
  if (f.mecanismos.includes('PALABRA_GIRADA')) e.add('GIRO');
  if (f.mecanismos.includes('ENTRA_POR_LOS_BORDES')) e.add('SANGRADO');
  const clases = f.tipografia.map((t) => t.clasificacion.toLowerCase()).join(' ');
  if (/script|pincel|florituras|caligr|manuscrit/.test(clases)) e.add('SCRIPT_QUE_CRUZA');
  if (new Set(f.tipografia.map((t) => t.clasificacion)).size >= 2) e.add('MEZCLA_DE_VOCES');
  if (/versalit/.test(clases)) e.add('VERSALITAS_ESPACIADAS');
  if (f.tratamiento?.some((t) => t === 'TINTA' || t === 'TRAMA')) e.add('TINTA_IMPRESA');
  return [...e];
}

/** El bloque para el director: efectos del local, de la referencia y la regla de mezcla. */
export function textoDeHuella(h: HuellaTipografica, referencia: Efecto[]): string {
  const propios = (Object.entries(h.efectos) as Array<[Efecto, number]>).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${NOMBRES[k]} (${n} de ${h.piezas})`);
  const nuevos = referencia.filter((r) => !(r in h.efectos));
  return [
    `IDENTIDAD TIPOGRÁFICA DEL LOCAL (${h.piezas ? `${h.piezas} pieza(s) anteriores` : 'sin piezas anteriores: solo su marca'}):`,
    `  Efectos del local: ${propios.join(', ') || 'ninguno todavía'}. Voces de la marca: ${h.deMarca.join(' · ') || '—'}.`,
    `  Efectos de la referencia: ${referencia.map((r) => NOMBRES[r]).join(', ') || 'ninguno destacable'}.`,
    `  REGLA DE MEZCLA: la identidad del local manda (sus voces y sus efectos de siempre); de la referencia toma uno o dos gestos${nuevos.length ? ` (candidatos: ${nuevos.map((r) => NOMBRES[r]).join(', ')})` : ''}, no su tipografía entera.`,
  ].join('\n');
}
