import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { nombreDeCapa } from '../../dominio/diseno/resuelto.js';
import type { CapaDeDiseno, GaleriaDeDisenos, HojasDeRevision, ProblemaDeDiseno, VersionDeDiseno } from '../../puertos/GaleriaDeDisenos.js';

type Rect = { x: number; y: number; w: number; h: number };

/** Lo que se lee de resuelto.json. Se lee con manga ancha: una versión antigua puede no traer todos los campos. */
interface ResueltoGuardado {
  lienzo?: { ancho?: number; alto?: number };
  zonaSegura?: Rect;
  capas?: Array<Record<string, unknown> & { id?: string; tipo?: string; z?: number }>;
  medidas?: { contraste?: Record<string, number> };
  problemas?: Array<{ gravedad?: string; tipo?: string; mensaje?: string; capa?: string }>;
}

const esRect = (valor: unknown): valor is Rect =>
  typeof valor === 'object' && valor !== null && ['x', 'y', 'w', 'h'].every((clave) => typeof (valor as Record<string, unknown>)[clave] === 'number');

/**
 * Lee lo que guardan AlmacenDisenosFicheros y ComponedorProyectos:
 *   <base>/<proyecto>/<id>/vNNN/{resuelto.json, diseno.png, diseno.svg, capas/, exportadas/}
 *   <base>/<proyecto>/revision/<etiqueta>/{carrusel.jpg, movil.jpg, capas-<id>.jpg}
 * Solo lee.
 */
export class GaleriaDisenosFicheros implements GaleriaDeDisenos {
  constructor(private readonly base: string) {}

  async versiones(proyecto: string, id: string): Promise<VersionDeDiseno[]> {
    const carpeta = this.rutaArchivo(proyecto, id);
    const entradas = await readdir(carpeta, { withFileTypes: true }).catch(() => []);
    const versiones: VersionDeDiseno[] = [];
    for (const nombre of entradas.filter((e) => e.isDirectory() && /^v\d+$/.test(e.name)).map((e) => e.name).sort()) {
      const version = await this.leerVersion(proyecto, id, nombre);
      if (version) versiones.push(version);
    }
    return versiones.sort((a, b) => a.version - b.version);
  }

  async hojasDeRevision(proyecto: string): Promise<HojasDeRevision[]> {
    const carpeta = this.rutaArchivo(proyecto, 'revision');
    const etiquetas = await readdir(carpeta, { withFileTypes: true }).catch(() => []);
    const hojas: HojasDeRevision[] = [];
    for (const etiqueta of etiquetas.filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      const archivos = (await readdir(join(carpeta, etiqueta)).catch(() => [])).filter((a) => /\.(jpe?g|png)$/i.test(a)).sort();
      if (archivos.length) hojas.push({ etiqueta, archivos: archivos.map((a) => `revision/${etiqueta}/${a}`) });
    }
    return hojas;
  }

  rutaArchivo(proyecto: string, archivo: string): string {
    const raiz = resolve(this.base);
    const base = resolve(raiz, proyecto);
    // El proyecto es una sola carpeta dentro de la base, y el archivo no puede salir de ella.
    if (base === raiz || !base.startsWith(raiz + sep) || base.slice(raiz.length + 1).includes(sep)) throw new ErrorDeUsuario(`Proyecto no válido: ${proyecto}`);
    const ruta = resolve(base, archivo);
    if (ruta !== base && !ruta.startsWith(base + sep)) throw new ErrorDeUsuario(`Ruta fuera de los diseños del proyecto: ${archivo}`);
    return ruta;
  }

  private async leerVersion(proyecto: string, id: string, nombre: string): Promise<VersionDeDiseno | undefined> {
    const relativa = `${id}/${nombre}`;
    const carpeta = this.rutaArchivo(proyecto, relativa);
    const rutaResuelto = join(carpeta, 'resuelto.json');
    const info = await stat(rutaResuelto).catch(() => undefined);
    if (!info) return undefined; // una carpeta a medias no es una versión
    let resuelto: ResueltoGuardado;
    try {
      resuelto = JSON.parse(await readFile(rutaResuelto, 'utf8')) as ResueltoGuardado;
    } catch {
      return undefined;
    }
    const existentes = async (subcarpeta: string) => new Set(await readdir(join(carpeta, subcarpeta)).catch(() => [] as string[]));
    const [pngs, jpgs, raiz] = await Promise.all([existentes('capas'), existentes('exportadas'), existentes('.')]);

    const capas: CapaDeDiseno[] = (resuelto.capas ?? []).map((capa, indice) => {
      const idCapa = String(capa.id ?? `capa-${indice + 1}`);
      const png = nombreDeCapa({ z: typeof capa.z === 'number' ? capa.z : indice, id: idCapa });
      // La caja útil para señalar la capa: el texto ya colocado, el marco de una imagen, el sujeto de un recorte…
      const caja = [capa.caja, capa.marco, capa.sujeto, capa.rect, capa.destino].find(esRect);
      return { id: idCapa, tipo: String(capa.tipo ?? ''), ...(pngs.has(png) ? { archivo: `${relativa}/capas/${png}` } : {}), ...(caja ? { caja } : {}) };
    });
    const problemas: ProblemaDeDiseno[] = (resuelto.problemas ?? []).map((p) => ({
      gravedad: p.gravedad === 'ERROR' ? 'ERROR' : 'AVISO',
      tipo: String(p.tipo ?? ''),
      mensaje: String(p.mensaje ?? ''),
      ...(p.capa ? { capa: p.capa } : {}),
    }));
    return {
      id,
      version: Number(nombre.slice(1)),
      diseno: `${relativa}/diseno.png`,
      ...(raiz.has('diseno.svg') ? { svgEditable: `${relativa}/diseno.svg` } : {}),
      exportadas: [...jpgs]
        .filter((a) => /^\d+x\d+\.jpg$/.test(a))
        .sort()
        .map((a) => ({ proporcion: a.replace('.jpg', '').replace('x', ':'), archivo: `${relativa}/exportadas/${a}` })),
      capas,
      lienzo: { ancho: resuelto.lienzo?.ancho ?? 1080, alto: resuelto.lienzo?.alto ?? 1440 },
      ...(esRect(resuelto.zonaSegura) ? { zonaSegura: resuelto.zonaSegura } : {}),
      problemas,
      contraste: resuelto.medidas?.contraste ?? {},
      compuestaEn: info.mtime.toISOString(),
    };
  }
}
