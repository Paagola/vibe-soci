// El plano del loft: ÚNICA fuente de verdad de la distribución. Datos puros, sin three.js (lo leen el decorado, el
// guion y las pruebas espaciales de Node).
//
// Unidades: metros. X a la derecha, Z hacia la cámara, Y arriba. La cámara de héroe mira desde +X +Z, así que las
// paredes con ventanales son la del fondo (-Z) y la izquierda (-X); los lados de la cámara quedan abiertos (cutaway).
//
//            z = -6.5  ┌──────────────── pared del fondo con ventanales ────────────────┐
//   referencias ·  estudio de foto  │ generador · revisor · segmentación (laboratorio, cristal)
//            z = -2.2  ═══ CALLE DEL FONDO ════ parada 1 ═══════════ parada 2 ════════════
//   recepción │ rincón de lectura │      JARDÍN CENTRAL (patio)      │ sala de brainstorming
//            z =  2.6  ═══ CALLE DELANTERA ═════════════════════════════════════════════
//   café │ lounge │      galería de entrega · compositor (imprenta) · dirección de arte
//            z =  6.5  └─────────────────────────────── (abierto a la cámara) ──────────┘
//
// El material recorre la calle del fondo de izquierda a derecha, baja por la derecha y vuelve por la calle delantera
// de derecha a izquierda hasta la galería: un circuito alrededor del jardín.

export const LOSA = Object.freeze({ x0: -9.5, x1: 9.5, z0: -6.5, z1: 6.5, grueso: 0.3 });
/** Grosor y altura de las paredes con ventanales (fondo y izquierda). */
export const PARED = Object.freeze({ grueso: 0.24, alto: 3.0 });
/** Altura de las mesas de trabajo de los profesionales y de las bandejas de las máquinas. */
export const ALTO_MESA = 0.74;
/** Altura del suelo elevado de madera de algunas zonas (dirección creativa, lounge). */
export const ALTO_TARIMA = 0.12;

const rect = (x0, z0, x1, z1) => Object.freeze({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
const P = (x, z, yaw = 0) => Object.freeze({ x, z, yaw });
const FRENTE = 0; // mirando a +Z (a la cámara)
const ATRAS = Math.PI; // mirando a -Z
const DERECHA = Math.PI / 2; // mirando a +X
const IZQUIERDA = -Math.PI / 2; // mirando a -X
/** Hacia la cámara de héroe (en las paradas, el corredor enseña el material «a la persona»). */
const A_CAMARA = 0.72;

/**
 * Las once estaciones de la orden única (src/dominio/post.ts). Por cada una:
 * - `centro` y `yaw`: el marco del grupo de la estación (su +Z local es por donde llega el corredor);
 * - `entrega`: dónde se para el corredor y hacia dónde mira;
 * - `operario`: dónde trabaja el profesional (solo los agentes que deciden; las máquinas van solas);
 * - `ocupa`: el área que ocupan sus muebles y máquinas (para las pruebas de colisión);
 * - `zona`: el vecindario creativo al que pertenece.
 */
export const PUESTOS = Object.freeze({
  referencia: {
    paso: 'REFERENCIA', tipo: 'tablero', zona: 'recepcion', nombre: 'Tablero de referencias',
    funcion: 'Guarda la referencia de Canva o Pinterest de la que se toma el oficio (obligatoria en las 5 primeras piezas del local).',
    centro: P(-7.55, -5.2, FRENTE), entrega: P(-7.55, -3.63, ATRAS), ocupa: [rect(-9.2, -6.25, -6.0, -3.93)],
  },
  entrada: {
    paso: 'FOTO_REAL', tipo: 'bandeja', zona: 'recepcion', nombre: 'Recepción · bandeja de entrada',
    funcion: 'Recibe la foto que sube el hostelero y la registra como activo real del encargo.',
    centro: P(-8.6, -1.15, DERECHA), entrega: P(-7.98, -1.15, IZQUIERDA), ocupa: [rect(-9.25, -2.6, -8.28, 0.3)],
  },
  directorFoto: {
    paso: 'PROPUESTA', tipo: 'agente', zona: 'fotografia', nombre: 'Director de fotografía',
    funcion: 'Gemini mira la foto subida y propone la toma nueva: cámara, luz, encuadre y la lista de elementos que hay que conservar.',
    centro: P(-3.85, -4.05, FRENTE), entrega: P(-2.42, -4.05, IZQUIERDA), operario: P(-3.35, -4.72, FRENTE), ocupa: [rect(-5.9, -6.25, -2.75, -3.72)],
  },
  parada1: {
    paso: 'CONFIRMAR_ELEMENTOS', tipo: 'parada', zona: 'fotografia', nombre: 'Parada 1 · mesa de presentación',
    funcion: 'Aquí se para todo: confirmas los elementos, el prompt y el gasto de la foto nueva.',
    centro: P(-2.85, -0.85, FRENTE), entrega: P(-2.85, -2.05, A_CAMARA), ocupa: [rect(-3.55, -1.35, -2.15, -0.3)],
  },
  generador: {
    paso: 'GENERAR', tipo: 'maquina', zona: 'laboratorio', nombre: 'Generador de la foto',
    funcion: 'Máquina autónoma: hace la foto nueva del mismo plato con otra toma, otra luz y los mismos elementos.',
    centro: P(-0.55, -4.75, FRENTE), entrega: P(-0.55, -3.82, ATRAS), ocupa: [rect(-1.75, -6.0, 0.65, -4.12)],
  },
  revisor: {
    paso: 'COMPROBAR', tipo: 'agente', zona: 'laboratorio', nombre: 'Revisor visual',
    funcion: 'Comprueba que la foto nueva conserva todos los elementos del plato, su número y su anatomía, y que no añade nada.',
    centro: P(2.75, -4.05, FRENTE), entrega: P(1.65, -4.05, DERECHA), operario: P(2.75, -4.72, FRENTE), ocupa: [rect(1.9, -6.25, 4.25, -3.72)],
  },
  parada2: {
    paso: 'CONFIRMAR_FOTO', tipo: 'parada', zona: 'laboratorio', nombre: 'Parada 2 · foto ampliada',
    funcion: 'Aquí se para todo: miras la foto nueva y la confirmas o la rechazas con un motivo.',
    centro: P(5.58, -0.85, FRENTE), entrega: P(5.58, -2.05, A_CAMARA), ocupa: [rect(4.95, -1.35, 6.2, -0.3)],
  },
  mascara: {
    paso: 'MASCARA', tipo: 'maquina', zona: 'laboratorio', nombre: 'Segmentación (Apple Vision)',
    funcion: 'Máquina autónoma: recorta el plato de la foto confirmada (la máscara del sujeto) para que el diseño pueda jugar con él.',
    centro: P(6.45, -4.75, FRENTE), entrega: P(6.45, -3.82, ATRAS), ocupa: [rect(5.3, -6.0, 7.6, -4.12)],
  },
  directorDiseno: {
    paso: 'INTENCION', tipo: 'agente', zona: 'creativa', nombre: 'Director de diseño',
    funcion: 'Gemini escribe la intención de diseño desde la referencia y el mapa de la foto; el código comprueba que no inventa nada.',
    centro: P(6.6, 4.4, FRENTE), entrega: P(5.75, 3.6, FRENTE), operario: P(6.65, 3.5, FRENTE), ocupa: [rect(5.3, 3.95, 9.2, 6.25)],
  },
  compositor: {
    paso: 'COMPONER', tipo: 'maquina', zona: 'grafica', nombre: 'Compositor (sharp · SVG)',
    funcion: 'Máquina autónoma: pinta la intención sobre la foto y exporta el post a 3:4 y 4:5.',
    centro: P(2.05, 4.55, ATRAS), entrega: P(2.05, 3.6, FRENTE), ocupa: [rect(0.75, 3.92, 3.4, 5.9)],
  },
  salida: {
    paso: 'HECHO', tipo: 'expositor', zona: 'grafica', nombre: 'Galería de entrega',
    funcion: 'Aquí queda expuesto cada post terminado; los anteriores forman la exposición del estudio.',
    centro: P(-1.55, 4.75, FRENTE), entrega: P(-1.55, 3.6, FRENTE), ocupa: [rect(-3.0, 3.95, -0.1, 5.6)],
  },
});

/** El orden de la orden única (dominio/post.ts) y el puesto de cada paso. */
export const ORDEN = Object.freeze(['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'CONFIRMAR_FOTO', 'MASCARA', 'INTENCION', 'COMPONER', 'HECHO']);
export const PUESTO_DE_PASO = Object.freeze(Object.fromEntries(Object.entries(PUESTOS).map(([id, p]) => [p.paso, id])));

/** Zonas comunes (ambiente: no son procesos). */
export const ZONAS = Object.freeze({
  jardin: { nombre: 'Jardín central', ocupa: [rect(-1.65, -1.25, 3.68, 1.85)] },
  lectura: { nombre: 'Rincón de lectura', ocupa: [rect(-6.75, -1.25, -5.1, 1.9)] },
  brainstorming: { nombre: 'Sala de brainstorming', ocupa: [rect(6.3, -1.25, 9.25, 1.9)] },
  cafe: { nombre: 'Rincón del café', ocupa: [rect(-9.25, 3.25, -8.1, 6.25)] },
  lounge: { nombre: 'Lounge', ocupa: [rect(-7.5, 3.55, -3.85, 6.25)] },
});

/** Árboles y plantas grandes (cada uno con su especie: no se repite el mismo árbol). Centro y radio de copa. */
export const VEGETACION = Object.freeze([
  { especie: 'olivo', x: 1.05, z: 0.3, copa: 1.25 },
  { especie: 'ficus', x: 8.6, z: -5.4, copa: 0.75 },
  { especie: 'kentia', x: 4.15, z: 5.75, copa: 0.6 },
  { especie: 'monstera', x: -3.42, z: 5.85, copa: 0.42 },
  { especie: 'strelitzia', x: -5.6, z: -0.8, copa: 0.45 },
  { especie: 'helecho', x: -6.0, z: 1.35, copa: 0.4 },
]);

/** Jardineras lineales y el jardín vertical (pared izquierda, junto al café). Rectángulo que ocupan en el suelo. */
export const JARDINERAS = Object.freeze([{ x: 0.95, z: -2.95, ancho: 0.9, fondo: 0.32 }]);
export const JARDIN_VERTICAL = Object.freeze({ x: -9.5 + 0.3, z: 5.55, ancho: 1.25, alto: 1.6, y: 1.75 });

/** Pilares estructurales (los del forjado del loft) y vigas vistas encima. */
export const PILARES = Object.freeze([P(-5.0, -3.15), P(4.3, -3.15), P(-3.42, 3.45), P(4.3, 3.45)]);

// ---------------------------------------------------------------- Recorridos

/** La red de calles por las que se camina: nodos y tramos. Las entregas se enganchan a su nodo más cercano. */
export const CALLES = Object.freeze({
  nodos: {
    F0: P(-7.45, -2.05), F1: P(-4.45, -2.05), F2: P(-2.85, -2.05), F3: P(-0.55, -2.05), F25: P(1.65, -2.05), F4: P(3.5, -2.05), F45: P(4.3, -2.05), F5: P(5.58, -2.05), F6: P(6.45, -2.05),
    D0: P(-7.45, 2.6), D1: P(-4.45, 2.6), D2: P(-1.55, 2.6), D3: P(2.05, 2.6), D4: P(4.3, 2.6), D5: P(5.45, 2.6),
  },
  tramos: [
    ['F0', 'F1'], ['F1', 'F2'], ['F2', 'F3'], ['F3', 'F25'], ['F25', 'F4'], ['F4', 'F45'], ['F45', 'F5'], ['F5', 'F6'],
    ['D0', 'D1'], ['D1', 'D2'], ['D2', 'D3'], ['D3', 'D4'], ['D4', 'D5'],
    ['F0', 'D0'], ['F1', 'D1'], ['F45', 'D4'],
  ],
});
/** Anchura libre mínima de las calles (para las pruebas de paso). */
export const ANCHO_CALLE = 1.2;

/** Dónde descansa el corredor cuando no hay nada en marcha: junto a la recepción, mirando a la sala. */
export const REPOSO = Object.freeze({ x: -7.55, z: -0.35, yaw: 0.9 });

/** Dirección de la cámara de héroe en el plano XZ (para que el corredor enseñe el material «a la persona»). */
export const YAW_CAMARA = A_CAMARA;

export const sitioDeEntrega = (id) => ({ ...PUESTOS[id].entrega });
export const marcoDePuesto = (id) => ({ ...PUESTOS[id].centro });

// ---------------------------------------------------------------- Rutas (puras, deterministas)

const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

function nodoMasCercano(p) {
  let mejor = null;
  let d = Infinity;
  for (const [id, n] of Object.entries(CALLES.nodos)) {
    const dd = dist(p, n);
    if (dd < d) {
      d = dd;
      mejor = id;
    }
  }
  return mejor;
}

const vecinos = (() => {
  const v = Object.fromEntries(Object.keys(CALLES.nodos).map((k) => [k, []]));
  for (const [a, b] of CALLES.tramos) {
    v[a].push(b);
    v[b].push(a);
  }
  return v;
})();

function caminoEntreNodos(a, b) {
  const d = Object.fromEntries(Object.keys(CALLES.nodos).map((k) => [k, Infinity]));
  const prev = {};
  d[a] = 0;
  const pendientes = new Set(Object.keys(CALLES.nodos));
  while (pendientes.size) {
    let u = null;
    for (const k of pendientes) if (u === null || d[k] < d[u]) u = k;
    pendientes.delete(u);
    if (u === b || d[u] === Infinity) break;
    for (const w of vecinos[u]) {
      const alt = d[u] + dist(CALLES.nodos[u], CALLES.nodos[w]);
      if (alt < d[w]) {
        d[w] = alt;
        prev[w] = u;
      }
    }
  }
  if (d[b] === Infinity) return null;
  const camino = [b];
  while (camino[0] !== a) camino.unshift(prev[camino[0]]);
  return camino;
}

/**
 * La ruta a pie entre dos puntos: sale a la calle por el nodo más cercano, sigue la red y entra al destino por su nodo.
 * Devuelve la polilínea [{x,z}] y su longitud. Si los dos puntos comparten nodo, va recto.
 */
export function ruta(desde, hasta) {
  const a = nodoMasCercano(desde);
  const b = nodoMasCercano(hasta);
  const puntos = [{ x: desde.x, z: desde.z }];
  if (a !== b && dist(desde, hasta) > 0.05) {
    const nodos = caminoEntreNodos(a, b) ?? [];
    for (const id of nodos) puntos.push({ x: CALLES.nodos[id].x, z: CALLES.nodos[id].z });
  }
  puntos.push({ x: hasta.x, z: hasta.z });
  // Quita los puntos que casi se repiten (un nodo encima de la entrega) para no girar en el sitio.
  const limpios = puntos.filter((p, i) => i === 0 || dist(p, puntos[i - 1]) > 0.08);
  let largo = 0;
  for (let i = 1; i < limpios.length; i++) largo += dist(limpios[i - 1], limpios[i]);
  return { puntos: limpios, largo };
}

/** Posición y rumbo a una distancia `d` a lo largo de una polilínea. */
export function enRuta(puntos, d) {
  let resto = Math.max(0, d);
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const l = dist(a, b);
    if (resto <= l || i === puntos.length - 1) {
      const u = l > 0 ? Math.min(1, resto / l) : 1;
      return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, rumbo: Math.atan2(b.x - a.x, b.z - a.z), tramo: i };
    }
    resto -= l;
  }
  const p = puntos.at(-1);
  return { x: p.x, z: p.z, rumbo: 0, tramo: puntos.length - 1 };
}
