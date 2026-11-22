/**
 * Estudio de arte con Gemini (Hydrogen, con visión): director de arte, crítico con rúbrica y comparador a ciegas.
 *
 * Gasto: una llamada por tanda de direcciones (dos si la primera no pasa), una de crítica por pieza y vuelta, y una de
 * comparación por encargo. Las imágenes van reducidas (la foto y las referencias a 640 px; la pieza a 900 px y a 360 px).
 */
import sharp from 'sharp';
import { z } from 'zod';
import { PropuestaDeDirecciones, PropuestaInspirada, Receta } from '../../dominio/arte/receta.js';
import { Critica } from '../../dominio/arte/rubrica.js';
import { mapaEnTexto } from '../../dominio/diseno/mapaDeFoto.js';
import type { ComparadorDeArte, CriticoDeArte, DirectorDeArte, EncargoDeArte, PiezaPintada } from '../../puertos/EstudioDeArte.js';
import type { ClienteGemini, ParteGemini } from './ClienteGemini.js';
import { PlanDeLote } from '../../dominio/arte/lote.js';
import {
  EvaluacionDeLote, instruccionesEvaluacionLote, instruccionesLote,
  instruccionesComparador, instruccionesComparadorConReferencia, instruccionesCriticoArte, instruccionesDirectorArte, instruccionesEnriquecer, instruccionesInspiradas, instruccionesPlantilla,
  RespuestaComparacion, RespuestaEnriquecer, RespuestaPlantilla,
} from './instruccionesArte.js';

const imagen = async (ruta: string, lado: number): Promise<ParteGemini> => ({
  inlineData: { mimeType: 'image/jpeg', data: (await sharp(ruta).rotate().flatten({ background: '#ffffff' }).resize(lado, lado, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer()).toString('base64') },
});

export function hechosEnTexto(e: EncargoDeArte): string {
  const h = e.hechos;
  return [
    'HECHOS (lo único que la pieza puede decir; cita de aquí, literal):',
    `  PLATO (nota del dueño): «${h.plato}»`,
    `  ELEMENTO (confirmados): ${h.elementos.map((x) => `«${x.nombre} ${x.estado}»`).join(' · ') || 'ninguno'}`,
    `  RECUENTO: ${h.elementos.filter((x) => x.recuento !== null).map((x) => `«${x.recuento} ${x.nombre}»`).join(' · ') || 'ninguno'}`,
    `  MARCA: ${[h.local.nombre, h.local.ciudad, h.local.descripcion, ...h.local.tonos, h.local.instagram ?? '', h.local.web ?? ''].filter(Boolean).map((t) => `«${t}»`).join(' · ')}`,
    `  CREATIVO: ${e.creativo ? 'permitido (como mucho dos textos creativos de hasta 4 palabras, sin cifras ni reclamos)' : 'no permitido'}`,
    `MENSAJE DE LA PIEZA: ${e.mensaje}`,
  ].join('\n');
}

function materialEnTexto(e: EncargoDeArte): string {
  return [
    mapaEnTexto(e.mapa),
    e.cortes.length ? `CORTES: la foto corta el producto por ${e.cortes.join(' y ')}: recortado, ese canto se ve recto; colócalo contra el borde del lienzo (producto «enorme» si corta por abajo) o usa FOTO_A_SANGRE / PARTIDA.` : 'CORTES: el producto está entero en la foto: se puede recortar y poner en cualquier sitio.',
    `COLORES: ${e.colores.map((c) => `@${c.token} ${c.hex} (${c.papel})`).join(' · ')}`,
    `VOCES: ${e.voces.map((v) => `${v.id} [${v.papel}]: ${v.descripcion}`).join(' · ')}`,
    ...(e.anteriores?.length ? [`YA HECHAS PARA ESTE LOCAL (no repitas su estructura): ${e.anteriores.join(' | ')}`] : []),
  ].join('\n');
}

export class EstudioArteGemini implements DirectorDeArte, CriticoDeArte, ComparadorDeArte {
  readonly nombre: string;

  constructor(
    private readonly cliente: ClienteGemini,
    modelos: string[],
  ) {
    this.nombre = `Gemini (${modelos.join(', respaldo ')})`;
  }

  async proponer(e: EncargoDeArte, devolver: string[]): Promise<PropuestaDeDirecciones> {
    const partes: ParteGemini[] = [
      { text: `${hechosEnTexto(e)}\n\n${materialEnTexto(e)}\n\nPropón ${e.direcciones} direcciones.` },
      { text: 'La FOTO del producto (el código la recorta con su máscara o la pone a sangre):' },
      await imagen(e.foto, 640),
    ];
    if (e.referencias.length) partes.push({ text: 'REFERENCIAS de oficio (de otros locales: toma decisiones, nunca sus textos, su marca ni su plato):' });
    for (const r of e.referencias) partes.push({ text: r.texto }, await imagen(r.ruta, 640));
    if (devolver.length) partes.push({ text: `TU PROPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS (corrígelos todos y devuelve las ${e.direcciones} direcciones enteras):\n${devolver.map((p) => `- ${p}`).join('\n')}` });
    return this.cliente.generarJson(instruccionesDirectorArte(), partes, PropuestaDeDirecciones);
  }

  /** Modo referencia: estudia la referencia (imagen y ficha) y propone direcciones hermanas que la mejoran. */
  async inspirar(e: EncargoDeArte, devolver: string[]): Promise<PropuestaInspirada> {
    if (!e.referencia) throw new Error('inspirar necesita una referencia');
    const partes: ParteGemini[] = [
      { text: `${hechosEnTexto(e)}\n\n${materialEnTexto(e)}\n\nPropón ${Math.min(3, Math.max(2, e.direcciones))} direcciones hermanas de la referencia.` },
      { text: `La REFERENCIA que eligió el cliente («${e.referencia.id}»)${e.referencia.ficha ? `, con su ficha: ${JSON.stringify(e.referencia.ficha)}` : ''}:` },
      await imagen(e.referencia.ruta, 900),
      { text: 'La FOTO del producto de este local (el código la recorta con su máscara o la pone a sangre):' },
      await imagen(e.foto, 640),
    ];
    if (devolver.length) partes.push({ text: `TU PROPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS (corrígelos todos):\n${devolver.map((p) => `- ${p}`).join('\n')}` });
    return this.cliente.generarJson(instruccionesInspiradas(), partes, PropuestaInspirada);
  }

  /** Planifica un lote de posts y carruseles para el local (tipos variados, fotos reales y generadas). */
  async planificarLote(e: EncargoDeArte, devolver: string[]): Promise<PlanDeLote> {
    const partes: ParteGemini[] = [
      { text: `${hechosEnTexto(e)}\n\n${materialEnTexto(e)}` },
      { text: 'La FOTO REAL del plato del local («foto: real»):' },
      await imagen(e.foto, 640),
    ];
    if (e.referencia) partes.push({ text: `Un post de REFERENCIA que le gusta al local («${e.referencia.id}»): tómalo como listón de oficio para la pieza de diseño gráfico, no lo copies.` }, await imagen(e.referencia.ruta, 640));
    if (devolver.length) partes.push({ text: `TU PLAN ANTERIOR TENÍA ESTOS PROBLEMAS (corrígelos todos y devuelve el plan entero):\n${devolver.map((p) => `- ${p}`).join('\n')}` });
    return this.cliente.generarJson(instruccionesLote(), partes, PlanDeLote);
  }

  /** Audita el lote entero (una hoja con todas las piezas a tamaño de móvil). */
  async evaluarLote(hoja: string, ids: string[], contexto: string): Promise<EvaluacionDeLote> {
    const partes: ParteGemini[] = [{ text: `${contexto}\n\nPiezas, en orden de lectura (de izquierda a derecha y de arriba abajo): ${ids.join(', ')}.` }, await imagen(hoja, 1600)];
    return this.cliente.generarJson(instruccionesEvaluacionLote(), partes, EvaluacionDeLote);
  }

  /** Mira la pieza pintada (y la referencia, si la hay) y propone elementos dibujados que le añadan oficio o carácter. */
  async enriquecer(e: EncargoDeArte, pieza: { png: string; receta: Receta; mapa?: string }): Promise<RespuestaEnriquecer> {
    const partes: ParteGemini[] = [
      { text: `${hechosEnTexto(e)}\n\nCOLORES: ${e.colores.map((c) => `@${c.token} ${c.hex}`).join(' · ')}\n\nLA RECETA DE LA PIEZA: ${JSON.stringify(pieza.receta)}${pieza.mapa ? `\n\nMAPA DE LA PIEZA (retícula 12 × 16; «#» = texto o producto, «.» = fondo libre):\n${pieza.mapa}` : ''}` },
      { text: 'La pieza ya maquetada:' },
      await imagen(pieza.png, 900),
    ];
    if (e.referencia) partes.push({ text: `La referencia de la que parte («${e.referencia.id}»):` }, await imagen(e.referencia.ruta, 700));
    return this.cliente.generarJson(instruccionesEnriquecer(), partes, RespuestaEnriquecer);
  }

  async reparar(e: EncargoDeArte, receta: Receta, problemas: string[]): Promise<Receta> {
    const partes: ParteGemini[] = [
      { text: `${hechosEnTexto(e)}\n\n${materialEnTexto(e)}` },
      { text: 'La FOTO del producto:' },
      await imagen(e.foto, 640),
      {
        text: [
          'REPARA UNA DIRECCIÓN. Esta receta no se puede ejecutar por estos problemas (los mide el código):',
          ...problemas.map((p) => `- ${p}`),
          `LA RECETA: ${JSON.stringify(receta)}`,
          'Corrígela sin cambiar su idea ni su nombre: cambia solo lo necesario (escala, lado, operaciones, textos que no constan o no caben). Devuelve {"direcciones": [la receta corregida]}.',
          // Lote-1 (22/11): con el plato llenando la foto, Hydrogen devolvía la misma firma y el mismo apoyo largos
          // («la marca se reconoce por su firma») y la receta volvía a no caber.
          'Si un texto pequeño «no cabe» o «no hay sitio», el código ya buscó en toda la foto: quítalo de verdad o acórtalo mucho. El apoyo es lo primero que sobra; la firma puede ir corta (el nombre corto del local) o no ir si la foto se sostiene sola. Si ni así cabe, cambia de esqueleto (p. ej. PRODUCTO_SOBRE_COLOR o EDITORIAL con el plato recortado) o de lado.',
        ].join('\n'),
      },
    ];
    const r = await this.cliente.generarJson(instruccionesDirectorArte(), partes, z.union([z.object({ direcciones: z.array(Receta).min(1).max(1) }), Receta]));
    return 'direcciones' in r ? r.direcciones[0]! : r;
  }

  async criticar(e: EncargoDeArte, p: PiezaPintada): Promise<Critica> {
    const partes: ParteGemini[] = [
      { text: `${hechosEnTexto(e)}\n\nCOLORES: ${e.colores.map((c) => `@${c.token} ${c.hex}`).join(' · ')}\nVOCES: ${e.voces.map((v) => `${v.id} [${v.papel}]`).join(' · ')}` },
      { text: `LA RECETA QUE SE PINTÓ:\n${JSON.stringify(p.receta)}` },
      { text: `MEDIDAS DEL CÓDIGO:\n${p.medidas.length ? p.medidas.map((m) => `- ${m}`).join('\n') : '- sin avisos'}` },
      { text: 'La pieza a tamaño de pantalla:' },
      await imagen(p.png, 900),
      { text: 'La misma pieza a tamaño de móvil (360 px de ancho), como se verá en el feed:' },
      await imagen(p.movil, 360),
      { text: 'La foto original del producto:' },
      await imagen(e.foto, 480),
    ];
    if (e.referencia) partes.push({ text: `La REFERENCIA que eligió el cliente («${e.referencia.id}»): puntúa también «referencia».` }, await imagen(e.referencia.ruta, 700));
    return this.cliente.generarJson(instruccionesCriticoArte(), partes, Critica);
  }

  /** Prueba de plantilla: piezas de varios locales, a ciegas; agrupa las que parecen la misma plantilla. */
  async agrupar(piezas: Array<{ letra: string; movil: string }>): Promise<RespuestaPlantilla> {
    const partes: ParteGemini[] = [];
    for (const p of piezas) partes.push({ text: `Pieza ${p.letra}:` }, await imagen(p.movil, 320));
    return this.cliente.generarJson(instruccionesPlantilla(), partes, RespuestaPlantilla);
  }

  async comparar(piezas: Array<{ letra: string; movil: string }>, referencia?: string): Promise<RespuestaComparacion> {
    const partes: ParteGemini[] = [];
    if (referencia) partes.push({ text: 'La REFERENCIA que eligió el cliente (no se puntúa; sirve de listón):' }, await imagen(referencia, 360));
    for (const p of piezas) partes.push({ text: `Pieza ${p.letra}:` }, await imagen(p.movil, 360));
    return this.cliente.generarJson(referencia ? instruccionesComparadorConReferencia() : instruccionesComparador(), partes, RespuestaComparacion);
  }
}
