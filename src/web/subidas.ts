import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { ErrorDeUsuario } from '../dominio/errores.js';
import { esExtensionDeFoto } from '../dominio/reglas.js';

const ID_VALIDO = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;

/**
 * Fotos subidas desde el navegador, a la espera de entrar en una pieza.
 * Cada subida es un archivo en datos/subidas/<uuid>.<ext>; crearPieza las copia y después se borran.
 */
export class AlmacenSubidas {
  constructor(private readonly carpeta: string) {}

  async guardar(nombre: string, bytes: Buffer): Promise<{ id: string; nombre: string; bytes: number }> {
    if (!esExtensionDeFoto(nombre)) throw new ErrorDeUsuario(`${nombre}: usa JPG, PNG o WEBP (exporta antes las HEIC).`);
    if (bytes.length === 0) throw new ErrorDeUsuario(`${nombre} está vacío.`);
    const id = `${randomUUID()}${extname(nombre).toLowerCase()}`;
    await mkdir(this.carpeta, { recursive: true });
    await writeFile(join(this.carpeta, id), bytes);
    return { id, nombre, bytes: bytes.length };
  }

  /** Ruta absoluta de una subida. El id se valida para no salir de la carpeta. */
  ruta(id: string): string {
    if (!ID_VALIDO.test(id)) throw new ErrorDeUsuario(`La subida «${id}» no es válida. Vuelve a subir la foto.`);
    return join(this.carpeta, id);
  }

  async borrar(ids: string[]): Promise<void> {
    await Promise.all(ids.filter((id) => ID_VALIDO.test(id)).map((id) => rm(join(this.carpeta, id), { force: true })));
  }
}
