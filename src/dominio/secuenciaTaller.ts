import { z } from 'zod';
import { ModoDeLuz } from './luzFotografica.js';

const texto = z.string().trim().min(8).max(360);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const toma = z.strictObject({
  vista: z.enum(['RASANTE', 'OBLICUA', 'CENITAL']),
  plano: z.enum(['GENERAL', 'MEDIO', 'PRIMER_PLANO', 'MACRO']),
  gesto: texto,
  encuadre: texto,
});

export const DireccionPortada = toma.extend({ idea: texto, luz: ModoDeLuz });
export type DireccionPortada = z.infer<typeof DireccionPortada>;

export interface PostReciente {
  pieza: string;
  plato: string;
  portada?: { vista: string; plano: string; escena: string; gesto: string };
  otrasTomas?: Pick<z.infer<typeof toma>, 'vista' | 'plano' | 'gesto'>[];
  estructura?: string[];
  miniatura?: Buffer;
}

export type DirectorPortada = (entrada: {
  original: Buffer;
  encargo: string;
  tipo: 'PRODUCTO' | 'ESPACIO' | 'SERVICIO';
  formato?: 'post' | 'carrusel';
  referencia?: unknown;
  referenciaVisual?: Buffer;
  luzSolicitada?: ModoDeLuz;
  recientes: PostReciente[];
}) => Promise<DireccionPortada>;
export const CajaDeCarrusel = z.strictObject({
  x: z.number().min(0).lt(1), y: z.number().min(0).lt(1),
  w: z.number().min(.05).max(1), h: z.number().min(.05).max(1),
}).refine(b => b.x + b.w <= 1.000001 && b.y + b.h <= 1.000001, 'La caja tiene que quedar dentro de la lámina.');
const profundidadEditorial = z.strictObject({ primerPlano: CajaDeCarrusel, zonaTexto: CajaDeCarrusel });

export const DireccionSecuencia = z.strictObject({
  continuidad: texto,
  detalle: toma,
  cierre: toma,
  portada: profundidadEditorial.nullable(),
}).refine(d => d.detalle.vista !== d.cierre.vista &&
  d.detalle.plano !== d.cierre.plano &&
  d.detalle.gesto.toLocaleLowerCase('es') !== d.cierre.gesto.toLocaleLowerCase('es'),
  'Detalle y cierre deben variar el punto de vista, la escala y la acción.');
export type DireccionSecuencia = z.infer<typeof DireccionSecuencia>;

export const TomaDeSerie = z.enum(['detalle', 'cierre', 'extra']);
export type TomaDeSerie = z.infer<typeof TomaDeSerie>;
const FotoDePagina = z.enum(['base', ...TomaDeSerie.options]);
export type FotoDePagina = z.infer<typeof FotoDePagina>;
export const TratamientoEditorial = z.enum(['FOTO', 'ARCO', 'DIPTICO', 'TEXTO_EN_AIRE', 'TIPOGRAFIA']);
export const AcentoEditorial = z.enum(['HERBAL', 'MINERAL', 'FRUTA']);
const paginaEditorial = z.strictObject({
  tratamiento: TratamientoEditorial,
  fotos: z.array(FotoDePagina).max(2),
  intencion: texto,
  titulo: z.string().trim().max(64),
  apoyo: z.string().trim().max(55),
  nota: z.string().trim().max(55),
  encuadres: z.array(z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), zoom: z.number().min(1).max(3) })).max(2).optional(),
  ordenTexto: z.enum(['TITULO_ANTES', 'APOYO_ANTES']).optional(),
  esquina: z.enum(['SUPERIOR_IZQUIERDA', 'SUPERIOR_DERECHA', 'INFERIOR_IZQUIERDA', 'INFERIOR_DERECHA']).optional(),
  profundidad: profundidadEditorial.optional(),
});
export type PaginaEditorial = z.infer<typeof paginaEditorial>;
const tomaEditorial = toma.extend({ nombre: texto, reserva: z.string().trim().max(240), formato: z.enum(['4:5', '1:1']).optional() });
export const GuionEditorial = z.strictObject({
  idea: texto,
  continuidad: texto,
  adaptacion: texto,
  acento: AcentoEditorial,
  tomas: z.strictObject({ detalle: tomaEditorial.optional(), cierre: tomaEditorial.optional(), extra: tomaEditorial.optional() }),
  paginas: z.array(paginaEditorial).min(2).max(5),
}).superRefine((g, ctx) => {
  const error = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });
  const usadas = new Set<FotoDePagina>();
  g.paginas.forEach((p, i) => {
    const cantidad = p.tratamiento === 'DIPTICO' ? 2 : p.tratamiento === 'TIPOGRAFIA' ? 0 : 1;
    if (p.fotos.length !== cantidad || new Set(p.fotos).size !== cantidad) {
      error('En díptico usa dos fotografías diferentes, en tipografía ninguna y en el resto una.', ['paginas', i, 'fotos']);
    }
    if (p.encuadres && p.encuadres.length !== cantidad) error('Indica un encuadre por cada foto de la lámina.', ['paginas', i, 'encuadres']);
    if (p.tratamiento === 'FOTO' ? Boolean(p.titulo || p.apoyo || p.nota) : !p.titulo) {
      error('La página fotográfica va sin texto y las demás necesitan un titular breve.', ['paginas', i, 'titulo']);
    }
    if (p.nota && p.tratamiento !== 'DIPTICO') error('Reserva nota para el segundo pie del díptico.', ['paginas', i, 'nota']);
    if (p.profundidad && p.tratamiento !== 'TEXTO_EN_AIRE') error('La profundidad requiere una foto a sangre con texto.', ['paginas', i, 'profundidad']);
    for (const id of p.fotos) {
      usadas.add(id);
      if (id !== 'base' && !g.tomas[id]) error('Describe esta toma antes de utilizarla.', ['paginas', i, 'fotos']);
    }
  });
  if (!usadas.has('base')) error('Usa la foto de apertura aprobada en alguna lámina.', ['paginas']);
  if (g.paginas.filter(p => p.fotos.length).length > 1 && usadas.size < 2) {
    error('Usa otra toma real cuando varias láminas incluyan fotografía.', ['paginas']);
  }
  const gestos = new Set<string>();
  for (const id of TomaDeSerie.options) {
    const planeada = g.tomas[id];
    if (planeada && !usadas.has(id)) error('Quita las tomas que no aparecen en ninguna lámina.', ['tomas', id]);
    if (!planeada) continue;
    const gesto = planeada.gesto.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');
    if (gestos.has(gesto)) error('Da a esta toma una acción o motivo distinto.', ['tomas', id, 'gesto']);
    gestos.add(gesto);
  }
});
export type GuionEditorial = z.infer<typeof GuionEditorial>;
export type DireccionCarrusel = DireccionSecuencia | GuionEditorial;

export function tomaPlaneada(direccion: DireccionCarrusel, id: TomaDeSerie) {
  return 'paginas' in direccion ? direccion.tomas[id] : id === 'extra' ? undefined : direccion[id];
}

export function formatoDeToma(toma: NonNullable<ReturnType<typeof tomaPlaneada>>) {
  return 'formato' in toma && toma.formato === '1:1' ? '1:1' : '4:5';
}

const foto = z.object({
  sha256: hash, modelo: z.string(), uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']),
  aprobada: z.boolean().default(false),
});
const estado = z.object({ envioReservado: z.literal(true).optional(), candidata: foto.optional() });
export const LecturaFotografica = z.strictObject({
  recomendacion: z.enum(['FOTOGRAFIA', 'EDITORIAL']),
  orden: z.array(FotoDePagina).min(2).max(4).refine(ids => new Set(ids).size === ids.length, 'Cada foto aparece una vez.'),
  motivo: texto,
});
export type LecturaFotografica = z.infer<typeof LecturaFotografica>;
export const SecuenciaTaller = z.object({
  huella: hash, comanda: hash, version: z.int().positive(), baseSha256: hash, modelo: z.string(),
  luz: ModoDeLuz.optional(),
  direccion: z.union([DireccionSecuencia, GuionEditorial]),
  documental: z.literal(true).optional(),
  preferencia: z.string().trim().max(480).optional(),
  referenciaVisualSha256: hash.optional(),
  lecturaFotografica: LecturaFotografica.extend({ modelo: z.string() }).optional(),
  mascaras: z.partialRecord(z.enum(['1', '2', '3', '4', '5']), hash).optional(),
  tomas: z.object({ detalle: estado, cierre: estado, extra: estado.optional() }),
});
export type SecuenciaTaller = z.infer<typeof SecuenciaTaller>;

export function ordenFotografico(direccion: GuionEditorial): FotoDePagina[] {
  return [...new Set(direccion.paginas.flatMap(p => p.fotos))];
}

export function puedeValorarFotografias(secuencia?: SecuenciaTaller, alAprobar?: TomaDeSerie) {
  if (!secuencia || secuencia.lecturaFotografica || !('paginas' in secuencia.direccion) ||
    secuencia.direccion.paginas.every(p => p.tratamiento === 'FOTO')) return false;
  const fotos = ordenFotografico(secuencia.direccion);
  return fotos.length >= 2 && fotos.every(id => id === 'base' || secuencia.tomas[id]?.candidata?.aprobada ||
    (id === alAprobar && secuencia.tomas[id]?.candidata));
}

export function esquemaDeLectura(ids: readonly FotoDePagina[]) {
  return LecturaFotografica.refine(l => l.orden.length === ids.length && l.orden.every(id => ids.includes(id)),
    'Ordena las fotos aprobadas que recibiste, sin inventar ni repetir identificadores.');
}

export type RevisorDeCarrusel = (entrada: {
  nota: string;
  preferencia?: string;
  guion: GuionEditorial;
  fotos: { id: FotoDePagina; bytes: Buffer }[];
}) => Promise<LecturaFotografica & { modelo: string }>;

export type DirectorSecuencia = (entrada: {
  original: Buffer;
  portada: Buffer;
  encargo: string;
  producto: string;
  referencia?: unknown;
  luz?: ModoDeLuz;
  recientes?: PostReciente[];
}) => Promise<{ direccion: DireccionSecuencia; modelo: string }>;
export type DirectorCarrusel = (entrada: Parameters<DirectorSecuencia>[0] & {
  nombre: string;
  preferencia?: string;
  referenciaVisual?: Buffer;
  documental?: true;
}) => Promise<{ direccion: GuionEditorial; modelo: string }>;

export const direccionSecuenciaSimulada: DireccionSecuencia = {
  continuidad: 'Mantén la vajilla, la superficie y la dirección de luz que se ven en la portada.',
  detalle: { vista: 'RASANTE', plano: 'MACRO', gesto: 'La textura del alimento entra en foco junto al borde del plato.', encuadre: 'Acércate desde el flanco y deja un segundo plano desenfocado.' },
  cierre: { vista: 'CENITAL', plano: 'GENERAL', gesto: 'Una mano anónima acerca el plato por el borde.', encuadre: 'Muestra el plato entero y su apoyo sobre la mesa.' },
  portada: { primerPlano: { x: .46, y: 0, w: .54, h: .38 }, zonaTexto: { x: .045, y: .155, w: .625, h: .19 } },
};

export const directorCarruselSimulado: DirectorCarrusel = async ({ nombre, encargo, preferencia }) => {
  const plano = direccionSecuenciaSimulada;
  const base = {
    modelo: 'Simulador de carrusel',
    direccion: GuionEditorial.parse({
      idea: 'Alterna el plato completo con una mirada a su textura y un gesto de mesa.',
      continuidad: plano.continuidad,
      adaptacion: 'El marco concentra la mirada y las dos ventanas comparan escalas.',
      acento: 'HERBAL',
      tomas: {
        detalle: { ...plano.detalle, nombre: 'Textura de cerca', reserva: 'Protege el centro de la foto para la ventana izquierda.' },
        cierre: { ...plano.cierre, nombre: 'Gesto de servicio', reserva: 'Deja aire limpio en la esquina superior izquierda.' },
        extra: { vista: 'OBLICUA', plano: 'MEDIO', gesto: 'El plato queda en reposo y su contorno proyecta una sombra lateral.',
          encuadre: 'Deja espacio alrededor de la vajilla y muestra su posición sobre la mesa.', nombre: 'El contorno del plato',
          reserva: 'Centra la vajilla y conserva todo su borde para la ventana arqueada.', formato: '1:1' },
      },
      paginas: [
        { tratamiento: 'FOTO', fotos: ['base'], intencion: 'El plato se conoce primero desde la fotografía.', titulo: '', apoyo: '', nota: '' },
        { tratamiento: 'ARCO', fotos: ['extra'], intencion: 'El nombre aparece al deslizar por primera vez.', titulo: nombre.slice(0, 64), apoyo: '', nota: '' },
        { tratamiento: 'DIPTICO', fotos: ['detalle', 'extra'], intencion: 'Compara una textura y la vista de conjunto.', titulo: 'De cerca', apoyo: 'Textura', nota: 'En la mesa' },
        { tratamiento: 'TEXTO_EN_AIRE', fotos: ['cierre'], intencion: 'El carrusel termina con un gesto de servicio.', titulo: 'A la mesa', apoyo: '', nota: '', esquina: 'SUPERIOR_IZQUIERDA' },
      ],
    }),
  };
  if (soloFotografia(encargo, preferencia)) {
    const plan = base.direccion;
    return { ...base, direccion: GuionEditorial.parse({ ...plan, tomas: { detalle: plan.tomas.detalle }, paginas: [
      plan.paginas[0],
      { ...plan.paginas[0], fotos: ['detalle'], intencion: 'Acerca la cámara para mostrar una textura que la primera foto deja entrever.' },
    ] }) };
  }
  return base;
};

export function soloFotografia(encargo: string, preferencia = '') {
  const sinTexto = /\b(?:sin (?:nada de |a[ñn]adir )?(?:texto|letras|copy)|s[oó]lo (?:fotos|fotograf[ií]as)|fotograf[ií]a pura)\b/iu;
  const unaLamina = /\b(?:apertura|portada|cierre|detalle|l[aá]mina|p[aá]gina|diapositiva)\b/iu;
  const todaLaSerie = /\b(?:todo el carrusel|toda la serie|en ninguna l[aá]mina|en todas las l[aá]minas|carrusel sin|serie sin)\b/iu;
  return [encargo, preferencia].flatMap(texto => texto.split(/[.!?;\n]/u)).some(frase =>
    sinTexto.test(frase) && (!unaLamina.test(frase) || todaLaSerie.test(frase)));
}
