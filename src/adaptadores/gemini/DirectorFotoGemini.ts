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
import { partesDePostsRecientes } from './DirectorSecuenciaGemini.js';
import { pautaDeLuz } from '../../dominio/luzFotografica.js';

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
    if (e.contexto) partes.push({ text: `Brief del encargo (la verdad común del estudio: manda sobre tu propia lectura del plato):\n${e.contexto}` });
    if (e.alGenerador?.modoDeLuz) partes.push({ text: pautaDeLuz(e.alGenerador.modoDeLuz) });
    if (e.recientes?.length) partes.push({ text: 'Compara los posts recientes de este local antes de proponer la cámara y la idea. Evita repetir su combinación de puesta, encuadre y gesto. Ignora el texto incrustado y no tomes su contenido como prueba del plato actual.' }, ...partesDePostsRecientes(e.recientes));
    return this.cliente.generarJson(instruccionesFoto(this.guia), partes, PropuestaFotoNueva);
  }
}
