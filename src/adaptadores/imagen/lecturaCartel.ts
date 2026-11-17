import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { coincideTexto } from '../../aplicacion/taller/direccion.js';

const ejecutar = promisify(execFile);
export async function leerCartel(ruta: string, esperadas: string[]) {
  if (process.platform === 'darwin') {
    try {
      const swift = fileURLToPath(new URL('./leerCartel.swift', import.meta.url));
      const { stdout } = await ejecutar('/usr/bin/swift', [swift, ruta], { timeout: 25_000, maxBuffer: 128_000 });
      const lineas = z.array(z.string()).parse(JSON.parse(stdout));
      return { motor: 'Apple Vision', lineas, coincide: coincideTexto(esperadas, lineas) };
    } catch { /* En otros entornos la transcripción humana sigue disponible. */ }
  }
  return { motor: 'Lectura manual', lineas: [], coincide: null };
}
