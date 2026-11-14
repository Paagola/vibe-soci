// El plano del estudio: dónde está cada puesto en la losa. Datos puros (sin three.js), compartidos por el decorado y
// por el guion, que se prueba en Node.
//
// La losa es larga en Z: el material entra por el fondo (-Z) y sale hacia la cámara (+Z), por un pasillo central.
// Los puestos se alternan a los dos lados del pasillo: a la izquierda (-X) los agentes que deciden (directores y
// revisor) y los tablones; a la derecha (+X) las máquinas que ejecutan (generador, recorte y compositor).

export const LOSA = Object.freeze({ ancho: 4.9, largo: 13.2, grueso: 0.34 });

/** Altura de la mesa (y de la bandeja de entrada de las máquinas), donde se deja el material. */
export const ALTO_MESA = 0.56;
/** Distancia del pasillo a la que se para el corredor delante de un puesto. */
export const X_ENTREGA = 1.0;
/** Centro de la mesa (donde queda el material) y sitio del operario detrás. */
export const X_MESA = 1.44;
export const X_OPERARIO = 1.86;

/**
 * Cada puesto: lado del pasillo (-1 izquierda, +1 derecha, 0 en el pasillo), su Z y qué es.
 * `paso` es el paso de la orden única (src/dominio/post.ts) que hace ese puesto.
 */
export const PUESTOS = Object.freeze({
  referencia: { lado: -1, z: -5.35, tipo: 'tablero', paso: 'REFERENCIA', nombre: 'Tablero de la referencia' },
  entrada: { lado: 1, z: -4.85, tipo: 'bandeja', paso: 'FOTO_REAL', nombre: 'Bandeja de entrada' },
  directorFoto: { lado: -1, z: -3.15, tipo: 'agente', paso: 'PROPUESTA', nombre: 'Director de foto (Gemini)' },
  parada1: { lado: 0, z: -2.05, tipo: 'parada', paso: 'CONFIRMAR_ELEMENTOS', nombre: 'Parada 1: confirmar elementos' },
  generador: { lado: 1, z: -1.15, tipo: 'maquina', paso: 'GENERAR', nombre: 'Generador de la foto' },
  revisor: { lado: -1, z: 0.25, tipo: 'agente', paso: 'COMPROBAR', nombre: 'Revisor (comprobación automática)' },
  parada2: { lado: 0, z: 1.3, tipo: 'parada', paso: 'CONFIRMAR_FOTO', nombre: 'Parada 2: confirmar la foto' },
  mascara: { lado: 1, z: 2.05, tipo: 'maquina', paso: 'MASCARA', nombre: 'Recorte (Apple Vision)' },
  directorDiseno: { lado: -1, z: 3.4, tipo: 'agente', paso: 'INTENCION', nombre: 'Director de diseño F3 (Gemini)' },
  compositor: { lado: 1, z: 4.45, tipo: 'maquina', paso: 'COMPONER', nombre: 'Compositor (sharp/SVG)' },
  salida: { lado: -1, z: 5.55, tipo: 'expositor', paso: 'HECHO', nombre: 'Bandeja de salida' },
});

/** El orden de la orden única (dominio/post.ts) y el puesto de cada paso. */
export const ORDEN = Object.freeze(['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'CONFIRMAR_FOTO', 'MASCARA', 'INTENCION', 'COMPONER', 'HECHO']);
export const PUESTO_DE_PASO = Object.freeze(Object.fromEntries(Object.entries(PUESTOS).map(([id, p]) => [p.paso, id])));

/** Dónde descansa el corredor cuando no hay nada en marcha: junto a la bandeja de entrada, mirando al pasillo. */
export const REPOSO = Object.freeze({ x: 0.55, z: -5.75, yaw: -0.35 });

/** Dirección de la cámara de héroe en el plano XZ (para que el corredor enseñe el material «a la persona»). */
export const YAW_CAMARA = 0.42;

/** Sitio y orientación del corredor al llegar a un puesto. */
export function sitioDeEntrega(id) {
  const p = PUESTOS[id];
  if (p.lado === 0) return { x: 0, z: p.z, yaw: YAW_CAMARA };
  const { x, z, yaw } = marcoDePuesto(id);
  const d = X_MESA - X_ENTREGA;
  return { x: x + Math.sin(yaw) * d, z: z + Math.cos(yaw) * d, yaw: yaw + Math.PI };
}

/** Giro de los agentes hacia la cámara: así se les ve la cara sin dar la espalda al pasillo. */
export const GIRO_AGENTES = 0.35;

/**
 * Marco de un puesto: su centro (la mesa) y su orientación. El +Z local del puesto mira al pasillo (por ahí llega el
 * corredor); el operario está detrás, en -Z local.
 */
export function marcoDePuesto(id) {
  const p = PUESTOS[id];
  if (p.lado === 0) return { x: 0, z: p.z, yaw: 0 };
  const base = p.lado < 0 ? Math.PI / 2 : -Math.PI / 2;
  const giro = p.tipo === 'agente' || p.tipo === 'tablero' || p.tipo === 'expositor' ? p.lado * GIRO_AGENTES : 0;
  return { x: p.lado * X_MESA, z: p.z, yaw: base + giro };
}
