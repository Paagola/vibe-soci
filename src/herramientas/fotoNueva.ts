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
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { DirectorFotoGemini } from '../adaptadores/gemini/DirectorFotoGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { proponerFotoNueva } from '../aplicacion/fotos/proponerFotoNueva.js';

const { values } = parseArgs({ options: { foto: { type: 'string' }, plato: { type: 'string' }, salida: { type: 'string' }, referencia: { type: 'string' } } });

async function resumenReferencia(id: string): Promise<string> {
  const f = JSON.parse(await readFile(join(RAIZ, 'conocimiento', 'referencias', 'fichas', `${id}.json`), 'utf8')) as Record<string, unknown>;
  const campos = ['titulo', 'familia', 'capas', 'reticula', 'foto', 'lectura', 'porQueFunciona'] as const;
  return campos.map((c) => `${c}: ${JSON.stringify(f[c])}`).join(' · ');
}

async function principal(): Promise<void> {
  const { foto, plato, salida, referencia } = values;
  if (!foto || !plato || !salida) throw new Error('Faltan --foto, --plato o --salida');
  const config = leerConfig();
  if (!config.geminiApiKey) throw new Error('Falta GEMINI_API_KEY en .env');
  const guia = await new BibliotecaFicheros(config.carpetaBiblioteca).leerGuia();
  const modelos = [config.geminiModelo, ...(config.geminiModeloRespaldo ? [config.geminiModeloRespaldo] : [])];
  const cliente = new ClienteGemini(config.geminiApiKey, modelos, { alUsar: registradorDeUso(config.carpetaDatos, 'director-foto', config.geminiFacturacion) });
  const director = new DirectorFotoGemini(cliente, guia, modelos);
  const encargo = {
    foto: resolve(foto),
    plato,
    ...(referencia ? { referencia: { id: referencia, resumen: await resumenReferencia(referencia), imagen: join(RAIZ, 'biblioteca', 'referencias', `${referencia}.jpg`) } } : {}),
  };
  const { propuesta, prompt, problemas, intentos } = await proponerFotoNueva(director, encargo);
  const meta = await sharp(resolve(foto)).metadata();
  const lado = { ancho: meta.width ?? 0, alto: meta.height ?? 0 };
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
