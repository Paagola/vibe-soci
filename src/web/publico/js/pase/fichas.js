import { api, subirArchivo } from '../api.js';
import { urlDeBiblioteca, usd } from '../orden.js';
import { avisar, bloqueError, h, reemplazar } from '../ui.js';
import { editorDePropuesta, editorJsonDePropuesta, panelDeEspera, panelIntencion } from '../vistas/paneles.js';

const FOTOS = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;
const CAMARAS = { GENERAL: 'General', MEDIO: 'Plano medio', PRIMER_PLANO: 'Primer plano', MACRO: 'Macro' };
const VEREDICTOS = { PASA: 'Pasa la revisión', REVISAR: 'Revisión manual', DESCARTA: 'Descartada', RECHAZADA: 'Rechazada', PENDIENTE: 'Pendiente de revisar' };
const DICTAMENES = { APROBADA: 'Revisión editorial aprobada', CORREGIDA: 'Composición corregida tras la revisión', REVISION_HUMANA: 'Requiere revisión humana' };
const etiqueta = (texto, control, detalle) => h('label', { class: 'campo' }, h('span', {}, texto), control, detalle ? h('small', { class: 'muted' }, detalle) : null);
const opcion = (valor, nombre, seleccionado) => h('option', { value: valor, selected: seleccionado }, nombre);
const detalles = (nombre, ...nodos) => h('details', {}, h('summary', {}, nombre), ...nodos);
const titulo = (texto) => h('h2', { id: 'ficha-titulo' }, texto);
const nota = (texto) => texto ? h('p', { class: 'muted' }, texto) : null;
const lista = (textos) => textos?.length ? h('ul', {}, textos.map((x) => h('li', {}, x))) : null;
const aviso = (texto) => texto ? h('p', { class: 'aviso-linea', 'data-alerta': true }, texto) : null;
const boton = (texto, onclick, primario = false, disabled = false) => h('button', { type: 'button', class: primario ? 'primario' : '', disabled, onclick }, texto);
const accion = (...nodos) => h('div', { class: 'acciones' }, nodos);
const enlace = (texto, href, attrs = {}) => h('a', { class: 'boton', href, ...attrs }, texto);
const avanzar = (ctx, texto, cuerpo = {}, disabled = false) => boton(texto, (e) => ctx.avanzar(e.currentTarget, cuerpo), true, disabled || ctx.ocupada);
const par = (pares) => h('dl', { class: 'datos' }, pares.filter(([, valor]) => valor !== undefined && valor !== null && valor !== '').flatMap(([nombre, valor]) => [h('dt', {}, nombre), h('dd', {}, valor)]));

function foto(url, grande, alt, pie) {
  if (!url) return null;
  const imagen = h('img', { src: url, alt });
  imagen.addEventListener('error', () => reemplazar(figura, nota('La imagen ya no está disponible.')));
  const figura = h('figure', { class: 'foto-ficha' }, h('a', { href: grande, target: '_blank', rel: 'noopener' }, imagen), pie ? h('figcaption', {}, pie) : null);
  return figura;
}

function subirA(archivo) {
  if (!archivo) throw new Error('Elige una imagen.');
  if (archivo.size > MAX_BYTES) throw new Error('La imagen supera los 10 MB.');
  return subirArchivo(archivo);
}

export function fichaDeSubida(ctx) {
  if (!ctx.locales.length) return [titulo('Añade un local'), nota('Cada encargo usa el perfil de su local.'), accion(ctx.simulado ? boton('Usar el local de ejemplo', (e) => ctx.crearLocalDeEjemplo(e.currentTarget), true) : null, enlace('Dar de alta un local', '/index.html#/local'))];
  const local = h('select', { name: 'local', required: true }, ctx.locales.map((l) => opcion(l.slug, l.nombre)));
  const formato = h('select', { name: 'formato' }, opcion('post', 'Post'), opcion('carrusel', 'Carrusel'));
  const uso = h('select', { name: 'uso' }, opcion('PUBLICABLE', 'Foto del local'), opcion('SOLO_PRUEBA_COMPOSICION', 'Solo para una prueba'));
  const estetica = h('select', { name: 'estetica' }, opcion('', 'A partir de la referencia'), [
    ['EDITORIAL_SERENO', 'Editorial sereno'], ['EDITORIAL_OSCURO', 'Editorial oscuro'], ['COLOR_POP', 'Color pop'],
    ['MAXIMALISMO', 'Maximalismo'], ['MEDITERRANEO_LUMINOSO', 'Mediterráneo luminoso'], ['RUSTICO_FUEGO', 'Rústico de fuego'],
  ].map(([valor, nombre]) => opcion(valor, nombre)));
  const nombre = h('input', { name: 'plato', required: true, minlength: '3', maxlength: '300', placeholder: 'Ej. Gamba roja a la brasa' });
  const archivo = h('input', { type: 'file', accept: FOTOS, 'aria-label': 'Foto original' });
  const preview = h('div');
  const errores = h('div', { role: 'status' });
  const zona = h('div', { class: 'subida' }, preview, etiqueta('Foto original', archivo, 'Suelta la foto aquí o elige un archivo. JPG, PNG o WebP de hasta 10 MB.'));
  let fichero;
  let blob;
  function elegir(nuevo) {
    if (!nuevo) return;
    reemplazar(errores);
    if (blob) URL.revokeObjectURL(blob);
    fichero = undefined;
    blob = undefined;
    reemplazar(preview);
    if (nuevo.size > MAX_BYTES) return reemplazar(errores, bloqueError({ message: 'La imagen supera los 10 MB.' }));
    fichero = nuevo;
    blob = URL.createObjectURL(nuevo);
    const url = blob;
    reemplazar(preview, h('img', { src: url, alt: 'Vista previa de la foto original', onload: () => URL.revokeObjectURL(url), onerror: () => URL.revokeObjectURL(url) }));
  }
  archivo.addEventListener('change', () => elegir(archivo.files[0]));
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.dataset.arrastre = ''; });
  zona.addEventListener('dragleave', () => delete zona.dataset.arrastre);
  zona.addEventListener('drop', (e) => { e.preventDefault(); delete zona.dataset.arrastre; elegir(e.dataTransfer.files[0]); });
  const form = h('form', {}, zona, etiqueta('Local', local), etiqueta('Plato', nombre), etiqueta('Formato', formato), detalles('Uso y estética', etiqueta('Uso de la imagen', uso), etiqueta('Estética', estetica)), errores,
    h('button', { type: 'submit', class: 'primario' }, 'Crear encargo'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    reemplazar(errores);
    ctx.enviarSubida(e.submitter, async () => {
      const plato = nombre.value.trim();
      if (plato.length < 3) throw new Error('Escribe el nombre del plato.');
      const subida = await subirA(fichero);
      return { subidaId: subida.id, local: local.value, plato, formato: formato.value, usoFotoReal: uso.value, ...(estetica.value ? { estetica: estetica.value } : {}), productorEditorial: true };
    }, errores);
  });
  return [titulo('Empieza con una foto'), form];
}

function fichaOriginal(ctx) {
  const { encargo, fotoSubida } = ctx.d;
  return [titulo('Foto original'), foto(fotoSubida.disponible ? ctx.urls.subida(480) : null, ctx.urls.subida(), encargo.plato, `${fotoSubida.ancho} × ${fotoSubida.alto} px`),
    fotoSubida.disponible ? h('p', { class: 'muted' }, fotoSubida.uso === 'PUBLICABLE' ? 'Aportada por el local.' : 'Solo para pruebas de composición.') : aviso('La foto de origen no está disponible.'),
    ctx.actual !== 'original' ? accion(boton('Volver a la fase actual', () => ctx.irActual(), true)) : null];
}

function fichaReferencia(ctx) {
  const { referencia, espera, encargo } = ctx.d;
  const elegida = referencia.elegida;
  const ficha = elegida?.ficha;
  const cambiar = espera.tipo === 'REFERENCIA' && !ctx.ocupada;
  const elegir = (cuerpo) => (e) => ctx.usarReferencia(e.currentTarget, async () => cuerpo);
  const tarjeta = (id, nombre, url, cuerpo, disabled = false) => h('li', {},
    h('button', { type: 'button', disabled, onclick: elegir(cuerpo), title: nombre }, url ? h('img', { src: url, alt: '', loading: 'lazy' }) : h('span', { class: 'ref-vacia' }), h('span', {}, nombre || id)));
  const recomendadas = new Set(referencia.estado?.propuestas?.map((f) => f.id));
  const familias = [...referencia.biblioteca].sort((a, b) => Number(recomendadas.has(b.id)) - Number(recomendadas.has(a.id)));
  const grupoFamilia = (f) => h('div', {}, h('h3', {}, f.nombre), h('ul', { class: 'referencias' }, f.posts.map((id) => tarjeta(id, id, urlDeBiblioteca(id, 200), { biblioteca: id }))));
  const archivo = h('input', { type: 'file', accept: FOTOS });
  const url = h('input', { type: 'url', placeholder: 'https://…' });
  const propia = h('form', {}, etiqueta('Imagen', archivo), etiqueta('Enlace', url), h('button', { type: 'submit' }, 'Usar referencia propia'));
  propia.addEventListener('submit', (e) => {
    e.preventDefault();
    ctx.usarReferencia(e.submitter, async () => {
      if (archivo.files[0]) return { subidaId: (await subirA(archivo.files[0])).id };
      if (url.value.trim()) return { enlace: url.value.trim() };
      throw new Error('Elige una imagen o pega un enlace.');
    });
  });
  return [titulo(cambiar ? 'Elige la referencia' : 'Referencia'),
    foto(referencia.conImagen ? ctx.urls.referencia(480) : null, ctx.urls.referencia(), ficha?.titulo ?? 'Referencia elegida', ficha?.titulo),
    ficha ? par([['Familia', ficha.familia], ['Retícula', ficha.reticula], ['Lectura', ficha.lectura?.join(' → ')]]) : null,
    cambiar ? nota(espera.motivo) : !encargo.referencia ? nota('Aquí se colocará la referencia visual del encargo.') : !ficha ? nota(encargo.referencia) : null,
    aviso(referencia.error),
    cambiar && referencia.registradas.length ? [h('h3', {}, 'Del local'), h('ul', { class: 'referencias' }, referencia.registradas.map((r) => tarjeta(r.id, r.titulo ?? r.id, r.conImagen ? ctx.urls.referenciaDelLocal(r.id, 200) : null, { referencia: r.id }, !r.usable)))] : null,
    cambiar && familias.length ? [grupoFamilia(familias[0]), familias.length > 1 ? detalles('Más referencias de la biblioteca', familias.slice(1).map(grupoFamilia)) : null] : null,
    cambiar ? detalles('Aportar una referencia propia', propia) : null];
}

function editorElemento(ctx, indice) {
  const origen = ctx.d.propuesta.contenido;
  const original = origen.descripcion.elementos[indice] ?? {};
  const campo = (nombre, valor, attrs = {}) => h('input', { name: nombre, value: valor ?? '', ...attrs });
  const nombre = campo('nombre', original.nombre, { required: true });
  const estado = campo('estado', original.estado, { required: true });
  const recuento = campo('recuento', original.recuento, { type: 'number', min: '1' });
  const cortados = campo('cortados', original.cortados, { type: 'number', min: '0' });
  const dudoso = campo('dudoso', '', { type: 'checkbox', checked: original.dudoso });
  const encuadre = h('select', {}, opcion('', 'Por revisar', original.enEncuadre === undefined), opcion('si', 'Entra', original.enEncuadre === true), opcion('no', 'Queda fuera', original.enEncuadre === false));
  const descripcion = campo('ingles', original.ingles);
  const alGuardar = (e) => {
    e.preventDefault();
    const propuesta = structuredClone(origen);
    const elemento = { ...original, nombre: nombre.value.trim(), estado: estado.value.trim(), recuento: recuento.value === '' ? null : Number(recuento.value), dudoso: dudoso.checked };
    if (cortados.value === '') delete elemento.cortados;
    else elemento.cortados = Number(cortados.value);
    if (encuadre.value) elemento.enEncuadre = encuadre.value === 'si';
    else delete elemento.enEncuadre;
    const frase = descripcion.value.trim();
    if (frase && (frase !== original.ingles?.trim() || (elemento.nombre === original.nombre && elemento.estado === original.estado))) elemento.ingles = frase;
    else delete elemento.ingles;
    propuesta.descripcion.elementos[indice] = elemento;
    ctx.guardarPropuesta(e.submitter, propuesta);
  };
  return h('form', { class: 'elemento-editor', onsubmit: alGuardar },
    etiqueta('Elemento', nombre), etiqueta('Estado', estado),
    h('div', { class: 'fila' }, etiqueta('Piezas enteras', recuento), etiqueta('Cortadas', cortados)),
    etiqueta('En la toma', encuadre), h('label', {}, dudoso, ' Recuento dudoso'),
    detalles('Descripción para la foto', etiqueta('Descripción en inglés', descripcion)),
    h('button', { type: 'submit', disabled: ctx.ocupada, class: 'primario' }, 'Guardar corrección'));
}

function fichaElementos(ctx) {
  const { propuesta, espera, editorial } = ctx.d;
  const elementos = propuesta?.valida ? propuesta.contenido.descripcion.elementos : [];
  const puedeEditar = espera.tipo === 'CONFIRMAR_ELEMENTOS' && !ctx.ocupada;
  const actual = elementos[ctx.elemento];
  const camara = propuesta?.valida ? propuesta.contenido.huecos.camara : null;
  return [titulo('Inventario de la toma'),
    propuesta && !propuesta.valida ? [aviso('Hay que corregir la propuesta.'), lista(propuesta.errores)] : null,
    !propuesta ? nota('El estudio registrará lo que se ve en la foto original.') : null,
    espera.bloqueo ? aviso(espera.explicacion?.queHaPasado ?? 'La orden se ha detenido. Revisa los elementos y la toma.') : null,
    elementos.length ? nota(puedeEditar ? 'Selecciona un elemento para revisar sus datos.' : 'Elementos anotados en la foto original.') : null,
    elementos.length ? h('ol', { class: 'lista-elementos' }, elementos.map((el, i) => h('li', {}, h('button', { type: 'button', 'aria-pressed': String(ctx.elemento === i), onclick: () => ctx.seleccionar('elementos', i, true) }, h('i', {}, i + 1), h('span', {}, el.nombre), h('small', {}, el.recuento == null ? 'Sin recuento' : `${el.recuento} ud.`))))) : null,
    actual ? [h('h3', {}, actual.nombre), actual.nota ? nota(actual.nota) : null, puedeEditar ? editorElemento(ctx, ctx.elemento) : par([['Estado', actual.estado], ['Cortadas', actual.cortados], ['En la toma', actual.enEncuadre === true ? 'Sí' : actual.enEncuadre === false ? 'Queda fuera' : 'Por revisar']])] : null,
    camara ? detalles('Toma propuesta', par([['Ángulo', `${camara.anguloGrados}°`], ['Plano', CAMARAS[camara.distancia]], ['Óptica', `${camara.objetivoMm} mm · f/${camara.apertura}`], ['Descripción', camara.descripcion], ['Luz', propuesta.contenido.huecos.luz]])) : null,
    propuesta?.problemas?.length ? h('div', { class: 'aviso-linea', 'data-alerta': true }, h('strong', {}, 'Antes de confirmar'), lista(propuesta.problemas)) : null,
    editorial?.plan?.hiloVisual ? detalles('Hilo visual', nota(editorial.plan.hiloVisual)) : null,
    puedeEditar ? accion(boton('Revisar y confirmar', () => ctx.confirmarInventario(), true, !propuesta?.valida || Boolean(propuesta.problemas?.length) || ctx.faltaEditorial),
      ctx.faltaEditorial ? avanzar(ctx, 'Preparar plan editorial') : null,
      propuesta ? boton('Editar inventario y toma', () => ctx.abrirHerramientas()) : null) : null];
}

function fichaCandidata(ctx) {
  const d = ctx.d;
  const candidata = d.intentos.find((i) => i.elegida) ?? d.intentos.at(-1);
  const fotoActual = d.espera.tipo === 'CONFIRMAR_FOTO';
  const rechazo = h('textarea', { required: true, minlength: '3', maxlength: '300', rows: '3' });
  const form = h('form', { onsubmit: (e) => { e.preventDefault(); ctx.avanzar(e.submitter, { rechazo: rechazo.value.trim() }); } }, etiqueta('Motivo del rechazo', rechazo), h('button', { type: 'submit', disabled: ctx.ocupada }, 'Rechazar candidata'));
  const intentos = d.intentos.filter((i) => i !== candidata);
  return [titulo(fotoActual ? 'Revisa la candidata' : 'Foto candidata'),
    candidata?.disponible ? h('div', { class: 'comparacion-ficha', role: 'group', 'aria-label': 'Comparación de las fotografías' },
      d.fotoSubida.disponible ? foto(ctx.urls.subida(480), ctx.urls.subida(), 'Foto original del local', 'Original') : null,
      foto(ctx.urls.activo(candidata.activo, 480), ctx.urls.activo(candidata.activo), 'Foto candidata', `Candidata · Intento ${candidata.n} · ${VEREDICTOS[candidata.final] ?? candidata.final}`)) : null,
    candidata?.motivos?.length ? detalles('Comprobación automática', lista(candidata.motivos)) : null,
    fotoActual ? nota('Compara ambas fotografías. Comprueba los ingredientes, el recuento y la toma.') : !candidata ? nota('La candidata llegará después de revisar el inventario.') : null,
    d.espera.tipo === 'IMPORTAR_FOTO' ? [aviso(d.espera.motivo), accion(boton('Importar foto', () => ctx.abrirHerramientas(), true))] : null,
    fotoActual ? [accion(avanzar(ctx, 'Confirmar esta foto', { confirmo: 'CONFIRMAR_FOTO' })), detalles('Rechazar y explicar', form)] : null,
    d.espera.tipo === 'CONTINUAR' && ctx.actual === 'candidata' && !ctx.ocupada ? accion(avanzar(ctx, 'Continuar con la foto')) : null,
    intentos.length ? detalles('Intentos anteriores', h('ul', { class: 'encargos-lista' }, intentos.map((i) => h('li', {}, i.disponible ? enlace(`Intento ${i.n} · ${VEREDICTOS[i.final] ?? i.final}`, ctx.urls.activo(i.activo), { target: '_blank', rel: 'noopener' }) : `Intento ${i.n} · ${VEREDICTOS[i.final] ?? i.final}`)))) : null];
}

function hojasDe(diseno) {
  const hojas = diseno.diapositivas?.length ? diseno.diapositivas : [{ id: diseno.intencion?.id ?? 'portada', papel: 'portada', versiones: diseno.versiones }];
  return hojas.map((x) => ({ ...x, papel: x.papel.charAt(0).toUpperCase() + x.papel.slice(1) }));
}

export function versionesDe(ctx) {
  const { diseno } = ctx.d;
  const vigente = (versiones, preferencia) => versiones.find((v) => v.version === preferencia) ?? versiones.findLast((v) => !v.problemas?.some((p) => p.gravedad === 'ERROR')) ?? versiones.at(-1);
  const portada = diseno.intencion?.id ?? 'portada';
  return hojasDe(diseno).map((x) => ({ ...x, version: vigente(x.versiones, x.id === portada ? diseno.vigente : null) })).filter((x) => x.version);
}

export function hojaDe(ctx) {
  const hojas = versionesDe(ctx);
  return hojas.find((h) => h.id === ctx.hoja) ?? hojas[0];
}

export function portadaDe(version) {
  return version?.exportadas.find((x) => x.proporcion === '4:5')?.archivo ?? version?.exportadas[0]?.archivo ?? version?.diseno;
}

export function pideRevision(d) {
  return d?.encargo.paso === 'COMPONER' && d.revisionEditorial?.estado === 'REVISION_HUMANA';
}

function dictamenDe(ctx, hojas) {
  const revision = ctx.d.revisionEditorial;
  if (!revision) return null;
  const nombre = (id) => {
    const i = hojas.findIndex((x) => x.id === id);
    return i < 0 ? id : `${i + 1}. ${hojas[i].papel}`;
  };
  return h('section', { class: 'aviso-linea', 'data-alerta': revision.estado === 'REVISION_HUMANA' },
    h('strong', {}, DICTAMENES[revision.estado]),
    revision.modelo ? h('div', { class: 'muted' }, revision.modelo) : null,
    lista(revision.incidencias.map((x) => `${nombre(x.id)} · v${x.version}. ${x.motivo}`)),
    lista(revision.correcciones.map((x) => `${nombre(x.id)} · v${x.desde} → v${x.hasta}`)));
}

function fichaComposicion(ctx) {
  const { diseno, editorial, espera, encargo } = ctx.d;
  const pendiente = pideRevision(ctx.d);
  const faseActiva = ['INTENCION', 'COMPOSICION', 'HECHO'].includes(espera.tipo) || Boolean(diseno.intencion);
  const hojas = hojasDe(diseno);
  const hoja = hojaDe(ctx);
  const incidencia = ctx.d.revisionEditorial?.incidencias.find((x) => x.id === hoja?.id);
  const version = hoja?.versiones.find((v) => v.version === incidencia?.version) ?? hoja?.version;
  const archivo = pendiente && !ctx.vistaPrevia ? portadaDe(version) : null;
  const preview = ctx.vistaPrevia ?? (archivo ? ctx.urls.diseno(archivo, { lado: 480, sello: version.compuestaEn }) : null);
  const elegir = (id) => () => ctx.elegirHoja(id);
  return [titulo(pendiente ? 'Revisa la composición' : 'Composición'),
    dictamenDe(ctx, hojas),
    preview ? foto(preview, archivo ? ctx.urls.diseno(archivo) : preview, 'Vista previa de la composición', archivo ? `${hoja.papel} · v${version.version}` : null) : null,
    pendiente && diseno.intencion ? accion(boton(`Corregir ${hoja?.papel.toLowerCase() ?? 'composición'}`, () => ctx.abrirHerramientas(), true, ctx.ocupada)) : null,
    editorial?.plan?.hiloVisual ? nota(editorial.plan.hiloVisual) : nota(faseActiva ? 'Revisa los textos y prepara una vista previa de la pieza.' : 'La composición parte de la foto candidata aprobada.'),
    espera.tipo === 'TOKENS' ? [aviso(`Falta el perfil de diseño de ${ctx.d.local?.nombre ?? encargo.local}.`), accion(avanzar(ctx, 'Volver a comprobar la marca'))] : null,
    faseActiva && hojas.length > 1 ? h('div', { class: 'grupo' }, hojas.map((x, i) => boton(`${i + 1}. ${x.papel}`, elegir(x.id), false, ctx.ocupada))) : null,
    faseActiva && !pendiente ? accion(boton('Abrir editor de composición', () => ctx.abrirHerramientas(), true, ctx.ocupada)) : null,
    !pendiente && ctx.actual === 'composicion' && espera.tipo === 'CONTINUAR' && !ctx.ocupada ? accion(avanzar(ctx, 'Continuar la composición')) : null];
}

function fichaEntrega(ctx) {
  const dictamen = dictamenDe(ctx, hojasDe(ctx.d.diseno));
  if (ctx.d.encargo.paso !== 'HECHO') {
    const pendiente = pideRevision(ctx.d);
    return [titulo('Entrega pendiente'), dictamen,
      nota(pendiente ? 'La entrega estará disponible cuando se apruebe la revisión editorial.' : 'Los archivos aparecerán cuando termine la composición.'),
      pendiente ? accion(boton('Ir a la composición', () => ctx.irActual(), true)) : null];
  }
  const hojas = versionesDe(ctx);
  const hoja = hojaDe(ctx);
  if (!hoja) return [titulo('Entrega'), dictamen, aviso('El compositor no ha dejado archivos disponibles.')];
  const v = hoja.version;
  const portada = portadaDe(v);
  const hayError = v.problemas?.some((p) => p.gravedad === 'ERROR');
  return [titulo(hayError ? 'Entrega por revisar' : 'Lista para descargar'),
    dictamen,
    hojas.length > 1 ? etiqueta('Diapositiva', h('select', { onchange: (e) => ctx.elegirHoja(e.currentTarget.value) }, hojas.map((x, i) => opcion(x.id, `${i + 1}. ${x.papel}`, hoja.id === x.id)))) : null,
    foto(portada ? ctx.urls.diseno(portada, { lado: 480, sello: v.compuestaEn }) : null, portada ? ctx.urls.diseno(portada) : null, 'Pieza compuesta', `Versión ${v.version}`),
    hayError ? aviso('Esta versión tiene errores del compositor.') : accion(v.exportadas.map((x) => enlace(`Descargar ${x.proporcion}`, ctx.urls.descargar(x.archivo)))),
    accion(boton('Ver versiones y archivos', () => ctx.abrirHerramientas()))];
}

export const fichas = { original: fichaOriginal, referencia: fichaReferencia, elementos: fichaElementos, candidata: fichaCandidata, composicion: fichaComposicion, entrega: fichaEntrega };

export function controlesDeFase(ctx) {
  const { espera, propuesta, diseno } = ctx.d;
  if (ctx.seleccion === 'elementos' && espera.tipo === 'CONFIRMAR_ELEMENTOS' && propuesta) {
    return [h('h3', {}, 'Editar inventario y toma'), propuesta.valida ? editorDePropuesta(ctx, propuesta.contenido) : editorJsonDePropuesta(ctx, propuesta.contenido)];
  }
  if (ctx.seleccion === 'candidata' && espera.tipo === 'IMPORTAR_FOTO') return panelDeEspera(ctx);
  if (ctx.seleccion === 'composicion' && diseno.intencion) {
    const hoja = diseno.diapositivas?.find((p) => p.id === ctx.hoja);
    const edicion = hoja ? { ...diseno, intencion: hoja.intencion, versiones: hoja.versiones, siguienteVersion: Math.max(0, ...hoja.versiones.map((v) => v.version)) + 1 } : diseno;
    const modo = espera.tipo === 'INTENCION' && !edicion.versiones.length ? 'INTENCION' : espera.tipo === 'COMPOSICION' ? 'COMPOSICION' : 'NUEVA';
    const contexto = Object.create(ctx);
    Object.defineProperty(contexto, 'd', { value: { ...ctx.d, diseno: edicion } });
    return panelIntencion(contexto, modo);
  }
  if (ctx.seleccion === 'entrega' && espera.tipo === 'HECHO') return panelDeEspera(ctx);
  return null;
}

export function textoPresupuesto(p) {
  if (!p?.disponible) return nota(`La foto se podrá importar a mano${p?.motivo ? ` (${p.motivo})` : ''}.`);
  return par([['Generador', p.generador], ['Por intento', `≤ ${usd(p.estimadoPorIntentoUsd)}`], ['Intentos', `Hasta ${p.maxIntentos}`], ['Total máximo', `≤ ${usd((p.estimadoPorIntentoUsd ?? 0) * p.maxIntentos)}`], ['Tope', p.tope ? `${usd(p.tope.gastadoUsd)} de ${usd(p.tope.topeUsd)}` : null]]);
}

export async function cargarPresupuesto(proyecto, nodo) {
  try {
    const { presupuesto } = await api('GET', `/encargos/${proyecto}/presupuesto`);
    reemplazar(nodo, textoPresupuesto(presupuesto));
    return true;
  } catch (error) {
    reemplazar(nodo, bloqueError(error));
    return false;
  }
}

export function notificarCorreccion(respuesta) {
  const problemas = respuesta.problemas?.length ?? 0;
  avisar(problemas ? `Corrección guardada. Quedan ${problemas} por revisar.` : 'Corrección guardada.', 'ok');
}
