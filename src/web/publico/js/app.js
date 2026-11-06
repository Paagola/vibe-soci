// Arranque del frontend: cabecera (modo simulado y claves) y enrutado por #hash.
import { api } from './api.js';
import { avisar, bloqueError, h, reemplazar } from './ui.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaNuevoLocal } from './vistas/local.js';
import { vistaNuevaPieza } from './vistas/nuevaPieza.js';
import { vistaPieza } from './vistas/pieza.js';

const RUTAS = [
  [/^#?\/?$/, () => vistaInicio()],
  [/^#\/local$/, () => vistaNuevoLocal()],
  [/^#\/nueva$/, () => vistaNuevaPieza()],
  [/^#\/pieza\/([a-z0-9-]+)$/, (id) => vistaPieza(id)],
];

/** Cada vista devuelve {nodo, salir?}. `salir` deja de consultar trabajos al cambiar de pantalla. */
let vistaActual;

async function enrutar() {
  vistaActual?.salir?.();
  const contenedor = document.getElementById('vista');
  const ruta = RUTAS.find(([patron]) => patron.test(location.hash));
  if (!ruta) {
    location.hash = '#/';
    return;
  }
  const [patron, crear] = ruta;
  reemplazar(contenedor, h('p', { class: 'cargando' }, 'Cargando…'));
  try {
    vistaActual = await crear(...(location.hash.match(patron)?.slice(1) ?? []));
    reemplazar(contenedor, vistaActual.nodo);
    window.scrollTo(0, 0);
  } catch (error) {
    reemplazar(contenedor, bloqueError(error), h('p', {}, h('a', { href: '#/' }, 'Volver a las piezas')));
  }
}

async function iniciarCabecera() {
  const interruptor = document.getElementById('modo-simulado');
  const claves = document.getElementById('estado-claves');
  const estudio = await api('GET', '/estudio');

  const pintar = (simulado) => {
    interruptor.checked = simulado;
    document.body.classList.toggle('simulado', simulado);
    reemplazar(
      claves,
      simulado
        ? 'Nada gasta: director y generador falsos'
        : [
            estudio.claves.gemini ? `Director: ${estudio.modelos.director}` : 'Sin clave de Gemini',
            ' · ',
            estudio.claves.higgsfield ? `Imágenes: ${estudio.modelos.imagen}` : 'Sin clave de Higgsfield (vía manual)',
          ],
    );
  };
  pintar(estudio.simulado);

  interruptor.addEventListener('change', async () => {
    try {
      const { simulado } = await api('PUT', '/estudio', { simulado: interruptor.checked });
      pintar(simulado);
      avisar(simulado ? 'Modo simulado: nada gasta y sus piezas se guardan aparte.' : 'Modo real: el director y la generación usan tus claves.');
      // Cada modo tiene sus propias piezas: se vuelve a la lista para no seguir en una pieza del otro modo.
      if (location.hash === '' || location.hash === '#/') enrutar();
      else location.hash = '#/';
    } catch (error) {
      interruptor.checked = !interruptor.checked;
      avisar(error.message, 'error');
    }
  });
}

window.addEventListener('hashchange', enrutar);
iniciarCabecera().catch((error) => avisar(`No puedo hablar con el servidor: ${error.message}`, 'error'));
enrutar();
