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
import { listarEncargos, resumirEncargos } from '../../aplicacion/post/consultasPost.js';
import type { EncargoPost, PasoPost } from '../../dominio/post.js';
import type { Estudio } from '../estudio.js';
import type { VistaTrabajo } from '../trabajos.js';
import { baseDeEncargo, claveDeEncargo, urlDePortada } from './encargos.js';

/** Los encargos más recientes que se mandan (la escena enseña uno; el resto solo cuenta). */
const MAX_ENCARGOS = 12;
/** Las últimas notas del historial que hacen falta para reconstruir el recorrido del material. */
const MAX_RECORRIDO = 80;
/** Posts terminados que se mandan para la exposición de la galería. */
const MAX_GALERIA = 8;
/** Lado de las miniaturas: texturas pequeñas para la escena (las sirve /archivos con ?lado=). */
const LADO = 320;

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
  /** Por qué pasos ha ido el encargo, en orden (del historial), con la nota real de cada uno. */
  recorrido: Array<{ fecha: string; paso: PasoPost; nota: string }>;
  /**
   * Las imágenes REALES del encargo, en miniatura, para las estaciones de la oficina. Solo las que constan en el encargo;
   * una ruta puede contestar 404 si el archivo ya no está (p. ej. una referencia de enlace sin captura).
   */
  imagenes: {
    subida: string;
    referencia: string | null;
    intentos: Array<{ n: number; url: string }>;
    mascara: string | null;
    post: string | null;
  };
  trabajo: ProcesoTrabajo | null;
}

export interface EstadoProcesos {
  modo: 'REAL' | 'SIMULADO';
  ahora: number;
  encargos: ProcesoEncargo[];
  /** Los posts terminados más recientes (su miniatura real), para la exposición de la galería de entrega. */
  galeria: Array<{ proyecto: string; plato: string; url: string }>;
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
  // Las portadas (el post compuesto, si lo hay) salen de la misma consulta que usa la lista de Posts.
  const resumenes = await resumirEncargos(deps).catch(() => []);
  const postDe = new Map(resumenes.filter((r) => r.portada?.tipo === 'DISENO' || r.portada?.tipo === 'TALLER').map((r) => [r.proyecto, `${urlDePortada(r.proyecto, r.portada!)}?lado=${LADO}`]));
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
          recorrido: e.historial.slice(-MAX_RECORRIDO).map((h) => ({ fecha: h.fecha, paso: h.paso, nota: h.nota.slice(0, 220) })),
          imagenes: {
            subida: `${baseDeEncargo(e.proyecto)}subida?lado=${LADO}`,
            referencia: e.referencia ? `${baseDeEncargo(e.proyecto)}referencia?lado=${LADO}` : null,
            intentos: e.intentos.map((i) => ({ n: i.n, url: `${baseDeEncargo(e.proyecto)}activos/${encodeURIComponent(i.activo)}?lado=${LADO}` })),
            mascara: e.fotoElegida ? `${baseDeEncargo(e.proyecto)}activos/${encodeURIComponent(e.fotoElegida)}?mascara&lado=${LADO}` : null,
            post: postDe.get(e.proyecto) ?? null,
          },
          trabajo: trabajo ? resumirTrabajo(estudio.registro.vista(trabajo)) : null,
        };
      }),
    ),
    galeria: resumenes
      .filter((r) => r.paso === 'HECHO' && postDe.has(r.proyecto))
      .slice(0, MAX_GALERIA)
      .map((r) => ({ proyecto: r.proyecto, plato: r.plato, url: postDe.get(r.proyecto)! })),
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
