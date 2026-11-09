import type { ChecklistVisual, ComparacionToma, ConteoAnatomia } from '../dominio/comprobacionSalida.js';

/** Las rutas de las dos fotos que se comparan: la real que subió el restaurante y la nueva generada. */
export interface ParDeFotos {
  real: string;
  generada: string;
}

/**
 * Un revisor visual (hoy, Gemini con visión). Solo contesta preguntas: la decisión la toma el dominio
 * (decidirSalida), para que la regla no dependa del modelo.
 */
export interface RevisorVisual {
  /** Nombre del revisor y su modelo, para la procedencia. */
  readonly nombre: string;
  /** A. Elemento a elemento frente a la lista confirmada (texto en el idioma en que se pidió al generador). */
  comprobarElementos(fotos: ParDeFotos, lista: string): Promise<ChecklistVisual>;
  /** B. ¿Es el mismo punto de vista? Lado a lado, sin grados. */
  compararToma(fotos: ParDeFotos): Promise<ComparacionToma>;
  /** C. Cabezas, colas y cuerpos de las piezas que se cuentan, con recortes a resolución completa. */
  contarAnatomia(generada: string, piezas: Array<{ nombre: string; esperado: number }>): Promise<ConteoAnatomia>;
}
