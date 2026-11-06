import { join } from 'node:path';
import { Activo } from '../../dominio/activos.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import { leerJson } from './json.js';

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
}
