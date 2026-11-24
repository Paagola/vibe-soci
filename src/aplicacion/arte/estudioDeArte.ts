/**
 * Estudio de arte · de un brief a varias direcciones pintadas, criticadas y corregidas.
 *
 *   foto + hechos + marca ─► mapa de la foto (código) ─► referencias del corpus (bibliotecario)
 *   ─► director de arte: N direcciones (recetas) ─► comprobación: textos frente a hechos, variedad entre direcciones,
 *      compilación ─► si algo falla, se le devuelve UNA vez
 *   ─► por dirección: compilar (compilarReceta) ─► pintar (compositor) ─► medir (avisos, OCR a 360 px)
 *      ─► crítico con rúbrica ─► parche ─► se pinta y se vuelve a criticar; el parche se queda solo si sube la nota
 *   ─► comparador a ciegas a tamaño móvil ─► informe.
 *
 * El modelo decide; el código garantiza; la crítica mide (informe de dirección de arte, §4.1).
 */
import { compilarReceta, type EntornoArte } from '../../dominio/arte/compilarReceta.js';
import { VOCES_DE_ESTUDIO, type Receta } from '../../dominio/arte/receta.js';
import { elegirReferencias, carpetaDelLocal, referenciaEnTexto, type PiezaDeReferencia } from '../../dominio/arte/referencias.js';
import { nota, problemasDeVariedad, type Critica } from '../../dominio/arte/rubrica.js';
import { contraste } from '../../dominio/diseno/color.js';
import { Intencion, type EstiloTexto, type Tokens } from '../../dominio/diseno/intencion.js';
import type { MapaDeFoto } from '../../dominio/diseno/mapaDeFoto.js';
import { compilarIntencion, problemasDeTextos, type CapaPropuesta, type HechosDeLaPieza, type Maqueta } from '../../dominio/diseno/propuesta.js';
import { describirProblemas } from '../../dominio/validacion.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { MedidorDeFoto } from '../../puertos/DirectorDeDiseno.js';
import type { ComparadorDeArte, CriticoDeArte, DirectorDeArte, EncargoDeArte } from '../../puertos/EstudioDeArte.js';
import { coloresDisponibles, vocesDisponibles } from '../diseno/proponerDiseno.js';

export interface Pintura {
  png: string;
  movil: string;
  errores: string[];
  avisos: string[];
}

export interface DepsEstudioDeArte {
  director: DirectorDeArte;
  critico: CriticoDeArte;
  comparador?: ComparadorDeArte;
  medidor: MedidorDeFoto;
  /** La silueta del sujeto dentro de su caja, en rejilla: para saber qué celdas pisa el producto recortado de verdad. */
  silueta?: (foto: ActivoDisponible) => Promise<{ columnas: number; filas: number; ocupacion: number[] } | undefined>;
  /** Compone la intención y devuelve el PNG (1080 × 1440), su versión a 360 px y los problemas del compositor. */
  pintar: (intencion: Intencion, carpeta: string) => Promise<Pintura>;
  /** Genera (una vez por descripción) la imagen de una ESCENA sin comida y la registra como activo del local. */
  escena?: (describe: string, contexto: { local: string; luz: string }) => Promise<ActivoDisponible>;
  /** Genera (una vez por descripción, estilo y color) un ELEMENTO gráfico y lo registra como activo recortable. */
  elemento?: (describe: string, contexto: { local: string; color: string; estilo: 'trazo' | 'forma'; centroVacio: boolean }) => Promise<ActivoDisponible>;
  /** Inserción en contexto: dibuja sobre la pieza pintada (carpeta de su versión) y protege sus capas. */
  insertar?: (pieza: { png: string }, instruccion: string, contexto: { id: string; referencia?: string; carpeta: string; reestilizar?: string[] }) => Promise<{ png: string; movil: string; medidas: string[] }>;
  /** Genera (una vez por descripción y color) un GARABATO a tinta y lo registra como activo recortable del color pedido. */
  garabato?: (describe: string, contexto: { local: string; color: string }) => Promise<ActivoDisponible>;
  /** Mide un texto en un estilo con el motor tipográfico: ancho a ese cuerpo y altura de mayúsculas (por cuerpo). */
  metricas?: { ancho(estilo: EstiloTexto, texto: string, tamano: number): number; mayusculas(estilo: EstiloTexto): number };
  /** Lee el texto de una imagen (OCR). */
  leer?: (png: string) => Promise<string[]>;
  corpus: { piezas: PiezaDeReferencia[]; ruta: (archivo: string) => string };
  informar?: (linea: string) => void;
}

export interface EntradaEstudioDeArte {
  id: string;
  local: string;
  foto: ActivoDisponible;
  hechos: HechosDeLaPieza;
  tokensMarca: Tokens;
  mensaje: string;
  creativo: boolean;
  direcciones: number;
  /** Vueltas de crítica por dirección (cada una puede traer un parche). */
  vueltas: number;
  /** Carpeta donde se guarda todo. */
  salida: string;
  anteriores?: string[];
  referencias?: number;
  /** Modo referencia: el post que eligió el cliente. Las direcciones parten de él y lo mejoran. */
  referencia?: { id: string; ruta: string; ficha?: unknown };
  /** Al final, enriquecer la mejor dirección (o todas) con elementos gráficos (aislados e insertados) y compararlas. */
  enriquecer?: boolean | 'todas';
  /** Enriquecer también con los elementos generados por separado y colocados por el código (por defecto, solo inserción en contexto). */
  aislados?: boolean;
  /**
   * Esqueletos de las otras láminas de la serie (un carrusel): un parche del crítico no puede convertir esta lámina en
   * otra igual (Torre de Vega, 23/11: el despiece acabó siendo una segunda portada).
   */
  evitarEsqueletos?: string[];
}

export interface Vuelta {
  n: number;
  receta: Receta;
  png?: string;
  movil?: string;
  problemas: string[];
  avisos: string[];
  medidas: string[];
  critica?: Critica;
  nota?: number;
  /** El parche se quedó (ganó la comparación a ciegas) o se descartó. */
  adoptada?: boolean;
  /** Lo que dijo el comparador al enfrentarla con la mejor anterior. */
  comparacion?: string;
}

export interface DireccionPintada {
  nombre: string;
  vueltas: Vuelta[];
  mejor?: Vuelta;
}

export interface ResultadoEstudioDeArte {
  encargo: EncargoDeArte;
  referencias: PiezaDeReferencia[];
  propuestas: number;
  devuelto: string[];
  direcciones: DireccionPintada[];
  comparacion?: { orden: string[]; plantilla: string[][]; motivo: string; letras: Record<string, string> };
  /** Modo referencia: lo que el director estudió de la referencia. */
  analisis?: unknown;
  /** El enriquecimiento de la mejor dirección (o de todas): los elementos, las dos maneras de añadirlos y la comparación. */
  enriquecimientos?: Array<{
    direccion: string;
    porque: string;
    mejoras?: Array<{ categoria: string; que: string; instruccion: string }>;
    elementos: unknown[];
    insercion: string;
    versiones: Array<{ nombre: string; png?: string; movil?: string; nota?: number; critica?: Critica; medidas: string[] }>;
    comparacion?: { orden: string[]; motivo: string; letras: Record<string, string> };
  }>;
  mapa: MapaDeFoto;
}

const CREATIVO = { maxPalabras: 4, maxTextos: 2 };

/** Ancho medio de un carácter al cuerpo pequeño (34 px): como en proponerDiseno. */
const anchoDeCaracter = (e: Pick<EstiloTexto, 'caso' | 'tracking'>) => 34 * ((e.caso === 'mayusculas' ? 0.72 : 0.52) + Math.max(0, e.tracking));

/**
 * Lo que el estudio sabe de un encargo antes de decidir nada: el mapa de la foto, los colores y las voces disponibles,
 * los cortes del producto y las referencias del corpus. Lo usan el estudio y el planificador de lotes.
 */
export async function prepararEncargo(deps: Pick<DepsEstudioDeArte, 'medidor' | 'silueta' | 'corpus'>, entrada: EntradaEstudioDeArte) {
  const { foto } = entrada;
  const mapa = await deps.medidor.medir(foto);
  const tieneMascara = Boolean(foto.rutaMascara) && Boolean(mapa.sujeto);
  const { colores, coloresMedidos } = coloresDisponibles(entrada.tokensMarca, mapa);
  const { voces: vocesMarca, vocesDeEstudio: deF3, roles } = vocesDisponibles(entrada.tokensMarca, colores);

  // Las voces del estudio llevan de color el de la marca con más carácter: el código pone la tinta de cada texto igualmente.
  const porLuz = [...colores].sort((a, b) => contraste(b.hex, '#FFFFFF') - contraste(a.hex, '#FFFFFF'));
  const conCaracter = porLuz.slice(1, -1).find((c) => c.papel === 'de la marca') ?? porLuz[0]!;
  const vocesDeEstudio: Record<string, EstiloTexto> = { ...deF3 };
  for (const [id, v] of Object.entries(VOCES_DE_ESTUDIO)) vocesDeEstudio[id] = { ...v.estilo, color: `@${conCaracter.token}` } as EstiloTexto;
  // Para el esqueleto PATRON, cada voz tiene una variante «-patron» con más interlineado (aire entre filas). No se le
  // ofrece al director: la elige el código.
  for (const [id, e] of Object.entries({ ...entrada.tokensMarca.estilos, ...vocesDeEstudio })) {
    if (!id.endsWith('-patron')) vocesDeEstudio[`${id}-patron`] = { ...e, interlineado: Math.max(e.interlineado, 1.14) };
  }
  const estilos: Record<string, EstiloTexto> = { ...entrada.tokensMarca.estilos, ...vocesDeEstudio };
  const papelDe = (id: string) => VOCES_DE_ESTUDIO[id]?.papel ?? (id === roles.titular ? 'titular de la marca' : id === roles.firma ? 'firma de la marca' : id === roles.anotacion ? 'anotacion' : id === roles.acento ? 'acento' : 'apoyo de la marca');
  const voces = [
    ...vocesMarca.map((v) => ({ ...v, papel: papelDe(v.id) })),
    ...Object.entries(VOCES_DE_ESTUDIO).map(([id, v]) => ({ id, descripcion: `${v.describe} (del estudio)`, papel: v.papel })),
  ];
  const marca = { ...roles, anotacion: roles.anotacion ?? 'estudio-rotulador' };

  const rejilla = deps.silueta ? await deps.silueta(foto) : undefined;
  const cortes: string[] = [];
  const bbox = foto.activo.mascara?.bbox;
  if (bbox) {
    if (bbox.y <= 2) cortes.push('arriba');
    if (bbox.y + bbox.h >= foto.activo.alto - 2) cortes.push('abajo');
    if (bbox.x <= 2) cortes.push('la izquierda');
    if (bbox.x + bbox.w >= foto.activo.ancho - 2) cortes.push('la derecha');
  }

  const referencias = elegirReferencias(deps.corpus.piezas, { carpetas: carpetaDelLocal(`${entrada.hechos.local.descripcion} ${entrada.hechos.plato}`), n: entrada.referencias ?? 5, semilla: `${entrada.local}/${foto.activo.id}` });
  const encargo: EncargoDeArte = {
    hechos: entrada.hechos,
    mensaje: entrada.mensaje,
    creativo: entrada.creativo,
    foto: foto.ruta,
    mapa,
    cortes,
    colores,
    voces,
    referencias: referencias.map((p, i) => ({ ruta: deps.corpus.ruta(p.archivo), texto: referenciaEnTexto(p, i) })),
    direcciones: entrada.direcciones,
    ...(entrada.anteriores ? { anteriores: entrada.anteriores } : {}),
    ...(entrada.referencia ? { referencia: entrada.referencia } : {}),
  };
  return { mapa, tieneMascara, colores, coloresMedidos, roles, conCaracter, vocesDeEstudio, estilos, voces, marca, rejilla, cortes, bbox, referencias, encargo };
}

export async function estudioDeArte(deps: DepsEstudioDeArte, entrada: EntradaEstudioDeArte): Promise<ResultadoEstudioDeArte> {
  const log = deps.informar ?? (() => {});
  const { foto } = entrada;
  const { mapa, tieneMascara, colores, coloresMedidos, roles, conCaracter, vocesDeEstudio, estilos, voces: _voces, marca, rejilla, cortes, bbox, referencias, encargo } = await prepararEncargo(deps, entrada);

  const entorno: EntornoArte = {
    mapa,
    tieneMascara,
    colores: colores.map((c) => ({ token: c.token, hex: c.hex })),
    voces: Object.keys(estilos),
    vocesDeMarca: Object.keys(entrada.tokensMarca.estilos),
    marca,
    textos: {},
    colorDeVoz: Object.fromEntries(Object.entries(estilos).map(([id, e]) => [id, e.color.replace(/^@/, '')])),
    anchoDeCaracter: Object.fromEntries(Object.entries(estilos).map(([id, e]) => [id, anchoDeCaracter(e)])),
    ...(bbox ? { silueta: { ...bbox, anchoFoto: foto.activo.ancho, altoFoto: foto.activo.alto, ...(rejilla ? { rejilla } : {}) } } : {}),
    ...(deps.metricas
      ? {
          medir: {
            ancho: (voz: string, texto: string, tamano: number) => {
              const e = estilos[voz];
              return e ? deps.metricas!.ancho(e, e.caso === 'mayusculas' ? texto.toLocaleUpperCase('es') : texto, tamano) : texto.length * tamano * 0.6;
            },
            mayusculas: (voz: string) => (estilos[voz] ? deps.metricas!.mayusculas(estilos[voz]!) : 0.7),
            interlineado: (voz: string) => estilos[voz]?.interlineado ?? 1,
          },
        }
      : {}),
  };
  const contexto = (id: string, version: number) => ({
    id,
    version,
    titulo: `${entrada.hechos.local.nombre} · ${id}`,
    marca: entrada.local,
    foto: foto.activo.id,
    tieneMascara,
    colores: Object.fromEntries(colores.map((c) => [c.token, c.hex])),
    voces: Object.keys(estilos),
    vocesDeEstudio,
    coloresMedidos,
    conReferencia: false,
  });

  /** De la receta a la intención: textos, compilación de la receta, compilación de la maqueta y esquema. */
  const compilar = (r: Receta, id: string, version: number, escena?: { activo: string; mapa: MapaDeFoto }, garabato?: string, ajustes?: Ajustes, elementos?: Array<string | undefined>): { intencion?: Intencion; problemas: string[]; notas: string[] } => {
    const problemas = problemasDeTextos(r.textos, entrada.hechos, { titularCreativo: entrada.creativo, creativo: CREATIVO });
    const textos = Object.fromEntries(r.textos.map((t) => [t.clave, t.texto]));
    // Holgura del maquetador: si algo no cabe por falta de sitio, se baja el producto un paso antes de devolverlo.
    const ent = { ...entorno, textos, ...(escena ? { escena: escena.mapa } : {}), ...(garabato ? { garabato: true } : {}), ...(elementos?.length ? { elementos: elementos.map(Boolean) } : {}) };
    let c = compilarReceta(r, ent);
    const deSitio = (ps: string[]) => ps.filter((x) => /^(No cabe|No hay sitio|No hay hueco)/.test(x)).length;
    for (const escala of r.producto.escala === 'enorme' ? (['grande', 'contenida'] as const) : r.producto.escala === 'grande' ? (['contenida'] as const) : []) {
      if (!deSitio(c.problemas)) break;
      const otra = compilarReceta({ ...r, producto: { ...r.producto, escala } }, ent);
      if (deSitio(otra.problemas) < deSitio(c.problemas)) c = { ...otra, notas: [...otra.notas, `El código bajó el producto de «${r.producto.escala}» a «${escala}» para que quepan los textos.`] };
    }
    // Sin aire para el acento manuscrito, se prueba sin él (el titular y el resto de la idea se mantienen).
    if (r.acentoManuscrito && c.problemas.some((x) => /acento hacen falta/.test(x))) {
      const { acentoManuscrito: _a, ...sinAcento } = r;
      const otra = compilarReceta(sinAcento, ent);
      if (otra.problemas.length < c.problemas.length) c = { ...otra, notas: [...otra.notas, 'El código quitó el acento manuscrito: no había aire para él.'] };
    }
    problemas.push(...c.problemas);
    const maqueta: Maqueta = {
      idea: r.idea,
      foco: r.esqueleto === 'CARTEL' || r.esqueleto === 'COLUMNA' ? 'TITULAR' : 'PLATO',
      seToma: [],
      noSeCopia: [],
      textos: r.textos.map((t) => (c.textos[t.clave] ? { ...t, texto: c.textos[t.clave]! } : t)),
      capas: ajustes ? aplicarAjustes(c.capas, ajustes) : c.capas,
      montaje: c.montaje,
    };
    const extra: Record<string, string> = { ...(escena ? { escena: escena.activo } : {}), ...(garabato ? { garabato } : {}) };
    for (const [i, a] of (elementos ?? []).entries()) if (a) extra[`elemento${i + 1}`] = a;
    let compilada: ReturnType<typeof compilarIntencion>;
    try {
      compilada = compilarIntencion(maqueta, { ...contexto(id, version), ...(Object.keys(extra).length ? { activosExtra: extra } : {}) });
    } catch (error) {
      // Una caja fuera de la retícula es un fallo de colocación: se devuelve como problema, no tumba el encargo.
      if (error instanceof RangeError) return { problemas: [...problemas, `No se puede colocar: ${error.message}`], notas: c.notas };
      throw error;
    }
    problemas.push(...compilada.problemas);
    if (problemas.length) return { problemas, notas: c.mesa ? [...c.notas, `Retícula ocupada:\n${c.mesa}`] : c.notas };
    const leida = Intencion.safeParse(compilada.intencion);
    if (!leida.success) return { problemas: describirProblemas(leida.error).map((x) => `La intención compilada no es válida: ${x}`), notas: c.notas };
    const usadas = new Set(leida.data.capas.flatMap((k) => ('estilo' in k && typeof k.estilo === 'string' ? [k.estilo] : [])));
    const delEstudio = [...usadas].filter((v) => v in vocesDeEstudio).map((v) => `voz «${v}» (${vocesDeEstudio[v]!.fuente}) propuesta por el estudio`);
    const notas = [...c.notas, ...delEstudio];
    return { intencion: { ...leida.data, notas: `${leida.data.notas} ${notas.join(' ')}`.trim() }, problemas: [], notas };
  };

  // ------------------------------------------------------------------ Escenas generadas (Nano Banana Pro), una por descripción
  const escenas = new Map<string, Promise<{ activo: string; mapa: MapaDeFoto } | undefined>>();
  const luz = `${mapa.temperatura.toLowerCase()} light, ${mapa.luzMedia < 0.3 ? 'low-key and dark' : mapa.luzMedia > 0.6 ? 'bright and airy' : 'medium key'}`;
  const prepararEscena = (r: Receta) => {
    const op = r.operaciones.find((o): o is Extract<Receta['operaciones'][number], { tipo: 'ESCENA' }> => o.tipo === 'ESCENA');
    if (!op || !deps.escena) return Promise.resolve(undefined);
    if (!escenas.has(op.describe)) {
      escenas.set(
        op.describe,
        (async () => {
          try {
            log(`· Escena para «${r.nombre}»: ${op.describe}`);
            const foto = await deps.escena!(op.describe, { local: entrada.local, luz });
            return { activo: foto.activo.id, mapa: await deps.medidor.medir(foto) };
          } catch (error) {
            log(`  ! La escena no se pudo generar: ${(error as Error).message.slice(0, 300)}`);
            return undefined;
          }
        })(),
      );
    }
    return escenas.get(op.describe)!;
  };

  const garabatos = new Map<string, Promise<string | undefined>>();
  const prepararGarabato = (r: Receta) => {
    const op = r.operaciones.find((o): o is Extract<Receta['operaciones'][number], { tipo: 'GARABATO' }> => o.tipo === 'GARABATO');
    if (!op || !deps.garabato) return Promise.resolve(undefined);
    const tinta = colores.find((c) => `@${c.token}` === (op.color ?? r.acento ?? ''))?.hex ?? conCaracter.hex;
    const clave = `${op.describe}|${tinta}`;
    if (!garabatos.has(clave)) {
      garabatos.set(
        clave,
        (async () => {
          try {
            log(`· Garabato para «${r.nombre}»: ${op.describe}`);
            return (await deps.garabato!(op.describe, { local: entrada.local, color: tinta })).activo.id;
          } catch (error) {
            log(`  ! El garabato no se pudo generar: ${(error as Error).message.slice(0, 300)}`);
            return undefined;
          }
        })(),
      );
    }
    return garabatos.get(clave)!;
  };

  const elementosGenerados = new Map<string, Promise<string | undefined>>();
  const prepararElementos = async (r: Receta): Promise<Array<string | undefined>> => {
    if (!deps.elemento || !r.elementos.length) return [];
    return Promise.all(
      r.elementos.map((el) => {
        const tinta = colores.find((c) => `@${c.token}` === (el.color ?? r.acento ?? ''))?.hex ?? conCaracter.hex;
        const clave = `${el.describe}|${el.estilo}|${el.donde}|${tinta}`;
        if (!elementosGenerados.has(clave)) {
          elementosGenerados.set(
            clave,
            (async () => {
              try {
                log(`· Elemento para «${r.nombre}»: ${el.describe}`);
                return (await deps.elemento!(el.describe, { local: entrada.local, color: tinta, estilo: el.estilo, centroVacio: el.donde === 'alrededor-del-producto' })).activo.id;
              } catch (error) {
                log(`  ! El elemento no se pudo generar: ${(error as Error).message.slice(0, 300)}`);
                return undefined;
              }
            })(),
          );
        }
        return elementosGenerados.get(clave)!;
      }),
    );
  };

  // ------------------------------------------------------------------ Direcciones
  // Una propuesta del director; si las direcciones se parecen entre sí, una segunda. Después, cada dirección que no
  // compila vuelve sola al director UNA vez (reparar), sin tirar las demás.
  let devuelto: string[] = [];
  let recetas: Receta[] = [];
  let propuestas = 0;
  let analisis: unknown;
  for (let n = 1; n <= 2; n++) {
    log(`· Director de arte: ${n === 1 ? 'propuesta' : 'segunda propuesta (variedad)'}${encargo.referencia ? ` a partir de la referencia «${encargo.referencia.id}»` : ''}…`);
    if (encargo.referencia && deps.director.inspirar) {
      const p = await deps.director.inspirar(encargo, devuelto);
      analisis = p.analisis;
      recetas = p.direcciones;
    } else recetas = (await deps.director.proponer(encargo, devuelto)).direcciones;
    propuestas++;
    // Con referencia, las direcciones son hermanas a propósito (mismo mecanismo): no se les pide que difieran.
    const variedad = encargo.referencia ? [] : problemasDeVariedad(recetas);
    for (const x of variedad) log(`  ! ${x}`);
    if (!variedad.length || n === 2) break;
    devuelto = variedad;
  }
  for (const [i, r] of recetas.entries()) {
    const c = compilar(r, 'prueba', 1);
    if (!c.problemas.length) continue;
    for (const x of c.problemas) log(`  ! «${r.nombre}»: ${x}`);
    log(`· Director de arte: reparar «${r.nombre}»…`);
    try {
      const reparada = await deps.director.reparar(encargo, r, c.problemas);
      const c2 = compilar(reparada, 'prueba', 1);
      for (const x of c2.problemas) log(`  ! «${reparada.nombre}» reparada: ${x}`);
      if (c2.problemas.length < c.problemas.length) recetas[i] = reparada;
    } catch (error) {
      log(`  ! No se pudo reparar: ${(error as Error).message.slice(0, 200)}`);
    }
  }

  // ------------------------------------------------------------------ Pintar, criticar, parchear
  // Las direcciones van en paralelo (cada una espera a su crítico); el orden del resultado es el de la propuesta.
  const direcciones: DireccionPintada[] = recetas.map((r) => ({ nombre: r.nombre, vueltas: [] }));
  await Promise.all(recetas.map(async (inicial, i) => {
    const slug = `${String(i + 1).padStart(2, '0')}-${inicial.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'direccion'}`;
    const d = direcciones[i]!;
    let receta = inicial;
    for (let v = 1; v <= entrada.vueltas + 1; v++) {
      const vuelta: Vuelta = { n: v, receta, problemas: [], avisos: [], medidas: [] };
      d.vueltas.push(vuelta);
      const elementosDeLaReceta = await prepararElementos(receta);
      const c = compilar(receta, `${entrada.id}-${slug}`, v, await prepararEscena(receta), await prepararGarabato(receta), undefined, elementosDeLaReceta);
      vuelta.problemas.push(...c.problemas);
      if (!c.intencion) {
        log(`✖ ${inicial.nombre} v${v}: no compila (${c.problemas.length} problemas).`);
        if (process.env.ARTE_DEPURAR) log(c.notas.join('\n'));
        break;
      }
      let pintura = await deps.pintar(c.intencion, `${entrada.salida}/${slug}/v${v}`);
      // Lo medible lo arregla el código antes de llamar al crítico: tinta que no contrasta, titular que pisa el producto.
      const ajustes = ajustesPara(pintura.errores, colores);
      if (ajustes) {
        const c2 = compilar(receta, `${entrada.id}-${slug}`, v, await prepararEscena(receta), await prepararGarabato(receta), ajustes, elementosDeLaReceta);
        if (c2.intencion) {
          const p2 = await deps.pintar(c2.intencion, `${entrada.salida}/${slug}/v${v}-arreglo`);
          log(`  arreglo del código en «${inicial.nombre}» v${v}: ${ajustes.descripcion.join(' · ')} → ${p2.errores.length} errores (antes ${pintura.errores.length})`);
          if (p2.errores.length < pintura.errores.length) {
            pintura = p2;
            vuelta.medidas.push(...ajustes.descripcion.map((x) => `ARREGLO ${x}`));
          }
        }
      }
      Object.assign(vuelta, { png: pintura.png, movil: pintura.movil });
      vuelta.problemas.push(...pintura.errores);
      vuelta.avisos.push(...pintura.avisos);
      vuelta.medidas.push(...pintura.errores.map((e) => `ERROR ${e}`), ...pintura.avisos.map((a) => `AVISO ${a}`));
      if (deps.leer) {
        const lineas = await deps.leer(pintura.movil);
        const leidas = norm(lineas.join(' '));
        const esperados = receta.textos.filter((t) => !receta.operaciones.some((o) => o.tipo === 'REPETICION' && o.texto === t.clave));
        const faltan = esperados.filter((t) => !norm(t.texto).split(' ').filter((p) => p.length > 2).every((p) => leidas.includes(p)));
        vuelta.medidas.push(`OCR a 360 px: se leen ${esperados.length - faltan.length} de ${esperados.length} textos${faltan.length ? ` (no se leen: ${faltan.map((t) => `«${t.texto.replace(/\n/g, ' ')}»`).join(', ')})` : ''}.`);
        // Un titular que no se lee en el móvil no es un detalle: es la pieza (Torre de Vega, 23/11: el hueso tapaba
        // «TRINCHADO»). Se repara como cualquier otro problema medido.
        // Con tolerancia: el OCR confunde letras sueltas («Croquelas»); lo que no lee es una palabra tapada («CHU», «TRJ»).
        const titular = esperados.find((t) => t.clave === receta.titular.texto && !seLee(t.texto, lineas));
        // Sin ninguna línea leída, el OCR no está disponible o falló: no se acusa al titular.
        // En COLUMNA el titular va girado y el OCR no lee texto vertical: ahí no se acusa (sería un falso positivo).
        if (titular && lineas.length && receta.esqueleto !== 'COLUMNA') vuelta.problemas.push(`LEGIBILIDAD: el titular «${titular.texto.replace(/\n/g, ' ')}» no se lee a 360 px (el producto lo tapa o la letra es demasiado fina): que el producto tape menos (relación «aparte» o el otro lado), o un titular de una línea.`);
      }
      log(`■ ${inicial.nombre} v${v} → ${pintura.png}${pintura.errores.length ? ` · ${pintura.errores.length} errores` : ''}`);
      const critica = await deps.critico.criticar(encargo, { receta, png: pintura.png, movil: pintura.movil, medidas: vuelta.medidas });
      vuelta.critica = critica;
      vuelta.nota = nota(critica.puntuaciones, pintura.errores.length === 0);
      log(`  crítica: ${vuelta.nota}/100 · ${critica.primeraLectura} · defecto: ${critica.defectoPrincipal}`);
      // El parche se queda si gana a la mejor vuelta en una comparación a ciegas a tamaño móvil (la nota absoluta del
      // crítico es ruidosa); sin comparador, si sube la nota.
      if (!d.mejor) d.mejor = vuelta;
      else {
        let gana = (vuelta.nota ?? 0) > (d.mejor.nota ?? 0);
        if (deps.comparador && d.mejor.movil && pintura.errores.length === 0) {
          const nuevaPrimero = (v + i) % 2 === 0;
          const par = nuevaPrimero ? [{ letra: 'A', movil: pintura.movil }, { letra: 'B', movil: d.mejor.movil }] : [{ letra: 'A', movil: d.mejor.movil }, { letra: 'B', movil: pintura.movil }];
          const r = await deps.comparador.comparar(par, encargo.referencia?.ruta);
          const letraNueva = nuevaPrimero ? 'A' : 'B';
          gana = r.orden[0] === letraNueva;
          vuelta.comparacion = r.motivo;
          log(`  comparación a ciegas v${v} contra v${d.mejor.n}: ${gana ? 'gana el parche' : 'gana la anterior'}`);
        }
        vuelta.adoptada = gana;
        if (gana) d.mejor = vuelta;
      }
      if (v > entrada.vueltas || !critica.parches.length || !critica.receta) break;
      // La siguiente vuelta parte de la mejor receta con el parche de la crítica de la mejor vuelta.
      if (d.mejor !== vuelta) break;
      if (critica.receta.esqueleto !== receta.esqueleto && entrada.evitarEsqueletos?.includes(critica.receta.esqueleto)) {
        log(`  ! El parche pasa a ${critica.receta.esqueleto}, que ya usa otra lámina de la serie: se descarta.`);
        break;
      }
      receta = critica.receta;
      // Un parche que no se puede ejecutar (un texto que no consta, algo que no cabe) vuelve UNA vez al director.
      const prueba = compilar(receta, 'prueba', 1);
      if (prueba.problemas.length) {
        log(`  ! El parche no compila: ${prueba.problemas.join(' · ').slice(0, 300)}`);
        try {
          receta = await deps.director.reparar(encargo, receta, prueba.problemas);
        } catch (error) {
          log(`  ! No se pudo reparar el parche: ${(error as Error).message.slice(0, 200)}`);
          break;
        }
      }
    }
  }));

  // ------------------------------------------------------------------ Comparación a ciegas
  let comparacion: ResultadoEstudioDeArte['comparacion'];
  const finales = direcciones.filter((d) => d.mejor?.movil);
  if (deps.comparador && finales.length >= 2) {
    const letras: Record<string, string> = {};
    const barajadas = [...finales].sort((a, b) => (a.mejor!.receta.esqueleto < b.mejor!.receta.esqueleto ? -1 : 1));
    const piezas = barajadas.map((d, i) => {
      const letra = String.fromCharCode(65 + i);
      letras[letra] = d.nombre;
      return { letra, movil: d.mejor!.movil! };
    });
    const r = await deps.comparador.comparar(piezas, encargo.referencia?.ruta);
    comparacion = { ...r, letras };
    log(`· Comparación a ciegas: ${r.orden.map((l) => letras[l] ?? l).join(' > ')}${r.plantilla.length ? ` · misma plantilla: ${r.plantilla.map((p) => p.map((l) => letras[l] ?? l).join(' = ')).join('; ')}` : ''}`);
  }
  // ------------------------------------------------------------------ Enriquecimiento con elementos gráficos
  type Enriquecimiento = NonNullable<ResultadoEstudioDeArte['enriquecimientos']>[number];
  const enriquecimientos: Enriquecimiento[] = [];
  const ganadora = comparacion ? direcciones.find((d) => d.nombre === comparacion!.letras[comparacion!.orden[0] ?? '']) : [...direcciones].sort((a, b) => (b.mejor?.nota ?? 0) - (a.mejor?.nota ?? 0))[0];
  const aEnriquecer = entrada.enriquecer === 'todas' ? direcciones.filter((d) => d.mejor?.png) : entrada.enriquecer && ganadora ? [ganadora] : [];
  for (const [k, dir] of aEnriquecer.entries()) {
    if (!deps.director.enriquecer || !dir.mejor?.png || !dir.mejor.movil || dir.mejor.receta.esqueleto === 'MONTAJE_EDITORIAL') continue;
    const ganadora = dir;
    const base = ganadora.mejor!;
    log(`· Enriquecer «${ganadora.nombre}» con elementos gráficos…`);
    // El mapa de la pieza (lo ocupado por texto y producto, «#») para que los elementos vayan donde hay sitio.
    const mapaPieza = compilarReceta(base.receta, { ...entorno, textos: Object.fromEntries(base.receta.textos.map((t) => [t.clave, t.texto])) }).mesa;
    const propuesta = await deps.director.enriquecer(encargo, { png: base.png!, receta: base.receta, ...(mapaPieza ? { mapa: mapaPieza } : {}) });
    log(`  ${propuesta.mejoras.map((m) => `${m.categoria}: ${m.que}`).join(' | ')}`);
    const versiones: Enriquecimiento['versiones'] = [{ nombre: 'base', png: base.png!, movil: base.movil!, ...(base.nota !== undefined ? { nota: base.nota } : {}), ...(base.critica ? { critica: base.critica } : {}), medidas: base.medidas }];
    const criticar = async (png: string, movil: string, receta: Receta, medidas: string[]) => {
      const c = await deps.critico.criticar(encargo, { receta, png, movil, medidas });
      return { critica: c, nota: nota(c.puntuaciones) };
    };
    // (a) Aislados: cada elemento se genera solo y el código lo coloca donde dice la receta.
    const conElementos: Receta = { ...base.receta, elementos: propuesta.elementos as Receta['elementos'] };
    const ids = entrada.aislados ? await prepararElementos(conElementos) : [];
    const sufijo = aEnriquecer.length > 1 ? `-${k + 1}` : '';
    const ca = compilar(conElementos, `${entrada.id}-enriquecida${sufijo}`, 1, await prepararEscena(conElementos), await prepararGarabato(conElementos), undefined, ids);
    if (!entrada.aislados) {
      // Por defecto no: en las pruebas del 22/11 quedaron últimos en 5 de 5 comparaciones a ciegas.
    } else if (ca.intencion) {
      const p = await deps.pintar(ca.intencion, `${entrada.salida}/enriquecida${sufijo}/aislados`);
      const medidas = [...p.errores.map((e) => `ERROR ${e}`), ...p.avisos.map((a) => `AVISO ${a}`)];
      const { critica, nota: n } = await criticar(p.png, p.movil, conElementos, medidas);
      versiones.push({ nombre: 'elementos aislados', png: p.png, movil: p.movil, nota: n, critica, medidas });
      log(`  elementos aislados → ${n}/100 · ${critica.defectoPrincipal}`);
    } else log(`  ! Los elementos aislados no compilan: ${ca.problemas.join(' · ')}`);
    // (b) Inserción en contexto: el modelo dibuja sobre la pieza y el código protege producto y textos.
    if (deps.insertar) {
      try {
        const ins = await deps.insertar({ png: base.png! }, propuesta.insercion, { id: `${entrada.id}-insercion${sufijo}`, ...(encargo.referencia ? { referencia: encargo.referencia.ruta } : {}), carpeta: `${entrada.salida}/enriquecida${sufijo}/insercion`, reestilizar: propuesta.reestilizar });
        const { critica, nota: n } = await criticar(ins.png, ins.movil, base.receta, ins.medidas);
        versiones.push({ nombre: 'acabado (Nano Banana 2)', png: ins.png, movil: ins.movil, nota: n, critica, medidas: ins.medidas });
        log(`  acabado (Nano Banana 2) → ${n}/100 · ${critica.defectoPrincipal}`);
      } catch (error) {
        log(`  ! La inserción falló: ${(error as Error).message.slice(0, 300)}`);
      }
    }
    // Comparación a ciegas de las versiones (con la referencia como listón).
    let comp: Enriquecimiento['comparacion'];
    const conMovil = versiones.filter((x) => x.movil);
    if (deps.comparador && conMovil.length >= 2) {
      const orden = [...conMovil].sort((a, b) => (a.nombre.length * 7) % 5 - (b.nombre.length * 7) % 5);
      const letras: Record<string, string> = {};
      const piezas = orden.map((x, i) => {
        const letra = String.fromCharCode(65 + i);
        letras[letra] = x.nombre;
        return { letra, movil: x.movil! };
      });
      const r = await deps.comparador.comparar(piezas, encargo.referencia?.ruta);
      comp = { orden: r.orden, motivo: r.motivo, letras };
      log(`· Versiones enriquecidas, a ciegas: ${r.orden.map((l) => letras[l] ?? l).join(' > ')}`);
    }
    enriquecimientos.push({ direccion: ganadora.nombre, porque: propuesta.porque, mejoras: propuesta.mejoras, elementos: propuesta.elementos, insercion: propuesta.insercion, versiones, ...(comp ? { comparacion: comp } : {}) });
  }
  return { encargo, referencias, propuestas, devuelto, direcciones, ...(comparacion ? { comparacion } : {}), ...(analisis ? { analisis } : {}), ...(enriquecimientos.length ? { enriquecimientos } : {}), mapa };
}

/** Distancia de edición (Levenshtein). */
function distancia(a: string, b: string): number {
  const f = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = f[0]!;
    f[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = f[j]!;
      f[j] = Math.min(f[j]! + 1, f[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = t;
    }
  }
  return f[b.length]!;
}

/** La menor distancia de edición de `p` a cualquier trozo de `t` (búsqueda aproximada de Sellers). */
function distanciaEnTexto(p: string, t: string): number {
  let fila = Array.from({ length: p.length + 1 }, (_, i) => i);
  let mejor = fila[p.length]!;
  for (const c of t) {
    const nueva = [0];
    for (let i = 1; i <= p.length; i++) nueva[i] = Math.min(fila[i]! + 1, nueva[i - 1]! + 1, fila[i - 1]! + (p[i - 1] === c ? 0 : 1));
    fila = nueva;
    mejor = Math.min(mejor, fila[p.length]!);
  }
  return mejor;
}

/**
 * Si un texto se lee en las líneas del OCR: cada palabra con contenido aparece, con una letra de error por cada cinco.
 * El OCR a veces pega palabras («ALCELTRO» por «AL CENTRO»): se busca también dentro del texto leído sin espacios.
 */
export function seLee(texto: string, lineas: string[]): boolean {
  const leidas = norm(lineas.join(' ')).split(' ').filter(Boolean);
  const seguido = leidas.join('');
  return norm(texto)
    .split(' ')
    .filter((p) => p.length > 2)
    .every((p) => {
      const tolerancia = Math.max(1, Math.floor(p.length / 5));
      return leidas.some((l) => distancia(p, l) <= tolerancia) || distanciaEnTexto(p, seguido) <= tolerancia;
    });
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

interface Ajustes {
  tintas: Record<string, string>;
  detras: string[];
  quitar: string[];
  descripcion: string[];
}

/** Los arreglos que el código sabe hacer sin el modelo, a partir de los ERROR del compositor. */
export function ajustesPara(errores: string[], colores: Array<{ token: string; hex: string }>): Ajustes | undefined {
  const tintas: Record<string, string> = {};
  const detras: string[] = [];
  const quitar: string[] = [];
  const descripcion: string[] = [];
  const porLuz = [...colores].sort((a, b) => contraste(b.hex, '#FFFFFF') - contraste(a.hex, '#FFFFFF'));
  const oscura = porLuz[0];
  const clara = porLuz.at(-1);
  for (const e of errores) {
    const contrasteMal = /^CONTRASTE: «([^»]+)»/.exec(e);
    if (contrasteMal && oscura && clara) {
      // Se prueba la tinta extrema contraria a la que había (no se sabe cuál era: se prueban las dos, primero la clara).
      tintas[contrasteMal[1]!] = '?';
      descripcion.push(`otra tinta para «${contrasteMal[1]}»`);
    }
    const solape = /^SOLAPE: «([^»]+)» tapa el sujeto/.exec(e);
    if (solape && /^nota-/.test(solape[1]!)) {
      // Una anotación que pisa el producto se quita (las demás se quedan).
      quitar.push(solape[1]!);
      descripcion.push(`se quita la anotación «${solape[1]}», que pisaba el producto`);
    } else if (solape && solape[1] === 'titular') {
      // Solo el titular puede pasar detrás del producto: la firma y el apoyo no se esconden.
      detras.push(solape[1]!);
      descripcion.push(`«${solape[1]}» pasa detrás del producto`);
    }
  }
  if (!descripcion.length) return undefined;
  for (const id of Object.keys(tintas)) tintas[id] = `${oscura!.token}|${clara!.token}`;
  return { tintas, detras, quitar, descripcion };
}

export function aplicarAjustes(capas: CapaPropuesta[], a: Ajustes): CapaPropuesta[] {
  // Sobre una foto a sangre, un texto pequeño encima de luces y sombras no llega a 4,5:1 con ninguna tinta (lote-1:
  // 3,34:1 y 2,57:1 con las dos): se oscurece su lado con el velo de la foto y va en la tinta clara, como en el cine.
  const conFotoASangre = capas.some((c) => c.tipo === 'foto' && c.encuadre === 'sangre');
  const velos = new Set<'arriba' | 'abajo'>();
  let colorVelo: string | undefined;
  const ajustadas = capas.filter((c) => !(c.tipo === 'anotacion' && a.quitar.includes(c.id))).map((c) => {
    if ((c.tipo === 'texto' || c.tipo === 'anotacion') && a.tintas[c.id]) {
      const [oscura, clara] = a.tintas[c.id]!.split('|');
      if (conFotoASangre && c.tipo === 'texto' && c.id !== 'titular') {
        velos.add((c.caja.fila[0]! + c.caja.fila[1]!) / 2 <= 8.5 ? 'arriba' : 'abajo');
        colorVelo = `@${oscura}`;
        return { ...c, color: `@${clara}` };
      }
      // La contraria a la que llevaba: si era la oscura, la clara; si no, la oscura.
      return { ...c, color: c.color === `@${oscura}` ? `@${clara}` : `@${oscura}` };
    }
    if (c.tipo === 'texto' && a.detras.includes(c.id) && c.relacion === 'aparte') return { ...c, relacion: 'detras' as const };
    return c;
  });
  if (!velos.size) return ajustadas;
  return ajustadas.map((c) => {
    if (c.tipo !== 'foto' || c.encuadre !== 'sangre') return c;
    const lados = new Set([...velos, ...(c.velo === 'ambos' ? (['arriba', 'abajo'] as const) : c.velo === 'arriba' || c.velo === 'abajo' ? [c.velo] : [])]);
    return { ...c, velo: lados.size > 1 ? ('ambos' as const) : [...lados][0]!, colorVelo: c.colorVelo ?? colorVelo! };
  });
}
