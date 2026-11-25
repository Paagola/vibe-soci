// Chat: lo que hacía pase/index.js para un encargo, sin el banco óptico en 3D. Monta las fichas de la orden dentro de
// un nodo (la tarjeta del chat): estaciones, ficha de la estación, herramientas de la fase y el trabajo en curso.
import { api, seguirTrabajo } from './api.js';
import { avisar, bloqueError, h, reemplazar } from './ui.js';
import { urlsDe } from './orden.js';
import { cargarPresupuesto, controlesDeFase, fichaDeSubida, fichas, notificarCorreccion, pideRevision } from './pase/fichas.js';
import { fichaManual, fichaTaller, referenciasEditoriales } from './pase/taller.js';

const ESTACIONES = [
  { id: 'original', nombre: 'Original' },
  { id: 'referencia', nombre: 'Referencia' },
  { id: 'elementos', nombre: 'Inventario' },
  { id: 'candidata', nombre: 'Candidata' },
  { id: 'composicion', nombre: 'Composición' },
  { id: 'entrega', nombre: 'Entrega' },
];
const DE_TALLER = { elementos: 'Dirección', candidata: 'Producción', composicion: 'Revisión' };
const ETAPAS = { REFERENCIA: 'referencia', ELEMENTOS: 'elementos', FOTO: 'candidata', DISENO: 'composicion', RESULTADO: 'entrega' };
const pasoDe = (d) => (d?.encargo.taller && d.encargo.paso === 'CONFIRMAR_FOTO' ? 'composicion' : ETAPAS[d?.fase] ?? 'original');

/**
 * Monta un encargo en `raiz`. Sin `proyecto`, el formulario de alta (o la lista para retomar uno).
 * `alCrear(proyecto)` avisa al chat del encargo creado; `alCambiar(resumen)` le cuenta por dónde va.
 */
export function montarEncargo(raiz, { proyecto: inicial, alCrear, alCambiar, locales: localesIniciales = [] }) {
  let proyecto = inicial ?? null;
  let d = null;
  let locales = localesIniciales;
  let seleccion = 'original';
  let elemento = null;
  let hoja = null;
  let intentoFoto = null;
  let vistaPrevia;
  let ocupado = null;
  let turno = 0;
  let seguimiento = null;
  let cerrado = false;

  const nodoEstaciones = h('nav', { class: 'legado-estaciones', 'aria-label': 'Pasos del encargo' });
  const nodoTrabajo = h('div', { class: 'legado-trabajo', role: 'status' });
  const nodoFicha = h('div', { class: 'legado-ficha' });
  const nodoHerramientas = h('section', { class: 'legado-herramientas', hidden: true });
  reemplazar(raiz, nodoEstaciones, nodoTrabajo, nodoFicha, nodoHerramientas);

  const candidataVisible = () =>
    d?.intentos.find((i) => i.disponible && i.n === intentoFoto) ?? d?.intentos.find((i) => i.disponible && i.elegida) ?? d?.intentos.findLast((i) => i.disponible);

  function contexto() {
    return {
      d, proyecto, seleccion, elemento, candidata: candidataVisible(), elegirCandidata,
      hoja: hoja ?? (pideRevision(d) ? d.revisionEditorial.incidencias[0]?.id : null), vistaPrevia, locales, simulado: false,
      actual: pasoDe(d), urls: proyecto ? urlsDe(proyecto) : null, ocupada: Boolean(ocupado || d?.trabajo?.estado === 'EN_CURSO'),
      faltaEditorial: Boolean(d?.encargo.productorEditorial && !d.editorial),
      seleccionar, elegirHoja, abrirHerramientas, confirmarInventario, enviarSubida, usarReferencia, guardarPropuesta, crearLocalDeEjemplo,
      irActual: () => seleccionar(pasoDe(d)), avanzar, lanzar, recargar,
      alMostrarVista(vista) {
        const archivo = vista.diseno.split('/').map(encodeURIComponent).join('/');
        vistaPrevia = `${vista.base}${archivo}?v=${encodeURIComponent(vista.sello)}`;
        pintarFicha();
      },
    };
  }

  function pintarEstaciones() {
    if (!d) return reemplazar(nodoEstaciones);
    const actual = pasoDe(d);
    const indice = ESTACIONES.findIndex((s) => s.id === actual);
    reemplazar(nodoEstaciones, ESTACIONES.map((s, i) => h('button', {
      type: 'button', 'aria-pressed': String(s.id === seleccion), 'data-estado': i < indice || d.encargo.paso === 'HECHO' ? 'hecha' : s.id === actual ? 'actual' : '',
      onclick: () => seleccionar(s.id),
    }, (d.encargo.taller && DE_TALLER[s.id]) || s.nombre)));
  }

  function pintarTrabajo() {
    const t = d?.trabajo;
    if (!t || t.estado === 'TERMINADO') return reemplazar(nodoTrabajo);
    const fallido = t.estado === 'ERROR';
    reemplazar(nodoTrabajo, h('div', { class: 'legado-progreso', 'data-error': String(fallido) },
      fallido ? null : h('span', { class: 'legado-girando', 'aria-hidden': 'true' }),
      h('span', {}, fallido ? (t.error?.message ?? 'El trabajo ha fallado.') : (t.mensaje ?? 'Trabajando en el encargo…')),
      t.avisos?.at(-1) ? h('small', {}, t.avisos.at(-1)) : null));
  }

  function pintarFicha() {
    const ctx = contexto();
    if (!proyecto) return reemplazar(nodoFicha, fichaDeSubida(ctx));
    if (!d) return reemplazar(nodoFicha, h('p', { class: 'muted' }, 'Abriendo el encargo…'));
    if (d.encargo.taller && seleccion !== 'original') {
      return reemplazar(nodoFicha, seleccion === 'referencia'
        ? [d.encargo.taller.comanda?.editorial && !d.encargo.referencia ? [h('h2', {}, 'Referencias de la dirección'), referenciasEditoriales(d.encargo.taller.comanda.editorial)] : fichas.referencia(ctx), fichaManual(ctx)]
        : ctx.actual !== seleccion ? [h('h2', {}, (DE_TALLER[seleccion] ?? seleccion)), h('button', { type: 'button', onclick: ctx.irActual }, 'Ir a la fase actual')] : fichaTaller(ctx));
    }
    const seguir = ctx.actual === seleccion && d.espera.tipo === 'CONTINUAR' && !ctx.ocupada && !['candidata', 'composicion'].includes(seleccion);
    reemplazar(nodoFicha, fichas[seleccion](ctx), seguir ? h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'primario', onclick: (e) => avanzar(e.currentTarget) }, 'Continuar el encargo')) : null);
  }

  function pintarTodo() {
    if (cerrado) return;
    pintarEstaciones();
    pintarTrabajo();
    pintarFicha();
    nodoHerramientas.hidden = true;
    reemplazar(nodoHerramientas);
    if (d) alCambiar?.({ proyecto, plato: d.encargo.plato, paso: d.encargo.paso, local: d.local?.nombre ?? d.encargo.local });
  }

  function seleccionar(id, i = null) {
    seleccion = id;
    elemento = i;
    pintarTodo();
  }

  function elegirHoja(id) {
    hoja = id;
    vistaPrevia = undefined;
    pintarFicha();
    if (seleccion === 'composicion') abrirHerramientas();
  }

  function elegirCandidata(n) {
    intentoFoto = n;
    pintarFicha();
  }

  function abrirHerramientas() {
    if (!d) return;
    const controles = controlesDeFase(contexto());
    if (!controles) return;
    reemplazar(nodoHerramientas, controles);
    nodoHerramientas.hidden = false;
    nodoHerramientas.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function abrir(id) {
    const fecha = ++turno;
    proyecto = id;
    d = null;
    pintarTodo();
    try {
      const detalle = await api('GET', `/encargos/${encodeURIComponent(id)}`);
      if (fecha !== turno) return;
      d = detalle;
      seleccion = pasoDe(d);
    } catch (error) {
      reemplazar(nodoFicha, bloqueError(error));
      return;
    }
    pintarTodo();
    if (d.trabajo?.estado === 'EN_CURSO') seguir(d.trabajo);
  }

  async function recargar(saltar = false) {
    if (!proyecto || cerrado) return;
    const fecha = turno;
    const nuevo = await api('GET', `/encargos/${encodeURIComponent(proyecto)}`);
    if (fecha !== turno) return;
    const antes = pasoDe(d);
    if (nuevo.intentos.length !== d?.intentos.length) intentoFoto = null;
    d = nuevo;
    if (saltar && (antes !== pasoDe(d) || pideRevision(d))) {
      seleccion = pasoDe(d);
      elemento = null;
      hoja = null;
      vistaPrevia = undefined;
    }
    pintarTodo();
    if (d.trabajo?.estado === 'EN_CURSO') seguir(d.trabajo);
  }

  async function seguir(trabajo) {
    if (seguimiento === trabajo.id) return;
    seguimiento = trabajo.id;
    try {
      const final = await seguirTrabajo(trabajo.id, (t) => {
        if (!d || cerrado) return;
        d.trabajo = t;
        pintarTrabajo();
      }, () => cerrado);
      if (final.estado === 'ERROR') avisar(final.error?.message ?? 'El trabajo ha fallado.', 'error');
      await recargar(true);
    } catch (error) {
      avisar(error.message, 'error');
    } finally {
      seguimiento = null;
    }
  }

  async function ejecutar(boton, tipo, fn, mostrarError) {
    if (ocupado) return;
    ocupado = { tipo };
    const etiqueta = boton?.textContent;
    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Un momento…';
    }
    try {
      return await fn();
    } catch (error) {
      if (mostrarError) mostrarError(error);
      else avisar(error.message, 'error');
      if (error.status === 409 && proyecto) await recargar().catch(() => {});
      return undefined;
    } finally {
      ocupado = null;
      if (boton?.isConnected) {
        boton.disabled = false;
        boton.textContent = etiqueta;
      }
    }
  }

  async function lanzar(boton, metodo, ruta, cuerpo) {
    if (d?.trabajo?.estado === 'EN_CURSO') return;
    const accion = d?.revision && (metodo === 'PUT' || cuerpo?.confirmo || cuerpo?.rechazo || cuerpo?.volverAlInventario) ? { ...cuerpo, revision: d.revision } : cuerpo;
    const respuesta = await ejecutar(boton, 'avance', () => api(metodo, ruta, accion));
    if (!respuesta) return;
    if (respuesta.trabajo) {
      d.trabajo = respuesta.trabajo;
      pintarTrabajo();
      pintarFicha();
      seguir(respuesta.trabajo);
    }
    return respuesta;
  }

  function avanzar(boton, cuerpo = {}) {
    return lanzar(boton, 'POST', `/encargos/${encodeURIComponent(proyecto)}/avanzar`, cuerpo);
  }

  async function guardarPropuesta(boton, propuesta) {
    const cuerpo = { propuesta, ...(d.revision ? { revision: d.revision } : {}) };
    const respuesta = await ejecutar(boton, 'propuesta', () => api('PUT', `/encargos/${encodeURIComponent(proyecto)}/propuesta`, cuerpo));
    if (!respuesta) return;
    notificarCorreccion(respuesta);
    await recargar().catch((error) => avisar(error.message, 'error'));
  }

  async function usarReferencia(boton, preparar) {
    if (d?.trabajo?.estado === 'EN_CURSO') return;
    const respuesta = await ejecutar(boton, 'referencia', async () => api('PUT', `/encargos/${encodeURIComponent(proyecto)}/referencia`, await preparar()));
    if (respuesta) await avanzar(null);
  }

  async function enviarSubida(boton, preparar, errores) {
    const r = await ejecutar(boton, 'alta', async () => api('POST', '/encargos', await preparar()), (error) => reemplazar(errores, bloqueError(error)));
    if (r?.encargo) {
      alCrear?.(r.encargo.proyecto);
      await abrir(r.encargo.proyecto);
    }
  }

  async function crearLocalDeEjemplo(boton) {
    const datos = await ejecutar(boton, 'local', async () => {
      await api('POST', '/locales/ejemplo');
      return api('GET', '/locales');
    });
    if (datos) {
      locales = datos.locales;
      pintarFicha();
    }
  }

  function confirmarInventario() {
    if (!d || d.trabajo?.estado === 'EN_CURSO') return;
    const revision = d.revision;
    const gastos = h('div', { role: 'status' }, 'Consultando el presupuesto…');
    const confirmar = h('button', { type: 'button', class: 'primario', disabled: true, onclick: () => {
      reemplazar(nodoHerramientas);
      nodoHerramientas.hidden = true;
      if (revision === d?.revision) avanzar(null, { confirmo: 'CONFIRMAR_ELEMENTOS' });
    } }, 'Confirmar inventario');
    reemplazar(nodoHerramientas, h('h3', {}, 'Antes de la foto candidata'), h('p', {}, 'Confirma el inventario, la nueva toma y el presupuesto.'), gastos,
      h('div', { class: 'acciones' }, h('button', { type: 'button', onclick: () => { nodoHerramientas.hidden = true; } }, 'Volver a revisar'), confirmar));
    nodoHerramientas.hidden = false;
    nodoHerramientas.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    cargarPresupuesto(proyecto, gastos).then((ok) => { confirmar.disabled = !ok; });
  }

  if (!localesIniciales.length) api('GET', '/locales').then((r) => { locales = r.locales; if (!proyecto) pintarFicha(); }).catch(() => {});
  if (proyecto) abrir(proyecto);
  else pintarTodo();

  return {
    abrir,
    recargar: () => recargar(true),
    cerrar() {
      cerrado = true;
    },
  };
}
