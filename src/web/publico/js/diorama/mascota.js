// La mascota de SOCIETY a escala de juguete, hecha a mano (modelos authored-only): casco blanco con la cara negra
// mate y dos ojos blancos verticales, sudadera azul #1033EF con capucha y la estrella amarilla, pantalón negro,
// guantes y zapatillas blancas. Mide ~1,05 m: cabeza grande de juguete sobre un cuerpo corto.
//
// Sigue las convenciones del rig del kit (peopleModel-street.js): raíz en los pies, mira a +Z, un grupo por
// articulación con la geometría colgando hacia -Y y los mismos nombres de articulación, así que las poses del kit
// (STAND, walkPose) valen con sus signos: +X en cadera o hombro lleva el miembro atrás, +X en rodilla dobla el talón
// atrás, -X en el codo dobla el antebrazo hacia la cara.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const RIG = Object.freeze({
  hipY: 0.4,
  hipX: 0.058,
  thigh: 0.19,
  shin: 0.18,
  shoulderY: 0.235,
  shoulderX: 0.135,
  upperArm: 0.13,
  foreArm: 0.115,
  headY: 0.285,
});

/** Distancia que avanza un ciclo de paso completo (dos pasos) para que los pies no patinen: 2·2·pierna·sin(amp). */
export const ZANCADA = 4 * (RIG.thigh + RIG.shin) * Math.sin(0.34);

function malla(padre, geo, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.esc) m.scale.set(...o.esc);
  m.castShadow = o.sombra ?? true;
  m.receiveShadow = false;
  padre.add(m);
  return m;
}

const geoCache = new Map();
function geo(clave, crear) {
  if (!geoCache.has(clave)) geoCache.set(clave, crear());
  return geoCache.get(clave);
}

function estrella(r, grosor) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: grosor, bevelEnabled: false });
}

/**
 * @param m materiales de crearMateriales
 * @param opts.halo el aro fino sobre la cabeza (como en la presentación)
 */
export function crearMascota(m, opts = {}) {
  const raiz = new THREE.Group();
  raiz.name = opts.nombre ?? 'mascota';
  const J = {};

  const pelvis = new THREE.Group();
  pelvis.position.y = RIG.hipY;
  raiz.add(pelvis);
  J.pelvis = pelvis;
  // Cadera: el pantalón negro, ovalado.
  malla(pelvis, geo('cadera', () => new THREE.SphereGeometry(0.1, 18, 12)), m.pantalon, 0, 0.0, 0, { esc: [1.05, 0.62, 0.82] });

  const torso = new THREE.Group();
  torso.position.y = 0.02;
  pelvis.add(torso);
  J.torso = torso;
  // Sudadera: un torno con bajo acanalado, bolsillo canguro, capucha a la espalda y la estrella amarilla.
  const perfil = [
    [0.0, -0.05],
    [0.118, -0.05],
    [0.125, -0.02],
    [0.13, 0.06],
    [0.138, 0.16],
    [0.132, 0.22],
    [0.105, 0.265],
    [0.06, 0.29],
    [0.0, 0.295],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const cuerpo = geo('sudadera', () => {
    const g = new THREE.LatheGeometry(perfil, 22);
    g.scale(1, 1, 0.82);
    return g;
  });
  malla(torso, cuerpo, m.azul, 0, 0, 0);
  malla(torso, geo('bajo', () => new THREE.CylinderGeometry(0.122, 0.124, 0.035, 22)), m.azulHondo, 0, -0.035, 0, { esc: [1, 1, 0.82] });
  malla(torso, geo('bolsillo', () => new RoundedBoxGeometry(0.15, 0.07, 0.02, 2, 0.008)), m.azulHondo, 0, 0.035, 0.1, { rot: [-0.12, 0, 0] });
  malla(torso, geo('capucha', () => new THREE.TorusGeometry(0.075, 0.034, 10, 20)), m.azul, 0, 0.255, -0.05, { rot: [Math.PI / 2 - 0.5, 0, 0], esc: [1.15, 1, 1] });
  malla(torso, geo('estrella', () => estrella(0.032, 0.008)), m.amarillo, 0.055, 0.16, 0.104, { rot: [-0.18, 0.28, 0], sombra: false });
  // Cordones de la capucha.
  for (const s of [-1, 1]) malla(torso, geo('cordon', () => new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6)), m.blanco, s * 0.03, 0.22, 0.095, { rot: [0.25, 0, 0], sombra: false });

  // Cabeza: casco blanco redondeado, cara negra mate (sin reflejo) y ojos blancos verticales.
  const cabeza = new THREE.Group();
  cabeza.position.y = RIG.headY;
  torso.add(cabeza);
  J.head = cabeza;
  malla(cabeza, geo('cuello', () => new THREE.CylinderGeometry(0.045, 0.05, 0.05, 12)), m.pantalon, 0, 0.0, 0);
  malla(cabeza, geo('casco', () => new RoundedBoxGeometry(0.4, 0.33, 0.33, 4, 0.13)), m.blanco, 0, 0.18, 0);
  // La cara asoma por delante del casco (si no, queda hundida y la cabeza se lee como una bola blanca).
  malla(cabeza, geo('cara', () => new THREE.SphereGeometry(0.15, 24, 16)), m.tinta, 0, 0.19, 0.122, { esc: [1.14, 0.92, 0.5], sombra: false });
  for (const s of [-1, 1]) malla(cabeza, geo('ojo', () => new THREE.CapsuleGeometry(0.018, 0.05, 4, 10)), m.blanco, s * 0.052, 0.2, 0.192, { esc: [1, 1, 0.55], sombra: false });
  if (opts.halo) malla(cabeza, geo('halo', () => new THREE.TorusGeometry(0.15, 0.007, 6, 40)), m.tinta, 0, 0.41, -0.01, { rot: [Math.PI / 2 - 0.25, 0, 0.12], sombra: false });

  // Brazos: manga azul, puño acanalado y guante blanco (mitón con pulgar).
  for (const s of [-1, 1]) {
    const hombro = new THREE.Group();
    hombro.position.set(s * RIG.shoulderX, RIG.shoulderY, 0);
    torso.add(hombro);
    malla(hombro, geo('hombro', () => new THREE.SphereGeometry(0.045, 14, 10)), m.azul, 0, 0, 0);
    malla(hombro, geo('brazo', () => new THREE.CapsuleGeometry(0.038, RIG.upperArm - 0.03, 4, 12)), m.azul, 0, -RIG.upperArm / 2, 0);
    const codo = new THREE.Group();
    codo.position.y = -RIG.upperArm;
    hombro.add(codo);
    malla(codo, geo('antebrazo', () => new THREE.CapsuleGeometry(0.034, RIG.foreArm - 0.04, 4, 12)), m.azul, 0, -RIG.foreArm / 2 + 0.005, 0);
    malla(codo, geo('puno', () => new THREE.CylinderGeometry(0.036, 0.036, 0.025, 12)), m.azulHondo, 0, -RIG.foreArm + 0.012, 0);
    const muneca = new THREE.Group();
    muneca.position.y = -RIG.foreArm;
    codo.add(muneca);
    malla(muneca, geo('mano', () => new THREE.SphereGeometry(0.042, 14, 10)), m.blanco, 0, -0.035, 0.005, { esc: [0.95, 1.1, 0.8] });
    malla(muneca, geo('pulgar', () => new THREE.CapsuleGeometry(0.013, 0.02, 3, 8)), m.blanco, s * 0.033, -0.025, 0.022, { rot: [0.4, 0, -s * 0.6] });
    J[s < 0 ? 'shoulderL' : 'shoulderR'] = hombro;
    J[s < 0 ? 'elbowL' : 'elbowR'] = codo;
    J[s < 0 ? 'wristL' : 'wristR'] = muneca;
  }

  // Piernas: pantalón negro y zapatillas blancas con suela y raya negras.
  for (const s of [-1, 1]) {
    const cadera = new THREE.Group();
    cadera.position.set(s * RIG.hipX, -0.03, 0);
    pelvis.add(cadera);
    malla(cadera, geo('muslo', () => new THREE.CapsuleGeometry(0.043, RIG.thigh - 0.04, 4, 10)), m.pantalon, 0, -RIG.thigh / 2, 0);
    const rodilla = new THREE.Group();
    rodilla.position.y = -RIG.thigh;
    cadera.add(rodilla);
    malla(rodilla, geo('rodilla', () => new THREE.SphereGeometry(0.04, 10, 8)), m.pantalon, 0, 0, 0);
    malla(rodilla, geo('espinilla', () => new THREE.CapsuleGeometry(0.037, RIG.shin - 0.05, 4, 10)), m.pantalon, 0, -RIG.shin / 2 + 0.01, 0);
    const tobillo = new THREE.Group();
    tobillo.position.y = -RIG.shin;
    rodilla.add(tobillo);
    malla(tobillo, geo('zapa', () => new RoundedBoxGeometry(0.095, 0.065, 0.17, 3, 0.03)), m.blanco, 0, -0.012, 0.03);
    malla(tobillo, geo('suela', () => new RoundedBoxGeometry(0.1, 0.018, 0.176, 2, 0.008)), m.tinta, 0, -0.04, 0.03, { sombra: false });
    malla(tobillo, geo('raya', () => new THREE.BoxGeometry(0.006, 0.022, 0.07)), m.tinta, s * 0.048, -0.008, 0.02, { rot: [0.5, 0, 0], sombra: false });
    J[s < 0 ? 'hipL' : 'hipR'] = cadera;
    J[s < 0 ? 'kneeL' : 'kneeR'] = rodilla;
    J[s < 0 ? 'ankleL' : 'ankleR'] = tobillo;
  }

  // Sombra de contacto: un disco suave bajo los pies (el kit la pide en cada figura).
  const sombra = new THREE.Mesh(geo('sombra', () => new THREE.CircleGeometry(0.2, 24)), m.sombra);
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.012;
  sombra.scale.set(1, 0.8, 1);
  raiz.add(sombra);

  return { grupo: raiz, J };
}

/** Aplica una pose completa del kit ({articulación: [x,y,z]}). */
export function ponerPose(p, pose) {
  for (const [k, v] of Object.entries(pose)) {
    const j = p.J[k];
    if (j) j.rotation.set(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
  }
}
