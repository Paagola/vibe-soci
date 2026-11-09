/**
 * Generación manual en la app de Gemini (cuando la clave de la API no admite el modelo): el paquete que se adjunta a mano
 * y la importación de lo que el usuario descarga, con su procedencia. Funciones puras.
 */
import { Activo } from '../../dominio/activos.js';
import type { RecetaGemini } from './recetaGemini.js';

export const VIA_MANUAL = 'APP_GEMINI_MANUAL';

/** En la app no se puede poner una etiqueta delante de cada imagen: el orden de adjunto hace de etiqueta. */
export function promptParaApp(prompt: string, etiquetas: string[], aspectRatio: string): string {
  const lista = etiquetas.map((etiqueta, i) => `- Attached image ${i + 1} = ${etiqueta}`).join('\n');
  const tokens = etiquetas.map((e) => e.split(' ')[0]).join(', ');
  return [
    `I am attaching ${etiquetas.length} images, in this order:`,
    lista,
    `Whenever the brief below says ${tokens}, it means that attached image.`,
    `Create ONE single new photograph, vertical, aspect ratio ${aspectRatio} (portrait), following the brief exactly. Reply with the image.`,
    '',
    'BRIEF:',
    prompt.trim(),
  ].join('\n');
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const slug = (s: string) => sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Nombre de cada imagen del paquete, numerado en el orden de adjunto. */
export function nombresDelPaquete(receta: RecetaGemini): string[] {
  return receta.referencias.map((r, i) => `${i + 1}-${slug(r.rol?.nombre ?? r.etiqueta)}.jpg`);
}

/** Generación externa a nuestras herramientas de API: a mano en la app de Gemini o por el MCP de Higgsfield (en una conversación). */
export type ViaExterna =
  | { via: typeof VIA_MANUAL; modeloDeclarado: string }
  | { via: typeof VIA_MCP_HIGGSFIELD; modeloPedido: string; modeloServido: string; trabajo: string; creditos: number; usdPorCredito: number };

export const VIA_MCP_HIGGSFIELD = 'MCP_HIGGSFIELD';

export interface Importacion {
  receta: RecetaGemini;
  intento: number;
  promptArchivo: string;
  prompt: string;
  referencias: Array<{ origen: string; sha256: string }>;
  archivo: string;
  ruta: string;
  ancho: number;
  alto: number;
  sha256: string;
  origen: ViaExterna;
  generadoEn: string;
  importadoEn: string;
  notas: string[];
}

export const idDeImportacion = (receta: RecetaGemini, intento: number, via: ViaExterna['via'] = VIA_MANUAL) =>
  `${receta.id}-${via === VIA_MANUAL ? 'app' : 'mcp'}-${intento}`;

/** El activo de una imagen generada fuera de nuestras herramientas: GENERADO, solo para pruebas, con toda la procedencia. */
export function activoDeImportacion(i: Importacion): Activo {
  const o = i.origen;
  const mcp = o.via === VIA_MCP_HIGGSFIELD;
  const costeUsd = mcp ? Math.round(o.creditos * o.usdPorCredito * 1000) / 1000 : 0;
  return Activo.parse({
    id: idDeImportacion(i.receta, i.intento, o.via),
    localSlug: i.receta.local,
    tipo: 'GENERADO',
    uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: [
      `${i.receta.descripcion} ${mcp ? `Generada por el MCP de Higgsfield (pedido ${o.modeloPedido}, servido ${o.modeloServido})` : 'Generada a mano en la app de Gemini'} (intento ${i.intento}).`,
      ...i.notas,
    ].join(' '),
    archivo: i.archivo,
    ancho: i.ancho,
    alto: i.alto,
    sha256: i.sha256,
    procedencia: {
      ruta: i.ruta,
      sha256: i.sha256,
      copiadoEn: i.importadoEn,
      generacion: {
        modelo: mcp ? `Higgsfield MCP · ${o.modeloServido} (pedido: ${o.modeloPedido})` : `app de Gemini · ${o.modeloDeclarado}`,
        requestId: mcp ? o.trabajo : `manual-${i.sha256.slice(0, 12)}`,
        promptArchivo: i.promptArchivo,
        prompt: i.prompt,
        parametros: { ...o, aspectRatioPedido: i.receta.parametros.aspectRatio, intento: i.intento },
        referencias: i.referencias.map((r) => ({ activo: r.origen, sha256: r.sha256 })),
        costeEstimadoUsd: costeUsd,
        tarifa: mcp
          ? `${o.creditos} créditos de Higgsfield (preflight get_cost); ≈ ${costeUsd} USD con ${o.usdPorCredito} USD por crédito, la relación del registro de la API`
          : 'generación manual del usuario en la app de Gemini; sin coste de API',
        generadoEn: i.generadoEn,
      },
    },
    alteraciones: i.receta.alteraciones,
    niveles: [],
  });
}
