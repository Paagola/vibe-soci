/**
 * Métricas de una corrida del estudio de arte (datos/arte/<corrida>/<encargo>/resultado.json), para comparar corridas:
 *
 *   npx tsx src/herramientas/arteMetricas.ts r3 [r4 …]
 *   npx tsx src/herramientas/arteMetricas.ts --gasto 2026-11-22T00:00     gasto en USD desde esa fecha
 *
 * Por corrida: direcciones propuestas y pintadas, nota de la primera versión y de la mejor, parches adoptados en la
 * comparación a ciegas, duelos contra la pieza previa, errores del compositor por tipo y media por dimensión de la
 * rúbrica (de la mejor versión de cada dirección).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..', '..');

interface Vuelta {
  n: number;
  nota?: number;
  adoptada?: boolean;
  problemas: string[];
  receta: { esqueleto: string; operaciones: Array<{ tipo: string }> };
  critica?: { puntuaciones: Record<string, { nivel: number }> };
}
interface Resultado {
  direcciones: Array<{ nombre: string; vueltas: Vuelta[]; mejor?: Vuelta }>;
  contraPrevia?: { gana: 'nueva' | 'previa' };
  comparacion?: { plantilla: string[][] };
  segundos?: number;
}

const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : NaN);

async function metricas(corrida: string) {
  const carpeta = join(RAIZ, 'datos', 'arte', corrida);
  const encargos = (await readdir(carpeta)).filter((n) => !n.includes('.'));
  const rs: Array<{ id: string; r: Resultado }> = [];
  for (const id of encargos) {
    const f = join(carpeta, id, 'resultado.json');
    if (await stat(f).then(() => true, () => false)) rs.push({ id, r: JSON.parse(await readFile(f, 'utf8')) as Resultado });
  }
  const dirs = rs.flatMap((x) => x.r.direcciones);
  const pintadas = dirs.filter((d) => d.mejor);
  const primeras = pintadas.map((d) => d.vueltas[0]?.nota).filter((n): n is number => typeof n === 'number');
  const mejores = pintadas.map((d) => d.mejor!.nota).filter((n): n is number => typeof n === 'number');
  const parches = dirs.flatMap((d) => d.vueltas.filter((v) => v.n > 1 && v.adoptada !== undefined));
  const errores: Record<string, number> = {};
  for (const d of dirs) for (const v of d.vueltas) for (const p of v.problemas) {
    const tipo = /^([A-Z_]+):/.exec(p)?.[1] ?? (/^No (cabe|hay)/.test(p) ? 'SITIO' : 'OTRO');
    errores[tipo] = (errores[tipo] ?? 0) + 1;
  }
  const dimensiones: Record<string, number[]> = {};
  for (const d of pintadas) for (const [k, v] of Object.entries(d.mejor!.critica?.puntuaciones ?? {})) (dimensiones[k] ??= []).push(v.nivel);
  const esqueletos: Record<string, number> = {};
  for (const d of pintadas) esqueletos[d.mejor!.receta.esqueleto] = (esqueletos[d.mejor!.receta.esqueleto] ?? 0) + 1;
  const duelos = rs.filter((x) => x.r.contraPrevia);
  return {
    corrida,
    encargos: rs.length,
    direcciones: dirs.length,
    pintadas: pintadas.length,
    notaPrimera: media(primeras),
    notaMejor: media(mejores),
    sinErrores: pintadas.filter((d) => (d.mejor!.nota ?? 0) > 0).length,
    parches: `${parches.filter((v) => v.adoptada).length}/${parches.length} adoptados`,
    contraPrevia: duelos.length ? `${duelos.filter((x) => x.r.contraPrevia!.gana === 'nueva').length}/${duelos.length} gana la nueva` : '—',
    mismaPlantillaDentro: rs.reduce((a, x) => a + (x.r.comparacion?.plantilla.length ?? 0), 0),
    errores,
    dimensiones: Object.fromEntries(Object.entries(dimensiones).map(([k, v]) => [k, media(v)])),
    esqueletos,
    segundosPorEncargo: media(rs.map((x) => x.r.segundos ?? 0)),
  };
}

/**
 * Gasto del estudio de arte en USD: texto (Hydrogen, tarifa oficial del 22/11/2026: 1,50 USD/M de entrada y 7,50 USD/M
 * de salida, razonamiento incluido) e imagen (el coste real apuntado por GeneradorFotoGemini), desde una fecha.
 */
async function gasto(desde: string) {
  const leer = async (f: string) => (await readFile(join(RAIZ, 'datos', 'gasto', f), 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  const texto = (await leer('gemini-texto.jsonl')).filter((x) => String(x.motivo ?? '').startsWith('estudio-de-arte') && String(x.fecha) >= desde);
  const porProyecto: Record<string, { llamadas: number; usd: number }> = {};
  let usdTexto = 0;
  for (const x of texto) {
    const usd = (Number(x.tokensEntrada ?? 0) * 1.5 + (Number(x.tokensSalida ?? 0) + Number(x.tokensRazonamiento ?? 0)) * 7.5) / 1e6;
    usdTexto += usd;
    const k = String(x.proyecto ?? '—');
    porProyecto[k] ??= { llamadas: 0, usd: 0 };
    porProyecto[k].llamadas++;
    porProyecto[k].usd += usd;
  }
  const imagenes = (await leer('gemini.jsonl')).filter((x) => String(x.receta ?? '').startsWith('estudio-de-arte') && String(x.fecha) >= desde && x.estado === 'COMPLETADO');
  const usdImagen = imagenes.reduce((a, x) => a + Number(x.realUsd ?? x.estimadoUsd ?? 0), 0);
  const r2 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    desde,
    texto: { llamadas: texto.length, usd: r2(usdTexto), porProyecto: Object.fromEntries(Object.entries(porProyecto).map(([k, v]) => [k, { llamadas: v.llamadas, usd: r2(v.usd) }])) },
    imagenes: { n: imagenes.length, usd: r2(usdImagen), modelos: [...new Set(imagenes.map((x) => x.modelo))] },
    total: r2(usdTexto + usdImagen),
  };
}

const args = process.argv.slice(2);
if (args[0] === '--gasto') console.log(JSON.stringify(await gasto(args[1] ?? new Date().toISOString().slice(0, 10)), null, 2));
else for (const c of args) console.log(JSON.stringify(await metricas(c), null, 2));
