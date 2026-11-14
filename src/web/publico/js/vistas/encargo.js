// Un encargo de la orden única: las cinco fases, el panel de lo que toca ahora y, al lado, la foto, la referencia y el historial.
// Cada avance es un trabajo en segundo plano que corre hasta la siguiente parada; la vista lo sigue aunque se recargue.
import { api, seguirTrabajo } from '../api.js';
import { panelDeTrabajo } from '../componentes.js';
import { FASES, indiceDeFase, urlsDe, usd } from '../orden.js';
import { avisar, conBoton, formatearFecha, h, reemplazar } from '../ui.js';
import { panelDeEspera } from './paneles.js';

export async function vistaEncargo(proyecto) {
  const nodo = h('div', { class: 'encargo' });
  const panelTrabajo = h('div', { class: 'panel-trabajo' });
  const urls = urlsDe(proyecto);
  let d;
  let siguiendo = null;
  let fuera = false;

  async function recargar() {
    d = await api('GET', `/encargos/${proyecto}`);
    pintar();
  }

  /** Lanza un trabajo (o una acción corta) desde un botón; si devuelve un trabajo, lo sigue hasta que acaba. */
  async function lanzar(boton, metodo, ruta, cuerpo) {
    const tarea = () => api(metodo, ruta, cuerpo);
    const respuesta = boton
      ? await conBoton(boton, tarea)
      : await tarea().catch((error) => {
          avisar(error.message ?? String(error), 'error');
          return undefined;
        });
    if (respuesta?.trabajo) seguir(respuesta.trabajo);
    return respuesta;
  }

  async function seguir(trabajo) {
    if (siguiendo === trabajo.id) return;
    siguiendo = trabajo.id;
    nodo.classList.add('ocupada');
    reemplazar(panelTrabajo, panelDeTrabajo(trabajo));
    try {
      const final = await seguirTrabajo(trabajo.id, (t) => reemplazar(panelTrabajo, panelDeTrabajo(t)), () => fuera);
      if (fuera) return;
      if (final.estado === 'ERROR') avisar(final.error?.message ?? 'El trabajo ha fallado.', 'error');
      else reemplazar(panelTrabajo);
    } catch (error) {
      avisar(error.message, 'error');
    } finally {
      siguiendo = null;
    }
    if (!fuera) await recargar();
  }

  const ctx = {
    proyecto,
    urls,
    get d() {
      return d;
    },
    recargar,
    lanzar,
    avanzar: (boton, cuerpo = {}) => lanzar(boton, 'POST', `/encargos/${proyecto}/avanzar`, cuerpo),
  };

  function pintar() {
    const enCurso = d.trabajo?.estado === 'EN_CURSO';
    // Un fallo del último trabajo se queda a la vista hasta la siguiente acción: dice qué ha pasado y por qué.
    if (!enCurso && siguiendo === null) reemplazar(panelTrabajo, d.trabajo?.estado === 'ERROR' ? panelDeTrabajo(d.trabajo) : null);
    reemplazar(nodo, cabecera(), pasos(), panelTrabajo, h('div', { class: 'encargo-rejilla' }, h('div', {}, panelDeEspera(ctx)), lateral()));
    nodo.classList.toggle('ocupada', enCurso);
    if (enCurso) seguir(d.trabajo);
  }

  function cabecera() {
    const { encargo, local } = d;
    return h(
      'div',
      { class: 'cabeza-pantalla' },
      h(
        'div',
        {},
        h('p', { class: 'miga' }, h('a', { href: '#/posts' }, '← Posts'), ` · ${local?.nombre ?? encargo.local}`),
        h('h1', {}, encargo.plato),
        h(
          'div',
          { class: 'chips' },
          h('span', { class: 'chip mono', title: 'Nombre del encargo (carpeta del proyecto)' }, encargo.proyecto),
          encargo.simulado ? h('span', { class: 'chip chip-azul' }, 'Simulado') : null,
          encargo.usoFotoReal === 'SOLO_PRUEBA_COMPOSICION' ? h('span', { class: 'chip chip-revisar', title: 'La foto subida no es del local: no se publica' }, 'Foto solo para probar') : null,
          h('span', { class: 'nota' }, `Creado el ${formatearFecha(encargo.creadoEn)}`),
        ),
      ),
    );
  }

  function pasos() {
    const actual = indiceDeFase(d.fase);
    const terminado = d.fase === 'RESULTADO';
    return h(
      'ol',
      { class: 'pasos', 'aria-label': 'Fases del post' },
      FASES.map((fase, i) => {
        const clase = terminado || i < actual ? 'hecho' : i === actual ? 'actual' : '';
        return h(
          'li',
          { class: `paso ${clase}`, 'aria-current': i === actual ? 'step' : undefined },
          h('span', { class: 'paso-numero' }, clase === 'hecho' ? '✓' : String(i + 1)),
          h('span', { class: 'paso-nombre' }, fase.nombre),
          fase.parada ? h('span', { class: 'paso-parada' }, `■ ${fase.parada}`) : null,
        );
      }),
    );
  }

  function lateral() {
    const { encargo, fotoSubida, referencia, intentos, generador } = d;
    const elegida = referencia.elegida;
    const gastado = intentos.reduce((suma, intento) => suma + intento.costeUsd, 0);
    const historial = [...encargo.historial].reverse();
    return h(
      'aside',
      { class: 'lateral' },
      h(
        'section',
        {},
        h('h3', {}, 'Foto subida', fotoSubida.disponible ? h('span', { class: 'nota' }, `${fotoSubida.ancho} × ${fotoSubida.alto}`) : null),
        fotoSubida.disponible ? h('a', { href: urls.subida(), target: '_blank' }, h('img', { src: urls.subida(640), alt: 'Foto subida por el local' })) : h('p', { class: 'nota' }, 'No está disponible.'),
      ),
      encargo.fotoElegida
        ? h('section', {}, h('h3', {}, 'Foto nueva elegida'), h('a', { href: urls.activo(encargo.fotoElegida), target: '_blank' }, h('img', { src: urls.activo(encargo.fotoElegida, 640), alt: 'Foto nueva confirmada' })))
        : null,
      h(
        'section',
        {},
        h('h3', {}, 'Referencia', encargo.referencia ? h('span', { class: 'chip' }, encargo.referencia) : null),
        elegida && referencia.conImagen ? h('a', { href: urls.referencia(), target: '_blank' }, h('img', { src: urls.referencia(640), alt: 'Referencia elegida' })) : null,
        elegida?.ficha
          ? h('dl', { class: 'datos' }, h('dt', {}, 'Familia'), h('dd', {}, elegida.ficha.familia), h('dt', {}, 'Ficha'), h('dd', {}, elegida.ficha.titulo))
          : h('p', { class: 'nota' }, encargo.referencia ? 'Sin ficha todavía.' : 'Sin elegir.'),
        h('p', { class: 'nota' }, 'Se toma su oficio; nunca sus textos ni sus marcas.'),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'Gasto'),
        h(
          'dl',
          { class: 'datos' },
          h('dt', {}, 'Fotos nuevas'),
          h('dd', {}, String(intentos.length)),
          h('dt', {}, 'Coste'),
          h('dd', {}, usd(gastado)),
          h('dt', {}, 'Generador'),
          h('dd', {}, generador.nombre),
        ),
      ),
      h(
        'section',
        {},
        h('h3', {}, 'Historial', h('span', { class: 'nota' }, String(historial.length))),
        h(
          'ol',
          { class: 'historial' },
          historial.map((entrada) => h('li', {}, h('time', { datetime: entrada.fecha }, formatearFecha(entrada.fecha)), entrada.nota)),
        ),
      ),
    );
  }

  await recargar();
  return {
    nodo,
    salir: () => {
      fuera = true;
    },
  };
}
