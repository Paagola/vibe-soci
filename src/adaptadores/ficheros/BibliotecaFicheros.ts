import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { Valoracion } from '../../dominio/modelos.js';
import type { Afinidad, BibliotecaCreativa, GuiaCreativa, ReferenciaVisual } from '../../puertos/BibliotecaCreativa.js';
import { IndiceReferencias, elegirReferencias } from './elegirReferencias.js';

const VALORACIONES_RECIENTES = 20;
/** Pocas y reducidas: cada imagen alarga la petición al director. */
const REFERENCIAS_POR_PIEZA = 3;

/**
 * biblioteca/
 *   principios.md       lo que ha gustado y lo que no (lo edita el equipo)
 *   ejemplos/*.md       prompts que funcionaron, con su porqué
 *   valoraciones.jsonl  un voto por línea (lo escribe el comando valorar)
 *   referencias/        posts de referencia del usuario + indice.json con sus etiquetas
 */
export interface OpcionesBiblioteca {
  /** Dónde se guardan y leen los votos. Por defecto, biblioteca/valoraciones.jsonl. El modo simulado usa otro. */
  rutaValoraciones?: string;
}

export class BibliotecaFicheros implements BibliotecaCreativa {
  constructor(
    private readonly carpeta: string,
    private readonly opciones: OpcionesBiblioteca = {},
  ) {}

  async leerGuia(afinidad?: Afinidad): Promise<GuiaCreativa> {
    const principios = await readFile(join(this.carpeta, 'principios.md'), 'utf8').catch(() => {
      throw new ErrorDeUsuario(`Falta ${join(this.carpeta, 'principios.md')}: es la guía del director creativo.`);
    });
    return {
      principios,
      ejemplos: await this.leerEjemplos(),
      valoraciones: await this.leerValoraciones(),
      referencias: afinidad ? await this.leerReferencias(afinidad) : [],
    };
  }

  async registrarValoracion(valoracion: Valoracion): Promise<void> {
    await mkdir(dirname(this.rutaValoraciones()), { recursive: true });
    await appendFile(this.rutaValoraciones(), `${JSON.stringify(valoracion)}\n`);
  }

  private async leerEjemplos(): Promise<string[]> {
    const carpeta = join(this.carpeta, 'ejemplos');
    const archivos = (await readdir(carpeta).catch(() => [])).filter((nombre) => nombre.endsWith('.md')).sort();
    return Promise.all(archivos.map((nombre) => readFile(join(carpeta, nombre), 'utf8')));
  }

  /** Sin índice no hay referencias: la biblioteca funciona igual, solo que sin ejemplos visuales. */
  private async leerReferencias(afinidad: Afinidad): Promise<ReferenciaVisual[]> {
    const carpeta = join(this.carpeta, 'referencias');
    const contenido = await readFile(join(carpeta, 'indice.json'), 'utf8').catch(() => undefined);
    if (!contenido) return [];

    const indice = IndiceReferencias.safeParse(JSON.parse(contenido));
    if (!indice.success) throw new ErrorDeUsuario(`${join(carpeta, 'indice.json')} no tiene el formato esperado.`);
    return elegirReferencias(indice.data.referencias, afinidad, REFERENCIAS_POR_PIEZA).map((entrada) => ({
      ruta: join(carpeta, entrada.archivo),
      archivo: entrada.archivo,
      descripcion: entrada.descripcion,
    }));
  }

  /** Las líneas que no se entienden se ignoran: un voto roto no debe parar el estudio. */
  private async leerValoraciones(): Promise<Valoracion[]> {
    const contenido = await readFile(this.rutaValoraciones(), 'utf8').catch(() => '');
    return contenido
      .split('\n')
      .filter(Boolean)
      .flatMap((linea) => {
        try {
          const resultado = Valoracion.safeParse(JSON.parse(linea));
          return resultado.success ? [resultado.data] : [];
        } catch {
          return [];
        }
      })
      .reverse()
      .slice(0, VALORACIONES_RECIENTES);
  }

  private rutaValoraciones(): string {
    return this.opciones.rutaValoraciones ?? join(this.carpeta, 'valoraciones.jsonl');
  }
}
