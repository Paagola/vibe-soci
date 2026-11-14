// La lista de encargos (columna izquierda de Posts, al estilo lista + detalle) y el estado vacío de Posts.
import { api } from '../api.js';
import { estadoDePaso, fasesMini } from '../orden.js';
import { conBoton, formatearFecha, h, reemplazar } from '../ui.js';

const FILTROS = [
  ['TODOS', 'Todos', () => true],
  ['TOCA', 'Te toca', (e) => estadoDePaso(e.paso, e).clase === 'chip-toca'],
  ['LISTOS', 'Listos', (e) => e.paso === 'HECHO'],
];

/**
 * La columna con los encargos y sus filtros en píldora (Todos / Te toca / Listos, con su cuenta).
 * `actualizar(encargos, seleccionado)` la vuelve a pintar sin perder el filtro elegido.
 */
export function listaDeEncargos() {
  let filtro = 'TODOS';
  let ultimo = { encargos: [], seleccionado: null };
  const pildoras = h('div', { class: 'pildoras', role: 'tablist', 'aria-label': 'Filtrar los encargos' });
  const filas = h('ol', { class: 'lista-encargos' });
  const nodo = h('section', { class: 'columna-lista', 'aria-label': 'Encargos' }, h('header', { class: 'columna-lista-cabeza' }, h('h2', {}, 'Encargos'), pildoras), filas);

  const pintar = () => {
    const { encargos, seleccionado } = ultimo;
    reemplazar(
      pildoras,
      FILTROS.map(([id, nombre, pasa]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(id === filtro),
            onclick: () => {
              filtro = id;
              pintar();
            },
          },
          nombre,
          h('span', { class: 'pildora-cuenta' }, String(encargos.filter(pasa).length)),
        ),
      ),
    );
    const visibles = encargos.filter(FILTROS.find(([id]) => id === filtro)[2]);
    reemplazar(
      filas,
      visibles.length
        ? visibles.map((e) => {
            const estado = estadoDePaso(e.paso, e);
            return h(
              'li',
              {},
              h(
                'a',
                { class: `fila-encargo${e.proyecto === seleccionado ? ' elegida' : ''}`, href: `#/encargo/${e.proyecto}`, 'aria-current': e.proyecto === seleccionado ? 'true' : undefined },
                e.miniatura ? h('img', { src: e.miniatura, alt: '', loading: 'lazy' }) : h('span', { class: 'sin-imagen' }),
                h(
                  'span',
                  { class: 'fila-texto' },
                  h('b', {}, e.plato),
                  h('span', {}, `${e.nombreLocal ?? e.local} · ${formatearFecha(e.actualizadoEn)}`),
                  h('span', { class: 'fila-estado' }, fasesMini(e.fase, h), h('span', { class: `chip ${estado.clase}`, title: estado.texto }, estado.texto)),
                ),
              ),
            );
          })
        : h('li', { class: 'nota lista-vacia' }, 'Ninguno en este filtro.'),
    );
  };

  return {
    nodo,
    actualizar: (encargos, seleccionado) => {
      ultimo = { encargos, seleccionado };
      pintar();
    },
  };
}

/** Sin encargos: la mascota, las cinco fases y una sola acción amarilla. */
export function vacioDePosts(locales, estudio) {
  const ejemplo = (evento) =>
    conBoton(evento.currentTarget, async () => {
      await api('POST', '/locales/ejemplo');
      location.hash = '#/nuevo';
    });
  return h(
    'div',
    { class: 'vacio' },
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
      locales.length ? h('a', { class: 'boton primario', href: '#/nuevo' }, 'Nuevo post') : null,
      !locales.length && estudio.simulado ? h('button', { class: 'primario', onclick: ejemplo }, 'Usar el local de ejemplo') : null,
      !locales.length ? h('a', { class: `boton ${estudio.simulado ? 'secundario' : 'primario'}`, href: '#/local' }, 'Dar de alta un local') : null,
    ),
    !locales.length && estudio.simulado ? h('p', { class: 'nota' }, 'El local de ejemplo es el de plantillas/marca.ejemplo.json, solo en el modo simulado.') : null,
  );
}
