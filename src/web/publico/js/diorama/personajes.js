// Personajes: la mascota de SOCIETY como asistente de producción (lleva el material) y tres profesionales adultos
// estilizados, construidos sobre el rig vestido del kit (kit/peopleModel-street.js): misma escala (1,69 m), mismo
// lenguaje de formas y el mismo contorno, pero cada uno con su pelo, su ropa, su color de identidad y su accesorio.
//
// Honestidad: TRABAJAR solo pasa cuando el guion dice que su estación trabaja (dato real de /api/procesos). En reposo
// viven (respiran, miran alrededor, cambian el peso, se estiran), siempre erguidos y sin manos en la mesa, para que la
// vida ambiental no se confunda con trabajo.
import * as THREE from 'three';
import { buildPerson, setPose } from './kit/peopleModel-street.js';
import { STAND, mixPose } from './kit/poses.js';
import { camaraFoto } from './estaciones.js';
import { crearMascota } from './mascota.js';
import { caja, cil, fusionarArticulaciones, pon, toro, vivo } from './piezas.js';

const sat = (x) => Math.min(1, Math.max(0, x));
const suave = (k) => k * k * (3 - 2 * k);
/** Ventana suave: 0 fuera de [a, b], 1 dentro, con rampas de `r` segundos. */
const ventana = (x, a, b, r = 0.4) => suave(sat((x - a) / r)) * (1 - suave(sat((x - b) / r)));

/** Los tres profesionales: quién es cada uno (rol, no nombre propio) y cómo viste. */
export const PROFESIONALES = Object.freeze({
  directorFoto: {
    rol: 'Director de fotografía',
    piel: 0xc68c63, pelo: 0x3b2a20, peinado: 'short', top: 0xb8875a, estilo: 'jacket', manga: 'long', bottom: 0x2f3a4c, zapato: 0x5a3b28,
    identidad: 'sobrecamisa camel, vaqueros y la cámara colgada al cuello',
  },
  revisor: {
    rol: 'Revisora visual',
    piel: 0xf0c8a8, pelo: 0x1e1a18, peinado: 'bun', top: 0x1f5f6b, estilo: 'jacket', manga: 'long', bottom: 0x3c3f48, zapato: 0xf2efe8, gafas: true, acreditacion: 0x1033ef,
    identidad: 'chaqueta técnica azul petróleo, gafas, lupa y sello',
  },
  directorDiseno: {
    rol: 'Director de diseño',
    piel: 0x8a5a3c, pelo: 0x24160f, peinado: 'long', top: 0xc65f3e, estilo: 'tee', manga: 'long', bottom: 0x5b6440, zapato: 0x2a2a31, gafas: true, bufanda: 0xf1e6cf,
    identidad: 'camisa terracota, bufanda crema y lápiz de tableta',
  },
});

function materialesDe(m, look, p) {
  const t = (c) => look.toon(c);
  return {
    skin: t(p.piel),
    hair: t(p.pelo),
    top: t(p.top),
    bottom: t(p.bottom),
    shoe: t(p.zapato),
    mats: { leather: m.maderaOscura, eye: m.tinta, mouth: t(0x9b4b4b), bone: m.blancoCalido, glass: m.cristal, steelDark: m.grafito, paper: m.blancoCalido, roseDeep: t(0xb0535e) },
  };
}

/** Un profesional: el rig del kit con su vestuario y su accesorio de oficio. */
export function crearProfesional(id, m, look) {
  const p = PROFESIONALES[id];
  const mt = materialesDe(m, look, p);
  const persona = buildPerson(mt.mats, {
    skin: mt.skin,
    hair: mt.hair,
    top: mt.top,
    bottom: mt.bottom,
    shoe: mt.shoe,
    sleeve: p.manga,
    topStyle: p.estilo,
    hairStyle: p.peinado,
    glasses: p.gafas,
    scarf: p.bufanda ? look.toon(p.bufanda) : undefined,
    lanyard: p.acreditacion ? look.toon(p.acreditacion) : undefined,
  });
  const J = persona.joints;
  // Accesorios de oficio, colgados de su articulación (se mueven con ella).
  if (id === 'directorFoto') {
    // La cámara al cuello, con su correa.
    camaraFoto(J.torso, m, 0.0, 0.3, 0.2, 0, 0.75);
    pon(J.torso, toro(0.15, 0.008, 6, 24, Math.PI), m.tinta, 0, 0.38, 0.07, { rot: [-1.2, 0, 0] });
  }
  if (id === 'revisor') {
    // Lupa en la derecha y sello en la izquierda.
    const lupa = new THREE.Group();
    lupa.position.set(0, -0.11, 0.03);
    lupa.rotation.set(-1.3, 0, 0);
    J.wristR.add(lupa);
    pon(lupa, cil(0.012, 0.014, 0.1, 8), m.maderaOscura, 0, 0, 0);
    pon(lupa, toro(0.055, 0.009, 8, 24), m.grafito, 0, -0.1, 0, { rot: [Math.PI / 2, 0, 0] });
    pon(lupa, cil(0.05, 0.05, 0.004, 22), m.cristal, 0, -0.1, 0, { sombra: false });
    const sello = new THREE.Group();
    sello.position.set(0, -0.1, 0.02);
    J.wristL.add(sello);
    pon(sello, cil(0.018, 0.022, 0.07, 10), m.madera, 0, 0, 0);
    pon(sello, caja(0.07, 0.03, 0.05, 0.006), m.grafito, 0, -0.05, 0);
  }
  if (id === 'directorDiseno') {
    // Lápiz de la tableta gráfica en la derecha.
    const lapiz = new THREE.Group();
    lapiz.position.set(0, -0.1, 0.03);
    lapiz.rotation.set(-0.6, 0, 0);
    J.wristR.add(lapiz);
    pon(lapiz, cil(0.007, 0.007, 0.15, 6), m.grafito, 0, -0.03, 0);
    pon(lapiz, cil(0.0, 0.007, 0.025, 6), m.blanco, 0, -0.12, 0);
  }
  fusionarArticulaciones(persona.group);
  vivo(persona.group);
  persona.group.name = id;
  return { id, grupo: persona.group, J, persona, fase: { directorFoto: 0.7, revisor: 2.3, directorDiseno: 4.1 }[id] };
}

// ---------------------------------------------------------------- Poses de los profesionales

const ERGUIDO = { ...STAND, torso: [0.02, 0, 0] };

/** Reposo (vida ambiental): respira, mira alrededor, cambia el peso y, de vez en cuando, se estira. Nunca toca la mesa. */
export function poseReposo(t, fase) {
  const ciclo = 23 + fase * 3;
  const c = (t + fase * 7) % ciclo;
  const respira = Math.sin(t * 1.5 + fase) * 0.012;
  const mira = Math.sin(t * 0.31 + fase * 2.1);
  const peso = Math.sin(t * 0.17 + fase);
  let pose = {
    ...ERGUIDO,
    torso: [0.02 + respira, peso * 0.05, peso * 0.02],
    head: [0.03 + 0.05 * Math.sin(t * 0.23 + fase), 0.45 * mira * Math.abs(mira), 0],
    hipL: [0, 0, 0.02 + peso * 0.03],
    hipR: [0, 0, -0.02 + peso * 0.03],
    kneeL: [0.05 + Math.max(0, peso) * 0.12, 0, 0],
    kneeR: [0.05 + Math.max(0, -peso) * 0.12, 0, 0],
  };
  // Estirarse (brazos arriba) unos segundos de cada ciclo: claramente no es trabajo.
  const estira = ventana(c, 6, 9, 0.6);
  if (estira > 0) {
    pose = mixPose(pose, { ...pose, torso: [-0.12, 0, 0], head: [-0.25, 0, 0], shoulderL: [-2.9, 0, -0.25], shoulderR: [-2.9, 0, 0.25], elbowL: [-0.5, 0, 0], elbowR: [-0.5, 0, 0] }, estira);
  }
  // Brazos cruzados un rato: espera relajada.
  const cruza = ventana(c, 14, 19, 0.5);
  if (cruza > 0) pose = mixPose(pose, { ...pose, shoulderL: [-0.55, 0, 0.32], shoulderR: [-0.55, 0, -0.32], elbowL: [-1.85, 0.4, 0], elbowR: [-1.85, -0.4, 0] }, cruza);
  return pose;
}

/** Inclinado sobre la mesa, con las manos en ella. `mano` mueve la derecha (escribir, dibujar, pasar la lupa). */
function poseMesa(t, { mano = 0, amplitud = 0.08, cabeza = 0.45, izquierda = null } = {}) {
  return {
    ...ERGUIDO,
    torso: [0.24 + 0.015 * Math.sin(t * 1.9), 0, 0],
    head: [cabeza, 0, 0],
    shoulderR: [-0.48 + amplitud * Math.sin(mano), 0, 0.06 + amplitud * Math.cos(mano)],
    elbowR: [-0.62 + amplitud * Math.cos(mano * 1.7), 0, 0],
    shoulderL: izquierda?.shoulderL ?? [-0.42, 0, -0.08],
    elbowL: izquierda?.elbowL ?? [-0.58, 0, 0],
    hipL: [-0.08, 0, 0.02],
    hipR: [-0.08, 0, -0.02],
    kneeL: [0.12, 0, 0],
    kneeR: [0.12, 0, 0],
  };
}

/** Trabajo de cada profesional (solo con dato real). `k`: avance del trabajo contado (0..1) o un ciclo si es en vivo. */
export function poseTrabajo(id, t, { sella = false, k = 0 } = {}) {
  if (id === 'directorFoto') {
    // Examina la foto, consulta la pantalla (referencias) y anota: ciclo de 6 s.
    const c = t % 6;
    const anota = poseMesa(t, { mano: t * 9, amplitud: 0.06, cabeza: 0.5 });
    const consulta = { ...poseMesa(t, { mano: 0, amplitud: 0, cabeza: 0.12 }), head: [0.12, 0.25, 0], shoulderR: [-0.3, 0, 0.1], elbowR: [-1.3, 0, 0] };
    return mixPose(anota, consulta, ventana(c, 3.2, 5.0, 0.5));
  }
  if (id === 'revisor') {
    // Inclina la cabeza y pasa la lupa por la foto; compara con las pantallas; al terminar, sella.
    const c = t % 5;
    const lupa = { ...poseMesa(t, { mano: t * 2.2, amplitud: 0.1, cabeza: 0.55, izquierda: { shoulderL: [-0.2, 0, -0.2], elbowL: [-1.0, 0, 0] } }), head: [0.55, 0, 0.18 * Math.sin(t * 0.8)] };
    const compara = { ...lupa, head: [0.15, -0.3, 0], torso: [0.12, -0.15, 0] };
    let pose = mixPose(lupa, compara, ventana(c, 3.4, 4.6, 0.4));
    if (sella) {
      const arriba = sat((k - 0.55) / 0.12) * (1 - sat((k - 0.72) / 0.05));
      const golpe = sat((k - 0.72) / 0.05) * (1 - sat((k - 0.9) / 0.1));
      pose = { ...pose, shoulderL: [-0.5 - 0.5 * arriba + 0.1 * golpe, 0, -0.05], elbowL: [-0.9 - 0.4 * arriba + 0.3 * golpe, 0, 0], head: [0.5, 0.1, 0] };
    }
    return pose;
  }
  // Director de diseño: dibuja con trazos rápidos; cada 7 s se para a pensar (mano a la barbilla) o elige muestras.
  const c = t % 7;
  const dibuja = poseMesa(t, { mano: t * 13, amplitud: 0.05, cabeza: 0.52 });
  const piensa = { ...dibuja, torso: [0.05, 0, 0], head: [-0.12, 0.2, 0], shoulderL: [-0.9, 0, 0.25], elbowL: [-2.2, 0, 0], shoulderR: [-0.3, 0, 0.1], elbowR: [-0.5, 0, 0] };
  const muestras = { ...dibuja, shoulderL: [-0.55, 0, -0.35], elbowL: [-0.4, 0, 0], head: [0.5, 0.35, 0] };
  return mixPose(mixPose(dibuja, piensa, ventana(c, 4.0, 5.6, 0.5)), muestras, ventana(c, 1.2, 2.2, 0.35));
}

/** Espera a la persona en su estación (p. ej. la intención que no pasó): erguido, mirando a la sala. */
export function poseEspera(t, fase) {
  return { ...poseReposo(t, fase), head: [0.0, 0.35, 0], shoulderL: [-0.55, 0, 0.32], shoulderR: [-0.55, 0, -0.32], elbowL: [-1.85, 0.4, 0], elbowR: [-1.85, -0.4, 0] };
}

/** Fallo real en su estación: interrumpe el trabajo y se lleva la mano a la cabeza. */
export function poseError(t) {
  return { ...ERGUIDO, torso: [0.05, 0.1, 0], head: [0.15, 0.2, 0.12], shoulderR: [-2.4, 0, 0.25], elbowR: [-1.7, 0, 0], shoulderL: [0.05, 0, -0.2], elbowL: [-0.4, 0, 0], kneeL: [0.08, 0, 0], kneeR: [0.05 + 0.02 * Math.sin(t), 0, 0] };
}

export const ponerPoseProfesional = (p, pose) => setPose(p.persona, pose);

// ---------------------------------------------------------------- La mascota (asistente de producción)

/** Escala de la mascota: un poco mayor que en el diorama anterior, para alcanzar las mesas de 0,74 m. */
export const ESCALA_MASCOTA = 1.2;

export function crearCorredor(m) {
  const c = crearMascota(m, { nombre: 'corredor', halo: false });
  c.grupo.scale.setScalar(ESCALA_MASCOTA);
  fusionarArticulaciones(c.grupo);
  vivo(c.grupo);
  return c;
}
