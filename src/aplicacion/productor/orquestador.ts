/**
 * Productor (fase 1): el orquestador en código, sin IA. Implementa los ganchos de la orden única: escribe el brief del
 * encargo, congela el inventario solo cuando confirma el usuario, para la orden si algo se aparta del brief, controla el
 * presupuesto de fotos y de llamadas de texto, y lleva la bitácora.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  actualizarInventarioPropuesto,
  confirmarInventario,
  contextoDelBrief,
  crearBrief,
  resumenParaLaParada,
  type BriefDelEncargo,
  type TomaEntrada,
} from '../../dominio/brief.js';
import { nuevaEntrada, type QuienEnBitacora, type TipoEnBitacora } from '../../dominio/bitacora.js';
import { cotejarPropuestaFoto, cotejarTextos } from '../../dominio/cotejo.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { PropuestaFotoNueva } from '../../dominio/fotoNueva.js';
import { textoDelInventario, type ElementoComparable } from '../../dominio/inventario.js';
import type { Marca } from '../../dominio/modelos.js';
import type { EncargoPost, PasoPost } from '../../dominio/post.js';
import type { AlmacenBrief } from '../../puertos/AlmacenBrief.js';
import type { FuenteDelBrief, QuienLlama } from '../../puertos/FuenteDelBrief.js';
import type { AccionVista, GanchosDeOrden, ResultadoAntes, ResultadoTras } from '../post/ganchos.js';

export interface DepsOrquestador {
  /** Carpeta de los proyectos (la misma que DepsPost.proyectos). */
  proyectos: string;
  almacen: AlmacenBrief;
  locales: { obtener(local: string): Promise<Marca> };
  ahora: () => string;
}

export interface Orquestador extends GanchosDeOrden {
  /** Lo que los decoradores de los especialistas leen de este encargo. */
  fuente(proyecto: string): FuenteDelBrief;
}

const QUIEN_POR_PASO: Partial<Record<PasoPost, QuienEnBitacora>> = {
  REFERENCIA: 'analista',
  PROPUESTA: 'director-foto',
  GENERAR: 'generador',
  COMPROBAR: 'revisor',
  INTENCION: 'director-diseno',
};

const PASOS_SIN_COTEJO_DE_FOTO: readonly PasoPost[] = ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS'];

const esNoEncontrado = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'ENOENT';

const primeraLinea = (texto: string): string => texto.split('\n')[0] ?? texto;

type Propuesta = PropuestaFotoNueva;

export function crearOrquestador(deps: DepsOrquestador): Orquestador {
  const { almacen } = deps;
  /** Índice del historial donde empieza lo que anota el paso en curso, por proyecto. */
  const desde = new Map<string, number>();
  /** El último paso que ha pasado por antesDePaso, por proyecto. */
  const pasoActual = new Map<string, PasoPost>();

  const anotar = (proyecto: string, quien: QuienEnBitacora, paso: PasoPost, tipo: TipoEnBitacora, texto: string, datos?: Record<string, unknown>) =>
    almacen.anotar(proyecto, nuevaEntrada({ quien, paso, tipo, texto, ...(datos ? { datos } : {}) }, deps.ahora()));

  const leerPropuesta = async (e: Readonly<EncargoPost>): Promise<Propuesta | undefined> => {
    let texto: string;
    try {
      texto = await readFile(join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? 'foto/propuesta.json'), 'utf8');
    } catch (error) {
      if (esNoEncontrado(error)) return undefined;
      throw error;
    }
    return PropuestaFotoNueva.parse((JSON.parse(texto) as { propuesta: unknown }).propuesta);
  };

  const tomasDe = (e: Readonly<EncargoPost>, propuesta: Propuesta): TomaEntrada[] => {
    if (e.tomas.length) {
      return e.tomas.map((t) => ({ elemento: t.elemento, ...(t.real ? { real: true } : {}), ...(t.intento ? { yaGenerada: true } : {}) }));
    }
    if (e.formato === 'carrusel') {
      return [
        ...e.fotosExtra.map((x) => ({ elemento: x.elemento, real: true })),
        ...(propuesta.tomas ?? []).map((t) => ({ elemento: t.elemento })),
      ].slice(0, 3);
    }
    return [];
  };

  const fotosUsadas = (e: Readonly<EncargoPost>): number => e.intentos.length + e.tomas.filter((t) => t.intento).length;

  const llamadasUsadas = async (proyecto: string): Promise<number> =>
    (await almacen.bitacora(proyecto)).filter((x) => x.tipo === 'LLAMADA').length;

  /** Lo que se hace antes de cada paso (salvo la parada de confirmación sin vía, que va primero). */
  const comprobarAntes = async (paso: PasoPost, e: Readonly<EncargoPost>, accion: AccionVista, brief: BriefDelEncargo): Promise<ResultadoAntes> => {
    // Dos: el inventario confirmado no se mueve sin confirmación del usuario.
    if (brief.hechos.inventario.estado === 'CONFIRMADO' && !PASOS_SIN_COTEJO_DE_FOTO.includes(paso)) {
      const propuesta = await leerPropuesta(e);
      if (propuesta) {
        const problemas = cotejarPropuestaFoto(brief.hechos.inventario, brief.hechos.nota, {
          elementos: propuesta.descripcion.elementos,
          tomas: e.tomas.map((t) => t.elemento),
        });
        if (problemas.length) {
          await anotar(e.proyecto, 'productor', paso, 'CONFLICTO', problemas.join(' | '));
          return {
            parar: `CONFLICTO CON EL BRIEF (lo para el productor): ${problemas.join(' | ')} El inventario confirmado está en brief.json: deja la propuesta como la confirmaste o crea un encargo nuevo.`,
          };
        }
      }
    }
    // Tres: la foto nueva no se genera si no cabe en el presupuesto de fotos que autorizaste.
    if (paso === 'GENERAR' && brief.hechos.inventario.estado === 'CONFIRMADO' && !accion.importar) {
      const usadas = fotosUsadas(e);
      const pendientes = 1 + e.tomas.filter((t) => !t.intento && !t.real).length;
      if (usadas + pendientes > brief.presupuesto.fotos) {
        await anotar(e.proyecto, 'productor', paso, 'PRESUPUESTO', `Presupuesto de fotos: harían falta ${usadas + pendientes} y autorizaste ${brief.presupuesto.fotos}.`);
        return {
          parar: `PRESUPUESTO DE FOTOS (lo para el productor): harían falta ${usadas + pendientes} y autorizaste ${brief.presupuesto.fotos} (brief.json).`,
        };
      }
    }
    // Cuatro: los textos de la intención no pueden afirmar lo que la nota del dueño y el inventario no dicen.
    if (paso === 'COMPONER' && brief.hechos.inventario.estado === 'CONFIRMADO') {
      const carpeta = join(deps.proyectos, e.proyecto);
      const plan = await leerJson<{ diapositivas?: Array<{ intencion: string }> }>(join(carpeta, 'plan.json'));
      const textos: string[] = [];
      for (const d of plan?.diapositivas ?? []) {
        const intencion = await leerJson<{ textos?: Record<string, unknown> }>(join(carpeta, d.intencion));
        for (const valor of Object.values(intencion?.textos ?? {})) {
          if (typeof valor === 'string') textos.push(valor);
        }
      }
      const marca = await deps.locales.obtener(e.local);
      const problemas = cotejarTextos(textos, {
        nota: brief.hechos.nota,
        elementos: brief.hechos.inventario.elementos,
        marca: [marca.nombre, marca.ciudad, marca.descripcion, ...marca.tonos].join(' '),
      });
      if (problemas.length) {
        await anotar(e.proyecto, 'productor', paso, 'COTEJO', problemas.join(' | '));
        return { parar: `COTEJO DE TEXTOS (lo para el productor): ${problemas.join(' | ')} Corrige la intención y vuelve a lanzar la orden.` };
      }
    }
    return {};
  };

  const leerJson = async <T>(ruta: string): Promise<T | undefined> => {
    try {
      return JSON.parse(await readFile(ruta, 'utf8')) as T;
    } catch (error) {
      if (esNoEncontrado(error)) return undefined;
      throw error;
    }
  };

  return {
    async antesDePaso(paso, e, accion) {
      const decide = (paso === 'CONFIRMAR_ELEMENTOS' && Boolean(accion.confirmo))
        || (paso === 'CONFIRMAR_FOTO' && Boolean(accion.confirmo || accion.rechazo));
      // Uno: con el productor encendido, las paradas solo las confirma el usuario (web o terminal interactiva).
      if (decide && accion.via !== 'web' && accion.via !== 'terminal') {
        if (await almacen.leer(e.proyecto)) {
          await anotar(e.proyecto, 'productor', paso, 'PARADA', 'Confirmación rechazada: sin vía de usuario.');
        }
        return {
          parar: `CONFIRMACIÓN RECHAZADA: con el productor encendido, las paradas solo las confirma el usuario, desde la web o desde una terminal interactiva (npm run post -- ${e.proyecto} --confirmo). Esta acción no dice de dónde viene.`,
        };
      }
      const brief = await almacen.leer(e.proyecto);
      pasoActual.set(e.proyecto, paso);
      const r: ResultadoAntes = brief ? await comprobarAntes(paso, e, accion, brief) : {};
      desde.set(e.proyecto, e.historial.length + (r.notas?.length ?? 0));
      return r;
    },

    async trasPaso(paso, _anterior, e, accion, parada) {
      const notas: string[] = [];
      let textoParada: string | undefined;
      const proyecto = e.proyecto;
      let brief = await almacen.leer(proyecto);
      let paradaAnotada = false;

      // Uno: la propuesta de la foto crea el brief (sin brief) o rehace el inventario propuesto (con brief propuesto).
      if (paso === 'PROPUESTA' && e.paso === 'CONFIRMAR_ELEMENTOS') {
        const propuesta = await leerPropuesta(e);
        if (propuesta) {
          if (!brief) {
            if (e.intentos.length === 0) {
              const marca = await deps.locales.obtener(e.local);
              const nuevo = crearBrief({
                proyecto,
                local: e.local,
                nota: e.plato,
                formato: e.formato,
                ...(e.estetica ? { estetica: e.estetica } : {}),
                ...(e.referencia ? { referencia: { id: e.referencia } } : {}),
                usoFotoReal: e.usoFotoReal,
                marca: {
                  nombre: marca.nombre,
                  ciudad: marca.ciudad,
                  descripcion: marca.descripcion,
                  tonos: marca.tonos,
                  ...(marca.instagram !== undefined ? { instagram: marca.instagram } : {}),
                  ...(marca.web !== undefined ? { web: marca.web } : {}),
                },
                elementos: propuesta.descripcion.elementos,
                tomas: tomasDe(e, propuesta),
              }, deps.ahora());
              await almacen.guardar(nuevo);
              brief = nuevo;
              const n = nuevo.hechos.inventario.elementos.length;
              await anotar(proyecto, 'productor', paso, 'ENCARGO', `Brief v1 escrito por el código: inventario PROPUESTO (${textoDelInventario(nuevo.hechos.inventario.elementos)}).`);
              await anotar(proyecto, 'productor', paso, 'DEGRADADO', 'Fase 1: el productor es solo código, sin IA; la idea queda vacía y el plan es el de por defecto.');
              notas.push(`Productor: brief v1 en brief.json (código, sin IA; inventario PROPUESTO de ${n} elemento(s)).`);
            }
          } else if (brief.hechos.inventario.estado === 'PROPUESTO') {
            const nuevo = actualizarInventarioPropuesto(brief, { elementos: propuesta.descripcion.elementos, tomas: tomasDe(e, propuesta) }, deps.ahora());
            if (nuevo !== brief) {
              await almacen.guardar(nuevo);
              brief = nuevo;
            }
          }
        }
      }

      // Dos: la confirmación del usuario congela el inventario; una parada de elementos añade el resumen del brief.
      if (paso === 'CONFIRMAR_ELEMENTOS' && brief) {
        if (e.paso === 'GENERAR') {
          const propuesta = await leerPropuesta(e);
          if (!propuesta) throw new Error(`Falta la propuesta de ${proyecto} al confirmar los elementos.`);
          const nuevo = confirmarInventario(
            brief,
            { elementos: propuesta.descripcion.elementos, tomas: tomasDe(e, propuesta) },
            accion.via,
            deps.ahora(),
            { fotos: fotosUsadas(e), llamadasTexto: await llamadasUsadas(proyecto) },
          );
          await almacen.guardar(nuevo);
          brief = nuevo;
          const { inventario } = nuevo.hechos;
          await anotar(
            proyecto,
            'usuario',
            paso,
            'CONFIRMACION',
            `Inventario confirmado (${accion.via}) y congelado en el brief v${nuevo.version}: ${textoDelInventario(inventario.elementos)}. Autoriza ≤ ${nuevo.presupuesto.fotos} fotos y ≤ ${nuevo.presupuesto.llamadasTexto} llamadas de texto.`,
          );
          notas.push(`Productor: inventario confirmado por ti (${accion.via}) y congelado en el brief v${nuevo.version}.`);
        } else if (parada) {
          if (brief.hechos.inventario.estado === 'PROPUESTO') {
            const propuesta = await leerPropuesta(e);
            if (propuesta) {
              const nuevo = actualizarInventarioPropuesto(brief, { elementos: propuesta.descripcion.elementos, tomas: tomasDe(e, propuesta) }, deps.ahora());
              if (nuevo !== brief) {
                await almacen.guardar(nuevo);
                brief = nuevo;
              }
            }
          }
          textoParada = resumenParaLaParada(brief);
          await anotar(proyecto, 'productor', paso, 'PARADA', primeraLinea(parada));
          paradaAnotada = true;
        }
      }

      // Tres: lo que confirma o rechaza el usuario en la foto queda en la bitácora.
      if (paso === 'CONFIRMAR_FOTO' && brief && e.paso !== 'CONFIRMAR_FOTO' && (accion.confirmo || accion.rechazo)) {
        await anotar(
          proyecto,
          'usuario',
          paso,
          'CONFIRMACION',
          accion.rechazo ? `Foto rechazada (${accion.via}): ${accion.rechazo}` : `Foto confirmada (${accion.via}): ${e.fotoElegida}`,
        );
      }

      // Cuatro: lo que han anotado los pasos (el informe del especialista) va a la bitácora.
      const inicio = desde.get(proyecto);
      if (brief && inicio !== undefined) {
        const nuevas = e.historial.slice(inicio).map((h) => h.nota);
        if (nuevas.length) await anotar(proyecto, QUIEN_POR_PASO[paso] ?? 'codigo', paso, 'INFORME', nuevas.join(' · '));
        if (parada && !paradaAnotada) await anotar(proyecto, 'productor', paso, 'PARADA', primeraLinea(parada));
        desde.delete(proyecto);
      }

      const resultado: ResultadoTras = {
        ...(notas.length ? { notas } : {}),
        ...(textoParada ? { textoParada } : {}),
      };
      return resultado;
    },

    fuente(proyecto) {
      return {
        async contexto() {
          const brief = await almacen.leer(proyecto);
          return brief ? contextoDelBrief(brief) : undefined;
        },

        async inventarioConfirmado(): Promise<readonly ElementoComparable[] | undefined> {
          const brief = await almacen.leer(proyecto);
          if (!brief || brief.hechos.inventario.estado !== 'CONFIRMADO') return undefined;
          return brief.hechos.inventario.elementos;
        },

        async antesDeLlamar(quien: QuienLlama): Promise<void> {
          const brief = await almacen.leer(proyecto);
          if (!brief) return;
          const usadas = await llamadasUsadas(proyecto);
          const tope = brief.presupuesto.llamadasTexto;
          const paso = pasoActual.get(proyecto) ?? 'PROPUESTA';
          if (usadas >= tope) {
            await anotar(proyecto, 'productor', paso, 'PRESUPUESTO', `Llamada de ${quien} cortada: ${usadas} de ${tope}.`);
            throw new ErrorDeUsuario(`Presupuesto de llamadas de texto agotado: ${usadas} de ${tope} autorizadas en brief.json. La orden se para; para seguir, vuelve a confirmar en una parada o crea un encargo nuevo.`);
          }
          await anotar(proyecto, quien, paso, 'LLAMADA', `Llamada ${usadas + 1} de ${tope} (${quien}).`);
        },
      };
    },
  };
}
