import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { describirProblemas } from '../../dominio/validacion.js';

/** Lee un JSON y lo valida: si alguien lo editó a mano y lo rompió, el error dice dónde. */
export async function leerJson<T>(ruta: string, esquema: z.ZodType<T>): Promise<T> {
  let datos: unknown;
  try {
    datos = JSON.parse(await readFile(ruta, 'utf8'));
  } catch (error) {
    throw new ErrorDeUsuario(`No puedo leer ${ruta}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) throw new ErrorDeUsuario(`${ruta} no tiene el formato esperado.`, describirProblemas(resultado.error));
  return resultado.data;
}

/**
 * Escribe primero en un temporal y luego renombra: un corte nunca deja el archivo a medias.
 * Cada escritura usa su propio temporal, así dos escrituras a la vez no se pisan el archivo intermedio.
 */
export async function escribirAtomico(ruta: string, contenido: string | Buffer): Promise<void> {
  await mkdir(dirname(ruta), { recursive: true });
  const temporal = `${ruta}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporal, contenido);
  await rename(temporal, ruta);
}

export async function escribirJson(ruta: string, datos: unknown): Promise<void> {
  await escribirAtomico(ruta, `${JSON.stringify(datos, null, 2)}\n`);
}
