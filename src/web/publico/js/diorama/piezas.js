// Piezas de construcción compartidas por arquitectura, vegetación, mobiliario y estaciones: geometrías en caché (una
// por forma y medida), la marca `vivo` para lo que se anima, sombras de contacto y la fusión de lo estático.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const geos = new Map();
export const geo = (clave, crear) => {
  if (!geos.has(clave)) geos.set(clave, crear());
  return geos.get(clave);
};
export function liberarGeometrias() {
  for (const g of geos.values()) g.dispose();
  geos.clear();
}

const r3 = (n) => Math.round(n * 1000) / 1000;
/** Caja redondeada. Las pequeñas (< 0,5 m) con un solo segmento de bisel: con sombreado por escalones no se nota y ahorra triángulos. */
export const caja = (w, h, d, r = 0.012, seg = Math.max(w, h, d) < 0.5 ? 1 : 2) => geo(`caja:${r3(w)}:${r3(h)}:${r3(d)}:${r3(r)}:${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.0005, Math.min(r, w / 2.2, h / 2.2, d / 2.2))));
export const cil = (rt, rb, h, s = 16, abierto = false) => geo(`cil:${r3(rt)}:${r3(rb)}:${r3(h)}:${s}:${abierto}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, abierto));
export const esfera = (r, a = 16, b = 12) => geo(`esf:${r3(r)}:${a}:${b}`, () => new THREE.SphereGeometry(r, a, b));
export const toro = (r, t, a = 10, b = 24, arco = Math.PI * 2) => geo(`toro:${r3(r)}:${r3(t)}:${a}:${b}:${r3(arco)}`, () => new THREE.TorusGeometry(r, t, a, b, arco));
export const plano = (w, h) => geo(`plano:${r3(w)}:${r3(h)}`, () => new THREE.PlaneGeometry(w, h));
export const disco = (r, s = 28) => geo(`disco:${r3(r)}:${s}`, () => new THREE.CircleGeometry(r, s));
export const blob = (r, detalle = 1) => geo(`blob:${r3(r)}:${detalle}`, () => new THREE.IcosahedronGeometry(r, detalle));

/** Añade una malla a `padre`. Opciones: rot [x,y,z], esc [x,y,z], sombra (proyecta), recibe. */
export function pon(padre, g, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2], o.orden ?? 'XYZ');
  if (o.esc) m.scale.set(...o.esc);
  m.castShadow = o.sombra ?? true;
  m.receiveShadow = o.recibe ?? true;
  padre.add(m);
  return m;
}

/** Un grupo hijo colocado y girado. */
export function grupo(padre, x = 0, y = 0, z = 0, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  padre.add(g);
  return g;
}

/** Marca lo que se mueve, cambia de material o se esconde: la fusión de lo estático no lo toca. */
export function vivo(o) {
  o.userData.vivo = true;
  return o;
}

/** Sombra de contacto (disco suave) bajo lo que toca el suelo. */
export function sombraContacto(padre, m, w, d, x = 0, z = 0, y = 0.012) {
  return pon(padre, disco(0.5), m.sombra, x, y, z, { rot: [-Math.PI / 2, 0, 0], esc: [w, d, 1], sombra: false, recibe: false });
}

/** Una superficie que enseña una imagen (real o pintada); sin contorno. Vivo: su textura cambia con los datos. */
export function lamina(padre, w, h, x, y, z, rot = [0, 0, 0], color = 0xf7f2e8) {
  const mat = new THREE.MeshBasicMaterial({ color });
  mat.userData.outlineParameters = { visible: false };
  const m = new THREE.Mesh(plano(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.set(...rot);
  padre.add(m);
  return vivo(m);
}

/**
 * Fusiona la geometría estática por material (y por si proyecta o recibe sombra). Lo marcado con `vivo` (y todo lo
 * que cuelga de ello) se queda como está. Devuelve cuántas mallas fusionadas quedan.
 */
export function fusionarEstaticos(raiz) {
  raiz.updateMatrixWorld(true);
  const inversa = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const grupos = new Map();
  const quitar = [];
  const visitar = (o) => {
    if (o.userData.vivo) return;
    if (o.isMesh && o.visible && !o.isInstancedMesh) {
      const clave = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
      if (!grupos.has(clave)) grupos.set(clave, { material: o.material, sombra: o.castShadow, recibe: o.receiveShadow, geos: [] });
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const nombre of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(nombre)) g.deleteAttribute(nombre);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld));
      grupos.get(clave).geos.push(g);
      quitar.push(o);
    }
    for (const hijo of o.children) visitar(hijo);
  };
  visitar(raiz);
  for (const o of quitar) o.removeFromParent();
  for (const { material, sombra, recibe, geos: lista } of grupos.values()) {
    const malla = new THREE.Mesh(mergeGeometries(lista, false), material);
    malla.castShadow = sombra;
    malla.receiveShadow = recibe;
    malla.name = 'fusion';
    raiz.add(malla);
    lista.forEach((x) => x.dispose());
  }
  return grupos.size;
}

/**
 * Fusiona, dentro de cada articulación de un personaje, las mallas hijas que comparten material: el rig sigue
 * moviéndose igual (cada articulación es un grupo) y pasa de ~100 mallas a ~30.
 */
export function fusionarArticulaciones(raiz) {
  const articulaciones = [];
  raiz.traverse((o) => {
    if (!o.isMesh && o.children.some((h) => h.isMesh && !h.userData.vivo)) articulaciones.push(o);
  });
  for (const art of articulaciones) {
    const porMaterial = new Map();
    for (const h of [...art.children]) {
      if (!h.isMesh || h.userData.vivo || h.children.length) continue;
      const clave = `${h.material.uuid}|${h.castShadow}`;
      if (!porMaterial.has(clave)) porMaterial.set(clave, []);
      porMaterial.get(clave).push(h);
    }
    for (const lista of porMaterial.values()) {
      if (lista.length < 2) continue;
      const gs = lista.map((h) => {
        h.updateMatrix();
        const g = h.geometry.index ? h.geometry.toNonIndexed() : h.geometry.clone();
        for (const nombre of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(nombre)) g.deleteAttribute(nombre);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        return g.applyMatrix4(h.matrix);
      });
      const malla = new THREE.Mesh(mergeGeometries(gs, false), lista[0].material);
      malla.castShadow = lista[0].castShadow;
      malla.receiveShadow = lista[0].receiveShadow;
      for (const h of lista) h.removeFromParent();
      art.add(malla);
      gs.forEach((g) => g.dispose());
    }
  }
}
