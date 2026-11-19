/**
 * Recetas de tipografía especial (tipografia/receta@1): un estilo de letra (derretida, papel, neón…) descrito como
 * datos, no como código. El compositor las interpreta (adaptadores/compositor/interpreteRecetas.ts).
 *
 * Por qué datos: un agente puede escribir una receta nueva sin escribir código que se ejecute. La receta solo usa
 * piezas de una lista blanca (filtros SVG, formas que salen de las letras, variación por letra), con rangos acotados
 * y un tamaño máximo; se valida antes de pintarla. Todas las medidas van en alturas de mayúscula («cap»), así el
 * estilo sale igual a cualquier cuerpo.
 *
 * Diseño completo: diseno/tipografia-especial/SISTEMA.md.
 */
import { z } from 'zod';

const IdLocal = z.string().regex(/^[a-z][a-zA-Z0-9-]{0,40}$/, 'id: minúsculas, números y guiones');
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/** Un número: literal, «$parametro» o «parámetro × por + mas» (para derivar un valor de un mando). */
export const Valor = z.union([
  z.number(),
  z.string().regex(/^\$[a-zA-Z][a-zA-Z0-9]*$/, 'un parámetro se escribe «$nombre»'),
  z.object({ param: z.string(), por: z.number().default(1), mas: z.number().default(0) }).strict(),
]);
export type Valor = z.infer<typeof Valor>;

/** Un color: «@texto» (el del estilo de la marca), «$parametro» de tipo color o un hex. */
export const ColorReceta = z.union([z.literal('@texto'), z.string().regex(/^\$[a-zA-Z][a-zA-Z0-9]*$/), Hex]);
export type ColorReceta = z.infer<typeof ColorReceta>;

export const Parametro = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('numero'), min: z.number(), max: z.number(), defecto: z.number(), descripcion: z.string() }).strict(),
  z.object({ tipo: z.literal('booleano'), defecto: z.boolean(), descripcion: z.string() }).strict(),
  z.object({ tipo: z.literal('color'), defecto: Hex, descripcion: z.string() }).strict(),
]);
export type Parametro = z.infer<typeof Parametro>;

/** Entradas de un nodo de filtro: la letra pintada, su alfa o el resultado de un nodo anterior. */
const Entrada = z.string().regex(/^(origen|alfa|[a-z][a-zA-Z0-9]*)$/);
const comun = { resultado: z.string().regex(/^[a-z][a-zA-Z0-9]*$/).optional(), entrada: Entrada.optional(), si: z.string().optional() };

/** Los nodos de filtro permitidos (lista blanca). Medidas en alturas de mayúscula. */
export const NodoFiltro = z.discriminatedUnion('tipo', [
  z.object({ ...comun, tipo: z.literal('turbulencia'), ruido: z.enum(['fractal', 'turbulencia']).default('fractal'), frecuencia: z.union([Valor, z.tuple([Valor, Valor])]), octavas: z.int().min(1).max(5).default(2), semilla: z.int().min(0).max(99).default(0) }).strict(),
  z.object({ ...comun, tipo: z.literal('desplazar'), mapa: Entrada, escala: Valor }).strict(),
  z.object({ ...comun, tipo: z.literal('desenfocar'), radio: Valor }).strict(),
  /** alfa = a · canal + b (el canal: R del ruido o A de la letra). Sin «conservarColor», el color queda negro. */
  z.object({ ...comun, tipo: z.literal('alfa'), canal: z.enum(['R', 'A']), a: Valor, b: Valor, conservarColor: z.boolean().default(false) }).strict(),
  z.object({ ...comun, tipo: z.literal('dilatar'), radio: Valor }).strict(),
  z.object({ ...comun, tipo: z.literal('erosionar'), radio: Valor }).strict(),
  z.object({ ...comun, tipo: z.literal('inundar'), color: ColorReceta, opacidad: Valor.default(1) }).strict(),
  z.object({ ...comun, tipo: z.literal('componer'), con: Entrada, operador: z.enum(['dentro', 'fuera', 'encima', 'sobre', 'aritmetico']), k: z.tuple([Valor, Valor, Valor, Valor]).optional() }).strict(),
  z.object({ ...comun, tipo: z.literal('mover'), dx: Valor, dy: Valor }).strict(),
  z.object({ ...comun, tipo: z.literal('fundir'), entradas: z.array(Entrada).min(1).max(6) }).strict(),
  /** Brillo especular de una superficie con relieve (líquido espeso, barniz). La luz va en caps desde la esquina de la zona. */
  z.object({ ...comun, tipo: z.literal('brillo'), relieve: Valor, constante: Valor, exponente: Valor, luz: z.object({ x: z.number(), y: z.number(), z: z.number() }).strict() }).strict(),
]);
export type NodoFiltro = z.infer<typeof NodoFiltro>;

/** Formas que salen de cada letra (las gotas de la derretida). */
export const Emisor = z
  .object({
    id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
    forma: z.enum(['gota', 'circulo']),
    ancla: z.enum(['base']),
    /** Probabilidad de que una letra emita; «segunda», de que emita otra más (relativa a la probabilidad). */
    probabilidad: Valor,
    segunda: z.number().min(0).max(1).default(0),
    /** Ancho de la forma, en caps: [mínimo, máximo]. */
    ancho: z.tuple([z.number().min(0.01).max(0.5), z.number().min(0.01).max(0.5)]),
    /** Largo: mínimo + azar^curva × (máximo − mínimo), en caps. */
    largo: z.object({ min: z.number().min(0).max(2), max: Valor, curva: z.number().min(0.2).max(4).default(1) }).strict(),
    /** Cuánto se mete dentro de la letra para unirse a ella, en caps. */
    solape: z.number().min(0).max(0.5).default(0.18),
    /** No cae sobre la línea de debajo. */
    noInvadir: z.boolean().default(true),
  })
  .strict();
export type Emisor = z.infer<typeof Emisor>;

/** Variación por letra (los recortes de papel algo torcidos). Amplitudes: el valor va de −a a +a. */
export const VariacionLetras = z.object({ giro: Valor.default(0), desplazamientoY: Valor.default(0) }).strict();

/** Lo que se pinta: un árbol de grupos (cada uno con su filtro y su pintura) cuyas hojas son letras o emisores. */
export type Dibujo =
  | { grupo: Dibujo[]; filtro?: string; relleno?: ColorReceta; trazo?: { color: ColorReceta; grosor: Valor }; opacidad?: number; si?: string }
  | { letras: true; franja?: { desde: number; alto: number }; trazo?: { color: ColorReceta; grosor: Valor }; opacidad?: number; si?: string }
  | { emisor: string; si?: string };
export const Dibujo: z.ZodType<Dibujo> = z.lazy(() =>
  z.union([
    z.object({ grupo: z.array(Dibujo).min(1).max(8), filtro: z.string().optional(), relleno: ColorReceta.optional(), trazo: z.object({ color: ColorReceta, grosor: Valor }).strict().optional(), opacidad: z.number().min(0).max(1).optional(), si: z.string().optional() }).strict(),
    z.object({
      letras: z.literal(true),
      /** Solo una franja horizontal de cada línea: desde (caps por encima de la base) y alto (caps). */
      franja: z.object({ desde: z.number().min(0).max(2), alto: z.number().min(0.05).max(4) }).strict().optional(),
      trazo: z.object({ color: ColorReceta, grosor: Valor }).strict().optional(),
      opacidad: z.number().min(0).max(1).optional(),
      si: z.string().optional(),
    }).strict(),
    z.object({ emisor: z.string(), si: z.string().optional() }).strict(),
  ]),
);

/** La ficha: lo que usa el buscador para decidir si un estilo le va a una pieza. */
export const FichaTratamiento = z
  .object({
    materiales: z.array(z.string()).default([]),
    identidades: z.array(z.string()).default([]),
    evitar: z.array(z.string()).default([]),
    fuentes: z.object({ noAptas: z.array(z.string()).default([]), cuerpoMinimo: z.number().min(20).max(400).default(56) }).strict().default({ noAptas: [], cuerpoMinimo: 56 }),
    observaciones: z.array(z.string()).default([]),
  })
  .strict();

export const EstadoTratamiento = z.enum(['BORRADOR', 'PRUEBA', 'APROBADO', 'RETIRADO']);

export const Receta = z
  .object({
    esquema: z.literal('tipografia/receta@1'),
    id: IdLocal,
    nombre: z.string().min(1),
    version: z.int().positive(),
    estado: EstadoTratamiento,
    descripcion: z.string().min(1),
    origen: z.object({ autor: z.enum(['ESTUDIO', 'AGENTE']), fecha: z.string(), brief: z.string().optional(), derivaDe: z.string().optional(), aprobado: z.object({ por: z.string(), fecha: z.string() }).strict().optional() }).strict(),
    ficha: FichaTratamiento,
    parametros: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), Parametro).default({}),
    letras: VariacionLetras.optional(),
    emisores: z.array(Emisor).max(4).default([]),
    filtros: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/), z.array(NodoFiltro).min(1).max(24)).default({}),
    dibujo: Dibujo,
  })
  .strict();
export type Receta = z.infer<typeof Receta>;

/** Límites de tamaño de una receta: que ningún estilo tarde demasiado en pintarse. */
export const NODOS_MAXIMOS = 40;

/**
 * Comprobaciones que el esquema no puede hacer: que cada «$parametro» exista y sea del tipo que toca, que las
 * entradas de cada filtro existan antes de usarse, que los filtros y emisores citados existan y que el total de
 * nodos no se pase. Devuelve la lista de problemas (vacía si la receta es válida).
 */
export function problemasDeReceta(receta: Receta): string[] {
  const problemas: string[] = [];
  const parametro = (nombre: string, tipo: Parametro['tipo'], donde: string) => {
    const p = receta.parametros[nombre];
    if (!p) problemas.push(`${donde}: el parámetro «${nombre}» no está declarado.`);
    else if (p.tipo !== tipo) problemas.push(`${donde}: «${nombre}» es de tipo ${p.tipo} y aquí se usa como ${tipo}.`);
  };
  const valor = (v: Valor | undefined, donde: string) => {
    if (v === undefined || typeof v === 'number') return;
    parametro(typeof v === 'string' ? v.slice(1) : v.param, 'numero', donde);
  };
  const color = (c: ColorReceta | undefined, donde: string) => {
    if (c && c.startsWith('$')) parametro(c.slice(1), 'color', donde);
  };
  const condicion = (si: string | undefined, donde: string) => {
    if (si) parametro(si, 'booleano', donde);
  };

  for (const [nombre, p] of Object.entries(receta.parametros)) {
    if (p.tipo === 'numero' && (p.min > p.max || p.defecto < p.min || p.defecto > p.max)) problemas.push(`Parámetro «${nombre}»: el valor por defecto tiene que estar entre el mínimo y el máximo.`);
  }
  let total = 0;
  for (const [id, nodos] of Object.entries(receta.filtros)) {
    const disponibles = new Set(['origen', 'alfa']);
    total += nodos.length;
    nodos.forEach((nodo, i) => {
      const donde = `Filtro «${id}», nodo ${i + 1} (${nodo.tipo})`;
      const usa = (e: string | undefined) => {
        if (e && !disponibles.has(e)) problemas.push(`${donde}: usa «${e}», que no existe todavía (las entradas son origen, alfa o el resultado de un nodo anterior).`);
      };
      usa(nodo.entrada);
      if (nodo.tipo === 'desplazar') usa(nodo.mapa);
      if (nodo.tipo === 'componer') usa(nodo.con);
      if (nodo.tipo === 'fundir') nodo.entradas.forEach(usa);
      condicion(nodo.si, donde);
      for (const [clave, v] of Object.entries(nodo)) {
        if (['tipo', 'resultado', 'entrada', 'si', 'mapa', 'con', 'entradas', 'ruido', 'octavas', 'semilla', 'canal', 'conservarColor', 'operador', 'luz'].includes(clave)) continue;
        if (clave === 'color') color(v as ColorReceta, donde);
        else if (clave === 'frecuencia' && Array.isArray(v)) (v as Valor[]).forEach((x) => valor(x, donde));
        else if (clave === 'k') (v as Valor[]).forEach((x) => valor(x, donde));
        else valor(v as Valor, donde);
      }
      if (nodo.resultado) disponibles.add(nodo.resultado);
    });
  }
  if (total > NODOS_MAXIMOS) problemas.push(`La receta tiene ${total} nodos de filtro; el máximo es ${NODOS_MAXIMOS}.`);
  for (const e of receta.emisores) {
    valor(e.probabilidad, `Emisor «${e.id}»`);
    valor(e.largo.max, `Emisor «${e.id}»`);
    if (e.ancho[0] > e.ancho[1]) problemas.push(`Emisor «${e.id}»: el ancho mínimo es mayor que el máximo.`);
  }
  if (receta.letras) {
    valor(receta.letras.giro, 'Variación de letras');
    valor(receta.letras.desplazamientoY, 'Variación de letras');
  }
  const recorrer = (d: Dibujo, donde: string) => {
    condicion(d.si, donde);
    if ('grupo' in d) {
      if (d.filtro && !receta.filtros[d.filtro]) problemas.push(`${donde}: usa el filtro «${d.filtro}», que no está en «filtros».`);
      color(d.relleno, donde);
      if (d.trazo) {
        color(d.trazo.color, donde);
        valor(d.trazo.grosor, donde);
      }
      d.grupo.forEach((h, i) => recorrer(h, `${donde} › ${i + 1}`));
    } else if ('letras' in d) {
      if (d.trazo) {
        color(d.trazo.color, donde);
        valor(d.trazo.grosor, donde);
      }
    } else if (!receta.emisores.some((e) => e.id === d.emisor)) problemas.push(`${donde}: usa el emisor «${d.emisor}», que no está en «emisores».`);
  };
  recorrer(receta.dibujo, 'Dibujo');
  return problemas;
}

/** Valores de los parámetros para una pieza: los pedidos (comprobados) y, si no, los de por defecto. */
export function valoresDeParametros(receta: Receta, pedidos: Record<string, number | boolean | string>): { valores: Record<string, number | boolean | string>; problemas: string[] } {
  const valores: Record<string, number | boolean | string> = {};
  const problemas: string[] = [];
  for (const nombre of Object.keys(pedidos)) if (!receta.parametros[nombre]) problemas.push(`El estilo «${receta.id}» no tiene el parámetro «${nombre}» (tiene: ${Object.keys(receta.parametros).join(', ') || 'ninguno'}).`);
  for (const [nombre, p] of Object.entries(receta.parametros)) {
    const pedido = pedidos[nombre];
    if (pedido === undefined) {
      valores[nombre] = p.defecto;
      continue;
    }
    if (p.tipo === 'numero') {
      if (typeof pedido !== 'number' || pedido < p.min || pedido > p.max) problemas.push(`«${nombre}» va de ${p.min} a ${p.max}; se pidió ${String(pedido)}.`);
      else valores[nombre] = pedido;
    } else if (p.tipo === 'booleano') {
      if (typeof pedido !== 'boolean') problemas.push(`«${nombre}» es sí o no (true/false); se pidió ${String(pedido)}.`);
      else valores[nombre] = pedido;
    } else if (typeof pedido !== 'string') problemas.push(`«${nombre}» es un color; se pidió ${String(pedido)}.`);
    else valores[nombre] = pedido;
  }
  return { valores, problemas };
}
