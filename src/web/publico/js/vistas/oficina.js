// La oficina: la vista inicial del estudio, a pantalla completa. El mundo 3D es la interfaz (js/diorama/); la
// navegación de gestión queda en la barra de iconos, translúcida encima de la escena.
import { h } from '../ui.js';

export async function vistaOficina() {
  const nodo = h('div', { class: 'oficina', role: 'region', 'aria-label': 'La oficina del estudio, en vivo' });
  let montado = null;
  let fuera = false;
  // Carga diferida: el módulo de la escena (y three.js) solo se descarga al entrar en la oficina.
  import('/js/diorama/index.js')
    .then(({ montarDiorama }) => {
      if (fuera) return;
      montado = montarDiorama(nodo, { pantallaCompleta: true });
    })
    .catch((error) => {
      nodo.append(h('p', { class: 'oficina-error' }, `La oficina no se ha podido cargar: ${error.message}`));
    });
  return {
    nodo,
    salir: () => {
      fuera = true;
      montado?.desmontar();
    },
  };
}
