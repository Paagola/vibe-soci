/** Punto 2: busca una familia tipográfica con licencia libre (OFL) y la descarga. Sin red o si no la tiene, undefined. */
export interface FuenteDescargada {
  familia: string;
  /** Carpeta y archivo de la fuente (una variable si la hay; si no, la regular). */
  archivo: { nombre: string; bytes: Buffer };
  licencia: Buffer;
  /** De dónde sale (para el catálogo). */
  url: string;
  /** La categoría del proveedor (SERIF, SANS_SERIF, DISPLAY, HANDWRITING, MONOSPACE). */
  categoria?: string;
}

export interface ProveedorDeFuentes {
  readonly nombre: string;
  buscar(familia: string): Promise<FuenteDescargada | undefined>;
}
