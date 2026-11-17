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
  if (ctx.d.encargo.paso === 'REFERENCIA' && !ref.elegida && ref.estado?.paso.puede) {
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
  const copy = h('dl', { class: 'datos' }, c.textos.flatMap(b => [h('dt', {}, b.fuente === 'MARCA' ? 'Del local' : 'Del plato'), h('dd', {}, b.texto)]));
  if (e.paso === 'CONFIRMAR_ELEMENTOS') {
    const gesto = opciones('gesto', gestos, c.direccion.gesto);
    const nombre = texto('nombrePlato', 2, 300, c.nombrePlato ?? e.plato);
    const controles = campos.map(([k, titulo, min, max]) => [k, titulo, texto(k, min, max, c.direccion[k])]);
    return [titulo('Dirección del cartel'), h('p', {}, c.direccion.sujeto), h('p', {}, c.direccion.escena), h('p', {}, c.direccion.materia), h('p', {}, c.direccion.tipografia),
      ultima?.devolucion ? h('p', { class: 'aviso-linea' }, 'Corrección pendiente · ' + ultima.devolucion) : null, h('h3', {}, 'Palabras que aparecerán'), copy,
      detalle('Explorar otra acción en la imagen', formulario(ctx, () => ({ accion: 'PROPONER_GESTO', gesto: gesto.value }),
        campo('Relación entre letra y foto', gesto), accion('Proponer otra dirección'))),
      detalle('Editar dirección', formulario(ctx, () => ({ accion: 'EDITAR', nombrePlato: nombre.value, direccion: { gesto: c.direccion.gesto, ...Object.fromEntries(controles.map(([k, , input]) => [k, input.value])) } }),
        campo('Nombre que se imprime, copiado de la nota del plato', nombre), controles.map(([, label, input]) => campo(label, input)), accion('Guardar dirección'))),
      detalle('Instrucción completa', h('p', { style: { whiteSpace: 'pre-wrap' } }, c.prompt)),
      formulario(ctx, () => ({ accion: 'CONFIRMAR_DIRECCION' }), accion('Confirmar dirección y textos'))];
  }
  if (e.paso === 'GENERAR') {
    const archivo = h('input', { name: 'cartel', type: 'file', required: true, accept: 'image/png,image/jpeg,image/webp' });
    const uso = opciones('usoCandidata', [['SOLO_PRUEBA_COMPOSICION', 'Solo para probar'], ['PUBLICABLE', 'Tengo permiso para publicar este cartel']]);
    const limitado = c.uso !== 'PUBLICABLE';
    return [titulo('Producir el cartel'), h('p', {}, 'Descarga la dirección y la foto del producto. Adjunta la foto a tu herramienta de imagen, usa la instrucción completa e importa aquí el cartel 4:5.'),
      enlace('Descargar paquete de producción', base + 'paquete'), formulario(ctx, async () => ({ accion: 'IMPORTAR', subidaId: (await subirArchivo(archivo.files[0])).id, usoCandidata: limitado ? 'SOLO_PRUEBA_COMPOSICION' : uso.value }),
        campo('Imagen del cartel', archivo), limitado ? h('p', {}, 'La foto de origen permite pruebas de composición.') : campo('Uso del cartel importado', uso), accion('Importar cartel')),
      tallerApi?.disponibles === 0 ? h('p', {}, 'El estudio ha consumido su cupo de envíos. Puedes importar la imagen del paquete.') : null,
      tallerApi?.disponibles > 0 && !taller.envios.some(v => v.huella === c.huella) ? detalle('Generar con ' + tallerApi.modelo,
        h('p', {}, 'Se enviarán la foto y la instrucción a OpenAI. Quedan ' + tallerApi.disponibles + ' de ' + tallerApi.limite + ' envíos del estudio. Esta imagen se factura en la cuenta del proveedor.'),
        formulario(ctx, () => ({ accion: 'GENERAR', autorizarUnEnvio: true }), accion('Autorizar un envío facturable'))) : null,
      formulario(ctx, () => ({ accion: 'REABRIR_DIRECCION' }), accion('Volver a la dirección'))];
  }
  if (!ultima) return [titulo('Cartel pendiente')];
  const url = base + 'candidatas/' + ultima.version;
  const imagen = h('a', { href: url, target: '_blank', rel: 'noopener' }, h('img', { src: url, width: 360, alt: 'Cartel, versión ' + ultima.version, style: { display: 'block', width: 'min(100%, 360px)', height: 'auto' } }));
  if (e.paso === 'HECHO') return [titulo('Cartel aprobado'), imagen, h('p', {}, 'Versión ' + ultima.version + ' · PNG · 1080 × 1350 px'), ultima.uso === 'PUBLICABLE' ? enlace('Descargar cartel 4:5', base + 'exportacion') : h('p', {}, 'Vista de composición. La foto o el cartel tienen permiso de prueba.')];
  const transcripcion = texto('transcripcion', 1, 1000);
  const casillas = [['producto', 'He cotejado el producto y su preparación con la foto.'], ['gesto', 'En el cartel se ve la acción descrita en la dirección.'], ['legibilidad', 'He leído todas las palabras en la vista a 360 px.']].map(([k, label]) => [k, label, h('input', { type: 'checkbox', name: k, required: true })]);
  const motivo = texto('motivo', 3, 480);
  return [titulo('Revisar el cartel'), imagen, h('p', {}, 'Versión ' + ultima.version + ' · vista móvil'), detalle('Foto fuente y dirección', h('img', { src: ctx.urls.subida(360), alt: e.plato, style: { maxWidth: '100%' } }), h('p', {}, c.direccion.sujeto), h('p', {}, c.direccion.escena), copy),
    ultima.lectura.superficieUniforme ? h('p', { class: 'aviso-linea' }, 'La imagen aparece uniforme en la vista móvil. Devuelve esta versión e importa la imagen con el producto y sus palabras.') : null,
    ultima.lectura.coincide === false ? h('p', { class: 'aviso-linea' }, 'El lector automático encontró diferencias. Amplía la imagen y coteja también las palabras pequeñas.') : null,
    detalle('Lectura automática de la imagen', h('p', {}, ultima.lectura.lineas.join(' · ') || 'Requiere lectura manual.'), h('p', {}, ultima.lectura.coincide === true ? 'El lector local reconoce los bloques confirmados.' : 'Comprueba las letras en la imagen, especialmente las cursivas.')),
    formulario(ctx, () => ({ accion: 'APROBAR', version: ultima.version, transcripcion: transcripcion.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean), ...Object.fromEntries(casillas.map(([k, , box]) => [k, box.checked])) }),
      campo('Transcribe todo el texto que ves, un bloque por línea', transcripcion), casillas.map(([, label, control]) => h('label', {}, control, ' ' + label)), accion('Aprobar esta versión', ultima.lectura.superficieUniforme)),
    detalle('Pedir una corrección', formulario(ctx, () => ({ accion: 'DEVOLVER', version: ultima.version, motivo: motivo.value }), campo('Qué debe cambiar en la imagen', motivo), accion('Devolver a dirección')))];
}
