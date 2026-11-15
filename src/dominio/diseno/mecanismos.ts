/**
 * F3.1 · Biblioteca de mecanismos editoriales: de la composición que elige el director a una maqueta capa a capa.
 *
 * El director decide QUÉ (el mecanismo, los textos, el énfasis); este código decide DÓNDE y CUÁNTO, a partir del mapa de
 * la foto (dominio/diseno/mapaDeFoto.ts). Cada mecanismo garantiza por construcción lo que antes se dejaba al modelo:
 * - salto de escala: el titular llena una caja de varias filas con «caja»; lo demás va al cuerpo mínimo (34 px);
 * - cruce: el titular va «detrás» del plato (el compositor lo sube o lo baja hasta que el plato tape del 20 al 45 %),
 *   o las anotaciones señalan elementos del plato;
 * - contraste: la tinta de cada texto se elige con la luz medida en las celdas que ocupa y, si ninguna llega, se pone un
 *   velo en ese lado;
 * - nada encima del plato: los textos pequeños solo van en celdas libres del mapa.
 * Los mecanismos salen de las familias y mecanismos de las fichas (conocimiento/referencias) y de los criterios de
 * diseno/f3/INVESTIGACION.md (§3.1 y §4). Funciones puras: no pintan ni llaman a nada.
 */
import { contraste } from './color.js';
import { OCUPACION_DE_SUJETO, type MapaDeFoto } from './mapaDeFoto.js';
import type { CapaPropuesta, Composicion } from './propuesta.js';

const COLUMNAS = 12;
const PRIMERA_FILA = 2; // la 1 y la 16 quedan fuera de la zona segura
const ULTIMA_FILA = 15;
/** Ancho de una columna más su medianil, en px del lienzo de 1080 (retícula de 12 con margen 72 y medianil 12). */
const PASO_COLUMNA = (1080 - 2 * 72 + 12) / COLUMNAS;
const PASO_FILA = (1440 - 2 * 72 + 12) / 16;
/** Cuerpo de los textos pequeños: el mínimo del dialecto. */
const CUERPO_PEQUENO = 34;
const CUERPO_ANOTACION = 44;
/** Contraste que se pide al elegir la tinta: el de WCAG con un margen, porque el mapa mide medias por celda. */
const MARGEN_DE_CONTRASTE = 1.3;

export interface VocesDeLaPieza {
  titular: string;
  apoyo: string;
  firma: string;
  /** Voz de acento (manuscrita o didona); la de la marca o la que propone el estudio. */
  acento?: string;
  anotacion?: string;
}

export interface Tinta {
  token: string;
  hex: string;
}

/** Correcciones que pide la prueba en el compositor (se aplican sin volver a llamar al director). */
export interface Ajustes {
  /** Lados que llevan velo. */
  velos?: Array<'arriba' | 'abajo'>;
  /** Tinta forzada por capa (id → token). */
  tintas?: Record<string, string>;
  /** Filas de más para el titular (si el salto de escala no llega). */
  titularMasAlto?: number;
  /** Lado del titular forzado por un arreglo (el otro, si en el elegido el plato lo tapa demasiado). */
  lado?: 'arriba' | 'abajo';
}

export interface EntornoDeMecanismo {
  mapa: MapaDeFoto;
  tieneMascara: boolean;
  colores: Tinta[];
  voces: VocesDeLaPieza;
  /** Color (token, sin arroba) que lleva cada voz en su estilo: se respeta si contrasta. */
  colorDeVoz: Record<string, string>;
  /** Ancho medio de un carácter de cada voz al cuerpo pequeño, en px (para saber cuántas columnas ocupa). */
  anchoDeCaracter: Record<string, number>;
  /** Los textos de la propuesta (clave → texto). */
  textos: Record<string, string>;
  ajustes?: Ajustes;
}

export interface Colocacion {
  capas: CapaPropuesta[];
  /** Textos con cambios de línea puestos por el código (clave → texto). */
  textos: Record<string, string>;
  /** Lo que no se puede colocar: el director tiene que cambiar la composición. */
  problemas: string[];
  /** Decisiones del código, para las notas de la intención. */
  notas: string[];
}

interface Caja {
  col: [number, number];
  fila: [number, number];
}

const ancho = (c: Caja) => c.col[1] - c.col[0] + 1;
const alto = (c: Caja) => c.fila[1] - c.fila[0] + 1;
const acotar = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/** Rejilla de ocupación: el plato (de la máscara) y lo que ya se ha colocado. */
class Rejilla {
  private readonly usada: boolean[];

  constructor(
    private readonly mapa: MapaDeFoto,
    conSujeto: boolean,
  ) {
    this.usada = Array.from({ length: mapa.columnas * mapa.filas }, (_, i) => conSujeto && (mapa.ocupacion[i] ?? 0) >= OCUPACION_DE_SUJETO);
  }

  libre(c: Caja): boolean {
    for (let f = c.fila[0]; f <= c.fila[1]; f++) for (let k = c.col[0]; k <= c.col[1]; k++) if (this.usada[(f - 1) * this.mapa.columnas + (k - 1)]) return false;
    return true;
  }

  ocupar(c: Caja): void {
    for (let f = c.fila[0]; f <= c.fila[1]; f++) for (let k = c.col[0]; k <= c.col[1]; k++) this.usada[(f - 1) * this.mapa.columnas + (k - 1)] = true;
  }

  /** El hueco libre de w × h celdas más cercano a un punto (en celdas), dentro de las filas útiles. */
  hueco(w: number, h: number, cerca: { col: number; fila: number }, filas: [number, number] = [PRIMERA_FILA, ULTIMA_FILA]): Caja | undefined {
    let mejor: { c: Caja; d: number } | undefined;
    for (let f0 = filas[0]; f0 + h - 1 <= filas[1]; f0++) {
      for (let c0 = 1; c0 + w - 1 <= COLUMNAS; c0++) {
        const c: Caja = { col: [c0, c0 + w - 1], fila: [f0, f0 + h - 1] };
        if (!this.libre(c)) continue;
        const d = Math.hypot(c0 + (w - 1) / 2 - cerca.col, f0 + (h - 1) / 2 - cerca.fila);
        if (!mejor || d < mejor.d) mejor = { c, d };
      }
    }
    return mejor?.c;
  }
}

/** La luminancia relativa de un gris con esa luz (0–1, como la mide el mapa). */
const grisDe = (luz: number) => {
  const v = Math.round(acotar(luz, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${v}${v}${v}`;
};

/**
 * La tinta de un texto según la luz de las celdas que pisa (sin contar las del plato, que lo tapa o no se pisan).
 * Se mira la celda más clara y la más oscura: la tinta tiene que contrastar con las dos. `preferida`, si llega, manda.
 */
export function elegirTinta(caja: Caja, mapa: MapaDeFoto, colores: Tinta[], ratio: number, preferida?: string, conVelo = false): { tinta: Tinta; llega: boolean } {
  const luces: number[] = [];
  for (let f = caja.fila[0]; f <= caja.fila[1]; f++) {
    for (let c = caja.col[0]; c <= caja.col[1]; c++) {
      const i = (f - 1) * mapa.columnas + (c - 1);
      if ((mapa.ocupacion[i] ?? 0) >= OCUPACION_DE_SUJETO) continue;
      // Una celda con mucho detalle tiene luces y sombras dentro: se ensancha su rango.
      const margen = 0.15 * (mapa.detalle[i] ?? 0);
      luces.push(mapa.luz[i]! - margen, mapa.luz[i]! + margen);
    }
  }
  // Con velo, el fondo de ese lado queda casi negro.
  const fondos = conVelo ? [0.02, 0.12] : luces.length ? [Math.min(...luces), Math.max(...luces)] : [mapa.luzMedia];
  const peor = (t: Tinta) => Math.min(...fondos.map((l) => contraste(t.hex, grisDe(l))));
  const pedido = ratio * MARGEN_DE_CONTRASTE;
  const pref = colores.find((t) => t.token === preferida);
  if (pref && peor(pref) >= pedido) return { tinta: pref, llega: true };
  const mejor = [...colores].sort((a, b) => peor(b) - peor(a))[0]!;
  return { tinta: mejor, llega: peor(mejor) >= pedido };
}

/** La más oscura y la más clara de las tintas (para el fondo, el velo y un texto sobre velo). */
function extremos(colores: Tinta[]): { oscura: Tinta; clara: Tinta } {
  const porLuz = [...colores].sort((a, b) => contraste(b.hex, '#FFFFFF') - contraste(a.hex, '#FFFFFF'));
  return { oscura: porLuz[0]!, clara: porLuz[porLuz.length - 1]! };
}

export function colocar(comp: Composicion, e: EntornoDeMecanismo): Colocacion {
  const { mapa } = e;
  const problemas: string[] = [];
  const notas: string[] = [];
  const textos: Record<string, string> = {};
  const ajustes = e.ajustes ?? {};
  const sujeto = e.tieneMascara ? mapa.sujeto : undefined;
  const rejilla = new Rejilla(mapa, Boolean(sujeto));
  const { oscura, clara } = extremos(e.colores);
  const velos = new Set(ajustes.velos ?? []);
  const capasTexto: CapaPropuesta[] = [];
  const pedir = (clave: string | undefined, para: string): string | undefined => {
    if (!clave) return undefined;
    if (!(clave in e.textos)) problemas.push(`${para}: no hay ningún texto con la clave «${clave}».`);
    return clave;
  };
  const columnasPara = (clave: string, voz: string, cuerpo = CUERPO_PEQUENO) => {
    const largo = Math.max(...(e.textos[clave] ?? '').split('\n').map((l) => l.length));
    const px = (e.anchoDeCaracter[voz] ?? cuerpo * 0.6) * (cuerpo / CUERPO_PEQUENO);
    return acotar(Math.ceil((largo * px) / PASO_COLUMNA) + 1, 2, COLUMNAS);
  };
  const ladoDe = (c: Caja): 'arriba' | 'abajo' => ((c.fila[0] + c.fila[1]) / 2 <= 8.5 ? 'arriba' : 'abajo');
  const tintaDe = (id: string, c: Caja, ratio: number, preferida?: string): Tinta => {
    const forzada = ajustes.tintas?.[id];
    if (forzada) return e.colores.find((t) => t.token === forzada) ?? clara;
    const lado = ladoDe(c);
    const r = elegirTinta(c, mapa, e.colores, ratio, preferida, velos.has(lado));
    if (r.llega) return r.tinta;
    velos.add(lado);
    notas.push(`Velo ${lado}: ninguna tinta de la marca contrasta lo bastante con la foto donde va «${id}».`);
    return elegirTinta(c, mapa, e.colores, ratio, preferida, true).tinta;
  };

  // ---------------------------------------------------------------- 1. El titular (y el acento)
  const titular = pedir(comp.titular, 'titular') ?? comp.titular;
  const acento = comp.mecanismo === 'TITULAR_CON_ACENTO' ? pedir(comp.acento, 'acento') : undefined;
  if (comp.mecanismo === 'TITULAR_CON_ACENTO' && !comp.acento) problemas.push('TITULAR_CON_ACENTO necesita «acento»: la clave del texto en la voz de acento.');
  if (acento && !e.voces.acento) problemas.push('No hay voz de acento (ni de la marca ni del estudio): usa TITULAR_DETRAS.');
  if (comp.mecanismo === 'ANOTACIONES' && !comp.anotaciones?.length) problemas.push('ANOTACIONES necesita al menos una anotación.');
  if (comp.mecanismo !== 'ANOTACIONES' && (comp.anotaciones?.length ?? 0) > 1) problemas.push('Con este mecanismo, una anotación como mucho (un solo gesto a mano por pieza).');

  const detras = Boolean(sujeto) && comp.mecanismo !== 'ANOTACIONES';
  let cajaTitular: Caja;
  let cajaAcento: Caja | undefined;
  let lado: 'arriba' | 'abajo' = 'arriba';
  if (sujeto && detras) {
    const libresArriba = Math.max(0, sujeto.fila[0] - PRIMERA_FILA);
    const libresAbajo = Math.max(0, ULTIMA_FILA - sujeto.fila[1]);
    lado = ajustes.lado ?? comp.lado ?? (libresAbajo > libresArriba ? 'abajo' : 'arriba');
    const libres = lado === 'arriba' ? libresArriba : libresAbajo;
    // El tamaño del titular lo pone el aire de su lado (su caja es ese aire); cuánto se mete en el plato lo decide el
    // compositor, que lo acerca hasta que el plato tape del 20 al 45 % de su franja más tapada (relación «detras»).
    // Si la caja entrara ya en el plato, la segunda línea quedaría casi entera detrás y no se leería.
    // Con acento, sus dos filas van en el borde y el titular empieza justo después: si compartieran fila, el titular
    // taparía el acento. Por eso el acento necesita cuatro filas de aire (dos suyas y dos del titular).
    const desplazamiento = acento ? 2 : 0;
    // Sin aire, el titular «detrás» quedaría tapado casi entero (Sushita, 15/11: el 76 %): no se coloca.
    if (libres < 2) problemas.push(`No hay aire ${lado === 'arriba' ? 'encima' : 'debajo'} del plato (${libres} fila(s); encima ${libresArriba} y debajo ${libresAbajo}): el titular quedaría tapado. Usa PLATO_SOBRE_COLOR (el plato recortado sobre color plano), ANOTACIONES, o el otro lado si tiene aire.`);
    if (acento && libres < 4) problemas.push(`Para el acento hacen falta cuatro filas de aire ${lado === 'arriba' ? 'encima' : 'debajo'} del plato y hay ${libres}: usa TITULAR_DETRAS (o el otro lado, si tiene más aire).`);
    // Una sola palabra no puede partirse en dos líneas: su caja puede entrar una fila en el plato y crecer sin riesgo.
    const unaPalabra = !/\s/.test((e.textos[titular] ?? '').trim());
    const filas = acotar(libres - desplazamiento + (unaPalabra ? 1 : 0), 2, 7) + (ajustes.titularMasAlto ?? 0);
    if (lado === 'arriba') {
      const f0 = PRIMERA_FILA + desplazamiento;
      cajaTitular = { col: [1, COLUMNAS], fila: [f0, Math.min(ULTIMA_FILA, f0 + filas - 1)] };
      if (acento) cajaAcento = { col: [4, COLUMNAS - 1], fila: [PRIMERA_FILA, PRIMERA_FILA + 1] };
    } else {
      const f1 = ULTIMA_FILA - desplazamiento;
      cajaTitular = { col: [1, COLUMNAS], fila: [Math.max(PRIMERA_FILA, f1 - filas + 1), f1] };
      if (acento) cajaAcento = { col: [4, COLUMNAS - 1], fila: [ULTIMA_FILA - 1, ULTIMA_FILA] };
    }
  } else {
    // Sin plato recortable (o con anotaciones): el titular, grande, en la zona libre mayor.
    const zona = mapa.libres.find((z) => z.fila[1] >= PRIMERA_FILA && z.fila[0] <= ULTIMA_FILA);
    const f0 = acotar(zona?.fila[0] ?? PRIMERA_FILA, PRIMERA_FILA, ULTIMA_FILA);
    const f1 = acotar(Math.min(zona?.fila[1] ?? f0 + 3, f0 + 4), f0, ULTIMA_FILA);
    cajaTitular = { col: zona ? zona.col : [1, COLUMNAS], fila: [f0, Math.max(f1, Math.min(f0 + 1, ULTIMA_FILA))] };
    lado = ladoDe(cajaTitular);
    if (ancho(cajaTitular) < 6) notas.push('La zona libre mayor es estrecha: el titular será más pequeño.');
  }
  rejilla.ocupar(cajaTitular);
  if (cajaAcento) rejilla.ocupar(cajaAcento);

  const tintaTitular = tintaDe('titular', cajaTitular, 3, e.colorDeVoz[e.voces.titular]);
  if (acento && cajaAcento) {
    // El acento va por debajo del titular («plano: fondo»): el titular lo pisa y se lee como un solo logotipo.
    const preferida = e.colores.find((t) => t.token !== tintaTitular.token && contraste(t.hex, tintaTitular.hex) >= 1.6)?.token;
    const tinta = tintaDe('acento', cajaAcento, 3, preferida);
    // Cuerpo fijo al 85 % del alto de su caja: con «caja» llenaría el alto y, girado, se saldría de la zona segura.
    const cuerpo = Math.round(alto(cajaAcento) * (PASO_FILA - 12) * 0.85);
    capasTexto.push({ tipo: 'texto', id: 'acento', texto: acento, voz: e.voces.acento!, caja: cajaAcento, ajuste: 'fijo', tamano: cuerpo, alinear: 'derecha', vertical: lado === 'arriba' ? 'abajo' : 'arriba', color: `@${tinta.token}`, giro: -4, relacion: 'aparte', plano: 'fondo' });
  }
  capasTexto.push({
    tipo: 'texto',
    id: 'titular',
    texto: titular,
    voz: e.voces.titular,
    caja: cajaTitular,
    ajuste: 'caja',
    alinear: 'izquierda',
    vertical: lado === 'arriba' ? 'abajo' : 'arriba',
    color: `@${tintaTitular.token}`,
    relacion: detras ? 'detras' : 'aparte',
    ...(comp.sangra ? { sangra: true } : {}),
    ...(comp.tinta ? { tinta: comp.tinta } : {}),
    ...(detras && sujeto ? { entre: lado === 'arriba' ? [cajaTitular.fila[0], Math.min(ULTIMA_FILA, sujeto.fila[0] + 3)] : [Math.max(PRIMERA_FILA, sujeto.fila[1] - 3), cajaTitular.fila[1]] } : {}),
  });

  // ---------------------------------------------------------------- 2. Apoyo y firma, en celdas libres
  const pequenos: Array<{ id: string; clave: string; voz: string }> = [];
  const apoyo = pedir(comp.apoyo, 'apoyo');
  const firma = pedir(comp.firma, 'firma');
  if (apoyo) pequenos.push({ id: 'apoyo', clave: apoyo, voz: e.voces.apoyo });
  if (firma) pequenos.push({ id: 'firma', clave: firma, voz: e.voces.firma });
  // Mejor en el lado contrario al titular, pegados al borde; si no caben, en el lado del titular.
  const opuesto = lado === 'arriba' ? { col: 1, fila: ULTIMA_FILA } : { col: 1, fila: PRIMERA_FILA };
  for (const t of pequenos) {
    const w = columnasPara(t.clave, t.voz);
    const caja = rejilla.hueco(w, 1, opuesto) ?? rejilla.hueco(w, 1, { col: 1, fila: lado === 'arriba' ? PRIMERA_FILA : ULTIMA_FILA });
    if (!caja) {
      problemas.push(`No cabe «${e.textos[t.clave]}» sin pisar el plato ni el titular: quítalo o acórtalo.`);
      continue;
    }
    rejilla.ocupar(caja);
    const tinta = tintaDe(t.id, caja, 4.5, e.colorDeVoz[t.voz]);
    capasTexto.push({ tipo: 'texto', id: t.id, texto: t.clave, voz: t.voz, caja, ajuste: 'fijo', tamano: CUERPO_PEQUENO, alinear: caja.col[0] === 1 ? 'izquierda' : 'derecha', vertical: 'centro', color: `@${tinta.token}`, relacion: 'aparte' });
  }

  // ---------------------------------------------------------------- 3. Anotaciones con flecha
  const notasDelPlato = comp.anotaciones ?? [];
  if (notasDelPlato.length && !sujeto) problemas.push('Las anotaciones señalan el plato: hacen falta la máscara y el plato en el mapa.');
  if (notasDelPlato.length && !e.voces.anotacion) problemas.push('No hay voz para las anotaciones.');
  if (sujeto && e.voces.anotacion) {
    for (const [i, n] of notasDelPlato.entries()) {
      const clave = pedir(n.texto, 'anotación');
      if (!clave) continue;
      let w = columnasPara(clave, e.voces.anotacion, CUERPO_ANOTACION);
      let h = 1;
      if (w > 5) {
        w = Math.ceil(w / 2) + 1;
        h = 2;
      }
      const objetivo = { col: sujeto.col[0] + n.apunta.x * (sujeto.col[1] - sujeto.col[0]), fila: sujeto.fila[0] + n.apunta.y * (sujeto.fila[1] - sujeto.fila[0]) };
      const caja = rejilla.hueco(w, h, objetivo);
      if (!caja) {
        problemas.push(`No hay sitio libre cerca del plato para la anotación «${e.textos[clave]}»: quítala o acórtala.`);
        continue;
      }
      rejilla.ocupar(caja);
      const tinta = tintaDe(`nota-${i + 1}`, caja, 3, e.colorDeVoz[e.voces.anotacion]);
      capasTexto.push({ tipo: 'anotacion', id: `nota-${i + 1}`, texto: clave, voz: e.voces.anotacion, caja, tamano: CUERPO_ANOTACION, apunta: n.apunta, color: `@${tinta.token}` });
    }
  }

  // ---------------------------------------------------------------- 4. Sello con un dato real
  const capasSello: CapaPropuesta[] = [];
  if (comp.sello) {
    const lineas = comp.sello.lineas.map((l) => pedir(l, 'sello')).filter((l): l is string => Boolean(l));
    const caja = rejilla.hueco(3, 3, lado === 'arriba' ? { col: COLUMNAS, fila: ULTIMA_FILA } : { col: COLUMNAS, fila: PRIMERA_FILA });
    if (!caja) problemas.push('No hay un hueco libre de 3 × 3 celdas para el sello: quítalo.');
    else if (lineas.length) {
      rejilla.ocupar(caja);
      // Las líneas en la voz del titular (la más estrecha y la que más pesa: el dato se lee aunque el sello sea pequeño).
      // El fondo del sello: el color con más carácter (ni el más oscuro ni el más claro); las letras, la tinta que más contrasta con él.
      const fondo = e.colores.find((t) => t.token !== oscura.token && t.token !== clara.token) ?? clara;
      const letras = contraste(oscura.hex, fondo.hex) >= contraste(clara.hex, fondo.hex) ? oscura : clara;
      const centro = { x: (72 + (caja.col[0] - 1) * PASO_COLUMNA + (3 * PASO_COLUMNA - 12) / 2) / 1080, y: (72 + (caja.fila[0] - 1) * PASO_FILA + (3 * PASO_FILA - 12) / 2) / 1440 };
      capasSello.push({ tipo: 'sello', forma: 'circulo', centro: { x: Math.round(centro.x * 1000) / 1000, y: Math.round(centro.y * 1000) / 1000 }, radio: 0.095, fondo: `@${fondo.token}`, color: `@${letras.token}`, lineas: lineas.map((l) => ({ texto: l, voz: e.voces.titular })) });
    }
  }

  const capas: CapaPropuesta[] = [
    { tipo: 'fondo', color: `@${oscura.token}` },
    { tipo: 'foto', encuadre: 'sangre', ...(velos.size ? { velo: velos.size > 1 ? 'ambos' : velos.has('arriba') ? 'arriba' : 'abajo', colorVelo: `@${oscura.token}` } : {}) },
    ...capasTexto,
    ...capasSello,
  ];
  return { capas, textos, problemas, notas };
}
