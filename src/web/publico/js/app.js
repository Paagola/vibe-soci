// Arranque del frontend: panel lateral (secciones, modo simulado y vías) y enrutado por #hash.
import { api } from './api.js';
import { estadoDePaso } from './orden.js';
import { avisar, bloqueError, h, reemplazar } from './ui.js';
import { vistaEncargo } from './vistas/encargo.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaNuevoLocal } from './vistas/local.js';
import { vistaNuevaPieza } from './vistas/nuevaPieza.js';
import { vistaNuevoEncargo } from './vistas/nuevoEncargo.js';
import { vistaOficina } from './vistas/oficina.js';
import { vistaPanel } from './vistas/panel.js';
import { vistaPieza } from './vistas/pieza.js';

// [patrón, crear vista, sección del panel lateral que se marca]
const RUTAS = [
  // La oficina 3D es la portada; el resumen de cifras de antes sigue en #/resumen.
  [/^#?\/?$/, () => vistaOficina(), 'inicio'],
  [/^#\/resumen$/, () => vistaPanel(), 'resumen'],
  [/^#\/posts$/, () => vistaEncargo(), 'posts'],
  [/^#\/nuevo$/, () => vistaNuevoEncargo(), 'nuevo'],
  [/^#\/encargo\/([a-z0-9-]+)$/, (proyecto) => vistaEncargo(proyecto), 'posts'],
  [/^#\/local$/, () => vistaNuevoLocal(), 'local'],
  // El generador antiguo (MVP): se conserva tal cual.
  [/^#\/piezas$/, () => vistaInicio(), 'piezas'],
  [/^#\/nueva$/, () => vistaNuevaPieza(), 'piezas'],
  [/^#\/pieza\/([a-z0-9-]+)$/, (id) => vistaPieza(id), 'piezas'],
];

/** Cada vista devuelve {nodo, salir?}. `salir` deja de consultar trabajos al cambiar de pantalla. */
let vistaActual;

async function enrutar() {
  vistaActual?.salir?.();
  vistaActual = undefined;
  const contenedor = document.getElementById('vista');
  const ruta = RUTAS.find(([patron]) => patron.test(location.hash));
  if (!ruta) {
    location.hash = '#/';
    return;
  }
  const [patron, crear, seccion] = ruta;
  document.body.classList.toggle('en-oficina', seccion === 'inicio');
  document.querySelectorAll('.navegacion a').forEach((a) => {
    const activo = a.dataset.seccion === seccion;
    a.classList.toggle('activo', activo);
    if (activo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  reemplazar(contenedor, h('p', { class: 'cargando' }, 'Cargando…'));
  try {
    vistaActual = await crear(...(location.hash.match(patron)?.slice(1) ?? []));
    reemplazar(contenedor, vistaActual.nodo);
    window.scrollTo(0, 0);
  } catch (error) {
    reemplazar(contenedor, bloqueError(error), h('p', {}, h('a', { href: '#/' }, 'Volver al inicio')));
  }
  actualizarPendientes();
}

/** El número junto a «Posts»: los encargos que esperan una decisión tuya en este modo. */
async function actualizarPendientes() {
  const marca = document.getElementById('nav-pendientes');
  try {
    const { encargos } = await api('GET', '/encargos');
    const pendientes = encargos.filter((e) => estadoDePaso(e.paso, e).clase === 'chip-toca').length;
    marca.hidden = pendientes === 0;
    marca.textContent = String(pendientes);
    marca.title = `${pendientes} esperan tu decisión`;
  } catch {
    marca.hidden = true;
  }
}

async function iniciarCabecera() {
  const interruptor = document.getElementById('modo-simulado');
  const claves = document.getElementById('estado-claves');
  const estudio = await api('GET', '/estudio');

  const pintar = (simulado) => {
    interruptor.checked = simulado;
    document.body.classList.toggle('simulado', simulado);
    const { fotoNueva } = estudio;
    reemplazar(
      claves,
      simulado
        ? 'Director, generador y revisor simulados'
        : [
            estudio.claves.gemini ? `Director: ${estudio.modelos.director}` : 'Sin clave de Gemini',
            ' · ',
            fotoNueva?.facturacion ? `Foto nueva: ${fotoNueva.modelo} (tope ${fotoNueva.topeUsd} USD)` : 'Foto nueva: sin facturación (importar a mano)',
          ],
    );
  };
  pintar(estudio.simulado);

  interruptor.addEventListener('change', async () => {
    try {
      const { simulado } = await api('PUT', '/estudio', { simulado: interruptor.checked });
      pintar(simulado);
      avisar(simulado ? 'Modo simulado: nada gasta y todo se guarda aparte.' : 'Modo real: el director y la foto nueva usan tus claves y sus topes.');
      // Cada modo tiene sus propios encargos y piezas: se vuelve al inicio para no seguir en uno del otro modo.
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
