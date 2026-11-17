import { api, seguirTrabajo } from '../api.js';
import { avisar, bloqueError, formatearFecha, h, reemplazar } from '../ui.js';
import { estadoDePaso, urlsDe } from '../orden.js';
import { cargarPresupuesto, controlesDeFase, fichaDeSubida, fichas, hojaDe, notificarCorreccion, portadaDe } from './fichas.js';
import { distribuir, ESTACIONES, pintarPlano, proyectar2d, puntoInventario } from './plano.js';

const $ = (id) => document.getElementById(id);
const escena = $('escena');
const anclas = $('anclas');
const recorrido = $('recorrido');
const herramientas = $('herramientas');
const dialogo = $('dialogo');
const trabajoNodo = h('div', { role: 'status', 'aria-live': 'polite' });
const ETAPAS = { REFERENCIA: 'referencia', ELEMENTOS: 'elementos', FOTO: 'candidata', DISENO: 'composicion', RESULTADO: 'entrega' };
const pasoDe = (d) => ETAPAS[d?.fase] ?? 'original';
const indiceDe = (id) => ESTACIONES.findIndex((s) => s.id === id);
const nombreDe = (id) => ESTACIONES.find((s) => s.id === id)?.nombre ?? 'Original';
const ordinal = (i) => String(i + 1).padStart(2, '0');
const reduccion = matchMedia('(prefers-reduced-motion: reduce)');
const localizar = new Intl.NumberFormat('es-ES');

let procesos;
let lista = [];
let locales = [];
let d;
let proyecto;
let seccion = 'mesa';
let seleccion = 'original';
let elemento = null;
let hoja = null;
let vistaPrevia;
let seguimiento;
let turno = 0;
let ocupado;
let cargando = true;
let errorInicial;
let motor;
let dibujada = false;
let plano;
let propio = new URLSearchParams(location.search).get('vista') === '2d' ? '2d' : '3d';
let marcadores = [];
let materiales = {};
let revisionMaterial = '';
let contextoHerramientas;

function inventario() {
  return d?.propuesta?.valida ? d.propuesta.contenido.descripcion.elementos : [];
}

function contexto() {
  return {
    d, proyecto, seleccion, elemento, hoja, vistaPrevia, locales, simulado: procesos?.modo === 'SIMULADO',
    actual: pasoDe(d), urls: proyecto ? urlsDe(proyecto) : null, ocupada: Boolean(ocupado || d?.trabajo?.estado === 'EN_CURSO'),
    faltaEditorial: Boolean(d?.encargo.productorEditorial && !d.editorial),
    seleccionar, elegirHoja, abrirHerramientas, confirmarInventario, enviarSubida, usarReferencia, guardarPropuesta, crearLocalDeEjemplo,
    irActual: () => seleccionar(pasoDe(d)), avanzar, lanzar, recargar,
    alMostrarVista(vista) {
      const archivo = vista.diseno.split('/').map(encodeURIComponent).join('/');
      vistaPrevia = `${vista.base}${archivo}?v=${encodeURIComponent(vista.sello)}`;
      pintarFicha();
      pintarMateriales();
    },
  };
}

function medir() {
  const ancho = escena.clientWidth;
  const alto = escena.clientHeight;
  if (!ancho || !alto) return;
  plano = distribuir(ancho, alto);
  pintarPlano($('vista-2d'), plano, materiales);
  motor?.actualizar(plano, materiales, ancho, alto);
  anclar();
}

function anclar() {
  if (!plano) return;
  const estacionActiva = seccion === 'mesa' ? seleccion : '';
  for (const papel of $('vista-2d').children) papel.classList.toggle('activa', papel.dataset.tipo === estacionActiva);
  for (const { nodo, id, fila } of marcadores) {
    const papel = plano.papeles[indiceDe(id)];
    const [x, z] = fila == null ? [papel.x, papel.anclaZ] : puntoInventario(papel, fila);
    const [px, py] = motor && escena.dataset.vista === '3d' ? motor.proyectar(x, z, id) : proyectar2d(plano, x, z);
    nodo.style.left = `${px}%`;
    nodo.style.top = `${py}%`;
  }
}

function cambiarVista() {
  const vista = motor && dibujada && propio === '3d' ? '3d' : '2d';
  escena.dataset.vista = vista;
  $('cambiar-vista').hidden = !dibujada;
  $('cambiar-vista').textContent = vista === '3d' ? 'Vista 2D' : 'Vista 3D';
  $('cambiar-vista').setAttribute('aria-label', vista === '3d' ? 'Cambiar a vista 2D' : 'Cambiar a vista 3D');
  anclar();
}

function materialesDe() {
  if (!d) return {};
  const ctx = contexto();
  const foto = d.intentos.find((intento) => intento.elegida) ?? d.intentos.at(-1);
  const version = hojaDe(ctx)?.version;
  const portada = portadaDe(version);
  return {
    original: { url: d.fotoSubida.disponible ? ctx.urls.subida(880) : null },
    referencia: { url: d.referencia.conImagen ? ctx.urls.referencia(480) : null },
    elementos: { lineas: inventario().map((el) => el.nombre) },
    candidata: { url: foto?.disponible ? ctx.urls.activo(foto.activo, 680) : null },
    composicion: { url: vistaPrevia, lineas: d.editorial?.plan?.diapositivas?.map((x) => x.papel) ?? (d.diseno.intencion ? Object.values(d.diseno.intencion.contenido?.textos ?? {}).filter((x) => typeof x === 'string') : []) },
    entrega: { url: portada ? ctx.urls.diseno(portada, { lado: 680, sello: version.compuestaEn }) : null },
  };
}

function pintarMateriales() {
  materiales = materialesDe();
  const huella = JSON.stringify(materiales);
  if (revisionMaterial === huella) return;
  revisionMaterial = huella;
  medir();
}

function pintarNavegacion() {
  const actual = pasoDe(d);
  const activos = seccion === 'mesa';
  const inventariados = inventario();
  const pintarBoton = (s, i, espacial) => {
    const marcado = activos && s.id === seleccion;
    const pasado = d && (i < indiceDe(actual) || (actual === 'entrega' && i === 5));
    const identificador = ordinal(i);
    const tecla = espacial ? h('i', { 'aria-hidden': 'true' }, identificador) : h('small', { 'aria-hidden': 'true' }, pasado ? '✓' : identificador);
    const estrecho = !espacial && s.id === 'composicion';
    const b = h('button', {
      type: 'button', class: espacial ? 'ancla' : '', 'aria-pressed': String(marcado), 'aria-current': s.id === actual ? 'step' : undefined,
      'aria-controls': 'ficha', 'aria-label': estrecho ? s.nombre : undefined, 'data-paso': s.id, 'data-disponible': String(Boolean(d && (pasado || materiales[s.id]?.url || s.id === actual))),
      'data-estado': pasado ? 'hecha' : '', onclick: () => seleccionar(s.id, null, !espacial),
    }, tecla, h('span', { class: estrecho ? 'nombre-amplio' : '' }, s.nombre), estrecho ? h('span', { class: 'nombre-estrecho', 'aria-hidden': 'true' }, 'Diseño') : null);
    return b;
  };
  const foco = document.activeElement;
  const focoEnRecorrido = recorrido.contains(foco) && foco.dataset.paso;
  const focoEnEscena = anclas.contains(foco) && (foco.dataset.paso || foco.dataset.fila);
  marcadores = ESTACIONES.map((s, i) => ({ id: s.id, nodo: pintarBoton(s, i, true) }));
  inventariados.slice(0, 5).forEach((el, i) => {
    const nodo = h('button', { type: 'button', class: 'ancla ancla-objeto', 'aria-label': `Revisar ${el.nombre}`, 'aria-controls': 'ficha', 'aria-pressed': String(activos && seleccion === 'elementos' && elemento === i), 'data-fila': String(i), title: el.nombre, onclick: () => seleccionar('elementos', i) }, i + 1);
    marcadores.push({ id: 'elementos', fila: i, nodo });
  });
  reemplazar(anclas, marcadores.map((m) => m.nodo));
  reemplazar(recorrido, ESTACIONES.map((s, i) => pintarBoton(s, i, false)));
  if (focoEnEscena) (foco.dataset.fila != null ? anclas.querySelector(`[data-fila="${focoEnEscena}"]`) : anclas.querySelector(`[data-paso="${focoEnEscena}"]`))?.focus({ preventScroll: true });
  if (focoEnRecorrido) recorrido.querySelector(`[data-paso="${focoEnRecorrido}"]`)?.focus({ preventScroll: true });
  anclar();
}

function pintarMarco() {
  const ctx = contexto();
  const principal = $('titulo');
  const local = $('local');
  const fase = $('fase-cabecera');
  const modo = $('modo');
  const actual = pasoDe(d);
  const datos = d?.encargo;
  $('ir-mesa').toggleAttribute('aria-current', seccion === 'mesa');
  if (seccion === 'mesa') $('ir-mesa').setAttribute('aria-current', 'page');
  $('ir-encargos').toggleAttribute('aria-current', seccion === 'encargos');
  if (seccion === 'encargos') $('ir-encargos').setAttribute('aria-current', 'page');
  $('nuevo').disabled = Boolean(ocupado?.tipo === 'alta');
  modo.hidden = !procesos;
  modo.textContent = ctx.simulado ? 'Modo simulado' : 'Modo real';
  local.textContent = datos ? d.local?.nombre ?? datos.local : 'Society · Estudio creativo';
  reemplazar(principal, datos?.plato ?? ['El pase', h('span', {}, '.')]);
  fase.hidden = !datos;
  fase.textContent = datos ? `${nombreDe(actual)} · ${indiceDe(actual) + 1} de ${ESTACIONES.length}` : '';
  fase.dataset.estado = actual === 'entrega' ? 'listo' : '';
  $('pie-encargo').textContent = datos?.proyecto ?? 'Sin encargo';
  $('pie-inventario').textContent = datos ? `${localizar.format(inventario().length)} elementos` : '—';
  $('pie-intentos').textContent = datos ? localizar.format(d.intentos.length) : '—';
  $('pie-entrega').textContent = actual === 'entrega' ? 'Compuesta' : datos ? 'Pendiente' : '—';
  const entrada = datos?.historial?.at(-1);
  $('pie-actividad').textContent = entrada?.fecha ? formatearFecha(entrada.fecha) : '';
}

function pintarEncargos() {
  const entradas = lista.map((p) => {
    const resumen = procesos?.encargos.find((x) => x.proyecto === p.proyecto);
    const url = resumen?.imagenes.subida ?? (p.miniatura ? urlsDe(p.proyecto).subida(120) : null);
    const estado = estadoDePaso(p.paso, p).texto;
    return h('li', {}, h('button', { type: 'button', onclick: () => abrir(p.proyecto, { navegacion: true }) }, url ? h('img', { src: url, loading: 'lazy', alt: '' }) : h('span', { class: 'ref-vacia' }), h('span', {}, p.plato, h('br'), h('small', {}, p.nombreLocal ?? p.local)), h('span', { class: 'estado-encargo' }, estado)));
  });
  return [h('h2', { id: 'ficha-titulo' }, 'Encargos'), entradas.length ? h('ul', { class: 'encargos-lista' }, entradas) : h('p', { class: 'muted' }, 'Aún no hay encargos en este modo.'),
    h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'primario', onclick: nuevo }, 'Nuevo encargo'))];
}

function pintarFicha() {
  const ctx = contexto();
  const cuerpo = $('ficha-cuerpo');
  const focoElemento = cuerpo.contains(document.activeElement) && document.activeElement.closest('.lista-elementos');
  $('ficha-rotulo').textContent = seccion === 'encargos' ? 'Society Studio' : d ? 'Ficha de trabajo' : 'Nuevo encargo';
  $('ficha-avance').textContent = seccion === 'mesa' ? `${ordinal(indiceDe(seleccion))} / ${ordinal(ESTACIONES.length - 1)}` : '';
  if (cargando) reemplazar(cuerpo, h('h2', { id: 'ficha-titulo' }, 'Abriendo El pase…'));
  else if (errorInicial) reemplazar(cuerpo, h('h2', { id: 'ficha-titulo' }, 'No se ha podido abrir'), bloqueError(errorInicial), h('button', { type: 'button', onclick: iniciar }, 'Volver a conectar'));
  else if (seccion === 'encargos') reemplazar(cuerpo, pintarEncargos());
  else if (!d && seleccion === 'original') reemplazar(cuerpo, fichaDeSubida(ctx));
  else if (!d) reemplazar(cuerpo, h('h2', { id: 'ficha-titulo' }, nombreDe(seleccion)), h('p', { class: 'muted' }, 'Sube la foto original para iniciar el encargo.'), h('button', { type: 'button', class: 'primario', onclick: () => seleccionar('original', null, true) }, 'Añadir foto original'));
  else {
    const espera = d.espera;
    const seguir = ctx.actual === seleccion && espera.tipo === 'CONTINUAR' && !ctx.ocupada && !['candidata', 'composicion'].includes(seleccion);
    reemplazar(cuerpo, trabajoNodo, fichas[seleccion](ctx), seguir ? h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'primario', onclick: (e) => avanzar(e.currentTarget) }, 'Continuar el encargo')) : null);
    pintarTrabajo(d.trabajo);
  }
  if (focoElemento && elemento != null) cuerpo.querySelectorAll('.lista-elementos button')[elemento]?.focus({ preventScroll: true });
}

function pintarTrabajo(trabajo) {
  if (!trabajo || (trabajo.estado !== 'EN_CURSO' && trabajo.estado !== 'ERROR')) return reemplazar(trabajoNodo);
  const fallido = trabajo.estado === 'ERROR';
  const mensaje = (fallido ? trabajo.error?.message : trabajo.mensaje) ?? 'Procesando el encargo';
  const texto = trabajoNodo.querySelector('p');
  const progress = trabajoNodo.querySelector('progress');
  if (texto && progress && !fallido && mensaje === texto.textContent) {
    progress.value = trabajo.fraccion || 0;
    return;
  }
  reemplazar(trabajoNodo, h('div', { class: 'ficha-progress', 'data-error': fallido }, h('p', {}, mensaje), fallido ? null : h('progress', { value: Number(trabajo.fraccion || 0), max: 1, 'aria-label': 'Progreso del trabajo' }),
    trabajo.avisos?.length ? h('small', {}, trabajo.avisos.at(-1)) : null));
}

function pintarHerramientas() {
  contextoHerramientas = null;
  herramientas.hidden = true;
  reemplazar(herramientas);
}

function abrirHerramientas() {
  if (!d) return;
  const ctx = contexto();
  if (!contextoHerramientas || contextoHerramientas.d !== ctx.d || contextoHerramientas.seleccion !== ctx.seleccion || contextoHerramientas.hoja !== ctx.hoja) {
    const controles = controlesDeFase(ctx);
    if (!controles) return;
    contextoHerramientas = ctx;
    reemplazar(herramientas, controles);
  }
  herramientas.hidden = false;
  herramientas.tabIndex = -1;
  herramientas.focus({ preventScroll: true });
  herramientas.scrollIntoView({ behavior: reduccion.matches ? 'instant' : 'smooth', block: 'nearest' });
}

function pintarTodo() {
  pintarMarco();
  pintarMateriales();
  pintarNavegacion();
  pintarFicha();
  pintarHerramientas();
  motor?.seleccionar(seccion === 'mesa' ? seleccion : null, false);
}

function seleccionar(id, i = null, trasladarFoco = false) {
  if (ocupado?.tipo === 'alta') return;
  const cambio = seleccion !== id || seccion !== 'mesa';
  if (!cambio && i === elemento) {
    if (trasladarFoco) $('ficha').focus();
    return;
  }
  seleccion = id;
  elemento = i;
  seccion = 'mesa';
  if (cambio) pintarHerramientas();
  pintarMarco();
  pintarNavegacion();
  pintarFicha();
  motor?.seleccionar(id, true);
  if (trasladarFoco && (matchMedia('(max-width: 800px)').matches || id === 'original' && !d)) $('ficha').focus();
}

function elegirHoja(id) {
  hoja = id;
  vistaPrevia = undefined;
  pintarHerramientas();
  pintarMateriales();
  pintarFicha();
  if (seleccion === 'composicion') abrirHerramientas();
}

function navegacion(proyecto, reemplazo = false) {
  const url = new URL(location.href);
  if (proyecto) url.searchParams.set('proyecto', proyecto);
  else url.searchParams.delete('proyecto');
  if (url.href === location.href) return;
  history[reemplazo ? 'replaceState' : 'pushState']({}, '', url);
}

function nuevo() {
  if (ocupado?.tipo === 'alta') return;
  navegacion(null);
  abrir(null);
  $('ficha').focus({ preventScroll: true });
  if (matchMedia('(max-width: 800px)').matches) $('ficha').scrollIntoView({ block: 'nearest' });
}

function tareaActual() {
  const t = d?.trabajo;
  if (t?.estado === 'EN_CURSO') seguir(t);
}

async function abrir(id, opciones = {}) {
  const fecha = ++turno;
  proyecto = id || null;
  d = null;
  ocupado = null;
  cargando = Boolean(id);
  errorInicial = null;
  hoja = null;
  vistaPrevia = undefined;
  seleccion = 'original';
  seccion = 'mesa';
  elemento = null;
  if (opciones.navegacion) navegacion(id);
  pintarTodo();
  if (!id) return;
  try {
    const detalle = await api('GET', `/encargos/${encodeURIComponent(id)}`);
    if (fecha !== turno) return;
    d = detalle;
    seleccion = pasoDe(d);
  } catch (error) {
    if (fecha !== turno) return;
    errorInicial = error;
  }
  cargando = false;
  pintarTodo();
  tareaActual();
}

async function cargarIndice() {
  const [nuevoIndice, encargos] = await Promise.all([api('GET', '/procesos'), api('GET', '/encargos')]);
  procesos = nuevoIndice;
  lista = encargos.encargos;
}

async function iniciar() {
  cargando = true;
  errorInicial = null;
  pintarFicha();
  try {
    const [{ locales: disponibles }] = await Promise.all([api('GET', '/locales'), cargarIndice()]);
    locales = disponibles;
    const pedido = new URLSearchParams(location.search).get('proyecto');
    const actual = pedido ?? lista.find((p) => p.paso !== 'HECHO')?.proyecto ?? lista[0]?.proyecto;
    await abrir(actual);
  } catch (error) {
    cargando = false;
    errorInicial = error;
    pintarTodo();
  }
}

async function recargar(saltar = false, esperado = proyecto) {
  if (!esperado || esperado !== proyecto) return;
  const fecha = turno;
  const nuevo = await api('GET', `/encargos/${encodeURIComponent(esperado)}`);
  if (fecha !== turno) return;
  const antes = pasoDe(d);
  d = nuevo;
  const despues = pasoDe(d);
  if (saltar && antes !== despues && seccion === 'mesa') {
    seleccion = despues;
    elemento = null;
    hoja = null;
    vistaPrevia = undefined;
  }
  pintarTodo();
  tareaActual();
}

async function seguir(trabajo) {
  const fecha = turno;
  if (seguimiento?.id === trabajo.id && seguimiento.fecha === fecha) return;
  const marca = { id: trabajo.id, fecha };
  seguimiento = marca;
  const fuera = () => turno !== fecha || seguimiento !== marca;
  try {
    const final = await seguirTrabajo(trabajo.id, (nuevo) => {
      if (d && !fuera()) d.trabajo = nuevo;
      pintarTrabajo(nuevo);
    }, fuera);
    if (fuera()) return;
    if (final.estado === 'ERROR') avisar(final.error?.message ?? 'El trabajo ha fallado.', 'error');
    await cargarIndice().catch(() => {});
    if (!fuera()) await recargar(true);
  } catch (error) {
    if (!fuera()) avisar(error.message, 'error');
  } finally {
    if (seguimiento === marca) seguimiento = null;
  }
}

async function ejecutar(boton, tipo, fn, mostrarError) {
  if (ocupado) return;
  const marca = { tipo };
  const fecha = turno;
  ocupado = marca;
  const etiqueta = boton?.textContent;
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Un momento…';
  }
  try {
    return await fn(fecha);
  } catch (error) {
    if (fecha !== turno) return;
    if (mostrarError) mostrarError(error);
    else avisar(error.message, 'error');
    if (error.status === 409 && proyecto) {
      if (ocupado === marca) ocupado = null;
      await recargar().catch(() => {});
    }
    return undefined;
  } finally {
    if (ocupado === marca) ocupado = null;
    if (boton?.isConnected) {
      boton.disabled = false;
      boton.textContent = etiqueta;
    }
  }
}

async function lanzar(boton, metodo, ruta, cuerpo) {
  if (d?.trabajo?.estado === 'EN_CURSO') return;
  const fecha = turno;
  const accion = d?.revision && (metodo === 'PUT' || cuerpo?.confirmo || cuerpo?.rechazo) ? { ...cuerpo, revision: d.revision } : cuerpo;
  const respuesta = await ejecutar(boton, 'avance', () => api(metodo, ruta, accion));
  if (fecha !== turno || !respuesta) return;
  if (respuesta.trabajo) {
    d.trabajo = respuesta.trabajo;
    pintarFicha();
    tareaActual();
  }
  return respuesta;
}

function avanzar(boton, cuerpo = {}) {
  return lanzar(boton, 'POST', `/encargos/${encodeURIComponent(proyecto)}/avanzar`, cuerpo);
}

async function guardarPropuesta(boton, propuesta) {
  const fecha = turno;
  const cuerpo = { propuesta, ...(d.revision ? { revision: d.revision } : {}) };
  const respuesta = await ejecutar(boton, 'propuesta', () => api('PUT', `/encargos/${encodeURIComponent(proyecto)}/propuesta`, cuerpo));
  if (!respuesta || fecha !== turno) return;
  notificarCorreccion(respuesta);
  await recargar().catch((error) => avisar(error.message, 'error'));
}

async function usarReferencia(boton, preparar) {
  if (d?.trabajo?.estado === 'EN_CURSO') return;
  const id = proyecto;
  const fecha = turno;
  const respuesta = await ejecutar(boton, 'referencia', async () => {
    const datos = await preparar();
    if (fecha === turno) return api('PUT', `/encargos/${encodeURIComponent(id)}/referencia`, datos);
  });
  if (respuesta && fecha === turno) await avanzar(null);
}

async function enviarSubida(boton, preparar, errores) {
  const fecha = turno;
  const r = await ejecutar(boton, 'alta', async () => {
    const cuerpo = await preparar();
    if (fecha === turno) return api('POST', '/encargos', cuerpo);
  }, (error) => reemplazar(errores, bloqueError(error)));
  if (r?.encargo && fecha === turno) {
    cargarIndice().catch(() => {});
    await abrir(r.encargo.proyecto, { navegacion: true });
  }
}

async function crearLocalDeEjemplo(boton) {
  const fecha = turno;
  const datos = await ejecutar(boton, 'local', async () => {
    await api('POST', '/locales/ejemplo');
    return api('GET', '/locales');
  });
  if (datos && fecha === turno) {
    locales = datos.locales;
    pintarFicha();
  }
}

function confirmarInventario() {
  if (dialogo.open || !d || d.trabajo?.estado === 'EN_CURSO') return;
  const fecha = turno;
  const revision = d.revision;
  const gastos = h('div', { role: 'status' }, 'Consultando el presupuesto…');
  const confirmar = h('button', { type: 'button', class: 'primario', disabled: true, onclick: () => {
    dialogo.close();
    if (fecha === turno && revision === d?.revision) avanzar(null, { confirmo: 'CONFIRMAR_ELEMENTOS' });
  } }, 'Confirmar inventario');
  reemplazar(dialogo, h('h2', { id: 'dialogo-titulo' }, 'Antes de la foto candidata'), h('p', {}, 'Confirma el inventario, la nueva toma y el presupuesto.'), gastos,
    h('footer', {}, h('button', { type: 'button', onclick: () => dialogo.close() }, 'Volver a revisar'), confirmar));
  dialogo.showModal();
  cargarPresupuesto(proyecto, gastos).then((ok) => { confirmar.disabled = !ok; });
}

document.querySelector('.skip').addEventListener('click', (e) => {
  e.preventDefault();
  $('ficha').focus();
});
$('nuevo').addEventListener('click', nuevo);
$('ir-mesa').addEventListener('click', () => seleccionar(pasoDe(d)));
$('ir-encargos').addEventListener('click', () => {
  if (ocupado?.tipo === 'alta') return;
  seccion = 'encargos';
  pintarTodo();
  cargarIndice().then(() => { if (seccion === 'encargos') pintarFicha(); }).catch((error) => avisar(error.message, 'error'));
});
$('cambiar-vista').addEventListener('click', () => {
  propio = propio === '3d' ? '2d' : '3d';
  cambiarVista();
});
window.addEventListener('popstate', () => abrir(new URLSearchParams(location.search).get('proyecto')));
escena.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  const caja = escena.getBoundingClientRect();
  const id = escena.dataset.vista === '3d' ? motor?.tocar((e.clientX - caja.left) / caja.width, (e.clientY - caja.top) / caja.height) : e.target.closest('.plano-material')?.dataset.tipo;
  if (id) seleccionar(id);
});
new ResizeObserver(medir).observe(escena);
import('./mesa.js').then(({ crearMesa }) => {
  motor = crearMesa($('vista-3d'), () => {
    if (dibujada) anclar();
    else {
      dibujada = true;
      cambiarVista();
    }
  }, () => {
    motor = undefined;
    dibujada = false;
    cambiarVista();
  });
  medir();
  cambiarVista();
  motor.seleccionar(seleccion, false);
}).catch(() => cambiarVista());

iniciar();
