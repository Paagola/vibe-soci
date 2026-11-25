import { h, reemplazar } from '../ui.js';

const campo = (titulo, control) => h('label', { class: 'campo' }, h('span', {}, titulo), control);
const boton = (nombre, alPulsar) => h('button', { type: 'button', onclick: alPulsar }, nombre);
const limite = n => Math.max(0, Math.min(1, n));
const decimal = n => Math.round(n * 1000) / 1000;

function selectorDeZonas(url, guardadas) {
  const zonas = guardadas.map(r => ({ ...r }));
  const original = h('img', { src: url, alt: 'Fotografía original sobre la que se marcan los detalles', draggable: 'false', ondragstart: ev => ev.preventDefault() });
  const marcas = h('div', { class: 'marcas-muestras', 'aria-hidden': 'true' });
  const escena = h('div', { class: 'selector-muestras' }, original, marcas);
  const campos = h('div');
  const aviso = h('p', { role: 'status', class: 'muted' });
  const estado = h('p', { class: 'muted' });
  let inicio, trazo;

  function dibujar() {
    const rectangulos = trazo ? [...zonas, trazo] : zonas;
    reemplazar(marcas, rectangulos.filter(r => Object.values(r).every(Number.isFinite)).map((r, i) =>
      h('span', { class: 'zona-muestra', style: { left: (r.x * 100) + '%', top: (r.y * 100) + '%', width: (r.ancho * 100) + '%', height: (r.alto * 100) + '%' } }, h('b', {}, String(i + 1)))));
    estado.textContent = zonas.length + ' de 4 zonas seleccionadas';
  }
  function editarCoordenadas() {
    reemplazar(campos, zonas.map((r, i) => {
      const numeros = [['x', 'Izquierda'], ['y', 'Arriba'], ['ancho', 'Ancho'], ['alto', 'Alto']].map(([clave, nombre]) => {
        const input = h('input', { type: 'number', min: clave === 'x' || clave === 'y' ? 0 : 5, max: 100, step: 0.1, value: decimal(r[clave] * 100), required: true,
          oninput: e => { r[clave] = e.currentTarget.valueAsNumber / 100; dibujar(); } });
        return campo(nombre + ' (%)', input);
      });
      return h('details', {}, h('summary', {}, 'Zona ' + (i + 1)), h('div', { class: 'coordenadas-muestra' }, numeros),
        boton('Quitar zona ' + (i + 1), () => { zonas.splice(i, 1); editarCoordenadas(); dibujar(); }));
    }));
  }
  const punto = ev => {
    const caja = original.getBoundingClientRect();
    return { x: limite((ev.clientX - caja.left) / caja.width), y: limite((ev.clientY - caja.top) / caja.height) };
  };
  const rectangulo = (a, b) => ({
    x: decimal(Math.min(a.x, b.x)), y: decimal(Math.min(a.y, b.y)),
    ancho: decimal(Math.abs(decimal(b.x) - decimal(a.x))), alto: decimal(Math.abs(decimal(b.y) - decimal(a.y))),
  });
  function agregar(r) {
    if (zonas.length >= 4) { aviso.textContent = 'Quita una zona para cambiarla.'; return; }
    if (r.ancho < .05 || r.alto < .05 || r.ancho * r.alto >= .65) {
      aviso.textContent = 'Delimita un detalle visible que ocupe solo parte de la foto.';
      return;
    }
    zonas.push(r);
    aviso.textContent = '';
    editarCoordenadas();
    dibujar();
  }
  escena.addEventListener('pointerdown', ev => {
    if (!ev.isPrimary || ev.button !== 0 || !original.complete || !original.naturalWidth) return;
    if (zonas.length >= 4) { aviso.textContent = 'Quita una zona para cambiarla.'; return; }
    ev.preventDefault();
    inicio = punto(ev);
    escena.setPointerCapture(ev.pointerId);
  });
  escena.addEventListener('pointermove', ev => { if (ev.isPrimary && inicio) { trazo = rectangulo(inicio, punto(ev)); dibujar(); } });
  escena.addEventListener('pointerup', ev => {
    if (!ev.isPrimary || !inicio) return;
    const nueva = rectangulo(inicio, punto(ev));
    inicio = trazo = undefined;
    agregar(nueva);
    dibujar();
  });
  escena.addEventListener('pointercancel', () => { inicio = trazo = undefined; dibujar(); });
  editarCoordenadas();
  dibujar();
  return { zonas, nodos: [escena, estado, aviso, campos, boton('Añadir zona por coordenadas', () => agregar({ x: .35, y: .35, ancho: .3, alto: .3 }))] };
}

export function panelMuestras(ctx, c, formulario) {
  if (c.toma?.camara.vista !== 'CENITAL') return null;
  if (c.toma.alternativa) return h('p', { class: 'muted' }, 'Para dirigir una cenital con detalles del producto, indica la altura y el plano de la foto de origen en «Ajustar cámara y encuadre».');
  const muestras = c.muestras;
  const selector = selectorDeZonas(ctx.urls.subida(900), muestras?.recortes ?? []);
  const recuento = h('input', { name: 'recuentoFuente', type: 'number', min: 1, max: 200, required: true, value: muestras?.recuento });
  const unidad = h('input', { name: 'unidadFuente', minlength: 2, maxlength: 80, required: true, value: muestras?.unidad, placeholder: 'p. ej. gambas enteras' });
  const colocacion = h('textarea', { name: 'colocacion', rows: 2, minlength: 10, maxlength: 320, required: true, value: muestras?.colocacion, placeholder: 'Cómo deben disponerse las piezas bajo la cámara' });
  const editar = formulario(ctx, () => {
    if (selector.zonas.length < 2) throw new Error('Selecciona al menos dos detalles en la foto.');
    return { accion: 'AJUSTAR_MUESTRAS', muestras: { recuento: recuento.valueAsNumber, unidad: unidad.value.trim(), colocacion: colocacion.value.trim(), recortes: selector.zonas } };
  }, h('p', {}, 'Marca de dos a cuatro detalles de la foto. Aísla un rasgo de una sola pieza en cada ventana. Si entra una parte de otra pieza, ajusta el recorte. Puedes arrastrar sobre la foto o escribir las coordenadas.'),
    selector.nodos, campo('Número de piezas en la fuente', recuento), campo('Qué piezas has contado', unidad), campo('Nueva colocación', colocacion),
    h('button', { type: 'submit' }, 'Preparar lámina de detalles'));
  return [muestras ? [
    h('h3', {}, 'Imagen que recibirá el generador'),
    h('img', { class: 'lamina-muestras', src: '/api/encargos/' + ctx.proyecto + '/taller/muestras/' + muestras.sha256, alt: 'Lámina de los detalles elegidos para esta dirección' }),
    h('p', {}, muestras.recuento + ' ' + muestras.unidad + '. ' + muestras.colocacion),
    formulario(ctx, () => ({ accion: 'AJUSTAR_MUESTRAS', muestras: null }), h('button', { type: 'submit' }, 'Volver a la foto completa'))] : null,
    h('details', {}, h('summary', {}, muestras ? 'Cambiar detalles y colocación' : 'Cambiar la colocación mediante detalles del producto'), editar)];
}
