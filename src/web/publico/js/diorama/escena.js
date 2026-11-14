// La escena: renderer stroked-toon del kit, luces, cámara de héroe de tres cuartos con órbita libre, el decorado, el
// corredor y la aplicación del guion en cada fotograma. Todo lo que se ve en `t` sale de `guion.evaluar(t)`: la
// escena no guarda estado entre fotogramas (se puede congelar en cualquier `t` y sale igual).
import * as THREE from 'three';
import { updateCamera } from './kit/camera.js';
import { createDioramaOrbit } from './kit/orbit.js';
import { STAND, mixPose, walkPose } from './kit/poses.js';
import { createStrokedToon } from './kit/stroked-toon.js';
import { crearDecorado, crearTarjeta } from './decorado.js';
import { DURACION, Guion } from './guion.js';
import { crearMateriales } from './materiales.js';
import { crearMascota, ponerPose, ZANCADA } from './mascota.js';
import { LOSA, PUESTOS, YAW_CAMARA, marcoDePuesto, sitioDeEntrega } from './plano.js';

const grados = (g) => (g * Math.PI) / 180;

/** Cámara de héroe (punto de partida del preset stroked-toon, calibrado con capturas para una losa larga). */
export const CAMARA = Object.freeze({
  fov: 26,
  azimuth: grados(78),
  elevation: grados(48),
  target: new THREE.Vector3(0.1, 0.25, 0.2),
  fillX: 0.92,
  fillY: 0.9,
  subjectScale: 1,
});

const { ancho: AN, largo: LA, grueso: GR } = LOSA;
const PUNTOS_AJUSTE = [
  ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [new THREE.Vector3((sx * AN) / 2, 0, (sz * LA) / 2), new THREE.Vector3((sx * AN) / 2, -GR, (sz * LA) / 2)])),
  new THREE.Vector3(-AN / 2, 1.4, -LA / 2 + 0.1),
  new THREE.Vector3(AN / 2, 1.4, -LA / 2 + 0.1),
  new THREE.Vector3(1.44, 1.3, -1.15),
  new THREE.Vector3(-1.44, 1.4, 5.55),
];

const suave = (k) => k * k * (3 - 2 * k);
const sat = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
function lerpAng(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// ---------------------------------------------------------------- Poses del corredor

const LLEVAR = { ...STAND, shoulderL: [-0.95, 0, 0.32], elbowL: [-0.75, 0, 0], shoulderR: [-0.95, 0, -0.32], elbowR: [-0.75, 0, 0], torso: [0.04, 0, 0] };
const BRAZOS_LLEVAR = { shoulderL: LLEVAR.shoulderL, elbowL: LLEVAR.elbowL, shoulderR: LLEVAR.shoulderR, elbowR: LLEVAR.elbowR };
/** Alcanzar una superficie a la altura `alto` (0 = mesa, 1 = tablero alto). */
function alcanzar(alto) {
  return {
    ...STAND,
    torso: [lerp(0.32, 0.06, alto), 0, 0],
    head: [lerp(0.35, -0.1, alto), 0, 0],
    shoulderL: [lerp(-1.0, -2.25, alto), 0, 0.18],
    elbowL: [lerp(-0.12, -0.25, alto), 0, 0],
    shoulderR: [lerp(-1.0, -2.25, alto), 0, -0.18],
    elbowR: [lerp(-0.12, -0.25, alto), 0, 0],
    hipL: [lerp(-0.18, 0, alto), 0, 0.02],
    hipR: [lerp(-0.18, 0, alto), 0, -0.02],
    kneeL: [lerp(0.2, 0.05, alto), 0, 0],
    kneeR: [lerp(0.2, 0.05, alto), 0, 0],
  };
}
/** Enseñar el material a la persona: en alto, de cara a la cámara. */
const ENSENAR = { ...STAND, torso: [-0.04, 0, 0], head: [-0.12, 0, 0], shoulderL: [-1.55, 0, 0.22], elbowL: [-0.6, 0, 0], shoulderR: [-1.55, 0, -0.22], elbowR: [-0.6, 0, 0] };

function respirar(t, base = STAND, fase = 0) {
  return { ...base, torso: [base.torso[0] + 0.015 * Math.sin(t * 1.6 + fase), base.torso[1], base.torso[2]] };
}

// ---------------------------------------------------------------- Escena

export function crearEscena(lienzo, { maxDpr = 1.5, sombras = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'low-power' });
  const look = createStrokedToon(renderer, { maxDpr, thickness: 0.0034 });
  renderer.shadowMap.enabled = sombras;
  const m = crearMateriales(look);
  const scene = new THREE.Scene();

  // Luces del preset: clave cálida arriba a un lado con sombras ajustadas a la losa, hemisférica amplia y relleno frío.
  scene.add(new THREE.HemisphereLight(0xf4f1ff, 0x4a4a58, 1.55));
  const clave = new THREE.DirectionalLight(0xfff4e6, 2.55);
  clave.position.set(-6, 11, 7);
  clave.target.position.set(0, 0, 0);
  clave.castShadow = sombras;
  clave.shadow.mapSize.set(1024, 1024);
  Object.assign(clave.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 30 });
  clave.shadow.bias = -0.0004;
  clave.shadow.normalBias = 0.02;
  clave.shadow.camera.updateProjectionMatrix();
  scene.add(clave, clave.target);
  const relleno = new THREE.DirectionalLight(0xb9c8ff, 0.72);
  relleno.position.set(8, 6, -4);
  scene.add(relleno);

  const decorado = crearDecorado(m);
  scene.add(decorado.grupo);
  const { puestos } = decorado;

  const corredor = crearMascota(m, { nombre: 'corredor', halo: false });
  scene.add(corredor.grupo);
  const material = crearTarjeta(m);
  scene.add(material.grupo);
  const expuesto = crearTarjeta(m);
  expuesto.poner('post');
  scene.add(expuesto.grupo);
  {
    const sp = puestos.salida.spotMundo;
    const marco = marcoDePuesto('salida');
    expuesto.grupo.position.copy(sp);
    expuesto.grupo.rotation.set(Math.PI / 2 - 0.2, marco.yaw, 0, 'YXZ');
    expuesto.grupo.scale.setScalar(1.15);
  }

  const camera = new THREE.PerspectiveCamera(CAMARA.fov, 1, 0.5, 400);
  updateCamera(camera, CAMARA, 1, PUNTOS_AJUSTE);
  let orbit = null;
  const guion = new Guion();

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
  /** Orientación del material en las manos: de pie, de cara a donde mira el corredor, un poco echado atrás. */
  function quatEnMano(yaw, incl = 0.25) {
    return qa.setFromEuler(eu.set(Math.PI / 2 - incl, yaw, 0, 'YXZ')).clone();
  }
  function sitioMaterial(id) {
    const p = puestos[id];
    const marco = marcoDePuesto(id);
    const vertical = p.spotVertical;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(vertical ? Math.PI / 2 - (id === 'salida' ? 0.2 : 0.08) : 0, marco.yaw + (vertical ? 0 : Math.PI), 0, 'YXZ'));
    return { pos: p.spotMundo.clone(), q, alto: id === 'referencia' ? 1 : id === 'salida' ? 0.55 : 0 };
  }
  function colocarMaterial(pos, q, tipo) {
    material.grupo.visible = Boolean(tipo);
    if (!tipo) return;
    material.poner(tipo);
    material.grupo.position.copy(pos);
    material.grupo.quaternion.copy(q);
  }
  function enManos(yaw, tipo, incl) {
    const c = manos();
    const adelante = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    colocarMaterial(c.addScaledVector(adelante, 0.012).add(new THREE.Vector3(0, -0.04, 0)), quatEnMano(yaw, incl), tipo);
  }

  /** Momento en que el puesto cambia lo que entra por lo que sale (cuando las manos o la máquina lo tapan). */
  function cambioDe(id) {
    if (id === 'revisor') return 0.74;
    if (id === 'generador') return 0.5;
    if (PUESTOS[id].tipo === 'agente') return 0.7;
    if (PUESTOS[id].tipo === 'bandeja') return 0.5;
    return 0.88;
  }

  function aplicar(t) {
    const { seg, k, local, otros, expuesto: post } = guion.evaluar(t);
    const s = seg;
    expuesto.grupo.visible = post === 'post';
    puestos.entrada.animar({ otros });

    // Estado de cada puesto: solo trabaja el del segmento activo.
    for (const [id, p] of Object.entries(puestos)) {
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
      const trabajando = activo && s.tipo === 'procesar' && s.trabajando;
      p.animar({ t, trabajando, k: Number.isFinite(s.t1) ? k : (local % 6) / 6, sella: activo && s.sella && Number.isFinite(s.t1), otros });
    }

    // Señal y nube fuera de las paradas.
    const fueraDeParada = s.puesto && PUESTOS[s.puesto].tipo !== 'parada';
    if (fueraDeParada && s.espera && s.tipo === 'espera') {
      const marco = marcoDePuesto(s.puesto);
      const sitio = sitioDeEntrega(s.puesto);
      // Al lado del corredor, hacia el centro del pasillo y la cámara.
      decorado.senal.grupo.position.set(sitio.x * 0.35, 0, sitio.z + 0.45);
      decorado.senal.grupo.rotation.y = YAW_CAMARA;
      decorado.senal.poner(sat(local / 0.45), t);
      void marco;
    } else decorado.senal.poner(0);
    const rotulo = s.error ?? (s.trabajando ? s.aviso : null);
    if (rotulo && s.puesto && local > 0.2) {
      const marco = marcoDePuesto(s.puesto);
      decorado.nube.grupo.position.set(marco.x, 1.85, marco.z);
      decorado.nube.poner({ visible: true, rotulo, error: Boolean(s.error), t, camara: camera });
    } else decorado.nube.poner({ visible: false });

    // El corredor y el material.
    const g = corredor.grupo;
    const en = s.en ?? s.desde;
    let yaw = en.yaw;
    let pose;
    switch (s.tipo) {
      case 'andar': {
        const { desde, hasta } = s;
        const dx = hasta.x - desde.x;
        const dz = hasta.z - desde.z;
        const d = Math.hypot(dx, dz);
        const rumbo = Math.atan2(dx, dz);
        const tGiro = DURACION.girar;
        const recorrido = Math.max(0, local - tGiro) * (d / Math.max(0.001, s.t1 - s.t0 - tGiro));
        const u = d > 0 ? sat(recorrido / d) : 1;
        g.position.set(lerp(desde.x, hasta.x, u), 0, lerp(desde.z, hasta.z, u));
        yaw = local < tGiro ? lerpAng(desde.yaw, rumbo, suave(local / tGiro)) : lerpAng(rumbo, hasta.yaw, suave(sat((recorrido - (d - 0.35)) / 0.35)));
        const fase = (recorrido / ZANCADA) * Math.PI * 2;
        const andar = walkPose(fase, { amp: 0.34, armAmp: 0.4 });
        const arranque = sat(local / tGiro);
        pose = mixPose(STAND, s.mano ? { ...andar, ...BRAZOS_LLEVAR } : andar, arranque * (1 - sat((recorrido - d + 0.05) / 0.05)));
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
        const sitio = sitioMaterial(s.puesto);
        const alcance = alcanzar(sitio.alto);
        const ida = suave(sat(k / 0.6));
        const vuelta = suave(sat((k - 0.7) / 0.3));
        pose = mixPose(mixPose(s.mano ? LLEVAR : STAND, alcance, ida), STAND, vuelta);
        break;
      }
      case 'recoger':
      case 'coger': {
        g.position.set(en.x, 0, en.z);
        const sitio = sitioMaterial(s.puesto);
        const alcance = alcanzar(sitio.alto);
        const ida = suave(sat(k / 0.4));
        const vuelta = suave(sat((k - 0.55) / 0.45));
        pose = mixPose(mixPose(STAND, alcance, ida), LLEVAR, vuelta);
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

    // Dónde va el material.
    switch (s.tipo) {
      case 'dejar': {
        const sitio = sitioMaterial(s.puesto);
        if (k < 0.62) enManos(yaw, s.mano, lerp(0.25, -0.2, sat(k / 0.6)));
        else colocarMaterial(sitio.pos, sitio.q, s.mano);
        break;
      }
      case 'procesar': {
        const sitio = sitioMaterial(s.puesto);
        const kk = Number.isFinite(s.t1) ? k : 0;
        const tipo = kk >= cambioDe(s.puesto) ? s.sale : s.entra;
        if (s.puesto === 'generador') {
          // Entra por la ranura y sale nuevo por la misma bandeja: dentro de la máquina no se ve.
          const dentro = sat(kk / 0.2) * (1 - sat((kk - 0.6) / 0.25));
          const p = sitio.pos.clone().add(new THREE.Vector3(0.36 * dentro, 0, 0));
          colocarMaterial(p, sitio.q, dentro > 0.95 ? null : tipo);
        } else colocarMaterial(sitio.pos, sitio.q, tipo);
        break;
      }
      case 'espera':
        if (s.enMesa) {
          const sitio = sitioMaterial(s.puesto);
          colocarMaterial(sitio.pos, sitio.q, s.sale ?? s.entra);
        } else if (s.mano) enManos(yaw, s.mano);
        else colocarMaterial(null, null, null);
        break;
      case 'recoger':
      case 'coger': {
        const sitio = sitioMaterial(s.puesto);
        const tipo = s.recoge ?? s.sale;
        if (k < 0.4) colocarMaterial(sitio.pos, sitio.q, s.tipo === 'coger' ? (k > 0.25 ? tipo : null) : tipo);
        else {
          const desde = { pos: sitio.pos, q: sitio.q };
          const hacia = manos();
          const u = suave(sat((k - 0.4) / 0.25));
          qb.copy(desde.q).slerp(quatEnMano(yaw), u);
          colocarMaterial(desde.pos.clone().lerp(hacia, u), qb, tipo);
        }
        break;
      }
      case 'mostrar': {
        // La persona rechaza la foto: al bajar el brazo ya lleva la cruz.
        const tipo = s.manoFin && Number.isFinite(s.t1) && t > s.t1 - 0.35 ? s.manoFin : s.mano;
        enManos(yaw, tipo, -0.05);
        break;
      }
      default:
        if (s.mano) enManos(yaw, s.mano);
        else colocarMaterial(null, null, null);
    }
    // La nube mira siempre a la cámara aunque se orbite.
    if (decorado.nube.grupo.visible) decorado.nube.grupo.quaternion.copy(camera.quaternion);
  }

  // ---------------------------------------------------------------- Dibujo, tamaño y QA

  let ancho = 1;
  let alto = 1;
  function tamano(w, h) {
    ancho = Math.max(2, Math.floor(w));
    alto = Math.max(2, Math.floor(h));
    renderer.setSize(ancho, alto, false);
    const aspect = ancho / alto;
    // Si el usuario ha orbitado, se respeta su vista: solo se recalcula la de héroe.
    updateCamera(camera, CAMARA, aspect, PUNTOS_AJUSTE);
    if (orbit) {
      orbit.heroPosition.copy(camera.position);
      orbit.controls.target.copy(CAMARA.target);
      orbit.controls.update();
    }
  }
  function dibujar(t) {
    aplicar(t);
    look.render(scene, camera);
  }
  function activarOrbita(alCambiar) {
    orbit = createDioramaOrbit(camera, lienzo, {
      target: CAMARA.target,
      minDistance: camera.userData.distance * 0.45,
      maxDistance: camera.userData.distance * 1.6,
      minPolarAngle: 0.25,
      maxPolarAngle: Math.PI / 2 - 0.06,
      onChange: alCambiar,
    });
    return orbit;
  }
  function liberar() {
    orbit?.dispose();
    look.dispose();
    renderer.dispose();
    // El hueco se vuelve a montar en cada pantalla: se suelta el contexto WebGL para no acumularlos.
    renderer.forceContextLoss();
    scene.traverse((o) => o.geometry?.dispose?.());
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
    tamano,
    dibujar,
    activarOrbita,
    get orbit() {
      return orbit;
    },
    liberar,
    entities: { corredor: corredor.grupo, material: material.grupo, directorFoto: puestos.directorFoto.operario.grupo, revisor: puestos.revisor.operario.grupo, directorDiseno: puestos.directorDiseno.operario.grupo },
  };
}
