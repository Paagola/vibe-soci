/**
 * El prompt de la foto nueva sale del INVENTARIO confirmado (descripcion.elementos), no del texto libre de los huecos.
 * Nada que no conste (nota, marca, lista de elementos, datos del local) puede entrar en el prompt: lo que lo afirma se
 * detecta aquí y se pide quitarlo. Motivo: en la prueba de Torre de Vega el prompt decía «acorn-fed ibérico» y «bodega»
 * sin que la nota del dueño lo dijera, y los platos del inventario no salieron en la foto.
 */
import { normalizarTexto } from './inventario.js';
import { RECLAMOS } from './diseno/propuesta.js';
import { montarPromptFotoNueva, problemasFotoNueva, type ElementoFoto, type HuecosFotoNueva, type OpcionesDePrompt, type PropuestaFotoNueva, type TomaDeDetalle } from './fotoNueva.js';

/** La frase del elemento para el prompt: `ingles` (recortado) o, si no hay, `${nombre}, ${estado}` en castellano (lo añadió una persona). */
export function fraseDelElemento(e: Pick<ElementoFoto, 'nombre' | 'estado' | 'ingles'>): string {
  const ingles = e.ingles?.trim();
  return ingles ? ingles : `${e.nombre}, ${e.estado}`;
}

/**
 * Los huecos que de verdad van al prompt. Sin `o.desdeElInventario`, devuelve `p.huecos` TAL CUAL (el mismo objeto).
 * Con él: `{ ...p.huecos, elementos, recuento }` donde
 *   elementos = p.descripcion.elementos.map(fraseDelElemento).join('; ')
 *   recuento  = si hay elementos con recuento !== null: `Exactly ${contables.map(e => `${e.recuento} × ${fraseDelElemento(e)}`).join('; ')}.`
 *               si no: 'Exactly the elements listed above, no more.'
 */
export function huecosEfectivos(p: PropuestaFotoNueva, o?: OpcionesDePrompt): HuecosFotoNueva {
  if (!o?.desdeElInventario) return p.huecos;
  const elementos = p.descripcion.elementos.map(fraseDelElemento).join('; ');
  const contables = p.descripcion.elementos.filter((e) => e.recuento !== null);
  const recuento = contables.length
    ? `Exactly ${contables.map((e) => `${e.recuento} × ${fraseDelElemento(e)}`).join('; ')}.`
    : 'Exactly the elements listed above, no more.';
  return { ...p.huecos, elementos, recuento };
}

/** Igual para una toma de detalle: sin desdeElInventario, `t.huecos` tal cual; con él, `{ ...t.huecos, elementos: fraseDelElemento(el) }` si existe el elemento de nombre `t.elemento` en p.descripcion.elementos (si no, `t.huecos` tal cual). El recuento de la toma NO cambia. */
export function huecosDeTomaEfectivos(p: PropuestaFotoNueva, t: TomaDeDetalle, o?: OpcionesDePrompt): HuecosFotoNueva {
  if (!o?.desdeElInventario) return t.huecos;
  const el = p.descripcion.elementos.find((e) => e.nombre === t.elemento);
  return el ? { ...t.huecos, elementos: fraseDelElemento(el) } : t.huecos;
}

/** Afirmaciones en inglés que el prompt no puede hacer si no constan: `patron` se busca en el texto normalizado; vale si algún `constaSi` (raíz normalizada) aparece en los hechos normalizados. */
export const AFIRMACIONES_EN_INGLES: ReadonlyArray<{ patron: RegExp; constaSi: readonly string[] }> = [
  { patron: /\biberic(o|a|os|as)?\b|\biberian\b/, constaSi: ['iberic'] },
  { patron: /\bacorn(-fed)?\b|\bbellota\b/, constaSi: ['bellota'] },
  { patron: /\bpata negra\b|\bblack[- ]hoof\b/, constaSi: ['pata negra'] },
  { patron: /\bbodegas?\b|\bwine cellar\b/, constaSi: ['bodega'] },
  { patron: /\btaverns?\b|\btabernas?\b/, constaSi: ['taberna'] },
  { patron: /\bsteakhouse\b|\basador\b/, constaSi: ['asador', 'parrilla'] },
  { patron: /\btraditional\b/, constaSi: ['tradicion'] },
  { patron: /\bhome-?made\b/, constaSi: ['caser'] },
  { patron: /\bartisan(al)?\b|\bhand-?made\b|\bcraft\b/, constaSi: ['artesan'] },
  { patron: /\borganic\b/, constaSi: ['ecologic', 'organic'] },
  { patron: /\bfree-range\b/, constaSi: ['corral', 'campero'] },
  { patron: /\bwood-?fired?\b|\bwood fire\b|\bfirewood\b|\bcharcoal\b|\bember-?grilled\b|\bflame-grilled\b/, constaSi: ['brasa', 'lena', 'carbon'] },
  { patron: /\bgrilled\b/, constaSi: ['brasa', 'parrilla', 'plancha', 'lena'] },
  { patron: /\bsmoked\b/, constaSi: ['ahumad'] },
  { patron: /\b(dry-)?aged\b|\bmatured\b/, constaSi: ['madurad', 'curad', 'anej'] },
  { patron: /\baward(-winning)?\b|\bprize-winning\b|\bbest\b|\bfamous\b|\blegendary\b|\bpremium\b|\bgourmet\b|\bluxur(y|ious)\b|\bmichelin\b/, constaSi: ['premi', 'mejor', 'famos', 'legendari', 'premium', 'gourmet', 'lujo', 'michelin'] },
  { patron: /\bfresh(ly caught)?\b|\bcatch of the day\b/, constaSi: ['fresc', 'del dia'] },
  { patron: /\bwagyu\b/, constaSi: ['wagyu'] },
  { patron: /\bkobe\b/, constaSi: ['kobe'] },
  { patron: /\bangus\b/, constaSi: ['angus'] },
  { patron: /\bgalician\b/, constaSi: ['galleg', 'galicia'] },
  { patron: /\bbasque\b/, constaSi: ['vasc', 'euskadi'] },
  { patron: /\bspanish\b/, constaSi: ['espan'] },
  { patron: /\bandalusian\b/, constaSi: ['andalu'] },
  { patron: /\bitalian\b/, constaSi: ['italia'] },
  { patron: /\bjapanese\b/, constaSi: ['japon'] },
  { patron: /\bmediterranean\b/, constaSi: ['mediterrane'] },
];

export interface HechosDelPrompt { nota: string; marca?: string }

/** Palabras de RECLAMOS que no son afirmaciones de calidad o de origen en este contexto. */
const PALABRAS_PERMITIDAS = new Set(['natural', 'naturales', 'original', 'originales']);

/**
 * Problemas (strings, en castellano llano, SIN nombres de fichero ni comandos) de una propuesta cuyo prompt sale del inventario. En este orden:
 * 1) por cada elemento sin `ingles` (vacío o ausente):
 *    `«${nombre}» no tiene su frase para el prompt: sin ella, el generador no lo dibuja. Escríbela (en inglés, con su estado).`
 * 2) por cada elemento con `enEncuadre === false`:
 *    `La toma nueva deja fuera «${nombre}»: con esa cámara no cabe en la foto. Cambia la toma (más abierta o desde más arriba) para que quepa, o quita «${nombre}» de la lista si no tiene que salir.`
 *    y con `enEncuadre === undefined`: `No consta si «${nombre}» entra en la toma nueva: hay que decirlo de cada elemento.`
 * 3) afirmaciones: corpus = normalizarTexto([hechos.nota, hechos.marca ?? '', ...elementos.map(e => `${e.nombre} ${e.estado}`)].join(' ')).
 *    Textos a mirar, con su «dónde»: p.huecos.plato → 'qué es el plato'; p.huecos.origen → 'el tipo de local'; cada `ingles` → `la frase de «${nombre}»`.
 *    Para cada texto (normalizarTexto) y cada entrada de AFIRMACIONES_EN_INGLES cuyo patrón coincida y ninguna raíz `constaSi` esté en el corpus:
 *    `El prompt dice «${coincidencia}» en ${donde}, pero ni la nota del dueño, ni la lista de elementos, ni los datos del local lo dicen: quítalo (el generador no puede inventarlo).`
 *    Además, cada palabra del texto (split por /[^a-z0-9ñ-]+/) que esté en RECLAMOS, que NO sea 'natural', 'naturales', 'original' ni 'originales', y que no esté entre las palabras del corpus: el mismo mensaje con esa palabra.
 *    Sin repetir el mismo mensaje dos veces.
 */
export function problemasDelInventario(p: PropuestaFotoNueva, hechos: HechosDelPrompt): string[] {
  const problemas: string[] = [];
  const elementos = p.descripcion.elementos;

  for (const e of elementos) {
    if (!e.ingles?.trim()) {
      problemas.push(`«${e.nombre}» no tiene su frase para el prompt: sin ella, el generador no lo dibuja. Escríbela (en inglés, con su estado).`);
    }
  }

  for (const e of elementos) {
    if (e.enEncuadre === false) {
      problemas.push(
        `La toma nueva deja fuera «${e.nombre}»: con esa cámara no cabe en la foto. Cambia la toma (más abierta o desde más arriba) para que quepa, o quita «${e.nombre}» de la lista si no tiene que salir.`,
      );
    } else if (e.enEncuadre === undefined) {
      problemas.push(`No consta si «${e.nombre}» entra en la toma nueva: hay que decirlo de cada elemento.`);
    }
  }

  const corpus = normalizarTexto([hechos.nota, hechos.marca ?? '', ...elementos.map((e) => `${e.nombre} ${e.estado}`)].join(' '));
  const palabrasDelCorpus = new Set(corpus.split(/[^a-z0-9ñ-]+/));

  const textos: Array<{ texto: string; donde: string }> = [
    { texto: p.huecos.plato, donde: 'qué es el plato' },
    { texto: p.huecos.origen, donde: 'el tipo de local' },
    ...elementos.filter((e) => e.ingles?.trim()).map((e) => ({ texto: e.ingles ?? '', donde: `la frase de «${e.nombre}»` })),
  ];

  const vistos = new Set<string>();
  const añadir = (mensaje: string) => {
    if (vistos.has(mensaje)) return;
    vistos.add(mensaje);
    problemas.push(mensaje);
  };
  const mensajeInventado = (coincidencia: string, donde: string) =>
    `El prompt dice «${coincidencia}» en ${donde}, pero ni la nota del dueño, ni la lista de elementos, ni los datos del local lo dicen: quítalo (el generador no puede inventarlo).`;

  for (const { texto, donde } of textos) {
    const t = normalizarTexto(texto);
    for (const { patron, constaSi } of AFIRMACIONES_EN_INGLES) {
      const m = patron.exec(t);
      if (m && !constaSi.some((raiz) => corpus.includes(raiz))) añadir(mensajeInventado(m[0], donde));
    }
    for (const palabra of t.split(/[^a-z0-9ñ-]+/)) {
      if (RECLAMOS.has(palabra) && !PALABRAS_PERMITIDAS.has(palabra) && !palabrasDelCorpus.has(palabra)) añadir(mensajeInventado(palabra, donde));
    }
  }

  return problemas;
}

/**
 * El prompt y los problemas de una propuesta, como los ven la orden, la corrección a mano y la web.
 * huecos = huecosEfectivos(p, o); prompt = montarPromptFotoNueva(huecos, o);
 * problemas = [...problemasFotoNueva(p, c.lado), ...(o?.desdeElInventario ? problemasDelInventario(p, { nota: c.nota, ...(c.marca ? { marca: c.marca } : {}) }) : [])].
 * Sin desdeElInventario, prompt y problemas son EXACTAMENTE los de antes.
 */
export function revisarPropuesta(p: PropuestaFotoNueva, o: OpcionesDePrompt | undefined, c: { lado: { ancho: number; alto: number }; nota: string; marca?: string }): { huecos: HuecosFotoNueva; prompt: string; problemas: string[] } {
  const huecos = huecosEfectivos(p, o);
  const prompt = montarPromptFotoNueva(huecos, o);
  const problemas = [
    ...problemasFotoNueva(p, c.lado),
    ...(o?.desdeElInventario ? problemasDelInventario(p, { nota: c.nota, ...(c.marca ? { marca: c.marca } : {}) }) : []),
  ];
  return { huecos, prompt, problemas };
}
