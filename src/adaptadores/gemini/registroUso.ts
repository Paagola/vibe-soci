import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { UsoGemini } from './ClienteGemini.js';

/**
 * Registro de las llamadas de texto y visión a Gemini (director, revisor): datos/gasto/gemini-texto.jsonl.
 * Guarda los tokens que devuelve la API y si había facturación; el precio se calcula aparte con la tarifa vigente
 * (aquí no hay una tarifa comprobada de los modelos de texto, así que no se inventa).
 */
export function registradorDeUso(carpetaDatos: string, motivo: string, facturacion: boolean): (uso: UsoGemini) => void {
  const ruta = join(carpetaDatos, 'gasto', 'gemini-texto.jsonl');
  return (uso) => {
    mkdirSync(dirname(ruta), { recursive: true });
    appendFileSync(ruta, `${JSON.stringify({ fecha: new Date().toISOString(), motivo, tier: facturacion ? 'PAGO' : 'GRATUITO', ...uso })}\n`);
  };
}
