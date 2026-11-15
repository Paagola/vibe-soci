/**
 * Director de fotografía con Gemini: rellena la plantilla de foto nueva (dominio/fotoNueva.ts) mirando la foto subida y,
 * si la hay, la referencia del post (que no va al generador). Instrucciones en instruccionesFoto.ts.
 */
import sharp from 'sharp';
import { PropuestaFotoNueva } from '../../dominio/fotoNueva.js';
import type { GuiaCreativa } from '../../puertos/BibliotecaCreativa.js';
import type { DirectorDeFoto, EncargoDeFoto } from '../../puertos/Foto.js';
import type { ClienteGemini, ParteGemini } from './ClienteGemini.js';
import { instruccionesFoto, textoFotoNueva } from './instruccionesFoto.js';

const reducir = async (ruta: string, lado: number) =>
  (await sharp(ruta).rotate().resize(lado, lado, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()).toString('base64');

export class DirectorFotoGemini implements DirectorDeFoto {
  readonly nombre: string;

  constructor(
    private readonly cliente: ClienteGemini,
    private readonly guia: GuiaCreativa,
    modelos: string[],
  ) {
    this.nombre = `Gemini (${modelos.join(', respaldo ')})`;
  }

  async proponer(e: EncargoDeFoto, problemasPrevios: string[]): Promise<PropuestaFotoNueva> {
    const meta = await sharp(e.foto).metadata();
    const archivo = 'fotos/01-plato.jpg';
    const encargo = {
      plato: e.plato,
      archivo,
      ancho: meta.width ?? 0,
      alto: meta.height ?? 0,
      ...(e.referencia ? { referencia: { id: e.referencia.id, resumen: e.referencia.resumen } } : {}),
      ...(e.alGenerador ? { alGenerador: e.alGenerador } : {}),
      ...(e.formato ? { formato: e.formato } : {}),
    };
    const partes: ParteGemini[] = [
      { text: textoFotoNueva(encargo, problemasPrevios) },
      { text: `Imagen «${archivo}» · ${e.plato}:` },
      { inlineData: { mimeType: 'image/jpeg', data: await reducir(e.foto, 1536) } },
    ];
    if (e.referencia?.imagen) {
      partes.push(
        { text: `Post de referencia «${e.referencia.id}» (solo para ti, no se envía al generador):` },
        { inlineData: { mimeType: 'image/jpeg', data: await reducir(e.referencia.imagen, 768) } },
      );
    }
    return this.cliente.generarJson(instruccionesFoto(this.guia), partes, PropuestaFotoNueva);
  }
}
