// Nuevo post: la puerta de entrada de la orden única. El local, la foto del plato tal como la hizo y qué plato es.
// Al crearlo, la orden corre sola hasta su primera parada (la referencia o los elementos).
import { api, subirArchivo } from '../api.js';
import { bloqueError, conBoton, h, reemplazar } from '../ui.js';

const MAX_BYTES = 10 * 1024 * 1024;
const ACEPTADAS = 'image/jpeg,image/png,image/webp';

export async function vistaNuevoEncargo() {
  const [{ locales }, estudio] = await Promise.all([api('GET', '/locales'), api('GET', '/estudio')]);
  if (locales.length === 0) return { nodo: sinLocales(estudio) };

  const errores = h('div');
  const campo = (etiqueta, control, ayuda) => h('label', { class: 'campo' }, h('span', {}, etiqueta), control, ayuda ? h('small', {}, ayuda) : null);

  // ------------------------------------------------ Local
  const local = h('select', {}, locales.map((m) => h('option', { value: m.slug }, `${m.nombre} · ${m.ciudad}${m.soloLectura ? ' · datos reales (solo lectura)' : ''}`)));
  const avisoTokens = h('p', { class: 'aviso-linea', hidden: true }, 'Este local aún no tiene marcas/<local>/tokens.json: la orden llegará hasta la foto nueva, pero no podrá componer el post.');
  const actualizarLocal = () => {
    const elegido = locales.find((m) => m.slug === local.value);
    avisoTokens.hidden = Boolean(elegido?.tokens);
    reemplazar(muestras, elegido?.colores?.map((c) => h('span', { class: 'color-muestra', title: `${c.nombre} ${c.hex}`, style: { background: c.hex } })) ?? []);
  };
  const muestras = h('span', { class: 'chips' });
  local.addEventListener('change', actualizarLocal);

  // ------------------------------------------------ Foto
  let subida = { estado: 'VACIA' };
  const archivo = h('input', { type: 'file', accept: ACEPTADAS, 'aria-label': 'Foto del plato' });
  const zona = h('div', { class: 'soltar' });
  const pintarZona = (contenido) => reemplazar(zona, contenido, archivo);
  const zonaVacia = () =>
    pintarZona(h('div', {}, h('p', { class: 'soltar-titulo' }, 'Suelta aquí la foto del plato'), h('p', { class: 'nota' }, 'O haz clic para elegirla. La del móvil, tal cual: JPG, PNG o WEBP de hasta 10 MB.')));
  zonaVacia();

  const elegir = async (fichero) => {
    if (!fichero) return;
    if (fichero.size > MAX_BYTES) {
      subida = { estado: 'ERROR' };
      return pintarZona(h('div', {}, h('p', { class: 'error' }, 'Pesa más de 10 MB.'), h('p', { class: 'nota' }, 'Elige otra.')));
    }
    zona.classList.add('con-foto');
    const vista = h('img', { src: URL.createObjectURL(fichero), alt: 'Foto elegida' });
    const estado = h('p', { class: 'nota' }, 'Subiendo…');
    pintarZona(h('div', {}, vista, h('strong', {}, fichero.name), estado));
    subida = { estado: 'SUBIENDO' };
    try {
      subida = { estado: 'LISTA', id: (await subirArchivo(fichero)).id };
      estado.textContent = 'Subida. Haz clic para cambiarla.';
    } catch (error) {
      subida = { estado: 'ERROR' };
      estado.textContent = error.message;
      estado.className = 'error';
    }
  };
  archivo.addEventListener('change', () => elegir(archivo.files?.[0]));
  zona.addEventListener('dragover', (evento) => {
    evento.preventDefault();
    zona.classList.add('encima');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (evento) => {
    evento.preventDefault();
    zona.classList.remove('encima');
    elegir(evento.dataTransfer?.files?.[0]);
  });

  // ------------------------------------------------ Plato y uso
  const plato = h('input', { required: true, minlength: '3', maxlength: '300', placeholder: 'Lo que es el plato, como lo diría el local' });
  const uso = (valor, titulo, ayuda, marcado = false) =>
    h('label', { class: 'opcion' }, h('input', { type: 'radio', name: 'uso', value: valor, checked: marcado }), h('span', {}, h('strong', {}, titulo), h('small', {}, ayuda)));
  const opcionesUso = h(
    'div',
    { class: 'opciones' },
    uso('PUBLICABLE', 'Es del local', 'La hizo el local: se puede publicar.', true),
    uso('SOLO_PRUEBA_COMPOSICION', 'Solo para probar', 'Sacada de internet: sirve para componer, nunca se publica.'),
  );
  const proyecto = h('input', { pattern: '[a-z0-9]+(-[a-z0-9]+)*', maxlength: '80', placeholder: 'Se pone solo: fecha y plato' });
  // Formato y estética (puntos 1 y 10): la estética manda a la vez sobre la foto y sobre el diseño.
  const formato = h('select', {}, h('option', { value: 'integrado' }, 'Cartel integrado · 4:5'), h('option', { value: 'post' }, 'Post por capas'), h('option', { value: 'carrusel' }, 'Carrusel (portada, detalles y cierre)'));
  const estetica = h(
    'select',
    {},
    h('option', { value: '' }, 'La de la referencia'),
    ...[
      ['EDITORIAL_SERENO', 'Editorial sereno (claro, aire)'],
      ['EDITORIAL_OSCURO', 'Editorial oscuro (clave baja, script)'],
      ['COLOR_POP', 'Color pop con recorte'],
      ['MAXIMALISMO', 'Maximalismo / collage'],
      ['MEDITERRANEO_LUMINOSO', 'Cenital luminoso mediterráneo'],
      ['RUSTICO_FUEGO', 'Rústico de fuego'],
    ].map(([v, t]) => h('option', { value: v }, t)),
  );

  const enviar = async (evento) => {
    evento.preventDefault();
    reemplazar(errores);
    const problemas = [
      ...(subida.estado === 'SUBIENDO' ? ['Espera a que termine de subir la foto.'] : []),
      ...(subida.estado !== 'LISTA' && subida.estado !== 'SUBIENDO' ? ['Falta la foto del plato.'] : []),
      ...(plato.value.trim().length < 3 ? ['Di qué plato es (mínimo 3 caracteres).'] : []),
    ];
    if (problemas.length) return reemplazar(errores, bloqueError({ message: 'Revisa el post', detalles: problemas }));

    await conBoton(evento.submitter, async () => {
      try {
        const { encargo } = await api('POST', '/encargos', {
          subidaId: subida.id,
          local: local.value,
          plato: plato.value.trim(),
          usoFotoReal: nodo.querySelector('input[name="uso"]:checked')?.value ?? 'PUBLICABLE',
          formato: formato.value === 'integrado' ? 'post' : formato.value,
          ...(formato.value === 'integrado' ? { arte: 'INTEGRADO' } : {}),
          ...(estetica.value ? { estetica: estetica.value } : {}),
          ...(proyecto.value.trim() ? { proyecto: proyecto.value.trim() } : {}),
        });
        if (formato.value === 'integrado') location.assign('/pase.html?proyecto=' + encodeURIComponent(encargo.proyecto));
        else location.hash = `#/encargo/${encargo.proyecto}`;
      } catch (error) {
        reemplazar(errores, bloqueError(error));
      }
    });
  };

  const nodo = h(
    'form',
    { class: 'formulario', onsubmit: enviar },
    h('p', { class: 'sobretitulo' }, 'Orden única'),
    h('h1', {}, 'Nuevo post'),
    h('p', { class: 'entrada' }, 'Sube la foto del local y elige cómo producir la pieza. En el cartel integrado revisarás la dirección, el texto y la imagen final.'),
    h('fieldset', {}, h('legend', {}, 'Local'), campo('¿De qué local es?', local), muestras, avisoTokens),
    h(
      'fieldset',
      {},
      h('legend', {}, 'La foto del plato'),
      zona,
      campo('¿Qué plato es?', plato, 'Con las palabras del local: el director no inventa ingredientes y los textos solo dicen lo que consta del local.'),
      h('div', { class: 'campo' }, h('span', {}, '¿De dónde sale la foto?'), opcionesUso),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'La pieza'),
      campo('Formato', formato),
      campo('Estética', estetica, 'Manda sobre la foto nueva y sobre el diseño. Si no eliges, sale de la referencia; si eliges otra, se avisa.'),
    ),
    h('details', {}, h('summary', {}, 'Más opciones'), campo('Nombre del encargo', proyecto, 'Solo minúsculas, números y guiones. Si lo dejas vacío, sale de la fecha y del plato.')),
    errores,
    h('div', { class: 'acciones' }, h('button', { type: 'submit', class: 'primario' }, 'Empezar el post'), h('span', { class: 'nota' }, 'Aún no gasta nada: la primera parada es antes de la foto nueva.')),
  );
  actualizarLocal();
  return { nodo };
}

function sinLocales(estudio) {
  const ejemplo = (evento) =>
    conBoton(evento.currentTarget, async () => {
      await api('POST', '/locales/ejemplo');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  return h(
    'div',
    { class: 'vacio' },
    h('h2', {}, 'Antes, un local'),
    h('p', { class: 'nota' }, 'Cada post es de un local: su marca, sus colores y sus datos. Los textos solo dicen lo que consta de él.'),
    h(
      'div',
      { class: 'acciones' },
      estudio.simulado ? h('button', { class: 'primario', onclick: ejemplo }, 'Usar el local de ejemplo') : null,
      h('a', { class: `boton ${estudio.simulado ? 'secundario' : 'primario'}`, href: '#/local' }, 'Dar de alta un local'),
    ),
  );
}
