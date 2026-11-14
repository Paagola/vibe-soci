// Posts: lista + detalle. A la izquierda, los encargos; a la derecha, el elegido con su recorrido como línea de tiempo
// (subida → referencia → elementos → foto → diseño → post) y, debajo, el panel de lo que toca ahora.
// Cada avance es un trabajo en segundo plano que corre hasta la siguiente parada; la vista lo sigue aunque se recargue.
import { api, seguirTrabajo } from '../api.js';
import { panelDeTrabajo } from '../componentes.js';
import { estadoDePaso, FASES, indiceDeFase, urlsDe, usd } from '../orden.js';
import { avisar, conBoton, formatearFecha, h, reemplazar } from '../ui.js';
import { listaDeEncargos, vacioDePosts } from './encargos.js';
import { panelDeEspera } from './paneles.js';

/** `elegido` viene de #/encargo/<proyecto>; en #/posts se abre el primero que te toca (o el más reciente). */
export async function vistaEncargo(elegido) {
  const [{ encargos }, { locales }, estudio] = await Promise.all([api('GET', '/encargos'), api('GET', '/locales'), api('GET', '/estudio')]);
  const proyecto = elegido ?? (encargos.find((e) => estadoDePaso(e.paso, e).clase === 'chip-toca') ?? encargos[0])?.proyecto;

  const cabeceraDePagina = h(
    'div',
    { class: 'cabeza-pantalla' },
    h('div', {}, h('p', { class: 'sobretitulo' }, 'Orden única'), h('h1', {}, 'Posts'), h('p', { class: 'entrada' }, 'De la foto que sube el local a un post de estudio, con dos paradas para que confirmes.')),
    // Aquí la acción principal es la de la parada del encargo: «Nuevo post» va en blanco para no competir con ella.
    encargos.length ? h('div', { class: 'acciones' }, h('a', { class: 'boton secundario', href: locales.length ? '#/nuevo' : '#/local' }, locales.length ? 'Nuevo post' : 'Crea antes un local')) : null,
  );
  if (!proyecto) return { nodo: h('div', {}, cabeceraDePagina, vacioDePosts(locales, estudio)) };

  const lista = listaDeEncargos();
  const detalle = h('div', { class: 'detalle' });
  const nodo = h(
    'div',
    { class: `pagina-posts ${elegido ? 'con-eleccion' : 'sin-eleccion'}` },
    cabeceraDePagina,
    h('div', { class: 'maestro' }, lista.nodo, detalle),
  );
  lista.actualizar(encargos, proyecto);

  const panelTrabajo = h('div', { class: 'panel-trabajo' });
  const urls = urlsDe(proyecto);
  let d;
  let siguiendo = null;
  let fuera = false;

  async function recargar() {
    const [detalleNuevo, resumen] = await Promise.all([api('GET', `/encargos/${proyecto}`), api('GET', '/encargos')]);
    d = detalleNuevo;
    lista.actualizar(resumen.encargos, proyecto);
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
    detalle.classList.add('ocupada');
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
    reemplazar(detalle, cabecera(), lineaDeTiempo(), panelTrabajo, panelDeEspera(ctx), historial());
    detalle.classList.toggle('ocupada', enCurso);
    if (enCurso) seguir(d.trabajo);
  }

  // ---------------------------------------------------------------- Cabecera del encargo elegido

  function cabecera() {
    const { encargo, local, intentos, generador } = d;
    const estado = estadoDePaso(encargo.paso, { bloqueado: Boolean(encargo.bloqueo), trabajoEnCurso: d.trabajo?.estado === 'EN_CURSO' });
    const gastado = intentos.reduce((suma, intento) => suma + intento.costeUsd, 0);
    return h(
      'section',
      { class: 'detalle-cabeza' },
      h(
        'div',
        { class: 'detalle-titulo' },
        h('p', { class: 'miga' }, h('a', { href: '#/posts', class: 'volver' }, '← Encargos'), h('span', {}, local?.nombre ?? encargo.local)),
        h('h2', {}, encargo.plato),
        h(
          'div',
          { class: 'chips' },
          h('span', { class: `chip ${estado.clase}` }, estado.texto),
          encargo.simulado ? h('span', { class: 'chip chip-azul' }, 'Simulado') : null,
          encargo.usoFotoReal === 'SOLO_PRUEBA_COMPOSICION' ? h('span', { class: 'chip chip-revisar', title: 'La foto subida no es del local: no se publica' }, 'Foto solo para probar') : null,
          h('span', { class: 'chip mono', title: 'Nombre del encargo (carpeta del proyecto)' }, encargo.proyecto),
        ),
      ),
      // Estado visible: lo gastado en este encargo y con qué, y cuándo se creó.
      h(
        'dl',
        { class: 'detalle-datos' },
        h('div', {}, h('dt', {}, 'Fotos nuevas'), h('dd', {}, String(intentos.length))),
        h('div', {}, h('dt', {}, 'Gasto'), h('dd', {}, usd(gastado))),
        h('div', {}, h('dt', {}, 'Generador'), h('dd', {}, generador.nombre)),
        h('div', {}, h('dt', {}, 'Creado'), h('dd', {}, formatearFecha(encargo.creadoEn))),
      ),
    );
  }

  // ---------------------------------------------------------------- Línea de tiempo (Cardiology): hitos conectados

  function lineaDeTiempo() {
    const actual = indiceDeFase(d.fase);
    const terminado = d.fase === 'RESULTADO';
    // El hito 0 es la foto subida (siempre hecha); los demás son las cinco fases de la orden.
    const hitos = [{ id: 'SUBIDA', nombre: 'Foto subida' }, ...FASES].map((fase, i) => {
      const f = i - 1;
      const estado = i === 0 || terminado || f < actual ? 'hecho' : f === actual ? 'actual' : 'pendiente';
      return { ...fase, estado, ...contenidoDelHito(fase.id) };
    });
    const indiceActual = hitos.findIndex((x) => x.estado === 'actual');
    const avance = (indiceActual === -1 ? hitos.length - 1 : indiceActual) / (hitos.length - 1);
    const linea = h(
      'ol',
      { class: 'linea-tiempo' },
      hitos.map((x) =>
        h(
          'li',
          { class: `hito hito-${x.estado}`, 'aria-current': x.estado === 'actual' ? 'step' : undefined },
          h('span', { class: 'hito-punto', 'aria-hidden': 'true' }, x.estado === 'hecho' ? '✓' : ''),
          h('span', { class: 'hito-nombre' }, x.nombre, x.parada ? h('small', {}, x.parada) : null),
          h(
            'div',
            { class: 'hito-tarjeta' },
            x.imagen ? h('a', { href: x.enlace ?? x.imagen, target: '_blank', class: 'hito-imagen' }, h('img', { src: x.imagen, alt: x.alt ?? '', loading: 'lazy' })) : h('span', { class: 'hito-imagen hito-sin-imagen', 'aria-hidden': 'true' }),
            h('p', {}, x.texto),
          ),
        ),
      ),
    );
    // La parte azul de la línea llega hasta el hito actual (una propiedad CSS: no va por el objeto style de h()).
    linea.style.setProperty('--avance', String(avance));
    return h(
      'section',
      { class: 'recorrido-encargo' },
      h('header', { class: 'tarjeta-cabeza' }, h('h2', {}, 'Recorrido'), h('p', { class: 'nota' }, terminado ? 'Post terminado' : `Ahora: ${FASES[actual]?.nombre ?? ''}`)),
      linea,
    );
  }

  /** Lo que se sabe de cada hito: su imagen (si la hay) y una línea de estado. Nada inventado. */
  function contenidoDelHito(id) {
    const { encargo, fotoSubida, referencia, propuesta, intentos, diseno } = d;
    switch (id) {
      case 'SUBIDA':
        return fotoSubida.disponible ? { imagen: urls.subida(320), enlace: urls.subida(), alt: 'Foto subida por el local', texto: `${fotoSubida.ancho} × ${fotoSubida.alto} px` } : { texto: 'No está disponible' };
      case 'REFERENCIA': {
        const elegida = referencia.elegida;
        if (!encargo.referencia) return { texto: 'Sin elegir' };
        return { ...(elegida && referencia.conImagen ? { imagen: urls.referencia(320), enlace: urls.referencia(), alt: 'Referencia elegida' } : {}), texto: elegida?.ficha ? `${elegida.ficha.familia} · ${encargo.referencia}` : encargo.referencia };
      }
      case 'ELEMENTOS':
        if (!propuesta) return { texto: 'Esperando al director' };
        if (!propuesta.valida) return { texto: 'Propuesta por corregir' };
        return { texto: propuesta.toma?.otra ? 'Otra toma propuesta' : 'Misma toma: revisar' };
      case 'FOTO': {
        if (!intentos.length) return { texto: 'Sin fotos nuevas' };
        const foto = intentos.find((i) => i.elegida) ?? intentos.at(-1);
        const veredictos = { PASA: 'pasa', DESCARTA: 'descartada', REVISAR: 'a revisar', RECHAZADA: 'rechazada', PENDIENTE: 'sin comprobar' };
        return {
          ...(foto.disponible ? { imagen: urls.activo(foto.activo, 320), enlace: urls.activo(foto.activo), alt: `Foto nueva, intento ${foto.n}` } : {}),
          texto: `${foto.elegida ? 'Elegida' : `Intento ${foto.n}`} · ${veredictos[foto.final] ?? foto.final}`,
        };
      }
      case 'DISENO':
        if (!diseno.intencion) return { texto: 'Sin intención todavía' };
        return { texto: diseno.intencion.esBorrador ? 'Borrador de intención' : `Intención v${diseno.intencion.version ?? '?'}${diseno.intencion.valida ? '' : ' · no válida'}` };
      case 'RESULTADO': {
        const version = diseno.versiones.find((v) => v.version === diseno.vigente) ?? diseno.versiones.at(-1);
        if (!version) return { texto: 'Sin componer' };
        const archivo = version.exportadas.find((x) => x.proporcion === '4:5')?.archivo ?? version.exportadas[0]?.archivo ?? version.diseno;
        return { imagen: urls.diseno(archivo, { lado: 320, sello: version.compuestaEn }), enlace: urls.diseno(archivo), alt: `Post, versión ${version.version}`, texto: `Versión ${version.version}${version.version === diseno.vigente ? ' · vigente' : ''}` };
      }
      default:
        return { texto: '' };
    }
  }

  // ---------------------------------------------------------------- Historial (plegado: es consulta, no foco)

  function historial() {
    const entradas = [...d.encargo.historial].reverse();
    return h(
      'section',
      { class: 'detalle-historial' },
      h(
        'details',
        {},
        h('summary', {}, 'Historial ', h('span', { class: 'nota' }, `${entradas.length} notas`)),
        h('ol', { class: 'historial' }, entradas.map((entrada) => h('li', {}, h('time', { datetime: entrada.fecha }, formatearFecha(entrada.fecha)), entrada.nota))),
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
