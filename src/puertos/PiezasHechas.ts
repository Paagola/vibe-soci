import type { PiezaHecha } from '../dominio/referencia.js';

/** Las piezas hechas con las herramientas de línea de comandos (fuera de la app web). */
export interface PiezasHechas {
  listar(): Promise<PiezaHecha[]>;
}
