// montarDiorama(contenedor, { obtenerEstado }): la oficina 3D del estudio (la portada, a pantalla completa).
//
// Este módulo es ligero a propósito: no importa three.js. La escena (three.js r170 vendorizado, ~690 KB) se carga
// con import() solo cuando el hueco se ve en pantalla. Después:
// - pide el estado cada `intervaloMs` (por defecto GET /api/procesos) solo mientras se ve y la pestaña está activa;
// - dibuja a como mucho `fpsMax` fotogramas por segundo y se para si el hueco o la pestaña no se ven;
// - con prefers-reduced-motion no anima: pinta un fotograma fijo con el estado actual cada vez que cambia;
// - controles discretos: pausa, recolocar la cámara y la órbita libre del kit (arrastrar; flechas y R en el lienzo).
//
// Necesita en la página el importmap de three:
//   <script type="importmap">{"imports":{"three":"/vendor/three/three.module.min.js","three/addons/":"/vendor/three/addons/"}}</script>

const ESTILO = `
.diorama-raiz{position:relative;width:100%;height:100%;min-height:240px;overflow:hidden;contain:strict}
.diorama-raiz canvas{display:block;width:100%;height:100%;outline:none;touch-action:none;cursor:grab}
.diorama-raiz canvas:active{cursor:grabbing}
.diorama-raiz canvas:focus-visible{box-shadow:inset 0 0 0 2px #1033ef}
.diorama-controles{position:absolute;bottom:14px;right:14px;display:flex;gap:6px;opacity:.6;transition:opacity .2s;z-index:3}
.diorama-raiz:hover .diorama-controles,.diorama-controles:focus-within{opacity:1}
.diorama-controles button{width:32px;height:32px;border-radius:10px;border:1px solid rgb(255 255 255 / .16);background:rgb(16 18 28 / .72);color:#f2f1ec;display:grid;place-items:center;cursor:pointer;padding:0}
.diorama-controles button:hover{background:rgb(16 18 28 / .92)}
.diorama-controles button:focus-visible{outline:2px solid #1033ef;outline-offset:2px}
.diorama-controles svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.diorama-estado{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
`;

const ICONO = {
  pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  seguir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>',
  camara: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/></svg>',
};

const porDefecto = () => fetch('/api/procesos', { headers: { Accept: 'application/json' } }).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

export function montarDiorama(contenedor, opciones = {}) {
  const {
    obtenerEstado = porDefecto,
    intervaloMs = 2000,
    fpsMax = 30,
    maxDpr = 1.5,
    sombras = true,
    /** Hora del día para la luz de ambiente (por defecto, la del navegador). Solo para QA. */
    hora = new Date().getHours(),
    movimientoReducido = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    /** Para QA: carga ya, sin esperar a que se vea, y no pide estado (se lo da quien llama). */
    manual = false,
  } = opciones;

  if (!document.getElementById('diorama-estilo')) {
    const estilo = document.createElement('style');
    estilo.id = 'diorama-estilo';
    estilo.textContent = ESTILO;
    document.head.append(estilo);
  }
  const raiz = document.createElement('div');
  raiz.className = 'diorama-raiz';
  const lienzo = document.createElement('canvas');
  lienzo.setAttribute('role', 'img');
  lienzo.setAttribute('aria-label', 'Cómo trabaja el estudio: los puestos de la orden única y el material pasando de uno a otro. Arrastra para girar la vista; R la recoloca.');
  lienzo.tabIndex = 0;
  const controles = document.createElement('div');
  controles.className = 'diorama-controles';
  const botonPausa = boton(movimientoReducido ? 'seguir' : 'pausa', movimientoReducido ? 'Animar' : 'Pausar');
  const botonCamara = boton('camara', 'Recolocar la cámara');
  controles.append(botonPausa, botonCamara);
  const linea = document.createElement('p');
  linea.className = 'diorama-estado';
  linea.setAttribute('aria-live', 'polite');
  raiz.append(lienzo, controles, linea);
  contenedor.append(raiz);

  let escena = null;
  let interaccion = null;
  let cargando = null;
  let visible = false;
  let pestanaVisible = document.visibilityState !== 'hidden';
  let pausado = movimientoReducido;
  let reloj = 0; // segundos de escena
  let ultimoReal = 0;
  let frame = 0;
  let sondeo = 0;
  let destruido = false;
  let ultimoEstado = null;
  const medidas = { fotogramas: 0, msDibujo: 0, desde: performance.now() };

  function boton(icono, etiqueta) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = ICONO[icono];
    b.setAttribute('aria-label', etiqueta);
    b.title = etiqueta;
    return b;
  }

  async function cargar() {
    cargando ??= Promise.all([import('./escena.js'), import('./interaccion.js')]).then(([{ crearEscena }, { crearInteraccion }]) => {
      if (destruido) return null;
      escena = crearEscena(lienzo, { maxDpr, sombras, hora, alCargarImagen: () => dibujarSiQuieto() });
      ajustar();
      escena.activarOrbita(
        () => {
          if (pausado || !activo()) dibujarAhora();
        },
        (e) => interaccion?.alPulsar(e),
      );
      interaccion = crearInteraccion({ raiz, lienzo, escena, redibujar: () => dibujarSiQuieto() });
      if (ultimoEstado) escena.actualizar(ultimoEstado, reloj);
      dibujarAhora();
      return escena;
    });
    return cargando;
  }

  const activo = () => visible && pestanaVisible && !destruido;

  function ajustar() {
    if (!escena) return;
    const r = raiz.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    escena.tamano(r.width, r.height);
  }

  /** En movimiento reducido: un fotograma fijo con el último estado ya asentado (sin repetir el recorrido). */
  function tiempoFijo() {
    const ultimo = escena.guion.segmentos.at(-1);
    return Number.isFinite(ultimo.t0) ? ultimo.t0 + 1 : 0;
  }

  function dibujarAhora() {
    if (!escena) return;
    const t0 = performance.now();
    escena.dibujar(movimientoReducido && pausado ? tiempoFijo() : reloj);
    interaccion?.colocar();
    medidas.fotogramas++;
    medidas.msDibujo += performance.now() - t0;
  }

  function dibujarSiQuieto() {
    if (escena && (pausado || !activo() || !frame)) dibujarAhora();
  }

  function bucle(ahora) {
    frame = 0;
    if (!activo() || pausado || !escena) return;
    const paso = 1000 / fpsMax;
    if (ahora - ultimoReal >= paso - 1) {
      reloj += Math.min(0.1, (ahora - (ultimoReal || ahora)) / 1000);
      ultimoReal = ahora;
      dibujarAhora();
    }
    frame = requestAnimationFrame(bucle);
  }
  function arrancar() {
    if (frame || !activo() || pausado) return;
    ultimoReal = 0;
    frame = requestAnimationFrame(bucle);
  }
  function parar() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  async function consultar() {
    if (manual || !activo()) return;
    try {
      const estado = await obtenerEstado();
      escena?.ponerConexion(true);
      aplicarEstado(estado);
    } catch (error) {
      // Desconexión: la oficina lo cuenta en la recepción (rótulo y piloto en rojo) y deja de fingir actividad.
      escena?.ponerConexion(false);
      linea.textContent = `Sin conexión con el estudio (${error.message ?? error})`;
      dibujarSiQuieto();
    }
  }
  function aplicarEstado(estado, t = reloj) {
    ultimoEstado = estado;
    linea.textContent = resumen(estado);
    if (!escena) return false;
    const cambio = escena.actualizar(estado, t);
    if (cambio) {
      interaccion?.refrescar();
      dibujarSiQuieto();
    }
    return cambio;
  }
  function programarSondeo() {
    clearInterval(sondeo);
    sondeo = 0;
    if (manual || !activo()) return;
    consultar();
    sondeo = setInterval(consultar, intervaloMs);
  }

  const observador = new IntersectionObserver((entradas) => {
    visible = entradas.some((e) => e.isIntersecting);
    if (visible) {
      cargar().then(() => {
        programarSondeo();
        arrancar();
      });
    } else {
      parar();
      programarSondeo();
    }
  });
  observador.observe(raiz);
  const tamanoObs = new ResizeObserver(() => {
    ajustar();
    if (!frame) dibujarAhora();
  });
  tamanoObs.observe(raiz);
  const alCambiarPestana = () => {
    pestanaVisible = document.visibilityState !== 'hidden';
    if (activo()) {
      programarSondeo();
      arrancar();
    } else {
      parar();
      programarSondeo();
    }
  };
  document.addEventListener('visibilitychange', alCambiarPestana);

  botonPausa.addEventListener('click', () => {
    pausado = !pausado;
    botonPausa.innerHTML = ICONO[pausado ? 'seguir' : 'pausa'];
    const etiqueta = pausado ? 'Seguir' : 'Pausar';
    botonPausa.setAttribute('aria-label', etiqueta);
    botonPausa.title = etiqueta;
    if (pausado) {
      parar();
      dibujarAhora();
    } else arrancar();
  });
  botonCamara.addEventListener('click', () => {
    interaccion?.cerrar(false);
    escena?.salirDeVistaLibre();
    escena?.orbit?.reset();
    dibujarAhora();
  });

  if (manual) cargar();

  return {
    /** Para pruebas y QA: la escena (cuando ya está cargada). */
    get escena() {
      return escena;
    },
    cargar,
    aplicarEstado,
    /** Congela la escena en `t` (segundos de escena) y dibuja de inmediato. */
    congelar(t, recolocar = true) {
      pausado = true;
      parar();
      reloj = t;
      if (escena) {
        if (recolocar) escena.orbit?.reset();
        escena.dibujar(t);
      }
    },
    medidas() {
      const s = (performance.now() - medidas.desde) / 1000;
      return { fps: +(medidas.fotogramas / s).toFixed(1), msPorFotograma: +(medidas.msDibujo / Math.max(1, medidas.fotogramas)).toFixed(2), fotogramas: medidas.fotogramas };
    },
    reiniciarMedidas() {
      Object.assign(medidas, { fotogramas: 0, msDibujo: 0, desde: performance.now() });
    },
    /** La vista de la oficina (vistas/oficina.js) lo llama así al cambiar de pantalla. */
    desmontar() {
      this.destruir();
    },
    destruir() {
      destruido = true;
      parar();
      clearInterval(sondeo);
      observador.disconnect();
      tamanoObs.disconnect();
      document.removeEventListener('visibilitychange', alCambiarPestana);
      interaccion?.destruir();
      escena?.liberar();
      raiz.remove();
    },
  };
}

/** La línea de texto al pie del hueco: qué encargo se enseña y por dónde va (para quien no ve la escena). */
function resumen(estado) {
  const lista = estado?.encargos ?? [];
  const enCurso = lista.find((e) => e.trabajo?.estado === 'EN_CURSO');
  const e = enCurso ?? lista.find((x) => x.paso !== 'HECHO');
  if (!e) return lista.length ? 'Estudio en reposo · último post terminado en la bandeja de salida' : 'Estudio en reposo · ningún encargo';
  const que = enCurso ? e.trabajo.mensaje : e.paso === 'CONFIRMAR_ELEMENTOS' || e.paso === 'CONFIRMAR_FOTO' ? 'te toca confirmar' : e.trabajo?.estado === 'ERROR' ? `fallo: ${e.trabajo.error?.message ?? ''}` : `parado en ${e.paso}`;
  return `${e.nombreLocal ?? e.local} · ${que}`;
}
