// Vegetación integrada (biophilic office): cada árbol es de una especie distinta, con tronco, ramas, masas de hojas y
// su jardinera; plantas tropicales de hojas grandes, colgantes en la pérgola y un jardín vertical. Mismo acabado
// cel-shading que el resto. Todo es estático (se fusiona) salvo las colgantes, que se mecen muy poco.
import * as THREE from 'three';
import { blob, caja, cil, esfera, geo, grupo, pon, vivo } from './piezas.js';
import { JARDINERAS, JARDIN_VERTICAL, VEGETACION, ZONAS } from './plano.js';

/** Semilla determinista por posición (sin Math.random: la escena es la misma en cada carga). */
function aleatorio(semilla) {
  let a = Math.floor(semilla * 9973) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- Hojas (geometría fina extruida: tienen contorno)

function hoja(clave, puntos, grosor = 0.012) {
  return geo(`hoja:${clave}`, () => {
    const s = new THREE.Shape();
    s.moveTo(puntos[0][0], puntos[0][1]);
    for (let i = 1; i < puntos.length; i += 2) s.quadraticCurveTo(puntos[i][0], puntos[i][1], puntos[i + 1][0], puntos[i + 1][1]);
    const g = new THREE.ExtrudeGeometry(s, { depth: grosor, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -grosor / 2);
    return g;
  });
}
/** Lanceolada: de la base (0,0) a la punta (0,1). */
const lanza = (ancho = 0.12) => hoja(`lanza:${ancho}`, [[0, 0], [ancho, 0.35], [0, 1], [-ancho, 0.35], [0, 0]]);
/** Corazón grande (monstera). */
const corazon = () => hoja('corazon', [[0, 0], [0.42, -0.05], [0.4, 0.42], [0.3, 0.78], [0, 0.72], [-0.3, 0.78], [-0.4, 0.42], [-0.42, -0.05], [0, 0]], 0.014);
/** Pala alargada (strelitzia). */
const pala = () => hoja('pala', [[0, 0], [0.16, 0.25], [0.14, 0.75], [0, 1], [-0.14, 0.75], [-0.16, 0.25], [0, 0]], 0.012);

function maceta(padre, m, r, alto, mat = m.terracota, x = 0, z = 0) {
  const g = grupo(padre, x, 0, z);
  pon(g, cil(r, r * 0.8, alto, 18), mat, 0, alto / 2, 0);
  pon(g, cil(r * 1.06, r * 1.06, 0.04, 18), mat, 0, alto - 0.02, 0);
  pon(g, cil(r * 0.94, r * 0.94, 0.02, 18), m.tierra, 0, alto - 0.01, 0, { sombra: false });
  return g;
}

/** Tronco curvo: una cadena de cilindros que se estrechan. Devuelve la punta (para colgar ramas y copa). */
function tronco(padre, mat, puntos, r0, r1) {
  for (let i = 1; i < puntos.length; i++) {
    const a = new THREE.Vector3(...puntos[i - 1]);
    const b = new THREE.Vector3(...puntos[i]);
    const l = a.distanceTo(b);
    const k0 = r0 + ((r1 - r0) * (i - 1)) / (puntos.length - 1);
    const k1 = r0 + ((r1 - r0) * i) / (puntos.length - 1);
    const m = new THREE.Mesh(cil(k1, k0, l, 9), mat);
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true;
    m.receiveShadow = true;
    padre.add(m);
    pon(padre, esfera(k1 * 1.02, 8, 6), mat, b.x, b.y, b.z);
  }
}

// ---------------------------------------------------------------- Especies

/** Olivo del jardín central: tronco retorcido, tres brazos y copa ligera de muchas masas pequeñas verde oliva y salvia. */
function olivo(padre, m) {
  const g = grupo(padre);
  const r = aleatorio(1.7);
  // Alcorque de piedra.
  pon(g, cil(0.62, 0.66, 0.36, 22), m.hormigon, 0, 0.18 + 0.2, 0);
  pon(g, cil(0.56, 0.56, 0.03, 22), m.tierra, 0, 0.56, 0, { sombra: false });
  tronco(g, m.maderaOscura, [[0, 0.55, 0], [0.08, 1.0, 0.04], [-0.04, 1.4, -0.02], [0.05, 1.75, 0.03]], 0.13, 0.08);
  const brazos = [
    [[0.05, 1.75, 0.03], [0.45, 2.05, 0.2], [0.7, 2.3, 0.25]],
    [[0.05, 1.75, 0.03], [-0.4, 2.1, -0.15], [-0.65, 2.35, -0.3]],
    [[0.05, 1.75, 0.03], [0.05, 2.2, -0.35], [0.0, 2.55, -0.45]],
  ];
  for (const b of brazos) tronco(g, m.maderaOscura, b, 0.065, 0.035);
  const verdes = [m.oliva, m.salvia, m.hoja, m.oliva];
  const centros = [[0.7, 2.4, 0.25], [-0.65, 2.45, -0.3], [0.0, 2.65, -0.45], [0.1, 2.5, 0.1], [0.35, 2.7, -0.15], [-0.3, 2.65, 0.15]];
  centros.forEach(([x, y, z], i) => {
    for (let k = 0; k < 4; k++) {
      const s = 0.26 + r() * 0.14;
      pon(g, blob(0.3, 1), verdes[(i + k) % verdes.length], x + (r() - 0.5) * 0.5, y + (r() - 0.5) * 0.25, z + (r() - 0.5) * 0.5, { esc: [s / 0.3, (s * 0.72) / 0.3, s / 0.3], rot: [r(), r() * 3, 0] });
    }
  });
  return g;
}

/** Ficus en jardinera cuadrada: tronco recto y copa densa de masas grandes verde bosque. */
function ficus(padre, m) {
  const g = grupo(padre);
  const r = aleatorio(2.3);
  pon(g, caja(0.7, 0.55, 0.7, 0.04), m.grafito, 0, 0.275, 0);
  pon(g, caja(0.62, 0.03, 0.62, 0.01), m.tierra, 0, 0.55, 0, { sombra: false });
  tronco(g, m.maderaOscura, [[0, 0.55, 0], [0.04, 1.3, 0.02], [-0.02, 1.9, 0]], 0.07, 0.045);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const s = 0.34 + r() * 0.12;
    pon(g, blob(0.36, 1), k % 3 ? m.bosque : m.hoja, Math.cos(a) * 0.32, 1.85 + (k % 3) * 0.22 + r() * 0.1, Math.sin(a) * 0.32, { esc: [s / 0.36, (s * 0.85) / 0.36, s / 0.36] });
  }
  pon(g, blob(0.4, 1), m.bosque, 0, 2.45, 0);
  return g;
}

/** Kentia (palmera de interior): macetero alto y frondas arqueadas de folíolos. */
function kentia(padre, m) {
  const g = grupo(padre);
  maceta(g, m, 0.32, 0.6, m.crema);
  const foliolo = lanza(0.06);
  for (let f = 0; f < 7; f++) {
    const fr = grupo(g, 0, 0.6, 0, (f / 7) * Math.PI * 2 + 0.3);
    const inclina = 0.35 + (f % 3) * 0.12;
    // Tallo: tres tramos que se curvan hacia fuera.
    let x = 0;
    let y = 0;
    for (let i = 0; i < 9; i++) {
      const ang = inclina + i * 0.12;
      const nx = x + Math.sin(ang) * 0.16;
      const ny = y + Math.cos(ang) * 0.16;
      if (i < 3) {
        const tallo = new THREE.Mesh(cil(0.012, 0.016, 0.17, 6), m.oliva);
        tallo.position.set((x + nx) / 2, (y + ny) / 2, 0);
        tallo.rotation.z = -ang;
        fr.add(tallo);
      }
      if (i >= 2) {
        for (const s of [-1, 1]) {
          const h = new THREE.Mesh(foliolo, m.hoja);
          h.position.set(nx, ny, 0);
          h.rotation.set(0, 0, -ang - s * 1.25);
          h.scale.setScalar(0.32 - i * 0.015);
          h.castShadow = true;
          fr.add(h);
        }
      }
      x = nx;
      y = ny;
    }
  }
  return g;
}

/** Monstera: maceta baja y hojas grandes en corazón sobre tallos de varias alturas. */
function monstera(padre, m) {
  const g = grupo(padre);
  maceta(g, m, 0.26, 0.42, m.terracota);
  const r = aleatorio(3.9);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + r() * 0.4;
    const alto = 0.75 + r() * 0.45;
    const h = grupo(g, Math.cos(a) * 0.12, 0.42, Math.sin(a) * 0.12, -a + Math.PI / 2);
    pon(h, cil(0.01, 0.014, alto, 6), m.oliva, 0.0, alto / 2, 0.08, { rot: [0.3, 0, 0] });
    pon(h, corazon(), k % 2 ? m.bosque : m.hoja, 0, alto, 0.24, { rot: [-1.0 - r() * 0.3, 0, Math.PI], esc: [0.42, 0.42, 1] });
  }
  return g;
}

/** Strelitzia (ave del paraíso): maceta de hormigón y palas altas casi verticales. */
function strelitzia(padre, m) {
  const g = grupo(padre);
  maceta(g, m, 0.28, 0.5, m.hormigon);
  const r = aleatorio(5.1);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const h = grupo(g, Math.cos(a) * 0.08, 0.5, Math.sin(a) * 0.08, a);
    const alto = 0.6 + r() * 0.35;
    pon(h, cil(0.012, 0.016, alto, 6), m.oliva, 0, alto / 2, 0, { rot: [0.12, 0, 0] });
    pon(h, pala(), k % 2 ? m.hoja : m.bosque, 0, alto - 0.02, alto * 0.06, { rot: [0.22, 0, 0], esc: [0.55, 0.62, 1] });
  }
  return g;
}

/** Helecho en pedestal: frondas arqueadas que caen alrededor. */
function helecho(padre, m) {
  const g = grupo(padre);
  pon(g, cil(0.08, 0.12, 0.55, 12), m.maderaOscura, 0, 0.275, 0);
  const pot = maceta(g, m, 0.2, 0.22, m.crema);
  pot.position.y = 0.55;
  const fr = lanza(0.1);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2;
    const h = grupo(g, 0, 0.77, 0, a);
    pon(h, fr, k % 2 ? m.hojaClara : m.hoja, 0, 0, 0, { rot: [1.15 + (k % 3) * 0.15, 0, 0], esc: [0.45, 0.55, 1] });
  }
  return g;
}

const ESPECIES = { olivo, ficus, kentia, monstera, strelitzia, helecho };

/** Planta pequeña de estantería o de mesa (pothos, suculenta…): para vestir sin repetir árboles. */
export function plantita(padre, m, x, y, z, variante = 0) {
  const g = grupo(padre, x, y, z);
  maceta(g, m, 0.07, 0.1, [m.terracota, m.crema, m.petroleoClaro][variante % 3]);
  if (variante % 2) for (let k = 0; k < 5; k++) pon(g, lanza(0.14), m.hoja, 0, 0.1, 0, { rot: [0.5, (k / 5) * Math.PI * 2, 0], esc: [0.25, 0.22, 1] });
  else for (let k = 0; k < 3; k++) pon(g, blob(0.06, 0), [m.hoja, m.hojaClara, m.bosque][k], (k - 1) * 0.04, 0.15 + (k % 2) * 0.03, 0, { esc: [1, 0.8, 1] });
  return g;
}

/** Hierbas altas en un parterre: conos finos verdes de varias alturas. */
function hierbas(padre, m, x, z, n, semilla) {
  const r = aleatorio(semilla);
  const g = grupo(padre, x, 0.22, z);
  for (let i = 0; i < n; i++) pon(g, geo('hierba', () => new THREE.ConeGeometry(0.035, 0.42, 5)), [m.hoja, m.hojaClara, m.oliva][i % 3], (r() - 0.5) * 0.5, 0.2, (r() - 0.5) * 0.5, { rot: [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4], esc: [1, 0.7 + r() * 0.6, 1] });
  return g;
}

/** Arbustos bajos (masas redondas). */
function arbusto(padre, m, x, y, z, s, mat) {
  const g = grupo(padre, x, y, z);
  pon(g, blob(0.22, 1), mat, 0, 0.16 * s, 0, { esc: [s, s * 0.75, s] });
  pon(g, blob(0.16, 1), m.hojaClara, 0.12 * s, 0.22 * s, 0.04, { esc: [s, s * 0.8, s] });
  return g;
}

/** Jardín vertical: un bastidor de madera en la pared con una trama de masas de varios verdes. */
function jardinVertical(padre, m, ancho, alto) {
  const g = new THREE.Group();
  padre.add(g);
  pon(g, caja(ancho, alto, 0.08, 0.02), m.maderaOscura, 0, 0, 0);
  const r = aleatorio(7.7);
  const verdes = [m.hoja, m.bosque, m.hojaClara, m.salvia, m.oliva];
  for (let y = -alto / 2 + 0.12; y < alto / 2 - 0.05; y += 0.16) {
    for (let x = -ancho / 2 + 0.12; x < ancho / 2 - 0.05; x += 0.17) {
      const s = 0.09 + r() * 0.05;
      pon(g, blob(0.1, 0), verdes[Math.floor(r() * verdes.length)], x + (r() - 0.5) * 0.05, y + (r() - 0.5) * 0.05, 0.07, { esc: [s / 0.1, s / 0.1, (s * 0.7) / 0.1], rot: [r(), r(), 0] });
    }
  }
  return g;
}

/**
 * Colgante (pothos) de la pérgola: una guía de hojitas que cae. Es lo único vivo de la vegetación (se mece poco).
 * Devuelve el grupo y su animación.
 */
function colgante(padre, m, x, y, z, largo, semilla) {
  const g = vivo(grupo(padre, x, y, z));
  const r = aleatorio(semilla);
  pon(g, cil(0.09, 0.07, 0.12, 12), m.crema, 0, -0.06, 0);
  for (let i = 0; i < largo; i++) pon(g, blob(0.045, 0), i % 3 ? m.hoja : m.hojaClara, (r() - 0.5) * 0.08, -0.12 - i * 0.075, (r() - 0.5) * 0.08, { esc: [1.1, 0.7, 0.5], rot: [0, r() * 3, 0.4] });
  const fase = semilla * 1.3;
  return { grupo: g, animar: (t) => (g.rotation.z = 0.03 * Math.sin(t * 0.7 + fase)) };
}

export function crearVegetacion(m) {
  const raiz = new THREE.Group();
  raiz.name = 'vegetacion';
  const animados = [];
  for (const v of VEGETACION) {
    const arbol = ESPECIES[v.especie](raiz, m);
    arbol.position.set(v.x, v.especie === 'olivo' ? 0 : 0, v.z);
    arbol.name = v.especie;
  }
  // El jardín: hierbas, arbustos y helechitos alrededor del olivo.
  const j = ZONAS.jardin.ocupa[0];
  hierbas(raiz, m, j.x0 + 0.5, j.z0 + 0.45, 10, 11);
  hierbas(raiz, m, j.x1 - 0.55, j.z1 - 0.5, 9, 12);
  hierbas(raiz, m, j.x0 + 0.6, j.z1 - 0.55, 8, 13);
  arbusto(raiz, m, j.x1 - 0.6, 0.22, j.z0 + 0.5, 1.2, m.bosque);
  arbusto(raiz, m, j.x0 + 1.4, 0.22, j.z1 - 0.4, 1.0, m.hoja);
  arbusto(raiz, m, -0.2, 0.22, j.z0 + 0.35, 0.9, m.salvia);
  // Colgantes de la pérgola.
  [[j.x0 + 0.6, j.z0 + 0.2, 9], [j.x0 + 2.2, j.z1 - 0.2, 12], [j.x1 - 1.3, j.z0 + 0.2, 10], [j.x1 - 0.4, j.z1 - 0.2, 8]].forEach(([x, z, n], i) => animados.push(colgante(raiz, m, x, 2.8, z, n, i + 1)));
  // Jardín vertical en la pared izquierda, junto al rincón del café.
  const jv = jardinVertical(raiz, m, JARDIN_VERTICAL.ancho, JARDIN_VERTICAL.alto);
  jv.position.set(JARDIN_VERTICAL.x, JARDIN_VERTICAL.y, JARDIN_VERTICAL.z);
  jv.rotation.y = Math.PI / 2;
  // Jardineras lineales (separan la calle del fondo del laboratorio).
  for (const { x, z, ancho, fondo } of JARDINERAS) {
    const jar = grupo(raiz, x, 0, z);
    pon(jar, caja(ancho, 0.36, fondo, 0.03), m.grafito, 0, 0.18, 0);
    for (let k = 0; k < 4; k++) pon(jar, blob(0.12, 1), [m.hoja, m.bosque, m.hojaClara, m.salvia][k], -ancho / 2 + 0.13 + (k * (ancho - 0.26)) / 3, 0.42, 0, { esc: [1, 0.8, 1] });
  }
  return { grupo: raiz, animar: (t) => animados.forEach((a) => a.animar(t)) };
}
