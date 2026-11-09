import type { AlmacenLocales, AlmacenPiezas } from '../../puertos/Almacenes.js';
import type { AlmacenReferencias } from '../../puertos/AlmacenReferencias.js';
import type { BibliotecaDeReferencias } from '../../puertos/BibliotecaDeReferencias.js';
import type { ObtenedorEnlaces } from '../../puertos/ObtenedorEnlaces.js';
import type { PiezasHechas } from '../../puertos/PiezasHechas.js';

export interface DepsReferencias {
  /** Piezas del modo real (el simulado tiene su propio almacén y no cuenta). */
  piezas: AlmacenPiezas;
  /** Piezas hechas con las herramientas de línea de comandos: también cuentan para el umbral (09/11/2026). */
  piezasHechas?: PiezasHechas;
  locales: AlmacenLocales;
  referencias: AlmacenReferencias;
  biblioteca: BibliotecaDeReferencias;
  enlaces: ObtenedorEnlaces;
  leerArchivo: (ruta: string) => Promise<Buffer>;
  ahora: () => string;
  /** Por defecto UMBRAL_REFERENCIA_OBLIGATORIA. */
  umbral?: number;
}

export const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export function extensionDeTipo(tipo: string): string {
  if (tipo.includes('png')) return '.png';
  if (tipo.includes('webp')) return '.webp';
  return '.jpg';
}
