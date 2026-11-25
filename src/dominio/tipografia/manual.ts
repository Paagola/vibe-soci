/**
 * Manual del lenguaje de recetas (tipografia/receta@1) para el agente que crea estilos (Fase C).
 *
 * Es lo que lee el diseñador antes de escribir una receta: las piezas, sus unidades, las reglas y, como ejemplos, las
 * recetas aprobadas de la biblioteca. No se desincroniza del esquema (receta.ts):
 * - `PIEZAS_DE_FILTRO` es un registro con una entrada por cada nodo de la lista blanca: TypeScript obliga a que estén
 *   todos y a que no haya ninguno de más;
 * - test/manual-recetas.test.ts comprueba que el texto del manual cita exactamente los nodos, formas y anclas del esquema.
 */
import type { Emisor, NodoFiltro, Receta } from './receta.js';
import { NODOS_MAXIMOS } from './receta.js';

type TipoDeNodo = NodoFiltro['tipo'];

/** Un nodo de filtro: sus campos propios (además de entrada, resultado y si) y para qué sirve. */
export const PIEZAS_DE_FILTRO: Record<TipoDeNodo, { campos: string; para: string }> = {
  turbulencia: {
    campos: 'ruido ("fractal" | "turbulencia", por defecto fractal), frecuencia (ciclos por cap: un número o [x, y]), octavas (1–5), semilla (0–99)',
    para: 'Genera ruido (no usa entrada). Frecuencia baja (2–4) = manchas grandes; alta (30–60) = grano fino. "turbulencia" da vetas más marcadas. Sus canales R y G sirven de mapa para «desplazar» y su R para «alfa».',
  },
  desplazar: {
    campos: 'mapa (el resultado de una turbulencia), escala (caps)',
    para: 'Mueve cada píxel de la entrada según el mapa: cantos irregulares, rasgados o quemados. Escala 0,01–0,02 = canto vivo; 0,05 = rasgado; más de 0,08 rompe la letra.',
  },
  desenfocar: {
    campos: 'radio (caps)',
    para: 'Desenfoque gaussiano: halos, sombras suaves, relieve para «brillo» y el paso previo de un efecto «goo» (desenfocar y luego «alfa» con a alto).',
  },
  alfa: {
    campos: 'canal ("R" del ruido o "A" de la letra), a, b, conservarColor (por defecto false: el color queda negro)',
    para: 'Opacidad = a · canal + b. Con el canal R de un ruido convierte el ruido en máscara (a alto = bordes duros, b decide cuánto se cubre). Con el canal A y a alto (20–30) endurece un desenfoque: une formas (goo). Con a < 1 hace transparente (sombras).',
  },
  dilatar: {
    campos: 'radio (caps)',
    para: 'Engorda la forma. Para un canto o un alma que asoma alrededor de la letra (0,01–0,03). Más de 0,06 funde las letras entre sí.',
  },
  erosionar: {
    campos: 'radio (caps)',
    para: 'Adelgaza la forma: el núcleo de la letra (para meter grietas o vetas solo dentro). Más de 0,04 se come los trazos finos.',
  },
  inundar: {
    campos: 'color ("@texto", "$parametro" de tipo color o "#RRGGBB"), opacidad',
    para: 'Llena toda la zona del filtro de un color. Siempre se recorta después con «componer» (operador "dentro") contra una forma.',
  },
  componer: {
    campos: 'con (la segunda entrada), operador ("dentro", "fuera", "encima", "sobre", "aritmetico"), k ([k1, k2, k3, k4], solo con aritmetico)',
    para: 'Combina dos imágenes: "dentro" = la entrada recortada por la forma de «con»; "fuera" = la entrada menos la forma de «con» (agujeros, motas); "encima" = la entrada pintada sobre «con» solo donde hay «con»; "sobre" = la entrada sobre «con»; "aritmetico" = k1·a·b + k2·a + k3·b + k4 (para sumar luz).',
  },
  mover: {
    campos: 'dx, dy (caps)',
    para: 'Desplaza la entrada: sombras (0,02–0,06 abajo a la derecha).',
  },
  fundir: {
    campos: 'entradas (de 1 a 6; la primera queda debajo)',
    para: 'Apila capas: sombra, cuerpo, detalles y luces, en ese orden.',
  },
  brillo: {
    campos: 'relieve (caps), constante, exponente, luz ({x, y, z} en caps desde la esquina de la zona del filtro)',
    para: 'Brillo especular de una superficie con relieve (líquido espeso, barniz, caramelo): la entrada es un alfa desenfocado. Sin brillo, un líquido parece pintura.',
  },
};

const FORMAS: Record<Emisor['forma'], string> = {
  gota: 'una gota que cuelga (cuerpo que se estrecha y remate redondo)',
  circulo: 'un círculo (salpicaduras, burbujas, chispas)',
};
const ANCLAS: Record<Emisor['ancla'], string> = {
  base: 'nace en la base de cada letra',
};

/** El manual entero, en Markdown. */
export function manualDelLenguaje(): string {
  const nodos = (Object.entries(PIEZAS_DE_FILTRO) as Array<[TipoDeNodo, { campos: string; para: string }]>).map(([tipo, p]) => `- \`${tipo}\`: ${p.campos}. ${p.para}`).join('\n');
  const formas = (Object.entries(FORMAS) as Array<[string, string]>).map(([f, d]) => `\`${f}\` (${d})`).join(', ');
  const anclas = (Object.entries(ANCLAS) as Array<[string, string]>).map(([a, d]) => `\`${a}\` (${d})`).join(', ');
  return `# Lenguaje de recetas de tipografía especial (tipografia/receta@1)

Una receta describe un estilo de letra como un MATERIAL (algo que se derrite, un recorte de papel, un tipo de imprenta gastado, un tubo de neón) con piezas de una lista blanca. El compositor la pinta sobre los contornos reales de la fuente: el texto siempre sale bien escrito. Tú no escribes código ni SVG: solo JSON con estas piezas.

## Unidades
Todas las medidas van en **alturas de mayúscula (cap)**: 0,05 = un 5 % de la altura de una mayúscula. Así el estilo sale igual a cualquier cuerpo. Las frecuencias de ruido van en ciclos por cap. Los giros, en grados.

## Valores, parámetros y colores
- Un número puede ser literal (0.04), un parámetro ("$largo") o derivado de un parámetro ({"param": "desgaste", "por": 0.7, "mas": -3.6}).
- \`parametros\`: los mandos que una pieza puede ajustar. Tipos: {"tipo": "numero", "min", "max", "defecto", "descripcion"}, {"tipo": "booleano", "defecto", "descripcion"} (se usa en "si": el nodo o la capa solo actúa si es true) y {"tipo": "color", "defecto": "#RRGGBB", "descripcion"}. Todo parámetro citado tiene que estar declarado y ser del tipo que toca; el defecto, dentro de su rango.
- Colores: "@texto" (el color del estilo del local: úsalo para el cuerpo de la letra), "$parametro" de tipo color o "#RRGGBB".

## Nodos de filtro
Un filtro es una lista de nodos que se ejecutan en orden. Cada nodo puede llevar \`entrada\` ("origen" = la letra pintada con su relleno, "alfa" = solo su forma, o el \`resultado\` de un nodo anterior del mismo filtro), \`resultado\` (un nombre para usarlo después) y \`si\` (un parámetro booleano). El último nodo es la salida del filtro. La zona del filtro es la caja de las letras más 1 cap a los lados y arriba y 2 caps abajo: lo que caiga fuera no se ve.
${nodos}

## Emisores
Formas que salen de cada letra: \`emisores\`: [{"id", "forma", "ancla", "probabilidad", "segunda", "ancho": [min, max], "largo": {"min", "max", "curva"}, "solape", "noInvadir"}].
- Formas: ${formas}. Anclas: ${anclas}.
- probabilidad: de que una letra emita (0–1, puede ser "$parametro"); segunda: de que emita otra más.
- ancho en caps (0,01–0,5); largo: mínimo + azar^curva × (máximo − mínimo), en caps (curva > 1 = casi todas cortas y alguna larga).
- solape: cuánto se mete dentro de la letra para unirse a ella; noInvadir: no cae sobre la línea de debajo.
- Como mucho 4 emisores. Se pintan poniendo {"emisor": "<id>"} en el dibujo.

## Variación de letras
\`letras\`: {"giro": grados, "desplazamientoY": caps}: cada letra se gira y se sube o baja al azar entre −valor y +valor (recortes pegados a mano). Pequeño: 2–4 grados, 0,02–0,04 caps.

## Dibujo
\`dibujo\` es un árbol que se pinta de abajo arriba:
- {"grupo": [hijos], "filtro": "<id de filtros>", "relleno": color, "trazo": {"color", "grosor" (caps)}, "opacidad": 0–1, "si"}: como mucho 8 hijos; el filtro se aplica al grupo entero.
- {"letras": true, "franja": {"desde", "alto"} (solo una franja horizontal de cada línea, en caps desde la base), "trazo", "opacidad", "si"}: las letras.
- {"emisor": "<id>", "si"}: las formas de un emisor.
Lo habitual: {"grupo": [{"letras": true}], "filtro": "<id>", "relleno": "@texto"}.

## Reglas (se comprueban en código; si fallan, la receta vuelve con el error)
1. Solo estas piezas: cualquier otro campo o nodo se rechaza. No hay código, ni enlaces (href), ni imágenes, ni fuentes externas, ni texto SVG.
2. Como mucho ${NODOS_MAXIMOS} nodos de filtro en total y 24 por filtro. Cada entrada tiene que existir antes de usarse.
3. Los ids (de la receta, filtros, resultados y emisores) en minúsculas y sin espacios.
4. Tú no decides el estado, el id, la versión ni el origen: los pone el estudio (un estilo nuevo siempre entra «en prueba» y solo lo aprueba una persona).
5. La ficha (materiales, identidades, evitar, fuentes no aptas con sus clasificaciones: "alto-contraste", "script"…, y cuerpo mínimo) es lo que usa el buscador: dila con honestidad.

## Cómo se verifica (lo que tiene que pasar tu receta)
Se pinta una hoja de muestras: la palabra del encargo y «Jamón y Queso», en la fuente de la marca, una grotesca y una serif, sobre fondo oscuro (letra clara) y fondo claro (letra oscura).
- Un OCR tiene que leer el texto: en todos los paneles de la fuente de la marca y en la mayoría del resto (se perdona una letra de cada 8).
- Conservación: tiene que verse al menos el 60 % de la letra limpia. Si fijas el color del cuerpo (p. ej. carbón oscuro), sobre fondo oscuro desaparece: el cuerpo, con "@texto".
- Relleno: la tinta sólida fuera de la letra no puede pasar del 65 % de su área (nada de letras fundidas en manchas).
- Cada panel se pinta en menos de 2 s (los filtros grandes y las turbulencias de muchas octavas cuestan) y siempre igual.
- Después lo mira un crítico con el brief: ¿parece el material pedido o pintura?, ¿parece plantilla o IA barata?

## Oficio (de la hoja de muestras del 19/11)
- Imita el material, no un efecto de programa: nada de biseles, degradados genéricos ni brillos de plástico.
- Sutil se lee mejor: la antigua gusta porque se lee como impreso, no como roto.
- El material tiene que ser del plato o del local (gotas de oro sobre sushi quedaban raras).
- La tiza se descartó: tras cuatro intentos seguía pareciendo erosión o ruido de televisor. Si un material no sale, dilo.
`;
}

/** Las recetas aprobadas de la biblioteca, como ejemplos para el agente (JSON compacto). */
export function ejemplosDelManual(recetas: Receta[]): string {
  const aprobadas = recetas.filter((r) => r.estado === 'APROBADO');
  return aprobadas.map((r) => `### Ejemplo aprobado: ${r.nombre} (${r.id})\n${JSON.stringify(r)}`).join('\n\n');
}
