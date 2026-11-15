// La escena del loft: renderer stroked-toon del kit, luces según la hora real del navegador, cámara de héroe de tres
// cuartos con órbita libre, el decorado, el corredor, los profesionales y la aplicación del guion en cada fotograma.
// Todo lo que se mueve en `t` sale de `guion.evaluar(t)` y del estado real: la escena no guarda estado entre fotogramas.
import * as THREE from 'three';
import { updateCamera } from './kit/camera.js';
import { createDioramaOrbit } from './kit/orbit.js';
import { STAND, mixPose, walkPose } from './kit/poses.js';
import { createStrokedToon } from './kit/stroked-toon.js';
import { cieloDeHora } from './arquitectura.js';
import { crearDecorado, crearTarjeta } from './decorado.js';
import { DURACION, Guion } from './guion.js';
import { crearMateriales, liberarTexturasPintadas, texturaDe } from './materiales.js';
import { ponerPose, ZANCADA } from './mascota.js';
import { ESCALA_MASCOTA, crearCorredor, poseError, poseEspera, poseReposo, poseTrabajo, ponerPoseProfesional } from './personajes.js';
import { liberarGeometrias } from './piezas.js';
import { LOSA, ORDEN, PARED, PUESTOS, YAW_CAMARA, enRuta, sitioDeEntrega } from './plano.js';
import { crearCargador, ponerImagen } from './texturas.js';

const grados = (g) => (g * Math.PI) / 180;

/** Cámara de héroe: el punto de partida del preset stroked-toon (fov 26), recalibrado con capturas para el loft. */
export const CAMARA = Object.freeze({
  fov: 26,
  azimuth: grados(56),
  elevation: grados(40),
  target: new THREE.Vector3(-0.3, 0.6, -0.1),
  fillX: 0.95,
  fillY: 0.93,
  subjectScale: 1,
});

const PUNTOS_AJUSTE = [
  ...[LOSA.x0, LOSA.x1].flatMap((x) => [LOSA.z0, LOSA.z1].flatMap((z) => [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, -LOSA.grueso, z)])),
  new THREE.Vector3(LOSA.x0, PARED.alto, LOSA.z0),
  new THREE.Vector3(LOSA.x1, PARED.alto, LOSA.z0),
  new THREE.Vector3(LOSA.x0, PARED.alto, LOSA.z1),
];

const suave = (k) => k * k * (3 - 2 * k);
const sat = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
function lerpAng(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// ---------------------------------------------------------------- Poses del corredor (la mascota)

const LLEVAR = { ...STAND, shoulderL: [-0.95, 0, 0.32], elbowL: [-0.75, 0, 0], shoulderR: [-0.95, 0, -0.32], elbowR: [-0.75, 0, 0], torso: [0.04, 0, 0] };
const BRAZOS_LLEVAR = { shoulderL: LLEVAR.shoulderL, elbowL: LLEVAR.elbowL, shoulderR: LLEVAR.shoulderR, elbowR: LLEVAR.elbowR };
/** Alcanzar una superficie: 0 = mesa (0,74 m, ya alta para la mascota), 1 = tablero alto. */
function alcanzar(alto) {
  return {
    ...STAND,
    torso: [lerp(0.26, 0.06, alto), 0, 0],
    head: [lerp(0.3, -0.1, alto), 0, 0],
    shoulderL: [lerp(-1.25, -2.25, alto), 0, 0.18],
    elbowL: [lerp(-0.12, -0.25, alto), 0, 0],
    shoulderR: [lerp(-1.25, -2.25, alto), 0, -0.18],
    elbowR: [lerp(-0.12, -0.25, alto), 0, 0],
    hipL: [lerp(-0.12, 0, alto), 0, 0.02],
    hipR: [lerp(-0.12, 0, alto), 0, -0.02],
    kneeL: [lerp(0.14, 0.05, alto), 0, 0],
    kneeR: [lerp(0.14, 0.05, alto), 0, 0],
  };
}
const ENSENAR = { ...STAND, torso: [-0.04, 0, 0], head: [-0.12, 0, 0], shoulderL: [-1.55, 0, 0.22], elbowL: [-0.6, 0, 0], shoulderR: [-1.55, 0, -0.22], elbowR: [-0.6, 0, 0] };
const respirar = (t, base = STAND) => ({ ...base, torso: [base.torso[0] + 0.015 * Math.sin(t * 1.6), base.torso[1], base.torso[2]] });

/** Iluminación por hora (ambiente): mañana, tarde, atardecer o noche. */
function luzDeHora(hora) {
  const c = cieloDeHora(hora);
  if (c.noche) return { ...c, hemi: [0xb9c6ff, 0x262a38, 1.0], clave: [0xa9b9e6, 1.15], relleno: [0x6d7fb8, 0.45], lamparas: true };
  if (c.nombre === 'atardecer') return { ...c, hemi: [0xffe6cc, 0x5a4a40, 1.3], clave: [0xffc28f, 2.2], relleno: [0x9fb2ff, 0.55], lamparas: true };
  return { ...c, hemi: [0xf4f1ff, 0x6a6458, 1.5], clave: [0xfff2e2, 2.45], relleno: [0xb9c8ff, 0.7], lamparas: false };
}

// ---------------------------------------------------------------- Escena

export function crearEscena(lienzo, { maxDpr = 1.5, sombras = true, hora = new Date().getHours(), alCargarImagen = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'low-power' });
  const look = createStrokedToon(renderer, { maxDpr, thickness: 0.0034 });
  renderer.shadowMap.enabled = sombras;
  const m = crearMateriales(look);
  const scene = new THREE.Scene();
  const luz = luzDeHora(hora);

  scene.add(new THREE.HemisphereLight(luz.hemi[0], luz.hemi[1], luz.hemi[2]));
  const clave = new THREE.DirectionalLight(luz.clave[0], luz.clave[1]);
  clave.position.set(6, 15, 10);
  clave.target.position.set(0, 0, 0);
  clave.castShadow = sombras;
  clave.shadow.mapSize.set(2048, 2048);
  Object.assign(clave.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 4, far: 40 });
  clave.shadow.bias = -0.0005;
  clave.shadow.normalBias = 0.025;
  clave.shadow.camera.updateProjectionMatrix();
  scene.add(clave, clave.target);
  const relleno = new THREE.DirectionalLight(luz.relleno[0], luz.relleno[1]);
  relleno.position.set(-10, 7, 4);
  scene.add(relleno);

  const decorado = crearDecorado(m, look, { hora });
  scene.add(decorado.grupo);
  const { puestos, profesionales } = decorado;
  decorado.comunes.luces(luz.lamparas);

  const corredor = crearCorredor(m);
  scene.add(corredor.grupo);
  const material = crearTarjeta(m);
  scene.add(material.grupo);

  // Cajas invisibles para elegir estaciones (pasar por encima, pulsar): el área que ocupan, 2 m de alto.
  const cajas = new THREE.Group();
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  for (const [id, p] of Object.entries(PUESTOS)) {
    for (const r of p.ocupa) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, 2.0, r.z1 - r.z0), invisible);
      b.position.set((r.x0 + r.x1) / 2, 1.0, (r.z0 + r.z1) / 2);
      b.userData.estacion = id;
      cajas.add(b);
    }
    if (p.operario) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), invisible);
      b.position.set(p.operario.x, 0.9, p.operario.z);
      b.userData.estacion = id;
      cajas.add(b);
    }
  }
  scene.add(cajas);

  const camera = new THREE.PerspectiveCamera(CAMARA.fov, 1, 0.5, 400);
  updateCamera(camera, CAMARA, 1.6, PUNTOS_AJUSTE);
  let orbit = null;
  const guion = new Guion();
  // Cuando llega una imagen real, se vuelve a repartir en sus soportes (y se redibuja si la escena está quieta).
  const cargador = crearCargador({
    alCargar: () => {
      soportes(expuestoAntes === 'post');
      alCargarImagen();
    },
  });
  let estado = null;
  let conectado = true;

  // ---------------------------------------------------------------- Imágenes reales en las estaciones

  const focoActual = () => (estado?.encargos ?? []).find((e) => e.proyecto === guion.proyecto) ?? null;
  const imagenDeIntento = (foco, n) => {
    const i = foco?.imagenes?.intentos ?? [];
    return (n ? i.find((x) => x.n === n) : i.at(-1))?.url ?? null;
  };
  /** Imagen real del material que viaja, según su clase y su intento. Los papeles JSON se pintan (texturaDe). */
  function imagenDeMaterial(tipo, n) {
    const foco = focoActual();
    const img = foco?.imagenes;
    if (!img) return null;
    switch (tipo) {
      case 'ficha':
        return cargador.textura(img.referencia);
      case 'foto':
        return cargador.textura(img.subida);
      case 'fotoNueva':
      case 'fotoOk':
      case 'fotoMal':
        return cargador.textura(imagenDeIntento(foco, n));
      case 'recorte':
        return cargador.textura(img.mascara);
      case 'post':
        return cargador.textura(img.post);
      default:
        return null;
    }
  }
  const pasado = (foco, paso) => foco && ORDEN.indexOf(foco.paso) > ORDEN.indexOf(paso);

  /** Pone en cada soporte la imagen real que le toca (o papel en blanco). Se llama al cambiar el estado o al cargar. */
  function soportes(expuesto) {
    const foco = focoActual();
    const img = foco?.imagenes ?? {};
    const tx = (url) => cargador.textura(url);
    const S = (id) => puestos[id].soportes;
    ponerImagen(S('referencia').referencia, tx(img.referencia));
    ponerImagen(S('entrada').subida, tx(img.subida));
    ponerImagen(S('directorFoto').fotoMesa, tx(img.subida));
    ponerImagen(S('directorFoto').propuesta, pasado(foco, 'PROPUESTA') ? texturaDe('propuesta') : null);
    ponerImagen(S('directorFoto').pantalla, tx(img.subida), 0x1b1f2b);
    ponerImagen(S('parada1').foto, tx(img.subida));
    ponerImagen(S('parada1').hoja, pasado(foco, 'PROPUESTA') ? texturaDe('propuesta') : null);
    ponerImagen(S('revisor').original, tx(img.subida), 0x1b1f2b);
    ponerImagen(S('revisor').nueva, tx(imagenDeIntento(foco)), 0x1b1f2b);
    ponerImagen(S('parada2').foto, tx(imagenDeIntento(foco)));
    ponerImagen(S('parada2').hoja, null);
    ponerImagen(S('mascara').pantalla, tx(img.mascara), 0x1b1f2b);
    ponerImagen(S('directorDiseno').pantalla, tx(img.referencia), 0x1b1f2b);
    ponerImagen(S('directorDiseno').refMood, tx(img.referencia));
    ponerImagen(S('compositor').post, tx(img.post));
    // La galería: el post del encargo en foco solo cuando ya está en el expositor; el resto, los terminados anteriores.
    const galeria = (estado?.galeria ?? []).filter((g) => g.proyecto !== foco?.proyecto || expuesto);
    const enFoco = expuesto && img.post ? img.post : null;
    const lista = [enFoco, ...galeria.filter((g) => g.url !== enFoco).map((g) => g.url)].filter(Boolean);
    ponerImagen(S('salida').grande, tx(lista[0]));
    S('salida').marcos.forEach((lam, i) => ponerImagen(lam, tx(lista[i + 1])));
    // Pizarra del brainstorming: los platos REALES de los encargos abiertos.
    decorado.comunes.pizarra((estado?.encargos ?? []).filter((e) => e.paso !== 'HECHO').map((e) => e.plato));
  }

  // ---------------------------------------------------------------- Aplicar el guion en t

  const palmaL = new THREE.Vector3();
  const palmaR = new THREE.Vector3();
  const PALMA = new THREE.Vector3(0, -0.035, 0.03);
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const eu = new THREE.Euler();

  function manos() {
    corredor.grupo.updateMatrixWorld(true);
    palmaL.copy(PALMA).applyMatrix4(corredor.J.wristL.matrixWorld);
    palmaR.copy(PALMA).applyMatrix4(corredor.J.wristR.matrixWorld);
    return palmaL.clone().add(palmaR).multiplyScalar(0.5);
  }
  const quatEnMano = (yaw, incl = 0.25) => qa.setFromEuler(eu.set(Math.PI / 2 - incl, yaw, 0, 'YXZ')).clone();
  function sitioMaterial(id) {
    const p = puestos[id];
    const yaw = PUESTOS[id].centro.yaw;
    const vertical = id === 'salida' ? false : false;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(vertical ? Math.PI / 2 : 0, yaw + Math.PI, 0, 'YXZ'));
    const alto = id === 'salida' ? 0.25 : id === 'referencia' ? 0.12 : 0.08;
    return { pos: p.spotMundo.clone(), q, alto };
  }
  let tipoVisto = null;
  function colocarMaterial(pos, q, tipo, n = 0, veredicto = null) {
    material.grupo.visible = Boolean(tipo);
    if (!tipo) return;
    tipoVisto = tipo;
    material.poner(tipo, imagenDeMaterial(tipo, n), tipo === 'fotoOk' || tipo === 'fotoMal' ? veredicto : null);
    material.grupo.position.copy(pos);
    material.grupo.quaternion.copy(q);
  }
  function enManos(yaw, tipo, incl, n, veredicto) {
    const c = manos();
    const adelante = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    colocarMaterial(c.addScaledVector(adelante, 0.015).add(new THREE.Vector3(0, -0.05, 0)), quatEnMano(yaw, incl), tipo, n, veredicto);
  }
  function cambioDe(id) {
    if (id === 'revisor') return 0.74;
    if (id === 'generador') return 0.5;
    if (PUESTOS[id].tipo === 'agente') return 0.7;
    if (PUESTOS[id].tipo === 'bandeja') return 0.5;
    return 0.88;
  }

  let expuestoAntes = null;
  function aplicar(t) {
    const { seg, k, local, otros, expuesto } = guion.evaluar(t);
    const s = seg;
    const foco = focoActual();
    if (expuesto !== expuestoAntes) {
      expuestoAntes = expuesto;
      soportes(expuesto === 'post');
    }
    puestos.entrada.animar({ otros, conectado, local: foco?.nombreLocal ?? foco?.local ?? '' });

    // Estaciones: solo trabaja la del segmento activo, y solo si hay conexión (sin datos frescos no se finge actividad).
    for (const [id, p] of Object.entries(puestos)) {
      if (id === 'entrada') continue;
      const activo = s.puesto === id;
      if (p.tipo === 'parada') {
        let espera = 0;
        if (activo && s.tipo === 'mostrar' && s.espera) {
          espera = sat(local / 0.45);
          if (Number.isFinite(s.t1)) espera = Math.min(espera, sat((s.t1 - t) / 0.3));
        }
        p.animar({ t, espera });
        continue;
      }
      const trabajando = conectado && activo && s.tipo === 'procesar' && s.trabajando;
      p.animar({ t, trabajando, k: Number.isFinite(s.t1) ? k : (local % 6) / 6, sella: activo && s.sella && Number.isFinite(s.t1) });
    }

    // Profesionales: trabajan con dato real; si no, viven (o esperan a la persona, o interrumpen por un fallo).
    for (const [id, pro] of Object.entries(profesionales)) {
      const activo = s.puesto === id;
      let pose;
      if (activo && s.tipo === 'procesar' && s.trabajando && conectado) pose = poseTrabajo(id, t, { sella: s.sella && Number.isFinite(s.t1), k });
      else if (activo && s.error) pose = poseError(t);
      else if (activo && s.espera) pose = poseEspera(t, pro.fase);
      else pose = poseReposo(t, pro.fase);
      ponerPoseProfesional(pro, pose);
    }

    // Señal móvil y nube, fuera de las paradas.
    const fueraDeParada = s.puesto && PUESTOS[s.puesto].tipo !== 'parada';
    if (fueraDeParada && s.espera && s.tipo === 'espera') {
      const e = sitioDeEntrega(s.puesto);
      decorado.senal.grupo.position.set(e.x + Math.sin(e.yaw + Math.PI / 2) * 0.7, 0, e.z + Math.cos(e.yaw + Math.PI / 2) * 0.7);
      decorado.senal.grupo.rotation.y = YAW_CAMARA;
      decorado.senal.poner(sat(local / 0.45), t);
    } else decorado.senal.poner(0);
    const rotulo = s.error ?? (s.trabajando && conectado ? s.aviso : null);
    if (rotulo && s.puesto && local > 0.2) {
      const c = PUESTOS[s.puesto].centro;
      decorado.nube.grupo.position.set(c.x, 2.4, c.z + 0.3);
      decorado.nube.grupo.scale.setScalar(1.6);
      decorado.nube.poner({ visible: true, rotulo, error: Boolean(s.error), t });
      decorado.nube.grupo.quaternion.copy(camera.quaternion);
    } else decorado.nube.poner({ visible: false });

    // El corredor.
    const g = corredor.grupo;
    const en = s.en ?? s.desde;
    let yaw = en.yaw;
    let pose;
    switch (s.tipo) {
      case 'andar': {
        const tGiro = DURACION.girar;
        const recorrido = Math.max(0, local - tGiro) * (s.largo / Math.max(0.001, s.t1 - s.t0 - tGiro));
        const p = enRuta(s.puntos, recorrido);
        const mira = enRuta(s.puntos, recorrido + 0.35);
        g.position.set(p.x, 0, p.z);
        const rumbo = Math.hypot(mira.x - p.x, mira.z - p.z) > 0.01 ? Math.atan2(mira.x - p.x, mira.z - p.z) : p.rumbo;
        const inicio = enRuta(s.puntos, 0.35);
        const rumboInicial = Math.atan2(inicio.x - s.puntos[0].x, inicio.z - s.puntos[0].z);
        yaw = local < tGiro ? lerpAng(s.desde.yaw, rumboInicial, suave(local / tGiro)) : lerpAng(rumbo, s.hasta.yaw, suave(sat((recorrido - (s.largo - 0.3)) / 0.3)));
        const fase = (recorrido / (ZANCADA * ESCALA_MASCOTA)) * Math.PI * 2;
        const andar = walkPose(fase, { amp: 0.34, armAmp: 0.4 });
        const arranque = sat(local / tGiro);
        pose = mixPose(STAND, s.mano ? { ...andar, ...BRAZOS_LLEVAR } : andar, arranque * (1 - sat((recorrido - s.largo + 0.05) / 0.05)));
        if (s.mano) pose = { ...pose, ...BRAZOS_LLEVAR };
        break;
      }
      case 'girar':
        g.position.set(en.x, 0, en.z);
        yaw = lerpAng(en.yaw, s.hasta.yaw, suave(k));
        pose = s.mano ? LLEVAR : STAND;
        break;
      case 'dejar': {
        g.position.set(en.x, 0, en.z);
        const al = alcanzar(sitioMaterial(s.puesto).alto);
        pose = mixPose(mixPose(s.mano ? LLEVAR : STAND, al, suave(sat(k / 0.6))), STAND, suave(sat((k - 0.7) / 0.3)));
        break;
      }
      case 'recoger':
      case 'coger': {
        g.position.set(en.x, 0, en.z);
        const al = alcanzar(sitioMaterial(s.puesto).alto);
        pose = mixPose(mixPose(STAND, al, suave(sat(k / 0.4))), LLEVAR, suave(sat((k - 0.55) / 0.45)));
        break;
      }
      case 'mostrar': {
        g.position.set(en.x, 0, en.z);
        const sube = suave(sat(local / 0.4));
        const baja = Number.isFinite(s.t1) ? suave(sat((t - (s.t1 - 0.35)) / 0.35)) : 0;
        pose = mixPose(mixPose(LLEVAR, respirar(t, ENSENAR), sube), LLEVAR, baja);
        break;
      }
      default:
        g.position.set(en.x, 0, en.z);
        pose = respirar(t, s.mano ? LLEVAR : STAND);
        if (s.tipo === 'procesar' || s.tipo === 'espera') pose = { ...pose, head: [0.1, 0.25 * Math.sin(t * 0.5), 0] };
    }
    g.rotation.y = yaw;
    ponerPose(corredor, pose);

    // El material.
    switch (s.tipo) {
      case 'dejar': {
        const sitio = sitioMaterial(s.puesto);
        if (k < 0.62) enManos(yaw, s.mano, lerp(0.25, -0.2, sat(k / 0.6)), s.n, s.veredicto);
        else colocarMaterial(sitio.pos, sitio.q, s.mano, s.n, s.veredicto);
        break;
      }
      case 'procesar': {
        const sitio = sitioMaterial(s.puesto);
        const kk = Number.isFinite(s.t1) ? k : 0;
        const tipo = kk >= cambioDe(s.puesto) ? s.sale : s.entra;
        const ver = kk >= cambioDe(s.puesto) && s.sella ? s.veredicto : null;
        if (s.puesto === 'generador') {
          // Entra en la máquina y sale nuevo por la bandeja: dentro no se ve.
          const dentro = sat(kk / 0.2) * (1 - sat((kk - 0.6) / 0.25));
          const p = sitio.pos.clone().add(new THREE.Vector3(0, 0, -0.3 * dentro));
          colocarMaterial(p, sitio.q, dentro > 0.95 ? null : tipo, s.n, ver);
        } else colocarMaterial(sitio.pos, sitio.q, tipo, s.n, ver ?? (tipo === s.entra ? s.veredictoEntra : null));
        break;
      }
      case 'espera':
        if (s.enMesa) {
          const sitio = sitioMaterial(s.puesto);
          colocarMaterial(sitio.pos, sitio.q, s.sale ?? s.entra, s.n, s.veredicto);
        } else if (s.mano) enManos(yaw, s.mano, 0.25, s.n, s.veredicto);
        else colocarMaterial(null, null, null);
        break;
      case 'recoger':
      case 'coger': {
        const sitio = sitioMaterial(s.puesto);
        const tipo = s.recoge ?? s.sale;
        if (k < 0.4) colocarMaterial(sitio.pos, sitio.q, s.tipo === 'coger' ? (k > 0.25 ? tipo : null) : tipo, s.n, s.veredicto);
        else {
          const hacia = manos();
          const u = suave(sat((k - 0.4) / 0.25));
          qb.copy(sitio.q).slerp(quatEnMano(yaw), u);
          colocarMaterial(sitio.pos.clone().lerp(hacia, u), qb, tipo, s.n, s.veredicto);
        }
        break;
      }
      case 'mostrar': {
        const cierra = s.manoFin && Number.isFinite(s.t1) && t > s.t1 - 0.35;
        enManos(yaw, cierra ? s.manoFin : s.mano, -0.05, s.n, cierra ? s.veredictoFin : s.veredicto);
        break;
      }
      default:
        if (s.mano) enManos(yaw, s.mano, 0.25, s.n, s.veredicto);
        else colocarMaterial(null, null, null);
    }
    decorado.vegetacion.animar(t);
    void tipoVisto;
  }

  // ---------------------------------------------------------------- Dibujo, tamaño, datos y elección

  function tamano(w, h) {
    const ancho = Math.max(2, Math.floor(w));
    const alto = Math.max(2, Math.floor(h));
    renderer.setSize(ancho, alto, false);
    const tenia = orbit ? { pos: camera.position.clone(), tgt: orbit.controls.target.clone() } : null;
    updateCamera(camera, CAMARA, ancho / alto, PUNTOS_AJUSTE);
    if (orbit) {
      orbit.heroPosition.copy(camera.position);
      orbit.heroTarget.copy(CAMARA.target);
      // Si el usuario había movido la cámara, se respeta su vista; solo cambia la de héroe.
      if (tenia && enVistaLibre) {
        camera.position.copy(tenia.pos);
        orbit.controls.target.copy(tenia.tgt);
      } else orbit.controls.target.copy(CAMARA.target);
      orbit.controls.update();
    }
  }
  let enVistaLibre = false;
  function dibujar(t) {
    aplicar(t);
    look.render(scene, camera);
  }
  function activarOrbita(alCambiar, alElegir = () => {}) {
    orbit = createDioramaOrbit(camera, lienzo, {
      onSelect: alElegir,
      target: CAMARA.target,
      minDistance: camera.userData.distance * 0.18,
      maxDistance: camera.userData.distance * 1.4,
      minPolarAngle: 0.2,
      maxPolarAngle: Math.PI / 2 - 0.08,
      onChange: () => {
        enVistaLibre = true;
        alCambiar();
      },
    });
    orbit.controls.enablePan = true;
    orbit.controls.screenSpacePanning = false;
    return orbit;
  }
  /** Aplica una consulta nueva del estado real (en el instante de escena t). */
  function actualizar(nuevo, t) {
    estado = nuevo;
    const cambio = guion.actualizar(nuevo, t);
    soportes(expuestoAntes === 'post');
    return cambio;
  }
  function ponerConexion(ok) {
    conectado = ok;
  }
  /** La estación bajo un punto de la pantalla (coordenadas normalizadas -1..1), o null. */
  const rayo = new THREE.Raycaster();
  function estacionEn(ndcX, ndcY) {
    rayo.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = rayo.intersectObjects(cajas.children, false)[0];
    return hit?.object.userData.estacion ?? null;
  }
  /** Rectángulo en pantalla (coordenadas normalizadas) que ocupa una estación con su entrega y su operario. */
  function rectanguloDe(id) {
    const p = PUESTOS[id];
    const pts = [];
    for (const r of p.ocupa) for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) for (const y of [0, 2.0]) pts.push(new THREE.Vector3(x, y, z));
    for (const q of [p.entrega, p.operario].filter(Boolean)) for (const y of [0, 1.8]) pts.push(new THREE.Vector3(q.x, y, q.z));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of pts) {
      v.project(camera);
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    return { x0, y0, x1, y1 };
  }
  /** Punto de anclaje de una estación (para el rótulo y la tarjeta) y su proyección en pantalla. */
  function anclaDe(id) {
    const p = PUESTOS[id];
    const r = p.ocupa[0];
    return new THREE.Vector3((r.x0 + r.x1) / 2, id === 'parada1' || id === 'parada2' ? 1.9 : 2.2, (r.z0 + r.z1) / 2);
  }
  function proyectar(v) {
    const p = v.clone().project(camera);
    return { x: p.x, y: p.y, delante: p.z < 1 };
  }
  function liberar() {
    orbit?.dispose();
    cargador.liberar();
    liberarTexturasPintadas();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) for (const mat of [].concat(o.material)) mat.dispose?.();
    });
    liberarGeometrias();
    look.dispose();
    renderer.dispose();
    // La oficina se monta y desmonta al cambiar de pantalla: se suelta el contexto WebGL para no acumularlos.
    renderer.forceContextLoss();
  }

  return {
    THREE,
    scene,
    camera,
    renderer,
    guion,
    decorado,
    corredor,
    material,
    luz,
    tamano,
    dibujar,
    actualizar,
    ponerConexion,
    activarOrbita,
    estacionEn,
    anclaDe,
    rectanguloDe,
    proyectar,
    get estado() {
      return estado;
    },
    get conectado() {
      return conectado;
    },
    get orbit() {
      return orbit;
    },
    salirDeVistaLibre() {
      enVistaLibre = false;
    },
    liberar,
    entities: { corredor: corredor.grupo, material: material.grupo, ...Object.fromEntries(Object.entries(profesionales).map(([id, p]) => [id, p.grupo])) },
  };
}
