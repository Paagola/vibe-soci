import { stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { Intencion } from '../../dominio/diseno/intencion.js';
import { nombreDeCapa, type Resuelto } from '../../dominio/diseno/resuelto.js';
import type { AlmacenDisenos, VersionGuardada } from '../../puertos/AlmacenDisenos.js';
import type { Renderizado } from '../../puertos/Compositor.js';
import { escribirAtomico, escribirJson } from './json.js';

/**
 * <base>/<destino>/v001/
 *   intencion.json · resuelto.json · diseno.png · diseno.svg (editable) · diseno-trazos.svg (exacto)
 *   capas/01-fondo.png …  (cada capa sola, del tamaño del lienzo)
 * Una versión no se sobrescribe nunca: editar es guardar la siguiente.
 */
export class AlmacenDisenosFicheros implements AlmacenDisenos {
  constructor(private readonly base: string) {}

  async guardar(destino: string, intencion: Intencion, resuelto: Resuelto, renderizado: Renderizado): Promise<VersionGuardada> {
    const relativa = join(destino, `v${String(intencion.version).padStart(3, '0')}`);
    const carpeta = this.ruta(relativa, '.');
    const existe = await stat(join(carpeta, 'resuelto.json')).then(() => true, () => false);
    if (existe) throw new ErrorDeUsuario(`La versión ${intencion.version} de «${destino}» ya existe: los diseños no se sobrescriben, se crea la siguiente.`);

    const archivos: string[] = [];
    const escribir = async (archivo: string, contenido: Buffer | string) => {
      await escribirAtomico(join(carpeta, archivo), contenido);
      archivos.push(join(relativa, archivo));
    };
    await escribirJson(join(carpeta, 'intencion.json'), intencion);
    archivos.push(join(relativa, 'intencion.json'));
    await escribirJson(join(carpeta, 'resuelto.json'), resuelto);
    archivos.push(join(relativa, 'resuelto.json'));
    await escribir('diseno.png', renderizado.png);
    await escribir('diseno.svg', renderizado.svgEditable);
    await escribir('diseno-trazos.svg', renderizado.svgExacto);
    for (const capa of renderizado.capas) await escribir(join('capas', nombreDeCapa(capa)), capa.png);
    return { carpeta, archivos };
  }

  ruta(destino: string, archivo: string): string {
    const base = resolve(this.base);
    const ruta = resolve(base, destino, archivo);
    if (ruta !== base && !ruta.startsWith(base + sep)) throw new ErrorDeUsuario(`Ruta fuera de la carpeta de diseños: ${destino}/${archivo}`);
    return ruta;
  }
}
