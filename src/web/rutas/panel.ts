/**
 * Panel de control (página de inicio): lo que se puede contar del estudio con sus propios datos, sin inventar nada.
 * Solo lee: los encargos y los locales del modo activo, y los registros de gasto de datos/gasto/ (que son reales en los
 * dos modos: el modo simulado no gasta ni apunta nada).
 *
 *   GET /api/panel → { modo, encargos, locales, comprobaciones, gasto }
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GastoGemini } from '../../adaptadores/gemini/imagenGemini.js';
import { Router } from 'express';
import { listarEncargos } from '../../aplicacion/post/consultasPost.js';
import { comprobarReferencia } from '../../aplicacion/referencias/comprobarReferencia.js';
import type { Estudio } from '../estudio.js';

/** Veredictos de la comprobación de salida de cada foto nueva (IntentoFoto.final). */
const VEREDICTOS = ['PASA', 'REVISAR', 'DESCARTA', 'RECHAZADA', 'PENDIENTE'] as const;
type Veredicto = (typeof VEREDICTOS)[number];

export function rutasDelPanel(estudio: Estudio): Router {
  const rutas = Router();

  rutas.get('/panel/consumo', async (_req, res) => {
    res.json(await consumoMensual(join(estudio.config.carpetaDatos, 'gasto'), estudio.config.zonaHoraria));
  });

  rutas.get('/panel', async (_req, res) => {
    const deps = await estudio.post();
    const [encargos, locales] = await Promise.all([listarEncargos(deps), deps.referencias.locales.listar().catch(() => [])]);

    // ---------------------------------------------------------------- Locales y la regla de las 5 referencias
    const porLocal = await Promise.all(
      locales.map(async (local) => {
        const estado = await comprobarReferencia(deps.referencias, { local: local.slug }).catch(() => null);
        const referencias = await deps.referencias.referencias.listar(local.slug).catch(() => []);
        return {
          slug: local.slug,
          nombre: local.nombre,
          ciudad: local.ciudad,
          piezas: estado ? { total: estado.piezasReales, ...estado.desglose } : null,
          umbral: estado?.umbral ?? null,
          referencias: referencias.length,
          encargos: encargos.filter((e) => e.local === local.slug).length,
        };
      }),
    );

    // ---------------------------------------------------------------- Comprobación de salida de las fotos nuevas
    const comprobaciones = Object.fromEntries(VEREDICTOS.map((v) => [v, 0])) as Record<Veredicto, number>;
    for (const intento of encargos.flatMap((e) => e.intentos)) comprobaciones[intento.final] += 1;

    res.json({
      modo: estudio.simulado() ? 'SIMULADO' : 'REAL',
      locales: porLocal,
      comprobaciones: { ...comprobaciones, total: encargos.reduce((n, e) => n + e.intentos.length, 0) },
      gasto: {
        higgsfield: await gastoHiggsfield(join(estudio.config.carpetaDatos, 'gasto', 'higgsfield.jsonl')),
        geminiImagen: await estudio.gastoDeFotos(),
        geminiTexto: await usoGeminiTexto(join(estudio.config.carpetaDatos, 'gasto', 'gemini-texto.jsonl')),
      },
    });
  });

  return rutas;
}

/** Las líneas JSON de un registro; las que no se leen se saltan (un registro a medio escribir no tumba el panel). */
async function lineas(ruta: string): Promise<Array<Record<string, unknown>>> {
  const texto = await readFile(ruta, 'utf8').catch(e => {
    if (e.code === 'ENOENT') return '';
    throw e;
  });
  return texto
    .split('\n')
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        const valor = JSON.parse(l) as unknown;
        return valor && typeof valor === 'object' ? [valor as Record<string, unknown>] : [];
      } catch {
        return [];
      }
    });
}

const numero = (valor: unknown) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : 0);
const texto = (valor: unknown) => (typeof valor === 'string' ? valor : null);

/**
 * datos/gasto/higgsfield.jsonl: una línea al enviar y otra al terminar, por petición (gana la última, como en
 * herramientas/generarActivo.ts). Lo FALLIDO no cobra. Por la API consta un importe ESTIMADO en USD; por el MCP,
 * los créditos (su precio en USD no está confirmado, así que no se convierte).
 */
async function peticionesHiggsfield(ruta: string) {
  const porPeticion = new Map<string, Record<string, unknown>>();
  for (const linea of await lineas(ruta)) {
    const clave = texto(linea.requestId) ?? `${texto(linea.receta)}|${texto(linea.activo)}`;
    const previa = porPeticion.get(clave);
    porPeticion.set(clave, { ...previa, ...linea, inicio: previa?.inicio ?? linea.fecha, estimadoUsd: linea.estimadoUsd ?? previa?.estimadoUsd });
  }
  return [...porPeticion.values()].filter((g) => g.estado !== 'FALLIDO');
}

export async function gastoHiggsfield(ruta: string) {
  const validas = await peticionesHiggsfield(ruta);
  const mcp = validas.filter((g) => g.via === 'MCP');
  const api = validas.filter((g) => g.via !== 'MCP');
  const fechas = validas.map((g) => texto(g.fecha)).filter((f): f is string => Boolean(f)).sort();
  return {
    api: { peticiones: api.length, estimadoUsd: api.reduce((s, g) => s + numero(g.estimadoUsd), 0) },
    mcp: { peticiones: mcp.length, creditos: mcp.reduce((s, g) => s + numero(g.creditos), 0) },
    desde: fechas[0] ?? null,
    hasta: fechas.at(-1) ?? null,
  };
}

/**
 * datos/gasto/gemini-texto.jsonl: llamadas de texto y visión (director, revisor) con sus tokens. No hay una tarifa
 * comprobada de esos modelos, así que el panel cuenta llamadas y tokens, sin precio.
 */
export async function usoGeminiTexto(ruta: string) {
  const registro = await lineas(ruta);
  const porMotivo: Record<string, number> = {};
  for (const l of registro) {
    const motivo = texto(l.motivo) ?? 'otro';
    porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1;
  }
  const fechas = registro.map((l) => texto(l.fecha)).filter((f): f is string => Boolean(f)).sort();
  return {
    llamadas: registro.length,
    tokensEntrada: registro.reduce((s, l) => s + numero(l.tokensEntrada), 0),
    tokensSalida: registro.reduce((s, l) => s + numero(l.tokensSalida) + numero(l.tokensRazonamiento), 0),
    dePago: registro.filter((l) => l.tier === 'PAGO').length,
    porMotivo,
    desde: fechas[0] ?? null,
    hasta: fechas.at(-1) ?? null,
  };
}

export async function consumoMensual(carpeta: string, zonaHoraria: string, ahora = new Date()) {
  const fechaLocal = new Intl.DateTimeFormat('sv-SE', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit' });
  const actual = fechaLocal.format(ahora);
  const nuevo = (mes: string) => ({ mes, entrada: 0, salida: 0, razonamiento: 0, llamadas: 0, imagenes: 0,
    imagenUsd: 0, textoEstimadoUsd: 0, imagenEstimadaUsd: 0, higgsfieldEstimadoUsd: 0, creditos: 0, sinTarifa: 0 });
  const meses = new Map([[actual, nuevo(actual)]]);
  for (let i = 1; i < 6; i++) {
    const fecha = new Date(actual + '-15T12:00:00Z');
    fecha.setUTCMonth(fecha.getUTCMonth() - i);
    const mes = fecha.toISOString().slice(0, 7);
    meses.set(mes, nuevo(mes));
  }
  const periodo = (fecha: unknown) => {
    const instante = typeof fecha === 'string' ? Date.parse(fecha) : NaN;
    if (!Number.isFinite(instante)) return;
    const mes = fechaLocal.format(instante);
    if (!meses.has(mes)) meses.set(mes, nuevo(mes));
    return meses.get(mes)!;
  };
  const [texto, imagen, higgsfield] = await Promise.all([lineas(join(carpeta, 'gemini-texto.jsonl')),
    lineas(join(carpeta, 'gemini.jsonl')), peticionesHiggsfield(join(carpeta, 'higgsfield.jsonl'))]);
  for (const l of texto) {
    const m = periodo(l.fecha);
    if (!m) continue;
    m.llamadas++;
    m.entrada += numero(l.tokensEntrada);
    m.salida += numero(l.tokensSalida);
    m.razonamiento += numero(l.tokensRazonamiento);
    if (l.tier !== 'GRATUITO') {
      if (l.tier === 'PAGO' && l.modelo === 'gemini-4-hydrogen') {
        m.textoEstimadoUsd += (numero(l.tokensEntrada) * 1.5 + (numero(l.tokensSalida) + numero(l.tokensRazonamiento)) * 7.5) / 1e6;
      } else m.sinTarifa++;
    }
  }
  const envios = new Map<string, GastoGemini & { inicio: string }>();
  for (const linea of imagen) {
    const registro = GastoGemini.safeParse(linea);
    if (!registro.success) continue;
    const g = registro.data;
    const clave = JSON.stringify([g.receta, g.activo]);
    const previo = envios.get(clave);
    envios.set(clave, { ...previo, ...g, inicio: previo?.inicio ?? g.fecha });
  }
  for (const g of envios.values()) {
    const m = periodo(g.inicio);
    if (!m || g.estado === 'FALLIDO') continue;
    if (g.estado === 'COMPLETADO') m.imagenes++;
    m.entrada += g.uso?.promptTokenCount ?? 0;
    m.salida += g.uso?.candidatesTokenCount ?? 0;
    m.razonamiento += g.uso?.thoughtsTokenCount ?? 0;
    if (g.tier === 'PAGO') {
      if (g.realUsd !== undefined) m.imagenUsd += g.realUsd;
      else m.imagenEstimadaUsd += g.estimadoUsd;
    }
  }
  for (const g of higgsfield) {
    const m = periodo(g.inicio);
    if (!m) continue;
    if (g.via === 'MCP') m.creditos += numero(g.creditos);
    else m.higgsfieldEstimadoUsd += numero(g.estimadoUsd);
  }
  return { actual, meses: [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes)) };
}
