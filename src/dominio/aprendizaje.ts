/**
 * Aprendizaje (F1.5): de las valoraciones a lo que el director puede tener en cuenta en la siguiente pieza.
 *
 * Adaptado del bucle de design-agent (observaciones con evidencia, votos a favor y en contra, propuestas que solo se
 * mantienen si se repiten) con una regla más estricta para este producto: el gusto del dueño solo lo dice el dueño.
 *
 * Cuatro orígenes de evidencia, que no valen lo mismo:
 * - HUMANA: el dueño (o quien decide por él) valoró una pieza. Es la única que puede volver preferencia una observación.
 * - CRITICO: la revisión visual del estudio (una persona o un modelo que mira la imagen). Sirve como pista, no como gusto.
 * - DETERMINISTA: una comprobación medida (contraste, zona segura, fidelidad). Dice si algo cumple, no si gusta.
 * - AUTOMATICA: un voto escrito por un script. Se guarda por trazabilidad y no cuenta para nada.
 *
 * Estados de una observación (los decide `estadoDe`, nadie los escribe a mano):
 * - HIPOTESIS: hay pistas pero no basta (una sola valoración humana, o solo del crítico).
 * - OBSERVADA: al menos dos valoraciones humanas en piezas distintas, en el mismo sentido y sin ninguna en contra.
 * - CONFIRMADA: el dueño lo ha dicho con palabras («no quiero etiquetas»), o tres valoraciones humanas en tres
 *   piezas distintas sin ninguna en contra.
 * - EN_DUDA: hay valoraciones humanas en los dos sentidos. No se aplica hasta que el dueño lo aclare.
 */
import { z } from 'zod';

export const OrigenEvidencia = z.enum(['HUMANA', 'CRITICO', 'DETERMINISTA', 'AUTOMATICA']);
export type OrigenEvidencia = z.infer<typeof OrigenEvidencia>;

/** De qué trata un motivo. Son los cinco criterios que el dueño quiere separados, más la idea y el texto. */
export const Aspecto = z.enum(['IDEA', 'COMPOSICION', 'TIPOGRAFIA', 'FOTOGRAFIA', 'FIDELIDAD', 'PERSONALIZACION', 'TEXTO']);
export type Aspecto = z.infer<typeof Aspecto>;

/** Un motivo estructurado: qué aspecto, en qué sentido y por qué, con las palabras de quien lo dijo. */
export const Motivo = z.object({
  aspecto: Aspecto,
  juicio: z.enum(['A_FAVOR', 'EN_CONTRA']),
  detalle: z.string().min(3).max(300),
});
export type Motivo = z.infer<typeof Motivo>;

export const Evidencia = z.object({
  origen: OrigenEvidencia,
  fecha: z.string(),
  /** Pieza y diapositiva valoradas (o el diseño del compositor). */
  pieza: z.string(),
  motivo: Motivo,
  /** El dueño lo dijo como regla, no como reacción a una pieza. */
  explicita: z.boolean().default(false),
  /**
   * Quién valoró, si es HUMANA: el dueño del restaurante o la dirección del estudio. Lo que dice el estudio
   * es criterio del estudio (vale para todas las marcas) y no se convierte en gusto de un restaurante.
   */
  autor: z.enum(['PROPIETARIO', 'ESTUDIO']).default('PROPIETARIO'),
});
export type Evidencia = z.infer<typeof Evidencia>;

export const Observacion = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  /** Slug del restaurante, o «estudio» para el criterio del propio estudio. */
  marca: z.string(),
  aspecto: Aspecto,
  /** En positivo o negativo, una línea: «prefiere la fotografía en claroscuro», «rechaza las etiquetas técnicas». */
  enunciado: z.string().min(5).max(300),
  /** A_FAVOR: la observación dice lo que gusta. Las evidencias a favor la apoyan; las en contra la contradicen. */
  evidencias: z.array(Evidencia).default([]),
});
export type Observacion = z.infer<typeof Observacion>;

export type EstadoObservacion = 'HIPOTESIS' | 'OBSERVADA' | 'CONFIRMADA' | 'EN_DUDA';

/** Estado de una observación según sus evidencias. Las automáticas no cuentan nunca. */
export function estadoDe(observacion: Observacion): EstadoObservacion {
  // Solo cuenta quien tiene derecho a decidir: el dueño para su marca, la dirección del estudio para el estudio.
  const quien = observacion.marca === 'estudio' ? 'ESTUDIO' : 'PROPIETARIO';
  const humanas = observacion.evidencias.filter((e) => e.origen === 'HUMANA' && e.autor === quien);
  const aFavor = humanas.filter((e) => e.motivo.juicio === 'A_FAVOR');
  const enContra = humanas.filter((e) => e.motivo.juicio === 'EN_CONTRA');
  if (aFavor.length > 0 && enContra.length > 0) return 'EN_DUDA';
  if (aFavor.some((e) => e.explicita)) return 'CONFIRMADA';
  const piezas = new Set(aFavor.map((e) => e.pieza)).size;
  if (piezas >= 3) return 'CONFIRMADA';
  if (piezas >= 2) return 'OBSERVADA';
  return 'HIPOTESIS';
}

/**
 * Lo que el director puede tratar como preferencia del dueño en la próxima pieza: solo lo OBSERVADO o CONFIRMADO.
 * Las hipótesis se le pasan aparte, marcadas como tales, para que las pruebe sin darlas por buenas.
 */
export function paraElDirector(observaciones: Observacion[]): { preferencias: Observacion[]; hipotesis: Observacion[]; enDuda: Observacion[] } {
  const con = observaciones.map((o) => ({ o, estado: estadoDe(o) }));
  return {
    preferencias: con.filter((x) => x.estado === 'OBSERVADA' || x.estado === 'CONFIRMADA').map((x) => x.o),
    hipotesis: con.filter((x) => x.estado === 'HIPOTESIS').map((x) => x.o),
    enDuda: con.filter((x) => x.estado === 'EN_DUDA').map((x) => x.o),
  };
}
