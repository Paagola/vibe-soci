/**
 * Estudio de arte · de la RECETA (receta.ts) a la maqueta del dialecto de capas (propuesta.ts, CapaPropuesta), que
 * compilarIntencion convierte en la intención del compositor.
 *
 * El modelo decide qué (esqueleto, escala, relación, operaciones); aquí se decide dónde y cuánto, con la tensión
 * garantizada por construcción:
 * - «monumental» llena el ancho del lienzo; «grande» ocupa al menos dos tercios;
 * - «enorme» hace que el producto sangre por abajo y ocupe más de la mitad del alto;
 * - cada texto pequeño va en un hueco libre y su tinta se mide contra lo que pisa (color plano o foto);
 * - la firma va siempre en la voz de la marca.
 * Dominio puro: no pinta ni llama a nada.
 */
import { contraste, mezclar } from '../diseno/color.js';
import type { MapaDeFoto } from '../diseno/mapaDeFoto.js';
import {
  colocar, COLUMNAS, CUERPO_ANOTACION, CUERPO_PEQUENO, CUERPO_SEGUNDO, elegirTinta, extremos, MARGEN_DE_CONTRASTE, PASO_COLUMNA, PASO_FILA,
  type Caja, type Tinta, type VocesDeLaPieza,
} from '../diseno/mecanismos.js';
import type { CapaPropuesta, Composicion } from '../diseno/propuesta.js';
import type { Operacion, Receta } from './receta.js';

const FILAS = 16;
const PRIMERA = 2;
const ULTIMA = 15;
const MARGEN_PX = 72;

export interface EntornoArte {
  mapa: MapaDeFoto;
  tieneMascara: boolean;
  colores: Tinta[];
  /** Las voces que existen (de la marca y del estudio). */
  voces: string[];
  /** El mapa de la imagen de escena generada (papel «escena» en los activos de la intención), si la hay: los textos que
   * caen sobre ella miden su tinta contra ella. */
  escena?: MapaDeFoto;
  /**
   * Medidas reales de las voces (del motor tipográfico): ancho de un texto a un cuerpo, altura de mayúsculas e
   * interlineado (en múltiplos del cuerpo). Sin ellas, se estima con `anchoDeCaracter`.
   */
  medir?: { ancho(voz: string, texto: string, tamano: number): number; mayusculas(voz: string): number; interlineado(voz: string): number };
  /** Hay garabato generado (papel «garabato» en los activos de la intención). */
  garabato?: boolean;
  /** Qué elementos gráficos de la receta tienen ya su imagen (papel «elemento1», «elemento2»…). */
  elementos?: boolean[];
  /** Las voces que son de la marca (tokens): la firma va en una de ellas. */
  vocesDeMarca: string[];
  /** Las voces de la marca por papel: la firma y el apoyo salen de aquí si la receta no dice otra cosa. */
  marca: VocesDeLaPieza;
  /** Clave → texto. */
  textos: Record<string, string>;
  /** Color que lleva cada voz en su estilo (sin arroba). */
  colorDeVoz: Record<string, string>;
  anchoDeCaracter: Record<string, number>;
  /**
   * La caja de la silueta en la foto entera, el tamaño de la foto y, si se ha medido, la silueta dentro de su caja en
   * una rejilla (fracción de sujeto por celda): con ella se sabe qué celdas del lienzo pisa el producto de verdad.
   */
  silueta?: { x: number; y: number; w: number; h: number; anchoFoto: number; altoFoto: number; rejilla?: { columnas: number; filas: number; ocupacion: number[] } };
}

export interface RecetaCompilada {
  capas: CapaPropuesta[];
  /** Textos con saltos de línea puestos aquí (clave → texto). */
  textos: Record<string, string>;
  problemas: string[];
  notas: string[];
  /** Lo ocupado al final en la retícula 12 × 16 («#»), para depurar la colocación. */
  mesa?: string;
}

const acotar = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Rejilla propia del estudio: lo ocupado en el lienzo (no en la foto), para colocar los textos pequeños. */
class Mesa {
  private readonly usada = Array.from({ length: COLUMNAS * FILAS }, () => false);
  ocupar(c: Caja) {
    for (let f = c.fila[0]; f <= c.fila[1]; f++) for (let k = c.col[0]; k <= c.col[1]; k++) this.celda(k, f);
  }
  celda(k: number, f: number) {
    if (f >= 1 && f <= FILAS && k >= 1 && k <= COLUMNAS) this.usada[(f - 1) * COLUMNAS + (k - 1)] = true;
  }
  dibujo(): string {
    return Array.from({ length: FILAS }, (_, f) => `${String(f + 1).padStart(2)} ${Array.from({ length: COLUMNAS }, (_, k) => (this.usada[f * COLUMNAS + k] ? '#' : '.')).join('')}`).join('\n');
  }
  ocupada(k: number, f: number) {
    return this.usada[(f - 1) * COLUMNAS + (k - 1)] ?? true;
  }
  libre(c: Caja) {
    for (let f = c.fila[0]; f <= c.fila[1]; f++) for (let k = c.col[0]; k <= c.col[1]; k++) if (this.usada[(f - 1) * COLUMNAS + (k - 1)]) return false;
    return true;
  }
  hueco(w: number, h: number, cerca: { col: number; fila: number }, filas: [number, number] = [PRIMERA, ULTIMA], cols: [number, number] = [1, COLUMNAS], vale?: (c: Caja) => boolean): Caja | undefined {
    let mejor: { c: Caja; d: number } | undefined;
    for (let f0 = filas[0]; f0 + h - 1 <= filas[1]; f0++) {
      for (let c0 = cols[0]; c0 + w - 1 <= cols[1]; c0++) {
        const c: Caja = { col: [c0, c0 + w - 1], fila: [f0, f0 + h - 1] };
        if (!this.libre(c) || (vale && !vale(c))) continue;
        const d = Math.hypot(c0 + (w - 1) / 2 - cerca.col, f0 + (h - 1) / 2 - cerca.fila);
        if (!mejor || d < mejor.d) mejor = { c, d };
      }
    }
    return mejor?.c;
  }
}

/** ¿El segmento entre dos puntos (en celdas) atraviesa la caja? Se muestrea a pasos de un cuarto de celda. */
function segmentoCruzaCaja(a: { col: number; fila: number }, b: { col: number; fila: number }, c: Caja): boolean {
  const pasos = Math.ceil(Math.hypot(b.col - a.col, b.fila - a.fila) * 4) + 1;
  for (let i = 1; i < pasos; i++) {
    const t = i / pasos;
    const x = a.col + (b.col - a.col) * t;
    const y = a.fila + (b.fila - a.fila) * t;
    if (x >= c.col[0] - 0.4 && x <= c.col[1] + 0.4 && y >= c.fila[0] - 0.4 && y <= c.fila[1] + 0.4) return true;
  }
  return false;
}

/** Celdas que ocupa un rectángulo en px del lienzo 1080 × 1440. */
function celdasDe(x: number, y: number, w: number, h: number): Caja {
  const col = (px: number) => acotar(Math.floor((px - MARGEN_PX) / PASO_COLUMNA) + 1, 1, COLUMNAS);
  const fila = (px: number) => acotar(Math.floor((px - MARGEN_PX) / PASO_FILA) + 1, 1, FILAS);
  return { col: [col(x), col(x + w - 1)], fila: [fila(y), fila(y + h - 1)] };
}

/** Caja de celdas en px del lienzo. */
function pxDe(c: Caja) {
  return { x: MARGEN_PX + (c.col[0] - 1) * PASO_COLUMNA, y: MARGEN_PX + (c.fila[0] - 1) * PASO_FILA, w: (c.col[1] - c.col[0] + 1) * PASO_COLUMNA - 12, h: (c.fila[1] - c.fila[0] + 1) * PASO_FILA - 12 };
}

/**
 * Parte un texto en líneas equilibradas (como mucho `max`), para que «monumental» llene el ancho de verdad. Si el texto
 * tiene separadores (« · », « | », « – », comas), corta por ellos: «3 carnes · 3 bacon» no se parte en «3 carnes · 3».
 */
export function partirTitular(texto: string, max: number): string {
  if (texto.includes('\n')) return texto;
  const tramos = texto.trim().split(/\s+(?=[·|–—]\s)|(?<=,)\s+/);
  if (tramos.length > 1) return repartir(tramos, max, ' ');
  return repartir(texto.trim().split(/\s+/), max, ' ');
}

/** Qué parte de las mayúsculas de la última línea tapa el punto más alto del producto: así ninguna letra deja de leerse. */
const TAPADO = 0.4;

const VACIAS = new Set('a al de del el la las los lo y e o u con en por para sin un una su sus mi tu que'.split(' '));

function repartir(palabras: string[], max: number, union: string): string {
  const texto = palabras.join(union);
  if (palabras.length <= 1 || max <= 1) return texto;
  const n = Math.min(max, palabras.length);
  // Reparto que minimiza la línea más larga (en caracteres).
  let mejor: string[] = [texto];
  let peor = Infinity;
  const probar = (cortes: number[]) => {
    const lineas: string[] = [];
    let i = 0;
    for (const c of [...cortes, palabras.length]) {
      lineas.push(palabras.slice(i, c).join(' '));
      i = c;
    }
    // Una línea no termina en palabra vacía («PULPO A / LA GALLEGA»): se penaliza como si fuera más larga.
    const colgadas = lineas.slice(0, -1).filter((l) => VACIAS.has(l.split(' ').at(-1)!.toLowerCase())).length;
    const larga = Math.max(...lineas.map((l) => l.length)) + colgadas * 6;
    if (larga < peor) {
      peor = larga;
      mejor = lineas;
    }
  };
  const recorrer = (desde: number, quedan: number, cortes: number[]) => {
    if (quedan === 0) return probar(cortes);
    for (let c = desde + 1; c <= palabras.length - quedan; c++) recorrer(c, quedan - 1, [...cortes, c]);
  };
  recorrer(0, n - 1, []);
  // El salto de línea hace de separador: «· 3 bacon» empieza la línea sin el punto.
  return mejor.map((l) => l.replace(/^[·|–—]\s+/, '').replace(/\s+[·|–—]$/, '')).join('\n');
}

export function compilarReceta(r: Receta, e: EntornoArte): RecetaCompilada {
  const problemas: string[] = [];
  const notas: string[] = [];
  const textos: Record<string, string> = {};
  const porToken = new Map(e.colores.map((t) => [`@${t.token}`, t]));
  const tinta = (token: string | undefined): Tinta | undefined => (token ? porToken.get(token) : undefined);
  const { oscura, clara } = extremos(e.colores);
  const fondo = tinta(r.fondo) ?? oscura;
  if (!tinta(r.fondo)) problemas.push(`El color de fondo «${r.fondo}» no está en la lista.`);
  const acento = tinta(r.acento);
  const vozOk = (v: string, donde: string) => {
    if (!e.voces.includes(v)) problemas.push(`${donde}: la voz «${v}» no está en la lista (${e.voces.join(', ')}).`);
    return v;
  };
  const claveOk = (k: string, donde: string) => {
    if (!(k in e.textos)) problemas.push(`${donde}: no hay ningún texto con la clave «${k}».`);
    return k;
  };
  /** La tinta de un texto sobre un color plano: la preferida si contrasta; si no, la que más contrasta. */
  const sobre = (campo: Tinta, preferida: string | undefined, ratio: number): Tinta => {
    const pref = tinta(preferida) ?? e.colores.find((t) => t.token === preferida);
    if (pref && pref.token !== campo.token && contraste(pref.hex, campo.hex) >= ratio * MARGEN_DE_CONTRASTE) return pref;
    return [...e.colores].sort((a, b) => contraste(b.hex, campo.hex) - contraste(a.hex, campo.hex))[0]!;
  };
  const sujeto = e.tieneMascara ? e.mapa.sujeto : undefined;
  const conEscena = Boolean(e.escena) && r.operaciones.some((o) => o.tipo === 'ESCENA') && ['PRODUCTO_SOBRE_COLOR', 'CARTEL', 'COLUMNA', 'EDITORIAL'].includes(r.esqueleto);
  /** Sobre qué se mide la tinta de un texto: el campo liso o, con escena, la escena (como una foto). */
  const mapaTinta = conEscena && e.escena ? e.escena : e.mapa;
  const necesitaRecorte = ['PRODUCTO_SOBRE_COLOR', 'CARTEL', 'COLUMNA', 'MARCO', 'PATRON', 'EDITORIAL'].includes(r.esqueleto);
  if (necesitaRecorte && !sujeto) problemas.push(`El esqueleto ${r.esqueleto} recorta el producto: la foto no tiene máscara. Usa FOTO_A_SANGRE o PARTIDA.`);

  const t = r.titular;
  claveOk(t.texto, 'titular');
  vozOk(t.voz, 'titular');
  const firmaVoz = r.firma ? vozOk(r.firma.voz, 'firma') : e.marca.firma;
  const apoyoVoz = r.apoyo ? vozOk(r.apoyo.voz, 'apoyo') : e.marca.apoyo;
  if (r.firma && !e.vocesDeMarca.includes(r.firma.voz)) problemas.push(`La firma es un invariante de la marca: va en una de sus voces (${e.vocesDeMarca.join(', ')}), no en «${r.firma.voz}».`);

  // ------------------------------------------------------------------ FOTO_A_SANGRE: el mecanismo probado de F3
  if (r.esqueleto === 'FOTO_A_SANGRE') {
    const anot = r.operaciones.find((o): o is Extract<Operacion, { tipo: 'ANOTACIONES' }> => o.tipo === 'ANOTACIONES');
    const sello = r.operaciones.find((o): o is Extract<Operacion, { tipo: 'SELLO' }> => o.tipo === 'SELLO');
    const comp: Composicion = {
      mecanismo: anot ? 'ANOTACIONES' : r.acentoManuscrito ? 'TITULAR_CON_ACENTO' : 'TITULAR_DETRAS',
      titular: t.texto,
      ...(r.acentoManuscrito ? { acento: r.acentoManuscrito.texto } : {}),
      ...(r.apoyo ? { apoyo: r.apoyo.texto } : {}),
      ...(r.firma ? { firma: r.firma.texto } : {}),
      ...(r.lado === 'arriba' || r.lado === 'abajo' ? { lado: r.lado } : {}),
      sangra: t.escala === 'monumental',
      tinta: t.tinta,
      ...(sello ? { sello: { lineas: sello.lineas } } : {}),
      ...(anot ? { anotaciones: anot.notas.map((n) => ({ texto: n.texto, apunta: n.apunta })) } : {}),
    };
    const voces: VocesDeLaPieza = { titular: t.voz, apoyo: apoyoVoz, firma: firmaVoz, ...(r.acentoManuscrito ? { acento: r.acentoManuscrito.voz } : e.marca.acento ? { acento: e.marca.acento } : {}), ...(e.marca.anotacion ? { anotacion: e.marca.anotacion } : {}) };
    const col = colocar(comp, { mapa: e.mapa, tieneMascara: e.tieneMascara, colores: e.colores, voces, colorDeVoz: e.colorDeVoz, anchoDeCaracter: e.anchoDeCaracter, textos: e.textos });
    problemas.push(...col.problemas);
    notas.push(...col.notas);
    const capas = col.capas.map((c) => (c.tipo === 'texto' && c.id === 'titular' && t.color ? { ...c, color: t.color } : c));
    for (const o of r.operaciones) {
      if (o.tipo === 'TEXTURA') capas.push({ tipo: 'textura', recurso: 'grano', intensidad: 0.08 });
      if (o.tipo === 'GESTO') capas.push({ tipo: 'trazo', gesto: o.gesto, de: o.de === 'apoyo' && r.apoyo ? 'apoyo' : 'titular', color: o.color ?? `@${(acento ?? clara).token}` });
    }
    return { capas, textos: col.textos, problemas, notas };
  }

  // ------------------------------------------------------------------ Esqueletos sobre campo o foto partida
  const mesa = new Mesa();
  /** Las cajas de los textos pequeños y las anotaciones (el sello no puede pisarlas). */
  const pequenas: Caja[] = [];
  const capas: CapaPropuesta[] = [];
  const delante: CapaPropuesta[] = [];
  const s = e.silueta;
  const proporcion = s ? s.w / s.h : sujeto ? (sujeto.col[1] - sujeto.col[0] + 1) / (sujeto.fila[1] - sujeto.fila[0] + 1) : 1;
  const toca = s ? { arriba: s.y <= 2, abajo: s.y + s.h >= s.altoFoto - 2, izquierda: s.x <= 2, derecha: s.x + s.w >= s.anchoFoto - 2 } : { arriba: false, abajo: false, izquierda: false, derecha: false };
  // Cortado por los dos lados, el producto recortado tiene que sangrar por los lados para esconder los cortes: eso solo
  // cabe sobre un campo con el producto enorme; en un cartel, una columna o una página editorial taparía la letra.
  if (toca.izquierda && toca.derecha && ['CARTEL', 'COLUMNA', 'EDITORIAL', 'MARCO', 'PATRON'].includes(r.esqueleto)) {
    problemas.push(`La foto corta el producto por los dos lados: recortado en ${r.esqueleto} se verían los cortes o taparía el titular. Usa PRODUCTO_SOBRE_COLOR con el producto «enorme» (sangra por los lados), FOTO_A_SANGRE o PARTIDA.`);
  }
  if (necesitaRecorte && toca.arriba) notas.push('La foto corta el producto por arriba: recortado se verá el corte recto; se coloca de modo que ese canto quede fuera del lienzo si se puede.');

  /**
   * Las celdas del lienzo que pisa la silueta colocada en (x, y, w, h): con la rejilla de la máscara, las de verdad (los
   * hombros de una hamburguesa quedan libres); sin ella, todo su rectángulo. Se muestrean 3 × 3 puntos por celda.
   */
  const celdasDeSilueta = (x: number, y: number, w: number, h: number): Array<[number, number]> => {
    const rejilla = s?.rejilla;
    const celdas: Array<[number, number]> = [];
    for (let f = 1; f <= FILAS; f++) {
      for (let k = 1; k <= COLUMNAS; k++) {
        const c = pxDe({ col: [k, k], fila: [f, f] });
        let dentro = 0;
        for (const a of [0.1, 0.5, 0.9]) {
          for (const b of [0.1, 0.5, 0.9]) {
            const u = (c.x + a * (c.w + 12) - 6 - x) / w;
            const v = (c.y + b * (c.h + 12) - 6 - y) / h;
            if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
            if (!rejilla) dentro++;
            else if ((rejilla.ocupacion[Math.floor(v * rejilla.filas) * rejilla.columnas + Math.floor(u * rejilla.columnas)] ?? 0) > 0.35) dentro++;
          }
        }
        if (dentro > 0) celdas.push([k, f]);
      }
    }
    return celdas;
  };
  /** Fracción del alto de la silueta (desde arriba) donde la fila ya tiene al menos un 18 % de sujeto: el cuerpo. */
  const topeFirme = () => {
    const rj = s?.rejilla;
    if (!rj) return 0;
    for (let f = 0; f < rj.filas; f++) {
      let n = 0;
      for (let c = 0; c < rj.columnas; c++) n += rj.ocupacion[f * rj.columnas + c]! > 0.5 ? 1 : 0;
      if (n / rj.columnas >= 0.18) return f / rj.filas;
    }
    return 0;
  };
  /** Un producto recortado anclado en una caja: devuelve la capa y las celdas que ocupa (para no pisarlo). */
  const ponerProducto = (caja: Caja, altoObjetivo: number, alinear: 'abajo-centro' | 'abajo-izquierda' | 'abajo-derecha' | 'arriba-centro' | 'centro', sangra: number) => {
    let ancho = (altoObjetivo * 1440 * proporcion) / 1080;
    // Cortado por los lados en la foto: se agranda hasta que los cortes queden fuera del lienzo.
    if (toca.izquierda && toca.derecha) ancho = Math.max(ancho, 1.12);
    // Una caja que no ocupa todo el ancho limita el producto (más el margen del lado del canto): no invade lo de al lado.
    if (caja.col[0] > 1 || caja.col[1] < COLUMNAS) {
      const c0 = pxDe(caja);
      ancho = Math.min(ancho, (c0.w + (caja.col[0] === 1 ? MARGEN_PX : 0) + (caja.col[1] === COLUMNAS ? MARGEN_PX : 0)) / 1080);
    }
    ancho = r2(acotar(ancho, 0.3, 1.5));
    const pxW = ancho * 1080;
    const pxH = pxW / proporcion;
    const c = pxDe(caja);
    const x = alinear.endsWith('izquierda') ? c.x : alinear.endsWith('derecha') ? c.x + c.w - pxW : c.x + (c.w - pxW) / 2;
    const y = alinear.startsWith('abajo') ? c.y + c.h - pxH * (1 - sangra) : alinear === 'arriba-centro' ? c.y : c.y + (c.h - pxH) / 2;
    const ocupa = celdasDe(Math.max(0, x), Math.max(0, y), Math.min(1080, pxW), Math.min(1440, pxH));
    const celdas = celdasDeSilueta(x, y, pxW, pxH);
    const capa: CapaPropuesta = {
      tipo: 'plato', caja, ancho, alinear,
      ...(r.producto.giro ? { giro: r.producto.giro } : {}),
      ...(sangra ? { sangra: r2(sangra) } : {}),
      sombra: r.producto.sombra,
      ...(r.producto.filo ? { filo: r.producto.filo } : {}),
    };
    // La fila (fraccionaria) del canto de arriba y de abajo del producto en el lienzo. El de arriba es donde empieza el
    // CUERPO del producto (la primera franja de la silueta con masa), no la punta de una antena o de un tentáculo.
    const firme = topeFirme();
    return { capa, ocupa, celdas, arriba: (y + firme * pxH - MARGEN_PX) / PASO_FILA + 1, abajo: (y + pxH - MARGEN_PX) / PASO_FILA + 1 };
  };
  const altoDeEscala = { contenida: 0.36, grande: 0.52, enorme: 0.68 }[r.producto.escala];
  const sangraDeEscala = { contenida: 0, grande: 0.08, enorme: 0.16 }[r.producto.escala];
  const alinearProducto = (base: 'abajo' | 'arriba'): 'abajo-centro' | 'abajo-izquierda' | 'abajo-derecha' | 'arriba-centro' =>
    base === 'arriba' ? 'arriba-centro' : r.producto.lado === 'izquierda' ? 'abajo-izquierda' : r.producto.lado === 'derecha' ? 'abajo-derecha' : 'abajo-centro';

  const titularTexto = e.textos[t.texto] ?? '';
  const unaPalabra = !/\s/.test(titularTexto.trim());
  /** «ancho» solo si la caja tiene alto para las líneas a ese cuerpo (unas 2,6 filas por línea); si no, desborda. */
  const lineasDelTitular = () => (textos[t.texto] ?? titularTexto).split('\n').length;
  const cabeAlAncho = (caja: Caja) => caja.fila[1] - caja.fila[0] + 1 >= 2.6 * lineasDelTitular();
  const pTitular = (caja: Caja, extra: Partial<Extract<CapaPropuesta, { tipo: 'texto' }>>, campo: Tinta | 'foto') => {
    if (conEscena) campo = 'foto';
    const color = campo === 'foto'
      ? `@${elegirTinta(caja, mapaTinta, e.colores, 3, t.color?.slice(1) ?? e.colorDeVoz[t.voz]).tinta.token}`
      : `@${sobre(campo, t.color ?? `@${e.colorDeVoz[t.voz] ?? ''}`, 3).token}`;
    const capa: CapaPropuesta = {
      tipo: 'texto', id: 'titular', texto: t.texto, voz: t.voz, caja, ajuste: t.escala === 'monumental' && cabeAlAncho(caja) ? 'ancho' : 'caja', alinear: 'izquierda', vertical: 'centro', color,
      relacion: t.relacion, ...(t.tinta !== 'limpia' ? { tinta: t.tinta } : {}), ...(t.registro ? { registro: t.registro } : {}), ...(t.giro ? { giro: t.giro } : {}), ...extra,
    };
    // Con «detras», el compositor mueve el titular para que el producto tape entre el 20 y el 45 %: puede bajar una fila,
    // nunca subir por encima de su caja (pisaría la banda de la firma y el apoyo).
    if (capa.tipo === 'texto' && (capa.relacion === 'detras' || capa.relacion === 'contorno') && !capa.entre && !capa.rotacion) capa.entre = [caja.fila[0], Math.min(ULTIMA, caja.fila[1] + 1)];
    return capa;
  };
  /** Un texto pequeño en un hueco libre cerca de un punto. */
  const pequeno = (id: string, clave: string, voz: string, cerca: { col: number; fila: number }, campo: Tinta | 'foto', cuerpo = CUERPO_PEQUENO, preferida?: string, filas?: [number, number], cols?: [number, number]) => {
    claveOk(clave, id);
    const original = e.textos[clave] ?? '';
    // Se prueba en una línea, en dos y, si no cabe, al cuerpo pequeño: un texto de apoyo no se cae por no caber entero.
    const formas: Array<{ texto: string; cuerpo: number }> = [{ texto: original, cuerpo }];
    if (!original.includes('\n') && /\s/.test(original.trim())) formas.push({ texto: partirTitular(original, 2), cuerpo }, { texto: partirTitular(original, 3), cuerpo });
    if (cuerpo > CUERPO_PEQUENO) formas.push({ texto: original, cuerpo: CUERPO_PEQUENO }, ...(formas[1] ? [{ texto: formas[1].texto, cuerpo: CUERPO_PEQUENO }] : []));
    const intentos = [...(filas || cols ? formas.map((f) => ({ ...f, enBanda: true })) : []), ...formas.map((f) => ({ ...f, enBanda: false }))];
    for (const forma of intentos) {
      const lineas = forma.texto.split('\n');
      const largo = Math.max(...lineas.map((l) => l.length), 1);
      const px = (e.anchoDeCaracter[voz] ?? forma.cuerpo * 0.6) * (forma.cuerpo / CUERPO_PEQUENO);
      const anchoPx = e.medir ? Math.max(...lineas.map((l) => e.medir!.ancho(voz, l, forma.cuerpo))) : largo * px;
      const w = Math.ceil((anchoPx + 16) / PASO_COLUMNA);
      if (w > COLUMNAS) continue;
      const h = Math.max(1, Math.ceil((lineas.length * forma.cuerpo * 1.15) / PASO_FILA));
      const caja = forma.enBanda ? mesa.hueco(w, h, cerca, filas, cols) : mesa.hueco(w, h, cerca);
      if (!caja) continue;
      mesa.ocupar(caja);
      pequenas.push(caja);
      if (forma.texto !== original) textos[clave] = forma.texto;
      const color = campo === 'foto' || conEscena
        ? `@${elegirTinta(caja, mapaTinta, e.colores, 4.5, preferida?.slice(1) ?? e.colorDeVoz[voz]).tinta.token}`
        : `@${sobre(campo, preferida ?? `@${e.colorDeVoz[voz] ?? ''}`, 4.5).token}`;
      const izquierda = (caja.col[0] + caja.col[1]) / 2 <= 6.5;
      delante.push({ tipo: 'texto', id, texto: clave, voz, caja, ajuste: 'fijo', tamano: forma.cuerpo, alinear: izquierda ? 'izquierda' : 'derecha', vertical: 'centro', color, relacion: 'aparte' });
      return;
    }
    problemas.push(`No cabe «${original}» sin pisar el producto ni el titular: quítalo, acórtalo o baja la escala del producto.`);
  };

  let campoTexto = (conEscena ? 'foto' : fondo) as Tinta | 'foto';
  let titularCaja: Caja | undefined;
  let productoOcupa: Caja | undefined;
  let productoCeldas: Array<[number, number]> | undefined;
  const lado = r.lado;
  // La banda de los textos pequeños (firma y apoyo) se reserva ANTES de colocar titular y producto: así nunca se caen
  // por falta de sitio. Cada esqueleto dice dónde va (encima del titular, debajo del marco, dentro del bloque…).
  const filasDeBanda = (r.apoyo ? 2 : 0) + (r.firma ? 1 : 0) > 0 ? (r.apoyo ? 2 : 1) : 0;
  const bandas: Array<{ filas: [number, number]; cols: [number, number] }> = [];
  let ajusteMedido: 'ancho' | 'ancho-por-linea' | 'caja' | undefined;
  let firmaColocada = false;
  let apoyoColocado = false;
  const conProducto = (caja: Caja, alto: number, alinear: Parameters<typeof ponerProducto>[2], sangra: number) => {
    const prod = ponerProducto(caja, alto, alinear, sangra);
    productoOcupa = prod.ocupa;
    productoCeldas = prod.celdas;
    capas.push(prod.capa);
    return prod;
  };
  /**
   * El titular se ajusta al producto ya colocado: con «detras», su última línea queda con la mitad tapada por el canto
   * del producto; con «aparte», termina una fila antes. `filas` es el alto deseado; si no cabe entre `desde` y el
   * producto, se encoge.
   */
  /** Alto (caps de la primera línea a la base de la última) del titular al ancho de `cols`, y la altura de mayúsculas de su última línea. */
  const medidaTitular = (cols: [number, number], modo: 'ancho' | 'ancho-por-linea') => {
    if (!e.medir) return undefined;
    const W = pxDe({ col: cols, fila: [1, 1] }).w;
    const lineas = (textos[t.texto] ?? titularTexto).split('\n');
    const tam = lineas.map((l) => (W * 1000) / Math.max(1, e.medir!.ancho(t.voz, l, 1000)));
    const s = modo === 'ancho' ? tam.map(() => Math.min(...tam)) : tam;
    const cap = e.medir.mayusculas(t.voz);
    const il = e.medir.interlineado(t.voz);
    let alto = cap * s[0]!;
    for (let i = 1; i < s.length; i++) alto += (il - cap) * s[i - 1]! + cap * s[i]!;
    return { alto, capUltima: cap * s.at(-1)!, cuerpo: Math.min(...s) };
  };
  /**
   * Con medidas reales: la caja exacta del titular para que su última línea quede con la mitad de las mayúsculas tapada
   * por el canto del producto («detras») o una fila por encima («aparte»). Si no cabe entre `desde` y el producto, se
   * devuelve `caja` (el compositor encoge la letra hasta que quepa).
   */
  const titularMedido = (canto: number, desde: number, cols: [number, number], modo: 'ancho' | 'ancho-por-linea', detras: boolean): { fila: [number, number]; ajuste: 'ancho' | 'ancho-por-linea' | 'caja' } | undefined => {
    const m = medidaTitular(cols, modo);
    if (!m) return undefined;
    const yProducto = MARGEN_PX + (canto - 1) * PASO_FILA;
    const yBase = detras ? yProducto + TAPADO * m.capUltima : yProducto - 24;
    const fin = acotar(Math.round((yBase - MARGEN_PX + 12) / PASO_FILA), desde, ULTIMA);
    const necesarias = Math.ceil((m.alto + 12) / PASO_FILA);
    const inicio = fin - necesarias + 1;
    if (inicio >= desde) return { fila: [inicio, fin], ajuste: modo };
    // No cabe: el compositor encogerá la letra («caja»); la línea de base se recalcula con la letra encogida.
    const disponible = (fin - desde + 1) * PASO_FILA - 12;
    const k = Math.max(0.3, disponible / m.alto);
    const yBase2 = detras ? yProducto + TAPADO * m.capUltima * k : yProducto - 24;
    const fin2 = acotar(Math.round((yBase2 - MARGEN_PX + 12) / PASO_FILA), desde, ULTIMA);
    return { fila: [desde, Math.max(desde + 1, fin2)], ajuste: 'caja' };
  };
  const titularContraProducto = (canto: number, desde: number, filas: number, detras: boolean, abajo: boolean): [number, number] => {
    // «canto» es una posición fraccionaria: la fila f ocupa [f, f + 1). Una línea mide unas 2,3 filas al ancho.
    const porLinea = Math.min(2.3, filas / lineasDelTitular());
    if (!abajo) {
      const fin = Math.min(ULTIMA, detras ? Math.ceil(canto + porLinea * 0.5) - 1 : Math.floor(canto) - 1);
      return [Math.max(desde, fin - filas + 1), Math.max(desde, fin)];
    }
    const inicio = Math.max(PRIMERA, detras ? Math.floor(canto - porLinea * 0.5) : Math.ceil(canto) + 1);
    return [Math.min(inicio, desde), Math.min(desde, inicio + filas - 1)];
  };

  switch (r.esqueleto) {
    case 'PRODUCTO_SOBRE_COLOR': {
      capas.push({ tipo: 'fondo', color: `@${fondo.token}` });
      const abajo = lado === 'abajo';
      const filasTitulo = (t.escala === 'monumental' ? 6 : 4) - (filasDeBanda > 1 ? 1 : 0);
      const detras = t.relacion === 'detras' || t.relacion === 'contorno';
      const cols: [number, number] = [1, t.escala === 'grande' ? 9 : COLUMNAS];
      textos[t.texto] = partirTitular(titularTexto, t.escala === 'monumental' ? 2 : 3);
      if (abajo) {
        // El producto cuelga de arriba; el titular, debajo, con la banda al pie.
        const fin = ULTIMA - filasDeBanda;
        const prod = conProducto({ col: [1, COLUMNAS], fila: [1, Math.max(4, fin - filasTitulo)] }, altoDeEscala, 'arriba-centro', 0);
        titularCaja = { col: cols, fila: titularContraProducto(prod.abajo, fin, filasTitulo, detras, true) };
        if (filasDeBanda) bandas.push({ filas: [fin + 1, ULTIMA], cols: [1, COLUMNAS] });
      } else {
        const inicio = PRIMERA + filasDeBanda;
        if (filasDeBanda) bandas.push({ filas: [PRIMERA, inicio - 1], cols: [1, COLUMNAS] });
        const prod = conProducto({ col: [1, COLUMNAS], fila: [inicio + 2, FILAS] }, altoDeEscala, alinearProducto('abajo'), sangraDeEscala);
        const medido = t.escala === 'monumental' ? titularMedido(prod.arriba, inicio, cols, 'ancho', detras) : undefined;
        titularCaja = { col: cols, fila: medido?.fila ?? titularContraProducto(prod.arriba, inicio, filasTitulo, detras, false) };
        if (medido) ajusteMedido = medido.ajuste;
      }
      delante.unshift(pTitular(titularCaja, { vertical: abajo ? 'arriba' : 'abajo', ...(ajusteMedido ? { ajuste: ajusteMedido } : {}), ...(detras ? { entre: [titularCaja.fila[0], Math.min(ULTIMA, titularCaja.fila[1] + 1)] } : {}) }, fondo));
      break;
    }
    case 'CARTEL': {
      capas.push({ tipo: 'fondo', color: `@${fondo.token}` });
      const repeticion = r.operaciones.some((o) => o.tipo === 'REPETICION');
      // El titular ocupa casi todo el lienzo, en dos a cuatro líneas; el producto va delante, en el centro y abajo.
      const inicio = PRIMERA + filasDeBanda + (filasDeBanda ? 1 : 0);
      if (filasDeBanda) bandas.push({ filas: [PRIMERA, PRIMERA + filasDeBanda - 1], cols: [1, COLUMNAS] });
      textos[t.texto] = partirTitular(titularTexto, repeticion ? 2 : Math.min(4, Math.max(2, titularTexto.split(/\s+/).length)));
      // En el cartel manda la letra: primero el titular a todo el ancho desde arriba; el producto se dimensiona para
      // que su canto tape media línea de la última (y conserve al menos un tercio del alto del lienzo).
      const modo = textos[t.texto]!.includes('\n') ? 'ancho-por-linea' : 'ancho';
      const m = repeticion ? undefined : medidaTitular([1, COLUMNAS], modo);
      const sangra = Math.min(sangraDeEscala, 0.1);
      if (m) {
        const yTop = MARGEN_PX + (inicio - 1) * PASO_FILA;
        const yBaseMax = 1440 * 0.64 + TAPADO * m.capUltima;
        const k = Math.min(1, (yBaseMax - yTop) / m.alto);
        const yBase = yTop + m.alto * k;
        const fin = acotar(Math.ceil((yBase - MARGEN_PX + 12) / PASO_FILA), inicio + 1, ULTIMA);
        titularCaja = { col: [1, COLUMNAS], fila: [inicio, fin] };
        ajusteMedido = k < 1 ? 'caja' : modo;
        const yProducto = yBase - TAPADO * m.capUltima * k;
        const fondoCaja = MARGEN_PX + FILAS * PASO_FILA - 12;
        // El cuerpo empieza `firme` por debajo del canto de la silueta: el producto se alarga eso hacia arriba.
        const firme = topeFirme();
        let altoProducto = (fondoCaja - yProducto) / (1 - sangra - firme) / 1440;
        // En el cartel manda la letra: el producto no pasa del ancho del lienzo.
        altoProducto = Math.min(altoProducto, (0.98 * 1080) / (1440 * proporcion));
        conProducto({ col: [1, COLUMNAS], fila: [Math.max(1, Math.floor((yProducto - MARGEN_PX) / PASO_FILA) + 1), FILAS] }, acotar(altoProducto, 0.3, 0.75), alinearProducto('abajo'), sangra);
      } else {
        const prod = conProducto({ col: [1, COLUMNAS], fila: [inicio + 3, FILAS] }, Math.min(altoDeEscala, 0.5), alinearProducto('abajo'), sangra);
        titularCaja = { col: [1, COLUMNAS], fila: titularContraProducto(prod.arriba, inicio, repeticion ? 4 : Math.max(4, Math.round(prod.arriba) - inicio + 2), true, false) };
        ajusteMedido = modo;
      }
      // En el cartel el producto tapa las letras: «aparte» no cabe (el titular llena el lienzo).
      delante.unshift(pTitular(titularCaja, { ajuste: ajusteMedido, alinear: 'centro', vertical: 'abajo', relacion: t.relacion === 'aparte' ? 'detras' : t.relacion }, fondo));
      break;
    }
    case 'COLUMNA': {
      capas.push({ tipo: 'fondo', color: `@${fondo.token}` });
      const izq = lado !== 'derecha';
      // La palabra vertical sangra por arriba y por abajo; la columna mide 3 o 4 columnas según lo largo que sea.
      // Con medidas: la palabra girada llena el alto (sangrando un poco); la columna mide lo que miden sus mayúsculas a
      // ese cuerpo. Sin medidas, 3 o 4 columnas según lo larga que sea.
      let anchoCol = titularTexto.length > 10 ? 3 : 4;
      if (e.medir) {
        const largo = e.medir.ancho(t.voz, titularTexto.replace(/\s+/g, ' '), 1000);
        const cuerpo = ((ULTIMA - PRIMERA + 1) * PASO_FILA * 1000) / Math.max(1, largo);
        anchoCol = acotar(Math.ceil((e.medir.mayusculas(t.voz) * cuerpo + 24) / PASO_COLUMNA), 2, 5);
      }
      // En la zona segura (filas 2–15): sangrar por arriba y por abajo perdía letras enteras («ESAYUN»).
      titularCaja = izq ? { col: [1, anchoCol], fila: [PRIMERA, ULTIMA] } : { col: [COLUMNAS - anchoCol + 1, COLUMNAS], fila: [PRIMERA, ULTIMA] };
      const resto: [number, number] = izq ? [anchoCol + 1, COLUMNAS] : [1, COLUMNAS - anchoCol];
      if (filasDeBanda) bandas.push({ filas: [PRIMERA, PRIMERA + filasDeBanda - 1], cols: resto });
      textos[t.texto] = titularTexto.replace(/\s+/g, ' ');
      delante.unshift(pTitular(titularCaja, { ajuste: 'caja', rotacion: izq ? 'sube' : 'baja', alinear: 'centro', relacion: t.relacion }, fondo));
      conProducto(
        // Con «aparte», el producto no entra en la columna; con «detras» o «delante», la pisa una columna.
        (() => {
          const pisa = t.relacion === 'aparte' ? 1 : 0;
          return izq ? { col: [anchoCol + pisa, COLUMNAS] as [number, number], fila: [PRIMERA + filasDeBanda + 1, FILAS] as [number, number] } : { col: [1, COLUMNAS - anchoCol + 1 - pisa] as [number, number], fila: [PRIMERA + filasDeBanda + 1, FILAS] as [number, number] };
        })(),
        altoDeEscala,
        izq ? 'abajo-derecha' : 'abajo-izquierda',
        sangraDeEscala,
      );
      break;
    }
    case 'PARTIDA': {
      // La foto a sangre y un bloque de campo sobre un lado; el producto (su silueta) queda por delante del bloque.
      capas.push({ tipo: 'fondo', color: `@${fondo.token}` }, { tipo: 'foto', encuadre: 'sangre' });
      // El bloque necesita aire: en vertical, tres columnas libres del producto en su lado; si no, se prueba el otro
      // lado y después en horizontal, donde haya más filas libres.
      const libresIzq = sujeto ? sujeto.col[0] - 1 : 6;
      const libresDer = sujeto ? COLUMNAS - sujeto.col[1] : 6;
      const libresArriba = sujeto ? sujeto.fila[0] - 1 : 6;
      const libresAbajo = sujeto ? FILAS - sujeto.fila[1] : 6;
      let ladoPartida = lado ?? (libresIzq >= libresDer ? 'izquierda' : 'derecha');
      const libresDe = (l: string) => (l === 'izquierda' ? libresIzq : l === 'derecha' ? libresDer : l === 'arriba' ? libresArriba : libresAbajo);
      if (libresDe(ladoPartida) < 3) {
        const alternativas = (['izquierda', 'derecha', 'arriba', 'abajo'] as const).filter((l) => libresDe(l) >= 3).sort((a, b) => libresDe(b) - libresDe(a));
        if (alternativas[0]) {
          notas.push(`PARTIDA: el lado «${ladoPartida}» no tiene aire (el producto llega casi al borde); el bloque va ${alternativas[0] === 'arriba' || alternativas[0] === 'abajo' ? '' : 'a la '}${alternativas[0]}.`);
          ladoPartida = alternativas[0];
        } else problemas.push('PARTIDA: el producto llena la foto y no deja aire en ningún lado para el bloque de texto; usa PRODUCTO_SOBRE_COLOR, CARTEL o FOTO_A_SANGRE.');
      }
      const vertical = ladoPartida === 'izquierda' || ladoPartida === 'derecha';
      const izq = ladoPartida !== 'derecha';
      let bloque: Caja;
      if (vertical) {
        // El bloque llega hasta el borde del producto (lo cruza una columna) y mide de 4 a 6 columnas.
        const borde = sujeto ? (izq ? sujeto.col[0] : COLUMNAS - sujeto.col[1] + 1) : 5;
        const w = acotar(borde, 4, 6);
        bloque = izq ? { col: [1, w], fila: [1, FILAS] } : { col: [COLUMNAS - w + 1, COLUMNAS], fila: [1, FILAS] };
      } else {
        const arriba = ladoPartida === 'arriba';
        const borde = sujeto ? (arriba ? sujeto.fila[0] : FILAS - sujeto.fila[1] + 1) : 6;
        // El bloque se mete dos filas en el producto: el producto lo cruza por delante.
        const h = acotar(borde + 2, 5 + Math.min(filasDeBanda, 1), 8);
        bloque = arriba ? { col: [1, COLUMNAS], fila: [1, h] } : { col: [1, COLUMNAS], fila: [FILAS - h + 1, FILAS] };
      }
      capas.push({ tipo: 'forma', figura: 'bloque', caja: bloque, color: `@${fondo.token}`, sangra: true, plano: 'fondo' });
      if (sujeto) {
        productoOcupa = { col: sujeto.col as [number, number], fila: sujeto.fila as [number, number] };
        productoCeldas = [];
        for (let f = 1; f <= FILAS; f++) for (let k = 1; k <= COLUMNAS; k++) if ((e.mapa.ocupacion[(f - 1) * e.mapa.columnas + (k - 1)] ?? 0) >= 0.15) productoCeldas.push([k, f]);
      }
      // Todo lo de fuera del bloque es foto: se ocupa para que los textos vayan en el bloque.
      for (let f = 1; f <= FILAS; f++) for (let k = 1; k <= COLUMNAS; k++) {
        const dentro = k >= bloque.col[0] && k <= bloque.col[1] && f >= bloque.fila[0] && f <= bloque.fila[1];
        if (!dentro) mesa.celda(k, f);
      }
      const cols: [number, number] = [bloque.col[0], bloque.col[1] === COLUMNAS ? COLUMNAS : bloque.col[1] - 1];
      // Las filas del bloque que el producto no pisa en esas columnas: ahí van el titular y la banda.
      const pisada = (f: number, c: [number, number]) => (productoCeldas ?? []).some(([k, ff]) => ff === f && k >= c[0] && k <= c[1]);
      if (vertical) {
        titularCaja = { col: cols, fila: [PRIMERA + 1, PRIMERA + 6] };
        if (filasDeBanda) bandas.push({ filas: [ULTIMA - 3, ULTIMA], cols });
      } else {
        const filas: number[] = [];
        for (let f = Math.max(PRIMERA, bloque.fila[0]); f <= Math.min(ULTIMA, bloque.fila[1]); f++) if (!pisada(f, [1, COLUMNAS])) filas.push(f);
        // El tramo libre más largo junto al borde del lienzo.
        const tramo = ladoPartida === 'arriba' ? filas.filter((f, i) => f === filas[0]! + i) : filas.filter((f, i) => f === filas.at(-1)! - (filas.length - 1 - i));
        const desde = tramo[0] ?? bloque.fila[0];
        const hasta = tramo.at(-1) ?? bloque.fila[1];
        if (hasta - desde + 1 < 2 + filasDeBanda) problemas.push('PARTIDA: el producto deja muy poco bloque libre para el titular; prueba el producto «contenida» o el bloque en el otro lado.');
        if (ladoPartida === 'arriba') {
          titularCaja = { col: [1, COLUMNAS], fila: [desde, Math.max(desde, hasta - filasDeBanda)] };
          if (filasDeBanda) bandas.push({ filas: [titularCaja.fila[1] + 1, hasta], cols: [1, COLUMNAS] });
        } else {
          titularCaja = { col: [1, COLUMNAS], fila: [desde, Math.max(desde, hasta - filasDeBanda)] };
          if (filasDeBanda) bandas.push({ filas: [titularCaja.fila[1] + 1, hasta], cols: [1, COLUMNAS] });
        }
      }
      textos[t.texto] = partirTitular(titularTexto, vertical ? 4 : 2);
      delante.unshift(pTitular(titularCaja, { relacion: t.relacion === 'detras' || t.relacion === 'contorno' ? t.relacion : 'aparte' }, fondo));
      break;
    }
    case 'MARCO': {
      capas.push({ tipo: 'fondo', color: `@${fondo.token}` });
      // La foto en un marco abajo; el producto sale del marco por arriba (sobreLaFoto) unas dos filas y se mete en la
      // última línea del titular. El encuadre (zoom y enfoque) se calcula para que eso pase de verdad: el producto ocupa
      // el 85 % del ancho del marco y su canto de arriba queda por encima del marco.
      const marco: Caja = { col: [2, COLUMNAS - 1], fila: [8, r.apoyo ? 14 : 15] };
      const m = pxDe(marco);
      let enfoque = { x: 0.5, y: 0.5 };
      let zoom = 1;
      let arribaProducto = marco.fila[0] - 2;
      if (s && sujeto) {
        const W = s.anchoFoto;
        const H = s.altoFoto;
        const cubre = Math.max(m.w / W, m.h / H);
        const escalaDeseada = (0.85 * m.w) / s.w;
        zoom = acotar(escalaDeseada / cubre, 1, 3);
        const e2 = cubre * zoom;
        const w = m.w / e2;
        const h = m.h / e2;
        const sale = { contenida: 0.6, grande: 1.6, enorme: 2.4 }[r.producto.escala] * PASO_FILA;
        const ox = acotar(s.x + s.w / 2 - w / 2, 0, W - w);
        const oy = acotar(s.y + sale / e2, 0, H - h);
        enfoque = { x: r2((ox + w / 2) / W), y: r2((oy + h / 2) / H) };
        const top = m.y + (s.y - oy) * e2;
        arribaProducto = (top - MARGEN_PX) / PASO_FILA + 1;
        productoCeldas = celdasDeSilueta(m.x + (s.x - ox) * e2, top, s.w * e2, s.h * e2).filter(([k, f]) => f < marco.fila[0] || f > marco.fila[1] || k < marco.col[0] || k > marco.col[1]);
        if (top >= m.y - 4) notas.push('MARCO: la foto no deja que el producto salga del marco (no hay foto por debajo del producto para bajarlo); queda dentro.');
      }
      capas.push({ tipo: 'foto', encuadre: 'marco', caja: marco, zoom: r2(zoom), enfoque });
      if (sujeto) capas.push({ tipo: 'plato', sobreLaFoto: true, sombra: r.producto.sombra, ...(r.producto.filo ? { filo: r.producto.filo } : {}) });
      mesa.ocupar(marco);
      productoOcupa = { col: marco.col, fila: [Math.max(1, Math.floor(arribaProducto)), marco.fila[1]] };
      if (r.firma) bandas.push({ filas: [PRIMERA, PRIMERA], cols: [1, COLUMNAS] });
      if (r.apoyo) bandas.push({ filas: [marco.fila[1] + 1, ULTIMA], cols: [1, COLUMNAS] });
      textos[t.texto] = partirTitular(titularTexto, 2);
      const desde = PRIMERA + (r.firma ? 1 : 0);
      const detras = t.relacion === 'detras' || t.relacion === 'contorno';
      const medido = titularMedido(arribaProducto, desde, [1, COLUMNAS], 'ancho', detras);
      titularCaja = { col: [1, COLUMNAS], fila: medido?.fila ?? titularContraProducto(arribaProducto, desde, Math.max(3, Math.floor(arribaProducto) - desde + 2), detras, false) };
      delante.unshift(pTitular(titularCaja, { vertical: 'abajo', ...(medido ? { ajuste: medido.ajuste } : {}), relacion: detras ? t.relacion : 'aparte' }, fondo));
      break;
    }
    case 'PATRON': {
      // F2: la palabra repetida, una por fila y ajustada al ancho (con el margen de la retícula), llena el lienzo; el
      // remate en la última fila; el producto girado delante; la marca arriba entre filetes; el apoyo abajo.
      capas.push({ tipo: 'fondo', color: `@${fondo.token}` });
      const palabra = titularTexto.replace(/\s*\n\s*/g, ' ').trim();
      // El patrón es textura y titular a la vez, con letra enorme: le basta un contraste de 2,5 (el de «texto grande»
      // con un poco de margen); con el rojo claro de una marca, así se conserva el color de la referencia.
      const preferido = tinta(t.color) ?? acento;
      const colorPatron = `@${(preferido && preferido.token !== fondo.token && contraste(preferido.hex, fondo.hex) >= 2.5 ? preferido : sobre(fondo, undefined, 3)).token}`;
      const inicio = PRIMERA + (r.firma ? 1 : 0);
      const fin = ULTIMA - (r.apoyo ? 1 : 0);
      const finPatron = r.remate ? fin - 1 : fin;
      const x0 = MARGEN_PX / 1080;
      const anchoPx = 1080 - 2 * MARGEN_PX;
      const yArriba = MARGEN_PX + (inicio - 1) * PASO_FILA;
      const altoDisponible = (finPatron - inicio + 1) * PASO_FILA - 12;
      // Con medidas: el cuerpo que hace que la palabra llene el ancho, y tantas filas como quepan a ese cuerpo.
      let filas = 6;
      let altoPatron = altoDisponible;
      let cuerpoPatron = 0;
      let avance = altoDisponible / 7;
      let anchoPalabra = anchoPx;
      // La variante «-patron» de la voz (mismo trazo, más interlineado) deja aire entre filas, como la referencia.
      const vozPatron = e.voces.includes(`${t.voz}-patron`) ? `${t.voz}-patron` : t.voz;
      const f4 = (v: number) => Math.round(v * 10000) / 10000;
      if (e.medir) {
        // El bloque (filas + remate) llena el alto: tantas filas como quepan al cuerpo que llena el ancho, redondeando
        // hacia arriba; si así no caben, la letra baja un poco (y la palabra queda centrada, con algo más de margen).
        const il = e.medir.interlineado(vozPatron);
        const cuerpoAncho = (anchoPx * 1000) / Math.max(1, e.medir.ancho(vozPatron, palabra, 1000));
        // Al menos 6 filas (5 de palabra y el remate): con menos, el patrón deja de serlo y el producto lo tapa entero.
        const total = acotar(Math.round(altoDisponible / (cuerpoAncho * il)), 6, 10);
        cuerpoPatron = Math.min(cuerpoAncho, altoDisponible / (total * il));
        avance = cuerpoPatron * il;
        filas = total - (r.remate ? 1 : 0);
        altoPatron = filas * avance;
        anchoPalabra = e.medir.ancho(vozPatron, palabra, cuerpoPatron);
      }
      const yPatron = yArriba + (altoDisponible - altoPatron - (r.remate ? avance : 0)) / 2;
      textos[t.texto] = palabra;
      capas.push({
        tipo: 'patron', motivo: 'palabra', texto: t.texto, voz: vozPatron, filas, color: colorPatron, plano: 'fondo',
        rect: { x: f4((1080 - anchoPalabra) / 2 / 1080), y: f4(yPatron / 1440), w: f4(anchoPalabra / 1080), h: f4(altoPatron / 1440) },
        ...(t.tinta !== 'limpia' ? { tinta: t.tinta } : {}),
      });
      titularCaja = { col: [1, COLUMNAS], fila: [inicio, finPatron] };
      // El producto, delante, centrado en las filas del patrón y girado: rompe el patrón pero deja leer la mitad de las
      // filas de arriba y de abajo (en la referencia, el bocadillo, ancho, tapa unas dos filas y media de siete).
      const filaDe = (y: number) => acotar(Math.floor((y - MARGEN_PX) / PASO_FILA) + 1, 1, FILAS);
      const filasPatron: [number, number] = [filaDe(yPatron), filaDe(yPatron + altoPatron - 1)];
      // El producto pesa como el de la referencia: el 72 % del alto del patrón (deja leer las filas de arriba y de abajo).
      conProducto({ col: [1, COLUMNAS], fila: filasPatron }, Math.min(Math.max(altoDeEscala, 0.5), (0.72 * altoPatron) / 1440), 'centro', 0);
      if (r.remate) {
        claveOk(r.remate.texto, 'remate');
        vozOk(r.remate.voz, 'remate');
        // El remate es la última fila del bloque, al mismo cuerpo y en el mismo color (como «OF THE MONTH»): se pinta
        // como una fila más del patrón, centrada y del ancho exacto de su texto. Si a ese cuerpo no cabe, va ajustado al
        // ancho como texto.
        const texto = e.textos[r.remate.texto] ?? '';
        const vozRemate = e.voces.includes(`${r.remate.voz}-patron`) ? `${r.remate.voz}-patron` : r.remate.voz;
        if (e.medir && cuerpoPatron > 0) {
          // Si a ese cuerpo no cabe, baja lo justo para caber en el ancho, centrado en su fila: sigue siendo del bloque.
          const cuerpo = Math.min(cuerpoPatron, (anchoPx * 1000) / Math.max(1, e.medir.ancho(vozRemate, texto, 1000)));
          const ancho = e.medir.ancho(vozRemate, texto, cuerpo);
          const alto = cuerpo * e.medir.interlineado(vozRemate);
          capas.push({
            tipo: 'patron', motivo: 'palabra', texto: r.remate.texto, voz: vozRemate, filas: 1, color: r.remate.color && tinta(r.remate.color) ? r.remate.color : colorPatron, plano: 'fondo',
            rect: { x: f4((1080 - ancho) / 2 / 1080), y: f4((yPatron + altoPatron + (avance - alto) / 2) / 1440), w: f4(ancho / 1080), h: f4(alto / 1440) },
          });
        } else {
          const fila = filaDe(yPatron + altoPatron + avance / 2);
          const pref = tinta(r.remate.color) ?? tinta(colorPatron);
          const color = `@${(pref && contraste(pref.hex, fondo.hex) >= 3 ? pref : sobre(fondo, undefined, 3)).token}`;
          delante.push({ tipo: 'texto', id: 'remate', texto: r.remate.texto, voz: r.remate.voz, caja: { col: [1, COLUMNAS], fila: [fila, fila] }, ajuste: 'ancho', alinear: 'centro', vertical: 'centro', color, relacion: 'aparte' });
        }
        mesa.ocupar({ col: [1, COLUMNAS], fila: [filaDe(yPatron + altoPatron), filaDe(yPatron + altoPatron + avance)] });
      }
      // El apoyo, centrado entre filetes en la fila de abajo (el sitio de «ORDER NOW!»).
      if (r.apoyo) {
        claveOk(r.apoyo.texto, 'apoyo');
        const tintaApoyo = `@${sobre(fondo, r.apoyo.color ?? colorPatron, 4.5).token}`;
        // Entre filetes si cabe en una línea; si no, partido por sus separadores, en dos líneas y sin filetes.
        const textoApoyo = e.textos[r.apoyo.texto] ?? '';
        const anchoCaja = pxDe({ col: [3, 10], fila: [ULTIMA, ULTIMA] }).w;
        const cabeEnUna = !e.medir || e.medir.ancho(apoyoVoz, textoApoyo, CUERPO_PEQUENO) <= anchoCaja;
        if (cabeEnUna) {
          delante.push({ tipo: 'texto', id: 'apoyo', texto: r.apoyo.texto, voz: apoyoVoz, caja: { col: [3, 10], fila: [ULTIMA, ULTIMA] }, ajuste: 'fijo', tamano: CUERPO_PEQUENO, alinear: 'centro', vertical: 'centro', color: tintaApoyo, relacion: 'aparte' });
          delante.push({ tipo: 'forma', figura: 'filete', caja: { col: [1, 2], fila: [ULTIMA, ULTIMA] }, color: tintaApoyo, plano: 'frente' }, { tipo: 'forma', figura: 'filete', caja: { col: [11, 12], fila: [ULTIMA, ULTIMA] }, color: tintaApoyo, plano: 'frente' });
        } else {
          textos[r.apoyo.texto] = partirTitular(textoApoyo, 2);
          delante.push({ tipo: 'texto', id: 'apoyo', texto: r.apoyo.texto, voz: apoyoVoz, caja: { col: [1, COLUMNAS], fila: [ULTIMA, ULTIMA] }, ajuste: 'fijo', tamano: CUERPO_PEQUENO, alinear: 'centro', vertical: 'centro', color: tintaApoyo, relacion: 'aparte' });
        }
        mesa.ocupar({ col: [1, COLUMNAS], fila: [ULTIMA, ULTIMA] });
        apoyoColocado = true;
      }
      // La marca entre filetes, centrada en la fila de arriba (el sitio de «BORCELLE BAKERY» en la referencia).
      if (r.firma) {
        const tinta = `@${sobre(fondo, r.firma.color ?? colorPatron, 4.5).token}`;
        delante.push({ tipo: 'texto', id: 'firma', texto: r.firma.texto, voz: firmaVoz, caja: { col: [4, 9], fila: [PRIMERA, PRIMERA] }, ajuste: 'fijo', tamano: CUERPO_PEQUENO, alinear: 'centro', vertical: 'centro', color: tinta, relacion: 'aparte' });
        delante.push({ tipo: 'forma', figura: 'filete', caja: { col: [2, 3], fila: [PRIMERA, PRIMERA] }, color: tinta, plano: 'frente' }, { tipo: 'forma', figura: 'filete', caja: { col: [10, 11], fila: [PRIMERA, PRIMERA] }, color: tinta, plano: 'frente' });
        mesa.ocupar({ col: [1, COLUMNAS], fila: [PRIMERA, PRIMERA] });
        firmaColocada = true;
      }
      break;
    }
    case 'EDITORIAL': {
      capas.push({ tipo: 'fondo', color: `@${fondo.token}` });
      // Producto contenido y desplazado a un lado, abajo; titular arriba a la izquierda, a dos tercios del ancho; los
      // textos pequeños debajo del titular y abajo, en el lado del aire.
      const derecha = r.producto.lado !== 'izquierda';
      conProducto(derecha ? { col: [5, COLUMNAS], fila: [7, FILAS] } : { col: [1, 8], fila: [7, FILAS] }, Math.min(altoDeEscala, 0.46), derecha ? 'abajo-derecha' : 'abajo-izquierda', 0.06);
      titularCaja = t.escala === 'monumental' ? { col: [1, COLUMNAS], fila: [PRIMERA + 1, PRIMERA + 4] } : { col: [1, 9], fila: [PRIMERA + 1, PRIMERA + 3] };
      bandas.push({ filas: [titularCaja.fila[1] + 1, titularCaja.fila[1] + 2], cols: derecha ? [1, 7] : [6, COLUMNAS] }, { filas: [ULTIMA - 1, ULTIMA], cols: derecha ? [1, 6] : [7, COLUMNAS] });
      textos[t.texto] = partirTitular(titularTexto, 2);
      delante.unshift(pTitular(titularCaja, { relacion: t.relacion === 'detras' ? 'detras' : 'aparte' }, fondo));
      break;
    }
  }
  if (titularCaja) mesa.ocupar(titularCaja);
  if (productoCeldas) for (const [k, f] of productoCeldas) mesa.celda(k, f);
  else if (productoOcupa) mesa.ocupar(productoOcupa);

  // Acento manuscrito: escalonado sobre el titular, en el otro color, por debajo de él (lo pisa como un logotipo).
  if (r.acentoManuscrito && titularCaja) {
    const a = r.acentoManuscrito;
    claveOk(a.texto, 'acento');
    vozOk(a.voz, 'acento');
    // Escalonado sobre el borde de arriba del titular (o el de abajo si arriba no hay sitio). Con el titular vertical
    // (COLUMNA), o si no queda dentro de la zona segura, va en el hueco libre más cercano a la cabeza del titular.
    // Encima del titular, en las dos filas libres más cercanas a su borde (con el giro, apenas lo toca); si arriba no hay
    // sitio, debajo. Solo si no queda ninguna, montado sobre su borde, que es lo que el crítico lee como un tachón.
    const ancho = 7;
    const colAcento: [number, number] = [Math.min(COLUMNAS - ancho + 1, titularCaja.col[0] + 3), Math.min(COLUMNAS, titularCaja.col[0] + 2 + ancho)];
    const arriba: Caja = { col: colAcento, fila: [titularCaja.fila[0] - 2, titularCaja.fila[0] - 1] };
    const abajo: Caja = { col: colAcento, fila: [titularCaja.fila[1] + 1, titularCaja.fila[1] + 2] };
    const dentro = (c: Caja) => c.fila[0] >= PRIMERA && c.fila[1] <= ULTIMA;
    const fila = titularCaja.fila[0] > PRIMERA ? titularCaja.fila[0] - 1 : titularCaja.fila[1] + 1;
    let caja: Caja | undefined = dentro(arriba) && mesa.libre(arriba) ? arriba : dentro(abajo) && mesa.libre(abajo) ? abajo : { col: colAcento, fila: [Math.max(PRIMERA, fila - 1), Math.min(ULTIMA, fila + 1)] };
    if (r.esqueleto === 'COLUMNA' || caja.fila[0] > caja.fila[1] || caja.fila[1] - caja.fila[0] < 1) {
      caja = mesa.hueco(6, 2, { col: titularCaja.col[1] + 3, fila: PRIMERA + 2 }) ?? mesa.hueco(4, 2, { col: titularCaja.col[1] + 2, fila: PRIMERA + 2 });
    }
    if (caja) {
      // El acento va en otro color que el titular: si coinciden, se leen como una mancha.
      const campo = campoTexto === 'foto' ? oscura : campoTexto;
      const delTitular = (delante.find((c) => c.tipo === 'texto' && c.id === 'titular') as { color?: string } | undefined)?.color;
      let elegido = sobre(campo, a.color ?? (acento ? `@${acento.token}` : undefined), 3);
      if (`@${elegido.token}` === delTitular) {
        const otro = [...e.colores].filter((x) => `@${x.token}` !== delTitular && x.token !== campo.token).sort((x, y) => contraste(y.hex, campo.hex) - contraste(x.hex, campo.hex))[0];
        if (otro && contraste(otro.hex, campo.hex) >= 3) elegido = otro;
      }
      const color = `@${elegido.token}`;
      delante.push({ tipo: 'texto', id: 'acento', texto: a.texto, voz: a.voz, caja, ajuste: 'caja', alinear: r.esqueleto === 'COLUMNA' ? 'izquierda' : 'derecha', vertical: 'centro', color, giro: -5, relacion: 'aparte', plano: 'fondo' });
      mesa.ocupar(caja);
      pequenas.push(caja);
    } else notas.push('Se quitó el acento manuscrito: no había sitio.');
  }
  // Primero el apoyo (más largo) en la banda; la firma, en lo que quede de la banda o en la siguiente, lejos del titular.
  const lejos = titularCaja && titularCaja.fila[0] <= 5 ? { col: 1, fila: ULTIMA } : { col: 1, fila: PRIMERA };
  const enBanda = (b: (typeof bandas)[number] | undefined, extremo: 'inicio' | 'fin') => (b ? { col: extremo === 'inicio' ? b.cols[0] : b.cols[1], fila: b.filas[0] } : lejos);
  // La firma (corta) primero, en un extremo de su banda; el apoyo, en lo que queda.
  if (r.firma && !firmaColocada) pequeno('firma', r.firma.texto, firmaVoz, enBanda(bandas[0], r.apoyo && bandas.length === 1 ? 'fin' : 'inicio'), campoTexto, CUERPO_PEQUENO, r.firma.color, bandas[0]?.filas, bandas[0]?.cols);
  if (r.apoyo && !apoyoColocado) pequeno('apoyo', r.apoyo.texto, apoyoVoz, enBanda(bandas.at(-1), 'inicio'), campoTexto, CUERPO_SEGUNDO, r.apoyo.color, bandas.at(-1)?.filas, bandas.at(-1)?.cols);

  // ------------------------------------------------------------------ Operaciones
  // Primero lo que va al fondo, después lo que señala y por último lo que se pega encima (el sello busca lo que quede).
  const ORDEN: Record<Operacion['tipo'], number> = { REPETICION: 0, TRAMA: 0, DIAGONAL: 0, FORMA_DETRAS: 0, ESCENA: 0.5, GARABATO: 0.6, ANOTACIONES: 1, FILETES: 2, GESTO: 2, SELLO: 3, TEXTURA: 4 };
  for (const o of [...r.operaciones].sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo])) {
    switch (o.tipo) {
      case 'REPETICION': {
        if (r.esqueleto === 'PATRON') {
          notas.push('REPETICION se ignora en PATRON: el esqueleto ya repite la palabra.');
          break;
        }
        claveOk(o.texto, 'repetición');
        vozOk(o.voz, 'repetición');
        // Fuera de PATRON la repetición es FONDO: una textura callada que no compite con el titular ni se come los textos
        // pequeños que van encima (Torre, lote-1: «@negro» sobre «@blanco», 21:1, con el apoyo y la firma ilegibles
        // sobre las palabras repetidas). Si su tinta contrasta más de 2:1 con el campo, se mezcla hacia el campo hasta
        // quedarse en ~1,45:1: el mismo color de la marca, en un tono de fondo.
        const pedida = (o.color ? tinta(o.color) : undefined) ?? acento ?? sobre(fondo, undefined, 1.6);
        let color = o.color ?? `@${pedida.token}`;
        if (contraste(pedida.hex, fondo.hex) > 2) {
          let [bajo, alto] = [0, 1];
          for (let k = 0; k < 20; k++) {
            const medio = (bajo + alto) / 2;
            if (contraste(mezclar(fondo.hex, pedida.hex, medio), fondo.hex) > 1.45) alto = medio;
            else bajo = medio;
          }
          color = mezclar(fondo.hex, pedida.hex, bajo).toUpperCase();
          notas.push(`La repetición va de fondo: «@${pedida.token}» contrastaba ${contraste(pedida.hex, fondo.hex).toFixed(1)}:1 con el campo y se calla a ${color} (1,45:1) para que el titular y los textos pequeños se lean encima.`);
        }
        capas.splice(1, 0, { tipo: 'patron', motivo: 'palabra', texto: o.texto, voz: o.voz, filas: o.filas, color, ...(o.contornoAlterno ? { contornoAlterno: true } : {}), plano: 'fondo', ...(r.esqueleto === 'CARTEL' ? { caja: { col: [1, COLUMNAS], fila: [6, FILAS] } } : {}) });
        break;
      }
      case 'ANOTACIONES': {
        const voz = e.marca.anotacion;
        if (!voz) {
          problemas.push('No hay voz para anotaciones.');
          break;
        }
        if (!productoOcupa) {
          problemas.push('Las anotaciones señalan el producto: hace falta el producto en la pieza.');
          break;
        }
        const sinSitio: string[] = [];
        let puestas = 0;
        for (const [i, n] of o.notas.entries()) {
          claveOk(n.texto, 'anotación');
          const objetivo = { col: productoOcupa.col[0] + n.apunta.x * (productoOcupa.col[1] - productoOcupa.col[0]), fila: productoOcupa.fila[0] + n.apunta.y * (productoOcupa.fila[1] - productoOcupa.fila[0]) };
          const largo = (e.textos[n.texto] ?? '').length;
          const anchoPx = e.medir ? e.medir.ancho(voz, e.textos[n.texto] ?? '', CUERPO_ANOTACION) : largo * (e.anchoDeCaracter[voz] ?? 26) * (CUERPO_ANOTACION / CUERPO_PEQUENO);
          const w = acotar(Math.ceil((anchoPx + 20) / PASO_COLUMNA), 2, 7);
          // Una anotación larga se prueba en dos líneas antes de rendirse.
          // La flecha va del rótulo al punto: no puede atravesar el titular ni otro texto (se leería como un tachón).
          const textosPuestos = [...(titularCaja ? [titularCaja] : []), ...pequenas];
          // Y el rótulo no toca el producto: una columna de aire a cada lado.
          const celdasProducto = new Set((productoCeldas ?? []).map(([k, f]) => `${k},${f}`));
          const conAire = (c: Caja) => {
            for (let f = c.fila[0]; f <= c.fila[1]; f++) for (let k = c.col[0] - 1; k <= c.col[1] + 1; k++) if (celdasProducto.has(`${k},${f}`)) return false;
            return true;
          };
          const flechaLimpia = (c: Caja) => {
            const desde = { col: (c.col[0] + c.col[1]) / 2, fila: (c.fila[0] + c.fila[1]) / 2 };
            return conAire(c) && !textosPuestos.some((t) => segmentoCruzaCaja(desde, objetivo, t));
          };
          const caja =
            mesa.hueco(w, largo > 14 ? 2 : 1, objetivo, undefined, undefined, flechaLimpia) ??
            (largo > 8 ? mesa.hueco(Math.max(2, Math.ceil(w / 2) + 1), 2, objetivo, undefined, undefined, flechaLimpia) : undefined);
          if (!caja) {
            sinSitio.push(e.textos[n.texto] ?? n.texto);
            continue;
          }
          mesa.ocupar(caja);
          pequenas.push(caja);
          const color = o.color ?? `@${sobre(campoTexto === 'foto' ? oscura : campoTexto, acento ? `@${acento.token}` : undefined, 3).token}`;
          delante.push({ tipo: 'anotacion', id: `nota-${i + 1}`, texto: n.texto, voz, caja, tamano: CUERPO_ANOTACION, apunta: n.apunta, color });
          puestas++;
        }
        // Si cabe alguna, las que no caben se quitan (como haría el maquetador) y se dice; si no cabe ninguna, es un problema.
        if (sinSitio.length && puestas) notas.push(`Se quitaron ${sinSitio.length} anotaciones que no cabían: ${sinSitio.map((x) => `«${x}»`).join(', ')}.`);
        else if (sinSitio.length) problemas.push(`No hay sitio para las anotaciones (${sinSitio.map((x) => `«${x}»`).join(', ')}).`);
        break;
      }
      case 'SELLO': {
        // El sello es una pegatina: va en un hueco libre o montada sobre el borde del producto o del titular (un tercio
        // como mucho de cada uno), nunca sobre otro texto. Si no cabe así, se quita.
        const libreDeSello = new Mesa();
        for (const c of pequenas) libreDeSello.ocupar(c);
        // El radio crece con el dato más largo (el cuerpo mínimo legible manda); el hueco, con el radio.
        const masLarga = Math.max(...o.lineas.map((l) => (e.textos[l] ?? '').length), 1);
        const radio = r2(acotar(0.075 + 0.007 * masLarga, 0.1, 0.17));
        const lado = Math.max(3, Math.ceil((2 * radio * 1080) / PASO_COLUMNA));
        const celdasProducto = new Set((productoCeldas ?? []).map(([k, f]) => `${k},${f}`));
        const pisaPoco = (c: Caja) => {
          let titular = 0;
          let producto = 0;
          for (let f = c.fila[0]; f <= c.fila[1]; f++) for (let k = c.col[0]; k <= c.col[1]; k++) {
            if (titularCaja && k >= titularCaja.col[0] && k <= titularCaja.col[1] && f >= titularCaja.fila[0] && f <= titularCaja.fila[1]) titular++;
            if (celdasProducto.has(`${k},${f}`)) producto++;
          }
          return titular <= (lado * lado) / 3 && producto <= (lado * lado) / 3;
        };
        const esquina = titularCaja && titularCaja.fila[0] <= 5 ? { col: COLUMNAS, fila: ULTIMA - 2 } : { col: COLUMNAS, fila: PRIMERA + 1 };
        const caja = mesa.hueco(lado, lado, esquina) ?? libreDeSello.hueco(lado, lado, titularCaja ? { col: titularCaja.col[1], fila: titularCaja.fila[1] } : esquina, undefined, undefined, pisaPoco);
        if (!caja) {
          notas.push(`Se quitó el sello: no cabía sin tapar un texto o más de un tercio del titular o del producto.`);
          break;
        }
        mesa.ocupar(caja);
        const p = pxDe(caja);
        const fondoSello = tinta(o.fondo) ?? acento ?? clara;
        const letras = tinta(o.color) ?? sobre(fondoSello, undefined, 4.5);
        delante.push({ tipo: 'sello', forma: o.forma, centro: { x: r2((p.x + p.w / 2) / 1080), y: r2((p.y + p.h / 2) / 1440) }, radio, fondo: `@${fondoSello.token}`, color: `@${letras.token}`, lineas: o.lineas.map((l) => ({ texto: claveOk(l, 'sello'), voz: t.voz })) });
        break;
      }
      case 'GESTO': {
        // El trazo acompaña a un texto que esté en la pieza (si el apoyo no cupo, va con el titular).
        const hayApoyo = delante.some((c) => c.tipo === 'texto' && c.id === 'apoyo');
        delante.push({ tipo: 'trazo', gesto: o.gesto, de: o.de === 'apoyo' && hayApoyo ? 'apoyo' : 'titular', color: o.color ?? `@${(acento ?? sobre(fondo, undefined, 3)).token}` });
        break;
      }
      case 'DIAGONAL':
        capas.splice(1, 0, { tipo: 'diagonal', color: o.color, izquierda: 0.66, derecha: 0.42 });
        break;
      case 'FORMA_DETRAS': {
        if (!productoOcupa) break;
        const c = productoOcupa;
        const i = capas.findIndex((x) => x.tipo === 'plato');
        capas.splice(i < 0 ? capas.length : i, 0, { tipo: 'forma', figura: o.figura === 'circulo' ? 'circulo' : 'mancha', caja: { col: [Math.max(1, c.col[0]), Math.min(COLUMNAS, c.col[1])], fila: [Math.max(1, c.fila[0]), Math.min(FILAS, c.fila[1])] }, color: o.color, plano: 'fondo' });
        break;
      }
      case 'TRAMA':
        capas.splice(1, 0, { tipo: 'patron', motivo: o.motivo, color: o.color, ...(o.donde === 'franja' ? { caja: { col: [1, COLUMNAS], fila: [FILAS - 2, FILAS] } } : { suave: true }), plano: 'fondo' });
        break;
      case 'TEXTURA':
        delante.push({ tipo: 'textura', recurso: r.esqueleto === 'PARTIDA' ? 'papel' : o.recurso, intensidad: 0.1 });
        break;
      case 'ESCENA': {
        // La escena (generada aparte, sin comida) sustituye al campo liso: va justo encima del fondo, a sangre.
        if (!['PRODUCTO_SOBRE_COLOR', 'CARTEL', 'COLUMNA', 'EDITORIAL'].includes(r.esqueleto)) {
          problemas.push(`ESCENA solo va con PRODUCTO_SOBRE_COLOR, CARTEL, COLUMNA o EDITORIAL (no con ${r.esqueleto}).`);
          break;
        }
        if (!conEscena) {
          notas.push('ESCENA: todavía no hay imagen de escena; se compila sobre el campo liso.');
          break;
        }
        capas.splice(1, 0, {
          tipo: 'foto', encuadre: 'sangre', activo: 'escena',
          ...(o.tratamiento === 'duotono' ? { tratamiento: 'duotono', tinta: `@${oscura.token}`, papel: `@${(acento ?? fondo).token}` } : o.tratamiento === 'desenfocada' ? { tratamiento: 'desenfocada' } : {}),
        });
        break;
      }
      case 'GARABATO': {
        if (!e.garabato) {
          notas.push('GARABATO: todavía no hay imagen; se compila sin él.');
          break;
        }
        if (!productoOcupa) {
          problemas.push('GARABATO rodea al producto: hace falta el producto recortado en la pieza.');
          break;
        }
        // Centrado en el producto y un 45 % más ancho que él: los trazos asoman alrededor.
        const c = pxDe(productoOcupa);
        const capa: CapaPropuesta = { tipo: 'plato', recurso: true, activo: 'garabato', caja: productoOcupa, ancho: r2(acotar((c.w * 1.45) / 1080, 0.4, 1.4)), alinear: 'centro', plano: o.plano === 'delante' ? 'frente' : 'fondo' };
        if (o.plano === 'delante') delante.push(capa);
        else {
          // Detrás de todo menos del fondo (y de la escena): asoma entre las letras y alrededor del producto, nunca las tapa.
          const i = capas.findIndex((x) => x.tipo !== 'fondo' && !(x.tipo === 'foto' && x.activo === 'escena'));
          capas.splice(i < 0 ? capas.length : i, 0, capa);
        }
        break;
      }
      case 'FILETES': {
        const color = o.color ?? `@${sobre(campoTexto === 'foto' ? oscura : campoTexto, undefined, 3).token}`;
        // Un filete bajo el titular (o sobre él); con el titular vertical, en la cabeza de la otra zona. Si no hay una fila
        // libre dentro de la zona segura, no se pone.
        const vertical = r.esqueleto === 'COLUMNA';
        const cols: [number, number] = vertical && titularCaja ? (titularCaja.col[0] === 1 ? [titularCaja.col[1] + 1, COLUMNAS] : [1, titularCaja.col[0] - 1]) : (titularCaja?.col ?? [1, COLUMNAS]);
        const candidatas = vertical || !titularCaja ? [PRIMERA + filasDeBanda, PRIMERA + filasDeBanda + 1] : [titularCaja.fila[1] + 1, titularCaja.fila[0] - 1];
        const fila = candidatas.find((f) => f >= PRIMERA && f <= ULTIMA && mesa.libre({ col: cols, fila: [f, f] }));
        if (fila) delante.push({ tipo: 'forma', figura: 'filete', caja: { col: cols, fila: [fila, fila] }, color, plano: 'frente' });
        else notas.push('Se quitaron los filetes: no había una fila libre.');
        break;
      }
    }
  }
  // ------------------------------------------------------------------ Elementos gráficos (dibujados por el modelo secundario)
  for (const [i, el] of r.elementos.entries()) {
    if (!e.elementos?.[i]) {
      notas.push(`Elemento ${i + 1}: todavía no hay imagen; se compila sin él.`);
      continue;
    }
    let caja: Caja | undefined;
    let ancho = 0.5;
    if (el.donde === 'alrededor-del-producto' && productoOcupa) {
      caja = productoOcupa;
      ancho = (pxDe(productoOcupa).w * 1.35) / 1080;
    } else if (el.donde === 'detras-del-titular' && titularCaja) {
      caja = titularCaja;
      ancho = (pxDe(titularCaja).w * 1.08) / 1080;
    } else if (el.donde === 'fondo') {
      caja = { col: [1, COLUMNAS], fila: [1, FILAS] };
      ancho = 1.05;
    } else {
      // Una esquina libre (o, si no la hay, la de arriba a la derecha, por detrás de todo).
      caja = mesa.hueco(4, 4, { col: COLUMNAS, fila: PRIMERA }) ?? mesa.hueco(3, 3, { col: 1, fila: ULTIMA }) ?? { col: [9, 12], fila: [PRIMERA, PRIMERA + 3] };
      ancho = (pxDe(caja).w * 1.1) / 1080;
    }
    if (!caja) continue;
    // Delante solo si no pisa texto (el titular, el patrón o los textos pequeños): si los pisaría, va detrás.
    const pisaTexto = [...(titularCaja ? [titularCaja] : []), ...pequenas].some((t) => !(caja!.col[1] < t.col[0] || caja!.col[0] > t.col[1] || caja!.fila[1] < t.fila[0] || caja!.fila[0] > t.fila[1]));
    const delanteDeVerdad = el.plano === 'delante' && !pisaTexto;
    if (el.plano === 'delante' && pisaTexto) notas.push(`Elemento ${i + 1}: iba delante, pero pisaría el texto; va detrás.`);
    const capa: CapaPropuesta = { tipo: 'plato', recurso: true, activo: `elemento${i + 1}`, caja, ancho: r2(acotar(ancho, 0.15, 1.5)), alinear: 'centro', plano: delanteDeVerdad ? 'frente' : 'fondo' };
    if (delanteDeVerdad) delante.push(capa);
    else {
      // Detrás de todo menos del fondo (y de la escena): asoma entre las letras y alrededor del producto, nunca las tapa.
      const j = capas.findIndex((x) => x.tipo !== 'fondo' && !(x.tipo === 'foto' && x.activo === 'escena'));
      capas.splice(j < 0 ? capas.length : j, 0, capa);
    }
  }

  notas.push(`Esqueleto ${r.esqueleto}; producto ${r.producto.escala}; titular ${t.escala} (${t.relacion}); operaciones: ${r.operaciones.map((o) => o.tipo).join(', ') || 'ninguna'}${r.elementos.length ? `; elementos: ${r.elementos.length}` : ''}.`);
  return { capas: [...capas, ...delante], textos, problemas, notas, mesa: mesa.dibujo() };
}
