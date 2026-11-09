import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Activo } from '../../dominio/activos.js';
import { RevisionAutomatica } from '../../dominio/comprobacionSalida.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import { escribirJson, leerJson } from './json.js';

/** datos/locales/<slug>/activos/<id>/{activo.json, original.*, mascara.png} */
export class AlmacenActivosFicheros implements AlmacenActivos {
  constructor(private readonly carpetaLocales: string) {}

  private carpeta(localSlug: string, id: string): string {
    return join(this.carpetaLocales, localSlug, 'activos', id);
  }

  async obtener(localSlug: string, id: string): Promise<ActivoDisponible> {
    const carpeta = this.carpeta(localSlug, id);
    const activo = await leerJson(join(carpeta, 'activo.json'), Activo);
    return {
      activo,
      ruta: join(carpeta, activo.archivo),
      rutaMascara: activo.mascara ? join(carpeta, activo.mascara.archivo) : undefined,
    };
  }

  async existe(localSlug: string, id: string): Promise<boolean> {
    return stat(join(this.carpeta(localSlug, id), 'activo.json')).then(
      () => true,
      () => false,
    );
  }

  async crear(activo: Activo, archivos: Record<string, Buffer>): Promise<void> {
    const valido = Activo.parse(activo);
    if (await this.existe(valido.localSlug, valido.id)) throw new ErrorDeUsuario(`El activo ${valido.id} ya existe: un activo no se sobrescribe.`);
    const carpeta = this.carpeta(valido.localSlug, valido.id);
    await mkdir(carpeta, { recursive: true });
    for (const [nombre, bytes] of Object.entries(archivos)) await writeFile(join(carpeta, nombre), bytes);
    await escribirJson(join(carpeta, 'activo.json'), valido);
  }

  async actualizar(localSlug: string, id: string, cambios: Partial<Activo>, archivos: Record<string, Buffer> = {}): Promise<void> {
    const carpeta = this.carpeta(localSlug, id);
    const ruta = join(carpeta, 'activo.json');
    await leerJson(ruta, Activo); // que sea un activo válido
    // Se conserva el JSON tal cual (con los campos que el esquema no conoce, p. ej. notaNiveles) y solo cambia lo pedido.
    const crudo = JSON.parse(await readFile(ruta, 'utf8')) as Record<string, unknown>;
    const nuevo = { ...crudo, ...cambios };
    Activo.parse(nuevo);
    for (const [nombre, bytes] of Object.entries(archivos)) await writeFile(join(carpeta, nombre), bytes);
    await escribirJson(ruta, nuevo);
  }

  async anotarRevision(localSlug: string, id: string, revision: RevisionAutomatica): Promise<void> {
    await this.actualizar(localSlug, id, { revisionAutomatica: RevisionAutomatica.parse(revision) });
  }
}
