import { readdir, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { ReferenciaLocal } from '../../dominio/referencia.js';
import type { AlmacenReferencias } from '../../puertos/AlmacenReferencias.js';
import { escribirAtomico, escribirJson, leerJson } from './json.js';

/** datos/locales/<slug>/referencias/<id>/referencia.json (+ la imagen). */
export class AlmacenReferenciasFicheros implements AlmacenReferencias {
  constructor(private readonly carpetaLocales: string) {}

  async existe(local: string, id: string): Promise<boolean> {
    return stat(this.rutaArchivo(local, id, 'referencia.json')).then(() => true, () => false);
  }

  async obtener(local: string, id: string): Promise<ReferenciaLocal> {
    if (!(await this.existe(local, id))) throw new ErrorDeUsuario(`El local «${local}» no tiene la referencia «${id}».`);
    return leerJson(this.rutaArchivo(local, id, 'referencia.json'), ReferenciaLocal);
  }

  async guardar(referencia: ReferenciaLocal): Promise<void> {
    await escribirJson(this.rutaArchivo(referencia.local, referencia.id, 'referencia.json'), ReferenciaLocal.parse(referencia));
  }

  async listar(local: string): Promise<ReferenciaLocal[]> {
    const carpeta = join(this.carpetaLocales, local, 'referencias');
    const entradas = await readdir(carpeta, { withFileTypes: true }).catch(() => []);
    const lista: ReferenciaLocal[] = [];
    for (const e of entradas.filter((x) => x.isDirectory()).map((x) => x.name).sort()) {
      if (await this.existe(local, e)) lista.push(await this.obtener(local, e));
    }
    return lista;
  }

  async escribirArchivo(local: string, id: string, archivo: string, contenido: Buffer): Promise<void> {
    await escribirAtomico(this.rutaArchivo(local, id, archivo), contenido);
  }

  rutaArchivo(local: string, id: string, archivo: string): string {
    const base = resolve(this.carpetaLocales, local, 'referencias');
    const ruta = resolve(base, id, archivo);
    if (!ruta.startsWith(base + sep)) throw new ErrorDeUsuario(`Ruta fuera de las referencias del local: ${id}/${archivo}`);
    return ruta;
  }
}
