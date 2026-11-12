/**
 * Todo lo que comparten las rutas de la web: las dependencias de cada modo (real o simulado),
 * el registro de trabajos, el estimador de tiempos y las subidas.
 */
import { join } from 'node:path';
import type { Dependencias } from '../aplicacion/dependencias.js';
import type { DepsDisenoPost } from '../aplicacion/post/disenoDelPost.js';
import type { Config } from '../config.js';
import { crearContenedor } from '../contenedor.js';
import { crearDepsPost, gastoDeFotos, type GastoDeFotos } from '../contenedorPost.js';
import { DirectorCronometrado, Estimador } from './estimacion.js';
import { AlmacenSubidas } from './subidas.js';
import { RegistroTrabajos } from './trabajos.js';

export interface Estudio {
  config: Config;
  /** Dependencias del modo activo. Un trabajo las fija al lanzarse. */
  deps(): Dependencias;
  /**
   * Dependencias de la orden única (de la foto subida al post exportado) en el modo activo.
   * En simulado todo es del modo, como en el resto de la web: locales, referencias, proyectos y activos van en datos-simulado/.
   * `proyecto` solo sirve para apuntar el gasto del generador.
   */
  post(proyecto?: string): Promise<DepsDisenoPost>;
  /** Gasto real en fotos nuevas frente al tope del código (solo lee el registro). */
  gastoDeFotos(): Promise<GastoDeFotos>;
  simulado(): boolean;
  cambiarModo(simulado: boolean): void;
  registro: RegistroTrabajos;
  estimador: Estimador;
  subidas: AlmacenSubidas;
  carpetaPlantillas: string;
}

export interface OpcionesEstudio {
  simuladoAlArrancar: boolean;
  carpetaPlantillas: string;
  ahora?: () => number;
}

export function crearEstudio(config: Config, opciones: OpcionesEstudio): Estudio {
  const registro = new RegistroTrabajos(opciones.ahora);
  const avisar = (mensaje: string) => {
    if (!registro.avisar(mensaje)) console.warn(`! ${mensaje}`);
  };

  const crearModo = (simulado: boolean): Dependencias => {
    const base = crearContenedor(config, { simular: simulado, avisar });
    let director: DirectorCronometrado | undefined;
    return {
      ...base,
      director: () => (director ??= new DirectorCronometrado(base.director(), (ms) => estimador.registrarDirector(simulado, ms))),
    };
  };

  const real = crearModo(false);
  const simuladas = crearModo(true);
  const estimador = new Estimador({ real: real.piezas, simulado: simuladas.piezas }, join(config.carpetaDatos, 'duraciones.json'));
  let simulado = opciones.simuladoAlArrancar;

  return {
    config,
    deps: () => (simulado ? simuladas : real),
    post: (proyecto = 'web') => crearDepsPost(config, { simular: simulado, proyecto, avisar, datosDeReferencia: 'DEL_MODO' }),
    gastoDeFotos: () => gastoDeFotos(config),
    simulado: () => simulado,
    cambiarModo: (valor) => {
      simulado = valor;
    },
    registro,
    estimador,
    subidas: new AlmacenSubidas(join(config.carpetaDatos, 'subidas')),
    carpetaPlantillas: opciones.carpetaPlantillas,
  };
}
