/**
 * Modelos del estudio. Cada esquema zod es a la vez la validación y el tipo.
 * Los nombres siguen los de la app SOCIETY (pieza, diapositiva, generación).
 */
import { z } from 'zod';
import { Motivo } from './aprendizaje.js';

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

// ------------------------------------------------------------------ Enumerados

export const Formato = z.enum(['POST', 'CARRUSEL', 'HISTORIA']);
export type Formato = z.infer<typeof Formato>;

export const TipoPieza = z.enum(['PLATO_ESTRELLA', 'NOVEDAD', 'OFERTA', 'EVENTO']);
export type TipoPieza = z.infer<typeof TipoPieza>;

export const PapelFoto = z.enum(['PLATO', 'LOCAL', 'VAJILLA', 'PERSONAS', 'OTRO']);
export type PapelFoto = z.infer<typeof PapelFoto>;

export const OrigenGeneracion = z.enum(['API', 'MANUAL', 'SIMULADO']);
export type OrigenGeneracion = z.infer<typeof OrigenGeneracion>;

export const EstadoGeneracion = z.enum(['PENDIENTE_MANUAL', 'ENVIADA', 'COMPLETADA', 'FALLIDA']);
export type EstadoGeneracion = z.infer<typeof EstadoGeneracion>;

export const Veredicto = z.enum(['GUSTA', 'NO_GUSTA']);
export type Veredicto = z.infer<typeof Veredicto>;

// ------------------------------------------------------------------ Marca del local

export const ColorMarca = z.object({
  nombre: texto(1, 30),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa el formato #RRGGBB'),
});

export const TipografiaMarca = z.object({
  rol: z.enum(['TITULOS', 'TEXTOS', 'ROTULO']),
  descripcion: texto(1, 120),
});

export const Marca = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  nombre: texto(1, 80),
  ciudad: texto(1, 80),
  descripcion: z.string().trim().max(300).default(''),
  tonos: z.array(texto(1, 20)).min(1).max(5),
  colores: z.array(ColorMarca).max(6).default([]),
  tipografias: z.array(TipografiaMarca).max(3).default([]),
  /** Opcionales: si están, el director puede firmar la pieza con ellos (pie de contacto). */
  instagram: z.string().trim().max(60).optional(),
  web: z.string().trim().max(80).optional(),
});
export type Marca = z.infer<typeof Marca>;

// ------------------------------------------------------------------ Brief de la pieza

export const Condiciones = z.object({
  precio: texto(1, 120).optional(),
  fechas: texto(1, 120).optional(),
  limites: texto(1, 120).optional(),
});
export type Condiciones = z.infer<typeof Condiciones>;

export const FotoPieza = z.object({
  /** Ruta relativa a la carpeta de la pieza, p. ej. fotos/01-plato.jpg */
  archivo: z.string().min(1),
  papel: PapelFoto,
  nota: z.string().trim().max(160).optional(),
});
export type FotoPieza = z.infer<typeof FotoPieza>;

export const ReferenciaEstilo = z.object({
  archivo: z.string().min(1),
  nota: z.string().trim().max(160).optional(),
});
export type ReferenciaEstilo = z.infer<typeof ReferenciaEstilo>;

// ------------------------------------------------------------------ Director creativo

export const Concepto = z.object({
  titulo: texto(1, 80),
  /** El recurso creativo: cómo se relacionan el texto y el plato. */
  mecanismo: texto(1, 500),
  /** Composición, cámara y luz de la nueva foto. */
  fotografia: texto(1, 500),
  tipografia: texto(1, 400),
  textos: z.array(texto(1, 160)).min(1).max(6),
  porQue: texto(1, 400),
  /** Familia fotográfica (fondo de color plano, low-key, luz de día, macro a sangre…). */
  tratamiento: texto(1, 200).optional(),
  /** 2–4 colores en HEX: fondo, texto y acento. */
  paleta: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa el formato #RRGGBB')).max(4).optional(),
});
export type Concepto = z.infer<typeof Concepto>;

export const DiapositivaPlan = z.object({
  posicion: z.number().int().min(1),
  funcion: texto(1, 160),
  /** Cada texto literal que sale en la imagen, en español exacto. */
  textos: z.array(texto(1, 160)).max(8),
  /** Fotos de la pieza que usa, en el orden en que el prompt las nombra (Image 1, Image 2…). */
  fotos: z.array(z.string().min(1)).min(1),
  prompt: texto(50, 5000),
  /** El texto más grande de la diapositiva (uno de «textos»). */
  titular: texto(1, 80).optional(),
  /** Qué invita a pasar a la siguiente o qué elemento continúa en ella. */
  transicion: texto(1, 300).optional(),
});
export type DiapositivaPlan = z.infer<typeof DiapositivaPlan>;

export const Plan = z.object({
  diapositivas: z.array(DiapositivaPlan).min(1).max(5),
  pie: texto(1, 2200),
  hashtags: z.array(z.string().regex(/^#\S+$/, 'Cada hashtag empieza por # y no lleva espacios')).max(10),
  textoAlt: texto(1, 1000),
  /** Lo que une todas las diapositivas: color, tipografía y un elemento que continúa. Obligatorio si hay más de una. */
  hiloVisual: texto(1, 500).optional(),
});
export type Plan = z.infer<typeof Plan>;

// ------------------------------------------------------------------ Generaciones y valoraciones

export const ValoracionGeneracion = z.object({
  veredicto: Veredicto,
  motivo: texto(3, 300),
});

export const Generacion = z.object({
  diapositiva: z.number().int().min(1),
  version: z.number().int().min(1),
  origen: OrigenGeneracion,
  modelo: z.string(),
  prompt: z.string(),
  /** Rutas relativas a la pieza, en el orden en que se enviaron (Image 1, Image 2…). */
  referencias: z.array(z.string()),
  comentario: z.string().optional(),
  estado: EstadoGeneracion,
  requestId: z.string().optional(),
  urlEstado: z.string().optional(),
  archivo: z.string().optional(),
  error: z.string().optional(),
  valoracion: ValoracionGeneracion.optional(),
  creadaEn: z.string(),
  /** Cuándo terminó (completada o fallida). Sirve para estimar cuánto tarda cada imagen. */
  terminadaEn: z.string().optional(),
});
export type Generacion = z.infer<typeof Generacion>;

export const Pieza = z.object({
  id: z.string().min(1),
  localSlug: z.string().min(1),
  creadaEn: z.string(),
  formato: Formato,
  numDiapositivas: z.number().int().min(1).max(5),
  idea: texto(10, 300),
  tipo: TipoPieza,
  condiciones: Condiciones.default({}),
  fotos: z.array(FotoPieza).min(1),
  referenciaEstilo: ReferenciaEstilo.optional(),
  conceptos: z.array(Concepto).default([]),
  conceptoElegido: Concepto.optional(),
  plan: Plan.optional(),
  generaciones: z.array(Generacion).default([]),
});
export type Pieza = z.infer<typeof Pieza>;

/**
 * Quién votó. Solo los votos HUMANOS cuentan como gusto del dueño.
 * Los AUTOMATICOS (escritos por un script) se conservan por trazabilidad, pero el director no aprende de ellos.
 * Los votos antiguos sin este campo se hicieron desde la web: cuentan como humanos.
 */
export const OrigenValoracion = z.enum(['HUMANA', 'AUTOMATICA']);

export const Valoracion = z.object({
  fecha: z.string(),
  localSlug: z.string(),
  piezaId: z.string(),
  diapositiva: z.number().int().min(1),
  version: z.number().int().min(1),
  veredicto: Veredicto,
  motivo: texto(3, 300),
  prompt: z.string(),
  archivo: z.string(),
  origen: OrigenValoracion.optional(),
  /** Por qué se marcó así (p. ej. de dónde salió un voto automático). */
  notaOrigen: z.string().max(300).optional(),
  /**
   * Motivos estructurados (F1.5): qué aspecto gustó o no y por qué. Opcionales; los votos antiguos solo tienen
   * el motivo libre. De aquí salen las observaciones del aprendizaje (dominio/aprendizaje.ts).
   */
  motivos: z.array(Motivo).max(7).optional(),
});
export type Valoracion = z.infer<typeof Valoracion>;
