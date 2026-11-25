/**
 * Tipografía especial · el creador (SISTEMA.md §4, Fase C): un bucle de como mucho 4 rondas.
 *   brief → el diseñador escribe una receta → se valida en código → se pinta la hoja de muestras → OCR y medidas
 *   → la crítica visual la compara con el brief → si no pasa, vuelve al diseñador con las métricas y la crítica.
 * Si pasa, se guarda como PRUEBA en recursos/tratamientos/<id>/ (receta, hoja y métricas). Un estilo creado por el
 * agente nunca se aprueba solo: lo aprueba una persona viendo la hoja.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sellarCandidata, type BriefDeTratamiento, type ContextoDeDiseno, type CriticaDeTratamiento, type InformeParaCorregir } from '../../dominio/tipografia/creacion.js';
import { Receta } from '../../dominio/tipografia/receta.js';
import type { PeticionDeVerificacion, Verificacion } from './verificarTratamiento.js';

export interface DisenadorDeTratamientos {
  /** Escribe (o corrige, con el informe de la ronda anterior) una receta candidata en JSON. */
  escribir(brief: BriefDeTratamiento, contexto: ContextoDeDiseno, informe?: InformeParaCorregir & { anterior?: unknown }): Promise<unknown>;
}

export interface CriticoDeTratamientos {
  criticar(hoja: Buffer, brief: BriefDeTratamiento): Promise<CriticaDeTratamiento>;
}

export interface DepsCrearTratamiento {
  disenador: DisenadorDeTratamientos;
  critico?: CriticoDeTratamientos;
  verificar(candidata: unknown, peticion: PeticionDeVerificacion): Promise<Verificacion>;
  contexto: ContextoDeDiseno;
  /** recursos/tratamientos */
  carpeta: string;
  /** Dónde quedan las rondas y sus hojas (fuera del repositorio). Por defecto, junto a la biblioteca. */
  carpetaTrabajo?: string;
  ahora(): string;
  alProgresar?: (linea: string) => void;
}

export interface Ronda {
  n: number;
  problemas: string[];
  pasa?: boolean;
  resumen?: string;
  critica?: CriticaDeTratamiento;
  hoja?: string;
}

export interface ResultadoCreacion {
  id: string;
  guardado: boolean;
  rondas: Ronda[];
  /** Ruta de la hoja de muestras de la última ronda pintada. */
  hoja?: string;
  receta?: Receta;
}

export const RONDAS_MAXIMAS = 4;

export async function crearTratamiento(deps: DepsCrearTratamiento, brief: BriefDeTratamiento, peticion: PeticionDeVerificacion): Promise<ResultadoCreacion> {
  if (existsSync(join(deps.carpeta, brief.id, 'receta.json'))) throw new Error(`Ya hay un estilo «${brief.id}» en la biblioteca: elige otro nombre.`);
  const trabajo = join(deps.carpetaTrabajo ?? join(deps.carpeta, '..', 'tratamientos-en-prueba'), brief.id);
  await mkdir(trabajo, { recursive: true });
  const rondas: Ronda[] = [];
  let informe: (InformeParaCorregir & { anterior?: unknown }) | undefined;
  let ultimaHoja: string | undefined;
  for (let n = 1; n <= RONDAS_MAXIMAS; n++) {
    deps.alProgresar?.(`Ronda ${n}: el diseñador escribe la receta`);
    // Un fallo de una ronda (el modelo no contesta a tiempo, una respuesta rota) cierra el bucle con lo que haya: no se
    // pierden las hojas ni las medidas de las rondas anteriores.
    let escrita: unknown;
    try {
      escrita = await deps.disenador.escribir(brief, deps.contexto, informe);
    } catch (error) {
      rondas.push({ n, problemas: [`El diseñador no respondió: ${error instanceof Error ? error.message : String(error)}`] });
      break;
    }
    const candidata = sellarCandidata(escrita, { id: brief.id, fecha: deps.ahora(), brief: brief.texto });
    await writeFile(join(trabajo, `ronda-${n}.json`), `${JSON.stringify(candidata, null, 2)}\n`);
    deps.alProgresar?.(`Ronda ${n}: se pinta y se mide la hoja de muestras`);
    const v = await deps.verificar(candidata, peticion);
    const r = v.informe.resumen;
    const ronda: Ronda = { n, problemas: [...v.informe.validez, ...(v.informe.fallos ?? [])], pasa: v.informe.pasa, ...(r ? { resumen: `lecturas ${r.lecturas.marca} / ${r.lecturas.resto} · conservación mínima ${r.conservacion.minima.toFixed(2)} · relleno máximo ${r.relleno.maximo.toFixed(2)} · ${Math.round(r.msMaximo)} ms` } : {}) };
    if (v.hoja) {
      ultimaHoja = join(trabajo, `hoja-${n}.png`);
      await writeFile(ultimaHoja, v.hoja);
      ronda.hoja = ultimaHoja;
    }
    rondas.push(ronda);
    if (!v.receta) {
      informe = { ronda: n, problemasDeValidacion: v.informe.validez, anterior: candidata };
      continue;
    }
    let critica: CriticaDeTratamiento | undefined;
    if (v.informe.pasa && v.hoja && deps.critico) {
      deps.alProgresar?.(`Ronda ${n}: la crítica visual compara la hoja con el brief`);
      try {
        critica = await deps.critico.criticar(v.hoja, brief);
        ronda.critica = critica;
      } catch (error) {
        ronda.problemas.push(`La crítica no respondió: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
    if (v.informe.pasa && (!critica || critica.veredicto === 'PASA')) {
      await mkdir(join(deps.carpeta, brief.id), { recursive: true });
      await writeFile(join(deps.carpeta, brief.id, 'receta.json'), `${JSON.stringify(v.receta, null, 2)}\n`);
      if (v.hoja) await writeFile(join(deps.carpeta, brief.id, 'hoja.png'), v.hoja);
      await writeFile(join(deps.carpeta, brief.id, 'metricas.json'), `${JSON.stringify({ rondas, informe: v.informe }, null, 2)}\n`);
      return { id: brief.id, guardado: true, rondas, ...(ultimaHoja ? { hoja: ultimaHoja } : {}), receta: v.receta };
    }
    informe = { ronda: n, problemasDeValidacion: [], verificacion: { pasa: v.informe.pasa, fallos: v.informe.fallos, resumen: v.informe.resumen }, ...(critica ? { critica } : {}), anterior: candidata };
  }
  return { id: brief.id, guardado: false, rondas, ...(ultimaHoja ? { hoja: ultimaHoja } : {}) };
}

/** Aprueba (o retira) un estilo de la biblioteca: la puerta humana del paso 9. */
export async function cambiarEstadoDeTratamiento(carpeta: string, id: string, estado: 'APROBADO' | 'RETIRADO', por: string, fecha: string): Promise<Receta> {
  const ruta = join(carpeta, id, 'receta.json');
  const receta = Receta.parse(JSON.parse(await readFile(ruta, 'utf8')));
  const nueva = Receta.parse({ ...receta, estado, origen: { ...receta.origen, ...(estado === 'APROBADO' ? { aprobado: { por, fecha } } : {}) } });
  await writeFile(ruta, `${JSON.stringify(nueva, null, 2)}\n`);
  return nueva;
}
