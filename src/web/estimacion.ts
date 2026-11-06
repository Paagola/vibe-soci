/**
 * Cuánto falta para que termine un trabajo. Se basa en duraciones reales:
 * - imágenes: creadaEn → terminadaEn de las generaciones completadas (por origen);
 * - director: las últimas llamadas, guardadas en datos/duraciones.json.
 * Si aún no hay datos, se usan valores por defecto razonables.
 */
import { readFile } from 'node:fs/promises';
import { escribirJson } from '../adaptadores/ficheros/json.js';
import type { Concepto, Pieza } from '../dominio/modelos.js';
import type { Progreso } from '../aplicacion/progreso.js';
import type { AlmacenPiezas } from '../puertos/Almacenes.js';
import type { ContextoCreativo, DirectorCreativo, PeticionCorreccion } from '../puertos/DirectorCreativo.js';

export const DURACION_POR_DEFECTO_MS = {
  director: { real: 60_000, simulado: 1_000 },
  imagen: { API: 90_000, SIMULADO: 2_000 },
} as const;

/** Cuántas duraciones recientes se usan para la media. */
const MUESTRAS = 20;

export interface Medias {
  directorMs: number;
  imagenMs: number;
}

type Modo = 'real' | 'simulado';

/** Media de las últimas imágenes terminadas de ese origen, o undefined si no hay ninguna. */
export function mediaDeImagenes(piezas: Pieza[], origen: 'API' | 'SIMULADO'): number | undefined {
  const duraciones = piezas
    .flatMap((pieza) => pieza.generaciones)
    .filter((g) => g.origen === origen && g.estado === 'COMPLETADA' && g.terminadaEn)
    .sort((a, b) => a.creadaEn.localeCompare(b.creadaEn))
    .slice(-MUESTRAS)
    .map((g) => Date.parse(g.terminadaEn!) - Date.parse(g.creadaEn))
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  return media(duraciones);
}

/**
 * Tiempo que queda desde el inicio del paso actual.
 * Las imágenes de una tanda van en paralelo, así que cuenta una tanda como una imagen.
 */
export function restanteMs(pasos: Progreso['pasosRestantes'], medias: Medias): number {
  return pasos.director * medias.directorMs + pasos.tandas * medias.imagenMs;
}

function media(valores: number[]): number | undefined {
  return valores.length === 0 ? undefined : Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

/** Lee y guarda las duraciones del director y calcula las medias de cada modo. */
export class Estimador {
  /** Las duraciones se guardan de una en una: dos llamadas que terminan a la vez no se pisan. */
  private cola: Promise<void> = Promise.resolve();

  /** `piezas`: el almacén de cada modo (las imágenes simuladas viven en su propia carpeta). */
  constructor(
    private readonly piezas: Record<Modo, AlmacenPiezas>,
    private readonly rutaDuraciones: string,
  ) {}

  async medias(simulado: boolean): Promise<Medias> {
    const modo: Modo = simulado ? 'simulado' : 'real';
    const [piezas, duraciones] = await Promise.all([this.piezas[modo].listar(), this.leerDuraciones()]);
    return {
      directorMs: media(duraciones[modo]) ?? DURACION_POR_DEFECTO_MS.director[modo],
      imagenMs: mediaDeImagenes(piezas, simulado ? 'SIMULADO' : 'API') ?? DURACION_POR_DEFECTO_MS.imagen[simulado ? 'SIMULADO' : 'API'],
    };
  }

  registrarDirector(simulado: boolean, ms: number): Promise<void> {
    const modo: Modo = simulado ? 'simulado' : 'real';
    this.cola = this.cola
      .catch(() => {})
      .then(async () => {
        const duraciones = await this.leerDuraciones();
        duraciones[modo] = [...duraciones[modo], Math.round(ms)].slice(-MUESTRAS);
        await escribirJson(this.rutaDuraciones, duraciones);
      });
    return this.cola;
  }

  private async leerDuraciones(): Promise<Record<Modo, number[]>> {
    try {
      const datos = JSON.parse(await readFile(this.rutaDuraciones, 'utf8')) as Partial<Record<Modo, unknown>>;
      const lista = (valor: unknown) => (Array.isArray(valor) ? valor.filter((n): n is number => typeof n === 'number') : []);
      return { real: lista(datos.real), simulado: lista(datos.simulado) };
    } catch {
      return { real: [], simulado: [] };
    }
  }
}

/** Decorador: mide cada llamada al director y la guarda para mejorar la estimación. */
export class DirectorCronometrado implements DirectorCreativo {
  constructor(
    private readonly director: DirectorCreativo,
    private readonly registrar: (ms: number) => Promise<void>,
  ) {}

  proponerConceptos(contexto: ContextoCreativo, descartados: Concepto[]) {
    return this.medir(() => this.director.proponerConceptos(contexto, descartados));
  }

  planificar(contexto: ContextoCreativo, concepto: Concepto, problemasPrevios: string[]) {
    return this.medir(() => this.director.planificar(contexto, concepto, problemasPrevios));
  }

  corregir(contexto: ContextoCreativo, peticion: PeticionCorreccion, problemasPrevios: string[]) {
    return this.medir(() => this.director.corregir(contexto, peticion, problemasPrevios));
  }

  private async medir<T>(llamada: () => Promise<T>): Promise<T> {
    const inicio = Date.now();
    const resultado = await llamada();
    await this.registrar(Date.now() - inicio).catch(() => {});
    return resultado;
  }
}
