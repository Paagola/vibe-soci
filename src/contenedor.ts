/**
 * Raíz de composición: el único sitio que conoce las clases concretas.
 * Decide qué adaptador va detrás de cada puerto según la configuración y --simular.
 */
import { join } from 'node:path';
import { AlmacenLocalesFicheros } from './adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenPiezasFicheros } from './adaptadores/ficheros/AlmacenPiezasFicheros.js';
import { BibliotecaFicheros } from './adaptadores/ficheros/BibliotecaFicheros.js';
import { ClienteGemini } from './adaptadores/gemini/ClienteGemini.js';
import { DirectorGemini } from './adaptadores/gemini/DirectorGemini.js';
import { ClienteHiggsfield } from './adaptadores/higgsfield/ClienteHiggsfield.js';
import { GeneradorHiggsfield } from './adaptadores/higgsfield/GeneradorHiggsfield.js';
import { MODELOS_HIGGSFIELD } from './adaptadores/higgsfield/modelos.js';
import { ProcesadorSharp } from './adaptadores/imagen/ProcesadorSharp.js';
import { DirectorSimulado } from './adaptadores/simulado/DirectorSimulado.js';
import { GeneradorSimulado } from './adaptadores/simulado/GeneradorSimulado.js';
import type { Dependencias } from './aplicacion/dependencias.js';
import type { Config } from './config.js';
import { ErrorDeUsuario } from './dominio/errores.js';
import type { DirectorCreativo } from './puertos/DirectorCreativo.js';
import type { GeneradorImagen } from './puertos/GeneradorImagen.js';
import type { ProcesadorImagen } from './puertos/ProcesadorImagen.js';

export interface OpcionesContenedor {
  simular: boolean;
  avisar: (mensaje: string) => void;
}

export function crearContenedor(config: Config, opciones: OpcionesContenedor): Dependencias {
  const procesador = new ProcesadorSharp();
  // Cada modo tiene su carpeta: una pieza, un local o un voto simulado nunca aparece en el modo real.
  const carpetaDatos = opciones.simular ? config.carpetaDatosSimulado : config.carpetaDatos;
  return {
    piezas: new AlmacenPiezasFicheros(join(carpetaDatos, 'piezas')),
    locales: new AlmacenLocalesFicheros(join(carpetaDatos, 'locales')),
    // La guía creativa es la misma; los votos simulados van aparte para que no enseñen al director real.
    biblioteca: new BibliotecaFicheros(config.carpetaBiblioteca, opciones.simular ? { rutaValoraciones: join(carpetaDatos, 'valoraciones.jsonl') } : {}),
    procesador,
    director: unaVez(() => crearDirector(config, opciones, procesador)),
    generador: unaVez(() => crearGenerador(config, opciones, procesador)),
    limiteImagenesDia: config.limiteImagenesDia,
    zonaHoraria: config.zonaHoraria,
    reloj: () => new Date(),
    avisar: opciones.avisar,
  };
}

function crearDirector(config: Config, opciones: OpcionesContenedor, procesador: ProcesadorImagen): DirectorCreativo {
  if (opciones.simular) return new DirectorSimulado();
  if (!config.geminiApiKey) throw new ErrorDeUsuario('Falta GEMINI_API_KEY en .env. Para probar sin claves ni gasto, añade --simular.');
  const modelos = [config.geminiModelo, config.geminiModeloRespaldo].filter((m, i, todos): m is string => Boolean(m) && todos.indexOf(m) === i);
  return new DirectorGemini(new ClienteGemini(config.geminiApiKey, modelos, { avisar: opciones.avisar }), procesador);
}

function crearGenerador(config: Config, opciones: OpcionesContenedor, procesador: ProcesadorImagen): GeneradorImagen {
  if (opciones.simular) return new GeneradorSimulado(procesador);
  if (!config.hfKey) {
    throw new ErrorDeUsuario(
      'Falta HF_KEY en .env. Opciones: añade la clave, usa --simular o genera a mano con plan.md y luego «importar».',
    );
  }
  const estrategia = MODELOS_HIGGSFIELD[config.hfModelo];
  if (!estrategia) throw new ErrorDeUsuario(`Modelo de Higgsfield desconocido: ${config.hfModelo}`);
  return new GeneradorHiggsfield(new ClienteHiggsfield(config.hfKey), estrategia, config.hfResolucion, opciones.avisar);
}

function unaVez<T>(crear: () => T): () => T {
  let valor: T | undefined;
  return () => (valor ??= crear());
}
