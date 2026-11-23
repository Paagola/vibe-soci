/**
 * El chat de la web con sus piezas reales: Hydrogen (director, planificador y reparador), Nano Banana Pro por la API
 * de Gemini (con el tope mensual GEMINI_TOPE_USD), Apple Vision para las máscaras y el compositor del estudio.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { CompositorSharp } from '../adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../adaptadores/compositor/tipografias.js';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { EstudioArteGemini } from '../adaptadores/gemini/EstudioArteGemini.js';
import { GeneradorFotoGemini } from '../adaptadores/gemini/GeneradorFotoGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { franjasPlanas } from '../adaptadores/imagen/franjas.js';
import { fotoConMascaraPrincipal } from '../adaptadores/imagen/mascaraPrincipal.js';
import { MedidorDeFotoSharp } from '../adaptadores/imagen/MedidorDeFotoSharp.js';
import { ProcesadorSharp } from '../adaptadores/imagen/ProcesadorSharp.js';
import { SegmentadorVision } from '../adaptadores/imagen/SegmentadorVision.js';
import { prepararEncargo } from '../aplicacion/arte/estudioDeArte.js';
import { componerVisual, crearPintor, registrarFotoGenerada } from '../aplicacion/arte/pieza.js';
import { ServicioChat, type LocalDelChat } from '../aplicacion/chat/servicioChat.js';
import { RAIZ, type Config } from '../config.js';
import { CATALOGO } from '../aplicacion/chat/herramientas.js';
import type { Estudio } from './estudio.js';
import { crearHerramientasChat } from './herramientasChat.js';
import { crearBuscadorDeReferencias } from './referenciasChat.js';
import { leerCorpus } from '../dominio/arte/referencias.js';
import { Tokens } from '../dominio/diseno/intencion.js';
import { Marca } from '../dominio/modelos.js';

/** Lo que cuesta una toma nueva de Nano Banana Pro a 2K, para la estimación del plan (el tope lo mide de verdad). */
const USD_POR_FOTO = 0.15;

export async function crearServicioChat(config: Config, estudio?: Estudio, avisar: (m: string) => void = (m) => console.warn(`! ${m}`)): Promise<{ chat: ServicioChat; herramientas?: ReturnType<typeof crearHerramientasChat> }> {
  const datos = config.carpetaDatos;
  const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
  const motor = new MotorTexto(catalogo);
  const compositor = new CompositorSharp(motor, catalogo);
  const activos = new AlmacenActivosFicheros(join(datos, 'locales'));
  const procesador = new ProcesadorSharp();
  const medidor = new MedidorDeFotoSharp();
  const segmentador = new SegmentadorVision(RAIZ);
  const carpetaCorpus = join(RAIZ, 'referencias-pinterest', 'diseno-visual');
  const corpus = { piezas: leerCorpus(await readFile(join(carpetaCorpus, 'README.md'), 'utf8').catch(() => '')), ruta: (a: string) => join(carpetaCorpus, a) };
  const metricas = { ancho: (est: never, t: string, n: number) => motor.medir(est, t, n).ancho, mayusculas: (est: never) => motor.alturaMayusculas(est, 1000) / 1000 };

  const modelos = [process.env.GEMINI_MODELO_ARTE ?? 'gemini-4-hydrogen', config.geminiModelo];
  const cliente = config.geminiApiKey ? new ClienteGemini(config.geminiApiKey, modelos, { alUsar: registradorDeUso(datos, 'chat', config.geminiFacturacion), tiempoMaximoMs: 300_000 }) : undefined;
  const director = cliente ? new EstudioArteGemini(cliente, modelos) : undefined;
  const generador = new GeneradorFotoGemini({ ...(config.geminiApiKey ? { apiKey: config.geminiApiKey } : {}), modelo: config.geminiModeloImagen, facturacion: config.geminiFacturacion, topeUsd: config.geminiTopeUsd, carpetaDatos: datos, origen: 'chat' });

  const locales = async (): Promise<LocalDelChat[]> => {
    const carpeta = join(datos, 'locales');
    const slugs = await readdir(carpeta).catch(() => [] as string[]);
    const todos = await Promise.all(
      slugs.map(async (slug) => {
        const tokens = join(RAIZ, 'marcas', slug, 'tokens.json');
        if (!(await stat(tokens).then(() => true, () => false))) return undefined;
        try {
          return { slug, marca: Marca.parse(JSON.parse(await readFile(join(carpeta, slug, 'marca.json'), 'utf8'))), tokens: Tokens.parse(JSON.parse(await readFile(tokens, 'utf8'))) };
        } catch {
          return undefined;
        }
      }),
    );
    return todos.filter((l): l is LocalDelChat => Boolean(l)).sort((a, b) => a.marca.nombre.localeCompare(b.marca.nombre));
  };

  const generarFoto = async (o: { id: string; prompt: string; referencias: Array<{ ruta: string; etiqueta: string }>; tamano: '1K' | '2K' }) => {
    const r = await generador.generar({ id: o.id, prompt: o.prompt, referencias: o.referencias, aspectRatio: '3:4', tamano: o.tamano });
    return { bytes: r.bytes, costeUsd: r.costeUsd, modelo: r.modelo };
  };
  const herramientas = estudio ? crearHerramientasChat({ config, estudio, generarFoto }) : undefined;

  const chat = new ServicioChat({
    ...(herramientas ? { herramientas: { catalogo: CATALOGO, ejecutar: herramientas.ejecutar } } : {}),
    carpeta: join(datos, 'chat'),
    usdPorFoto: USD_POR_FOTO,
    avisar,
    locales,
    ...(director ? { director } : {}),
    // Estética de referencia antes de cada pieza (desactivable con CHAT_SIN_REFERENCIAS=1).
    ...(process.env.CHAT_SIN_REFERENCIAS === '1' ? {} : { buscarReferencias: crearBuscadorDeReferencias({ raiz: RAIZ, datos, locales, corpus, ...(cliente ? { cliente } : {}) }) }),
    registrarFoto: async (o) => {
      const activo = await registrarFotoGenerada(activos, segmentador, { ...o, ...(o.tipo === 'GENERADO' ? { modelo: config.geminiModeloImagen, trabajo: o.id } : {}) });
      // La real, con su máscara principal (sin los objetos que corta el borde), como en el resto del estudio.
      return o.tipo === 'REAL' ? fotoConMascaraPrincipal(activos, o.local, activo) : activo;
    },
    prepararEncargo: async (entrada) => (await prepararEncargo({ medidor, silueta: (f) => medidor.silueta(f), corpus }, entrada)).encargo,
    generarFoto,
    defectoDeFoto: async (ruta) => {
      const f = await franjasPlanas(ruta);
      return Math.max(f.arriba, f.abajo) >= 0.15 ? `franja plana del ${Math.round(Math.max(f.arriba, f.abajo) * 100)} %` : undefined;
    },
    componer: (entrada, receta, esfuerzo) =>
      componerVisual(
        {
          medidor,
          silueta: (f) => medidor.silueta(f),
          pintar: crearPintor({ compositor, activos, procesador, tokensMarca: entrada.tokensMarca }),
          metricas: metricas as never,
          corpus,
          // Con esfuerzo máximo, además, una vuelta de crítica visual de Hydrogen con su parche.
          ...(esfuerzo === 'maximo' && director ? { critico: director } : {}),
        },
        { ...entrada, vueltas: esfuerzo === 'maximo' ? 1 : 0 },
        receta,
        esfuerzo === 'rapido' ? undefined : director,
      ),
  });
  return { chat, ...(herramientas ? { herramientas } : {}) };
}
