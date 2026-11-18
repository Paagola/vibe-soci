import { api, seguirTrabajo } from '../api.js';
import { avisar, bloqueError, formatearFecha, h, reemplazar } from '../ui.js';
import { estadoDePaso, urlsDe } from '../orden.js';
import { cargarPresupuesto, controlesDeFase, fichaDeSubida, fichas, hojaDe, notificarCorreccion, pideRevision, portadaDe } from './fichas.js';
import { dibujarFotos, ESTACIONES, soporteDe } from './plano.js';
import { ENCUADRES } from './renders.js';
import { fichaManual, fichaTaller, referenciasEditoriales } from './taller.js';
import { actividadDe, intervencionesDe } from './actividad.js';

const $ = (id) => document.getElementById(id);
const escena = $('escena');
const fotogramas = $('fotogramas');
const respaldo = $('vista-2d');
const recorrido = $('recorrido');
const herramientas = $('herramientas');
const dialogo = $('dialogo');
const trabajoNodo = h('div');
const panelActividad = $('actividad');
const ETAPAS = { REFERENCIA: 'referencia', ELEMENTOS: 'elementos', FOTO: 'candidata', DISENO: 'composicion', RESULTADO: 'entrega' };
const pasoDe = (d) => d?.encargo.taller && d.encargo.paso === 'CONFIRMAR_FOTO' ? 'composicion' : ETAPAS[d?.fase] ?? 'original';
const etapasDeTaller = {
  elementos: { nombre: 'Dirección', accion: 'Dirección de arte', texto: 'Revisa el encuadre, la luz y la lectura elegida para el encargo.' },
  candidata: { nombre: 'Producción', accion: 'Producción de la imagen', texto: 'Lleva la dirección aprobada al generador o importa la imagen.' },
  composicion: { nombre: 'Revisión', accion: 'Revisión de la imagen', texto: 'Lee la imagen a escala móvil y contrasta el producto con la foto fuente.' },
};
const etapaDe = fase => d?.encargo.taller ? { ...fase, ...etapasDeTaller[fase.id] } : fase;
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
let intentoFoto = null;
let hoja = null;
let vistaPrevia;
let seguimiento;
let turno = 0;
let ocupado;
let cargando = true;
let errorInicial;
let motor;
let dibujada = false;
let puntos3d;
let iniciandoMotor = false;
let falloMotor = false;
let propio = new URLSearchParams(location.search).get('vista') === '2d' ? '2d' : '3d';
let materiales = {};
let revisionMaterial = '';
let contextoHerramientas;
let trabajoSinSeguimiento;
let actividad;
let huellaActividad;

function inventario() {
  return d?.propuesta?.valida ? d.propuesta.contenido.descripcion.elementos : [];
}

function contexto() {
  return {
    d, proyecto, seleccion, elemento, candidata: candidataVisible(), elegirCandidata,
    hoja: hoja ?? (pideRevision(d) ? d.revisionEditorial.incidencias[0]?.id : null), vistaPrevia, locales, simulado: procesos?.modo === 'SIMULADO',
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

function faseVista() { return etapaDe(ESTACIONES[indiceDe(seleccion)] ?? ESTACIONES[0]); }

function pintarOptica() {
  const fase = faseVista();
  if (escena.dataset.vista === '2d') {
    if (respaldo.dataset.fase !== fase.id) {
      respaldo.dataset.fase = fase.id;
      respaldo.style.backgroundImage = `url("/img/optica/${fase.id}.webp")`;
    }
  }
  const esquinas = escena.dataset.vista === '3d' ? puntos3d : ENCUADRES[fase.id];
  dibujarFotos(fotogramas, esquinas, fase.id, soporteDe(fase.id, materiales));
}

function medir() {
  motor?.medir(escena.clientWidth, escena.clientHeight);
  pintarOptica();
}

function cambiarVista() {
  const activa = propio === '3d' && Boolean(motor && dibujada);
  escena.dataset.vista = activa ? '3d' : '2d';
  const control = $('cambiar-vista');
  control.hidden = falloMotor || !(motor || propio === '2d');
  control.querySelector('span').textContent = activa ? 'Vista 2D' : 'Vista 3D';
  control.setAttribute('aria-label', activa ? 'Cambiar a vista 2D' : 'Cambiar a vista 3D');
  motor?.mostrar(propio === '3d');
  pintarOptica();
}

async function iniciarMotor() {
  if (motor || iniciandoMotor || falloMotor) return;
  iniciandoMotor = true;
  try {
    const { crearInstrumento } = await import('./instrumento.js');
    motor = crearInstrumento($('vista-3d'), (esquinas) => {
      puntos3d = esquinas;
      if (!dibujada) { dibujada = true; cambiarVista(); }
      else pintarOptica();
    }, () => { falloMotor = true; motor = null; propio = '2d'; cambiarVista(); });
    motor.seleccionar(seleccion, false);
    motor.activar(actividad?.figura);
    medir();
  } catch { falloMotor = true; propio = '2d'; cambiarVista(); }
  finally { iniciandoMotor = false; }
}

function materialesDe() {
  if (!d) return {};
  const ctx = contexto();
  const foto = ctx.candidata;
  const version = hojaDe(ctx)?.version;
  const portada = portadaDe(version);
  const integrada = d.encargo.taller?.candidatas.at(-1);
  const cartel = integrada ? '/api/encargos/' + proyecto + '/taller/candidatas/' + integrada.version : null;
  const render = cartel ?? (portada ? ctx.urls.diseno(portada, { lado: 680, sello: version.compuestaEn }) : null);
  return {
    original: { url: d.fotoSubida.disponible ? ctx.urls.subida(880) : null, original: ctx.urls.subida() },
    referencia: { url: d.referencia.conImagen ? ctx.urls.referencia(480) : null, original: ctx.urls.referencia() },
    elementos: { lineas: inventario().map((el) => el.nombre) },
    candidata: { url: foto?.disponible ? ctx.urls.activo(foto.activo, 680) : null, original: foto?.disponible ? ctx.urls.activo(foto.activo) : null },
    composicion: { url: vistaPrevia ?? render ?? originalElegida(ctx), original: vistaPrevia ?? (portada ? ctx.urls.diseno(portada) : originalElegida(ctx)), lineas: d.editorial?.plan?.diapositivas?.map((x) => x.papel) ?? (d.diseno.intencion ? Object.values(d.diseno.intencion.contenido?.textos ?? {}).filter((x) => typeof x === 'string') : []) },
    entrega: { url: d.encargo.paso === 'HECHO' ? render : null, original: cartel ?? (portada ? ctx.urls.diseno(portada) : null) },
  };
}

function originalElegida(ctx) {
  const e = ctx.d.encargo;
  return e.fotoElegida && e.fotoElegida === e.activoReal ? ctx.urls.subida() : null;
}

function candidataVisible() {
  return d?.intentos.find(i => i.disponible && i.n === intentoFoto) ??
    d?.intentos.find(i => i.disponible && i.elegida) ??
    d?.intentos.findLast(i => i.disponible);
}

function elegirCandidata(n) {
  if (!d?.intentos.some(i => i.n === n && i.disponible)) return;
  intentoFoto = n;
  pintarMateriales();
  pintarFicha();
  $('ficha').querySelector(`[data-intento="${n}"]`)?.focus({ preventScroll: true });
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
  const foco = recorrido.contains(document.activeElement) ? document.activeElement.dataset.paso : null;
  reemplazar(recorrido, ESTACIONES.map((estacion, i) => {
    const fase = etapaDe(estacion);
    const completada = Boolean(d && (i < indiceDe(actual) || d.encargo.paso === 'HECHO'));
    return h('button', {
      type: 'button', 'data-paso': fase.id, 'data-estado': completada ? 'hecha' : '',
      'aria-label': fase.nombre, 'aria-pressed': String(seccion === 'mesa' && fase.id === seleccion),
      'aria-current': d && fase.id === actual ? 'step' : undefined, 'aria-controls': 'ficha',
      onclick: () => seleccionar(fase.id),
    }, h('small', { 'aria-hidden': 'true' }, ordinal(i)), h('span', {}, fase.nombre), h('i', { 'aria-hidden': 'true' }, completada ? '✓' : ''));
  }));
  if (foco) recorrido.querySelector(`[data-paso="${foco}"]`)?.focus({ preventScroll: true });
}

function pintarMarco() {
  const ctx = contexto();
  const modo = $('modo');
  const actual = pasoDe(d);
  const datos = d?.encargo;
  const fase = faseVista();
  const n = indiceDe(fase.id);
  $('ir-mesa').toggleAttribute('aria-current', seccion === 'mesa');
  if (seccion === 'mesa') $('ir-mesa').setAttribute('aria-current', 'page');
  $('ir-encargos').toggleAttribute('aria-current', seccion === 'encargos');
  if (seccion === 'encargos') $('ir-encargos').setAttribute('aria-current', 'page');
  $('nuevo').disabled = Boolean(ocupado?.tipo === 'alta');
  modo.hidden = !procesos;
  modo.textContent = ctx.simulado ? 'Modo simulado' : 'Modo real';
  $('fase-cabecera').textContent = seccion === 'encargos' ? 'Archivo de encargos' : fase.accion;
  $('local').textContent = seccion === 'encargos' ? 'Abre un encargo para retomar su producción.' : !datos && n === 0 ? 'Una foto original es el punto de partida de cada pieza.' : fase.texto;
  const abrirFicha = $('abrir-ficha');
  const accionTaller = datos?.taller && ['elementos', 'candidata', 'composicion'].includes(seleccion) ? 'Abrir ' + fase.nombre.toLowerCase() : null;
  const accion = accionTaller ?? (seccion === 'encargos' ? 'Ver encargos' : !datos ? n === 0 ? 'Preparar encargo' : 'Ver ficha' : ['Ver original', 'Ver referencia', 'Revisar inventario', 'Comparar fotos', 'Ver composición', datos.paso === 'HECHO' ? 'Ver descargas' : 'Ver entrega'][n]);
  abrirFicha.firstChild.textContent = accion + ' ';
  $('encargo-titulo').textContent = datos?.plato ?? 'Nuevo encargo';
  $('encargo-local').textContent = datos ? d.local?.nombre ?? datos.local : 'Sin abrir';
  document.querySelector('.expediente').dataset.vacio = String(!datos);
  $('pie-inventario').previousElementSibling.textContent = datos?.taller ? 'Textos' : 'Inventario';
  $('pie-intentos').previousElementSibling.textContent = datos?.taller ? 'Versiones' : 'Intentos';
  $('pie-inventario').textContent = datos?.taller ? String(datos.taller.comanda?.textos.length ?? 0) : datos ? `${localizar.format(inventario().length)} ${inventario().length === 1 ? 'elemento' : 'elementos'}` : '—';
  $('pie-intentos').textContent = datos ? localizar.format(datos.taller?.candidatas.length ?? d.intentos.length) : '—';
  $('pie-entrega').textContent = actual === 'entrega' ? 'Compuesta' : pideRevision(d) ? 'En revisión' : datos ? 'Pendiente' : '—';
  const entrada = datos?.historial?.at(-1);
  $('pie-actividad').textContent = entrada?.fecha ? `Actualizado el ${formatearFecha(entrada.fecha)}` : '';
  const leyenda = $('leyenda');
  leyenda.querySelector('span').textContent = 'Fig. ' + ordinal(n);
  leyenda.querySelector('b').textContent = ['Óptica de captación','Portarreferencia','Registro de la toma','Comparador óptico','Guía de encuadre','Salida de la pieza'][n];
  escena.setAttribute('aria-label', `Instrumento óptico · ${leyenda.textContent}. ${fase.texto}`);
  pintarOptica();
}
function pintarEncargos() {
  const entradas = lista.map((p) => {
    const resumen = procesos?.encargos.find((x) => x.proyecto === p.proyecto);
    const url = p.portada?.tipo === 'TALLER' ? p.miniatura : resumen?.imagenes.subida ?? (p.miniatura ? urlsDe(p.proyecto).subida(120) : null);
    const estado = estadoDePaso(p.paso, p).texto;
    return h('li', {}, h('button', { type: 'button', onclick: () => abrir(p.proyecto, { navegacion: true }) }, url ? h('img', { src: url, loading: 'lazy', alt: '' }) : h('span', { class: 'ref-vacia' }), h('span', {}, p.plato, h('br'), h('small', {}, p.nombreLocal ?? p.local)), h('span', { class: 'estado-encargo' }, estado)));
  });
  return [h('h2', { id: 'ficha-titulo' }, 'Encargos'), entradas.length ? h('ul', { class: 'encargos-lista' }, entradas) : h('p', { class: 'muted' }, 'Aún no hay encargos en este modo.'),
    h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'primario', onclick: nuevo }, 'Nuevo encargo'))];
}

function pintarFicha() {
  pintarActividad();
  const ctx = contexto();
  const cuerpo = $('ficha-cuerpo');
  const focoElemento = cuerpo.contains(document.activeElement) && document.activeElement.closest('.lista-elementos');
  $('ficha-rotulo').textContent = seccion === 'encargos' ? 'Archivo' : d ? 'Ficha de trabajo' : 'Preparación';
  $('ficha-avance').textContent = seccion === 'mesa' ? `${ordinal(indiceDe(seleccion))} / ${ordinal(ESTACIONES.length - 1)}` : '';
  if (cargando) reemplazar(cuerpo, h('h2', { id: 'ficha-titulo' }, 'Abriendo el estudio…'));
  else if (errorInicial) reemplazar(cuerpo, h('h2', { id: 'ficha-titulo' }, 'No se ha podido abrir'), bloqueError(errorInicial), h('button', { type: 'button', onclick: iniciar }, 'Volver a conectar'));
  else if (seccion === 'encargos') reemplazar(cuerpo, pintarEncargos());
  else if (!d && seleccion === 'original') reemplazar(cuerpo, fichaDeSubida(ctx));
  else if (!d) reemplazar(cuerpo, h('h2', { id: 'ficha-titulo' }, nombreDe(seleccion)), h('p', { class: 'muted' }, 'Sube la foto original para iniciar el encargo.'), h('button', { type: 'button', class: 'primario', onclick: () => seleccionar('original', null, true) }, 'Añadir foto original'));
  else if (d.encargo.taller && seleccion !== 'original') {
    reemplazar(cuerpo, trabajoNodo, seleccion === 'referencia' ? [d.encargo.taller.comanda?.editorial && !d.encargo.referencia ? [h('h2', { id: 'ficha-titulo' }, 'Referencias de la dirección'), referenciasEditoriales(d.encargo.taller.comanda.editorial)] : fichas.referencia(ctx), fichaManual(ctx), d.encargo.paso !== 'REFERENCIA' ? h('button', { type: 'button', onclick: ctx.irActual }, 'Volver al encargo') : null] : ctx.actual !== seleccion ? [h('h2', { id: 'ficha-titulo' }, etapaDe(ESTACIONES[indiceDe(seleccion)]).nombre), h('button', { type: 'button', onclick: ctx.irActual }, 'Ir a la fase actual')] : fichaTaller(ctx));
    pintarTrabajo(d.trabajo);
  } else {
    const espera = d.espera;
    const seguir = ctx.actual === seleccion && espera.tipo === 'CONTINUAR' && !ctx.ocupada && !['candidata', 'composicion'].includes(seleccion);
    reemplazar(cuerpo, trabajoNodo, fichas[seleccion](ctx), seguir ? h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'primario', onclick: (e) => avanzar(e.currentTarget) }, 'Continuar el encargo')) : null);
    pintarTrabajo(d.trabajo);
  }
  if (focoElemento && elemento != null) cuerpo.querySelectorAll('.lista-elementos button')[elemento]?.focus({ preventScroll: true });
}

function pintarActividad() {
  const trabajo = d?.trabajo;
  actividad = trabajo?.id && trabajo.id === trabajoSinSeguimiento ? null : actividadDe(trabajo, ocupado?.tipo);
  const huella = JSON.stringify(actividad);
  if (huella === huellaActividad) return;
  huellaActividad = huella;
  panelActividad.hidden = !actividad;
  motor?.activar(actividad?.figura);
  if (!actividad) return;
  panelActividad.dataset.oficio = actividad.figura;
  $('actividad-oficio').textContent = actividad.nombre;
  $('actividad-tarea').textContent = actividad.tarea;
  $('actividad-modelo').hidden = !actividad.modelo;
  $('actividad-modelo').textContent = actividad.modelo ?? '';
}

function pintarTrabajo(trabajo) {
  if (!trabajo) return reemplazar(trabajoNodo);
  const relevos = intervencionesDe(trabajo);
  if (trabajo.estado === 'TERMINADO') {
    return reemplazar(trabajoNodo, relevos.length ? h('details', { class: 'turnos-de-trabajo' },
      h('summary', {}, 'Intervenciones de este avance'),
      h('ol', {}, relevos.map(texto => h('li', {}, texto)))) : null);
  }
  const sinSeguimiento = trabajo.id === trabajoSinSeguimiento;
  const fallido = trabajo.estado === 'ERROR' || sinSeguimiento;
  const oficio = fallido ? null : actividadDe(trabajo);
  const mensaje = sinSeguimiento ? 'Se ha interrumpido el seguimiento. Recarga la página para recuperar el estado.' :
    (oficio?.tarea ?? trabajo.error?.message ?? trabajo.mensaje ?? 'Procesando el encargo');
  const aviso = trabajo.avisos?.at(-1);
  const div = trabajoNodo.firstElementChild;
  if (div?.dataset.error === String(fallido) && div.querySelector('p')?.textContent === mensaje &&
      div.querySelector('strong')?.textContent === oficio?.nombre && div.querySelector('small')?.textContent === aviso) return;
  reemplazar(trabajoNodo, h('div', { class: 'ficha-progress', 'data-error': fallido },
    oficio ? h('strong', {}, oficio.nombre) : null,
    h('p', {}, mensaje),
    fallido ? null : h('div', { class: 'ficha-progress-controles' },
      h('progress', { 'aria-label': 'Trabajo en curso' }),
      h('button', { type: 'button', onclick: mostrarActividad }, 'Ver actividad')),
    aviso ? h('small', {}, aviso) : null));
}

function mostrarActividad() {
  if (panelActividad.hidden) return;
  panelActividad.focus({ preventScroll: true });
  panelActividad.scrollIntoView({ behavior: reduccion.matches ? 'instant' : 'smooth', block: 'center' });
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
  motor?.seleccionar(seleccion);
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
  $('ficha').scrollIntoView({ block: 'start' });
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
  intentoFoto = null;
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
  if (nuevo.intentos.length !== d?.intentos.length) intentoFoto = null;
  const requiereCorreccion = pideRevision(nuevo);
  d = nuevo;
  const despues = pasoDe(d);
  if (saltar && (antes !== despues || requiereCorreccion) && seccion === 'mesa') {
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
  trabajoSinSeguimiento = undefined;
  const fuera = () => turno !== fecha || seguimiento !== marca;
  let pidiendoCandidata = false;
  try {
    const final = await seguirTrabajo(trabajo.id, (nuevo) => {
      if (!d || fuera()) return;
      d.trabajo = nuevo;
      pintarActividad();
      pintarTrabajo(nuevo);
      if (nuevo.estado === 'EN_CURSO' && nuevo.paso === 'COMPROBAR' && !pidiendoCandidata) {
        pidiendoCandidata = true;
        api('GET', `/encargos/${encodeURIComponent(proyecto)}`).then(detalle => {
          if (fuera() || d?.trabajo?.estado !== 'EN_CURSO' || d.trabajo.paso !== 'COMPROBAR' ||
              detalle.intentos.length <= d.intentos.length) return;
          if (seccion === 'mesa' && seleccion === pasoDe(d)) seleccion = 'candidata';
          intentoFoto = null;
          d = { ...detalle, trabajo: d.trabajo };
          pintarTodo();
        }).catch(() => { pidiendoCandidata = false; });
      }
    }, fuera);
    if (fuera()) return;
    if (final.estado === 'ERROR') avisar(final.error?.message ?? 'El trabajo ha fallado.', 'error');
    await cargarIndice().catch(() => {});
    if (!fuera()) await recargar(true);
  } catch (error) {
    if (!fuera()) {
      trabajoSinSeguimiento = trabajo.id;
      pintarActividad();
      pintarTrabajo(d?.trabajo);
      avisar(error.message, 'error');
    }
  } finally {
    if (seguimiento === marca) seguimiento = null;
  }
}

async function ejecutar(boton, tipo, fn, mostrarError) {
  if (ocupado) return;
  const marca = { tipo };
  const fecha = turno;
  ocupado = marca;
  pintarActividad();
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
    pintarActividad();
    if (boton?.isConnected) {
      boton.disabled = false;
      boton.textContent = etiqueta;
    }
  }
}

async function lanzar(boton, metodo, ruta, cuerpo) {
  if (d?.trabajo?.estado === 'EN_CURSO') return;
  const fecha = turno;
  const accion = d?.revision && (metodo === 'PUT' || cuerpo?.confirmo || cuerpo?.rechazo || cuerpo?.volverAlInventario) ? { ...cuerpo, revision: d.revision } : cuerpo;
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
  enfocarFicha();
  cargarIndice().then(() => { if (seccion === 'encargos') pintarFicha(); }).catch((error) => avisar(error.message, 'error'));
});
function enfocarFicha() {
  $('ficha').focus({ preventScroll: true });
  $('ficha').scrollIntoView({ behavior: reduccion.matches ? 'instant' : 'smooth', block: 'start' });
}
$('abrir-ficha').addEventListener('click', enfocarFicha);
$('cambiar-vista').addEventListener('click', () => {
  propio = propio === '3d' ? '2d' : '3d';
  if (propio === '3d' && !motor) iniciarMotor();
  cambiarVista();
});
recorrido.addEventListener('keydown', (e) => {
  const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!delta && e.key !== 'Home' && e.key !== 'End') return;
  const i = indiceDe(e.target.dataset.paso);
  if (i < 0) return;
  e.preventDefault();
  const proximo = e.key === 'End' ? ESTACIONES.length - 1 : e.key === 'Home' ? 0 : (i + delta + ESTACIONES.length) % ESTACIONES.length;
  seleccionar(ESTACIONES[proximo].id);
  recorrido.children[proximo].focus({ preventScroll: true });
});
for (const img of fotogramas.querySelectorAll('img')) img.addEventListener('error', () => { img.hidden = true; });
window.addEventListener('popstate', () => abrir(new URLSearchParams(location.search).get('proyecto')));
new ResizeObserver(medir).observe(escena);
cambiarVista();
if (propio === '3d') iniciarMotor();
iniciar();
