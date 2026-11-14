/**
 * Director de diseño con Gemini (F3): elige el mecanismo y los textos (dominio/diseno/propuesta.ts, PropuestaDelDirector)
 * y, como crítico, mira la pieza pintada junto a la referencia.
 *
 * Gasto: una llamada por propuesta (dos como mucho si la primera no pasa) y una de crítica. Lo que el modelo no sabe
 * medir no se le pide: el sitio libre y los colores van como texto (mapa de la foto), y las imágenes van pequeñas.
 */
import sharp from 'sharp';
import { PropuestaDelDirector, type PropuestaDeDiseno } from '../../dominio/diseno/propuesta.js';
import type { CriticaDeDiseno, CriticoDeDiseno, DirectorDeDiseno, EncargoDeDiseno } from '../../puertos/DirectorDeDiseno.js';
import type { ClienteGemini, ParteGemini } from './ClienteGemini.js';
import { instruccionesDiseno, RespuestaDeCritica, textoCritica, textoDiseno } from './instruccionesDiseno.js';

/** Lado de las imágenes que se envían: basta para ver el plato y el tono; el detalle lo da el mapa. */
const LADO = 512;

const reducir = async (ruta: string, lado = LADO) =>
  (await sharp(ruta).rotate().resize(lado, lado, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64');

export class DirectorDisenoGemini implements DirectorDeDiseno, CriticoDeDiseno {
  readonly nombre: string;

  constructor(
    private readonly cliente: ClienteGemini,
    modelos: string[],
  ) {
    this.nombre = `Gemini (${modelos.join(', respaldo ')})`;
  }

  async proponer(e: EncargoDeDiseno, problemasPrevios: string[]): Promise<PropuestaDeDiseno> {
    const partes: ParteGemini[] = [
      { text: textoDiseno(e, problemasPrevios) },
      { text: 'La foto nueva del plato, tal como caerá a sangre (para que veas el plato y sitúes las anotaciones; las medidas están en el mapa):' },
      { inlineData: { mimeType: 'image/jpeg', data: await reducir(e.foto) } },
    ];
    if (e.referencia?.imagen) {
      partes.push(
        { text: `El post de referencia «${e.referencia.id}» (toma su oficio; no copies sus textos, su marca ni su plato):` },
        { inlineData: { mimeType: 'image/jpeg', data: await reducir(e.referencia.imagen) } },
      );
    }
    return this.cliente.generarJson(instruccionesDiseno(), partes, PropuestaDelDirector);
  }

  async criticar(e: EncargoDeDiseno, propuesta: PropuestaDeDiseno, pieza: string): Promise<CriticaDeDiseno> {
    const partes: ParteGemini[] = [
      { text: textoCritica(e, propuesta) },
      { text: 'La pieza pintada:' },
      { inlineData: { mimeType: 'image/jpeg', data: await reducir(pieza) } },
    ];
    if (e.referencia?.imagen) partes.push({ text: `La referencia «${e.referencia.id}»:` }, { inlineData: { mimeType: 'image/jpeg', data: await reducir(e.referencia.imagen) } });
    const r = await this.cliente.generarJson(instruccionesDiseno(), partes, RespuestaDeCritica);
    return { llega: r.llega, motivos: r.motivos, ...(!r.llega && r.propuesta ? { propuesta: r.propuesta } : {}) };
  }
}
