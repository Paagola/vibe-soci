/**
 * Recurso gráfico procedural: una franja de papel rasgado (familia F7, post-24 y post-30), sin IA y sin coste.
 * Papel arrugado (ruido suave a dos escalas), borde superior rasgado (paseo aleatorio) con la fibra más clara
 * que deja el desgarro, y su máscara. Se guarda como activo del local para usarlo como «recorte».
 * Determinista: la misma semilla da el mismo papel.
 *
 * Uso: tsx src/herramientas/papelRasgado.ts --local L --id ID [--color "#141414"] [--fibra "#5a5550"] [--semilla 7]
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { Activo } from '../dominio/activos.js';
import { RAIZ, leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';

const { values } = parseArgs({
  options: { local: { type: 'string' }, id: { type: 'string' }, color: { type: 'string', default: '#141414' }, fibra: { type: 'string', default: '#5a5550' }, semilla: { type: 'string', default: '7' } },
});

const W = 2160;
const H = 900;

/** Generador pseudoaleatorio con semilla (mulberry32). */
function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

async function ruido(r: () => number, escala: number): Promise<Buffer> {
  const w = Math.ceil(W / escala), h = Math.ceil(H / escala);
  const b = Buffer.alloc(w * h);
  for (let i = 0; i < b.length; i++) b[i] = Math.floor(r() * 256);
  return sharp(b, { raw: { width: w, height: h, channels: 1 } }).resize(W, H, { kernel: 'cubic' }).blur(escala / 3).extractChannel(0).raw().toBuffer();
}

async function principal(): Promise<void> {
  const { local, id } = values;
  if (!local || !id) throw new Error('Faltan --local --id');
  const r = aleatorio(Number(values.semilla));
  // Borde rasgado: una onda irregular (suma de senos) con fibra fina encima, entre el 7 % y el 14 % de la altura.
  const fases = [r() * 6.3, r() * 6.3, r() * 6.3];
  const borde: number[] = [];
  let jitter = 0;
  for (let x = 0; x < W; x++) {
    jitter = jitter * 0.6 + (r() - 0.5) * 3.2;
    const onda = Math.sin(x / 210 + (fases[0] ?? 0)) * 14 + Math.sin(x / 67 + (fases[1] ?? 0)) * 6 + Math.sin(x / 23 + (fases[2] ?? 0)) * 2.5;
    borde.push(0.105 * H + onda + jitter);
  }
  // La fibra blanquecina del desgarro: más ancha donde el papel se rompió en bisel.
  const fibra = borde.map((b, x) => b + 3 + Math.abs(Math.sin(x / 41 + (fases[1] ?? 0))) * 7 + r() * 2.5);
  // Arrugas: facetas de Voronoi, cada una con su tono, y aristas que cogen luz.
  // Cada faceta es un plano inclinado: tono base y pendiente (gx, gy), como un papel que se ha arrugado y alisado.
  const puntos = Array.from({ length: 46 }, () => [r() * W, 0.05 * H + r() * 0.98 * H, (r() - 0.5) * 9, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05] as const);
  const [fino] = await Promise.all([ruido(r, 6)]);
  const [cr, cg, cb] = hex(values.color as string);
  const [fr, fg, fb] = hex(values.fibra as string);
  const rgba = Buffer.alloc(W * H * 4);
  const mascara = Buffer.alloc(W * H);
  for (let yy = 0; yy < H; yy++) {
    for (let x = 0; x < W; x++) {
      const i = yy * W + x;
      const top = borde[x] ?? 0;
      if (yy < top) continue;
      let d1 = Infinity, d2 = Infinity, tono = 0;
      for (const [px, py, t, gx, gy] of puntos) {
        const d = (px - x) * (px - x) + (py - yy) * (py - yy);
        if (d < d1) { d2 = d1; d1 = d; tono = t + gx * (x - px) + gy * (yy - py); } else if (d < d2) d2 = d;
      }
      const arista = Math.sqrt(d2) - Math.sqrt(d1);
      const luz = Math.max(-14, Math.min(14, tono)) + (arista < 3 ? 7 * (1 - arista / 3) : 0) + ((fino[i] ?? 128) - 128) * 0.07;
      const enFibra = yy < (fibra[x] ?? 0);
      const [r0, g0, b0] = enFibra ? [fr, fg, fb] : [cr, cg, cb];
      rgba[i * 4] = Math.max(0, Math.min(255, r0 + (enFibra ? 0 : luz)));
      rgba[i * 4 + 1] = Math.max(0, Math.min(255, g0 + (enFibra ? 0 : luz)));
      rgba[i * 4 + 2] = Math.max(0, Math.min(255, b0 + (enFibra ? 0 : luz)));
      rgba[i * 4 + 3] = 255;
      mascara[i] = 255;
    }
  }
  const carpeta = join(leerConfig().carpetaDatos, 'locales', local, 'activos', id);
  await mkdir(carpeta, { recursive: true });
  // Un desenfoque mínimo quita el aire de polígono de las aristas.
  const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).blur(0.9).png().toBuffer();
  await writeFile(join(carpeta, 'original.png'), png);
  await sharp(mascara, { raw: { width: W, height: H, channels: 1 } }).png().toFile(join(carpeta, 'mascara.png'));
  const sha = createHash('sha256').update(png).digest('hex');
  const activo = Activo.parse({
    id,
    localSlug: local,
    tipo: 'GENERADO',
    uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: 'Recurso gráfico procedural, no es producto: franja de papel rasgado y arrugado (familia F7, post-24 y post-30).',
    archivo: 'original.png',
    ancho: W,
    alto: H,
    sha256: sha,
    procedencia: {
      ruta: relative(RAIZ, join(carpeta, 'original.png')),
      sha256: sha,
      copiadoEn: new Date().toISOString(),
      derivacion: { operacion: 'papel-rasgado-procedural', entradas: {}, parametros: { color: values.color, fibra: values.fibra, semilla: Number(values.semilla), ancho: W, alto: H } },
    },
    alteraciones: [],
    mascara: { archivo: 'mascara.png', metodo: 'MANUAL', creadaEn: new Date().toISOString(), bbox: { x: 0, y: Math.floor(Math.min(...borde)), w: W, h: H - Math.floor(Math.min(...borde)) }, incluye: 'todo el papel, borde rasgado incluido' },
    niveles: [],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  console.log(`Papel ${id} → ${relative(RAIZ, carpeta)}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
