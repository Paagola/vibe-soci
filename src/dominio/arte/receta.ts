/**
 * Estudio de arte · la RECETA de una dirección visual (informe diseno/INFORME-DIRECCION-DE-ARTE-AGENTICA.md, §4).
 *
 * Es el punto medio entre los cuatro mecanismos cerrados de F3 (el modelo solo elegía) y la maqueta capa a capa (el
 * modelo elegía tamaños prudentes y lo apilaba todo «aparte»: propuesta.ts, comentario de F3.1):
 * - el modelo decide la IDEA, el ESQUELETO (la estructura de la pieza), qué hace el producto, qué hace el titular y qué
 *   OPERACIONES se combinan (repetición, anotaciones, sello, trama…), con parámetros cualitativos («monumental», «enorme»);
 * - el código (compilarReceta.ts) traduce cada decisión a celdas, cuerpos y tintas con la tensión garantizada: un titular
 *   «monumental» llena el ancho, un producto «enorme» sangra, la tinta se mide contra lo que pisa.
 * Así el repertorio es combinatorio (esqueleto × producto × titular × operaciones) y no una lista de plantillas, y la
 * crítica puede corregir un parámetro sin rehacer la pieza (parches.ts).
 */
import { z } from 'zod';
import { TextoPropuesto } from '../diseno/propuesta.js';
import type { EstiloTexto } from '../diseno/intencion.js';

const Clave = z.string().regex(/^[a-z][a-z0-9-]*$/);
const Token = z.string().regex(/^@[a-z][a-zA-Z0-9-]*$/);
/**
 * Texto que explica (no se pinta): si el modelo se alarga, se recorta en lugar de tumbar la respuesta entera
 * (23/11: Argon escribía «parentesco» de más de 240 caracteres y el plan se rechazaba tres veces).
 */
export const explicacion = (min: number, max: number) => z.preprocess((v) => (typeof v === 'string' && v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v), z.string().min(min).max(max));

const Fraccion = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

/** La estructura de la pieza: dónde vive el producto y dónde vive el texto. Cambiarla es cambiar de pieza. */
export const Esqueleto = z.enum(['PRODUCTO_SOBRE_COLOR', 'FOTO_A_SANGRE', 'PARTIDA', 'MARCO', 'COLUMNA', 'CARTEL', 'EDITORIAL', 'PATRON']);
export type Esqueleto = z.infer<typeof Esqueleto>;

export const ESQUELETOS: Record<Esqueleto, string> = {
  PRODUCTO_SOBRE_COLOR: 'El producto recortado con su máscara, grande, sobre un campo de color plano; el titular grande en el otro extremo. Directo, de cartel de producto.',
  FOTO_A_SANGRE: 'La foto llena el lienzo; el titular vive en el aire de la foto, medido, y puede ir detrás del producto. Para fotos con atmósfera y aire.',
  PARTIDA: 'El lienzo partido en dos zonas: una de foto y otra de campo (color o papel) con el texto; el producto recortado cruza la frontera entre las dos. Editorial, de carta.',
  MARCO: 'La foto dentro de un marco (rectángulo, arco o esquinas redondeadas) sobre un campo; el producto se sale del marco por arriba. Profundidad por cruce de planos.',
  COLUMNA: 'Una palabra enorme girada en vertical ocupa una columna lateral y sangra; el producto ocupa el resto del lienzo. Eje y tensión vertical.',
  CARTEL: 'La tipografía llena el lienzo (titular en varias líneas, monumental) y el producto recortado va delante tapando parte de las letras. Cartel tipográfico.',
  PATRON: 'La palabra del titular repetida en filas, una por fila y a todo lo ancho, llena el lienzo; la última fila puede ser otra (el «remate»); el producto recortado, girado, va delante en el centro; la marca arriba entre filetes y una línea abajo. Familia F2 (patrón repetido).',
  EDITORIAL: 'Mucho aire: el producto contenido y descentrado, el titular en una serif o una voz de revista, pequeños textos ordenados y filetes. Contención premium.',
};

/** Cómo de grande va el producto. El código lo convierte en ancho y sangrado. */
export const EscalaProducto = z.enum(['contenida', 'grande', 'enorme']);
/** Cómo de grande va el titular. «monumental» llena el ancho disponible. */
export const EscalaTitular = z.enum(['grande', 'monumental']);

export const Producto = z.object({
  escala: EscalaProducto,
  giro: z.number().min(-20).max(20).default(0).describe('Grados. Un giro pequeño da gesto; 0 si el plato tiene «arriba».'),
  sombra: z.enum(['no', 'contacto', 'proyectada']).default('proyectada'),
  filo: Token.optional().describe('Filo de pegatina alrededor del recorte, en este color.'),
  lado: z.enum(['izquierda', 'centro', 'derecha']).default('centro').describe('Hacia dónde se desplaza el producto.'),
});

export const Titular = z.object({
  texto: Clave.describe('Clave de «textos».'),
  voz: Clave.describe('Una voz de la lista (de la marca o del estudio).'),
  escala: EscalaTitular,
  relacion: z.enum(['aparte', 'detras', 'delante', 'contorno']).describe('Con el producto. detras: el producto lo tapa en parte. contorno: detrás y solo contorno donde lo cruza.'),
  color: Token.optional(),
  tinta: z.enum(['limpia', 'impresa', 'gastada']).default('limpia'),
  registro: Token.optional().describe('Segunda impresión desplazada en este color (efecto de risografía).'),
  giro: z.number().min(-12).max(12).default(0),
});

const TextoSecundario = z.object({ texto: Clave, voz: Clave, color: Token.optional() });

/** Operaciones que se suman al esqueleto. Cada una nace de una familia del corpus (referencias-pinterest/diseno-visual). */
export const Operacion = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('REPETICION'),
    texto: Clave.describe('Palabra que se repite en filas detrás del producto (normalmente el titular).'),
    voz: Clave,
    filas: z.number().int().min(3).max(9).default(6),
    contornoAlterno: z.boolean().default(false),
    color: Token.optional(),
  }),
  z.object({
    tipo: z.literal('ANOTACIONES'),
    notas: z.array(z.object({ texto: Clave, apunta: Fraccion.describe('Punto del producto: 0,0 arriba a la izquierda de su silueta; 1,1 abajo a la derecha.') })).min(1).max(3),
    color: Token.optional(),
  }),
  z.object({
    tipo: z.literal('SELLO'),
    forma: z.enum(['circulo', 'estrella', 'festoneado', 'ovalo', 'pastilla']),
    lineas: z.array(Clave).min(1).max(2).describe('Un dato real corto (año, recuento).'),
    color: Token.optional(),
    fondo: Token.optional(),
  }),
  z.object({ tipo: z.literal('GESTO'), gesto: z.enum(['subrayado', 'circulo', 'tachado']), de: z.enum(['titular', 'apoyo']), color: Token.optional() }),
  z.object({ tipo: z.literal('DIAGONAL'), color: Token }),
  z.object({ tipo: z.literal('FORMA_DETRAS'), figura: z.enum(['circulo', 'mancha']), color: Token }),
  z.object({ tipo: z.literal('TRAMA'), motivo: z.enum(['puntos', 'rayas', 'cuadros', 'olas']), color: Token, donde: z.enum(['fondo', 'franja']).default('fondo') }),
  z.object({ tipo: z.literal('TEXTURA'), recurso: z.enum(['papel', 'grano']) }),
  z.object({ tipo: z.literal('FILETES'), color: Token.optional() }),
  z.object({
    tipo: z.literal('ESCENA'),
    describe: z
      .string()
      .min(20)
      .max(300)
      .describe('La superficie, la luz y la atmósfera del fondo, en inglés, SIN comida, sin vajilla, sin personas y sin texto (p. ej. «charred oak planks lit by low orange ember light from the left, deep black shadows»).'),
    tratamiento: z.enum(['natural', 'duotono', 'desenfocada']).default('natural'),
  }),
  z.object({
    tipo: z.literal('GARABATO'),
    describe: z
      .string()
      .min(15)
      .max(240)
      .describe('Los trazos a mano alrededor del producto, en inglés (p. ej. «loose comic-style burst lines, small sparkles and three steam squiggles»). Nunca objetos ni comida ni letras.'),
    color: Token.optional(),
    plano: z.enum(['detras', 'delante']).default('detras'),
  }),
]);
export type Operacion = z.infer<typeof Operacion>;
export type TipoDeOperacion = Operacion['tipo'];

export const OPERACIONES: Record<TipoDeOperacion, string> = {
  REPETICION: 'Una palabra repetida en filas a todo lo ancho, detrás del producto, que tapa las del centro (ritmo; «MELTED», «MANHATTAN TOWER»).',
  ANOTACIONES: 'De una a tres anotaciones a mano con flecha que señalan partes reales del producto (explicar sin tapar).',
  SELLO: 'Un sello o pegatina con un dato real corto (un año, un recuento).',
  GESTO: 'Un trazo a mano (subrayado, círculo, tachado) sobre el titular o el apoyo: la interrupción humana.',
  DIAGONAL: 'El campo partido en diagonal con un segundo color.',
  FORMA_DETRAS: 'Un disco o una mancha orgánica de color detrás del producto, que lo enmarca.',
  TRAMA: 'Una trama de puntos, rayas, cuadros u olas, en el fondo o en una franja.',
  TEXTURA: 'Fibra de papel sobre el color, o grano de película sobre la foto.',
  FILETES: 'Filetes finos que ordenan los textos pequeños (retícula de revista).',
  GARABATO: 'Trazos dibujados a mano a tinta (destellos, líneas de movimiento, vapor, un círculo suelto) alrededor del producto, en un color de la marca: la interrupción humana, de fanzine. Cuesta una imagen.',
  ESCENA: 'Un fondo fotográfico generado (superficie, luz, atmósfera; nunca comida) en lugar del campo liso, con el producto recortado encima. Solo con PRODUCTO_SOBRE_COLOR, CARTEL, COLUMNA o EDITORIAL. Cuesta una imagen: úsalo si la escena dice algo del local (la brasa, la barra, el mármol del obrador).',
};

/**
 * Un elemento gráfico que el compositor no sabe pintar (un dibujo a mano, una forma, un icono): lo dibuja un modelo de
 * imagen secundario (Nano Banana 2) en tinta o en plano y el código lo convierte en una capa recortable del color de la
 * marca. Nunca comida, texto ni logos: el producto es siempre la foto real.
 */
export const ElementoGrafico = z.object({
  describe: z.string().min(15).max(240).describe('Qué se dibuja, en inglés (p. ej. «loose comic burst lines and small sparkles»). Nunca comida, texto, letras, números ni logos.'),
  estilo: z.enum(['trazo', 'forma']).default('trazo').describe('trazo: dibujo de línea a mano, a tinta. forma: figura plana rellena (una mancha, un sol, una cinta).'),
  donde: z.enum(['alrededor-del-producto', 'detras-del-titular', 'esquina', 'fondo']),
  plano: z.enum(['detras', 'delante']).default('detras').describe('detras: por detrás del producto y del texto. delante: encima (solo trazos finos que no tapen lo importante).'),
  color: Token.optional(),
});
export type ElementoGrafico = z.infer<typeof ElementoGrafico>;

/** Una dirección visual: lo que escribe el director de arte. */
export const Receta = z.object({
  nombre: z.string().min(2).max(40).describe('Nombre corto de la dirección («Alzado», «Prensa», «Corte»).'),
  idea: explicacion(12, 280).describe('La idea en una frase: de qué hecho del producto, del mensaje o del local nace.'),
  lecturas: z.array(explicacion(3, 120)).length(3).describe('Qué se ve primero, segundo y tercero.'),
  esqueleto: Esqueleto,
  lado: z.enum(['izquierda', 'derecha', 'arriba', 'abajo']).optional().describe('PARTIDA y COLUMNA: dónde va la zona de texto. CARTEL y FOTO_A_SANGRE: dónde va el titular.'),
  fondo: Token.describe('Color del campo (de la lista).'),
  acento: Token.optional().describe('Segundo color, con carácter (de la lista).'),
  textos: z.array(TextoPropuesto).min(1).max(8),
  producto: Producto,
  titular: Titular,
  acentoManuscrito: TextoSecundario.optional().describe('Una o dos palabras en voz manuscrita o de florituras que se apoyan en el titular.'),
  apoyo: TextoSecundario.optional(),
  remate: TextoSecundario.optional().describe('PATRON: la última fila, distinta de la palabra repetida (p. ej. «OF THE MONTH»), en la misma voz y color.'),
  firma: TextoSecundario.optional(),
  operaciones: z.array(Operacion).max(4).default([]),
  elementos: z.array(ElementoGrafico).max(3).default([]).describe('Elementos dibujados por un modelo de imagen secundario (opcional).'),
  parentesco: explicacion(8, 240).optional().describe('Con referencia: qué se toma de ella (estructura, mecanismo, ritmo, tratamiento).'),
  mejora: explicacion(8, 240).optional().describe('Con referencia: la decisión propia que hace esta pieza mejor que la referencia.'),
});
export type Receta = z.infer<typeof Receta>;
export type RecetaEntrada = z.input<typeof Receta>;

/** Lo que el director estudia de la referencia antes de proponer (modo referencia). */
export const AnalisisDeReferencia = z.object({
  queLaHaceFuncionar: z.array(explicacion(5, 200)).min(2).max(5),
  estructura: explicacion(10, 300).describe('Dónde va cada cosa y en qué proporción.'),
  tipografia: explicacion(5, 220),
  color: explicacion(5, 220),
  producto: explicacion(5, 220).describe('Cómo se trata el producto: recorte, giro, escala, posición, sombra.'),
  recursos: z.array(z.string().max(160)).max(6),
  elementosDibujados: z.array(z.string().max(160)).max(4).describe('Lo que la referencia tiene dibujado a mano o ilustrado (el compositor no lo pinta).'),
  mejorable: z.array(explicacion(5, 200)).min(1).max(4).describe('Lo que se puede hacer mejor que la referencia.'),
});
export type AnalisisDeReferencia = z.infer<typeof AnalisisDeReferencia>;

/** Modo referencia: el estudio de la referencia y las direcciones hermanas (que se le parecen y la mejoran). */
export const PropuestaInspirada = z.object({ analisis: AnalisisDeReferencia, direcciones: z.array(Receta).min(1).max(3) });
export type PropuestaInspirada = z.infer<typeof PropuestaInspirada>;

/** Lo que escribe el director: varias direcciones de una vez, para que sean distintas entre sí. */
export const PropuestaDeDirecciones = z.object({ direcciones: z.array(Receta).min(2).max(4) });
export type PropuestaDeDirecciones = z.infer<typeof PropuestaDeDirecciones>;

/**
 * Voces del estudio para el titular, el acento o las anotaciones: una por registro tipográfico, de las fuentes OFL de
 * recursos/tipografias. La firma va siempre en la voz de la marca (la identidad no se reinventa en cada pieza).
 */
export const VOCES_DE_ESTUDIO: Record<string, { estilo: Omit<EstiloTexto, 'color'>; describe: string; papel: 'titular' | 'acento' | 'anotacion' | 'apoyo' }> = {
  'estudio-ultracondensada': { estilo: { fuente: 'anybody', ejes: { wdth: 50, wght: 900 }, caso: 'mayusculas', tracking: -0.01, interlineado: 0.82, rasgos: [] }, describe: 'grotesca ultracondensada negrísima, de cartel', papel: 'titular' },
  'estudio-madera': { estilo: { fuente: 'league-gothic', ejes: { wdth: 100 }, caso: 'mayusculas', tracking: 0, interlineado: 0.86, rasgos: [] }, describe: 'condensada alta, de tipo de madera', papel: 'titular' },
  'estudio-extendida': { estilo: { fuente: 'mattone', ejes: {}, caso: 'mayusculas', tracking: 0, interlineado: 0.92, rasgos: [] }, describe: 'grotesca extendida y pesada, ancha', papel: 'titular' },
  'estudio-didona': { estilo: { fuente: 'bodoni-moda', ejes: { opsz: 96, wght: 700 }, caso: 'tal-cual', tracking: -0.02, interlineado: 0.92, rasgos: [] }, describe: 'didona de alto contraste, de revista', papel: 'titular' },
  'estudio-didona-condensada': { estilo: { fuente: 'noto-serif-display', ejes: { wdth: 62.5, wght: 800 }, caso: 'mayusculas', tracking: -0.01, interlineado: 0.86, rasgos: [] }, describe: 'didona condensada y alta', papel: 'titular' },
  'estudio-serif-blanda': { estilo: { fuente: 'fraunces', ejes: { opsz: 144, wght: 800, SOFT: 100, WONK: 1 }, caso: 'tal-cual', tracking: -0.02, interlineado: 0.9, rasgos: [] }, describe: 'serif blanda y redonda, cercana y pop', papel: 'titular' },
  'estudio-serif-editorial': { estilo: { fuente: 'instrument-serif', ejes: {}, caso: 'tal-cual', tracking: -0.01, interlineado: 0.95, rasgos: [] }, describe: 'serif editorial condensada, elegante', papel: 'titular' },
  'estudio-floritura': { estilo: { fuente: 'ballet', ejes: { opsz: 72 }, caso: 'tal-cual', tracking: 0, interlineado: 0.95, rasgos: [] }, describe: 'script de florituras, solo para una o dos palabras de acento', papel: 'acento' },
  'estudio-pincel': { estilo: { fuente: 'kaushan-script', ejes: {}, caso: 'tal-cual', tracking: 0, interlineado: 0.95, rasgos: [] }, describe: 'script de pincel, solo para acento', papel: 'acento' },
  'estudio-rotulador': { estilo: { fuente: 'caveat', ejes: { wght: 600 }, caso: 'tal-cual', tracking: 0, interlineado: 1.05, rasgos: [] }, describe: 'rotulador a mano, para anotaciones', papel: 'anotacion' },
  'estudio-mono': { estilo: { fuente: 'plex-mono', ejes: {}, caso: 'mayusculas', tracking: 0.08, interlineado: 1.3, rasgos: [] }, describe: 'monoespaciada en versalitas, para etiquetas y datos', papel: 'apoyo' },
};
