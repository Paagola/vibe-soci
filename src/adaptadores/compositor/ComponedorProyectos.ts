/**
 * Compone un proyecto (proyectos/<slug>/plan.json) con el compositor y monta las hojas de revisión (antes, todo dentro de
 * herramientas/carrusel.ts; ahora lo usan también la orden única).
 *
 * Cada diapositiva se guarda como versión entera e inmutable en <datos>/disenos/<slug>/<id>/vNNN (la versión la pone la
 * intención. Un resultado íntegro se puede reutilizar. Con `borrador` se compone en una carpeta temporal.
 *
 * Hojas (en <salida>/revision/<etiqueta>/): carrusel.jpg (en fila), movil.jpg (a 390 px) y capas-<id>.jpg.
 */
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import sharp, { type OverlayOptions } from 'sharp';
import { z } from 'zod';
import { componerDiseno, type ResultadoComponer } from '../../aplicacion/diseno/componerDiseno.js';
import { Intencion, Tokens } from '../../dominio/diseno/intencion.js';
import { conTokensDeMarca } from '../../dominio/diseno/operaciones.js';
import { nombreDeCapa } from '../../dominio/diseno/resuelto.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ComponedorDePiezas, DiapositivaCompuesta, PiezaCompuesta } from '../../puertos/ComponedorDePiezas.js';
import { AlmacenActivosFicheros } from '../ficheros/AlmacenActivosFicheros.js';
import { AlmacenDisenosFicheros } from '../ficheros/AlmacenDisenosFicheros.js';
import { ProcesadorSharp } from '../imagen/ProcesadorSharp.js';
import { CompositorSharp } from './CompositorSharp.js';
import { MotorTexto } from './MotorTexto.js';
import { CatalogoTipografico } from './tipografias.js';

interface Plan {
  local: string;
  marca: string;
  diapositivas: Array<{ intencion: string }>;
}

const ResueltoGuardado = z.object({
  esquema: z.literal('diseno/resuelto@1'),
  intencion: z.object({ id: z.string(), version: z.int() }),
  capas: z.array(z.object({ id: z.string(), z: z.int() })),
  problemas: z.array(z.object({ gravedad: z.enum(['ERROR', 'AVISO']), tipo: z.string(), mensaje: z.string() })),
  activos: z.record(z.string(), z.object({ id: z.string(), sha256: z.string(), uso: z.string(), tipo: z.string(), alteraciones: z.array(z.string()) })),
});

const carpetaDeVersion = (version: number) => `v${String(version).padStart(3, '0')}`;
const nombreDeExportacion = (i: Intencion) => i.lienzo.formato === 'HISTORIA_9_16' ? ['9x16.jpg'] : ['3x4.jpg', '4x5.jpg'];

async function versionesEn(carpeta: string): Promise<number[]> {
  const entradas = await readdir(carpeta).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  return entradas.filter((n) => /^v\d+$/.test(n)).map((n) => Number(n.slice(1))).sort((a, b) => b - a);
}

async function leerVersion(
  base: string, version: number, intencion: Intencion, activos: AlmacenActivos,
): Promise<DiapositivaCompuesta | undefined> {
  const carpeta = join(base, carpetaDeVersion(version));
  const leer = async (nombre: string) => JSON.parse(await readFile(join(carpeta, nombre), 'utf8')) as unknown;
  const guardada = Intencion.safeParse(await leer('intencion.json').catch(() => undefined));
  if (!guardada.success || !isDeepStrictEqual(guardada.data, { ...intencion, version })) return undefined;
  const documento = ResueltoGuardado.safeParse(await leer('resuelto.json').catch(() => undefined));
  if (!documento.success || documento.data.intencion.id !== intencion.id || documento.data.intencion.version !== version) return undefined;
  const { capas, problemas } = documento.data;
  const png = join(carpeta, 'diseno.png');
  const baseDiapositiva = { id: intencion.id, version, carpeta, png, problemas };
  const pngLegible = await sharp(png, { failOn: 'warning' }).stats().then(() => true, () => false);
  if (!pngLegible) return undefined;
  if (problemas.some((p) => p.gravedad === 'ERROR')) return { ...baseDiapositiva, reutilizada: false };

  const ficheros = [
    'diseno.svg', 'diseno-trazos.svg',
    ...capas.map((c) => join('capas', nombreDeCapa(c))),
    ...nombreDeExportacion(intencion).map((n) => join('exportadas', n)),
  ];
  if (!(await Promise.all(ficheros.map((nombre) => tieneContenido(join(carpeta, nombre))))).every(Boolean)) return undefined;
  for (const [papel, id] of Object.entries(intencion.activos)) {
    const { activo } = await activos.obtener(intencion.marca, id);
    const actual = { id, sha256: activo.sha256, uso: activo.uso, tipo: activo.tipo, alteraciones: activo.alteraciones };
    if (!isDeepStrictEqual(documento.data.activos[papel], actual)) return undefined;
  }
  return { ...baseDiapositiva, reutilizada: true };
}

/** Donde se componen los borradores (`borrador: true`): una carpeta por proyecto, que se sobrescribe cada vez. */
export const CARPETA_DE_BORRADORES = join(tmpdir(), 'estudio-contenido-borradores');

export class ComponedorProyectos implements ComponedorDePiezas {
  constructor(
    private readonly raiz: string,
    private readonly carpetaDatos: string,
  ) {}

  async componer(rutaProyecto: string, opciones: { borrador?: boolean; etiqueta?: string; solo?: string; informar?: (linea: string) => void } = {}): Promise<PiezaCompuesta> {
    const log = opciones.informar ?? (() => {});
    const proyecto = resolve(this.raiz, rutaProyecto);
    const plan = JSON.parse(await readFile(join(proyecto, 'plan.json'), 'utf8')) as Plan;
    const slug = basename(proyecto);
    const salida = opciones.borrador ? join(CARPETA_DE_BORRADORES, slug) : join(this.carpetaDatos, 'disenos', slug);
    if (opciones.borrador) await rm(salida, { recursive: true, force: true });

    const catalogo = new CatalogoTipografico(join(this.raiz, 'recursos', 'tipografias'));
    const motor = new MotorTexto(catalogo);
    const deps = {
      compositor: new CompositorSharp(motor, catalogo),
      activos: new AlmacenActivosFicheros(join(this.carpetaDatos, 'locales')),
      disenos: new AlmacenDisenosFicheros(salida),
      procesador: new ProcesadorSharp(),
    };
    const tokensMarca = Tokens.parse(JSON.parse(await readFile(resolve(proyecto, plan.marca), 'utf8')));

    const renders: Array<{ id: string; png: string; resultado?: ResultadoComponer }> = [];
    const diapositivas: DiapositivaCompuesta[] = [];
    for (const [i, diapositiva] of plan.diapositivas.entries()) {
      const solicitada = Intencion.parse(JSON.parse(await readFile(join(proyecto, diapositiva.intencion), 'utf8')));
      const base = join(salida, solicitada.id);
      const versiones = await versionesEn(base);
      const aplicada = conTokensDeMarca(solicitada, tokensMarca);
      let existente: DiapositivaCompuesta | undefined;
      for (const version of versiones.filter((v) => v >= solicitada.version)) {
        existente = await leerVersion(base, version, aplicada, deps.activos);
        if (existente) break;
      }
      if (existente) {
        const { id, version, png, reutilizada, problemas } = existente;
        log(reutilizada ? `= ${id} v${version}: se reutiliza.` : `✖ ${id} v${version}: conserva sus errores de composición.`);
        if (!reutilizada) for (const p of problemas) log(`  ${p.gravedad === 'ERROR' ? '✖' : '!'} ${p.tipo}: ${p.mensaje}`);
        renders.push({ id, png });
        diapositivas.push(existente);
        continue;
      }
      if (opciones.solo && opciones.solo !== String(i + 1)) continue;

      const version = Math.max(solicitada.version, (versiones[0] ?? 0) + 1);
      const intencion = { ...solicitada, version };
      const inicio = Date.now();
      const resultado = await componerDiseno(deps, intencion, intencion.id, { tokensMarca });
      informar(log, `${intencion.id} v${intencion.version}`, resultado, Date.now() - inicio);
      renders.push({ id: intencion.id, png: join(resultado.guardado.carpeta, 'diseno.png'), resultado });
      diapositivas.push({
        id: intencion.id,
        version: intencion.version,
        carpeta: resultado.guardado.carpeta,
        png: join(resultado.guardado.carpeta, 'diseno.png'),
        reutilizada: false,
        problemas: resultado.resuelto.problemas.map((p) => ({ gravedad: p.gravedad === 'ERROR' ? 'ERROR' : 'AVISO', tipo: String(p.tipo), mensaje: p.mensaje })),
      });
    }

    const revision = join(salida, 'revision', opciones.etiqueta ?? (opciones.borrador ? 'borrador' : new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')));
    await mkdir(revision, { recursive: true });
    await hojaCarrusel(join(revision, 'carrusel.jpg'), renders.map((r) => r.png), 540, 18);
    await hojaCarrusel(join(revision, 'movil.jpg'), renders.map((r) => r.png), 390, 12);
    for (const r of renders) {
      if (r.resultado) await hojaDeCapas(join(revision, `capas-${r.id}.jpg`), r.resultado.renderizado.capas.map((c) => ({ png: c.png, etiqueta: `${String(c.z + 1).padStart(2, '0')} ${c.id}` })), motor);
    }
    return { salida, revision, diapositivas };
  }
}

function informar(log: (linea: string) => void, nombre: string, r: ResultadoComponer, ms: number): void {
  log(`\n■ ${nombre} · ${r.renderizado.capas.length} capas · ${ms} ms → ${r.guardado.carpeta}`);
  const m = r.resuelto.medidas;
  const lista = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' ');
  if (Object.keys(m.ampliacion).length) log(`  ampliación: ${lista(m.ampliacion)}`);
  if (Object.keys(m.contraste).length) log(`  contraste: ${lista(m.contraste)}`);
  for (const capa of r.resuelto.capas) if (capa.tipo === 'texto') log(`  ${capa.id}: cuerpo ${capa.tamano} px, caja ${JSON.stringify(capa.caja)}`);
  for (const p of r.resuelto.problemas) log(`  ${p.gravedad === 'ERROR' ? '✖' : '!'} ${p.tipo}: ${p.mensaje}`);
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

const tieneContenido = (ruta: string) => stat(ruta).then((f) => f.isFile() && f.size > 0, () => false);
