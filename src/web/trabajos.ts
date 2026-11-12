/**
 * Trabajos en segundo plano (conceptos, plan, generar, corregir y los avances de un encargo de la orden única).
 * Viven en memoria: si se recarga la página siguen corriendo y la vista los recupera.
 * Los avisos de deps.avisar se asocian al trabajo en curso con AsyncLocalStorage.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { AlProgresar, Progreso } from '../aplicacion/progreso.js';
import { describirError, ErrorHttp, type ErrorApi } from './errores.js';
import { restanteMs, type Medias } from './estimacion.js';

export type TipoTrabajo = 'CONCEPTOS' | 'PLAN' | 'GENERAR' | 'CORREGIR' | 'ENCARGO';
export type EstadoTrabajo = 'EN_CURSO' | 'TERMINADO' | 'ERROR';
/** Cada modo tiene sus propias piezas: el mismo id puede existir en los dos sin ser la misma pieza. */
export type ModoTrabajo = 'REAL' | 'SIMULADO';

export interface Trabajo {
  id: string;
  tipo: TipoTrabajo;
  /** A quién pertenece: el id de la pieza o, en la orden única, «encargo:<proyecto>». No puede tener dos trabajos a la vez. */
  piezaId: string;
  modo: ModoTrabajo;
  estado: EstadoTrabajo;
  mensaje: string;
  hechas: number;
  total: number;
  iniciadoEn: number;
  /** Cuándo se espera que termine. Se recalcula al empezar cada paso. */
  finEstimadoEn: number;
  terminadoEn?: number;
  avisos: string[];
  resultado?: unknown;
  error?: ErrorApi;
}

/** Lo que ve el frontend: el trabajo más el tiempo que queda. */
export interface VistaTrabajo extends Trabajo {
  quedanSegundos: number;
  /** Ya se pasó de la estimación pero sigue en curso. */
  casiListo: boolean;
  /** De 0 a 1, para la barra. */
  fraccion: number;
}

export interface Lanzamiento {
  tipo: TipoTrabajo;
  piezaId: string;
  /** Por defecto, REAL. */
  modo?: ModoTrabajo;
  medias: Medias;
  ejecutar: (alProgresar: AlProgresar) => Promise<unknown>;
}

const MAX_TRABAJOS_GUARDADOS = 200;

export class RegistroTrabajos {
  private readonly trabajos = new Map<string, Trabajo>();
  private readonly enCurso = new AsyncLocalStorage<string>();

  constructor(private readonly ahora: () => number = Date.now) {}

  /** Arranca el trabajo y vuelve enseguida. Una pieza no puede tener dos trabajos a la vez. */
  lanzar({ tipo, piezaId, modo = 'REAL', medias, ejecutar }: Lanzamiento): Trabajo {
    const activo = this.ultimoDe(piezaId, modo);
    if (activo?.estado === 'EN_CURSO') {
      throw new ErrorHttp(409, 'TRABAJO_EN_CURSO', 'Esta pieza ya tiene un trabajo en curso. Espera a que termine.');
    }

    const inicio = this.ahora();
    const trabajo: Trabajo = {
      id: randomUUID(),
      tipo,
      piezaId,
      modo,
      estado: 'EN_CURSO',
      mensaje: 'Preparando…',
      hechas: 0,
      total: 0,
      iniciadoEn: inicio,
      finEstimadoEn: inicio + medias.directorMs,
      avisos: [],
    };
    this.guardar(trabajo);

    let pasoAnterior = '';
    const alProgresar = (progreso: Progreso) => {
      Object.assign(trabajo, { mensaje: progreso.mensaje, hechas: progreso.hechas, total: progreso.total });
      // Solo se reestima al cambiar de paso: si no, cada imagen terminada «reiniciaría» la cuenta atrás.
      const paso = `${progreso.mensaje}|${progreso.pasosRestantes.director}|${progreso.pasosRestantes.tandas}`;
      if (paso !== pasoAnterior) {
        pasoAnterior = paso;
        trabajo.finEstimadoEn = this.ahora() + restanteMs(progreso.pasosRestantes, medias) + (progreso.otrosMs ?? 0);
      }
    };

    void this.enCurso.run(trabajo.id, async () => {
      try {
        trabajo.resultado = await ejecutar(alProgresar);
        trabajo.estado = 'TERMINADO';
        trabajo.mensaje = 'Listo';
      } catch (error) {
        trabajo.estado = 'ERROR';
        trabajo.error = describirError(error).error;
        trabajo.mensaje = trabajo.error.message;
      } finally {
        trabajo.terminadoEn = this.ahora();
      }
    });
    return trabajo;
  }

  obtener(id: string): Trabajo | undefined {
    return this.trabajos.get(id);
  }

  /** El trabajo más reciente de una pieza de ese modo (en curso o terminado). */
  ultimoDe(piezaId: string, modo: ModoTrabajo = 'REAL'): Trabajo | undefined {
    return [...this.trabajos.values()].filter((t) => t.piezaId === piezaId && t.modo === modo).at(-1);
  }

  /** Adjunta el aviso al trabajo en curso. Devuelve false si no hay ninguno (aviso suelto). */
  avisar(mensaje: string): boolean {
    const trabajo = this.trabajos.get(this.enCurso.getStore() ?? '');
    trabajo?.avisos.push(mensaje);
    return Boolean(trabajo);
  }

  vista(trabajo: Trabajo): VistaTrabajo {
    const ahora = trabajo.terminadoEn ?? this.ahora();
    const transcurrido = ahora - trabajo.iniciadoEn;
    const quedanMs = trabajo.finEstimadoEn - ahora;
    const enCurso = trabajo.estado === 'EN_CURSO';
    const duracionEstimada = Math.max(1, trabajo.finEstimadoEn - trabajo.iniciadoEn);
    return {
      ...trabajo,
      quedanSegundos: enCurso ? Math.max(0, Math.ceil(quedanMs / 1000)) : 0,
      casiListo: enCurso && quedanMs <= 0,
      fraccion: enCurso ? Math.min(0.97, Math.max(0.02, transcurrido / duracionEstimada)) : 1,
    };
  }

  private guardar(trabajo: Trabajo): void {
    this.trabajos.set(trabajo.id, trabajo);
    if (this.trabajos.size > MAX_TRABAJOS_GUARDADOS) {
      const masAntiguoTerminado = [...this.trabajos.values()].find((t) => t.estado !== 'EN_CURSO');
      if (masAntiguoTerminado) this.trabajos.delete(masAntiguoTerminado.id);
    }
  }
}
