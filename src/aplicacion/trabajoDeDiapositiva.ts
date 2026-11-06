/**
 * Qué imágenes se envían con cada diapositiva y en qué orden.
 * El orden lo fija el código (decisión E11): fotos de la diapositiva → referencia de estilo → portada aprobada.
 * Al prompt se le añade una leyenda con ese orden para que «Image N» no sea ambiguo.
 */
import { ErrorDeUsuario } from '../dominio/errores.js';
import type { DiapositivaPlan, PapelFoto, Pieza, Plan } from '../dominio/modelos.js';
import { versionElegida } from '../dominio/reglas.js';

export interface TrabajoDeDiapositiva {
  posicion: number;
  /** Prompt final, con la leyenda de referencias incluida. */
  prompt: string;
  /** Rutas relativas a la pieza, en orden (Image 1, Image 2…). */
  referencias: string[];
  comentario?: string;
}

interface Referencia {
  archivo: string;
  papel: string;
}

export function exigirPlan(pieza: Pieza): Plan {
  if (!pieza.plan) throw new ErrorDeUsuario(`La pieza ${pieza.id} aún no tiene plan. Ejecuta antes: conceptos ${pieza.id}`);
  return pieza.plan;
}

export function exigirDiapositiva(pieza: Pieza, posicion: number): DiapositivaPlan {
  const diapositiva = exigirPlan(pieza).diapositivas.find((d) => d.posicion === posicion);
  if (!diapositiva) throw new ErrorDeUsuario(`La pieza ${pieza.id} no tiene diapositiva ${posicion}.`);
  return diapositiva;
}

/**
 * Trabajo de una diapositiva tal como está en el plan.
 * `portadaPendiente` sirve para plan.md, cuando la portada aún no existe.
 */
export function trabajoDelPlan(pieza: Pieza, posicion: number, opciones: { portadaPendiente?: boolean } = {}): TrabajoDeDiapositiva {
  const diapositiva = exigirDiapositiva(pieza, posicion);
  const referencias: Referencia[] = diapositiva.fotos.map((archivo) => ({ archivo, papel: papelDeFoto(pieza, archivo) }));

  if (pieza.referenciaEstilo) {
    referencias.push({
      archivo: pieza.referenciaEstilo.archivo,
      papel: 'style reference only (light, composition and typographic idea). Never copy its food, objects or text',
    });
  }
  if (posicion > 1) {
    const portada = versionElegida(pieza, 1)?.archivo ?? (opciones.portadaPendiente ? 'generadas/d1 (la versión de la portada que apruebes)' : undefined);
    if (portada) {
      referencias.push({ archivo: portada, papel: 'the approved cover of this series. Match its typography, colours, layout and photographic look exactly' });
    }
  }
  return componer(posicion, diapositiva.prompt, referencias);
}

/** Corrección: la versión anterior es Image 1 y detrás van las fotos reales. */
export function trabajoDeCorreccion(pieza: Pieza, posicion: number, prompt: string, anterior: string, comentario: string): TrabajoDeDiapositiva {
  const diapositiva = exigirDiapositiva(pieza, posicion);
  const referencias: Referencia[] = [
    { archivo: anterior, papel: 'the previous version to fix. Keep it almost exactly except for the numbered changes' },
    ...diapositiva.fotos.map((archivo) => ({ archivo, papel: papelDeFoto(pieza, archivo) })),
  ];
  return { ...componer(posicion, prompt, referencias), comentario };
}

function componer(posicion: number, prompt: string, referencias: Referencia[]): TrabajoDeDiapositiva {
  const leyenda = referencias.map((referencia, i) => `Image ${i + 1}: ${referencia.papel}.`).join('\n');
  return {
    posicion,
    prompt: `${prompt.trim()}\n\nREFERENCE IMAGES, IN ORDER:\n${leyenda}`,
    referencias: referencias.map((referencia) => referencia.archivo),
  };
}

const PAPEL_EN_INGLES: Record<PapelFoto, string> = {
  PLATO: 'the dish',
  LOCAL: 'the venue',
  VAJILLA: 'the tableware',
  PERSONAS: 'people at the venue',
  OTRO: 'a real detail',
};

function papelDeFoto(pieza: Pieza, archivo: string): string {
  const foto = pieza.fotos.find((f) => f.archivo === archivo);
  const que = foto ? PAPEL_EN_INGLES[foto.papel] : 'the venue';
  const nota = foto?.nota ? ` («${foto.nota}»)` : '';
  return `real photo of ${que}${nota}. Keep every real element faithfully; it is a list of elements, not a layout to copy`;
}
