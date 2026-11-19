import { z } from 'zod';

export const ModoDeLuz = z.enum(['NATURAL', 'ESTUDIO']);
export type ModoDeLuz = z.infer<typeof ModoDeLuz>;

export function luzSolicitada(nota: string): ModoDeLuz | undefined {
  if (/\b(?:luz|iluminaci[oó]n)\s+(?:natural|de ventana|de d[ií]a)\b/iu.test(nota)) return 'NATURAL';
  if (/\b(?:luz|iluminaci[oó]n|foco)\s+de estudio\b/iu.test(nota)) return 'ESTUDIO';
  return undefined;
}

// Society, Directoria / Hostelería 02 (luz y color) y 08 (firma de rodaje).
export const luzDeProduccion: Record<ModoDeLuz, string> = {
  ESTUDIO: 'Iluminación de estudio de producto: un solo foco neutro de unos 5000 K, lateral y ligeramente por detrás, dibuja el contorno. El alimento es lo más luminoso y el fondo cae entre 1,5 y 2 pasos, sin relleno sobre el fondo. Negros con profundidad y reflejos controlados, sin quemar.',
  NATURAL: 'Luz natural de una ventana lateral, balance de día neutro de unos 5000 K. Sombras direccionales de borde suave con detalle, como en una mesa junto a la ventana. Una parte del plato recibe más luz que la otra. Conserva el color de los materiales, como la tela teja y la loza clara en una sesión editorial casera.',
};

export const balanceNeutro = 'Balance de blancos neutro. La loza blanca y el lino claro conservan su tono neutro, incluso si la escena tiene materiales de color. Los dorados pertenecen a la cocción y a la corteza, los rojos o marrones a los materiales que los tienen. Corrige una dominante amarilla, ámbar o naranja que tiña toda la imagen, incluso si aparece en una foto de referencia.';

export const pautaDeLuz = (modo: ModoDeLuz) => luzDeProduccion[modo] + ' ' + balanceNeutro;
