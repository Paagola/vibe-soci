import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { Intencion } from '../../dominio/diseno/intencion.js';
import { nombreDeCapa, type Resuelto } from '../../dominio/diseno/resuelto.js';
import type { AlmacenDisenos, VersionGuardada } from '../../puertos/AlmacenDisenos.js';
import type { Renderizado } from '../../puertos/Compositor.js';

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
    const errorExistente = () => new ErrorDeUsuario(`La versión ${intencion.version} de «${destino}» ya existe: los diseños no se sobrescriben, se crea la siguiente.`);
    if (await stat(carpeta).then(() => true, () => false)) throw errorExistente();

    await mkdir(dirname(carpeta), { recursive: true });
    const temporal = await mkdtemp(`${carpeta}.tmp-`);
    const archivos: string[] = [];
    const escribir = async (archivo: string, contenido: Buffer | string) => {
      await writeFile(join(temporal, archivo), contenido);
      archivos.push(join(relativa, archivo));
    };
    try {
      await escribir('intencion.json', JSON.stringify(intencion, null, 2) + '\n');
      await escribir('resuelto.json', JSON.stringify(resuelto, null, 2) + '\n');
      await escribir('diseno.png', renderizado.png);
      await escribir('diseno.svg', renderizado.svgEditable);
      await escribir('diseno-trazos.svg', renderizado.svgExacto);
      if (renderizado.capas.length) await mkdir(join(temporal, 'capas'));
      for (const capa of renderizado.capas) await escribir(join('capas', nombreDeCapa(capa)), capa.png);
      await rename(temporal, carpeta).catch((err: NodeJS.ErrnoException) => {
        if (err.code === 'EEXIST' || err.code === 'ENOTEMPTY') throw errorExistente();
        throw err;
      });
    } finally {
      await rm(temporal, { recursive: true, force: true });
    }
    return { carpeta, archivos };
  }

  ruta(destino: string, archivo: string): string {
    const base = resolve(this.base);
    const ruta = resolve(base, destino, archivo);
    if (ruta !== base && !ruta.startsWith(base + sep)) throw new ErrorDeUsuario(`Ruta fuera de la carpeta de diseños: ${destino}/${archivo}`);
    return ruta;
  }
}
