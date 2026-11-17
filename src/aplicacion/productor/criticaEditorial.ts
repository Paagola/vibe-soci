import { z } from 'zod';
import type { BriefDelEncargo } from '../../dominio/brief.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { validar } from '../../dominio/validacion.js';
import type { Intencion } from '../../dominio/diseno/intencion.js';
import { lienzoDe, rectDeCaja } from '../../dominio/diseno/reticula.js';
import type { DiapositivaEditorial } from '../../dominio/editorial.js';
import { cartelDePortada, fichaDeCartel, esquemaDelPlanEditorial } from './editorial.js';

interface ImagenEditorial {
  id: string;
  /** JPEG orientado como lo verá la persona que revisa. */
  bytes: Uint8Array;
}

export interface PaginaRenderizada extends ImagenEditorial {
  version: number;
}

export interface EncargoCriticaEditorial {
  brief: BriefDelEncargo;
  /** Arte renderizado, en el orden del plan. */
  paginas: readonly PaginaRenderizada[];
  /** Originales para cotejar el producto. Cuando el plan tenga recortes, su foto fuente va primero. */
  originales?: readonly ImagenEditorial[];
  referencia?: { id: string; huella: string; ficha?: string };
}

export interface CriticoEditorial {
  readonly modelo: string;
  revisar(encargo: EncargoCriticaEditorial): Promise<CriticaEditorial>;
}

const id = z.string().max(128).regex(/^[a-z0-9][a-z0-9-]*$/);
const version = z.int().positive();
const coordenada = z.number().min(0).max(1);
const dato = z.int().min(1).max(3);

export const CorreccionEditorial = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('AJUSTAR_RECORTE'),
    enfoque: z.strictObject({ x: coordenada, y: coordenada }),
    zoom: z.number().min(1.2).max(4),
  }),
  z.strictObject({ tipo: z.literal('MEJORAR_CONTRASTE'), dato }),
  z.strictObject({ tipo: z.literal('AJUSTAR_TAMANO'), dato, factor: z.number().min(0.8).max(1.3) }),
  z.strictObject({ tipo: z.literal('AJUSTAR_MARGEN'), margen: z.number().min(0.05).max(0.14) }),
  z.strictObject({ tipo: z.literal('DESPEJAR_TITULAR') }),
  z.strictObject({ tipo: z.literal('REVISION_HUMANA') }),
]);
export type CorreccionEditorial = z.infer<typeof CorreccionEditorial>;

const IncidenciaEditorial = z.strictObject({
  id,
  version,
  motivo: z.string().trim().min(1).max(260),
  correccion: CorreccionEditorial,
});
export type IncidenciaEditorial = z.infer<typeof IncidenciaEditorial>;

export const CriticaEditorial = z.strictObject({ incidencias: z.array(IncidenciaEditorial).max(5) });
export type CriticaEditorial = z.infer<typeof CriticaEditorial>;

const Imagen = z.object({ id, bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength > 0, 'Faltan los bytes de la imagen.') });
const MaterialDeCritica = z.object({
  paginas: z.array(Imagen.extend({ version })).min(1).max(5),
  originales: z.array(Imagen).max(5).optional(),
  referencia: z.strictObject({ id: z.string().min(1), huella: z.string().regex(/^[a-f0-9]{64}$/), ficha: z.string().optional() }).optional(),
});

export function esquemaDeCriticaEditorial(encargo: EncargoCriticaEditorial) {
  const { brief } = encargo;
  const editorial = brief.editorial;
  if (brief.hechos.inventario.estado !== 'CONFIRMADO' || !editorial || editorial.inventarioSha256 !== brief.hechos.inventario.huella) {
    throw new ErrorDeUsuario('La revisión editorial exige un plan con el inventario confirmado.');
  }
  const { diapositivas } = validar(esquemaDelPlanEditorial(brief), editorial.plan, 'El plan editorial no coincide con el brief confirmado.');
  const { paginas, originales, referencia } = validar(MaterialDeCritica, encargo, 'Falta material válido para la revisión editorial.');
  if (paginas.length !== diapositivas.length || new Set(paginas.map((p) => p.id)).size !== paginas.length) {
    throw new ErrorDeUsuario('La crítica necesita una página renderizada por cada diapositiva del plan.');
  }
  if (originales && new Set(originales.map((p) => p.id)).size !== originales.length) {
    throw new ErrorDeUsuario('Cada foto original de la revisión debe tener su propio identificador.');
  }
  const idReferencia = editorial.referencia ?? brief.referencia?.id;
  if (referencia && idReferencia && referencia.id !== idReferencia) {
    throw new ErrorDeUsuario('La ficha de referencia no coincide con la referencia del brief.');
  }
  const ficha = fichaDeCartel(editorial.fichaReferencia);
  const vistas = new Map(paginas.map((pagina, i) => [pagina.id, { version: pagina.version, editorial: cartelDePortada(diapositivas[i]!, ficha, brief) ?? diapositivas[i]! }]));

  return CriticaEditorial.superRefine(({ incidencias }, ctx) => {
    const revisadas = new Set<string>();
    incidencias.forEach((incidencia, i) => {
      const { id, version, correccion } = incidencia;
      const pagina = vistas.get(id);
      const problema = (campo: string, message: string) => ctx.addIssue({ code: 'custom', path: ['incidencias', i, campo], message });
      if (!pagina || pagina.version !== version) {
        problema('id', 'Usa el id y la versión de una página renderizada que aparezca en esta revisión.');
        return;
      }
      if (revisadas.has(id)) problema('id', 'Describe una sola incidencia por página.');
      revisadas.add(id);
      const tratamiento = pagina.editorial;
      const datos = tratamiento.tratamiento === 'CIERRE_TEXTO' ? tratamiento.textos.length
        : tratamiento.tratamiento === 'FOTO_TEXTO_AL_BORDE' && !tratamiento.arco ? 1 : 0;
      switch (correccion.tipo) {
        case 'DESPEJAR_TITULAR':
          if (tratamiento.tratamiento !== 'CARTEL') problema('correccion', 'El ajuste del titular pertenece a una portada de cartel.');
          break;
        case 'AJUSTAR_RECORTE':
          if (tratamiento.tratamiento !== 'RECORTE_DETALLE' || !originales?.length) {
            problema('correccion', 'Solo se puede ajustar el recorte de un detalle con su foto fuente disponible.');
          }
          break;
        case 'MEJORAR_CONTRASTE':
        case 'AJUSTAR_TAMANO':
          if (correccion.dato > datos) problema('correccion', 'El dato debe existir en una banda de texto de esta página.');
          break;
        case 'AJUSTAR_MARGEN':
          if (!datos) problema('correccion', 'El margen horizontal se aplica a una banda de texto existente.');
          break;
      }
    });
  });
}

export class CriticoEditorialSimulado implements CriticoEditorial {
  readonly modelo = 'SIMULADO';

  constructor(private readonly incidencias: readonly IncidenciaEditorial[] = []) {}

  async revisar(encargo: EncargoCriticaEditorial): Promise<CriticaEditorial> {
    return esquemaDeCriticaEditorial(encargo).parse({ incidencias: this.incidencias });
  }
}

/** Si la traducción se perdió entre agentes, una foto con un pie legible tampoco satisface un plan de cartel. */
export function revisarEstructuraDelCartel(
  brief: BriefDelEncargo, pagina: DiapositivaEditorial, intencion: Intencion,
): IncidenciaEditorial | undefined {
  const cartel = cartelDePortada(pagina, fichaDeCartel(brief.editorial?.fichaReferencia), brief);
  if (!cartel) return undefined;
  const lienzo = lienzoDe(intencion.lienzo.formato);
  const legible = intencion.capas.some(c => {
    if (c.oculta || c.opacidad === 0 || c.tipo !== 'texto') return false;
    const caja = rectDeCaja(c.caja, lienzo, intencion.reticula);
    return cartel.estructura === 'EJE_VERTICAL'
      ? Math.abs(c.rotacion + c.giro) >= 60 && caja.h >= lienzo.alto * 0.40
      : caja.y < lienzo.alto * 0.32 && caja.w >= lienzo.ancho * 0.50 && caja.h >= lienzo.alto * 0.095;
  });
  if (legible) return undefined;
  return { id: intencion.id, version: intencion.version, correccion: { tipo: 'REVISION_HUMANA' },
    motivo: cartel.estructura === 'EJE_VERTICAL'
      ? 'El cartel perdió su eje. Falta una palabra girada que ocupe la columna junto a la foto.'
      : 'El cartel perdió la jerarquía de cabecera. Falta el bloque tipográfico principal junto al producto.' };
}
