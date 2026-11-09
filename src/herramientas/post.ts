/**
 * ORDEN ÚNICA de punta a punta: de la foto subida al post exportado (src/aplicacion/post/ordenPost.ts).
 * Se para donde hace falta tu confirmación; cada vez que la lanzas, sigue desde donde se quedó.
 *
 *   npm run post -- nuevo <proyecto> --local L --foto <ruta> --plato "nota del dueño" [--referencia ref-id]
 *                  [--uso PUBLICABLE|SOLO_PRUEBA_COMPOSICION] [--simular]
 *   npm run post -- <proyecto>                       sigue hasta la siguiente parada
 *   npm run post -- <proyecto> --confirmo            confirma la parada (elementos y gasto, o la foto)
 *   npm run post -- <proyecto> --rechazo "motivo"    rechaza la foto propuesta (vuelve a generar si quedan intentos)
 *   npm run post -- <proyecto> --importar <imagen>   usa una foto hecha a mano en el paso de generar (sin facturación)
 *
 * Real: proyectos/<proyecto>/ y datos/. Generación con Gemini de pago solo si GEMINI_FACTURACION=si, con el tope
 * GEMINI_TOPE_USD. Revisión y director con Gemini. Máscara con Apple Vision.
 * --simular: director, generador, revisor y máscara simulados; nada se gasta y todo va a datos-simulado/ (los locales
 * y las referencias se leen de datos/, sin tocarlos).
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ComponedorProyectos } from '../adaptadores/compositor/ComponedorProyectos.js';
import { ObtenedorEnlacesHttp } from '../adaptadores/enlaces/ObtenedorEnlacesHttp.js';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenLocalesFicheros } from '../adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenPiezasFicheros } from '../adaptadores/ficheros/AlmacenPiezasFicheros.js';
import { AlmacenReferenciasFicheros } from '../adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { BibliotecaFicheros } from '../adaptadores/ficheros/BibliotecaFicheros.js';
import { PiezasHechasFicheros } from '../adaptadores/ficheros/PiezasHechasFicheros.js';
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { DirectorFotoGemini } from '../adaptadores/gemini/DirectorFotoGemini.js';
import { GeneradorFotoGemini } from '../adaptadores/gemini/GeneradorFotoGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { RevisorVisualGemini } from '../adaptadores/gemini/RevisorVisualGemini.js';
import { SegmentadorVision } from '../adaptadores/imagen/SegmentadorVision.js';
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from '../adaptadores/simulado/FotoSimulada.js';
import { avanzar, crearEncargo, type DepsPost } from '../aplicacion/post/ordenPost.js';
import { RAIZ, leerConfig } from '../config.js';
import { ErrorDeUsuario } from '../dominio/errores.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    local: { type: 'string' },
    foto: { type: 'string' },
    plato: { type: 'string' },
    referencia: { type: 'string' },
    uso: { type: 'string', default: 'PUBLICABLE' },
    simular: { type: 'boolean', default: false },
    confirmo: { type: 'boolean', default: false },
    rechazo: { type: 'string' },
    importar: { type: 'string' },
  },
});

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

async function construirDeps(simulado: boolean, proyecto: string): Promise<DepsPost> {
  const config = leerConfig();
  const datos = simulado ? config.carpetaDatosSimulado : config.carpetaDatos;
  const localesReales = join(config.carpetaDatos, 'locales');
  const biblioteca = new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(config.carpetaBiblioteca, 'referencias'));
  const referencias = {
    piezas: new AlmacenPiezasFicheros(join(config.carpetaDatos, 'piezas')),
    piezasHechas: new PiezasHechasFicheros(join(RAIZ, 'proyectos')),
    locales: new AlmacenLocalesFicheros(localesReales),
    referencias: new AlmacenReferenciasFicheros(localesReales),
    biblioteca,
    enlaces: new ObtenedorEnlacesHttp(),
    leerArchivo: async () => {
      throw new Error('la orden no registra referencias');
    },
    ahora: () => new Date().toISOString(),
  };
  const comunes = {
    raiz: RAIZ,
    proyectos: simulado ? join(config.carpetaDatosSimulado, 'proyectos') : join(RAIZ, 'proyectos'),
    activos: new AlmacenActivosFicheros(join(datos, 'locales')),
    referencias,
    componedor: new ComponedorProyectos(RAIZ, datos),
    ahora: () => new Date().toISOString(),
  };
  if (simulado) {
    return { ...comunes, director: new DirectorFotoSimulado(), generador: new GeneradorFotoSimulado(), revisor: new RevisorVisualSimulado(), segmentador: new SegmentadorSimulado() };
  }
  if (!config.geminiApiKey) throw new ErrorDeUsuario('Falta GEMINI_API_KEY en .env (o usa --simular).');
  const modelos = [config.geminiModelo, ...(config.geminiModeloRespaldo ? [config.geminiModeloRespaldo] : [])];
  const cliente = (motivo: string) =>
    new ClienteGemini(config.geminiApiKey as string, modelos, {
      avisar: (m) => console.error(`  aviso: ${m}`),
      alUsar: registradorDeUso(config.carpetaDatos, motivo, config.geminiFacturacion),
    });
  return {
    ...comunes,
    director: new DirectorFotoGemini(cliente('director-foto'), await new BibliotecaFicheros(config.carpetaBiblioteca).leerGuia(), modelos),
    generador: new GeneradorFotoGemini({
      apiKey: config.geminiApiKey,
      modelo: config.geminiModeloImagen,
      facturacion: config.geminiFacturacion,
      topeUsd: config.geminiTopeUsd,
      carpetaDatos: config.carpetaDatos,
      origen: `orden-post:${proyecto}`,
    }),
    revisor: new RevisorVisualGemini(cliente('comprobacion-salida'), modelos),
    segmentador: new SegmentadorVision(RAIZ),
  };
}

async function principal(): Promise<void> {
  const config = leerConfig();
  if (positionals[0] === 'nuevo') {
    const proyecto = positionals[1];
    if (!proyecto || !values.local || !values.foto || !values.plato) throw new ErrorDeUsuario('Uso: npm run post -- nuevo <proyecto> --local L --foto <ruta> --plato "…" [--referencia ref-id] [--simular]');
    const uso = values.uso === 'SOLO_PRUEBA_COMPOSICION' ? 'SOLO_PRUEBA_COMPOSICION' : 'PUBLICABLE';
    const deps = await construirDeps(values.simular, proyecto);
    await crearEncargo(deps, { proyecto, local: values.local, plato: values.plato, foto: values.foto, usoFotoReal: uso, simulado: values.simular, ...(values.referencia ? { referencia: values.referencia } : {}) });
    console.log(`✓ Encargo ${proyecto} creado${values.simular ? ' (SIMULADO, en datos-simulado/)' : ''}.`);
    await seguir(deps, proyecto);
    return;
  }
  const proyecto = positionals[0];
  if (!proyecto) throw new ErrorDeUsuario('Uso: npm run post -- <proyecto> [--confirmo | --rechazo "motivo" | --importar <imagen>]');
  const simulado = !(await existe(join(RAIZ, 'proyectos', proyecto, 'post.json'))) && (await existe(join(config.carpetaDatosSimulado, 'proyectos', proyecto, 'post.json')));
  await seguir(await construirDeps(simulado, proyecto), proyecto);
}

async function seguir(deps: DepsPost, proyecto: string): Promise<void> {
  const r = await avanzar(deps, proyecto, {
    confirmo: values.confirmo,
    ...(values.rechazo ? { rechazo: values.rechazo } : {}),
    ...(values.importar ? { importar: values.importar } : {}),
  });
  for (const m of r.mensajes) console.log(`· ${m}`);
  console.log(`\n■ ${r.encargo.paso}${r.encargo.simulado ? ' (simulado)' : ''} · ${r.parada}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof ErrorDeUsuario && error.detalles.length) for (const d of error.detalles) console.error(`  · ${d}`);
  process.exitCode = 1;
});
