import { ErrorDeUsuario } from '../dominio/errores.js';
import { Marca } from '../dominio/modelos.js';
import { validar } from '../dominio/validacion.js';
import type { Dependencias } from './dependencias.js';

export async function crearLocal(
  deps: Pick<Dependencias, 'locales'>,
  datos: unknown,
  opciones: { sobrescribir?: boolean } = {},
): Promise<Marca> {
  const marca = validar(Marca, datos, 'La marca del local no es válida.');

  if (!opciones.sobrescribir && (await deps.locales.existe(marca.slug))) {
    throw new ErrorDeUsuario(`Ya existe el local «${marca.slug}». Usa --sobrescribir para reemplazarlo.`);
  }
  await deps.locales.guardar(marca);
  return marca;
}
