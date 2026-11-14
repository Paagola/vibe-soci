/**
 * Raíz de composición de la ORDEN ÚNICA (`npm run post` y las pantallas de la web): decide qué adaptador va detrás de
 * cada puerto según la configuración y el modo. Junto con contenedor.ts, es el único sitio que crea clases concretas.
 *
 * Real: proyectos/<proyecto>/ y datos/. Directores (de foto y de diseño) y revisor con Gemini; foto nueva con Gemini de
 * pago solo si GEMINI_FACTURACION=si, con el tope GEMINI_TOPE_USD; máscara con Apple Vision; mapa de la foto con sharp.
 * Simulado: directores, generador, revisor y máscara simulados; nada se gasta y todo se escribe en datos-simulado/.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CARPETA_DE_BORRADORES, ComponedorProyectos } from './adaptadores/compositor/ComponedorProyectos.js';
import { ObtenedorEnlacesHttp } from './adaptadores/enlaces/ObtenedorEnlacesHttp.js';
import { AlmacenActivosFicheros } from './adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenLocalesFicheros } from './adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenPiezasFicheros } from './adaptadores/ficheros/AlmacenPiezasFicheros.js';
import { AlmacenReferenciasFicheros } from './adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from './adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { BibliotecaFicheros } from './adaptadores/ficheros/BibliotecaFicheros.js';
import { GaleriaDisenosFicheros } from './adaptadores/ficheros/GaleriaDisenosFicheros.js';
import { PiezasHechasFicheros } from './adaptadores/ficheros/PiezasHechasFicheros.js';
import { ClienteGemini } from './adaptadores/gemini/ClienteGemini.js';
import { DirectorDisenoGemini } from './adaptadores/gemini/DirectorDisenoGemini.js';
import { DirectorFotoGemini } from './adaptadores/gemini/DirectorFotoGemini.js';
import { GeneradorFotoGemini, gastoAcumuladoGemini } from './adaptadores/gemini/GeneradorFotoGemini.js';
import { registradorDeUso } from './adaptadores/gemini/registroUso.js';
import { RevisorVisualGemini } from './adaptadores/gemini/RevisorVisualGemini.js';
import { MedidorDeFotoSharp } from './adaptadores/imagen/MedidorDeFotoSharp.js';
import { SegmentadorVision } from './adaptadores/imagen/SegmentadorVision.js';
import { CriticoDisenoSimulado, DirectorDisenoSimulado } from './adaptadores/simulado/DisenoSimulado.js';
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from './adaptadores/simulado/FotoSimulada.js';
import type { DepsDisenoPost } from './aplicacion/post/disenoDelPost.js';
import type { DepsReferencias } from './aplicacion/referencias/dependencias.js';
import { RAIZ, type Config } from './config.js';
import { ErrorDeUsuario } from './dominio/errores.js';
import type { DirectorDeFoto } from './puertos/Foto.js';
import type { ObtenedorEnlaces } from './puertos/ObtenedorEnlaces.js';
import type { RevisorVisual } from './puertos/RevisorVisual.js';

export interface OpcionesDepsPost {
  simular: boolean;
  /** Para el registro de gasto: de qué encargo sale cada petición. */
  proyecto: string;
  avisar?: (mensaje: string) => void;
  /**
   * De dónde salen, en simulado, los locales, las referencias y el recuento de piezas:
   * - `REALES` (la línea de comandos): se leen de datos/, sin tocarlos;
   * - `DEL_MODO` (la web): de datos-simulado/, como todo lo demás que la web hace en simulado.
   * En real no cambia nada: siempre son los de datos/.
   */
  datosDeReferencia?: 'REALES' | 'DEL_MODO';
}

const sinClave = (quien: string) => new ErrorDeUsuario(`Falta GEMINI_API_KEY en .env: ${quien} es Gemini. Añade la clave o usa el modo simulado.`);

/** Con el modo real y sin clave, la orden se puede consultar pero no avanzar: lo dice al intentarlo. */
const directorSinClave: DirectorDeFoto = {
  nombre: 'Gemini (sin clave)',
  proponer: async () => {
    throw sinClave('el director de fotografía');
  },
};
const revisorSinClave: RevisorVisual = {
  nombre: 'Gemini (sin clave)',
  comprobarElementos: async () => {
    throw sinClave('el revisor de la foto');
  },
  compararToma: async () => {
    throw sinClave('el revisor de la foto');
  },
  contarAnatomia: async () => {
    throw sinClave('el revisor de la foto');
  },
};
const enlacesSimulados: ObtenedorEnlaces = {
  obtener: async () => ({ estado: 'PIDE_CAPTURA', motivo: 'en modo simulado no se abre ningún enlace: sube una captura del post' }),
};

export async function crearDepsPost(config: Config, opciones: OpcionesDepsPost): Promise<DepsDisenoPost> {
  const { simular } = opciones;
  const avisar = opciones.avisar ?? ((mensaje: string) => console.error(`  aviso: ${mensaje}`));
  const datos = simular ? config.carpetaDatosSimulado : config.carpetaDatos;
  const proyectos = simular ? join(config.carpetaDatosSimulado, 'proyectos') : join(RAIZ, 'proyectos');
  // Los locales, sus referencias y lo que cuenta para el umbral de la referencia obligatoria.
  const delModo = simular && opciones.datosDeReferencia === 'DEL_MODO';
  const datosDeReferencia = delModo ? datos : config.carpetaDatos;
  const ahora = () => new Date().toISOString();

  const referencias: DepsReferencias = {
    piezas: new AlmacenPiezasFicheros(join(datosDeReferencia, 'piezas')),
    piezasHechas: new PiezasHechasFicheros(delModo ? proyectos : join(RAIZ, 'proyectos')),
    locales: new AlmacenLocalesFicheros(join(datosDeReferencia, 'locales')),
    referencias: new AlmacenReferenciasFicheros(join(datosDeReferencia, 'locales')),
    biblioteca: new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(config.carpetaBiblioteca, 'referencias')),
    enlaces: simular ? enlacesSimulados : new ObtenedorEnlacesHttp(),
    leerArchivo: (ruta) => readFile(ruta),
    ahora,
  };
  const comunes = {
    raiz: RAIZ,
    proyectos,
    activos: new AlmacenActivosFicheros(join(datos, 'locales')),
    referencias,
    componedor: new ComponedorProyectos(RAIZ, datos),
    galeria: new GaleriaDisenosFicheros(join(datos, 'disenos')),
    galeriaDeBorradores: new GaleriaDisenosFicheros(CARPETA_DE_BORRADORES),
    ahora,
  };
  const medidor = new MedidorDeFotoSharp();
  const describirFuente = await descriptorDeFuentes(join(RAIZ, 'recursos', 'tipografias', 'catalogo.json'));
  if (simular) {
    return {
      ...comunes,
      director: new DirectorFotoSimulado(),
      generador: new GeneradorFotoSimulado(),
      revisor: new RevisorVisualSimulado(),
      segmentador: new SegmentadorSimulado(),
      disenador: { director: new DirectorDisenoSimulado(), critico: new CriticoDisenoSimulado(), medidor, describirFuente },
    };
  }

  const { geminiApiKey } = config;
  const modelos = [config.geminiModelo, ...(config.geminiModeloRespaldo ? [config.geminiModeloRespaldo] : [])];
  const cliente = (clave: string, motivo: string) => new ClienteGemini(clave, modelos, { avisar, alUsar: registradorDeUso(config.carpetaDatos, motivo, config.geminiFacturacion) });
  return {
    ...comunes,
    director: geminiApiKey ? new DirectorFotoGemini(cliente(geminiApiKey, 'director-foto'), await new BibliotecaFicheros(config.carpetaBiblioteca).leerGuia(), modelos) : directorSinClave,
    generador: new GeneradorFotoGemini({
      apiKey: geminiApiKey,
      modelo: config.geminiModeloImagen,
      facturacion: config.geminiFacturacion,
      topeUsd: config.geminiTopeUsd,
      carpetaDatos: config.carpetaDatos,
      origen: `orden-post:${opciones.proyecto}`,
    }),
    revisor: geminiApiKey ? new RevisorVisualGemini(cliente(geminiApiKey, 'comprobacion-salida'), modelos) : revisorSinClave,
    segmentador: new SegmentadorVision(RAIZ),
    // Sin clave no hay director de diseño: INTENCION deja el borrador y se para, como antes de F3.
    ...(geminiApiKey ? { disenador: { ...disenadorGemini(new DirectorDisenoGemini(cliente(geminiApiKey, 'director-diseno'), modelos)), medidor, describirFuente } } : {}),
  };
}

/** El mismo adaptador hace de director y de crítico: comparten las instrucciones fijas (y el prefijo que la API reutiliza). */
function disenadorGemini(gemini: DirectorDisenoGemini) {
  return { director: gemini, critico: gemini };
}

/** «anybody: grotesca, variable, ultracondensada, display»: cómo es cada fuente, para describírsela al director. */
async function descriptorDeFuentes(rutaCatalogo: string): Promise<(fuente: string) => string> {
  const catalogo = JSON.parse(await readFile(rutaCatalogo, 'utf8')) as { fuentes: Array<{ id: string; familia: string; clasificacion?: string[] }> };
  const porId = new Map(catalogo.fuentes.map((f) => [f.id, f]));
  return (fuente) => {
    const f = porId.get(fuente);
    return f ? `${f.familia} (${(f.clasificacion ?? []).join(', ')})` : fuente;
  };
}

export interface GastoDeFotos {
  /** La clave de Gemini tiene la facturación activada (GEMINI_FACTURACION=si). */
  facturacion: boolean;
  modelo: string;
  topeUsd: number;
  /** Lo acumulado en datos/gasto/gemini.jsonl, que es lo que el generador compara con el tope antes de cada envío. */
  gastadoUsd: number;
}

/** El gasto real en fotos nuevas frente al tope del código. Solo lee el registro. */
export async function gastoDeFotos(config: Config): Promise<GastoDeFotos> {
  return {
    facturacion: config.geminiFacturacion,
    modelo: config.geminiModeloImagen,
    topeUsd: config.geminiTopeUsd,
    gastadoUsd: await gastoAcumuladoGemini(join(config.carpetaDatos, 'gasto', 'gemini.jsonl')),
  };
}
