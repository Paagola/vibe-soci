/**
 * Instrucciones del director de diseño (F3). Las instrucciones de sistema son fijas (no cambian de una pieza a otra),
 * para que el prefijo sea siempre el mismo y la API pueda reutilizarlo; lo que cambia va en el mensaje.
 * Los criterios salen de diseno/f3/INVESTIGACION.md y de conocimiento/oficios/composicion-y-tipografia.md.
 */
import { z } from 'zod';
import { PropuestaDeDiseno } from '../../dominio/diseno/propuesta.js';
import type { EncargoDeDiseno } from '../../puertos/DirectorDeDiseno.js';
import { mapaEnTexto } from '../../dominio/diseno/mapaDeFoto.js';

/** El esquema del dialecto, generado del mismo zod que valida la respuesta: no se pueden desincronizar. */
const ESQUEMA = JSON.stringify(z.toJSONSchema(PropuestaDeDiseno));

export function instruccionesDiseno(): string {
  return `Eres el director de diseño de un estudio que hace posts de Instagram (3:4, 1080 × 1440) para restaurantes.
Recibes los HECHOS de la pieza (lo único que puede decir), la ficha de un post de REFERENCIA (de la que tomas el oficio),
el MAPA de la foto (medido por código: dónde está el plato y dónde hay aire) y las listas de COLORES y VOCES disponibles.
Devuelves SOLO un JSON con la forma de este esquema (una «propuesta de diseño»; el código la compila y la pinta):

${ESQUEMA}

CÓMO SE COLOCA
- Hablas en la retícula: 12 columnas × 16 filas, [primera, última], las dos incluidas. Nunca en píxeles.
- Pon los textos en las «zonas libres» del mapa o en relación con el plato; no sobre una zona «x» (con detalle) salvo con velo.
- La caja de un texto «aparte» y la de una anotación no pueden pisar ninguna celda «#» del mapa: el código mide si las
  letras tapan el plato y, si lo tapan más de un 3 %, rechaza la propuesta.
- El contraste se mide con lo que hay detrás de cada letra: sobre una zona clara, tinta oscura; sobre una oscura, clara.
  Si la zona mezcla las dos, pon un velo o un bloque de color detrás.
- Las filas 1 y 16 quedan en parte fuera de la zona segura (se recortan al exportar a 4:5): ahí no va texto, salvo
  un titular que sangra a propósito.
- Las capas van de fondo a frente. El plato aparece una vez: una capa «foto» al natural o una capa «plato» (recortado, solo si hay máscara).

OFICIO (lo que separa una pieza con intención de una plantilla de IA)
- Un solo foco («foco»): el plato o el titular. Lo demás descansa.
- Salto de escala: el texto mayor, entre 5 y 12 veces el menor. Si todo pesa parecido, no hay jerarquía.
- El titular toca al plato: relación «detras», «delante» o «contorno» si hay máscara; no lo pongas solo como un bloque aparte encima o debajo de la foto.
- Como mucho 30 palabras y cuatro niveles (titular, apoyo, dato, firma). Lo que sobre va al pie, no a la imagen.
- Dos voces tipográficas como mucho, y si acaso una tercera manuscrita corta que solo interrumpe (nunca un dato).
- Un solo gesto a mano por pieza (un trazo o una anotación con flecha), y como mucho dos recursos (sellos y patrones).
- Un solo color de acento, y mejor si sale del plato (el color «plato» de la lista, si está).
- La tinta («impresa», «gastada») solo en texto grande; el corte tipográfico solo si el plato también se parte o se corta.
- La foto del plato va «natural»: el duotono y la trama nunca van sobre el plato.
- Nada de degradados decorativos, todo centrado por defecto ni texturas de papel porque sí: cada recurso responde a un hecho.

NO INVENTAR (lo comprueba el código y rechaza la propuesta)
- Cada texto declara su «fuente» y su «cita»: el fragmento LITERAL de los hechos que lo respalda.
- Cada palabra con contenido del texto tiene que estar en los hechos. Ni precios, ni fechas, ni premios, ni recuentos que no consten.
- «CREATIVO» solo si el encargo lo permite: una palabra o dos, sin cifras y sin reclamos («casero», «el mejor»…).
- De la referencia se toma el oficio (jerarquía, mecanismo, tratamiento), nunca sus textos, su marca ni su plato.
  Di qué tomas en «seToma» y qué no copias en «noSeCopia».
- Usa solo los colores y las voces de las listas, con su nombre exacto (los colores con «@»).`;
}

/** El mensaje de cada pieza: hechos, referencia, mapa, listas y, si los hay, los problemas de la propuesta anterior. */
export function textoDiseno(e: EncargoDeDiseno, problemasPrevios: string[]): string {
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
    ...(problemasPrevios.length ? ['', 'TU PROPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS (corrígelos todos):', ...problemasPrevios.map((p) => `- ${p}`)] : []),
  ].join('\n');
}
