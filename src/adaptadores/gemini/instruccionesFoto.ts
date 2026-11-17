/**
 * Instrucciones de la FASE DE FOTO, separadas de las de diseño (instrucciones.ts): aquí la foto va sin texto,
 * así que no aplica la regla «foto y texto en una sola imagen». La plantilla está en dominio/fotoNueva.ts.
 */
import { DIFERENCIA_MINIMA_GRADOS, DIFERENCIA_PARCIAL_GRADOS, GIRO_MINIMO_GRADOS, type OpcionesDePrompt } from '../../dominio/fotoNueva.js';
import type { GuiaCreativa } from '../../puertos/BibliotecaCreativa.js';
import { ESTETICAS } from '../../dominio/diseno/estetica.js';

export function instruccionesFoto(guia: GuiaCreativa): string {
  return `Eres el director de fotografía de un estudio que hace fotos de producto para restaurantes y bares reales.
El dueño sube una foto rápida de su plato. Tú escribes el encargo para una FOTO NUEVA de ese mismo plato, como la haría un fotógrafo profesional: otra cámara, otra luz, otro encuadre, los mismos elementos reales.
La foto va sin texto: la tipografía la pone el estudio después, en la fase de diseño.

# Guía del estudio (la ha escrito el dueño a partir de lo que le gusta)
${guia.principios.trim()}

# Ejemplos
Las marcadas «GUSTÓ» o «NO GUSTÓ» son piezas concretas: aprende qué fotos han gustado y por qué. Fíjate sobre todo en la estructura de los prompts de foto que gustaron (cómo nombran la foto, la lista de elementos, la cámara, la idea gráfica y la luz), no en su contenido.
${guia.ejemplos.map((e) => e.trim()).join('\n\n---\n\n') || 'No hay ejemplos.'}

# Reglas que no se rompen nunca
- Nada inventado: ni ingredientes, ni guarniciones, ni vajilla, ni manos, ni objetos que no estén en la foto subida. Lo que sí puedes cambiar: cámara, luz, fondo, superficie, encuadre y colocación (sin cambiar el número de piezas).
- La foto nueva es OTRA TOMA, no la subida mejorada: la cámara sube o baja más de ${DIFERENCIA_MINIMA_GRADOS}°, o cambian al menos dos de: el lado (girar ${GIRO_MINIMO_GRADOS}° o más alrededor del plato), la distancia (otro tamaño de plano) y la altura (${DIFERENCIA_PARCIAL_GRADOS}° o más). Si la foto subida ya está en el ángulo clásico del plato, gira y cambia la distancia en vez de estropear el ángulo.
- Ningún texto, letra ni logotipo en la foto.
- Respondes solo con JSON válido, sin texto antes ni después.`;
}

export interface EncargoFoto {
  plato: string;
  archivo: string;
  ancho: number;
  alto: number;
  /** Ficha de la referencia elegida para el post, en palabras (la imagen va aparte, solo para el director). */
  referencia?: { id: string; resumen: string };
  /** Si el generador verá la referencia como @image2 (solo de estilo) y su familia. */
  alGenerador?: Pick<OpcionesDePrompt, 'estiloDeReferencia' | 'familia' | 'estetica' | 'desdeElInventario'>;
  /** F3.3: un carrusel pide también las tomas de detalle. */
  formato?: 'post' | 'carrusel';
}

export function textoFotoNueva(e: EncargoFoto, problemasPrevios: string[] = []): string {
  const desdeElInventario = e.alGenerador?.desdeElInventario === true;
  const referencia = e.referencia
    ? `\n# Referencia elegida para el post (solo para ti: no se envía al generador)
${e.referencia.id}: ${e.referencia.resumen}
La foto nueva tiene que dejar sitio a su composición (dónde irá el titular y qué tapa el producto) y encajar con su luz y su fondo. No copies su plato, sus objetos ni sus textos.
${e.alGenerador?.estiloDeReferencia ? 'ESTA VEZ EL GENERADOR TAMBIÉN VERÁ LA REFERENCIA, como @image2, solo como referencia de estilo (luz, ángulo, tratamiento del fondo, color y aire para el texto). El estudio añade esa frase al prompt: tú no la escribas, pero escribe la luz, el fondo y el aire pensando en ella, y no nombres nada de lo que sale en la referencia (su comida, sus objetos, sus textos).\n' : ''}${e.alGenerador?.familia && ['F1', 'F3'].includes(e.alGenerador.familia) ? `La referencia es de la familia ${e.alGenerador.familia}: el plato irá RECORTADO sobre un color plano. Pide un fondo limpio y uniforme, sin objetos alrededor ni sombras duras que lo toquen, y el plato entero dentro del encuadre (que la foto no lo corte por ningún lado): el estudio añade al prompt el fondo para recortar.\n` : ''}`
    : '';
  const estetica = e.alGenerador?.estetica ? ESTETICAS[e.alGenerador.estetica] : undefined;
  const textoEstetica = estetica
    ? `\n# Estética del post: ${estetica.nombre}
${estetica.idea} La foto y el diseño tienen que ser de esta misma estética: el diseño se hará con ${estetica.diseno.mecanismos.join(', ')}.
Luz: ${estetica.foto.luz}. Fondo: ${estetica.foto.fondo}. Atrezo: ${estetica.foto.atrezo}. Color: ${estetica.foto.color}. Encuadre: ${estetica.foto.encuadre}.
El estudio añade esta frase de estética al prompt; escribe la cámara, la idea gráfica, el aire y la luz de acuerdo con ella (sin añadir comida ni nada que no esté en la foto subida).\n`
    : '';
  const problemas = problemasPrevios.length ? `\n# Problemas de tu respuesta anterior (corrígelos)\n${problemasPrevios.map((p) => `- ${p}`).join('\n')}\n` : '';
  return `# Encargo
Plato, con la nota que escribió el dueño al subir la foto: «${e.plato}»
Imagen adjunta: ${e.archivo}, la foto real que ha subido el restaurante. Mide ${e.ancho} × ${e.alto} px.
${referencia}${textoEstetica}
# Paso 1: describe la foto subida, antes de proponer nada
- "anguloGrados": la altura de la cámara sobre el plano de la mesa (0 = a ras de mesa, 90 = cenital, negativo si mira hacia arriba). Mírala bien: un ¾ alto está en torno a 45°.
- "distancia": el tamaño de plano: GENERAL (el plato y mucho entorno), MEDIO (el plato entero con algo de aire), PRIMER_PLANO (el plato llena el encuadre o se corta) o MACRO (un detalle).
- "encuadre" y "luz": cómo está hecha.
- "elementos": cada elemento real con su estado (tostado, glaseado, brillante…) y su recuento (null si no se puede contar). Cuenta pieza a pieza, mirando la foto entera:
  - "recuento" son solo las piezas que se ven ENTERAS; las que corta el borde de la foto van en "cortados" (una pieza cortada puede ser una entera en el plato real, o no: no la des por entera);
  - piezas parecidas pero distintas son elementos distintos (un rollito blanco con huevas no es un rollito de atún): no las juntes;
  - si alguna pieza queda tapada, borrosa o no sabes de qué tipo es, pon "dudoso": true y explícalo en "nota". Mejor dudoso que inventado.
${desdeElInventario ? `  - "ingles": escribe para cada elemento una frase en inglés que describa solo su nombre y estado, sin añadir ingredientes, origen, raza, calidad ni recuento. El estudio construye la lista del prompt con estas frases.
  - "enEncuadre": después de planear la cámara de la toma principal, comprueba cada elemento. Pon true solo si se verá en esa toma y false si queda fuera u oculto. Si algo queda fuera, abre el plano, cambia la altura o recoloca el plato para que se vea. Mantén el elemento en la lista aunque el encuadre todavía no lo enseñe.` : ''}
- "defectos": lo que tiene de foto rápida (resolución, luz plana, cosas que sobran en el encuadre, manchas).
- "utilizable" y "motivo": si sirve como lista de elementos o hay que pedir otra foto.

# Paso 2: rellena los huecos de la plantilla, en inglés
El estudio monta el prompt con esta estructura exacta (no la escribas tú):
"@image1 is a real photo of <plato> <origen>. Use it only as the list of elements, not as a layout to copy. The new photograph must contain the same real elements: <elementos>. <recuento> Nothing else added. New composition by a professional food photographer: <camara.descripcion>, <objetivoMm> mm lens at f/<apertura>, <ideaGrafica>. <luz>, <colorDominante>. Photographic realism, no text."
- "plato" y "origen": qué es y de qué tipo de local, sin nombre propio.
${desdeElInventario ? '- Usa únicamente el nombre y la preparación que consten en la nota o sean visibles. Si desconoces el tipo de local, usa «at a restaurant». La referencia solo aporta estilo.' : ''}
- "elementos": todos los de la foto, con su estado, incluida la vajilla. Superficie y fondo son libres.
- "recuento": «Exactly …» con el número de cada pieza que se pueda contar.
- "camara": altura en grados, "giroGrados" (cuánto gira alrededor del plato respecto a la foto subida: 0 el mismo lado, 45 un ¾ desde la esquina, 90 de costado), "distancia" (otro tamaño de plano si cambia), una frase que describa el resultado visible, objetivo y apertura. Tiene que ser otra toma (regla de arriba).
- "ideaGrafica": la composición con sitio para cada cosa: qué va grande, dónde, qué sale por los bordes, qué línea guía la mirada y dónde queda el hueco limpio para el titular.
- "aire": dónde queda ese hueco limpio para el texto, en una palabra: arriba, abajo, izquierda, derecha, arriba-izquierda, arriba-derecha, abajo-izquierda o abajo-derecha ("ninguno" si no hace falta). El estudio lo MIDE en la foto nueva: si el plato lo llena, la foto se descarta. Que la cámara y la distancia lo dejen de verdad (el plato no puede ocupar toda esa zona).
- "luz": la fuente, su dirección y su calidad, y lo que hace en el plato.
- "colorDominante": qué color manda y cuál es el único fuerte.
Elige cámara, distancia y luz por el plato y la referencia, no por costumbre.

${e.formato === 'carrusel' ? `# Paso 3 (es un CARRUSEL): las tomas de detalle
Los "huecos" de arriba son la PORTADA: el plato entero, aislado y heroico. Añade "tomas": de dos a tres tomas de DETALLE, una por cada elemento que más cuenta del plato (no la vajilla ni la superficie). Cada una:
- "elemento": el nombre EXACTO de uno de tus "elementos";
- "huecos": la misma plantilla, pero solo con ESE elemento de @image1: "plato" y "elementos" dicen solo ese elemento con su estado; "recuento": «Exactly N …» con las piezas de ese elemento que se ven en la toma (puede ser menos que en el plato: una o dos de cerca); la cámara MACRO o PRIMER_PLANO y otra altura; "ideaGrafica" con el elemento grande y aire limpio arriba para un título; "aire": "arriba".
Nada que no esté en la foto subida.
` : ''}
En "decisiones", explica en español cada decisión y de qué ejemplo o referencia la sacas.
${problemas}
Responde solo con este JSON (los números son de relleno: pon los tuyos):
{"descripcion":{"anguloGrados":0,"distancia":"MEDIO","encuadre":"…","luz":"…","elementos":[{"nombre":"…","estado":"…","recuento":2,"cortados":1,"dudoso":false,"nota":"…"${desdeElInventario ? ',"ingles":"…","enEncuadre":true' : ''}}],"defectos":["…"],"utilizable":true,"motivo":"…"},"huecos":{"plato":"…","origen":"…","elementos":"…","recuento":"…","camara":{"anguloGrados":0,"giroGrados":0,"distancia":"MEDIO","descripcion":"…","objetivoMm":0,"apertura":0},"ideaGrafica":"…","aire":"arriba-derecha","luz":"…","colorDominante":"…"},"decisiones":["…"]${e.formato === 'carrusel' ? ',"tomas":[{"elemento":"…","huecos":{…la misma forma que "huecos"…}}]' : ''}}`;
}
