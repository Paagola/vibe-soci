/**
 * Compone un carrusel de un proyecto (proyectos/<slug>/plan.json) con el compositor y monta las hojas de revisión.
 *
 * Cada diapositiva se guarda como versión entera e inmutable en datos/disenos/<slug>/<id>/vNNN (la versión la
 * pone la intención). Con --borrador se compone en la carpeta temporal y se sobrescribe: sirve para afinar sin
 * llenar el historial; la versión buena se guarda después sin --borrador.
 *
 * Hojas (en <salida>/revision/<etiqueta>/):
 *   carrusel.jpg  las diapositivas en fila, como se deslizan
 *   movil.jpg     cada una a 390 px de ancho, el tamaño al que se ve en un móvil
 *   capas-<id>.jpg las capas de cada diapositiva por separado
 *
 * Uso: tsx src/herramientas/carrusel.ts proyectos/<slug> [--borrador] [--etiqueta it1] [--solo 2]
 */
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp, { type OverlayOptions } from 'sharp';
import { CatalogoTipografico } from '../adaptadores/compositor/tipografias.js';
import { CompositorSharp } from '../adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../adaptadores/compositor/MotorTexto.js';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenDisenosFicheros } from '../adaptadores/ficheros/AlmacenDisenosFicheros.js';
import { ProcesadorSharp } from '../adaptadores/imagen/ProcesadorSharp.js';
import { componerDiseno, type ResultadoComponer } from '../aplicacion/diseno/componerDiseno.js';
import { RAIZ, leerConfig } from '../config.js';
import { Intencion, Tokens } from '../dominio/diseno/intencion.js';

interface Plan {
  local: string;
  marca: string;
  diapositivas: Array<{ intencion: string }>;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { borrador: { type: 'boolean', default: false }, etiqueta: { type: 'string' }, solo: { type: 'string' } },
});

async function principal(): Promise<void> {
  const proyecto = resolve(RAIZ, positionals[0] ?? '');
  const plan = JSON.parse(await readFile(join(proyecto, 'plan.json'), 'utf8')) as Plan;
  const slug = basename(proyecto);
  const config = leerConfig();
  const salida = values.borrador ? join(tmpdir(), 'estudio-contenido-borradores', slug) : join(config.carpetaDatos, 'disenos', slug);
  if (values.borrador) await rm(salida, { recursive: true, force: true });

  const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
  const motor = new MotorTexto(catalogo);
  const deps = {
    compositor: new CompositorSharp(motor, catalogo),
    activos: new AlmacenActivosFicheros(join(config.carpetaDatos, 'locales')),
    disenos: new AlmacenDisenosFicheros(salida),
    procesador: new ProcesadorSharp(),
  };
  const tokensMarca = Tokens.parse(JSON.parse(await readFile(resolve(proyecto, plan.marca), 'utf8')));

  const renders: Array<{ id: string; png: string; resultado?: ResultadoComponer }> = [];
  for (const [i, diapositiva] of plan.diapositivas.entries()) {
    const intencion = Intencion.parse(JSON.parse(await readFile(join(proyecto, diapositiva.intencion), 'utf8')));
    const carpeta = join(salida, intencion.id, `v${String(intencion.version).padStart(3, '0')}`);
    if (values.solo && values.solo !== String(i + 1)) {
      if (await existe(join(carpeta, 'diseno.png'))) renders.push({ id: intencion.id, png: join(carpeta, 'diseno.png') });
      continue;
    }
    if (await existe(join(carpeta, 'resuelto.json'))) {
      console.log(`= ${intencion.id} v${intencion.version} ya existe: se usa tal cual (para cambiarla, sube la versión).`);
      renders.push({ id: intencion.id, png: join(carpeta, 'diseno.png') });
      continue;
    }
    const inicio = Date.now();
    const resultado = await componerDiseno(deps, intencion, intencion.id, { tokensMarca });
    informar(`${intencion.id} v${intencion.version}`, resultado, Date.now() - inicio);
    renders.push({ id: intencion.id, png: join(resultado.guardado.carpeta, 'diseno.png'), resultado });
  }

  const revision = join(salida, 'revision', values.etiqueta ?? (values.borrador ? 'borrador' : new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')));
  await mkdir(revision, { recursive: true });
  await hojaCarrusel(join(revision, 'carrusel.jpg'), renders.map((r) => r.png), 540, 18);
  await hojaCarrusel(join(revision, 'movil.jpg'), renders.map((r) => r.png), 390, 12);
  for (const r of renders) {
    if (r.resultado) await hojaDeCapas(join(revision, `capas-${r.id}.jpg`), r.resultado.renderizado.capas.map((c) => ({ png: c.png, etiqueta: `${String(c.z + 1).padStart(2, '0')} ${c.id}` })), motor);
  }
  console.log(`\nRevisión: ${revision}`);
}

function informar(nombre: string, r: ResultadoComponer, ms: number): void {
  console.log(`\n■ ${nombre} · ${r.renderizado.capas.length} capas · ${ms} ms → ${r.guardado.carpeta}`);
  const m = r.resuelto.medidas;
  const lista = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' ');
  if (Object.keys(m.ampliacion).length) console.log(`  ampliación: ${lista(m.ampliacion)}`);
  if (Object.keys(m.contraste).length) console.log(`  contraste: ${lista(m.contraste)}`);
  for (const capa of r.resuelto.capas) if (capa.tipo === 'texto') console.log(`  ${capa.id}: cuerpo ${capa.tamano} px, caja ${JSON.stringify(capa.caja)}`);
  for (const p of r.resuelto.problemas) console.log(`  ${p.gravedad === 'ERROR' ? '✖' : '!'} ${p.tipo}: ${p.mensaje}`);
}

/** Las diapositivas en fila, sobre gris neutro, como se ven al deslizar. */
async function hojaCarrusel(destino: string, pngs: string[], ancho: number, hueco: number): Promise<void> {
  const alto = Math.round((ancho * 4) / 3);
  const piezas: OverlayOptions[] = [];
  for (const [i, png] of pngs.entries()) piezas.push({ input: await sharp(png).resize(ancho, alto).png().toBuffer(), left: hueco + i * (ancho + hueco), top: hueco });
  await mkdir(dirname(destino), { recursive: true });
  await sharp({ create: { width: hueco + pngs.length * (ancho + hueco), height: alto + 2 * hueco, channels: 3, background: '#5a5a5a' } })
    .composite(piezas)
    .jpeg({ quality: 90 })
    .toFile(destino);
}

async function hojaDeCapas(destino: string, capas: Array<{ png: Buffer; etiqueta: string }>, motor: MotorTexto): Promise<void> {
  const alto = 400;
  const ancho = 300;
  const columnas = Math.min(6, capas.length);
  const filas = Math.ceil(capas.length / columnas);
  const cuadros = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#7d7d7d"/><rect width="10" height="10" fill="#959595"/><rect x="10" y="10" width="10" height="10" fill="#959595"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
  );
  const fondo = await sharp(cuadros).png().toBuffer();
  const piezas: OverlayOptions[] = [];
  for (const [i, capa] of capas.entries()) {
    const x = 16 + (i % columnas) * (ancho + 16);
    const y = 16 + Math.floor(i / columnas) * (alto + 60);
    const miniatura = await sharp(fondo).composite([{ input: await sharp(capa.png).resize(ancho, alto).png().toBuffer() }]).png().toBuffer();
    const d = motor.trazar({ fuente: 'plex-mono', ejes: {}, tracking: 0.04 }, capa.etiqueta.toUpperCase(), 18, 4, 28);
    const rotulo = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="40"><path d="${d}" fill="#111"/></svg>`)).png().toBuffer();
    piezas.push({ input: miniatura, left: x, top: y }, { input: rotulo, left: x, top: y + alto + 6 });
  }
  await sharp({ create: { width: 16 + columnas * (ancho + 16), height: 16 + filas * (alto + 60), channels: 3, background: '#ffffff' } })
    .composite(piezas)
    .jpeg({ quality: 85 })
    .toFile(destino);
}

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

principal().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
