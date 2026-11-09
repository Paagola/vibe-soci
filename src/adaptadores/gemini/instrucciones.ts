/**
 * Textos que recibe el director creativo. Aquí solo va el *marco* del encargo:
 * lo que ha gustado vive en biblioteca/ (principios, ejemplos y valoraciones), no en el código.
 */
import type { Concepto, Formato } from '../../dominio/modelos.js';
import { MAX_PALABRAS_POR_DIAPOSITIVA, MAX_PALABRAS_TITULAR, RECORTE_4_5_PX, proporcionDe } from '../../dominio/reglas.js';
import type { GuiaCreativa } from '../../puertos/BibliotecaCreativa.js';
import type { ContextoCreativo, PeticionCorreccion } from '../../puertos/DirectorCreativo.js';

const EXTRACTO_PROMPT = 400;

export function instruccionesBase(guia: GuiaCreativa): string {
  return `Eres el director creativo de un estudio que crea piezas de Instagram para restaurantes y bares reales.
Conviertes la idea del dueño y sus fotos reales en imágenes creativas, llamativas, con personalidad propia y fieles a las fotos.
No rellenas plantillas: la guía y los ejemplos te enseñan el nivel y lo que ha gustado; tú propones algo nuevo para este local y este plato.

# Guía creativa del estudio
${guia.principios.trim()}

# Ejemplos
Hay dos clases. Las marcadas «GUSTÓ» o «NO GUSTÓ» son piezas concretas de otros locales: aprende su nivel y su estructura, pero no repitas esa pieza (mismo titular o misma idea para el mismo plato).
Las marcadas «REFERENCIA DEL USUARIO» son recursos del repertorio que el dueño admira: puedes adaptarlos y combinarlos con el plato real, sin copiar sus textos ni sus colores.

${guia.ejemplos.map((ejemplo) => ejemplo.trim()).join('\n\n---\n\n') || 'No hay ejemplos.'}

# Valoraciones recientes del equipo (aprende de los motivos)
${describirValoraciones(guia)}

# Reglas que no se rompen nunca
- Foto y texto en una sola imagen generada.
- Nada inventado: ni platos, ingredientes, vajilla, logotipos, carteles ni personas que no estén en las fotos.
- Ninguna cifra, precio, fecha, teléfono, dirección o web que no esté en la idea, en las condiciones o en los datos del local.
- Elementos gráficos (sello, franja, flechas, contador): como mucho uno o dos por imagen y con propósito. Nunca una caja genérica que tape el fondo, ni botones de interfaz, ni iconos de Instagram, ni puntos de paginación.
- Los textos de la imagen, en español de España exacto, con tildes y signos de apertura, pocos y legibles en el móvil.
- Respondes solo con JSON válido, sin texto antes ni después.`;
}

function describirValoraciones(guia: GuiaCreativa): string {
  if (guia.valoraciones.length === 0) return 'Aún no hay valoraciones.';
  return guia.valoraciones
    .map((v) => {
      const cabecera = `- [${v.veredicto === 'GUSTA' ? 'GUSTA' : 'NO GUSTA'}] ${v.localSlug} · diapositiva ${v.diapositiva}: «${v.motivo}»`;
      return v.veredicto === 'GUSTA' ? `${cabecera}\n  Prompt (extracto): ${v.prompt.slice(0, EXTRACTO_PROMPT).replace(/\s+/g, ' ')}…` : cabecera;
    })
    .join('\n');
}

/** Datos del local y de la pieza. Va siempre antes de las imágenes. */
export function textoEncargo(contexto: ContextoCreativo): string {
  const { marca, pieza } = contexto;
  const colores = marca.colores.map((c) => `${c.nombre} ${c.hex}`).join(', ') || 'no hay definidos: sácalos de la propia escena';
  const tipografias = marca.tipografias.map((t) => `${t.rol.toLowerCase()}: ${t.descripcion}`).join('; ') || 'no hay definidas';
  const condiciones =
    Object.entries(pieza.condiciones)
      .filter(([, valor]) => valor)
      .map(([clave, valor]) => `${clave}: ${valor}`)
      .join('; ') || 'ninguna';
  const contacto = [marca.instagram, marca.web].filter(Boolean).join(' · ') || 'no hay: no pongas ni Instagram, ni web, ni teléfono';

  return `# Encargo
Local: ${marca.nombre}, ${marca.ciudad}. ${marca.descripcion}
Tono: ${marca.tonos.join(', ')}
Colores de la marca: ${colores}
Tipografías de la marca: ${tipografias}
Pieza: ${pieza.formato} de ${pieza.numDiapositivas} imagen(es), ${describirLienzo(pieza.formato)}. Tipo: ${pieza.tipo}.
Idea del dueño: «${pieza.idea}»
Condiciones del dueño (las únicas cifras permitidas): ${condiciones}
Contacto real del local (solo se puede firmar con esto): ${contacto}

Imágenes adjuntas (cada una va precedida de su nombre):
${[...contexto.fotos, ...(contexto.referenciaEstilo ? [contexto.referenciaEstilo] : [])].map((i) => `- ${i.archivo} · ${i.descripcion}`).join('\n')}`;
}

/** El feed se diseña a 3:4 y se exporta también a 4:5, que recorta el centro: el texto va dentro de la zona segura. */
function describirLienzo(formato: Formato): string {
  if (formato === 'HISTORIA') return 'proporción 9:16 (1080 × 1920)';
  return `proporción 3:4 (1080 × 1440), que también se publica recortada a 4:5 (${RECORTE_4_5_PX} px menos arriba y abajo)`;
}

/** Márgenes del bloque LAYOUT: en el feed, arriba y abajo hay que sumar lo que recorta el 4:5. */
function margenesDelLayout(formato: Formato): string {
  return formato === 'HISTORIA' ? 'márgenes de 70 px' : `márgenes de 70 px a los lados y de ${70 + RECORTE_4_5_PX} px arriba y abajo`;
}

/** Posts de referencia que mira el director: enseñan oficio, no son de este local ni se envían al generador. */
export function textoReferenciasVisuales(guia: GuiaCreativa): string {
  if (guia.referencias.length === 0) return '';
  return `# Posts de referencia del usuario (solo para ti)
No son de este local y no se envían al generador. Fíjate en la jerarquía, los márgenes, la pareja tipográfica, cómo se tocan texto y producto y cuántas palabras llevan. No copies sus textos, marcas ni platos.
${guia.referencias.map((r) => `- ${r.archivo}: ${r.descripcion}`).join('\n')}`;
}

export function textoConceptos(descartados: Concepto[], formato: Formato): string {
  const yaVistos = descartados.length
    ? `\nYa se propusieron y descartaron estos conceptos. No los repitas ni hagas variaciones de ellos:\n${descartados
        .map((c) => `- ${c.titulo}: ${c.mecanismo}`)
        .join('\n')}\n`
    : '';
  const serie =
    formato === 'POST'
      ? ''
      : '- como es una serie, explica en "mecanismo" cómo se encadenan las imágenes (qué se repite y qué continúa de una a otra);\n';

  return `# Qué tienes que hacer ahora
Mira las fotos con atención: qué hay exactamente, qué texturas, qué colores, qué hace único a este plato.
Propón exactamente 3 conceptos muy distintos entre sí: **cada uno de una familia visual distinta** (recorte sobre color plano, low-key, luz de día o flash, macro a sangre, editorial blanco) y con un mecanismo tipográfico distinto.
Al menos uno tiene que ser arriesgado: algo que el dueño no esperaría, pero que se entienda en dos segundos.
Cada concepto:
- recompone la foto real como un fotógrafo profesional (ángulo, objetivo, luz y encuadre nuevos), nunca la misma foto con más calidad;
- tiene un mecanismo en el que el texto y el plato se tocan, y que nace de este plato, de esta idea o de este local;
- tiene jerarquía clara: un titular de ${MAX_PALABRAS_TITULAR} palabras como mucho (mejor 1–3) y uno o dos textos pequeños de apoyo;
- usa de 2 a 4 colores en HEX (fondo, texto y un acento), de la marca o de la propia escena;
${serie}- se lee bien en el móvil: mucho contraste, márgenes y nada importante pegado a los bordes.
Escribe los conceptos en español: el dueño los lee para elegir.
${yaVistos}
Responde solo con este JSON:
{"conceptos":[{"titulo":"…","tratamiento":"familia visual y fondo","mecanismo":"…","fotografia":"…","tipografia":"…","paleta":["#RRGGBB","#RRGGBB"],"textos":["titular","apoyo"],"porQue":"…"}]}`;
}

const ESTRUCTURA: Record<Formato, string> = {
  POST: 'Es una sola imagen que lo cuenta todo: el titular se lee en dos segundos y el plato es el protagonista.',
  CARRUSEL: `Es una historia que se desliza:
- Diapositiva 1, gancho: titular corto, el producto más apetecible y una razón para deslizar (algo que se sale por el borde derecho, una pregunta, una promesa o un contador pequeño «1/N»).
- Intermedias: una idea por diapositiva (un plato, un ingrediente, un detalle, la acción, el local). Cambia el plano (general, detalle, acción) para que no aburra.
- Última, cierre: **siempre** una llamada a la acción con un verbo (Reserva, Ven, Pide…) y el lugar real del local (ciudad o barrio). Puede volver al plato de la portada con otro encuadre.
- Todas con la misma familia visual, la misma pareja tipográfica, la misma paleta y el titular en el mismo sitio. Cada una se entiende sola si sale suelta.`,
  HISTORIA: `Pantallas verticales 9:16 que se leen de un vistazo: titular grande y breve, la misma regla tipográfica en todas y la última con la acción.
Deja libre el 14 % de arriba y el 20 % de abajo, porque ahí va la interfaz de Instagram.`,
};

export function textoPlan(contexto: ContextoCreativo, concepto: Concepto, problemasPrevios: string[]): string {
  const { pieza } = contexto;
  const extras = [
    contexto.referenciaEstilo &&
      '- La referencia de estilo irá justo después de las fotos de la diapositiva: si la diapositiva usa 1 foto, es Image 2; si usa 2, es Image 3. Úsala solo para la luz, la composición o la idea tipográfica; nunca copies su comida, sus objetos ni sus textos.',
    pieza.numDiapositivas > 1 &&
      '- En las diapositivas 2 en adelante, la portada aprobada irá la última: pide que se copien su tipografía, sus colores y su aspecto fotográfico.',
    pieza.formato === 'HISTORIA'
      ? `- Proporción ${proporcionDe(pieza.formato)} (1080 × 1920).`
      : `- Proporción ${proporcionDe(pieza.formato)} (1080 × 1440). También se exporta a 4:5 recortando ${RECORTE_4_5_PX} px arriba y ${RECORTE_4_5_PX} px abajo: deja todo el texto y lo importante del plato a más de ${70 + RECORTE_4_5_PX} px de esos bordes.`,
  ].filter(Boolean);
  const problemas = problemasPrevios.length
    ? `\n# Problemas de tu respuesta anterior (corrígelos)\n${problemasPrevios.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  const serie = pieza.numDiapositivas > 1;
  return `# Concepto elegido por el dueño
${JSON.stringify(concepto, null, 2)}

# Qué tienes que hacer ahora
Escribe el plan de la pieza con exactamente ${pieza.numDiapositivas} diapositiva(s), con posiciones de 1 a ${pieza.numDiapositivas}.
${ESTRUCTURA[pieza.formato]}

Para cada diapositiva:
- "funcion": para qué sirve, en una frase corta en español.
- "titular": el texto más grande (${MAX_PALABRAS_TITULAR} palabras como mucho); tiene que ser también uno de "textos".
- "textos": cada texto literal que saldrá en la imagen, exacto, en español de España con tildes. Entre todos, ${MAX_PALABRAS_POR_DIAPOSITIVA[pieza.formato]} palabras como mucho; lo largo va en el pie.${serie ? '\n- "transicion": qué invita a pasar a la siguiente o qué elemento continúa en ella (en la última, cómo cierra).' : ''}
- "fotos": los nombres de las fotos que usa (solo de la lista que empieza por fotos/), al menos una. El orden importa: la primera será Image 1, la segunda Image 2…
- "prompt": en inglés, con la estructura que ha funcionado: cabecera, CAMERA, PHOTO, LAYOUT (dónde va cada nivel de texto, ${margenesDelLayout(pieza.formato)} y qué se sale del encuadre), CREATIVE TYPOGRAPHY y RULES. Describe con detalle los elementos reales que ves en las fotos. Escribe cada texto de "textos" entre comillas, exactamente igual (el sistema lo comprueba).
  El bloque CAMERA es obligatorio y es lo más importante: el dueño no quiere su foto mejorada, quiere una toma nueva de fotógrafo profesional. Escríbelo así: "CAMERA: Image 1 is shot <cómo está hecha: altura, ángulo, distancia, encuadre>. Use Image 1 only as the list of elements, not as a layout to copy. The new photograph is shot <posición de cámara claramente distinta: otra altura y otro ángulo (p. ej. a ras de mesa, cenital, contrapicado), objetivo, distancia y qué se sale del encuadre>." Si la nueva toma se parece a la original, no sirve.
${serie ? '\nEn el plan, "hiloVisual": lo que une todas las diapositivas (familia visual, pareja tipográfica, paleta en HEX y el elemento que continúa). Repítelo en el LAYOUT de cada prompt para que el generador lo mantenga.\n' : ''}
Referencias que el sistema añade detrás de las fotos:
${extras.join('\n')}

Además:
- "pie": el texto de la publicación, en español y con el tono del local, sin cifras que no estén en la idea o en las condiciones. Aquí sí cabe lo que no cabía en la imagen.
- "hashtags": de 3 a 10, cada uno con #.
- "textoAlt": descripción de la imagen para accesibilidad, en español.
${problemas}
Responde solo con este JSON:
{${serie ? '"hiloVisual":"…",' : ''}"diapositivas":[{"posicion":1,"funcion":"…","titular":"…","textos":["…"],${serie ? '"transicion":"…",' : ''}"fotos":["${contexto.fotos[0]?.archivo ?? 'fotos/01-plato.jpg'}"],"prompt":"…"}],"pie":"…","hashtags":["#…"],"textoAlt":"…"}`;
}

export function textoCorreccion(peticion: PeticionCorreccion, problemasPrevios: string[] = []): string {
  const { diapositiva } = peticion;
  const problemas = problemasPrevios.length
    ? `\n# Problemas de tu respuesta anterior (corrígelos)\n${problemasPrevios.map((p) => `- ${p}`).join('\n')}\n`
    : '';
  return `# Corrección de la diapositiva ${diapositiva.posicion} (${diapositiva.funcion})
Prompt con el que se generó:
"""
${peticion.promptAnterior}
"""

El dueño pide este cambio: «${peticion.comentario}»

Imágenes adjuntas: la primera (${peticion.imagenAnterior.archivo}) es la versión generada que hay que corregir; las siguientes son las fotos reales de la diapositiva.

# Qué tienes que hacer ahora
Mira la versión generada y escribe un prompt nuevo en inglés que:
- empiece por "Keep image 1 almost exactly.";
- siga con una lista numerada de cambios concretos que resuelvan el comentario y cualquier fallo evidente que veas (texto mal escrito, elementos inventados, cajas genéricas detrás del texto, texto pegado al borde o demasiado pequeño para el móvil);
- mantenga los textos exactos entre comillas, salvo que el comentario los cambie, y las RULES;
- no añada ninguna cifra, precio, fecha, teléfono o web que no esté en la idea, en las condiciones o en el comentario del dueño.
En "textos", escribe cada texto literal que saldrá en la imagen después del cambio, igual que entre las comillas del prompt (el sistema lo comprueba).
No incluyas la lista de imágenes de referencia: la añade el sistema (Image 1 = versión anterior; Image 2 y siguientes = fotos reales).
${problemas}
Responde solo con este JSON:
{"prompt":"…","textos":["…"]}`;
}

/**
 * Ensayo (herramientas/ensayoDirectorFoto.ts): el director escribe solo el prompt de la foto nueva, sin tipografía.
 * A propósito no añade reglas del estudio (ni el bloque CAMERA de textoPlan): mide lo que el director saca de la biblioteca.
 */
export function textoFotoNuevaDeEnsayo(plato: string, archivo: string): string {
  return `# Encargo de prueba
Plato, con la nota que escribió el dueño al subir la foto: «${plato}»
Imagen adjunta: ${archivo}, la foto real que ha subido el restaurante.

# Qué tienes que hacer ahora
Esta vez no hay tipografía: el estudio la pondrá después. Escribe solo el prompt, en inglés, de la FOTO NUEVA de este plato que haría un fotógrafo profesional, sin ningún texto en la imagen.
Aprende de los ejemplos y valoraciones de la guía qué fotos han gustado y cuáles no.
En "decisiones", explica en español cada decisión del prompt y de qué ejemplo o valoración la sacas.
Responde solo con este JSON: {"prompt":"…","decisiones":["…"]}`;
}
