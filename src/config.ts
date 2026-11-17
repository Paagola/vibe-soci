import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MODELO_POR_DEFECTO, MODELOS_HIGGSFIELD, type Resolucion } from './adaptadores/higgsfield/modelos.js';
import { validar } from './dominio/validacion.js';

/** Carpeta del proyecto, para que los comandos funcionen desde cualquier directorio. */
export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const MODELO_PRODUCTOR_GEMINI = 'gemini-4-hydrogen';

const vacioComoAusente = (valor: unknown) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor);
/** Una variable vacía en .env cuenta como no puesta: así se aplica el valor por defecto. */
const opcional = <T extends z.ZodType>(esquema: T) => z.preprocess(vacioComoAusente, esquema.optional());

const Entorno = z.object({
  OPENAI_API_KEY: opcional(z.string().trim()),
  OPENAI_TALLER_ENVIOS: opcional(z.coerce.number().int().min(0).max(10000)),
  GEMINI_API_KEY: opcional(z.string().trim()),
  GEMINI_MODELO: opcional(z.string().trim()),
  GEMINI_MODELO_RESPALDO: opcional(z.string().trim()),
  GEMINI_MODELO_PRODUCTOR: opcional(z.string().trim()),
  GEMINI_MODELO_PRODUCTOR_RESPALDO: opcional(z.string().trim()),
  GEMINI_FACTURACION: opcional(z.enum(['si', 'no'])),
  GEMINI_TOPE_USD: opcional(z.coerce.number().positive()),
  GEMINI_MODELO_IMAGEN: opcional(z.string().trim()),
  HF_KEY: opcional(z.string().trim().regex(/^[^:\s]+:\S+$/, 'tiene que ser KEY_ID:KEY_SECRET')),
  HF_MODELO: opcional(
    z.string().refine((id) => id in MODELOS_HIGGSFIELD, `tiene que ser uno de: ${Object.keys(MODELOS_HIGGSFIELD).join(', ')}`),
  ),
  HF_RESOLUCION: opcional(z.enum(['1k', '2k', '4k'])),
  LIMITE_IMAGENES_DIA: opcional(z.coerce.number().int().min(1)),
  ESTUDIO_DATOS: opcional(z.string()),
  ESTUDIO_DATOS_SIMULADO: opcional(z.string()),
  ESTUDIO_BIBLIOTECA: opcional(z.string()),
  ESTUDIO_PRODUCTOR: opcional(z.enum(['si', 'no'])),
  ESTUDIO_ZONA_HORARIA: opcional(z.string().trim().refine(esZonaHoraria, 'tiene que ser una zona horaria IANA, p. ej. Europe/Madrid')),
});

function esZonaHoraria(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('es-ES', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

export interface Config {
  openaiApiKey?: string;
  openaiTallerEnvios?: number;
  geminiApiKey?: string;
  geminiModelo: string;
  /** Se usa si el principal está saturado. */
  geminiModeloRespaldo?: string;
  /** Modelo de texto y visión de la orden con Productor. */
  geminiModeloProductor?: string;
  geminiModeloProductorRespaldo?: string;
  /** Indica si la clave tiene facturación activa. La generación de imágenes por la API la requiere. */
  geminiFacturacion: boolean;
  /** Tope acumulado de gasto en Gemini (imagen), que comprueba el código antes de cada envío. Google solo avisa. */
  geminiTopeUsd: number;
  /** Modelo de imagen de la vía de producción. */
  geminiModeloImagen: string;
  hfKey?: string;
  hfModelo: string;
  hfResolucion: Resolucion;
  limiteImagenesDia: number;
  carpetaDatos: string;
  /** Lo que se hace en modo simulado vive aquí y nunca se mezcla con lo real. */
  carpetaDatosSimulado: string;
  carpetaBiblioteca: string;
  /** Para saber qué es «hoy» en el límite diario. */
  zonaHoraria: string;
  /** El productor (orquestador) del encargo: apagado salvo ESTUDIO_PRODUCTOR=si. */
  productor?: boolean;
}

export function leerConfig(entorno: NodeJS.ProcessEnv = process.env): Config {
  const e = validar(Entorno, entorno, 'La configuración (.env) no es válida.');
  const ruta = (carpeta: string) => (isAbsolute(carpeta) ? carpeta : resolve(RAIZ, carpeta));
  return {
    openaiApiKey: e.OPENAI_API_KEY, openaiTallerEnvios: e.OPENAI_TALLER_ENVIOS ?? 0,
    geminiApiKey: e.GEMINI_API_KEY,
    geminiModelo: e.GEMINI_MODELO ?? 'gemini-3.8-flash',
    geminiModeloRespaldo: e.GEMINI_MODELO_RESPALDO ?? 'gemini-3.5-flash',
    geminiModeloProductor: e.GEMINI_MODELO_PRODUCTOR ?? MODELO_PRODUCTOR_GEMINI,
    geminiModeloProductorRespaldo: e.GEMINI_MODELO_PRODUCTOR_RESPALDO,
    geminiFacturacion: e.GEMINI_FACTURACION === 'si',
    geminiTopeUsd: e.GEMINI_TOPE_USD ?? 1,
    geminiModeloImagen: e.GEMINI_MODELO_IMAGEN ?? 'gemini-3-pro-image',
    hfKey: e.HF_KEY,
    hfModelo: e.HF_MODELO ?? MODELO_POR_DEFECTO,
    hfResolucion: e.HF_RESOLUCION ?? '4k',
    limiteImagenesDia: e.LIMITE_IMAGENES_DIA ?? 40,
    carpetaDatos: ruta(e.ESTUDIO_DATOS ?? 'datos'),
    carpetaDatosSimulado: ruta(e.ESTUDIO_DATOS_SIMULADO ?? 'datos-simulado'),
    carpetaBiblioteca: ruta(e.ESTUDIO_BIBLIOTECA ?? 'biblioteca'),
    zonaHoraria: e.ESTUDIO_ZONA_HORARIA ?? 'Europe/Madrid',
    productor: e.ESTUDIO_PRODUCTOR === 'si',
  };
}
