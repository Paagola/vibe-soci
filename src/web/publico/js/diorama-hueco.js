// El hueco del diorama isométrico (los agentes del estudio trabajando). El diorama lo construye otro módulo
// (js/diorama/); aquí solo se reserva la columna, se pinta un reposo y, si el módulo existe, se monta de forma diferida.
//
// Contrato: el módulo /js/diorama/index.js (o window.montarDiorama) exporta
//   montarDiorama(contenedor, { obtenerEstado }) → { desmontar?() } | undefined
// Mientras no exista, la columna se queda en reposo y no se rompe nada.
import { api } from './api.js';
import { h } from './ui.js';

const MODULO = '/js/diorama/index.js';
let cargado; // la promesa de carga se comparte entre vistas

async function cargarMontar() {
  if (typeof window.montarDiorama === 'function') return window.montarDiorama;
  cargado ??= fetch(MODULO, { method: 'HEAD' })
    .then((r) => (r.ok ? import(MODULO) : null))
    .then((m) => m?.montarDiorama ?? null)
    .catch(() => null);
  return (await cargado) ?? (typeof window.montarDiorama === 'function' ? window.montarDiorama : null);
}

/** Lo que el diorama puede pedir cuando quiera: los encargos del modo y el resumen del panel. Solo lectura. */
async function obtenerEstado() {
  const [{ encargos }, panel] = await Promise.all([api('GET', '/encargos'), api('GET', '/panel')]);
  return { modo: panel.modo, encargos, panel };
}

/** La columna del diorama, en reposo. Devuelve { nodo, salir } para desmontarlo al cambiar de pantalla. */
export function huecoDiorama() {
  const lienzo = h(
    'div',
    { class: 'diorama-lienzo' },
    h('div', { class: 'diorama-reposo' }, h('p', { class: 'diorama-titulo' }, 'El estudio, en vivo'), h('p', { class: 'nota' }, 'Aquí verás a los agentes del estudio trabajando en cada encargo.')),
  );
  const nodo = h('aside', { id: 'diorama', class: 'panel-diorama', 'aria-label': 'El estudio en vivo' }, lienzo);
  let montado = null;
  let fuera = false;

  cargarMontar().then(async (montar) => {
    if (!montar || fuera) return;
    try {
      montado = (await montar(lienzo, { obtenerEstado })) ?? null;
      if (fuera) montado?.desmontar?.();
      else nodo.classList.add('con-diorama');
    } catch (error) {
      console.warn('El diorama no se ha podido montar:', error);
    }
  });

  return {
    nodo,
    salir: () => {
      fuera = true;
      montado?.desmontar?.();
    },
  };
}
