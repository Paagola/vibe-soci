/**
 * Encargos de la ORDEN ÚNICA: de la foto subida al post exportado, con sus dos paradas para confirmar.
 * La web hace lo mismo que `npm run post`, con los mismos casos de uso: cada avance es un trabajo en segundo plano
 * que sigue hasta la siguiente parada, y lo que la línea de comandos pide hacer a mano (elegir la referencia,
 * corregir la propuesta, escribir la intención) tiene aquí su ruta.
 */
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { revisionDeEncargo } from '../../aplicacion/productor/revision.js';
import { abrirEncargo } from '../../aplicacion/post/abrirEncargo.js';
import { detalleDeEncargo, listarEncargos, resumirEncargos, type PortadaDeEncargo } from '../../aplicacion/post/consultasPost.js';
import { corregirPropuesta } from '../../aplicacion/post/corregirPropuesta.js';
import { claveDeBorrador, guardarIntencion, recomponerPost, vistaPreviaDelDiseno, type DepsDisenoPost } from '../../aplicacion/post/disenoDelPost.js';
import { elegirReferencia, usarReferenciaDeBiblioteca, usarReferenciaPropia } from '../../aplicacion/post/elegirReferencia.js';
import { avanzar, leerEncargo, type Accion } from '../../aplicacion/post/ordenPost.js';
import { presupuestoDeFoto } from '../../aplicacion/post/presupuestoDeFoto.js';
import type { AlProgresar, Progreso } from '../../aplicacion/progreso.js';
import { Intencion } from '../../dominio/diseno/intencion.js';
import { ErrorDeServicio, ErrorDeUsuario } from '../../dominio/errores.js';
import { PasoPost, type EncargoPost } from '../../dominio/post.js';
import { validar } from '../../dominio/validacion.js';
import { ErrorHttp } from '../errores.js';
import type { Estudio } from '../estudio.js';

const PROYECTO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Lo que tarda, más o menos, lo que no es ni director ni imagen (para la cuenta atrás). */
const MASCARA_MS = 3_000;
const COMPONER_MS = 6_000;

const CuerpoNuevo = z.object({ subidaId: z.string() }).passthrough();
const CuerpoAvanzar = z
  .object({
    /** La parada que se confirma: si el encargo ya no está en ella, no se confirma nada. */
    revision: z.string().optional(),
    confirmo: z.enum(['CONFIRMAR_ELEMENTOS', 'CONFIRMAR_FOTO']).optional(),
    rechazo: z.string().trim().min(3, 'Di por qué la rechazas (mínimo 3 caracteres).').max(300).optional(),
    /** Subida con la foto hecha a mano. */
    importar: z.string().optional(),
  })
  .refine((c) => [c.confirmo, c.rechazo, c.importar].filter(Boolean).length <= 1, 'Una sola acción cada vez: confirmar, rechazar o importar.');
/** Una referencia ya registrada del local, o un post de la biblioteca del estudio (se registra con su ficha). */
const CuerpoReferencia = z.union([
  z.object({ referencia: z.string().min(1) }),
  z.object({ biblioteca: z.string().min(1) }),
  /** Una referencia propia: una imagen subida (/api/subidas) o un enlace. */
  z.object({ subidaId: z.string().min(1) }),
  z.object({ enlace: z.string().url('Pega un enlace completo (https://…).') }),
]);
const CuerpoPropuesta = z.object({ propuesta: z.unknown(), revision: z.string().optional() });
const CuerpoIntencion = z.object({ intencion: z.unknown(), revision: z.string().optional() });

export const claveDeEncargo = (proyecto: string) => `encargo:${proyecto}`;
export const baseDeEncargo = (proyecto: string) => `/archivos/encargos/${proyecto}/`;

export function rutasDeEncargos(estudio: Estudio): Router {
  const rutas = Router();
  /** Las vistas previas de un mismo encargo se componen de una en una: comparten la carpeta del borrador. */
  const colaDeVistas = new Map<string, Promise<unknown>>();

  function conBorrador<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
    const turno = (colaDeVistas.get(clave) ?? Promise.resolve()).catch(() => undefined).then(tarea);
    colaDeVistas.set(clave, turno);
    return turno.finally(() => {
      if (colaDeVistas.get(clave) === turno) colaDeVistas.delete(clave);
    });
  }

  // Una decisión y una edición del mismo proyecto comparten documentos. Reserva el turno antes de cualquier lectura.
  const escrituras = new Set<string>();
  const conEscritura = (accion: RequestHandler): RequestHandler => async (req, res, next) => {
    const clave = `${estudio.simulado()}:${proyectoDe(req)}`;
    if (escrituras.has(clave)) throw new ErrorHttp(409, 'TRABAJO_EN_CURSO', 'Se está guardando otro cambio en la comanda.');
    escrituras.add(clave);
    try {
      await accion(req, res, next);
    } finally {
      escrituras.delete(clave);
    }
  };

  rutas.get('/', async (_req, res) => {
    const encargos = await resumirEncargos(await estudio.post());
    res.json({
      encargos: encargos.map((e) => ({
        ...e,
        miniatura: e.portada ? urlDePortada(e.proyecto, e.portada) : null,
        trabajoEnCurso: ultimoTrabajo(estudio, e.proyecto)?.estado === 'EN_CURSO',
      })),
    });
  });

  rutas.post('/', async (req, res) => {
    const { subidaId, ...datos } = validar(CuerpoNuevo, req.body, 'El encargo no es válido.');
    const encargo = await abrirEncargo(await estudio.post(), datos, { foto: estudio.subidas.ruta(subidaId), simulado: estudio.simulado(), zonaHoraria: estudio.config.zonaHoraria });
    await estudio.subidas.borrar([subidaId]);
    // Nada más abrirlo, la orden corre hasta su primera parada (referencia que falta o elementos por confirmar).
    const trabajo = await lanzar(estudio, encargo.proyecto, (deps, alProgresar) => avanzarConProgreso(deps, encargo.proyecto, {}, alProgresar));
    res.status(201).json({ encargo: { proyecto: encargo.proyecto }, trabajo });
  });

  rutas.get('/:proyecto', async (req, res) => {
    const proyecto = proyectoDe(req);
    const deps = await estudio.post(proyecto);
    await exigirEncargo(deps, proyecto);
    const trabajo = ultimoTrabajo(estudio, proyecto);
    res.json({ ...(await detalleDeEncargo(deps, proyecto)), base: baseDeEncargo(proyecto), trabajo: trabajo ? estudio.registro.vista(trabajo) : null });
  });

  /** Lo que costaría la foto nueva, para la parada de elementos. No gasta nada. */
  rutas.get('/:proyecto/presupuesto', async (req, res) => {
    const proyecto = proyectoDe(req);
    const deps = await estudio.post(proyecto);
    await exigirEncargo(deps, proyecto);
    const presupuesto = await presupuestoDeFoto(deps, proyecto);
    // El tope es del generador real: en simulado no hay nada que vigilar.
    res.json({ presupuesto: { ...presupuesto, tope: estudio.simulado() ? null : await estudio.gastoDeFotos() } });
  });

  // ---------------------------------------------------------------- Avanzar (trabajo largo)

  rutas.post('/:proyecto/avanzar', conEscritura(async (req, res) => {
    const proyecto = proyectoDe(req);
    const cuerpo = validar(CuerpoAvanzar, req.body ?? {}, 'La acción no es válida.');
    const deps = await exigirLibre(estudio, proyecto);
    const encargo = await leerEncargo(deps, proyecto);
    if (cuerpo.confirmo || cuerpo.rechazo) await exigirRevision(deps, encargo, cuerpo.revision);

    // Una confirmación vale para la parada que la persona está viendo, no para la siguiente que encuentre la orden.
    if (cuerpo.confirmo && encargo.paso !== cuerpo.confirmo) throw fueraDePaso('confirmar', encargo);
    if (cuerpo.rechazo && encargo.paso !== 'CONFIRMAR_FOTO') throw fueraDePaso('rechazar la foto', encargo);
    if (cuerpo.importar && encargo.paso !== 'GENERAR') throw fueraDePaso('importar una foto', encargo);

    const accion: Accion = {
      ...(cuerpo.revision ? { revision: cuerpo.revision } : {}),
      ...(cuerpo.confirmo ? { confirmo: true } : {}),
      ...(cuerpo.rechazo ? { rechazo: cuerpo.rechazo } : {}),
      ...(cuerpo.importar ? { importar: estudio.subidas.ruta(cuerpo.importar) } : {}),
      ...(cuerpo.confirmo || cuerpo.rechazo ? { via: 'web' as const } : {}),
    };
    const trabajo = await lanzar(estudio, proyecto, async (deps, alProgresar) => {
      try {
        return await avanzarConProgreso(deps, proyecto, accion, alProgresar);
      } finally {
        if (cuerpo.importar) await estudio.subidas.borrar([cuerpo.importar]);
      }
    });
    res.status(202).json({ trabajo });
  }));

  // ---------------------------------------------------------------- Lo que la orden pide hacer a mano

  rutas.put('/:proyecto/referencia', conEscritura(async (req, res) => {
    const proyecto = proyectoDe(req);
    const cuerpo = validar(CuerpoReferencia, req.body, 'Elige una referencia.');
    const deps = await exigirLibre(estudio, proyecto);
    const encargo =
      'biblioteca' in cuerpo
        ? await usarReferenciaDeBiblioteca(deps, proyecto, cuerpo.biblioteca)
        : 'subidaId' in cuerpo
          ? await usarReferenciaPropia(deps, proyecto, { imagen: estudio.subidas.ruta(cuerpo.subidaId) })
          : 'enlace' in cuerpo
            ? await usarReferenciaPropia(deps, proyecto, { enlace: cuerpo.enlace })
            : await elegirReferencia(deps, proyecto, cuerpo.referencia);
    if ('subidaId' in cuerpo) await estudio.subidas.borrar([cuerpo.subidaId]);
    res.json({ encargo: { proyecto: encargo.proyecto, referencia: encargo.referencia } });
  }));

  rutas.put('/:proyecto/propuesta', conEscritura(async (req, res) => {
    const proyecto = proyectoDe(req);
    const { propuesta, revision } = validar(CuerpoPropuesta, req.body, 'Falta la propuesta.');
    const deps = await exigirLibre(estudio, proyecto);
    await exigirRevision(deps, await leerEncargo(deps, proyecto), revision);
    res.json(await corregirPropuesta(deps, proyecto, propuesta));
  }));

  /** Compone la intención en borrador, sin guardar ninguna versión. */
  rutas.post('/:proyecto/vista-previa', async (req, res) => {
    const proyecto = proyectoDe(req);
    const { intencion } = validar(CuerpoIntencion, req.body, 'Falta la intención.');
    const deps = await estudio.post(proyecto);
    await exigirEncargo(deps, proyecto);
    const clave = `${estudio.simulado() ? 'simulado' : 'real'}:${proyecto}`;
    const vista = await conBorrador(clave, () => vistaPreviaDelDiseno(deps, proyecto, intencion));
    res.json({ vista: { ...vista.version, errores: vista.errores, base: `${baseDeEncargo(proyecto)}vista-previa/`, sello: Date.now() } });
  });

  /** Guarda la intención como versión nueva y compone: sigue la orden o, en un encargo terminado, lo recompone. */
  rutas.put('/:proyecto/intencion', conEscritura(async (req, res) => {
    const proyecto = proyectoDe(req);
    const { intencion, revision } = validar(CuerpoIntencion, req.body, 'Falta la intención.');
    validar(Intencion, intencion, 'La intención de diseño no es válida.'); // los fallos de forma, al momento
    const deps = await exigirLibre(estudio, proyecto);
    await exigirRevision(deps, await leerEncargo(deps, proyecto), revision);
    const trabajo = await lanzar(estudio, proyecto, async (deps, alProgresar) => {
      alProgresar({ mensaje: 'Comprobando la intención en borrador…', hechas: 0, total: 0, pasosRestantes: { director: 0, tandas: 0 }, otrosMs: 2 * COMPONER_MS });
      const guardada = await conBorrador(`${estudio.simulado() ? 'simulado' : 'real'}:${proyecto}`, () => guardarIntencion(deps, proyecto, intencion));
      if (guardada.encargo.paso !== 'HECHO') return avanzarConProgreso(deps, proyecto, {}, alProgresar);
      alProgresar({ mensaje: `Componiendo la versión ${guardada.version}…`, hechas: 0, total: 0, pasosRestantes: { director: 0, tandas: 0 }, otrosMs: COMPONER_MS });
      const recompuesto = await recomponerPost(deps, proyecto);
      return { paso: 'HECHO', parada: 'HECHO', mensajes: recompuesto.errores.length ? [`La versión ${guardada.version} da errores del compositor: ${recompuesto.errores.join(' | ')}`] : [`Compuesta la versión ${guardada.version}.`] };
    });
    res.status(202).json({ trabajo });
  }));

  return rutas;
}

// ---------------------------------------------------------------- Ayudantes

/** Avanza la orden contando por dónde va. Los fallos del generador y del compositor se dicen como tales. */
async function avanzarConProgreso(deps: DepsDisenoPost, proyecto: string, accion: Accion, alProgresar: AlProgresar) {
  try {
    const resultado = await avanzar(deps, proyecto, accion, { alEmpezarPaso: (paso, encargo) => alProgresar(progresoDe(paso, encargo)) });
    return { paso: resultado.encargo.paso, parada: resultado.parada, mensajes: resultado.mensajes };
  } catch (error) {
    if (error instanceof RangeError) throw new ErrorDeUsuario('El compositor no puede resolver la intención.', [error.message]);
    const mensaje = error instanceof Error ? error.message : '';
    // GeneradorFotoGemini lanza errores sueltos con lo que ha contestado la API.
    if (mensaje.startsWith('Gemini ')) throw new ErrorDeServicio('Gemini', mensaje.slice('Gemini '.length), /HTTP (429|5\d\d)/.test(mensaje));
    throw error;
  }
}

/** Qué está haciendo la orden en cada paso y cuánto queda, en el mejor caso, hasta la siguiente parada. */
export function progresoDe(paso: PasoPost, encargo: Pick<EncargoPost, 'intentos'>): Progreso {
  const progreso = (mensaje: string, director = 0, tandas = 0, otrosMs = 0): Progreso => ({ paso, mensaje, hechas: 0, total: 0, pasosRestantes: { director, tandas }, otrosMs });
  switch (paso) {
    case 'REFERENCIA':
      return progreso('Comprobando la referencia…', 1);
    case 'FOTO_REAL':
      return progreso('Registrando la foto subida…', 1);
    case 'PROPUESTA':
      return progreso('El director de fotografía mira la foto y propone la toma nueva…', 1);
    case 'CONFIRMAR_ELEMENTOS':
      return progreso('Comprobando la propuesta…');
    case 'GENERAR':
      return progreso(`Haciendo la foto nueva (intento ${encargo.intentos.length + 1})…`, 1, 1);
    case 'COMPROBAR':
      return progreso('Comprobación de salida: elementos, toma y anatomía…', 1);
    case 'CONFIRMAR_FOTO':
      return progreso('Anotando tu decisión…');
    case 'MASCARA':
      return progreso('Recortando el sujeto de la foto…', 0, 0, MASCARA_MS);
    case 'INTENCION':
      return progreso('Preparando la intención de diseño…', 0, 0, COMPONER_MS);
    case 'COMPONER':
      return progreso('Componiendo el post y exportando a 3:4 y 4:5…', 0, 0, COMPONER_MS);
    case 'HECHO':
      return progreso('Listo');
  }
}

async function lanzar(estudio: Estudio, proyecto: string, tarea: (deps: DepsDisenoPost, alProgresar: AlProgresar) => Promise<unknown>) {
  // El trabajo se queda con el modo de este momento aunque luego se cambie el interruptor.
  const simulado = estudio.simulado();
  const deps = await estudio.post(proyecto);
  const medias = await estudio.estimador.medias(simulado);
  const trabajo = estudio.registro.lanzar({
    tipo: 'ENCARGO',
    piezaId: claveDeEncargo(proyecto),
    modo: simulado ? 'SIMULADO' : 'REAL',
    medias,
    ejecutar: (alProgresar) => tarea(deps, alProgresar),
  });
  return estudio.registro.vista(trabajo);
}

/** El último trabajo de ese encargo en el modo activo. */
function ultimoTrabajo(estudio: Estudio, proyecto: string) {
  return estudio.registro.ultimoDe(claveDeEncargo(proyecto), estudio.simulado() ? 'SIMULADO' : 'REAL');
}

async function exigirEncargo(deps: DepsDisenoPost, proyecto: string): Promise<EncargoPost> {
  if (!(await listarEncargos(deps)).some((e) => e.proyecto === proyecto)) throw new ErrorHttp(404, 'NO_ENCONTRADO', `No existe el encargo «${proyecto}» en este modo.`);
  return leerEncargo(deps, proyecto);
}

/** Para los cambios a mano: el encargo existe y no tiene un trabajo en curso que pueda pisarlos. */
async function exigirLibre(estudio: Estudio, proyecto: string): Promise<DepsDisenoPost> {
  const deps = await estudio.post(proyecto);
  await exigirEncargo(deps, proyecto);
  if (ultimoTrabajo(estudio, proyecto)?.estado === 'EN_CURSO') throw new ErrorHttp(409, 'TRABAJO_EN_CURSO', 'Este encargo tiene un trabajo en curso. Espera a que termine.');
  return deps;
}

async function exigirRevision(deps: DepsDisenoPost, e: EncargoPost, revision?: string) {
  if (!e.productorEditorial && !revision) return;
  const brief = await deps.productor?.leerBrief?.(e.proyecto);
  if (!revision || revision !== await revisionDeEncargo(deps.proyectos, e, brief)) {
    throw new ErrorHttp(409, 'REVISION_OBSOLETA', 'La comanda ha cambiado. Vuelve a revisar la versión vigente.');
  }
}

function fueraDePaso(que: string, encargo: EncargoPost): ErrorHttp {
  return new ErrorHttp(409, 'FUERA_DE_PASO', `No se puede ${que}: el encargo está en el paso ${encargo.paso}. Recarga la página.`);
}

function proyectoDe(req: Request): string {
  const proyecto = String(req.params.proyecto);
  if (!PROYECTO.test(proyecto)) throw new ErrorHttp(400, 'ID_NO_VALIDO', `«${proyecto}» no es un nombre de encargo válido.`);
  return proyecto;
}

const codificar = (ruta: string) => ruta.split('/').map(encodeURIComponent).join('/');

export function urlDePortada(proyecto: string, portada: PortadaDeEncargo): string {
  const base = baseDeEncargo(proyecto);
  if (portada.tipo === 'DISENO') return `${base}disenos/${codificar(portada.archivo)}`;
  if (portada.tipo === 'ACTIVO') return `${base}activos/${encodeURIComponent(portada.activo)}?lado=640`;
  return `${base}subida?lado=640`;
}

export { claveDeBorrador };
