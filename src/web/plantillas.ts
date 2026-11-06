/**
 * «Cargar ejemplo»: da de alta el local y una pieza a partir de plantillas/*.json,
 * con fotos reales guardadas en plantillas/fotos/ (ya no dependen de una carpeta externa).
 */
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { crearLocal } from '../aplicacion/crearLocal.js';
import { crearPieza } from '../aplicacion/crearPieza.js';
import type { Dependencias } from '../aplicacion/dependencias.js';
import { ErrorDeUsuario } from '../dominio/errores.js';
import type { Pieza } from '../dominio/modelos.js';

/** Post: Asador Etxebarri con la gamba. Carrusel: Café Albor con la tostada y el café (dos fotos). */
export const PLANTILLAS_DE_PIEZA = {
  post: { marca: 'marca.ejemplo.json', brief: 'brief.ejemplo.json' },
  carrusel: { marca: 'marca-cafe-albor.ejemplo.json', brief: 'brief-carrusel.ejemplo.json' },
} as const;
export type PlantillaDePieza = keyof typeof PLANTILLAS_DE_PIEZA;

export async function cargarEjemplo(
  deps: Pick<Dependencias, 'locales' | 'piezas' | 'reloj'>,
  carpeta: string,
  plantilla: PlantillaDePieza,
): Promise<Pieza> {
  const archivos = PLANTILLAS_DE_PIEZA[plantilla];
  const marca = (await leerJson(join(carpeta, archivos.marca))) as { slug?: string };
  if (!marca.slug || !(await deps.locales.existe(marca.slug))) await crearLocal(deps, marca);

  const brief = (await leerJson(join(carpeta, archivos.brief))) as {
    fotos?: { ruta?: string }[];
    referenciaEstilo?: { ruta?: string };
  };
  // En las plantillas las rutas son relativas a la carpeta plantillas/.
  const absoluta = (ruta?: string) => (ruta && !isAbsolute(ruta) ? resolve(carpeta, ruta) : ruta);
  return crearPieza(deps, {
    ...brief,
    fotos: brief.fotos?.map((foto) => ({ ...foto, ruta: absoluta(foto.ruta) })),
    referenciaEstilo: brief.referenciaEstilo && { ...brief.referenciaEstilo, ruta: absoluta(brief.referenciaEstilo.ruta) },
  });
}

async function leerJson(ruta: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(ruta, 'utf8'));
  } catch (error) {
    throw new ErrorDeUsuario(`No puedo leer la plantilla ${ruta}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
