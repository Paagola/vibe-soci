// Lo que comparten las pantallas de la orden única: las cinco fases, qué le toca a la persona y las URL de los archivos.

/** Las once etapas de la orden, agrupadas en las cinco fases que se ven. Las dos paradas cierran Elementos y Foto. */
export const FASES = [
  { id: 'REFERENCIA', nombre: 'Referencia' },
  { id: 'ELEMENTOS', nombre: 'Elementos', parada: 'Parada 1' },
  { id: 'FOTO', nombre: 'Foto nueva', parada: 'Parada 2' },
  { id: 'DISENO', nombre: 'Diseño' },
  { id: 'RESULTADO', nombre: 'Post' },
];

export const indiceDeFase = (fase) => FASES.findIndex((f) => f.id === fase);

/** Qué le toca a la persona en cada paso, para la lista y la cabecera. `toca` = la orden espera algo de ti. */
const ESTADOS = {
  REFERENCIA: { texto: 'Elige la referencia', toca: true },
  FOTO_REAL: { texto: 'En marcha' },
  PROPUESTA: { texto: 'En marcha' },
  CONFIRMAR_ELEMENTOS: { texto: 'Parada 1 · confirma los elementos', toca: true },
  GENERAR: { texto: 'Foto nueva pendiente', toca: true },
  COMPROBAR: { texto: 'En marcha' },
  CONFIRMAR_FOTO: { texto: 'Parada 2 · mira la foto', toca: true },
  MASCARA: { texto: 'En marcha' },
  INTENCION: { texto: 'Escribe la intención de diseño', toca: true },
  COMPONER: { texto: 'Componiendo' },
  HECHO: { texto: 'Post listo', listo: true },
};

export function estadoDePaso(paso, { bloqueado = false, trabajoEnCurso = false } = {}) {
  if (trabajoEnCurso) return { texto: 'Trabajando…', clase: 'chip-azul' };
  if (bloqueado) return { texto: 'Bloqueado: revisa la propuesta', clase: 'chip-alerta' };
  const estado = ESTADOS[paso] ?? { texto: paso };
  return { texto: estado.texto, clase: estado.listo ? 'chip-ok' : estado.toca ? 'chip-toca' : '' };
}

/** Las barritas de fase de las tarjetas. */
export function fasesMini(fase, h) {
  const actual = indiceDeFase(fase);
  return h(
    'span',
    { class: 'fases-mini', 'aria-label': `Fase ${actual + 1} de ${FASES.length}: ${FASES[actual]?.nombre ?? ''}` },
    FASES.map((f, i) => h('i', { class: i < actual || fase === 'RESULTADO' ? 'hecha' : i === actual ? 'actual' : '' })),
  );
}

const codificar = (ruta) => ruta.split('/').map(encodeURIComponent).join('/');

/** URL de los archivos de un encargo (servidos por /archivos/encargos/<proyecto>/…). */
export function urlsDe(proyecto) {
  const base = `/archivos/encargos/${encodeURIComponent(proyecto)}`;
  return {
    subida: (lado) => `${base}/subida${lado ? `?lado=${lado}` : ''}`,
    activo: (id, lado) => `${base}/activos/${encodeURIComponent(id)}${lado ? `?lado=${lado}` : ''}`,
    mascara: (id) => `${base}/activos/${encodeURIComponent(id)}?mascara`,
    referencia: (lado) => `${base}/referencia${lado ? `?lado=${lado}` : ''}`,
    referenciaDelLocal: (id, lado) => `${base}/referencias/${encodeURIComponent(id)}${lado ? `?lado=${lado}` : ''}`,
    diseno: (archivo, { lado, sello } = {}) => {
      const consulta = [lado ? `lado=${lado}` : '', sello ? `v=${sello}` : ''].filter(Boolean).join('&');
      return `${base}/disenos/${codificar(archivo)}${consulta ? `?${consulta}` : ''}`;
    },
    descargar: (archivo) => `${base}/disenos/${codificar(archivo)}?descargar`,
    vistaPrevia: (archivo, sello) => `${base}/vista-previa/${codificar(archivo)}?v=${sello}`,
  };
}

export const urlDeBiblioteca = (post, lado = 320) => `/archivos/biblioteca/${encodeURIComponent(post)}?lado=${lado}`;

export const usd = (n) => `${Number(n ?? 0).toFixed(3)} USD`;
