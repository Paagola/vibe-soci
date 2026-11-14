/**
 * Director de diseño con Gemini (F3): escribe la propuesta de diseño (dominio/diseno/propuesta.ts).
 *
 * Gasto: una llamada por propuesta (dos como mucho, si la primera no pasa las comprobaciones del código). Lo que el
 * modelo no sabe medir no se le pide: el sitio libre y los colores van como texto (mapa de la foto, unas doscientas
 * fichas), y las imágenes van pequeñas, solo para que vea el plato y el tono de la referencia.
 */
import sharp from 'sharp';
import { PropuestaDeDiseno } from '../../dominio/diseno/propuesta.js';
import type { DirectorDeDiseno, EncargoDeDiseno } from '../../puertos/DirectorDeDiseno.js';
import type { ClienteGemini, ParteGemini } from './ClienteGemini.js';
import { instruccionesDiseno, textoDiseno } from './instruccionesDiseno.js';

/** Lado de las imágenes que se envían: basta para ver el plato y el tono; el detalle lo da el mapa. */
const LADO_FOTO = 512;
const LADO_REFERENCIA = 512;

const reducir = async (ruta: string, lado: number) =>
  (await sharp(ruta).rotate().resize(lado, lado, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64');

export class DirectorDisenoGemini implements DirectorDeDiseno {
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
      { text: 'La foto nueva del plato, tal como caerá a sangre (solo para que la veas; las medidas están en el mapa):' },
      { inlineData: { mimeType: 'image/jpeg', data: await reducir(e.foto, LADO_FOTO) } },
    ];
    if (e.referencia?.imagen) {
      partes.push(
        { text: `El post de referencia «${e.referencia.id}» (toma su oficio; no copies sus textos, su marca ni su plato):` },
        { inlineData: { mimeType: 'image/jpeg', data: await reducir(e.referencia.imagen, LADO_REFERENCIA) } },
      );
    }
    return this.cliente.generarJson(instruccionesDiseno(), partes, PropuestaDeDiseno);
  }
}
