// Inicio: el panel de control del estudio. Solo datos reales del modo activo (encargos, locales, comprobaciones) y los
// registros de gasto; lo que no consta no se pinta, o se dice que no hay. Cada tarjeta dice de dónde sale su dato.
import { api } from '../api.js';
import { huecoDiorama } from '../diorama-hueco.js';
import { estadoDePaso, FASES, indiceDeFase } from '../orden.js';
import { conBoton, h } from '../ui.js';

const nf = (n, decimales = 0) => Number(n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const FLECHA = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  const trazo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trazo.setAttribute('d', 'M5 12h14M13 6l6 6-6 6');
  svg.append(trazo);
  return svg;
};

export async function vistaPanel() {
  const [{ encargos }, panel, estudio] = await Promise.all([api('GET', '/encargos'), api('GET', '/panel'), api('GET', '/estudio')]);
  const diorama = huecoDiorama();
  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const modo = panel.modo === 'SIMULADO' ? 'modo simulado' : 'modo real';
  const vacio = encargos.length === 0;

  const nodo = h(
    'div',
    { class: 'inicio' },
    h(
      'div',
      { class: 'cabeza-pantalla' },
      h('div', {}, h('p', { class: 'sobretitulo' }, `${hoy} · ${modo}`), h('h1', {}, 'Qué hacer hoy'), h('p', { class: 'entrada' }, 'Lo que espera tu decisión, cómo van los encargos y lo gastado. Cada dato dice de dónde sale.')),
      // Sin encargos, la acción principal está en la bienvenida: un solo botón amarillo por pantalla.
      vacio ? null : h('div', { class: 'acciones' }, h('a', { class: 'boton primario', href: panel.locales.length ? '#/nuevo' : '#/local' }, panel.locales.length ? 'Nuevo post' : 'Crea antes un local')),
    ),
    h(
      'div',
      { class: 'inicio-rejilla' },
      h(
        'div',
        { class: 'inicio-principal' },
        vacio ? bienvenida(panel, estudio) : teToca(encargos),
        h('div', { class: 'inicio-par' }, porFase(encargos, modo), comprobaciones(panel.comprobaciones, modo)),
        locales(panel.locales, modo),
        gasto(panel.gasto),
      ),
      diorama.nodo,
    ),
  );
  return { nodo, salir: diorama.salir };
}

// ---------------------------------------------------------------- Te toca (el foco de la pantalla, bloque oscuro)

function teToca(encargos) {
  const pendientes = encargos.filter((e) => estadoDePaso(e.paso, e).clase === 'chip-toca');
  const enMarcha = encargos.filter((e) => e.paso !== 'HECHO' && !pendientes.includes(e)).length;
  return h(
    'section',
    { class: 'te-toca' },
    h(
      'div',
      { class: 'te-toca-cifra' },
      h('p', { class: 'sobretitulo' }, 'Te toca'),
      h('p', { class: 'cifra-grande' }, String(pendientes.length)),
      h('p', {}, pendientes.length === 1 ? 'encargo espera tu decisión' : 'encargos esperan tu decisión'),
      enMarcha ? h('p', { class: 'te-toca-nota' }, `${enMarcha} más en marcha, hasta su próxima parada.`) : null,
    ),
    pendientes.length
      ? h(
          'ol',
          { class: 'te-toca-lista' },
          pendientes.slice(0, 4).map((e) =>
            h(
              'li',
              {},
              h(
                'a',
                { href: `#/encargo/${e.proyecto}` },
                e.miniatura ? h('img', { src: e.miniatura, alt: '', loading: 'lazy' }) : h('span', { class: 'sin-imagen' }),
                h('span', { class: 'te-toca-texto' }, h('b', {}, e.plato), h('span', {}, `${e.nombreLocal ?? e.local} · ${estadoDePaso(e.paso, e).texto}`)),
                h('span', { class: 'boton-ir' }, FLECHA()),
              ),
            ),
          ),
          pendientes.length > 4 ? h('li', { class: 'te-toca-mas' }, h('a', { href: '#/posts' }, `Ver los ${pendientes.length}`)) : null,
        )
      : h('p', { class: 'te-toca-nada' }, 'Nada te espera ahora. Los encargos siguen solos hasta su próxima parada.'),
  );
}

/** Sin encargos: la bienvenida, con la mascota y el grafiti como acento y la única acción amarilla. */
function bienvenida(panel, estudio) {
  const ejemplo = (evento) =>
    conBoton(evento.currentTarget, async () => {
      await api('POST', '/locales/ejemplo');
      location.hash = '#/nuevo';
    });
  const conLocal = panel.locales.length > 0;
  return h(
    'section',
    { class: 'bienvenida' },
    h(
      'div',
      { class: 'bienvenida-texto' },
      h('p', { class: 'sobretitulo' }, 'Para empezar'),
      h('h2', {}, 'De la foto del plato a un post de estudio'),
      h('p', {}, 'Sube la foto como la hizo el local. El estudio hace otra foto del mismo plato y monta el post sobre una referencia, parándose dos veces para que confirmes.'),
      h(
        'div',
        { class: 'acciones' },
        conLocal ? h('a', { class: 'boton primario', href: '#/nuevo' }, 'Nuevo post') : null,
        !conLocal && estudio.simulado ? h('button', { class: 'primario', onclick: ejemplo }, 'Usar el local de ejemplo') : null,
        !conLocal ? h('a', { class: `boton ${estudio.simulado ? 'secundario' : 'primario'}`, href: '#/local' }, 'Dar de alta un local') : null,
      ),
    ),
    h('img', { class: 'bienvenida-mascota', src: '/img/mascota-movil.png', alt: '', width: '247', height: '320' }),
  );
}

// ---------------------------------------------------------------- Encargos por fase

function porFase(encargos, modo) {
  const cuenta = FASES.map((f) => encargos.filter((e) => indiceDeFase(e.fase) === indiceDeFase(f.id)).length);
  const maximo = Math.max(1, ...cuenta);
  return h(
    'section',
    { class: 'tarjeta-dato' },
    cabeza('Encargos por fase', `${nf(encargos.length)} en total`),
    encargos.length
      ? h(
          'ol',
          { class: 'barras' },
          FASES.map((f, i) =>
            h(
              'li',
              {},
              h('span', { class: 'barras-nombre' }, f.nombre),
              h('span', { class: 'barras-pista' }, h('span', { class: 'barras-relleno', style: { width: `${(cuenta[i] / maximo) * 100}%` } })),
              h('b', {}, nf(cuenta[i])),
            ),
          ),
        )
      : h('p', { class: 'nota vacio-dato' }, 'Aún no hay encargos.'),
    fuente(`Encargos del ${modo}`),
  );
}

// ---------------------------------------------------------------- Comprobación de salida

const VEREDICTOS = [
  ['PASA', 'Pasan'],
  ['REVISAR', 'A revisar'],
  ['DESCARTA', 'Descartadas'],
  ['RECHAZADA', 'Rechazadas por ti'],
  ['PENDIENTE', 'Sin comprobar'],
];

function comprobaciones(c, modo) {
  return h(
    'section',
    { class: 'tarjeta-dato' },
    cabeza('Comprobación de las fotos', `${nf(c.total)} foto${c.total === 1 ? '' : 's'} nueva${c.total === 1 ? '' : 's'}`),
    c.total
      ? [
          h('div', { class: 'reparto', role: 'img', 'aria-label': VEREDICTOS.map(([k, n]) => `${n}: ${c[k]}`).join(', ') }, VEREDICTOS.filter(([k]) => c[k]).map(([k]) => h('span', { class: `reparto-${k.toLowerCase()}`, style: { flexGrow: String(c[k]) } }))),
          h(
            'ul',
            { class: 'leyenda' },
            VEREDICTOS.map(([k, n]) => h('li', { class: c[k] ? '' : 'cero' }, h('i', { class: `reparto-${k.toLowerCase()}` }), h('span', {}, n), h('b', {}, nf(c[k])))),
          ),
        ]
      : h('p', { class: 'nota vacio-dato' }, 'Aún no se ha hecho ninguna foto nueva en este modo.'),
    fuente(`Intentos de foto de los encargos del ${modo}. El veredicto automático solo filtra: el tuyo manda.`),
  );
}

// ---------------------------------------------------------------- Locales y la regla de las 5 referencias

function locales(lista, modo) {
  return h(
    'section',
    { class: 'tarjeta-dato' },
    cabeza('Locales y referencia obligatoria', 'Las 5 primeras piezas de cada local parten de una referencia'),
    lista.length
      ? h(
          'div',
          { class: 'tabla-desliza' },
          h(
            'table',
            { class: 'tabla tabla-locales' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Local'), h('th', {}, 'Piezas que cuentan'), h('th', { class: 'cifra' }, 'Referencias'), h('th', {}, 'Referencia'))),
            h('tbody', {}, lista.map(filaDeLocal)),
          ),
        )
      : h('p', { class: 'nota vacio-dato' }, 'Aún no hay locales en este modo.'),
    fuente(`Locales del ${modo}; piezas de la app y de las herramientas (plan.json), como cuenta la regla del 09/11.`),
  );
}

function filaDeLocal(l) {
  const total = l.piezas?.total ?? null;
  const umbral = l.umbral ?? 5;
  const quedan = total === null ? null : Math.max(0, umbral - total);
  const progreso =
    total === null
      ? h('span', { class: 'nota' }, 'No se ha podido leer')
      : h(
          'div',
          { class: 'progreso', title: `${total} de ${umbral}: ${l.piezas.app} de la app y ${l.piezas.herramientas} con herramientas` },
          h('span', { class: 'progreso-pista' }, h('span', { class: 'progreso-relleno', style: { width: `${Math.min(1, total / umbral) * 100}%` } })),
          h('b', {}, `${nf(total)}/${umbral}`),
        );
  const estado = quedan === null ? '—' : quedan > 0 ? h('span', { class: 'chip' }, `Obligatoria · quedan ${quedan}`) : h('span', { class: 'chip chip-ok' }, 'Ya no es obligatoria');
  return h('tr', {}, h('td', {}, h('b', {}, l.nombre), h('small', {}, l.ciudad)), h('td', {}, progreso), h('td', { class: 'cifra' }, nf(l.referencias)), h('td', {}, estado));
}

// ---------------------------------------------------------------- Gasto registrado

function gasto(g) {
  const { higgsfield: hf, geminiImagen: gi, geminiTexto: gt } = g;
  const tiles = [
    hf.api.peticiones
      ? tile('Higgsfield · API', `${nf(hf.api.estimadoUsd, 2)} USD`, `estimado · ${nf(hf.api.peticiones)} ${hf.api.peticiones === 1 ? 'imagen' : 'imágenes'}`, 'gasto/higgsfield.jsonl')
      : null,
    hf.mcp.peticiones ? tile('Higgsfield · MCP', `${nf(hf.mcp.creditos)} créditos`, `${nf(hf.mcp.peticiones)} imágenes · sin precio en USD confirmado`, 'gasto/higgsfield.jsonl') : null,
    tile('Gemini · foto nueva', `${nf(gi.gastadoUsd, 2)} USD`, `de ${nf(gi.topeUsd, 2)} USD de tope · facturación ${gi.facturacion ? 'activada' : 'desactivada'}`, 'gasto/gemini.jsonl'),
    gt.llamadas
      ? tile('Gemini · texto y visión', `${nf(gt.llamadas)} llamada${gt.llamadas === 1 ? '' : 's'}`, `${nf(gt.tokensEntrada + gt.tokensSalida)} tokens · ${gt.dePago ? `${gt.dePago} de pago` : 'tier gratuito'}; sin tarifa comprobada, sin precio`, 'gasto/gemini-texto.jsonl')
      : null,
  ].filter(Boolean);
  return h(
    'section',
    { class: 'tarjeta-dato' },
    cabeza('Gasto registrado', 'Real, de todo el estudio: el modo simulado no gasta'),
    h('div', { class: 'tiles' }, tiles),
    fuente('Registros de datos/gasto/. Higgsfield por la API apunta un importe estimado; por el MCP, créditos.'),
  );
}

function tile(titulo, valor, detalle, origen) {
  return h('div', { class: 'tile' }, h('p', { class: 'tile-titulo' }, titulo), h('p', { class: 'tile-valor' }, valor), h('p', { class: 'tile-detalle' }, detalle), h('p', { class: 'tile-origen mono' }, origen));
}

// ---------------------------------------------------------------- Ayudantes

const cabeza = (titulo, sub) => h('header', { class: 'tarjeta-cabeza' }, h('h2', {}, titulo), sub ? h('p', { class: 'nota' }, sub) : null);
const fuente = (texto) => h('p', { class: 'fuente' }, texto);
