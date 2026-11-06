import type { Formato, OrigenGeneracion } from '../dominio/modelos.js';

export interface PeticionImagen {
  prompt: string;
  /** Rutas absolutas, en el orden en que el prompt las nombra (Image 1, Image 2…). */
  referencias: string[];
  formato: Formato;
  /** Misma clave = mismo trabajo: evita pagar dos veces si se reintenta un envío. */
  claveIdempotencia: string;
}

/** Lo que hay que guardar nada más enviar, para poder retomar la espera. */
export interface TrabajoEnviado {
  requestId: string;
  urlEstado: string;
}

export interface ImagenGenerada {
  bytes: Buffer;
  extension: string;
}

export interface GeneradorImagen {
  readonly modelo: string;
  readonly origen: Extract<OrigenGeneracion, 'API' | 'SIMULADO'>;

  enviar(peticion: PeticionImagen): Promise<TrabajoEnviado>;

  /** Espera a que termine el trabajo y descarga la imagen. */
  esperarResultado(trabajo: TrabajoEnviado): Promise<ImagenGenerada>;
}
