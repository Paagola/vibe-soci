/**
 * Estudio de arte · lo que comparten los lotes (`npm run lote`) y el chat de la web para producir una pieza:
 * - el prompt final de una foto nueva (fidelidad al plato real, el local, imagen sin texto, aire de escena);
 * - registrar una foto generada como activo del local (con máscara de Apple Vision y procedencia);
 * - componer un visual con su receta: el código maqueta y, si la receta no cabe en la foto de verdad o el código mide
 *   errores al pintarla, Hydrogen la repara VIENDO esa foto (hasta dos vueltas; se queda la mejor).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import sharp from 'sharp';
import { Activo } from '../../dominio/activos.js';
import type { Receta } from '../../dominio/arte/receta.js';
import type { Visual } from '../../dominio/arte/lote.js';
import type { Intencion, Tokens } from '../../dominio/diseno/intencion.js';
import type { ActivoDisponible, Compositor } from '../../puertos/Compositor.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ProcesadorImagen } from '../../puertos/ProcesadorImagen.js';
import { componerDiseno } from '../diseno/componerDiseno.js';
import { AlmacenDisenosFicheros } from '../../adaptadores/ficheros/AlmacenDisenosFicheros.js';
import { estudioDeArte, type DepsEstudioDeArte, type EntradaEstudioDeArte, type Pintura } from './estudioDeArte.js';
import type { DirectorDeArte } from '../../puertos/EstudioDeArte.js';

/** Problemas del compositor que no son de la maqueta (los del activo y su resolución). */
const AJENOS = /^(ACTIVO|FIDELIDAD|RESOLUCION)$/;

/**
 * Quita del prompt del director las palabras de luz cálida que el modelo convierte en una dominante amarilla o naranja
 * (Torre de Vega, 23/11: «warm golden ambient light», «warm amber side light» → blancos con R−B de 107 y 135).
 * El color de la comida («golden-brown crust») se respeta.
 */
export function sinLuzCalida(prompt: string): string {
  return prompt
    .replace(/\bgolden hour\b/gi, 'soft daylight')
    .replace(/\bcandle-?lit\b|\bcandlelight\b/gi, 'softly lit')
    .replace(/\b(warm(ly)?|amber|sepia|honey(ed)?|sunset|toasty)\b[ -]?/gi, '')
    .replace(/\bgolden(?![-\s]?brown)\b[ -]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

/** El prompt final para el modelo de imagen: el del director más las reglas de fidelidad, color neutro e imagen sin texto. */
export function promptFinal(v: NonNullable<Visual['generar']>, local: { nombre: string; ciudad: string; descripcion: string }): string {
  return [
    v.conPlato
      ? '@image1 is the real dish from this restaurant. Keep the dish exactly as it is: the same food, the same ingredients and quantities, the same plate and garnish; do not add, remove or restyle anything on the plate. Change the camera angle, the distance, the surroundings, the props and the light as the direction below says: this must be a NEW photograph, not a copy of @image1.'
      : '',
    sinLuzCalida(v.prompt),
    // Lo que delata una foto de IA: la dominante amarilla. Los mejores carruseles del estudio (la ensalada) la pidieron neutra.
    'Neutral daylight white balance (about 5000–5500 K): the plate, tablecloth and any white read truly white; wood and food keep their natural colours. No yellow, orange, amber or golden colour cast, no warm filter, no sepia, no orange highlights.',
    `The place: ${local.descripcion} (${local.ciudad}).`,
    'Photorealistic professional editorial photograph, vertical 3:4. People, if any, are anonymous adults, natural and candid. Absolutely no text, letters, numbers, signs, menus, logos or watermarks anywhere in the image.',
    // Nano Banana Pro tomó «clean dark shadow space in the upper area» al pie de la letra y pintó una franja negra
    // plana (Lo Güeno, lote-1): el aire para el texto tiene que salir de la propia escena.
    'Any calm area left for typography must be part of the real scene (a dark wall, deep shadow, sky, tablecloth or an out-of-focus background) and the photograph must fill the whole frame: never a flat empty band, border, frame or letterbox.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Una foto como activo del local, con su máscara: la real del cliente (REAL, PUBLICABLE) o una generada (GENERADO,
 * SOLO_PRUEBA_COMPOSICION hasta que alguien la apruebe para publicar). Si ya existe con los mismos bytes, se reutiliza.
 */
export async function registrarFotoGenerada(
  activos: AlmacenActivos,
  segmentador: { mascara(ruta: string): Promise<Buffer> },
  o: { local: string; id: string; ruta: string; descripcion: string; tipo?: 'REAL' | 'GENERADO'; modelo?: string; trabajo?: string; prompt?: string; referencias?: Array<{ activo: string; sha256: string }>; uso?: 'SOLO_PRUEBA_COMPOSICION' | 'PUBLICABLE' },
): Promise<ActivoDisponible> {
  const bytes = await sharp(o.ruta).png().toBuffer();
  const sha = createHash('sha256').update(bytes).digest('hex');
  let id = o.id.replace(/[^a-z0-9-]/g, '-').slice(0, 80);
  if (await activos.existe(o.local, id)) {
    const previo = await activos.obtener(o.local, id);
    if (previo.activo.sha256 === sha) return previo;
    id = `${id.slice(0, 70)}-${sha.slice(0, 8)}`;
    if (await activos.existe(o.local, id)) return activos.obtener(o.local, id);
  }
  const meta = await sharp(bytes).metadata();
  const mascara = await segmentador.mascara(o.ruta).catch(() => undefined);
  let bbox: { x: number; y: number; w: number; h: number } | undefined;
  if (mascara) {
    const { data, info } = await sharp(mascara).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
    let [x0, y0, x1, y1] = [info.width, info.height, -1, -1];
    for (let i = 0; i < data.length; i++) {
      if (data[i]! < 128) continue;
      const x = i % info.width;
      const y = (i - x) / info.width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 > x0 && y1 > y0) bbox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  const ahora = new Date().toISOString();
  await activos.crear(
    Activo.parse({
      id,
      localSlug: o.local,
      tipo: o.tipo ?? 'GENERADO',
      uso: o.uso ?? (o.tipo === 'REAL' ? 'PUBLICABLE' : 'SOLO_PRUEBA_COMPOSICION'),
      descripcion: o.descripcion,
      archivo: 'original.png',
      ancho: meta.width!,
      alto: meta.height!,
      sha256: sha,
      ...(mascara && bbox ? { mascara: { archivo: 'mascara.png', metodo: 'APPLE_VISION', creadaEn: ahora, bbox, incluye: 'lo que detecte Apple Vision' } } : {}),
      procedencia: {
        ruta: relative(process.cwd(), o.ruta),
        sha256: sha,
        copiadoEn: ahora,
        ...(o.tipo === 'REAL' ? {} : { generacion: { modelo: o.modelo ?? '—', requestId: o.trabajo ?? o.id, promptArchivo: '—', prompt: o.prompt ?? '', parametros: { aspecto: '3:4' }, referencias: o.referencias ?? [], generadoEn: ahora } }),
      },
    }),
    { 'original.png': bytes, ...(mascara ? { 'mascara.png': mascara } : {}) },
  );
  return activos.obtener(o.local, id);
}

/** El pintor del estudio: compone la intención con el compositor real y mide sus errores. */
export function crearPintor(d: { compositor: Compositor; activos: AlmacenActivos; procesador: ProcesadorImagen; tokensMarca: Tokens }): (intencion: Intencion, carpeta: string) => Promise<Pintura> {
  return async (intencion, carpeta) => {
    await mkdir(carpeta, { recursive: true });
    const r = await componerDiseno({ compositor: d.compositor, activos: d.activos, disenos: new AlmacenDisenosFicheros(carpeta), procesador: d.procesador }, intencion, 'pieza', { tokensMarca: d.tokensMarca });
    const png = join(r.guardado.carpeta, 'diseno.png');
    const movil = join(carpeta, 'movil.png');
    await sharp(png).resize(360).png().toFile(movil);
    const problemas = r.resuelto.problemas.filter((x) => !AJENOS.test(String(x.tipo)));
    return {
      png,
      movil,
      errores: problemas.filter((x) => x.gravedad === 'ERROR').map((x) => `${x.tipo}: ${x.mensaje}`),
      avisos: problemas.filter((x) => x.gravedad !== 'ERROR').map((x) => `${x.tipo}: ${x.mensaje}`),
    };
  };
}

export interface VisualCompuesto {
  png?: string;
  movil?: string;
  problemas: string[];
  reparada: boolean;
  receta: Receta;
  /** Lo que se decidió por el camino (reparación rechazada, acabado elegido a ciegas…), en castellano. */
  decisiones?: string[];
  /** La carpeta de capas (PNG a lienzo completo) de la composición final, antes del acabado. */
  capas?: string;
}

const NEUTRA = { nivel: 2, motivo: 'sin crítica' };
const SIN_CRITICA: DepsEstudioDeArte['critico'] = {
  nombre: 'sin crítica',
  criticar: async () => ({
    primeraLectura: 'sin crítica',
    puntuaciones: { idea: NEUTRA, composicion: NEUTRA, tipografia: NEUTRA, relacion: NEUTRA, identidad: NEUTRA, acabado: NEUTRA },
    defectoPrincipal: '—',
    parches: [],
  }),
};

/** Por debajo de esta fracción del ancho del lienzo, un producto recortado se ve diminuto. */
export const ANCHO_MINIMO_PRODUCTO = 0.45;

/** El ancho del producto recortado (fracción del lienzo) en la intención que se pintó junto a `png`, si la hay. */
async function anchoDelProducto(png: string): Promise<number | undefined> {
  const intencion = await readFile(join(dirname(png), 'intencion.json'), 'utf8').then((t) => JSON.parse(t) as { capas?: Array<{ tipo?: string; escala?: { anchoSujeto?: number } }> }, () => undefined);
  const recortes = (intencion?.capas ?? []).filter((c) => c.tipo === 'recorte' && typeof c.escala?.anchoSujeto === 'number');
  return recortes.length ? Math.max(...recortes.map((c) => c.escala!.anchoSujeto!)) : undefined;
}

/** Esqueletos que viven de la foto entera (su escena, su luz, su aire). */
const DE_FOTO = new Set(['FOTO_A_SANGRE', 'PARTIDA']);
/** Esqueletos que recortan el producto y tiran la escena. */
const DE_RECORTE = new Set(['PRODUCTO_SOBRE_COLOR', 'CARTEL', 'COLUMNA', 'MARCO', 'PATRON', 'EDITORIAL']);

/**
 * Una reparación que convierte una foto a sangre en un plato recortado sobre color tira la foto (Etxebarri, 23/11: la
 * mesa de roble y el fuego acabaron en un plato pequeño sobre marrón liso). No se acepta: mejor la foto sola.
 */
export function degrada(antes: Receta, despues: Receta): boolean {
  return DE_FOTO.has(antes.esqueleto) && DE_RECORTE.has(despues.esqueleto);
}

/**
 * Compone un visual con su receta sobre su foto. Con `reparador` (Hydrogen), lo que no cabe o sale con errores medidos
 * se repara viendo la foto real, hasta dos vueltas; se queda la pasada pintada con menos errores. Una reparación que
 * degrada la foto (de foto a sangre a producto recortado) se rechaza.
 * Con `entrada.enriquecer` y un reparador que sepa enriquecer, la pieza recibe el acabado de Nano Banana 2 y se queda
 * la versión que gane a ciegas. `entrada.referencia` llega al crítico y al comparador como listón.
 * `entrada` lleva el encargo (foto, hechos, marca) y la carpeta de salida; cada pasada va en su subcarpeta.
 */
export async function componerVisual(
  deps: Omit<DepsEstudioDeArte, 'director' | 'critico'> & { critico?: DepsEstudioDeArte['critico'] },
  entrada: EntradaEstudioDeArte,
  receta0: Receta,
  reparador?: Pick<DirectorDeArte, 'reparar'> & Partial<Pick<DirectorDeArte, 'enriquecer'>>,
): Promise<VisualCompuesto> {
  let receta = receta0;
  let pendientes: string[] = [];
  let mejor: VisualCompuesto | undefined;
  const decisiones: string[] = [];
  /** Repara sin dejar que la foto se degrade: si la reparación tira la escena, se queda la receta como estaba. */
  const repararSinDegradar = async (enc: Parameters<DirectorDeArte['reparar']>[0], r0: Receta, problemas: string[]): Promise<Receta> => {
    const r = await reparador!.reparar(enc, r0, problemas);
    const copia = r.esqueleto !== r0.esqueleto && entrada.evitarEsqueletos?.includes(r.esqueleto);
    if (!degrada(receta0, r) && !copia) return r;
    const nota = copia
      ? `Rechacé una reparación que pasaba a ${r.esqueleto}: es la maqueta de otra lámina del carrusel.`
      : `Rechacé una reparación que pasaba de ${receta0.esqueleto} a ${r.esqueleto}: habría tirado la foto para pegar el plato recortado sobre color.`;
    if (!decisiones.includes(nota)) decisiones.push(nota);
    return r0;
  };
  let encargo: Parameters<DirectorDeArte['reparar']>[0] | undefined;
  for (let pasada = 1; pasada <= (reparador ? 2 : 1); pasada++) {
    let reparada = pasada > 1;
    const r = await estudioDeArte(
      {
        ...deps,
        critico: deps.critico ?? SIN_CRITICA,
        director: {
          nombre: 'receta dada',
          proponer: async (enc) => ({ direcciones: [pendientes.length && reparador ? await repararSinDegradar(enc, receta, pendientes) : receta] }),
          reparar: async (enc, r0, problemas) => {
            if (!reparador) return r0;
            reparada = true;
            return repararSinDegradar(enc, r0, problemas);
          },
        },
      },
      // El acabado, una sola vez y sobre la versión final (abajo), no en cada pasada.
      { ...entrada, enriquecer: false, direcciones: 1, salida: join(entrada.salida, `p${pasada}`) },
    );
    encargo = r.encargo;
    const vuelta = r.direcciones[0]?.mejor ?? r.direcciones[0]?.vueltas[0];
    const esta: VisualCompuesto = { ...(vuelta?.png ? { png: vuelta.png } : {}), ...(vuelta?.movil ? { movil: vuelta.movil } : {}), problemas: vuelta?.problemas ?? ['no compila'], reparada: reparada || Boolean(mejor?.reparada), receta: vuelta?.receta ?? receta };
    if (!mejor || (esta.png && (!mejor.png || esta.problemas.length < mejor.problemas.length))) mejor = esta;
    if (!esta.problemas.length) break;
    pendientes = esta.problemas;
    receta = esta.receta;
  }

  // Un producto recortado diminuto no es una pieza (Torre de Vega, 23/11: «LA BRASA» en columna con el plato al 30 % del
  // ancho; a sangre, con la misma foto, era otra cosa). Se mide en la intención pintada y cuenta como problema.
  if (mejor?.png && DE_RECORTE.has(mejor.receta.esqueleto)) {
    const ancho = await anchoDelProducto(mejor.png);
    if (ancho !== undefined && ancho < ANCHO_MINIMO_PRODUCTO) mejor = { ...mejor, problemas: [...mejor.problemas, `PRODUCTO_PEQUEÑO: en ${mejor.receta.esqueleto} el producto ocupa el ${Math.round(ancho * 100)} % del ancho (mínimo ${Math.round(ANCHO_MINIMO_PRODUCTO * 100)} %).`] };
  }

  // Un titular que sigue sin leerse tras las reparaciones (el producto lo tapa) lo arregla el código sin preguntar al
  // modelo: el titular sale de detrás del producto («aparte») y va en el aire libre de la foto (Torre de Vega, 23/11:
  // «AL CENTRO» y «CHULETÓN» se entregaron tapados por el hueso).
  if (mejor?.png && mejor.problemas.some((p) => p.startsWith('LEGIBILIDAD')) && mejor.receta.titular.relacion !== 'aparte') {
    const aparte: Receta = { ...mejor.receta, titular: { ...mejor.receta.titular, relacion: 'aparte' } };
    const r = await estudioDeArte({ ...deps, critico: SIN_CRITICA, director: { nombre: 'receta dada', proponer: async () => ({ direcciones: [aparte] }), reparar: async (_e, r0) => r0 } }, { ...entrada, enriquecer: false, vueltas: 0, direcciones: 1, salida: join(entrada.salida, 'legible') });
    const v = r.direcciones[0]?.mejor ?? r.direcciones[0]?.vueltas[0];
    const quedan = (v?.problemas ?? []).filter((p) => p.startsWith('LEGIBILIDAD')).length;
    if (v?.png && v.movil && quedan === 0 && v.problemas.length <= mejor.problemas.length) {
      mejor = { ...mejor, png: v.png, movil: v.movil, problemas: v.problemas, receta: v.receta };
      decisiones.push('El titular no se leía en el móvil (el producto lo tapaba): lo saqué de detrás del producto, al aire libre de la foto.');
    }
  }

  // Las capas de la composición (para enseñar cómo se compuso), antes de que el acabado cambie el PNG.
  if (mejor?.png) mejor = { ...mejor, capas: join(dirname(mejor.png), 'capas') };

  // El acabado de Nano Banana 2 sobre la versión final: Hydrogen propone las mejoras (fondo, luz, sello, marco,
  // acabado de impresión), Nano Banana 2 las pinta, el código restaura producto y textos, y se queda la versión que
  // gane a ciegas a tamaño móvil (con la referencia como listón).
  if (entrada.enriquecer && reparador?.enriquecer && deps.insertar && encargo && mejor?.png && mejor.movil && !mejor.problemas.length) {
    try {
      const prop = await reparador.enriquecer(encargo, { png: mejor.png, receta: mejor.receta });
      const ins = await deps.insertar({ png: mejor.png }, prop.insercion, { id: `${entrada.id}-acabado`, ...(encargo.referencia ? { referencia: encargo.referencia.ruta } : {}), carpeta: join(entrada.salida, 'acabado'), reestilizar: prop.reestilizar });
      let gana = true;
      let motivo = '';
      if (deps.comparador) {
        // El orden se alterna para no premiar siempre a la misma letra.
        const acabadoPrimero = createHash('sha256').update(entrada.id).digest()[0]! % 2 === 0;
        const par = acabadoPrimero ? [{ letra: 'A', movil: ins.movil }, { letra: 'B', movil: mejor.movil }] : [{ letra: 'A', movil: mejor.movil }, { letra: 'B', movil: ins.movil }];
        const c = await deps.comparador.comparar(par, encargo.referencia?.ruta);
        gana = c.orden[0] === (acabadoPrimero ? 'A' : 'B');
        motivo = c.motivo;
      }
      const que = prop.mejoras.map((m) => m.categoria).join(', ') || 'acabado';
      if (gana) {
        mejor = { ...mejor, png: ins.png, movil: ins.movil };
        decisiones.push(`Acabado con Nano Banana 2 (${que}): ganó a ciegas a la versión sin acabado.${motivo ? ` ${motivo}` : ''}`.slice(0, 400));
      } else decisiones.push(`Probé un acabado con Nano Banana 2 (${que}) y la versión limpia ganó a ciegas: se queda la limpia.`);
    } catch (error) {
      decisiones.push(`El acabado con Nano Banana 2 no salió (${(error instanceof Error ? error.message : String(error)).slice(0, 160)}): se queda la versión limpia.`);
    }
  }
  return { ...mejor!, decisiones };
}
