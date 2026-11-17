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
import { LocalesSuperpuestos, ReferenciasSuperpuestas } from './adaptadores/ficheros/Superpuestos.js';
import { BibliotecaDeReferenciasFicheros } from './adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { BibliotecaFicheros } from './adaptadores/ficheros/BibliotecaFicheros.js';
import { GaleriaDisenosFicheros } from './adaptadores/ficheros/GaleriaDisenosFicheros.js';
import { HistorialDeDisenosFicheros } from './adaptadores/ficheros/HistorialDeDisenosFicheros.js';
import { PiezasHechasFicheros } from './adaptadores/ficheros/PiezasHechasFicheros.js';
import { CriticoEditorialSimulado } from './aplicacion/productor/criticaEditorial.js';
import { CriticoEditorialGemini } from './adaptadores/gemini/CriticoEditorialGemini.js';
import { ProductorEditorialSimulado } from './aplicacion/productor/editorial.js';
import { ProductorEditorialGemini } from './adaptadores/gemini/ProductorEditorialGemini.js';
import type { Orquestador } from './aplicacion/productor/orquestador.js';
import type { QuienLlama } from './puertos/FuenteDelBrief.js';
import { leerEncargo } from './aplicacion/post/ordenPost.js';
import { ClienteGemini } from './adaptadores/gemini/ClienteGemini.js';
import { AnalistaReferenciasGemini } from './adaptadores/gemini/AnalistaReferenciasGemini.js';
import { DirectorDisenoGemini } from './adaptadores/gemini/DirectorDisenoGemini.js';
import { AnalistaReferenciasSimulado } from './adaptadores/simulado/AnalistaSimulado.js';
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
import { conProductor } from './contenedorProductor.js';
import { ErrorDeUsuario } from './dominio/errores.js';
import type { DirectorDeFoto } from './puertos/Foto.js';
import type { ObtenedorEnlaces } from './puertos/ObtenedorEnlaces.js';
import type { RevisorVisual } from './puertos/RevisorVisual.js';

import { GeneradorCartelOpenAI } from './adaptadores/openai/GeneradorCartel.js';

export interface OpcionesDepsPost {
  simular: boolean;
  /** Para el registro de gasto: de qué encargo sale cada petición. */
  proyecto: string;
  avisar?: (mensaje: string) => void;
  alIntervenir?: (especialista: QuienLlama, modelo?: string) => void;
  /**
   * De dónde salen, en simulado, los locales, las referencias y el recuento de piezas:
   * - `REALES` (la línea de comandos): se leen de datos/, sin tocarlos;
   * - `DEL_MODO` (la web): de datos-simulado/, como todo lo demás que la web hace en simulado.
   * En real no cambia nada: siempre son los de datos/.
   */
  datosDeReferencia?: 'REALES' | 'DEL_MODO';
  /** Enciende el productor aunque la configuración no lo diga (la opción --productor). */
  productor?: boolean;
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
  const guardado = await leerEncargo({ proyectos }, opciones.proyecto).catch(error => {
    if (error instanceof ErrorDeUsuario) return undefined;
    throw error;
  });
  const editorial = guardado?.productorEditorial === true || (!guardado && (opciones.productor ?? config.productor));
  const encender = !guardado?.taller && (editorial || (opciones.productor ?? config.productor));
  // Los locales, sus referencias y lo que cuenta para el umbral de la referencia obligatoria.
  const delModo = simular && opciones.datosDeReferencia === 'DEL_MODO';
  const datosDeReferencia = delModo ? datos : config.carpetaDatos;
  const ahora = () => new Date().toISOString();

  const referencias: DepsReferencias = {
    piezas: new AlmacenPiezasFicheros(join(datosDeReferencia, 'piezas')),
    piezasHechas: new PiezasHechasFicheros(delModo ? proyectos : join(RAIZ, 'proyectos')),
    // En la web en simulado, los locales y sus referencias reales se ven en solo lectura; lo que se escribe va a los simulados.
    locales: delModo
      ? new LocalesSuperpuestos(new AlmacenLocalesFicheros(join(datos, 'locales')), new AlmacenLocalesFicheros(join(config.carpetaDatos, 'locales')))
      : new AlmacenLocalesFicheros(join(datosDeReferencia, 'locales')),
    referencias: delModo
      ? new ReferenciasSuperpuestas(new AlmacenReferenciasFicheros(join(datos, 'locales')), new AlmacenReferenciasFicheros(join(config.carpetaDatos, 'locales')))
      : new AlmacenReferenciasFicheros(join(datosDeReferencia, 'locales')),
    biblioteca: new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(config.carpetaBiblioteca, 'referencias')),
    enlaces: simular ? enlacesSimulados : new ObtenedorEnlacesHttp(),
    leerArchivo: (ruta) => readFile(ruta),
    ahora,
  };
  const comunes = {
    ...(!simular && config.openaiApiKey && config.openaiTallerEnvios ? { tallerApi: {
      generador: new GeneradorCartelOpenAI(config.openaiApiKey), limite: config.openaiTallerEnvios,
      reservas: join(config.carpetaDatos, 'gasto', 'taller-openai'),
    } } : {}),
    raiz: RAIZ,
    proyectos,
    activos: new AlmacenActivosFicheros(join(datos, 'locales')),
    referencias,
    componedor: new ComponedorProyectos(RAIZ, datos),
    galeria: new GaleriaDisenosFicheros(join(datos, 'disenos')),
    galeriaDeBorradores: new GaleriaDisenosFicheros(CARPETA_DE_BORRADORES),
    historial: new HistorialDeDisenosFicheros(datos),
    ahora,
  };
  const medidor = new MedidorDeFotoSharp();
  const describirFuente = await descriptorDeFuentes(join(RAIZ, 'recursos', 'tipografias', 'catalogo.json'));
  if (simular) {
    const deps: DepsDisenoPost = {
      ...comunes,
      ...(editorial ? { criticoEditorial: new CriticoEditorialSimulado() } : {}),
      director: new DirectorFotoSimulado(),
      generador: new GeneradorFotoSimulado(),
      revisor: new RevisorVisualSimulado(),
      segmentador: new SegmentadorSimulado(),
      disenador: { director: new DirectorDisenoSimulado(), critico: new CriticoDisenoSimulado(), medidor, describirFuente },
      analista: new AnalistaReferenciasSimulado(),
    };
    return encender ? conProductor(deps, {
      proyecto: opciones.proyecto,
      alIntervenir: opciones.alIntervenir,
      ...(editorial ? { editorial: new ProductorEditorialSimulado() } : {}),
    }) : deps;
  }

  const { geminiApiKey } = config;
  const respaldo = editorial ? config.geminiModeloProductorRespaldo : config.geminiModeloRespaldo;
  const modelos = [editorial ? (config.geminiModeloProductor ?? 'gemini-4-hydrogen') : config.geminiModelo, ...(respaldo ? [respaldo] : [])];
  let orquestador: Orquestador | undefined;
  const cliente = (clave: string, motivo: string, quien: QuienLlama) => new ClienteGemini(clave, modelos, {
    avisar, alUsar: registradorDeUso(config.carpetaDatos, motivo, config.geminiFacturacion),
    ...(editorial || opciones.alIntervenir ? { antesDeEnviar: async (modelo: string) => {
      if (editorial) {
        if (!orquestador) throw new Error('Falta el control de presupuesto.');
        await orquestador.reservarLlamada(opciones.proyecto, quien, modelo);
      }
      opciones.alIntervenir?.(quien, modelo);
    } } : {}),
  });
  const deps: DepsDisenoPost = {
    ...comunes,
    ...(editorial && geminiApiKey ? { criticoEditorial: new CriticoEditorialGemini(cliente(geminiApiKey, 'critica-editorial', 'critico')) } : {}),
    director: geminiApiKey ? new DirectorFotoGemini(cliente(geminiApiKey, 'director-foto', 'director-foto'), await new BibliotecaFicheros(config.carpetaBiblioteca).leerGuia(), modelos) : directorSinClave,
    generador: new GeneradorFotoGemini({
      apiKey: geminiApiKey,
      modelo: config.geminiModeloImagen,
      facturacion: config.geminiFacturacion,
      topeUsd: config.geminiTopeUsd,
      carpetaDatos: config.carpetaDatos,
      origen: `orden-post:${opciones.proyecto}`,
    }),
    revisor: geminiApiKey ? new RevisorVisualGemini(cliente(geminiApiKey, 'comprobacion-salida', 'revisor'), modelos) : revisorSinClave,
    segmentador: new SegmentadorVision(RAIZ),
    // La ficha automática de una referencia nueva (puntos 3 y 4), con las familias del estudio y una ficha de ejemplo.
    ...(geminiApiKey ? { analista: await analistaGemini(cliente(geminiApiKey, 'analista-referencias', 'analista'), modelos, referencias.biblioteca) } : {}),
    // Sin clave no hay director de diseño: INTENCION deja el borrador y se para, como antes de F3.
    ...(geminiApiKey ? { disenador: { ...disenadorGemini(new DirectorDisenoGemini(cliente(geminiApiKey, 'director-diseno', 'director-diseno'), modelos)), medidor, describirFuente } } : {}),
  };
  return encender ? conProductor(deps, {
    proyecto: opciones.proyecto,
    ...(editorial && geminiApiKey ? {
      editorial: new ProductorEditorialGemini(cliente(geminiApiKey, 'productor-editorial', 'productor')),
      conectarTransporte: orq => { orquestador = orq; },
    } : {}),
  }) : deps;
}

async function analistaGemini(cliente: ClienteGemini, modelos: string[], biblioteca: DepsReferencias['biblioteca']): Promise<AnalistaReferenciasGemini> {
  const familias = await biblioteca.familias();
  // Una ficha hecha a mano por el estudio como ejemplo (post-09, F2), sin lo que pone el código.
  const ejemplo = await biblioteca.ficha('post-09').then(
    ({ esquema: _e, analizadaPor: _p, analizadaEn: _f, ...resto }) => resto,
    () => undefined,
  );
  return new AnalistaReferenciasGemini(cliente, modelos, familias, ejemplo);
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
