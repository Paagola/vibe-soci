import type { BriefDelEncargo, DiapositivaDelPlan } from '../../dominio/brief.js';
import { PlanEditorial, type CartelEditorial, type DiapositivaEditorial, type ReferenciaTextoEditorial } from '../../dominio/editorial.js';
import { FichaReferencia } from '../../dominio/referencia.js';

export { DiapositivaEditorial, PlanEditorial, ReferenciaTextoEditorial } from '../../dominio/editorial.js';

export interface EncargoEditorial {
  brief: BriefDelEncargo;
  /** Foto fuente sobre la que se expresan las coordenadas de los recortes. */
  foto: { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' };
  oficio?: string;
  fichaReferencia?: string;
}

export interface ProductorEditorial {
  readonly modelo: string;
  proponer(encargo: EncargoEditorial): Promise<PlanEditorial>;
}

function textoDelBrief(brief: BriefDelEncargo, texto: ReferenciaTextoEditorial): string | undefined {
  switch (texto.fuente) {
    case 'MARCA':
      return brief.marca.nombre.trim() || undefined;
    case 'CIUDAD':
      return brief.marca.ciudad.trim() || undefined;
    case 'INSTAGRAM': {
      const usuario = brief.marca.instagram?.trim().replace(/^@/, '');
      return usuario ? `@${usuario}` : undefined;
    }
    case 'ELEMENTO':
      return brief.hechos.inventario.elementos[texto.indice]?.nombre.trim() || undefined;
  }
}

/** Resuelve los textos desde sus fuentes. Los elementos requieren la aprobación del inventario. */
export function textoConfirmado(brief: BriefDelEncargo, texto: ReferenciaTextoEditorial): string | undefined {
  if (texto.fuente === 'ELEMENTO' && brief.hechos.inventario.estado !== 'CONFIRMADO') return undefined;
  return textoDelBrief(brief, texto);
}

/** Traduce mecanismos de la ficha archivada. Sus ejemplos, paleta y textos nunca pasan a la composición. */
export function fichaDeCartel(serializada?: string): FichaReferencia | undefined {
  if (!serializada) return undefined;
  try { return FichaReferencia.safeParse(JSON.parse(serializada)).data; } catch { return undefined; }
}

export function cartelDePortada(
  pagina: DiapositivaEditorial, ficha: FichaReferencia | undefined, brief: BriefDelEncargo, nuevo = false,
): CartelEditorial | undefined {
  if (pagina.tratamiento === 'CARTEL') return pagina;
  if (pagina.papel !== 'portada' || !ficha) return undefined;
  const anuncio = pagina.tratamiento === 'FOTO_TEXTO_AL_BORDE' && pagina.gesto === 'ANUNCIO';
  const grafico = nuevo && brief.estetica !== 'EDITORIAL_SERENO' && brief.estetica !== 'EDITORIAL_OSCURO';
  if (!anuncio && !grafico) return undefined;
  const vertical = ficha.mecanismos.includes('PALABRA_GIRADA');
  const cabecera = ficha.mecanismos.some(m => ['PALABRA_DETRAS', 'CONTORNO_AL_CRUZAR', 'PATRON_REPETIDO'].includes(m));
  if (!vertical && !cabecera) return undefined;
  const elementos = brief.hechos.inventario.elementos;
  const elegido = elementos.findIndex(e => e.origen === 'NOTA' && e.nombre.trim());
  const indice = elegido >= 0 ? elegido : elementos.findIndex(e => e.nombre.trim());
  const texto: ReferenciaTextoEditorial = pagina.tratamiento === 'FOTO_TEXTO_AL_BORDE' ? pagina.texto
    : indice >= 0 ? { fuente: 'ELEMENTO', indice } : { fuente: 'MARCA' };
  if (!textoDelBrief(brief, texto)) return undefined;
  return {
    n: pagina.n, papel: 'portada', tratamiento: 'CARTEL', texto,
    estructura: vertical ? 'EJE_VERTICAL' : 'CABECERA',
    superficie: ficha.mecanismos.includes('PAPEL_RASGADO') ? 'PAPEL' : 'FOTOGRAFIA',
    firma: texto.fuente !== 'MARCA' && Boolean(brief.marca.nombre.trim()),
  };
}

/** El plan debe respetar cada página y elemento que ya constan en el brief. */
export function esquemaDelPlanEditorial(brief: BriefDelEncargo) {
  return PlanEditorial.superRefine((plan, ctx) => {
    const problema = (path: Array<string | number>, message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (plan.diapositivas.length !== brief.plan.length) {
      problema(['diapositivas'], `El brief tiene ${brief.plan.length} diapositivas.`);
    }

    plan.diapositivas.forEach((diapositiva, i) => {
      const prevista = brief.plan[i];
      const ruta = ['diapositivas', i];
      if (!prevista || diapositiva.n !== prevista.n || diapositiva.papel !== prevista.papel) {
        problema(ruta, 'Conserva el número, el papel y el orden de las diapositivas del brief.');
      }

      if (diapositiva.tratamiento === 'RECORTE_DETALLE') {
        const nombre = brief.hechos.inventario.elementos[diapositiva.elemento]?.nombre;
        if (!nombre || (prevista?.elemento && nombre !== prevista.elemento)) {
          problema([...ruta, 'elemento'], 'El recorte debe mostrar el elemento asignado a este detalle en el brief.');
        }
      }

      if (diapositiva.tratamiento === 'FOTO_TEXTO_AL_BORDE' && diapositiva.arco) {
        const { centro, radio } = diapositiva.arco;
        if (diapositiva.papel !== 'detalle' || centro.x - radio < 0.035 || centro.x + radio > 0.965 ||
            centro.y - radio * 0.75 < 0.035 || centro.y + radio * 0.75 > 0.965) {
          problema([...ruta, 'arco'], 'El arco debe caber en el encuadre 3:4 de un detalle de la foto fuente.');
        }
      }
      if ((diapositiva.tratamiento === 'FOTO_TEXTO_AL_BORDE' || diapositiva.tratamiento === 'CARTEL') && !textoDelBrief(brief, diapositiva.texto)) {
        problema([...ruta, 'texto'], 'El texto debe referir a un dato disponible en el brief.');
      }

      if (diapositiva.tratamiento === 'CIERRE_TEXTO') {
        const vistos = new Set<string>();
        diapositiva.textos.forEach((referencia, j) => {
          const texto = textoDelBrief(brief, referencia);
          if (!texto || vistos.has(texto)) {
            problema([...ruta, 'textos', j], 'El cierre exige referencias distintas a datos disponibles en el brief.');
          }
          if (texto) vistos.add(texto);
        });
      }
    });
  });
}

function diapositivaSimulada(brief: BriefDelEncargo, pagina: DiapositivaDelPlan): DiapositivaEditorial {
  const { n, papel } = pagina;
  if (papel === 'cierre') {
    const marca: ReferenciaTextoEditorial[] = [{ fuente: 'MARCA' }, { fuente: 'CIUDAD' }, { fuente: 'INSTAGRAM' }];
    const disponibles = new Map<string, ReferenciaTextoEditorial>();
    for (const ref of marca) {
      const texto = textoDelBrief(brief, ref);
      if (texto && !disponibles.has(texto)) disponibles.set(texto, ref);
    }
    const textos = [...disponibles.values()];
    const indice = brief.hechos.inventario.elementos.findIndex((e) => e.nombre.trim());
    if (!textos.length && indice >= 0) textos.push({ fuente: 'ELEMENTO', indice });
    return { n, papel, tratamiento: 'CIERRE_TEXTO', textos };
  }

  const elemento = brief.hechos.inventario.elementos.findIndex((e) => e.nombre === pagina.elemento);
  if (papel === 'detalle' && pagina.foto === 'RECORTE' && elemento >= 0) {
    return { n, papel, tratamiento: 'RECORTE_DETALLE', elemento, enfoque: { x: 0.5, y: 0.5 }, zoom: 2 };
  }
  return { n, papel, tratamiento: 'FOTO_LIMPIA' };
}

export class ProductorEditorialSimulado implements ProductorEditorial {
  readonly modelo = 'SIMULADO';

  async proponer({ brief }: EncargoEditorial): Promise<PlanEditorial> {
    return esquemaDelPlanEditorial(brief).parse({
      esquema: 'post/editorial@1',
      hiloVisual: 'LUZ',
      diapositivas: brief.plan.map((pagina) => diapositivaSimulada(brief, pagina)),
    });
  }
}

/** Instrucciones de cámara derivadas del plan, visibles con el prompt antes de autorizar la imagen. */
export function direccionParaLaFoto(brief: BriefDelEncargo | undefined): string {
  if (!brief?.editorial) return '';
  const { diapositivas, hiloVisual } = brief.editorial.plan;
  const portada = diapositivas[0];
  const cartel = portada && cartelDePortada(portada, fichaDeCartel(brief.editorial.fichaReferencia), brief);
  const encuadre = cartel
    ? cartel.estructura === 'EJE_VERTICAL'
      ? 'Place the dish to one side, with a continuous quiet vertical space beside it for one large word. Keep the edge of the dish clean.'
      : 'Keep the upper part quiet for a large masthead. Let the top edge of the dish reach the lower edge of that space.'
    : portada?.tratamiento === 'FOTO_TEXTO_AL_BORDE'
    ? `Leave quiet negative space at the ${portada.borde === 'SUPERIOR' ? 'top' : 'bottom'} for separate typesetting.`
    : 'Compose the cover as a standalone photograph, without reserving space for a headline.';
  const continuidad = { COLOR: 'Keep the characteristic colours of the ingredients consistent.', LUZ: 'Keep a coherent light direction and preserve the texture of the dish.', ENCUADRE: 'Frame the dish with a clear axis that can be repeated in the following views.' };
  return ` Editorial direction: ${encuadre} ${continuidad[hiloVisual]} Render no lettering or graphics.`;
}
