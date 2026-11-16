/**
 * Productor (fase 1): la huella del inventario de un plato y su texto. Dominio puro.
 */
import { createHash } from 'node:crypto';

export interface ElementoComparable { nombre: string; estado: string; recuento: number | null; cortados?: number }

/** Sin tildes (NFD y quita U+0300–U+036F), minúsculas, trim y espacios repetidos a uno. */
export function normalizarTexto(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** sha256 hex de la lista ordenada de [nombre, estado, recuento, cortados] normalizados. */
export function huellaDelInventario(elementos: readonly ElementoComparable[]): string {
  const tuplas = elementos
    .map((e) => [normalizarTexto(e.nombre), normalizarTexto(e.estado), e.recuento, e.cortados ?? 0] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return createHash('sha256').update(JSON.stringify(tuplas)).digest('hex');
}

/** "gunkan de toro (sobre arroz) ×2 (+1 cortado); salsa (por encima)" */
export function textoDelInventario(elementos: readonly ElementoComparable[]): string {
  return elementos
    .map((e) => {
      const recuento = e.recuento === null ? '' : ` ×${e.recuento}`;
      const cortados = (e.cortados ?? 0) > 0 ? ` (+${e.cortados} cortado)` : '';
      return `${e.nombre} (${e.estado})${recuento}${cortados}`;
    })
    .join('; ');
}
