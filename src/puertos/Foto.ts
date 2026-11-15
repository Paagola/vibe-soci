import type { OpcionesDePrompt, PropuestaFotoNueva } from '../dominio/fotoNueva.js';

/** Lo que recibe el director de fotografía para proponer la foto nueva. */
export interface EncargoDeFoto {
  /** Ruta de la foto subida. */
  foto: string;
  /** La nota del dueño. */
  plato: string;
  /** La referencia del post: su ficha en palabras y, si la hay, su imagen (solo para el director). */
  referencia?: { id: string; resumen: string; imagen?: string };
  /** F3.3: un carrusel pide además las tomas de detalle. */
  formato?: 'post' | 'carrusel';
  /** Cómo se montará el prompt: si el generador verá la referencia (@image2) y su familia (F1/F3: fondo para recortar). */
  alGenerador?: OpcionesDePrompt;
}

/** Rellena la plantilla de foto nueva (dominio/fotoNueva.ts). */
export interface DirectorDeFoto {
  readonly nombre: string;
  proponer(encargo: EncargoDeFoto, problemasPrevios: string[]): Promise<PropuestaFotoNueva>;
}

export interface PeticionFoto {
  /** Id del activo que se va a crear (para el registro de gasto). */
  id: string;
  prompt: string;
  /** En el orden de @image1, @image2…: rutas de imagen y su etiqueta. */
  referencias: Array<{ ruta: string; etiqueta: string }>;
  aspectRatio: string;
  tamano: '1K' | '2K' | '4K';
}

export interface FotoGenerada {
  bytes: Buffer;
  /** El modelo que dice la respuesta. */
  modelo: string;
  costeUsd: number;
  tier: 'PAGO' | 'GRATUITO' | 'SIMULADO';
  detalle: string;
}

/** Genera la foto nueva (la vía de producción: Gemini de imagen de pago, decisión del 09/11/2026). */
export interface GeneradorFoto {
  readonly nombre: string;
  /** false si no puede generar ahora (p. ej. sin facturación), con el motivo. */
  disponible(): { ok: true } | { ok: false; motivo: string };
  /** Estimación por arriba del coste de un intento, antes de autorizarlo. */
  estimarUsd(peticion: PeticionFoto): Promise<number>;
  /** Comprueba el tope antes de enviar y apunta el gasto. No reintenta (podría cobrar dos veces). */
  generar(peticion: PeticionFoto): Promise<FotoGenerada>;
}

/** Máscara del sujeto de una foto. */
export interface Segmentador {
  readonly metodo: 'APPLE_VISION' | 'UMBRAL';
  /** PNG en escala de grises del mismo tamaño que la foto: blanco = sujeto. */
  mascara(ruta: string): Promise<Buffer>;
}
