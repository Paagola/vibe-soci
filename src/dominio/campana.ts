import { z } from 'zod';

const frase = (max: number) => z.string().trim().min(1).max(max);

export const SolicitudCampana = z.object({
  objetivo: frase(500),
  inicio: z.iso.date(),
  semanas: z.number().int().min(1).max(4),
});
export type SolicitudCampana = z.infer<typeof SolicitudCampana>;

const EncargoPieza = z.object({
  dia: z.number().int().min(0).max(27),
  formato: z.enum(['post', 'carrusel', 'historia']),
  laminas: z.number().int().min(1).max(6),
  proposito: frase(400),
  motivoFormato: frase(400).optional(),
  audiencia: frase(300),
  enfoque: frase(400),
  llamada: frase(240),
  metrica: frase(240),
  fuente: frase(300),
});

export const EstrategiaCampana = z.object({
  nombre: frase(160),
  estrategia: frase(1200),
  fundamento: frase(800).optional(),
  piezas: z.array(EncargoPieza).min(1).max(12),
});
export type EstrategiaCampana = z.infer<typeof EstrategiaCampana>;

export const PlanCampana = EstrategiaCampana.extend({
  piezas: z.array(EncargoPieza.extend({
    texto: frase(2200),
    guion: z.array(frase(400)).min(1).max(6),
  }).superRefine((pieza, ctx) => {
    if (pieza.guion.length !== pieza.laminas) {
      ctx.addIssue({ code: 'custom', path: ['guion'], message: 'Escribe un paso por lámina.' });
    }
    if (new Set(pieza.guion.map((paso) => paso.toLocaleLowerCase('es'))).size !== pieza.guion.length) {
      ctx.addIssue({ code: 'custom', path: ['guion'], message: 'Cada lámina debe avanzar la historia.' });
    }
  })).min(1).max(12),
});
export type PlanCampana = z.infer<typeof PlanCampana>;

export interface ContextoCampana {
  solicitud: SolicitudCampana;
  nombreLocal: string;
  voz: string;
  hechos: Record<string, string>;
  historial: string[];
  referenciaSemanal?: ReferenciaSemanal;
}

export const ReferenciaSemanal = z.object({
  formato: z.enum(['post', 'carrusel', 'historia']), metrica: frase(240), llamada: frase(240),
  muestras: z.number().int().positive(), mediana: z.number().nonnegative(),
});
export type ReferenciaSemanal = z.infer<typeof ReferenciaSemanal>;

/** Se aplica al brief estratégico y al resultado editorial, incluso si proceden de una simulación. */
export function problemasDeCalendario(plan: EstrategiaCampana, contexto: ContextoCampana): string[] {
  const problemas: string[] = [];
  const porSemana = Array<number>(contexto.solicitud.semanas).fill(0);
  for (const [indice, pieza] of plan.piezas.entries()) {
    const prefijo = `Pieza ${indice + 1}`;
    if (!Object.hasOwn(contexto.hechos, pieza.fuente) || !contexto.hechos[pieza.fuente]?.trim()) {
      problemas.push(`${prefijo}: el hecho «${pieza.fuente}» no figura entre las fuentes confirmadas.`);
    }
    const semana = Math.floor(pieza.dia / 7);
    if (semana >= porSemana.length) problemas.push(`${prefijo}: el día cae fuera de la campaña.`);
    else porSemana[semana] = porSemana[semana]! + 1;
    if (indice && pieza.dia <= plan.piezas[indice - 1]!.dia) {
      problemas.push(`${prefijo}: programa cada pieza en un día distinto y en orden cronológico.`);
    }
    if (pieza.formato === 'carrusel' ? pieza.laminas < 3 : pieza.laminas !== 1) {
      problemas.push(`${prefijo}: un post o una historia lleva una lámina y un carrusel lleva de tres a seis.`);
    }
  }
  porSemana.forEach((total, i) => {
    if (total < 1 || total > 3) problemas.push(`Semana ${i + 1}: programa de una a tres piezas.`);
  });
  return problemas;
}
