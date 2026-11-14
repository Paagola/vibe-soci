/**
 * ORDEN ÚNICA de punta a punta: de la foto subida al post exportado (src/aplicacion/post/ordenPost.ts).
 * Se para donde hace falta tu confirmación; cada vez que la lanzas, sigue desde donde se quedó.
 *
 *   npm run post -- nuevo <proyecto> --local L --foto <ruta> --plato "nota del dueño" [--referencia ref-id]
 *                  [--uso PUBLICABLE|SOLO_PRUEBA_COMPOSICION] [--titular-creativo] [--simular]
 *   npm run post -- <proyecto>                       sigue hasta la siguiente parada
 *   npm run post -- <proyecto> --confirmo            confirma la parada (elementos y gasto, o la foto)
 *   npm run post -- <proyecto> --rechazo "motivo"    rechaza la foto propuesta (vuelve a generar si quedan intentos)
 *   npm run post -- <proyecto> --importar <imagen>   usa una foto hecha a mano en el paso de generar (sin facturación)
 *
 * Real: proyectos/<proyecto>/ y datos/. Generación con Gemini de pago solo si GEMINI_FACTURACION=si, con el tope
 * GEMINI_TOPE_USD. Revisión y directores (de foto y de diseño, F3) con Gemini. Máscara con Apple Vision.
 * --titular-creativo: el director de diseño puede usar UN titular que no sea un dato (una o dos palabras, sin cifras
 * ni reclamos). Por defecto, todo lo que dice la pieza tiene que constar en los datos.
 * --simular: director, generador, revisor y máscara simulados; nada se gasta y todo va a datos-simulado/ (los locales
 * y las referencias se leen de datos/, sin tocarlos).
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { avanzar, crearEncargo, type DepsPost } from '../aplicacion/post/ordenPost.js';
import { RAIZ, leerConfig } from '../config.js';
import { crearDepsPost } from '../contenedorPost.js';
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
    'titular-creativo': { type: 'boolean', default: false },
    confirmo: { type: 'boolean', default: false },
    rechazo: { type: 'string' },
    importar: { type: 'string' },
  },
});

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

/** Los adaptadores los elige contenedorPost.ts, que comparte con la web. Aquí, en simulado, los locales y las referencias son los reales. */
async function construirDeps(simulado: boolean, proyecto: string): Promise<DepsPost> {
  const config = leerConfig();
  if (!simulado && !config.geminiApiKey) throw new ErrorDeUsuario('Falta GEMINI_API_KEY en .env (o usa --simular).');
  return crearDepsPost(config, { simular: simulado, proyecto, datosDeReferencia: 'REALES', avisar: (m) => console.error(`  aviso: ${m}`) });
}

async function principal(): Promise<void> {
  const config = leerConfig();
  if (positionals[0] === 'nuevo') {
    const proyecto = positionals[1];
    if (!proyecto || !values.local || !values.foto || !values.plato) throw new ErrorDeUsuario('Uso: npm run post -- nuevo <proyecto> --local L --foto <ruta> --plato "…" [--referencia ref-id] [--simular]');
    const uso = values.uso === 'SOLO_PRUEBA_COMPOSICION' ? 'SOLO_PRUEBA_COMPOSICION' : 'PUBLICABLE';
    const deps = await construirDeps(values.simular, proyecto);
    await crearEncargo(deps, { proyecto, local: values.local, plato: values.plato, foto: values.foto, usoFotoReal: uso, simulado: values.simular, titularCreativo: values['titular-creativo'], ...(values.referencia ? { referencia: values.referencia } : {}) });
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
