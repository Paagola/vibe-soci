/**
 * F1 · Compositor con intenciones escritas a mano (DAK Burger). No usa Gemini ni genera imágenes: no gasta.
 *
 * Lee diseno/f1/plan.json y, para cada diseño y cada variante de activo, compone y guarda la versión entera
 * (intención, resuelto, PNG, SVG editable y exacto, capas y exportaciones 3:4 y 4:5). Después:
 *   - cambia solo un texto y vuelve a componer, para comprobar qué capas se repintan;
 *   - monta las hojas de revisión: diseños, comparativa con lo generado antes y capas de cada diseño.
 *
 * Uso: tsx src/herramientas/f1.ts [--salida <carpeta>] [--solo <id>]
 */
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import sharp, { type Blend, type OverlayOptions, type Sharp } from 'sharp';
import { CatalogoTipografico } from '../adaptadores/compositor/tipografias.js';
import { CompositorSharp } from '../adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../adaptadores/compositor/MotorTexto.js';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenDisenosFicheros } from '../adaptadores/ficheros/AlmacenDisenosFicheros.js';
import { ProcesadorSharp } from '../adaptadores/imagen/ProcesadorSharp.js';
import { componerDiseno, type ResultadoComponer } from '../aplicacion/diseno/componerDiseno.js';
import { RAIZ, leerConfig } from '../config.js';
import { Intencion, Tokens } from '../dominio/diseno/intencion.js';
import { conTexto } from '../dominio/diseno/operaciones.js';

interface Plan {
  marca: string;
  disenos: Array<{ intencion: string; variantes: Record<string, Record<string, string>> }>;
  edicion?: { diseno: string; variante: string; texto: string; valor: string };
}

const { values } = parseArgs({ options: { salida: { type: 'string' }, solo: { type: 'string' } } });
const CARPETA_F1 = join(RAIZ, 'diseno', 'f1');

async function principal(): Promise<void> {
  const config = leerConfig();
  const salida = resolve(values.salida ?? join(config.carpetaDatos, 'disenos', 'f1'));
  // La carpeta de salida es solo de este lanzador y se rehace entera en cada ejecución.
  // Por seguridad, solo se admite dentro de datos/disenos/ o de la carpeta temporal del sistema.
  const permitidas = [resolve(config.carpetaDatos, 'disenos'), resolve(tmpdir()), '/private/tmp', '/tmp'];
  if (!permitidas.some((p) => salida.startsWith(p + sep))) throw new Error(`La salida tiene que estar dentro de datos/disenos/ o de la carpeta temporal: ${salida}`);
  await rm(salida, { recursive: true, force: true });

  const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
  const motor = new MotorTexto(catalogo);
  const compositor = new CompositorSharp(motor, catalogo);
  const deps = {
    compositor,
    activos: new AlmacenActivosFicheros(join(config.carpetaDatos, 'locales')),
    disenos: new AlmacenDisenosFicheros(salida),
    procesador: new ProcesadorSharp(),
  };
  const plan = JSON.parse(await readFile(join(CARPETA_F1, 'plan.json'), 'utf8')) as Plan;
  const tokensMarca = Tokens.parse(JSON.parse(await readFile(join(CARPETA_F1, plan.marca), 'utf8')));

  const resultados = new Map<string, ResultadoComponer>();
  for (const diseno of plan.disenos) {
    if (values.solo && basename(diseno.intencion, '.json') !== values.solo) continue;
    const base = Intencion.parse(JSON.parse(await readFile(join(CARPETA_F1, diseno.intencion), 'utf8')));
    for (const [variante, activos] of Object.entries(diseno.variantes)) {
      const inicio = Date.now();
      const resultado = await componerDiseno(deps, { ...base, activos: { ...base.activos, ...activos } }, `${base.id}/${variante}`, { tokensMarca });
      resultados.set(`${base.id}/${variante}`, resultado);
      informar(`${base.id}/${variante}`, resultado, Date.now() - inicio);
    }
  }

  if (plan.edicion && (!values.solo || values.solo === plan.edicion.diseno)) {
    const previo = resultados.get(`${plan.edicion.diseno}/${plan.edicion.variante}`);
    if (previo) {
      const editada = conTexto(previo.intencion, plan.edicion.texto, plan.edicion.valor);
      const inicio = Date.now();
      const resultado = await componerDiseno(deps, editada, `${plan.edicion.diseno}/${plan.edicion.variante}`, {});
      const repintadas = resultado.renderizado.capas.filter((c) => !c.reutilizada).map((c) => c.id);
      const reutilizadas = resultado.renderizado.capas.filter((c) => c.reutilizada).map((c) => c.id);
      console.log(`\n✎ Edición «${plan.edicion.texto}» → «${plan.edicion.valor}» (v${editada.version}, ${Date.now() - inicio} ms)`);
      console.log(`  repintadas: ${repintadas.join(', ')}`);
      console.log(`  reutilizadas sin tocar: ${reutilizadas.join(', ')}`);
      resultados.set(`${plan.edicion.diseno}/${plan.edicion.variante}@v${editada.version}`, resultado);
    }
  }

  await hojas(salida, resultados, motor);
  console.log(`\nSalida: ${salida}`);
}

function informar(nombre: string, r: ResultadoComponer, ms: number): void {
  const reutilizadas = r.renderizado.capas.filter((c) => c.reutilizada).length;
  console.log(`\n■ ${nombre} · ${r.renderizado.capas.length} capas (${reutilizadas} reutilizadas) · ${ms} ms`);
  const m = r.resuelto.medidas;
  const lista = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' ');
  if (Object.keys(m.cobertura).length) console.log(`  cobertura: ${lista(m.cobertura)}`);
  if (Object.keys(m.solape).length) console.log(`  solape: ${lista(m.solape)}`);
  if (Object.keys(m.ampliacion).length) console.log(`  ampliación de la foto: ${lista(m.ampliacion)}`);
  if (Object.keys(m.contraste).length) console.log(`  contraste: ${lista(m.contraste)}`);
  for (const p of r.resuelto.problemas) console.log(`  ${p.gravedad === 'ERROR' ? '✖' : '!'} ${p.tipo}: ${p.mensaje}`);
}

// ------------------------------------------------------------------ Hojas de revisión

async function hojas(salida: string, resultados: Map<string, ResultadoComponer>, motor: MotorTexto): Promise<void> {
  const piezas = join(RAIZ, 'datos', 'piezas');
  const disenos = [...resultados.entries()].filter(([nombre]) => !nombre.includes('@'));
  await hoja(join(salida, 'hoja-disenos.jpg'), disenos.map(([nombre, r]) => ({ ruta: join(r.guardado.carpeta, 'diseno.png'), etiqueta: etiquetaDe(nombre, r) })), motor);

  const antiguas = [
    { ruta: join(piezas, '2026-11-03-la-manhattan-tower-tres-carnes', 'generadas', 'd1_v1.png'), etiqueta: 'ANTES · MARKETING-STUDIO (UNA PASADA)' },
    { ruta: join(piezas, '2026-11-03-manhattan-tower-la-torre-de', 'generadas', 'd1_v1.png'), etiqueta: 'ANTES · GROK (UNA PASADA)' },
  ];
  const nuevas = ['a-tres/composicion', 'b-alzado/composicion', 'c-ventana/fidelidad']
    .map((n) => resultados.get(n) && { ruta: join(resultados.get(n)!.guardado.carpeta, 'diseno.png'), etiqueta: etiquetaDe(n, resultados.get(n)!) })
    .filter((x): x is { ruta: string; etiqueta: string } => Boolean(x));
  if (nuevas.length) await hoja(join(salida, 'comparativa-antes-despues.jpg'), [...antiguas, ...nuevas], motor);

  for (const [nombre, r] of resultados) {
    const capas = r.renderizado.capas.map((c) => ({ png: c.png, etiqueta: `${String(c.z + 1).padStart(2, '0')} ${c.id.toUpperCase()}` }));
    await hojaDeCapas(join(r.guardado.carpeta, 'hoja-capas.jpg'), capas, motor);
    void nombre;
  }
}

function etiquetaDe(nombre: string, r: ResultadoComponer): string {
  const activo = Object.values(r.resuelto.activos)[0];
  const tipo = activo?.uso === 'PUBLICABLE' ? 'FOTO REAL' : 'ACTIVO DE PRUEBA (GROK)';
  return `NUEVO · ${nombre.split('/')[0]!.toUpperCase()} · ${tipo}`;
}

async function rotulo(motor: MotorTexto, texto: string, ancho: number): Promise<Buffer> {
  const estilo = { fuente: 'archivo', ejes: { wdth: 100, wght: 600 }, tracking: 0.08 };
  const d = motor.trazar(estilo, texto, 22, 4, 30);
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="44"><path d="${d}" fill="#111"/></svg>`)).png().toBuffer();
}

async function hoja(destino: string, celdas: Array<{ ruta: string; etiqueta: string }>, motor: MotorTexto): Promise<void> {
  const alto = 900;
  const ancho = Math.round((alto * 3) / 4);
  const piezas: OverlayOptions[] = [];
  for (const [i, celda] of celdas.entries()) {
    const imagen = await sharp(celda.ruta).resize(ancho, alto, { fit: 'cover' }).png().toBuffer();
    const x = 24 + i * (ancho + 24);
    piezas.push({ input: imagen, left: x, top: 24 }, { input: await rotulo(motor, celda.etiqueta, ancho), left: x, top: alto + 30 });
  }
  await sharp({ create: { width: 24 + celdas.length * (ancho + 24), height: alto + 84, channels: 3, background: '#ffffff' } })
    .composite(piezas)
    .jpeg({ quality: 88 })
    .toFile(destino);
}

async function hojaDeCapas(destino: string, capas: Array<{ png: Buffer; etiqueta: string }>, motor: MotorTexto): Promise<void> {
  const alto = 400;
  const ancho = 300;
  const columnas = 6;
  const filas = Math.ceil(capas.length / columnas);
  // Fondo a cuadros para que se vea qué parte de cada capa es transparente.
  const cuadros = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#7d7d7d"/><rect width="10" height="10" fill="#959595"/><rect x="10" y="10" width="10" height="10" fill="#959595"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
  );
  const fondo = await sharp(cuadros).png().toBuffer();
  const piezas: OverlayOptions[] = [];
  for (const [i, capa] of capas.entries()) {
    const x = 16 + (i % columnas) * (ancho + 16);
    const y = 16 + Math.floor(i / columnas) * (alto + 60);
    const miniatura = await sharp(fondo).composite([{ input: await sharp(capa.png).resize(ancho, alto).png().toBuffer() }]).png().toBuffer();
    piezas.push({ input: miniatura, left: x, top: y }, { input: await rotulo(motor, capa.etiqueta, ancho), left: x, top: y + alto + 6 });
  }
  await sharp({ create: { width: 16 + columnas * (ancho + 16), height: 16 + filas * (alto + 60), channels: 3, background: '#ffffff' } })
    .composite(piezas)
    .jpeg({ quality: 85 })
    .toFile(destino);
}

principal().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
