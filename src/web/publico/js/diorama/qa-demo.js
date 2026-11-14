// Recorrido de prueba para QA (diorama.html?qa=demo): una sucesión de estados con la forma EXACTA de GET
// /api/procesos (la del simulado del 14/11 más un 503 real de Gemini y un rechazo), aplicados en orden. Sirve para
// congelar fotogramas en tiempos conocidos; la escena en vivo usa la API y no carga este archivo.

const BASE = ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA'];
const enc = (paso, recorrido, extra = {}) => ({
  proyecto: '2026-11-14-rodaballo-a-la-parrilla',
  local: 'asador-etxebarri',
  nombreLocal: 'Asador Etxebarri',
  plato: 'Rodaballo a la parrilla con su pil-pil',
  paso,
  bloqueo: null,
  creadoEn: '2026-11-14T10:00:00Z',
  actualizadoEn: '2026-11-14T10:00:00Z',
  intentos: [],
  fotoElegida: false,
  diseno: null,
  recorrido: recorrido.map((p) => ({ fecha: '2026-11-14T10:00:00Z', paso: p })),
  trabajo: { estado: 'TERMINADO', mensaje: 'Listo', fraccion: 1, quedanSegundos: 0, iniciadoEn: 1, terminadoEn: 2, avisos: [], error: null },
  ...extra,
});
const enCurso = (mensaje, avisos = []) => ({ estado: 'EN_CURSO', mensaje, fraccion: 0.4, quedanSegundos: 60, iniciadoEn: 3, terminadoEn: null, avisos, error: null });
const estado = (...encargos) => ({ modo: 'SIMULADO', ahora: 0, encargos });
const otro = enc('CONFIRMAR_ELEMENTOS', BASE, { proyecto: '2026-11-13-pulpo', actualizadoEn: '2026-11-13T10:00:00Z' });

const R1 = [...BASE, 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'GENERAR', 'COMPROBAR'];
const R2 = [...R1, 'CONFIRMAR_FOTO', 'GENERAR', 'COMPROBAR'];
const R3 = [...R2, 'CONFIRMAR_FOTO', 'MASCARA', 'INTENCION', 'COMPONER'];

/** [nombre, estado]: cada uno se aplica cuando la escena ha contado el anterior. */
export const DEMO = [
  ['vacio', estado()],
  ['falta-referencia', estado(enc('REFERENCIA', ['REFERENCIA']), otro)],
  ['parada1', estado(enc('CONFIRMAR_ELEMENTOS', BASE), otro)],
  ['generando-503', estado(enc('GENERAR', [...BASE, 'CONFIRMAR_ELEMENTOS'], { trabajo: enCurso('Haciendo la foto nueva (intento 1)…', ['gemini-3-pro-image no responde ahora (Gemini HTTP 503: The model is overloaded.). Sigo con gemini-3.5-flash.']) }), otro)],
  ['parada2', estado(enc('CONFIRMAR_FOTO', R1, { intentos: [{ n: 1, final: 'DESCARTA' }, { n: 2, final: 'PASA' }] }), otro)],
  ['rechazo', estado(enc('CONFIRMAR_FOTO', R2, { intentos: [{ n: 1, final: 'DESCARTA' }, { n: 2, final: 'RECHAZADA' }, { n: 3, final: 'PASA' }] }), otro)],
  ['diseno-en-curso', estado(enc('INTENCION', [...R2, 'CONFIRMAR_FOTO', 'MASCARA'], { intentos: [{ n: 1, final: 'DESCARTA' }, { n: 2, final: 'RECHAZADA' }, { n: 3, final: 'PASA' }], fotoElegida: true, trabajo: enCurso('Preparando la intención de diseño…') }), otro)],
  ['hecho', estado(enc('HECHO', R3, { intentos: [{ n: 1, final: 'DESCARTA' }, { n: 2, final: 'RECHAZADA' }, { n: 3, final: 'PASA' }], fotoElegida: true, diseno: { propuestas: 2, pasa: true } }), otro)],
];

/**
 * Aplica los estados en orden: cada uno 2,5 s después de que la escena llegue al segmento abierto del anterior.
 * Devuelve las marcas de tiempo (para congelar fotogramas): cuándo se aplicó cada estado y los momentos clave.
 */
export function programar(escena, demo = DEMO) {
  const guion = escena.guion;
  const marcas = {};
  let t = 0;
  for (const [nombre, est] of demo) {
    escena.actualizar(est, t);
    marcas[nombre] = t;
    const abierto = guion.segmentos.at(-1);
    t = (Number.isFinite(abierto.t0) ? Math.max(abierto.t0, t) : t) + 2.5;
  }
  marcas.fin = t;
  // Momentos clave, buscados en la línea de tiempo (mitad de cada segmento).
  const mitad = (s) => (s.t0 + (Number.isFinite(s.t1) ? s.t1 : s.t0 + 2)) / 2;
  const busca = (nombre, f, n = 0) => {
    const s = guion.segmentos.filter(f)[n];
    if (s) marcas[nombre] = +mitad(s).toFixed(2);
  };
  busca('andando-con-foto', (s) => s.tipo === 'andar' && s.mano === 'foto');
  busca('director-foto-trabaja', (s) => s.tipo === 'procesar' && s.puesto === 'directorFoto');
  busca('revisor-descarta', (s) => s.tipo === 'procesar' && s.puesto === 'revisor' && s.sale === 'fotoMal');
  busca('vuelta-al-generador', (s) => s.tipo === 'andar' && s.mano === 'fotoMal');
  busca('generador-trabaja', (s) => s.tipo === 'procesar' && s.puesto === 'generador', 1);
  busca('recorte', (s) => s.tipo === 'procesar' && s.puesto === 'mascara');
  busca('prueba-devuelta', (s) => s.tipo === 'andar' && s.mano === 'pruebaMal');
  busca('compositor-imprime', (s) => s.tipo === 'procesar' && s.puesto === 'compositor' && s.sale === 'post');
  busca('expositor', (s) => s.tipo === 'dejar' && s.puesto === 'salida');
  const p1 = guion.segmentos.find((s) => s.tipo === 'mostrar' && s.puesto === 'parada1');
  if (p1) marcas['espera-parada1'] = +(p1.t0 + 1.5).toFixed(2);
  const nube = guion.segmentos.find((s) => s.aviso === '503');
  if (nube) marcas['nube-503'] = +(nube.t0 + 1.5).toFixed(2);
  const p2 = guion.segmentos.filter((s) => s.tipo === 'mostrar' && s.puesto === 'parada2');
  if (p2[0]) marcas['espera-parada2'] = +(p2[0].t0 + 1.2).toFixed(2);
  if (p2[0]) marcas['rechazo-cruz'] = +(p2[0].t1 - 0.15).toFixed(2);
  marcas.reposo = +(guion.segmentos.at(-1).t0 + 3).toFixed(2);
  return marcas;
}
