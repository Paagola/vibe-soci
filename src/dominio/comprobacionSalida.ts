/**
 * Comprobación de SALIDA de una foto nueva (09/11/2026; diseño en diseno/f1_6/ESTADO.md §9).
 *
 * Un revisor visual (puerto RevisorVisual) contesta tres preguntas y este módulo decide con sus respuestas:
 *   A. checklist: elemento a elemento, recuento, anatomía, añadidos y texto nuevo, frente a la lista confirmada;
 *   B. toma: la foto real y la nueva lado a lado: ¿es el mismo punto de vista? (sin estimar grados);
 *   C. anatomía por teselas: cabezas, colas y piezas contadas con recortes a resolución completa (lo que A no ve).
 * Decide el código, no el modelo: así la regla es la misma para cualquier revisor y se puede probar.
 * El veredicto automático solo filtra antes de enseñar la foto: el veredicto humano (Activo.fidelidad) manda.
 */
import { z } from 'zod';

export const ChecklistVisual = z.object({
  elementos: z.array(
    z.object({
      nombre: z.string(),
      /** El número de la lista confirmada, o null si no se cuenta (salsa, brotes). */
      esperado: z.number().int().nullable(),
      /** Lo que cuenta el revisor en la foto nueva, o null. */
      visto: z.number().int().nullable(),
      presente: z.boolean(),
      nota: z.string().default(''),
    }),
  ),
  anatomia: z.array(z.string()).default([]),
  anadidos: z.array(z.string()).default([]),
  textoNuevo: z.array(z.string()).default([]),
  /**
   * F3.3: elementos que en la foto nueva son OTRA preparación que el mismo elemento en la foto real (otro envoltorio, otro
   * corte, otra forma), aunque la lista los describa así: manda la foto real (la toma de Sushita pasó con «rollitos de
   * papel de arroz» porque la lista, equivocada, lo decía).
   */
  cambiados: z.array(z.string()).default([]),
  /** Lo que la foto nueva ha copiado del post de referencia (@image2): textos, logotipos, comida u objetos suyos. */
  copiadoDeReferencia: z.array(z.string()).default([]),
  seguro: z.boolean(),
});
export type ChecklistVisual = z.infer<typeof ChecklistVisual>;

export const ComparacionToma = z.object({
  alturaReal: z.string(),
  alturaNueva: z.string(),
  mismoLado: z.boolean(),
  mismaDistancia: z.boolean(),
  mismoPuntoDeVista: z.boolean(),
  /**
   * Los elementos están colocados igual que en la foto subida (lo que estaba a la izquierda sigue a la izquierda…),
   * aunque cambien la luz o el fondo. Sushita (15/11): las fotos de la prueba A/B copiaban la disposición de la foto
   * mediocre y pasaban, porque «otra toma» solo miraba la cámara declarada en el prompt.
   */
  mismaDistribucion: z.boolean().default(false),
  explicacion: z.string().default(''),
});
export type ComparacionToma = z.infer<typeof ComparacionToma>;

export const ConteoAnatomia = z.object({
  piezas: z.array(
    z.object({
      nombre: z.string(),
      esperado: z.number().int().positive(),
      /** null si esa pieza no tiene cabeza o cola (una taza, un churro). */
      cabezas: z.number().int().nonnegative().nullable(),
      colas: z.number().int().nonnegative().nullable(),
      cuerpos: z.number().int().nonnegative(),
      nota: z.string().default(''),
    }),
  ),
  seguro: z.boolean(),
});
export type ConteoAnatomia = z.infer<typeof ConteoAnatomia>;

export type VeredictoElementos = 'CONSERVA' | 'DESCARTA' | 'REVISAR';
export type VeredictoToma = 'OTRA' | 'MISMA' | 'SIN_COMPROBAR';
export type VeredictoFinal = 'PASA' | 'DESCARTA' | 'REVISAR';

export interface DecisionSalida {
  elementos: VeredictoElementos;
  toma: VeredictoToma;
  final: VeredictoFinal;
  motivos: string[];
}

/** Motivos que descartan por elementos (A y C). Sin motivos: CONSERVA si todo es seguro, REVISAR si no. */
function motivosDeElementos(c: ChecklistVisual, a?: ConteoAnatomia): string[] {
  const motivos = [
    ...c.elementos.filter((e) => !e.presente).map((e) => `falta: ${e.nombre}`),
    ...c.elementos.filter((e) => e.presente && e.esperado !== null && e.visto !== null && e.visto !== e.esperado).map((e) => `recuento de ${e.nombre}: ${e.visto} en vez de ${e.esperado}`),
    ...c.anatomia.map((x) => `anatomía: ${x}`),
    ...c.anadidos.map((x) => `añadido: ${x}`),
    ...c.textoNuevo.map((x) => `texto nuevo: ${x}`),
    ...c.cambiados.map((x) => `cambiado respecto a la foto real: ${x}`),
    ...c.copiadoDeReferencia.map((x) => `copiado de la referencia: ${x}`),
  ];
  for (const p of a?.piezas ?? []) {
    const fuera = [
      p.cuerpos !== p.esperado ? `${p.cuerpos} cuerpos` : '',
      p.cabezas !== null && p.cabezas !== p.esperado ? `${p.cabezas} cabezas` : '',
      p.colas !== null && p.colas !== p.esperado ? `${p.colas} colas` : '',
    ].filter(Boolean);
    if (fuera.length) motivos.push(`anatomía por teselas de ${p.nombre}: ${fuera.join(', ')} (se esperan ${p.esperado})`);
  }
  return motivos;
}

/**
 * La regla de salida:
 * - DESCARTA si falta un elemento, cambia un recuento, hay anatomía rota (A o C), algo añadido o texto nuevo;
 * - si no, REVISAR si el revisor no está seguro (en A o en C), y CONSERVA si lo está;
 * - la toma es MISMA si B dice «mismo punto de vista»: entonces no es otra toma y la foto no pasa.
 * Final: DESCARTA si los elementos descartan o la toma es la misma; REVISAR si los elementos piden revisión; si no, PASA.
 */
/** Fracción de la zona pedida que tiene que quedar libre de plato: por debajo, la foto no deja sitio al texto. */
export const AIRE_MINIMO = 0.6;

/** El aire pedido y el medido con el mapa de la foto (la máscara del plato). */
export const AireMedido = z.object({ lado: z.string(), libre: z.number().min(0).max(1), minimo: z.number().default(AIRE_MINIMO) });
export type AireMedido = z.infer<typeof AireMedido>;

export function decidirSalida(checklist: ChecklistVisual, toma?: ComparacionToma, anatomia?: ConteoAnatomia, aire?: AireMedido): DecisionSalida {
  const motivos = motivosDeElementos(checklist, anatomia);
  // Sin el aire pedido, la foto no sirve para el diseño: se descarta como un elemento añadido (otro intento si quedan).
  if (aire && aire.libre < aire.minimo) motivos.push(`no deja el aire pedido (${aire.lado}): libre el ${Math.round(aire.libre * 100)} % de esa zona, hace falta el ${Math.round(aire.minimo * 100)} %`);
  const dudoso = !checklist.seguro || (anatomia ? !anatomia.seguro : false);
  const elementos: VeredictoElementos = motivos.length ? 'DESCARTA' : dudoso ? 'REVISAR' : 'CONSERVA';
  if (elementos === 'REVISAR') motivos.push('el revisor no está seguro de algún elemento');
  const veredictoToma: VeredictoToma = !toma ? 'SIN_COMPROBAR' : toma.mismoPuntoDeVista || toma.mismaDistribucion ? 'MISMA' : 'OTRA';
  if (veredictoToma === 'MISMA') {
    const que = toma?.mismaDistribucion && !toma.mismoPuntoDeVista ? 'los elementos están colocados igual que en la foto subida' : 'mismo punto de vista que la foto subida';
    motivos.push(`no es otra toma: ${que}${toma?.explicacion ? ` (${toma.explicacion})` : ''}`);
  }
  const final: VeredictoFinal = elementos === 'DESCARTA' || veredictoToma === 'MISMA' ? 'DESCARTA' : elementos === 'REVISAR' ? 'REVISAR' : 'PASA';
  return { elementos, toma: veredictoToma, final, motivos };
}

/** Lo que se guarda en el activo generado (Activo.revisionAutomatica): las respuestas y la decisión. */
export const RevisionAutomatica = z.object({
  fecha: z.string(),
  revisor: z.string(),
  frente: z.string(),
  lista: z.string(),
  elementos: z.enum(['CONSERVA', 'DESCARTA', 'REVISAR']),
  toma: z.enum(['OTRA', 'MISMA', 'SIN_COMPROBAR']),
  final: z.enum(['PASA', 'DESCARTA', 'REVISAR']),
  motivos: z.array(z.string()),
  respuestas: z.object({ checklist: ChecklistVisual, toma: ComparacionToma.optional(), anatomia: ConteoAnatomia.optional(), aire: AireMedido.optional() }),
});
export type RevisionAutomatica = z.infer<typeof RevisionAutomatica>;
