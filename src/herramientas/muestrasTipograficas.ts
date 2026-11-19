/**
 * Hoja de muestras de las tipografías especiales: cada tratamiento (derretida, papel, antigua, neón) sobre la fuente
 * de titular y los colores de cada local (marcas/<slug>/tokens.json). Pasa por el compositor de verdad, así que lo que
 * se ve es lo que saldría en una pieza. Sin IA y sin coste.
 *
 * Sirve para decidir a ojo qué tratamiento le va a cada identidad antes de usarlo en un post.
 * Escribe en una carpeta nueva de datos/disenos/muestras-tipograficas/ (nunca sobrescribe).
 *
 * Uso: npm run muestras-tipo [-- --locales torre-de-vega,cafe-albor] [--texto "Pulpo"]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { CompositorSharp } from '../adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../adaptadores/compositor/tipografias.js';
import { RAIZ } from '../config.js';
import { contraste, hexARgb } from '../dominio/diseno/color.js';
import { Intencion, Tokens } from '../dominio/diseno/intencion.js';

const { values } = parseArgs({ options: { locales: { type: 'string' }, texto: { type: 'string' } } });

const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
const compositor = new CompositorSharp(new MotorTexto(catalogo), catalogo);
const TRATAMIENTOS = ['derretida', 'papel', 'antigua', 'neon'] as const;

const croma = (hex: string) => {
  const rgb = hexARgb(hex);
  return Math.max(...rgb) - Math.min(...rgb);
};

/** El color claro, el oscuro y el acento (el más saturado) de la paleta del local. */
function paleta(tokens: Tokens): { claro: string; oscuro: string; acento: string } {
  const colores = Object.values(tokens.colores);
  const porLuz = [...colores].sort((a, b) => contraste(b, '#000000') - contraste(a, '#000000'));
  const claro = porLuz[0] ?? '#F2EEE8';
  const oscuro = porLuz.at(-1) ?? '#141414';
  const acento = [...colores].sort((a, b) => croma(b) - croma(a))[0] ?? claro;
  return { claro, oscuro, acento };
}

/** Fondo y color del texto de cada tratamiento, con los colores del local donde tienen sentido. */
function puesta(tratamiento: (typeof TRATAMIENTOS)[number], p: ReturnType<typeof paleta>): { fondo: string; texto: string } {
  switch (tratamiento) {
    case 'derretida':
      // Un líquido espeso se lee sobre oscuro; si el acento no destaca, el claro.
      return { fondo: p.oscuro, texto: contraste(p.acento, p.oscuro) >= 3 ? p.acento : p.claro };
    case 'papel':
      return { fondo: contraste(p.acento, p.claro) >= 3 ? p.claro : p.oscuro, texto: p.acento };
    case 'antigua':
      return { fondo: p.claro, texto: p.oscuro };
    case 'neon':
      return { fondo: '#0E0B12', texto: contraste(p.acento, '#0E0B12') >= 3 ? p.acento : p.claro };
  }
}

function nombreDe(slug: string): string {
  const ruta = join(RAIZ, 'datos', 'locales', slug, 'marca.json');
  if (!existsSync(ruta)) return slug;
  const marca = JSON.parse(readFileSync(ruta, 'utf8')) as { nombre?: string };
  return marca.nombre ?? slug;
}

const slugs = values.locales
  ? values.locales.split(',').map((s) => s.trim())
  : readdirSync(join(RAIZ, 'marcas')).filter((s) => existsSync(join(RAIZ, 'marcas', s, 'tokens.json')));

const hoy = new Date().toISOString().slice(0, 10);
let salida = join(RAIZ, 'datos', 'disenos', 'muestras-tipograficas', hoy);
for (let n = 2; existsSync(salida); n++) salida = join(RAIZ, 'datos', 'disenos', 'muestras-tipograficas', `${hoy}-${n}`);
await mkdir(salida, { recursive: true });

const W = 1080;
const H = 1440;
const filas: Buffer[][] = [];
for (const slug of slugs) {
  const tokens = Tokens.parse(JSON.parse(readFileSync(join(RAIZ, 'marcas', slug, 'tokens.json'), 'utf8')));
  const titular = tokens.estilos.titular ?? Object.values(tokens.estilos)[0];
  if (!titular) continue;
  const p = paleta(tokens);
  const texto = values.texto ?? nombreDe(slug);
  const fila: Buffer[] = [];
  for (const tratamiento of TRATAMIENTOS) {
    const { fondo, texto: tinta } = puesta(tratamiento, p);
    const intencion = Intencion.parse({
      esquema: 'diseno/intencion@1',
      id: `muestra-${slug}-${tratamiento}`,
      titulo: `${tratamiento} · ${slug}`,
      marca: slug,
      activos: {},
      tokens: { colores: { fondo, tinta }, estilos: { titular: { ...titular, color: '@tinta' } } },
      capas: [
        { id: 'fondo', tipo: 'relleno', color: '@fondo' },
        { id: 'titular', tipo: 'texto', texto, estilo: 'titular', caja: { x: 0.1, y: 0.36, w: 0.8, h: 0.2 }, ajuste: 'caja', alinear: 'centro', vertical: 'centro', tratamiento: { tipo: tratamiento } },
      ],
    });
    const resuelto = await compositor.resolver(intencion, {});
    for (const problema of resuelto.problemas) console.log(`  ${slug} · ${tratamiento}: ${problema.gravedad} ${problema.tipo}: ${problema.mensaje}`);
    const { png } = await compositor.renderizar(resuelto, {});
    await sharp(png).toFile(join(salida, `${slug}-${tratamiento}.png`));
    // En la hoja va la franja central, donde está el titular.
    fila.push(await sharp(png).extract({ left: 0, top: Math.round(H * 0.28), width: W, height: Math.round(H * 0.42) }).resize(Math.round(W * 0.4)).png().toBuffer());
  }
  filas.push(fila);
  console.log(`${slug}: ${titular.fuente} · «${texto}»`);
}

const celda = await sharp(filas[0]![0]!).metadata();
const cw = celda.width!;
const ch = celda.height!;
await sharp({ create: { width: cw * TRATAMIENTOS.length, height: ch * filas.length, channels: 3, background: '#000000' } })
  .composite(filas.flatMap((fila, j) => fila.map((input, i) => ({ input, left: i * cw, top: j * ch }))))
  .png()
  .toFile(join(salida, 'hoja.png'));
console.log(`Hoja: ${relative(RAIZ, join(salida, 'hoja.png'))} (columnas: ${TRATAMIENTOS.join(', ')})`);
