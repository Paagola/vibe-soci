import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { Marca } from '../../dominio/modelos.js';
import type { AlmacenLocales } from '../../puertos/Almacenes.js';
import { escribirJson, leerJson } from './json.js';

/** datos/locales/<slug>/marca.json */
export class AlmacenLocalesFicheros implements AlmacenLocales {
  constructor(private readonly carpeta: string) {}

  async existe(slug: string): Promise<boolean> {
    return stat(this.ruta(slug)).then(
      () => true,
      () => false,
    );
  }

  async obtener(slug: string): Promise<Marca> {
    if (!(await this.existe(slug))) throw new ErrorDeUsuario(`No existe el local «${slug}». Créalo con: nuevo-local`);
    return leerJson(this.ruta(slug), Marca);
  }

  async guardar(marca: Marca): Promise<void> {
    await escribirJson(this.ruta(marca.slug), marca);
  }

  async listar(): Promise<Marca[]> {
    const entradas = await readdir(this.carpeta, { withFileTypes: true }).catch(() => []);
    const slugs = entradas.filter((entrada) => entrada.isDirectory()).map((entrada) => entrada.name).sort();
    const marcas: Marca[] = [];
    for (const slug of slugs) if (await this.existe(slug)) marcas.push(await this.obtener(slug));
    return marcas;
  }

  private ruta(slug: string): string {
    return join(this.carpeta, slug, 'marca.json');
  }
}
