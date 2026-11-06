/**
 * Reglas del dominio. Son funciones puras: no leen ficheros ni llaman a servicios,
 * así que se pueden probar solas y reutilizar en la app.
 */
import type { DiapositivaPlan, Formato, Generacion, Pieza, Plan } from './modelos.js';

// ------------------------------------------------------------------ Límites

export const RANGO_DIAPOSITIVAS: Record<Formato, { min: number; max: number }> = {
  POST: { min: 1, max: 1 },
  CARRUSEL: { min: 3, max: 5 },
  HISTORIA: { min: 1, max: 3 },
};

/** Cambios que admite cada diapositiva (D-17 en la app). */
export const MAX_CORRECCIONES = 3;

/**
 * Palabras como máximo dentro de una imagen (sumando todos sus textos).
 * Los posts de referencia rara vez pasan de 25 sin contar el pie de contacto, y cuanto más texto
 * pide el prompt, más faltas mete el generador. Lo largo va en el pie de la publicación.
 */
export const MAX_PALABRAS_POR_DIAPOSITIVA: Record<Formato, number> = { POST: 30, CARRUSEL: 30, HISTORIA: 20 };

/** El titular se lee de un golpe en el móvil. */
export const MAX_PALABRAS_TITULAR = 5;

export const EXTENSIONES_FOTO = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export const MAX_BYTES_FOTO = 10 * 1024 * 1024;

export const TIPOS_CON_CONDICIONES = new Set<Pieza['tipo']>(['OFERTA', 'EVENTO']);

// ------------------------------------------------------------------ Proporciones (decisión del 06/11/2026)

/**
 * El feed se diseña a 3:4 (1080 × 1440) con una zona segura 4:5 en el centro (1080 × 1350).
 * Así la misma pieza vale tal cual o recortada a 4:5 (45 px arriba y 45 px abajo).
 */
export type Proporcion = '3:4' | '4:5' | '9:16';

export const TAMANO_PROPORCION: Record<Proporcion, { ancho: number; alto: number }> = {
  '3:4': { ancho: 1080, alto: 1440 },
  '4:5': { ancho: 1080, alto: 1350 },
  '9:16': { ancho: 1080, alto: 1920 },
};

/** Lo que se exporta de cada formato. La primera es la de diseño. */
export const EXPORTACIONES_POR_FORMATO: Record<Formato, Proporcion[]> = {
  POST: ['3:4', '4:5'],
  CARRUSEL: ['3:4', '4:5'],
  HISTORIA: ['9:16'],
};

/** Proporción con la que se diseña y se genera. */
export function proporcionDe(formato: Formato): '3:4' | '9:16' {
  return formato === 'HISTORIA' ? '9:16' : '3:4';
}

/** Lo que recorta la exportación 4:5 por arriba y por abajo (45 px en 1080 × 1440). */
export const RECORTE_4_5_PX = (TAMANO_PROPORCION['3:4'].alto - TAMANO_PROPORCION['4:5'].alto) / 2;

// ------------------------------------------------------------------ Brief

export type Brief = Pick<Pieza, 'formato' | 'numDiapositivas' | 'idea' | 'tipo' | 'condiciones' | 'fotos'>;

export function problemasDelBrief(brief: Brief): string[] {
  const problemas: string[] = [];
  const rango = RANGO_DIAPOSITIVAS[brief.formato];

  if (brief.numDiapositivas < rango.min || brief.numDiapositivas > rango.max) {
    problemas.push(`Un ${brief.formato} lleva entre ${rango.min} y ${rango.max} imágenes.`);
  }
  if (!brief.fotos.some((foto) => foto.papel === 'PLATO')) {
    problemas.push('Hace falta al menos una foto real de un plato.');
  }
  if (TIPOS_CON_CONDICIONES.has(brief.tipo) && !tieneAlgunaCondicion(brief.condiciones)) {
    problemas.push('Indica el precio, las fechas o los límites: la IA no puede inventarlos.');
  }
  return problemas;
}

/** Comprueba una foto antes de copiarla. `bytes` es undefined si el archivo no existe. */
export function problemaDeFoto(nombre: string, bytes: number | undefined): string | undefined {
  if (bytes === undefined) return `No encuentro el archivo ${nombre}.`;
  if (!esExtensionDeFoto(nombre)) return `${nombre}: usa JPG, PNG o WEBP (exporta antes las HEIC).`;
  if (bytes > MAX_BYTES_FOTO) return `${nombre}: pesa más de 10 MB.`;
  return undefined;
}

export function esExtensionDeFoto(nombre: string): boolean {
  return EXTENSIONES_FOTO.some((extension) => nombre.toLowerCase().endsWith(extension));
}

function tieneAlgunaCondicion(condiciones: Pieza['condiciones']): boolean {
  return Object.values(condiciones).some((valor) => Boolean(valor?.trim()));
}

// ------------------------------------------------------------------ Plan

const NUMERO = /\d+(?:[.,]\d+)?/g;
const normalizarNumero = (numero: string) => numero.replace(',', '.');

/**
 * Devuelve los textos que llevan una cifra que no aparece en las fuentes (idea y condiciones).
 * Así la IA no inventa precios ni fechas. Los contadores de carrusel se quitan antes con quitarCifrasPermitidas.
 */
export function cifrasNoAutorizadas(textos: string[], fuentes: string[]): string[] {
  const permitidas = new Set(fuentes.flatMap((fuente) => (fuente.match(NUMERO) ?? []).map(normalizarNumero)));
  return textos.filter((texto) => (texto.match(NUMERO) ?? []).some((numero) => !permitidas.has(normalizarNumero(numero))));
}

export function fuentesDeCifras(pieza: Pick<Pieza, 'idea' | 'condiciones'>): string[] {
  return [pieza.idea, ...Object.values(pieza.condiciones).filter((valor): valor is string => Boolean(valor))];
}

export function problemasDelPlan(pieza: Pieza, plan: Plan): string[] {
  const problemas: string[] = [];
  const posiciones = plan.diapositivas.map((diapositiva) => diapositiva.posicion).sort((a, b) => a - b);
  const esperadas = Array.from({ length: pieza.numDiapositivas }, (_, i) => i + 1);

  if (posiciones.join(',') !== esperadas.join(',')) {
    problemas.push(`Tiene que haber exactamente ${pieza.numDiapositivas} diapositivas con posiciones ${esperadas.join(', ')}.`);
  }
  if (pieza.numDiapositivas > 1 && !plan.hiloVisual) {
    problemas.push('Falta "hiloVisual": di qué une todas las diapositivas (color, tipografía y un elemento que continúa).');
  }

  const archivosValidos = new Set(pieza.fotos.map((foto) => foto.archivo));
  for (const diapositiva of plan.diapositivas) {
    const desconocidas = diapositiva.fotos.filter((archivo) => !archivosValidos.has(archivo));
    if (desconocidas.length > 0) {
      problemas.push(`La diapositiva ${diapositiva.posicion} usa fotos que no existen: ${desconocidas.join(', ')}. Usa solo: ${[...archivosValidos].join(', ')}.`);
    }
    problemas.push(...problemasDeLegibilidad(pieza.formato, diapositiva));
    problemas.push(...problemasDeCamara(diapositiva));
  }

  const textos = [...plan.diapositivas.flatMap((diapositiva) => diapositiva.textos), plan.pie].map((texto) =>
    quitarCifrasPermitidas(texto, pieza.numDiapositivas),
  );
  const conCifras = cifrasNoAutorizadas(textos, fuentesDeCifras(pieza));
  if (conCifras.length > 0) {
    problemas.push(`Hay cifras que el dueño no ha dado (quítalas): ${conCifras.map((t) => `«${t.slice(0, 80)}»`).join(', ')}.`);
  }
  return problemas;
}

/**
 * Lo que menos ha gustado es repetir el ángulo de la foto real (R6). Cada prompt tiene que
 * describir la toma original y pedir otra posición de cámara.
 */
export function problemasDeCamara(diapositiva: DiapositivaPlan): string[] {
  const prompt = diapositiva.prompt.toLowerCase();
  if (prompt.includes('camera:') && prompt.includes('not as a layout to copy')) return [];
  return [
    `El prompt de la diapositiva ${diapositiva.posicion} no tiene el bloque CAMERA completo: describe cómo está hecha Image 1, ` +
      'escribe «Use Image 1 only as the list of elements, not as a layout to copy» y pide una posición de cámara claramente distinta.',
  ];
}

/** Poco texto, un titular corto y cada texto escrito tal cual en el prompt (si no, el generador inventa). */
function problemasDeLegibilidad(formato: Formato, diapositiva: DiapositivaPlan): string[] {
  const problemas: string[] = [];
  const n = diapositiva.posicion;
  const palabras = diapositiva.textos.reduce((total, texto) => total + contarPalabras(texto), 0);
  const maximo = MAX_PALABRAS_POR_DIAPOSITIVA[formato];

  if (palabras > maximo) {
    problemas.push(`La diapositiva ${n} lleva ${palabras} palabras en la imagen; el máximo es ${maximo}. Lo largo va en el pie.`);
  }
  if (diapositiva.titular !== undefined) {
    if (!diapositiva.textos.includes(diapositiva.titular)) {
      problemas.push(`El titular de la diapositiva ${n} tiene que ser uno de sus "textos", escrito igual.`);
    }
    if (contarPalabras(diapositiva.titular) > MAX_PALABRAS_TITULAR) {
      problemas.push(`El titular de la diapositiva ${n} tiene más de ${MAX_PALABRAS_TITULAR} palabras: acórtalo.`);
    }
  }
  const ausentes = textosAusentesDelPrompt(diapositiva.prompt, diapositiva.textos);
  if (ausentes.length > 0) {
    problemas.push(`El prompt de la diapositiva ${n} no escribe literalmente estos textos: ${ausentes.map((t) => `«${t}»`).join(', ')}.`);
  }
  return problemas;
}

function textosAusentesDelPrompt(prompt: string, textos: string[]): string[] {
  const normalizado = normalizarComillas(prompt).toLowerCase();
  return textos.filter((texto) => !normalizado.includes(normalizarComillas(texto).toLowerCase()));
}

/**
 * Lo que propone el director para un «Pedir cambio» pasa las mismas reglas que el plan:
 * parte de la imagen anterior, no mete más texto del que cabe, escribe cada texto tal cual
 * y no inventa cifras. Las cifras que escribe el dueño en su comentario cuentan como suyas.
 */
export function problemasDeCorreccion(pieza: Pieza, correccion: { prompt: string; textos: string[] }, comentario: string): string[] {
  const problemas: string[] = [];
  if (!correccion.prompt.trimStart().toLowerCase().startsWith('keep image 1 almost exactly')) {
    problemas.push('El prompt tiene que empezar por «Keep image 1 almost exactly.»: el cambio parte de la imagen anterior.');
  }
  const palabras = correccion.textos.reduce((total, texto) => total + contarPalabras(texto), 0);
  const maximo = MAX_PALABRAS_POR_DIAPOSITIVA[pieza.formato];
  if (palabras > maximo) problemas.push(`Con el cambio, la imagen lleva ${palabras} palabras; el máximo es ${maximo}. Lo largo va en el pie.`);

  const ausentes = textosAusentesDelPrompt(correccion.prompt, correccion.textos);
  if (ausentes.length > 0) problemas.push(`El prompt no escribe literalmente estos textos: ${ausentes.map((t) => `«${t}»`).join(', ')}.`);

  const textos = correccion.textos.map((texto) => quitarCifrasPermitidas(texto, pieza.numDiapositivas));
  const conCifras = cifrasNoAutorizadas(textos, [...fuentesDeCifras(pieza), comentario]);
  if (conCifras.length > 0) {
    problemas.push(`Hay cifras que el dueño no ha dado (quítalas): ${conCifras.map((t) => `«${t.slice(0, 80)}»`).join(', ')}.`);
  }
  return problemas;
}

/** Cuenta palabras con letras o números; los separadores sueltos (✦ · —) no cuentan. */
export function contarPalabras(texto: string): number {
  return texto.split(/\s+/).filter((palabra) => /[\p{L}\p{N}]/u.test(palabra)).length;
}

function normalizarComillas(texto: string): string {
  return texto.replace(/[“”«»"]/g, '"').replace(/[‘’´`]/g, "'").replace(/\s+/g, ' ');
}

/**
 * Cifras que no son datos inventados: el contador de un carrusel («2/5», «(02)»)
 * y las de un usuario de Instagram o una web («@bar2go», «bar2go.es»).
 */
export function quitarCifrasPermitidas(texto: string, totalDiapositivas: number): string {
  const sinContacto = texto.replace(/@\S+/g, ' ').replace(/\S+\.(?:com|es|net|org|eus|cat|gal|bar)\b\S*/gi, ' ');
  if (totalDiapositivas < 2) return sinContacto;
  return sinContacto
    .replace(/\b0?(\d)\s*\/\s*0?(\d)\b/g, (todo, n: string, total: string) =>
      Number(total) === totalDiapositivas && Number(n) >= 1 && Number(n) <= totalDiapositivas ? ' ' : todo,
    )
    .replace(/\(0?(\d)\)/g, (todo, n: string) => (Number(n) >= 1 && Number(n) <= totalDiapositivas ? ' ' : todo));
}

// ------------------------------------------------------------------ Generaciones

export function generacionesDe(pieza: Pieza, posicion: number): Generacion[] {
  return pieza.generaciones.filter((generacion) => generacion.diapositiva === posicion);
}

export function ultimaCompletada(pieza: Pieza, posicion: number): Generacion | undefined {
  return generacionesDe(pieza, posicion)
    .filter((generacion) => generacion.estado === 'COMPLETADA')
    .at(-1);
}

/** La versión que se exporta: la última que te gustó o, si no hay, la última completada. */
export function versionElegida(pieza: Pieza, posicion: number): Generacion | undefined {
  const completadas = generacionesDe(pieza, posicion).filter((generacion) => generacion.estado === 'COMPLETADA');
  return completadas.filter((generacion) => generacion.valoracion?.veredicto === 'GUSTA').at(-1) ?? completadas.at(-1);
}

export function siguienteVersion(pieza: Pieza, posicion: number): number {
  return Math.max(0, ...generacionesDe(pieza, posicion).map((generacion) => generacion.version)) + 1;
}

/** Los fallos del proveedor no gastan cambios. */
export function correccionesUsadas(pieza: Pieza, posicion: number): number {
  return generacionesDe(pieza, posicion).filter((generacion) => generacion.comentario && generacion.estado !== 'FALLIDA').length;
}

export function posicionesSinImagen(pieza: Pieza): number[] {
  const total = pieza.plan?.diapositivas.length ?? 0;
  return Array.from({ length: total }, (_, i) => i + 1).filter((posicion) => !ultimaCompletada(pieza, posicion));
}

/** Imágenes por la API de hoy. «Hoy» es el día en la zona horaria del estudio, no en UTC. */
export function imagenesPorApiDelDia(piezas: Pieza[], hoy: Date, zonaHoraria: string): number {
  const dia = diaEnZona(hoy, zonaHoraria);
  return piezas
    .flatMap((pieza) => pieza.generaciones)
    .filter((g) => g.origen === 'API' && g.estado !== 'FALLIDA' && diaEnZona(new Date(g.creadaEn), zonaHoraria) === dia).length;
}

/** Fecha AAAA-MM-DD de un instante en una zona horaria IANA (p. ej. Europe/Madrid). */
export function diaEnZona(instante: Date, zonaHoraria: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export function rutaGenerada(posicion: number, version: number, extension: string): string {
  return `generadas/d${posicion}_v${version}.${extension}`;
}

// ------------------------------------------------------------------ Nombres

export function slugificar(texto: string, maxPalabras = 6): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, maxPalabras)
    .join('-');
}

export function idDePieza(fecha: Date, idea: string): string {
  return `${fecha.toISOString().slice(0, 10)}-${slugificar(idea, 5) || 'pieza'}`;
}
