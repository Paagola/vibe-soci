import { join } from 'node:path';
import { Activo } from '../../dominio/activos.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import { readFile } from 'node:fs/promises';
import { RevisionAutomatica } from '../../dominio/comprobacionSalida.js';
import { escribirJson, leerJson } from './json.js';

/** datos/locales/<slug>/activos/<id>/{activo.json, original.*, mascara.png} */
export class AlmacenActivosFicheros implements AlmacenActivos {
  constructor(private readonly carpetaLocales: string) {}

  async obtener(localSlug: string, id: string): Promise<ActivoDisponible> {
    const carpeta = join(this.carpetaLocales, localSlug, 'activos', id);
    const activo = await leerJson(join(carpeta, 'activo.json'), Activo);
    return {
      activo,
      ruta: join(carpeta, activo.archivo),
      rutaMascara: activo.mascara ? join(carpeta, activo.mascara.archivo) : undefined,
    };
  }

  async anotarRevision(localSlug: string, id: string, revision: RevisionAutomatica): Promise<void> {
    const ruta = join(this.carpetaLocales, localSlug, 'activos', id, 'activo.json');
    await leerJson(ruta, Activo); // que sea un activo válido
    // Se conserva el JSON tal cual (con los campos que el esquema no conoce, p. ej. notaNiveles) y solo se añade la revisión.
    const crudo = JSON.parse(await readFile(ruta, 'utf8')) as Record<string, unknown>;
    await escribirJson(ruta, { ...crudo, revisionAutomatica: RevisionAutomatica.parse(revision) });
  }
}
