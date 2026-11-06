// Piezas de interfaz reutilizables: panel de progreso, confirmación de gasto y campos extra.
import { confirmar, formatearTiempo, h } from './ui.js';

/** Panel de un trabajo largo: fase, barra, «quedan unos X s», imágenes listas y avisos. */
export function panelDeTrabajo(trabajo) {
  const enCurso = trabajo.estado === 'EN_CURSO';
  const restante = !enCurso
    ? trabajo.estado === 'ERROR'
      ? 'Ha fallado'
      : 'Terminado'
    : trabajo.casiListo
      ? 'Casi listo…'
      : `Quedan ${formatearTiempo(trabajo.quedanSegundos)}`;

  return h(
    'section',
    { class: `trabajo trabajo-${trabajo.estado.toLowerCase()}` },
    h('div', { class: 'trabajo-cabecera' }, h('strong', {}, trabajo.mensaje), h('span', { class: 'trabajo-restante' }, restante)),
    h(
      'div',
      { class: 'barra', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(trabajo.fraccion * 100)) },
      h('div', { class: `barra-relleno${enCurso ? ' animada' : ''}`, style: { width: `${Math.round(trabajo.fraccion * 100)}%` } }),
    ),
    trabajo.total > 0 ? h('p', { class: 'trabajo-detalle' }, `${trabajo.hechas} de ${trabajo.total} imagen(es) listas`) : null,
    trabajo.avisos.length ? h('ul', { class: 'trabajo-avisos' }, trabajo.avisos.map((aviso) => h('li', {}, aviso))) : null,
    trabajo.error?.detalles?.length ? h('ul', { class: 'error' }, trabajo.error.detalles.map((d) => h('li', {}, d))) : null,
  );
}

/** Modal con lo que va a costar. Devuelve true si el usuario confirma. */
export function confirmarGasto(presupuesto, { accion = 'generar' } = {}) {
  const { imagenes, retomar, modelo, usadasHoy, limite, superaLimite } = presupuesto;
  const contenido = h(
    'div',
    { class: 'gasto' },
    imagenes > 0
      ? h('p', {}, `Se va${imagenes === 1 ? '' : 'n'} a ${accion === 'corregir' ? 'generar una versión nueva' : `generar ${imagenes} imagen(es)`} con `, h('strong', {}, modelo), '.')
      : null,
    retomar > 0 ? h('p', {}, `Se retoma${retomar === 1 ? '' : 'n'} ${retomar} imagen(es) que ya estaban enviadas (sin volver a pagar).`) : null,
    h('p', {}, `Hoy llevas ${usadasHoy} de ${limite} imágenes por la API.`),
    h('p', { class: 'nota' }, 'Higgsfield no publica el precio por imagen de este modelo: revisa tu saldo en su consola.'),
    superaLimite ? h('p', { class: 'error' }, 'Esto supera el límite diario (LIMITE_IMAGENES_DIA). No se puede generar hoy.') : null,
  );
  return confirmar({
    titulo: accion === 'corregir' ? 'Antes de pedir el cambio' : 'Antes de generar',
    contenido,
    aceptar: 'Generar',
    soloCancelar: superaLimite,
  });
}

/**
 * Muestra los campos de un objeto que no se pintan ya en otro sitio.
 * Así, si el sistema creativo añade campos nuevos (p. ej. «tratamiento» o «paleta»), aparecen sin tocar la interfaz.
 */
export function camposExtra(objeto, conocidos) {
  const extras = Object.entries(objeto ?? {}).filter(([clave, valor]) => {
    if (conocidos.includes(clave) || valor === undefined || valor === null || valor === '') return false;
    if (Array.isArray(valor)) return valor.length > 0;
    return typeof valor !== 'object';
  });
  if (extras.length === 0) return null;
  return h(
    'dl',
    { class: 'extras' },
    extras.map(([clave, valor]) => [h('dt', {}, etiquetaDeCampo(clave)), h('dd', {}, valorDeCampo(valor))]),
  );
}

/** Nombres bonitos de los campos que ya conocemos; el resto se deduce de la clave. */
const ETIQUETAS = { transicion: 'Transición', hiloVisual: 'Hilo visual', porQue: 'Por qué', textoAlt: 'Texto alternativo', fotografia: 'Fotografía', tipografia: 'Tipografía' };

function etiquetaDeCampo(clave) {
  if (ETIQUETAS[clave]) return ETIQUETAS[clave];
  const conEspacios = clave.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

function valorDeCampo(valor) {
  if (!Array.isArray(valor)) return String(valor);
  return valor.map((elemento) => {
    const texto = typeof elemento === 'object' ? JSON.stringify(elemento) : String(elemento);
    return /^#[0-9a-f]{6}$/i.test(texto) ? muestraDeColor(texto) : h('span', { class: 'etiqueta' }, texto);
  });
}

export function muestraDeColor(hex) {
  return h('span', { class: 'color' }, h('span', { class: 'color-muestra', style: { background: hex } }), hex);
}
