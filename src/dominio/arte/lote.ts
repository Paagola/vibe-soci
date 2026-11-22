/**
 * Estudio de arte · el LOTE de contenido de un local: varios posts y carruseles que planifica el director de una vez,
 * para que haya variedad de tipos (no solo carteles: el plato, el ambiente, gente celebrando, el proceso, un dato…) y
 * continuidad de marca entre piezas.
 *
 * Cada visual dice qué foto usa (la real del local o una que se genera) y lleva su RECETA: la maquetación la hace siempre
 * el código (textos con su cita, voces y colores de la marca, tensión garantizada). La foto generada nunca inventa el
 * plato: si sale el plato, va la foto real de referencia y el plato tiene que ser el mismo.
 */
import { z } from 'zod';
import { Receta } from './receta.js';

const Clave = z.string().regex(/^[a-z][a-z0-9-]*$/);

export const TipoDeFoto = z.enum(['plato', 'ambiente', 'evento', 'proceso', 'detalle', 'bodegon', 'equipo']);

export const GeneracionDeFoto = z.object({
  tipo: TipoDeFoto,
  prompt: z
    .string()
    .min(60)
    .max(900)
    .describe('La foto, en inglés, como un fotógrafo de agencia: escena, encuadre, punto de vista, óptica, luz, color, gente (adultos anónimos), dónde queda aire para el texto. Sin texto, letras ni logos en la imagen.'),
  conPlato: z.boolean().describe('true si en la foto sale el plato del local: se adjunta la foto real y el plato tiene que ser el mismo.'),
});
export type GeneracionDeFoto = z.infer<typeof GeneracionDeFoto>;

export const Visual = z.object({
  foto: z.enum(['real', 'generada']).describe('real: la foto del plato del local. generada: una foto nueva (de «generar»).'),
  generar: GeneracionDeFoto.optional(),
  receta: Receta.describe('La maquetación sobre esa foto. Para una foto que se sostiene sola, FOTO_A_SANGRE con un titular corto o solo la firma.'),
});
export type Visual = z.infer<typeof Visual>;

export const TipoDePieza = z.enum(['cartel', 'plato', 'ambiente', 'evento', 'proceso', 'detalle', 'dato']);

export const PostDeLote = z.object({
  id: Clave,
  tipo: TipoDePieza,
  idea: z.string().min(12).max(240),
  visual: Visual,
});
export type PostDeLote = z.infer<typeof PostDeLote>;

export const DiapositivaDeLote = z.object({
  papel: z.enum(['portada', 'detalle', 'ambiente', 'proceso', 'dato', 'cierre']),
  visual: Visual,
});

export const CarruselDeLote = z.object({
  id: Clave,
  tipo: TipoDePieza,
  idea: z.string().min(12).max(240).describe('La historia que cuenta la serie y por qué se desliza.'),
  diapositivas: z.array(DiapositivaDeLote).min(3).max(5),
});
export type CarruselDeLote = z.infer<typeof CarruselDeLote>;

export const PlanDeLote = z.object({
  estrategia: z.string().min(20).max(500).describe('Qué cuenta el lote del local y cómo se reparte entre piezas.'),
  posts: z.array(PostDeLote).min(2).max(4),
  carruseles: z.array(CarruselDeLote).min(1).max(2),
});
export type PlanDeLote = z.infer<typeof PlanDeLote>;

/** Todos los visuales del plan, con su ruta de pieza (post o carrusel y diapositiva). */
export function visualesDe(plan: PlanDeLote): Array<{ id: string; pieza: string; diapositiva?: number; visual: Visual }> {
  return [
    ...plan.posts.map((p) => ({ id: p.id, pieza: p.id, visual: p.visual })),
    ...plan.carruseles.flatMap((c) => c.diapositivas.map((d, i) => ({ id: `${c.id}-${i + 1}`, pieza: c.id, diapositiva: i + 1, visual: d.visual }))),
  ];
}

/** Problemas del plan que el código puede ver antes de generar nada. */
export function problemasDelPlan(plan: PlanDeLote): string[] {
  const problemas: string[] = [];
  for (const v of visualesDe(plan)) {
    if (v.visual.foto === 'generada' && !v.visual.generar) problemas.push(`«${v.id}»: foto «generada» sin «generar» (qué foto hay que hacer).`);
    if (v.visual.foto === 'real' && v.visual.generar) problemas.push(`«${v.id}»: foto «real» con «generar»: o una o la otra.`);
  }
  const tipos = new Set(plan.posts.map((p) => p.tipo));
  if (tipos.size < Math.min(3, plan.posts.length)) problemas.push('Los posts repiten tipo: el lote tiene que mezclar (cartel, plato, ambiente, evento, proceso, detalle, dato).');
  const generadas = visualesDe(plan).filter((v) => v.visual.foto === 'generada').length;
  if (generadas > 5) problemas.push(`Hay ${generadas} fotos generadas: como mucho 5 por lote.`);
  return problemas;
}
