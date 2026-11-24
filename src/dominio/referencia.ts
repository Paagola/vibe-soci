/**
 * Referencias de diseño (F1.6). En las primeras piezas de cada local, el diseño parte de un post de referencia
 * que elige el usuario (Canva, Pinterest o una captura), para construir sobre su gusto y no sobre el del estudio.
 *
 * - Una referencia se guarda con el local y se analiza con una ficha estructurada (la de diseno/f1_6/FASE-0.md §2.1).
 * - De la referencia se toma el oficio (jerarquía, mecanismo, tratamiento); nunca textos ni marcas.
 * - Mientras un local tenga menos de UMBRAL_REFERENCIA_OBLIGATORIA piezas creadas en modo real, una pieza no pasa
 *   de brief a concepto sin una referencia analizada.
 * - El post de referencia no va al generador de imágenes: se le pasa la ficha en palabras.
 */
import { z } from 'zod';
import type { Pieza } from './modelos.js';

/** Hasta cuántas piezas reales es obligatoria la referencia (decisión del 07/11/2026). Configurable. */
export const UMBRAL_REFERENCIA_OBLIGATORIA = 5;

export const Familia = z.enum(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']);
export type Familia = z.infer<typeof Familia>;

/** Mecanismos (relación texto-producto) y recursos gráficos que aparecen en las referencias. */
export const Mecanismo = z.enum([
  'PALABRA_DETRAS',
  'CONTORNO_AL_CRUZAR',
  'PATRON_REPETIDO',
  'TEXTO_CURVO',
  'PALABRA_GIRADA',
  'LOGOTIPO_TIPOGRAFICO',
  'TITULAR_EN_EL_AIRE',
  'SALE_DEL_MARCO',
  'ENTRA_POR_LOS_BORDES',
  'PLATO_CORTADO_POR_EL_BORDE',
  'ACCION_CON_MANO',
  'SALPICADURA_O_FLOTANTES',
  'SELLO',
  'FLECHAS_A_MANO',
  'PAPEL_RASGADO',
  'TIRA_DE_CUADROS',
  'FORMAS_ORGANICAS',
  'DIBUJOS_O_PEGATINAS',
  'TARJETA_DE_INFORMACION',
  'CONTADOR_O_NUMERACION',
  'ANOTACIONES',
]);
export type Mecanismo = z.infer<typeof Mecanismo>;

const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const Tratamiento = z.enum(['FOTOGRAFICO_LIMPIO', 'ILUSTRADO', 'TINTA', 'PINCEL', 'PEGATINA', 'PAPEL', 'ICONOS_DE_LINEA', 'TRAMA', 'COLLAGE']);
export type Tratamiento = z.infer<typeof Tratamiento>;

const observacion = z.string().trim().min(3).max(320);
export const LecturaFotografica = z.object({
  camara: observacion.describe('Altura y orientación aproximadas, apoyadas en algo visible.'),
  distancia: observacion.describe('Tamaño del sujeto, cortes, planos y qué queda enfocado.'),
  luz: observacion.describe('Dirección, tamaño aparente y caída, con evidencia en sombras o reflejos.'),
  gesto: observacion.describe('Peso, apoyo, orientación o gesto del sujeto y su relación con el entorno.'),
  materiales: observacion.describe('Respuesta a la luz de dos superficies concretas, si se ven.'),
  sensacion: observacion.describe('Lectura emocional posible y detalle visual que la provoca.'),
  traslado: observacion.describe('Una decisión aplicable a otra escena y qué tendrá que cambiar.'),
});
export type LecturaFotografica = z.infer<typeof LecturaFotografica>;

export const RelacionesGraficas = z.array(z.object({
  gesto: observacion.describe('Relación visible entre dos elementos y su posición en el cartel.'),
  construccion: observacion.describe('Cómo trasladarla con capas editables y qué tiene que seguir siendo legible.'),
})).max(3);

export function detallesGraficos(relaciones: z.infer<typeof RelacionesGraficas>) {
  return relaciones.map(r => ({ titulo: r.gesto, detalle: r.construccion }));
}

export function detallesFotograficos(f: LecturaFotografica) {
  return [
    { titulo: 'Punto de vista', detalle: f.camara }, { titulo: 'Distancia y foco', detalle: f.distancia },
    { titulo: 'Iluminación', detalle: f.luz }, { titulo: 'Gesto y apoyos', detalle: f.gesto },
    { titulo: 'Materiales', detalle: f.materiales }, { titulo: 'Sensación', detalle: f.sensacion },
    { titulo: 'Aplicación a la nueva toma', detalle: f.traslado },
  ];
}

export function direccionFotografica(ficha: Pick<FichaReferencia, 'foto' | 'lecturaFotografica'>): string {
  return ficha.lecturaFotografica
    ? detallesFotograficos(ficha.lecturaFotografica).map(x => x.titulo + ' · ' + x.detalle).join('\n')
    : ficha.foto;
}

/** La ficha de análisis de una referencia: lo que un diseñador anotaría para poder reutilizar el oficio. */
export const FichaReferencia = z.object({
  esquema: z.literal('referencia/ficha@1'),
  titulo: z.string().min(1),
  familia: Familia,
  mecanismos: z.array(Mecanismo).default([]),
  /** Del fondo al frente. */
  capas: z.array(z.string().min(3)).min(2),
  reticula: z.string().min(3),
  tipografia: z
    .array(
      z.object({
        rol: z.enum(['TITULAR', 'SECUNDARIO', 'APOYO', 'MARCA', 'DATO']),
        clasificacion: z.string().min(3),
        /** Altura de mayúscula aproximada, en % del alto del lienzo. */
        escala: z.number().positive().max(80).optional(),
      }),
    )
    .min(1),
  /** HEX medidos sobre la imagen (k-means); el rol lo pone quien analiza. */
  paleta: z.array(z.object({ hex: Hex, rol: z.string().min(2) })).min(1),
  foto: z.string().min(3),
  lecturaFotografica: LecturaFotografica.optional(), // Las fichas de biblioteca anteriores conservan su descripción libre.
  relacionesGraficas: RelacionesGraficas.optional(),
  recursos: z.array(z.object({ recurso: z.string().min(2), funcion: z.string().min(3) })).default([]),
  /** Qué se lee primero, segundo y tercero en el móvil. */
  lectura: z.tuple([z.string().min(2), z.string().min(2), z.string().min(2)]),
  /**
   * F3.3 (punto 12): el tratamiento gráfico, lo que hace que la pieza parezca dibujada, impresa o pegada (ref-pin-34:
   * letra de pincel, rama a tinta, papel, iconos de línea y el producto con filo de pegatina). Opcional: las fichas
   * anteriores no lo tienen.
   */
  tratamiento: z.array(Tratamiento).optional(),
  porQueFunciona: z.string().min(10),
  analizadaPor: z.enum(['ESTUDIO_A_MANO', 'GEMINI']),
  analizadaEn: z.string(),
});
export type FichaReferencia = z.infer<typeof FichaReferencia>;

export const OrigenReferencia = z.discriminatedUnion('tipo', [
  /** Imagen o captura subida por el usuario (o un post de la biblioteca del estudio). */
  z.object({ tipo: z.literal('IMAGEN'), archivo: z.string(), deBiblioteca: z.string().optional() }),
  /**
   * Enlace de Canva, Pinterest u otro. La app no busca en esas plataformas (Pinterest exige app aprobada; el autofill
   * de Canva exige Enterprise): solo intenta leer la imagen pública del enlace. Si el sitio lo bloquea, pide captura.
   */
  z.object({
    tipo: z.literal('ENLACE'),
    url: z.string().url(),
    plataforma: z.enum(['CANVA', 'PINTEREST', 'OTRA']),
    estado: z.enum(['OBTENIDA', 'PIDE_CAPTURA']),
    /** Si se obtuvo, la imagen descargada; si se pide captura, por qué. */
    archivo: z.string().optional(),
    motivo: z.string().optional(),
  }),
]);
export type OrigenReferencia = z.infer<typeof OrigenReferencia>;

/**
 * Puntos 3 y 4 (15/11): ¿la imagen es de verdad un post publicado? Una referencia por enlace puede traer el mockup de un
 * vendedor con marca de agua («Xtreme Flyers», Pinterest), una captura con la interfaz de la app o un collage de varios
 * posts: de eso no se toma oficio.
 */
export const TipoDeImagen = z.enum(['POST', 'MOCKUP', 'MARCA_DE_AGUA', 'CAPTURA_CON_INTERFAZ', 'COLLAGE']);
export type TipoDeImagen = z.infer<typeof TipoDeImagen>;

export const Aptitud = z.object({
  tipo: TipoDeImagen.describe('POST: el post tal cual. MOCKUP: un post puesto en un móvil, una mano o una escena de vendedor. MARCA_DE_AGUA: lleva la marca de agua de un banco de imágenes o de un vendedor. CAPTURA_CON_INTERFAZ: una captura con botones, iconos o textos de la app alrededor. COLLAGE: varios posts juntos.'),
  problemas: z.array(z.string().max(200)).max(5).describe('Qué se ve que lo delata (la marca de agua y dónde, el marco del móvil…). Vacío si es un post limpio.'),
});
export type Aptitud = z.infer<typeof Aptitud>;

/** Lo que se hace con cada tipo: un mockup, una marca de agua o un collage se rechazan; una captura se acepta con aviso. */
export function decidirAptitud(a: Aptitud): 'ACEPTA' | 'AVISA' | 'RECHAZA' {
  if (a.tipo === 'POST') return 'ACEPTA';
  return a.tipo === 'CAPTURA_CON_INTERFAZ' ? 'AVISA' : 'RECHAZA';
}

export const AnalisisAutomatico = z.object({
  fecha: z.string(),
  analista: z.string(),
  aptitud: Aptitud,
  decision: z.enum(['ACEPTA', 'AVISA', 'RECHAZA']),
});
export type AnalisisAutomatico = z.infer<typeof AnalisisAutomatico>;

export const ReferenciaLocal = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  local: z.string(),
  origen: OrigenReferencia,
  ficha: FichaReferencia.optional(),
  /** El análisis automático (ficha con Gemini visión), con lo que dice de la imagen. */
  analisis: AnalisisAutomatico.optional(),
  creadaEn: z.string(),
  nota: z.string().optional(),
});
export type ReferenciaLocal = z.infer<typeof ReferenciaLocal>;

/** Lo que el concepto declara sobre su referencia: qué toma (oficio) y qué no copia (textos, marcas, la pieza entera). */
export const UsoDeReferencia = z.object({
  referencia: z.string(),
  queSeToma: z.array(z.string().min(3)).min(1),
  queNoSeCopia: z.array(z.string().min(3)).min(1),
});
export type UsoDeReferencia = z.infer<typeof UsoDeReferencia>;

/** Una familia de la biblioteca, con su receta y para qué locales encaja. */
export const FamiliaBiblioteca = z.object({
  id: Familia,
  nombre: z.string(),
  posts: z.array(z.string()).min(1),
  fondo: z.enum(['COLOR', 'OSCURO', 'CLARO', 'FOTO']),
  receta: z.string(),
  faltaEnElCompositor: z.array(z.string()).default([]),
  /** Tonos de marca (marca.json) con los que encaja: se comparan con los del local para proponer familias. */
  encajaCon: z.array(z.string()).default([]),
});
export type FamiliaBiblioteca = z.infer<typeof FamiliaBiblioteca>;

/** Piezas creadas en modo real de un local. El modo simulado guarda aparte; por si acaso, se excluyen las simuladas. */
export function piezasRealesDelLocal(piezas: Pieza[], local: string): number {
  return piezas.filter((p) => p.localSlug === local && !(p.generaciones.length > 0 && p.generaciones.every((g) => g.origen === 'SIMULADO'))).length;
}

/**
 * Una pieza hecha con las herramientas de línea de comandos (decisión del 09/11/2026: cuentan para el umbral).
 * Se declara en el plan del proyecto (`proyectos/…/plan.json` → `pieza`); los planes sin `pieza` son experimentos
 * (benchmark, maquetas) y no cuentan.
 */
export const PiezaHecha = z.object({
  /** Carpeta del proyecto, relativa a proyectos/. */
  proyecto: z.string().min(1),
  local: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'AAAA-MM-DD'),
  /** Id de la referencia registrada con `npm run referencia` de la que parte, si la hay. */
  referencia: z.string().min(1).optional(),
});
export type PiezaHecha = z.infer<typeof PiezaHecha>;

/** Piezas del local que cuentan para el umbral: las reales de la app y las hechas con herramientas. */
export function piezasQueCuentan(app: Pieza[], herramientas: PiezaHecha[], local: string): { app: number; herramientas: number; total: number } {
  const deApp = piezasRealesDelLocal(app, local);
  const deHerramientas = herramientas.filter((p) => p.local === local).length;
  return { app: deApp, herramientas: deHerramientas, total: deApp + deHerramientas };
}

export type PasoAConcepto =
  | { puede: true; motivo: string }
  | { puede: false; motivo: string; falta: 'REFERENCIA' | 'FICHA' | 'CAPTURA' };

/**
 * ¿Puede una pieza pasar de brief a concepto? Mientras el local tenga menos piezas reales que el umbral,
 * hace falta una referencia elegida y analizada (con ficha). Una referencia por enlace que no se pudo leer necesita captura.
 */
export function comprobarPasoAConcepto(
  entrada: { piezasReales: number; referencia?: ReferenciaLocal },
  umbral = UMBRAL_REFERENCIA_OBLIGATORIA,
): PasoAConcepto {
  const { piezasReales, referencia } = entrada;
  if (piezasReales >= umbral) {
    return { puede: true, motivo: `El local ya tiene ${piezasReales} piezas: la referencia es opcional.` };
  }
  const quedan = umbral - piezasReales;
  if (!referencia) {
    return {
      puede: false,
      falta: 'REFERENCIA',
      motivo: `Este local lleva ${piezasReales} pieza(s); hasta la ${umbral}.ª cada pieza parte de una referencia (quedan ${quedan}). Sube una imagen o pega un enlace de Canva o Pinterest, o elige una de las familias propuestas.`,
    };
  }
  if (referencia.origen.tipo === 'ENLACE' && referencia.origen.estado === 'PIDE_CAPTURA') {
    return {
      puede: false,
      falta: 'CAPTURA',
      motivo: `No se pudo leer el enlace (${referencia.origen.motivo ?? 'sin detalle'}). Sube una captura del post: no se analiza lo que no se ha visto.`,
    };
  }
  if (referencia.analisis?.decision === 'RECHAZA') {
    return {
      puede: false,
      falta: 'REFERENCIA',
      motivo: `La imagen de «${referencia.id}» no es un post publicado (${referencia.analisis.aptitud.tipo}: ${referencia.analisis.aptitud.problemas.join('; ') || 'sin detalle'}): de ahí no se toma oficio. Sube el post limpio o elige otra referencia.`,
    };
  }
  if (!referencia.ficha) {
    return { puede: false, falta: 'FICHA', motivo: 'La referencia está sin analizar: hace falta su ficha antes del concepto.' };
  }
  return { puede: true, motivo: `Parte de la referencia «${referencia.id}» (${referencia.ficha.familia}).` };
}

/**
 * Si el usuario no tiene referencia, se le proponen tres familias de la biblioteca para que elija.
 * Primero las que encajan con los tonos del local; después se busca variedad de fondo (color, oscuro, claro),
 * para que vea opciones distintas y no tres versiones de lo mismo. Orden estable.
 */
export function proponerFamilias(familias: FamiliaBiblioteca[], tonos: string[], cuantas = 3): FamiliaBiblioteca[] {
  const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const tonosLocal = new Set(tonos.map(normal));
  const puntuadas = familias
    .map((f, orden) => ({ f, orden, puntos: f.encajaCon.filter((t) => tonosLocal.has(normal(t))).length }))
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden);
  const elegidas: FamiliaBiblioteca[] = [];
  const fondos = new Set<string>();
  for (const { f } of puntuadas) {
    if (elegidas.length >= cuantas) break;
    if (fondos.has(f.fondo)) continue;
    elegidas.push(f);
    fondos.add(f.fondo);
  }
  for (const { f } of puntuadas) {
    if (elegidas.length >= cuantas) break;
    if (!elegidas.includes(f)) elegidas.push(f);
  }
  return elegidas;
}

/** Plataforma de un enlace, por su dominio. */
export function plataformaDe(url: string): 'CANVA' | 'PINTEREST' | 'OTRA' {
  const host = new URL(url).hostname.toLowerCase();
  if (host === 'canva.com' || host.endsWith('.canva.com') || host === 'canva.link') return 'CANVA';
  if (host === 'pin.it' || /(^|\.)pinterest\.[a-z.]+$/.test(host)) return 'PINTEREST';
  return 'OTRA';
}
