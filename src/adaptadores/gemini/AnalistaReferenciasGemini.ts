/**
 * Puntos 3 y 4 (15/11): la ficha de una referencia con Gemini visión, contra el esquema FichaReferencia, y si la imagen
 * es de verdad un post (o un mockup, una marca de agua, una captura con interfaz o un collage).
 * Una llamada por referencia. Las familias F1–F10 y un ejemplo de ficha hecha a mano van en las instrucciones (fijas).
 */
import sharp from 'sharp';
import { z } from 'zod';
import { Aptitud, FichaReferencia, type FamiliaBiblioteca } from '../../dominio/referencia.js';
import type { AnalistaDeReferencias, FichaAnalizada } from '../../puertos/AnalistaDeReferencias.js';
import type { ClienteGemini } from './ClienteGemini.js';

export const RespuestaDeAnalisis = z.object({
  aptitud: Aptitud,
  ficha: FichaReferencia.omit({ esquema: true, analizadaPor: true, analizadaEn: true }),
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
- No inventes lo que no se ve.
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
