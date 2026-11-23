/**
 * El chat del estudio: una conversación con el director (Hydrogen) en la que se sube la foto, se confirman los hechos
 * del plato y se aprueban y producen posts y carruseles. Lo interactivo va en tarjetas dentro de los mensajes:
 * - HECHOS: lo que el director ve en la foto (local, plato, elementos). Hasta que el usuario no lo confirma, no se
 *   escribe ningún texto ni se genera nada: los textos de las piezas solo pueden decir lo que consta aquí.
 * - PLAN: la pieza planificada (cada diapositiva con su foto nueva y su diseño) y su coste. Nada se gasta en imágenes
 *   hasta que el usuario lo aprueba.
 * - PROGRESO y PIEZA: la producción y el resultado.
 */
import { z } from 'zod';
import { Visual } from './arte/lote.js';

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/);

export const ImagenDelChat = z.object({
  id: Id,
  /** Archivo dentro de la carpeta de la conversación. */
  archivo: z.string(),
  nombre: z.string(),
  ancho: z.number().int().positive(),
  alto: z.number().int().positive(),
});
export type ImagenDelChat = z.infer<typeof ImagenDelChat>;

export const Elemento = z.object({
  nombre: z.string().min(1).max(80),
  estado: z.string().max(160).describe('Cómo está: preparación, punto, salsa… solo lo que se ve o dice el usuario.'),
  recuento: z.number().int().positive().nullable(),
});

export const HechosDelPlato = z.object({
  local: z.string().describe('El slug del local (de la lista).'),
  plato: z.string().min(2).max(160).describe('El nombre del plato, como lo diría el local.'),
  elementos: z.array(Elemento).min(1).max(12),
  mensaje: z.string().min(4).max(240).describe('Lo que el local quiere contar con la pieza.'),
  /** La foto real del plato (id de una imagen de la conversación). */
  foto: Id,
  /** Un post que le gusta al cliente, para tomarlo como listón (id de una imagen de la conversación). */
  referencia: Id.optional(),
});
export type HechosDelPlato = z.infer<typeof HechosDelPlato>;

export const PapelDeDiapositiva = z.enum(['portada', 'detalle', 'ambiente', 'proceso', 'dato', 'cierre', 'post']);

export const DiapositivaDePieza = z.object({
  papel: PapelDeDiapositiva,
  resumen: z.string().min(8).max(200).describe('Qué es esta diapositiva, en una frase para el cliente (castellano).'),
  visual: Visual,
});
export type DiapositivaDePieza = z.infer<typeof DiapositivaDePieza>;

export const PlanDePieza = z.object({
  idea: z.string().min(12).max(320).describe('La idea de la pieza y por qué funciona, para el cliente.'),
  diapositivas: z.array(DiapositivaDePieza).min(1).max(6),
});
export type PlanDePieza = z.infer<typeof PlanDePieza>;

export const Formato = z.enum(['post', 'carrusel']);
export type Formato = z.infer<typeof Formato>;

export const Esfuerzo = z.enum(['rapido', 'normal', 'maximo']);
export type Esfuerzo = z.infer<typeof Esfuerzo>;

/** Lo que el código ve en un plan antes de gastar nada. */
export function problemasDePieza(plan: PlanDePieza, formato: Formato, n: number): string[] {
  const p: string[] = [];
  const d = plan.diapositivas;
  if (d.length !== n) p.push(`Hacen falta ${n} diapositiva(s) y hay ${d.length}.`);
  for (const [i, x] of d.entries()) {
    if (x.visual.foto === 'generada' && !x.visual.generar) p.push(`Diapositiva ${i + 1}: foto «generada» sin «generar».`);
    if (x.visual.foto === 'real' && x.visual.generar) p.push(`Diapositiva ${i + 1}: foto «real» con «generar»: o una o la otra.`);
  }
  if (formato === 'carrusel') {
    // Lo que el cliente pidió: cada diapositiva aporta una foto distinta, no recortes de la misma.
    const reales = d.filter((x) => x.visual.foto === 'real').length;
    if (reales > 1) p.push(`La foto real sale en ${reales} diapositivas: como mucho en una; las demás son tomas nuevas (otro ángulo, otra luz, otra distancia, el ambiente, el proceso).`);
    for (let i = 1; i < d.length; i++) {
      if (d[i]!.visual.receta.esqueleto === d[i - 1]!.visual.receta.esqueleto) p.push(`Las diapositivas ${i} y ${i + 1} repiten el esqueleto ${d[i]!.visual.receta.esqueleto}: cada una con otra maquetación.`);
    }
    if (d.length >= 4 && new Set(d.map((x) => x.visual.receta.esqueleto)).size < 3) p.push('El carrusel usa menos de tres esqueletos distintos: varía la maquetación.');
    const prompts = d.flatMap((x) => (x.visual.generar ? [x.visual.generar.prompt.toLowerCase().slice(0, 120)] : []));
    if (new Set(prompts).size < prompts.length) p.push('Dos tomas nuevas tienen el mismo prompt: cada una con su punto de vista.');
  }
  return p;
}

/** Coste estimado de producir un plan (USD): fotos nuevas + llamadas a Hydrogen (reparaciones). */
export function costeEstimado(plan: PlanDePieza, o: { usdPorFoto: number; esfuerzo: Esfuerzo; soloDiapositivas?: number[] }): number {
  const cuenta = plan.diapositivas.filter((_, i) => !o.soloDiapositivas?.length || o.soloDiapositivas.includes(i + 1));
  const fotos = cuenta.filter((x) => x.visual.foto === 'generada').length;
  const llamadasPorVisual = o.esfuerzo === 'rapido' ? 0 : o.esfuerzo === 'normal' ? 1 : 2.5;
  return Math.round((fotos * o.usdPorFoto + cuenta.length * llamadasPorVisual * 0.05) * 100) / 100;
}

export const EstadoDeTarjeta = z.enum(['PENDIENTE', 'HECHO', 'DESCARTADO']);

/** Una candidata a estética de referencia. `archivo`, relativo a la carpeta de la conversación. */
export const CandidataDeReferencia = z.object({
  id: Id,
  origen: z.enum(['pinterest', 'estudio', 'biblioteca', 'local']),
  archivo: z.string(),
  titulo: z.string().max(200).default(''),
  motivo: z.string().max(400).optional(),
  enlace: z.string().max(500).optional(),
});
export type CandidataDeReferencia = z.infer<typeof CandidataDeReferencia>;

export const Bloque = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('hechos'), id: Id, estado: EstadoDeTarjeta, propuesta: HechosDelPlato }),
  z.object({ tipo: z.literal('plan'), id: Id, estado: EstadoDeTarjeta, pieza: Id }),
  z.object({ tipo: z.literal('progreso'), id: Id, pieza: Id }),
  z.object({ tipo: z.literal('pieza'), id: Id, pieza: Id }),
  z.object({ tipo: z.literal('error'), id: Id, texto: z.string() }),
  /** Una herramienta del catálogo: su formulario, mientras corre y su resultado. */
  z.object({
    tipo: z.literal('herramienta'),
    id: Id,
    herramienta: z.string(),
    estado: z.enum(['FORMULARIO', 'EN_CURSO', 'HECHO', 'ERROR', 'DESCARTADO']),
    valores: z.record(z.string(), z.unknown()).default({}),
    progreso: z.array(z.string()).default([]),
    resultado: z.unknown().optional(),
    error: z.string().optional(),
  }),
  /**
   * La estética de referencia de una pieza, antes de planificarla: candidatas de Pinterest (buscadas y curadas), del
   * estudio (corpus y biblioteca) y del local (sus posts anteriores). El cliente elige una, «decide tú» o ninguna.
   */
  z.object({
    tipo: z.literal('referencias'),
    id: Id,
    estado: z.enum(['BUSCANDO', 'PENDIENTE', 'HECHO', 'DESCARTADO', 'ERROR']),
    pedido: z.object({ formato: Formato, diapositivas: z.number().int().min(1).max(6), indicaciones: z.string(), esfuerzo: Esfuerzo }),
    consultas: z.array(z.string()).default([]),
    candidatas: z.array(CandidataDeReferencia).default([]),
    progreso: z.array(z.string()).default([]),
    elegida: z.string().optional(),
    error: z.string().optional(),
  }),
  /** Un encargo de la orden paso a paso (editorial, cartel integrado, por capas, F3). Sin proyecto, aún por crear. */
  z.object({ tipo: z.literal('encargo'), id: Id, proyecto: z.string().optional(), modo: z.string().optional() }),
]);
export type Bloque = z.infer<typeof Bloque>;

export const Mensaje = z.object({
  id: Id,
  rol: z.enum(['usuario', 'asistente']),
  fecha: z.string(),
  texto: z.string(),
  imagenes: z.array(Id).default([]),
  bloques: z.array(Bloque).default([]),
});
export type Mensaje = z.infer<typeof Mensaje>;

export const PasoDeProgreso = z.object({ texto: z.string(), estado: z.enum(['en-curso', 'hecho', 'error']) });

export const DiapositivaProducida = z.object({
  n: z.number().int().positive(),
  /** Rutas relativas a la carpeta de la conversación. */
  png: z.string().optional(),
  movil: z.string().optional(),
  problemas: z.array(z.string()).default([]),
  foto: z.string().optional(),
});

export const Pieza = z.object({
  id: Id,
  formato: Formato,
  esfuerzo: Esfuerzo,
  indicaciones: z.string().default(''),
  /** Falta mientras se planifica. */
  plan: PlanDePieza.optional(),
  estado: z.enum(['PROPUESTA', 'PRODUCIENDO', 'LISTA', 'ERROR', 'DESCARTADA']),
  costeEstimadoUsd: z.number().nonnegative(),
  costeRealUsd: z.number().nonnegative().optional(),
  /** Una pieza que ajusta otra: las diapositivas que no se rehacen se copian de la base. */
  base: Id.optional(),
  rehacer: z.array(z.number().int().positive()).default([]),
  progreso: z.array(PasoDeProgreso).default([]),
  diapositivas: z.array(DiapositivaProducida).default([]),
  error: z.string().optional(),
});
export type Pieza = z.infer<typeof Pieza>;

export const Conversacion = z.object({
  id: Id,
  titulo: z.string().default('Nueva conversación'),
  creada: z.string(),
  actualizada: z.string(),
  imagenes: z.array(ImagenDelChat).default([]),
  /** Los hechos confirmados por el usuario (con la foto real ya registrada como activo del local). */
  hechos: HechosDelPlato.extend({ activoReal: z.string() }).optional(),
  piezas: z.array(Pieza).default([]),
  /** La referencia de la conversación (id de una imagen): la de la ficha o la que se eligió de la biblioteca. */
  referencia: Id.optional(),
  mensajes: z.array(Mensaje).default([]),
  /** Hay una respuesta del director en marcha. */
  pensando: z.boolean().default(false),
});
export type Conversacion = z.infer<typeof Conversacion>;

/** Lo que el director devuelve en cada turno: un mensaje y, si toca, una acción que el código ejecuta. */
export const AccionDelDirector = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('PROPONER_HECHOS'), hechos: HechosDelPlato }),
  z.object({
    tipo: z.literal('PROPONER_PIEZA'),
    formato: Formato,
    diapositivas: z.number().int().min(1).max(6),
    indicaciones: z.string().max(600).describe('Lo que pidió el usuario y tu dirección, para el planificador.'),
    busqueda: z
      .array(z.string().min(3).max(80))
      .max(3)
      .default([])
      .describe('2 o 3 búsquedas para Pinterest que encuentren posts de Instagram con la estética que buscas (en inglés o castellano: «croquetas instagram post editorial oscuro», «asador carousel design»).'),
  }),
  z.object({
    tipo: z.literal('AJUSTAR_PIEZA'),
    pieza: Id,
    diapositivas: z.array(z.number().int().positive()).describe('Las que se rehacen (1 = la primera); vacío = todas.'),
    indicaciones: z.string().min(4).max(600),
  }),
  z.object({
    tipo: z.literal('ABRIR_HERRAMIENTA'),
    herramienta: z.string().describe('El id de una herramienta del catálogo.'),
    valores: z.record(z.string(), z.unknown()).default({}).describe('Lo que ya sabes de sus campos (el cliente lo revisa).'),
  }),
  z.object({
    tipo: z.literal('ABRIR_ENCARGO'),
    modo: z.enum(['editorial', 'carrusel-editorial', 'integrado', 'capas', 'carrusel-capas', 'f3', 'carrusel-f3']).describe('editorial: toma nueva con otro ángulo y luz; integrado: cartel con referencia; capas: por capas con el productor; f3: director de diseño.'),
  }),
]);
export type AccionDelDirector = z.infer<typeof AccionDelDirector>;

export const TurnoDelDirector = z.object({
  mensaje: z.string().min(1).max(1500).describe('Lo que le dices al usuario (castellano, breve, markdown sencillo).'),
  accion: AccionDelDirector.optional(),
});
export type TurnoDelDirector = z.infer<typeof TurnoDelDirector>;
