import { ErrorDeServicio, ErrorDeUsuario } from '../dominio/errores.js';

/** Formato de error de la API, el mismo que en la app: {error:{code,message,detalles,retryable}}. */
export interface ErrorApi {
  code: string;
  message: string;
  detalles: string[];
  retryable: boolean;
}

/** Errores propios de la web (petición mal formada, conflicto…). */
export class ErrorHttp extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ErrorHttp';
  }
}

/** Traduce cualquier error a un estado HTTP y al cuerpo de error de la API. */
export function describirError(error: unknown): { status: number; error: ErrorApi } {
  if (error instanceof ErrorHttp) {
    return { status: error.status, error: { code: error.code, message: error.message, detalles: [], retryable: false } };
  }
  if (error instanceof ErrorDeUsuario) {
    return { status: 400, error: { code: 'PETICION_NO_VALIDA', message: error.message, detalles: error.detalles, retryable: false } };
  }
  if (error instanceof ErrorDeServicio) {
    const code = error.message.includes('MODERACION') ? 'MODERACION' : 'PROVEEDOR_NO_DISPONIBLE';
    return { status: 502, error: { code, message: error.message, detalles: [], retryable: error.reintentable } };
  }
  const cuerpo = error as { type?: string; status?: number };
  if (cuerpo?.type === 'entity.too.large') {
    return { status: 413, error: { code: 'ARCHIVO_DEMASIADO_GRANDE', message: 'El archivo pesa más de 10 MB.', detalles: [], retryable: false } };
  }
  if (cuerpo?.type === 'entity.parse.failed') {
    return { status: 400, error: { code: 'JSON_NO_VALIDO', message: 'El cuerpo de la petición no es JSON válido.', detalles: [], retryable: false } };
  }
  console.error(error);
  return { status: 500, error: { code: 'ERROR_INTERNO', message: 'Error inesperado. Mira la consola del servidor.', detalles: [], retryable: false } };
}
