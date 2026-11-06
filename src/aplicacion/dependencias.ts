import type { AlmacenLocales, AlmacenPiezas } from '../puertos/Almacenes.js';
import type { BibliotecaCreativa } from '../puertos/BibliotecaCreativa.js';
import type { DirectorCreativo } from '../puertos/DirectorCreativo.js';
import type { GeneradorImagen } from '../puertos/GeneradorImagen.js';
import type { ProcesadorImagen } from '../puertos/ProcesadorImagen.js';

/**
 * Todo lo que necesitan los casos de uso. Cada caso de uso pide solo lo que usa con Pick<…>.
 * El director y el generador se crean al pedirlos: así los comandos que no los usan funcionan sin claves.
 */
export interface Dependencias {
  piezas: AlmacenPiezas;
  locales: AlmacenLocales;
  biblioteca: BibliotecaCreativa;
  procesador: ProcesadorImagen;
  director: () => DirectorCreativo;
  generador: () => GeneradorImagen;
  limiteImagenesDia: number;
  /** Zona horaria IANA con la que se cuenta el límite diario. */
  zonaHoraria: string;
  reloj: () => Date;
  avisar: (mensaje: string) => void;
}
