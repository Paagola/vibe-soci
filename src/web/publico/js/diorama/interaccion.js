// Lo que la oficina cuenta al interactuar (anexo C): nada permanente, todo bajo demanda y anclado al mundo.
// - Al pasar por encima (o enfocar con el teclado) una estación: un rótulo pequeño con su nombre y su función.
// - Al pulsar: la cámara se acerca y aparece UNA tarjeta compacta pegada a la estación (sin taparla): qué hace ahora
//   (dato real de /api/procesos), qué pasa después en el recorrido real, si te toca decidir (botón amarillo a la
//   pantalla de esa parada del encargo) y lo último que entregó, con miniatura si hay imagen real.
// - Se cierra con Escape, al alejarse o al volver a la vista de héroe.
// - Lo único que se anuncia sin interacción son las paradas que te esperan: en la escena (zona y letrero amarillos) y,
//   si la estación queda fuera de cuadro, un indicador amarillo mínimo en el borde.
import { ORDEN, PUESTOS, PUESTO_DE_PASO } from './plano.js';

const ESTILO = `
.diorama-rotulo{position:absolute;z-index:4;pointer-events:none;transform:translate(-50%,calc(-100% - 10px));max-width:300px;padding:.45rem .7rem;border-radius:12px;background:rgb(12 16 30 / .9);color:#eef1f8;font:600 12.5px/1.35 Nunito,system-ui,sans-serif;box-shadow:0 0 0 1px rgb(255 255 255 / .08),0 12px 26px -12px rgb(0 0 0 / .8);opacity:0;transition:opacity .12s}
.diorama-rotulo b{font-weight:800}
.diorama-rotulo.visible{opacity:1}
.diorama-tarjeta{position:absolute;z-index:5;width:300px;max-width:calc(100% - 24px);padding:1rem 1.05rem .9rem;border-radius:20px;background:rgb(12 16 30 / .94);color:#eef1f8;font:600 13px/1.45 Nunito,system-ui,sans-serif;box-shadow:0 0 0 1px rgb(255 255 255 / .08),0 24px 48px -20px rgb(0 0 0 / .85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.diorama-tarjeta h2{margin:0 0 .15rem;padding-right:1.8rem;font:800 16px/1.25 Nunito,system-ui,sans-serif;letter-spacing:-.01em}
.diorama-tarjeta .funcion{margin:0 0 .7rem;color:#bac1d3;font-weight:600}
.diorama-tarjeta dl{margin:0;display:grid;gap:.55rem}
.diorama-tarjeta dt{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8b93a8}
.diorama-tarjeta dd{margin:.1rem 0 0}
.diorama-tarjeta .entrega{display:flex;gap:.6rem;align-items:flex-start}
.diorama-tarjeta .entrega img{width:56px;height:70px;object-fit:cover;border-radius:8px;flex:none;box-shadow:0 0 0 1px rgb(255 255 255 / .1)}
.diorama-tarjeta .hora{color:#8b93a8;font-size:11.5px}
.diorama-tarjeta .toca{margin-top:.75rem;padding:.7rem .75rem;border-radius:14px;background:rgb(245 197 24 / .1);box-shadow:inset 0 0 0 1px rgb(245 197 24 / .45)}
.diorama-tarjeta .toca p{margin:0 0 .55rem}
.diorama-tarjeta .boton-toca{display:inline-flex;align-items:center;gap:.4rem;min-height:38px;padding:.5rem 1rem;border-radius:999px;background:#f5c518;color:#151515;font:800 13px Nunito,system-ui,sans-serif;text-decoration:none}
.diorama-tarjeta .boton-toca:focus-visible{outline:2px solid #fff;outline-offset:2px}
.diorama-tarjeta .pie{display:flex;justify-content:space-between;align-items:center;margin-top:.8rem}
.diorama-tarjeta .volver{background:none;border:0;padding:.3rem 0;color:#8ba0ff;font:700 12.5px Nunito,system-ui,sans-serif;cursor:pointer}
.diorama-tarjeta .cerrar{position:absolute;top:.55rem;right:.55rem;width:30px;height:30px;border-radius:10px;border:0;background:transparent;color:#bac1d3;cursor:pointer;font-size:18px;line-height:1}
.diorama-tarjeta .cerrar:hover{background:rgb(255 255 255 / .06)}
.diorama-borde{position:absolute;z-index:4;display:none;align-items:center;gap:.35rem;padding:.35rem .65rem .35rem .45rem;border-radius:999px;border:0;background:#f5c518;color:#151515;font:800 12px Nunito,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 20px -8px rgb(0 0 0 / .7)}
.diorama-borde svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.diorama-estaciones{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
`;

/** Qué tiene que decidir la persona en cada paso donde la orden se para (textos de la pantalla de Posts). */
const QUE_DECIDIR = {
  REFERENCIA: 'Elige una referencia para este local (es obligatoria en sus cinco primeras piezas).',
  CONFIRMAR_ELEMENTOS: 'Confirma los elementos del plato, el prompt y el gasto de la foto nueva (o corrige la propuesta).',
  GENERAR: 'La foto nueva no se puede generar sola ahora: impórtala hecha a mano o revisa el generador.',
  CONFIRMAR_FOTO: 'Mira la foto nueva y confírmala, o recházala con un motivo.',
  INTENCION: 'La intención de diseño no pasó las comprobaciones: revísala a partir del borrador.',
  COMPONER: 'El compositor dio errores: corrige la intención y sube su versión.',
};

/** Matiz de lo que pasa después de cada paso (reglas reales del dominio). */
const MATIZ = {
  COMPROBAR: 'Si la descarta, la foto vuelve al generador (como mucho dos veces seguidas; después se para en la parada 1).',
  CONFIRMAR_FOTO: 'Si la rechazas, vuelve al generador.',
  INTENCION: 'Si su propuesta no pasa las comprobaciones, se le devuelve una vez.',
};

/** Distancia de la cámara al acercarse a una estación (con fov 26 caben unos 6 m de alto: estación, profesional y corredor). */
const DISTANCIA_FOCO = 12.5;

const hora = (fecha) => {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const h = (etiqueta, attrs = {}, ...hijos) => {
  const n = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const hijo of hijos.flat()) if (hijo !== null && hijo !== undefined && hijo !== false) n.append(hijo instanceof Node ? hijo : String(hijo));
  return n;
};

/** Lo que cuenta la tarjeta de una estación con el estado real y el encargo en foco. */
export function contenidoDe(id, estado, proyectoFoco) {
  const p = PUESTOS[id];
  const foco = (estado?.encargos ?? []).find((e) => e.proyecto === proyectoFoco) ?? null;
  const i = ORDEN.indexOf(p.paso);
  const plato = foco ? `«${foco.plato}»${foco.nombreLocal ? ` (${foco.nombreLocal})` : ''}` : '';
  let ahora;
  let toca = null;
  if (!foco) ahora = 'No hay ningún encargo en marcha: la estación está en reposo.';
  else {
    const j = ORDEN.indexOf(foco.paso);
    const t = foco.trabajo;
    if (foco.paso === p.paso) {
      if (t?.estado === 'EN_CURSO') ahora = `Trabajando en ${plato}: ${t.mensaje}`;
      else if (t?.estado === 'ERROR') ahora = `Se ha parado por un fallo en ${plato}: ${t.error?.message ?? 'error sin detalle'}`;
      else if (p.paso === 'HECHO') ahora = `Expone el post terminado de ${plato}.`;
      else {
        ahora = `Espera tu decisión sobre ${plato}.`;
        toca = { texto: QUE_DECIDIR[p.paso] ?? 'La orden se ha parado aquí: revisa el encargo.', href: `#/encargo/${foco.proyecto}` };
      }
    } else if (j > i) ahora = `Ya hizo su parte en ${plato}. Ahora no tiene trabajo.`;
    else ahora = `Aún no le ha llegado ${plato}. Ahora no tiene trabajo.`;
  }
  const siguiente = ORDEN[i + 1];
  const despues = siguiente
    ? `${PUESTOS[PUESTO_DE_PASO[siguiente]].nombre}: ${PUESTOS[PUESTO_DE_PASO[siguiente]].funcion}${MATIZ[p.paso] ? ` ${MATIZ[p.paso]}` : ''}`
    : 'Es el final del recorrido: el post queda expuesto y se publica a mano, con tu visto bueno.';
  // Lo último que entregó: la última nota real de su paso en el encargo en foco y, si la hay, su imagen real.
  const nota = foco ? [...(foco.recorrido ?? [])].reverse().find((r) => r.paso === p.paso && r.nota) : null;
  const img = foco?.imagenes ?? {};
  const ultimaFoto = img.intentos?.at?.(-1)?.url ?? null;
  const imagen = { referencia: img.referencia, entrada: img.subida, generador: ultimaFoto, revisor: ultimaFoto, parada2: ultimaFoto, mascara: img.mascara, compositor: img.post, salida: img.post }[id] ?? null;
  const entrega = nota ? { texto: nota.nota, fecha: nota.fecha, imagen: foco?.paso && ORDEN.indexOf(foco.paso) >= i ? imagen : null } : null;
  return { nombre: p.nombre, funcion: p.funcion, ahora, despues, toca, entrega };
}

export function crearInteraccion({ raiz, lienzo, escena, redibujar }) {
  if (!document.getElementById('diorama-interaccion')) {
    const e = document.createElement('style');
    e.id = 'diorama-interaccion';
    e.textContent = ESTILO;
    document.head.append(e);
  }
  const rotulo = h('div', { class: 'diorama-rotulo', 'aria-hidden': 'true' });
  const borde = h('button', { class: 'diorama-borde', type: 'button' });
  borde.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span>Te toca</span>';
  // Una lista de botones (solo para el teclado y los lectores de pantalla): una por estación.
  const lista = h('div', { class: 'diorama-estaciones', role: 'group', 'aria-label': 'Estaciones de la oficina' });
  for (const [id, p] of Object.entries(PUESTOS)) {
    lista.append(h('button', { type: 'button', 'data-estacion': id, onfocus: () => mostrarRotulo(id), onblur: () => mostrarRotulo(null), onclick: () => abrir(id) }, p.nombre));
  }
  raiz.append(rotulo, borde, lista);

  let encima = null;
  let abierta = null; // { id, nodo }
  let tween = null;
  const ocultos = new Set();

  function aPantalla(id) {
    const v = escena.proyectar(escena.anclaDe(id));
    const r = lienzo.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, delante: v.delante, w: r.width, h: r.height };
  }
  function mostrarRotulo(id) {
    encima = id;
    if (!id) {
      rotulo.classList.remove('visible');
      return;
    }
    const p = PUESTOS[id];
    rotulo.replaceChildren(h('b', {}, p.nombre), ' · ', p.funcion);
    colocarRotulo();
    rotulo.classList.add('visible');
  }
  function colocarRotulo() {
    if (!encima || abierta?.id === encima) {
      rotulo.classList.remove('visible');
      return;
    }
    const s = aPantalla(encima);
    rotulo.style.left = `${Math.min(s.w - 160, Math.max(160, s.x))}px`;
    rotulo.style.top = `${Math.max(60, s.y)}px`;
  }

  // ---------------------------------------------------------------- Cámara: acercarse a una estación y volver

  function vistaDe(id) {
    const r = PUESTOS[id].ocupa[0];
    const objetivo = new escena.THREE.Vector3((r.x0 + r.x1) / 2, 0.9, (r.z0 + r.z1) / 2);
    const dir = new escena.THREE.Vector3(Math.cos(0.68) * Math.cos(0.98), Math.sin(0.68), Math.cos(0.68) * Math.sin(0.98));
    // Un poco hacia el pasillo (donde está la entrega): así entran la estación, su profesional y el corredor.
    const e = PUESTOS[id].entrega;
    objetivo.lerp(new escena.THREE.Vector3(e.x, 0.9, e.z), 0.3);
    return { objetivo, posicion: objetivo.clone().addScaledVector(dir, DISTANCIA_FOCO) };
  }
  function moverCamara(destino, alTerminar) {
    const orbit = escena.orbit;
    const c = escena.camera;
    const desde = { pos: c.position.clone(), obj: orbit.controls.target.clone() };
    const reducido = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const inicio = performance.now();
    const dur = reducido ? 0 : 750;
    cancelAnimationFrame(tween);
    const paso = (ahora) => {
      const u = dur ? Math.min(1, (ahora - inicio) / dur) : 1;
      const e = u * u * (3 - 2 * u);
      c.position.lerpVectors(desde.pos, destino.posicion, e);
      orbit.controls.target.lerpVectors(desde.obj, destino.objetivo, e);
      orbit.controls.update();
      redibujar();
      if (u < 1) tween = requestAnimationFrame(paso);
      else {
        tween = null;
        alTerminar?.();
      }
    };
    tween = requestAnimationFrame(paso);
  }
  /** Oculta lo que se interpone entre la cámara y el objetivo (árboles, pérgola, pilares, cristaleras), como los muros. */
  function despejar(id) {
    mostrarOcultos();
    const THREE = escena.THREE;
    const cam = escena.camera.position;
    const rayo = new THREE.Ray();
    const caja = new THREE.Box3();
    const punto = new THREE.Vector3();
    // Toda la estación: las esquinas de lo que ocupa (a dos alturas), su profesional y la entrega del corredor.
    const p = PUESTOS[id];
    const puntos = [];
    for (const r of p.ocupa) for (const x of [r.x0, (r.x0 + r.x1) / 2, r.x1]) for (const z of [r.z0, r.z1]) for (const y of [0.4, 1.4]) puntos.push(new THREE.Vector3(x, y, z));
    for (const q of [p.entrega, p.operario].filter(Boolean)) for (const y of [0.3, 1.2]) puntos.push(new THREE.Vector3(q.x, y, q.z));
    for (const o of escena.decorado.ocultables) {
      caja.setFromObject(o);
      for (const p of puntos) {
        rayo.set(cam, p.clone().sub(cam).normalize());
        if (rayo.intersectBox(caja, punto) && punto.distanceTo(cam) < p.distanceTo(cam)) {
          o.visible = false;
          ocultos.add(o);
          break;
        }
      }
    }
  }
  function mostrarOcultos() {
    for (const o of ocultos) o.visible = true;
    ocultos.clear();
  }

  // ---------------------------------------------------------------- La tarjeta

  function tarjeta(id) {
    const c = contenidoDe(id, escena.estado, escena.guion.proyecto);
    const nodo = h(
      'section',
      { class: 'diorama-tarjeta', role: 'dialog', 'aria-label': c.nombre },
      h('button', { class: 'cerrar', type: 'button', 'aria-label': 'Cerrar', onclick: () => cerrar(true) }, '×'),
      h('h2', {}, c.nombre),
      h('p', { class: 'funcion' }, c.funcion),
      h(
        'dl',
        {},
        h('div', {}, h('dt', {}, 'Ahora'), h('dd', {}, c.ahora)),
        h('div', {}, h('dt', {}, 'Después'), h('dd', {}, c.despues)),
        c.entrega
          ? h('div', {}, h('dt', {}, 'Lo último que entregó'), h('dd', { class: 'entrega' }, c.entrega.imagen ? h('img', { src: c.entrega.imagen, alt: '' }) : null, h('span', {}, c.entrega.texto, h('br'), h('span', { class: 'hora' }, hora(c.entrega.fecha)))))
          : null,
      ),
      c.toca ? h('div', { class: 'toca' }, h('p', {}, h('b', {}, 'Te toca. '), c.toca.texto), h('a', { class: 'boton-toca', href: c.toca.href }, 'Ir a la parada del encargo →')) : null,
      h('div', { class: 'pie' }, h('button', { class: 'volver', type: 'button', onclick: () => cerrar(true) }, '← Vista general')),
    );
    return nodo;
  }
  function abrir(id) {
    cerrar(false);
    const nodo = tarjeta(id);
    raiz.append(nodo);
    abierta = { id, nodo };
    mostrarRotulo(null);
    const vista = vistaDe(id);
    moverCamara(vista, () => {
      despejar(id);
      colocarTarjeta();
      redibujar();
    });
    colocarTarjeta();
    nodo.querySelector('.boton-toca, .volver')?.focus({ preventScroll: true });
  }
  function colocarTarjeta() {
    if (!abierta) return;
    const s = aPantalla(abierta.id);
    const w = abierta.nodo.offsetWidth || 300;
    const alto = abierta.nodo.offsetHeight || 280;
    // Al lado de la estación, fuera del rectángulo que ocupa en pantalla (con su profesional y el corredor): nunca encima.
    const r = escena.rectanguloDe(abierta.id);
    const izq = ((r.x0 + 1) / 2) * s.w;
    const der = ((r.x1 + 1) / 2) * s.w;
    const margen = 18;
    const caben = { derecha: s.w - der - margen - 12 >= w, izquierda: izq - margen - 84 >= w };
    const x = caben.derecha ? der + margen : caben.izquierda ? izq - margen - w : Math.max(84, s.w - w - 12);
    const y = Math.min(s.h - alto - 70, Math.max(70, s.y - alto / 2));
    abierta.nodo.style.left = `${x}px`;
    abierta.nodo.style.top = `${y}px`;
  }
  /** Cierra la tarjeta. Con `volver`, la cámara regresa a la vista de héroe. */
  function cerrar(volver) {
    if (!abierta) return;
    const id = abierta.id;
    abierta.nodo.remove();
    abierta = null;
    mostrarOcultos();
    if (volver) {
      escena.salirDeVistaLibre();
      moverCamara({ posicion: escena.orbit.heroPosition.clone(), objetivo: escena.orbit.heroTarget.clone() });
      lista.querySelector(`[data-estacion="${id}"]`)?.focus({ preventScroll: true });
    }
    redibujar();
  }

  // ---------------------------------------------------------------- El aviso del borde (parada pendiente fuera de cuadro)

  function estacionQueEspera() {
    const foco = (escena.estado?.encargos ?? []).find((e) => e.proyecto === escena.guion.proyecto);
    if (!foco || foco.paso === 'HECHO' || foco.trabajo?.estado === 'EN_CURSO') return null;
    return PUESTO_DE_PASO[foco.paso] ?? null;
  }
  function colocarBorde() {
    const id = estacionQueEspera();
    if (!id || abierta?.id === id) {
      borde.style.display = 'none';
      return;
    }
    const s = aPantalla(id);
    const fuera = !s.delante || s.x < 0 || s.x > s.w || s.y < 0 || s.y > s.h;
    if (!fuera) {
      borde.style.display = 'none';
      return;
    }
    const x = Math.min(s.w - 110, Math.max(60, s.x));
    const y = Math.min(s.h - 50, Math.max(64, s.y));
    const ang = Math.atan2(s.y - y, s.x - x);
    borde.style.display = 'inline-flex';
    borde.style.left = `${x - 40}px`;
    borde.style.top = `${y - 16}px`;
    borde.querySelector('svg').style.transform = `rotate(${ang}rad)`;
    borde.onclick = () => abrir(id);
    borde.setAttribute('aria-label', `Te toca: ${PUESTOS[id].nombre}`);
  }

  // ---------------------------------------------------------------- Eventos

  let pendiente = 0;
  function alMover(e) {
    if (pendiente) return;
    pendiente = requestAnimationFrame(() => {
      pendiente = 0;
      const r = lienzo.getBoundingClientRect();
      const id = escena.estacionEn(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (id !== encima) mostrarRotulo(id);
      lienzo.style.cursor = id ? 'pointer' : '';
    });
  }
  function alPulsar(e) {
    const r = lienzo.getBoundingClientRect();
    const id = escena.estacionEn(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (id) abrir(id);
    else if (abierta) cerrar(true);
  }
  function alTeclear(e) {
    if (e.key === 'Escape' && abierta) {
      e.preventDefault();
      cerrar(true);
    }
  }
  lienzo.addEventListener('pointermove', alMover);
  lienzo.addEventListener('pointerleave', () => mostrarRotulo(null));
  document.addEventListener('keydown', alTeclear);

  return {
    alPulsar,
    /** Cada fotograma (o cada cambio de cámara): reubica el rótulo, la tarjeta y el aviso del borde. */
    colocar() {
      colocarRotulo();
      colocarTarjeta();
      colocarBorde();
      // Al alejarse mucho de la estación, la tarjeta se cierra sola.
      if (abierta && !tween) {
        const d = escena.camera.position.distanceTo(escena.orbit.controls.target);
        if (d > DISTANCIA_FOCO * 1.6) cerrar(false);
      }
    },
    /** Con un estado nuevo, la tarjeta abierta se rehace con los datos frescos. */
    refrescar() {
      if (!abierta) return;
      const nueva = tarjeta(abierta.id);
      abierta.nodo.replaceWith(nueva);
      abierta.nodo = nueva;
      colocarTarjeta();
    },
    abrir,
    cerrar,
    destruir() {
      cancelAnimationFrame(tween);
      cancelAnimationFrame(pendiente);
      document.removeEventListener('keydown', alTeclear);
      mostrarOcultos();
      rotulo.remove();
      borde.remove();
      lista.remove();
      abierta?.nodo.remove();
    },
  };
}
