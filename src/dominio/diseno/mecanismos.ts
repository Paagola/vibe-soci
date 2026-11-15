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
/** Segundo nivel de texto (entre el titular y la firma): un 35 % más que la firma, para que se separe como nivel. */
const CUERPO_SEGUNDO = 46;
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
  /** Recursos que permite la estética del encargo (punto 10). Sin ella, todos. */
  recursos?: string[];
  /** F3.3: los elementos gráficos que admite la estética y cuántos (punto 13). */
  graficos?: { tipos: string[]; maximo: number };
  /** F3.3: los tratamientos de la referencia que la estética sabe reproducir (punto 12): PEGATINA, PAPEL, PINCEL, TINTA… */
  tratamientos?: string[];
  /** La caja de la silueta del plato en la foto entera, en px, y el tamaño de la foto: dice si la foto corta el plato. */
  silueta?: { x: number; y: number; w: number; h: number; anchoFoto: number; altoFoto: number };
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
  if (comp.mecanismo === 'PLATO_SOBRE_COLOR') return platoSobreColor(comp, e);
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
  const unaPalabra = !/\s/.test((e.textos[titular] ?? '').trim());
  // Sangrar es cortar las letras en los DOS cantos: solo con una palabra, que llena el ancho entero sin partirse.
  const sangra = Boolean(comp.sangra) && unaPalabra;
  if (comp.sangra && !unaPalabra) notas.push('«sangra» solo se aplica a un titular de una palabra: con más, se partiría en líneas y no llegaría a los cantos.');
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
    ajuste: sangra ? 'ancho' : 'caja',
    alinear: sangra ? 'centro' : 'izquierda',
    vertical: lado === 'arriba' ? 'abajo' : 'arriba',
    color: `@${tintaTitular.token}`,
    relacion: detras ? 'detras' : 'aparte',
    ...(sangra ? { sangra: true } : {}),
    ...(comp.tinta ? { tinta: comp.tinta } : {}),
    ...(detras && sujeto ? { entre: lado === 'arriba' ? [cajaTitular.fila[0], Math.min(ULTIMA_FILA, sujeto.fila[0] + 3)] : [Math.max(PRIMERA_FILA, sujeto.fila[1] - 3), cajaTitular.fila[1]] } : {}),
  });

  // ---------------------------------------------------------------- 2. Apoyo y firma, en celdas libres
  const pequenos: Array<{ id: string; clave: string; voz: string }> = [];
  const apoyo = pedir(comp.apoyo, 'apoyo');
  const firma = pedir(comp.firma, 'firma');
  // La firma primero: se queda el sitio más pegado al borde, y el apoyo va justo antes de ella.
  if (firma) pequenos.push({ id: 'firma', clave: firma, voz: e.voces.firma });
  // Con acento ya hay tres voces (titular, acento y firma): el apoyo va en la de la firma para no pasar de tres.
  if (apoyo) pequenos.push({ id: 'apoyo', clave: apoyo, voz: acento ? e.voces.firma : e.voces.apoyo });
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

/**
 * PLATO_SOBRE_COLOR (familias F1 y F3: «color plano y producto recortado»; ref-pin-34 de Sushita):
 * - un campo de color plano partido en diagonal (dos colores de la marca);
 * - el plato, recortado con su máscara, grande, girado y cortado por el borde, por delante de la diagonal;
 * - el titular, grande y ENTERO, por delante del fondo y sin que nada lo tape (en el v001 de Sushita quedó enterrado);
 * - tres niveles de texto: titular, una línea secundaria y la firma.
 * Si la foto corta el plato por los lados (la tabla llena la foto), el plato se agranda hasta que esos cortes quedan
 * fuera del lienzo y solo se ve su canto de arriba, que es real; si lo corta por arriba, no se puede.
 * Todo va sobre colores exactos, así que la tinta de cada texto se elige midiendo contra su color, sin estimar.
 */
function platoSobreColor(comp: Composicion, e: EntornoDeMecanismo): Colocacion {
  const problemas: string[] = [];
  const notas: string[] = [];
  const sujeto = e.tieneMascara ? e.mapa.sujeto : undefined;
  if (!sujeto) return { capas: [], textos: {}, problemas: ['PLATO_SOBRE_COLOR recorta el plato: hace falta la máscara de la foto.'], notas };
  if (comp.lado === 'abajo') notas.push('PLATO_SOBRE_COLOR pone siempre el titular arriba y el plato abajo, cortado por el borde.');
  // Sin sello: compite con el plato recortado. Se quita (no bloquea): así una corrección del crítico que lo pida no se
  // pierde entera por él (en la v003 de Sushita se perdió el campo en oro por el sello).
  if (comp.sello) notas.push('PLATO_SOBRE_COLOR no lleva sello (compite con el plato recortado): se quita.');
  if ((comp.anotaciones?.length ?? 0) > 0) problemas.push('PLATO_SOBRE_COLOR no lleva anotaciones: el plato recortado ya es el gesto (las anotaciones van en las diapositivas de detalle).');
  for (const [para, clave] of [['titular', comp.titular], ['apoyo', comp.apoyo], ['firma', comp.firma]] as const) {
    if (clave && !(clave in e.textos)) problemas.push(`${para}: no hay ningún texto con la clave «${clave}».`);
  }
  const { oscura, clara } = extremos(e.colores);
  const deMarca = e.colores.filter((t) => !['plato', 'foto'].includes(t.token));
  const conCaracter = deMarca.find((t) => t.token !== oscura.token && t.token !== clara.token) ?? clara;
  if (comp.color && !e.colores.some((t) => `@${t.token}` === comp.color)) problemas.push(`El color «${comp.color}» no está en la lista.`);
  // El campo de arriba (el del titular) y el de la diagonal: dos colores de la marca que contrasten entre sí.
  const campo = (comp.color && e.colores.find((t) => `@${t.token}` === comp.color)) || oscura;
  const diagonal = campo.token === conCaracter.token ? oscura : conCaracter;
  const sobre = (fondo: Tinta, preferida: string | undefined, ratio: number): Tinta => {
    const pref = e.colores.find((t) => t.token === preferida);
    if (pref && pref.token !== fondo.token && contraste(pref.hex, fondo.hex) >= ratio * MARGEN_DE_CONTRASTE) return pref;
    return [...deMarca].sort((a, b) => contraste(b.hex, fondo.hex) - contraste(a.hex, fondo.hex))[0]!;
  };

  const s = e.silueta;
  const toca = s ? { arriba: s.y <= 2, izquierda: s.x <= 2, derecha: s.x + s.w >= s.anchoFoto - 2 } : { arriba: sujeto.fila[0] <= 1, izquierda: sujeto.col[0] <= 1, derecha: sujeto.col[1] >= COLUMNAS };
  if (toca.arriba) problemas.push('La foto corta el plato por arriba: recortado se vería el corte recto. Usa la foto a sangre (TITULAR_DETRAS o ANOTACIONES).');
  const cortadoPorLosLados = toca.izquierda || toca.derecha;
  // Proporción de la silueta (ancho / alto); las celdas del mapa son cuadradas.
  const proporcion = s ? s.w / s.h : (sujeto.col[1] - sujeto.col[0] + 1) / (sujeto.fila[1] - sujeto.fila[0] + 1);
  const plato: CapaPropuesta = cortadoPorLosLados
    ? // 1,5 del ancho: los cortes de los lados quedan fuera del lienzo y el plato sigue más allá del borde de abajo.
      { tipo: 'plato', caja: { col: [1, COLUMNAS], fila: [10, 16] }, ancho: 1.5, alinear: 'arriba-centro', giro: -8, sombra: 'proyectada' }
    : // Entero: su alto, en torno al 55 % del lienzo, y el 12 % sale por abajo.
      { tipo: 'plato', caja: { col: [1, COLUMNAS], fila: [8, 16] }, ancho: Math.round(acotar((0.55 * 1440 * proporcion) / 1080, 0.55, 1.3) * 100) / 100, alinear: 'abajo-centro', giro: -10, sangra: 0.12, sombra: 'proyectada' };
  if (cortadoPorLosLados) notas.push('La foto corta el plato por los lados: se agranda hasta que esos cortes quedan fuera del lienzo.');

  const capas: CapaPropuesta[] = [
    { tipo: 'fondo', color: `@${campo.token}` },
    // La diagonal, si la estética la admite (color pop, maximalismo); si no, un campo liso.
    ...(!e.recursos || e.recursos.includes('diagonal') ? [{ tipo: 'diagonal' as const, color: `@${diagonal.token}`, izquierda: 0.64, derecha: 0.4 }] : []),
    plato,
    // El titular, entero y por delante: su caja acaba antes que el plato y la diagonal.
    { tipo: 'texto', id: 'titular', texto: comp.titular, voz: e.voces.titular, caja: { col: [1, COLUMNAS], fila: [3, 6] }, ajuste: 'caja', alinear: 'izquierda', vertical: 'centro', color: `@${sobre(campo, e.colorDeVoz[e.voces.titular], 3).token}`, relacion: 'aparte', ...(comp.tinta ? { tinta: comp.tinta } : {}) },
  ];
  if (comp.firma) capas.push({ tipo: 'texto', id: 'firma', texto: comp.firma, voz: e.voces.firma, caja: { col: [1, 8], fila: [2, 2] }, ajuste: 'fijo', tamano: CUERPO_PEQUENO, alinear: 'izquierda', vertical: 'centro', color: `@${sobre(campo, e.colorDeVoz[e.voces.firma], 4.5).token}`, relacion: 'aparte' });
  // El segundo nivel: una línea entre el titular y la firma, en la voz de texto, a un cuerpo intermedio.
  const trata = new Set(e.tratamientos ?? []);
  // PINCEL: el segundo nivel en la voz de acento de pincel (la identidad del local sigue en el titular).
  const conPincel = trata.has('PINCEL') && Boolean(e.voces.acento);
  if (comp.apoyo) {
    capas.push(
      conPincel
        ? // Sin giro: la letra de pincel ya va inclinada, y girada se salía de la zona segura por la izquierda.
          { tipo: 'texto', id: 'apoyo', texto: comp.apoyo, voz: e.voces.acento!, caja: { col: [1, 9], fila: [7, 8] }, ajuste: 'fijo', tamano: 70, alinear: 'izquierda', vertical: 'arriba', color: `@${sobre(campo, e.colorDeVoz[e.voces.acento!], 3).token}`, relacion: 'aparte' }
        : { tipo: 'texto', id: 'apoyo', texto: comp.apoyo, voz: e.voces.apoyo, caja: { col: [1, 9], fila: [7, 7] }, ajuste: 'fijo', tamano: CUERPO_SEGUNDO, alinear: 'izquierda', vertical: 'arriba', color: `@${sobre(campo, e.colorDeVoz[e.voces.apoyo], 4.5).token}`, relacion: 'aparte' },
    );
  }
  // PEGATINA o ILUSTRADO: el plato recortado con un filo claro alrededor, como el producto de las referencias de flyer
  // (en una pieza ilustrada el producto recortado va contorneado, como un dibujo o una pegatina más).
  if (trata.has('PEGATINA') || trata.has('ILUSTRADO')) {
    const filo = [...deMarca].sort((a, b) => contraste(b.hex, '#000000') - contraste(a.hex, '#000000'))[0]!;
    (plato as Extract<CapaPropuesta, { tipo: 'plato' }>).filo = `@${filo.token}`;
    notas.push(`Filo de pegatina @${filo.token} alrededor del plato (tratamiento ${trata.has('PEGATINA') ? 'pegatina' : 'ilustrado'} de la referencia).`);
  }
  // TINTA: un subrayado a pincel bajo el titular, la interrupción a mano de la pieza.
  // Bajo el segundo nivel si lo hay (bajo el titular cruzaría el segundo nivel), en el color de la diagonal.
  if (trata.has('TINTA')) capas.push({ tipo: 'trazo', gesto: 'subrayado', de: comp.apoyo ? 'apoyo' : 'titular', color: `@${diagonal.token === campo.token ? clara.token : diagonal.token}` });
  // ILUSTRADO o ICONOS_DE_LINEA: el gesto dibujado a tinta de la referencia, una rama de cerezo que entra por el canto
  // derecho en el vacío junto al segundo nivel (en ref-pin-34 entra por el izquierdo; aquí ese lado es del texto).
  const conRama = trata.has('ILUSTRADO') || trata.has('ICONOS_DE_LINEA');
  if (conRama) {
    // A la derecha, por debajo de la línea de la diagonal (que allí corta al 40 %): va sobre el color de la diagonal.
    const debajo = !e.recursos || e.recursos.includes('diagonal') ? diagonal : campo;
    capas.splice(capas.indexOf(plato), 0, { tipo: 'forma', figura: 'rama', caja: { col: [9, COLUMNAS], fila: [7, 10] }, sangra: true, color: `@${sobre(debajo, undefined, 3).token}`, plano: 'fondo' });
    notas.push('Una rama de cerezo dibujada a tinta entra por el canto derecho (tratamiento ilustrado de la referencia).');
  }
  // Elementos gráficos de la estética, cada uno con su papel (punto 13). La trama de puntos cede su sitio a la rama.
  const graficos = (e.graficos?.tipos ?? []).filter((g) => !(conRama && g === 'puntos')).slice(0, e.graficos?.maximo ?? 0);
  for (const g of graficos) {
    if (g === 'circulo') {
      // Un disco detrás del plato: lo enmarca y lo separa del campo, como un plato de color bajo el producto.
      capas.splice(capas.indexOf(plato), 0, { tipo: 'forma', figura: 'circulo', caja: { col: [2, 11], fila: [9, 16] }, color: `@${clara.token === campo.token ? diagonal.token : clara.token}`, plano: 'fondo' });
      notas.push('Un disco detrás del plato, para enmarcarlo.');
    } else if (g === 'mancha') {
      capas.splice(capas.indexOf(plato), 0, { tipo: 'forma', figura: 'mancha', caja: { col: [1, 12], fila: [9, 16] }, color: `@${clara.token}`, plano: 'fondo' });
      notas.push('Una mancha orgánica detrás del plato.');
    } else if (g === 'puntos') {
      // Una trama de puntos que llena el vacío a la derecha del segundo nivel y se apaga hacia el texto.
      capas.splice(capas.indexOf(plato), 0, { tipo: 'patron', motivo: 'puntos', caja: { col: [9, 12], fila: [7, 9] }, color: `@${diagonal.token}`, desvanece: 'izquierda', plano: 'fondo' });
      notas.push('Una trama de puntos en el vacío junto al segundo nivel.');
    } else if (g === 'filete') {
      // Un filete a la derecha de la firma: la línea de cabecera, como la etiqueta entre filetes de los flyers.
      capas.push({ tipo: 'forma', figura: 'filete', caja: { col: [9, 12], fila: [2, 2] }, color: `@${sobre(campo, undefined, 3).token}`, plano: 'frente' });
    }
  }
  // TRAMA o ICONOS_DE_LINEA: un patrón de línea (olas seigaiha) muy flojo sobre el campo, por detrás de todo: la textura
  // del fondo de los flyers japoneses. Iconos de línea propios (cerezo, palillos…) no hay: el patrón es lo más cercano.
  if (trata.has('TRAMA') || trata.has('ICONOS_DE_LINEA')) {
    capas.splice(1, 0, { tipo: 'patron', motivo: 'olas', caja: { col: [1, COLUMNAS], fila: [1, 16] }, color: `@${sobre(campo, clara.token, 1.5).token}`, suave: true, plano: 'fondo' });
    notas.push('Un patrón de línea de olas, muy flojo, sobre el campo (tratamiento de la referencia).');
  }
  // PAPEL: la fibra de un papel sin estucar sobre todo, muy suave.
  if (trata.has('PAPEL')) capas.push({ tipo: 'textura', recurso: 'papel', intensidad: 0.1 });
  notas.push(`Campo @${campo.token} partido en diagonal con @${diagonal.token}; el plato recortado, girado y cortado por el borde.`);
  return { capas, textos: {}, problemas, notas };
}
