/**
 * ORDEN ÚNICA de punta a punta: de la foto subida al post exportado (src/aplicacion/post/ordenPost.ts).
 * Se para donde hace falta tu confirmación; cada vez que la lanzas, sigue desde donde se quedó.
 *
 *   npm run post -- nuevo <proyecto> --local L --foto <ruta> --plato "nota del dueño" [--referencia ref-id]
 *                  [--uso PUBLICABLE|SOLO_PRUEBA_COMPOSICION] [--titular-creativo] [--estilo-de-referencia] [--estetica E] [--formato post|carrusel] [--simular]
 *                  [--foto-extra "ruta=elemento que enseña"]…  (hasta tres, solo en carrusel)
 *   npm run post -- <proyecto>                       sigue hasta la siguiente parada
 *   npm run post -- <proyecto> --confirmo            confirma la parada (elementos y gasto, o la foto)
 *   npm run post -- <proyecto> --rechazo "motivo"    rechaza la foto propuesta (vuelve a generar si quedan intentos)
 *   npm run post -- <proyecto> --importar <imagen>   usa una foto hecha a mano en el paso de generar (sin facturación)
 *   npm run post -- <proyecto> --confirmo [--sin-toma N]… [--portada-toma N]   en un carrusel: quita tomas de detalle que no
 *                                                    valen; hace la portada con una toma (producto aislado)
 *
 * Real: proyectos/<proyecto>/ y datos/. Generación con Gemini de pago solo si GEMINI_FACTURACION=si, con el tope
 * GEMINI_TOPE_USD. Revisión y directores (de foto y de diseño, F3) con Gemini. Máscara con Apple Vision.
 * --titular-creativo: el director de diseño puede usar UN titular que no sea un dato (una o dos palabras, sin cifras
 * ni reclamos). Por defecto, todo lo que dice la pieza tiene que constar en los datos.
 * --formato carrusel: portada, dos o tres detalles y un cierre con la firma (punto 1). F3.3: cada detalle con su foto
 *   (una toma nueva de ese elemento, sacada de la foto real; la primera parada dice cuántas fotos y el gasto total).
 * --foto-extra: una foto real de más que sube el dueño para el detalle de un elemento (se usa tal cual, sin generar).
 * --estetica: EDITORIAL_SERENO, EDITORIAL_OSCURO, COLOR_POP, MAXIMALISMO, MEDITERRANEO_LUMINOSO o RUSTICO_FUEGO (punto 10;
 *   sin ella, la de la familia de la referencia). Manda sobre la foto y el diseño.
 * --estilo-de-referencia: el generador recibe también la imagen de la referencia como @image2, solo de estilo (punto 9).
 * --simular: director, generador, revisor y máscara simulados; nada se gasta y todo va a datos-simulado/ (los locales
 * y las referencias se leen de datos/, sin tocarlos).
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { avanzar, crearEncargo, type DepsPost } from '../aplicacion/post/ordenPost.js';
import { RAIZ, leerConfig } from '../config.js';
import { crearDepsPost } from '../contenedorPost.js';
import { Estetica } from '../dominio/diseno/estetica.js';
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
    'estilo-de-referencia': { type: 'boolean', default: false },
    estetica: { type: 'string' },
    formato: { type: 'string', default: 'post' },
    'foto-extra': { type: 'string', multiple: true },
    'portada-toma': { type: 'string' },
    'sin-toma': { type: 'string', multiple: true },
    confirmo: { type: 'boolean', default: false },
    rechazo: { type: 'string' },
    importar: { type: 'string' },
  },
});

/** «ruta=elemento que enseña» → { ruta, elemento }. */
function fotoExtra(valor: string): { ruta: string; elemento: string } {
  const i = valor.indexOf('=');
  if (i < 1 || i === valor.length - 1) throw new ErrorDeUsuario(`--foto-extra "${valor}": escribe «ruta=elemento que enseña».`);
  return { ruta: valor.slice(0, i).trim(), elemento: valor.slice(i + 1).trim() };
}

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
    await crearEncargo(deps, { proyecto, local: values.local, plato: values.plato, foto: values.foto, usoFotoReal: uso, simulado: values.simular, titularCreativo: values['titular-creativo'], estiloDeReferencia: values['estilo-de-referencia'], ...(values.estetica ? { estetica: Estetica.parse(values.estetica) } : {}), formato: values.formato === 'carrusel' ? 'carrusel' : 'post', ...(values['foto-extra']?.length ? { fotosExtra: values['foto-extra'].map(fotoExtra) } : {}), ...(values.referencia ? { referencia: values.referencia } : {}) });
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
    ...(values['portada-toma'] ? { portadaToma: Number(values['portada-toma']) } : {}),
    ...(values['sin-toma']?.length ? { sinToma: values['sin-toma'].map(Number) } : {}),
  });
  for (const m of r.mensajes) console.log(`· ${m}`);
  console.log(`\n■ ${r.encargo.paso}${r.encargo.simulado ? ' (simulado)' : ''} · ${r.parada}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof ErrorDeUsuario && error.detalles.length) for (const d of error.detalles) console.error(`  · ${d}`);
  process.exitCode = 1;
});
