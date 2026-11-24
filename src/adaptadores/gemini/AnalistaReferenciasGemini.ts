/**
 * Puntos 3 y 4 (15/11): la ficha de una referencia con Gemini visión, contra el esquema FichaReferencia, y si la imagen
 * es de verdad un post (o un mockup, una marca de agua, una captura con interfaz o un collage).
 * Una llamada por referencia. Las familias F1–F10 y un ejemplo de ficha hecha a mano van en las instrucciones (fijas).
 */
import sharp from 'sharp';
import { z } from 'zod';
import { Aptitud, FichaReferencia, LecturaFotografica, RelacionesGraficas, type FamiliaBiblioteca } from '../../dominio/referencia.js';
import type { AnalistaDeReferencias, FichaAnalizada } from '../../puertos/AnalistaDeReferencias.js';
import type { ClienteGemini } from './ClienteGemini.js';

export const RespuestaDeAnalisis = z.object({
  aptitud: Aptitud,
  ficha: FichaReferencia.omit({ esquema: true, analizadaPor: true, analizadaEn: true }).extend({ lecturaFotografica: LecturaFotografica, relacionesGraficas: RelacionesGraficas }),
});

export function instruccionesAnalista(familias: FamiliaBiblioteca[], ejemplo?: FichaAnalizada): string {
  return `Eres el analista de referencias de un estudio que diseña posts de Instagram para restaurantes. Te dan la imagen de
un post que el local ha elegido como referencia. Escribes su FICHA: lo que un diseñador anotaría para reutilizar su OFICIO
(composición, jerarquía, tipografía, color, recursos), nunca sus textos ni su marca.

PRIMERO, di si la imagen es un post publicado («aptitud»):
- POST: el post tal cual, a sangre.
- MOCKUP: el post puesto en un móvil, en una mano o en una escena de vendedor de plantillas.
- MARCA_DE_AGUA: lleva la marca de agua de un banco de imágenes o de un vendedor (busca logotipos o textos repetidos y semitransparentes encima).
- CAPTURA_CON_INTERFAZ: una captura con botones, iconos o textos de la app alrededor del post.
- COLLAGE: varios posts juntos.
Di en «problemas» qué lo delata y dónde. Si no es un POST, la ficha se rellena igual con lo que se vea.

FAMILIAS (elige la que mejor encaje):
${familias.map((f) => `- ${f.id} · ${f.nombre}: ${f.receta}`).join('\n')}

REGLAS DE LA FICHA
- «capas», de fondo a frente, en frases cortas; los textos del post, entre comillas «», tal cual (solo para describirlo).
- «tipografia»: cada nivel con su papel y su clasificación (grotesca condensada, didona, script de pincel…) y «escala»: la
  altura de las mayúsculas en % del alto del lienzo (un titular gigante, 10–15; un apoyo, 2–3).
- «paleta»: de 2 a 5 HEX medidos a ojo con su papel.
- «lectura»: qué se lee primero, segundo y tercero en el móvil.
- En «relacionesGraficas» elige hasta tres decisiones que distinguen ESTE diseño. En «gesto» localiza qué elementos
  se cruzan o se alinean, cuál está delante, su escala relativa o la diferencia de nitidez. En «construccion» explica
  cómo reproducir esa relación con la fotografía nueva y las palabras del encargo. Por ejemplo, una inicial caligráfica
  cruza solo el pie de una mayúscula de palo fino; cada palabra sigue siendo editable. Un campo vacío o una única
  voz tipográfica también pueden ser la relación principal. Descarta los efectos que no se ven.
- «tratamiento»: lo que hace que parezca dibujada, impresa o pegada: ILUSTRADO (dibujos), TINTA (trazos a tinta o pincel),
  PINCEL (letra de pincel), PEGATINA (producto recortado con un filo blanco), PAPEL (textura de papel), ICONOS_DE_LINEA
  (iconos finos de fondo), TRAMA (semitonos), COLLAGE; o FOTOGRAFICO_LIMPIO si no hay nada de eso.
- No inventes lo que no se ve.
- En «lecturaFotografica» justifica cada observación con una señal localizable. El borde elíptico de una taza permite
  estimar la altura de la mirada. La sombra de la base y el reflejo en el esmalte permiten proponer el lado de la luz.
  Describe el plano que queda legible y dónde empieza a caer el foco. Distingue luz y color del material. La emoción
  es una interpretación: explica qué gesto, distancia o contraste podría sugerirla al espectador.
- Para «traslado», convierte una relación visible en una instrucción ejecutable para una toma de otro sujeto. Conserva
  la relación entre masas, luz o gesto y modifica la puesta en escena. No atribuyas focal, apertura o Kelvin exactos
  a partir de la imagen. Si es una ilustración o algo queda oculto, dilo. Puedes describir su equivalente gráfico.
${ejemplo ? `\nEJEMPLO de ficha hecha a mano (de otro post):\n${JSON.stringify(ejemplo)}\n` : ''}
Responde SOLO con JSON: {"aptitud":{"tipo":"POST","problemas":[]},"ficha":{…}} con este esquema:
${JSON.stringify(z.toJSONSchema(RespuestaDeAnalisis))}`;
}

export class AnalistaReferenciasGemini implements AnalistaDeReferencias {
  readonly nombre: string;

  constructor(
    private readonly cliente: ClienteGemini,
    modelos: string[],
    private readonly familias: FamiliaBiblioteca[],
    private readonly ejemplo?: FichaAnalizada,
  ) {
    this.nombre = `Gemini (${modelos.join(', respaldo ')})`;
  }

  async analizar(rutaImagen: string) {
    const datos = await sharp(rutaImagen).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    return this.cliente.generarJson(
      instruccionesAnalista(this.familias, this.ejemplo),
      [{ text: 'La imagen de la referencia:' }, { inlineData: { mimeType: 'image/jpeg', data: datos.toString('base64') } }],
      RespuestaDeAnalisis,
    );
  }
}
