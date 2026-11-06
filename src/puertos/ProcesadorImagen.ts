import type { Formato } from '../dominio/modelos.js';
import type { Proporcion } from '../dominio/reglas.js';

export interface InfoImagen {
  ancho: number;
  alto: number;
}

export interface ProcesadorImagen {
  medir(ruta: string): Promise<InfoImagen>;

  /** JPEG reducido para que el director lo mire sin enviar fotos de 10 MB. */
  reducir(ruta: string, ladoMaximo: number): Promise<Buffer>;

  /** Escala y recorta por el centro al tamaño de esa proporción: 1080 × 1440, 1080 × 1350 o 1080 × 1920. */
  exportar(origen: string, destino: string, proporcion: Proporcion): Promise<void>;

  /** Imagen de marcador para el modo simulado, con la proporción de diseño del formato. */
  crearMarcador(texto: string, formato: Formato): Promise<Buffer>;
}
