/**
 * Conocimiento creativo (F1.5): oficios, principios, rúbrica y fichas de referencia en conocimiento/.
 *
 * Cada documento empieza con una cabecera de pocas líneas:
 *   ---
 *   nombre: fotografia-gastronomica
 *   resumen: Una línea: para qué sirve.
 *   fases: concepto, fotografia, revision
 *   formatos: post, carrusel, historia
 *   ---
 * El director no lee todo en cada pieza: pide lo de la fase en la que está (como las skills de design-agent,
 * que se cargan solo cuando el trabajo las necesita). Sin cabecera, el documento no se ofrece.
 */
export const FASES = ['brief', 'concepto', 'fotografia', 'composicion', 'texto', 'revision', 'aprendizaje'] as const;
export type Fase = (typeof FASES)[number];
export const FORMATOS = ['post', 'carrusel', 'historia'] as const;
export type FormatoConocimiento = (typeof FORMATOS)[number];

export interface DocumentoConocimiento {
  nombre: string;
  resumen: string;
  fases: Fase[];
  formatos: FormatoConocimiento[];
  /** Ruta relativa a conocimiento/. */
  ruta: string;
  cuerpo: string;
}

/** Separa la cabecera del cuerpo. Devuelve null si no hay cabecera o le falta algo. */
export function leerDocumento(ruta: string, texto: string): DocumentoConocimiento | null {
  const coincide = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto.replace(/\r\n/g, '\n'));
  if (!coincide) return null;
  const campos = new Map<string, string>();
  for (const linea of coincide[1]!.split('\n')) {
    const i = linea.indexOf(':');
    if (i > 0) campos.set(linea.slice(0, i).trim(), linea.slice(i + 1).trim());
  }
  const lista = (clave: string) => (campos.get(clave) ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const nombre = campos.get('nombre');
  const resumen = campos.get('resumen');
  const fases = lista('fases');
  const formatos = lista('formatos');
  if (!nombre || !resumen || fases.length === 0) return null;
  const desconocidas = [...fases.filter((f) => !FASES.includes(f as Fase)), ...formatos.filter((f) => !FORMATOS.includes(f as FormatoConocimiento))];
  if (desconocidas.length) throw new RangeError(`${ruta}: fases o formatos desconocidos: ${desconocidas.join(', ')}`);
  return {
    nombre,
    resumen,
    fases: fases as Fase[],
    formatos: (formatos.length ? formatos : [...FORMATOS]) as FormatoConocimiento[],
    ruta,
    cuerpo: coincide[2]!.trim(),
  };
}

/** Los documentos que tocan en una fase y un formato, en orden estable (por nombre). */
export function seleccionar(documentos: DocumentoConocimiento[], { fase, formato }: { fase: Fase; formato?: FormatoConocimiento }): DocumentoConocimiento[] {
  return documentos
    .filter((d) => d.fases.includes(fase) && (!formato || d.formatos.includes(formato)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Índice de una línea por documento, para dárselo al director antes de que pida el texto completo. */
export function indice(documentos: DocumentoConocimiento[]): string {
  return documentos.map((d) => `- ${d.nombre} (${d.fases.join(', ')}): ${d.resumen}`).join('\n');
}
