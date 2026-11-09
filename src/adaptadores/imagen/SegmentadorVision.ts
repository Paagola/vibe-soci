/**
 * Máscara del sujeto con Apple Vision (macOS, local, sin red): src/herramientas/mascara.swift, compilado la primera vez.
 * Adaptador sustituible (decisión del 06/11/2026: Apple Vision solo como adaptador local).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Segmentador } from '../../puertos/Foto.js';

export class SegmentadorVision implements Segmentador {
  readonly metodo = 'APPLE_VISION' as const;

  constructor(private readonly raiz: string) {}

  async mascara(ruta: string): Promise<Buffer> {
    const herramienta = join(this.raiz, 'node_modules', '.cache', 'estudio-contenido', 'mascara');
    if (!(await stat(herramienta).then(() => true, () => false))) {
      await mkdir(join(herramienta, '..'), { recursive: true });
      execFileSync('swiftc', ['-O', join(this.raiz, 'src', 'herramientas', 'mascara.swift'), '-o', herramienta], { stdio: 'inherit' });
    }
    const carpeta = await mkdtemp(join(tmpdir(), 'estudio-mascara-'));
    try {
      const salida = join(carpeta, 'mascara.png');
      execFileSync(herramienta, [ruta, salida], { stdio: 'inherit' });
      const { width = 0, height = 0 } = await sharp(ruta).metadata();
      return await sharp(await readFile(salida)).resize(width, height, { fit: 'fill' }).extractChannel(0).png().toBuffer();
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }
}
