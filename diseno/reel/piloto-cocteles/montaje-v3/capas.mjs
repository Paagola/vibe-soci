// Efecto de aparicion por capas: el rotulo se descubre columna a columna en la estela de la copa.
// Por banda: extrae los fotogramas del arrastre, calcula el mate (diferencia con la barra vacia), sigue el borde de la copa
// y escribe una secuencia RGBA del rotulo enmascarado (tmp/<id>-tx/%03d.png).
// Copa que sale por la izquierda: se revelan las columnas x > borde derecho minimo alcanzado. Por la derecha: x < borde izquierdo maximo.
import sharp from '/Users/padre/Documents/victor/pantallas/pase-hydrogen/node_modules/sharp/dist/index.mjs';
import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
import { svgRotulo } from './rotulos.mjs';
const FIT = 'fps=25,scale=-2:640,crop=1080:640:(iw-1080)/2:0,setsar=1';
const W = 1080, H = 640, SUAVE = 28;
for (const [id, clip, lado] of [['clover-club', 'clover-arrastre', 'izq'], ['old-fashioned', 'old-arrastre', 'der'], ['espresso-martini', 'espresso-arrastre', 'izq']]) {
  const fr = `tmp/${id}-fr`, tx = `tmp/${id}-tx`; fs.rmSync(fr, { recursive: true, force: true }); fs.rmSync(tx, { recursive: true, force: true }); fs.mkdirSync(fr, { recursive: true }); fs.mkdirSync(tx, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `../brutos/v3/${clip}.mp4`, '-vf', FIT, `${fr}/%03d.png`]);
  const n = fs.readdirSync(fr).length; const grey = async (f) => (await sharp(f).greyscale().raw().toBuffer());
  const plate = await grey(`${fr}/${String(n).padStart(3, '0')}.png`);
  const rot = await sharp(Buffer.from(svgRotulo(id))).ensureAlpha().raw().toBuffer(); // RGBA 1080x640
  let borde = lado === 'izq' ? W : -1; // izq: minimo del borde derecho; der: maximo del borde izquierdo
  const traza = [];
  for (let i = 1; i <= n; i++) {
    const g = await grey(`${fr}/${String(i).padStart(3, '0')}.png`);
    const cnt = new Uint16Array(W);
    for (let y = 40; y < 460; y++) for (let x = 0; x < W; x++) if (Math.abs(g[y * W + x] - plate[y * W + x]) > 26) cnt[x]++;
    let lo = -1, hi = -1; for (let x = 0; x < W; x++) if (cnt[x] >= 10) { if (lo < 0) lo = x; hi = x; }
    if (lado === 'izq') { const r = hi < 0 ? 0 : hi; borde = Math.min(borde, r); } else { const l = lo < 0 ? W : lo; borde = Math.max(borde, l); }
    traza.push(borde);
    const out = Buffer.from(rot);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4 + 3; if (!out[k]) continue;
      const t = lado === 'izq' ? (x - borde) / SUAVE : (borde - x) / SUAVE;
      out[k] = Math.round(out[k] * Math.max(0, Math.min(1, t)));
    }
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 1 }).toFile(`${tx}/${String(i).padStart(3, '0')}.png`);
  }
  console.log(id, n, 'borde cada 10 fotogramas:', traza.filter((_, i) => i % 10 === 0).join(' '));
}
