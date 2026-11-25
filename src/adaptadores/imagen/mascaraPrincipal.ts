/**
 * La máscara de Apple Vision junta todas las instancias que detecta (mascara.swift): en una foto con un segundo plato
 * cortado por el borde, el recorte se lleva también ese trozo («un trozo duplicado encima», crítica del estudio de arte
 * del 21/11 sobre el pulpo de Torre de Vega). Aquí se quitan los componentes que tocan el borde de la foto y no son el
 * mayor; las piezas sueltas de un conjunto (las tazas junto a la bandeja de churros) se quedan.
 *
 * Determinista y sin IA: se etiquetan los componentes en una versión reducida de la máscara, se elige el mayor y la
 * máscara original (a su resolución) se multiplica por ese componente ampliado y un poco dilatado (los bordes finos no
 * se pierden).
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { Activo } from '../../dominio/activos.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';

export interface MascaraLimpia {
  /** PNG en escala de grises del tamaño de la imagen. */
  mascara: Buffer;
  bbox: { x: number; y: number; w: number; h: number };
  /** Fracción de la máscara original que se ha quitado. */
  quitado: number;
}

const LADO = 640;
/** Erosión antes de etiquetar (en px de la versión reducida): rompe los puentes finos entre dos instancias. */
const EROSION = 4;
/** Una fila es «cintura» si su ancho es menos de esta fracción del de las zonas anchas de encima y de debajo. */
const CINTURA = 0.6;

export async function mascaraPrincipal(rutaMascara: string, ancho: number, alto: number): Promise<MascaraLimpia | undefined> {
  const escala = Math.min(1, LADO / Math.max(ancho, alto));
  const w = Math.max(8, Math.round(ancho * escala));
  const h = Math.max(8, Math.round(alto * escala));
  const reducida = await sharp(rutaMascara).resize(w, h, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  // Erosión cuadrada: un píxel queda si todo su entorno de EROSION px es sujeto.
  const pequena = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dentro = reducida[y * w + x]! >= 128;
      for (let dy = -EROSION; dentro && dy <= EROSION; dy++) {
        for (let dx = -EROSION; dx <= EROSION; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (reducida[ny * w + nx]! < 128) {
            dentro = false;
            break;
          }
        }
      }
      pequena[y * w + x] = dentro ? 255 : 0;
    }
  }
  const etiqueta = new Int32Array(w * h).fill(-1);
  const tamanos: number[] = [];
  /** Si el componente toca el borde de la foto (un objeto que el encuadre corta). */
  const tocaBorde: boolean[] = [];
  for (let i = 0; i < w * h; i++) {
    if (pequena[i]! < 128 || etiqueta[i] !== -1) continue;
    const n = tamanos.length;
    let cuenta = 0;
    let borde = false;
    const pila = [i];
    etiqueta[i] = n;
    while (pila.length) {
      const j = pila.pop()!;
      cuenta++;
      const x = j % w;
      const y = (j - x) / w;
      if (x <= EROSION + 1 || y <= EROSION + 1 || x >= w - EROSION - 2 || y >= h - EROSION - 2) borde = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (pequena[k]! >= 128 && etiqueta[k] === -1) {
          etiqueta[k] = n;
          pila.push(k);
        }
      }
    }
    tamanos.push(cuenta);
    tocaBorde.push(borde);
  }
  const total = tamanos.reduce((a, b) => a + b, 0);
  if (total === 0) return undefined;
  if (tamanos.length < 2) return cortarPorCintura(rutaMascara, reducida, w, h, ancho, alto);
  const mayor = tamanos.indexOf(Math.max(...tamanos));
  // Se quitan solo los componentes que tocan el borde (objetos que el encuadre corta), nunca las piezas sueltas de un
  // conjunto (las tazas junto a la bandeja de churros son parte del producto).
  const conservar = new Set(tamanos.map((_, k) => k).filter((k) => k === mayor || !tocaBorde[k]));
  const quitado = 1 - [...conservar].reduce((a, k) => a + tamanos[k]!, 0) / total;
  // Si los otros componentes son motas (menos del 1 %), no hay otra instancia separada: se busca una cintura.
  if (quitado < 0.01) return cortarPorCintura(rutaMascara, reducida, w, h, ancho, alto);
  // El componente elegido, dilatado lo erosionado y 2 px más, como máscara de la grande (los bordes los pone la original).
  const mapaConservado = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!conservar.has(etiqueta[i]!)) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -EROSION - 2; dy <= EROSION + 2; dy++) for (let dx = -EROSION - 2; dx <= EROSION + 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) mapaConservado[ny * w + nx] = 255;
    }
  }
  const grande = await sharp(mapaConservado, { raw: { width: w, height: h, channels: 1 } }).resize(ancho, alto, { fit: 'fill', kernel: 'nearest' }).extractChannel(0).raw().toBuffer();
  const original = await sharp(rutaMascara).resize(ancho, alto, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  const limpia = Buffer.alloc(ancho * alto);
  let x0 = ancho;
  let y0 = alto;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < ancho * alto; i++) {
    const v = grande[i]! ? original[i]! : 0;
    limpia[i] = v;
    if (v >= 128) {
      const x = i % ancho;
      const y = (i - x) / ancho;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) return undefined;
  return {
    mascara: await sharp(limpia, { raw: { width: ancho, height: alto, channels: 1 } }).png().toBuffer(),
    bbox: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    quitado: Math.round(quitado * 1000) / 1000,
  };
}

/**
 * Un solo componente, pero con «cintura»: una franja de filas donde el ancho cae por debajo del 60 % del de las zonas de
 * encima y de debajo, y la parte pequeña toca el borde de arriba o de abajo de la foto (otro plato que el encuadre
 * corta y que en la foto toca al principal). Se quita la parte pequeña si es menos del 35 % de la máscara.
 */
async function cortarPorCintura(rutaMascara: string, reducida: Buffer, w: number, h: number, ancho: number, alto: number): Promise<MascaraLimpia | undefined> {
  const anchoFila = Array.from({ length: h }, (_, y) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (reducida[y * w + x]! >= 128) n++;
    return n;
  });
  const total = anchoFila.reduce((a, b) => a + b, 0);
  let corte: { fila: number; arriba: boolean } | undefined;
  for (let y = 2; y < h - 2; y++) {
    const encima = Math.max(...anchoFila.slice(0, y));
    const debajo = Math.max(...anchoFila.slice(y + 1));
    if (anchoFila[y]! >= CINTURA * Math.min(encima, debajo)) continue;
    const areaEncima = anchoFila.slice(0, y).reduce((a, b) => a + b, 0);
    const pequenaArriba = areaEncima < total / 2;
    const parte = pequenaArriba ? areaEncima : total - areaEncima - anchoFila[y]!;
    const tocaBorde = pequenaArriba ? anchoFila[0]! > 0 : anchoFila[h - 1]! > 0;
    if (!tocaBorde || parte / total > 0.35 || parte / total < 0.01) continue;
    // La fila más estrecha de la cintura.
    if (!corte || anchoFila[y]! < anchoFila[corte.fila]!) corte = { fila: y, arriba: pequenaArriba };
  }
  if (!corte) return undefined;
  const filaGrande = Math.round(((corte.fila + 0.5) / h) * alto);
  const original = await sharp(rutaMascara).resize(ancho, alto, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  const limpia = Buffer.from(original);
  if (corte.arriba) limpia.fill(0, 0, filaGrande * ancho);
  else limpia.fill(0, filaGrande * ancho);
  let x0 = ancho;
  let y0 = alto;
  let x1 = -1;
  let y1 = -1;
  let antes = 0;
  let despues = 0;
  for (let i = 0; i < ancho * alto; i++) {
    if (original[i]! >= 128) antes++;
    if (limpia[i]! < 128) continue;
    despues++;
    const x = i % ancho;
    const y = (i - x) / ancho;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < x0 || y1 < y0 || !antes) return undefined;
  return {
    mascara: await sharp(limpia, { raw: { width: ancho, height: alto, channels: 1 } }).png().toBuffer(),
    bbox: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    quitado: Math.round((1 - despues / antes) * 1000) / 1000,
  };
}

/**
 * Si la máscara junta instancias (un segundo plato cortado por el borde), el estudio usa un activo derivado con solo
 * el componente principal: misma imagen, máscara limpia y su procedencia (operación determinista, sin IA).
 */
export async function fotoConMascaraPrincipal(activos: AlmacenActivos, local: string, foto: ActivoDisponible): Promise<ActivoDisponible> {
  if (!foto.rutaMascara || !foto.activo.mascara) return foto;
  const id = `${foto.activo.id}-principal`;
  if (await activos.existe(local, id)) return activos.obtener(local, id);
  const limpia = await mascaraPrincipal(foto.rutaMascara, foto.activo.ancho, foto.activo.alto);
  if (!limpia) return foto;
  const ahora = new Date().toISOString();
  await activos.crear(
    Activo.parse({
      ...foto.activo,
      id,
      descripcion: `${foto.activo.descripcion} · Máscara con solo el componente principal (se quitó el ${Math.round(limpia.quitado * 100)} % de la original: otra instancia cortada por el borde).`,
      mascara: { ...foto.activo.mascara, archivo: 'mascara.png', creadaEn: ahora, bbox: limpia.bbox, incluye: `${foto.activo.mascara.incluye} · solo el componente principal` },
      procedencia: { ...foto.activo.procedencia, derivacion: { operacion: 'mascara-principal', entradas: { foto: foto.activo.id }, parametros: { quitado: limpia.quitado } } },
    }),
    { [foto.activo.archivo]: await readFile(foto.ruta), 'mascara.png': limpia.mascara },
  );
  console.log(`  máscara principal: ${id} (se quita el ${Math.round(limpia.quitado * 100)} % de la máscara de ${foto.activo.id})`);
  return activos.obtener(local, id);
}
