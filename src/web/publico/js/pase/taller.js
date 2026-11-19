import { panelMuestras } from './muestras.js';
import { api, subirArchivo } from '../api.js';
import { bloqueError, h, reemplazar } from '../ui.js';

const titulo = texto => h('h2', { id: 'ficha-titulo' }, texto);
const campo = (texto, control) => h('label', { class: 'campo' }, h('span', {}, texto), control);
const texto = (nombre, min, max, valor = '') => h('textarea', { name: nombre, required: true, rows: 3, minlength: min, maxlength: max, value: valor });
const opciones = (nombre, pares, valor) => h('select', { name: nombre }, pares.map(([key, label]) => h('option', { value: key, selected: key === valor }, label)));
const accion = (nombre, disabled = false) => h('button', { type: 'submit', class: 'primario', disabled }, nombre);
const detalle = (titulo, ...contenido) => h('details', {}, h('summary', {}, titulo), contenido);
const enlace = (titulo, href) => h('a', { class: 'boton', href, download: true }, titulo);
const gestos = [['EMERGER', 'Emerger de una superficie'], ['LUZ_Y_SOMBRA', 'Luz y sombra'], ['RITMO', 'Ritmo entre letra y producto'], ['MACRO', 'Encuadre de detalle']];
const campos = [['sujeto', 'Producto y encuadre', 3, 480], ['escena', 'Acción en la imagen', 5, 600], ['materia', 'Superficie y luz', 5, 480], ['tipografia', 'Dirección tipográfica', 5, 480]];

const vistas = [['AUTO', 'Según el plato y la referencia'], ['RASANTE', 'Rasante · de perfil'], ['OBLICUA', 'Oblicua · tres cuartos'], ['CENITAL', 'Cenital · desde arriba']];
const estilosTitulo = [['CONTRASTE', 'Instrument Serif · romana y cursiva'], ['CONDENSADA', 'Archivo · condensada de peso alto']];
const posicionesTitulo = [['SUPERIOR_DERECHA', 'Arriba, al borde derecho'], ['SUPERIOR_IZQUIERDA', 'Arriba a la izquierda'], ['INFERIOR_IZQUIERDA', 'Abajo a la izquierda'], ['PAPEL', 'Al pie en papel']];
const distancias = [['GENERAL', 'General'], ['MEDIO', 'Medio'], ['PRIMER_PLANO', 'Primer plano'], ['MACRO', 'Macro']];
const etiquetaDe = (lista, valor) => lista.find(([clave]) => clave === valor)?.[1] ?? valor;

const rutas = [['FOTO_PLATO', 'Fotografía del plato'], ['FOTO_ESPACIO', 'Fotografía del local'], ['TIPO_SOBRIA', 'Fotografía con un título'], ['CARTEL_EXPRESIVO', 'Cartel editorial expresivo']];
const vistasDeSala = [['AUTO', 'Según la escena'], ['RASANTE', 'A la altura del visitante'], ['OBLICUA', 'Desde un costado'], ['CENITAL', 'Detalle desde arriba']];
export const referenciasEditoriales = editorial => detalle('Ver referencias de esta decisión', h('ul', {}, editorial.evidencias.map(e =>
  h('li', {}, h('p', {}, e.lectura), h('a', { href: e.pagina, target: '_blank', rel: 'noopener noreferrer' }, e.fuente), ' · ',
    h('a', { href: e.imagen, target: '_blank', rel: 'noopener noreferrer' }, 'Ver pieza ' + e.id)))));
function explorar(ctx, ed) {
  const otra = opciones('rutaEditorial', rutas.filter(([id]) => id !== ed.ruta));
  return detalle('Explorar otra dirección', formulario(ctx, () => ({ accion: 'EXPLORAR_RUTA', ruta: otra.value }),
    campo('Otra lectura del encargo', otra), accion('Preparar alternativa')));
}
function encuadrarOriginal(ctx) {
  const previa = h('img', { class: 'encuadre-original', src: ctx.urls.subida(680), alt: 'Encuadre de la foto original en proporción 4:5' });
  const posicion = h('input', { type: 'range', min: 0, max: 100, value: 50, name: 'posicionOriginal',
    oninput: e => { previa.style.objectPosition = e.target.value + '% ' + e.target.value + '%'; } });
  return detalle('Encuadrar la foto original', formulario(ctx, () => ({ accion: 'USAR_ORIGINAL', posicion: posicion.valueAsNumber / 100 }),
    previa, campo('Posición del recorte', posicion), accion('Revisar este encuadre sin generar')),
    ctx.d.encargo.taller.comanda?.tipografiaLocal ? formulario(ctx, () => ({ accion: 'USAR_ORIGINAL', completa: true }), accion('Conservar toda la foto con margen para el título')) : null);
}
function camaraDe(ctx, toma, preferencias = vistas, comanda) {
  const seleccion = toma?.seleccion;
  const vista = opciones('opcionToma', preferencias, seleccion?.opcion ?? 'AUTO');
  const plano = opciones('planoToma', [['', 'Propuesto por la dirección'], ...distancias], seleccion?.plano ?? '');
  const luz = h('textarea', { name: 'luzToma', rows: 2, minlength: 5, maxlength: 320, value: seleccion?.luz ?? '', placeholder: toma?.luz });
  const accionFoto = h('textarea', { name: 'accionFoto', rows: 2, minlength: 5, maxlength: 320, value: seleccion?.accionProducto ?? '', placeholder: toma?.accion });
  const angulo = h('input', { name: 'anguloOrigen', type: 'number', min: -45, max: 90, step: 'any', value: seleccion?.origen?.anguloGrados ?? '', placeholder: 'Sin medir' });
  const distancia = opciones('distanciaOrigen', [['', 'Sin determinar'], ...distancias], seleccion?.origen?.distancia ?? '');
  const rasgo = h('input', { name: 'rasgoFuente', maxlength: 220, value: seleccion?.rasgoFuente ?? '' });
  const vajilla = opciones('vajilla', [['ESTUDIO', 'Reemplazar el soporte en estudio'], ['ORIGINAL', 'Conservar la vajilla fotografiada']], comanda?.puesta?.vajilla);
  const grado = (name, min, max, value) => h('input', { name, type: 'number', min, max, step: 'any', value: value ?? '', placeholder: 'Según la posición elegida' });
  const altura = grado('alturaNueva', -45, 90, seleccion?.posicionLibre?.anguloGrados);
  const giro = grado('giroNuevo', 0, 180, seleccion?.posicionLibre?.giroGrados);
  const estilo = opciones('estiloTitulo', estilosTitulo, comanda?.tipografiaLocal?.estilo);
  const posicionTitulo = opciones('posicionTitulo', posicionesTitulo, comanda?.tipografiaLocal?.posicion);
  const puedeCambiarVajilla = comanda?.puesta && (comanda.puesta.ambito === 'PRODUCTO' || !comanda.puesta.ambito && comanda.editorial?.ruta !== 'FOTO_ESPACIO');
  const ajustar = () => {
    if ((altura.value === '') !== (giro.value === '')) throw new Error('Para fijar una cámara libre, indica tanto la inclinación como el giro.');

    if ((angulo.value === '') !== (distancia.value === '')) throw new Error('Para describir la fuente, indica tanto la altura como el tamaño del plano.');
    return { accion: 'AJUSTAR_TOMA', opcion: vista.value,
      ...(comanda?.puesta && altura.value !== '' ? { posicionLibre: { anguloGrados: altura.valueAsNumber, giroGrados: giro.valueAsNumber } } : {}),
      ...(puedeCambiarVajilla ? { vajilla: vajilla.value } : {}),
      ...(comanda?.tipografiaLocal ? { estiloTitulo: estilo.value, posicionTitulo: posicionTitulo.value } : {}), ...(plano.value ? { plano: plano.value } : {}),
      ...(luz.value.trim() ? { luz: luz.value.trim() } : {}), ...(accionFoto.value.trim() ? { accionProducto: accionFoto.value.trim() } : {}),
      ...(angulo.value === '' ? {} : { origen: { anguloGrados: angulo.valueAsNumber, distancia: distancia.value } }),
      ...(rasgo.value.trim() ? { rasgoFuente: rasgo.value.trim() } : {}) };
  };
  const posicion = toma?.camara;
  return [h('h3', {}, 'Toma fotográfica'),
    posicion ? [h('p', {}, h('strong', {}, etiquetaDe(preferencias, posicion.vista)), ' · ' + posicion.anguloGrados + '° · ' + etiquetaDe(distancias, posicion.distancia) + ' · ' + posicion.objetivoMm + ' mm · f/' + posicion.apertura),
      h('p', {}, posicion.evidencia), h('p', {}, toma.luz), h('p', {}, toma.accion),
      toma.alternativa ? h('p', { class: 'muted' }, 'Si la fuente ya tiene esa perspectiva, la dirección pide una sola toma ' + etiquetaDe(preferencias, toma.alternativa.vista).toLowerCase() + '.') : h('p', { class: 'muted' }, 'Cambio respecto al origen indicado · ' + toma.cambios.join(', '))] : null,
    detalle('Ajustar cámara y encuadre', formulario(ctx, ajustar,
      h('img', { src: ctx.urls.subida(480), alt: 'Foto de origen', style: { maxWidth: '100%', maxHeight: '210px' } }),
      campo('Posición de cámara', vista), campo('Tamaño del plano', plano),
      comanda?.puesta ? detalle('Fijar los ángulos de la toma', campo('Inclinación en grados (0 a ras, 90 cenital)', altura), campo('Giro alrededor del sujeto en grados (0–180)', giro)) : null,
      puedeCambiarVajilla ? campo('Vajilla y superficie', vajilla) : null,
      comanda?.tipografiaLocal ? [campo('Familia y peso del título', estilo), campo('Reserva para el título', posicionTitulo)] : null,
      detalle('Afinar luz y acción', campo('Luz de la escena', luz), campo('Acción en cuadro', accionFoto)), campo('Altura aproximada de la foto de origen en grados (0 a ras, 90 cenital)', angulo), campo('Tamaño del plano de origen', distancia),
      campo('Rasgo de la foto que debe conservarse', rasgo), accion('Preparar esta toma')))];
}

function comparacion(ctx, url, version, original) {
  const foto = (nombre, miniatura, completa) => h('figure', { class: 'foto-ficha' },
    h('a', { href: completa, target: '_blank', rel: 'noopener' }, h('img', { src: miniatura, alt: nombre })), h('figcaption', {}, nombre));
  return h('div', { class: 'comparacion-ficha', role: 'group', 'aria-label': 'Comparación de la fuente y la nueva toma' },
    foto('Fotografía de origen', ctx.urls.subida(480), ctx.urls.subida()), foto((original ? 'Recorte original' : 'Nueva toma') + ' · versión ' + version, url, url));
}

function formulario(ctx, datos, ...hijos) {
  const error = h('div', { role: 'status' });
  const form = h('form', {}, hijos, error);
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const boton = evento.submitter;
    if (boton.disabled) return;
    boton.disabled = true;
    const nombre = boton.textContent;
    boton.textContent = 'Guardando…';
    reemplazar(error);
    try {
      await api('POST', '/encargos/' + ctx.proyecto + '/taller', { revision: ctx.d.revision, ...await datos() });
      await ctx.recargar(true, ctx.proyecto);
    } catch (e) {
      reemplazar(error, bloqueError(e));
      if (e.status === 409) {
        error.append(h('button', { type: 'button', onclick: () => ctx.recargar(true, ctx.proyecto) }, 'Recargar la versión actual'));
      }
    } finally {
      boton.disabled = false;
      boton.textContent = nombre;
    }
  });
  return form;
}

export function fichaManual(ctx) {
  const ref = ctx.d.referencia;
  if (ctx.d.encargo.paso === 'REFERENCIA' && !ref.elegida && (ctx.d.encargo.taller?.seleccionEditorial || ref.estado?.paso.puede)) {
    return formulario(ctx, () => ({ accion: 'SIN_REFERENCIA' }), accion('Preparar dirección solo con mi foto'));
  }
  if (ctx.d.encargo.paso !== 'REFERENCIA' || !ref.conImagen || !ref.elegida || ref.elegida.ficha || ref.elegida.analisis?.decision === 'RECHAZA') return null;
  const familias = ref.biblioteca.map(f => [f.id, f.id + ' · ' + f.nombre]);
  const familia = opciones('familia', familias, 'F3');
  const mecanismos = ['PAPEL_RASGADO', 'PALABRA_GIRADA', 'PALABRA_DETRAS', 'TITULAR_EN_EL_AIRE', 'PATRON_REPETIDO', 'SALE_DEL_MARCO', 'CONTORNO_AL_CRUZAR', 'PLATO_CORTADO_POR_EL_BORDE', 'TEXTO_CURVO', 'ANOTACIONES'];
  const mecanismo = opciones('mecanismo', mecanismos.map(x => [x, x.toLowerCase().replaceAll('_', ' ')]));
  const reticula = texto('reticula', 10, 220), foto = texto('foto', 5, 200), voz = texto('voz', 3, 120);
  const lectura = [1, 2, 3].map(i => h('input', { name: 'lectura' + i, required: true, minlength: 2, maxlength: 80 }));
  return [h('h3', {}, 'Describe tu referencia'), h('p', {}, 'Mira el ejemplo y señala qué te interesa trasladar al nuevo cartel.'),
    formulario(ctx, () => ({ accion: 'FICHAR_REFERENCIA', familia: familia.value, mecanismo: mecanismo.value, reticula: reticula.value, foto: foto.value, voz: voz.value, lectura: lectura.map(i => i.value) }),
      campo('Familia visual', familia), campo('Recurso principal', mecanismo), campo('Cómo se reparten letra y foto', reticula), campo('Encuadre del sujeto', foto), campo('Carácter de la letra', voz), lectura.map((i, n) => campo(['Qué se ve primero', 'Qué se ve después', 'Qué cierra la lectura'][n], i)), accion('Preparar dirección con esta ficha'))];
}

export function fichaTaller(ctx) {
  const { encargo: e, tallerApi } = ctx.d;
  const taller = e.taller, c = taller.comanda;
  if (ctx.d.trabajo?.estado === 'EN_CURSO') return [titulo('Producción en curso')];
  const base = '/api/encargos/' + ctx.proyecto + '/taller/';
  if (!c) return [titulo('Dirección de arte'), h('button', { type: 'button', onclick: () => ctx.seleccionar('referencia') }, 'Elegir referencia')];
  const ultima = taller.candidatas.at(-1);
  const ed = c.editorial;
  const limpia = ed?.ruta === 'FOTO_PLATO' || ed?.ruta === 'FOTO_ESPACIO';
  const sala = ed?.ruta === 'FOTO_ESPACIO';
  const posiciones = sala ? vistasDeSala : vistas;
  const copy = h('dl', { class: 'datos' }, c.textos.flatMap(b => [h('dt', {}, b.fuente === 'MARCA' ? 'Del local' : 'Del plato'), h('dd', {}, b.texto)]));
  if (e.paso === 'CONFIRMAR_ELEMENTOS') {
    const gesto = opciones('gesto', gestos, c.direccion.gesto);
    const confirmoMuestras = h('input', { name: 'confirmoMuestras', type: 'checkbox', required: true });
    const nombre = texto('nombrePlato', 2, 300, c.nombrePlato ?? e.plato);
    const criterios = c.direccion.criterioVisual && [['foco', 'Qué debe verse primero', 320], ['conservar', 'Qué se conserva de la fuente', 480], ['comprobar', 'Qué comprobar a 360 px', 480]].map(([k, label, max]) => [k, label, texto(k, 3, max, c.direccion.criterioVisual[k])]);
    const controles = campos.filter(([k]) => !((limpia || c.tipografiaLocal) && k === 'tipografia')).map(([k, titulo, min, max]) => [k, titulo, texto(k, min, max, c.direccion[k])]);
    return [titulo(ed ? etiquetaDe(rutas, ed.ruta) : 'Dirección del cartel'),
      ed ? [h('h3', {}, ed.enfoque), h('p', {}, ed.motivo)] : null,
      h('p', {}, c.direccion.sujeto), h('p', {}, c.direccion.escena), h('p', {}, c.direccion.materia), h('p', {}, c.direccion.tipografia),
      c.puesta ? [h('p', {}, c.puesta.soporte), h('p', {}, c.puesta.apetito)] : null,
      c.tipografiaLocal ? h('p', {}, etiquetaDe(estilosTitulo, c.tipografiaLocal.estilo) + ' · ' + etiquetaDe(posicionesTitulo, c.tipografiaLocal.posicion)) : null, ed ? [h('p', {}, ed.comprobar), referenciasEditoriales(ed), explorar(ctx, ed), detalle('Dirigir una toma nueva', camaraDe(ctx, c.toma, posiciones, c))] : camaraDe(ctx, c.toma),
      sala ? null : panelMuestras(ctx, c, formulario),
      ultima?.devolucion ? h('p', { class: 'aviso-linea' }, 'Corrección pendiente · ' + ultima.devolucion) : null, limpia ? null : [h('h3', {}, 'Palabras que aparecerán'), copy],
      ed && ed.ruta !== 'CARTEL_EXPRESIVO' ? null : detalle('Explorar otra acción en la imagen', formulario(ctx, () => ({ accion: 'PROPONER_GESTO', gesto: gesto.value }),
        campo('Relación entre letra y foto', gesto), accion('Proponer otra dirección'))),
      detalle('Editar dirección', formulario(ctx, () => ({ accion: 'EDITAR', ...(limpia ? {} : { nombrePlato: nombre.value }), direccion: { ...c.direccion, ...(criterios ? { criterioVisual: Object.fromEntries(criterios.map(([k, , input]) => [k, input.value])) } : {}), ...Object.fromEntries(controles.map(([k, , input]) => [k, input.value])) } }),
        limpia ? null : campo('Texto público, copiado de la nota del encargo', nombre), criterios?.map(([, label, input]) => campo(label, input)), controles.map(([, label, input]) => campo(label, input)), accion('Guardar dirección'))),
      detalle('Instrucción completa', h('p', { style: { whiteSpace: 'pre-wrap' } }, c.prompt)),
      formulario(ctx, () => ({ accion: 'CONFIRMAR_DIRECCION', ...(c.muestras ? { confirmoMuestras: confirmoMuestras.checked } : {}) }),
        c.muestras ? h('label', {}, confirmoMuestras, ' He comprobado el recuento en la fuente y que cada ventana aísla el rasgo de una sola pieza.') : null, accion(limpia ? 'Confirmar dirección fotográfica' : 'Confirmar dirección y textos'))];
  }
  if (e.paso === 'GENERAR') {
    const archivo = h('input', { name: 'cartel', type: 'file', required: true, accept: 'image/png,image/jpeg,image/webp' });
    const uso = opciones('usoCandidata', [['SOLO_PRUEBA_COMPOSICION', 'Solo para probar'], ['PUBLICABLE', 'Tengo permiso para publicar la imagen']]);
    const limitado = c.uso !== 'PUBLICABLE';
    return [titulo(ed ? 'Producir el post' : 'Producir el cartel'), (limpia || c.tipografiaLocal) && !c.muestras ? encuadrarOriginal(ctx) : null, h('p', {}, c.muestras ? 'Descarga el paquete. Adjunta únicamente muestras.jpg al generador y utiliza direccion.txt. Usa producto.jpg para cotejar los alimentos del cartel terminado.' : 'Para una toma nueva, descarga el paquete y adjunta la fotografía a tu herramienta de imagen con la dirección aprobada. Importa aquí el resultado 4:5.'),
      enlace('Descargar paquete de producción', base + 'paquete'), formulario(ctx, async () => ({ accion: 'IMPORTAR', subidaId: (await subirArchivo(archivo.files[0])).id, usoCandidata: limitado ? 'SOLO_PRUEBA_COMPOSICION' : uso.value }),
        campo(c.tipografiaLocal ? 'Fotografía base 4:5 sin título. El taller compondrá el texto.' : 'Imagen 4:5', archivo), limitado ? h('p', {}, 'La foto de origen permite pruebas de composición.') : campo('Permiso de la imagen importada', uso), accion('Importar imagen')),
      tallerApi?.disponibles === 0 ? h('p', {}, 'El estudio ha consumido su cupo de envíos. Puedes importar la imagen del paquete.') : null,
      tallerApi?.disponibles > 0 && !taller.envios.some(v => v.huella === c.huella) ? detalle('Generar con ' + tallerApi.modelo,
        h('p', {}, (c.muestras ? 'Se enviarán la lámina de detalles y la instrucción a OpenAI.' : 'Se enviarán la foto y la instrucción a OpenAI.') + ' Quedan ' + tallerApi.disponibles + ' de ' + tallerApi.limite + ' envíos del estudio. Esta imagen se factura en la cuenta del proveedor.'),
        formulario(ctx, () => ({ accion: 'GENERAR', autorizarUnEnvio: true }), accion('Autorizar un envío facturable'))) : null,
      formulario(ctx, () => ({ accion: 'REABRIR_DIRECCION' }), accion('Volver a la dirección'))];
  }
  if (!ultima) return [titulo('Imagen pendiente')];
  const url = base + 'candidatas/' + ultima.version;
  const imagen = h('a', { href: url, target: '_blank', rel: 'noopener' }, h('img', { src: url, width: 360, alt: 'Imagen, versión ' + ultima.version, style: { display: 'block', width: 'min(100%, 360px)', height: 'auto' } }));
  if (e.paso === 'HECHO') return [titulo(ed ? 'Post aprobado' : 'Cartel aprobado'), imagen, h('p', {}, 'Versión ' + ultima.version + ' · PNG · 1080 × 1350 px'), ultima.uso === 'PUBLICABLE' ? enlace('Descargar PNG 4:5', base + 'exportacion') : h('p', {}, 'Vista de composición. La foto o el cartel tienen permiso de prueba.')];
  const recuento = h('input', { type: 'number', name: 'recuentoObservado', min: 0, max: 10000, required: true });
  const transcripcion = texto('transcripcion', 1, 1000);
  const original = ultima.origen === 'ORIGINAL';
  const toma = original ? undefined : c.toma;
  const observables = [toma?.camara, toma?.alternativa].filter(Boolean);
  const vistaLeida = opciones('vistaObservada', [['', 'Selecciona la vista que se aprecia'], ...observables.map(p => [p.vista, etiquetaDe(posiciones, p.vista)])]);
  vistaLeida.required = observables.length > 1;
  const correccionToma = opciones('siguienteToma', [['', 'Conservar la dirección de cámara'], ...posiciones]);
  const cotejoProducto = sala ? 'He cotejado el espacio, el mobiliario y los rótulos reales con la fuente.' : c.muestras ? 'He seguido el contorno de cada pieza y cotejado su preparación con la foto completa. Cada parte visible pertenece a su pieza, sin duplicaciones ni uniones truncadas.' : 'He cotejado el producto y su preparación con la foto.';
  const casillas = [['producto', cotejoProducto], ...(c.puesta && !original ? [['apetito', c.puesta.apetito]] : []),
    ...(ultima.composicion ? [['composicionTipografica', 'La ubicación y el peso del título funcionan a 360 px y dejan leer el sujeto.']] : []), ...(toma ? [['cambioDeToma', 'He comprobado el cambio de perspectiva en los bordes y solapes del producto.']] : []), ['gesto', original ? 'El encuadre conserva el motivo y sus bordes importantes.' : 'Se ve la acción descrita en la dirección.'], ['legibilidad', limpia ? 'El sujeto y su contexto se reconocen a 360 px.' : 'He leído todas las palabras en la vista a 360 px.'], ...(limpia ? [['sinTextoAnadido', 'He comprobado que sólo aparecen las letras que ya había en la fuente.']] : [])].map(([k, label]) => [k, label, h('input', { type: 'checkbox', name: k, required: true })]);
  const motivo = texto('motivo', 3, 480);
  const observacion = texto('observacionVisual', 3, 480, ultima.avisoVisual ?? '');
  const impresa = ultima.composicion;
  const familia = opciones('familiaRevision', estilosTitulo, impresa?.estilo);
  const sitio = opciones('posicionRevision', posicionesTitulo, impresa?.posicionSolicitada);
  const versionUrl = base + 'candidatas/' + ultima.version;
  const literal = texto('tituloLiteral', 2, 300, c.nombrePlato);
  const mascara = h('input', { type: 'file', name: 'mascara', accept: 'image/png' });
  const plano = opciones('plano', [['AIRE', 'En el aire sobre el contorno'], ['DETRAS', 'Detrás del borde del sujeto']], impresa?.profundidad?.plano);
  const capas = impresa ? detalle('Componer con la silueta',
    enlace('Guardar la foto base limpia', versionUrl + '/base'),
    impresa.profundidad ? [enlace('Ver la máscara utilizada', versionUrl + '/mascara'), h('p', {}, 'Tinta cubierta a 360 px · ' + Math.round(100 * impresa.profundidad.oclusion) + '% del título · ' + Math.round(100 * impresa.profundidad.peorFranja) + '% en la franja más tapada.')] : null,
    formulario(ctx, async () => ({ accion: 'RECOMPONER_TITULO', version: ultima.version, estiloTitulo: familia.value, tituloLiteral: literal.value, posicionTitulo: 'SUPERIOR_IZQUIERDA', plano: plano.value,
      ...(mascara.files.length ? { mascaraId: (await subirArchivo(mascara.files[0])).id } : {}) }),
      campo('Relación entre titular y producto', plano),
      campo('Máscara PNG de la base, sujeto blanco y fondo negro. Opcional con segmentación local.', mascara),
      accion('Ver composición por capas'))) : null;
  const maquetar = impresa ? detalle('Recomponer el título sobre esta misma foto',
    h('p', {}, etiquetaDe(estilosTitulo, impresa.estilo) + ' · ' + (impresa.profundidad ? etiquetaDe([['AIRE', 'Titular en aire'], ['DETRAS', 'Solape parcial']], impresa.profundidad.plano) : etiquetaDe(posicionesTitulo, impresa.posicion)) + ' · contraste ' + impresa.contraste + ' a 1'),
    !impresa.profundidad && impresa.posicion !== impresa.posicionSolicitada ? h('p', {}, 'La zona solicitada tenía demasiado detalle o poco contraste. Se utilizó otra posición para conservar la lectura.') : null,
    campo('Título que confirmas para esta maqueta, copiado de la nota original', literal),
    formulario(ctx, () => ({ accion: 'RECOMPONER_TITULO', version: ultima.version, estiloTitulo: familia.value, tituloLiteral: literal.value, posicionTitulo: sitio.value }),
      campo('Familia y peso', familia), campo('Posición', sitio), accion('Ver la nueva composición sin generar')), capas) : null;
  return [titulo(ed ? 'Revisar el post' : 'Revisar el cartel'), comparacion(ctx, url, ultima.version, original),
    toma ? [h('h3', {}, 'Punto de vista observado'), ...observables.map(p => h('p', {}, h('strong', {}, etiquetaDe(posiciones, p.vista) + '. '), p.evidencia))] : null,
    h('h3', {}, 'Lectura a tamaño móvil'), imagen, h('p', {}, 'Versión ' + ultima.version + ' · vista móvil'), maquetar, c.direccion.criterioVisual ? detalle('Criterio visual de esta versión', ...Object.values(c.direccion.criterioVisual).map(v => h('p', {}, v))) : null, detalle('Dirección y palabras confirmadas', h('p', {}, c.direccion.sujeto), h('p', {}, c.direccion.escena), copy),
    ultima.avisoVisual ? h('p', { class: 'aviso-linea' }, 'Observación visual · ' + ultima.avisoVisual) : null,
    detalle('Anotar una observación sobre esta versión', formulario(ctx, () => ({ accion: 'ANOTAR_REVISION', version: ultima.version, observacion: observacion.value }),
      campo('Qué cambia al comparar con la fuente a 360 px', observacion), accion('Guardar observación sin generar'))),
    ultima.lectura.superficieUniforme ? h('p', { class: 'aviso-linea' }, 'La imagen aparece uniforme en la vista móvil. Devuelve esta versión e importa la imagen con el producto y sus palabras.') : null,
    ultima.lectura.coincide === false ? h('p', { class: 'aviso-linea' }, 'El lector automático encontró diferencias. Amplía la imagen y coteja también las palabras pequeñas.') : null,
    detalle('Controles técnicos de lectura', h('p', {}, ultima.lectura.lineas.join(' · ') || 'Requiere lectura manual.'), h('p', {}, limpia ? 'Compara cualquier rótulo detectado con la foto del local.' : ultima.lectura.coincide === true ? 'El lector local reconoce los bloques confirmados.' : 'Comprueba las letras en la imagen, especialmente las cursivas.')),
    formulario(ctx, () => ({ accion: 'APROBAR', version: ultima.version, ...(c.muestras ? { recuentoObservado: recuento.valueAsNumber } : {}), ...(toma ? { vistaObservada: observables.length === 1 ? toma.camara.vista : vistaLeida.value } : {}), transcripcion: limpia ? [] : transcripcion.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean), ...Object.fromEntries(casillas.map(([k, , box]) => [k, box.checked])) }),
      c.muestras ? campo('Cuenta las piezas que se ven en el cartel (' + c.muestras.unidad + ')', recuento) : null, observables.length > 1 ? campo('Qué punto de vista se ve en el cartel', vistaLeida) : null, limpia ? null : campo('Transcribe los bloques añadidos, uno por línea', transcripcion), casillas.map(([, label, control]) => h('label', {}, control, ' ' + label)), accion('Aprobar esta versión', ultima.lectura.superficieUniforme)),
    detalle('Pedir una corrección', formulario(ctx, () => ({ accion: 'DEVOLVER', version: ultima.version, motivo: motivo.value,
      ...(correccionToma.value ? { ajusteToma: { ...toma?.seleccion, opcion: correccionToma.value } } : {}) }), campo('Qué debe cambiar en la imagen', motivo),
      toma ? campo('Cámara para la siguiente prueba', correccionToma) : null, accion('Devolver a dirección')))];
}
