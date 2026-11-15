/**
 * F3 · La propuesta de diseño: lo que escribe el director (un modelo de lenguaje) y cómo se convierte en una intención.
 *
 * El director no escribe la intención del compositor, sino un dialecto más corto y de más alto nivel:
 * - habla en la retícula (columnas y filas), nunca en píxeles ni fracciones;
 * - elige una RELACIÓN del texto con el plato («detrás», «delante», «contorno»…) y el código pone lo que haga falta
 *   para pintarla (el recorte fantasma de una foto a sangre, dos capas para el contorno, la relación que se mide…);
 * - pide la tinta por nombre («impresa», «gastada») y el código pone los márgenes medidos en impresiones reales;
 * - cada texto lleva la CITA del dato que lo respalda, y el código comprueba que la cita existe: así «no inventar
 *   datos del restaurante» deja de depender de que el modelo obedezca.
 * Es más barato (menos fichas de salida, que son las caras), más difícil de romper y se puede comprobar entero.
 *
 * Todo este archivo es dominio puro: valida, comprueba y compila. No llama a nada.
 */
import { z } from 'zod';
import { rectDeCaja } from './reticula.js';
import { RECORTE_4_5_PX, TAMANO_PROPORCION } from '../reglas.js';

const Id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const Token = z.string().regex(/^@[a-z][a-zA-Z0-9-]*$/);
const COLUMNAS = 12;
const FILAS = 16;

const Celdas = z
  .object({
    col: z.array(z.number().int().min(1).max(COLUMNAS)).length(2),
    fila: z.array(z.number().int().min(1).max(FILAS)).length(2),
  })
  .describe('Caja en la retícula: columnas 1–12 y filas 1–16, [primera, última], las dos incluidas.');
export type Celdas = z.infer<typeof Celdas>;

const Fraccion = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const NivelDeTinta = z.enum(['limpia', 'impresa', 'gastada']).describe('limpia: vector; impresa: cobertura algo irregular y canto vivo; gastada: más rota. Solo en texto grande.');
const Giro = z.number().min(-30).max(30).describe('Grados; positivo, en el sentido del reloj.');

/** De dónde sale un texto. CREATIVO (una palabra de acción o sensorial) solo vale si el encargo lo permite. */
export const FuenteDeTexto = z.enum(['PLATO', 'ELEMENTO', 'MARCA', 'RECUENTO', 'CREATIVO']);
export type FuenteDeTexto = z.infer<typeof FuenteDeTexto>;

export const TextoPropuesto = z.object({
  clave: Id.describe('Nombre corto: titular, apoyo, firma, dato…'),
  texto: z.string().min(1).max(90).describe('Lo que se lee, con sus mayúsculas y acentos. «\\n» parte la línea.'),
  fuente: FuenteDeTexto.describe('PLATO: la nota del dueño. ELEMENTO: un elemento confirmado del plato. MARCA: un dato del local. RECUENTO: cuántas piezas hay.'),
  cita: z.string().max(160).describe('El fragmento LITERAL de los datos que respalda el texto.'),
});
export type TextoPropuesto = z.infer<typeof TextoPropuesto>;

const CapaFondo = z.object({ tipo: z.literal('fondo'), color: Token });

const CapaFoto = z.object({
  tipo: z.literal('foto'),
  encuadre: z.enum(['sangre', 'marco']).describe('sangre: la foto llena el lienzo. marco: dentro de «caja».'),
  caja: Celdas.optional(),
  zoom: z.number().min(1).max(3).optional(),
  enfoque: Fraccion.optional().describe('Punto de la foto que queda en el centro (0–1).'),
  tratamiento: z.enum(['natural', 'duotono', 'trama', 'desenfocada']).optional().describe('La foto del plato va «natural». Los otros, para una foto que acompaña.'),
  tinta: Token.optional().describe('duotono y trama: la tinta.'),
  papel: Token.optional().describe('duotono: el color de las luces. trama: el del papel (sin él, se ve lo de debajo).'),
  velo: z.enum(['no', 'arriba', 'abajo', 'ambos']).optional().describe('Oscurece ese lado de la foto (o los dos) para que se lea un texto. Solo si hace falta.'),
  colorVelo: Token.optional(),
  sangra: z.boolean().optional().describe('marco: llega a los cantos de los lados y al de abajo (la foto ocupa la parte baja del lienzo).'),
});

const CapaPlato = z.object({
  tipo: z.literal('plato'),
  caja: Celdas.optional().describe('Dónde se apoya el plato recortado (salvo «sobreLaFoto»).'),
  ancho: z.number().min(0.15).max(1.5).optional().describe('Ancho del plato como fracción del ancho del lienzo. Más de 1 sangra por los lados (salvo «sobreLaFoto»).'),
  sobreLaFoto: z.boolean().optional().describe('El plato sale de su foto en marco: recortado justo encima de ella, en el mismo sitio, y lo que queda fuera del marco se ve sobre el fondo.'),
  alinear: z.enum(['arriba-izquierda', 'arriba-centro', 'arriba-derecha', 'centro-izquierda', 'centro', 'centro-derecha', 'abajo-izquierda', 'abajo-centro', 'abajo-derecha']).optional(),
  giro: Giro.optional(),
  sangra: z.number().min(0).max(0.5).optional().describe('Fracción del plato que se sale por debajo de su caja.'),
  sombra: z.enum(['no', 'contacto', 'proyectada']).optional(),
});

const CapaTexto = z.object({
  tipo: z.literal('texto'),
  id: Id,
  texto: Id.describe('Clave de «textos».'),
  voz: Id.describe('Una voz de la lista.'),
  caja: Celdas,
  ajuste: z.enum(['ancho', 'caja', 'alto', 'fijo']).describe('ancho: llena el ancho de la caja (titulares). caja: lo más grande que quepa. alto: llena el alto. fijo: con «tamano».'),
  tamano: z.number().min(34).max(400).optional().describe('Solo con ajuste «fijo». Mínimo 34.'),
  alinear: z.enum(['izquierda', 'centro', 'derecha']).optional(),
  vertical: z.enum(['arriba', 'centro', 'abajo']).optional(),
  color: Token.optional(),
  giro: Giro.optional(),
  rotacion: z.enum(['no', 'sube', 'baja']).optional().describe('sube: girado 90°, se lee de abajo arriba. baja: de arriba abajo.'),
  sangra: z.boolean().optional().describe('El titular se sale por los lados a propósito.'),
  relacion: z
    .enum(['aparte', 'detras', 'delante', 'contorno'])
    .describe('Con el plato. aparte: no lo pisa. detras: el plato lo tapa en parte. delante: lo cruza por encima. contorno: detrás y, donde lo cruza, solo el contorno de las letras.'),
  tinta: NivelDeTinta.optional(),
  registro: Token.optional().describe('Segunda impresión desplazada, en este color.'),
  corte: z.boolean().optional().describe('La palabra partida en dos mitades que se deslizan. Solo si el plato también se parte o se corta.'),
  plano: z.enum(['fondo', 'frente']).optional().describe('relacion «aparte»: «fondo» lo pinta por debajo de los demás textos (un acento que el titular pisa).'),
  entre: z.array(z.number().int().min(1).max(FILAS)).length(2).optional().describe('relacion «detras»: filas entre las que se puede mover al ajustar cuánto lo tapa el plato.'),
});

const Plano = z.enum(['fondo', 'frente']).describe('fondo: por detrás del plato. frente: por delante.');

const CapaPatron = z.object({
  tipo: z.literal('patron'),
  motivo: z.enum(['palabra', 'puntos', 'cuadros', 'rayas']),
  caja: Celdas.optional().describe('Sin caja, todo el lienzo.'),
  color: Token,
  texto: Id.optional().describe('palabra: clave de «textos».'),
  voz: Id.optional(),
  filas: z.number().int().min(1).max(12).optional().describe('palabra: filas que caben en la caja.'),
  ladrillo: z.boolean().optional().describe('palabra: cada fila arranca a media palabra de la anterior.'),
  contornoAlterno: z.boolean().optional().describe('palabra: una fila rellena y otra en contorno.'),
  giro: Giro.optional(),
  desvanece: z.enum(['no', 'arriba', 'abajo', 'izquierda', 'derecha', 'centro']).optional().describe('puntos: hacia dónde se apagan.'),
  plano: Plano.optional(),
  tinta: NivelDeTinta.optional(),
});

const CapaSello = z.object({
  tipo: z.literal('sello'),
  forma: z.enum(['circulo', 'estrella', 'festoneado', 'ovalo', 'pastilla']),
  centro: Fraccion.describe('Centro del sello en el lienzo (0–1).'),
  radio: z.number().min(0.07).max(0.3).describe('Radio como fracción del ancho del lienzo.'),
  giro: Giro.optional(),
  fondo: Token,
  color: Token.describe('Color de las letras.'),
  lineas: z
    .array(z.object({ texto: Id, voz: Id, peso: z.number().min(0.2).max(1).optional() }))
    .min(1)
    .max(3)
    .describe('De una a tres líneas; la de más peso es la grande. El tamaño se ajusta solo.'),
  anillo: Id.optional().describe('Clave del texto que rodea el borde (solo círculo, estrella y festoneado).'),
  vozAnillo: Id.optional(),
  sombra: Token.optional().describe('Sombra dura desplazada, en este color.'),
});

const CapaAnotacion = z.object({
  tipo: z.literal('anotacion'),
  id: Id,
  texto: Id.describe('Clave de «textos»: el nombre de algo que se ve en el plato.'),
  voz: Id,
  caja: Celdas.describe('Dónde va el rótulo, fuera del plato.'),
  tamano: z.number().min(34).max(90).optional(),
  apunta: Fraccion.describe('Punto del plato al que señala la flecha: 0,0 es su esquina de arriba a la izquierda y 1,1 la de abajo a la derecha.'),
  color: Token,
});

const CapaTrazo = z.object({
  tipo: z.literal('trazo'),
  gesto: z.enum(['subrayado', 'circulo', 'tachado']),
  de: Id.describe('Id de la capa de texto a la que acompaña.'),
  color: Token,
});

const CapaForma = z.object({
  tipo: z.literal('forma'),
  figura: z.enum(['bloque', 'mancha', 'filete']).describe('bloque: rectángulo de color. mancha: forma orgánica. filete: una línea fina a lo ancho de la caja.'),
  caja: Celdas,
  color: Token,
  giro: Giro.optional(),
  sangra: z.boolean().optional().describe('El bloque llega a los bordes del lienzo.'),
  plano: Plano.optional(),
  tinta: NivelDeTinta.optional(),
});

/** Un campo de color partido en diagonal (familia F3): lo de debajo (o encima) de la línea va en este color. */
const CapaDiagonal = z.object({
  tipo: z.literal('diagonal'),
  color: Token,
  izquierda: z.number().min(0).max(1).describe('Altura de la línea en el canto izquierdo (0 arriba, 1 abajo).'),
  derecha: z.number().min(0).max(1).describe('Altura de la línea en el canto derecho.'),
  lado: z.enum(['abajo', 'arriba']).optional().describe('Qué parte se pinta: la de debajo de la línea (por defecto) o la de encima.'),
});

const CapaTextura = z.object({
  tipo: z.literal('textura'),
  recurso: z.enum(['papel', 'grano']).describe('papel: sobre un color plano. grano: sobre una foto.'),
  intensidad: z.number().min(0.03).max(0.2).optional(),
});

export const CapaPropuesta = z.discriminatedUnion('tipo', [CapaFondo, CapaFoto, CapaPlato, CapaTexto, CapaPatron, CapaSello, CapaAnotacion, CapaTrazo, CapaForma, CapaTextura, CapaDiagonal]);
export type CapaPropuesta = z.infer<typeof CapaPropuesta>;

/**
 * F3.1 (14/11): el director ya no coloca. Elige un MECANISMO editorial, los textos, el énfasis y unos pocos parámetros;
 * el código coloca las capas a partir del mapa de la foto (dominio/diseno/mecanismos.ts), con el salto de escala, el
 * contraste y el cruce con el plato resueltos por construcción. La maqueta capa a capa («capas») sigue existiendo para
 * escribirla a mano o en pruebas, pero no se le pide al modelo: es justo lo que hacía mal (elegía tamaños prudentes y
 * lo apilaba todo «aparte»).
 */
export const Mecanismo = z
  .enum(['TITULAR_DETRAS', 'TITULAR_CON_ACENTO', 'ANOTACIONES', 'PLATO_SOBRE_COLOR'])
  .describe(
    'TITULAR_DETRAS: el titular, monumental, a todo lo ancho, con el plato tapando su parte baja (o alta). ' +
      'TITULAR_CON_ACENTO: lo mismo, más una palabra o dos en una voz de acento (manuscrita o didona) que se apoya en el titular, escalonada: es el mecanismo de las referencias con un titular de florituras. ' +
      'ANOTACIONES: el titular grande en la zona libre y de una a tres anotaciones a mano con flecha que señalan elementos reales del plato. ' +
      'PLATO_SOBRE_COLOR: el plato recortado, enorme y girado, sobre un color plano, cortado por el borde de abajo y tapando la parte baja de un titular grande (familias F1 y F3); sirve aunque la foto no deje aire.',
  );
export type Mecanismo = z.infer<typeof Mecanismo>;

export const Composicion = z.object({
  mecanismo: Mecanismo,
  titular: Id.describe('Clave de «textos» del titular: corto (de una a tres palabras se leen monumentales).'),
  acento: Id.optional().describe('TITULAR_CON_ACENTO: clave del texto en la voz de acento (una a tres palabras, de los datos).'),
  apoyo: Id.optional().describe('Clave de una línea de apoyo pequeña (opcional).'),
  firma: Id.optional().describe('Clave de la firma: el nombre del local (opcional).'),
  lado: z.enum(['arriba', 'abajo']).optional().describe('Dónde va el titular respecto al plato. Sin él, donde haya más aire.'),
  sangra: z.boolean().optional().describe('El titular se sale por los dos bordes (más tensión; se corta en el canto).'),
  tinta: NivelDeTinta.optional().describe('Tinta del titular.'),
  color: Token.optional().describe('PLATO_SOBRE_COLOR: el color plano del fondo (de la lista). Sin él, el de la marca con más carácter.'),
  sello: z
    .object({ lineas: z.array(Id).min(1).max(2).describe('Claves de «textos»: un dato real corto (p. ej. un año que conste).') })
    .optional()
    .describe('Sello con un dato real, donde quepa. Opcional.'),
  anotaciones: z
    .array(z.object({ texto: Id, apunta: Fraccion.describe('Punto del plato al que señala: 0,0 su esquina de arriba a la izquierda; 1,1 la de abajo a la derecha.') }))
    .max(3)
    .optional()
    .describe('ANOTACIONES: de una a tres. Con los otros mecanismos, una como mucho.'),
});
export type Composicion = z.infer<typeof Composicion>;

const BasePropuesta = z.object({
  idea: z.string().min(12).max(280).describe('La idea en una frase: de qué hecho del plato o del local nace la pieza.'),
  foco: z.enum(['PLATO', 'TITULAR']).describe('Lo único que manda en la pieza.'),
  seToma: z.array(z.string().min(3).max(140)).max(4).describe('Qué se toma de la referencia (oficio: jerarquía, mecanismo, tratamiento).'),
  noSeCopia: z.array(z.string().min(3).max(140)).max(4).describe('Qué no se copia de la referencia (sus textos, su marca, su plato).'),
  textos: z.array(TextoPropuesto).min(1).max(7),
  excepcion: z
    .string()
    .min(10)
    .max(240)
    .optional()
    .describe('Solo si a propósito la pieza no cruza el plato o no tiene salto de escala: por qué. Lo lee una persona.'),
});

/** Lo que escribe el director (el modelo): sin capas. */
export const PropuestaDelDirector = BasePropuesta.extend({ composicion: Composicion });
export type PropuestaDelDirector = z.infer<typeof PropuestaDelDirector>;

/** Una propuesta: con «composicion» (coloca el código) o con «capas» (maqueta escrita a mano). */
export const PropuestaDeDiseno = BasePropuesta.extend({
  composicion: Composicion.optional(),
  capas: z.array(CapaPropuesta).min(2).max(16).optional().describe('De fondo a frente.'),
}).refine((p) => Boolean(p.composicion) !== Boolean(p.capas), 'Una propuesta lleva «composicion» (coloca el código) o «capas» (maqueta a mano), no las dos ni ninguna.');
export type PropuestaDeDiseno = z.infer<typeof PropuestaDeDiseno>;

/** La propuesta ya colocada, capa a capa: lo que compila compilarIntencion. */
export type Maqueta = Omit<PropuestaDeDiseno, 'composicion' | 'capas'> & { capas: CapaPropuesta[] };

// ------------------------------------------------------------------ Hechos y comprobación de los textos

/** Lo único que la pieza puede decir: lo que consta del local y lo que se ve en el plato. */
export interface HechosDeLaPieza {
  /** La nota del dueño al subir la foto. */
  plato: string;
  /** Los elementos confirmados en la parada de elementos. */
  elementos: Array<{ nombre: string; estado: string; recuento: number | null }>;
  local: { nombre: string; ciudad: string; descripcion: string; tonos: string[]; instagram?: string; web?: string; otros?: string[] };
}

/** Palabras gramaticales: no afirman nada, así que no necesitan constar en los datos. */
const GRAMATICALES = new Set(
  'a al ante bajo con contra de del desde durante e el en entre hacia hasta la las le les lo los me mi mis ni no o para pero por que se si sin sobre su sus te tu tus u un una unas uno unos y ya más mas muy tan como nada todo toda todos todas solo sólo es son está están hay este esta esto estos estas ese esa eso aquí'.split(' '),
);

/**
 * Palabras que afirman algo del local o del producto aunque suenen a adorno. Un titular CREATIVO no puede llevarlas
 * salvo que consten en los datos: son justo las que un modelo añade para «vender».
 */
const RECLAMOS = new Set(
  'mejor mejores premio premios premiada premiado ganador ganadora casero casera caseros caseras artesano artesana artesanal artesanales fresco fresca frescos frescas natural naturales ecologico ecologica tradicional tradicionales autentico autentica original originales unico unica nuevo nueva novedad gratis oferta ofertas descuento precio barato desde anos siempre famoso famosa legendario legendaria favorito favorita primero primera numero ahumado ahumada madurado madurada lena brasa horno'.split(
    ' ',
  ),
);

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ@.]+/g, ' ')
    .trim();
}

const palabrasDe = (texto: string) => normalizar(texto).split(' ').filter(Boolean);

/** La misma palabra en singular y en plural cuentan como la misma («carne» respalda «carnes»). */
function variantes(palabra: string): string[] {
  const v = [palabra];
  if (palabra.endsWith('es') && palabra.length > 4) v.push(palabra.slice(0, -2));
  if (palabra.endsWith('s') && palabra.length > 3) v.push(palabra.slice(0, -1));
  v.push(`${palabra}s`, `${palabra}es`);
  return v;
}

/** El texto de cada fuente, tal como consta. */
export function corpusDe(h: HechosDeLaPieza): Record<Exclude<FuenteDeTexto, 'CREATIVO'>, string> {
  const l = h.local;
  return {
    PLATO: h.plato,
    ELEMENTO: h.elementos.map((e) => `${e.nombre} ${e.estado}`).join(' · '),
    MARCA: [l.nombre, l.ciudad, l.descripcion, ...l.tonos, l.instagram ?? '', l.web ?? '', ...(l.otros ?? [])].join(' · '),
    RECUENTO: h.elementos.filter((e) => e.recuento !== null).map((e) => `${e.recuento} ${e.nombre}`).join(' · '),
  };
}

export interface OpcionesDeTexto {
  /** El encargo permite UN titular creativo (una palabra de acción o sensorial que no es un dato). Por defecto, no. */
  titularCreativo?: boolean;
  /** Palabras del post de referencia: no pueden pasar a la pieza. */
  palabrasDeReferencia?: string[];
}

/**
 * Lo que falla en los textos de una propuesta frente a los hechos. Vacío = todo lo que dice la pieza consta.
 * - la cita tiene que estar, literal, en la fuente que se declara;
 * - cada palabra con contenido del texto tiene que estar en los datos (en cualquier fuente);
 * - cada cifra tiene que constar: un precio, una fecha o un recuento no se inventan;
 * - nada de lo que decía el post de referencia.
 */
export function problemasDeTextos(textos: TextoPropuesto[], hechos: HechosDeLaPieza, opciones: OpcionesDeTexto = {}): string[] {
  const corpus = corpusDe(hechos);
  const todo = normalizar(Object.values(corpus).join(' · '));
  const palabrasConocidas = new Set(todo.split(' '));
  const consta = (palabra: string) => variantes(palabra).some((v) => palabrasConocidas.has(v));
  const deReferencia = new Set((opciones.palabrasDeReferencia ?? []).flatMap(palabrasDe).filter((p) => p.length >= 4 && !consta(p)));
  const problemas: string[] = [];
  const claves = new Set<string>();
  let creativos = 0;

  for (const t of textos) {
    if (claves.has(t.clave)) problemas.push(`Hay dos textos con la clave «${t.clave}».`);
    claves.add(t.clave);
    const palabras = palabrasDe(t.texto);
    const copiadas = palabras.filter((p) => deReferencia.has(p));
    if (copiadas.length) problemas.push(`«${t.texto}» lleva palabras del post de referencia (${copiadas.join(', ')}): de la referencia se toma el oficio, nunca sus textos.`);

    if (t.fuente === 'CREATIVO') {
      creativos++;
      if (!opciones.titularCreativo) {
        problemas.push(`«${t.texto}» se declara CREATIVO y este encargo no lo permite: usa solo palabras que consten en los datos.`);
        continue;
      }
      if (palabras.length > 2) problemas.push(`El texto creativo «${t.texto}» tiene ${palabras.length} palabras; como mucho, dos.`);
      if (/\d/.test(t.texto)) problemas.push(`El texto creativo «${t.texto}» lleva una cifra: las cifras solo salen de los datos.`);
      const reclamos = palabras.filter((p) => RECLAMOS.has(p) && !consta(p));
      if (reclamos.length) problemas.push(`El texto creativo «${t.texto}» afirma algo que no consta (${reclamos.join(', ')}).`);
      continue;
    }

    const fuente = normalizar(corpus[t.fuente]);
    const cita = normalizar(t.cita);
    if (!cita || !fuente.includes(cita)) {
      problemas.push(`La cita de «${t.texto}» («${t.cita}») no está en ${nombreDeFuente(t.fuente)}: copia el fragmento literal, o cambia el texto.`);
    }
    const sinRespaldo = palabras.filter((p) => !/^\d+$/.test(p) && !GRAMATICALES.has(p) && p.length > 1 && !consta(p));
    if (sinRespaldo.length) {
      problemas.push(`«${t.texto}» dice algo que no consta en los datos (${[...new Set(sinRespaldo)].join(', ')}): quítalo o usa las palabras de los datos.`);
    }
    const cifras = t.texto.match(/\d+(?:[.,]\d+)?/g) ?? [];
    const cifrasSinRespaldo = cifras.filter((c) => !new RegExp(`(^|[^0-9.,])${c.replace(/[.,]/g, '[.,]')}([^0-9]|$)`).test(Object.values(corpus).join(' · ')));
    if (cifrasSinRespaldo.length) problemas.push(`«${t.texto}» lleva una cifra que no consta (${cifrasSinRespaldo.join(', ')}): ni precios, ni fechas, ni recuentos inventados.`);
  }
  if (creativos > 1) problemas.push(`Hay ${creativos} textos creativos; como mucho, uno (el titular).`);
  return problemas;
}

function nombreDeFuente(fuente: Exclude<FuenteDeTexto, 'CREATIVO'>): string {
  return { PLATO: 'la nota del dueño', ELEMENTO: 'los elementos confirmados del plato', MARCA: 'los datos del local', RECUENTO: 'los recuentos confirmados' }[fuente];
}

/** Las palabras propias de un post de referencia: lo que va entre comillas en su ficha y lo que está todo en mayúsculas. */
export function palabrasDeLaFicha(ficha: { titulo: string; capas: string[] }): string[] {
  const textos = [ficha.titulo, ...ficha.capas];
  const citas = textos.flatMap((t) => [...t.matchAll(/«([^»]+)»/g)].map((m) => m[1]!));
  const mayusculas = textos.flatMap((t) => t.match(/\b[A-ZÁÉÍÓÚÑ]{4,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})*\b/g) ?? []);
  return [...new Set([...citas, ...mayusculas].flatMap(palabrasDe).filter((p) => p.length >= 4))];
}

// ------------------------------------------------------------------ De la propuesta a la intención

export interface ContextoDeCompilacion {
  id: string;
  version: number;
  titulo: string;
  /** Slug del local. */
  marca: string;
  /** Id del activo de la foto nueva. */
  foto: string;
  /** La foto tiene máscara: se puede recortar el plato, poner cosas detrás de él y señalarlo. */
  tieneMascara: boolean;
  /** Colores disponibles (los de la marca y los medidos en la foto), sin la arroba. */
  colores: Record<string, string>;
  /** Voces disponibles: las de la marca y las del estudio. */
  voces: string[];
  /** Voces del estudio que hay que añadir a la intención porque la marca no las tiene. */
  vocesDeEstudio: Record<string, unknown>;
  /** Colores medidos que hay que añadir a la intención (p. ej. el del plato). */
  coloresMedidos: Record<string, string>;
  /** Hay referencia: la propuesta tiene que decir qué toma y qué no copia. */
  conReferencia: boolean;
  /** Punto 10: la estética del encargo y sus límites de oficio, que viajan en la intención hasta el compositor. */
  estetica?: { id: string; limites: { saltoMinimo: number; palabrasMaximas: number; nivelesMaximos: number; vocesMaximas: number; gestosMaximos: number; recursosMaximos: number } };
}

/** Los márgenes de la tinta impresa salen de impresiones reales (diseno/f3/INVESTIGACION.md §3.2). */
const TINTAS = {
  limpia: undefined,
  impresa: { densidad: 0.08, bordeSeco: 0.02 },
  gastada: { densidad: 0.12, bordeSeco: 0.04 },
} as const;

/** En qué plano va cada cosa: se pinta por planos y, dentro de cada uno, en el orden de la propuesta. */
const enum Plano3 {
  FONDO = 0,
  FOTO = 1,
  DETRAS = 2,
  SOMBRA = 3,
  PLATO = 4,
  FRENTE = 5,
  GESTO = 6,
  TEXTURA = 7,
}

const LIENZO = { ancho: TAMANO_PROPORCION['3:4'].ancho, alto: TAMANO_PROPORCION['3:4'].alto };
const RETICULA = { columnas: COLUMNAS, filas: FILAS, margen: 72, medianil: 12 };
const r4 = (n: number) => Math.round(n * 10000) / 10000;
/** Lo que queda entre los márgenes de arriba y abajo y el recorte de 4:5, en fracciones del alto (reticula.ts, zonaSegura). */
const ZONA_SEGURA_VERTICAL = { desde: r4((RETICULA.margen + RECORTE_4_5_PX) / LIENZO.alto), hasta: r4(1 - (RETICULA.margen + RECORTE_4_5_PX) / LIENZO.alto) };

/** Una caja de celdas en fracciones del lienzo. Con `sangra`, llega a los bordes laterales (y los pasa un poco). */
/**
 * Cuánto se sale por cada canto lo que sangra, en fracción del ancho. Un titular solo asoma (el 15/11 el usuario pidió
 * «un recorte de canto, no una amputación de letras»: con 0,04 se perdía media E de ENTRECOT); un patrón o un bloque,
 * que no se leen letra a letra, sí pueden salirse más.
 */
export const SANGRADO_TITULAR = 0.008;
const SANGRADO_FORMA = 0.04;

function aFracciones(celdas: Celdas, sangra = false, cuanto = SANGRADO_FORMA): { x: number; y: number; w: number; h: number } {
  const col: [number, number] = [Math.min(celdas.col[0]!, celdas.col[1]!), Math.max(celdas.col[0]!, celdas.col[1]!)];
  const fila: [number, number] = [Math.min(celdas.fila[0]!, celdas.fila[1]!), Math.max(celdas.fila[0]!, celdas.fila[1]!)];
  const r = rectDeCaja({ col, fila }, LIENZO, RETICULA);
  let x = r.x / LIENZO.ancho;
  let w = r.w / LIENZO.ancho;
  if (sangra) {
    // Lo que toca la primera o la última columna se lleva más allá del borde: un titular que sangra se corta en el canto.
    const derecha = col[1] === COLUMNAS ? 1 + cuanto : x + w;
    x = col[0] === 1 ? -cuanto : x;
    w = derecha - x;
  }
  return { x: r4(x), y: r4(r.y / LIENZO.alto), w: r4(w), h: r4(r.h / LIENZO.alto) };
}

/** Entre qué alturas puede moverse un texto «detras»: sus filas «entre», y nunca fuera de la zona segura (salvo si sangra). */
function zonaDe(entre: number[] | undefined, sangra: boolean | undefined): { zona?: { desde: number; hasta: number } } {
  if (!entre) return sangra ? {} : { zona: ZONA_SEGURA_VERTICAL };
  const r = aFracciones({ col: [1, 1], fila: [entre[0]!, entre[1]!] });
  const desde = sangra ? r.y : Math.max(r.y, ZONA_SEGURA_VERTICAL.desde);
  const hasta = sangra ? r4(r.y + r.h) : Math.min(r4(r.y + r.h), ZONA_SEGURA_VERTICAL.hasta);
  return { zona: { desde, hasta } };
}

/** Un marco que llega a los cantos de los lados y al de abajo: de su borde de arriba hasta el final del lienzo. */
function sangraAbajoYLados(r: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  return { x: 0, y: r.y, w: 1, h: r4(1 - r.y) };
}

/** Un texto que toca la fila 1 o la 16 se sale de la zona segura (márgenes más el recorte de 4:5). */
const fueraDeZonaSegura = (c: Celdas) => Math.min(c.fila[0]!, c.fila[1]!) <= 1 || Math.max(c.fila[0]!, c.fila[1]!) >= FILAS;

export interface Compilacion {
  /** La intención, sin validar todavía con su esquema (lo hace quien la usa). */
  intencion: Record<string, unknown>;
  /** Lo que la propuesta pide y no se puede hacer. Con alguno, no hay intención que valga. */
  problemas: string[];
}

/**
 * Convierte la propuesta del director en una intención del compositor. Determinista: la misma propuesta da la misma
 * intención. Comprueba lo que se puede comprobar sin pintar (que las voces, los colores y los textos existen, que lo que
 * depende de la máscara tenga máscara) y deja para el compositor lo que hay que medir.
 */
export function compilarIntencion(p: Maqueta, c: ContextoDeCompilacion): Compilacion {
  const problemas: string[] = [];
  const claves = new Set(p.textos.map((t) => t.clave));
  const color = (token: string, donde: string): string => {
    if (!(token.slice(1) in c.colores)) problemas.push(`${donde}: el color «${token}» no está en la lista (${Object.keys(c.colores).map((k) => `@${k}`).join(', ')}).`);
    return token;
  };
  const voz = (nombre: string, donde: string): string => {
    if (!c.voces.includes(nombre)) problemas.push(`${donde}: la voz «${nombre}» no está en la lista (${c.voces.join(', ')}).`);
    return nombre;
  };
  const texto = (clave: string, donde: string): string => {
    if (!claves.has(clave)) problemas.push(`${donde}: no hay ningún texto con la clave «${clave}».`);
    return `@${clave}`;
  };

  if (c.conReferencia && (p.seToma.length === 0 || p.noSeCopia.length === 0)) {
    problemas.push('La pieza parte de una referencia: di en «seToma» qué oficio tomas de ella y en «noSeCopia» qué no copias.');
  }
  const fotos = p.capas.filter((x) => x.tipo === 'foto' && (x.tratamiento ?? 'natural') === 'natural');
  const platos = p.capas.filter((x) => x.tipo === 'plato');
  if (platos.length > 1) problemas.push('Hay más de una capa «plato»: el plato va una vez.');
  if (fotos.length === 0 && platos.length === 0) problemas.push('La pieza no enseña el plato: hace falta una capa «plato» (recortado) o una «foto» al natural.');
  if (platos.length && !c.tieneMascara) problemas.push('La foto no tiene máscara: no se puede recortar el plato. Usa la foto a sangre o en un marco.');
  const aSangre = p.capas.find((x) => x.tipo === 'foto' && x.encuadre === 'sangre' && (x.tratamiento ?? 'natural') === 'natural');
  // El sujeto con el que se relacionan los textos: el plato recortado o, en una foto a sangre con máscara, su silueta.
  const haySujeto = platos.length > 0 || (Boolean(aSangre) && c.tieneMascara);
  const sujetoFantasma = platos.length === 0 && Boolean(aSangre) && c.tieneMascara;
  const idsDeTexto = new Set(p.capas.filter((x) => x.tipo === 'texto' || x.tipo === 'anotacion').map((x) => (x as { id: string }).id));
  if (idsDeTexto.size !== p.capas.filter((x) => x.tipo === 'texto' || x.tipo === 'anotacion').length) problemas.push('Hay dos capas de texto con el mismo id.');

  const capas: Array<{ plano: Plano3; capa: Record<string, unknown> }> = [];
  const poner = (plano: Plano3, capa: Record<string, unknown>) => capas.push({ plano, capa });
  const relaciones: Array<Record<string, unknown>> = [];
  const noSolapar: string[] = [];
  const usados = new Set<string>();
  let fotoEnMarco: string | undefined;
  const idLibre = (base: string): string => {
    let id = base;
    for (let n = 2; usados.has(id); n++) id = `${base}-${n}`;
    usados.add(id);
    return id;
  };
  for (const id of idsDeTexto) usados.add(id);
  const tintaDe = (nivel: keyof typeof TINTAS | undefined, registro?: string, donde = '') => {
    const base = nivel ? TINTAS[nivel] : undefined;
    if (!base && !registro) return {};
    return { tinta: { ...(base ?? {}), ...(registro ? { registro: { dx: 6, dy: 4, color: color(registro, donde), opacidad: 0.85 } } : {}) } };
  };
  const detrasDelSujeto = (plano: 'fondo' | 'frente' | undefined) => (plano ?? 'fondo') === 'fondo';

  for (const x of p.capas) {
    switch (x.tipo) {
      case 'fondo':
        poner(Plano3.FONDO, { id: idLibre('fondo'), tipo: 'relleno', color: color(x.color, 'fondo') });
        break;

      case 'foto': {
        const id = idLibre('foto');
        if (x.encuadre === 'marco' && (x.tratamiento ?? 'natural') === 'natural') fotoEnMarco = id;
        const natural = (x.tratamiento ?? 'natural') === 'natural';
        if (x.encuadre === 'marco' && !x.caja) problemas.push('Una foto en marco necesita «caja».');
        const retoque =
          x.tratamiento === 'duotono'
            ? { duotono: { sombras: color(x.tinta ?? '@', 'foto en duotono (tinta)'), luces: color(x.papel ?? '@', 'foto en duotono (papel)') } }
            : x.tratamiento === 'trama'
              ? { contraste: 1.15, tramado: { forma: 'punto', paso: 10, angulo: 45, tinta: color(x.tinta ?? '@', 'foto en trama (tinta)'), ...(x.papel ? { papel: color(x.papel, 'foto en trama (papel)') } : {}) } }
              : x.tratamiento === 'desenfocada'
                ? { desenfoque: 18 }
                : undefined;
        poner(Plano3.FOTO, {
          id,
          tipo: 'imagen',
          activo: 'foto',
          caja: x.encuadre === 'sangre' || !x.caja ? { x: 0, y: 0, w: 1, h: 1 } : x.sangra ? sangraAbajoYLados(aFracciones(x.caja)) : aFracciones(x.caja),
          ...(x.zoom ? { zoom: x.zoom } : {}),
          ...(x.enfoque ? { enfoque: x.enfoque } : {}),
          ...(retoque ? { retoque } : {}),
        });
        if (x.velo && x.velo !== 'no') {
          const tono = color(x.colorVelo ?? '@', 'velo de la foto');
          for (const abajo of x.velo === 'ambos' ? [false, true] : [x.velo === 'abajo']) {
            poner(Plano3.FOTO, {
              id: idLibre('velo'),
              tipo: 'degradado',
              forma: 'lineal',
              caja: abajo ? { x: 0, y: 0.55, w: 1, h: 0.45 } : { x: 0, y: 0, w: 1, h: 0.45 },
              angulo: 90,
              paradas: abajo ? [{ en: 0, color: tono, opacidad: 0 }, { en: 1, color: tono, opacidad: 0.86 }] : [{ en: 0, color: tono, opacidad: 0.86 }, { en: 1, color: tono, opacidad: 0 }],
            });
          }
        }
        // La silueta del plato de una foto a sangre: no se pinta, pero deja que los textos se relacionen con él.
        if (natural && x.encuadre === 'sangre' && sujetoFantasma && !usados.has('plato')) {
          usados.add('plato');
          poner(Plano3.FOTO, { id: 'plato', tipo: 'recorte', activo: 'foto', alineadoCon: id, opacidad: 0, nota: 'Silueta del plato de la foto a sangre: no se pinta.' });
        }
        break;
      }

      case 'plato': {
        usados.add('plato');
        if (x.sombra && x.sombra !== 'no') {
          poner(
            Plano3.SOMBRA,
            x.sombra === 'contacto'
              ? { id: idLibre('sombra'), tipo: 'sombra', de: 'plato', modo: 'contacto', desenfoque: 26, ancho: 0.82, alto: 34, opacidad: 0.38 }
              : { id: idLibre('sombra'), tipo: 'sombra', de: 'plato', modo: 'proyectada', desenfoque: 36, desplazamiento: { x: 0, y: 26 }, opacidad: 0.45 },
          );
        }
        if (x.sobreLaFoto) {
          if (!fotoEnMarco) problemas.push('plato «sobreLaFoto»: hace falta antes una capa «foto» en marco, al natural.');
          poner(Plano3.PLATO, { id: 'plato', tipo: 'recorte', activo: 'foto', alineadoCon: fotoEnMarco ?? 'foto', contraerBorde: 1, nota: 'El plato sale de su foto: recortado encima de ella, en el mismo sitio.' });
          break;
        }
        if (!x.caja || !x.ancho) {
          problemas.push('plato: hace falta «caja» y «ancho» (o «sobreLaFoto»).');
          break;
        }
        poner(Plano3.PLATO, {
          id: 'plato',
          tipo: 'recorte',
          activo: 'foto',
          escala: { anchoSujeto: x.ancho },
          ancla: { caja: aFracciones(x.caja), alinear: x.alinear ?? 'centro' },
          ...(x.sangra ? { sangradoAbajo: x.sangra } : {}),
          ...(x.giro ? { giro: x.giro } : {}),
          contraerBorde: 1,
        });
        break;
      }

      case 'texto': {
        const donde = `texto «${x.id}»`;
        if (x.ajuste === 'fijo' && !x.tamano) problemas.push(`${donde}: con ajuste «fijo» hace falta «tamano».`);
        if (!x.sangra && fueraDeZonaSegura(x.caja)) problemas.push(`${donde}: las filas 1 y 16 quedan fuera de la zona segura (se cortan en 4:5); usa las filas 2–15, o «sangra» si es un titular que se sale a propósito.`);
        const comun = {
          tipo: 'texto',
          texto: texto(x.texto, donde),
          estilo: voz(x.voz, donde),
          caja: aFracciones(x.caja, x.sangra, SANGRADO_TITULAR),
          ajuste: x.ajuste,
          ...(x.tamano && x.ajuste === 'fijo' ? { tamano: x.tamano } : {}),
          ...(x.alinear ? { alinear: x.alinear } : {}),
          ...(x.vertical ? { vertical: x.vertical } : {}),
          ...(x.color ? { color: color(x.color, donde) } : {}),
          ...(x.giro ? { giro: x.giro } : {}),
          ...(x.rotacion && x.rotacion !== 'no' ? { rotacion: x.rotacion === 'sube' ? -90 : 90 } : {}),
          ...(x.sangra ? { sangrado: true } : {}),
          ...(x.corte ? { corte: { angulo: 72, en: 0.55, desplazamiento: 28 } } : {}),
          ...tintaDe(x.tinta, x.registro, donde),
        };
        const relacion = haySujeto ? x.relacion : 'aparte';
        if (x.relacion !== 'aparte' && !haySujeto) problemas.push(`${donde}: la relación «${x.relacion}» necesita el plato recortado o una foto a sangre con máscara.`);
        if (relacion === 'aparte') {
          poner(x.plano === 'fondo' ? Plano3.DETRAS : Plano3.FRENTE, { id: x.id, ...comun });
          if (haySujeto) noSolapar.push(x.id);
          relaciones.push({ tipo: 'contrasteMinimo', texto: x.id, ratio: x.ajuste === 'fijo' ? 4.5 : 3 });
        } else if (relacion === 'delante') {
          poner(Plano3.FRENTE, { id: x.id, ...comun });
          relaciones.push({ tipo: 'cruza', texto: x.id, sujeto: 'plato', minimo: 0.04 }, { tipo: 'contrasteMinimo', texto: x.id, ratio: 3 });
        } else {
          // Detrás del plato: con el plato recortado basta el orden de las capas; con una foto a sangre, se recorta por su silueta.
          poner(Plano3.DETRAS, { id: x.id, ...comun, ...(sujetoFantasma ? { recortarCon: { sujeto: 'plato', modo: 'fuera' } } : {}) });
          // También con la silueta de una foto a sangre: «cruza» solo pedía un mínimo, y un titular tapado casi entero
          // pasaba sin aviso. «detras» lo sube o lo baja hasta que el plato tape entre el 20 y el 45 % de su franja
          // más tapada, que es lo que decide si se lee. Sin salirse de la zona segura al moverlo (si no se puede, avisa).
          relaciones.push({ tipo: 'detras', texto: x.id, sujeto: 'plato', cobertura: [0.2, 0.45], ...zonaDe(x.entre, x.sangra) });
          if (relacion === 'contorno') {
            const { tinta: _sinTinta, ...limpio } = comun as Record<string, unknown>;
            poner(Plano3.FRENTE, { id: idLibre(`${x.id}-contorno`), ...limpio, contorno: 3, recortarCon: { sujeto: 'plato', modo: 'dentro' }, opacidad: 0.92 });
          }
        }
        break;
      }

      case 'patron': {
        const donde = `patrón de ${x.motivo}`;
        if (x.motivo === 'palabra' && (!x.texto || !x.voz)) problemas.push(`${donde}: hace falta «texto» y «voz».`);
        const detras = detrasDelSujeto(x.plano);
        poner(detras ? Plano3.DETRAS : Plano3.FRENTE, {
          id: idLibre('patron'),
          tipo: 'patron',
          motivo: x.motivo,
          color: color(x.color, donde),
          ...(x.caja ? { caja: aFracciones(x.caja, x.motivo === 'palabra') } : {}),
          ...(x.motivo === 'palabra' && x.texto && x.voz ? { texto: texto(x.texto, donde), estilo: voz(x.voz, donde), filas: x.filas ?? 5, desfase: x.ladrillo ? 0.5 : 0, contornoAlterno: x.contornoAlterno ? 3 : 0 } : {}),
          ...(x.motivo === 'puntos' ? { paso: 20, tamano: [0.38, 0], desvanece: x.desvanece ?? 'abajo' } : {}),
          ...(x.motivo === 'cuadros' ? { paso: 36 } : {}),
          ...(x.motivo === 'rayas' ? { paso: 24, tamano: [0.5, 0.5], angulo: 60 } : {}),
          ...(x.giro ? { giro: x.giro } : {}),
          ...(detras && sujetoFantasma ? { recortarCon: { sujeto: 'plato', modo: 'fuera' } } : {}),
          ...tintaDe(x.tinta),
        });
        break;
      }

      case 'sello': {
        const donde = 'sello';
        if (x.anillo && (x.forma === 'ovalo' || x.forma === 'pastilla')) problemas.push('sello: el anillo de texto solo va en círculo, estrella o festoneado.');
        poner(Plano3.FRENTE, {
          id: idLibre('sello'),
          tipo: 'sello',
          forma: x.forma,
          centro: x.centro,
          radio: x.radio,
          fondo: color(x.fondo, donde),
          color: color(x.color, donde),
          filete: 2,
          lineas: x.lineas.map((l) => ({ texto: texto(l.texto, donde), estilo: voz(l.voz, donde), ...(l.peso ? { peso: l.peso } : {}) })),
          ...(x.anillo ? { anillo: { texto: texto(x.anillo, donde), estilo: voz(x.vozAnillo ?? x.lineas[0]!.voz, donde), tamano: 24 } } : {}),
          giro: x.giro ?? -8,
          ...(x.sombra ? { sombra: { dx: 6, dy: 8, color: color(x.sombra, donde) } } : {}),
        });
        break;
      }

      case 'anotacion': {
        const donde = `anotación «${x.id}»`;
        if (!haySujeto) problemas.push(`${donde}: una anotación señala al plato; hace falta el plato recortado o una foto a sangre con máscara.`);
        if (fueraDeZonaSegura(x.caja)) problemas.push(`${donde}: las filas 1 y 16 quedan fuera de la zona segura (se cortan en 4:5); usa las filas 2–15.`);
        const caja = aFracciones(x.caja);
        poner(Plano3.GESTO, { id: x.id, tipo: 'texto', texto: texto(x.texto, donde), estilo: voz(x.voz, donde), caja, ajuste: 'fijo', tamano: x.tamano ?? 46, color: color(x.color, donde) });
        if (haySujeto) {
          // La flecha sale del lado del rótulo que mira al centro del lienzo, que es hacia donde está el plato.
          const cx = caja.x + caja.w / 2;
          const cy = caja.y + caja.h / 2;
          const haciaLaDerecha = cx < 0.5;
          const desde = { x: r4(haciaLaDerecha ? caja.x + caja.w * 0.55 : caja.x + caja.w * 0.2), y: r4(cy < 0.5 ? caja.y + caja.h * 0.75 : caja.y - 0.004) };
          poner(Plano3.GESTO, { id: idLibre(`${x.id}-flecha`), tipo: 'trazo', gesto: 'flecha', desde, hacia: { sujeto: 'plato', punto: x.apunta }, curva: haciaLaDerecha === cy < 0.5 ? -0.3 : 0.3, color: color(x.color, donde), grosor: 4, temblor: 0.4 });
          noSolapar.push(x.id);
        }
        break;
      }

      case 'trazo':
        if (!idsDeTexto.has(x.de)) problemas.push(`trazo: «${x.de}» no es el id de ninguna capa de texto.`);
        poner(Plano3.GESTO, { id: idLibre(x.gesto), tipo: 'trazo', gesto: x.gesto, de: x.de, color: color(x.color, 'trazo'), grosor: 6, temblor: 0.4 });
        break;

      case 'forma': {
        const donde = `forma (${x.figura})`;
        const detras = detrasDelSujeto(x.plano);
        const caja = aFracciones(x.caja, x.sangra);
        const comun = { id: idLibre(x.figura), tipo: 'forma', color: color(x.color, donde), ...(x.giro ? { giro: x.giro } : {}), ...(detras && sujetoFantasma ? { recortarCon: { sujeto: 'plato', modo: 'fuera' } } : {}), ...tintaDe(x.tinta) };
        if (x.figura === 'filete') poner(detras ? Plano3.DETRAS : Plano3.FRENTE, { ...comun, figura: 'linea', desde: { x: caja.x, y: r4(caja.y + caja.h / 2) }, hasta: { x: r4(caja.x + caja.w), y: r4(caja.y + caja.h / 2) }, grosor: 2 });
        else poner(detras ? Plano3.DETRAS : Plano3.FRENTE, { ...comun, figura: x.figura === 'bloque' ? 'rect' : 'mancha', caja });
        break;
      }

      case 'diagonal': {
        // Un polígono que pasa de canto a canto y se sale un poco: la línea no deja huecos en las esquinas.
        const borde = x.lado === 'arriba' ? -0.05 : 1.05;
        poner(Plano3.FONDO, {
          id: idLibre('diagonal'),
          tipo: 'forma',
          figura: 'poligono',
          color: color(x.color, 'diagonal'),
          puntos: [
            { x: -0.05, y: x.izquierda },
            { x: 1.05, y: x.derecha },
            { x: 1.05, y: borde },
            { x: -0.05, y: borde },
          ],
        });
        break;
      }

      case 'textura':
        poner(Plano3.TEXTURA, { id: idLibre(x.recurso), tipo: 'textura', recurso: x.recurso, intensidad: x.intensidad ?? 0.08, fusion: x.recurso === 'papel' ? 'soft-light' : 'overlay' });
        break;
    }
  }

  if (noSolapar.length) relaciones.push({ tipo: 'noSolapar', textos: noSolapar, sujeto: 'plato', maximo: 0.03 });
  // Se pinta por planos; dentro de cada uno, en el orden en que lo escribió el director.
  const ordenadas = capas.map((x, i) => ({ ...x, i })).sort((a, b) => a.plano - b.plano || a.i - b.i).map((x) => x.capa);

  return {
    problemas,
    intencion: {
      esquema: 'diseno/intencion@1',
      id: c.id,
      version: c.version,
      titulo: c.titulo,
      notas: [`Idea: ${p.idea}`, `Foco: ${p.foco === 'PLATO' ? 'el plato' : 'el titular'}.`, p.seToma.length ? `De la referencia se toma: ${p.seToma.join('; ')}.` : '', p.noSeCopia.length ? `No se copia: ${p.noSeCopia.join('; ')}.` : '']
        .filter(Boolean)
        .join(' '),
      marca: c.marca,
      tokens: { colores: c.coloresMedidos, estilos: c.vocesDeEstudio },
      activos: { foto: c.foto },
      textos: Object.fromEntries(p.textos.map((t) => [t.clave, t.texto])),
      capas: ordenadas,
      relaciones,
      ...(c.estetica ? { estetica: c.estetica.id, oficio: c.estetica.limites } : {}),
    },
  };
}
