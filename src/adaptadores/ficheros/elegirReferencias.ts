import { z } from 'zod';
import { TipoPieza } from '../../dominio/modelos.js';
import type { Afinidad } from '../../puertos/BibliotecaCreativa.js';

export const EntradaReferencia = z.object({
  archivo: z.string().min(1),
  tipos: z.array(TipoPieza).default([]),
  tratamiento: z.string().min(1),
  palabras: z.array(z.string()).default([]),
  descripcion: z.string().min(1),
});
export type EntradaReferencia = z.infer<typeof EntradaReferencia>;

export const IndiceReferencias = z.object({ referencias: z.array(EntradaReferencia) });

/**
 * Elige las referencias más afines a la pieza (producto parecido y mismo tipo),
 * pero con tratamientos distintos entre sí: el director debe ver opciones, no tres copias de lo mismo.
 * Los empates se ordenan con una semilla del propio texto, así piezas distintas ven referencias distintas.
 */
export function elegirReferencias(entradas: EntradaReferencia[], afinidad: Afinidad, maximo: number): EntradaReferencia[] {
  const texto = normalizar(afinidad.texto);
  const puntuadas = entradas
    .map((entrada) => ({
      entrada,
      puntos:
        entrada.palabras.filter((palabra) => texto.includes(normalizar(palabra))).length * 3 +
        (entrada.tipos.includes(afinidad.tipo) ? 2 : 0),
      desempate: hash(`${texto}|${entrada.archivo}`),
    }))
    .sort((a, b) => b.puntos - a.puntos || a.desempate - b.desempate);

  const elegidas: EntradaReferencia[] = [];
  const tratamientos = new Set<string>();
  for (const { entrada } of puntuadas) {
    if (elegidas.length >= maximo) break;
    if (tratamientos.has(entrada.tratamiento)) continue;
    elegidas.push(entrada);
    tratamientos.add(entrada.tratamiento);
  }
  return elegidas;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function hash(texto: string): number {
  let valor = 0;
  for (const caracter of texto) valor = (valor * 31 + caracter.charCodeAt(0)) >>> 0;
  return valor;
}
