/** Piezas: crear, consultar y lanzar los trabajos largos del flujo (conceptos, plan, generar, corregir). */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { comprobarCorreccion, corregirDiapositiva } from '../../aplicacion/corregirDiapositiva.js';
import { crearPieza } from '../../aplicacion/crearPieza.js';
import type { Dependencias } from '../../aplicacion/dependencias.js';
import { calcularResumenGasto } from '../../aplicacion/ejecutarGeneracion.js';
import { exportarPieza } from '../../aplicacion/exportarPieza.js';
import { calcularEncargo, generarDiapositivas } from '../../aplicacion/generarDiapositivas.js';
import { importarImagen } from '../../aplicacion/importarImagen.js';
import { planificarPieza } from '../../aplicacion/planificarPieza.js';
import type { AlProgresar } from '../../aplicacion/progreso.js';
import { proponerConceptos } from '../../aplicacion/proponerConceptos.js';
import { valorarDiapositiva } from '../../aplicacion/valorarDiapositiva.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { Veredicto, type Pieza } from '../../dominio/modelos.js';
import { MAX_CORRECCIONES, correccionesUsadas, ultimaCompletada, versionElegida } from '../../dominio/reglas.js';
import { validar } from '../../dominio/validacion.js';
import { ErrorHttp } from '../errores.js';
import type { Estudio } from '../estudio.js';
import type { TipoTrabajo } from '../trabajos.js';

const ID_PIEZA = /^[a-z0-9][a-z0-9-]*$/;

const SubidaConNota = z.object({ subidaId: z.string(), nota: z.string().optional() });
const CuerpoNuevaPieza = z
  .object({
    fotos: z.array(SubidaConNota.extend({ papel: z.string() })).min(1, 'Sube al menos una foto del plato.'),
    referenciaEstilo: SubidaConNota.optional(),
  })
  .passthrough();
const CuerpoPlan = z.object({ concepto: z.number().int().min(1) });
const CuerpoGenerar = z.object({
  diapositivas: z.array(z.number().int().min(1)).optional(),
  confirmado: z.boolean().default(false),
});
const CuerpoCorregir = z.object({
  comentario: z.string(),
  manual: z.boolean().default(false),
  confirmado: z.boolean().default(false),
});
const CuerpoValorar = z.object({ veredicto: Veredicto, motivo: z.string(), version: z.number().int().min(1).optional() });
const CuerpoImportar = z.object({ subidaId: z.string() });

export function rutasDePiezas(estudio: Estudio): Router {
  const rutas = Router();

  rutas.get('/', async (_req, res) => {
    const piezas = await estudio.deps().piezas.listar();
    const resumenes = piezas.map((pieza) => resumirPieza(estudio, pieza)).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
    res.json({ piezas: resumenes });
  });

  rutas.post('/', async (req, res) => {
    const cuerpo = validar(CuerpoNuevaPieza, req.body, 'La pieza no es válida.');
    const { subidas } = estudio;
    const pieza = await crearPieza(estudio.deps(), {
      ...cuerpo,
      fotos: cuerpo.fotos.map(({ subidaId, ...foto }) => ({ ...foto, ruta: subidas.ruta(subidaId) })),
      referenciaEstilo: cuerpo.referenciaEstilo && { nota: cuerpo.referenciaEstilo.nota, ruta: subidas.ruta(cuerpo.referenciaEstilo.subidaId) },
    });
    await subidas.borrar([...cuerpo.fotos.map((f) => f.subidaId), ...(cuerpo.referenciaEstilo ? [cuerpo.referenciaEstilo.subidaId] : [])]);
    res.status(201).json({ pieza: { id: pieza.id } });
  });

  rutas.get('/:id', async (req, res) => {
    res.json(await detalleDePieza(estudio, piezaIdDe(req)));
  });

  // ---------------------------------------------------------------- Trabajos largos

  rutas.post('/:id/conceptos', async (req, res) => {
    const trabajo = await lanzar(estudio, 'CONCEPTOS', piezaIdDe(req), (deps, alProgresar, id) => proponerConceptos(deps, id, { alProgresar }));
    res.status(202).json({ trabajo });
  });

  rutas.post('/:id/plan', async (req, res) => {
    const { concepto } = validar(CuerpoPlan, req.body, 'Elige un concepto.');
    const trabajo = await lanzar(estudio, 'PLAN', piezaIdDe(req), (deps, alProgresar, id) => planificarPieza(deps, id, concepto, { alProgresar }));
    res.status(202).json({ trabajo });
  });

  /** Lo que costaría generar o corregir, para el modal de confirmación. No gasta nada. */
  rutas.get('/:id/presupuesto', async (req, res) => {
    const deps = estudio.deps();
    const pieza = await deps.piezas.obtener(piezaIdDe(req));
    const generador = deps.generador();
    let imagenes = 1;
    let retomar = 0;

    if (req.query.accion === 'corregir') {
      comprobarCorreccion(pieza, Number(req.query.diapositiva));
    } else {
      const posiciones = typeof req.query.diapositivas === 'string' && req.query.diapositivas ? req.query.diapositivas.split(',').map(Number) : undefined;
      const encargo = calcularEncargo(pieza, generador.origen, posiciones);
      imagenes = encargo.posiciones.length;
      retomar = encargo.enCurso.length;
      if (imagenes === 0 && retomar === 0) throw new ErrorDeUsuario('No hay nada que generar: todas las diapositivas tienen imagen.');
    }
    const resumen = await calcularResumenGasto(deps, generador, imagenes);
    res.json({ presupuesto: { ...resumen, retomar, superaLimite: resumen.origen === 'API' && resumen.usadasHoy + imagenes > resumen.limite } });
  });

  rutas.post('/:id/generar', async (req, res) => {
    const { diapositivas, confirmado } = validar(CuerpoGenerar, req.body, 'La petición no es válida.');
    exigirConfirmacion(confirmado);
    const trabajo = await lanzar(estudio, 'GENERAR', piezaIdDe(req), (deps, alProgresar, id) =>
      generarDiapositivas(deps, id, { posiciones: diapositivas, confirmar: async () => true, alProgresar }),
    );
    res.status(202).json({ trabajo });
  });

  rutas.post('/:id/diapositivas/:n/corregir', async (req, res) => {
    const { comentario, manual, confirmado } = validar(CuerpoCorregir, req.body, 'La petición no es válida.');
    if (!manual) exigirConfirmacion(confirmado);
    const posicion = posicionDe(req);
    const trabajo = await lanzar(estudio, 'CORREGIR', piezaIdDe(req), (deps, alProgresar, id) =>
      corregirDiapositiva(deps, id, posicion, comentario, { manual, confirmar: async () => true, alProgresar }),
    );
    res.status(202).json({ trabajo });
  });

  // ---------------------------------------------------------------- Acciones rápidas

  rutas.post('/:id/diapositivas/:n/valorar', async (req, res) => {
    const cuerpo = validar(CuerpoValorar, req.body, 'La valoración no es válida.');
    res.json({ valoracion: await valorarDiapositiva(estudio.deps(), piezaIdDe(req), posicionDe(req), cuerpo) });
  });

  rutas.post('/:id/diapositivas/:n/importar', async (req, res) => {
    const { subidaId } = validar(CuerpoImportar, req.body, 'Sube antes la imagen.');
    const generacion = await importarImagen(estudio.deps(), piezaIdDe(req), posicionDe(req), estudio.subidas.ruta(subidaId));
    await estudio.subidas.borrar([subidaId]);
    res.status(201).json({ generacion });
  });

  rutas.post('/:id/exportar', async (req, res) => {
    const id = piezaIdDe(req);
    const { archivos, sinAprobar } = await exportarPieza(estudio.deps(), id);
    res.json({ archivos: archivos.map((archivo) => ({ archivo, url: urlDeArchivo(id, archivo) })), sinAprobar });
  });

  return rutas;
}

// ---------------------------------------------------------------- Ayudantes

async function lanzar(
  estudio: Estudio,
  tipo: TipoTrabajo,
  piezaId: string,
  ejecutar: (deps: Dependencias, alProgresar: AlProgresar, piezaId: string) => Promise<unknown>,
) {
  // El trabajo se queda con el modo de este momento aunque luego se cambie el interruptor.
  const deps = estudio.deps();
  const simulado = estudio.simulado();
  await deps.piezas.obtener(piezaId);
  const medias = await estudio.estimador.medias(simulado);
  const trabajo = estudio.registro.lanzar({
    tipo,
    piezaId,
    modo: simulado ? 'SIMULADO' : 'REAL',
    medias,
    ejecutar: (alProgresar) => ejecutar(deps, alProgresar, piezaId),
  });
  return estudio.registro.vista(trabajo);
}

/** El último trabajo de esa pieza en el modo activo (el otro modo tiene sus propias piezas). */
function ultimoTrabajo(estudio: Estudio, piezaId: string) {
  return estudio.registro.ultimoDe(piezaId, estudio.simulado() ? 'SIMULADO' : 'REAL');
}

function exigirConfirmacion(confirmado: boolean): void {
  if (!confirmado) throw new ErrorHttp(400, 'CONFIRMACION_NECESARIA', 'Confirma antes el gasto (consulta el presupuesto).');
}

function piezaIdDe(req: Request): string {
  const id = String(req.params.id);
  if (!ID_PIEZA.test(id)) throw new ErrorHttp(400, 'ID_NO_VALIDO', `«${id}» no es un id de pieza válido.`);
  return id;
}

function posicionDe(req: Request): number {
  const posicion = Number(req.params.n);
  if (!Number.isInteger(posicion) || posicion < 1) throw new ErrorHttp(400, 'DIAPOSITIVA_NO_VALIDA', 'La diapositiva tiene que ser un número mayor que 0.');
  return posicion;
}

export function urlDeArchivo(piezaId: string, archivo: string): string {
  return `/archivos/piezas/${piezaId}/${archivo.split('/').map(encodeURIComponent).join('/')}`;
}

async function detalleDePieza(estudio: Estudio, id: string) {
  const deps = estudio.deps();
  const pieza = await deps.piezas.obtener(id);
  const marca = await deps.locales.obtener(pieza.localSlug).catch(() => null);
  const trabajo = ultimoTrabajo(estudio, id);
  return {
    pieza,
    marca,
    base: `/archivos/piezas/${id}/`,
    diapositivas: (pieza.plan?.diapositivas ?? []).map((d) => ({
      posicion: d.posicion,
      correccionesUsadas: correccionesUsadas(pieza, d.posicion),
      maxCorrecciones: MAX_CORRECCIONES,
      versionElegida: versionElegida(pieza, d.posicion)?.version ?? null,
    })),
    trabajo: trabajo ? estudio.registro.vista(trabajo) : null,
  };
}

function resumirPieza(estudio: Estudio, pieza: Pieza) {
  const total = pieza.plan?.diapositivas.length ?? pieza.numDiapositivas;
  const conImagen = new Set(pieza.generaciones.filter((g) => g.estado === 'COMPLETADA').map((g) => g.diapositiva)).size;
  const fase = pieza.conceptos.length === 0 ? 'IDEA' : !pieza.plan ? 'CONCEPTOS' : conImagen < total ? 'IMAGENES' : 'LISTA';
  const portada = versionElegida(pieza, 1)?.archivo ?? ultimaCompletada(pieza, 1)?.archivo ?? pieza.fotos[0]?.archivo;
  return {
    id: pieza.id,
    localSlug: pieza.localSlug,
    formato: pieza.formato,
    tipo: pieza.tipo,
    idea: pieza.idea,
    creadaEn: pieza.creadaEn,
    fase,
    conImagen,
    total,
    miniatura: portada ? urlDeArchivo(pieza.id, portada) : null,
    trabajoEnCurso: ultimoTrabajo(estudio, pieza.id)?.estado === 'EN_CURSO',
  };
}
