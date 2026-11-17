import { z } from 'zod';

export const ReferenciaTextoEditorial = z.discriminatedUnion('fuente', [
  z.strictObject({ fuente: z.enum(['MARCA', 'CIUDAD', 'INSTAGRAM']) }),
  z.strictObject({ fuente: z.literal('ELEMENTO'), indice: z.int().nonnegative() }),
]);
export type ReferenciaTextoEditorial = z.infer<typeof ReferenciaTextoEditorial>;

export const CartelEditorial = z.strictObject({
  n: z.int().positive(), papel: z.literal('portada'), tratamiento: z.literal('CARTEL'),
  estructura: z.enum(['EJE_VERTICAL', 'CABECERA']),
  superficie: z.enum(['PAPEL', 'FOTOGRAFIA']),
  texto: ReferenciaTextoEditorial,
  firma: z.boolean(),
});
export type CartelEditorial = z.infer<typeof CartelEditorial>;

const n = z.int().positive();
const coordenada = z.number().min(0).max(1);
export const DiapositivaEditorial = z.discriminatedUnion('tratamiento', [
  CartelEditorial,
  z.strictObject({
    n,
    papel: z.enum(['portada', 'detalle']),
    tratamiento: z.literal('FOTO_LIMPIA'),
  }),
  z.strictObject({
    n,
    papel: z.enum(['portada', 'detalle']),
    tratamiento: z.literal('FOTO_TEXTO_AL_BORDE'),
    borde: z.enum(['SUPERIOR', 'INFERIOR']),
    gesto: z.enum(['CONTENIDO', 'ANUNCIO']),
    /** Arco medido sobre el encuadre 3:4 de la foto fuente. */
    arco: z.strictObject({
      centro: z.strictObject({ x: coordenada, y: coordenada }),
      radio: z.number().min(0.07).max(0.4),
      grados: z.number().min(30).max(155),
      inicio: z.number().min(-180).max(180),
      tinta: z.enum(['CLARA', 'OSCURA']),
    }).optional(),
    texto: ReferenciaTextoEditorial,
  }),
  z.strictObject({
    n,
    papel: z.literal('detalle'),
    tratamiento: z.literal('RECORTE_DETALLE'),
    enfoque: z.strictObject({ x: coordenada, y: coordenada }),
    zoom: z.number().min(1.2).max(4),
    elemento: z.int().nonnegative(),
  }),
  z.strictObject({
    n,
    papel: z.literal('cierre'),
    tratamiento: z.literal('CIERRE_TEXTO'),
    textos: z.array(ReferenciaTextoEditorial).min(1).max(3),
  }),
]);
export type DiapositivaEditorial = z.infer<typeof DiapositivaEditorial>;

export const PlanEditorial = z.strictObject({
  esquema: z.literal('post/editorial@1'),
  hiloVisual: z.enum(['COLOR', 'LUZ', 'ENCUADRE']),
  diapositivas: z.array(DiapositivaEditorial).min(1).max(5),
});
export type PlanEditorial = z.infer<typeof PlanEditorial>;
