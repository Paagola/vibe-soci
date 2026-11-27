// Rotulos medidos sobre el reel de referencia (720x1280 -> escala 1.5 a 1080 de ancho):
//  - sans geometrica (Montserrat, eje wght 400), blanco, UNA linea, cuerpo 30 px a 720 = 45 px a 1080 (altura de versal 21 px = 0.70 em)
//  - anchos de tinta medidos: "Old Fashioned" 214 px, "Espresso Martini" 243 px, "Hara // joyful" 181 px -> 29.7-29.9 px de cuerpo
//  - posicion fija durante todo el reel: tinta empieza en x=94/315/107 (a 720), linea de base 289/305/274 dentro de cada banda
// Uso: node rotulos.mjs [salida-dir]
import fontkit from '/Users/padre/Documents/victor/pantallas/pase-hydrogen/node_modules/fontkit/dist/main.cjs';
import sharp from '/Users/padre/Documents/victor/pantallas/pase-hydrogen/node_modules/sharp/dist/index.mjs';
const F = fontkit.openSync('/Users/padre/Documents/victor/pantallas/pase-hydrogen/recursos/tipografias/montserrat/Montserrat[wght].ttf');
export const PESO = 400, CUERPO = 45;
export const BANDAS = { // x de origen y linea de base en el lienzo de la banda (1080x640)
  'clover-club': { texto: 'Clover Club', x: 138, y: 433 },
  'old-fashioned': { texto: 'Old Fashioned', x: 470, y: 458 },
  'espresso-martini': { texto: 'Espresso Martini', x: 157, y: 411 },
};
export function trazo(texto, size, x, yBase, wght = PESO) {
  const font = F.getVariation({ wght }); const run = font.layout(texto); const k = size / font.unitsPerEm; let pen = x, d = '';
  run.glyphs.forEach((g, i) => { const p = g.path.toSVG(); if (p) d += `<path transform="translate(${pen},${yBase}) scale(${k},${-k})" d="${p}"/>`; pen += run.positions[i].xAdvance * k; });
  return d;
}
const sombra = '<filter id="s" x="-5%" y="-30%" width="110%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="#000" flood-opacity=".35"/></filter>';
export const svgRotulo = (id) => { const b = BANDAS[id]; return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="640"><defs>${sombra}</defs><g fill="#FFFFFF" filter="url(#s)">${trazo(b.texto, CUERPO, b.x, b.y)}</g></svg>`; };
if (process.argv[1].endsWith('rotulos.mjs')) {
  const out = process.argv[2] || '.';
  for (const id of Object.keys(BANDAS)) await sharp(Buffer.from(svgRotulo(id))).png().toFile(`${out}/rotulo-${id}.png`);
  const q = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></linearGradient>${sombra}</defs><rect x="0" y="1620" width="1080" height="300" fill="url(#gr)"/><g fill="#FFFFFF" filter="url(#s)">${trazo('¿Cuál pides?', 56, 138, 1840, 500)}</g></svg>`;
  await sharp(Buffer.from(q)).png().toFile(`${out}/pregunta.png`);
}
