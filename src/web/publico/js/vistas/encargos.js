// Posts: los encargos de la orden única, del más reciente al más antiguo, con lo que le toca a la persona en cada uno.
import { api } from '../api.js';
import { estadoDePaso, fasesMini } from '../orden.js';
import { conBoton, formatearFecha, h } from '../ui.js';

export async function vistaEncargos() {
  const [{ encargos }, { locales }, estudio] = await Promise.all([api('GET', '/encargos'), api('GET', '/locales'), api('GET', '/estudio')]);
  const pendientes = encargos.filter((e) => estadoDePaso(e.paso, e).clase === 'chip-toca').length;

  const nodo = h(
    'div',
    {},
    h(
      'div',
      { class: 'cabeza-pantalla' },
      h(
        'div',
        {},
        h('p', { class: 'sobretitulo' }, 'Orden única'),
        h('h1', {}, 'Posts'),
        h('p', { class: 'entrada' }, 'De la foto que sube el local con prisa a un post de estudio: foto nueva del mismo plato y diseño sobre una referencia. La orden se para dos veces para que confirmes.'),
      ),
      // Sin posts, la acción primaria está en el estado vacío: un solo botón amarillo por pantalla.
      encargos.length ? h('div', { class: 'acciones' }, pendientes ? h('span', { class: 'chip chip-toca' }, `${pendientes} esperan tu decisión`) : null, botonNuevo(locales)) : null,
    ),
    encargos.length === 0 ? vacio(locales, estudio) : h('div', { class: 'rejilla' }, encargos.map(tarjeta)),
  );
  return { nodo };
}

function botonNuevo(locales) {
  return h('a', { class: 'boton primario', href: locales.length ? '#/nuevo' : '#/local' }, locales.length ? 'Nuevo post' : 'Crea antes un local');
}

function tarjeta(e) {
  const estado = estadoDePaso(e.paso, e);
  return h(
    'a',
    { class: 'tarjeta tarjeta-pieza tarjeta-encargo', href: `#/encargo/${e.proyecto}` },
    h('div', { class: 'portada' }, e.miniatura ? h('img', { src: e.miniatura, alt: '', loading: 'lazy' }) : h('div', { class: 'sin-imagen' }), h('span', { class: `chip ${estado.clase}` }, estado.texto)),
    h(
      'div',
      { class: 'tarjeta-cuerpo' },
      h('p', { class: 'idea' }, e.plato),
      h('p', { class: 'nota' }, `${e.nombreLocal ?? e.local} · ${formatearFecha(e.actualizadoEn)}`),
      h(
        'div',
        { class: 'estado' },
        fasesMini(e.fase, h),
        h('span', { class: 'chips' }, e.referencia ? h('span', { class: 'chip', title: 'Referencia elegida' }, e.referencia) : null, e.intentos ? h('span', { class: 'chip', title: 'Fotos nuevas hechas' }, `${e.intentos} foto${e.intentos === 1 ? '' : 's'}`) : null),
      ),
    ),
  );
}

function vacio(locales, estudio) {
  const ejemplo = (evento) =>
    conBoton(evento.currentTarget, async () => {
      await api('POST', '/locales/ejemplo');
      location.hash = '#/nuevo';
    });
  return h(
    'div',
    { class: 'vacio' },
    // La mascota de SOCIETY, como en el estado vacío S05 del prototipo final («Crea tu primera pieza»).
    h('img', { class: 'vacio-mascota', src: '/img/mascota-movil.png', alt: '', width: '247', height: '320' }),
    h('h2', {}, 'Aún no hay posts'),
    h('p', { class: 'nota' }, 'Sube la foto de un plato y la orden hace el resto, parándose donde hace falta tu ojo:'),
    h(
      'ol',
      { class: 'recorrido' },
      h('li', {}, h('b', {}, '1 · Referencia'), 'Un post de Canva o Pinterest del que tomar el oficio. Obligatoria en las 5 primeras piezas del local.'),
      h('li', {}, h('b', {}, '2 · Elementos'), 'El director mira la foto y propone otra toma. Confirmas qué hay en el plato y el gasto.'),
      h('li', {}, h('b', {}, '3 · Foto nueva'), 'Se genera y se comprueba sola. Tú la comparas con la subida y decides.'),
      h('li', {}, h('b', {}, '4 · Diseño'), 'La intención de diseño, con vista previa antes de guardarla.'),
      h('li', {}, h('b', {}, '5 · Post'), 'Exportado a 3:4 y 4:5, con las hojas de revisión.'),
    ),
    h(
      'div',
      { class: 'acciones' },
      locales.length ? botonNuevo(locales) : null,
      !locales.length && estudio.simulado ? h('button', { class: 'primario', onclick: ejemplo }, 'Usar el local de ejemplo') : null,
      !locales.length ? h('a', { class: 'boton secundario', href: '#/local' }, 'Dar de alta un local') : null,
    ),
    !locales.length && estudio.simulado ? h('p', { class: 'nota' }, 'El local de ejemplo es el de plantillas/marca.ejemplo.json, solo en el modo simulado.') : null,
  );
}
