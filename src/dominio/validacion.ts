import { z } from 'zod';
import { ErrorDeUsuario } from './errores.js';

z.config(z.locales.es());

/** Valida con zod y, si falla, lanza un error con un detalle legible por campo. */
export function validar<T>(esquema: z.ZodType<T>, datos: unknown, mensaje: string): T {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) return resultado.data;
  throw new ErrorDeUsuario(mensaje, describirProblemas(resultado.error));
}

export function describirProblemas(error: z.ZodError): string[] {
  return error.issues.map((problema) => `${problema.path.join('.') || '(raíz)'}: ${problema.message}`);
}
