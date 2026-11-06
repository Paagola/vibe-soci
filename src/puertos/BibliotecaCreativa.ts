import type { Formato, TipoPieza, Valoracion } from '../dominio/modelos.js';

/** Un post de referencia que el director puede mirar (nunca se envía al generador). */
export interface ReferenciaVisual {
  /** Ruta absoluta en disco. */
  ruta: string;
  archivo: string;
  descripcion: string;
}

/** Con qué se eligen las referencias visuales más afines a una pieza. */
export interface Afinidad {
  tipo: TipoPieza;
  formato: Formato;
  /** Idea y notas de las fotos: se buscan sus palabras en las etiquetas. */
  texto: string;
}

/** Lo que ha gustado y lo que no: guía para el director, nunca una plantilla. */
export interface GuiaCreativa {
  principios: string;
  ejemplos: string[];
  /** Las más recientes primero. */
  valoraciones: Valoracion[];
  /** Posts de referencia afines a la pieza, con tratamientos distintos. Vacío si no se pidió afinidad. */
  referencias: ReferenciaVisual[];
}

export interface BibliotecaCreativa {
  leerGuia(afinidad?: Afinidad): Promise<GuiaCreativa>;
  registrarValoracion(valoracion: Valoracion): Promise<void>;
}
