/**
 * Mapa de la foto (F3): lo que el director de diseño necesita saber de la foto para colocar cosas, medido por el código.
 *
 * Un modelo de lenguaje acierta al decidir QUÉ poner y falla al estimar DÓNDE hay sitio. Aquí se mide: en qué celdas de la
 * retícula está el plato, cuáles están tranquilas (poco detalle) y son claras u oscuras, y qué colores manda la foto.
 * Sale gratis (no gasta ni un token de visión) y es exacto. Las dos señales son las de los recortadores automáticos de
 * fotos: el detalle (bordes) y dónde está el sujeto (diseno/f3/INVESTIGACION.md §3.4).
 * Funciones puras: reciben los píxeles ya reducidos; quien abre la imagen es un adaptador.
 */
import { colorVivo, paletaDominante, temperaturaDe, type ColorDominante, type Temperatura } from './color.js';

export interface CeldasDeMapa {
  /** Columnas, de 1 a N, las dos incluidas. */
  col: [number, number];
  fila: [number, number];
}

export interface MapaDeFoto {
  columnas: number;
  filas: number;
  /** Por celda, fila a fila: fracción ocupada por el sujeto (0–1). Vacío si la foto no tiene máscara. */
  ocupacion: number[];
  /** Por celda: detalle (0 = liso, 1 = lo más cargado de la foto). */
  detalle: number[];
  /** Por celda: luz media (0 = negro, 1 = blanco). */
  luz: number[];
  /** Dónde está el sujeto y qué parte del lienzo ocupa. */
  sujeto?: CeldasDeMapa & { area: number };
  /** Zonas tranquilas y sin sujeto donde cabe un texto, de mayor a menor. `luz` dice qué tinta contrasta. */
  libres: Array<CeldasDeMapa & { luz: number }>;
  /** Colores dominantes de toda la foto y del sujeto. */
  paleta: ColorDominante[];
  delSujeto: ColorDominante[];
  /** El color más vivo del sujeto, si lo hay: el candidato a acento «sacado del plato». */
  vivo?: string;
  temperatura: Temperatura;
  luzMedia: number;
}

export interface EntradaDeMapa {
  /** Tamaño de la muestra: la foto tal como caerá en el lienzo, reducida. */
  ancho: number;
  alto: number;
  /** Ternas RGB, fila a fila. */
  rgb: Uint8Array;
  /** Máscara del sujeto al mismo tamaño (0–255), si la hay. */
  mascara?: Uint8Array;
  columnas?: number;
  filas?: number;
}

/** Una celda cuenta como del sujeto a partir de esta ocupación. */
export const OCUPACION_DE_SUJETO = 0.12;
/** Una celda está «tranquila» si su detalle no pasa de esta fracción del máximo de la foto. */
const DETALLE_TRANQUILO = 0.3;

export function construirMapa(e: EntradaDeMapa): MapaDeFoto {
  const columnas = e.columnas ?? 12;
  const filas = e.filas ?? 16;
  const { ancho, alto, rgb, mascara } = e;
  const gris = new Float32Array(ancho * alto);
  for (let i = 0; i < ancho * alto; i++) gris[i] = (0.2126 * rgb[i * 3]! + 0.7152 * rgb[i * 3 + 1]! + 0.0722 * rgb[i * 3 + 2]!) / 255;

  const n = columnas * filas;
  const sumaLuz = new Float64Array(n);
  const sumaDetalle = new Float64Array(n);
  const sumaSujeto = new Float64Array(n);
  const cuenta = new Float64Array(n);
  for (let y = 0; y < alto; y++) {
    const fila = Math.min(filas - 1, Math.floor((y / alto) * filas));
    for (let x = 0; x < ancho; x++) {
      const celda = fila * columnas + Math.min(columnas - 1, Math.floor((x / ancho) * columnas));
      const i = y * ancho + x;
      // Detalle: filtro de Laplace sobre la luz (lo que se aparta un píxel de sus cuatro vecinos).
      const arriba = gris[Math.max(0, y - 1) * ancho + x]!;
      const abajo = gris[Math.min(alto - 1, y + 1) * ancho + x]!;
      const izquierda = gris[y * ancho + Math.max(0, x - 1)]!;
      const derecha = gris[y * ancho + Math.min(ancho - 1, x + 1)]!;
      sumaDetalle[celda] = sumaDetalle[celda]! + Math.abs(4 * gris[i]! - arriba - abajo - izquierda - derecha);
      sumaLuz[celda] = sumaLuz[celda]! + gris[i]!;
      if (mascara) sumaSujeto[celda] = sumaSujeto[celda]! + mascara[i]! / 255;
      cuenta[celda] = cuenta[celda]! + 1;
    }
  }
  const media = (suma: Float64Array) => Array.from(suma, (v, i) => (cuenta[i]! > 0 ? v / cuenta[i]! : 0));
  const luz = media(sumaLuz).map(r3);
  const crudo = media(sumaDetalle);
  const maximo = Math.max(...crudo, 1e-6);
  const detalle = crudo.map((v) => r3(v / maximo));
  const ocupacion = mascara ? media(sumaSujeto).map(r3) : [];

  let sujeto: MapaDeFoto['sujeto'];
  if (mascara) {
    const ocupadas = ocupacion.map((v, i) => (v >= OCUPACION_DE_SUJETO ? i : -1)).filter((i) => i >= 0);
    if (ocupadas.length) {
      const cols = ocupadas.map((i) => (i % columnas) + 1);
      const fils = ocupadas.map((i) => Math.floor(i / columnas) + 1);
      sujeto = { col: [Math.min(...cols), Math.max(...cols)], fila: [Math.min(...fils), Math.max(...fils)], area: r3(ocupacion.reduce((s, v) => s + v, 0) / n) };
    }
  }

  // Celdas donde cabe un texto: sin sujeto y con poco detalle.
  const libre = Array.from({ length: n }, (_, i) => (ocupacion[i] ?? 0) < OCUPACION_DE_SUJETO && detalle[i]! <= DETALLE_TRANQUILO);
  const libres = rectangulosLibres(libre, columnas, filas, 3).map((r) => ({ ...r, luz: r3(mediaEn(luz, r, columnas)) }));

  const paleta = paletaDominante(rgb, 5);
  const delSujeto = mascara ? paletaDominante(rgb, 4, mascara) : [];
  const vivo = colorVivo(delSujeto.length ? delSujeto : paleta);
  const luzMedia = r3(gris.reduce((s, v) => s + v, 0) / gris.length);
  return {
    columnas,
    filas,
    ocupacion,
    detalle,
    luz,
    ...(sujeto ? { sujeto } : {}),
    libres,
    paleta,
    delSujeto,
    ...(vivo ? { vivo: vivo.hex } : {}),
    temperatura: temperaturaDe(paleta[0]?.hex ?? '#808080'),
    luzMedia,
  };
}

/**
 * Los rectángulos de celdas libres más grandes, sin que se pisen: se busca el mayor, se apartan sus celdas y se repite.
 * Solo cuentan los de dos celdas o más en cada lado (en una sola celda no cabe un texto).
 */
export function rectangulosLibres(libre: boolean[], columnas: number, filas: number, cuantos: number): CeldasDeMapa[] {
  const disponible = [...libre];
  const salida: CeldasDeMapa[] = [];
  while (salida.length < cuantos) {
    const mejor = mayorRectangulo(disponible, columnas, filas);
    if (!mejor || mejor.col[1] - mejor.col[0] < 1 || mejor.fila[1] - mejor.fila[0] < 1) break;
    salida.push(mejor);
    for (let f = mejor.fila[0]; f <= mejor.fila[1]; f++) for (let c = mejor.col[0]; c <= mejor.col[1]; c++) disponible[(f - 1) * columnas + (c - 1)] = false;
  }
  return salida;
}

/** El mayor rectángulo de celdas libres (el clásico del histograma: por cada fila, cuántas libres hay hacia arriba). */
function mayorRectangulo(libre: boolean[], columnas: number, filas: number): CeldasDeMapa | undefined {
  const alturas = new Array<number>(columnas).fill(0);
  let mejor: (CeldasDeMapa & { area: number }) | undefined;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) alturas[c] = libre[f * columnas + c] ? alturas[c]! + 1 : 0;
    for (let c0 = 0; c0 < columnas; c0++) {
      let alto = Infinity;
      for (let c1 = c0; c1 < columnas; c1++) {
        alto = Math.min(alto, alturas[c1]!);
        if (alto === 0) break;
        // Un bloque de texto es más ancho que alto: a igual área, gana el más apaisado.
        const area = alto * (c1 - c0 + 1) + (c1 - c0) * 0.01;
        if (!mejor || area > mejor.area) mejor = { col: [c0 + 1, c1 + 1], fila: [f - alto + 2, f + 1], area };
      }
    }
  }
  return mejor && { col: mejor.col, fila: mejor.fila };
}

function mediaEn(valores: number[], r: CeldasDeMapa, columnas: number): number {
  let suma = 0;
  let cuenta = 0;
  for (let f = r.fila[0]; f <= r.fila[1]; f++) {
    for (let c = r.col[0]; c <= r.col[1]; c++) {
      suma += valores[(f - 1) * columnas + (c - 1)]!;
      cuenta++;
    }
  }
  return cuenta ? suma / cuenta : 0;
}

/**
 * El mapa en texto, para dárselo al director en unas doscientas fichas en lugar de una imagen en alta.
 * Una letra por celda: «#» sujeto, «.» tranquila y oscura, «:» tranquila y clara, «x» cargada de detalle.
 */
export function mapaEnTexto(m: MapaDeFoto): string {
  const lineas: string[] = [];
  for (let f = 0; f < m.filas; f++) {
    let linea = '';
    for (let c = 0; c < m.columnas; c++) {
      const i = f * m.columnas + c;
      if ((m.ocupacion[i] ?? 0) >= OCUPACION_DE_SUJETO) linea += '#';
      else if (m.detalle[i]! > DETALLE_TRANQUILO) linea += 'x';
      else linea += m.luz[i]! >= 0.5 ? ':' : '.';
    }
    lineas.push(`${String(f + 1).padStart(2)} ${linea}`);
  }
  const celdas = (r: CeldasDeMapa) => `col ${r.col[0]}–${r.col[1]}, fila ${r.fila[0]}–${r.fila[1]}`;
  const partes = [
    `Mapa de la foto a sangre (${m.columnas} columnas × ${m.filas} filas; # plato · «.» zona tranquila oscura · «:» zona tranquila clara · x zona con detalle):`,
    ...lineas,
    m.sujeto ? `Plato: ${celdas(m.sujeto)}; ocupa el ${Math.round(m.sujeto.area * 100)} % del lienzo.` : 'La foto no tiene máscara: no se sabe dónde está el plato, y no se puede recortar ni poner nada detrás de él.',
    m.libres.length ? `Zonas libres para texto: ${m.libres.map((r) => `${celdas(r)} (${r.luz >= 0.5 ? 'clara: tinta oscura' : 'oscura: tinta clara'})`).join(' · ')}.` : 'No hay ninguna zona tranquila grande: el texto necesita un velo o ir sobre un bloque de color.',
    `Luz media ${m.luzMedia.toFixed(2)} (${m.luzMedia < 0.3 ? 'foto oscura' : m.luzMedia > 0.6 ? 'foto clara' : 'foto de tono medio'}); temperatura ${m.temperatura.toLowerCase()}.`,
    `Colores de la foto: ${m.paleta.slice(0, 4).map((c) => `${c.hex} (${Math.round(c.peso * 100)} %)`).join(', ')}.`,
    ...(m.delSujeto.length ? [`Colores del plato: ${m.delSujeto.slice(0, 3).map((c) => `${c.hex} (${Math.round(c.peso * 100)} %)`).join(', ')}.`] : []),
  ];
  return partes.join('\n');
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
