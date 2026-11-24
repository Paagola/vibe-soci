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
import { juzgarDominante, medirDominante, neutralizarDominante } from '../adaptadores/imagen/dominante.js';
import { leerCartel } from '../adaptadores/imagen/lecturaCartel.js';
import { fotoConMascaraPrincipal } from '../adaptadores/imagen/mascaraPrincipal.js';
import { MedidorDeFotoSharp } from '../adaptadores/imagen/MedidorDeFotoSharp.js';
import { ProcesadorSharp } from '../adaptadores/imagen/ProcesadorSharp.js';
import { SegmentadorVision } from '../adaptadores/imagen/SegmentadorVision.js';
import { componerFotografiaConTexto } from '../aplicacion/arte/fotografiaConTexto.js';
import { prepararEncargo } from '../aplicacion/arte/estudioDeArte.js';
import { componerVisual, crearPintor, registrarFotoGenerada } from '../aplicacion/arte/pieza.js';
import { comprobarFotosEdicion, crearEditorDeDiseno } from '../aplicacion/chat/editarDiseno.js';
import { ServicioChat, type LocalDelChat } from '../aplicacion/chat/servicioChat.js';
import { RAIZ, type Config } from '../config.js';
import { CATALOGO } from '../aplicacion/chat/herramientas.js';
import type { Estudio } from './estudio.js';
import { crearHerramientasChat } from './herramientasChat.js';
import { crearBuscadorDeReferencias } from './referenciasChat.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { AnalistaReferenciasGemini } from '../adaptadores/gemini/AnalistaReferenciasGemini.js';
import { RecursosArteGemini } from '../adaptadores/gemini/RecursosArteGemini.js';
import { BibliotecaDeReferenciasFicheros } from '../adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { capasProtegidas, componerProtegido } from '../adaptadores/imagen/insercion.js';
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

  // El acabado de las piezas con Nano Banana 2 (no el Pro, que es para la foto del plato), con el mismo tope mensual.
  // El modelo dibuja sobre la pieza terminada y el código restaura píxel a píxel el producto y los textos.
  const modeloAcabado = process.env.ARTE_MODELO_RECURSOS ?? 'gemini-3.1-flash-image';
  const recursos = config.geminiApiKey
    ? new RecursosArteGemini(new GeneradorFotoGemini({ apiKey: config.geminiApiKey, modelo: modeloAcabado, facturacion: config.geminiFacturacion, topeUsd: config.geminiTopeUsd, carpetaDatos: datos, origen: 'chat/acabado' }), activos, modeloAcabado, () => {})
    : undefined;
  const insertar = recursos
    ? async (pieza: { png: string }, instruccion: string, c: { id: string; referencia?: string; carpeta: string; reestilizar?: string[] }) => {
        await mkdir(c.carpeta, { recursive: true });
        const editada = await recursos.insertar(pieza.png, instruccion, { id: c.id, ...(c.referencia ? { referencia: c.referencia } : {}) });
        await writeFile(join(c.carpeta, 'editada-por-el-modelo.png'), await sharp(editada.bytes).png().toBuffer());
        await writeFile(join(c.carpeta, 'prompt.txt'), `${editada.prompt}\n`);
        const r = await componerProtegido(pieza.png, editada.bytes, await capasProtegidas(dirname(pieza.png), c.reestilizar ?? []));
        const png = join(c.carpeta, 'diseno.png');
        await writeFile(png, r.png);
        const movil = join(c.carpeta, 'movil.png');
        await sharp(r.png).resize(360).png().toFile(movil);
        return { png, movil, medidas: [`INSERCION: el modelo (${editada.modelo}) habría cambiado el ${Math.round(r.cambioDentro * 100)} % del producto y los textos (restaurados por el código) y añadió en el ${Math.round(r.cambioFuera * 100)} % del resto; ${editada.costeUsd.toFixed(3)} USD.`] };
      }
    : undefined;
  // El analista de referencias: la ficha de la referencia elegida (familia, retícula, capas, tipografía, paleta).
  const familias = await new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(config.carpetaBiblioteca, 'referencias')).familias().catch(() => []);
  const analista = cliente && familias.length ? new AnalistaReferenciasGemini(cliente, modelos, familias) : undefined;

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
    comprobarFotosEdicion: (local, laminas, referencias) => comprobarFotosEdicion(activos, local, laminas, referencias),
    ...(director && recursos ? { editarDiseno: crearEditorDeDiseno({
      compositor, activos, fuentes: catalogo.familias(), dirigir: (o) => director.editarCapas(o),
      chip: (local, clave, descripcion) => recursos.chip(local, clave, descripcion),
    }) } : {}),
    ...(herramientas ? { herramientas: { catalogo: CATALOGO, ejecutar: herramientas.ejecutar } } : {}),
    carpeta: join(datos, 'chat'),
    usdPorFoto: USD_POR_FOTO,
    avisar,
    locales,
    ...(director ? { director, revisarFoto: (o: Parameters<typeof director.revisarFoto>[0]) => director.revisarFoto(o) } : {}),
    ...(analista
      ? {
          analizarReferencia: async (ruta: string) => {
            const a = await analista.analizar(ruta);
            return { ficha: a.ficha, apta: a.aptitud.tipo === 'POST', problemas: a.aptitud.problemas };
          },
        }
      : {}),
    // Estética de referencia antes de cada pieza (desactivable con CHAT_SIN_REFERENCIAS=1).
    ...(process.env.CHAT_SIN_REFERENCIAS === '1' ? {} : { buscarReferencias: crearBuscadorDeReferencias({ raiz: RAIZ, datos, locales, corpus, ...(cliente ? { cliente } : {}) }) }),
    registrarFoto: async (o) => {
      const activo = await registrarFotoGenerada(activos, segmentador, { ...o, ...(o.tipo === 'GENERADO' ? { modelo: config.geminiModeloImagen, trabajo: o.id } : {}) });
      // La real, con su máscara principal (sin los objetos que corta el borde), como en el resto del estudio.
      return o.tipo === 'REAL' ? fotoConMascaraPrincipal(activos, o.local, activo) : activo;
    },
    prepararEncargo: async (entrada) => (await prepararEncargo({ medidor, silueta: (f) => medidor.silueta(f), corpus }, entrada)).encargo,
    generarFoto,
    defectoDeFoto: async (ruta, luzDeEscena) => {
      const f = await franjasPlanas(ruta);
      if (Math.max(f.arriba, f.abajo) >= 0.15) return `franja plana del ${Math.round(Math.max(f.arriba, f.abajo) * 100)} %`;
      if (luzDeEscena) return undefined; // El revisor visual compara la distribución del color con la fuente prevista.
      const d = await medirDominante(ruta);
      return juzgarDominante(d) === 'EXCESIVA' ? `una dominante amarilla fuera del balance solicitado (luces R−B ${d.blancosRB})` : undefined;
    },
    corregirFoto: async (ruta) => {
      const r = await neutralizarDominante(ruta);
      return r ? `Neutralicé la dominante amarilla de la foto (blancos R−B ${r.antes} → ${r.despues}): los blancos tiraban a crema.` : undefined;
    },
    leerTextoMovil: async png => (await leerCartel(png, [])).lineas,
    componerFotografiaConTexto: (entrada, receta, cabecera) => componerFotografiaConTexto(
      crearPintor({ compositor, activos, procesador, tokensMarca: entrada.tokensMarca }), entrada, receta, cabecera),
    componer: (entrada, receta, esfuerzo) =>
      componerVisual(
        {
          medidor,
          silueta: (f) => medidor.silueta(f),
          pintar: crearPintor({ compositor, activos, procesador, tokensMarca: entrada.tokensMarca }),
          metricas: metricas as never,
          corpus,
          // Salvo en «rápido», la pieza la mira un crítico (con la referencia como listón) y su parche solo se queda si
          // gana a ciegas; el acabado de Nano Banana 2, donde lo pida la entrada (la portada o todas, según el esfuerzo).
          ...(esfuerzo !== 'rapido' && director ? { critico: director, comparador: director } : {}),
          ...(esfuerzo !== 'rapido' && insertar ? { insertar } : {}),
          // OCR a 360 px (Apple Vision, en local): un titular que no se lee en el móvil se repara.
          ...(esfuerzo !== 'rapido' ? { leer: async (png: string) => (await leerCartel(png, []).catch(() => ({ lineas: [] as string[] }))).lineas } : {}),
        },
        { ...entrada, vueltas: esfuerzo === 'maximo' ? 2 : esfuerzo === 'normal' ? 1 : 0, ...(esfuerzo === 'rapido' ? { enriquecer: false } : {}) },
        receta,
        esfuerzo === 'rapido' ? undefined : director,
      ),
  });
  return { chat, ...(herramientas ? { herramientas } : {}) };
}
