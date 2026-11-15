// Los paneles del encargo: uno por cada cosa que la orden puede estar esperando (detalle.espera.tipo).
// Lo que aquí se decide es lo mismo que en `npm run post`: elegir la referencia, las dos paradas y la intención de diseño.
import { api, subirArchivo } from '../api.js';
import { urlDeBiblioteca, usd } from '../orden.js';
import { avisar, bloqueError, confirmar, conBoton, formatearFecha, h, reemplazar } from '../ui.js';

export function panelDeEspera(ctx) {
  const { espera } = ctx.d;
  switch (espera.tipo) {
    case 'REFERENCIA':
      return panelReferencia(ctx);
    case 'CONFIRMAR_ELEMENTOS':
      return panelElementos(ctx);
    case 'IMPORTAR_FOTO':
      return panelImportar(ctx);
    case 'CONFIRMAR_FOTO':
      return panelFoto(ctx);
    case 'TOKENS':
      return panelTokens(ctx);
    case 'INTENCION':
      return panelIntencion(ctx, 'INTENCION');
    case 'COMPOSICION':
      return panelIntencion(ctx, 'COMPOSICION');
    case 'HECHO':
      return panelResultado(ctx);
    default:
      return panelContinuar(ctx);
  }
}

// ---------------------------------------------------------------- Piezas comunes

const PASOS_LEGIBLES = {
  REFERENCIA: 'comprobar la referencia',
  FOTO_REAL: 'registrar la foto subida',
  PROPUESTA: 'la propuesta del director de fotografía',
  GENERAR: 'hacer la foto nueva',
  COMPROBAR: 'la comprobación de salida',
  MASCARA: 'recortar el sujeto',
  INTENCION: 'preparar la intención de diseño',
  COMPONER: 'componer y exportar el post',
};

const DISTANCIAS = { GENERAL: 'general', MEDIO: 'plano medio', PRIMER_PLANO: 'primer plano', MACRO: 'macro' };

function panel(clase, ...hijos) {
  return h('section', { class: `panel-encargo panel-${clase}` }, ...hijos);
}

function cabeza({ sello, sobretitulo, titulo, entrada }) {
  return h(
    'header',
    {},
    h('div', {}, sello ? h('span', { class: 'parada-sello' }, sello) : null, sobretitulo ? h('p', { class: 'sobretitulo' }, sobretitulo) : null, h('h2', {}, titulo), entrada ? h('p', { class: 'nota' }, entrada) : null),
  );
}

function llamada(titulo, texto, tipo = '') {
  return h('div', { class: `llamada ${tipo ? `llamada-${tipo}` : ''}` }, titulo ? h('strong', {}, titulo) : null, texto);
}

function lista(elementos) {
  return elementos?.length ? h('ul', {}, elementos.map((x) => h('li', {}, x))) : null;
}

function datos(pares) {
  return h(
    'dl',
    { class: 'datos' },
    pares.filter(([, valor]) => valor !== undefined && valor !== null && valor !== '').map(([clave, valor]) => [h('dt', {}, clave), h('dd', {}, valor)]),
  );
}

function botonCopiar(texto, etiqueta = 'Copiar') {
  return h(
    'button',
    {
      type: 'button',
      class: 'secundario pequeno',
      onclick: () =>
        navigator.clipboard.writeText(texto).then(
          () => avisar('Copiado.', 'ok'),
          () => avisar('No he podido copiar: selecciona el texto a mano.', 'error'),
        ),
    },
    etiqueta,
  );
}

function chipVeredicto(final) {
  const textos = { PASA: 'Pasa', REVISAR: 'Revisar', DESCARTA: 'Descarta', RECHAZADA: 'Rechazada por ti', PENDIENTE: 'Sin comprobar' };
  return h('span', { class: `chip veredicto-${String(final).toLowerCase()}` }, textos[final] ?? final);
}

/** La ficha de la referencia, en lo que sirve para diseñar: capas, retícula, lectura y por qué funciona. */
function fichaDeReferencia(ficha) {
  if (!ficha) return null;
  return h(
    'div',
    { class: 'bloque' },
    h('h3', {}, `Ficha de la referencia · ${ficha.familia}`),
    h('p', { class: 'nota' }, ficha.titulo),
    datos([
      ['Capas', ficha.capas?.join(' → ')],
      ['Retícula', ficha.reticula],
      ['Lectura', ficha.lectura?.join(' → ')],
      ['Tipografía', ficha.tipografia?.map((t) => `${t.rol.toLowerCase()}: ${t.clasificacion}`).join(' · ')],
      ['Foto', ficha.foto],
    ]),
    ficha.porQueFunciona ? h('p', { class: 'nota' }, ficha.porQueFunciona) : null,
  );
}

// ---------------------------------------------------------------- Seguir sin nada que confirmar

function panelContinuar(ctx) {
  const { espera, encargo } = ctx.d;
  const paso = espera.paso ?? encargo.paso;
  return panel(
    'continuar',
    cabeza({ sobretitulo: 'En marcha', titulo: 'La orden puede seguir sola', entrada: `Se quedó en «${PASOS_LEGIBLES[paso] ?? paso}». No hay nada que confirmar hasta la siguiente parada.` }),
    h('div', { class: 'barra-acciones' }, h('button', { class: 'primario lanza-trabajo', onclick: (e) => ctx.avanzar(e.currentTarget) }, 'Seguir')),
  );
}

// ---------------------------------------------------------------- Referencia

function panelReferencia(ctx) {
  const { d, proyecto, urls } = ctx;
  const { referencia, espera, encargo } = d;
  const estado = referencia.estado;
  const propuestas = new Set((estado?.propuestas ?? []).map((f) => f.id));

  const usar = (cuerpo) => async (evento) => {
    const boton = evento.currentTarget;
    const hecho = await conBoton(boton, () => api('PUT', `/encargos/${proyecto}/referencia`, cuerpo));
    // Con la referencia puesta, la orden sigue sola hasta la parada de elementos.
    if (hecho) await ctx.avanzar(null);
  };

  const registradas = referencia.registradas.length
    ? h(
        'div',
        { class: 'bloque' },
        h('h3', {}, 'Las referencias de este local'),
        h(
          'div',
          { class: 'posts' },
          referencia.registradas.map((r) =>
            h(
              'button',
              {
                type: 'button',
                class: `post-ref lanza-trabajo${encargo.referencia === r.id ? ' elegida' : ''}`,
                disabled: !r.usable,
                title: r.usable ? `${r.titulo ?? r.id} (${r.familia})` : 'Sin ficha (o sin captura): todavía no se puede usar',
                onclick: usar({ referencia: r.id }),
              },
              r.conImagen ? h('img', { src: urls.referenciaDelLocal(r.id, 320), alt: r.titulo ?? r.id, loading: 'lazy' }) : h('div', { class: 'sin-imagen', style: { aspectRatio: '4 / 5' } }),
              h('span', {}, r.familia ? `${r.id} · ${r.familia}` : r.id),
            ),
          ),
        ),
      )
    : null;

  const familia = (f) =>
    h(
      'article',
      { class: 'familia' },
      h('header', {}, h('h3', {}, `${f.id} · ${f.nombre}`), propuestas.has(f.id) ? h('span', { class: 'chip chip-azul', title: 'Elegida por los tonos del local y por variedad de fondo' }, 'Propuesta para este local') : null),
      h('p', {}, f.receta),
      h(
        'div',
        { class: 'posts' },
        f.posts.map((post) =>
          h(
            'button',
            { type: 'button', class: `post-ref lanza-trabajo${encargo.referencia === `ref-${post}` ? ' elegida' : ''}`, title: `Usar ${post} como referencia`, onclick: usar({ biblioteca: post }) },
            h('img', { src: urlDeBiblioteca(post), alt: `${post} (${f.nombre})`, loading: 'lazy' }),
            h('span', {}, post),
          ),
        ),
      ),
    );

  const primero = referencia.biblioteca.filter((f) => propuestas.has(f.id));
  const resto = referencia.biblioteca.filter((f) => !propuestas.has(f.id));

  return panel(
    'referencia',
    cabeza({
      sobretitulo: 'Fase 1',
      titulo: 'Elige la referencia',
      entrada: estado ? `Piezas del local que cuentan: ${estado.piezasReales} de ${estado.umbral}.` : null,
    }),
    llamada('Por qué se para aquí', espera.motivo),
    registradas,
    h(
      'div',
      { class: 'familias' },
      h('p', { class: 'nota' }, 'O toma un post de la biblioteca del estudio: entra con su ficha ya analizada. De la referencia se toma el oficio (composición, jerarquía, tipografía), nunca sus textos ni sus marcas.'),
      (primero.length ? primero : resto.slice(0, 3)).map(familia),
      resto.length > (primero.length ? 0 : 3) ? h('details', {}, h('summary', {}, 'Ver el resto de familias'), h('div', { class: 'familias' }, (primero.length ? resto : resto.slice(3)).map(familia))) : null,
    ),
    referenciaPropia(usar),
  );
}

/** Una referencia propia: una imagen o un enlace. Su ficha la escribe el analista al seguir (y avisa si no es un post limpio). */
function referenciaPropia(usar) {
  const archivo = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Imagen de la referencia' });
  const enlace = h('input', { type: 'url', placeholder: 'https://… (Canva o Pinterest)', 'aria-label': 'Enlace de la referencia' });
  const errores = h('div', {});
  const enviar = async (evento) => {
    reemplazar(errores);
    try {
      if (archivo.files?.[0]) {
        const subida = await subirArchivo(archivo.files[0]);
        await usar({ subidaId: subida.id })(evento);
      } else if (enlace.value.trim()) {
        await usar({ enlace: enlace.value.trim() })(evento);
      } else reemplazar(errores, bloqueError({ message: 'Elige una imagen o pega un enlace.' }));
    } catch (error) {
      reemplazar(errores, bloqueError(error));
    }
  };
  return h(
    'div',
    { class: 'bloque' },
    h('h3', {}, 'O una referencia propia'),
    h('p', { class: 'nota' }, 'Una imagen o un enlace. El estudio escribe su ficha y avisa si es un mockup, lleva marca de agua o no es el post en sí.'),
    h('div', { class: 'campo' }, archivo, enlace),
    errores,
    h('button', { type: 'button', class: 'lanza-trabajo', onclick: enviar }, 'Usar esta referencia'),
  );
}

// ---------------------------------------------------------------- Parada 1: elementos, toma y gasto

function panelElementos(ctx) {
  const { d, urls } = ctx;
  const { propuesta, espera, generador, fotoSubida } = d;
  const presupuesto = h('div', { class: 'gasto' }, h('p', { class: 'cargando' }, 'Calculando el gasto…'));
  let datosGasto;
  api('GET', `/encargos/${ctx.proyecto}/presupuesto`).then(
    ({ presupuesto: p }) => {
      datosGasto = p;
      reemplazar(presupuesto, ...cajasDeGasto(p));
    },
    (error) => reemplazar(presupuesto, bloqueError(error)),
  );

  if (!propuesta?.valida) {
    return panel(
      'elementos',
      cabeza({ sello: '■ Parada 1', titulo: 'La propuesta del director no es válida' }),
      propuesta ? h('div', { class: 'error' }, h('strong', {}, 'Lo que falla:'), lista(propuesta.errores)) : h('p', { class: 'nota' }, 'No hay propuesta guardada.'),
      propuesta ? editorJsonDePropuesta(ctx, propuesta.contenido) : null,
    );
  }

  const { descripcion, huecos, decisiones } = propuesta.contenido;
  const { camara } = huecos;
  const conProblemas = propuesta.problemas.length > 0;

  const confirmarParada = async (evento) => {
    const boton = evento.currentTarget;
    const p = datosGasto;
    const contenido = h(
      'div',
      {},
      p?.disponible
        ? h(
            'dl',
            {},
            h('dt', {}, 'Generador'),
            h('dd', {}, p.generador),
            h('dt', {}, 'Por intento'),
            h('dd', {}, `≤ ${usd(p.estimadoPorIntentoUsd)}`),
            h('dt', {}, 'Intentos'),
            h('dd', {}, `hasta ${p.maxIntentos} seguidos`),
            h('dt', {}, 'Como mucho'),
            h('dd', {}, `≤ ${usd((p.estimadoPorIntentoUsd ?? 0) * p.maxIntentos)}`),
            p.tope ? [h('dt', {}, 'Tope del código'), h('dd', {}, `${usd(p.tope.gastadoUsd)} de ${usd(p.tope.topeUsd)} gastados`)] : null,
          )
        : h('p', {}, `La API no puede generar ahora (${p?.motivo ?? 'sin generador'}). Al confirmar, la orden te pedirá la foto hecha a mano.`),
      h('p', { class: 'nota' }, 'Confirmas la lista de elementos, la toma nueva y este gasto. Si la comprobación descarta dos fotos seguidas, la orden se para y vuelves aquí.'),
    );
    if (await confirmar({ titulo: 'Antes de la foto nueva', contenido, aceptar: 'Confirmar' })) ctx.avanzar(boton, { confirmo: 'CONFIRMAR_ELEMENTOS' });
  };

  return panel(
    'elementos',
    cabeza({
      sello: '■ Parada 1',
      titulo: '¿Está todo lo que hay en el plato?',
      entrada: 'Confirma la lista de elementos, la toma nueva y el gasto. Hasta aquí no se ha gastado nada en fotos.',
    }),
    espera.bloqueo
      ? llamada(
          `${generador.maxIntentos} fotos descartadas seguidas`,
          'La orden se ha parado por la regla de gasto. Revisa la propuesta (los elementos y la toma) y vuelve a confirmar para otros intentos.',
          'alerta',
        )
      : null,
    h(
      'div',
      { class: 'dos-columnas' },
      h(
        'div',
        {},
        h('figure', { class: 'foto-grande', style: { margin: '0 0 1rem' } }, h('img', { src: urls.subida(1080), alt: 'Foto subida' }), h('figcaption', { class: 'nota' }, `Foto subida · ${fotoSubida.ancho} × ${fotoSubida.alto} px`)),
        h(
          'div',
          { class: 'bloque' },
          h('h3', {}, 'Lo que ve el director'),
          h(
            'table',
            { class: 'tabla' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Elemento'), h('th', {}, 'Cómo está'), h('th', {}, 'Nº'))),
            h('tbody', {}, descripcion.elementos.map((x) => h('tr', {}, h('td', {}, h('strong', {}, x.nombre)), h('td', {}, x.estado), h('td', { class: 'cifra' }, x.recuento ?? '—')))),
          ),
          datos([
            ['Encuadre', descripcion.encuadre],
            ['Luz', descripcion.luz],
            ['Defectos', descripcion.defectos?.join(' · ')],
          ]),
        ),
      ),
      h(
        'div',
        {},
        h(
          'div',
          { class: 'bloque' },
          h('h3', {}, 'La toma nueva', propuesta.toma?.otra ? h('span', { class: 'chip chip-ok' }, 'Otra toma') : h('span', { class: 'chip chip-alerta' }, 'Misma toma')),
          h(
            'div',
            { class: 'toma' },
            h('div', { class: 'toma-lado' }, h('span', { class: 'nota' }, 'Ahora'), h('b', {}, `${descripcion.anguloGrados}°`), DISTANCIAS[descripcion.distancia] ?? descripcion.distancia),
            h('span', { class: 'toma-flecha', 'aria-hidden': 'true' }, '→'),
            h('div', { class: 'toma-lado' }, h('span', { class: 'nota' }, 'Nueva'), h('b', {}, `${camara.anguloGrados}°`), DISTANCIAS[camara.distancia] ?? camara.distancia),
          ),
          h('p', {}, camara.descripcion),
          datos([
            ['Óptica', `${camara.objetivoMm} mm · f/${camara.apertura}${camara.giroGrados ? ` · giro ${camara.giroGrados}°` : ''}`],
            ['Cambios', propuesta.toma?.cambios?.join(' · ')],
            ['Luz', huecos.luz],
            ['Idea gráfica', huecos.ideaGrafica],
            ['Color', huecos.colorDominante],
          ]),
          decisiones?.length ? h('details', {}, h('summary', {}, 'Por qué lo decide así'), lista(decisiones)) : null,
        ),
        h('div', { class: 'bloque' }, h('h3', {}, 'Gasto'), presupuesto),
      ),
    ),
    conProblemas ? llamada('Hay que corregirlo antes de confirmar', lista(propuesta.problemas), 'alerta') : null,
    h('details', {}, h('summary', {}, 'Prompt de la foto nueva'), h('pre', {}, propuesta.prompt), botonCopiar(propuesta.prompt, 'Copiar el prompt')),
    h('details', { open: conProblemas }, h('summary', {}, 'Corregir la propuesta'), editorDePropuesta(ctx, propuesta.contenido)),
    h(
      'div',
      { class: 'barra-acciones' },
      h('button', { class: 'primario lanza-trabajo', disabled: conProblemas, onclick: confirmarParada, title: conProblemas ? 'Corrige antes los problemas' : undefined }, 'Confirmar y hacer la foto nueva'),
      h('span', { class: 'nota' }, conProblemas ? 'Con problemas no se puede confirmar.' : 'Te enseño el gasto antes de seguir.'),
    ),
  );
}

function cajasDeGasto(p) {
  const caja = (valor, etiqueta, clase = '') => h('div', { class: clase }, h('b', {}, valor), h('span', {}, etiqueta));
  if (!p.disponible) {
    return [h('p', { class: 'aviso-linea', style: { gridColumn: '1 / -1' } }, `La API no puede generar: ${p.motivo}. Al confirmar, podrás importar una foto hecha a mano.`), caja(usd(p.gastadoUsd), 'gastado en este post')];
  }
  return [
    caja(`≤ ${usd(p.estimadoPorIntentoUsd)}`, 'por intento'),
    caja(String(p.maxIntentos), 'intentos seguidos'),
    caja(usd(p.gastadoUsd), 'gastado en este post'),
    p.tope ? caja(`${Number(p.tope.gastadoUsd).toFixed(2)} / ${Number(p.tope.topeUsd).toFixed(2)}`, `USD del tope (${p.tope.modelo})`) : caja(p.generador, 'generador', 'texto'),
  ];
}

/** Corregir la propuesta: la lista de elementos y los huecos que más se tocan; el resto, en el JSON completo. */
function editorDePropuesta(ctx, original) {
  const propuesta = structuredClone(original);
  const errores = h('div');
  const filas = h('tbody');

  const filaElemento = (x = { nombre: '', estado: '', recuento: null }) => {
    const nombre = h('input', { value: x.nombre, placeholder: 'gamba', 'aria-label': 'Elemento' });
    const estado = h('input', { value: x.estado, placeholder: 'entera, a la brasa', 'aria-label': 'Cómo está' });
    const recuento = h('input', { type: 'number', min: '1', value: x.recuento ?? '', placeholder: '—', style: { width: '4.5rem' }, 'aria-label': 'Número' });
    const fila = h('tr', {}, h('td', {}, nombre), h('td', {}, estado), h('td', {}, recuento), h('td', {}, h('button', { type: 'button', class: 'secundario pequeno', onclick: () => fila.remove() }, 'Quitar')));
    fila.leer = () => ({ nombre: nombre.value.trim(), estado: estado.value.trim(), recuento: recuento.value ? Number(recuento.value) : null });
    filas.append(fila);
  };
  propuesta.descripcion.elementos.forEach(filaElemento);

  const area = (valor, filasTexto = 2) => h('textarea', { rows: String(filasTexto), value: valor });
  const elementosEn = area(propuesta.huecos.elementos, 3);
  const recuentoEn = h('input', { value: propuesta.huecos.recuento });
  const angulo = h('input', { type: 'number', min: '-45', max: '90', value: propuesta.huecos.camara.anguloGrados });
  const distancia = h('select', {}, Object.entries(DISTANCIAS).map(([valor, texto]) => h('option', { value: valor, selected: propuesta.huecos.camara.distancia === valor }, texto)));
  const camara = area(propuesta.huecos.camara.descripcion);
  const luz = area(propuesta.huecos.luz);
  const idea = area(propuesta.huecos.ideaGrafica);
  const campo = (etiqueta, control, ayuda) => h('label', { class: 'campo' }, h('span', {}, etiqueta), control, ayuda ? h('small', {}, ayuda) : null);

  const guardar = (evento) =>
    conBoton(evento.currentTarget, async () => {
      reemplazar(errores);
      propuesta.descripcion.elementos = [...filas.children].map((fila) => fila.leer()).filter((x) => x.nombre);
      Object.assign(propuesta.huecos, { elementos: elementosEn.value.trim(), recuento: recuentoEn.value.trim(), luz: luz.value.trim(), ideaGrafica: idea.value.trim() });
      Object.assign(propuesta.huecos.camara, { anguloGrados: Number(angulo.value), distancia: distancia.value, descripcion: camara.value.trim() });
      await enviarPropuesta(ctx, propuesta, errores);
    });

  return h(
    'div',
    { class: 'formulario', style: { maxWidth: 'none' } },
    h('p', { class: 'nota' }, 'La lista es lo que la comprobación de salida busca en la foto nueva. Los textos de la toma van en inglés: son el prompt, que vuelve a montar el código.'),
    h(
      'table',
      { class: 'tabla' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Elemento'), h('th', {}, 'Cómo está'), h('th', {}, 'Nº'), h('th', {}))),
      filas,
    ),
    h('button', { type: 'button', class: 'secundario pequeno', onclick: () => filaElemento() }, 'Añadir elemento'),
    h('div', { class: 'dos-columnas', style: { marginTop: '1rem' } }, h('div', {}, campo('Elementos (prompt)', elementosEn), campo('Recuento (prompt)', recuentoEn, 'Por ejemplo: «Exactly one plate.»')), h('div', {}, campo('Ángulo de la cámara (°)', angulo, '0 = a ras de mesa · 90 = cenital'), campo('Distancia', distancia), campo('Cámara (prompt)', camara))),
    h('div', { class: 'dos-columnas' }, campo('Luz (prompt)', luz), campo('Idea gráfica (prompt)', idea)),
    errores,
    h('div', { class: 'acciones' }, h('button', { type: 'button', onclick: guardar }, 'Guardar la corrección')),
    h('details', {}, h('summary', {}, 'Editar el JSON completo'), editorJsonDePropuesta(ctx, original)),
  );
}

function editorJsonDePropuesta(ctx, contenido) {
  const errores = h('div');
  const texto = h('textarea', { class: 'codigo', spellcheck: 'false', wrap: 'off', value: JSON.stringify(contenido ?? {}, null, 2) });
  const guardar = (evento) =>
    conBoton(evento.currentTarget, async () => {
      reemplazar(errores);
      let propuesta;
      try {
        propuesta = JSON.parse(texto.value);
      } catch (error) {
        return reemplazar(errores, bloqueError({ message: `No es JSON válido: ${error.message}` }));
      }
      await enviarPropuesta(ctx, propuesta, errores);
    });
  return h('div', {}, texto, errores, h('div', { class: 'acciones' }, h('button', { type: 'button', onclick: guardar }, 'Guardar el JSON')));
}

async function enviarPropuesta(ctx, propuesta, errores) {
  try {
    const r = await api('PUT', `/encargos/${ctx.proyecto}/propuesta`, { propuesta });
    avisar(r.problemas.length ? `Guardada, con ${r.problemas.length} problema(s) por corregir.` : 'Propuesta corregida: cumple la plantilla.', r.problemas.length ? 'info' : 'ok');
    await ctx.recargar();
  } catch (error) {
    reemplazar(errores, bloqueError(error));
  }
}

// ---------------------------------------------------------------- Foto hecha a mano

function panelImportar(ctx) {
  const { d, urls } = ctx;
  const archivo = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', style: { position: 'absolute', inset: '0', opacity: '0', cursor: 'pointer' } });
  const estado = h('p', { class: 'nota' });
  archivo.addEventListener('change', async () => {
    const elegido = archivo.files?.[0];
    if (!elegido) return;
    estado.textContent = 'Subiendo…';
    try {
      const subida = await subirArchivo(elegido);
      estado.textContent = 'Subida. Comprobando la foto…';
      await ctx.avanzar(null, { importar: subida.id });
    } catch (error) {
      estado.textContent = '';
      avisar(error.message, 'error');
    }
  });
  const prompt = d.propuesta?.prompt ?? '';
  return panel(
    'importar',
    cabeza({ sobretitulo: 'Fase 3', titulo: 'Haz la foto nueva a mano', entrada: 'La orden no puede generarla por la API. Hazla fuera y súbela: entra como un intento más y pasa la misma comprobación.' }),
    llamada('Por qué', d.espera.motivo),
    h(
      'ol',
      {},
      h('li', {}, 'Copia el prompt.'),
      h('li', {}, 'Genera la imagen adjuntando ', h('a', { href: urls.subida(), target: '_blank' }, 'la foto subida'), ' como @image1, a 3:4 y 2K.'),
      h('li', {}, 'Súbela aquí.'),
    ),
    h('pre', {}, prompt),
    h('div', { class: 'acciones' }, botonCopiar(prompt, 'Copiar el prompt'), h('a', { class: 'boton secundario pequeno', href: `${urls.subida()}?descargar` }, 'Descargar la foto subida')),
    h('div', { class: 'barra-acciones' }, h('label', { class: 'boton primario lanza-trabajo', style: { position: 'relative', overflow: 'hidden' } }, 'Subir la foto hecha a mano', archivo), estado),
  );
}

// ---------------------------------------------------------------- Parada 2: la foto nueva

function panelFoto(ctx) {
  const { d, urls } = ctx;
  const ultimo = d.intentos.at(-1);
  const revision = ultimo?.revision;
  const max = d.encargo.autorizacion?.maxIntentos ?? d.generador.maxIntentos;
  // Descartes seguidos antes de este intento: si lo rechazas, ¿queda otro autorizado?
  let previos = 0;
  for (const intento of d.intentos.slice(0, -1).reverse()) {
    if (intento.final === 'DESCARTA' || intento.final === 'RECHAZADA') previos++;
    else break;
  }
  const quedaOtro = previos + 1 < max;

  const motivo = h('textarea', { rows: '2', maxlength: '300', placeholder: 'Qué falla: «sobra una gamba», «es la misma toma», «la salsa no es la del plato»…' });
  const zonaRechazo = h(
    'div',
    { class: 'bloque', hidden: true },
    h('h3', {}, 'Rechazar la foto'),
    motivo,
    h('p', { class: 'nota' }, quedaOtro ? `Se hará otra foto (intento ${d.intentos.length + 1}) dentro de lo que autorizaste.` : 'Es el último intento autorizado: la orden se parará y volverás a la parada de elementos.'),
    h(
      'div',
      { class: 'acciones' },
      h(
        'button',
        {
          class: 'peligro lanza-trabajo',
          onclick: (evento) => {
            if (motivo.value.trim().length < 3) return avisar('Di por qué la rechazas (mínimo 3 caracteres).', 'error');
            ctx.avanzar(evento.currentTarget, { rechazo: motivo.value.trim() });
          },
        },
        quedaOtro ? 'Rechazar y probar otra' : 'Rechazar',
      ),
      h('button', { class: 'secundario', onclick: () => (zonaRechazo.hidden = true) }, 'Cancelar'),
    ),
  );

  const checklist = revision?.respuestas?.checklist;
  const toma = revision?.respuestas?.toma;
  const siNo = (valor) => (valor ? 'sí' : 'no');

  return panel(
    'foto',
    cabeza({ sello: '■ Parada 2', titulo: '¿Es el mismo plato, con otra toma?', entrada: 'Compara las dos fotos. La comprobación automática solo filtra: tu decisión manda.' }),
    h(
      'div',
      { class: 'comparar' },
      h('figure', {}, h('figcaption', {}, 'Foto subida', h('span', { class: 'nota' }, `${d.fotoSubida.ancho} × ${d.fotoSubida.alto}`)), h('a', { href: urls.subida(), target: '_blank' }, h('img', { src: urls.subida(1080), alt: 'Foto subida' }))),
      h(
        'figure',
        {},
        h('figcaption', {}, `Foto nueva · intento ${ultimo.n}`, h('span', { class: 'chips' }, ultimo.importada ? h('span', { class: 'chip' }, 'Importada') : null, chipVeredicto(ultimo.final))),
        h('a', { href: urls.activo(ultimo.activo), target: '_blank' }, h('img', { src: urls.activo(ultimo.activo, 1080), alt: `Foto nueva, intento ${ultimo.n}` })),
      ),
    ),
    h(
      'div',
      { class: 'bloque', style: { marginTop: '1rem' } },
      h('h3', {}, 'Comprobación automática', revision ? h('span', { class: 'nota' }, revision.revisor) : null),
      ultimo.motivos.length ? lista(ultimo.motivos) : h('p', { class: 'nota' }, ultimo.final === 'PASA' ? 'No ha visto nada que falte, sobre ni cambie de número. Míralo tú igualmente: lo fino se le escapa.' : 'Sin motivos anotados.'),
      checklist
        ? h(
            'details',
            {},
            h('summary', {}, 'Qué ha mirado'),
            h(
              'table',
              { class: 'tabla' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Elemento'), h('th', {}, 'Esperado'), h('th', {}, 'Visto'), h('th', {}, 'Está'))),
              h('tbody', {}, checklist.elementos.map((x) => h('tr', {}, h('td', {}, x.nombre, x.nota ? h('div', { class: 'nota' }, x.nota) : null), h('td', { class: 'cifra' }, x.esperado ?? '—'), h('td', { class: 'cifra' }, x.visto ?? '—'), h('td', {}, siNo(x.presente))))),
            ),
            datos([
              ['Añadido', checklist.anadidos?.join(' · ')],
              ['Texto nuevo', checklist.textoNuevo?.join(' · ')],
              ['Anatomía', checklist.anatomia?.join(' · ')],
              ['Seguro', siNo(checklist.seguro)],
              ['Altura', toma ? `${toma.alturaReal} → ${toma.alturaNueva}` : null],
              ['Mismo lado', toma ? siNo(toma.mismoLado) : null],
              ['Misma distancia', toma ? siNo(toma.mismaDistancia) : null],
              ['Toma', toma?.explicacion],
            ]),
          )
        : null,
    ),
    d.intentos.length > 1
      ? h(
          'div',
          { class: 'bloque' },
          h('h3', {}, 'Intentos anteriores'),
          h(
            'div',
            { class: 'tira' },
            d.intentos.slice(0, -1).map((i) =>
              h('figure', { class: 'miniatura' }, h('a', { href: urls.activo(i.activo), target: '_blank' }, h('img', { src: urls.activo(i.activo, 320), alt: `Intento ${i.n}`, loading: 'lazy' })), h('figcaption', {}, `Intento ${i.n} · `, chipVeredicto(i.final))),
            ),
          ),
        )
      : null,
    zonaRechazo,
    h(
      'div',
      { class: 'barra-acciones' },
      h('button', { class: 'primario lanza-trabajo', onclick: (e) => ctx.avanzar(e.currentTarget, { confirmo: 'CONFIRMAR_FOTO' }) }, 'Confirmar esta foto'),
      h('button', { class: 'secundario', onclick: () => ((zonaRechazo.hidden = false), motivo.focus()) }, 'Rechazarla…'),
      h('span', { class: 'nota empuja' }, `Intento ${ultimo.n} · ${usd(ultimo.costeUsd)}`),
    ),
  );
}

// ---------------------------------------------------------------- Sin tokens de marca

function panelTokens(ctx) {
  return panel(
    'tokens',
    cabeza({ sobretitulo: 'Fase 4', titulo: 'Falta la marca para el compositor', entrada: 'La foto nueva está confirmada, pero el compositor necesita los colores y estilos del local.' }),
    llamada('Qué falta', h('span', {}, 'El archivo ', h('code', {}, ctx.d.espera.archivo), '. Se escribe a mano desde el perfil de la marca: la web no lo inventa.'), 'alerta'),
    h('div', { class: 'barra-acciones' }, h('button', { class: 'primario lanza-trabajo', onclick: (e) => ctx.avanzar(e.currentTarget) }, 'Ya está: seguir')),
  );
}

// ---------------------------------------------------------------- Diseño: la intención

function panelIntencion(ctx, modo) {
  const { d, urls, proyecto } = ctx;
  const diseno = d.diseno;
  const intencion = diseno.intencion;
  let actual = structuredClone(intencion?.contenido ?? {});
  // Una versión compuesta no se sobrescribe: para corregirla o rehacerla se guarda la siguiente.
  const compuestas = new Set(diseno.versiones.map((v) => v.version));
  if (modo !== 'INTENCION' || compuestas.has(actual.version)) actual.version = diseno.siguienteVersion;

  const texto = h('textarea', { class: 'codigo', spellcheck: 'false', wrap: 'off', value: JSON.stringify(actual, null, 2), 'aria-label': 'Intención de diseño (JSON)' });
  const estadoJson = h('span', { class: 'json-estado bien' }, 'JSON válido');
  const botonGuardar = h('button', { class: 'primario lanza-trabajo' });
  const lienzo = h('div', { class: 'lienzo' }, h('p', { class: 'nota' }, 'Pulsa «Vista previa» para componerla sin guardar nada.'));
  const problemas = h('div');
  const textos = h('div', { class: 'textos-rapidos' });

  const leer = () => {
    try {
      const valor = JSON.parse(texto.value);
      estadoJson.textContent = 'JSON válido';
      estadoJson.className = 'json-estado bien';
      return valor;
    } catch (error) {
      estadoJson.textContent = `No es JSON válido: ${error.message}`;
      estadoJson.className = 'json-estado mal';
      return undefined;
    }
  };
  const pintarBoton = () => {
    const valor = leer();
    botonGuardar.textContent = valor?.version ? `Guardar la versión ${valor.version} y componer` : 'Guardar y componer';
    botonGuardar.disabled = !valor;
  };

  // Los textos de la intención, a mano: los escribe la persona con lo que consta del local (nada inventado).
  const pintarTextos = () => {
    const valor = leer();
    const claves = Object.entries(valor?.textos ?? {}).filter(([, v]) => typeof v === 'string');
    reemplazar(
      textos,
      claves.length ? h('h3', {}, 'Textos') : null,
      claves.map(([clave, v]) => {
        const control = h('input', { value: v, maxlength: '200' });
        control.addEventListener('input', () => {
          const ahora = leer();
          if (!ahora) return;
          ahora.textos[clave] = control.value;
          texto.value = JSON.stringify(ahora, null, 2);
        });
        return h('label', { class: 'campo' }, h('span', {}, clave), control);
      }),
    );
  };
  texto.addEventListener('input', pintarBoton);
  texto.addEventListener('change', pintarTextos);
  pintarBoton();
  pintarTextos();

  const vistaPrevia = (evento) =>
    conBoton(evento.currentTarget, async () => {
      const valor = leer();
      if (!valor) return;
      reemplazar(problemas);
      reemplazar(lienzo, h('p', { class: 'cargando' }, 'Componiendo el borrador…'));
      try {
        const { vista } = await api('POST', `/encargos/${proyecto}/vista-previa`, { intencion: valor });
        reemplazar(lienzo, h('img', { src: `${vista.base}${vista.diseno.split('/').map(encodeURIComponent).join('/')}?v=${vista.sello}`, alt: 'Vista previa del post' }));
        reemplazar(problemas, listaDeProblemas(vista.problemas, vista.contraste));
      } catch (error) {
        reemplazar(lienzo, h('p', { class: 'nota' }, 'No se ha podido componer.'));
        reemplazar(problemas, bloqueError(error));
      }
    });

  botonGuardar.addEventListener('click', (evento) => {
    const valor = leer();
    if (valor) ctx.lanzar(evento.currentTarget, 'PUT', `/encargos/${proyecto}/intencion`, { intencion: valor });
  });

  const titulos = {
    INTENCION: ['Escribe la intención de diseño', 'Qué capas lleva el post, dónde va cada una y con qué estilo. Pruébala con la vista previa antes de guardarla.'],
    COMPOSICION: ['El compositor ha dado errores', 'Corrige la intención y guarda la versión siguiente: una versión compuesta no se sobrescribe.'],
    NUEVA: ['Una versión nueva del diseño', `Se guarda como la versión ${diseno.siguienteVersion}; las anteriores se quedan como están.`],
  };
  const [titulo, entrada] = titulos[modo];

  return panel(
    'intencion',
    modo === 'NUEVA' ? null : cabeza({ sobretitulo: 'Fase 4', titulo, entrada }),
    modo === 'NUEVA' ? h('p', { class: 'nota' }, entrada) : null,
    modo === 'INTENCION' && intencion?.esBorrador
      ? llamada('Esto es un borrador, no un diseño', 'La foto a sangre, un titular y la marca: un punto de partida que compone. Rehazlo desde la ficha de la referencia (qué se toma y qué no se copia). Hasta que el director lo haga solo (F3), la intención la escribe una persona.')
      : null,
    modo === 'COMPOSICION' ? llamada('Errores del compositor', lista(d.espera.errores), 'alerta') : null,
    intencion && !intencion.valida ? h('div', { class: 'error' }, h('strong', {}, `${intencion.archivo} no es válida:`), lista(intencion.errores)) : null,
    h(
      'div',
      { class: 'editor' },
      h(
        'div',
        {},
        textos,
        h('div', { class: 'titulo-seccion', style: { margin: '0.4rem 0' } }, h('h3', { style: { margin: 0 } }, 'Intención (JSON)'), estadoJson),
        texto,
        diseno.fuentes.length
          ? h('details', {}, h('summary', {}, `Fuentes del compositor (${diseno.fuentes.length})`), h('ul', {}, diseno.fuentes.map((f) => h('li', {}, h('code', {}, f.id), ` · ${f.familia}${f.clasificacion.length ? ` · ${f.clasificacion.join(', ')}` : ''}`))))
          : null,
      ),
      h('div', {}, lienzo, problemas, fichaDeReferencia(d.referencia.elegida?.ficha)),
    ),
    h('div', { class: 'barra-acciones' }, h('button', { class: 'secundario', onclick: vistaPrevia }, 'Vista previa'), botonGuardar, h('span', { class: 'nota empuja' }, 'Antes de guardar se compone en borrador: con errores no se guarda.')),
  );
}

function listaDeProblemas(problemas = [], contraste = {}) {
  const bajos = Object.entries(contraste).filter(([, ratio]) => ratio < 4.5);
  if (!problemas.length && !bajos.length) return h('p', { class: 'nota', style: { marginTop: '0.6rem' } }, 'El compositor no da avisos.');
  return h(
    'ul',
    { class: 'problemas' },
    problemas.map((p) => h('li', { class: p.gravedad }, h('strong', {}, p.gravedad === 'ERROR' ? 'Error' : 'Aviso'), ` · ${p.tipo}: ${p.mensaje}`)),
    bajos.map(([capa, ratio]) => h('li', {}, h('strong', {}, 'Contraste'), ` · ${capa}: ${ratio.toFixed(1)}:1 (menos de 4,5:1)`)),
  );
}

// ---------------------------------------------------------------- Resultado

function panelResultado(ctx) {
  const { d, urls } = ctx;
  const diseno = d.diseno;
  const version = diseno.versiones.find((v) => v.version === diseno.vigente) ?? diseno.versiones.at(-1);
  if (!version) {
    return panel('resultado', cabeza({ titulo: 'El encargo está hecho, pero no encuentro el diseño' }), h('p', { class: 'nota' }, 'No hay ninguna versión compuesta en la carpeta de diseños.'));
  }
  const exportadas = [...version.exportadas].sort((a, b) => (a.proporcion === '4:5' ? -1 : b.proporcion === '4:5' ? 1 : 0));
  const imagen = h('img', { alt: `Post compuesto, versión ${version.version}` });
  const pestanas = h('div', { class: 'pestanas', role: 'group', 'aria-label': 'Proporción' });
  const mostrar = (x) => {
    imagen.src = urls.diseno(x.archivo, { sello: version.compuestaEn });
    [...pestanas.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.archivo === x.archivo)));
  };
  exportadas.forEach((x) => pestanas.append(h('button', { type: 'button', 'data-archivo': x.archivo, onclick: () => mostrar(x) }, x.proporcion)));
  if (exportadas[0]) mostrar(exportadas[0]);
  else imagen.src = urls.diseno(version.diseno);

  const MEDIDAS = { '3:4': '1080 × 1440', '4:5': '1080 × 1350', '9:16': '1080 × 1920' };
  const hojas = diseno.hojas.flatMap((hoja) => hoja.archivos);

  return panel(
    'resultado',
    cabeza({ sobretitulo: 'Listo', titulo: 'El post está compuesto', entrada: 'Nada se publica sin tu visto bueno: descárgalo y publícalo a mano.' }),
    h(
      'div',
      { class: 'resultado' },
      h('div', {}, pestanas, h('div', { class: 'resultado-imagen' }, imagen)),
      h(
        'div',
        {},
        h(
          'div',
          { class: 'bloque' },
          h('h3', {}, `Versión ${version.version}`, h('span', { class: 'nota' }, formatearFecha(version.compuestaEn))),
          h(
            'div',
            { class: 'descargas' },
            exportadas.map((x) => h('a', { class: 'boton pequeno', href: urls.descargar(x.archivo) }, `Descargar ${x.proporcion} · ${MEDIDAS[x.proporcion] ?? ''}`)),
            version.svgEditable ? h('a', { class: 'boton secundario pequeno', href: urls.descargar(version.svgEditable) }, 'SVG editable') : null,
          ),
          listaDeProblemas(version.problemas, version.contraste),
        ),
        hojas.length
          ? h(
              'div',
              { class: 'bloque' },
              h('h3', {}, 'Hojas de revisión'),
              h('div', { class: 'hojas' }, hojas.map((archivo) => h('a', { href: urls.diseno(archivo), target: '_blank', title: archivo }, h('img', { src: urls.diseno(archivo, { lado: 640, sello: version.compuestaEn }), alt: archivo, loading: 'lazy' })))),
            )
          : null,
        diseno.versiones.length > 1
          ? h(
              'div',
              { class: 'bloque' },
              h('h3', {}, 'Versiones'),
              h(
                'div',
                { class: 'hojas' },
                [...diseno.versiones].reverse().map((v) =>
                  h(
                    'a',
                    { href: urls.diseno(v.diseno), target: '_blank', title: `v${v.version}` },
                    h('img', { src: urls.diseno(v.diseno, { lado: 320, sello: v.compuestaEn }), alt: `Versión ${v.version}`, loading: 'lazy' }),
                    h('span', { class: 'nota' }, `v${v.version}${v.version === diseno.vigente ? ' · vigente' : ''}${v.problemas.some((p) => p.gravedad === 'ERROR') ? ' · con errores' : ''}`),
                  ),
                ),
              ),
            )
          : null,
      ),
    ),
    h('details', { style: { marginTop: '1.2rem' } }, h('summary', {}, 'Hacer una versión nueva del diseño'), panelIntencion(ctx, 'NUEVA')),
  );
}
