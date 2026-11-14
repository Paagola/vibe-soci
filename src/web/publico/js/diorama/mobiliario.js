// Mobiliario del loft (cada mueble con varias piezas reconocibles) y las zonas comunes: café, lounge, brainstorming y
// rincón de lectura. Ambiente: no representan ningún proceso.
import * as THREE from 'three';
import { texturaPizarra } from './materiales.js';
import { blob, caja, cil, esfera, grupo, lamina, pon, sombraContacto, toro, vivo } from './piezas.js';
import { ALTO_MESA, ZONAS } from './plano.js';
import { plantita } from './vegetacion.js';

// ---------------------------------------------------------------- Piezas de mobiliario

/** Mesa de trabajo: tablero con canto, faldón, patas en caballete de acero y travesaño. Centro en (0,0); X a lo largo. */
export function mesa(padre, m, { largo = 1.4, fondo = 0.7, alto = ALTO_MESA, tablero = m.madera, patas = m.grafito, x = 0, z = 0 } = {}) {
  const g = grupo(padre, x, 0, z);
  pon(g, caja(largo, 0.045, fondo, 0.014), tablero, 0, alto - 0.0225, 0);
  pon(g, caja(largo - 0.12, 0.08, fondo - 0.12, 0.01), patas, 0, alto - 0.085, 0, { sombra: false });
  for (const s of [-1, 1]) {
    const p = grupo(g, s * (largo / 2 - 0.1), 0, 0);
    pon(p, caja(0.045, alto - 0.08, 0.045, 0.008), patas, 0, (alto - 0.08) / 2, fondo / 2 - 0.08, { rot: [0.04, 0, 0] });
    pon(p, caja(0.045, alto - 0.08, 0.045, 0.008), patas, 0, (alto - 0.08) / 2, -fondo / 2 + 0.08, { rot: [-0.04, 0, 0] });
    pon(p, caja(0.04, 0.04, fondo - 0.1, 0.008), patas, 0, 0.03, 0);
  }
  pon(g, caja(largo - 0.25, 0.035, 0.035, 0.008), patas, 0, 0.32, -fondo / 2 + 0.1);
  sombraContacto(g, m, largo + 0.2, fondo + 0.25);
  return g;
}

/** Silla de oficina: base de cinco radios, pistón, asiento y respaldo tapizados. */
export function silla(padre, m, x, z, yaw, tela = m.petroleo) {
  const g = grupo(padre, x, 0, z, yaw);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    pon(g, caja(0.03, 0.025, 0.26, 0.008), m.grafito, Math.sin(a) * 0.13, 0.05, Math.cos(a) * 0.13, { rot: [0, a, 0] });
    pon(g, esfera(0.025, 8, 6), m.grafito, Math.sin(a) * 0.25, 0.025, Math.cos(a) * 0.25);
  }
  pon(g, cil(0.022, 0.022, 0.36, 8), m.metal, 0, 0.24, 0);
  pon(g, caja(0.44, 0.07, 0.42, 0.03), tela, 0, 0.45, 0);
  pon(g, caja(0.42, 0.42, 0.06, 0.03), tela, 0, 0.72, -0.2, { rot: [-0.1, 0, 0] });
  pon(g, caja(0.04, 0.3, 0.04, 0.008), m.grafito, 0, 0.55, -0.2);
  sombraContacto(g, m, 0.55, 0.55);
  return g;
}

/** Monitor: peana, brazo y marco; devuelve la lámina de la pantalla (vivo) para enseñar una imagen real o encenderse. */
export function monitor(padre, m, x, y, z, yaw = 0, ancho = 0.5, alto = 0.32) {
  const g = grupo(padre, x, y, z, yaw);
  pon(g, caja(0.2, 0.015, 0.14, 0.006), m.grafito, 0, 0.008, 0);
  pon(g, caja(0.03, 0.2, 0.03, 0.006), m.grafito, 0, 0.11, -0.03);
  pon(g, caja(ancho + 0.03, alto + 0.03, 0.03, 0.01), m.tinta, 0, 0.2 + alto / 2, 0);
  const pantalla = lamina(g, ancho, alto, 0, 0.2 + alto / 2, 0.016, [0, 0, 0], 0x1b1f2b);
  return pantalla;
}

/** Flexo de mesa: base, dos brazos articulados y la cabeza con su bombilla (que se enciende). */
export function flexo(padre, m, x, z, yaw = 0, color = m.grafito) {
  const g = grupo(padre, x, ALTO_MESA, z, yaw);
  pon(g, cil(0.06, 0.07, 0.025, 16), color, 0, 0.012, 0);
  pon(g, cil(0.01, 0.01, 0.3, 6), color, 0.03, 0.16, 0, { rot: [0, 0, -0.25] });
  pon(g, cil(0.01, 0.01, 0.28, 6), color, 0.12, 0.38, 0.06, { rot: [0.5, 0, 0.6] });
  const cabeza = grupo(g, 0.22, 0.46, 0.15);
  cabeza.rotation.set(0.9, 0, 0);
  pon(cabeza, cil(0.04, 0.075, 0.1, 16, true), color, 0, 0, 0);
  const bombilla = vivo(pon(cabeza, esfera(0.03, 10, 8), m.lamparaApagada, 0, -0.03, 0, { sombra: false }));
  return { poner: (on, mat = m.calidaEncendida) => (bombilla.material = on ? mat : m.lamparaApagada) };
}

/** Lámpara de pie (lounge, lectura): base, mástil curvo y pantalla de tela con su bombilla. */
export function lamparaPie(padre, m, x, z, tela = m.crema) {
  const g = grupo(padre, x, 0, z);
  pon(g, cil(0.16, 0.18, 0.03, 18), m.grafito, 0, 0.015, 0);
  pon(g, cil(0.015, 0.015, 1.45, 8), m.grafito, 0, 0.74, 0);
  pon(g, cil(0.16, 0.22, 0.24, 18, true), tela, 0, 1.52, 0);
  const bombilla = vivo(pon(g, esfera(0.05, 10, 8), m.lamparaApagada, 0, 1.47, 0, { sombra: false }));
  sombraContacto(g, m, 0.4, 0.4);
  return { poner: (on) => (bombilla.material = on ? m.calidaEncendida : m.lamparaApagada) };
}

/** Estantería de madera con baldas, libros de colores, cajas y alguna planta. Centro en la base, frente a +Z. */
export function estanteria(padre, m, x, z, yaw, { ancho = 1.2, alto = 1.8, baldas = 4, semilla = 1 } = {}) {
  const g = grupo(padre, x, 0, z, yaw);
  const fondo = 0.34;
  for (const s of [-1, 1]) pon(g, caja(0.04, alto, fondo, 0.01), m.madera, (s * ancho) / 2, alto / 2, 0);
  pon(g, caja(ancho, alto, 0.02, 0.005), m.maderaOscura, 0, alto / 2, -fondo / 2 + 0.01);
  const colores = [m.terracota, m.petroleo, m.crema, m.azul, m.oliva, m.naranja, m.grafito, m.arena];
  let k = semilla;
  for (let i = 0; i <= baldas; i++) {
    const y = (alto * i) / baldas;
    pon(g, caja(ancho, 0.03, fondo, 0.008), m.madera, 0, Math.max(0.015, y), 0);
    if (i === baldas) continue;
    // Libros (a veces una caja o una planta) sobre la balda.
    let cx = -ancho / 2 + 0.06;
    while (cx < ancho / 2 - 0.12) {
      k = (k * 7 + 3) % 23;
      if (k % 7 === 0 && i > 0) {
        plantita(g, m, cx + 0.09, y + 0.03, 0.02, k);
        cx += 0.22;
        continue;
      }
      if (k % 5 === 0) {
        pon(g, caja(0.22, 0.16, 0.26, 0.01), m.arena, cx + 0.11, y + 0.1, 0);
        cx += 0.25;
        continue;
      }
      const w = 0.035 + (k % 3) * 0.012;
      const h = 0.2 + (k % 4) * 0.03;
      pon(g, caja(w, h, 0.22, 0.004), colores[k % colores.length], cx + w / 2, y + 0.015 + h / 2, 0.02, { rot: [0, 0, k % 9 === 0 ? 0.25 : 0] });
      cx += w + 0.006;
    }
  }
  sombraContacto(g, m, ancho + 0.2, fondo + 0.25);
  return g;
}

/** Pila de papeles o carpetas sobre una superficie. */
export function pila(padre, m, x, y, z, n = 4, mat = m.blancoCalido, w = 0.22, d = 0.3) {
  const g = grupo(padre, x, y, z);
  for (let i = 0; i < n; i++) pon(g, caja(w, 0.012, d, 0.003), i % 2 ? mat : m.blancoCalido, (i % 2) * 0.008, 0.006 + i * 0.013, (i % 3) * 0.006, { rot: [0, (i % 3) * 0.04, 0] });
  return g;
}

/** Taza de café (asa incluida). */
export function taza(padre, m, x, y, z, mat = m.blanco) {
  const g = grupo(padre, x, y, z);
  pon(g, cil(0.035, 0.03, 0.08, 12), mat, 0, 0.04, 0);
  pon(g, toro(0.022, 0.007, 6, 12), mat, 0.038, 0.045, 0, { rot: [0, 0, Math.PI / 2] });
  return g;
}

// ---------------------------------------------------------------- Zonas comunes

/** Rincón del café: encimera con armarios, cafetera de dos grupos, molinillo, tazas, estantes con tarros y una planta. */
function rinconCafe(padre, m) {
  const r = ZONAS.cafe.ocupa[0];
  const g = grupo(padre, r.x0 + 0.4, 0, (r.z0 + r.z1) / 2, Math.PI / 2);
  const largo = r.z1 - r.z0 - 0.2;
  // Armario bajo y encimera.
  pon(g, caja(largo, 0.86, 0.6, 0.02), m.petroleo, 0, 0.43, 0);
  for (let i = 0; i < 4; i++) pon(g, caja(largo / 4 - 0.04, 0.7, 0.02, 0.01), m.petroleoClaro, -largo / 2 + largo / 8 + (i * largo) / 4, 0.42, 0.305);
  for (let i = 0; i < 4; i++) pon(g, caja(0.12, 0.02, 0.02, 0.005), m.metalClaro, -largo / 2 + largo / 8 + (i * largo) / 4, 0.7, 0.32);
  pon(g, caja(largo + 0.06, 0.05, 0.66, 0.01), m.maderaClara, 0, 0.885, 0.02);
  // Cafetera de dos grupos: cuerpo, bandeja, grupos, portafiltros y manómetro.
  const cafetera = grupo(g, -0.55, 0.91, -0.05);
  pon(cafetera, caja(0.62, 0.42, 0.42, 0.04), m.metalClaro, 0, 0.21, 0);
  pon(cafetera, caja(0.64, 0.06, 0.44, 0.02), m.grafito, 0, 0.45, 0);
  pon(cafetera, caja(0.5, 0.03, 0.18, 0.01), m.grafito, 0, 0.02, 0.24);
  for (const s of [-1, 1]) {
    pon(cafetera, cil(0.05, 0.05, 0.06, 12), m.grafito, s * 0.15, 0.27, 0.24);
    pon(cafetera, caja(0.03, 0.03, 0.14, 0.008), m.tinta, s * 0.15, 0.22, 0.32);
    taza(cafetera, m, s * 0.15, 0.035, 0.24, m.blanco);
  }
  pon(cafetera, cil(0.05, 0.05, 0.02, 16), m.blanco, 0, 0.33, 0.215, { rot: [Math.PI / 2, 0, 0] });
  pon(cafetera, caja(0.02, 0.1, 0.02, 0.005), m.maderaOscura, 0.27, 0.48, 0.12);
  // Molinillo.
  const molino = grupo(g, 0.05, 0.91, -0.12);
  pon(molino, caja(0.16, 0.24, 0.18, 0.02), m.grafito, 0, 0.12, 0);
  pon(molino, cil(0.07, 0.05, 0.16, 12), m.crema, 0, 0.32, 0);
  // Tazas en fila y un tarro de galletas.
  for (let i = 0; i < 4; i++) taza(g, m, 0.35 + i * 0.1, 0.91, 0.15, [m.terracota, m.crema, m.petroleoClaro, m.blanco][i]);
  pon(g, cil(0.08, 0.08, 0.18, 14), m.cristal, 0.85, 1.0, -0.05, { sombra: false });
  plantita(g, m, 1.15, 0.91, -0.1, 1);
  // Estantes en la pared con tarros y tazas colgadas; dos plafones cálidos.
  for (const y of [1.45, 1.85]) {
    pon(g, caja(1.4, 0.04, 0.24, 0.01), m.madera, 0.7, y, -0.2);
    for (let i = 0; i < 5; i++) pon(g, cil(0.045, 0.045, 0.14 + (i % 2) * 0.04, 12), [m.crema, m.arena, m.terracota][i % 3], 0.15 + i * 0.26, y + 0.09, -0.2);
  }
  // Viga de madera en la pared de la que cuelgan los dos plafones cálidos.
  pon(g, caja(largo, 0.1, 0.5, 0.02), m.maderaOscura, 0, 2.62, -0.05);
  const luces = [-0.4, 0.6].map((x) => {
    pon(g, cil(0.004, 0.004, 0.3, 4), m.grafito, x, 2.43, 0.1);
    pon(g, cil(0.05, 0.13, 0.12, 16, true), m.terracota, x, 2.28, 0.1);
    return vivo(pon(g, esfera(0.04, 10, 8), m.lamparaApagada, x, 2.24, 0.1, { sombra: false }));
  });
  sombraContacto(g, m, largo + 0.3, 0.9);
  return { poner: (on) => luces.forEach((b) => (b.material = on ? m.calidaEncendida : m.lamparaApagada)) };
}

/** Lounge: alfombra, sofá de tres plazas, dos butacas, mesa baja con libros y lámpara de pie. */
function lounge(padre, m) {
  const r = ZONAS.lounge.ocupa[0];
  const g = grupo(padre, (r.x0 + r.x1) / 2, 0.035, (r.z0 + r.z1) / 2);
  pon(g, caja(r.x1 - r.x0 - 0.5, 0.012, r.z1 - r.z0 - 0.5, 0.004), m.alfombraTerracota, 0, 0.006, 0, { sombra: false });
  pon(g, caja(r.x1 - r.x0 - 0.8, 0.014, r.z1 - r.z0 - 0.8, 0.004), m.alfombra, 0, 0.012, 0, { sombra: false });
  // Sofá contra el fondo de la zona, mirando a la sala.
  const sofa = grupo(g, 0, 0, 0.85);
  sofa.rotation.y = Math.PI;
  pon(sofa, caja(2.0, 0.22, 0.8, 0.05), m.arena, 0, 0.2, 0);
  for (let i = -1; i <= 1; i++) pon(sofa, caja(0.62, 0.14, 0.7, 0.06), m.crema, i * 0.64, 0.38, 0.04);
  pon(sofa, caja(2.0, 0.5, 0.2, 0.06), m.arena, 0, 0.5, -0.3);
  for (const s of [-1, 1]) pon(sofa, caja(0.2, 0.36, 0.8, 0.06), m.arena, s * 1.0, 0.4, 0);
  for (const s of [-1, 1]) pon(sofa, caja(0.36, 0.3, 0.12, 0.06), s < 0 ? m.terracota : m.salvia, s * 0.6, 0.6, -0.17, { rot: [-0.2, 0, s * 0.1] });
  for (const [sx, sz] of [[-0.9, 0.3], [0.9, 0.3], [-0.9, -0.3], [0.9, -0.3]]) pon(sofa, cil(0.025, 0.02, 0.1, 6), m.maderaOscura, sx, 0.05, sz);
  // Dos butacas encaradas.
  for (const s of [-1, 1]) {
    const b = grupo(g, s * 1.25, 0, -0.35, s * 0.9 + Math.PI);
    pon(b, caja(0.68, 0.2, 0.68, 0.06), m.terracota, 0, 0.25, 0);
    pon(b, caja(0.68, 0.45, 0.16, 0.06), m.terracota, 0, 0.55, -0.28, { rot: [-0.12, 0, 0] });
    for (const t of [-1, 1]) pon(b, caja(0.12, 0.26, 0.6, 0.05), m.terracota, t * 0.3, 0.42, 0);
    for (const [sx, sz] of [[-0.26, 0.26], [0.26, 0.26], [-0.26, -0.26], [0.26, -0.26]]) pon(b, cil(0.02, 0.015, 0.15, 6), m.maderaOscura, sx, 0.075, sz);
  }
  // Mesa baja con revistas y una planta.
  const mesaBaja = grupo(g, 0, 0, -0.2);
  pon(mesaBaja, cil(0.42, 0.42, 0.05, 24), m.maderaClara, 0, 0.38, 0);
  pon(mesaBaja, cil(0.05, 0.08, 0.36, 10), m.grafito, 0, 0.18, 0);
  pon(mesaBaja, cil(0.24, 0.26, 0.03, 18), m.grafito, 0, 0.015, 0);
  pila(mesaBaja, m, -0.12, 0.405, 0.05, 3, m.terracota, 0.22, 0.28);
  plantita(mesaBaja, m, 0.15, 0.405, -0.08, 2);
  const lampara = lamparaPie(g, m, r.x1 - r.x0 > 3 ? 1.55 : 1.2, 0.8);
  return { poner: (on) => lampara.poner(on) };
}

/**
 * Sala de brainstorming: mesa colaborativa con sillas, pizarra con los platos REALES de los encargos abiertos (o
 * «sin encargos»), notas adhesivas y marcadores. La pizarra es viva: cambia con los datos.
 */
function brainstorming(padre, m) {
  const r = ZONAS.brainstorming.ocupa[0];
  const g = grupo(padre, (r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
  const mesaG = mesa(g, m, { largo: 1.5, fondo: 0.85, tablero: m.blancoCalido, patas: m.grafito, x: -0.15, z: 0.1 });
  void mesaG;
  for (const [x, z, a] of [[-0.6, -0.55, 0], [0.3, -0.55, 0], [-0.6, 0.75, Math.PI], [0.3, 0.75, Math.PI], [0.95, 0.1, -Math.PI / 2]]) silla(g, m, x, z, a, m.salvia);
  // Notas y marcadores sobre la mesa.
  for (let i = 0; i < 5; i++) pon(g, caja(0.07, 0.004, 0.07, 0.001), [m.salvia, m.naranja, m.cian, m.crema, m.terracota][i], -0.6 + i * 0.22, ALTO_MESA + 0.003, 0.05 + (i % 2) * 0.12, { sombra: false });
  for (let i = 0; i < 3; i++) pon(g, cil(0.008, 0.008, 0.12, 6), [m.azul, m.rojo, m.tinta][i], 0.25 + i * 0.03, ALTO_MESA + 0.008, 0.25, { rot: [0, 0, Math.PI / 2] });
  // Pizarra blanca en pie, contra la pared derecha (mirando a la sala).
  const piz = grupo(g, (r.x1 - r.x0) / 2 - 0.3, 0, -0.1, -Math.PI / 2);
  for (const s of [-1, 1]) pon(piz, caja(0.05, 1.9, 0.05, 0.01), m.grafito, s * 0.85, 0.95, 0);
  pon(piz, caja(1.72, 1.06, 0.04, 0.02), m.metalClaro, 0, 1.35, 0);
  const pizarra = lamina(piz, 1.64, 0.98, 0, 1.35, 0.022);
  pon(piz, caja(1.6, 0.04, 0.08, 0.01), m.metalClaro, 0, 0.8, 0.04);
  return {
    poner(platos) {
      const tex = texturaPizarra('En la mesa', platos);
      if (pizarra.material.map !== tex) {
        pizarra.material.map = tex;
        pizarra.material.color.set(0xffffff);
        pizarra.material.needsUpdate = true;
      }
    },
  };
}

/** Rincón de lectura junto a la recepción: butaca, estantería baja, lámpara y revistas (pequeño espacio privado). */
function rinconLectura(padre, m) {
  const r = ZONAS.lectura.ocupa[0];
  const g = grupo(padre, (r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
  pon(g, cil(0.85, 0.85, 0.012, 32), m.alfombra, 0.1, 0.006, 0.15, { sombra: false });
  const b = grupo(g, 0.2, 0, 0.35, 2.4);
  pon(b, caja(0.7, 0.22, 0.7, 0.07), m.petroleo, 0, 0.25, 0);
  pon(b, caja(0.7, 0.55, 0.16, 0.07), m.petroleo, 0, 0.6, -0.28, { rot: [-0.15, 0, 0] });
  for (const t of [-1, 1]) pon(b, caja(0.12, 0.28, 0.62, 0.05), m.petroleo, t * 0.31, 0.43, 0);
  pon(b, caja(0.4, 0.2, 0.4, 0.05), m.petroleoClaro, 0, 0.12, 0.6);
  estanteria(g, m, 0.0, -1.2, 0, { ancho: 1.4, alto: 0.9, baldas: 2, semilla: 5 });
  const lampara = lamparaPie(g, m, -0.65, 0.95, m.salvia);
  pila(g, m, 0.75, 0.0, 1.0, 3, m.crema, 0.26, 0.2);
  return { poner: (on) => lampara.poner(on) };
}

export function crearZonasComunes(m) {
  const raiz = new THREE.Group();
  raiz.name = 'zonas-comunes';
  const cafe = rinconCafe(raiz, m);
  const salon = lounge(raiz, m);
  const sala = brainstorming(raiz, m);
  const lectura = rinconLectura(raiz, m);
  return {
    grupo: raiz,
    /** Lámparas cálidas encendidas por la noche (ambiente según la hora real, no proceso). */
    luces: (on) => [cafe, salon, lectura].forEach((z) => z.poner(on)),
    pizarra: (platos) => sala.poner(platos),
  };
}

void blob;
