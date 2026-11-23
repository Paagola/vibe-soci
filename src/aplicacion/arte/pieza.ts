/**
 * Estudio de arte · lo que comparten los lotes (`npm run lote`) y el chat de la web para producir una pieza:
 * - el prompt final de una foto nueva (fidelidad al plato real, el local, imagen sin texto, aire de escena);
 * - registrar una foto generada como activo del local (con máscara de Apple Vision y procedencia);
 * - componer un visual con su receta: el código maqueta y, si la receta no cabe en la foto de verdad o el código mide
 *   errores al pintarla, Hydrogen la repara VIENDO esa foto (hasta dos vueltas; se queda la mejor).
 */
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { Activo } from '../../dominio/activos.js';
import type { Receta } from '../../dominio/arte/receta.js';
import type { Visual } from '../../dominio/arte/lote.js';
import type { Intencion, Tokens } from '../../dominio/diseno/intencion.js';
import type { ActivoDisponible, Compositor } from '../../puertos/Compositor.js';
import type { DirectorDeArte } from '../../puertos/EstudioDeArte.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ProcesadorImagen } from '../../puertos/ProcesadorImagen.js';
import { componerDiseno } from '../diseno/componerDiseno.js';
import { AlmacenDisenosFicheros } from '../../adaptadores/ficheros/AlmacenDisenosFicheros.js';
import { estudioDeArte, type DepsEstudioDeArte, type EntradaEstudioDeArte, type Pintura } from './estudioDeArte.js';

/** Problemas del compositor que no son de la maqueta (los del activo y su resolución). */
const AJENOS = /^(ACTIVO|FIDELIDAD|RESOLUCION)$/;

/** El prompt final para el modelo de imagen: el del director más las reglas de fidelidad y de imagen sin texto. */
export function promptFinal(v: NonNullable<Visual['generar']>, local: { nombre: string; ciudad: string; descripcion: string }): string {
  return [
    v.conPlato
      ? '@image1 is the real dish from this restaurant. Keep the dish exactly as it is: the same food, the same ingredients and quantities, the same plate and garnish; do not add, remove or restyle anything on the plate. Change the camera angle, the distance, the surroundings, the props and the light as the direction below says: this must be a NEW photograph, not a copy of @image1.'
      : '',
    v.prompt,
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

/**
 * Compone un visual con su receta sobre su foto. Con `reparador` (Hydrogen), lo que no cabe o sale con errores medidos
 * se repara viendo la foto real, hasta dos vueltas; se queda la pasada pintada con menos errores.
 * `entrada` lleva el encargo (foto, hechos, marca) y la carpeta de salida; cada pasada va en su subcarpeta.
 */
export async function componerVisual(
  deps: Omit<DepsEstudioDeArte, 'director' | 'critico'> & { critico?: DepsEstudioDeArte['critico'] },
  entrada: EntradaEstudioDeArte,
  receta0: Receta,
  reparador?: Pick<DirectorDeArte, 'reparar'>,
): Promise<VisualCompuesto> {
  let receta = receta0;
  let pendientes: string[] = [];
  let mejor: VisualCompuesto | undefined;
  for (let pasada = 1; pasada <= (reparador ? 2 : 1); pasada++) {
    let reparada = pasada > 1;
    const r = await estudioDeArte(
      {
        ...deps,
        critico: deps.critico ?? SIN_CRITICA,
        director: {
          nombre: 'receta dada',
          proponer: async (enc) => ({ direcciones: [pendientes.length && reparador ? await reparador.reparar(enc, receta, pendientes) : receta] }),
          reparar: async (enc, r0, problemas) => {
            if (!reparador) return r0;
            reparada = true;
            return reparador.reparar(enc, r0, problemas);
          },
        },
      },
      { ...entrada, direcciones: 1, salida: join(entrada.salida, `p${pasada}`), referencia: undefined },
    );
    const vuelta = r.direcciones[0]?.mejor ?? r.direcciones[0]?.vueltas[0];
    const esta: VisualCompuesto = { ...(vuelta?.png ? { png: vuelta.png } : {}), ...(vuelta?.movil ? { movil: vuelta.movil } : {}), problemas: vuelta?.problemas ?? ['no compila'], reparada: reparada || Boolean(mejor?.reparada), receta: vuelta?.receta ?? receta };
    if (!mejor || (esta.png && (!mejor.png || esta.problemas.length < mejor.problemas.length))) mejor = esta;
    if (!esta.problemas.length) break;
    pendientes = esta.problemas;
    receta = esta.receta;
  }
  return mejor!;
}
