/** Compone una pieza de un proyecto (plan.json + intenciones) con el compositor, y monta sus hojas de revisión. */
export interface DiapositivaCompuesta {
  id: string;
  version: number;
  /** Carpeta de la versión (diseno.png, diseno.svg, exportadas/…). */
  carpeta: string;
  png: string;
  /** true si ya existía y se usó tal cual. */
  reutilizada: boolean;
  /** Problemas del resolutor: los ERROR impiden dar la pieza por buena. */
  problemas: Array<{ gravedad: 'ERROR' | 'AVISO'; tipo: string; mensaje: string }>;
}

export interface PiezaCompuesta {
  salida: string;
  revision: string;
  diapositivas: DiapositivaCompuesta[];
}

export interface ComponedorDePiezas {
  componer(rutaProyecto: string, opciones?: { borrador?: boolean; etiqueta?: string; solo?: string; informar?: (linea: string) => void }): Promise<PiezaCompuesta>;
}
