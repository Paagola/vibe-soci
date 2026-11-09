/**
 * La intención de un diseño: qué capas hay, dónde van en la retícula y cómo se relacionan.
 * La escribe una persona (F1) o, más adelante, el director. No lleva píxeles exactos ni tamaños de letra:
 * eso lo calcula el resolutor. Cada capa se puede cambiar sin tocar las demás.
 */
import { z } from 'zod';

const Id = z.string().regex(/^[a-z][a-z0-9-]*$/, 'minúsculas, números y guiones');
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa el formato #RRGGBB');
/** Un color: un token de la marca (@rojo) o un HEX. */
export const Color = z.union([Hex, z.string().regex(/^@[a-z][a-zA-Z0-9-]*$/, 'un token empieza por @')]);
export type Color = z.infer<typeof Color>;

/**
 * Dónde va algo. En la retícula (columnas y filas de 1 a N, ambas incluidas) o en fracciones del lienzo.
 * Las fracciones pueden salirse de 0–1: es el sangrado (lo que se sale del borde a propósito).
 */
export const CajaReticula = z.object({ col: z.tuple([z.number().int(), z.number().int()]), fila: z.tuple([z.number().int(), z.number().int()]) });
export const CajaFraccion = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });
export const Caja = z.union([CajaReticula, CajaFraccion]);
export type Caja = z.infer<typeof Caja>;

export const Punto = z.object({ x: z.number(), y: z.number() });

export const Fusion = z.enum(['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'darken', 'lighten']);
export type Fusion = z.infer<typeof Fusion>;

export const Alineacion = z.enum([
  'arriba-izquierda', 'arriba-centro', 'arriba-derecha',
  'centro-izquierda', 'centro', 'centro-derecha',
  'abajo-izquierda', 'abajo-centro', 'abajo-derecha',
]);
export type Alineacion = z.infer<typeof Alineacion>;

/** Retoque fotográfico suave: 1 = sin cambio. `calidez` desplaza hacia el ámbar (+) o el azul (−). */
export const Retoque = z.object({
  brillo: z.number().min(0.5).max(1.5).optional(),
  saturacion: z.number().min(0).max(2).optional(),
  contraste: z.number().min(0.5).max(1.8).optional(),
  calidez: z.number().min(-0.3).max(0.3).optional(),
  /**
   * El negro más profundo de la foto. Con el negro de la marca (p. ej. un carbón #111111) la foto y el fondo
   * liso comparten el mismo negro y no se nota dónde acaba una y empieza el otro.
   */
  puntoNegro: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.string().regex(/^@[a-z][a-zA-Z0-9-]*$/)]).optional(),
});
export type Retoque = z.infer<typeof Retoque>;

const base = {
  id: Id,
  opacidad: z.number().min(0).max(1).default(1),
  fusion: Fusion.default('normal'),
  /** Para probar sin borrar: la capa existe pero no se pinta. */
  oculta: z.boolean().default(false),
  /** Por qué está esta capa (dirección de arte). No afecta al render. */
  nota: z.string().optional(),
};

export const CapaRelleno = z.object({ ...base, tipo: z.literal('relleno'), color: Color });

export const CapaDegradado = z.object({
  ...base,
  tipo: z.literal('degradado'),
  forma: z.enum(['lineal', 'radial']),
  /** Zona que ocupa; por defecto, todo el lienzo. En radial, el centro y el radio salen de esta caja. */
  caja: Caja.optional(),
  /** Solo lineal: 90 = de arriba abajo, 0 = de izquierda a derecha. */
  angulo: z.number().default(90),
  paradas: z.array(z.object({ en: z.number().min(0).max(1), color: Color, opacidad: z.number().min(0).max(1).default(1) })).min(2),
});

/** Una foto (o parte de ella) dentro de un marco. Sirve para usar la escena real, no solo el plato. */
export const CapaImagen = z.object({
  ...base,
  tipo: z.literal('imagen'),
  activo: z.string(),
  /** El marco en el lienzo: la foto se recorta a esta caja. */
  caja: Caja,
  /** Qué punto de la foto (fracciones de la foto) queda en el centro del marco. */
  enfoque: Punto.default({ x: 0.5, y: 0.5 }),
  /** 1 = la foto cubre el marco justo; 1,2 = se acerca un 20 %. */
  zoom: z.number().min(1).max(6).default(1),
  retoque: Retoque.optional(),
});

/** El plato recortado con su máscara. */
export const CapaRecorte = z.object({
  ...base,
  tipo: z.literal('recorte'),
  activo: z.string(),
  /** Tamaño del sujeto en fracciones del lienzo (uno de los dos). */
  escala: z.object({ anchoSujeto: z.number().positive().optional(), altoSujeto: z.number().positive().optional() }).optional(),
  /** Dónde se apoya el sujeto: una caja y cómo se alinea dentro de ella. */
  ancla: z.object({ caja: Caja, alinear: Alineacion.default('abajo-centro') }).optional(),
  /** Parte del sujeto que se sale de su caja hacia abajo (fracción de su alto): así no «flota». */
  sangradoAbajo: z.number().min(0).max(0.6).default(0),
  /** En vez de escala y ancla: la misma posición y escala que una capa de imagen (el plato que se sale de su foto). */
  alineadoCon: Id.optional(),
  retoque: Retoque.optional(),
  /** Suaviza el borde de la máscara (px), para que el recorte no parezca pegado. */
  bordeSuave: z.number().min(0).max(4).default(0.8),
  /** Encoge la máscara unos px antes de suavizarla: quita el filo del fondo que a veces arrastra (p. ej. el neón). */
  contraerBorde: z.number().min(0).max(8).default(0),
  /**
   * En vez de escala y ancla: el sujeto va justo detrás de la última letra de un texto, como si fuera un signo
   * (el grano de sal que hace de punto final). Las medidas van en alturas de mayúscula de esa línea.
   */
  trasTexto: z
    .object({
      texto: Id,
      /** Alto del sujeto. */
      alto: z.number().positive().max(2),
      /** Hueco entre la tinta de la última letra y el sujeto. */
      separacion: z.number().min(-0.5).max(2).default(0.08),
      /** Cuánto se levanta la base del sujeto sobre la línea base (0 = apoyado, como un punto). */
      elevacion: z.number().min(-0.5).max(1.5).default(0),
    })
    .optional(),
});

/** Sombra del sujeto: proyectada (la forma del plato, desplazada y difuminada) o de contacto (una elipse bajo la base). */
export const CapaSombra = z.object({
  ...base,
  tipo: z.literal('sombra'),
  de: Id,
  modo: z.enum(['proyectada', 'contacto']),
  color: Color.default('#000000'),
  desenfoque: z.number().min(0).max(120).default(24),
  desplazamiento: Punto.default({ x: 0, y: 18 }),
  /** Solo contacto: ancho de la elipse respecto al sujeto y alto en px. */
  ancho: z.number().min(0.1).max(1.5).default(0.8),
  alto: z.number().min(2).max(200).default(30),
});

export const Ajuste = z.enum([
  'ancho', // el bloque ocupa justo el ancho de la caja (todas las líneas al mismo tamaño)
  'ancho-por-linea', // cada línea ocupa el ancho (bloque «justificado» de cartel)
  'alto', // la altura de las mayúsculas ocupa el alto de la caja (una línea)
  'eje-ancho', // altura de mayúsculas = alto de la caja y el eje de anchura de la fuente ajusta el ancho
  'caja', // el tamaño más grande que cabe en la caja, partiendo líneas
  'fijo', // tamaño en px; parte líneas al ancho de la caja
]);

export const CapaTexto = z.object({
  ...base,
  tipo: z.literal('texto'),
  /** Literal o «@clave» de `textos`. «\n» fuerza un salto de línea. */
  texto: z.string().min(1),
  estilo: z.string(),
  caja: Caja,
  ajuste: Ajuste.default('fijo'),
  tamano: z.number().positive().optional(),
  alinear: z.enum(['izquierda', 'centro', 'derecha']).default('izquierda'),
  vertical: z.enum(['arriba', 'centro', 'abajo']).default('arriba'),
  /** −90: se lee de abajo arriba; 90: de arriba abajo. La caja es la que ocupa ya girado. */
  rotacion: z.union([z.literal(0), z.literal(90), z.literal(-90)]).default(0),
  /** Puede salirse de la zona segura (titulares monumentales que sangran). */
  sangrado: z.boolean().default(false),
  /** Solo el contorno de las letras, con este grosor en px. */
  contorno: z.number().positive().optional(),
  color: Color.optional(),
});

export const CapaForma = z.object({
  ...base,
  tipo: z.literal('forma'),
  figura: z.enum(['rect', 'elipse', 'linea']),
  /** rect y elipse. */
  caja: Caja.optional(),
  /** linea: de un punto a otro, en fracciones del lienzo. */
  desde: Punto.optional(),
  hasta: Punto.optional(),
  color: Color,
  /** Grosor del trazo en px. Sin grosor, la forma va rellena. */
  grosor: z.number().positive().optional(),
  discontinua: z.tuple([z.number().positive(), z.number().positive()]).optional(),
});

/** Texto alrededor de un círculo (sello). */
export const CapaCirculoTexto = z.object({
  ...base,
  tipo: z.literal('circulo-texto'),
  texto: z.string().min(1),
  estilo: z.string(),
  centro: Punto,
  /** Radio en fracciones del ancho del lienzo. */
  radio: z.number().positive(),
  tamano: z.number().positive(),
  /** Disco detrás del texto. */
  fondo: Color.optional(),
  /** Ángulo de inicio en grados (0 = arriba). */
  giro: z.number().default(0),
  /**
   * Grados de circunferencia que ocupa el texto. Sin él, la vuelta entera (sello). Con 180 y giro −90, la mitad de
   * arriba: el texto que sigue el borde de un plato o una taza y se lee derecho (familia F10, post-10).
   */
  arco: z.number().min(10).max(360).optional(),
});

/**
 * Líneas de nivel a la altura de partes del sujeto (anotadas en el activo), con su rótulo.
 * Es el recurso del «alzado»: el plato leído como un edificio.
 */
export const CapaNiveles = z.object({
  ...base,
  tipo: z.literal('niveles'),
  de: Id,
  estilo: z.string(),
  tamano: z.number().positive(),
  color: Color,
  grosor: z.number().positive().default(1.5),
  discontinua: z.tuple([z.number().positive(), z.number().positive()]).optional(),
  /** De dónde a dónde van las líneas (fracciones del ancho). */
  desdeX: z.number().default(0.067),
  hastaX: z.number().default(0.933),
  niveles: z.array(z.object({ punto: z.string(), izquierda: z.string().optional(), derecha: z.string().optional() })).min(1),
});

export const CapaTextura = z.object({
  ...base,
  tipo: z.literal('textura'),
  recurso: z.literal('grano'),
  intensidad: z.number().min(0).max(1).default(0.08),
  /** Tamaño del grano en px. */
  escala: z.number().min(1).max(6).default(1.6),
  semilla: z.number().int().default(7),
});

export const Capa = z.discriminatedUnion('tipo', [
  CapaRelleno, CapaDegradado, CapaImagen, CapaRecorte, CapaSombra, CapaTexto, CapaForma, CapaCirculoTexto, CapaNiveles, CapaTextura,
]);
export type Capa = z.infer<typeof Capa>;
export type CapaDe<T extends Capa['tipo']> = Extract<Capa, { tipo: T }>;

export const Relacion = z.discriminatedUnion('tipo', [
  /**
   * El texto queda detrás del sujeto: el resolutor lo sube o baja hasta que el sujeto tape esa fracción de las letras.
   * «franja» (por defecto) mide la parte más tapada de la palabra, que es la que decide si se lee; «media», el total.
   */
  z.object({
    tipo: z.literal('detras'),
    texto: Id,
    sujeto: Id,
    cobertura: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    medida: z.enum(['franja', 'media']).default('franja'),
    /** Entre qué alturas (fracciones del lienzo) puede quedar el texto al moverlo: así no se pega a lo de arriba. */
    zona: z.object({ desde: z.number().min(0).max(1), hasta: z.number().min(0).max(1) }).optional(),
  }),
  /** Estos textos no pueden tapar el sujeto más de esa fracción. */
  z.object({ tipo: z.literal('noSolapar'), textos: z.array(Id).min(1), sujeto: Id, maximo: z.number().min(0).max(1).default(0.02) }),
  /** Contraste mínimo (WCAG) entre el texto y lo que tiene detrás. Se mide al pintar. */
  z.object({ tipo: z.literal('contrasteMinimo'), texto: Id, ratio: z.number().min(1).max(21) }),
]);
export type Relacion = z.infer<typeof Relacion>;

export const EstiloTexto = z.object({
  fuente: z.string(),
  ejes: z.record(z.string(), z.number()).default({}),
  caso: z.enum(['mayusculas', 'tal-cual']).default('tal-cual'),
  /** Espaciado entre letras en em (0,1 = 10 % del cuerpo). */
  tracking: z.number().min(-0.2).max(0.6).default(0),
  /** Distancia entre líneas, en múltiplos del cuerpo. */
  interlineado: z.number().min(0.6).max(2).default(1.15),
  color: Color,
});
export type EstiloTexto = z.infer<typeof EstiloTexto>;

export const Tokens = z.object({
  colores: z.record(z.string(), Hex).default({}),
  estilos: z.record(z.string(), EstiloTexto).default({}),
});
export type Tokens = z.infer<typeof Tokens>;

export const Reticula = z.object({
  columnas: z.number().int().min(1).max(24).default(12),
  filas: z.number().int().min(1).max(32).default(16),
  margen: z.number().min(0).default(72),
  medianil: z.number().min(0).default(12),
});
export type Reticula = z.infer<typeof Reticula>;

export const Intencion = z.object({
  esquema: z.literal('diseno/intencion@1'),
  id: Id,
  version: z.number().int().min(1).default(1),
  padre: z.number().int().min(1).optional(),
  titulo: z.string(),
  /** Dirección de arte: qué se busca y por qué. */
  notas: z.string().default(''),
  marca: z.string(),
  lienzo: z.object({ formato: z.enum(['FEED_3_4', 'HISTORIA_9_16']).default('FEED_3_4') }).default({ formato: 'FEED_3_4' }),
  reticula: Reticula.default({ columnas: 12, filas: 16, margen: 72, medianil: 12 }),
  tokens: Tokens.default({ colores: {}, estilos: {} }),
  /** Papel de cada activo en el diseño («plato») → id del activo. */
  activos: z.record(z.string(), z.string()),
  /** Textos de la pieza. Las capas los usan con «@clave». */
  textos: z.record(z.string(), z.string()).default({}),
  capas: z.array(Capa).min(1),
  relaciones: z.array(Relacion).default([]),
});
export type Intencion = z.infer<typeof Intencion>;
