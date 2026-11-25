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
import { Visual, VisualNuevo } from './arte/lote.js';
import { explicacion } from './arte/receta.js';

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
  fotosPorLamina: z.array(z.object({ lamina: z.number().int().min(1).max(6), foto: Id })).max(6).optional(),
  /** Un post que le gusta al cliente, para tomarlo como listón (id de una imagen de la conversación). */
  referencia: Id.optional(),
});
export type HechosDelPlato = z.infer<typeof HechosDelPlato>;

export const PapelDeDiapositiva = z.enum(['portada', 'detalle', 'ambiente', 'proceso', 'dato', 'cierre', 'post']);

export const DiapositivaDePieza = z.object({
  papel: PapelDeDiapositiva,
  resumen: explicacion(8, 200).describe('Qué es esta diapositiva, en una frase para el cliente (castellano).'),
  visual: Visual,
  soloFoto: z
    .boolean()
    .default(false)
    .describe('true: la lámina es la foto sola, sin texto (la receta no se pinta). Para tomas que se sostienen solas en un carrusel editorial; nunca la portada de un carrusel, y en un post solo si el cliente lo pide.'),
});
export type DiapositivaDePieza = z.infer<typeof DiapositivaDePieza>;

/**
 * Un concepto de serie: la idea de la pieza ANTES del plan, con su historia lámina a lámina y su manera de fotografiar.
 * El director propone tres que se distinguen de verdad (no tres titulares para la misma serie) y el cliente elige.
 * Torre de Vega, 23/11: sin este paso, Hydrogen y Argon planificaban el mismo carrusel (mismas cinco tomas, mismo cierre).
 */
export const ConceptoDeSerie = z.object({
  nombre: explicacion(3, 60).describe('El nombre del concepto, corto («El ritual del corte»).'),
  idea: explicacion(20, 320).describe('La idea en dos frases, para el cliente: qué cuenta la serie y por qué engancha.'),
  titular: z.string().min(2).max(40).describe('El titular de la portada: creativo, con idea (un juego, una tensión, una frase con intención), hasta 4 palabras, sin cifras ni reclamos («casero», «el mejor», «brasa»…). Nada de describir el ingrediente.'),
  fotografia: explicacion(20, 320).describe('Cómo se fotografía la serie: escenas, gestos, objetos, luz y lo que NO sale. Puede incluir tomas sin el plato (el fuego, el cuchillo, las manos, el local).'),
  laminas: z.array(explicacion(8, 200)).min(1).max(6).describe('Una línea por lámina: qué muestra y qué aporta a la historia.'),
});
export type ConceptoDeSerie = z.infer<typeof ConceptoDeSerie>;

/** La tarjeta de elección debe ofrecer exactamente las láminas que luego se planifican. */
export function propuestaDeConceptos(diapositivas: number) {
  const concepto = ConceptoDeSerie.extend({ laminas: ConceptoDeSerie.shape.laminas.length(diapositivas) });
  return z.object({ conceptos: z.array(concepto).length(3) });
}

export const PlanDePieza = z.object({
  idea: explicacion(12, 320).describe('La idea de la pieza y por qué funciona, para el cliente.'),
  diapositivas: z.array(DiapositivaDePieza).min(1).max(6),
});
export type PlanDePieza = z.infer<typeof PlanDePieza>;
export const PlanConFotosNuevas = PlanDePieza.extend({
  diapositivas: z.array(DiapositivaDePieza.extend({ visual: VisualNuevo })).min(1).max(6),
});

export const Formato = z.enum(['post', 'carrusel']);
export type Formato = z.infer<typeof Formato>;

export const Esfuerzo = z.enum(['rapido', 'normal', 'maximo']);
export type Esfuerzo = z.infer<typeof Esfuerzo>;

/** Lo que el código ve en un plan antes de gastar nada. */
export function problemasDePieza(plan: PlanDePieza, formato: Formato, n: number): string[] {
  const p: string[] = [];
  const d = plan.diapositivas;
  if (d.length !== n) p.push(`Hacen falta ${n} diapositiva(s) y hay ${d.length}.`);
  // La portada lleva un titular CREATIVO, con idea: describir el ingrediente («Rojo jugoso», «Tiras doradas») no
  // detiene el dedo (Torre de Vega, 23/11).
  const portada = d[0];
  if (portada && !portada.soloFoto) {
    const r = portada.visual.receta;
    const t = r.textos.find((x) => x.clave === r.titular.texto);
    if (t && t.fuente !== 'CREATIVO') p.push(`La portada lleva un titular CREATIVO (fuente «CREATIVO», hasta 4 palabras, con idea y sin reclamos): «${t.texto.replace(/\n/g, ' ')}» es ${t.fuente}.`);
  }
  for (const [i, x] of d.entries()) {
    if (x.visual.foto === 'generada' && !x.visual.generar) p.push(`Diapositiva ${i + 1}: foto «generada» sin «generar».`);
    if (x.visual.foto === 'real') p.push(`Diapositiva ${i + 1}: la foto subida solo sirve de referencia. Planifica una toma nueva con «foto: generada» y «generar».`);
  }
  if (formato === 'carrusel') {
    // Lo que el cliente pidió: cada diapositiva aporta una foto distinta, no recortes de la misma.
    for (let i = 1; i < d.length; i++) {
      if (d[i]!.visual.receta.esqueleto === d[i - 1]!.visual.receta.esqueleto) p.push(`Las diapositivas ${i} y ${i + 1} repiten el esqueleto ${d[i]!.visual.receta.esqueleto}: cada una con otra maquetación.`);
    }
    if (d.length >= 4 && new Set(d.map((x) => x.visual.receta.esqueleto)).size < 3) p.push('El carrusel usa menos de tres esqueletos distintos: varía la maquetación.');
    // La serie se cierra: portada y cierre con texto (al menos la firma) y como mucho N−2 láminas solo foto
    // (Torre de Vega, 23/11: tres de cinco sin texto y un cierre sin firma).
    if (d[0]?.soloFoto) p.push('La portada de un carrusel lleva texto: no puede ser «soloFoto».');
    if (d.length > 1 && d[d.length - 1]?.soloFoto) p.push('El cierre de un carrusel lleva al menos la firma: no puede ser «soloFoto».');
    const solas = d.filter((x) => x.soloFoto).length;
    if (d.length > 2 && solas > d.length - 2) p.push(`Hay ${solas} láminas «soloFoto» en un carrusel de ${d.length}: como mucho ${d.length - 2}.`);
    const prompts = d.flatMap((x) => (x.visual.generar ? [x.visual.generar.prompt.toLowerCase().slice(0, 120)] : []));
    if (new Set(prompts).size < prompts.length) p.push('Dos tomas nuevas tienen el mismo prompt: cada una con su punto de vista.');
  }
  return p;
}

/** Qué láminas llevan acabado de Nano Banana 2: en «normal», la portada (la primera); en «máximo», todas; en «rápido», ninguna. */
export function llevaAcabado(n: number, esfuerzo: Esfuerzo): boolean {
  return esfuerzo === 'maximo' || (esfuerzo === 'normal' && n === 1);
}

/** Lo que cuesta, de media, el acabado de una lámina: la propuesta de Hydrogen, la imagen de Nano Banana 2, su crítica y la comparación a ciegas. */
export const USD_ACABADO = 0.2;

/**
 * Coste estimado de producir un plan (USD): fotos nuevas, la revisión de cada foto, la crítica (y su parche) de cada
 * lámina con texto y el acabado de Nano Banana 2 donde toque. Es una estimación: el tope mensual mide el gasto real.
 */
export function costeEstimado(plan: PlanDePieza, o: { usdPorFoto: number; esfuerzo: Esfuerzo; soloDiapositivas?: number[] }): number {
  const cuenta = plan.diapositivas.map((d, i) => ({ d, n: i + 1 })).filter(({ n }) => !o.soloDiapositivas?.length || o.soloDiapositivas.includes(n));
  const fotos = cuenta.filter(({ d }) => d.visual.foto === 'generada').length;
  const conTexto = cuenta.filter(({ d }) => !d.soloFoto);
  const llamadasPorVisual = o.esfuerzo === 'rapido' ? 0 : o.esfuerzo === 'normal' ? 2 : 4;
  const revisiones = o.esfuerzo === 'rapido' ? 0 : fotos;
  const acabados = conTexto.filter(({ n }) => llevaAcabado(n, o.esfuerzo)).length;
  return Math.round((fotos * o.usdPorFoto + conTexto.length * llamadasPorVisual * 0.05 + revisiones * 0.02 + acabados * USD_ACABADO) * 100) / 100;
}

/** El veredicto del director sobre una foto generada, antes de maquetarla. */
export const RevisionDeFoto = z.object({
  veredicto: z.enum(['USAR', 'REPETIR']).describe('REPETIR si el plato no es el mismo, hay algo raro (manos, cubiertos, texto, objetos que no se pidieron) o no hay el aire que pide la toma.'),
  motivo: z.string().min(3).max(300).describe('En castellano y en una frase: qué ves y por qué decides así.'),
  corregir: z.string().max(400).optional().describe('Si REPETIR: lo que hay que cambiar, en inglés, como una instrucción para el fotógrafo.'),
  sinTexto: z.boolean().describe('true si la foto se sostiene sola y cualquier texto encima la empeoraría (nunca en la portada ni en el cierre de un carrusel).'),
  frenteAAnterior: z.enum(['MEJOR', 'PEOR', 'IGUAL']).optional().describe('Si te paso un INTENTO ANTERIOR de esta misma toma: si esta es mejor, peor o igual que aquel.'),
});
export type RevisionDeFoto = z.infer<typeof RevisionDeFoto>;

export const EstadoDeTarjeta = z.enum(['PENDIENTE', 'HECHO', 'DESCARTADO']);

/** Una candidata a estética de referencia. `archivo`, relativo a la carpeta de la conversación. */
export const CandidataDeReferencia = z.object({
  id: Id,
  origen: z.enum(['pinterest', 'estudio', 'biblioteca', 'local', 'propia']),
  archivo: z.string(),
  titulo: z.string().max(200).default(''),
  motivo: z.string().max(400).optional(),
  enlace: z.string().max(500).optional(),
});
export type CandidataDeReferencia = z.infer<typeof CandidataDeReferencia>;

const HechosConfirmados = HechosDelPlato.extend({ activoReal: z.string() });
export const FuentesDePieza = z.object({
  hechos: HechosConfirmados,
  referencia: z.object({ id: Id, archivo: z.string(), ficha: z.unknown().optional(), revision: z.literal(2).optional() }).optional(),
});
export type FuentesDePieza = z.infer<typeof FuentesDePieza>;
const PedidoDePieza = z.object({ formato: Formato, diapositivas: z.number().int().min(1).max(6), indicaciones: z.string(), esfuerzo: Esfuerzo, fuentes: FuentesDePieza.optional() });
export type PedidoDePieza = z.infer<typeof PedidoDePieza>;

export const Bloque = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('hechos'), id: Id, estado: EstadoDeTarjeta, propuesta: HechosDelPlato,
    formato: z.union([Formato, z.literal('auto')]).optional(), esfuerzo: Esfuerzo.optional(),
  }),
  z.object({ tipo: z.literal('plan'), id: Id, estado: EstadoDeTarjeta, pieza: Id }),
  z.object({ tipo: z.literal('progreso'), id: Id, pieza: Id }),
  z.object({ tipo: z.literal('pieza'), id: Id, pieza: Id, mostrar: z.int().positive().optional() }),
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
    pedido: PedidoDePieza,
    consultas: z.array(z.string()).default([]),
    candidatas: z.array(CandidataDeReferencia).default([]),
    progreso: z.array(z.string()).default([]),
    elegida: z.string().optional(),
    imagenElegida: Id.optional(),
    lectura: z.array(z.object({ titulo: z.string(), detalle: z.string() })).optional(),
    error: z.string().optional(),
  }),
  /** Tres conceptos de serie para elegir antes del plan (o «decide tú»). */
  z.object({
    tipo: z.literal('conceptos'),
    id: Id,
    estado: z.enum(['BUSCANDO', 'PENDIENTE', 'HECHO', 'ERROR']),
    pedido: PedidoDePieza,
    conceptos: z.array(ConceptoDeSerie).default([]),
    elegido: z.number().int().min(0).max(2).optional(),
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

/** Quién trabaja en una pieza. Cada uno tiene su cursor en la mesa de la web. */
export const RolDeAgente = z.enum(['director', 'fotografo', 'maquetador', 'revisor']);
export type RolDeAgente = z.infer<typeof RolDeAgente>;
/** Una zona de la lámina, en fracciones del lienzo (0–1): la capa que toca el agente. */
export const ZonaDeLamina = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export type ZonaDeLamina = z.infer<typeof ZonaDeLamina>;
/** Lo que hace un agente ahora mismo: en qué lámina (y en qué zona de ella) y con qué. */
export const AgenteEnLaMesa = z.object({
  /** Un id por puesto de trabajo («fotografo-2»): dos fotógrafos en paralelo son dos cursores. */
  id: z.string(),
  rol: RolDeAgente,
  n: z.number().int().positive().optional(),
  zona: ZonaDeLamina.optional(),
  accion: z.string(),
  desde: z.string(),
});
export type AgenteEnLaMesa = z.infer<typeof AgenteEnLaMesa>;
export const ApunteDeBitacora = z.object({ id: z.string(), rol: RolDeAgente, n: z.number().int().positive().optional(), texto: z.string(), fecha: z.string() });

export const DiapositivaProducida = z.object({
  n: z.number().int().positive(),
  /** Rutas relativas a la carpeta de la conversación. */
  png: z.string().optional(),
  movil: z.string().optional(),
  /** Documento de capas exacto de la versión entregada, relativo a la conversación. */
  intencion: z.string().optional(),
  /** Recorte publicado que sirve de fondo al añadir capas a una lámina que solo tenía foto. */
  fondoPlano: z.string().optional(),
  problemas: z.array(z.string()).default([]),
  foto: z.string().optional(),
  /** La lámina es la foto sola (lo planificó el director, lo decidió al ver la foto o no cabía el texto sin taparla). */
  soloFoto: z.boolean().optional(),
  /** Lo que decidieron los agentes por el camino (foto repetida, sin texto, acabado elegido a ciegas…), para el cliente. */
  decisiones: z.array(z.string()).default([]),
  /** Las capas de la composición, de fondo a frente (PNG a lienzo completo), para enseñar cómo se compuso. */
  capas: z.array(z.string()).default([]),
});

export const Pieza = z.object({
  id: Id,
  formato: Formato,
  esfuerzo: Esfuerzo,
  indicaciones: z.string().default(''),
  encargo: z.object({ local: z.string(), plato: z.string(), fotografia: z.string().optional(), fuentes: FuentesDePieza.optional() }).optional(),
  /** Falta mientras se planifica. */
  plan: PlanDePieza.optional(),
  estado: z.enum(['PROPUESTA', 'PRODUCIENDO', 'LISTA', 'ERROR', 'DESCARTADA']),
  costeEstimadoUsd: z.number().nonnegative(),
  costeRealUsd: z.number().nonnegative().optional(),
  /** Una pieza que ajusta otra: las diapositivas que no se rehacen se copian de la base. */
  base: Id.optional(),
  rehacer: z.array(z.number().int().positive()).default([]),
  progreso: z.array(PasoDeProgreso).default([]),
  /** Las fotos nuevas según van llegando (para verlas mientras se produce la pieza). */
  fotos: z.array(z.object({ n: z.number().int().positive(), archivo: z.string() })).default([]),
  /** Los agentes que trabajan ahora mismo en la pieza (vacío cuando nadie la toca). */
  agentes: z.array(AgenteEnLaMesa).default([]),
  /** Lo último que han hecho, para la bitácora de la mesa. */
  bitacora: z.array(ApunteDeBitacora).default([]),
  /** Una edición de capas en marcha sobre la pieza terminada. */
  edicion: z.object({ laminas: z.array(z.number().int().positive()), pedido: z.string(), desde: z.string() }).optional(),
  diapositivas: z.array(DiapositivaProducida).default([]),
  error: z.string().optional(),
});
export type Pieza = z.infer<typeof Pieza>;

export const EncargoCampana = z.object({
  canal: z.literal('historia').optional(),
  brief: z.object({ campana: z.string(), objetivo: z.string(), estrategia: z.string(), fecha: z.iso.date(),
    audiencia: z.string(), proposito: z.string(), motivoFormato: z.string().optional(), llamada: z.string(), metrica: z.string() }).optional(),
  local: Id,
  titulo: z.string().min(1),
  formato: Formato,
  laminas: z.number().int().min(1).max(6),
  indicaciones: z.string().min(1),
  origen: Id.optional(),
  evidenciaOrigen: z.string().min(1).optional(),
}).refine(e => e.formato === 'post' ? e.laminas === 1 : e.laminas >= 3, 'Un post tiene una lámina y un carrusel entre tres y seis.');
export type EncargoCampana = z.infer<typeof EncargoCampana>;

export const Conversacion = z.object({
  encargoCampana: EncargoCampana.optional(),
  id: Id,
  titulo: z.string().default('Nueva conversación'),
  creada: z.string(),
  actualizada: z.string(),
  imagenes: z.array(ImagenDelChat).default([]),
  /** Los hechos confirmados por el usuario (con la foto real ya registrada como activo del local). */
  hechos: HechosConfirmados.optional(),
  piezas: z.array(Pieza).default([]),
  /** La referencia de la conversación (id de una imagen): la de la ficha o la que se eligió de la biblioteca. */
  referencia: Id.optional(),
  /** La ficha de la referencia (la analiza el director al elegirla): las piezas parten de ella como hermanas. */
  fichaReferencia: z.object({ imagen: Id, ficha: z.unknown(), apta: z.boolean(), problemas: z.array(z.string()).default([]), revision: z.literal(2).optional() }).optional(),
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
    alcance: z.enum(['diseno', 'diseno-con-imagen-secundaria', 'nueva-toma']).optional().describe('Por defecto diseno: edición directa de capas. Una foto de sustitución exige nueva-toma explícita.'),
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
