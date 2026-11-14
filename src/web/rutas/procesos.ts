/**
 * Estado de los procesos del estudio para el diorama (la vista isométrica del panel): SOLO LECTURA.
 *
 * Junta, para cada encargo de la orden única del modo activo, lo que ya está guardado (el paso, los intentos de foto,
 * el recorrido del historial y cuántas propuestas hizo el director de diseño) con su último trabajo en memoria
 * (en curso o no, el mensaje, los avisos de reintento y el error si falló). No llama a ninguna IA ni escribe nada:
 * se puede consultar cada pocos segundos sin gastar ni cambiar el estado.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Router } from 'express';
import { listarEncargos } from '../../aplicacion/post/consultasPost.js';
import type { EncargoPost, PasoPost } from '../../dominio/post.js';
import type { Estudio } from '../estudio.js';
import type { VistaTrabajo } from '../trabajos.js';
import { claveDeEncargo } from './encargos.js';

/** Los encargos más recientes que se mandan (la escena enseña uno; el resto solo cuenta). */
const MAX_ENCARGOS = 12;
/** Las últimas notas del historial que hacen falta para reconstruir el recorrido del material. */
const MAX_RECORRIDO = 80;

export interface ProcesoTrabajo {
  estado: VistaTrabajo['estado'];
  mensaje: string;
  fraccion: number;
  quedanSegundos: number;
  iniciadoEn: number;
  terminadoEn: number | null;
  /** Avisos reales del trabajo, p. ej. «gemini-… no responde ahora (HTTP 503 …). Sigo con …». */
  avisos: string[];
  error: { code: string; message: string; retryable: boolean } | null;
}

export interface ProcesoEncargo {
  proyecto: string;
  local: string;
  nombreLocal: string | null;
  plato: string;
  paso: PasoPost;
  bloqueo: string | null;
  creadoEn: string;
  actualizadoEn: string;
  intentos: Array<{ n: number; final: EncargoPost['intentos'][number]['final'] }>;
  fotoElegida: boolean;
  /** Las propuestas que hizo el director de diseño (1, o 2 si se le devolvió) y si la última quedó con problemas. Null si aún no hubo. */
  diseno: { propuestas: number; pasa: boolean } | null;
  /** Por qué pasos ha ido el encargo, en orden (del historial). */
  recorrido: Array<{ fecha: string; paso: PasoPost }>;
  trabajo: ProcesoTrabajo | null;
}

export interface EstadoProcesos {
  modo: 'REAL' | 'SIMULADO';
  ahora: number;
  encargos: ProcesoEncargo[];
}

export function rutasDeProcesos(estudio: Estudio): Router {
  const rutas = Router();
  rutas.get('/', async (_req, res) => {
    res.json(await estadoDeProcesos(estudio));
  });
  return rutas;
}

export async function estadoDeProcesos(estudio: Estudio): Promise<EstadoProcesos> {
  const simulado = estudio.simulado();
  const deps = await estudio.post();
  const encargos = (await listarEncargos(deps)).slice(0, MAX_ENCARGOS);
  const nombres = new Map((await deps.referencias.locales.listar().catch(() => [])).map((m) => [m.slug, m.nombre]));
  const modo = simulado ? 'SIMULADO' : 'REAL';
  return {
    modo,
    ahora: Date.now(),
    encargos: await Promise.all(
      encargos.map(async (e): Promise<ProcesoEncargo> => {
        const trabajo = estudio.registro.ultimoDe(claveDeEncargo(e.proyecto), modo);
        return {
          proyecto: e.proyecto,
          local: e.local,
          nombreLocal: nombres.get(e.local) ?? null,
          plato: e.plato,
          paso: e.paso,
          bloqueo: e.bloqueo ?? null,
          creadoEn: e.creadoEn,
          actualizadoEn: e.historial.at(-1)?.fecha ?? e.creadoEn,
          intentos: e.intentos.map((i) => ({ n: i.n, final: i.final })),
          fotoElegida: Boolean(e.fotoElegida),
          diseno: await propuestasDeDiseno(join(deps.proyectos, e.proyecto)),
          recorrido: e.historial.slice(-MAX_RECORRIDO).map((h) => ({ fecha: h.fecha, paso: h.paso })),
          trabajo: trabajo ? resumirTrabajo(estudio.registro.vista(trabajo)) : null,
        };
      }),
    ),
  };
}

function resumirTrabajo(t: VistaTrabajo): ProcesoTrabajo {
  return {
    estado: t.estado,
    mensaje: t.mensaje,
    fraccion: t.fraccion,
    quedanSegundos: t.quedanSegundos,
    iniciadoEn: t.iniciadoEn,
    terminadoEn: t.terminadoEn ?? null,
    avisos: t.avisos.slice(-5),
    error: t.error ? { code: t.error.code, message: t.error.message, retryable: t.error.retryable } : null,
  };
}

/** Lo que dejó el director de diseño en intenciones/post.propuesta.json (lo escribe la orden en INTENCION). */
async function propuestasDeDiseno(carpeta: string): Promise<ProcesoEncargo['diseno']> {
  try {
    const guardada = JSON.parse(await readFile(join(carpeta, 'intenciones', 'post.propuesta.json'), 'utf8')) as { intentos?: unknown; problemas?: unknown };
    const propuestas = Array.isArray(guardada.intentos) ? guardada.intentos.length : 0;
    if (propuestas === 0) return null;
    return { propuestas, pasa: Array.isArray(guardada.problemas) && guardada.problemas.length === 0 };
  } catch {
    return null;
  }
}
