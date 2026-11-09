/**
 * Ensayo (sin generar imagen): ¿escribe el director un buen prompt de FOTO NUEVA solo con la foto subida y la biblioteca?
 * El director recibe su marco de siempre (instruccionesBase) con la biblioteca tal cual la carga la app (principios,
 * ejemplos y valoraciones; sin posts de referencia ni conocimiento/), la foto y una tarea: el prompt de la foto, sin texto.
 * No se añaden reglas del estudio: se mide lo que aporta la biblioteca.
 *
 * Coste: una llamada de texto a Gemini (tier gratuito de la clave del usuario: 0 USD).
 *
 * Uso: tsx --env-file=.env src/herramientas/ensayoDirectorFoto.ts --foto <ruta> --plato "<nota del dueño>" --salida <archivo.json>
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import { RAIZ, leerConfig } from '../config.js';
import { BibliotecaFicheros } from '../adaptadores/ficheros/BibliotecaFicheros.js';
import { ClienteGemini, type ParteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { instruccionesBase, textoFotoNuevaDeEnsayo } from '../adaptadores/gemini/instrucciones.js';

const { values } = parseArgs({ options: { foto: { type: 'string' }, plato: { type: 'string' }, salida: { type: 'string' } } });

const Respuesta = z.object({ prompt: z.string().min(50), decisiones: z.array(z.string()).min(1) });

async function principal(): Promise<void> {
  const { foto, plato, salida } = values;
  if (!foto || !plato || !salida) throw new Error('Faltan --foto, --plato o --salida');
  const config = leerConfig();
  if (!config.geminiApiKey) throw new Error('Falta GEMINI_API_KEY en .env');
  const guia = await new BibliotecaFicheros(config.carpetaBiblioteca).leerGuia();
  const modelos = [config.geminiModelo, ...(config.geminiModeloRespaldo ? [config.geminiModeloRespaldo] : [])];
  const cliente = new ClienteGemini(config.geminiApiKey, modelos);
  const bytes = await sharp(resolve(foto)).rotate().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const archivo = 'fotos/01-plato.jpg';
  // Igual que el director: cada imagen va precedida de su nombre y la nota del dueño.
  const partes: ParteGemini[] = [
    { text: textoFotoNuevaDeEnsayo(plato, archivo) },
    { text: `Imagen «${archivo}» · ${plato}:` },
    { inlineData: { mimeType: 'image/jpeg', data: bytes.toString('base64') } },
  ];
  const instrucciones = instruccionesBase(guia);
  const respuesta = await cliente.generarJson(instrucciones, partes, Respuesta);
  await mkdir(dirname(resolve(salida)), { recursive: true });
  await writeFile(
    resolve(salida),
    `${JSON.stringify(
      {
        fecha: new Date().toISOString(),
        modelos,
        foto: foto.replace(`${RAIZ}/`, ''),
        plato,
        biblioteca: { ejemplos: guia.ejemplos.length, valoraciones: guia.valoraciones.length, referencias: guia.referencias.length },
        respuesta,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Prompt del director (${respuesta.prompt.length} caracteres) → ${salida}`);
  console.log(respuesta.prompt);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
