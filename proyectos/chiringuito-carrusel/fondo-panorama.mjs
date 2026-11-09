// Fondo panorámico del carrusel continuo (5 diapositivas de 1080 × 1440): cal, mar con oleaje, arena y un sol que cruza
// de la diapositiva 1 a la 2. Procedural y determinista; se parte en 5 activos, uno por diapositiva.
// Uso: node proyectos/chiringuito-carrusel/fondo-panorama.mjs <carpeta-activos>
import { createRequire } from 'node:module'; import { mkdirSync, writeFileSync } from 'node:fs'; import { createHash } from 'node:crypto'; import { join } from 'node:path';
const sharp = createRequire(import.meta.url)('../../package.json') && createRequire(new URL('../../package.json', import.meta.url))('sharp');
const N = 5, W = 1080, H = 1440, PW = N * W;
const cal = '#F6F1E7', mar = '#1D78B4', marOscuro = '#13598A', espuma = '#FFFFFF', arena = '#EBCB8B', sol = '#F5B921';
const onda = (x, base, a1, p1, a2, p2, f) => base + a1 * Math.sin(x / p1 + f) + a2 * Math.sin(x / p2 + f * 1.7);
let mar1 = '', mar2 = '', esp = '', are = '';
for (let x = 0; x <= PW; x += 12) {
  mar1 += `${x},${onda(x, 0.6 * H, 26, 190, 12, 61, 0.4).toFixed(1)} `;
  mar2 += `${x},${onda(x, 0.69 * H, 18, 150, 8, 47, 2.1).toFixed(1)} `;
  esp += `${x},${onda(x, 0.79 * H, 14, 120, 6, 39, 1.2).toFixed(1)} `;
  are += `${x},${onda(x, 0.805 * H, 14, 120, 6, 39, 1.2).toFixed(1)} `;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${H}">
<rect width="${PW}" height="${H}" fill="${cal}"/>
<circle cx="${W}" cy="${0.27 * H}" r="${0.17 * W}" fill="${sol}"/>
<polygon points="0,${H} ${mar1} ${PW},${H}" fill="${mar}"/>
<polygon points="0,${H} ${mar2} ${PW},${H}" fill="${marOscuro}"/>
<polygon points="0,${H} ${esp} ${PW},${H}" fill="${espuma}"/>
<polygon points="0,${H} ${are} ${PW},${H}" fill="${arena}"/>
</svg>`;
const carpeta = process.argv[2];
const panorama = await sharp(Buffer.from(svg)).png().toBuffer();
for (let i = 0; i < N; i++) {
  const id = `fondo-panorama-${i + 1}`; const dir = join(carpeta, id); mkdirSync(dir, { recursive: true });
  const png = await sharp(panorama).extract({ left: i * W, top: 0, width: W, height: H }).png().toBuffer();
  writeFileSync(join(dir, 'original.png'), png);
  const sha = createHash('sha256').update(png).digest('hex');
  writeFileSync(join(dir, 'activo.json'), JSON.stringify({ id, localSlug: 'chiringuito-prueba', tipo: 'GENERADO', uso: 'SOLO_PRUEBA_COMPOSICION', descripcion: `Fondo procedural del carrusel continuo, trozo ${i + 1} de ${N} (cal, mar, espuma, arena y sol). Recurso gráfico, no es producto.`, archivo: 'original.png', ancho: W, alto: H, sha256: sha, procedencia: { ruta: `datos/locales/chiringuito-prueba/activos/${id}/original.png`, sha256: sha, copiadoEn: new Date().toISOString(), derivacion: { operacion: 'panorama-procedural', entradas: {}, parametros: { trozo: i + 1, de: N, colores: { cal, mar, marOscuro, espuma, arena, sol } } } }, alteraciones: [], niveles: [] }, null, 2) + '\n');
}
await sharp(panorama).resize(PW / 4).jpeg({ quality: 88 }).toFile(join(carpeta, '..', 'panorama-vista.jpg'));
console.log('ok');
