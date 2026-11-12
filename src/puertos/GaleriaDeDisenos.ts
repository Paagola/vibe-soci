/**
 * Lectura de los diseños ya compuestos de un proyecto (lo que guarda AlmacenDisenos y las hojas de revisión).
 * Solo lee: sirve para enseñar el resultado en la web sin que la web conozca cómo se guardan las versiones.
 */
export interface ProblemaDeDiseno {
  gravedad: 'ERROR' | 'AVISO';
  tipo: string;
  mensaje: string;
  capa?: string;
}

/** Dónde quedó una capa al resolver el diseño, en píxeles del lienzo (para señalarla sobre la imagen). */
export interface CapaDeDiseno {
  id: string;
  tipo: string;
  /** PNG de la capa sola, relativo a la carpeta de diseños del proyecto. */
  archivo?: string;
  caja?: { x: number; y: number; w: number; h: number };
}

export interface VersionDeDiseno {
  /** Id de la intención (la carpeta del diseño). */
  id: string;
  version: number;
  /** Archivos relativos a la carpeta de diseños del proyecto (p. ej. «post/v001/diseno.png»). */
  diseno: string;
  svgEditable?: string;
  exportadas: Array<{ proporcion: string; archivo: string }>;
  capas: CapaDeDiseno[];
  lienzo: { ancho: number; alto: number };
  zonaSegura?: { x: number; y: number; w: number; h: number };
  problemas: ProblemaDeDiseno[];
  /** Contraste medido de cada texto con su fondo (ratio WCAG). */
  contraste: Record<string, number>;
  /** Cuándo se compuso (fecha del documento resuelto). */
  compuestaEn: string;
}

export interface HojasDeRevision {
  etiqueta: string;
  /** Relativos a la carpeta de diseños del proyecto (p. ej. «revision/orden-post/movil.jpg»). */
  archivos: string[];
}

export interface GaleriaDeDisenos {
  /** Versiones guardadas de un diseño, de la más antigua a la más reciente. Vacío si no hay ninguna. */
  versiones(proyecto: string, id: string): Promise<VersionDeDiseno[]>;
  hojasDeRevision(proyecto: string): Promise<HojasDeRevision[]>;
  /** Ruta absoluta de un archivo de los diseños del proyecto. Nunca fuera de su carpeta. */
  rutaArchivo(proyecto: string, archivo: string): string;
}
