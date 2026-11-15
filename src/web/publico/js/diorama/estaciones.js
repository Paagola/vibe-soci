// Las once estaciones de la orden única, cada una con identidad propia (no la misma mesa con otros objetos).
// Marco local: +Z es por donde llega el corredor. Cada constructor devuelve:
//   grupo · spot (dónde queda el material, local) · soportes (láminas que enseñan imágenes REALES del encargo) ·
//   animar({ t, trabajando, k, sella, espera }) · y, si es una parada, su señal amarilla.
// Los profesionales (agentes que deciden) se colocan aparte (personajes.js), en el sitio que dice plano.js.
import * as THREE from 'three';
import { COLOR, texturaLetrero } from './materiales.js';
import { flexo, estanteria, mesa, monitor, pila, silla, taza } from './mobiliario.js';
import { blob, caja, cil, disco, esfera, grupo, lamina, pon, sombraContacto, toro, vivo } from './piezas.js';
import { ALTO_MESA } from './plano.js';
import { plantita } from './vegetacion.js';

const suave = (k) => k * k * (3 - 2 * k);
const sat = (x) => Math.min(1, Math.max(0, x));

/** Piloto de actividad: un cristal pequeño que se enciende en azul mientras la estación trabaja de verdad. */
function piloto(padre, m, x, y, z, r = 0.025) {
  const p = vivo(pon(padre, esfera(r, 10, 8), m.lamparaApagada, x, y, z, { sombra: false }));
  return (on, mat = m.lamparaEncendida) => (p.material = on ? mat : m.lamparaApagada);
}

/** Cámara de fotos detallada: cuerpo, empuñadura, montura, objetivo con anillos, visor, diales y correa. */
export function camaraFoto(padre, m, x, y, z, yaw = 0, escala = 1) {
  const c = grupo(padre, x, y, z, yaw);
  c.scale.setScalar(escala);
  pon(c, caja(0.16, 0.1, 0.07, 0.015), m.tinta, 0, 0, 0);
  pon(c, caja(0.04, 0.1, 0.08, 0.015), m.grafito, -0.065, -0.005, 0.01);
  pon(c, caja(0.06, 0.04, 0.05, 0.01), m.tinta, 0.01, 0.065, -0.005);
  pon(c, cil(0.034, 0.034, 0.02, 18), m.metal, 0.015, 0, 0.045, { rot: [Math.PI / 2, 0, 0] });
  pon(c, cil(0.03, 0.032, 0.09, 18), m.tinta, 0.015, 0, 0.1, { rot: [Math.PI / 2, 0, 0] });
  pon(c, toro(0.031, 0.004, 6, 18), m.metalClaro, 0.015, 0, 0.12, {});
  pon(c, cil(0.024, 0.024, 0.006, 18), m.azulHondo, 0.015, 0, 0.147, { rot: [Math.PI / 2, 0, 0], sombra: false });
  for (const dx of [-0.04, 0.05]) pon(c, cil(0.013, 0.013, 0.012, 12), m.metalClaro, dx, 0.056, 0);
  pon(c, caja(0.012, 0.008, 0.01, 0.002), m.rojo, -0.05, 0.03, 0.036, { sombra: false });
  return c;
}

/** Trípode: tres patas, columna central y rótula. Devuelve el punto de la rótula (altura). */
function tripode(padre, m, x, z, alto = 1.25) {
  const g = grupo(padre, x, 0, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    pon(g, cil(0.012, 0.012, alto, 6), m.grafito, Math.sin(a) * 0.16, alto / 2 - 0.02, Math.cos(a) * 0.16, { rot: [Math.cos(a) * 0.26, 0, -Math.sin(a) * 0.26] });
  }
  pon(g, cil(0.018, 0.018, 0.3, 8), m.metal, 0, alto + 0.1, 0);
  pon(g, esfera(0.035, 10, 8), m.grafito, 0, alto + 0.26, 0);
  return g;
}

/** Softbox en pie: pie de estudio, brazo, caja octogonal con difusor blanco. Se enciende cuando el plató trabaja. */
function softbox(padre, m, x, z, yaw, alto = 1.7) {
  const g = grupo(padre, x, 0, z, yaw);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    pon(g, cil(0.012, 0.012, 0.42, 6), m.grafito, Math.sin(a) * 0.14, 0.12, Math.cos(a) * 0.14, { rot: [Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0] });
  }
  pon(g, cil(0.016, 0.016, alto, 8), m.grafito, 0, alto / 2, 0);
  const cab = grupo(g, 0, alto, 0.05);
  cab.rotation.x = 0.35;
  pon(cab, cil(0.3, 0.12, 0.26, 8, true), m.tinta, 0, 0, 0.12, { rot: [Math.PI / 2, 0, 0] });
  const difusor = vivo(pon(cab, cil(0.3, 0.3, 0.01, 8), m.blancoCalido, 0, 0, 0.25, { rot: [Math.PI / 2, 0, 0], sombra: false }));
  return (on) => (difusor.material = on ? m.calidaEncendida : m.blancoCalido);
}

// ---------------------------------------------------------------- Recepción y fotografía

function referencia(m) {
  // Tablero de referencias: gran moodboard de corcho en la pared, con la referencia REAL del encargo en foco en el
  // centro (si la hay), muestras de color, láminas y carpetas; y la mesa donde se organizan los encargos.
  const g = new THREE.Group();
  const tablero = grupo(g, 0, 0, -0.92);
  pon(tablero, caja(2.7, 1.6, 0.06, 0.02), m.maderaOscura, 0, 1.75, 0);
  pon(tablero, caja(2.56, 1.46, 0.04, 0.01), m.corcho, 0, 1.75, 0.03, { sombra: false });
  // La referencia del encargo, grande, con cuatro chinchetas.
  const ref = lamina(tablero, 0.62, 0.8, -0.2, 1.78, 0.056, [0, 0, 0.02]);
  for (const [dx, dy] of [[-0.28, 0.37], [0.28, 0.37], [-0.28, -0.37], [0.28, -0.37]]) pon(tablero, esfera(0.016, 8, 6), m.rojo, -0.2 + dx, 1.78 + dy, 0.065, { sombra: false });
  // Muestras de color, cartas tipográficas y fichas de familia (sin fotos inventadas).
  const tiras = [[COLOR.terracota, COLOR.crema, COLOR.oliva], [COLOR.petroleo, COLOR.arena, COLOR.naranja], [COLOR.azul, COLOR.blancoCalido, COLOR.tinta]];
  tiras.forEach((t, i) => t.forEach((c, j) => pon(tablero, caja(0.16, 0.11, 0.008, 0.003), m[Object.keys(COLOR).find((k) => COLOR[k] === c)], 0.5 + i * 0.2, 2.2 - j * 0.13, 0.055, { sombra: false, rot: [0, 0, (i - 1) * 0.05] })));
  for (let i = 0; i < 3; i++) pon(tablero, caja(0.36, 0.26, 0.008, 0.003), m.blancoCalido, 0.82 - (i % 2) * 0.1, 1.55 - i * 0.28, 0.052, { sombra: false, rot: [0, 0, 0.06 - i * 0.05] });
  for (let i = 0; i < 4; i++) pon(tablero, caja(0.03, 0.022, 0.003, 0.001), m.tinta, 0.72 - (i % 2) * 0.1, 1.6 - i * 0.14, 0.058, { sombra: false });
  pon(tablero, caja(0.4, 0.3, 0.008, 0.003), m.crema, -0.95, 2.15, 0.052, { sombra: false, rot: [0, 0, -0.05] });
  pon(tablero, caja(0.36, 0.42, 0.008, 0.003), m.arena, -1.0, 1.4, 0.052, { sombra: false, rot: [0, 0, 0.04] });
  // Hilo rojo que une la referencia con las muestras (cómo se organiza el encargo).
  pon(tablero, caja(0.7, 0.006, 0.004, 0.001), m.rojo, 0.25, 1.95, 0.064, { rot: [0, 0, 0.35], sombra: false });
  // Mesa de organización: tablero de madera, carpetas y un archivador de cajones al lado.
  mesa(g, m, { largo: 1.6, fondo: 0.6, tablero: m.maderaClara, x: 0, z: 0.95 });
  pila(g, m, -0.5, ALTO_MESA, 0.95, 5, m.terracota, 0.26, 0.32);
  pila(g, m, -0.15, ALTO_MESA, 0.85, 3, m.petroleoClaro, 0.24, 0.3);
  plantita(g, m, 0.62, ALTO_MESA, 0.8, 0);
  const arch = grupo(g, -1.2, 0, 0.6);
  pon(arch, caja(0.46, 0.9, 0.5, 0.02), m.oliva, 0, 0.45, 0);
  for (let i = 0; i < 3; i++) {
    pon(arch, caja(0.4, 0.26, 0.02, 0.01), m.salvia, 0, 0.18 + i * 0.28, 0.255);
    pon(arch, caja(0.12, 0.02, 0.02, 0.005), m.metalClaro, 0, 0.25 + i * 0.28, 0.27);
  }
  sombraContacto(arch, m, 0.6, 0.65);
  return { grupo: g, spot: new THREE.Vector3(0, ALTO_MESA + 0.002, 1.13), soportes: { referencia: ref }, animar() {} };
}

function entrada(m) {
  // Recepción: mostrador de madera con frente de lamas, bandeja de entrada con la foto REAL que subió el hostelero,
  // la pila de los otros encargos abiertos, estanterías de clasificación, el rótulo del local y el «router» cuyo
  // piloto dice si hay conexión con el estudio.
  const g = new THREE.Group();
  const largo = 2.6;
  pon(g, caja(largo, 1.0, 0.5, 0.03), m.madera, 0, 0.5, -0.05);
  for (let i = 0; i < 14; i++) pon(g, caja(0.06, 0.9, 0.02, 0.006), m.maderaOscura, -largo / 2 + 0.12 + (i * (largo - 0.24)) / 13, 0.48, 0.205);
  pon(g, caja(largo + 0.06, 0.04, 0.62, 0.012), m.blancoCalido, 0, 1.02, -0.02);
  pon(g, caja(largo - 0.2, 0.04, 0.4, 0.012), m.madera, 0, ALTO_MESA - 0.02, 0.05);
  // Bandeja de entrada (azul de marca) con la foto subida.
  const bandeja = grupo(g, 0, ALTO_MESA, 0.12);
  pon(bandeja, caja(0.4, 0.014, 0.34, 0.004), m.azul, 0, 0.007, 0);
  for (const [w, d, x, z] of [[0.42, 0.02, 0, 0.17], [0.42, 0.02, 0, -0.17], [0.02, 0.34, 0.2, 0], [0.02, 0.34, -0.2, 0]]) pon(bandeja, caja(w, 0.05, d, 0.005), m.azul, x, 0.025, z);
  const subida = lamina(bandeja, 0.24, 0.3, 0, 0.018, 0, [-Math.PI / 2, 0, 0.05]);
  // Pila de los otros encargos abiertos (se ve cuántos esperan).
  const pilaOtros = [];
  for (let i = 0; i < 5; i++) {
    const p = vivo(pon(g, caja(0.26, 0.014, 0.32, 0.004), i % 2 ? m.crema : m.blancoCalido, 0.65 + (i % 2) * 0.01, ALTO_MESA + 0.007 + i * 0.016, 0.1, { rot: [0, 0.05 * i, 0] }));
    p.visible = false;
    pilaOtros.push(p);
  }
  // Ordenador de recepción y el router con su piloto (conexión real con el servidor).
  const pantalla = monitor(g, m, -0.75, ALTO_MESA, -0.05, 0, 0.42, 0.26);
  pantalla.material.color.set(0x24304f);
  const router = grupo(g, -1.1, 1.04, -0.05);
  pon(router, caja(0.18, 0.04, 0.12, 0.01), m.blancoCalido, 0, 0.02, 0);
  for (const s of [-1, 1]) pon(router, cil(0.005, 0.005, 0.12, 4), m.grafito, s * 0.07, 0.1, -0.04);
  const led = vivo(pon(router, esfera(0.012, 8, 6), m.pilotoVerde, 0.06, 0.045, 0.06, { sombra: false }));
  // Estanterías de clasificación detrás (contra la pared), con cajas etiquetadas por color.
  const casillero = grupo(g, 0, 0, -0.48);
  pon(casillero, caja(2.2, 1.6, 0.3, 0.02), m.maderaClara, 0, 0.8, 0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) pon(casillero, caja(0.36, 0.38, 0.26, 0.02), [m.terracota, m.crema, m.petroleoClaro, m.salvia, m.arena][(i + j) % 5], -0.88 + j * 0.44, 0.3 + i * 0.5, 0.04);
  // Rótulo con el nombre del local del encargo en foco, sobre la recepción.
  const rotulo = lamina(g, 1.6, 0.36, 0, 2.2, -0.58);
  pon(g, caja(1.7, 0.44, 0.04, 0.02), m.tinta, 0, 2.2, -0.61);
  silla(g, m, 0.6, -0.55, Math.PI, m.terracota);
  return {
    grupo: g,
    spot: new THREE.Vector3(0, ALTO_MESA + 0.004, 0.18),
    soportes: { subida, rotulo },
    animar({ otros = 0, conectado = true, local = '' }) {
      pilaOtros.forEach((p, i) => (p.visible = i < otros));
      led.material = conectado ? m.pilotoVerde : m.pilotoRojo;
      const texto = conectado ? local || 'estudio' : 'sin conexión';
      const tex = texturaLetrero(texto, { fondo: COLOR.tinta, tinta: conectado ? COLOR.blancoCalido : COLOR.rojo, ancho: 512, alto: 116, tamano: 0.5, peso: 800 });
      if (rotulo.material.map !== tex) {
        rotulo.material.map = tex;
        rotulo.material.color.set(0xffffff);
        rotulo.material.needsUpdate = true;
      }
    },
  };
}

function directorFoto(m) {
  // Pequeño estudio profesional: fondo de papel curvo, mesa de bodegón con un plato blanco, dos softboxes, reflector,
  // cámara en trípode apuntando al set; y la mesa del director con la foto original REAL, la propuesta y su monitor.
  const g = new THREE.Group();
  const set = grupo(g, -1.25, 0, -0.55);
  // Fondo de papel: rollo arriba, caída y curva que barre hasta el suelo.
  pon(set, cil(0.06, 0.06, 1.7, 14), m.grafito, 0, 2.3, -0.55, { rot: [0, 0, Math.PI / 2] });
  for (const s of [-1, 1]) pon(set, cil(0.02, 0.02, 2.3, 6), m.grafito, s * 0.88, 1.15, -0.55);
  pon(set, caja(1.6, 2.1, 0.02, 0.005), m.arena, 0, 1.25, -0.56, { sombra: false });
  pon(set, geoCurva(), m.arena, 0, 0.2, -0.36, { sombra: false });
  pon(set, caja(1.6, 0.01, 0.75, 0.003), m.arena, 0, 0.01, 0.2, { sombra: false });
  // Mesa de bodegón con un plato blanco vacío y una servilleta (atrezo; la foto del plato es la real, en la mesa del director).
  const bodegon = grupo(set, 0, 0, 0.1);
  pon(bodegon, cil(0.32, 0.32, 0.04, 22), m.maderaClara, 0, 0.62, 0);
  pon(bodegon, cil(0.04, 0.06, 0.6, 10), m.grafito, 0, 0.3, 0);
  pon(bodegon, cil(0.2, 0.22, 0.02, 18), m.grafito, 0, 0.01, 0);
  pon(bodegon, cil(0.15, 0.11, 0.025, 22), m.blanco, 0, 0.655, 0);
  pon(bodegon, caja(0.2, 0.006, 0.12, 0.002), m.terracota, 0.16, 0.643, 0.1, { rot: [0, 0.4, 0] });
  const luzA = softbox(set, m, -0.85, 0.75, 2.6);
  const luzB = softbox(set, m, 0.95, 0.55, -2.4, 1.55);
  // Reflector plegable en el suelo.
  pon(set, cil(0.32, 0.32, 0.01, 24), m.metalClaro, -0.2, 0.45, 0.85, { rot: [1.1, 0, 0] });
  pon(set, cil(0.01, 0.01, 0.45, 6), m.grafito, -0.2, 0.22, 0.75);
  // Cámara en trípode mirando al bodegón.
  const tr = tripode(g, m, -0.75, 0.2, 1.1);
  camaraFoto(tr, m, 0, 1.42, 0, Math.PI + 0.55, 1.1);
  // Mesa del director: foto original real, propuesta (papel), lupa de cuentahílos, monitor, flexo y objetivos.
  mesa(g, m, { largo: 1.2, fondo: 0.6, tablero: m.maderaOscura, x: 0.5, z: 0 });
  const fotoMesa = lamina(g, 0.21, 0.28, 0.25, ALTO_MESA + 0.004, 0.08, [-Math.PI / 2, 0, 0.12]);
  const propuesta = lamina(g, 0.21, 0.28, 0.48, ALTO_MESA + 0.005, -0.02, [-Math.PI / 2, 0, -0.1]);
  const pantalla = monitor(g, m, 0.55, ALTO_MESA, -0.2, 0, 0.46, 0.3);
  const luz = flexo(g, m, 0.98, -0.18, -0.6, m.grafito);
  for (let i = 0; i < 3; i++) pon(g, cil(0.035, 0.035, 0.06 + i * 0.02, 14), m.tinta, 0.0 + i * 0.09, ALTO_MESA + 0.03 + i * 0.01, -0.18);
  taza(g, m, 0.95, ALTO_MESA, 0.15, m.terracota);
  silla(g, m, 1.25, -0.55, 2.4, m.grafito);
  const pil = piloto(g, m, 1.05, ALTO_MESA + 0.02, 0.22);
  return {
    grupo: g,
    // El corredor entrega por el extremo derecho de la mesa (al lado, no entre la cámara y el director).
    spot: new THREE.Vector3(0.98, ALTO_MESA + 0.004, 0.0),
    soportes: { fotoMesa, propuesta, pantalla },
    animar({ trabajando }) {
      luz.poner(trabajando, m.calidaEncendida);
      luzA(trabajando);
      luzB(trabajando);
      pil(trabajando);
    },
  };
}

/** La curva del fondo de papel (cuarto de cilindro abierto). */
function geoCurva() {
  return new THREE.CylinderGeometry(0.2, 0.2, 1.6, 12, 1, true, Math.PI, Math.PI / 2).rotateZ(Math.PI / 2);
}

// ---------------------------------------------------------------- Paradas (presentación para la persona)

function parada(m, cual) {
  // Mesa de presentación con su atril: enseña la foto REAL (original o nueva) y la carpeta de producción. El tablero y
  // el letrero se ponen AMARILLOS solo cuando la orden espera tu decisión.
  const g = new THREE.Group();
  const tab = grupo(g, 0, 0, 0.0);
  pon(tab, caja(1.3, 0.05, 0.72, 0.015), m.blancoCalido, 0, ALTO_MESA - 0.025, 0);
  const banda = vivo(pon(tab, caja(1.32, 0.05, 0.74, 0.015), m.grafito, 0, ALTO_MESA - 0.075, 0));
  for (const s of [-1, 1]) {
    pon(tab, caja(0.05, ALTO_MESA - 0.1, 0.6, 0.01), m.grafito, s * 0.6, (ALTO_MESA - 0.1) / 2, 0);
  }
  // Atril inclinado con la foto grande.
  const atril = grupo(tab, cual === 2 ? 0 : -0.25, ALTO_MESA, -0.1);
  atril.rotation.x = -0.35;
  pon(atril, caja(cual === 2 ? 0.62 : 0.42, cual === 2 ? 0.8 : 0.56, 0.03, 0.01), m.tinta, 0, cual === 2 ? 0.42 : 0.3, 0);
  const foto = lamina(atril, cual === 2 ? 0.56 : 0.36, cual === 2 ? 0.74 : 0.5, 0, cual === 2 ? 0.42 : 0.3, 0.017);
  pon(tab, caja(0.5, 0.03, 0.1, 0.01), m.grafito, cual === 2 ? 0 : -0.25, ALTO_MESA + 0.015, 0.05);
  // Carpeta de producción (parada 1: la propuesta en papel; parada 2: la ficha de la comprobación).
  const hoja = lamina(tab, 0.21, 0.28, cual === 2 ? 0.45 : 0.3, ALTO_MESA + 0.004, 0.12, [-Math.PI / 2, 0, -0.15]);
  pon(tab, caja(0.26, 0.012, 0.34, 0.004), m.madera, cual === 2 ? 0.45 : 0.3, ALTO_MESA + 0.002, 0.12, { rot: [0, -0.15, 0] });
  // Lámpara de presentación (se enciende en amarillo cuando te toca) y el letrero «TE TOCA».
  const lampara = grupo(tab, 0.55, ALTO_MESA, -0.25);
  pon(lampara, cil(0.05, 0.06, 0.02, 14), m.grafito, 0, 0.01, 0);
  pon(lampara, cil(0.008, 0.008, 0.5, 6), m.grafito, 0, 0.26, 0);
  const foco = vivo(pon(lampara, esfera(0.045, 12, 8), m.lamparaApagada, 0, 0.53, 0.02, { sombra: false }));
  const senal = crearSenal(m);
  senal.grupo.position.set(-0.85, 0, 0.1);
  senal.grupo.rotation.y = 0.5;
  g.add(senal.grupo);
  sombraContacto(g, m, 1.6, 1.0);
  return {
    grupo: g,
    spot: new THREE.Vector3(0, ALTO_MESA, 0.2),
    soportes: cual === 2 ? { foto, hoja } : { foto, hoja },
    animar({ t, espera = 0 }) {
      const on = espera > 0;
      banda.material = on ? m.amarilloLuz : m.grafito;
      foco.material = on ? m.amarilloLuz : m.lamparaApagada;
      senal.poner(espera, t);
    },
  };
}

/** Letrero amarillo de «te toca» en su poste: aparece con un rebote cuando el encargo espera a la persona. */
export function crearSenal(m) {
  const grupoS = vivo(new THREE.Group());
  const cuerpo = new THREE.Group();
  grupoS.add(cuerpo);
  pon(cuerpo, cil(0.02, 0.02, 1.55, 8), m.grafito, 0, 0.775, 0);
  pon(cuerpo, cil(0.13, 0.15, 0.04, 16), m.grafito, 0, 0.02, 0);
  const placa = new THREE.Group();
  placa.position.y = 1.66;
  cuerpo.add(placa);
  pon(placa, caja(0.62, 0.32, 0.04, 0.035), m.amarillo, 0, 0, 0);
  const tex = texturaLetrero('TE TOCA', { fondo: COLOR.amarillo, tamano: 0.52 });
  for (const s of [1, -1]) {
    const cara = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.27), new THREE.MeshBasicMaterial({ map: tex }));
    cara.material.userData.outlineParameters = { visible: false };
    cara.position.z = s * 0.021;
    if (s < 0) cara.rotation.y = Math.PI;
    placa.add(cara);
  }
  grupoS.visible = false;
  return {
    grupo: grupoS,
    poner(k, t = 0) {
      grupoS.visible = k > 0.001;
      const s = k <= 0 ? 0 : k >= 1 ? 1 : 1 + Math.sin(k * Math.PI * 1.5) * (1 - k) * 0.6 - (1 - k);
      cuerpo.scale.set(1, Math.max(0.001, s), 1);
      placa.rotation.z = k >= 1 ? 0.05 * Math.sin(t * 2.2) : 0;
    },
  };
}

// ---------------------------------------------------------------- Laboratorio tecnológico

function generador(m) {
  // Generador: máquina modular azul petróleo. Cámara de toma con ventana (dentro, una platina con luz que se enciende
  // al generar), dos brazos de luz, panel de operación con pilotos, rejillas, ranura de entrada y bandeja de salida.
  const g = new THREE.Group();
  const cuerpo = grupo(g, 0, 0, -0.2);
  // Zócalo y armario inferior con puertas y rejillas.
  pon(cuerpo, caja(1.5, 0.08, 0.95, 0.02), m.grafito, 0, 0.04, 0);
  pon(cuerpo, caja(1.42, 0.62, 0.86, 0.04), m.petroleo, 0, 0.39, 0);
  for (const s of [-1, 1]) {
    pon(cuerpo, caja(0.62, 0.48, 0.02, 0.02), m.petroleoClaro, s * 0.36, 0.38, 0.435);
    for (let i = 0; i < 4; i++) pon(cuerpo, caja(0.36, 0.018, 0.012, 0.004), m.grafito, s * 0.36, 0.28 + i * 0.06, 0.448);
  }
  // Bandeja de salida a la altura de la mesa (donde aparece la foto nueva) y ranura de entrada encima.
  const bandeja = grupo(cuerpo, 0, ALTO_MESA - 0.04, 0.43);
  pon(bandeja, caja(0.5, 0.025, 0.3, 0.008), m.metalClaro, 0, 0, 0.13);
  pon(bandeja, caja(0.5, 0.05, 0.02, 0.006), m.metalClaro, 0, 0.025, 0.28);
  // Módulo superior: cámara de toma acristalada con la platina iluminada.
  const camara = grupo(cuerpo, -0.2, ALTO_MESA, -0.05);
  pon(camara, caja(0.95, 0.75, 0.72, 0.05), m.blanco, 0, 0.375, 0);
  pon(camara, caja(0.62, 0.48, 0.02, 0.02), m.tinta, 0, 0.4, 0.361);
  pon(camara, plano2(0.58, 0.44), m.cristal, 0, 0.4, 0.373, { sombra: false });
  const platina = vivo(pon(camara, cil(0.14, 0.14, 0.03, 20), m.grafito, 0, 0.22, 0.12));
  pon(camara, cil(0.09, 0.07, 0.02, 20), m.blanco, 0, 0.245, 0.12);
  const luzInterior = vivo(pon(camara, caja(0.5, 0.03, 0.2, 0.01), m.lamparaApagada, 0, 0.7, 0.12, { sombra: false }));
  // Ranura de entrada (al lado de la cámara de toma).
  pon(cuerpo, caja(0.36, 0.05, 0.08, 0.01), m.grafito, 0.48, ALTO_MESA + 0.05, 0.3);
  pon(cuerpo, caja(0.3, 0.012, 0.02, 0.003), m.tinta, 0.48, ALTO_MESA + 0.08, 0.345, { sombra: false });
  // Panel de operación con pilotos y diales.
  const panel = grupo(cuerpo, 0.48, ALTO_MESA + 0.12, 0.05);
  pon(panel, caja(0.4, 0.6, 0.5, 0.03), m.blanco, 0, 0.3, -0.05);
  const pantalla = lamina(panel, 0.28, 0.16, 0, 0.45, 0.205, [0, 0, 0], 0x1b1f2b);
  const pilotos = [0, 1, 2].map((i) => piloto(panel, m, -0.1 + i * 0.1, 0.25, 0.21, 0.018));
  for (const dx of [-0.08, 0.08]) pon(panel, cil(0.03, 0.03, 0.03, 14), m.grafito, dx, 0.12, 0.21, { rot: [Math.PI / 2, 0, 0] });
  // Dos brazos de luz encima de la cámara de toma.
  for (const s of [-1, 1]) {
    const brazo = grupo(camara, s * 0.38, 0.75, 0);
    pon(brazo, cil(0.012, 0.012, 0.4, 6), m.grafito, 0, 0.2, 0);
    pon(brazo, cil(0.06, 0.1, 0.12, 14, true), m.tinta, 0, 0.42, 0.06, { rot: [-0.9, 0, s * 0.3] });
  }
  // Cables al suelo.
  pon(g, caja(0.05, 0.03, 0.6, 0.01), m.tinta, 0.7, 0.015, -0.2);
  return {
    grupo: g,
    spot: new THREE.Vector3(0, ALTO_MESA - 0.01, 0.5),
    entrada: new THREE.Vector3(0.48, ALTO_MESA + 0.08, 0.15),
    soportes: { pantalla },
    animar({ t, trabajando, k }) {
      luzInterior.material = trabajando ? m.lamparaEncendida : m.lamparaApagada;
      platina.rotation.y = trabajando ? t * 1.6 : 0;
      pilotos.forEach((p, i) => p(trabajando && Math.sin(t * 5 + i * 2) > -0.3));
      pantalla.material.color.set(trabajando ? 0x3a64ff : 0x1b1f2b);
      void k;
    },
  };
}
const plano2 = (w, h) => new THREE.PlaneGeometry(w, h);

function revisor(m) {
  // Laboratorio de inspección: mesa con caja de luz (se enciende al revisar), dos pantallas de comparación (la foto
  // original y la nueva, REALES), sello, bandejas de aceptadas y devueltas y documentos de revisión.
  const g = new THREE.Group();
  mesa(g, m, { largo: 1.5, fondo: 0.66, tablero: m.blanco, patas: m.petroleo, x: 0, z: 0 });
  const cajaLuz = vivo(pon(g, caja(0.5, 0.02, 0.4, 0.008), m.blancoCalido, -0.45, ALTO_MESA + 0.01, 0.05, { sombra: false }));
  pon(g, caja(0.54, 0.018, 0.44, 0.008), m.grafito, -0.45, ALTO_MESA + 0.004, 0.05);
  const original = monitor(g, m, -0.48, ALTO_MESA, -0.2, 0.25, 0.32, 0.4);
  const nueva = monitor(g, m, -0.08, ALTO_MESA, -0.24, 0.05, 0.32, 0.4);
  pon(g, caja(0.13, 0.03, 0.08, 0.008), m.grafito, 0.62, ALTO_MESA + 0.015, 0.18);
  for (const [x, mat] of [[0.62, m.verde], [0.62, m.rojo]]) void x, void mat;
  pon(g, caja(0.18, 0.04, 0.24, 0.006), m.verde, 0.66, ALTO_MESA + 0.02, -0.12);
  pon(g, caja(0.18, 0.04, 0.24, 0.006), m.rojo, 0.66, ALTO_MESA + 0.065, -0.12);
  pila(g, m, -0.6, ALTO_MESA, 0.18, 3, m.blancoCalido, 0.2, 0.26);
  const pil = piloto(g, m, 0.72, ALTO_MESA + 0.02, 0.26);
  silla(g, m, -0.55, -0.78, 2.6, m.petroleoClaro);
  estanteria(g, m, 0.95, -0.85, 0, { ancho: 0.9, alto: 1.5, baldas: 3, semilla: 9 });
  return {
    grupo: g,
    // La foto, en la caja de luz del extremo izquierdo: el corredor la deja desde el lado, no delante de la revisora.
    spot: new THREE.Vector3(-0.6, ALTO_MESA + 0.022, 0.05),
    soportes: { original, nueva },
    animar({ trabajando }) {
      cajaLuz.material = trabajando ? m.calidaEncendida : m.blancoCalido;
      pil(trabajando);
    },
  };
}

function mascara(m) {
  // Segmentación: escáner de visión artificial con tapa abierta y barra de luz que barre al trabajar, torre de proceso
  // con pilotos, y la pantalla en brazo con la MÁSCARA REAL cuando existe.
  const g = new THREE.Group();
  const cuerpo = grupo(g, 0, 0, -0.15);
  pon(cuerpo, caja(1.3, 0.08, 0.9, 0.02), m.grafito, 0, 0.04, 0);
  pon(cuerpo, caja(1.2, ALTO_MESA - 0.12, 0.82, 0.04), m.blanco, 0, (ALTO_MESA - 0.12) / 2 + 0.08, 0);
  for (let i = 0; i < 5; i++) pon(cuerpo, caja(0.9, 0.02, 0.012, 0.004), m.petroleoClaro, 0, 0.2 + i * 0.08, 0.416);
  // Cama del escáner con su cristal y la barra de luz.
  pon(cuerpo, caja(0.9, 0.03, 0.62, 0.01), m.grafito, 0, ALTO_MESA - 0.02, 0.05);
  const barra = vivo(pon(cuerpo, caja(0.06, 0.02, 0.6, 0.006), m.lamparaApagada, -0.4, ALTO_MESA + 0.0, 0.05, { sombra: false }));
  const tapa = grupo(cuerpo, 0, ALTO_MESA, -0.27);
  tapa.rotation.x = -1.15;
  pon(tapa, caja(0.92, 0.6, 0.03, 0.015), m.petroleo, 0, 0.3, 0);
  // Torre de proceso con pilotos.
  const torre = grupo(cuerpo, -0.5, ALTO_MESA, -0.15);
  pon(torre, caja(0.22, 0.6, 0.4, 0.02), m.grafito, 0, 0.3, 0);
  const pilotos = [0, 1, 2, 3].map((i) => piloto(torre, m, 0.115, 0.15 + i * 0.1, 0.1, 0.014));
  // Pantalla en brazo con la máscara.
  const brazo = grupo(cuerpo, 0.5, ALTO_MESA, -0.25);
  pon(brazo, cil(0.015, 0.015, 0.5, 6), m.grafito, 0, 0.25, 0);
  const pantalla = monitor(brazo, m, 0, 0.3, 0.05, -0.3, 0.36, 0.3);
  return {
    grupo: g,
    spot: new THREE.Vector3(0, ALTO_MESA + 0.002, 0.42),
    soportes: { pantalla },
    animar({ t, trabajando }) {
      barra.material = trabajando ? m.lamparaEncendida : m.lamparaApagada;
      barra.position.x = trabajando ? 0.4 * Math.sin(t * 1.8) : -0.4;
      pilotos.forEach((p, i) => p(trabajando && ((Math.floor(t * 4) + i) % 3 !== 0)));
    },
  };
}

// ---------------------------------------------------------------- Dirección creativa y producción gráfica

function directorDiseno(m) {
  // Estudio de dirección de arte: gran mesa de madera con tableta gráfica, bocetos, muestras de color y reglas;
  // pantalla con la referencia REAL; moodboard de corcho y estanterías con libros detrás; lámpara de arquitecto.
  const g = new THREE.Group();
  mesa(g, m, { largo: 1.6, fondo: 0.7, tablero: m.maderaClara, patas: m.terracota, x: 0, z: 0 });
  pon(g, caja(0.42, 0.012, 0.3, 0.006), m.grafito, 0.1, ALTO_MESA + 0.006, 0.0);
  pon(g, caja(0.36, 0.004, 0.24, 0.003), m.tinta, 0.1, ALTO_MESA + 0.013, 0.0, { sombra: false });
  // Pantalla al extremo de la mesa, en ángulo: no tapa la cara del director desde la sala.
  const pantalla = monitor(g, m, 0.62, ALTO_MESA, 0.12, Math.PI - 0.7, 0.5, 0.32);
  // Muestras de color en abanico, reglas y lápices.
  for (let i = 0; i < 6; i++) pon(g, caja(0.05, 0.004, 0.2, 0.002), [m.terracota, m.naranja, m.crema, m.oliva, m.petroleo, m.azul][i], 0.55, ALTO_MESA + 0.003 + i * 0.002, -0.1, { rot: [0, -0.5 + i * 0.18, 0], sombra: false });
  pon(g, caja(0.4, 0.004, 0.04, 0.002), m.metalClaro, -0.35, ALTO_MESA + 0.004, -0.2, { rot: [0, 0.3, 0], sombra: false });
  pon(g, cil(0.04, 0.035, 0.1, 12), m.terracota, -0.62, ALTO_MESA + 0.05, 0.2);
  for (let i = 0; i < 4; i++) pon(g, cil(0.005, 0.005, 0.15, 6), [m.azul, m.rojo, m.oliva, m.tinta][i], -0.62 + (i - 1.5) * 0.012, ALTO_MESA + 0.12, 0.2, { rot: [(i - 1.5) * 0.1, 0, (i - 1.5) * 0.12], sombra: false });
  // Bocetos en la mesa (papeles, sin contenido inventado) y el lugar del material.
  pila(g, m, -0.3, ALTO_MESA, 0.12, 3, m.crema, 0.21, 0.28);
  const luz = flexo(g, m, 0.7, 0.25, Math.PI + 0.6, m.terracota);
  // Moodboard de corcho a un lado de la mesa, de cara a la sala (no tapa al director).
  const tablero = grupo(g, 1.85, 0, 0.45, -0.25);
  pon(tablero, caja(2.0, 1.3, 0.05, 0.02), m.maderaOscura, 0, 1.6, 0);
  pon(tablero, caja(1.9, 1.2, 0.03, 0.01), m.corcho, 0, 1.6, 0.03, { sombra: false });
  const refMood = lamina(tablero, 0.42, 0.54, -0.55, 1.65, 0.05, [0, 0, -0.03]);
  for (let i = 0; i < 5; i++) pon(tablero, caja(0.26, 0.2, 0.008, 0.003), [m.crema, m.arena, m.blancoCalido, m.salvia, m.terracota][i], 0.05 + (i % 3) * 0.3, 1.9 - Math.floor(i / 3) * 0.35, 0.048, { sombra: false, rot: [0, 0, (i - 2) * 0.04] });
  for (const s of [-1, 1]) pon(tablero, caja(0.05, 1.25, 0.05, 0.01), m.maderaOscura, s * 0.9, 0.62, 0.1);
  estanteria(g, m, 2.3, 1.45, -Math.PI / 2, { ancho: 1.0, alto: 1.7, baldas: 4, semilla: 3 });
  silla(g, m, -0.95, -0.2, -0.4, m.terracota);
  const pil = piloto(g, m, 0.75, ALTO_MESA + 0.02, -0.25);
  return {
    grupo: g,
    spot: new THREE.Vector3(-0.65, ALTO_MESA + 0.004, -0.3),
    soportes: { pantalla, refMood },
    animar({ trabajando }) {
      luz.poner(trabajando, m.calidaEncendida);
      pil(trabajando);
    },
  };
}

function compositor(m) {
  // Imprenta del compositor: máquina de rodillos con bastidor, tres tinteros (cian, magenta y tinta), volante rojo,
  // bandeja de entrada y bandeja de salida donde aparece el post REAL; mesa auxiliar con pliegos.
  const g = new THREE.Group();
  const cuerpo = grupo(g, 0, 0, -0.15);
  pon(cuerpo, caja(1.6, 0.1, 0.9, 0.02), m.grafito, 0, 0.05, 0);
  pon(cuerpo, caja(1.5, 0.6, 0.8, 0.04), m.maderaOscura, 0, 0.4, 0);
  for (const s of [-1, 1]) pon(cuerpo, caja(0.08, 0.7, 0.86, 0.02), m.grafito, s * 0.62, 1.0, 0);
  // Rodillos (giran al componer).
  const rodillos = [0, 1, 2].map((i) => {
    const r = vivo(grupo(cuerpo, 0, 0.82 + i * 0.16, -0.15 + i * 0.08));
    pon(r, cil(0.07 - i * 0.008, 0.07 - i * 0.008, 1.16, 18), i === 1 ? m.metalClaro : m.tinta, 0, 0, 0, { rot: [0, 0, Math.PI / 2] });
    return r;
  });
  // Tinteros de color de impresión.
  [m.cian, m.magenta, m.tinta].forEach((c, i) => pon(cuerpo, caja(0.3, 0.14, 0.18, 0.02), c, -0.35 + i * 0.35, 1.38, -0.22));
  // Volante rojo en el lateral que ve la cámara.
  const volante = vivo(grupo(cuerpo, -0.7, 0.95, 0));
  volante.rotation.z = Math.PI / 2;
  pon(volante, toro(0.24, 0.022, 8, 28), m.rojo, 0, 0, 0, { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) pon(volante, caja(0.016, 0.016, 0.48, 0.004), m.grafito, 0, 0, 0, { rot: [0, (i * Math.PI) / 3, 0] });
  pon(volante, cil(0.035, 0.035, 0.08, 12), m.grafito, 0, 0, 0);
  // Bandeja de entrada (lado del pasillo) y de salida (con el post real).
  pon(cuerpo, caja(0.6, 0.03, 0.34, 0.008), m.metalClaro, 0.3, ALTO_MESA - 0.02, 0.55);
  const salida = grupo(cuerpo, -0.35, ALTO_MESA + 0.02, 0.5);
  salida.rotation.x = 0.25;
  pon(salida, caja(0.4, 0.02, 0.36, 0.008), m.metalClaro, 0, 0, 0);
  const post = lamina(salida, 0.26, 0.32, 0, 0.012, 0.02, [-Math.PI / 2, 0, 0]);
  const pantalla = monitor(cuerpo, m, 0.55, 1.38, -0.2, Math.PI, 0.3, 0.2);
  const pilotos = [0, 1].map((i) => piloto(cuerpo, m, 0.66, 0.6 + i * 0.1, 0.42, 0.02));
  // Mesa auxiliar con pliegos impresos y una guillotina.
  const aux = grupo(g, 1.15, 0, 0.1, -0.15);
  mesa(aux, m, { largo: 0.8, fondo: 0.6, tablero: m.maderaClara });
  pila(aux, m, -0.15, ALTO_MESA, 0, 6, m.crema, 0.26, 0.32);
  pon(aux, caja(0.3, 0.06, 0.34, 0.01), m.grafito, 0.2, ALTO_MESA + 0.03, 0);
  pon(aux, caja(0.34, 0.02, 0.04, 0.006), m.metal, 0.2, ALTO_MESA + 0.08, 0.12, { rot: [0, 0, 0.3] });
  return {
    grupo: g,
    spot: new THREE.Vector3(0.3, ALTO_MESA, 0.53),
    soportes: { post, pantalla },
    animar({ t, trabajando }) {
      rodillos.forEach((r, i) => (r.rotation.x = trabajando ? t * (3 + i) * (i % 2 ? -1 : 1) : 0));
      volante.rotation.y = trabajando ? t * 2 : 0;
      pilotos.forEach((p, i) => p(trabajando && (i === 0 || Math.sin(t * 6) > 0)));
      pantalla.material.color.set(trabajando ? 0x3a64ff : 0x1b1f2b);
    },
  };
}

function salida(m, nMarcos = 8) {
  // Galería de entrega: panel expositor de doble cara (a la sala y a la cámara) con los marcos de los posts terminados
  // REALES; el más reciente, grande; y del lado del pasillo, la bandeja donde el corredor deja el post.
  const g = new THREE.Group();
  const panel = grupo(g, 0, 0, 0.15);
  pon(panel, caja(2.7, 1.9, 0.12, 0.03), m.blancoCalido, 0, 1.15, 0);
  pon(panel, caja(2.8, 0.08, 0.2, 0.02), m.maderaOscura, 0, 0.12, 0);
  for (const s of [-1, 1]) pon(panel, caja(0.1, 2.0, 0.2, 0.02), m.maderaOscura, s * 1.38, 1.0, 0);
  pon(panel, caja(2.8, 0.06, 0.2, 0.02), m.maderaOscura, 0, 2.12, 0);
  const marcos = [];
  // El marco grande (último post) y una retícula de anteriores, en la cara que da a la cámara (+Z).
  const grande = lamina(panel, 0.66, 0.82, -0.75, 1.15, 0.09);
  pon(panel, caja(0.74, 0.9, 0.03, 0.01), m.tinta, -0.75, 1.15, 0.07);
  const posiciones = [];
  for (let i = 0; i < nMarcos - 1; i++) posiciones.push([0.05 + (i % 4) * 0.36, 1.55 - Math.floor(i / 4) * 0.48]);
  for (const [x, y] of posiciones) {
    pon(panel, caja(0.3, 0.38, 0.025, 0.008), m.tinta, x, y, 0.07);
    marcos.push(lamina(panel, 0.25, 0.32, x, y, 0.086));
  }
  // Rótulo de la galería.
  const rot = lamina(panel, 0.9, 0.12, 0.55, 2.0 - 0.06, 0.065);
  rot.material.map = texturaLetrero('PUBLICADOS', { fondo: COLOR.blancoCalido, tinta: COLOR.tinta, ancho: 512, alto: 68, tamano: 0.62, peso: 800 });
  rot.material.color.set(0xffffff);
  // Bandeja de entrega (lado del pasillo, -Z).
  const mesita = grupo(g, 0, 0, -0.62);
  pon(mesita, caja(0.7, 0.05, 0.42, 0.012), m.maderaClara, 0, 0.78, 0);
  pon(mesita, cil(0.03, 0.03, 0.76, 8), m.grafito, 0, 0.38, 0);
  pon(mesita, cil(0.2, 0.22, 0.03, 16), m.grafito, 0, 0.015, 0);
  pon(mesita, caja(0.4, 0.03, 0.34, 0.006), m.azul, 0, 0.82, 0);
  sombraContacto(g, m, 2.9, 0.8, 0, 0.15);
  return {
    grupo: g,
    spot: new THREE.Vector3(0, 0.84, -0.62),
    soportes: { grande, marcos },
    animar() {},
  };
}

export const CONSTRUCTORES = {
  referencia,
  entrada,
  directorFoto,
  parada1: (m) => parada(m, 1),
  generador,
  revisor,
  parada2: (m) => parada(m, 2),
  mascara,
  directorDiseno,
  compositor,
  salida,
};

void blob;
void disco;
