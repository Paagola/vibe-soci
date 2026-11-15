/**
 * Medidas de oficio (F3): lo que se puede medir de una composición para saber si tiene jerarquía o es una plantilla.
 *
 * Las reglas de legibilidad (zona segura, tamaño mínimo, contraste) dicen si una pieza está MAL hecha; estas dicen si está
 * hecha sin intención. Salen de sistemas de diseño reales que las usan como puerta de calidad (diseno/f3/INVESTIGACION.md):
 * - salto de escala: el texto mayor es 5–12 veces el menor (sistemas editoriales de una y dos tintas); por debajo de 3,5
 *   todo pesa lo mismo y no hay foco («equal emphasis across all elements»);
 * - densidad: 30 palabras como mucho y tres niveles más la firma (las 29 referencias del usuario);
 * - voces: dos familias tipográficas y, como mucho, una tercera manuscrita que solo interrumpe;
 * - un solo gesto a mano por pieza: con varios se convierte en un collage de garabatos;
 * - el titular toca al producto (relación «cruza»), en vez de vivir en un bloque aparte encima de la foto.
 * Son AVISOS: un criterio se puede romper con una razón, y la razón se escribe en las notas de la intención.
 */
import type { CapaResuelta, Problema } from './resuelto.js';
import type { Lienzo, Rect } from './reticula.js';

export const SALTO_DE_ESCALA_MINIMO = 3.5;
const SALTO_MINIMO_EDITORIAL = SALTO_DE_ESCALA_MINIMO;
export const SALTO_DE_ESCALA_OBJETIVO = 5;
export const PALABRAS_MAXIMAS = 30;
export const NIVELES_MAXIMOS = 4;
export const VOCES_MAXIMAS = 3;
export const RECURSOS_MAXIMOS = 2;
const PALABRAS_MAXIMAS_EDITORIAL = PALABRAS_MAXIMAS;
const NIVELES_MAXIMOS_EDITORIAL = NIVELES_MAXIMOS;
const VOCES_MAXIMAS_EDITORIAL = VOCES_MAXIMAS;
const RECURSOS_MAXIMOS_EDITORIAL = RECURSOS_MAXIMOS;

export interface MedidasDeOficio {
  /** Altura de mayúscula del texto más grande dividida por la del más pequeño (1 si solo hay un texto). */
  saltoDeEscala: number;
  /** Palabras que se leen en la pieza (un patrón de palabra cuenta una vez). */
  palabras: number;
  /** Niveles de texto que el ojo separa por tamaño. */
  niveles: number;
  /** Familias tipográficas distintas. */
  voces: number;
  /** Familias de gesto a mano distintas (subrayado, círculo, flecha…). */
  gestos: number;
  /** Recursos gráficos: sellos y patrones. */
  recursos: number;
  /** Fracción del lienzo que queda sin texto, sujeto ni recursos (medida por cajas: es una aproximación). */
  aire: number;
  /** Fracción del lienzo que ocupa el sujeto recortado, si lo hay. */
  sujeto?: number;
  /** Todos los textos van centrados en el eje del lienzo (no es un fallo: es para saber si es a propósito). */
  todoCentrado: boolean;
}

export interface MedidoresDeTexto {
  /** Altura de las mayúsculas en px de un estilo a un cuerpo. */
  alturaMayusculas: (estilo: { fuente: string; ejes: Record<string, number> }, tamano: number) => number;
  /** Nombre de la familia de una fuente del catálogo. */
  familia: (fuente: string) => string;
}

const contarPalabras = (texto: string) => texto.split(/[\s·|/—–-]+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;

/** Niveles de tamaño: de mayor a menor, un nivel nuevo cada vez que el tamaño baja más de un 25 %. */
export function nivelesDeTamano(alturas: number[]): number {
  const orden = [...alturas].sort((a, b) => b - a);
  let niveles = 0;
  let referencia = Infinity;
  for (const altura of orden) {
    if (altura < referencia / 1.25) {
      niveles++;
      referencia = altura;
    }
  }
  return niveles;
}

export function medirOficio(capas: CapaResuelta[], lienzo: Lienzo, medir: MedidoresDeTexto): MedidasDeOficio {
  const alturas: number[] = [];
  const familias = new Set<string>();
  const gestos = new Set<string>();
  const cajas: Rect[] = [];
  let palabras = 0;
  let recursos = 0;
  let sujeto: number | undefined;
  let centrados = 0;
  let textos = 0;

  for (const capa of capas) {
    // Un recorte invisible sigue contando: es la silueta del sujeto de una foto a sangre, que sí se ve.
    if (capa.opacidad <= 0 && capa.tipo !== 'recorte') continue;
    switch (capa.tipo) {
      case 'texto': {
        for (const linea of capa.lineas) alturas.push(medir.alturaMayusculas(capa.estilo, linea.tamano));
        familias.add(medir.familia(capa.estilo.fuente));
        palabras += contarPalabras(capa.texto);
        cajas.push(capa.caja);
        textos++;
        if (Math.abs(capa.caja.x + capa.caja.w / 2 - lienzo.ancho / 2) < lienzo.ancho * 0.03) centrados++;
        break;
      }
      case 'circulo-texto':
        alturas.push(medir.alturaMayusculas(capa.estilo, capa.tamano));
        familias.add(medir.familia(capa.estilo.fuente));
        palabras += contarPalabras(capa.texto);
        cajas.push({ x: capa.centro.x - capa.radio, y: capa.centro.y - capa.radio, w: capa.radio * 2, h: capa.radio * 2 });
        break;
      case 'niveles':
        alturas.push(medir.alturaMayusculas(capa.estilo, capa.tamano));
        familias.add(medir.familia(capa.estilo.fuente));
        for (const linea of capa.lineas) palabras += contarPalabras(`${linea.izquierda ?? ''} ${linea.derecha ?? ''}`);
        break;
      case 'sello':
        recursos++;
        for (const linea of capa.lineas) {
          alturas.push(medir.alturaMayusculas(linea.estilo, linea.tamano));
          familias.add(medir.familia(linea.estilo.fuente));
          palabras += contarPalabras(linea.texto);
        }
        if (capa.anillo) palabras += contarPalabras(capa.anillo.texto);
        cajas.push(capa.caja);
        break;
      case 'patron':
        recursos++;
        if (capa.motivo === 'palabra' && capa.texto && capa.estilo && capa.tamano) {
          alturas.push(medir.alturaMayusculas(capa.estilo, capa.tamano));
          familias.add(medir.familia(capa.estilo.fuente));
          palabras += contarPalabras(capa.texto);
          cajas.push(capa.rect);
        }
        break;
      case 'trazo':
        gestos.add(capa.gesto);
        break;
      case 'recorte':
        sujeto = Math.max(sujeto ?? 0, areaDentro(capa.destino, lienzo) / (lienzo.ancho * lienzo.alto));
        cajas.push(capa.destino);
        break;
      default:
        break;
    }
  }

  const mayor = alturas.length ? Math.max(...alturas) : 0;
  const menor = alturas.length ? Math.min(...alturas) : 0;
  return {
    saltoDeEscala: redondear(menor > 0 ? mayor / menor : 1),
    palabras,
    niveles: nivelesDeTamano(alturas),
    voces: familias.size,
    gestos: gestos.size,
    recursos,
    aire: redondear(1 - areaCubierta(cajas, lienzo)),
    ...(sujeto !== undefined ? { sujeto: redondear(sujeto) } : {}),
    todoCentrado: textos >= 2 && centrados === textos,
  };
}

/** Los avisos que salen de las medidas. El de «cruza» lo pone el resolutor, que es quien mide el solape. */
/**
 * Los límites con los que se mide: los de la estética del encargo (dominio/diseno/estetica.ts, punto 10) o, sin ella,
 * los editoriales de siempre (las constantes de arriba).
 */
export interface LimitesMedibles {
  saltoMinimo: number;
  palabrasMaximas: number;
  nivelesMaximos: number;
  vocesMaximas: number;
  gestosMaximos: number;
  recursosMaximos: number;
}

export function problemasDeOficio(m: MedidasDeOficio, formato: 'FEED_3_4' | 'HISTORIA_9_16' = 'FEED_3_4', l?: LimitesMedibles): Problema[] {
  const SALTO_DE_ESCALA_MINIMO = l?.saltoMinimo ?? SALTO_MINIMO_EDITORIAL;
  const PALABRAS_MAXIMAS = l?.palabrasMaximas ?? PALABRAS_MAXIMAS_EDITORIAL;
  const NIVELES_MAXIMOS = l?.nivelesMaximos ?? NIVELES_MAXIMOS_EDITORIAL;
  const VOCES_MAXIMAS = l?.vocesMaximas ?? VOCES_MAXIMAS_EDITORIAL;
  const RECURSOS_MAXIMOS = l?.recursosMaximos ?? RECURSOS_MAXIMOS_EDITORIAL;
  const GESTOS_MAXIMOS = l?.gestosMaximos ?? 1;
  const problemas: Problema[] = [];
  const aviso = (tipo: Problema['tipo'], mensaje: string) => problemas.push({ gravedad: 'AVISO', tipo, mensaje });
  if (m.niveles >= 2 && m.saltoDeEscala < SALTO_DE_ESCALA_MINIMO) {
    aviso('JERARQUIA', `No hay salto de escala: el texto más grande es solo ${m.saltoDeEscala.toFixed(1)} veces el más pequeño. Con menos de ${SALTO_DE_ESCALA_MINIMO} todo pesa parecido; una pieza con foco anda entre ${SALTO_DE_ESCALA_OBJETIVO} y 12.`);
  }
  const maximo = formato === 'HISTORIA_9_16' ? Math.min(20, PALABRAS_MAXIMAS) : PALABRAS_MAXIMAS;
  if (m.palabras > maximo) aviso('DENSIDAD', `La pieza lleva ${m.palabras} palabras; el máximo es ${maximo}. Lo que sobra va al pie de la publicación.`);
  if (m.niveles > NIVELES_MAXIMOS) aviso('DENSIDAD', `Hay ${m.niveles} niveles de texto; con más de ${NIVELES_MAXIMOS} (titular, apoyo, dato y firma) el ojo no sabe por dónde empezar.`);
  if (m.voces > VOCES_MAXIMAS) aviso('VOCES', `Hay ${m.voces} familias tipográficas; el máximo son dos y, si acaso, una manuscrita que solo interrumpe.`);
  if (m.gestos > GESTOS_MAXIMOS) aviso('GESTOS', `Hay ${m.gestos} gestos a mano distintos; con esta estética caben ${GESTOS_MAXIMOS} (en editorial, uno solo interrumpe y varios decoran).`);
  if (m.recursos > RECURSOS_MAXIMOS) aviso('GESTOS', `Hay ${m.recursos} recursos gráficos (sellos y patrones); con más de ${RECURSOS_MAXIMOS} compiten entre sí y con el producto.`);
  return problemas;
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;

function areaDentro(r: Rect, lienzo: Lienzo): number {
  const w = Math.max(0, Math.min(r.x + r.w, lienzo.ancho) - Math.max(r.x, 0));
  const h = Math.max(0, Math.min(r.y + r.h, lienzo.alto) - Math.max(r.y, 0));
  return w * h;
}

/** Fracción del lienzo cubierta por la unión de unas cajas, medida sobre una rejilla de 20 px (rápido y suficiente). */
function areaCubierta(cajas: Rect[], lienzo: Lienzo): number {
  const paso = 20;
  const columnas = Math.ceil(lienzo.ancho / paso);
  const filas = Math.ceil(lienzo.alto / paso);
  const ocupada = new Uint8Array(columnas * filas);
  for (const r of cajas) {
    const c0 = Math.max(0, Math.floor(r.x / paso));
    const c1 = Math.min(columnas - 1, Math.floor((r.x + r.w - 0.001) / paso));
    const f0 = Math.max(0, Math.floor(r.y / paso));
    const f1 = Math.min(filas - 1, Math.floor((r.y + r.h - 0.001) / paso));
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) ocupada[f * columnas + c] = 1;
  }
  let suma = 0;
  for (const v of ocupada) suma += v;
  return suma / ocupada.length;
}
