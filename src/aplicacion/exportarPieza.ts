import { ErrorDeUsuario } from '../dominio/errores.js';
import { EXPORTACIONES_POR_FORMATO, versionElegida, type Proporcion } from '../dominio/reglas.js';
import type { Dependencias } from './dependencias.js';
import { comprobarFotoDePieza } from './ejecutarGeneracion.js';
import { exigirPlan } from './trabajoDeDiapositiva.js';

export interface ResultadoExportar {
  archivos: string[];
  /** Diapositivas que se exportan sin un «gusta» (se usa la última versión). */
  sinAprobar: number[];
}

/** Cada proporción va en su carpeta: así no se pisan entre sí ni con las exportaciones anteriores (exportadas/NN.jpg). */
export const CARPETA_EXPORTACION: Record<Proporcion, string> = { '3:4': 'exportadas/3x4', '4:5': 'exportadas/4x5', '9:16': 'exportadas/9x16' };

/**
 * Deja la pieza lista para publicar, con pie.txt:
 * - post y carrusel: 1080 × 1440 (3:4, la de diseño) y 1080 × 1350 (4:5, recortando el centro);
 * - historia: 1080 × 1920.
 */
export async function exportarPieza(deps: Pick<Dependencias, 'piezas' | 'procesador'>, piezaId: string): Promise<ResultadoExportar> {
  const pieza = await deps.piezas.obtener(piezaId);
  const plan = exigirPlan(pieza);
  const elegidas = plan.diapositivas.map((d) => {
    const generacion = versionElegida(pieza, d.posicion);
    return { posicion: d.posicion, archivo: generacion?.archivo, gusta: generacion?.valoracion?.veredicto === 'GUSTA' };
  });

  const sinImagen = elegidas.filter((e) => !e.archivo).map((e) => e.posicion);
  if (sinImagen.length > 0) throw new ErrorDeUsuario(`Faltan imágenes de las diapositivas: ${sinImagen.join(', ')}.`);

  for (const e of elegidas) await comprobarFotoDePieza(deps, pieza, deps.piezas.rutaArchivo(pieza.id, e.archivo!));

  const archivos: string[] = [];
  for (const proporcion of EXPORTACIONES_POR_FORMATO[pieza.formato]) {
    for (const { posicion, archivo } of elegidas) {
      const destino = `${CARPETA_EXPORTACION[proporcion]}/${String(posicion).padStart(2, '0')}.jpg`;
      await deps.procesador.exportar(deps.piezas.rutaArchivo(pieza.id, archivo as string), deps.piezas.rutaArchivo(pieza.id, destino), proporcion);
      archivos.push(destino);
    }
  }

  const pie = `${plan.pie}\n\n${plan.hashtags.join(' ')}\n\nTexto alternativo:\n${plan.textoAlt}\n`;
  await deps.piezas.escribirArchivo(pieza.id, 'exportadas/pie.txt', pie);
  archivos.push('exportadas/pie.txt');

  return {
    archivos,
    sinAprobar: elegidas.filter((e) => !e.gusta).map((e) => e.posicion),
  };
}
