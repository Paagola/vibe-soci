import type { Receta } from '../dominio/tipografia/receta.js';

/**
 * Los estilos de tipografía especial (recetas) que se pueden reutilizar: los del estudio y los que crea el agente.
 * Un estilo nuevo nunca pisa a otro: una versión nueva conserva la anterior en su historial.
 */
export interface BibliotecaDeTratamientos {
  /** La receta vigente de un estilo. Lanza un error que lista los que hay si no existe. */
  obtener(id: string): Receta;
  /** Todas las recetas vigentes (sin las retiradas, salvo que se pidan). */
  listar(opciones?: { conRetiradas?: boolean }): Receta[];
}
