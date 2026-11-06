// Nueva pieza (S06 Idea · S07 Estética · S08 Fotos): mismo brief y mismas reglas que la app.
import { api, subirArchivo } from '../api.js';
import { bloqueError, h, nombre, reemplazar } from '../ui.js';

const RANGO = { POST: [1, 1], CARRUSEL: [3, 5], HISTORIA: [1, 3] };
const TIPOS_CON_CONDICIONES = ['OFERTA', 'EVENTO'];
const PAPELES_OPCIONALES = ['PLATO', 'LOCAL', 'VAJILLA', 'PERSONAS', 'OTRO'];
const MAX_BYTES = 10 * 1024 * 1024;
const ACEPTADAS = 'image/jpeg,image/png,image/webp';

export async function vistaNuevaPieza() {
  const { locales } = await api('GET', '/locales');
  if (locales.length === 0) {
    return { nodo: h('div', { class: 'vacio' }, h('p', {}, 'Antes de crear una pieza hace falta un local.'), h('a', { class: 'boton', href: '#/local' }, 'Crear local')) };
  }

  const errores = h('div');
  const campo = (etiqueta, control, ayuda) => h('label', { class: 'campo' }, h('span', {}, etiqueta), control, ayuda ? h('small', {}, ayuda) : null);

  // ------------------------------------------------ 1 · Idea
  const local = h('select', {}, locales.map((m) => h('option', { value: m.slug }, `${m.nombre} (${m.ciudad})`)));
  const formato = h('select', {}, ['POST', 'CARRUSEL', 'HISTORIA'].map((f) => h('option', { value: f }, `${nombre(f)} ${f === 'HISTORIA' ? '(9:16)' : '(3:4, también sale en 4:5)'}`)));
  const numero = h('input', { type: 'number', min: '1', max: '1', value: '1' });
  const ayudaNumero = h('small');
  const actualizarNumero = () => {
    const [min, max] = RANGO[formato.value];
    Object.assign(numero, { min: String(min), max: String(max), disabled: min === max });
    numero.value = String(Math.min(max, Math.max(min, Number(numero.value) || min)));
    ayudaNumero.textContent = min === max ? 'Una sola imagen.' : `Entre ${min} y ${max}.`;
  };
  formato.addEventListener('change', actualizarNumero);
  actualizarNumero();

  const idea = h('textarea', { required: true, minlength: '10', maxlength: '300', rows: '3', placeholder: 'Boquerones fritos recién hechos para el aperitivo del domingo' });
  const contador = h('small', {}, '0/300');
  idea.addEventListener('input', () => (contador.textContent = `${idea.value.length}/300`));

  const tipo = h('select', {}, ['PLATO_ESTRELLA', 'NOVEDAD', 'OFERTA', 'EVENTO'].map((t) => h('option', { value: t }, nombre(t))));
  const precio = h('input', { maxlength: '120', placeholder: '12 €' });
  const fechas = h('input', { maxlength: '120', placeholder: 'del 1 al 15 de diciembre' });
  const limites = h('input', { maxlength: '120', placeholder: 'solo a mediodía' });
  const condiciones = h(
    'fieldset',
    { hidden: true },
    h('legend', {}, 'Condiciones'),
    h('p', { class: 'nota' }, 'La IA no inventa cifras: escribe tú el precio, las fechas o los límites (al menos uno).'),
    campo('Precio', precio),
    campo('Fechas', fechas),
    campo('Límites', limites),
  );
  tipo.addEventListener('change', () => (condiciones.hidden = !TIPOS_CON_CONDICIONES.includes(tipo.value)));

  // ------------------------------------------------ 2 · Fotos
  const filas = h('div', { class: 'fotos' });
  const anadirFoto = (obligatoria) => filas.append(filaDeFoto({ obligatoria, alQuitar: (fila) => fila.remove() }));
  anadirFoto(true);

  // ------------------------------------------------ 3 · Referencia
  const referencia = filaDeFoto({ esReferencia: true });

  const enviar = async (evento) => {
    evento.preventDefault();
    const boton = evento.submitter;
    reemplazar(errores);
    const fotos = [...filas.children].map((fila) => fila.leer());
    const ref = referencia.leer();
    const pendientes = [...fotos, ref].filter((f) => f.estado === 'SUBIENDO');
    const problemas = [
      ...(pendientes.length ? ['Espera a que terminen de subir las fotos.'] : []),
      ...(fotos.some((f) => f.estado === 'ERROR') || ref.estado === 'ERROR' ? ['Hay fotos que no se han podido subir: quítalas o vuelve a elegirlas.'] : []),
      ...(!fotos.some((f) => f.subidaId && f.papel === 'PLATO') ? ['Hace falta al menos una foto real de un plato.'] : []),
    ];
    if (problemas.length) return reemplazar(errores, bloqueError({ message: 'Revisa la pieza', detalles: problemas }));

    boton.disabled = true;
    try {
      const cuerpo = {
        localSlug: local.value,
        formato: formato.value,
        numDiapositivas: Number(numero.value),
        idea: idea.value.trim(),
        tipo: tipo.value,
        condiciones: TIPOS_CON_CONDICIONES.includes(tipo.value)
          ? Object.fromEntries(
              [
                ['precio', precio],
                ['fechas', fechas],
                ['limites', limites],
              ]
                .filter(([, c]) => c.value.trim())
                .map(([k, c]) => [k, c.value.trim()]),
            )
          : {},
        fotos: fotos.filter((f) => f.subidaId).map(({ subidaId, papel, nota }) => ({ subidaId, papel, nota: nota || undefined })),
        referenciaEstilo: ref.subidaId ? { subidaId: ref.subidaId, nota: ref.nota || undefined } : undefined,
      };
      const { pieza } = await api('POST', '/piezas', cuerpo);
      location.hash = `#/pieza/${pieza.id}`;
    } catch (error) {
      reemplazar(errores, bloqueError(error));
    } finally {
      boton.disabled = false;
    }
  };

  const nodo = h(
    'form',
    { class: 'formulario', onsubmit: enviar },
    h('h1', {}, 'Nueva pieza'),
    h('fieldset', {}, h('legend', {}, '1 · Idea'), campo('Local', local), campo('Formato', formato), campo('¿Cuántas imágenes?', numero, ayudaNumero), campo('Tu idea, en una o dos frases', idea, contador), campo('Tipo', tipo)),
    condiciones,
    h(
      'fieldset',
      {},
      h('legend', {}, '2 · Fotos reales'),
      h('p', { class: 'nota' }, 'Mínimo una foto real del plato. Opcionales: el local, más platos, vajilla o personas. JPG, PNG o WEBP de hasta 10 MB.'),
      filas,
      h('button', { type: 'button', class: 'secundario', onclick: () => anadirFoto(false) }, 'Añadir otra foto'),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, '3 · Referencia de estilo (opcional)'),
      h('p', { class: 'nota' }, 'Un pin o una imagen cuya luz, composición o tipografía te guste. Solo inspira: nunca se publica.'),
      referencia,
    ),
    errores,
    h('div', { class: 'acciones' }, h('button', { type: 'submit' }, 'Crear pieza')),
  );
  return { nodo };
}

/**
 * Una foto: elegir archivo (se sube al momento), qué se ve y una nota.
 * fila.leer() → {subidaId, papel, nota, estado: VACIA | SUBIENDO | LISTA | ERROR}
 */
function filaDeFoto({ obligatoria = false, esReferencia = false, alQuitar } = {}) {
  let estado = 'VACIA';
  let subidaId;
  const vista = h('div', { class: 'miniatura vacia' });
  const mensaje = h('small');
  const nota = h('input', { maxlength: '160', placeholder: esReferencia ? 'Qué te gusta de ella' : 'Qué es (p. ej. «chuletón de vaca vieja»)' });
  const papel = obligatoria || esReferencia ? null : h('select', {}, PAPELES_OPCIONALES.map((p) => h('option', { value: p }, p === 'PLATO' ? 'Otro plato' : nombre(p))));
  const archivo = h('input', { type: 'file', accept: ACEPTADAS });

  archivo.addEventListener('change', async () => {
    const elegido = archivo.files?.[0];
    if (!elegido) return;
    subidaId = undefined;
    if (elegido.size > MAX_BYTES) {
      estado = 'ERROR';
      mensaje.textContent = 'Pesa más de 10 MB.';
      return;
    }
    reemplazar(vista, h('img', { src: URL.createObjectURL(elegido), alt: '' }));
    vista.classList.remove('vacia');
    estado = 'SUBIENDO';
    mensaje.textContent = 'Subiendo…';
    try {
      subidaId = (await subirArchivo(elegido)).id;
      estado = 'LISTA';
      mensaje.textContent = '✔ Subida';
    } catch (error) {
      estado = 'ERROR';
      mensaje.textContent = error.message;
    }
  });

  const fila = h(
    'div',
    { class: 'fila-foto' },
    vista,
    h(
      'div',
      { class: 'fila-foto-campos' },
      h('strong', {}, esReferencia ? 'Referencia de estilo' : obligatoria ? 'Foto del plato (obligatoria)' : 'Otra foto'),
      archivo,
      papel,
      nota,
      mensaje,
    ),
    alQuitar && !obligatoria ? h('button', { type: 'button', class: 'secundario', onclick: () => alQuitar(fila) }, 'Quitar') : null,
  );
  fila.leer = () => ({ subidaId, estado, nota: nota.value.trim(), papel: papel?.value ?? 'PLATO' });
  return fila;
}
