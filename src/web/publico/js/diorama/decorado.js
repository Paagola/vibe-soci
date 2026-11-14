// El decorado del loft: arquitectura, jardín, vegetación, zonas comunes, las once estaciones y los profesionales,
// todo colocado desde plano.js (única fuente de verdad). Al final se fusiona lo estático por material.
import * as THREE from 'three';
import { crearArquitectura, crearSueloJardin } from './arquitectura.js';
import { COLOR, texturaDe, texturaLetrero, texturaSello } from './materiales.js';
import { crearZonasComunes } from './mobiliario.js';
import { caja, esfera, fusionarEstaticos, plano, pon, vivo } from './piezas.js';
import { CONSTRUCTORES, crearSenal } from './estaciones.js';
import { crearProfesional } from './personajes.js';
import { PUESTOS } from './plano.js';
import { crearVegetacion } from './vegetacion.js';

export { crearSenal };

/**
 * La tarjeta del material que viaja de mano en mano: papel con grosor y contorno, la imagen encima (REAL si existe:
 * la foto subida, la foto nueva, la máscara, el post; pintada solo para los papeles que son JSON) y, si toca, el sello
 * del veredicto real del revisor.
 */
export function crearTarjeta(m, ancho = 0.21, alto = 0.28) {
  const grupo = vivo(new THREE.Group());
  pon(grupo, caja(ancho, 0.01, alto, 0.003), m.blancoCalido, 0, 0.005, 0);
  const caraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  caraMat.userData.outlineParameters = { visible: false };
  const cara = new THREE.Mesh(plano(ancho * 0.92, alto * 0.92), caraMat);
  cara.rotation.x = -Math.PI / 2;
  cara.position.y = 0.0105;
  grupo.add(cara);
  const selloMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  selloMat.userData.outlineParameters = { visible: false };
  const sello = new THREE.Mesh(plano(ancho * 0.8, ancho * 0.4), selloMat);
  sello.rotation.x = -Math.PI / 2;
  sello.position.set(0, 0.0115, alto * 0.22);
  sello.visible = false;
  grupo.add(sello);
  let clave = '';
  return {
    grupo,
    /** tipo: clase de material; imagen: Texture real (o null); veredicto: sello a mostrar (o null). */
    poner(tipo, imagen = null, veredicto = null) {
      const nueva = `${tipo}|${imagen?.uuid ?? ''}|${veredicto ?? ''}`;
      if (nueva === clave) return;
      clave = nueva;
      const mapa = imagen ?? texturaDe(tipo);
      caraMat.map = mapa;
      caraMat.color.set(mapa ? 0xffffff : COLOR.blancoCalido);
      caraMat.needsUpdate = true;
      sello.visible = Boolean(veredicto);
      if (veredicto) {
        selloMat.map = texturaSello(veredicto);
        selloMat.needsUpdate = true;
      }
    },
  };
}

/** Nube de aviso sobre una estación: un fallo real (503, tiempo agotado…) o un reintento. Mira siempre a la cámara. */
export function crearNube(m) {
  const grupo = vivo(new THREE.Group());
  const bolas = new THREE.Group();
  grupo.add(bolas);
  for (const [x, y, r] of [[0, 0, 0.2], [-0.2, -0.04, 0.14], [0.2, -0.03, 0.15], [-0.1, 0.12, 0.14], [0.11, 0.11, 0.14]]) pon(bolas, esfera(r, 16, 10), m.blanco, x, y, 0, { esc: [1, 0.85, 0.7], sombra: false });
  const cartel = new THREE.Mesh(plano(0.38, 0.19), new THREE.MeshBasicMaterial({ transparent: true }));
  cartel.material.userData.outlineParameters = { visible: false };
  cartel.position.z = 0.15;
  bolas.add(cartel);
  grupo.visible = false;
  let texto = null;
  return {
    grupo,
    poner({ visible, rotulo, error, t = 0 }) {
      grupo.visible = visible;
      if (!visible) return;
      if (rotulo !== texto) {
        texto = rotulo;
        cartel.material.map = texturaLetrero(rotulo, { fondo: COLOR.blanco, tinta: error ? COLOR.rojo : COLOR.tinta, tamano: 0.78 });
        cartel.material.needsUpdate = true;
      }
      bolas.position.y = 0.03 * Math.sin(t * 1.8);
    },
  };
}

export function crearDecorado(m, look, { hora } = {}) {
  const escena = new THREE.Group();
  escena.name = 'loft';
  const arquitectura = crearArquitectura(m, { hora });
  escena.add(arquitectura.grupo);
  escena.add(crearSueloJardin(m));
  const vegetacion = crearVegetacion(m);
  escena.add(vegetacion.grupo);
  const comunes = crearZonasComunes(m);
  escena.add(comunes.grupo);

  const puestos = {};
  for (const [id, p] of Object.entries(PUESTOS)) {
    const puesto = CONSTRUCTORES[id](m);
    puesto.grupo.position.set(p.centro.x, 0, p.centro.z);
    puesto.grupo.rotation.y = p.centro.yaw;
    puesto.grupo.name = id;
    puesto.tipo = p.tipo;
    escena.add(puesto.grupo);
    puestos[id] = puesto;
  }

  // Los profesionales, en el sitio que les da el plano.
  const profesionales = {};
  for (const [id, p] of Object.entries(PUESTOS)) {
    if (!p.operario) continue;
    const pro = crearProfesional(id, m, look);
    pro.grupo.position.set(p.operario.x, 0, p.operario.z);
    pro.grupo.rotation.y = p.operario.yaw;
    escena.add(pro.grupo);
    profesionales[id] = pro;
  }

  escena.updateMatrixWorld(true);
  for (const puesto of Object.values(puestos)) {
    if (puesto.spot) puesto.spotMundo = puesto.spot.clone().applyMatrix4(puesto.grupo.matrixWorld);
  }

  // Señal y nube móviles para las esperas y avisos fuera de las paradas.
  const senal = crearSenal(m);
  escena.add(senal.grupo);
  const nube = crearNube(m);
  escena.add(nube.grupo);

  // Los árboles y la arquitectura que pueden tapar un primer plano no se fusionan: se ocultan uno a uno si estorban.
  // Dentro de cada uno sí se fusiona lo suyo (un árbol = pocas mallas).
  const ocultables = [...arquitectura.ocultables, ...vegetacion.ocultables];
  for (const o of ocultables) {
    if (o.isMesh) continue; // una malla suelta ya es una sola llamada de dibujo
    o.userData.vivo = false;
    fusionarEstaticos(o);
    o.userData.vivo = true;
  }
  const fusiones = fusionarEstaticos(escena);
  return { grupo: escena, puestos, profesionales, senal, nube, vegetacion, comunes, arquitectura, ocultables, fusiones };
}
