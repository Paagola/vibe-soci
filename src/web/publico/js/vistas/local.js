// Alta de un local: identidad de marca con colores HEX (con su muestra) y tipografías.
import { api } from '../api.js';
import { bloqueError, h, reemplazar } from '../ui.js';

const MAX_COLORES = 6;

export async function vistaNuevoLocal() {
  const errores = h('div');
  const colores = h('div', { class: 'colores' });
  const campo = (etiqueta, control, ayuda) => h('label', { class: 'campo' }, h('span', {}, etiqueta), control, ayuda ? h('small', {}, ayuda) : null);

  const nombre = h('input', { required: true, maxlength: '80', placeholder: 'Bar El Boquerón Dorado' });
  const slug = h('input', { required: true, pattern: '[a-z0-9]+(-[a-z0-9]+)*', placeholder: 'el-boqueron-dorado' });
  let slugTocado = false;
  slug.addEventListener('input', () => (slugTocado = true));
  nombre.addEventListener('input', () => {
    if (!slugTocado) slug.value = slugificar(nombre.value);
  });

  const ciudad = h('input', { required: true, maxlength: '80', placeholder: 'Málaga' });
  const descripcion = h('textarea', { maxlength: '300', rows: '2', placeholder: 'Qué es y qué lo hace único' });
  const tonos = h('input', { required: true, placeholder: 'canalla, cercano, marinero' });
  const instagram = h('input', { maxlength: '60', placeholder: '@elboquerondorado' });
  const web = h('input', { maxlength: '80', placeholder: 'elboquerondorado.es' });
  const titulos = h('input', { maxlength: '120', placeholder: 'grotesca condensada muy pesada' });
  const textos = h('input', { maxlength: '120', placeholder: 'monoespaciada pequeña en mayúsculas' });
  const rotulo = h('input', { maxlength: '120', placeholder: 'rótulo pintado a mano del local' });
  const sobrescribir = h('input', { type: 'checkbox' });

  const anadirColor = (nombreColor = '', hex = '#C8102E') => {
    if (colores.children.length >= MAX_COLORES) return;
    const texto = h('input', { class: 'hex', value: hex, pattern: '#[0-9A-Fa-f]{6}', maxlength: '7' });
    const selector = h('input', { type: 'color', value: hex });
    selector.addEventListener('input', () => (texto.value = selector.value.toUpperCase()));
    texto.addEventListener('input', () => /^#[0-9a-f]{6}$/i.test(texto.value) && (selector.value = texto.value));
    const fila = h(
      'div',
      { class: 'fila-color' },
      selector,
      texto,
      h('input', { class: 'nombre-color', value: nombreColor, placeholder: 'Nombre (p. ej. Magenta)', maxlength: '30' }),
      h('button', { type: 'button', class: 'secundario', onclick: () => fila.remove() }, 'Quitar'),
    );
    colores.append(fila);
  };
  anadirColor('Principal');

  const enviar = async (evento) => {
    evento.preventDefault();
    const boton = evento.submitter;
    boton.disabled = true;
    reemplazar(errores);
    try {
      const marca = {
        slug: slug.value.trim(),
        nombre: nombre.value.trim(),
        ciudad: ciudad.value.trim(),
        descripcion: descripcion.value.trim(),
        tonos: tonos.value.split(',').map((t) => t.trim()).filter(Boolean),
        instagram: instagram.value.trim() || undefined,
        web: web.value.trim() || undefined,
        colores: [...colores.children].map((fila) => ({
          hex: fila.querySelector('.hex').value.trim().toUpperCase(),
          nombre: fila.querySelector('.nombre-color').value.trim() || fila.querySelector('.hex').value.trim(),
        })),
        tipografias: [
          ['TITULOS', titulos],
          ['TEXTOS', textos],
          ['ROTULO', rotulo],
        ]
          .filter(([, control]) => control.value.trim())
          .map(([rol, control]) => ({ rol, descripcion: control.value.trim() })),
      };
      await api('POST', '/locales', { marca, sobrescribir: sobrescribir.checked });
      location.hash = '#/nueva';
    } catch (error) {
      reemplazar(errores, bloqueError(error));
    } finally {
      boton.disabled = false;
    }
  };

  const nodo = h(
    'form',
    { class: 'formulario', onsubmit: enviar },
    h('h1', {}, 'Nuevo local'),
    h('p', { class: 'nota' }, 'Cuanto más concreta sea la marca, menos genérico será el resultado. Nada de colores genéricos: usa los del local.'),
    campo('Nombre del local', nombre),
    campo('Identificador corto', slug, 'Solo minúsculas, números y guiones.'),
    campo('Ciudad o zona', ciudad),
    campo('Descripción breve', descripcion),
    campo('Tono (de 1 a 5 palabras, separadas por comas)', tonos),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Contacto (opcional)'),
      campo('Instagram', instagram, 'Solo se usa en el cierre del carrusel si lo escribes aquí: la IA no inventa contactos.'),
      campo('Web', web),
    ),
    h('fieldset', {}, h('legend', {}, 'Colores de la marca (máx. 6)'), colores, h('button', { type: 'button', class: 'secundario', onclick: () => anadirColor() }, 'Añadir color')),
    h('fieldset', {}, h('legend', {}, 'Tipografías (opcionales)'), campo('Títulos', titulos), campo('Textos', textos), campo('Rótulo', rotulo)),
    h('label', { class: 'casilla' }, sobrescribir, ' Reemplazar si ya existe un local con ese identificador'),
    errores,
    h('div', { class: 'acciones' }, h('button', { type: 'submit' }, 'Guardar local')),
  );
  return { nodo };
}

function slugificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
