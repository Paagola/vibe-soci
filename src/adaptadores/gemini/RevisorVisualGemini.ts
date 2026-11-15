/**
 * Revisor visual con Gemini (visión). Las tres preguntas de la comprobación de salida (dominio/comprobacionSalida.ts).
 * Los textos salen del prototipo probado el 09/11/2026 (proyectos/prueba-comprobacion-salida/), y la pasada C es nueva:
 * la foto entera reducida más cuatro recortes 2×2 a resolución completa (con un 15 % de solape), para contar cabezas y colas.
 * Solo pregunta y valida el formato; no decide nada.
 */
import sharp from 'sharp';
import { ChecklistVisual, ComparacionToma, ConteoAnatomia } from '../../dominio/comprobacionSalida.js';
import type { ParDeFotos, RevisorVisual } from '../../puertos/RevisorVisual.js';
import type { ClienteGemini, ParteGemini } from './ClienteGemini.js';

const LADO_COMPARACION = 1280;
const LADO_TESELA = 1400;
const SOLAPE = 0.15;

async function jpeg(entrada: string | Buffer, lado: number): Promise<ParteGemini> {
  const datos = await sharp(entrada).rotate().flatten({ background: '#ffffff' }).resize(lado, lado, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return { inlineData: { mimeType: 'image/jpeg', data: datos.toString('base64') } };
}

/** Cuatro recortes 2×2 con solape, de izquierda a derecha y de arriba abajo. */
export async function teselas(ruta: string): Promise<Buffer[]> {
  const imagen = sharp(ruta).rotate();
  const { width = 0, height = 0 } = await imagen.metadata();
  const w = Math.round((width / 2) * (1 + SOLAPE));
  const h = Math.round((height / 2) * (1 + SOLAPE));
  const xs = [0, width - w];
  const ys = [0, height - h];
  const recortes: Buffer[] = [];
  for (const top of ys) for (const left of xs) recortes.push(await sharp(ruta).rotate().extract({ left, top, width: w, height: h }).toBuffer());
  return recortes;
}

export const INSTRUCCIONES_CHECKLIST = `Eres el control de calidad de un estudio de fotografía gastronómica. Comparas la FOTO REAL de un plato (imagen 1) con una FOTO NUEVA generada por IA (imagen 2).
La foto nueva puede cambiar libremente la cámara, la luz, el fondo, la superficie, el encuadre y la colocación. NO puede cambiar los elementos del plato: qué son, cuántos hay, su anatomía ni la vajilla, ni añadir nada.
Mira la imagen 2 con mucho detalle, zona por zona, como si la ampliaras. Cuenta de verdad: cabezas, colas, cuerpos, piezas.
Respondes solo con JSON.`;

export function textoChecklist(lista: string, conReferencia = false): string {
  return `Lista confirmada de elementos de la foto real (tal como se pidió al generador):
«${lista}»

Para la imagen 2:
- "elementos": cada elemento de la lista con "esperado" (el número de la lista o null si no se cuenta), "visto" (lo que cuentas en la imagen 2, o null), "presente" y una "nota" breve.
- "anatomia": problemas de anatomía o forma (una cabeza o una cola de más o de menos, cuerpos fundidos, piezas cortadas que no deberían). Vacío si no hay.
- "anadidos": objetos, alimentos o vajilla de la imagen 2 que NO están en la lista (un posavasos, un plato de más, hierbas, un limón…). La superficie y el fondo no cuentan. Vacío si no hay.
- "textoNuevo": letras, palabras o logotipos visibles en la imagen 2 que NO están en la imagen 1. Vacío si no hay.
${conReferencia ? '- "copiadoDeReferencia": lo que la imagen 2 ha copiado de la imagen 3 (el post de referencia): sus letras, palabras o logotipos, su comida, sus objetos (palillos, papel, ramas, códigos QR…) o su composición de elementos. Copiar su luz, su ángulo, su fondo o su color NO cuenta. Vacío si no hay.\n' : ''}- "seguro": false si alguna respuesta es dudosa.
JSON: {"elementos":[{"nombre":"…","esperado":2,"visto":2,"presente":true,"nota":"…"}],"anatomia":[],"anadidos":[],"textoNuevo":[],${conReferencia ? '"copiadoDeReferencia":[],' : ''}"seguro":true}`;
}

export const INSTRUCCIONES_TOMA = `Eres un fotógrafo profesional. Te enseñan dos fotos del mismo plato: imagen 1 (la que hizo el restaurante) e imagen 2 (una foto nueva).
La pregunta es si la imagen 2 es OTRA TOMA o la MISMA TOMA con otra luz: si la cámara está en el mismo sitio respecto al plato. No estimes grados: compara.
Respondes solo con JSON.`;

export const TEXTO_TOMA = `Compara las dos fotos:
- "alturaReal" y "alturaNueva": desde dónde mira la cámara en cada una, en palabras (cenital, alta desde arriba, ¾, baja, a ras de mesa).
- "mismoLado": ¿se ve el plato desde el mismo lado?
- "mismaDistancia": ¿el plato ocupa más o menos lo mismo del encuadre?
- "mismoPuntoDeVista": true si un fotógrafo diría que la cámara está prácticamente en el mismo sitio (misma altura aproximada y mismo lado), aunque cambien la luz, el fondo o el encuadre.
- "mismaDistribucion": true si los elementos están colocados igual que en la imagen 1: las mismas piezas en las mismas posiciones relativas (lo que está a la izquierda sigue a la izquierda, la misma fila en el mismo orden), aunque cambien la luz, el fondo o la cámara. Una foto nueva tiene que recolocar el plato, no repetir su disposición.
- "explicacion": una frase.
JSON: {"alturaReal":"…","alturaNueva":"…","mismoLado":true,"mismaDistancia":true,"mismoPuntoDeVista":true,"mismaDistribucion":true,"explicacion":"…"}`;

export const INSTRUCCIONES_ANATOMIA = `Eres el control de calidad de un estudio de fotografía gastronómica. Cuentas piezas en una foto generada por IA, que a veces añade una cabeza, una cola o un cuerpo de más, o funde dos piezas en una.
Te doy la foto entera (reducida) y cuatro recortes a resolución completa: arriba a la izquierda, arriba a la derecha, abajo a la izquierda y abajo a la derecha. Los recortes se solapan un poco: una pieza que cae entre dos recortes es UNA sola.
Usa los recortes para ver el detalle y la foto entera para no contar dos veces. Respondes solo con JSON.`;

export function textoAnatomia(piezas: Array<{ nombre: string; esperado: number }>): string {
  return `Piezas que hay que contar en la foto ENTERA (no por recorte), con lo que se espera:
${piezas.map((p) => `- ${p.nombre}: se esperan ${p.esperado}`).join('\n')}

Para cada pieza:
- "cuerpos": cuántas piezas separadas e independientes ves (dos piezas fundidas en una cuentan como 1 y lo dices en "nota");
- "cabezas" y "colas": cuántas cabezas y cuántas colas ves en total, o null si esa pieza no tiene cabeza o cola (una taza, un churro, una carne);
- "nota": dónde está lo raro, si lo hay.
"seguro": false si alguna cuenta es dudosa.
JSON: {"piezas":[{"nombre":"…","esperado":2,"cabezas":2,"colas":2,"cuerpos":2,"nota":"…"}],"seguro":true}`;
}

export class RevisorVisualGemini implements RevisorVisual {
  readonly nombre: string;

  constructor(
    private readonly cliente: ClienteGemini,
    modelos: string[],
  ) {
    this.nombre = `Gemini (${modelos.join(', respaldo ')})`;
  }

  async comprobarElementos(fotos: ParDeFotos, lista: string) {
    const partes: ParteGemini[] = [{ text: 'Imagen 1 (foto real):' }, await jpeg(fotos.real, LADO_COMPARACION), { text: 'Imagen 2 (foto nueva):' }, await jpeg(fotos.generada, LADO_COMPARACION)];
    if (fotos.referencia) partes.push({ text: 'Imagen 3 (post de referencia que vio el generador, SOLO de estilo):' }, await jpeg(fotos.referencia, 768));
    partes.push({ text: textoChecklist(lista, Boolean(fotos.referencia)) });
    return this.cliente.generarJson(INSTRUCCIONES_CHECKLIST, partes, ChecklistVisual);
  }

  async compararToma(fotos: ParDeFotos) {
    return this.cliente.generarJson(
      INSTRUCCIONES_TOMA,
      [{ text: 'Imagen 1:' }, await jpeg(fotos.real, LADO_COMPARACION), { text: 'Imagen 2:' }, await jpeg(fotos.generada, LADO_COMPARACION), { text: TEXTO_TOMA }],
      ComparacionToma,
    );
  }

  async contarAnatomia(generada: string, piezas: Array<{ nombre: string; esperado: number }>) {
    const nombres = ['arriba a la izquierda', 'arriba a la derecha', 'abajo a la izquierda', 'abajo a la derecha'];
    const partes: ParteGemini[] = [{ text: 'Foto entera (reducida):' }, await jpeg(generada, LADO_COMPARACION)];
    for (const [i, recorte] of (await teselas(generada)).entries()) partes.push({ text: `Recorte ${nombres[i]}:` }, await jpeg(recorte, LADO_TESELA));
    partes.push({ text: textoAnatomia(piezas) });
    return this.cliente.generarJson(INSTRUCCIONES_ANATOMIA, partes, ConteoAnatomia);
  }
}
