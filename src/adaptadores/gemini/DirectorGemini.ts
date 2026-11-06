import { z } from 'zod';
import { Concepto, Plan } from '../../dominio/modelos.js';
import type { ContextoCreativo, DirectorCreativo, ImagenDeContexto, PeticionCorreccion, PropuestaCorreccion } from '../../puertos/DirectorCreativo.js';
import type { ProcesadorImagen } from '../../puertos/ProcesadorImagen.js';
import type { ClienteGemini, ParteGemini } from './ClienteGemini.js';
import { instruccionesBase, textoConceptos, textoCorreccion, textoEncargo, textoPlan, textoReferenciasVisuales } from './instrucciones.js';

/** Lado máximo de las fotos que mira el director: basta para ver el plato y no satura la petición. */
const LADO_VISION = 1536;
/** Los posts de referencia solo enseñan composición: con poco tamaño basta. */
const LADO_REFERENCIA = 512;

/** A veces el modelo devuelve la lista sin envolver: se acepta igual. */
const RespuestaConceptos = z.preprocess(
  (datos) => (Array.isArray(datos) ? { conceptos: datos } : datos),
  z.object({ conceptos: z.array(Concepto).length(3) }),
);
const RespuestaCorreccion = z.object({
  prompt: z.string().trim().min(50).max(5000),
  textos: z.array(z.string().trim().min(1).max(160)).max(8),
});

export class DirectorGemini implements DirectorCreativo {
  constructor(
    private readonly cliente: ClienteGemini,
    private readonly procesador: ProcesadorImagen,
  ) {}

  /** Para proponer, además de las fotos, mira los posts de referencia afines (es cuando más ayudan). */
  async proponerConceptos(contexto: ContextoCreativo, descartados: Concepto[]): Promise<Concepto[]> {
    const partes = [
      ...(await this.encargoConImagenes(contexto)),
      ...(await this.referenciasVisuales(contexto)),
      { text: textoConceptos(descartados, contexto.pieza.formato) },
    ];
    const respuesta = await this.cliente.generarJson(instruccionesBase(contexto.guia), partes, RespuestaConceptos);
    return respuesta.conceptos;
  }

  /** Para el plan basta la descripción de las referencias: el concepto ya está elegido y la petición pesa menos. */
  async planificar(contexto: ContextoCreativo, concepto: Concepto, problemasPrevios: string[]) {
    const referencias = textoReferenciasVisuales(contexto.guia);
    const partes: ParteGemini[] = [
      ...(await this.encargoConImagenes(contexto)),
      ...(referencias ? [{ text: referencias }] : []),
      { text: textoPlan(contexto, concepto, problemasPrevios) },
    ];
    return this.cliente.generarJson(instruccionesBase(contexto.guia), partes, Plan);
  }

  async corregir(contexto: ContextoCreativo, peticion: PeticionCorreccion, problemasPrevios: string[]): Promise<PropuestaCorreccion> {
    const fotosDeLaDiapositiva = contexto.fotos.filter((foto) => peticion.diapositiva.fotos.includes(foto.archivo));
    const partes: ParteGemini[] = [
      { text: textoEncargo(contexto) },
      ...(await this.imagenes([peticion.imagenAnterior, ...fotosDeLaDiapositiva])),
      { text: textoCorreccion(peticion, problemasPrevios) },
    ];
    return this.cliente.generarJson(instruccionesBase(contexto.guia), partes, RespuestaCorreccion);
  }

  private async encargoConImagenes(contexto: ContextoCreativo): Promise<ParteGemini[]> {
    const imagenes = [...contexto.fotos, ...(contexto.referenciaEstilo ? [contexto.referenciaEstilo] : [])];
    return [{ text: textoEncargo(contexto) }, ...(await this.imagenes(imagenes))];
  }

  private async referenciasVisuales(contexto: ContextoCreativo): Promise<ParteGemini[]> {
    const texto = textoReferenciasVisuales(contexto.guia);
    if (!texto) return [];
    return [{ text: texto }, ...(await this.imagenes(contexto.guia.referencias, LADO_REFERENCIA, 'Post de referencia'))];
  }

  /** Cada imagen va precedida de su nombre para que el director pueda citarla en el plan. */
  private async imagenes(imagenes: ImagenDeContexto[], lado = LADO_VISION, etiqueta = 'Imagen'): Promise<ParteGemini[]> {
    const partes = await Promise.all(
      imagenes.map(async (imagen): Promise<ParteGemini[]> => [
        { text: `${etiqueta} «${imagen.archivo}» · ${imagen.descripcion}:` },
        { inlineData: { mimeType: 'image/jpeg', data: (await this.procesador.reducir(imagen.ruta, lado)).toString('base64') } },
      ]),
    );
    return partes.flat();
  }
}
