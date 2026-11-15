// Arquitectura del loft: losa, suelo de hormigón pulido con tarimas de madera, las dos paredes con ventanales (fondo e
// izquierda), pilares, la pérgola de madera del jardín, la cristalera del laboratorio y de la sala de brainstorming,
// paneles acústicos y el cielo de fuera, que cambia con la hora real del navegador (ambiente, no proceso).
import * as THREE from 'three';
import { COLOR } from './materiales.js';
import { caja, cil, grupo, pon, plano, vivo } from './piezas.js';
import { LOSA, PARED, PILARES, PUESTOS, ZONAS } from './plano.js';

const { x0, x1, z0, z1, grueso } = LOSA;
const ANCHO = x1 - x0;
const FONDO = z1 - z0;

/** Una ventana con marco grafito, montante central, alféizar de madera y cristal tintado (sin contorno). */
function ventana(padre, m, ancho, alto, cristal) {
  const v = new THREE.Group();
  padre.add(v);
  const f = 0.06;
  pon(v, caja(ancho, f, 0.1, 0.01), m.marco, 0, alto / 2 - f / 2, 0);
  pon(v, caja(ancho, f, 0.1, 0.01), m.marco, 0, -alto / 2 + f / 2, 0);
  for (const s of [-1, 1]) pon(v, caja(f, alto, 0.1, 0.01), m.marco, (s * (ancho - f)) / 2, 0, 0);
  pon(v, caja(0.035, alto - 0.1, 0.06, 0.008), m.marco, 0, 0, 0);
  pon(v, caja(ancho - 0.1, 0.03, 0.06, 0.008), m.marco, 0, alto * 0.18, 0);
  pon(v, caja(ancho + 0.14, 0.05, 0.24, 0.012), m.madera, 0, -alto / 2 - 0.02, 0.08);
  pon(v, plano(ancho - 0.1, alto - 0.1), cristal, 0, 0, 0.0, { sombra: false, recibe: false });
  return v;
}

/**
 * Pared con ventanales: zócalo, dintel y machones entre ventanas. `largo` en su eje local X; la cara interior mira a +Z.
 * `huecos` son los tramos [desde, hasta] (en X local) que van con ventana; el resto es pared lisa.
 */
function paredConVentanas(padre, m, largo, huecos, cristal) {
  const g = new THREE.Group();
  padre.add(g);
  const alto = PARED.alto;
  const e = PARED.grueso;
  const bajo = 0.55;
  const dintel = 2.55;
  pon(g, caja(largo, bajo, e, 0.02), m.pared, 0, bajo / 2, 0);
  pon(g, caja(largo, alto - dintel, e, 0.02), m.pared, 0, (alto + dintel) / 2, 0);
  // Remate de madera arriba (la línea de la viga perimetral).
  pon(g, caja(largo + 0.02, 0.12, e + 0.06, 0.02), m.maderaOscura, 0, alto + 0.06, 0.02);
  const tramos = [];
  let cursor = -largo / 2;
  for (const [a, b] of huecos) {
    if (a > cursor) tramos.push([cursor, a]);
    cursor = b;
    const ancho = b - a;
    const v = ventana(g, m, ancho, dintel - bajo, cristal);
    v.position.set((a + b) / 2, (bajo + dintel) / 2, 0);
  }
  if (cursor < largo / 2) tramos.push([cursor, largo / 2]);
  for (const [a, b] of tramos) pon(g, caja(b - a, dintel - bajo, e, 0.01), m.pared, (a + b) / 2, (bajo + dintel) / 2, 0);
  return g;
}

/** Pilar del loft: fuste de hormigón con basa y collarín de madera. */
function pilar(padre, m, x, z) {
  const p = grupo(padre, x, 0, z);
  pon(p, caja(0.3, PARED.alto, 0.3, 0.03), m.hormigon, 0, PARED.alto / 2, 0);
  pon(p, caja(0.36, 0.14, 0.36, 0.02), m.hormigonOscuro, 0, 0.07, 0);
  pon(p, caja(0.34, 0.1, 0.34, 0.02), m.madera, 0, 1.15, 0);
  return p;
}

/** Cristalera interior: perfiles grafito arriba, abajo y cada 1,2 m, con cristal claro. A lo largo de X local. */
function cristalera(padre, m, largo, alto = 2.3, puerta = null) {
  const g = new THREE.Group();
  padre.add(g);
  const tramos = puerta ? [[-largo / 2, puerta[0]], [puerta[1], largo / 2]] : [[-largo / 2, largo / 2]];
  for (const [a, b] of tramos) {
    const l = b - a;
    if (l <= 0.05) continue;
    const cx = (a + b) / 2;
    pon(g, caja(l, 0.05, 0.06, 0.01), m.marco, cx, alto, 0);
    pon(g, caja(l, 0.08, 0.06, 0.01), m.marco, cx, 0.04, 0);
    const n = Math.max(1, Math.round(l / 1.2));
    for (let i = 0; i <= n; i++) pon(g, caja(0.05, alto, 0.06, 0.01), m.marco, a + (l * i) / n, alto / 2, 0);
    pon(g, plano(l, alto - 0.08), m.cristal, cx, alto / 2 + 0.02, 0, { sombra: false, recibe: false });
  }
  return g;
}

/** Tarima de madera (zonas creativas y lounge): un tablero fino con su canto y las juntas de las lamas. */
function tarima(padre, m, r) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const t = grupo(padre, (r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
  pon(t, caja(w, 0.035, d, 0.01), m.maderaClara, 0, 0.0175, 0, { sombra: false });
  for (let x = -w / 2 + 0.45; x < w / 2 - 0.1; x += 0.45) pon(t, plano(0.012, d - 0.04), m.juntas, x, 0.0365, 0, { rot: [-Math.PI / 2, 0, 0], sombra: false });
  return t;
}

/** Colores del cielo de fuera según la hora: mañana, tarde, atardecer o noche. */
export function cieloDeHora(hora) {
  if (hora >= 7 && hora < 12) return { cielo: 0xbfe3f2, horizonte: 0xe8f3f0, noche: false, nombre: 'mañana' };
  if (hora >= 12 && hora < 18) return { cielo: 0xa7d4ef, horizonte: 0xf4ecd8, noche: false, nombre: 'tarde' };
  if (hora >= 18 && hora < 21) return { cielo: 0xf0a77a, horizonte: 0xf6d39b, noche: false, nombre: 'atardecer' };
  return { cielo: 0x18233f, horizonte: 0x2a3560, noche: true, nombre: 'noche' };
}

export function crearArquitectura(m, { hora = new Date().getHours() } = {}) {
  const raiz = new THREE.Group();
  raiz.name = 'arquitectura';
  const luz = cieloDeHora(hora);
  /** Lo que se puede ocultar en un primer plano si se interpone entre la cámara y la estación (como los muros en los juegos). */
  const ocultables = [];
  const ocultable = (o) => {
    vivo(o);
    ocultables.push(o);
    return o;
  };

  // Losa: base grafito con una línea azul de marca en el canto, y suelo de hormigón pulido con juntas cada 1,5 m.
  pon(raiz, caja(ANCHO, grueso - 0.04, FONDO, 0.06), m.grafito, (x0 + x1) / 2, -grueso / 2 - 0.02, (z0 + z1) / 2, { sombra: false });
  pon(raiz, caja(ANCHO + 0.02, 0.05, FONDO + 0.02, 0.02), m.azul, (x0 + x1) / 2, -0.07, (z0 + z1) / 2, { sombra: false });
  pon(raiz, caja(ANCHO, 0.05, FONDO, 0.02), m.sueloPlano, (x0 + x1) / 2, -0.025, (z0 + z1) / 2, { sombra: false });
  for (let x = x0 + 1.5; x < x1 - 0.2; x += 1.5) pon(raiz, plano(0.014, FONDO - 0.3), m.juntas, x, 0.002, (z0 + z1) / 2, { rot: [-Math.PI / 2, 0, 0], sombra: false });
  for (let z = z0 + 1.5; z < z1 - 0.2; z += 1.5) pon(raiz, plano(ANCHO - 0.3, 0.014), m.juntas, (x0 + x1) / 2, 0.002, z, { rot: [-Math.PI / 2, 0, 0], sombra: false });

  // Tarimas de madera bajo la dirección creativa y el lounge (cambian el suelo de cada vecindario).
  tarima(raiz, m, { x0: 5.2, z0: 3.85, x1: 9.3, z1: 6.4 });
  tarima(raiz, m, { x0: -7.6, z0: 3.45, x1: -3.75, z1: 6.4 });

  // Paredes con ventanales. El cristal deja ver el cielo de fuera, que cambia con la hora.
  const cristal = luz.noche ? m.cristalNoche : m.cristal;
  const fondo = grupo(raiz, (x0 + x1) / 2 + PARED.grueso / 2, 0, z0 + PARED.grueso / 2);
  paredConVentanas(fondo, m, ANCHO - PARED.grueso, [[-8.1, -5.9], [-5.3, -3.1], [-2.2, 0.0], [0.6, 2.8], [3.4, 5.6], [6.2, 8.4]], cristal);
  const izquierda = grupo(raiz, x0 + PARED.grueso / 2, 0, (z0 + z1) / 2, Math.PI / 2);
  paredConVentanas(izquierda, m, FONDO, [[-1.6, 0.2], [4.0, 5.6]], cristal);
  // Rincón de las dos paredes.
  pon(raiz, caja(PARED.grueso, PARED.alto + 0.12, PARED.grueso, 0.02), m.pared, x0 + PARED.grueso / 2, (PARED.alto + 0.12) / 2, z0 + PARED.grueso / 2);

  // El cielo de fuera: dos planos pegados por fuera de las paredes, a la altura de los ventanales (de 0,55 a 2,55 m),
  // así que solo se ven a través del cristal. Sin contorno ni sombra.
  const cieloMat = new THREE.MeshBasicMaterial({ color: luz.cielo });
  cieloMat.userData.outlineParameters = { visible: false };
  const cieloFondo = pon(raiz, plano(ANCHO, 2.0), cieloMat, (x0 + x1) / 2, 1.55, z0 - 0.08, { sombra: false, recibe: false });
  const cieloIzq = pon(raiz, plano(FONDO, 2.0), cieloMat, x0 - 0.08, 1.55, (z0 + z1) / 2, { rot: [0, Math.PI / 2, 0], sombra: false, recibe: false });
  vivo(cieloFondo);
  vivo(cieloIzq);
  // Una franja de horizonte más clara abajo (copas lejanas o luces de la ciudad de noche).
  const horizonteMat = new THREE.MeshBasicMaterial({ color: luz.horizonte });
  horizonteMat.userData.outlineParameters = { visible: false };
  pon(raiz, plano(ANCHO, 0.55), horizonteMat, (x0 + x1) / 2, 0.82, z0 - 0.07, { sombra: false, recibe: false });
  pon(raiz, plano(FONDO, 0.55), horizonteMat, x0 - 0.07, 0.82, (z0 + z1) / 2, { rot: [0, Math.PI / 2, 0], sombra: false, recibe: false });

  // Pilares y vigas vistas encima del jardín (la pérgola, de donde cuelgan las plantas).
  for (const p of PILARES) ocultable(pilar(raiz, m, p.x, p.z));
  const j = ZONAS.jardin.ocupa[0];
  const pergola = ocultable(grupo(raiz, (j.x0 + j.x1) / 2, 2.85, (j.z0 + j.z1) / 2));
  for (const s of [-1, 1]) pon(pergola, caja(j.x1 - j.x0 + 0.4, 0.12, 0.11, 0.02), m.madera, 0, 0, (s * (j.z1 - j.z0)) / 2);
  for (let i = 0; i <= 6; i++) pon(pergola, caja(0.065, 0.09, j.z1 - j.z0 + 0.3, 0.012), m.maderaClara, -((j.x1 - j.x0) / 2) + ((j.x1 - j.x0) * i) / 6, 0.1, 0);
  // Postes de la pérgola en las cuatro esquinas del jardín.
  for (const [px, pz] of [[j.x0 + 0.1, j.z0 + 0.1], [j.x1 - 0.1, j.z0 + 0.1], [j.x0 + 0.1, j.z1 - 0.1], [j.x1 - 0.1, j.z1 - 0.1]]) ocultable(pon(raiz, caja(0.12, 2.85, 0.12, 0.02), m.maderaOscura, px, 1.425, pz));

  // Cristalera que separa el estudio de foto del laboratorio, y la sala de brainstorming acristalada.
  const sep = ocultable(grupo(raiz, -2.15, 0, -5.0, Math.PI / 2));
  cristalera(sep, m, 2.4, 2.3);
  const b = ZONAS.brainstorming.ocupa[0];
  cristalera(ocultable(grupo(raiz, (b.x0 + b.x1) / 2, 0, b.z0)), m, b.x1 - b.x0, 2.3);
  cristalera(ocultable(grupo(raiz, b.x0, 0, (b.z0 + b.z1) / 2, Math.PI / 2)), m, b.z1 - b.z0, 2.3, [-0.1, 0.85]);

  // Paneles acústicos de fieltro sobre el laboratorio (hexágonos en azul petróleo y terracota).
  const hex = new THREE.CylinderGeometry(0.26, 0.26, 0.05, 6);
  const acusticos = grupo(raiz, 2.6, 2.75, z0 + PARED.grueso + 0.03);
  [[-1.2, 0, 'petroleo'], [-0.75, -0.24, 'petroleoClaro'], [-0.3, 0, 'petroleo'], [0.15, -0.24, 'terracota'], [0.6, 0, 'petroleo'], [1.05, -0.24, 'petroleoClaro']].forEach(([x, y, c]) => pon(acusticos, hex, m[c], x, y, 0, { rot: [Math.PI / 2, 0, Math.PI / 6] }));

  // Rótulo del estudio en la pared del fondo, sobre el estudio de foto.
  return { grupo: raiz, cielo: { fondo: cieloFondo, izq: cieloIzq, material: cieloMat }, luz, ocultables };
}

/** El jardín central: parterres de madera con tierra, piedras de paso y un banco. Los árboles van en vegetacion.js. */
export function crearSueloJardin(m) {
  const r = ZONAS.jardin.ocupa[0];
  const g = grupo(new THREE.Group(), (r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  // Borde de madera del patio y la tierra.
  pon(g, caja(w, 0.22, d, 0.03), m.maderaOscura, 0, 0.11, 0);
  pon(g, caja(w - 0.16, 0.05, d - 0.16, 0.02), m.tierraPlana, 0, 0.2, 0, { sombra: false });
  // Césped en dos islas y un camino de piedras que lo cruza en diagonal (solo de adorno: no es una calle).
  pon(g, caja(w * 0.42, 0.03, d - 0.4, 0.02), m.cespedPlano, -w * 0.24, 0.235, 0, { sombra: false });
  pon(g, caja(w * 0.3, 0.03, d * 0.5, 0.02), m.cespedPlano, w * 0.3, 0.235, -d * 0.18, { sombra: false });
  for (let i = 0; i < 6; i++) pon(g, cil(0.16, 0.18, 0.04, 9), m.hormigon, -w * 0.08 + i * 0.42, 0.24, d * 0.32 - i * 0.18, { rot: [0, i, 0] });
  // Banco de madera mirando al olivo.
  const banco = grupo(g, w * 0.3, 0.22, d * 0.3, -0.3);
  pon(banco, caja(1.1, 0.06, 0.36, 0.02), m.madera, 0, 0.26, 0);
  for (const s of [-1, 1]) pon(banco, caja(0.08, 0.26, 0.32, 0.02), m.grafito, s * 0.45, 0.13, 0);
  return g.parent;
}

void PUESTOS;
void COLOR;
