/**
 * Plantilla de FOTO NUEVA (07/11/2026). Copia la ESTRUCTURA del prompt de la gamba que gustó, no su contenido:
 *   1. papel de la foto: «solo lista de elementos, no layout»;
 *   2. lista de elementos con su estado, recuento exacto y «nada añadido»;
 *   3. cámara con altura, objetivo y apertura, a más de 30° de la foto subida;
 *   4. idea gráfica con sitio para cada cosa;
 *   5. luz con fuente y dirección, y un color dominante;
 *   6. cierre «Photographic realism, no text.».
 * El director rellena los huecos; el código monta el prompt (la estructura no depende del modelo) y comprueba la regla de ángulo.
 * Macro, 10° o clave baja NO van fijados: dependen del plato y de la referencia.
 */
import { z } from 'zod';

/** La cámara nueva tiene que quedar a más de esto de la original: en el benchmark, un ¾ a 25° frente a uno a 45° volvió a la foto subida. */
export const DIFERENCIA_MINIMA_GRADOS = 30;

/** Por debajo de este lado largo la foto se marca: los detalles finos (texturas, dibujos) no se pueden leer. */
export const LADO_MINIMO_RECOMENDADO_PX = 1000;

const Elemento = z.object({
  nombre: z.string().min(1),
  estado: z.string().min(1),
  /** null si no se puede contar (salsa, brotes). */
  recuento: z.number().int().positive().nullable(),
});

/** Lo que el director ve en la foto subida, antes de proponer nada. */
export const DescripcionFoto = z.object({
  /** Altura de la cámara sobre el plano de la mesa: 0 = a ras de mesa, 90 = cenital. Negativo: contrapicado. */
  anguloGrados: z.number().min(-45).max(90),
  encuadre: z.string().min(1),
  luz: z.string().min(1),
  elementos: z.array(Elemento).min(1),
  defectos: z.array(z.string()),
  utilizable: z.boolean(),
  motivo: z.string().min(1),
});
export type DescripcionFoto = z.infer<typeof DescripcionFoto>;

/** Los huecos de la plantilla, en inglés (van al generador), más las decisiones en español para el dueño. */
export const HuecosFotoNueva = z.object({
  /** «red prawns from Palamós grilled whole», sin artículo inicial. */
  plato: z.string().min(3),
  /** «at a Basque wood-fire grill restaurant». */
  origen: z.string().min(3),
  /** Cada elemento real con su estado, separados por comas. */
  elementos: z.string().min(10),
  /** «Exactly two prawns, correct anatomy.» */
  recuento: z.string().min(5),
  camara: z.object({
    anguloGrados: z.number().min(-45).max(90),
    /** «a near table-level side view at 10 degrees». */
    descripcion: z.string().min(5),
    objetivoMm: z.number().min(14).max(200),
    apertura: z.number().min(1).max(22),
  }),
  /** Dónde va cada cosa en el encuadre (incluido el hueco del titular si hay referencia). */
  ideaGrafica: z.string().min(10),
  /** Fuente, dirección y calidad de la luz. */
  luz: z.string().min(10),
  /** «red the only strong colour». */
  colorDominante: z.string().min(5),
});
export type HuecosFotoNueva = z.infer<typeof HuecosFotoNueva>;

export const PropuestaFotoNueva = z.object({
  descripcion: DescripcionFoto,
  huecos: HuecosFotoNueva,
  decisiones: z.array(z.string()).min(1),
});
export type PropuestaFotoNueva = z.infer<typeof PropuestaFotoNueva>;

const conPunto = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const sinPunto = (s: string) => s.trim().replace(/[.]+$/, '');
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Monta el prompt con la estructura del prompt de la gamba. Determinista: el mismo hueco da el mismo texto. */
export function montarPromptFotoNueva(h: HuecosFotoNueva): string {
  return [
    `@image1 is a real photo of ${sinPunto(h.plato)} ${sinPunto(h.origen)}. Use it only as the list of elements, not as a layout to copy.`,
    `The new photograph must contain the same real elements: ${sinPunto(h.elementos)}.`,
    `${conPunto(h.recuento)} Nothing else added.`,
    `New composition by a professional food photographer: ${sinPunto(h.camara.descripcion)}, ${h.camara.objetivoMm} mm lens at f/${h.camara.apertura}, ${sinPunto(h.ideaGrafica)}.`,
    `${mayuscula(sinPunto(h.luz))}, ${sinPunto(h.colorDominante)}.`,
    'Photographic realism, no text.',
  ].join(' ');
}

/** Problemas que obligan a pedir otra respuesta al director (o a pedir otra foto al dueño). */
export function problemasFotoNueva(p: PropuestaFotoNueva, lado: { ancho: number; alto: number }): string[] {
  const problemas: string[] = [];
  const diferencia = Math.abs(p.huecos.camara.anguloGrados - p.descripcion.anguloGrados);
  if (diferencia <= DIFERENCIA_MINIMA_GRADOS) {
    problemas.push(
      `La cámara nueva (${p.huecos.camara.anguloGrados}°) está a ${diferencia}° de la foto subida (${p.descripcion.anguloGrados}°): tiene que quedar a más de ${DIFERENCIA_MINIMA_GRADOS}° (por ejemplo, rasante o cenital si la original es un ¾ alto).`,
    );
  }
  if (!/\d|exactly|one|two|three|four|single/i.test(p.huecos.recuento)) problemas.push('El recuento no dice cuántas piezas hay («Exactly …»).');
  if (/\btext\b|letters|typography|headline/i.test(p.huecos.ideaGrafica) && !/space|room|empty|clean/i.test(p.huecos.ideaGrafica)) {
    problemas.push('La idea gráfica no puede pedir texto en la foto: solo el hueco donde irá.');
  }
  if (Math.max(lado.ancho, lado.alto) < LADO_MINIMO_RECOMENDADO_PX && !p.descripcion.defectos.some((d) => /resoluci|pequeñ|píxel|pixel/i.test(d))) {
    problemas.push(`La foto mide ${lado.ancho} × ${lado.alto} px: anótalo en "defectos" y di si los detalles finos se pueden leer.`);
  }
  return problemas;
}
