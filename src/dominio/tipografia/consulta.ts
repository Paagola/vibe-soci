/**
 * El buscador determinista de tipografía especial (SISTEMA.md §3, pasos 1 a 3): de una consulta (rasgos del local,
 * materiales del plato, tipografía de la referencia, fuentes de la marca y rol del texto) a una lista ordenada de
 * estilos con su puntuación y sus razones, en español y legibles. El director (un LLM) elige después entre los tres
 * primeros o dice «NINGUNO»; sin director, se queda el primero si pasa el umbral.
 *
 * 1. Filtro duro (un estilo que no lo pasa queda descartado, con el motivo):
 *    - solo recetas APROBADO; solo para el titular;
 *    - fuente: la del rol no puede tener una clasificación de `ficha.fuentes.noAptas` ni un rasgo que la ficha evite
 *      («fuentes muy gruesas»). Si no vale, se prueba con otra fuente de la marca (y se resta un punto); si ninguna
 *      vale, se descarta;
 *    - `ficha.evitar`: cada frase se lee con el diccionario de rasgos.ts y su ámbito sale de su primera palabra:
 *      «platos…» o «bebidas…» se mira en el plato, «locales…» en los rasgos del local (sin contar los que solo salen
 *      del nombre), «fondos…» en el fondo y «fuentes…» en la fuente; si no empieza por ninguna, en el plato y en el local;
 *    - un estilo cuyos materiales son todos comestibles (la derretida: queso, chocolate…) solo va si el plato tiene uno
 *      de ellos. Es la regla de la hoja del 19/11: «el material tiene que ser del plato».
 * 2. Puntuación (PESOS): material del plato que coincide (alto), material del entorno del local (la madera de la barra,
 *    el neón del rótulo), material que pide la referencia, cada rasgo del local que coincide con una identidad de la
 *    ficha, y lo observado en hojas anteriores sobre este local (a favor o en contra).
 */
import { contraste } from '../diseno/color.js';
import { normalizarTexto } from '../inventario.js';
import type { Receta } from './receta.js';
import { buscarEn, FONDOS, MATERIALES, materialDeTermino, RASGOS, RASGOS_DE_FUENTE, rasgoDeTermino, type Material, type Rasgo } from './rasgos.js';

/** Una fuente de la marca (un estilo de sus tokens) con lo que el catálogo dice de ella. */
export interface FuenteDeMarca {
  /** Id del estilo en los tokens («titular», «versalita»). */
  estilo: string;
  /** Id de la fuente en el catálogo («bodoni-moda-italica»). */
  fuente: string;
  familia: string;
  clasificacion: string[];
  ejes: Record<string, number>;
}

export interface ConsultaTipografica {
  local: { slug: string; nombre: string; rasgos: Rasgo[]; materiales: Material[] };
  plato: { texto?: string; materiales: Material[] };
  /** Lo que dice la ficha de la referencia de su titular («script de pincel», «letra de papel recortado»). */
  referencia?: { tipografia: string };
  /** Las fuentes de la marca; la primera es la del rol que se busca. */
  fuentes: FuenteDeMarca[];
  rol: 'titular' | 'secundario' | 'apoyo';
  /** Sobre qué irá el texto. Sin dato, no se filtra por fondo. */
  fondo?: 'claro' | 'oscuro';
}

export const PESOS = {
  materialDelPlato: 4,
  materialDelLocal: 2,
  materialDeLaReferencia: 2,
  rasgo: 1,
  observacion: 2,
  otraFuente: -1,
} as const;

/**
 * Por debajo de esto, el estilo sería adorno: sin director, la pieza va sin tipografía especial. Con estos pesos, basta
 * un material del plato; sin él, hacen falta tres rasgos del local, o algo del entorno o de lo observado que lo apoye.
 */
export const UMBRAL = 3;

export interface Candidato {
  id: string;
  nombre: string;
  receta: Receta;
  apto: boolean;
  puntuacion: number;
  razones: string[];
  /** La fuente con la que se pintaría (la del rol o, si no vale, otra de la marca). */
  fuente?: FuenteDeMarca;
}

/** Rasgos de una fuente tal como la usa la marca: su clasificación y lo que dicen sus ejes (un wght 900 es gruesa). */
export function rasgosDeFuente(f: Pick<FuenteDeMarca, 'clasificacion' | 'ejes'>): string[] {
  const rasgos = new Set(f.clasificacion);
  if ((f.ejes.wght ?? 0) >= 800 || f.clasificacion.includes('pesada')) rasgos.add('gruesa');
  if ((f.ejes.wdth ?? 100) >= 115 || f.clasificacion.includes('extendida')) rasgos.add('extendida');
  if (f.ejes.wght !== undefined && f.ejes.wght <= 300) rasgos.add('fina');
  return [...rasgos];
}

/** Sobre qué fondo irá un texto de este color: uno claro necesita fondo oscuro, y al revés. */
export function fondoParaColor(hexTexto: string): 'claro' | 'oscuro' {
  return contraste(hexTexto, '#000000') >= contraste(hexTexto, '#FFFFFF') ? 'oscuro' : 'claro';
}

type Ambito = 'plato' | 'local' | 'fondo' | 'fuente' | 'todo';

/** Una frase de «evitar», leída: su ámbito y lo que nombra (rasgos, materiales, rasgos de fuente, fondo). */
export function leerEvitar(frase: string): { ambito: Ambito; rasgos: string[]; materiales: string[]; fuente: string[]; fondo: string[] } {
  const primera = normalizarTexto(frase).split(/[^a-z0-9]+/)[0] ?? '';
  const ambito: Ambito = /^(plato|bebida)/.test(primera) ? 'plato' : /^local/.test(primera) ? 'local' : /^fondo/.test(primera) ? 'fondo' : /^fuente/.test(primera) ? 'fuente' : 'todo';
  return {
    ambito,
    rasgos: buscarEn(RASGOS, frase, 'ficha').map((h) => h.id),
    materiales: buscarEn(MATERIALES, frase, 'ficha').map((h) => h.id),
    fuente: buscarEn(RASGOS_DE_FUENTE, frase, 'ficha').map((h) => h.id),
    fondo: buscarEn(FONDOS, frase, 'ficha').map((h) => h.id),
  };
}

const lista = (xs: string[]) => xs.map((x) => `«${x}»`).join(', ');
const firmar = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Palabras del nombre del local que lo identifican en una observación («Aranda», «Güeno»), sin las genéricas. */
const GENERICAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'lo', 'y', 'casa', 'meson', 'cafe', 'asador', 'restaurante', 'bar', 'burger', 'taberna', 'prueba']);
function senasDelLocal(nombre: string, slug: string): string[] {
  const palabras = [...normalizarTexto(nombre).split(/[^a-z0-9]+/), ...slug.split('-')].filter((p) => p.length >= 3 && !GENERICAS.has(p));
  return [...new Set(palabras)];
}

/** En contra si dice que queda raro, que falla o que no es; a favor si dice que encaja, se lee o es «de marca». */
const EN_CONTRA = /\b(raro|rara|no|falla|borra|mal|pintura|contorno doble)\b/;
const A_FAVOR = /\b(encaja|creible|de marca|funciona|se lee|sutil)\b/;

export function candidatos(recetas: Receta[], consulta: ConsultaTipografica): Candidato[] {
  const evaluados = recetas.map((receta) => evaluar(receta, consulta));
  return evaluados.sort((a, b) => Number(b.apto) - Number(a.apto) || b.puntuacion - a.puntuacion || a.id.localeCompare(b.id));
}

function evaluar(receta: Receta, consulta: ConsultaTipografica): Candidato {
  const base = { id: receta.id, nombre: receta.nombre, receta };
  const descartar = (razones: string[]): Candidato => ({ ...base, apto: false, puntuacion: 0, razones });
  const ficha = receta.ficha;

  if (receta.estado !== 'APROBADO') return descartar([`está en ${receta.estado}: el buscador solo elige estilos APROBADO`]);
  if (consulta.rol !== 'titular') return descartar([`es para el titular y esto es un texto ${consulta.rol}`]);

  const evitar = ficha.evitar.map((frase) => ({ frase, ...leerEvitar(frase) }));
  const rasgosFuertes = consulta.local.rasgos.filter((r) => !r.debil);
  const choques: string[] = [];
  for (const e of evitar) {
    const enPlato = e.ambito === 'plato' || e.ambito === 'todo';
    const enLocal = e.ambito === 'local' || e.ambito === 'todo';
    const material = enPlato ? consulta.plato.materiales.find((m) => e.materiales.includes(m.id)) : undefined;
    const rasgoPlato = enPlato && consulta.plato.texto ? buscarEn(RASGOS, consulta.plato.texto, 'plato').find((h) => e.rasgos.includes(h.id)) : undefined;
    const rasgo = enLocal ? rasgosFuertes.find((r) => e.rasgos.includes(r.id)) : undefined;
    if (material) choques.push(`evita «${e.frase}» y el plato lleva «${material.palabra}» (${material.id})`);
    else if (rasgoPlato) choques.push(`evita «${e.frase}» y el plato es «${rasgoPlato.palabra}» (${rasgoPlato.id})`);
    else if (rasgo) choques.push(`evita «${e.frase}» y el local es ${rasgo.id} (de «${rasgo.palabra}», ${rasgo.origen})`);
    else if (e.ambito === 'fondo' && consulta.fondo && e.fondo.includes(consulta.fondo)) choques.push(`evita «${e.frase}» y el texto irá sobre fondo ${consulta.fondo}`);
  }
  if (choques.length) return descartar(choques);

  // Un estilo hecho solo de materiales comestibles imita el plato: sin ese material en el plato, sobra.
  const suyos = ficha.materiales.map((t) => materialDeTermino(t)).filter((m): m is string => Boolean(m));
  const comestibles = suyos.every((id) => MATERIALES.find((m) => m.id === id)?.comestible);
  const delPlato = consulta.plato.materiales.filter((m) => suyos.includes(m.id));
  if (suyos.length && comestibles && delPlato.length === 0) {
    return descartar([`imita un material del plato (${lista(ficha.materiales)}) y el plato${consulta.plato.texto ? ` («${consulta.plato.texto}»)` : ''} no tiene ninguno: el material tiene que ser del plato`]);
  }

  // La fuente: la del rol o, si no vale, otra de la marca.
  const evitaEnFuente = evitar.filter((e) => e.ambito === 'fuente');
  const problemaDe = (f: FuenteDeMarca): string | undefined => {
    const suyosF = rasgosDeFuente(f);
    const noApta = ficha.fuentes.noAptas.filter((c) => suyosF.includes(c));
    if (noApta.length) return `${f.familia} es ${noApta.join(', ')}: no apta`;
    const evitada = evitaEnFuente.find((e) => e.fuente.some((r) => suyosF.includes(r)));
    if (evitada) return `${f.familia} (${f.estilo}) es ${evitada.fuente.filter((r) => suyosF.includes(r)).join(' y ')} y el estilo evita «${evitada.frase}»`;
    return undefined;
  };
  const razones: string[] = [];
  let puntuacion = 0;
  const [delRol, ...otras] = consulta.fuentes;
  if (!delRol) return descartar(['la marca no tiene ninguna fuente en sus tokens']);
  let fuente: FuenteDeMarca | undefined = delRol;
  const problema = problemaDe(delRol);
  if (problema) {
    fuente = otras.find((f) => !problemaDe(f));
    if (!fuente) return descartar([`${problema}, y ninguna otra fuente de la marca vale (${otras.map((f) => problemaDe(f)).join('; ') || 'no tiene más'})`]);
    puntuacion += PESOS.otraFuente;
    razones.push(`${problema}; se pintaría con ${fuente.familia} («${fuente.estilo}»), otra fuente de la marca (${firmar(PESOS.otraFuente)})`);
  }

  // Materiales: del plato (alto), del entorno del local y de la referencia. Cada material cuenta una vez, por lo más alto.
  const contados = new Set<string>();
  const palabrasUsadas = new Set<string>();
  for (const m of delPlato) {
    contados.add(m.id);
    puntuacion += PESOS.materialDelPlato;
    razones.push(`material «${m.id}» del plato coincide (de «${m.palabra}», ${m.origen}) (${firmar(PESOS.materialDelPlato)})`);
  }
  // Lo comestible que nombra el local es su carta, no este plato; lo que no se come es su entorno (la barra, el rótulo).
  for (const m of consulta.local.materiales.filter((x) => !x.comestible && suyos.includes(x.id) && !contados.has(x.id))) {
    contados.add(m.id);
    palabrasUsadas.add(`${m.origen}|${normalizarTexto(m.palabra)}`);
    puntuacion += PESOS.materialDelLocal;
    razones.push(`material «${m.id}» del local (de «${m.palabra}», ${m.origen}) (${firmar(PESOS.materialDelLocal)})`);
  }
  if (consulta.referencia?.tipografia) {
    for (const h of buscarEn(MATERIALES, consulta.referencia.tipografia, 'referencia').filter((x) => suyos.includes(x.id) && !contados.has(x.id))) {
      contados.add(h.id);
      puntuacion += PESOS.materialDeLaReferencia;
      razones.push(`la referencia tiene letra de «${h.palabra}» (${h.id}) (${firmar(PESOS.materialDeLaReferencia)})`);
    }
  }

  // Identidad: cada rasgo del local que la ficha nombra (con cualquiera de sus palabras), una vez.
  const identidades = new Set(ficha.identidades.map((t) => rasgoDeTermino(t)).filter((r): r is string => Boolean(r)));
  for (const r of consulta.local.rasgos.filter((x) => identidades.has(x.id))) {
    // Una misma palabra no cuenta dos veces («neón» ya contó como material del rótulo).
    if (palabrasUsadas.has(`${r.origen}|${normalizarTexto(r.palabra)}`)) continue;
    puntuacion += PESOS.rasgo;
    razones.push(`el local es ${r.id} (de «${r.palabra}», ${r.origen}${r.debil ? ', solo por el nombre' : ''}) (${firmar(PESOS.rasgo)})`);
  }

  // Lo observado en hojas anteriores sobre este local.
  const senas = senasDelLocal(consulta.local.nombre, consulta.local.slug);
  for (const o of ficha.observaciones) {
    const normal = normalizarTexto(o);
    const sena = senas.find((s) => new RegExp(`\\b${s}\\b`).test(normal));
    if (!sena) continue;
    const contra = EN_CONTRA.test(normal);
    const favor = !contra && A_FAVOR.test(normal);
    if (!contra && !favor) continue;
    const peso = contra ? -PESOS.observacion : PESOS.observacion;
    puntuacion += peso;
    razones.push(`observado ${contra ? 'en contra' : 'a favor'} en este local: «${o}» (${firmar(peso)})`);
  }

  if (razones.every((r) => r.startsWith(`${delRol.familia}`) || r.includes('otra fuente'))) razones.push('nada del plato ni del local lo pide');
  return { ...base, apto: true, puntuacion, razones, fuente };
}

/** Los términos de una consulta que una justificación puede citar: materiales, rasgos y las palabras de donde salen. */
export function terminosDeLaConsulta(consulta: ConsultaTipografica): string[] {
  const t = [...consulta.plato.materiales, ...consulta.local.materiales, ...consulta.local.rasgos].flatMap((h) => [h.id, h.palabra]);
  return [...new Set(t.map((x) => normalizarTexto(x)).filter((x) => x.length >= 3))];
}
