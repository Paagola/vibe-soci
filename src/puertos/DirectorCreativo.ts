import type { Concepto, DiapositivaPlan, Marca, Pieza, Plan } from '../dominio/modelos.js';
import type { GuiaCreativa } from './BibliotecaCreativa.js';

/** Una imagen que el director puede mirar. */
export interface ImagenDeContexto {
  /** Ruta absoluta en disco. */
  ruta: string;
  /** Ruta relativa a la pieza, la que se usa en el plan (p. ej. fotos/01-plato.jpg). */
  archivo: string;
  descripcion: string;
}

/** Todo lo que el director necesita para trabajar en una pieza. */
export interface ContextoCreativo {
  marca: Marca;
  pieza: Pieza;
  fotos: ImagenDeContexto[];
  referenciaEstilo?: ImagenDeContexto;
  guia: GuiaCreativa;
}

export interface PeticionCorreccion {
  diapositiva: DiapositivaPlan;
  promptAnterior: string;
  comentario: string;
  /** La versión generada que hay que corregir: será Image 1. */
  imagenAnterior: ImagenDeContexto;
}

/** Lo que propone el director para un cambio. Los textos se comprueban igual que los del plan. */
export interface PropuestaCorreccion {
  prompt: string;
  /** Cada texto literal que saldrá en la imagen después del cambio. */
  textos: string[];
}

export interface DirectorCreativo {
  /** Propone 3 conceptos distintos entre sí y de los ya descartados. */
  proponerConceptos(contexto: ContextoCreativo, descartados: Concepto[]): Promise<Concepto[]>;

  /** Escribe el plan del concepto elegido. Si hay problemas de un intento anterior, los corrige. */
  planificar(contexto: ContextoCreativo, concepto: Concepto, problemasPrevios: string[]): Promise<Plan>;

  /** Reescribe el prompt de una diapositiva a partir del comentario del dueño. Si hay problemas de un intento anterior, los corrige. */
  corregir(contexto: ContextoCreativo, peticion: PeticionCorreccion, problemasPrevios: string[]): Promise<PropuestaCorreccion>;
}
