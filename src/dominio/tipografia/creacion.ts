/**
 * El encargo de un estilo nuevo (Fase C) y lo que circula en el bucle receta → muestras → medir → criticar → corregir.
 * Tipos y funciones puras: el bucle está en aplicacion/tipografia/crearTratamiento.ts.
 */
import { z } from 'zod';
import type { InformeDeVerificacion } from './verificacion.js';

/** Lo que se pide: el material, para qué local y con qué palabra se prueba. */
export interface BriefDeTratamiento {
  /** El brief en palabras: qué material, por qué, para qué local y plato. */
  texto: string;
  /** El id que tendrá el estilo (lo decide el estudio, no el agente). */
  id: string;
  /** La palabra del encargo, la que se pinta en la hoja. */
  palabra: string;
  local?: { slug: string; nombre: string; fuente: string; clasificacion: string[]; colores: { claro: string; oscuro: string; acento: string } };
}

/** El manual y los ejemplos que lee el diseñador. */
export interface ContextoDeDiseno {
  manual: string;
  ejemplos: string;
}

export const CriticaDeTratamiento = z
  .object({
    veredicto: z.enum(['PASA', 'NO_PASA']),
    /** Qué parece de verdad (el material pedido, pintura, plástico, una plantilla…), en una frase. */
    parece: z.string().default(''),
    /** Correcciones concretas para la receta; vacío si pasa. */
    correcciones: z.array(z.string()).default([]),
  })
  .strict();
export type CriticaDeTratamiento = z.infer<typeof CriticaDeTratamiento>;

/** Lo que vuelve al diseñador para corregir: los problemas de validación o las métricas y la crítica de la ronda. */
export interface InformeParaCorregir {
  ronda: number;
  problemasDeValidacion: string[];
  verificacion?: Pick<InformeDeVerificacion, 'pasa' | 'fallos' | 'resumen'>;
  critica?: CriticaDeTratamiento;
}

/**
 * Lo que el estudio pone en toda receta candidata, diga lo que diga el agente: el esquema, el id, la versión, el estado
 * (PRUEBA: un estilo nuevo nunca se aprueba solo) y el origen. Así un agente no puede «aprobarse» ni pisar otro estilo.
 */
export function sellarCandidata(candidata: unknown, sello: { id: string; fecha: string; brief: string }): unknown {
  if (!candidata || typeof candidata !== 'object' || Array.isArray(candidata)) return candidata;
  return {
    ...(candidata as Record<string, unknown>),
    esquema: 'tipografia/receta@1',
    id: sello.id,
    version: 1,
    estado: 'PRUEBA',
    origen: { autor: 'AGENTE', fecha: sello.fecha, brief: sello.brief },
  };
}

/** Un id de estilo a partir del brief: sus primeras palabras con contenido, sin tildes, en minúsculas y con guiones. */
export function idDesdeBrief(brief: string): string {
  const vacias = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'que', 'se', 'sin', 'su', 'un', 'una', 'y', 'o', 'letra', 'letras', 'estilo', 'tipografia']);
  const palabras = brief
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p && !vacias.has(p));
  const id = palabras.slice(0, 3).join('-').slice(0, 40).replace(/-+$/, '');
  return /^[a-z]/.test(id) ? id : `estilo-${id || 'nuevo'}`.slice(0, 40);
}
