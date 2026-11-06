import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { Pieza } from '../../dominio/modelos.js';
import type { AlmacenPiezas } from '../../puertos/Almacenes.js';
import { escribirAtomico, escribirJson, leerJson } from './json.js';

/** Cada pieza es una carpeta: datos/piezas/<id>/pieza.json + fotos, generadas y exportadas. */
export class AlmacenPiezasFicheros implements AlmacenPiezas {
  /** Una cola por pieza: los cambios de la misma pieza se aplican de uno en uno, en orden de llegada. */
  private readonly colas = new Map<string, Promise<unknown>>();

  constructor(private readonly carpeta: string) {}

  async existe(id: string): Promise<boolean> {
    return stat(this.rutaJson(id)).then(
      () => true,
      () => false,
    );
  }

  async obtener(id: string): Promise<Pieza> {
    if (!(await this.existe(id))) throw new ErrorDeUsuario(`No existe la pieza «${id}». Mira las que hay con: listar`);
    return leerJson(this.rutaJson(id), Pieza);
  }

  async guardar(pieza: Pieza): Promise<void> {
    await escribirJson(this.rutaJson(pieza.id), pieza);
  }

  /**
   * El cerrojo vive en memoria: basta porque el estudio es un solo proceso local.
   * Si un cambio falla, la cola sigue con el siguiente.
   */
  async actualizar(id: string, cambio: (pieza: Pieza) => Pieza | Promise<Pieza>): Promise<Pieza> {
    const anterior = this.colas.get(id) ?? Promise.resolve();
    const turno = anterior
      .catch(() => {})
      .then(async () => {
        const actualizada = await cambio(await this.obtener(id));
        await this.guardar(actualizada);
        return actualizada;
      });
    this.colas.set(id, turno);
    try {
      return await turno;
    } finally {
      if (this.colas.get(id) === turno) this.colas.delete(id);
    }
  }

  async listar(): Promise<Pieza[]> {
    const entradas = await readdir(this.carpeta, { withFileTypes: true }).catch(() => []);
    const ids = entradas.filter((entrada) => entrada.isDirectory()).map((entrada) => entrada.name).sort();
    const piezas: Pieza[] = [];
    for (const id of ids) if (await this.existe(id)) piezas.push(await this.obtener(id));
    return piezas;
  }

  rutaArchivo(id: string, archivo: string): string {
    const base = resolve(this.carpeta, id);
    const ruta = resolve(base, archivo);
    // Evita que una ruta con «..» escriba fuera de la carpeta de la pieza.
    if (!ruta.startsWith(base + sep)) throw new ErrorDeUsuario(`Ruta no válida dentro de la pieza: ${archivo}`);
    return ruta;
  }

  async copiarArchivo(id: string, origenAbsoluto: string, archivo: string): Promise<void> {
    const destino = this.rutaArchivo(id, archivo);
    await mkdir(dirname(destino), { recursive: true });
    await copyFile(origenAbsoluto, destino);
  }

  async escribirArchivo(id: string, archivo: string, contenido: Buffer | string): Promise<void> {
    await escribirAtomico(this.rutaArchivo(id, archivo), contenido);
  }

  private rutaJson(id: string): string {
    return join(this.carpeta, id, 'pieza.json');
  }
}
