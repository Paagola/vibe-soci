// El guion: convierte el estado REAL de los encargos (GET /api/procesos) en una línea de tiempo y la evalúa como
// función pura de `t`. Sin three.js ni DOM: se prueba en Node (test/diorama-guion.test.ts).
//
// - El recorrido del material sale del historial del encargo (los pasos por los que ha pasado) más el paso actual.
//   Si un paso va hacia atrás, es un retorno de verdad: la foto descartada o rechazada vuelve al generador; tras dos
//   descartes, la orden vuelve a la parada 1. La propuesta devuelta al director de diseño sale de
//   intenciones/post.propuesta.json (2 propuestas = se le devolvió una vez).
// - Lo nuevo que llega en cada consulta se añade al final de la línea de tiempo: la escena «cuenta» lo que ha pasado
//   desde la consulta anterior, en orden y con su duración de escena (el simulado tarda milisegundos; el real, minutos).
// - Al abrir, NO se repite el pasado: el material aparece donde está ahora. Sin encargos, reposo.
import { ORDEN, PUESTOS, PUESTO_DE_PASO, REPOSO, ruta, sitioDeEntrega } from './plano.js';

export const VELOCIDAD = 0.8; // m/s del corredor
export const DURACION = Object.freeze({ dejar: 0.75, recoger: 0.75, coger: 1.1, mostrar: 1.8, agente: 2.8, maquina: 2.6, bandeja: 0.9, prueba: 2.2, girar: 0.35 });

// ---------------------------------------------------------------- Qué encargo se enseña

/** El encargo que se cuenta: el que tiene un trabajo en marcha; si no, el último que espera; si no, el último hecho. */
export function enfoque(estado) {
  const lista = estado?.encargos ?? [];
  if (!lista.length) return null;
  const enCurso = lista.filter((e) => e.trabajo?.estado === 'EN_CURSO').sort((a, b) => b.trabajo.iniciadoEn - a.trabajo.iniciadoEn);
  if (enCurso[0]) return enCurso[0];
  const porFecha = [...lista].sort((a, b) => String(b.actualizadoEn).localeCompare(String(a.actualizadoEn)));
  return porFecha.find((e) => e.paso !== 'HECHO') ?? porFecha[0];
}

/** Los otros encargos abiertos (sin terminar): esperan en la bandeja de entrada. */
export function otrosAbiertos(estado, foco) {
  return (estado?.encargos ?? []).filter((e) => e !== foco && e.proyecto !== foco?.proyecto && e.paso !== 'HECHO').length;
}

// ---------------------------------------------------------------- Recorrido → visitas a puestos

/** Pasos por los que ha ido el material: historial + paso actual, sin repetidos seguidos y con los huecos rellenos. */
export function pasosDelRecorrido(encargo) {
  const crudos = [...(encargo.recorrido ?? []).map((r) => r.paso), encargo.paso].filter((p) => ORDEN.includes(p));
  const pasos = [];
  for (const p of crudos) {
    const ultimo = pasos.at(-1);
    if (p === ultimo) continue;
    if (ultimo !== undefined && ORDEN.indexOf(p) > ORDEN.indexOf(ultimo)) {
      // Hacia delante: el material pasa por los puestos intermedios aunque no dejaran nota.
      for (let i = ORDEN.indexOf(ultimo) + 1; i < ORDEN.indexOf(p); i++) pasos.push(ORDEN[i]);
    }
    pasos.push(p);
  }
  return pasos;
}

/**
 * Las visitas a puestos, con el material que entra y el que sale. Cada visita tiene una clave estable (su orden y
 * su puesto) para poder añadir solo lo nuevo en la siguiente consulta.
 */
export function visitasDe(encargo) {
  const pasos = pasosDelRecorrido(encargo);
  const visitas = [];
  let comprobaciones = 0;
  let generadas = 0; // número del intento de foto al que pertenece el material desde GENERAR
  const intentos = encargo.intentos ?? [];
  const disenos = encargo.diseno?.propuestas ?? 0;
  pasos.forEach((paso, i) => {
    const siguiente = pasos[i + 1];
    const ultima = i === pasos.length - 1;
    const puesto = PUESTO_DE_PASO[paso];
    switch (paso) {
      case 'REFERENCIA':
        return visitas.push({ puesto, accion: 'coger', sale: 'ficha' });
      case 'FOTO_REAL':
        return visitas.push({ puesto, accion: 'procesar', sale: 'foto' });
      case 'PROPUESTA':
        return visitas.push({ puesto, accion: 'procesar', sale: 'propuesta' });
      case 'CONFIRMAR_ELEMENTOS':
        return visitas.push({ puesto, accion: 'mostrar', sale: null });
      case 'GENERAR':
        generadas++;
        return visitas.push({ puesto, accion: 'procesar', sale: 'fotoNueva', n: generadas });
      case 'COMPROBAR': {
        const final = intentos[comprobaciones++]?.final ?? 'PENDIENTE';
        if (final === 'PENDIENTE') return visitas.push({ puesto, accion: 'procesar', sale: 'fotoNueva', sella: false, n: generadas });
        // RECHAZADA es la decisión posterior de la persona: el sello del revisor fue el de la comprobación (pasó).
        return visitas.push({ puesto, accion: 'procesar', sale: final === 'DESCARTA' ? 'fotoMal' : 'fotoOk', sella: true, veredicto: final === 'RECHAZADA' ? 'PASA' : final, n: generadas });
      }
      case 'CONFIRMAR_FOTO':
        // Si después vuelve al generador (o a la parada 1), la persona la rechazó: sale con la cruz roja.
        {
          const rechazada = Boolean(siguiente && ORDEN.indexOf(siguiente) < ORDEN.indexOf('CONFIRMAR_FOTO'));
          return visitas.push({ puesto, accion: 'mostrar', sale: rechazada ? 'fotoMal' : null, rechazada, ...(rechazada ? { veredicto: 'RECHAZADA' } : {}), n: generadas });
        }
      case 'MASCARA':
        return visitas.push({ puesto, accion: 'procesar', sale: 'recorte', n: generadas });
      case 'INTENCION':
        // Con dos propuestas, la primera no pasó la prueba en el compositor y se le devolvió UNA vez.
        if (disenos >= 2 && (!ultima || encargo.trabajo?.estado !== 'EN_CURSO')) {
          visitas.push({ puesto, accion: 'procesar', sale: 'boceto' });
          visitas.push({ puesto: 'compositor', accion: 'procesar', sale: 'pruebaMal', prueba: true });
        }
        return visitas.push({ puesto, accion: 'procesar', sale: 'boceto' });
      case 'COMPONER':
        return visitas.push({ puesto, accion: 'procesar', sale: 'post' });
      case 'HECHO':
        return visitas.push({ puesto, accion: 'exponer', sale: null });
      default:
        return undefined;
    }
  });
  return visitas.map((v, i) => ({ ...v, clave: `${i}:${v.puesto}${v.prueba ? ':prueba' : ''}` }));
}

/** Cómo se queda el encargo al final de lo que se sabe: trabajando, esperando a la persona, con un fallo o hecho. */
export function finalDe(encargo) {
  const t = encargo.trabajo;
  if (encargo.paso === 'HECHO') return { modo: 'hecho' };
  if (t?.estado === 'EN_CURSO') {
    const reintento = (t.avisos ?? []).find((a) => /no responde|HTTP|tiempo/i.test(a));
    return { modo: 'trabajando', aviso: reintento ? rotuloDeAviso(reintento) : null };
  }
  if (t?.estado === 'ERROR') return { modo: 'espera', error: rotuloDeAviso(t.error?.message ?? ''), mensaje: t.error?.message ?? '' };
  return { modo: 'espera', bloqueo: encargo.bloqueo ?? null };
}

/** Lo que pone la nube: el código HTTP si lo hay (503, 429…), un reloj si no contestó a tiempo y «!» si no se sabe. */
export function rotuloDeAviso(texto) {
  const http = /HTTP (\d{3})/.exec(texto);
  if (http) return http[1];
  if (/a tiempo|tiempo|timeout/i.test(texto)) return '…';
  return '!';
}

// ---------------------------------------------------------------- Línea de tiempo

const distancia = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

export class Guion {
  constructor() {
    this.reiniciar(null);
  }

  reiniciar(proyecto, t = 0) {
    this.proyecto = proyecto;
    this.segmentos = [{ tipo: 'quieto', t0: -Infinity, t1: Infinity, en: { ...REPOSO }, mano: null, expuesto: null }];
    this.claves = [];
    this.pendiente = null; // cómo terminar la última visita cuando llegue lo siguiente
    this.firmaFinal = '';
    this.n = 0; // intento de foto del material que lleva el corredor
    this.veredicto = null; // sello que lleva ese material
    this.otros = 0;
    this.extra = { modo: 'reposo' };
    this.t = t;
  }

  /**
   * Aplica una consulta nueva en el instante de escena `t`. Devuelve true si algo cambió.
   * La primera vez (o si cambia el encargo) coloca el material donde está, sin contar el pasado.
   */
  actualizar(estado, t) {
    let foco = enfoque(estado);
    // El foco no salta a otro encargo mientras la escena aún cuenta el actual (ni antes de dejar su post en la salida).
    const actual = this.proyecto ? (estado?.encargos ?? []).find((e) => e.proyecto === this.proyecto) : null;
    if (actual && foco && foco.proyecto !== actual.proyecto && foco.trabajo?.estado !== 'EN_CURSO') {
      const contando = (this.segmentos.at(-1)?.t0 ?? -Infinity) > t;
      const sinSalida = actual.paso === 'HECHO' && !this.claves.some((c) => c.endsWith(':salida'));
      if (contando || sinSalida) foco = actual;
    }
    this.otros = otrosAbiertos(estado, foco);
    if (!foco) {
      if (this.proyecto !== null) this.reiniciar(null, t);
      return false;
    }
    const visitas = visitasDe(foco);
    const final = finalDe(foco);
    if (foco.proyecto !== this.proyecto || !this.claves.every((c, i) => visitas[i]?.clave === c)) {
      this.reiniciar(foco.proyecto, t);
      this.colocar(visitas, final, t);
      return true;
    }
    const nuevas = visitas.slice(this.claves.length);
    const firma = `${final.modo}|${final.aviso ?? ''}|${final.error ?? ''}|${final.bloqueo ?? ''}`;
    if (!nuevas.length && firma === this.firmaFinal) return false;
    // Lo de la última visita que estaba abierta se cierra ahora, y se cuentan las nuevas detrás.
    if (!nuevas.length) {
      // Mismo sitio, otro estado (p. ej. de trabajando a error): se reabre la última visita con el estado nuevo.
      this.cerrarAbierto(t, false);
      this.alargarUltima(final, t);
      return true;
    }
    this.cerrarAbierto(t, true, visitas[this.claves.length - 1]);
    nuevas.forEach((v, i) => this.anadir(v, i === nuevas.length - 1 ? final : null));
    this.firmaFinal = firma;
    return true;
  }

  /** Coloca el material donde está ahora (primera consulta): sin animación del pasado. */
  colocar(visitas, final, t) {
    const ultima = visitas.at(-1);
    this.claves = visitas.map((v) => v.clave);
    this.firmaFinal = `${final.modo}|${final.aviso ?? ''}|${final.error ?? ''}|${final.bloqueo ?? ''}`;
    if (!ultima) return;
    // El material que llega a la última visita es el que salió de la anterior.
    const previa = visitas.slice(0, -1).reverse().find((v) => v.sale);
    const mano = previa?.sale ?? null;
    this.segmentos = [];
    if (ultima.accion === 'exponer') {
      this.segmentos.push({ tipo: 'quieto', t0: t, t1: Infinity, en: { ...REPOSO }, mano: null, expuesto: 'post' });
      this.extra = { modo: 'reposo' };
      return;
    }
    const sitio = sitioDeEntrega(ultima.puesto);
    this.cursor = { t, en: sitio, mano };
    this.empezarVisita(ultima, final, { llegarAndando: false, colocando: true });
  }

  get finTimeline() {
    return this.segmentos.at(-1)?.t1 ?? 0;
  }

  /** Cierra el segmento abierto (t1 = Infinity) en `t` o tras su duración mínima, y añade lo que faltaba de esa visita. */
  cerrarAbierto(t, continuar, visita) {
    const ultimo = this.segmentos.at(-1);
    if (!ultimo || ultimo.t1 !== Infinity) return;
    ultimo.t1 = Math.max(t, ultimo.t0 + (ultimo.minimo ?? 0.6));
    this.cursor = { t: ultimo.t1, en: ultimo.en, mano: ultimo.mano };
    if (!continuar) return;
    if (this.pendiente) this.pendiente(visita);
    this.pendiente = null;
  }

  /** Reabre la última visita con un estado final distinto (trabajando → error, aviso de reintento…). */
  alargarUltima(final, t) {
    const ultimo = this.segmentos.at(-1);
    this.firmaFinal = `${final.modo}|${final.aviso ?? ''}|${final.error ?? ''}|${final.bloqueo ?? ''}`;
    const base = { ...ultimo, t0: Math.max(t, ultimo.t1), t1: Infinity, manoFin: undefined };
    if (final.modo === 'espera') Object.assign(base, { tipo: base.tipo === 'mostrar' ? 'mostrar' : 'espera', espera: true, error: final.error ?? null, trabajando: false, enMesa: base.enMesa || ultimo.tipo === 'procesar' });
    else if (final.modo === 'trabajando') Object.assign(base, { aviso: final.aviso, error: null });
    this.segmentos.push(base);
  }

  push(seg) {
    this.segmentos.push(seg);
    this.cursor = { t: seg.t1, en: seg.hasta ?? seg.en, mano: seg.manoFin ?? seg.mano };
    return seg;
  }

  andarHasta(destino) {
    const { t, en, mano } = this.cursor;
    if (distancia(en, destino) < 0.02) {
      if (Math.abs(destino.yaw - en.yaw) > 0.05) this.push({ tipo: 'girar', t0: t, t1: t + DURACION.girar, en, hasta: destino, mano });
      return;
    }
    // Por las calles del loft (plano.ruta), no en línea recta: así no atraviesa muebles ni el jardín.
    const { puntos, largo } = ruta(en, destino);
    this.push({ tipo: 'andar', t0: t, t1: t + DURACION.girar + largo / VELOCIDAD, desde: en, hasta: destino, puntos, largo, en, mano, n: this.n, veredicto: this.veredicto });
  }

  anadir(visita, final) {
    this.claves.push(visita.clave);
    if (visita.accion === 'exponer') {
      this.andarHasta(sitioDeEntrega(visita.puesto));
      const { t, en, mano } = this.cursor;
      this.push({ tipo: 'dejar', t0: t, t1: t + DURACION.dejar, en, puesto: visita.puesto, mano, manoFin: null, expuesto: null });
      this.andarHasta({ ...REPOSO });
      const c = this.cursor;
      this.push({ tipo: 'quieto', t0: c.t, t1: Infinity, en: c.en, mano: null, expuesto: 'post' });
      this.extra = { modo: 'reposo' };
      return;
    }
    this.empezarVisita(visita, final, { llegarAndando: true });
  }

  /** Una visita: llegar, y según el puesto coger / dejar-procesar-recoger / enseñar. Si es la última, queda abierta. */
  empezarVisita(visita, final, { llegarAndando, colocando = false }) {
    const sitio = sitioDeEntrega(visita.puesto);
    if (llegarAndando) this.andarHasta(sitio);
    const abierta = Boolean(final);
    const tipoPuesto = PUESTOS[visita.puesto].tipo;
    const trabajando = final?.modo === 'trabajando';
    const espera = final?.modo === 'espera';
    const veredictoPrevio = this.veredicto;
    const n = visita.n ?? this.n;
    const comun = { puesto: visita.puesto, visita: visita.clave, error: final?.error ?? null, aviso: final?.aviso ?? null, n, veredicto: visita.veredicto ?? (visita.sale ? null : this.veredicto) };
    this.n = n;
    if (visita.sale) this.veredicto = visita.veredicto ?? null;

    if (visita.accion === 'mostrar') {
      const { t, en, mano } = this.cursor;
      this.push({ tipo: 'mostrar', t0: t, t1: abierta ? Infinity : t + DURACION.mostrar, minimo: DURACION.mostrar, en, mano, ...(visita.sale && !abierta ? { manoFin: visita.sale, veredictoFin: visita.veredicto ?? null } : {}), ...comun, veredicto: veredictoPrevio, espera: abierta ? !trabajando : true, rechazada: visita.rechazada });
      if (abierta) {
        this.pendiente = (v = visita) => {
          // La persona decidió: si la rechazó, sale con la cruz (y vuelve atrás en las visitas siguientes).
          const s = this.segmentos.at(-1);
          if (v.sale) Object.assign(s, { manoFin: v.sale, rechazada: v.rechazada, veredictoFin: v.veredicto ?? null });
          if (v.sale) this.veredicto = v.veredicto ?? this.veredicto;
          this.cursor.mano = v.sale ?? this.cursor.mano;
        };
      }
      return;
    }

    if (visita.accion === 'coger') {
      const { t, en, mano } = this.cursor;
      if (abierta && espera) {
        // Falta la referencia: el corredor espera ante el tablero, con las manos vacías.
        this.push({ tipo: 'espera', t0: t, t1: Infinity, minimo: 0.8, en, mano, ...comun, espera: true });
        this.pendiente = () => {
          const c = this.cursor;
          this.push({ tipo: 'coger', t0: c.t, t1: c.t + DURACION.coger, en: c.en, mano: null, manoFin: visita.sale, ...comun, sale: visita.sale });
        };
        return;
      }
      if (!colocando) this.push({ tipo: 'coger', t0: t, t1: t + DURACION.coger, en, mano: null, manoFin: visita.sale, ...comun, sale: visita.sale });
      if (abierta) this.push({ tipo: 'espera', t0: this.cursor.t, t1: Infinity, minimo: 0.3, en, mano: visita.sale, ...comun, espera: false });
      return;
    }

    // procesar: dejar → el puesto trabaja → recoger lo que sale.
    const durTrabajo = visita.prueba ? DURACION.prueba : tipoPuesto === 'agente' ? DURACION.agente : tipoPuesto === 'bandeja' ? DURACION.bandeja : DURACION.maquina;
    let c = this.cursor;
    const entra = c.mano;
    // Al colocar (primera consulta) no se cuenta la llegada: el material ya está en la mesa.
    if (!colocando) this.push({ tipo: 'dejar', t0: c.t, t1: c.t + DURACION.dejar, en: c.en, mano: c.mano, manoFin: null, entra: c.mano, ...comun });
    c = this.cursor;
    const procesar = { tipo: 'procesar', t0: c.t, en: c.en, mano: null, entra, sale: visita.sale, sella: visita.sella, ...comun, duracion: durTrabajo };
    if (!abierta) {
      this.push({ ...procesar, t1: c.t + durTrabajo, trabajando: true });
      this.recoger(visita, comun);
      return;
    }
    if (trabajando) {
      // Trabajo en curso de verdad: el puesto trabaja hasta que la consulta diga otra cosa.
      this.push({ ...procesar, t1: Infinity, minimo: durTrabajo, trabajando: true, abierto: true });
    } else {
      // Parado aquí (fallo, o espera a la persona): el puesto hizo su parte y el material se queda en la mesa.
      if (!colocando) this.push({ ...procesar, t1: c.t + durTrabajo, trabajando: true });
      const d = this.cursor;
      this.push({ ...procesar, tipo: 'espera', t0: d.t, t1: Infinity, minimo: 0.6, trabajando: false, espera: true, enMesa: true, sale: visita.sale });
    }
    this.pendiente = (v = visita) => {
      // El veredicto que no se sabía mientras trabajaba (p. ej. la comprobación) llega ahora: lo que sale es el de v.
      for (const s of this.segmentos) if (s.visita === visita.clave) Object.assign(s, { sale: v.sale, sella: v.sella });
      this.recoger(v, comun);
    };
  }

  recoger(visita, comun) {
    const c = this.cursor;
    this.push({ tipo: 'recoger', t0: c.t, t1: c.t + DURACION.recoger, en: c.en, mano: null, manoFin: visita.sale, recoge: visita.sale, ...comun });
  }

  /** El estado de la escena en `t`: el segmento activo y su avance (0..1). */
  evaluar(t) {
    let seg = this.segmentos[0];
    for (const s of this.segmentos) {
      if (t >= s.t0) seg = s;
      else break;
    }
    const dur = seg.t1 - seg.t0;
    const k = Number.isFinite(dur) && dur > 0 ? Math.min(1, Math.max(0, (t - seg.t0) / dur)) : 0;
    // El post de la última pieza terminada se queda en el expositor.
    const expuesto = [...this.segmentos].reverse().find((s) => s.t0 <= t && s.expuesto !== undefined)?.expuesto ?? null;
    return { seg, k, t, local: t - seg.t0, otros: this.otros, expuesto };
  }
}
