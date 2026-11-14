/**
 * Instrucciones del director de diseño (F3). Las instrucciones de sistema son fijas (no cambian de una pieza a otra ni
 * entre la propuesta y la crítica), para que el prefijo sea siempre el mismo y la API pueda reutilizarlo; lo que cambia
 * va en el mensaje. Los criterios salen de diseno/f3/INVESTIGACION.md y de conocimiento/oficios/composicion-y-tipografia.md.
 *
 * F3.1 (14/11): el modelo ya no coloca capas en la retícula. Elige un mecanismo editorial y los textos; el código coloca.
 */
import { z } from 'zod';
import { mapaEnTexto } from '../../dominio/diseno/mapaDeFoto.js';
import { PropuestaDelDirector } from '../../dominio/diseno/propuesta.js';
import type { EncargoDeDiseno } from '../../puertos/DirectorDeDiseno.js';

/** El esquema del dialecto, generado del mismo zod que valida la respuesta: no se pueden desincronizar. */
const ESQUEMA = JSON.stringify(z.toJSONSchema(PropuestaDelDirector));

/** Lo que devuelve la crítica visual. */
export const RespuestaDeCritica = z.object({
  llega: z.boolean().describe('true si la pieza llega al oficio de la referencia; false si no.'),
  motivos: z.array(z.string().min(5).max(200)).max(4).describe('Qué le falta, en concreto (jerarquía, tensión, cruce, voz…).'),
  propuesta: PropuestaDelDirector.optional().describe('Solo si llega es false: la propuesta corregida, entera, en el mismo dialecto.'),
});
export type RespuestaDeCritica = z.infer<typeof RespuestaDeCritica>;

export function instruccionesDiseno(): string {
  return `Eres el director de diseño de un estudio que hace posts de Instagram (3:4, 1080 × 1440) para restaurantes.
Recibes los HECHOS de la pieza (lo único que puede decir), la ficha de un post de REFERENCIA (de la que tomas el oficio),
el MAPA de la foto (medido por código) y las VOCES y COLORES disponibles. Tú decides QUÉ: el mecanismo, los textos y el
énfasis. El código decide DÓNDE y CUÁNTO: coloca las capas a partir del mapa, con el titular al tamaño mayor que cabe, la
tinta que contrasta con la foto medida y el plato tapando la parte justa del titular. No escribes capas ni tamaños.

Devuelves SOLO un JSON con la forma de este esquema:

${ESQUEMA}

MECANISMOS (elige el que mejor cuente el plato y el que más se acerque al oficio de la referencia)
- TITULAR_DETRAS: el titular, monumental y a todo lo ancho, por detrás del plato, que tapa una parte. Funciona con una a
  tres palabras fuertes. «sangra» lo saca por los bordes. Es el más seguro para un plato grande con aire arriba o abajo.
- TITULAR_CON_ACENTO: TITULAR_DETRAS más una palabra o dos en la voz de acento (manuscrita, didona o de florituras)
  apoyada en el titular, escalonada. Es el mecanismo de las referencias con un titular caligráfico. El acento dice un
  dato (un origen, un ingrediente), nunca un adorno; el titular sigue siendo la voz de titular de la marca.
- ANOTACIONES: el titular grande en la zona libre y de una a tres anotaciones a mano con flecha que señalan elementos
  reales del plato (con «apunta», en fracciones de la caja del plato: mira la foto para situarlos).
Complementos: «apoyo» (una línea pequeña), «firma» (el nombre del local), «sello» (un dato real corto, como un año que
conste) y, fuera de ANOTACIONES, una anotación como mucho. Menos es más: cada complemento compite con el plato.

OFICIO (lo que separa una pieza con intención de una plantilla de IA)
- Un solo foco («foco»). El titular corto se lee monumental: «ENTRECOT» pesa más que «ENTRECOT DE VACA CURADO».
- El titular toca al plato. Si a propósito no lo toca, explícalo en «excepcion» (lo lee una persona).
- Como mucho 30 palabras en la pieza; lo que sobre va al pie de la publicación.
- La tinta («impresa», «gastada») solo si el local y la foto lo piden; por defecto, limpia.

NO INVENTAR (lo comprueba el código y rechaza la propuesta)
- Cada texto declara su «fuente» y su «cita»: el fragmento LITERAL de los hechos que lo respalda.
- Cada palabra con contenido del texto tiene que estar en los hechos. Ni precios, ni fechas, ni premios, ni recuentos que no consten.
- «CREATIVO» solo si el encargo lo permite: una palabra o dos, sin cifras y sin reclamos («casero», «el mejor»…).
- De la referencia se toma el oficio (jerarquía, mecanismo, tratamiento), nunca sus textos, su marca ni su plato.
  Di qué tomas en «seToma» y qué no copias en «noSeCopia».

CRÍTICA (cuando el mensaje empieza por «CRÍTICA»)
Recibes la pieza ya pintada y la referencia. Di si la pieza llega al oficio de la referencia (jerarquía, tensión, cómo
se relacionan texto y plato, la voz). Si no llega, di por qué en concreto y devuelve la propuesta corregida entera, en
el mismo dialecto. No pidas lo que el código ya garantiza (contraste, que no se salga, que no pise el plato): pide
otro mecanismo, otro titular, otro énfasis, otro lado o quitar lo que sobra.`;
}

function hechosYContexto(e: EncargoDeDiseno): string[] {
  const f = e.referencia?.ficha;
  const referencia = e.referencia
    ? [
        `REFERENCIA «${e.referencia.id}»${f ? ` · familia ${f.familia} · ${f.titulo}` : ' (sin ficha)'}`,
        ...(f
          ? [
              `  capas: ${f.capas.join(' / ')}`,
              `  retícula: ${f.reticula}`,
              `  tipografía: ${f.tipografia.map((t) => `${t.rol} ${t.clasificacion}${t.escala ? ` (${t.escala} %)` : ''}`).join('; ')}`,
              `  foto: ${f.foto}`,
              `  recursos: ${f.recursos.map((r) => `${r.recurso} (${r.funcion})`).join('; ') || 'ninguno'}`,
              `  lectura: ${f.lectura.join(' → ')}`,
              `  por qué funciona: ${f.porQueFunciona}`,
              ...(f.mecanismos.length ? [`  mecanismos: ${f.mecanismos.join(', ')}`] : []),
            ]
          : []),
      ].join('\n')
    : 'Sin referencia: no rellenes «seToma» ni «noSeCopia».';
  const h = e.hechos;
  return [
    'HECHOS (lo único que la pieza puede decir; cita de aquí, literal):',
    `  PLATO (nota del dueño): «${h.plato}»`,
    `  ELEMENTO (confirmados): ${h.elementos.map((x) => `«${x.nombre} ${x.estado}»`).join(' · ') || 'ninguno'}`,
    `  RECUENTO: ${h.elementos.filter((x) => x.recuento !== null).map((x) => `«${x.recuento} ${x.nombre}»`).join(' · ') || 'ninguno'}`,
    `  MARCA: ${[h.local.nombre, h.local.ciudad, h.local.descripcion, ...h.local.tonos, h.local.instagram ?? '', h.local.web ?? ''].filter(Boolean).map((t) => `«${t}»`).join(' · ')}`,
    `  CREATIVO: ${e.titularCreativo ? 'este encargo permite UN titular creativo' : 'no permitido en este encargo'}`,
    '',
    referencia,
    '',
    mapaEnTexto(e.mapa),
    '',
    `COLORES: ${e.colores.map((c) => `@${c.token} ${c.hex} (${c.papel})`).join(' · ')}`,
    `VOCES: ${e.voces.map((v) => `${v.id}: ${v.descripcion}`).join(' · ')}`,
    `VOZ DE ACENTO: ${e.voces.some((v) => v.id === 'acento' || /ballet|bodoni|sacramento|kaushan/i.test(v.descripcion)) ? 'sí (TITULAR_CON_ACENTO es posible)' : 'no (no uses TITULAR_CON_ACENTO)'}`,
  ];
}

/** El mensaje de cada pieza: hechos, referencia, mapa, listas y, si los hay, los problemas de la propuesta anterior. */
export function textoDiseno(e: EncargoDeDiseno, problemasPrevios: string[]): string {
  return [
    ...hechosYContexto(e),
    ...(problemasPrevios.length ? ['', 'TU PROPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS (corrígelos todos):', ...problemasPrevios.map((p) => `- ${p}`)] : []),
  ].join('\n');
}

/** El mensaje de la crítica: lo mismo que la propuesta, más la propuesta que se pintó. Las imágenes van después. */
export function textoCritica(e: EncargoDeDiseno, propuesta: unknown): string {
  return [
    'CRÍTICA: mira la pieza pintada (primera imagen) junto a la referencia (segunda). ¿Llega a su oficio?',
    '',
    ...hechosYContexto(e),
    '',
    `LA PROPUESTA QUE SE PINTÓ: ${JSON.stringify(propuesta)}`,
    '',
    'Devuelve SOLO un JSON: {"llega": true|false, "motivos": ["…"], "propuesta": {…la propuesta corregida, solo si llega es false…}}',
  ].join('\n');
}
