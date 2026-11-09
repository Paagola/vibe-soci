/**
 * Importa una imagen generada fuera de nuestras herramientas de API, con las referencias del paquete de paqueteManual.ts:
 *   - a mano en la app de Gemini (--via app, por defecto): prompt = prompt.txt del paquete, coste de API 0;
 *   - por el MCP de Higgsfield en una conversación (--via mcp): prompt = el archivo exacto que se envió (--prompt-archivo),
 *     modelo pedido y servido, trabajo y créditos.
 * Comprueba que el paquete no ha cambiado (huellas del manifiesto) y crea un activo GENERADO, SOLO_PRUEBA_COMPOSICION.
 *
 * Uso: tsx src/herramientas/importarManual.ts --receta <receta.json> --imagen <archivo> --intento 1 --fecha 2026-11-08
 *        app: --modelo "Nano Banana Pro"
 *        mcp: --via mcp --prompt-archivo <archivo> --pedido nano_banana_pro --servido nano_banana_2 --trabajo <id> --creditos 2
 *        [--nota "…"] [--paquete proyectos/…/manual/S1]
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import { RAIZ, leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';
import { activoDeImportacion, idDeImportacion, VIA_MANUAL, VIA_MCP_HIGGSFIELD, type ViaExterna } from '../adaptadores/gemini/appManual.js';
import { leerReceta } from '../adaptadores/gemini/recetaGemini.js';

const Manifiesto = z.object({
  receta: z.string(),
  prompt: z.object({ archivo: z.string(), sha256: z.string() }),
  referencias: z.array(z.object({ orden: z.number(), archivo: z.string(), origen: z.string(), sha256: z.string() })),
});

const { values } = parseArgs({
  options: {
    receta: { type: 'string' },
    imagen: { type: 'string' },
    intento: { type: 'string', default: '1' },
    modelo: { type: 'string' },
    fecha: { type: 'string' },
    nota: { type: 'string', multiple: true, default: [] },
    paquete: { type: 'string' },
    via: { type: 'string', default: 'app' },
    'prompt-archivo': { type: 'string' },
    pedido: { type: 'string' },
    servido: { type: 'string' },
    trabajo: { type: 'string' },
    creditos: { type: 'string' },
    /** Relación del registro de la API (0,389 USD = 6,218 créditos, 07/11/2026). */
    'usd-por-credito': { type: 'string', default: '0.06256' },
  },
});

const huella = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

async function principal(): Promise<void> {
  const { receta: rutaReceta, imagen, modelo, fecha } = values;
  if (!rutaReceta || !imagen || !fecha) throw new Error('Faltan --receta, --imagen o --fecha (el día en que se generó).');
  let origen: ViaExterna;
  if (values.via === 'mcp') {
    const { pedido, servido, trabajo, creditos } = values;
    if (!pedido || !servido || !trabajo || !creditos || !values['prompt-archivo']) throw new Error('Con --via mcp faltan --pedido, --servido, --trabajo, --creditos o --prompt-archivo.');
    origen = { via: VIA_MCP_HIGGSFIELD, modeloPedido: pedido, modeloServido: servido, trabajo, creditos: Number(creditos), usdPorCredito: Number(values['usd-por-credito']) };
  } else {
    if (!modelo) throw new Error('Falta --modelo (el que mostraba la app).');
    origen = { via: VIA_MANUAL, modeloDeclarado: modelo };
  }
  const receta = await leerReceta(resolve(rutaReceta));
  const intento = Number(values.intento);
  if (!Number.isInteger(intento) || intento < 1) throw new Error('--intento es 1, 2, 3…');

  const paquete = resolve(RAIZ, values.paquete ?? join('proyectos/prueba-metodo-society/manual', basename(rutaReceta, '.json').toUpperCase()));
  const manifiesto = Manifiesto.parse(JSON.parse(await readFile(join(paquete, 'manifiesto.json'), 'utf8')));
  // En la app se pega prompt.txt del paquete; por el MCP se envía el archivo que se indique.
  const promptArchivo = origen.via === VIA_MCP_HIGGSFIELD ? (values['prompt-archivo'] as string) : manifiesto.prompt.archivo;
  const prompt = await readFile(resolve(RAIZ, promptArchivo));
  if (origen.via === VIA_MANUAL && huella(prompt) !== manifiesto.prompt.sha256) throw new Error('prompt.txt ha cambiado desde que se preparó el paquete: la procedencia no cuadraría.');
  for (const r of manifiesto.referencias) {
    if (huella(await readFile(join(paquete, r.archivo))) !== r.sha256) throw new Error(`${r.archivo} ha cambiado desde que se preparó el paquete.`);
  }

  const config = leerConfig();
  const id = idDeImportacion(receta, intento, origen.via);
  const carpeta = join(config.carpetaDatos, 'locales', receta.local, 'activos', id);
  if (await stat(join(carpeta, 'activo.json')).then(() => true, () => false)) throw new Error(`El activo ${id} ya existe: un activo no se sobrescribe.`);

  const bytes = await readFile(resolve(imagen));
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height) throw new Error('No se puede leer la imagen.');
  const extension = (extname(imagen).slice(1) || meta.format || 'png').toLowerCase();
  const archivo = `original.${extension}`;
  await mkdir(carpeta, { recursive: true });
  await copyFile(resolve(imagen), join(carpeta, archivo));
  await writeFile(join(carpeta, 'prompt.txt'), prompt);
  for (const r of manifiesto.referencias) await copyFile(join(paquete, r.archivo), join(carpeta, `referencia-${r.orden}.jpg`));

  const sha = huella(bytes);
  const activo = activoDeImportacion({
    receta,
    intento,
    promptArchivo: relative(RAIZ, resolve(RAIZ, promptArchivo)),
    prompt: prompt.toString('utf8').trim(),
    referencias: manifiesto.referencias,
    archivo,
    ruta: relative(RAIZ, join(carpeta, archivo)),
    ancho: meta.width,
    alto: meta.height,
    sha256: sha,
    origen,
    generadoEn: fecha,
    importadoEn: new Date().toISOString(),
    notas: values.nota as string[],
  });
  await escribirJson(join(carpeta, 'activo.json'), activo);
  console.log(`Activo ${id}: ${meta.width} × ${meta.height} (${(meta.width / meta.height).toFixed(3)}; 3:4 = 0,750) → ${relative(RAIZ, carpeta)}`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
