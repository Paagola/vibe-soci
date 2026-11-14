/**
 * F3 · El director escribe la intención de diseño (antes la escribía una persona).
 *
 *   foto confirmada ─► mapa de la foto (código, sin visión) ─► propuesta del director: mecanismo, textos y énfasis
 *   ─► comprobación de los textos frente a los hechos ─► el mecanismo coloca las capas (dominio/diseno/mecanismos.ts)
 *   ─► compilación a intención ─► prueba en el compositor ─► arreglos del código (velo, tinta, titular más alto)
 *   ─► si sigue fallando, se le devuelve UNA vez ─► crítica visual de la pieza pintada junto a la referencia, con UNA
 *   vuelta más como mucho.
 *
 * Decide el código, no el modelo: lo que se puede medir lo mide y lo arregla el código; el modelo decide lo que no se
 * mide (qué mecanismo, qué texto, qué énfasis) y juzga lo que solo se ve.
 *
 * F3.1 (14/11): el cruce con el plato y el salto de escala pasan a ser OBLIGATORIOS cuando la foto lo permite (hay
 * máscara y sitio), salvo que la propuesta explique en «excepcion» por qué no. Antes solo avisaban, y como arriesgar
 * (cruzar el plato) sí daba errores, el modelo aprendía que lo seguro era apilarlo todo «aparte».
 */
import { contraste, croma, type ColorDominante } from '../../dominio/diseno/color.js';
import { Intencion, type EstiloTexto, type Tokens } from '../../dominio/diseno/intencion.js';
import type { MapaDeFoto } from '../../dominio/diseno/mapaDeFoto.js';
import { colocar, type Ajustes, type VocesDeLaPieza } from '../../dominio/diseno/mecanismos.js';
import { compilarIntencion, palabrasDeLaFicha, problemasDeTextos, type HechosDeLaPieza, type Maqueta, type PropuestaDeDiseno } from '../../dominio/diseno/propuesta.js';
import type { FichaReferencia } from '../../dominio/referencia.js';
import { describirProblemas } from '../../dominio/validacion.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { ColorDisponible, CriticoDeDiseno, DirectorDeDiseno, EncargoDeDiseno, MedidorDeFoto, VozDisponible } from '../../puertos/DirectorDeDiseno.js';

/** Lo que dice el compositor al probar una intención: los ERROR impiden usarla; los AVISO se le devuelven al director una vez. */
export interface PruebaDeIntencion {
  errores: string[];
  avisos: string[];
  /** La pieza pintada en borrador, para la crítica visual. */
  png?: string;
}

export interface DepsProponerDiseno {
  director: DirectorDeDiseno;
  medidor: MedidorDeFoto;
  /** Mira la pieza pintada junto a la referencia y propone UNA corrección. Sin él, no hay crítica. */
  critico?: CriticoDeDiseno;
  /** Resuelve (y pinta en borrador) la intención y devuelve sus problemas. Sin ella, solo se comprueba el esquema. */
  probar?: (intencion: Intencion) => Promise<PruebaDeIntencion>;
  /** Cómo es una fuente del catálogo («grotesca ultracondensada…»), para describirle las voces al director. */
  describirFuente?: (fuente: string) => string;
}

export interface EntradaDiseno {
  id: string;
  version: number;
  titulo: string;
  /** Slug del local. */
  marca: string;
  /** La foto nueva confirmada, con su máscara si la tiene. */
  foto: ActivoDisponible;
  hechos: HechosDeLaPieza;
  tokensMarca: Tokens;
  referencia?: { id: string; ficha?: FichaReferencia; imagen?: string };
  titularCreativo?: boolean;
}

export interface Intento {
  /** Quién la escribió: el director (1.ª y 2.ª propuesta) o la crítica. */
  origen: 'director' | 'critica';
  problemas: string[];
  avisos: string[];
  /** Arreglos que hizo el código sin volver a llamar al modelo. */
  arreglos: string[];
}

export interface ResultadoDiseno {
  propuesta?: PropuestaDeDiseno;
  /** La intención compilada (válida con su esquema) o undefined si la propuesta no se pudo compilar. */
  intencion?: Intencion;
  /** Lo que sigue impidiendo usar la intención. Vacío = se puede componer. */
  problemas: string[];
  /** Avisos que quedan (no impiden componer; se apuntan para que los veas). */
  avisos: string[];
  intentos: Intento[];
  /** Lo que dijo la crítica visual, si la hubo. */
  critica?: { llega: boolean; motivos: string[]; adoptada: boolean };
  mapa: MapaDeFoto;
}

/** Voz que el estudio añade si la marca no la tiene: la manuscrita corta de las anotaciones (INVESTIGACION.md §3.1, voces). */
const VOZ_ANOTACION = 'anotacion';
/** Voz de acento que el estudio propone si el mecanismo de la referencia la necesita y la marca no la tiene. */
const VOZ_ACENTO = 'acento';
const PENDIENTE = 'propuesta del estudio, pendiente de confirmar con el local';

/** Los avisos que no dependen del director (la foto o los activos): no se le devuelven. */
const AVISOS_AJENOS = /^(ACTIVO|FIDELIDAD|RESOLUCION):/;
/** Los avisos de oficio que pasan a ser obligatorios cuando la foto lo permite. */
const OFICIO_OBLIGATORIO = /^(CRUCE|JERARQUIA):/;

export const MAX_PROPUESTAS = 2;

interface Evaluacion {
  maqueta?: Maqueta;
  intencion?: Intencion;
  problemas: string[];
  avisos: string[];
  arreglos: string[];
  png?: string;
}

export async function proponerDiseno(deps: DepsProponerDiseno, entrada: EntradaDiseno): Promise<ResultadoDiseno> {
  const mapa = await deps.medidor.medir(entrada.foto);
  const { colores, coloresMedidos } = coloresDisponibles(entrada.tokensMarca, mapa);
  const { voces, vocesDeEstudio, roles } = vocesDisponibles(entrada.tokensMarca, colores, deps.describirFuente, entrada.referencia?.ficha);
  const encargo: EncargoDeDiseno = {
    hechos: entrada.hechos,
    ...(entrada.referencia ? { referencia: entrada.referencia } : {}),
    foto: entrada.foto.ruta,
    mapa,
    colores,
    voces,
    titularCreativo: entrada.titularCreativo ?? false,
  };
  const tieneMascara = Boolean(entrada.foto.rutaMascara);
  const contexto = {
    id: entrada.id,
    version: entrada.version,
    titulo: entrada.titulo,
    marca: entrada.marca,
    foto: entrada.foto.activo.id,
    tieneMascara,
    colores: Object.fromEntries(colores.map((c) => [c.token, c.hex])),
    voces: voces.map((v) => v.id),
    vocesDeEstudio,
    coloresMedidos,
    conReferencia: Boolean(entrada.referencia),
  };
  const palabrasDeReferencia = entrada.referencia?.ficha ? palabrasDeLaFicha(entrada.referencia.ficha) : [];
  // El cruce y el salto de escala se exigen si la foto lo permite: hay plato recortable y aire donde poner el titular.
  const exigible = tieneMascara && Boolean(mapa.sujeto) && mapa.libres.length > 0;
  const estilos = { ...entrada.tokensMarca.estilos, ...vocesDeEstudio };
  const entorno = {
    mapa,
    tieneMascara,
    colores: colores.map((c) => ({ token: c.token, hex: c.hex })),
    voces: roles,
    colorDeVoz: Object.fromEntries(Object.entries(estilos).map(([id, e]) => [id, e.color.replace(/^@/, '')])),
    anchoDeCaracter: Object.fromEntries(Object.entries(estilos).map(([id, e]) => [id, anchoDeCaracter(e)])),
  };

  const evaluar = async (p: PropuestaDeDiseno, ajustes: Ajustes = {}): Promise<Evaluacion> => {
    const problemas = problemasDeTextos(p.textos, entrada.hechos, { titularCreativo: encargo.titularCreativo, palabrasDeReferencia });
    const arreglos: string[] = [];
    let maqueta: Maqueta;
    if (p.composicion) {
      const col = colocar(p.composicion, { ...entorno, textos: Object.fromEntries(p.textos.map((t) => [t.clave, t.texto])), ajustes });
      problemas.push(...col.problemas);
      arreglos.push(...col.notas);
      const { composicion: _c, capas: _k, ...base } = p;
      maqueta = { ...base, textos: p.textos.map((t) => (col.textos[t.clave] ? { ...t, texto: col.textos[t.clave]! } : t)), capas: col.capas };
    } else {
      const { composicion: _c, capas, ...base } = p;
      maqueta = { ...base, capas: capas ?? [] };
    }
    const compilada = compilarIntencion(maqueta, contexto);
    problemas.push(...compilada.problemas);
    if (compilada.problemas.length) return { maqueta, problemas, avisos: [], arreglos };
    const leida = Intencion.safeParse(compilada.intencion);
    if (!leida.success) return { maqueta, problemas: [...problemas, ...describirProblemas(leida.error).map((x) => `La intención compilada no es válida: ${x}`)], avisos: [], arreglos };
    const intencion = conNotasDelEstudio(leida.data, vocesDeEstudio, arreglos);
    let avisos: string[] = [];
    let png: string | undefined;
    // Solo se pinta lo que ya pasa las comprobaciones del dominio: pintar cuesta segundos y no cambia el veredicto.
    if (deps.probar && problemas.length === 0) {
      const prueba = await deps.probar(intencion);
      problemas.push(...prueba.errores);
      avisos = prueba.avisos;
      png = prueba.png;
    }
    const aviso = avisoDeCruce(maqueta, tieneMascara);
    if (aviso) avisos = [...avisos, aviso];
    if (exigible && !p.excepcion) {
      problemas.push(...avisos.filter((a) => OFICIO_OBLIGATORIO.test(a)).map((a) => `${a} (obligatorio cuando la foto tiene plato recortable y aire; si es a propósito, explícalo en «excepcion»)`));
      avisos = avisos.filter((a) => !OFICIO_OBLIGATORIO.test(a));
    }
    return { maqueta, intencion, problemas, avisos, arreglos, ...(png ? { png } : {}) };
  };

  /** Prueba la propuesta y, si lo que falla lo puede arreglar el código (tinta, velo, tamaño del titular), lo arregla. */
  const evaluarYArreglar = async (p: PropuestaDeDiseno): Promise<Evaluacion> => {
    const primera = await evaluar(p);
    if (!p.composicion || primera.problemas.length === 0 || !primera.maqueta) return primera;
    const ajustes = arreglosPara(primera.problemas, primera.maqueta, colores);
    if (!ajustes) return primera;
    const segunda = await evaluar(p, ajustes.ajustes);
    segunda.arreglos.unshift(...ajustes.descripcion);
    return segunda.problemas.length <= primera.problemas.length ? segunda : primera;
  };

  const intentos: Intento[] = [];
  let devolver: string[] = [];
  let mejor: { propuesta: PropuestaDeDiseno; e: Evaluacion } | undefined;
  for (let n = 1; n <= MAX_PROPUESTAS; n++) {
    const propuesta = await deps.director.proponer(encargo, devolver);
    const e = await evaluarYArreglar(propuesta);
    intentos.push({ origen: 'director', problemas: e.problemas, avisos: e.avisos, arreglos: e.arreglos });
    if (!mejor || e.problemas.length === 0 || mejor.e.problemas.length > 0) mejor = { propuesta, e };
    const devolubles = e.avisos.filter((a) => !AVISOS_AJENOS.test(a));
    if (e.problemas.length === 0 && (devolubles.length === 0 || n === MAX_PROPUESTAS)) break;
    devolver = [...e.problemas, ...devolubles.map((a) => `(aviso de oficio) ${a}`)];
  }

  // Crítica visual: solo sobre una pieza que ya cumple todo lo medible, y una vuelta como mucho.
  let critica: ResultadoDiseno['critica'];
  if (deps.critico && mejor && mejor.e.problemas.length === 0 && mejor.e.png) {
    const c = await deps.critico.criticar(encargo, mejor.propuesta, mejor.e.png);
    critica = { llega: c.llega, motivos: c.motivos, adoptada: false };
    if (!c.llega && c.propuesta) {
      const e = await evaluarYArreglar(c.propuesta);
      intentos.push({ origen: 'critica', problemas: e.problemas, avisos: e.avisos, arreglos: e.arreglos });
      if (e.problemas.length === 0) {
        mejor = { propuesta: c.propuesta, e };
        critica.adoptada = true;
      }
    }
  }

  const final = mejor!;
  return {
    propuesta: final.propuesta,
    ...(final.e.intencion ? { intencion: final.e.intencion } : {}),
    problemas: final.e.problemas,
    avisos: [...final.e.avisos, ...(critica && !critica.llega && !critica.adoptada ? critica.motivos.map((m) => `CRITICA: ${m}`) : [])],
    intentos,
    ...(critica ? { critica } : {}),
    mapa,
  };
}

/** Los arreglos que el código sabe hacer sin el modelo: velo y tinta clara donde falta contraste; titular más alto si falta escala. */
export function arreglosPara(problemas: string[], maqueta: Maqueta, colores: ColorDisponible[]): { ajustes: Ajustes; descripcion: string[] } | undefined {
  const velos = new Set<'arriba' | 'abajo'>();
  const tintas: Record<string, string> = {};
  const descripcion: string[] = [];
  const clara = [...colores].sort((a, b) => contraste(a.hex, '#FFFFFF') - contraste(b.hex, '#FFFFFF'))[0];
  for (const p of problemas) {
    const m = /^CONTRASTE: «([^»]+)»/.exec(p);
    if (!m || !clara) continue;
    const capa = maqueta.capas.find((c) => (c.tipo === 'texto' || c.tipo === 'anotacion') && c.id === m[1]);
    if (!capa || !('caja' in capa) || !capa.caja) continue;
    const lado = (capa.caja.fila[0]! + capa.caja.fila[1]!) / 2 <= 8.5 ? 'arriba' : 'abajo';
    velos.add(lado);
    tintas[m[1]!] = clara.token;
    descripcion.push(`Arreglo del código: velo ${lado} y tinta @${clara.token} para «${m[1]}» (contraste medido insuficiente).`);
  }
  const titularMasAlto = problemas.some((p) => /^JERARQUIA:/.test(p)) ? 2 : 0;
  if (titularMasAlto) descripcion.push('Arreglo del código: el titular, dos filas más alto (no había salto de escala).');
  if (!velos.size && !titularMasAlto) return undefined;
  return { ajustes: { velos: [...velos], tintas, titularMasAlto }, descripcion };
}

/** Las voces que propone el estudio y lo que ha decidido el código quedan escritos en las notas de la intención. */
function conNotasDelEstudio(i: Intencion, vocesDeEstudio: Record<string, EstiloTexto>, arreglos: string[]): Intencion {
  const usadas = new Set(i.capas.flatMap((c) => ('estilo' in c && typeof c.estilo === 'string' ? [c.estilo] : [])));
  const voces = Object.entries(vocesDeEstudio)
    .filter(([id]) => usadas.has(id))
    .map(([id, e]) => `Voz «${id}» (${e.fuente}): ${PENDIENTE}.`);
  const extra = [...voces, ...arreglos].join(' ');
  return extra ? { ...i, notas: `${i.notas} ${extra}`.trim() } : i;
}

/**
 * El compositor solo mide el cruce que se le pide: si todos los textos van «aparte», no avisa de nada aunque la pieza sea
 * el titular encima y la foto debajo, que es justo lo que delata una plantilla (INVESTIGACION.md §3.1, relación «cruza»).
 */
export function avisoDeCruce(p: Pick<Maqueta, 'capas'>, tieneMascara: boolean): string | undefined {
  if (!tieneMascara) return undefined;
  const tocan = p.capas.some((c) => (c.tipo === 'texto' && c.relacion !== 'aparte') || c.tipo === 'anotacion' || (c.tipo === 'patron' && c.motivo === 'palabra'));
  if (tocan) return undefined;
  return 'CRUCE: ningún texto se relaciona con el plato (todos van «aparte»): titular y foto quedan como dos bloques apilados. Usa un mecanismo que cruce (TITULAR_DETRAS, TITULAR_CON_ACENTO) o anotaciones que señalen el plato.';
}

/**
 * Los colores de la marca y, medidos en la foto, el del plato (el acento que «sale de la comida») y el que domina la
 * foto (para que un fondo liso continúe la foto). Un color medido que casi repite uno de la marca no se añade.
 */
export function coloresDisponibles(marca: Tokens, mapa: MapaDeFoto): { colores: ColorDisponible[]; coloresMedidos: Record<string, string> } {
  const colores: ColorDisponible[] = Object.entries(marca.colores).map(([token, hex]) => ({ token, hex: hex.toUpperCase(), papel: 'de la marca' }));
  const coloresMedidos: Record<string, string> = {};
  const parecido = (hex: string) => colores.some((c) => contraste(c.hex, hex) < 1.15);
  const anadir = (token: string, hex: string | undefined, papel: string) => {
    if (!hex || token in marca.colores || parecido(hex)) return;
    colores.push({ token, hex: hex.toUpperCase(), papel });
    coloresMedidos[token] = hex.toUpperCase();
  };
  anadir('plato', mapa.vivo, 'medido: el color más vivo del plato');
  const dominante: ColorDominante | undefined = mapa.paleta[0];
  anadir('foto', dominante?.hex, `medido: el que domina la foto (${Math.round((dominante?.peso ?? 0) * 100)} %)${dominante && croma(dominante.hex) < 0.04 ? ', casi neutro' : ''}`);
  return { colores, coloresMedidos };
}

const MANUSCRITAS = /caveat|sacramento|kaushan|ballet/;
const ACENTOS = /ballet|kaushan|sacramento|bodoni-moda-italica|fraunces-italica|instrument-serif-italica/;

/**
 * La voz de acento que pide la referencia, si su titular es de florituras, manuscrito o una didona (ficha.tipografia):
 * Ballet para las florituras y la caligrafía formal, Bodoni Moda itálica para la didona, Sacramento para la monolineal.
 */
export function acentoQuePide(ficha: FichaReferencia | undefined): { fuente: string; ejes: Record<string, number> } | undefined {
  const clases = (ficha?.tipografia ?? []).filter((t) => t.rol === 'TITULAR' || t.rol === 'SECUNDARIO').map((t) => t.clasificacion.toLowerCase()).join(' ');
  if (/florituras|script|caligr|swash/.test(clases)) return { fuente: 'ballet', ejes: { opsz: 72 } };
  if (/monolineal|manuscrit/.test(clases)) return { fuente: 'sacramento', ejes: {} };
  if (/didona|cursiva|itálica|italica/.test(clases)) return { fuente: 'bodoni-moda-italica', ejes: { opsz: 96, wght: 500 } };
  return undefined;
}

/** Las voces de la marca, las que añade el estudio si hacen falta, y qué voz hace cada papel en un mecanismo. */
export function vocesDisponibles(
  marca: Tokens,
  colores: ColorDisponible[],
  describirFuente: (fuente: string) => string = (f) => f,
  ficha?: FichaReferencia,
): { voces: VozDisponible[]; vocesDeEstudio: Record<string, EstiloTexto>; roles: VocesDeLaPieza } {
  const describir = (e: EstiloTexto) =>
    [describirFuente(e.fuente), Object.entries(e.ejes).map(([k, v]) => `${k} ${v}`).join(', '), e.caso === 'mayusculas' ? 'en mayúsculas' : '', e.tracking >= 0.08 ? 'espaciada' : '', `color ${e.color}`]
      .filter(Boolean)
      .join(' · ');
  const voces: VozDisponible[] = Object.entries(marca.estilos).map(([id, e]) => ({ id, descripcion: `${describir(e)} (de la marca)` }));
  const vocesDeEstudio: Record<string, EstiloTexto> = {};
  const ids = Object.keys(marca.estilos);
  const buscar = (patron: RegExp) => ids.find((id) => patron.test(id));
  const conFuente = (patron: RegExp) => ids.find((id) => patron.test(marca.estilos[id]!.fuente));
  const titular = buscar(/titular|palabra|frase/) ?? ids[0] ?? 'titular';
  const apoyo = buscar(/texto|apoyo/) ?? buscar(/versalita|rotulo|firma/) ?? titular;
  const firma = buscar(/rotulo|firma|versalita/) ?? apoyo;
  // Tintas para las voces del estudio: el color con más carácter (ni el más oscuro ni el más claro), si lo hay.
  const porLuz = [...colores].sort((a, b) => contraste(b.hex, '#FFFFFF') - contraste(a.hex, '#FFFFFF'));
  const conCaracter = porLuz.slice(1, -1).find((c) => c.papel === 'de la marca') ?? porLuz[porLuz.length - 1];

  let anotacion = conFuente(MANUSCRITAS);
  if (!anotacion && !(VOZ_ANOTACION in marca.estilos) && conCaracter) {
    const estilo: EstiloTexto = { fuente: 'caveat', ejes: { wght: 600 }, caso: 'tal-cual', tracking: 0, interlineado: 1.05, color: `@${conCaracter.token}`, rasgos: [] };
    vocesDeEstudio[VOZ_ANOTACION] = estilo;
    voces.push({ id: VOZ_ANOTACION, descripcion: `${describir(estilo)} (del estudio: solo para anotaciones cortas con flecha; nunca un dato)` });
    anotacion = VOZ_ANOTACION;
  } else if (!anotacion && VOZ_ANOTACION in marca.estilos) anotacion = VOZ_ANOTACION;

  let acento = conFuente(ACENTOS);
  const pide = acentoQuePide(ficha);
  if (!acento && pide && conCaracter) {
    const estilo: EstiloTexto = { fuente: pide.fuente, ejes: pide.ejes, caso: 'tal-cual', tracking: 0, interlineado: 0.95, color: `@${conCaracter.token}`, rasgos: [] };
    vocesDeEstudio[VOZ_ACENTO] = estilo;
    voces.push({ id: VOZ_ACENTO, descripcion: `${describir(estilo)} (${PENDIENTE}: la pide el titular de la referencia; solo para el acento de TITULAR_CON_ACENTO, nunca en lugar del titular de la marca)` });
    acento = VOZ_ACENTO;
  }
  return { voces, vocesDeEstudio, roles: { titular, apoyo, firma, ...(acento ? { acento } : {}), ...(anotacion ? { anotacion } : {}) } };
}

/** Ancho medio de un carácter al cuerpo pequeño (34 px): las mayúsculas espaciadas ocupan más. Es una estimación por arriba. */
function anchoDeCaracter(e: EstiloTexto): number {
  const base = e.caso === 'mayusculas' ? 0.72 : 0.52;
  return 34 * (base + Math.max(0, e.tracking));
}
