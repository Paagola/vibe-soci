import type { Aptitud, FichaReferencia } from '../dominio/referencia.js';

/** La ficha que escribe el analista: la de siempre sin lo que pone el código (esquema, quién y cuándo). */
export type FichaAnalizada = Omit<FichaReferencia, 'esquema' | 'analizadaPor' | 'analizadaEn'>;

/** Puntos 3 y 4: analiza la imagen de una referencia (familia, mecanismos, capas, retícula, tipografía, paleta) y dice si es un post de verdad. */
export interface AnalistaDeReferencias {
  readonly nombre: string;
  analizar(rutaImagen: string): Promise<{ aptitud: Aptitud; ficha: FichaAnalizada }>;
}
