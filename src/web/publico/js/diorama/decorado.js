// El decorado: la losa, el pasillo y los once sitios del estudio, todo hecho a mano (authored-only). Cada puesto
// devuelve su grupo, el sitio donde queda el material y `animar(estado)`, que mueve sus piezas como función pura del
// estado que le da el guion (trabajando o no, y en qué punto del trabajo). Ninguna pieza guarda estado entre fotogramas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAND, mixPose } from './kit/poses.js';
import { crearMascota, ponerPose } from './mascota.js';
import { texturaDe, texturaLetrero, COLOR } from './materiales.js';
import { ALTO_MESA, LOSA, PUESTOS, X_MESA, X_OPERARIO, marcoDePuesto } from './plano.js';

const geos = new Map();
const g = (clave, crear) => {
  if (!geos.has(clave)) geos.set(clave, crear());
  return geos.get(clave);
};
const caja = (w, h, d, r = 0.015) => g(`caja:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)));
const cil = (rt, rb, h, s = 16) => g(`cil:${rt}:${rb}:${h}:${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));

function pon(padre, geo, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.esc) m.scale.set(...o.esc);
  m.castShadow = o.sombra ?? true;
  m.receiveShadow = o.recibe ?? true;
  padre.add(m);
  return m;
}

/** Marca lo que se mueve, cambia de material o se esconde: la fusión de lo estático no lo toca. */
function vivo(o) {
  o.userData.vivo = true;
  return o;
}

/**
 * Fusiona la geometría estática del decorado por material (y por si proyecta sombra): de ~900 llamadas de dibujo por
 * fotograma a unas pocas decenas en lo fijo. Lo marcado con `vivo` (y todo lo que cuelga de ello) se queda como está.
 */
export function fusionarEstaticos(raiz) {
  raiz.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const grupos = new Map();
  const quitar = [];
  const visitar = (o) => {
    if (o.userData.vivo) return;
    if (o.isMesh && o.visible) {
      const clave = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
      if (!grupos.has(clave)) grupos.set(clave, { material: o.material, sombra: o.castShadow, recibe: o.receiveShadow, geos: [] });
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const nombre of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(nombre)) geo.deleteAttribute(nombre);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld));
      grupos.get(clave).geos.push(geo);
      quitar.push(o);
    }
    for (const hijo of o.children) visitar(hijo);
  };
  visitar(raiz);
  for (const o of quitar) o.removeFromParent();
  for (const { material, sombra, recibe, geos } of grupos.values()) {
    const malla = new THREE.Mesh(mergeGeometries(geos, false), material);
    malla.castShadow = sombra;
    malla.receiveShadow = recibe;
    malla.name = 'fusion';
    raiz.add(malla);
    geos.forEach((x) => x.dispose());
  }
  return grupos.size;
}

const suave = (k) => k * k * (3 - 2 * k);
const sat = (x) => Math.min(1, Math.max(0, x));

/** Disco de sombra de contacto para lo que toca el suelo. */
function sombraContacto(padre, m, w, d, x = 0, z = 0) {
  const s = pon(padre, g('disco', () => new THREE.CircleGeometry(0.5, 28)), m.sombra, x, 0.008, z, { rot: [-Math.PI / 2, 0, 0], esc: [w, d, 1], sombra: false, recibe: false });
  return s;
}

/** Una mesa de trabajo en el marco local del puesto (+Z hacia el pasillo): tablero, patas, travesaño y cajonera. */
function mesa(padre, m, largo = 1.0, fondo = 0.46) {
  const h = ALTO_MESA;
  pon(padre, caja(largo, 0.045, fondo, 0.014), m.mesa, 0, h - 0.0225, 0);
  pon(padre, caja(largo - 0.02, 0.02, fondo - 0.02, 0.006), m.mesaCanto, 0, h - 0.055, 0, { sombra: false });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) pon(padre, caja(0.038, h - 0.06, 0.038, 0.008), m.pata, sx * (largo / 2 - 0.05), (h - 0.06) / 2, sz * (fondo / 2 - 0.05));
  }
  pon(padre, caja(largo - 0.1, 0.03, 0.025, 0.006), m.pata, 0, 0.12, -(fondo / 2 - 0.05));
  pon(padre, caja(0.3, 0.24, fondo - 0.08, 0.02), m.mesaCanto, largo / 2 - 0.2, h - 0.2, 0);
  pon(padre, caja(0.08, 0.02, 0.012, 0.004), m.pata, largo / 2 - 0.2, h - 0.17, fondo / 2 - 0.035, { sombra: false });
  sombraContacto(padre, m, largo + 0.2, fondo + 0.2);
}

/** Lámpara de mesa: pie, brazo y pantalla con su cristal (se enciende mientras el puesto trabaja). */
function lampara(padre, m, x, z) {
  const h = ALTO_MESA;
  const grupo = new THREE.Group();
  grupo.position.set(x, h, z);
  padre.add(grupo);
  pon(grupo, cil(0.05, 0.06, 0.02, 18), m.maquinaOscura, 0, 0.01, 0);
  pon(grupo, cil(0.009, 0.009, 0.26, 8), m.maquinaOscura, 0, 0.14, 0, { rot: [0.25, 0, 0] });
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.27, 0.035);
  cabeza.rotation.x = 0.7;
  grupo.add(cabeza);
  pon(cabeza, g('pantalla', () => new THREE.CylinderGeometry(0.035, 0.07, 0.08, 18, 1, true)), m.azul, 0, 0, 0);
  const bombilla = vivo(pon(cabeza, g('bombilla', () => new THREE.SphereGeometry(0.03, 12, 8)), m.lamparaApagada, 0, -0.025, 0, { sombra: false }));
  return {
    poner(encendida) {
      bombilla.material = encendida ? m.lamparaEncendida : m.lamparaApagada;
    },
  };
}

/** Una tarjeta del material (foto, propuesta, boceto…): papel con grosor, contorno y la imagen pintada encima. */
export function crearTarjeta(m, ancho = 0.2, alto = 0.25) {
  const grupo = vivo(new THREE.Group());
  const base = pon(grupo, caja(ancho, 0.012, alto, 0.004), m.blanco, 0, 0.006, 0);
  const cara = new THREE.Mesh(g(`cara:${ancho}:${alto}`, () => new THREE.PlaneGeometry(ancho * 0.94, alto * 0.94)), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  cara.material.userData.outlineParameters = { visible: false };
  cara.rotation.x = -Math.PI / 2;
  cara.position.y = 0.0125;
  grupo.add(cara);
  let tipo = null;
  return {
    grupo,
    base,
    get tipo() {
      return tipo;
    },
    poner(nuevo) {
      if (nuevo === tipo) return;
      tipo = nuevo;
      cara.material.map = texturaDe(nuevo);
      cara.material.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- Operarios (agentes)

const BRAZOS_HERRAMIENTA = { shoulderL: [-0.25, 0, -0.12], elbowL: [-0.5, 0, 0], shoulderR: [-0.25, 0, 0.12], elbowR: [-0.5, 0, 0] };

/** Reposo: de pie, respirando, mirando de vez en cuando al pasillo. Fase propia por operario. */
function poseReposo(t, fase) {
  const r = Math.sin(t * 1.7 + fase);
  const mira = Math.sin(t * 0.37 + fase * 2.1);
  return mixPose(STAND, {
    ...STAND,
    ...BRAZOS_HERRAMIENTA,
    torso: [0.03 + 0.012 * r, 0, 0],
    head: [0.05, 0.35 * Math.max(0, mira) * mira, 0],
  }, 1);
}

/** Inclinado sobre la mesa, con las dos manos cerca del material. `mano` mueve la derecha (escribir, lupa). */
function poseSobreMesa(t, fase, { mano = 0, cabeza = 0.35, izquierda = null } = {}) {
  return {
    ...STAND,
    torso: [0.28 + 0.02 * Math.sin(t * 2 + fase), 0, 0],
    head: [cabeza, 0, 0],
    shoulderR: [-1.05 + 0.08 * Math.sin(mano), 0, 0.12 + 0.12 * Math.cos(mano)],
    elbowR: [-0.55 + 0.1 * Math.cos(mano * 2), 0, 0],
    shoulderL: izquierda?.shoulderL ?? [-0.95, 0, -0.18],
    elbowL: izquierda?.elbowL ?? [-0.5, 0, 0],
    hipL: [-0.12, 0, 0.02],
    hipR: [-0.12, 0, -0.02],
    kneeL: [0.16, 0, 0],
    kneeR: [0.16, 0, 0],
    ankleL: [-0.04, 0, 0],
    ankleR: [-0.04, 0, 0],
  };
}

function operario(padre, m, fase) {
  const o = crearMascota(m, { nombre: 'operario', halo: false });
  vivo(o.grupo);
  o.grupo.position.set(0, 0, -(X_OPERARIO - X_MESA));
  padre.add(o.grupo);
  o.fase = fase;
  return o;
}

// ---------------------------------------------------------------- Puestos

function puestoDirectorFoto(m) {
  const grupo = new THREE.Group();
  mesa(grupo, m);
  const luz = lampara(grupo, m, 0.38, -0.12);
  // Cámara en trípode al lado de la mesa: tres patas, rótula, cuerpo y objetivo hacia el pasillo.
  const tripode = new THREE.Group();
  tripode.position.set(-0.68, 0, -0.12);
  grupo.add(tripode);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    pon(tripode, cil(0.011, 0.011, 0.86, 6), m.maquinaOscura, Math.sin(a) * 0.13, 0.42, Math.cos(a) * 0.13, { rot: [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3] });
  }
  pon(tripode, cil(0.03, 0.03, 0.05, 10), m.maquinaOscura, 0, 0.86, 0);
  const camara = new THREE.Group();
  camara.position.set(0, 0.94, 0);
  tripode.add(camara);
  pon(camara, caja(0.17, 0.12, 0.11, 0.02), m.tinta, 0, 0, 0);
  pon(camara, cil(0.048, 0.052, 0.08, 18), m.maquinaOscura, 0, 0, 0.09, { rot: [Math.PI / 2, 0, 0] });
  pon(camara, cil(0.035, 0.035, 0.01, 18), m.azul, 0, 0, 0.135, { rot: [Math.PI / 2, 0, 0], sombra: false });
  pon(camara, caja(0.05, 0.03, 0.04, 0.008), m.maquinaOscura, -0.04, 0.075, -0.01);
  // Portapapeles con la hoja y un lápiz (detalle de uso).
  pon(grupo, caja(0.15, 0.012, 0.2, 0.004), m.madera, -0.3, ALTO_MESA + 0.006, -0.08, { rot: [0, 0.2, 0] });
  pon(grupo, caja(0.12, 0.004, 0.15, 0.002), m.blanco, -0.3, ALTO_MESA + 0.014, -0.075, { rot: [0, 0.2, 0], sombra: false });
  pon(grupo, cil(0.006, 0.006, 0.15, 6), m.amarilloNo ?? m.madera, -0.18, ALTO_MESA + 0.01, -0.12, { rot: [0, 0, Math.PI / 2], sombra: false });
  const op = operario(grupo, m, 0.7);
  return {
    grupo,
    operario: op,
    spot: new THREE.Vector3(0.05, ALTO_MESA + 0.002, 0.04),
    animar({ t, trabajando }) {
      luz.poner(trabajando);
      if (!trabajando) return ponerPose(op, poseReposo(t, op.fase));
      // Alterna mirar por el visor de la cámara y anotar en la hoja: ciclo de 4 s.
      const c = (t % 4) / 4;
      const visor = suave(sat((c - 0.05) / 0.15)) * (1 - suave(sat((c - 0.45) / 0.15)));
      const anota = poseSobreMesa(t, op.fase, { mano: t * 9, cabeza: 0.45 });
      const mira = { ...anota, torso: [0.18, 0.75, 0.05], head: [0.1, 0.35, 0], shoulderL: [-1.3, 0, -0.35], elbowL: [-0.9, 0, 0], shoulderR: [-0.6, 0, 0.1], elbowR: [-0.6, 0, 0] };
      ponerPose(op, mixPose(anota, mira, visor));
    },
  };
}

function puestoRevisor(m) {
  const grupo = new THREE.Group();
  mesa(grupo, m);
  const luz = lampara(grupo, m, -0.38, -0.12);
  // Tampón y bandejas de salida (aceptadas / devueltas) como detalle de oficio.
  pon(grupo, caja(0.12, 0.02, 0.08, 0.008), m.maquinaOscura, 0.33, ALTO_MESA + 0.01, 0.06);
  pon(grupo, caja(0.1, 0.006, 0.06, 0.003), m.rojo, 0.33, ALTO_MESA + 0.022, 0.06, { sombra: false });
  for (const [x, mat] of [[0.33, m.verde], [0.2, m.rojo]]) {
    pon(grupo, caja(0.11, 0.03, 0.14, 0.006), mat, x - 0.0, ALTO_MESA + 0.015, -0.12);
  }
  const op = operario(grupo, m, 2.1);
  // La lupa en la mano derecha: aro, cristal y mango (va con la muñeca).
  const lupa = new THREE.Group();
  lupa.position.set(0, -0.08, 0.04);
  lupa.rotation.set(-1.2, 0, 0);
  op.J.wristR.add(lupa);
  pon(lupa, g('aro', () => new THREE.TorusGeometry(0.055, 0.01, 8, 24)), m.maquinaOscura, 0, -0.07, 0, { rot: [Math.PI / 2, 0, 0] });
  pon(lupa, cil(0.05, 0.05, 0.004, 24), m.lamparaApagada, 0, -0.07, 0, { sombra: false });
  pon(lupa, cil(0.012, 0.012, 0.08, 8), m.madera, 0, 0, 0);
  // El sello en la izquierda: mango y base que marca la foto.
  const sello = new THREE.Group();
  sello.position.set(0, -0.07, 0.02);
  op.J.wristL.add(sello);
  pon(sello, cil(0.016, 0.02, 0.06, 10), m.madera, 0, 0, 0);
  pon(sello, caja(0.06, 0.025, 0.045, 0.006), m.maquinaOscura, 0, -0.04, 0);
  return {
    grupo,
    operario: op,
    spot: new THREE.Vector3(-0.05, ALTO_MESA + 0.002, 0.04),
    animar({ t, trabajando, k, sella }) {
      luz.poner(trabajando);
      if (!trabajando) return ponerPose(op, poseReposo(t, op.fase));
      // Pasa la lupa por la foto; al final (si el guion lo pide) levanta el sello y marca.
      const barre = poseSobreMesa(t, op.fase, { mano: t * 2.4, cabeza: 0.5, izquierda: { shoulderL: [-0.45, 0, -0.25], elbowL: [-0.9, 0, 0] } });
      if (!sella) return ponerPose(op, barre);
      const arriba = sat((k - 0.55) / 0.15) * (1 - sat((k - 0.72) / 0.06));
      const golpe = sat((k - 0.72) / 0.06) * (1 - sat((k - 0.9) / 0.1));
      const brazo = { shoulderL: [-1.05 - 0.4 * arriba + 0.15 * golpe, 0.1, -0.05], elbowL: [-0.75 - 0.5 * arriba + 0.15 * golpe, 0, 0] };
      ponerPose(op, { ...barre, ...brazo, head: [0.5, 0.15, 0] });
    },
  };
}

function puestoDirectorDiseno(m) {
  const grupo = new THREE.Group();
  mesa(grupo, m);
  const luz = lampara(grupo, m, 0.38, -0.12);
  // Atril de dibujo pequeño, regla, bote de lápices y papeles enrollados en una papelera (las propuestas de antes).
  pon(grupo, caja(0.3, 0.012, 0.03, 0.004), m.gris, -0.28, ALTO_MESA + 0.006, 0.12, { rot: [0, 0.15, 0] });
  pon(grupo, cil(0.035, 0.03, 0.09, 12), m.azul, -0.38, ALTO_MESA + 0.045, -0.13);
  for (const [dx, c] of [[-0.012, m.rojo], [0.01, m.tinta], [0.0, m.verde]]) pon(grupo, cil(0.005, 0.005, 0.13, 6), c, -0.38 + dx, ALTO_MESA + 0.1, -0.13 + dx, { rot: [dx * 8, 0, dx * 10], sombra: false });
  const papelera = new THREE.Group();
  papelera.position.set(-0.68, 0, 0.05);
  grupo.add(papelera);
  pon(papelera, g('papelera', () => new THREE.CylinderGeometry(0.12, 0.1, 0.26, 16, 1, true)), m.gris, 0, 0.13, 0);
  pon(papelera, cil(0.1, 0.1, 0.01, 16), m.gris, 0, 0.005, 0);
  for (const [x, z, r] of [[0.02, 0.02, 0.3], [-0.04, -0.03, -0.5], [0.04, -0.04, 1.1]]) pon(papelera, g('bola', () => new THREE.IcosahedronGeometry(0.05, 0)), m.blanco, x, 0.26, z, { rot: [r, r * 2, 0] });
  sombraContacto(papelera, m, 0.3, 0.3);
  const op = operario(grupo, m, 4.4);
  const lapiz = new THREE.Group();
  lapiz.position.set(0, -0.07, 0.03);
  lapiz.rotation.set(-0.5, 0, 0);
  op.J.wristR.add(lapiz);
  pon(lapiz, cil(0.007, 0.007, 0.12, 6), m.azul, 0, -0.03, 0);
  pon(lapiz, g('punta', () => new THREE.ConeGeometry(0.007, 0.02, 6)), m.tinta, 0, -0.1, 0, { rot: [Math.PI, 0, 0] });
  return {
    grupo,
    operario: op,
    spot: new THREE.Vector3(0.05, ALTO_MESA + 0.002, 0.04),
    animar({ t, trabajando }) {
      luz.poner(trabajando);
      if (!trabajando) return ponerPose(op, poseReposo(t, op.fase));
      // Trazos rápidos con el lápiz; cada 3 s levanta la cabeza a pensar.
      const piensa = suave(sat(((t % 3) - 2.2) / 0.3)) * (1 - suave(sat(((t % 3) - 2.7) / 0.3)));
      const dibuja = poseSobreMesa(t, op.fase, { mano: t * 14, cabeza: 0.5 });
      ponerPose(op, mixPose(dibuja, { ...dibuja, head: [-0.15, 0.25, 0], shoulderR: [-0.5, 0, 0.2], elbowR: [-1.4, 0, 0] }, piensa));
    },
  };
}

/** Pata corta de máquina con su zapata. */
function patasMaquina(padre, m, w, d) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pon(padre, caja(0.07, 0.05, 0.07, 0.01), m.maquinaOscura, sx * (w / 2 - 0.06), 0.025, sz * (d / 2 - 0.06));
  sombraContacto(padre, m, w + 0.2, d + 0.2);
}

function puestoGenerador(m) {
  // Marco local: +Z al pasillo; +X hacia la cámara. Entrada arriba (ranura), salida abajo (bandeja), ojo de buey y
  // manivela en la cara que ve la cámara, flash arriba.
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.position.set(0, 0, -0.2);
  grupo.add(cuerpo);
  patasMaquina(cuerpo, m, 0.9, 0.5);
  pon(cuerpo, caja(0.9, 1.0, 0.5, 0.06), m.maquina, 0, 0.55, 0);
  pon(cuerpo, caja(0.92, 0.07, 0.52, 0.02), m.azul, 0, 0.1, 0);
  pon(cuerpo, caja(0.92, 0.05, 0.52, 0.02), m.azul, 0, 1.03, 0);
  // Ranura de entrada (cara del pasillo) y bandeja de salida.
  pon(cuerpo, caja(0.32, 0.03, 0.02, 0.008), m.tinta, 0, 0.86, 0.25, { sombra: false });
  pon(cuerpo, caja(0.34, 0.07, 0.04, 0.012), m.maquinaOscura, 0, 0.9, 0.26);
  const bandeja = new THREE.Group();
  bandeja.position.set(0, ALTO_MESA - 0.02, 0.25);
  cuerpo.add(bandeja);
  pon(bandeja, caja(0.34, 0.02, 0.2, 0.006), m.maquinaOscura, 0, 0, 0.09);
  pon(bandeja, caja(0.34, 0.04, 0.015, 0.005), m.maquinaOscura, 0, 0.02, 0.19);
  pon(cuerpo, caja(0.3, 0.04, 0.02, 0.008), m.tinta, 0, ALTO_MESA + 0.03, 0.25, { sombra: false });
  // Ojo de buey en la cara +X (la que ve la cámara): aro, cristal oscuro y la luz de trabajo dentro.
  const ojo = new THREE.Group();
  ojo.position.set(0.455, 0.62, 0);
  ojo.rotation.z = -Math.PI / 2;
  cuerpo.add(ojo);
  pon(ojo, g('aroOjo', () => new THREE.TorusGeometry(0.14, 0.025, 10, 28)), m.maquinaOscura, 0, 0, 0, { rot: [Math.PI / 2, 0, 0] });
  pon(ojo, cil(0.125, 0.125, 0.012, 28), m.maquinaOscura, 0, -0.005, 0, { sombra: false });
  const brillo = vivo(pon(ojo, cil(0.07, 0.07, 0.014, 24), m.lamparaApagada, 0, 0.004, 0, { sombra: false }));
  // Manivela (gira mientras trabaja) y placa.
  const manivela = new THREE.Group();
  manivela.position.set(0.46, 0.3, 0.15);
  manivela.rotation.z = -Math.PI / 2;
  cuerpo.add(manivela);
  pon(manivela, cil(0.035, 0.035, 0.03, 14), m.maquinaOscura, 0, 0.015, 0);
  const brazo = vivo(new THREE.Group());
  brazo.position.y = 0.035;
  manivela.add(brazo);
  pon(brazo, caja(0.025, 0.02, 0.12, 0.006), m.azul, 0, 0, 0.05);
  pon(brazo, cil(0.014, 0.014, 0.06, 8), m.rojo, 0, 0.03, 0.1);
  pon(cuerpo, caja(0.012, 0.08, 0.22, 0.004), m.azul, 0.455, 0.93, -0.05, { sombra: false });
  // Flash arriba: reflector y bombilla.
  const flash = new THREE.Group();
  flash.position.set(0.15, 1.08, 0.05);
  cuerpo.add(flash);
  pon(flash, caja(0.06, 0.12, 0.06, 0.01), m.maquinaOscura, 0, 0.06, 0);
  pon(flash, caja(0.2, 0.12, 0.05, 0.015), m.maquina, 0, 0.17, 0.02, { rot: [-0.3, 0, 0] });
  const bombilla = vivo(pon(flash, cil(0.07, 0.07, 0.01, 18), m.lamparaApagada, 0, 0.17, 0.05, { rot: [Math.PI / 2 - 0.3, 0, 0], sombra: false }));
  return {
    grupo,
    entrada: new THREE.Vector3(0, 0.875, 0.06),
    spot: new THREE.Vector3(0, ALTO_MESA + 0.012, 0.15),
    animar({ t, trabajando, k }) {
      brillo.material = trabajando && Math.sin(t * 6) > -0.2 ? m.lamparaEncendida : m.lamparaApagada;
      bombilla.material = trabajando && k > 0.8 && k < 0.88 ? m.lamparaEncendida : m.lamparaApagada;
      brazo.rotation.y = trabajando ? t * 4.5 : 0;
    },
  };
}

function puestoMascara(m) {
  // Recortadora: mesa-armario y, encima, cama plana con un pórtico que lleva la cuchilla en círculo.
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.position.set(0, 0, -0.05);
  grupo.add(cuerpo);
  patasMaquina(cuerpo, m, 0.8, 0.5);
  pon(cuerpo, caja(0.8, ALTO_MESA - 0.07, 0.5, 0.05), m.maquina, 0, (ALTO_MESA - 0.07) / 2 + 0.05, 0);
  pon(cuerpo, caja(0.82, 0.04, 0.52, 0.015), m.azul, 0, 0.09, 0);
  pon(cuerpo, caja(0.72, 0.02, 0.44, 0.008), m.maquinaOscura, 0, ALTO_MESA - 0.01, 0);
  for (const sx of [-1, 1]) pon(cuerpo, caja(0.03, 0.03, 0.46, 0.008), m.gris, sx * 0.37, ALTO_MESA + 0.01, 0);
  const portico = vivo(new THREE.Group());
  cuerpo.add(portico);
  for (const sx of [-1, 1]) pon(portico, caja(0.05, 0.12, 0.06, 0.01), m.maquinaOscura, sx * 0.37, ALTO_MESA + 0.08, 0);
  pon(portico, caja(0.78, 0.045, 0.06, 0.012), m.azul, 0, ALTO_MESA + 0.15, 0);
  const cabezal = new THREE.Group();
  cabezal.position.y = ALTO_MESA + 0.15;
  portico.add(cabezal);
  pon(cabezal, caja(0.07, 0.07, 0.09, 0.01), m.maquina, 0, 0, 0);
  pon(cabezal, g('cuchilla', () => new THREE.ConeGeometry(0.012, 0.09, 8)), m.maquinaOscura, 0, -0.07, 0, { rot: [Math.PI, 0, 0] });
  const piloto = vivo(pon(cuerpo, cil(0.025, 0.025, 0.01, 12), m.lamparaApagada, 0.401, ALTO_MESA - 0.12, 0.12, { rot: [0, 0, Math.PI / 2], sombra: false }));
  // Recortes de otros trabajos en el suelo (detalle de uso).
  pon(grupo, caja(0.06, 0.004, 0.05, 0.002), m.blanco, 0.48, 0.004, 0.2, { rot: [0, 0.6, 0], sombra: false });
  pon(grupo, caja(0.05, 0.004, 0.04, 0.002), m.blanco, 0.42, 0.004, 0.28, { rot: [0, -0.3, 0], sombra: false });
  return {
    grupo,
    spot: new THREE.Vector3(0, ALTO_MESA + 0.002, -0.05),
    animar({ t, trabajando, k }) {
      piloto.material = trabajando ? m.lamparaEncendida : m.lamparaApagada;
      // El cabezal sigue una elipse (el contorno del plato) mientras recorta; en reposo, aparcado a un lado.
      const a = trabajando ? t * 2.2 : 0;
      const r = trabajando ? 1 : 0;
      portico.position.z = r * 0.09 * Math.sin(a);
      cabezal.position.x = trabajando ? 0.09 * Math.cos(a) : 0.3;
      cabezal.position.y = ALTO_MESA + 0.15 - (trabajando ? 0.02 : 0);
      void k;
    },
  };
}

function puestoCompositor(m) {
  // Prensa: armario, dos columnas, travesaño, platina que baja e imprime y volante en la cara de la cámara.
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.position.set(0, 0, -0.08);
  grupo.add(cuerpo);
  patasMaquina(cuerpo, m, 0.9, 0.55);
  pon(cuerpo, caja(0.9, ALTO_MESA - 0.07, 0.55, 0.05), m.maquina, 0, (ALTO_MESA - 0.07) / 2 + 0.05, 0);
  pon(cuerpo, caja(0.92, 0.04, 0.57, 0.015), m.azul, 0, 0.09, 0);
  pon(cuerpo, caja(0.5, 0.02, 0.4, 0.008), m.maquinaOscura, 0, ALTO_MESA - 0.01, 0);
  for (const sx of [-1, 1]) pon(cuerpo, cil(0.03, 0.03, 0.62, 12), m.maquinaOscura, sx * 0.3, ALTO_MESA + 0.31, -0.12);
  pon(cuerpo, caja(0.72, 0.1, 0.14, 0.02), m.azul, 0, ALTO_MESA + 0.62, -0.12);
  const platina = vivo(new THREE.Group());
  cuerpo.add(platina);
  pon(platina, cil(0.018, 0.018, 0.3, 8), m.gris, 0, ALTO_MESA + 0.45, -0.02);
  pon(platina, caja(0.36, 0.05, 0.3, 0.012), m.maquinaOscura, 0, ALTO_MESA + 0.3, 0.0);
  // Volante en la cara +X.
  const volante = vivo(new THREE.Group());
  volante.position.set(0.47, ALTO_MESA + 0.32, -0.12);
  volante.rotation.z = -Math.PI / 2;
  cuerpo.add(volante);
  pon(volante, g('volante', () => new THREE.TorusGeometry(0.13, 0.014, 8, 26)), m.rojo, 0, 0, 0, { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) pon(volante, caja(0.012, 0.012, 0.26, 0.004), m.maquinaOscura, 0, 0, 0, { rot: [0, (i * Math.PI) / 3, 0] });
  const piloto = vivo(pon(cuerpo, g('piloto', () => new THREE.SphereGeometry(0.03, 12, 8)), m.lamparaApagada, 0.3, ALTO_MESA + 0.7, -0.12, { sombra: false }));
  // Pila de pliegos impresos a un lado (detalle de uso).
  for (let i = 0; i < 4; i++) pon(cuerpo, caja(0.2, 0.01, 0.25, 0.003), m.blanco, -0.62, 0.01 + i * 0.012, 0.05 + (i % 2) * 0.01, { rot: [0, 0.05 * i, 0] });
  return {
    grupo,
    spot: new THREE.Vector3(0, ALTO_MESA + 0.002, -0.08),
    animar({ t, trabajando }) {
      piloto.material = trabajando ? m.lamparaEncendida : m.lamparaApagada;
      // Tres golpes de prensa por ciclo de 2,4 s; el volante gira con la bajada.
      const c = trabajando ? (t % 0.8) / 0.8 : 0;
      const baja = trabajando ? Math.sin(Math.PI * Math.min(1, c / 0.6)) : 0;
      platina.position.y = -0.24 * baja;
      volante.rotation.y = trabajando ? t * 3 : 0;
    },
  };
}

function puestoReferencia(m) {
  // Tablero de corcho en caballete, con las fichas de las referencias clavadas.
  const grupo = new THREE.Group();
  for (const sx of [-1, 1]) pon(grupo, caja(0.04, 1.35, 0.04, 0.01), m.madera, sx * 0.48, 0.675, -0.05, { rot: [-0.08, 0, 0] });
  pon(grupo, caja(0.04, 1.2, 0.04, 0.01), m.madera, 0, 0.6, -0.32, { rot: [0.32, 0, 0] });
  pon(grupo, caja(1.0, 0.68, 0.04, 0.012), m.madera, 0, 1.0, -0.02, { rot: [-0.08, 0, 0] });
  pon(grupo, caja(0.9, 0.58, 0.03, 0.008), m.corcho, 0, 1.0, 0.005, { rot: [-0.08, 0, 0], sombra: false });
  const fichas = [];
  for (const [x, y, r] of [[-0.28, 1.12, 0.06], [0.0, 1.08, -0.04], [0.28, 1.13, 0.05], [-0.14, 0.86, -0.08], [0.17, 0.85, 0.03]]) {
    const f = crearTarjeta(m, 0.16, 0.2);
    f.poner('ficha');
    f.grupo.position.set(x, y, 0.03);
    f.grupo.rotation.set(Math.PI / 2 - 0.08, 0, r);
    grupo.add(f.grupo);
    pon(f.grupo, g('chincheta', () => new THREE.SphereGeometry(0.014, 8, 6)), m.azul, 0, 0.02, -0.08, { sombra: false });
    fichas.push(f);
  }
  sombraContacto(grupo, m, 1.2, 0.6, 0, -0.1);
  return {
    grupo,
    // La ficha central es la que coge el corredor (la referencia del encargo).
    spot: new THREE.Vector3(0, 0.98, 0.06),
    spotVertical: true,
    fichaTomada: fichas[1],
    animar() {},
  };
}

function puestoEntrada(m) {
  // Bandeja de entrada en un velador: aquí llega la foto que sube el hostelero (y esperan los otros encargos).
  const grupo = new THREE.Group();
  pon(grupo, cil(0.04, 0.05, ALTO_MESA - 0.05, 12), m.pata, 0, (ALTO_MESA - 0.05) / 2, -0.1);
  pon(grupo, cil(0.2, 0.22, 0.03, 20), m.pata, 0, 0.015, -0.1);
  pon(grupo, caja(0.5, 0.04, 0.42, 0.012), m.mesa, 0, ALTO_MESA - 0.03, -0.1);
  pon(grupo, caja(0.34, 0.012, 0.3, 0.006), m.azul, 0, ALTO_MESA - 0.004, -0.06);
  for (const [w, d, x, z] of [[0.36, 0.02, 0, 0.09], [0.36, 0.02, 0, -0.21], [0.02, 0.32, 0.17, -0.06], [0.02, 0.32, -0.17, -0.06]]) pon(grupo, caja(w, 0.04, d, 0.005), m.azul, x, ALTO_MESA + 0.016, z);
  // Pila de los otros encargos abiertos (se ve cuántos hay).
  const pila = [];
  for (let i = 0; i < 4; i++) {
    const f = crearTarjeta(m, 0.18, 0.22);
    f.poner('foto');
    f.grupo.position.set(-0.36 + i * 0.008, ALTO_MESA - 0.01 + i * 0.013, -0.2);
    f.grupo.rotation.y = 0.25 + i * 0.12;
    f.grupo.visible = false;
    grupo.add(f.grupo);
    pila.push(f);
  }
  sombraContacto(grupo, m, 0.5, 0.5, 0, -0.1);
  return {
    grupo,
    spot: new THREE.Vector3(0, ALTO_MESA + 0.004, -0.06),
    pila,
    animar({ otros = 0 }) {
      pila.forEach((f, i) => (f.grupo.visible = i < otros));
    },
  };
}

function puestoSalida(m) {
  // Bandeja de salida: un expositor de pie con marco azul donde queda el post terminado (vacío, enseña el hueco).
  const grupo = new THREE.Group();
  pon(grupo, cil(0.24, 0.26, 0.04, 24), m.maquinaOscura, 0, 0.02, -0.05);
  pon(grupo, cil(0.025, 0.025, 0.62, 10), m.maquinaOscura, 0, 0.33, -0.08);
  const marco = new THREE.Group();
  marco.position.set(0, 0.86, -0.04);
  marco.rotation.x = -0.2;
  grupo.add(marco);
  pon(marco, caja(0.34, 0.4, 0.04, 0.02), m.azul, 0, 0, -0.012);
  pon(marco, caja(0.27, 0.33, 0.01, 0.004), m.gris, 0, 0, 0.01, { sombra: false });
  pon(marco, caja(0.3, 0.03, 0.06, 0.008), m.maquinaOscura, 0, -0.205, 0.02);
  sombraContacto(grupo, m, 0.6, 0.6, 0, -0.05);
  return {
    grupo,
    spot: new THREE.Vector3(0, 0.86, -0.02),
    spotVertical: true,
    animar() {},
  };
}

/** Letrero amarillo de «te toca» en su poste: aparece con un rebote cuando el encargo espera a la persona. */
export function crearSenal(m) {
  const grupo = vivo(new THREE.Group());
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  pon(cuerpo, cil(0.018, 0.018, 1.25, 8), m.maquinaOscura, 0, 0.625, 0);
  pon(cuerpo, cil(0.1, 0.12, 0.04, 16), m.maquinaOscura, 0, 0.02, 0);
  const placa = new THREE.Group();
  placa.position.y = 1.32;
  cuerpo.add(placa);
  pon(placa, caja(0.52, 0.27, 0.03, 0.03), m.amarillo, 0, 0, 0);
  const tex = texturaLetrero('TE TOCA', { fondo: COLOR.amarillo, tamano: 0.52 });
  for (const s of [1, -1]) {
    const cara = new THREE.Mesh(g('caraSenal', () => new THREE.PlaneGeometry(0.46, 0.22)), new THREE.MeshBasicMaterial({ map: tex }));
    cara.material.userData.outlineParameters = { visible: false };
    cara.position.z = s * 0.0165;
    if (s < 0) cara.rotation.y = Math.PI;
    placa.add(cara);
  }
  grupo.visible = false;
  return {
    grupo,
    /** k: 0 escondida → 1 arriba, con rebote al subir. */
    poner(k, t = 0) {
      grupo.visible = k > 0.001;
      const s = k <= 0 ? 0 : k >= 1 ? 1 : 1 + Math.sin(k * Math.PI * 1.5) * (1 - k) * 0.6 - (1 - k);
      cuerpo.scale.set(1, Math.max(0.001, s), 1);
      placa.rotation.z = k >= 1 ? 0.05 * Math.sin(t * 2.2) : 0;
    },
  };
}

/** Nube de aviso sobre un puesto: un fallo real (503, tiempo agotado…) o un reintento. Texto de cara a la cámara. */
export function crearNube(m) {
  const grupo = vivo(new THREE.Group());
  const bolas = new THREE.Group();
  grupo.add(bolas);
  for (const [x, y, r] of [[0, 0, 0.17], [-0.17, -0.03, 0.12], [0.17, -0.02, 0.13], [-0.08, 0.1, 0.12], [0.09, 0.09, 0.12]]) pon(bolas, g(`nube:${r}`, () => new THREE.SphereGeometry(r, 16, 10)), m.blanco, x, y, 0, { esc: [1, 0.85, 0.7], sombra: false });
  const cartel = new THREE.Mesh(g('caraNube', () => new THREE.PlaneGeometry(0.32, 0.16)), new THREE.MeshBasicMaterial({ transparent: true }));
  cartel.material.userData.outlineParameters = { visible: false };
  cartel.position.z = 0.13;
  bolas.add(cartel);
  grupo.visible = false;
  let texto = null;
  return {
    grupo,
    poner({ visible, rotulo, error, t = 0, camara }) {
      grupo.visible = visible;
      if (!visible) return;
      if (rotulo !== texto) {
        texto = rotulo;
        cartel.material.map = texturaLetrero(rotulo, { fondo: COLOR.blanco, tinta: error ? COLOR.rojo : COLOR.tinta, tamano: 0.78 });
        cartel.material.needsUpdate = true;
      }
      if (camara) grupo.quaternion.copy(camara.quaternion);
      bolas.position.y = 0.03 * Math.sin(t * 1.8);
    },
  };
}

function parada(m) {
  const grupo = new THREE.Group();
  const placa = vivo(pon(grupo, caja(0.9, 0.03, 0.9, 0.06), m.gris, 0, 0.015, 0, { sombra: false }));
  // Una mano dibujada en el suelo: aquí actúa la persona.
  const mano = new THREE.Group();
  mano.position.y = 0.032;
  grupo.add(mano);
  pon(mano, cil(0.09, 0.09, 0.004, 20), m.blanco, 0, 0, 0.02, { sombra: false });
  for (let i = 0; i < 4; i++) pon(mano, caja(0.03, 0.004, 0.09, 0.012), m.blanco, -0.06 + i * 0.04, 0, -0.1 + Math.abs(i - 1.5) * 0.015, { sombra: false });
  const senal = crearSenal(m);
  senal.grupo.position.set(0.58, 0, 0.18);
  grupo.add(senal.grupo);
  return {
    grupo,
    senal,
    animar({ t, espera }) {
      placa.material = espera > 0 ? m.amarillo : m.gris;
      senal.poner(espera, t);
    },
  };
}

// ---------------------------------------------------------------- El conjunto

export function crearDecorado(m) {
  const escena = new THREE.Group();
  const { ancho, largo, grueso } = LOSA;

  // Losa: cuerpo azul de marca con su canto y un tablero de papel encima.
  pon(escena, caja(ancho, grueso - 0.05, largo, 0.08), m.losaCanto, 0, -grueso / 2 - 0.025, 0, { sombra: false });
  pon(escena, caja(ancho, 0.06, largo, 0.03), m.losa, 0, -0.03, 0, { sombra: false });
  // Pasillo gastado por el uso, con flechas que marcan el sentido del material.
  pon(escena, g("pasillo", () => new THREE.PlaneGeometry(1.3, largo - 0.6)), m.pasillo, 0, 0.002, 0, { rot: [-Math.PI / 2, 0, 0], sombra: false });
  const flecha = g('flecha', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.16, 0);
    s.lineTo(0, 0.14);
    s.lineTo(0.16, 0);
    s.lineTo(0.16, -0.06);
    s.lineTo(0, 0.08);
    s.lineTo(-0.16, -0.06);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  });
  for (const z of [-3.95, -0.45, 2.7, 4.95]) pon(escena, flecha, m.marca, 0, 0.004, z, { rot: [-Math.PI / 2, 0, Math.PI], sombra: false });

  // Pared del fondo con el rótulo del estudio (el hito del diorama).
  const pared = new THREE.Group();
  pared.position.set(0, 0, -largo / 2 + 0.12);
  escena.add(pared);
  pon(pared, caja(ancho - 0.1, 1.3, 0.14, 0.03), m.blanco, 0, 0.65, 0);
  pon(pared, caja(ancho - 0.06, 0.06, 0.18, 0.02), m.azul, 0, 1.31, 0);
  pon(pared, caja(ancho - 0.06, 0.08, 0.18, 0.02), m.azul, 0, 0.04, 0);
  const rotulo = new THREE.Mesh(g('rotulo', () => new THREE.PlaneGeometry(1.7, 0.42)), new THREE.MeshBasicMaterial({ map: texturaLetrero('estudio', { fondo: COLOR.azul, tinta: COLOR.blanco, ancho: 512, alto: 128, tamano: 0.72 }) }));
  rotulo.material.userData.outlineParameters = { visible: false };
  rotulo.position.set(0, 0.78, 0.09);
  pared.add(rotulo);
  pon(pared, caja(1.78, 0.5, 0.02, 0.02), m.azul, 0, 0.78, 0.065, { sombra: false });

  const constructores = {
    referencia: puestoReferencia,
    entrada: puestoEntrada,
    directorFoto: puestoDirectorFoto,
    generador: puestoGenerador,
    revisor: puestoRevisor,
    mascara: puestoMascara,
    directorDiseno: puestoDirectorDiseno,
    compositor: puestoCompositor,
    salida: puestoSalida,
    parada1: parada,
    parada2: parada,
  };
  const puestos = {};
  for (const [id, p] of Object.entries(PUESTOS)) {
    const puesto = constructores[id](m);
    const marco = marcoDePuesto(id);
    puesto.grupo.position.set(marco.x, 0, marco.z);
    puesto.grupo.rotation.y = marco.yaw;
    puesto.grupo.name = id;
    puesto.tipo = p.tipo;
    escena.add(puesto.grupo);
    puestos[id] = puesto;
  }
  escena.updateMatrixWorld(true);
  // El sitio del material de cada puesto, en el mundo.
  for (const puesto of Object.values(puestos)) {
    if (puesto.spot) puesto.spotMundo = puesto.spot.clone().applyMatrix4(puesto.grupo.matrixWorld);
    if (puesto.entrada) puesto.entradaMundo = puesto.entrada.clone().applyMatrix4(puesto.grupo.matrixWorld);
  }

  // Señal y nube móviles para las esperas y avisos fuera de las paradas.
  const senal = crearSenal(m);
  escena.add(senal.grupo);
  const nube = crearNube(m);
  escena.add(nube.grupo);

  return { grupo: escena, puestos, senal, nube };
}
