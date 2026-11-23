/**
 * Rasgos del local y materiales del plato, deterministas (Fase B del buscador de tipografía especial,
 * diseno/tipografia-especial/SISTEMA.md §3). Salen de un diccionario explícito y comentado, no de un modelo: la misma
 * marca da siempre los mismos rasgos y cada uno dice de qué palabra salió, para que el dueño pueda confirmarlos o
 * corregirlos. El mismo diccionario sirve para leer las fichas de las recetas (identidades, materiales y «evitar»),
 * así que el vocabulario de una ficha y el de un local casan por construcción.
 *
 * Cómo se busca: el texto se parte en palabras y se normaliza (minúsculas, sin acentos). Una entrada del diccionario es
 * una palabra o una frase; la última palabra vale como prefijo («churr» encuentra «churros» y «churrería»), salvo que
 * acabe en «$», que entonces tiene que ser la palabra entera («te$» no encuentra «tenemos»).
 */
import type { ElementoComparable } from '../inventario.js';
import { normalizarTexto } from '../inventario.js';
import type { PerfilDeMarca } from '../marca/perfil.js';

/** Un rasgo o un material encontrado: cuál, en qué palabra del texto y en qué campo estaba. */
export interface Hallazgo {
  id: string;
  /** Las palabras del texto original que lo dieron («Churrería», «a la brasa»). */
  palabra: string;
  /** El campo de donde salió: «nombre», «descripción», «tonos», «perfil», «slug», «plato», «inventario», «referencia». */
  origen: string;
}

export interface Rasgo extends Hallazgo {
  /** Sale solo del nombre o del slug: cuenta para puntuar, pero no basta para descartar un estilo (un «Mesón» de cócteles). */
  debil: boolean;
}

export interface Material extends Hallazgo {
  /** Del plato (se come o se bebe) o del entorno (papel, madera, luz). */
  comestible: boolean;
}

interface Entrada {
  id: string;
  palabras: string[];
  /** Por qué esas palabras dan ese rasgo (para quien mantenga el diccionario). */
  porque: string;
}

/**
 * Rasgos de identidad de un local. Los ids son los que usan las fichas de las recetas («tradicional», «nocturno»…);
 * en una ficha también vale cualquiera de las palabras («mesón» y «taberna» son «tradicional»).
 */
export const RASGOS: readonly Entrada[] = [
  { id: 'asador', palabras: ['asador', 'parrill', 'brasa', 'a la brasa', 'lena$', 'fuego', 'carbon', 'horno de lena'], porque: 'el fuego es lo que define la casa' },
  { id: 'tradicional', palabras: ['meson', 'taberna', 'tasca', 'de siempre', 'tradicional', 'de toda la vida', 'castiz', 'desde 18', 'desde 19', 'fundad', 'solera'], porque: 'casa de siempre: mesón, taberna, años de historia' },
  { id: 'cafetería', palabras: ['cafe$', 'cafes$', 'cafeteria', 'brunch', 'desayuno', 'merienda'], porque: 'se va a tomar café o a desayunar' },
  { id: 'urbano', palabras: ['burger', 'hamburgues', 'street', 'urbano', 'callejer', 'smash'], porque: 'comida de calle, hamburguesería' },
  { id: 'nocturno', palabras: ['coctel', 'copas$', 'bar de copas', 'noche', 'nocturn', 'neon$', 'night'], porque: 'se va de noche o a tomar copas' },
  { id: 'japonés', palabras: ['sushi', 'japon', 'nikkei', 'ramen', 'izakaya', 'sashimi', 'nigiri', 'temaki'], porque: 'cocina japonesa' },
  { id: 'goloso', palabras: ['churr', 'chocolateria', 'pasteleria', 'heladeria', 'reposteria', 'goloso', 'golosa', 'dulces$', 'gofre'], porque: 'se va a por algo dulce' },
  { id: 'playa', palabras: ['playa', 'chiringuito', 'beach', 'mar$', 'arena$'], porque: 'junto al mar' },
  { id: 'marinero', palabras: ['marinero', 'marinera', 'marisqueria', 'puerto', 'lonja'], porque: 'casa de pescado y puerto' },
  { id: 'familiar', palabras: ['familia', 'familiar'], porque: 'se come en familia' },
  { id: 'artesanal', palabras: ['artesan', 'casero', 'casera', 'hecho a mano', 'hechos a mano', 'obrador'], porque: 'se hace a mano' },
  { id: 'desenfadado', palabras: ['desenfadad', 'canalla', 'animado', 'animada', 'informal', 'gamberr'], porque: 'tono suelto, sin ceremonia' },
  { id: 'sobrio', palabras: ['sobrio', 'sobria', 'sin artificios', 'minimal', 'austero', 'austera'], porque: 'pide contención' },
  { id: 'de autor', palabras: ['de autor', 'degustacion', 'alta cocina', 'vanguardia', 'estrella michelin'], porque: 'cocina de autor: la letra no debe hacer de payaso' },
  { id: 'elegante', palabras: ['elegante', 'atemporal', 'refinad', 'sofisticad'], porque: 'elegancia declarada' },
  { id: 'moderno', palabras: ['moderno', 'moderna', 'contemporane', 'diseno limpio', 'de diseno'], porque: 'estética actual y limpia' },
  { id: 'vino', palabras: ['vino', 'vinos$', 'bodega', 'enoteca'], porque: 'casa de vinos' },
];

/**
 * Materiales. Los comestibles son del plato (lo que se come o se bebe); los demás, del entorno (el papel del envoltorio,
 * la madera de la barra, la luz de un rótulo). Una misma palabra puede dar dos («espeto»: pescado y brasa).
 */
export const MATERIALES: ReadonlyArray<Entrada & { comestible: boolean }> = [
  { id: 'queso', comestible: true, palabras: ['queso', 'cheddar', 'mozzarella', 'parmesano', 'burrata', 'raclette', 'provolone'], porque: 'se funde' },
  { id: 'chocolate', comestible: true, palabras: ['chocolate', 'cacao', 'brownie', 'nutella'], porque: 'se funde y gotea' },
  { id: 'caramelo', comestible: true, palabras: ['caramel', 'dulce de leche', 'toffee', 'tofe$'], porque: 'líquido espeso' },
  { id: 'salsa', comestible: true, palabras: ['salsa', 'ketchup', 'mayonesa', 'alioli', 'bbq$', 'barbacoa', 'mostaza'], porque: 'líquido espeso' },
  { id: 'miel', comestible: true, palabras: ['miel$', 'mieles$'], porque: 'líquido espeso' },
  { id: 'glaseado', comestible: true, palabras: ['glasead', 'glase$', 'donut', 'cobertura'], porque: 'cubre y gotea' },
  { id: 'helado', comestible: true, palabras: ['helado', 'gelato', 'sorbete', 'granizad'], porque: 'se derrite' },
  { id: 'café', comestible: true, palabras: ['cafe$', 'cafes$', 'espresso', 'capuchino', 'cortado$', 'te$', 'infusion', 'matcha'], porque: 'bebida que no espesa' },
  { id: 'cóctel', comestible: true, palabras: ['coctel', 'mojito', 'gin tonic', 'vermu', 'spritz', 'margarita$'], porque: 'bebida de barra' },
  { id: 'masa', comestible: true, palabras: ['masa$', 'masas$', 'churr', 'reposteria', 'cruasan', 'croissant', 'hojaldre', 'bolleria', 'empanada'], porque: 'masa horneada o frita' },
  { id: 'pan', comestible: true, palabras: ['pan$', 'panes$', 'montadito', 'tostada', 'bocadillo', 'mollete', 'pitufo'], porque: 'pan' },
  { id: 'pescado', comestible: true, palabras: ['pescado', 'pulpo', 'marisco', 'gamba', 'langostino', 'sardina', 'espeto', 'sushi', 'sashimi', 'nigiri', 'atun$', 'salmon', 'merluza', 'calamar', 'boqueron', 'chipiron'], porque: 'del mar: no se funde' },
  { id: 'ensalada', comestible: true, palabras: ['ensalada', 'verduras$', 'crudites'], porque: 'fresco: no se funde' },
  { id: 'brasa', comestible: true, palabras: ['brasa', 'parrilla', 'lena$', 'carbon', 'espeto', 'ahumad', 'asado$', 'asada$'], porque: 'cocinado al fuego' },
  { id: 'carne', comestible: true, palabras: ['carne', 'chuleton', 'entrecot', 'solomillo', 'costilla', 'secreto iberico', 'embutido'], porque: 'carne' },
  { id: 'papel', comestible: false, palabras: ['papel', 'carton', 'kraft', 'envoltorio'], porque: 'papel o cartón' },
  { id: 'madera', comestible: false, palabras: ['madera', 'barrica'], porque: 'madera' },
  { id: 'tinta', comestible: false, palabras: ['tinta$', 'imprenta', 'letterpress'], porque: 'tinta de imprenta' },
  { id: 'hierro', comestible: false, palabras: ['hierro', 'forja'], porque: 'hierro forjado' },
  { id: 'luz', comestible: false, palabras: ['luz$', 'neon$', 'luminos'], porque: 'luz de un rótulo' },
];

/**
 * Rasgos de una fuente que nombran las fichas en «evitar» («fuentes muy gruesas o extendidas»). Se deducen de la
 * clasificación del catálogo y de los ejes con que la usa la marca (ver rasgosDeFuente en consulta.ts).
 */
export const RASGOS_DE_FUENTE: readonly Entrada[] = [
  { id: 'alto-contraste', palabras: ['alto contraste', 'alto-contraste'], porque: 'trazos finos que se rompen' },
  { id: 'gruesa', palabras: ['grues', 'pesad', 'muy negra'], porque: 'trazo muy grueso' },
  { id: 'extendida', palabras: ['extendid', 'expandid'], porque: 'letra ancha' },
  { id: 'fina', palabras: ['trazo muy fino', 'trazo fino', 'finas$', 'fina$'], porque: 'trazo fino' },
];

/** El fondo sobre el que irá el texto, tal como lo nombran las fichas («fondos claros»). */
export const FONDOS: readonly Entrada[] = [
  { id: 'claro', palabras: ['claro', 'claros$', 'blanco', 'blancos$'], porque: 'fondo claro' },
  { id: 'oscuro', palabras: ['oscuro', 'oscuros$', 'negro', 'negros$'], porque: 'fondo oscuro' },
];

type Palabra = { original: string; normal: string };

/** Las palabras de un texto, con su forma original y la normalizada. */
function palabrasDe(texto: string): Palabra[] {
  return (texto.match(/[\p{L}\p{N}]+/gu) ?? []).map((original) => ({ original, normal: normalizarTexto(original) }));
}

/** ¿Empieza aquí la frase del diccionario? Todas las palabras exactas menos la última, que vale como prefijo (sin «$»). */
function encaja(palabras: Palabra[], i: number, frase: string): number {
  const entera = frase.endsWith('$');
  const partes = (entera ? frase.slice(0, -1) : frase).split(' ');
  if (i + partes.length > palabras.length) return 0;
  for (let j = 0; j < partes.length; j++) {
    const p = palabras[i + j]!.normal;
    const ultima = j === partes.length - 1;
    if (ultima && !entera ? !p.startsWith(partes[j]!) : p !== partes[j]) return 0;
  }
  return partes.length;
}

/** Todo lo que un diccionario encuentra en un texto, en orden de aparición y sin repetir id. */
export function buscarEn<E extends Entrada>(diccionario: readonly E[], texto: string, origen: string): Array<Hallazgo & { entrada: E }> {
  const palabras = palabrasDe(texto);
  const hallados: Array<Hallazgo & { entrada: E }> = [];
  for (let i = 0; i < palabras.length; i++) {
    for (const entrada of diccionario) {
      if (hallados.some((h) => h.id === entrada.id)) continue;
      for (const frase of entrada.palabras) {
        const n = encaja(palabras, i, frase);
        if (n) {
          hallados.push({ id: entrada.id, palabra: palabras.slice(i, i + n).map((p) => p.original).join(' '), origen, entrada });
          break;
        }
      }
    }
  }
  return hallados;
}

/** Lo que se sabe del local para sacar sus rasgos: su marca.json y, si lo hay, su perfil. */
export interface DatosDelLocal {
  slug: string;
  marca?: { nombre?: string; descripcion?: string; tonos?: string[] };
  perfil?: PerfilDeMarca;
}

/**
 * Rasgos y materiales del local. Por orden: nombre, descripción, tonos y perfil (concepto, personalidad, voz y
 * recursos). Sin marca.json ni perfil, solo queda el slug («chiringuito-prueba» → playa), y así se dice.
 * Si un rasgo sale de varios campos, se queda el primero declarado (descripción, tonos o perfil) antes que el nombre.
 */
export function rasgosDelLocal(datos: DatosDelLocal): { rasgos: Rasgo[]; materiales: Material[] } {
  const campos: Array<[string, string]> = [];
  if (datos.marca?.nombre) campos.push(['nombre', datos.marca.nombre]);
  if (datos.marca?.descripcion) campos.push(['descripción', datos.marca.descripcion]);
  for (const tono of datos.marca?.tonos ?? []) campos.push(['tonos', tono]);
  const p = datos.perfil;
  if (p?.constantes.concepto) campos.push(['perfil (concepto)', p.constantes.concepto.valor]);
  for (const v of p?.constantes.personalidad?.valor ?? []) campos.push(['perfil (personalidad)', v]);
  for (const v of p?.constantes.voz?.valor ?? []) campos.push(['perfil (voz)', v]);
  for (const v of p?.variables.recursos?.valor ?? []) campos.push(['perfil (recursos)', v]);
  if (campos.length === 0) campos.push(['slug', datos.slug.replace(/-/g, ' ')]);

  const rasgos: Rasgo[] = [];
  const materiales: Material[] = [];
  for (const [origen, texto] of campos) {
    const debil = origen === 'nombre' || origen === 'slug';
    for (const h of buscarEn(RASGOS, texto, origen)) {
      const previo = rasgos.findIndex((r) => r.id === h.id);
      const nuevo: Rasgo = { id: h.id, palabra: h.palabra, origen, debil };
      if (previo === -1) rasgos.push(nuevo);
      else if (rasgos[previo]!.debil && !debil) rasgos[previo] = nuevo;
    }
    for (const h of buscarEn(MATERIALES, texto, origen)) {
      if (!materiales.some((m) => m.id === h.id)) materiales.push({ id: h.id, palabra: h.palabra, origen, comestible: h.entrada.comestible });
    }
  }
  return { rasgos, materiales };
}

/** Materiales del plato: de su texto («churros con chocolate») y, si los hay, de los elementos del inventario. */
export function materialesDelPlato(plato: { texto?: string; elementos?: readonly ElementoComparable[] }): Material[] {
  const materiales: Material[] = [];
  const anadir = (texto: string, origen: string) => {
    for (const h of buscarEn(MATERIALES, texto, origen)) {
      if (!materiales.some((m) => m.id === h.id)) materiales.push({ id: h.id, palabra: h.palabra, origen, comestible: h.entrada.comestible });
    }
  };
  if (plato.texto) anadir(plato.texto, 'plato');
  for (const e of plato.elementos ?? []) anadir(`${e.nombre} ${e.estado}`, 'inventario');
  return materiales;
}

/** El rasgo al que corresponde un término de una ficha («mesón» → tradicional), o undefined si el diccionario no lo conoce. */
export function rasgoDeTermino(termino: string): string | undefined {
  return idDeTermino(RASGOS, termino);
}

/** El material al que corresponde un término de una ficha («neón» → luz). */
export function materialDeTermino(termino: string): string | undefined {
  return idDeTermino(MATERIALES, termino);
}

function idDeTermino(diccionario: readonly Entrada[], termino: string): string | undefined {
  const normal = normalizarTexto(termino);
  const exacto = diccionario.find((e) => normalizarTexto(e.id) === normal);
  if (exacto) return exacto.id;
  return buscarEn(diccionario, termino, 'ficha')[0]?.id;
}
