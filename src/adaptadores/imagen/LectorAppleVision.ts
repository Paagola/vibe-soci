/**
 * OCR local con Apple Vision (macOS): el mismo script que lee los carteles (leerCartel.swift), lanzado con
 * /usr/bin/swift. Sin red y sin coste. Fuera de macOS, o sin Swift, falla con un error claro (no finge que lee).
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { LectorDeTexto } from '../../puertos/LectorDeTexto.js';

const ejecutar = promisify(execFile);
const SWIFT = '/usr/bin/swift';
const SCRIPT = fileURLToPath(new URL('./leerCartel.swift', import.meta.url));

export class LectorAppleVision implements LectorDeTexto {
  readonly nombre = 'Apple Vision (OCR local)';

  /** Si se puede usar en esta máquina (macOS con Swift). Las pruebas que lo necesitan se saltan si no. */
  static disponible(): boolean {
    return process.platform === 'darwin' && existsSync(SWIFT);
  }

  async leer(png: Buffer): Promise<string[]> {
    if (!LectorAppleVision.disponible()) {
      throw new ErrorDeUsuario('El OCR de Apple Vision solo funciona en macOS con Swift (/usr/bin/swift). Usa --lector simulado o lanza la creación en un Mac.');
    }
    const carpeta = await mkdtemp(join(tmpdir(), 'estudio-ocr-'));
    try {
      const ruta = join(carpeta, 'panel.png');
      await writeFile(ruta, png);
      const { stdout } = await ejecutar(SWIFT, [SCRIPT, ruta], { timeout: 60_000, maxBuffer: 256_000 });
      return z.array(z.string()).parse(JSON.parse(stdout));
    } catch (error) {
      if (error instanceof ErrorDeUsuario) throw error;
      throw new ErrorDeUsuario(`Apple Vision no ha podido leer el panel: ${error instanceof Error ? error.message.slice(0, 300) : String(error)}`);
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }
}
