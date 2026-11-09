/**
 * Plantilla de FOTO NUEVA con el director (dominio/fotoNueva.ts + adaptadores/gemini/instruccionesFoto.ts).
 *   1. el director describe la foto subida (ángulo, luz, elementos con recuento, defectos) y dice si es utilizable;
 *   2. rellena los huecos de la plantilla, con la referencia del post si la hay (solo para él);
 *   3. el código comprueba la regla de ángulo (> 30°) y lo demás; si falla, se le devuelve una vez con los problemas;
 *   4. el código monta el prompt con la estructura del prompt de la gamba que gustó.
 * Gemini, tier gratuito, solo texto y visión: 0 USD. No genera ninguna imagen.
 *
 * Uso: tsx --env-file=.env src/herramientas/fotoNueva.ts --foto <ruta> --plato "<nota del dueño>" --salida <archivo.json> [--referencia post-NN]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { RAIZ, leerConfig } from '../config.js';
import { BibliotecaFicheros } from '../adaptadores/ficheros/BibliotecaFicheros.js';
import { ClienteGemini, type ParteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { instruccionesFoto, textoFotoNueva } from '../adaptadores/gemini/instruccionesFoto.js';
import { montarPromptFotoNueva, problemasFotoNueva, PropuestaFotoNueva } from '../dominio/fotoNueva.js';

const { values } = parseArgs({ options: { foto: { type: 'string' }, plato: { type: 'string' }, salida: { type: 'string' }, referencia: { type: 'string' } } });

async function resumenReferencia(id: string): Promise<string> {
  const f = JSON.parse(await readFile(join(RAIZ, 'conocimiento', 'referencias', 'fichas', `${id}.json`), 'utf8')) as Record<string, unknown>;
  const campos = ['titulo', 'familia', 'capas', 'reticula', 'foto', 'lectura', 'porQueFunciona'] as const;
  return campos.map((c) => `${c}: ${JSON.stringify(f[c])}`).join(' · ');
}

const reducir = async (ruta: string, lado: number) =>
  (await sharp(ruta).rotate().resize(lado, lado, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()).toString('base64');

async function principal(): Promise<void> {
  const { foto, plato, salida, referencia } = values;
  if (!foto || !plato || !salida) throw new Error('Faltan --foto, --plato o --salida');
  const config = leerConfig();
  if (!config.geminiApiKey) throw new Error('Falta GEMINI_API_KEY en .env');
  const guia = await new BibliotecaFicheros(config.carpetaBiblioteca).leerGuia();
  const modelos = [config.geminiModelo, ...(config.geminiModeloRespaldo ? [config.geminiModeloRespaldo] : [])];
  const cliente = new ClienteGemini(config.geminiApiKey, modelos);
  const meta = await sharp(resolve(foto)).metadata();
  const lado = { ancho: meta.width ?? 0, alto: meta.height ?? 0 };
  const archivo = 'fotos/01-plato.jpg';
  const encargo = {
    plato,
    archivo,
    ...lado,
    ...(referencia ? { referencia: { id: referencia, resumen: await resumenReferencia(referencia) } } : {}),
  };
  const imagenes: ParteGemini[] = [
    { text: `Imagen «${archivo}» · ${plato}:` },
    { inlineData: { mimeType: 'image/jpeg', data: await reducir(resolve(foto), 1536) } },
    ...(referencia
      ? ([
          { text: `Post de referencia «${referencia}» (solo para ti, no se envía al generador):` },
          { inlineData: { mimeType: 'image/jpeg', data: await reducir(join(RAIZ, 'biblioteca', 'referencias', `${referencia}.jpg`), 768) } },
        ] as ParteGemini[])
      : []),
  ];

  let problemas: string[] = [];
  let propuesta: PropuestaFotoNueva | undefined;
  const intentos: Array<{ problemas: string[] }> = [];
  for (let intento = 1; intento <= 2; intento++) {
    propuesta = await cliente.generarJson(instruccionesFoto(guia), [{ text: textoFotoNueva(encargo, problemas) }, ...imagenes], PropuestaFotoNueva);
    problemas = problemasFotoNueva(propuesta, lado);
    intentos.push({ problemas });
    if (problemas.length === 0) break;
  }
  if (!propuesta) throw new Error('El director no respondió.');
  const prompt = montarPromptFotoNueva(propuesta.huecos);
  await mkdir(dirname(resolve(salida)), { recursive: true });
  await writeFile(
    resolve(salida),
    `${JSON.stringify({ fecha: new Date().toISOString(), modelos, foto, plato, lado, referencia: referencia ?? null, intentos, propuesta, prompt, problemasFinales: problemas }, null, 2)}\n`,
  );
  console.log(`Foto subida: ${propuesta.descripcion.anguloGrados}° · cámara nueva: ${propuesta.huecos.camara.anguloGrados}° · utilizable: ${propuesta.descripcion.utilizable} · intentos: ${intentos.length}`);
  if (problemas.length) console.log(`PROBLEMAS SIN RESOLVER: ${problemas.join(' | ')}`);
  console.log(prompt);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
