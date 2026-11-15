/**
 * El historial de diseños de un local en <datos>/disenos/<proyecto>/<id>/vNNN/intencion.json (la última versión de cada
 * diapositiva), y su huella tipográfica en <datos>/locales/<local>/huella-tipografica.json.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Intencion } from '../../dominio/diseno/intencion.js';
import type { HuellaTipografica } from '../../dominio/diseno/huella.js';
import type { HistorialDeDisenos } from '../../puertos/HistorialDeDisenos.js';

const carpetas = (ruta: string) => readdir(ruta, { withFileTypes: true }).then((e) => e.filter((x) => x.isDirectory()).map((x) => x.name), () => [] as string[]);

export class HistorialDeDisenosFicheros implements HistorialDeDisenos {
  constructor(private readonly carpetaDatos: string) {}

  async intencionesDelLocal(local: string): Promise<Intencion[]> {
    const raiz = join(this.carpetaDatos, 'disenos');
    const salida: Intencion[] = [];
    for (const proyecto of await carpetas(raiz)) {
      for (const id of await carpetas(join(raiz, proyecto))) {
        const versiones = (await carpetas(join(raiz, proyecto, id))).filter((v) => /^v\d+$/.test(v)).sort();
        const ultima = versiones[versiones.length - 1];
        if (!ultima) continue;
        const leida = Intencion.safeParse(JSON.parse(await readFile(join(raiz, proyecto, id, ultima, 'intencion.json'), 'utf8').catch(() => 'null')));
        if (leida.success && leida.data.marca === local) salida.push(leida.data);
      }
    }
    return salida;
  }

  async guardarHuella(local: string, huella: HuellaTipografica): Promise<void> {
    await mkdir(join(this.carpetaDatos, 'locales', local), { recursive: true });
    await writeFile(join(this.carpetaDatos, 'locales', local, 'huella-tipografica.json'), `${JSON.stringify(huella, null, 2)}\n`);
  }
}
