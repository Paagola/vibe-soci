/**
 * Perfil de marca v2 (F1.5): lo que el director creativo necesita saber de un restaurante para que una pieza
 * se reconozca como suya sin parecer siempre la misma.
 *
 * - **constantes**: lo que hace reconocible al local y no cambia entre campañas (nombre, paleta, tipografías, voz…).
 * - **variables**: lo que puede cambiar según la pieza (tratamiento fotográfico, grado de experimentación,
 *   recursos gráficos…). Se dan como márgenes, no como una plantilla.
 * - Cada dato dice de dónde sale y si está confirmado. Lo que no se sabe va a `pendientes`: no se rellena.
 *
 * Las preferencias del dueño no viven aquí: salen de las observaciones (dominio/aprendizaje.ts), que distinguen
 * lo observado de lo que solo es una hipótesis.
 */
import { z } from 'zod';
import type { Marca } from '../modelos.js';

export const FuenteDato = z.enum([
  'DOCUMENTO', // un archivo del proyecto (marca.json, brief, nota de una foto)
  'PROPIETARIO', // lo ha dicho el dueño
  'FOTO', // se ve en una foto real del local
  'ESTUDIO', // propuesta del estudio, pendiente de que el dueño la confirme
]);

const Dato = <T extends z.ZodType>(valor: T) =>
  z.object({
    valor,
    fuente: FuenteDato,
    /** Ruta del archivo, fecha de la conversación o id de la foto. */
    referencia: z.string(),
    confirmado: z.boolean().default(false),
  });

const Color = z.object({ nombre: z.string(), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/), papel: z.string().optional() });
const Tipografia = z.object({
  rol: z.enum(['TITULOS', 'TEXTOS', 'ROTULO']),
  descripcion: z.string(),
  /** Fuente del catálogo (recursos/tipografias) que la cumple, si se ha elegido. */
  fuente: z.string().optional(),
  licencia: z.string().optional(),
});

/**
 * Fidelidad del producto en las fotos nuevas (decisión de la dirección del estudio, 07/11/2026; sustituye a la del 06/11):
 * - FLEXIBLE (por defecto): cambian cámara, luz, fondo, encuadre y colocación; se conservan los ELEMENTOS del plato
 *   (qué es, cuántas piezas, anatomía, ingredientes) y la vajilla. Se descarta lo que añade un componente nuevo;
 *   no se descarta lo que solo cambia la luz o el brillo.
 * - ESTRICTA (si el local lo pide): además no cambia el ángulo; para otro ángulo se pide al restaurante una foto nueva.
 */
export const Fidelidad = z.enum(['FLEXIBLE', 'ESTRICTA']);
export type Fidelidad = z.infer<typeof Fidelidad>;
export const FIDELIDAD_POR_DEFECTO = {
  valor: 'FLEXIBLE' as const,
  fuente: 'ESTUDIO' as const,
  referencia: 'decisión de la dirección del estudio, 07/11/2026 (valor por defecto para todos los locales)',
  confirmado: true,
};

export const PerfilDeMarca = z.object({
  esquema: z.literal('marca/perfil@2'),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  fidelidad: Dato(Fidelidad).default(FIDELIDAD_POR_DEFECTO),
  constantes: z.object({
    nombre: Dato(z.string()),
    ubicacion: Dato(z.string()),
    concepto: Dato(z.string()).optional(),
    personalidad: Dato(z.array(z.string())).optional(),
    paleta: Dato(z.array(Color)).optional(),
    tipografias: Dato(z.array(Tipografia)).optional(),
    /** Cómo firma una pieza (nombre compuesto, logotipo real…). Nunca un logotipo dibujado por el estudio. */
    firma: Dato(z.string()).optional(),
    voz: Dato(z.array(z.string())).optional(),
  }),
  variables: z.object({
    /** Tratamientos fotográficos que encajan (p. ej. «claroscuro de brasa», «luz de día sobre mantel»). */
    fotografia: Dato(z.array(z.string())).optional(),
    /** De 0 (muy contenido) a 3 (experimental). Sin dato del dueño es una propuesta del estudio. */
    experimentacion: Dato(z.number().int().min(0).max(3)).optional(),
    /** Recursos gráficos que pertenecen a su universo. Vacío = ninguno añadido. */
    recursos: Dato(z.array(z.string())).optional(),
  }),
  /** Lo que no se puede hacer o decir (p. ej. «no inventar premios», «no mostrar la parrilla: no hay foto»). */
  restricciones: z.array(Dato(z.string())).default([]),
  /** Material real disponible: ids de activos y qué muestran. */
  material: z.array(z.object({ activo: z.string(), muestra: z.string() })).default([]),
  /** Campos que harían falta y no constan. El director no los presenta como hechos. */
  pendientes: z.array(z.string()).default([]),
});
export type PerfilDeMarca = z.infer<typeof PerfilDeMarca>;

/** Campos del perfil que hoy no salen de ningún dato del estudio (se piden al dueño poco a poco). */
export const CAMPOS_SIN_ORIGEN_HOY = [
  'logotipo en archivo (SVG o PNG) y dónde se puede usar',
  'tipografías propias del local o su licencia',
  'preferencias fotográficas del dueño',
  'grado de experimentación que acepta',
  'recursos gráficos que considera suyos y los que rechaza',
  'datos de contacto para la llamada a la acción (reservas, web, teléfono)',
] as const;

/**
 * Lo que se puede sacar hoy del `marca.json` de un local (el modelo Marca de la web).
 * Todo entra como DOCUMENTO sin confirmar; lo que el modelo no tiene queda en `pendientes`.
 */
export function perfilDesdeMarca(marca: Marca, referencia: string): PerfilDeMarca {
  const dato = <T>(valor: T) => ({ valor, fuente: 'DOCUMENTO' as const, referencia, confirmado: false });
  const pendientes: string[] = [...CAMPOS_SIN_ORIGEN_HOY];
  if (!marca.descripcion) pendientes.unshift('concepto o descripción del local');
  if (marca.colores.length === 0) pendientes.unshift('paleta');
  if (marca.tipografias.length === 0) pendientes.unshift('tipografías');
  return PerfilDeMarca.parse({
    esquema: 'marca/perfil@2',
    slug: marca.slug,
    constantes: {
      nombre: dato(marca.nombre),
      ubicacion: dato(marca.ciudad),
      ...(marca.descripcion ? { concepto: dato(marca.descripcion) } : {}),
      personalidad: dato(marca.tonos),
      ...(marca.colores.length ? { paleta: dato(marca.colores.map((c) => ({ nombre: c.nombre, hex: c.hex.toUpperCase() }))) } : {}),
      ...(marca.tipografias.length ? { tipografias: dato(marca.tipografias.map((t) => ({ rol: t.rol, descripcion: t.descripcion }))) } : {}),
      ...(marca.instagram || marca.web ? { firma: dato([marca.instagram, marca.web].filter(Boolean).join('\n')) } : {}),
    },
    variables: {},
    restricciones: [],
    material: [],
    pendientes,
  });
}
