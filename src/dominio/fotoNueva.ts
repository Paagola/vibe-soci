/**
 * Plantilla de FOTO NUEVA (07/11/2026). Copia la ESTRUCTURA del prompt de la gamba que gustó, no su contenido:
 *   1. papel de la foto: «solo lista de elementos, no layout»;
 *   2. lista de elementos con su estado, recuento exacto y «nada añadido»;
 *   3. cámara con altura, objetivo y apertura, que sea OTRA TOMA (ver esOtraToma);
 *   4. idea gráfica con sitio para cada cosa;
 *   5. luz con fuente y dirección, y un color dominante;
 *   6. cierre «Photographic realism, no text.».
 * El director rellena los huecos; el código monta el prompt (la estructura no depende del modelo) y comprueba la regla de ángulo.
 * Macro, 10° o clave baja NO van fijados: dependen del plato y de la referencia.
 */
import { z } from 'zod';
import { frasePrompt, type Estetica } from './diseno/estetica.js';

/** La cámara nueva tiene que quedar a más de esto de la original: en el benchmark, un ¾ a 25° frente a uno a 45° volvió a la foto subida. */
export const DIFERENCIA_MINIMA_GRADOS = 30;
/** Cambio de altura que cuenta como uno de los dos cambios de la regla combinada. */
export const DIFERENCIA_PARCIAL_GRADOS = 15;
/** Giro alrededor del plato que cuenta como «otro lado» (0 = el mismo lado que la foto subida, 90 = de costado, 180 = desde detrás). */
export const GIRO_MINIMO_GRADOS = 45;
/** Por encima de esta altura la toma es cenital o casi: el giro alrededor del plato no cambia lo que se ve. */
const CASI_CENITAL_GRADOS = 80;

/** Distancia o tamaño de plano, de lejos a cerca. Un escalón de diferencia cuenta como cambio. */
export const Distancia = z.enum(['GENERAL', 'MEDIO', 'PRIMER_PLANO', 'MACRO']);
export type Distancia = z.infer<typeof Distancia>;

/** Zonas del encuadre donde puede quedar el aire para el texto. */
export const LadoDeAire = z.enum(['arriba', 'abajo', 'izquierda', 'derecha', 'arriba-izquierda', 'arriba-derecha', 'abajo-izquierda', 'abajo-derecha', 'ninguno']);
export type LadoDeAire = z.infer<typeof LadoDeAire>;

/** Por debajo de este lado largo la foto se marca: los detalles finos (texturas, dibujos) no se pueden leer. */
export const LADO_MINIMO_RECOMENDADO_PX = 1000;

const Elemento = z.object({
  nombre: z.string().min(1),
  estado: z.string().min(1),
  /** null si no se puede contar (salsa, brotes). Solo las piezas que se ven ENTERAS. */
  recuento: z.number().int().positive().nullable(),
  /**
   * Piezas de este elemento que la foto corta por el borde (se ve solo una parte): no cuentan en «recuento» y se dicen
   * aparte (Sushita, 15/11: «×4» cuando se veían 2 enteras y una cortada).
   */
  cortados: z.number().int().nonnegative().optional(),
  /** El director no está seguro del recuento (piezas tapadas, parecidas entre sí, borrosas): lo tiene que mirar una persona. */
  dudoso: z.boolean().optional(),
  /** Por qué es dudoso, o qué se ve cortado. */
  nota: z.string().optional(),
  /** Productor: el elemento en inglés, con su estado y sin número, tal como irá al prompt (el prompt se arma desde aquí). */
  ingles: z.string().min(3).optional(),
  /** Productor: si la toma nueva (cámara e idea gráfica) enseña este elemento. */
  enEncuadre: z.boolean().optional(),
});
export type ElementoFoto = z.infer<typeof Elemento>;

/** Los elementos cuyo recuento hay que mirar en la parada: dudosos o con piezas cortadas por el borde. */
export function recuentosQueMirar(d: DescripcionFoto): string[] {
  return d.elementos
    .filter((e) => e.dudoso || (e.cortados ?? 0) > 0)
    .map((e) => `${e.nombre}: ${e.recuento ?? 'sin contar'} enteros${e.cortados ? ` y ${e.cortados} cortado(s) por el borde` : ''}${e.dudoso ? ' (dudoso)' : ''}${e.nota ? ` · ${e.nota}` : ''}`);
}

/** Lo que el director ve en la foto subida, antes de proponer nada. */
export const DescripcionFoto = z.object({
  /** Altura de la cámara sobre el plano de la mesa: 0 = a ras de mesa, 90 = cenital. Negativo: contrapicado. */
  anguloGrados: z.number().min(-45).max(90),
  /** Tamaño de plano de la foto subida. Opcional: sin él solo se aplica la regla de altura. */
  distancia: Distancia.optional(),
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
    /** Giro alrededor del plato respecto a la foto subida (0–180). Opcional. */
    giroGrados: z.number().min(0).max(180).optional(),
    /** Tamaño de plano de la toma nueva. Opcional. */
    distancia: Distancia.optional(),
  }),
  /** Dónde va cada cosa en el encuadre (incluido el hueco del titular si hay referencia). */
  ideaGrafica: z.string().min(10),
  /**
   * Dónde tiene que quedar el hueco limpio para el texto (lo que dice «ideaGrafica», en un dato que se puede medir).
   * La comprobación de salida mide con el mapa de la foto si de verdad quedó (Sushita, 15/11: pidió aire arriba a la
   * derecha y la tabla llenó el encuadre). «ninguno» si la composición no lo necesita.
   */
  aire: LadoDeAire.optional(),
  /** Fuente, dirección y calidad de la luz. */
  luz: z.string().min(10),
  /** «red the only strong colour». */
  colorDominante: z.string().min(5),
});
export type HuecosFotoNueva = z.infer<typeof HuecosFotoNueva>;

/**
 * F3.3 (punto 11): en un carrusel, además de la portada, una TOMA PROPIA por cada elemento que tendrá su diapositiva de
 * detalle (el nigiri de cerca, el uramaki…), sacada de la misma foto real: solo ese elemento, fiel a él.
 */
export const TomaDeDetalle = z.object({
  /** El nombre EXACTO de un elemento de «descripcion.elementos». */
  elemento: z.string().min(1),
  huecos: HuecosFotoNueva,
});
export type TomaDeDetalle = z.infer<typeof TomaDeDetalle>;

export const PropuestaFotoNueva = z.object({
  descripcion: DescripcionFoto,
  huecos: HuecosFotoNueva,
  decisiones: z.array(z.string()).min(1),
  /** Solo en un carrusel: de una a tres tomas de detalle. */
  tomas: z.array(TomaDeDetalle).max(3).optional(),
});
export type PropuestaFotoNueva = z.infer<typeof PropuestaFotoNueva>;

const conPunto = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const sinPunto = (s: string) => s.trim().replace(/[.]+$/, '');
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Cómo se monta el prompt:
 * - `estiloDeReferencia`: el generador recibe también la imagen del post de referencia como @image2, solo de estilo
 *   (punto 9, 15/11; desactivado por defecto hasta que la prueba A/B lo apruebe);
 * - `familia`: con una referencia F1 o F3 (color plano y producto recortado), la foto pide un fondo limpio y uniforme
 *   que facilite el recorte.
 */
export interface OpcionesDePrompt {
  estiloDeReferencia?: boolean;
  familia?: string;
  /** Punto 10: la estética del encargo; su frase de luz, fondo, atrezo, color y encuadre va en el prompt. */
  estetica?: Estetica;
  /** F3.3: es una toma de detalle del carrusel (la estética sin su encuadre de plato entero). */
  deDetalle?: boolean;
  /** Productor: «elementos» y «recuento» del prompt salen del inventario (descripcion.elementos), no del texto libre de los huecos. */
  desdeElInventario?: boolean;
}

/** El papel de @image2 en el prompt, tal como lo pidió el usuario. */
export const ROL_DE_LA_REFERENCIA =
  '@image2 is a published reference post used ONLY as a style reference: take its lighting, camera angle, background treatment, colour mood and how much clean space it leaves for typography. Never copy its food, props, text, logos or layout of elements; every element in the new photo comes from @image1.';

/** Familias de referencia en las que el plato se recorta sobre color plano. */
export const FAMILIAS_DE_RECORTE = ['F1', 'F3'];

/** Monta el prompt con la estructura del prompt de la gamba. Determinista: el mismo hueco da el mismo texto. */
export function montarPromptFotoNueva(h: HuecosFotoNueva, o: OpcionesDePrompt = {}): string {
  const recorte = o.familia && FAMILIAS_DE_RECORTE.includes(o.familia) ? ', on a clean, plain, uniform background with even light around the whole dish, so it can be cut out cleanly' : '';
  return [
    `@image1 is a real photo of ${sinPunto(h.plato)} ${sinPunto(h.origen)}. Use it only as the list of elements, not as a layout to copy.`,
    ...(o.estiloDeReferencia ? [ROL_DE_LA_REFERENCIA] : []),
    `The new photograph must contain the same real elements: ${sinPunto(h.elementos)}.`,
    `${conPunto(h.recuento)} Nothing else added.`,
    `New composition by a professional food photographer: ${sinPunto(h.camara.descripcion)}, ${h.camara.objetivoMm} mm lens at f/${h.camara.apertura}, ${sinPunto(h.ideaGrafica)}${recorte}.`,
    `${mayuscula(sinPunto(h.luz))}, ${sinPunto(h.colorDominante)}.`,
    ...(o.estetica ? [frasePrompt(o.estetica, o.deDetalle)] : []),
    'Photographic realism, no text.',
  ].join(' ');
}

/**
 * ¿Es OTRA TOMA y no la misma foto mejorada? (09/11/2026, sustituye a «solo más de 30° de altura»).
 * Lo es si la altura cambia más de 30°, o si cambian al menos DOS de: el lado (giro ≥ 45°), la distancia (un escalón)
 * o la altura (≥ 15°). Motivo: una foto subida a ras de tabla (la burger de DAK, unos 5°) ya está en el ángulo clásico
 * de su plato; subir 30° la convierte en otro plato peor, y girar y acercarse da una toma nueva.
 * Es la regla de la PROPUESTA; el resultado se comprueba aparte, preguntando lado a lado si es el mismo punto de vista.
 */
export function esOtraToma(original: Pick<DescripcionFoto, 'anguloGrados' | 'distancia'>, nueva: HuecosFotoNueva['camara']): { otra: boolean; cambios: string[] } {
  const altura = Math.abs(nueva.anguloGrados - original.anguloGrados);
  if (altura > DIFERENCIA_MINIMA_GRADOS) return { otra: true, cambios: [`altura ${altura}°`] };
  const cambios: string[] = [];
  const cenital = Math.max(nueva.anguloGrados, original.anguloGrados) >= CASI_CENITAL_GRADOS;
  if (!cenital && (nueva.giroGrados ?? 0) >= GIRO_MINIMO_GRADOS) cambios.push(`lado (giro de ${nueva.giroGrados}°)`);
  if (nueva.distancia && original.distancia && nueva.distancia !== original.distancia) cambios.push(`distancia (${original.distancia} → ${nueva.distancia})`);
  if (altura >= DIFERENCIA_PARCIAL_GRADOS) cambios.push(`altura ${altura}°`);
  return { otra: cambios.length >= 2, cambios };
}

/** Problemas que obligan a pedir otra respuesta al director (o a pedir otra foto al dueño). */
export function problemasFotoNueva(p: PropuestaFotoNueva, lado: { ancho: number; alto: number }): string[] {
  const problemas: string[] = [];
  const toma = esOtraToma(p.descripcion, p.huecos.camara);
  if (!toma.otra) {
    const diferencia = Math.abs(p.huecos.camara.anguloGrados - p.descripcion.anguloGrados);
    problemas.push(
      `No es otra toma: la cámara nueva (${p.huecos.camara.anguloGrados}°) está a ${diferencia}° de la foto subida (${p.descripcion.anguloGrados}°)` +
        `${toma.cambios.length ? ` y solo cambia ${toma.cambios.join(', ')}` : ''}. Hace falta más de ${DIFERENCIA_MINIMA_GRADOS}° de altura, o dos cambios entre lado (giro ≥ ${GIRO_MINIMO_GRADOS}°), distancia y altura (≥ ${DIFERENCIA_PARCIAL_GRADOS}°).`,
    );
  }
  if (!/\d|exactly|one|two|three|four|single/i.test(p.huecos.recuento)) problemas.push('El recuento no dice cuántas piezas hay («Exactly …»).');
  if (/\btext\b|letters|typography|headline/i.test(p.huecos.ideaGrafica) && !/space|room|empty|clean/i.test(p.huecos.ideaGrafica)) {
    problemas.push('La idea gráfica no puede pedir texto en la foto: solo el hueco donde irá.');
  }
  for (const [i, t] of (p.tomas ?? []).entries()) {
    const donde = `toma de detalle ${i + 1} («${t.elemento}»)`;
    if (!p.descripcion.elementos.some((e) => e.nombre === t.elemento)) problemas.push(`${donde}: «elemento» tiene que ser el nombre exacto de uno de los elementos descritos.`);
    if (!/\d|exactly|one|two|three|four|single/i.test(t.huecos.recuento)) problemas.push(`${donde}: el recuento no dice cuántas piezas hay («Exactly …»).`);
    if (!esOtraToma(p.descripcion, t.huecos.camara).otra) problemas.push(`${donde}: no es otra toma (cambia la distancia y la altura, o la altura más de ${DIFERENCIA_MINIMA_GRADOS}°).`);
  }
  if (Math.max(lado.ancho, lado.alto) < LADO_MINIMO_RECOMENDADO_PX && !p.descripcion.defectos.some((d) => /resoluci|pequeñ|píxel|pixel/i.test(d))) {
    problemas.push(`La foto mide ${lado.ancho} × ${lado.alto} px: anótalo en "defectos" y di si los detalles finos se pueden leer.`);
  }
  return problemas;
}
