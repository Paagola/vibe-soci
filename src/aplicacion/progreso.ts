/**
 * Progreso de un caso de uso largo. Lo emite el caso de uso y lo traduce la capa de entrada
 * (la web) en una barra y un «quedan unos X s».
 */
export interface Progreso {
  /** Qué está pasando, listo para mostrar. */
  mensaje: string;
  /** Imágenes terminadas y total del trabajo (0 y 0 si no hay imágenes). */
  hechas: number;
  total: number;
  /** Pasos que quedan, contando el actual: llamadas al director y tandas de imágenes. */
  pasosRestantes: { director: number; tandas: number };
  /** Tiempo de lo que queda y no es ni director ni imágenes (p. ej. componer el diseño), en ms. */
  otrosMs?: number;
}

export type AlProgresar = (progreso: Progreso) => void;

/** Para los casos de uso que reciben el callback como opcional. */
export const sinProgreso: AlProgresar = () => {};
