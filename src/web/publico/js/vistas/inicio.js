// Generador antiguo (MVP): piezas, locales y atajos para cargar los ejemplos. Se conserva tal cual.
import { api } from '../api.js';
import { conBoton, formatearFecha, h, nombre } from '../ui.js';

const FASES = {
  IDEA: 'Falta proponer conceptos',
  CONCEPTOS: 'Falta elegir concepto',
  IMAGENES: 'Faltan imágenes',
  LISTA: 'Lista para exportar',
};

export async function vistaInicio() {
  const [{ piezas }, { locales }] = await Promise.all([api('GET', '/piezas'), api('GET', '/locales')]);

  const cargarEjemplo = (plantilla) => (evento) =>
    conBoton(evento.currentTarget, async () => {
      const { pieza } = await api('POST', '/ejemplos', { plantilla });
      location.hash = `#/pieza/${pieza.id}`;
    });

  const nodo = h(
    'div',
    {},
    h(
      'div',
      { class: 'titulo-seccion' },
      h('div', {}, h('p', { class: 'sobretitulo' }, 'Generador antiguo · MVP'), h('h1', {}, 'Piezas'), h('p', { class: 'entrada' }, 'Gemini dirige e Higgsfield genera la imagen entera, con el texto dentro. Para la foto nueva y el post compuesto, usa «Nuevo post».')),
      h('div', { class: 'acciones' }, h('a', { class: 'boton', href: locales.length ? '#/nueva' : '#/local' }, locales.length ? 'Nueva pieza' : 'Crea antes un local')),
    ),
    piezas.length === 0
      ? h(
          'div',
          { class: 'vacio' },
          h('p', {}, 'Aún no hay piezas. Crea un local y una pieza, o carga un ejemplo con fotos reales (post del Asador Etxebarri, carrusel de Café Albor):'),
          h(
            'div',
            { class: 'acciones' },
            h('button', { class: 'secundario', onclick: cargarEjemplo('post') }, 'Cargar ejemplo: post'),
            h('button', { class: 'secundario', onclick: cargarEjemplo('carrusel') }, 'Cargar ejemplo: carrusel'),
          ),
        )
      : h('div', { class: 'rejilla' }, piezas.map(tarjetaDePieza)),
    h('h2', {}, 'Locales'),
    locales.length === 0
      ? h('p', { class: 'nota' }, 'Ninguno todavía.')
      : h(
          'ul',
          { class: 'locales' },
          locales.map((local) =>
            h(
              'li',
              {},
              h('strong', {}, local.nombre),
              ` · ${local.ciudad} · `,
              local.colores.map((color) => h('span', { class: 'color-muestra', title: `${color.nombre} ${color.hex}`, style: { background: color.hex } })),
            ),
          ),
        ),
    piezas.length > 0
      ? h(
          'p',
          { class: 'nota' },
          'Ejemplos con fotos reales: ',
          h('button', { class: 'enlace', onclick: cargarEjemplo('post') }, 'post'),
          ' · ',
          h('button', { class: 'enlace', onclick: cargarEjemplo('carrusel') }, 'carrusel'),
        )
      : null,
  );
  return { nodo };
}

function tarjetaDePieza(pieza) {
  return h(
    'a',
    { class: 'tarjeta tarjeta-pieza', href: `#/pieza/${pieza.id}` },
    pieza.miniatura ? h('img', { src: pieza.miniatura, alt: '', loading: 'lazy' }) : h('div', { class: 'sin-imagen' }),
    h(
      'div',
      { class: 'tarjeta-cuerpo' },
      h('p', { class: 'idea' }, pieza.idea),
      h('p', { class: 'nota' }, `${nombre(pieza.formato)} · ${nombre(pieza.tipo)} · ${formatearFecha(pieza.creadaEn)}`),
      h(
        'p',
        {},
        pieza.trabajoEnCurso ? h('span', { class: 'insignia insignia-curso' }, 'Trabajando…') : h('span', { class: `insignia insignia-${pieza.fase.toLowerCase()}` }, FASES[pieza.fase]),
        pieza.fase === 'IMAGENES' || pieza.fase === 'LISTA' ? ` ${pieza.conImagen}/${pieza.total} con imagen` : '',
      ),
    ),
  );
}
