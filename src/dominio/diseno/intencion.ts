/**
 * La intención de un diseño: qué capas hay, dónde van en la retícula y cómo se relacionan.
 * La escribe una persona (F1) o el director de diseño (F3, dominio/diseno/propuesta.ts). No lleva píxeles exactos ni
 * tamaños de letra: eso lo calcula el resolutor. Cada capa se puede cambiar sin tocar las demás.
 *
 * F3 (11/2026) amplía el vocabulario con lo que pedían las referencias del usuario y la investigación de estilos
 * (diseno/f3/INVESTIGACION.md): giro libre, sello, patrón, trazo a mano, corte tipográfico, tinta impresa,
 * texto recortado por el sujeto, duotono, trama de semitonos y rasgos OpenType. Todo es opcional y compatible:
 * una intención anterior se resuelve y se pinta igual que antes.
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

/** Giro libre en grados, en el sentido de las agujas del reloj (como en pantalla). */
const Giro = z.number().min(-180).max(180);

/**
 * Trama de semitonos: la imagen se reproduce con puntos o líneas de una sola tinta, más gordos donde la foto es más
 * oscura (como en prensa o en risografía). Es un proceso de reproducción, no un filtro de color.
 */
export const Tramado = z.object({
  forma: z.enum(['punto', 'linea']).default('punto'),
  /** Distancia entre puntos o líneas, en px del lienzo. */
  paso: z.number().min(4).max(60).default(12),
  /** Ángulo de la trama. 45° es el clásico: es el que menos se nota como rejilla. */
  angulo: z.number().default(45),
  tinta: Color,
  /** Color del papel. Sin él, el papel es transparente y se ve la capa de debajo. */
  papel: Color.optional(),
});
export type Tramado = z.infer<typeof Tramado>;

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
  /** Desenfoque en px: la escena que queda detrás de un recorte nítido. Da profundidad; no es un efecto. */
  desenfoque: z.number().min(0).max(60).optional(),
  /** Dos tintas: las sombras de la foto toman un color y las luces otro (impresión a dos tintas). */
  duotono: z.object({ sombras: Color, luces: Color }).optional(),
  tramado: Tramado.optional(),
});
export type Retoque = z.infer<typeof Retoque>;

/**
 * Tinta impresa: lo que hace que un texto grande o una forma parezcan impresos y no un vector perfecto.
 * Los márgenes salen de impresiones reales (cobertura irregular del 6–12 %, canto reseco del 1–4 %, registro de 1–3 mm).
 * Solo para textos grandes y formas: en un texto pequeño estropea la lectura y el resolutor lo ignora con un aviso.
 * Es determinista: la semilla sale de la identidad de la capa, así que repetir la pieza da las mismas marcas.
 */
export const Tinta = z.object({
  /** Cobertura irregular: la tinta no cubre igual en todas partes (0 = plana). */
  densidad: z.number().min(0).max(0.4).default(0),
  /** Canto reseco: el borde se rompe un poco y aparecen poros (0 = limpio). */
  bordeSeco: z.number().min(0).max(0.15).default(0),
  /** Segunda impresión desplazada (fuera de registro), en px. Sin color, es la misma tinta más pálida. */
  registro: z.object({ dx: z.number().min(-24).max(24), dy: z.number().min(-24).max(24), color: Color.optional(), opacidad: z.number().min(0).max(1).default(0.35) }).optional(),
  semilla: z.number().int().optional(),
});
export type Tinta = z.infer<typeof Tinta>;

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
  /**
   * Giro del sujeto alrededor de su centro (el sándwich de post-09 va girado unos 10° sobre las filas de texto).
   * Un giro pequeño da gesto; uno grande solo si el plato no tiene «arriba» (un cenital).
   */
  giro: Giro.default(0),
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

/**
 * Corte tipográfico: la palabra se parte por una línea y las dos mitades se deslizan, como algo que se rompe o se
 * rebana. Tiene sentido cuando lo hace también el plato (un pan que se parte, un corte de cuchillo); si no, es adorno.
 */
export const Corte = z.object({
  /** Ángulo de la línea de corte tal como se ve: 0 = horizontal, 90 = vertical, 60 = «/». */
  angulo: z.number().min(-89).max(90).default(72),
  /** Dónde cruza el corte el bloque: 0 = borde izquierdo (o de arriba, si el corte es tumbado), 1 = el opuesto. */
  en: z.number().min(0).max(1).default(0.5),
  /** Cuánto se desliza una mitad respecto a la otra a lo largo del corte, en px. */
  desplazamiento: z.number().min(0).max(200).default(28),
  /** Hueco que se abre entre las dos mitades, en px. */
  separacion: z.number().min(0).max(80).default(0),
});
export type Corte = z.infer<typeof Corte>;

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
  /**
   * Giro libre alrededor del centro de la caja, además de `rotacion`. El texto se compone en su caja y después gira:
   * una script inclinada −6°, un rótulo torcido como una etiqueta pegada a mano.
   */
  giro: Giro.default(0),
  /** Puede salirse de la zona segura (titulares monumentales que sangran). */
  sangrado: z.boolean().default(false),
  /** Solo el contorno de las letras, con este grosor en px. */
  contorno: z.number().positive().optional(),
  color: Color.optional(),
  corte: Corte.optional(),
  tinta: Tinta.optional(),
  /**
   * El texto solo se pinta donde está el sujeto («dentro») o donde no está («fuera»).
   * - «fuera» sobre una foto a sangre: la palabra queda detrás del plato sin tener que recortarlo.
   * - «dentro» con `contorno`: el titular pasa a contorno al cruzar el producto (post-19, «BEST COFFEE EVER»).
   */
  recortarCon: z.object({ sujeto: Id, modo: z.enum(['dentro', 'fuera']) }).optional(),
});

export const CapaForma = z.object({
  ...base,
  tipo: z.literal('forma'),
  /** `mancha` es una forma orgánica dentro de su caja (las de post-17 y post-19); `poligono`, un bloque de color libre. */
  figura: z.enum(['rect', 'elipse', 'linea', 'poligono', 'mancha']),
  /** rect, elipse y mancha. */
  caja: Caja.optional(),
  /** linea: de un punto a otro, en fracciones del lienzo. */
  desde: Punto.optional(),
  hasta: Punto.optional(),
  /** poligono: sus vértices en fracciones del lienzo (pueden salirse: un bloque diagonal que sangra). */
  puntos: z.array(Punto).min(3).max(24).optional(),
  color: Color,
  /** Grosor del trazo en px. Sin grosor, la forma va rellena. */
  grosor: z.number().positive().optional(),
  discontinua: z.tuple([z.number().positive(), z.number().positive()]).optional(),
  /** rect: radio de las esquinas en px. */
  radio: z.number().min(0).max(600).optional(),
  giro: Giro.default(0),
  /** mancha: cuántos lóbulos tiene y cuánto se aparta de una elipse. */
  lobulos: z.number().int().min(3).max(9).default(5),
  irregularidad: z.number().min(0).max(1).default(0.35),
  semilla: z.number().int().optional(),
  tinta: Tinta.optional(),
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
  /** `grano`: grano de película (para «overlay»). `papel`: la fibra y el moteado de un papel sin estucar (para «soft-light»). */
  recurso: z.enum(['grano', 'papel']),
  intensidad: z.number().min(0).max(1).default(0.08),
  /** Tamaño del grano en px. */
  escala: z.number().min(1).max(6).default(1.6),
  semilla: z.number().int().default(7),
});

/**
 * Sello o pegatina: una forma con su texto dentro, compuesta como una sola pieza (posts 5, 7, 13, 26 y 27).
 * Lleva un dato REAL del local (un precio, una fecha, un premio que conste); nunca un reclamo inventado.
 * El texto del centro se ajusta solo a la forma: no hay que dar tamaños.
 */
export const CapaSello = z.object({
  ...base,
  tipo: z.literal('sello'),
  forma: z.enum(['circulo', 'estrella', 'festoneado', 'ovalo', 'pastilla']).default('circulo'),
  centro: Punto,
  /** Radio exterior en fracciones del ancho del lienzo (en óvalo y pastilla, la mitad de su ancho). */
  radio: z.number().positive().max(0.6),
  /** Óvalo y pastilla: alto respecto al ancho. */
  proporcion: z.number().min(0.2).max(1).default(0.55),
  /** Estrella y festoneado: número de puntas u ondas. */
  puntas: z.number().int().min(6).max(48).default(16),
  /** Estrella y festoneado: cuánto entran las puntas (fracción del radio). */
  profundidad: z.number().min(0.03).max(0.45).default(0.14),
  fondo: Color,
  /** Color de las letras y del filete. */
  color: Color,
  /** Filete interior, en px (0 = sin filete). */
  filete: z.number().min(0).max(12).default(0),
  /** Texto en anillo, siguiendo el borde por dentro. */
  anillo: z.object({ texto: z.string().min(1), estilo: z.string(), tamano: z.number().positive() }).optional(),
  /** De una a tres líneas en el centro. `peso` reparte el tamaño: la de más peso es la grande. */
  lineas: z.array(z.object({ texto: z.string().min(1), estilo: z.string(), peso: z.number().min(0.2).max(1).default(1) })).min(1).max(3),
  /** Un sello recto parece un botón; torcido unos grados parece puesto a mano. */
  giro: Giro.default(-8),
  /** Sombra dura desplazada, sin difuminar: la pegatina sobre el papel. */
  sombra: z.object({ dx: z.number().min(-40).max(40), dy: z.number().min(-40).max(40), color: Color }).optional(),
  tinta: Tinta.optional(),
});

/**
 * Patrón: un motivo repetido que hace de textura y, si es una palabra, también de titular (familia F2: posts 9, 25 y 28).
 * - `palabra`: la palabra en filas a todo lo ancho; el producto tapa las del centro.
 * - `puntos`: un campo de semitonos, que puede desvanecerse (el «aire» con textura, no un degradado).
 * - `cuadros` y `rayas`: la tira de cuadros de post-5 y post-25, o un rayado.
 */
export const CapaPatron = z.object({
  ...base,
  tipo: z.literal('patron'),
  motivo: z.enum(['palabra', 'puntos', 'cuadros', 'rayas']),
  /** Zona que ocupa; por defecto, todo el lienzo. Lo que se sale de la caja no se pinta. */
  caja: Caja.optional(),
  color: Color,
  giro: Giro.default(0),
  /** palabra: literal o «@clave». */
  texto: z.string().min(1).optional(),
  estilo: z.string().optional(),
  /** palabra: filas que caben en la caja (decide el tamaño de letra). */
  filas: z.number().int().min(1).max(24).default(6),
  /** palabra: cada fila arranca desplazada esta fracción de su ancho respecto a la anterior (0,5 = a ladrillo). */
  desfase: z.number().min(0).max(1).default(0),
  /** palabra: hueco entre repeticiones, en anchos de un espacio. */
  separacion: z.number().min(0).max(8).default(1),
  /** palabra: las filas pares van solo en contorno, con este grosor en px (0 = todas rellenas). */
  contornoAlterno: z.number().min(0).max(12).default(0),
  /** puntos, cuadros y rayas: distancia entre puntos o rayas, o lado del cuadro, en px. */
  paso: z.number().min(4).max(240).default(24),
  /** puntos: radio respecto al paso en el extremo fuerte y en el débil. rayas: grosor respecto al paso (el primero). */
  tamano: z.tuple([z.number().min(0).max(0.75), z.number().min(0).max(0.75)]).default([0.42, 0.42]),
  /** puntos: hacia dónde se desvanecen (del tamaño fuerte al débil). */
  desvanece: z.enum(['no', 'arriba', 'abajo', 'izquierda', 'derecha', 'centro']).default('no'),
  /** puntos y rayas: ángulo de la trama. */
  angulo: z.number().default(45),
  tinta: Tinta.optional(),
});

/**
 * Trazo a mano: un subrayado, un círculo alrededor de un dato, una flecha que señala un ingrediente real.
 * Es la interrupción humana de una pieza ordenada, y por eso va UNO (una sola familia de gesto por pieza): con varios,
 * la pieza se vuelve un collage de garabatos. El pulso es determinista.
 */
export const CapaTrazo = z.object({
  ...base,
  tipo: z.literal('trazo'),
  gesto: z.enum(['subrayado', 'circulo', 'flecha', 'tachado']),
  /** Subrayado, círculo y tachado: el texto al que acompañan (se colocan solos sobre su caja). */
  de: Id.optional(),
  /** Flecha (o un trazo libre): de dónde a dónde, en fracciones del lienzo. */
  desde: Punto.optional(),
  hasta: Punto.optional(),
  /** Flecha: la punta sigue a un punto del sujeto (fracciones de su caja), aunque el plato cambie de sitio o de tamaño. */
  hacia: z.object({ sujeto: Id, punto: Punto }).optional(),
  /** Flecha: comba del trazo (0 = recto; el signo decide hacia qué lado). */
  curva: z.number().min(-1).max(1).default(0.25),
  cabeza: z.enum(['abierta', 'ninguna']).default('abierta'),
  color: Color,
  grosor: z.number().min(1.5).max(28).default(5),
  /** Pulso: 0 = tirado con regla; 1 = muy suelto. */
  temblor: z.number().min(0).max(1).default(0.35),
  /** Fracción del trazo que se queda sin tinta, como un rotulador seco. */
  huecos: z.number().min(0).max(0.2).default(0),
  semilla: z.number().int().optional(),
});

export const Capa = z.discriminatedUnion('tipo', [
  CapaRelleno, CapaDegradado, CapaImagen, CapaRecorte, CapaSombra, CapaTexto, CapaForma, CapaCirculoTexto, CapaNiveles, CapaTextura,
  CapaSello, CapaPatron, CapaTrazo,
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
  /**
   * El texto tiene que tocar al sujeto: al menos esa fracción de sus letras cae sobre él. Es lo contrario de «noSolapar»
   * y lo que convierte titular y producto en una sola cosa, en vez de dos bloques apilados. Se mide y, si no llega, avisa.
   */
  z.object({ tipo: z.literal('cruza'), texto: Id, sujeto: Id, minimo: z.number().min(0).max(1).default(0.04) }),
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
  /**
   * Rasgos OpenType que se activan además de los de serie, si la fuente los tiene: «smcp» (versalitas de verdad),
   * «onum» (cifras elzevirianas), «swsh» (florituras), «ss01»… Los que la fuente no tenga se ignoran.
   */
  rasgos: z.array(z.string().regex(/^[a-zA-Z0-9]{4}$/, 'un rasgo OpenType tiene 4 caracteres')).default([]),
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
