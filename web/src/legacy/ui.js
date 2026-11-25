// Ayudantes de interfaz: crear nodos sin innerHTML, avisos, modal y formatos.

/** h('button', {class: 'x', onclick}, 'Texto', otroNodo) */
export function h(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos ?? {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave.startsWith('on') && typeof valor === 'function') nodo.addEventListener(clave.slice(2), valor);
    else if (clave === 'class') nodo.className = valor;
    else if (clave === 'style' && typeof valor === 'object') Object.assign(nodo.style, valor);
    // value siempre como propiedad: en un <textarea> el atributo no rellena nada.
    else if (clave === 'value') nodo.value = String(valor);
    else if (clave in nodo && typeof valor !== 'string') nodo[clave] = valor;
    else nodo.setAttribute(clave, valor === true ? '' : String(valor));
  }
  anadir(nodo, hijos);
  return nodo;
}

function anadir(nodo, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

export function reemplazar(nodo, ...hijos) {
  nodo.replaceChildren();
  anadir(nodo, hijos);
}

/** Aviso flotante que desaparece solo. */
export function avisar(mensaje, tipo = 'info') {
  const aviso = h('div', { class: `aviso aviso-${tipo}` }, mensaje);
  // Chat: el contenedor de avisos se crea si la página no lo tiene.
  let contenedor = document.getElementById('avisos');
  if (!contenedor) {
    contenedor = Object.assign(document.createElement('div'), { id: 'avisos', className: 'legado-avisos' });
    document.body.append(contenedor);
  }
  contenedor.append(aviso);
  setTimeout(() => aviso.remove(), tipo === 'error' ? 9000 : 5000);
}

/** Bloque de error con sus detalles, para dejarlo dentro de un formulario o sección. */
export function bloqueError(error) {
  return h(
    'div',
    { class: 'error' },
    h('strong', {}, error.message ?? String(error)),
    error.detalles?.length ? h('ul', {}, error.detalles.map((detalle) => h('li', {}, detalle))) : null,
    error.retryable ? h('p', {}, 'Parece temporal: vuelve a intentarlo en un momento.') : null,
  );
}

/** Modal de confirmación. Resuelve true si se acepta. */
export function confirmar({ titulo, contenido, aceptar = 'Confirmar', cancelar = 'Cancelar', soloCancelar = false }) {
  return new Promise((resolver) => {
    const cerrar = (valor) => {
      fondo.remove();
      resolver(valor);
    };
    const fondo = h(
      'div',
      { class: 'modal-fondo', onclick: (evento) => evento.target === fondo && cerrar(false) },
      h(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('h2', {}, titulo),
        contenido,
        h(
          'div',
          { class: 'acciones' },
          h('button', { class: 'secundario', onclick: () => cerrar(false) }, cancelar),
          soloCancelar ? null : h('button', { onclick: () => cerrar(true) }, aceptar),
        ),
      ),
    );
    document.body.append(fondo);
    fondo.querySelector('button:last-child')?.focus();
  });
}

/** «unos 8 s» · «unos 85 s» · «unos 3 min» */
export function formatearTiempo(segundos) {
  if (segundos < 15) return `unos ${Math.max(1, Math.round(segundos))} s`;
  if (segundos < 90) return `unos ${Math.round(segundos / 5) * 5} s`;
  return `unos ${Math.round(segundos / 60)} min`;
}

export function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

/** Ejecuta una acción de botón mostrando que está ocupado y los errores como aviso. */
export async function conBoton(boton, accion) {
  const texto = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Un momento…';
  try {
    return await accion();
  } catch (error) {
    avisar(error.message ?? String(error), 'error');
    return undefined;
  } finally {
    boton.disabled = false;
    boton.textContent = texto;
  }
}

const NOMBRES = {
  PLATO_ESTRELLA: 'Plato estrella',
  NOVEDAD: 'Novedad',
  OFERTA: 'Oferta',
  EVENTO: 'Evento',
  POST: 'Post',
  CARRUSEL: 'Carrusel',
  HISTORIA: 'Historia',
  PLATO: 'Plato',
  LOCAL: 'Local',
  VAJILLA: 'Vajilla',
  PERSONAS: 'Personas',
  OTRO: 'Otro',
};

export function nombre(valor) {
  return NOMBRES[valor] ?? valor;
}
