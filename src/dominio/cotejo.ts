/**
 * Productor (fase 1): cotejo determinista de una propuesta de foto y de los textos de una pieza contra los hechos
 * (la nota del dueño y el inventario confirmado). Dominio puro.
 */
import { contradiccionesConLaNota, preparacionesDe } from './nota.js';
import { ElementoComparable, huellaDelInventario, normalizarTexto, textoDelInventario } from './inventario.js';

export interface DiferenciaDeInventario { anadidos: string[]; quitados: string[]; cambiados: string[] }

/** Empareja por normalizarTexto(nombre) y dice qué se añade, se quita o cambia. */
export function diferenciaDeInventario(confirmado: readonly ElementoComparable[], propuesto: readonly ElementoComparable[]): DiferenciaDeInventario {
  const A = new Map(confirmado.map((e) => [normalizarTexto(e.nombre), e] as const));
  const B = new Map(propuesto.map((e) => [normalizarTexto(e.nombre), e] as const));
  const anadidos = propuesto.filter((e) => !A.has(normalizarTexto(e.nombre))).map((e) => e.nombre);
  const quitados = confirmado.filter((e) => !B.has(normalizarTexto(e.nombre))).map((e) => e.nombre);
  const cambiados: string[] = [];
  for (const [clave, a] of A) {
    const b = B.get(clave);
    if (!b) continue;
    const estadoA = normalizarTexto(a.estado);
    const estadoB = normalizarTexto(b.estado);
    if (estadoA !== estadoB || a.recuento !== b.recuento || (a.cortados ?? 0) !== (b.cortados ?? 0)) {
      cambiados.push(`${a.nombre}: «${estadoA}» ×${a.recuento ?? '-'} → «${estadoB}» ×${b.recuento ?? '-'}`);
    }
  }
  return { anadidos, quitados, cambiados };
}

export interface InventarioParaCotejar { estado: 'PROPUESTO' | 'CONFIRMADO'; elementos: readonly ElementoComparable[]; huella: string }

/**
 * Problemas de una propuesta de foto frente al inventario y la nota del dueño. Vacío = todo cuadra.
 */
export function cotejarPropuestaFoto(inventario: InventarioParaCotejar, nota: string, propuesta: { elementos: readonly ElementoComparable[]; tomas: readonly string[] }): string[] {
  const problemas: string[] = [];
  if (inventario.estado === 'CONFIRMADO') {
    if (huellaDelInventario(propuesta.elementos) !== inventario.huella) {
      const d = diferenciaDeInventario(inventario.elementos, propuesta.elementos);
      const partes = [
        d.anadidos.length ? `añadidos: ${d.anadidos.join(', ')}` : '',
        d.quitados.length ? `quitados: ${d.quitados.join(', ')}` : '',
        d.cambiados.length ? `cambiados: ${d.cambiados.join(', ')}` : '',
      ].filter(Boolean);
      const grupos = partes.length ? partes.join('; ') : 'cambios menores';
      problemas.push(`La propuesta de foto cambia el inventario que confirmó el usuario (${grupos}). Solo cambia con otra confirmación suya.`);
    }
    const nombres = new Set(inventario.elementos.map((e) => normalizarTexto(e.nombre)));
    const listaNombres = inventario.elementos.map((e) => e.nombre).join('; ');
    for (const toma of propuesta.tomas) {
      if (!nombres.has(normalizarTexto(toma))) {
        problemas.push(`La toma de detalle «${toma}» no es ningún elemento del inventario confirmado (${listaNombres}).`);
      }
    }
  }
  problemas.push(...contradiccionesConLaNota(nota, [...propuesta.elementos]));
  return problemas;
}

export interface HechosParaTextos { nota: string; elementos: readonly ElementoComparable[]; marca?: string }

const REGEX_PRECIO = /(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:os?)?\b)|€\s*(\d+(?:[.,]\d{1,2})?)/;
const REGEX_COMERCIAL = /\b(premi\w*|galard\w*|n[º°o]\.?\s?1\b|numero\s+uno|(?:el|la|los|las)\s+mejor(?:es)?)|[®™]/;

/** Problemas de los textos de una pieza frente a los hechos (preparaciones, precios y afirmaciones comerciales). */
export function cotejarTextos(textos: readonly string[], hechos: HechosParaTextos): string[] {
  const problemas: string[] = [];
  const referenciaPrep = preparacionesDe(`${hechos.nota} ${hechos.elementos.map((e) => `${e.nombre} ${e.estado}`).join(' ')} ${hechos.marca ?? ''}`);
  const referenciaComercial = normalizarTexto(`${hechos.nota} ${hechos.marca ?? ''}`);
  for (const texto of textos) {
    for (const p of preparacionesDe(texto)) {
      if (!referenciaPrep.includes(p)) {
        problemas.push(`«${texto}» nombra «${p}», que no está en la nota del dueño ni en el inventario confirmado.`);
      }
    }
    const normal = normalizarTexto(texto);
    const precio = normal.match(REGEX_PRECIO);
    if (precio) {
      const cifra = precio[1] ?? precio[2] ?? '';
      if (!hechos.nota.includes(cifra)) {
        problemas.push(`«${texto}» lleva un precio (${precio[0]}): las reglas de marca no lo permiten si no consta.`);
      }
    }
    const comercial = normal.match(REGEX_COMERCIAL);
    if (comercial && !referenciaComercial.includes(comercial[0])) {
      problemas.push(`«${texto}» hace una afirmación comercial («${comercial[0]}») que no consta.`);
    }
  }
  return problemas;
}

/** La lista para el revisor, con el inventario confirmado debajo. */
export function listaConInventario(lista: string, elementos: readonly ElementoComparable[]): string {
  return `${lista}\nINVENTARIO CONFIRMADO POR EL DUEÑO (manda sobre la lista de arriba; un elemento que en la foto nueva sea otra preparación va en «cambiados»): ${textoDelInventario(elementos)}.`;
}
