// Pantalla de una pieza: conceptos → plan → imágenes (versiones, votos, cambios, importar) → exportar.
// Los trabajos largos se siguen con un panel de progreso que sobrevive a recargar la página.
import { api, seguirTrabajo, subirArchivo } from '../api.js';
import { camposExtra, confirmarGasto, muestraDeColor, panelDeTrabajo } from '../componentes.js';
import { avisar, conBoton, h, nombre, reemplazar } from '../ui.js';

const CAMPOS_CONCEPTO = ['titulo', 'mecanismo', 'fotografia', 'tipografia', 'textos', 'porQue'];
const CAMPOS_DIAPOSITIVA = ['posicion', 'funcion', 'textos', 'fotos', 'prompt'];
const CAMPOS_PLAN = ['diapositivas', 'pie', 'hashtags', 'textoAlt'];
const ESTADOS = { COMPLETADA: 'lista', ENVIADA: 'en curso', FALLIDA: 'fallida', PENDIENTE_MANUAL: 'pendiente de importar' };

export async function vistaPieza(id) {
  const nodo = h('div', { class: 'pieza' });
  const panel = h('div', { class: 'panel-trabajo' });
  let detalle;
  let siguiendo = null;
  let fuera = false;

  const url = (archivo) => detalle.base + archivo.split('/').map(encodeURIComponent).join('/');

  async function recargar() {
    detalle = await api('GET', `/piezas/${id}`);
    pintar();
  }

  function pintar() {
    const { pieza } = detalle;
    reemplazar(
      nodo,
      cabecera(),
      panel,
      seccionConceptos(),
      pieza.plan ? seccionPlan() : null,
      pieza.plan ? seccionImagenes() : null,
      pieza.plan ? seccionExportar() : null,
    );
    nodo.classList.toggle('ocupada', detalle.trabajo?.estado === 'EN_CURSO');
    if (detalle.trabajo?.estado === 'EN_CURSO') seguir(detalle.trabajo);
  }

  /** Sigue un trabajo hasta que termina; después recarga la pieza. */
  async function seguir(trabajo) {
    if (siguiendo === trabajo.id) return;
    siguiendo = trabajo.id;
    nodo.classList.add('ocupada');
    reemplazar(panel, panelDeTrabajo(trabajo));
    try {
      const final = await seguirTrabajo(trabajo.id, (t) => reemplazar(panel, panelDeTrabajo(t)), () => fuera);
      if (fuera) return;
      if (final.estado === 'ERROR') avisar(final.error?.message ?? 'El trabajo ha fallado.', 'error');
      else {
        avisar('Listo.', 'ok');
        reemplazar(panel);
      }
    } catch (error) {
      avisar(error.message, 'error');
    } finally {
      siguiendo = null;
    }
    if (!fuera) await recargar();
  }

  /** Lanza un trabajo largo desde un botón y empieza a seguirlo. */
  async function lanzar(boton, metodo, ruta, cuerpo) {
    const respuesta = await conBoton(boton, () => api(metodo, ruta, cuerpo));
    if (respuesta?.trabajo) seguir(respuesta.trabajo);
  }

  /** Pide el presupuesto y, si es por la API, confirma el gasto en un modal. */
  async function autorizar(boton, consulta, accion) {
    const respuesta = await conBoton(boton, () => api('GET', `/piezas/${id}/presupuesto?${consulta}`));
    if (!respuesta) return false;
    if (respuesta.presupuesto.origen === 'SIMULADO') return true;
    return confirmarGasto(respuesta.presupuesto, { accion });
  }

  // ---------------------------------------------------------------- Secciones

  function cabecera() {
    const { pieza, marca } = detalle;
    return h(
      'section',
      { class: 'resumen' },
      h('p', { class: 'nota' }, h('a', { href: '#/piezas' }, '← Piezas'), ` · ${marca?.nombre ?? pieza.localSlug} · ${nombre(pieza.formato)} de ${pieza.numDiapositivas} · ${nombre(pieza.tipo)}`),
      h('h1', {}, pieza.idea),
      Object.values(pieza.condiciones ?? {}).some(Boolean)
        ? h('p', { class: 'nota' }, 'Condiciones: ', Object.entries(pieza.condiciones).map(([k, v]) => `${k}: ${v}`).join(' · '))
        : null,
      h(
        'div',
        { class: 'tira' },
        pieza.fotos.map((foto) => miniatura(url(foto.archivo), `${nombre(foto.papel)}${foto.nota ? ` · ${foto.nota}` : ''}`)),
        pieza.referenciaEstilo ? miniatura(url(pieza.referenciaEstilo.archivo), 'Referencia de estilo', 'referencia') : null,
      ),
      marca?.colores?.length ? h('p', { class: 'nota' }, 'Marca: ', marca.colores.map((c) => muestraDeColor(c.hex))) : null,
    );
  }

  function seccionConceptos() {
    const { pieza } = detalle;
    const bloqueado = pieza.generaciones.length > 0;
    const proponer = (evento) => lanzar(evento.currentTarget, 'POST', `/piezas/${id}/conceptos`);

    if (pieza.conceptos.length === 0) {
      return h(
        'section',
        {},
        h('h2', {}, '1 · Conceptos'),
        h('p', {}, 'El director creativo mira tus fotos y propone 3 conceptos distintos. Tú eliges uno.'),
        h('button', { class: 'lanza-trabajo', onclick: proponer }, 'Proponer conceptos'),
      );
    }

    const tarjeta = (concepto, i) => {
      const elegido = pieza.conceptoElegido?.titulo === concepto.titulo && JSON.stringify(pieza.conceptoElegido) === JSON.stringify(concepto);
      return h(
        'article',
        { class: `tarjeta concepto${elegido ? ' elegido' : ''}` },
        h('h3', {}, `${i + 1}. ${concepto.titulo}`),
        h('dl', {}, [
          [h('dt', {}, 'Mecanismo'), h('dd', {}, concepto.mecanismo)],
          [h('dt', {}, 'Foto'), h('dd', {}, concepto.fotografia)],
          [h('dt', {}, 'Tipografía'), h('dd', {}, concepto.tipografia)],
          [h('dt', {}, 'Textos'), h('dd', {}, concepto.textos.map((t) => `«${t}»`).join(' · '))],
        ]),
        camposExtra(concepto, CAMPOS_CONCEPTO),
        h('p', { class: 'nota' }, concepto.porQue),
        elegido
          ? h('span', { class: 'insignia insignia-lista' }, 'Elegido')
          : h(
              'button',
              {
                class: 'lanza-trabajo',
                disabled: bloqueado,
                title: bloqueado ? 'La pieza ya tiene imágenes de otro plan: crea una pieza nueva para cambiar de concepto' : undefined,
                onclick: (evento) => lanzar(evento.currentTarget, 'POST', `/piezas/${id}/plan`, { concepto: i + 1 }),
              },
              'Elegir este',
            ),
      );
    };

    const todos = pieza.conceptos.map(tarjeta);
    const recientes = todos.slice(-3);
    const anteriores = todos.slice(0, -3);
    return h(
      'section',
      {},
      h('div', { class: 'titulo-seccion' }, h('h2', {}, '1 · Conceptos'), bloqueado ? null : h('button', { class: 'secundario lanza-trabajo', onclick: proponer }, 'Otros 3')),
      h('div', { class: 'rejilla' }, recientes),
      anteriores.length ? h('details', {}, h('summary', {}, `Conceptos anteriores (${anteriores.length})`), h('div', { class: 'rejilla' }, anteriores)) : null,
    );
  }

  function seccionPlan() {
    const { pieza } = detalle;
    const { plan } = pieza;
    return h(
      'section',
      {},
      h('div', { class: 'titulo-seccion' }, h('h2', {}, `2 · Plan${pieza.conceptoElegido ? `: ${pieza.conceptoElegido.titulo}` : ''}`), h('a', { href: url('plan.md'), target: '_blank' }, 'Abrir plan.md')),
      camposExtra(plan, CAMPOS_PLAN),
      plan.diapositivas.map((d) =>
        h(
          'article',
          { class: 'tarjeta diapositiva-plan' },
          h('h3', {}, `${d.posicion}. ${d.funcion}`),
          h('p', {}, 'Textos: ', d.textos.length ? d.textos.map((t) => h('span', { class: 'texto-imagen' }, `«${t}»`)) : '(sin texto)'),
          camposExtra(d, CAMPOS_DIAPOSITIVA),
          h('div', { class: 'tira pequena' }, d.fotos.map((archivo, i) => miniatura(url(archivo), `Image ${i + 1}`))),
          h('details', {}, h('summary', {}, 'Prompt'), h('pre', {}, d.prompt)),
        ),
      ),
      h('div', { class: 'tarjeta' }, h('h3', {}, 'Pie de publicación'), h('p', { class: 'pie' }, plan.pie), h('p', { class: 'nota' }, plan.hashtags.join(' ')), h('p', { class: 'nota' }, `Texto alternativo: ${plan.textoAlt}`)),
    );
  }

  function seccionImagenes() {
    const { pieza } = detalle;
    const completadas = (n) => pieza.generaciones.filter((g) => g.diapositiva === n && g.estado === 'COMPLETADA');
    const sinImagen = pieza.plan.diapositivas.map((d) => d.posicion).filter((n) => completadas(n).length === 0);
    const aMedias = pieza.generaciones.some((g) => g.estado === 'ENVIADA');

    const generar = async (evento, diapositivas) => {
      const boton = evento.currentTarget;
      const consulta = `accion=generar${diapositivas ? `&diapositivas=${diapositivas.join(',')}` : ''}`;
      if (await autorizar(boton, consulta, 'generar')) lanzar(boton, 'POST', `/piezas/${id}/generar`, { diapositivas, confirmado: true });
    };

    const botones = [];
    if (sinImagen.includes(1) && pieza.plan.diapositivas.length > 1) {
      botones.push(h('button', { class: 'lanza-trabajo', onclick: (e) => generar(e, [1]) }, 'Generar la portada'));
      botones.push(h('button', { class: 'secundario lanza-trabajo', onclick: (e) => generar(e) }, `Generar todas (${sinImagen.length})`));
    } else if (sinImagen.length > 0 || aMedias) {
      botones.push(h('button', { class: 'lanza-trabajo', onclick: (e) => generar(e) }, sinImagen.length ? `Generar las que faltan (${sinImagen.length})` : 'Retomar las que quedaron a medias'));
    }

    return h(
      'section',
      {},
      h('h2', {}, '3 · Imágenes'),
      h(
        'p',
        { class: 'nota' },
        'Primero la portada: las demás la llevan como referencia para que el carrusel sea coherente. ',
        'Para generar a mano con Nano Banana Pro, sigue ',
        h('a', { href: url('plan.md'), target: '_blank' }, 'plan.md'),
        ' e importa la imagen en su diapositiva.',
      ),
      botones.length ? h('div', { class: 'acciones' }, botones) : null,
      pieza.plan.diapositivas.map((d) => bloqueDeDiapositiva(d)),
    );
  }

  function bloqueDeDiapositiva(diapositiva) {
    const { pieza } = detalle;
    const n = diapositiva.posicion;
    const info = detalle.diapositivas.find((d) => d.posicion === n);
    const versiones = pieza.generaciones.filter((g) => g.diapositiva === n).reverse();
    const ultimaLista = versiones.find((g) => g.estado === 'COMPLETADA');
    const sinCambios = info.correccionesUsadas >= info.maxCorrecciones;

    // Pedir cambio
    const comentario = h('textarea', { rows: '2', maxlength: '300', placeholder: 'Qué cambiar: «el texto se lee mal, más grande», «la carne parece de plástico»…' });
    const manual = h('input', { type: 'checkbox' });
    const pedirCambio = async (evento) => {
      const boton = evento.currentTarget;
      if (comentario.value.trim().length < 3) return avisar('Escribe qué quieres cambiar (mínimo 3 caracteres).', 'error');
      if (!manual.checked && !(await autorizar(boton, `accion=corregir&diapositiva=${n}`, 'corregir'))) return;
      lanzar(boton, 'POST', `/piezas/${id}/diapositivas/${n}/corregir`, { comentario: comentario.value.trim(), manual: manual.checked, confirmado: true });
    };

    // Importar una imagen hecha a mano
    const importar = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    importar.addEventListener('change', async () => {
      const archivo = importar.files?.[0];
      if (!archivo) return;
      try {
        const subida = await subirArchivo(archivo);
        await api('POST', `/piezas/${id}/diapositivas/${n}/importar`, { subidaId: subida.id });
        avisar(`Imagen importada en la diapositiva ${n}.`, 'ok');
        await recargar();
      } catch (error) {
        avisar(error.message, 'error');
      }
    });

    return h(
      'article',
      { class: 'tarjeta diapositiva' },
      h('h3', {}, `Diapositiva ${n} · ${diapositiva.funcion}`),
      versiones.length === 0 ? h('p', { class: 'nota' }, 'Aún sin imagen.') : h('div', { class: 'versiones' }, versiones.map((g) => tarjetaDeVersion(g, info))),
      h(
        'details',
        { class: 'cambio' },
        h('summary', {}, `Pedir cambio (${info.correccionesUsadas}/${info.maxCorrecciones} usados)`),
        sinCambios
          ? h('p', { class: 'nota' }, 'Esta diapositiva ya no admite más cambios.')
          : !ultimaLista
            ? h('p', { class: 'nota' }, 'Genera o importa antes una imagen.')
            : [
                comentario,
                h('label', { class: 'casilla' }, manual, ' Lo genero a mano (Nano Banana Pro): dame solo el prompt'),
                h('button', { class: 'lanza-trabajo', onclick: pedirCambio }, 'Pedir cambio'),
              ],
      ),
      h('details', { class: 'importar' }, h('summary', {}, 'Importar una imagen hecha a mano'), importar),
    );
  }

  function tarjetaDeVersion(g, info) {
    const elegida = info.versionElegida === g.version;
    const votar = (veredicto) => {
      const motivo = h('input', { maxlength: '300', placeholder: veredicto === 'GUSTA' ? '¿Qué funciona? (lo aprende el director)' : '¿Qué falla? (lo aprende el director)' });
      const enviar = (evento) =>
        conBoton(evento.currentTarget, async () => {
          await api('POST', `/piezas/${id}/diapositivas/${g.diapositiva}/valorar`, { veredicto, motivo: motivo.value.trim(), version: g.version });
          avisar('Anotado en la biblioteca.', 'ok');
          await recargar();
        });
      reemplazar(zonaVoto, motivo, h('button', { onclick: enviar }, 'Guardar'), h('button', { class: 'secundario', onclick: () => reemplazar(zonaVoto, botonesVoto()) }, 'Cancelar'));
      motivo.focus();
    };
    const botonesVoto = () => [h('button', { class: 'secundario', onclick: () => votar('GUSTA') }, 'Me gusta'), h('button', { class: 'secundario', onclick: () => votar('NO_GUSTA') }, 'No me gusta')];
    const zonaVoto = h('div', { class: 'voto' }, g.estado === 'COMPLETADA' ? botonesVoto() : null);

    return h(
      'div',
      { class: `version version-${g.estado.toLowerCase()}${elegida ? ' elegida' : ''}` },
      g.archivo ? h('a', { href: url(g.archivo), target: '_blank' }, h('img', { src: url(g.archivo), alt: `Versión ${g.version}`, loading: 'lazy' })) : h('div', { class: 'sin-imagen' }, ESTADOS[g.estado]),
      h('p', {}, h('strong', {}, `v${g.version}`), ` · ${ESTADOS[g.estado] ?? g.estado}`, elegida ? ' · se exporta' : ''),
      h('p', { class: 'nota' }, g.modelo),
      g.comentario ? h('p', { class: 'nota' }, `Cambio: «${g.comentario}»`) : null,
      g.error ? h('p', { class: 'error' }, g.error) : null,
      g.valoracion ? h('p', { class: `insignia ${g.valoracion.veredicto === 'GUSTA' ? 'insignia-lista' : 'insignia-no'}` }, `${g.valoracion.veredicto === 'GUSTA' ? 'Gusta' : 'No gusta'}: ${g.valoracion.motivo}`) : null,
      g.estado === 'PENDIENTE_MANUAL' ? pendienteManual(g) : null,
      zonaVoto,
    );
  }

  /** Corrección para hacer a mano: el prompt y las imágenes en orden. */
  function pendienteManual(g) {
    const copiar = () =>
      navigator.clipboard.writeText(g.prompt).then(
        () => avisar('Prompt copiado.', 'ok'),
        () => avisar('No he podido copiar: selecciona el texto a mano.', 'error'),
      );
    return h(
      'div',
      { class: 'manual' },
      h('p', {}, 'Genera en la web de Higgsfield con este prompt y adjunta en este orden; después impórtala abajo.'),
      h('div', { class: 'tira pequena' }, g.referencias.map((archivo, i) => miniatura(url(archivo), `Image ${i + 1}`))),
      h('details', { open: true }, h('summary', {}, 'Prompt'), h('pre', {}, g.prompt)),
      h('button', { class: 'secundario', onclick: copiar }, 'Copiar prompt'),
    );
  }

  function seccionExportar() {
    const { pieza } = detalle;
    const resultado = h('div');
    const listas = pieza.plan.diapositivas.every((d) => pieza.generaciones.some((g) => g.diapositiva === d.posicion && g.estado === 'COMPLETADA'));
    const exportar = (evento) =>
      conBoton(evento.currentTarget, async () => {
        const { archivos, sinAprobar } = await api('POST', `/piezas/${id}/exportar`);
        reemplazar(
          resultado,
          sinAprobar.length ? h('p', { class: 'aviso-linea' }, `Sin «me gusta» en las diapositivas ${sinAprobar.join(', ')}: se ha usado su última versión.`) : null,
          // Miniaturas solo de la proporción de diseño (3:4 o 9:16); la 4:5 es la misma recortada.
          h('div', { class: 'tira' }, archivos.filter((a) => a.archivo.endsWith('.jpg') && !a.archivo.includes('/4x5/')).map((a) => h('a', { href: `${a.url}?descargar`, title: 'Descargar' }, h('img', { src: `${a.url}?v=${Date.now()}`, alt: a.archivo })))),
          h('ul', {}, archivos.map((a) => h('li', {}, h('a', { href: `${a.url}?descargar` }, `Descargar ${a.archivo.replace('exportadas/', '').replace('3x4/', '3:4 · ').replace('4x5/', '4:5 · ').replace('9x16/', '9:16 · ')}`)))),
        );
      });
    return h(
      'section',
      {},
      h('h2', {}, '4 · Exportar'),
      h('p', { class: 'nota' }, `Se usa la última versión que te gustó de cada diapositiva (o la última si no votaste), ${pieza.formato === 'HISTORIA' ? 'a 1080 × 1920' : 'a 1080 × 1440 (3:4) y también a 1080 × 1350 (4:5, recortando 45 px arriba y abajo)'}, con el pie en pie.txt.`),
      h('button', { disabled: !listas, title: listas ? undefined : 'Faltan imágenes', onclick: exportar }, 'Exportar'),
      resultado,
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

function miniatura(src, pie, clase = '') {
  return h('figure', { class: `miniatura ${clase}` }, h('a', { href: src, target: '_blank' }, h('img', { src, alt: pie, loading: 'lazy' })), h('figcaption', {}, pie));
}
