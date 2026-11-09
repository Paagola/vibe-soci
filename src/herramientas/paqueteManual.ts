/**
 * Paquete para generar a mano en la app de Gemini lo que la API no admite (p. ej. Nano Banana Pro sin facturación).
 * Por cada receta, una carpeta con:
 *   - las referencias numeradas en el orden de adjunto (las mismas que iría a la API: misma huella);
 *   - prompt.txt, listo para pegar (el brief con una cabecera que dice qué adjunto es cada @imageN);
 *   - LEEME.md con el rol de cada imagen (qué gobierna y qué no se copia);
 *   - manifiesto.json, que usa importarManual.ts para registrar la procedencia.
 *
 * Uso: tsx src/herramientas/paqueteManual.ts <receta.json>… [--salida proyectos/…/manual]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RAIZ, leerConfig } from '../config.js';
import { escribirJson } from '../adaptadores/ficheros/json.js';
import { nombresDelPaquete, promptParaApp } from '../adaptadores/gemini/appManual.js';
import { leerReceta, prepararReferencia } from '../adaptadores/gemini/recetaGemini.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { salida: { type: 'string', default: 'proyectos/prueba-metodo-society/manual' } } });

async function principal(): Promise<void> {
  if (positionals.length === 0) throw new Error('Uso: paqueteManual.ts <receta.json>… [--salida carpeta]');
  const config = leerConfig();
  for (const rutaReceta of positionals) {
    const receta = await leerReceta(resolve(rutaReceta));
    const nombre = basename(rutaReceta, '.json').toUpperCase();
    const carpeta = resolve(RAIZ, values.salida as string, nombre);
    await mkdir(carpeta, { recursive: true });

    const referencias = await Promise.all(receta.referencias.map((r) => prepararReferencia(RAIZ, config.carpetaDatos, receta.local, r)));
    const archivos = nombresDelPaquete(receta);
    for (const [i, referencia] of referencias.entries()) await writeFile(join(carpeta, archivos[i] as string), referencia.bytes);

    const brief = await readFile(resolve(RAIZ, receta.promptArchivo), 'utf8');
    const prompt = promptParaApp(brief, receta.referencias.map((r) => r.etiqueta), receta.parametros.aspectRatio);
    await writeFile(join(carpeta, 'prompt.txt'), `${prompt}\n`);

    await escribirJson(join(carpeta, 'manifiesto.json'), {
      receta: relative(RAIZ, resolve(rutaReceta)),
      prompt: { archivo: relative(RAIZ, join(carpeta, 'prompt.txt')), sha256: createHash('sha256').update(`${prompt}\n`).digest('hex') },
      referencias: referencias.map((r, i) => ({ orden: i + 1, archivo: archivos[i], origen: r.origen, sha256: r.sha256 })),
    });

    const filas = receta.referencias
      .map((r, i) => `| ${i + 1} | \`${archivos[i]}\` | ${r.rol?.gobierna ?? r.etiqueta} | ${r.rol?.noSeCopia ?? '—'} |`)
      .join('\n');
    await writeFile(
      join(carpeta, 'LEEME.md'),
      `# ${nombre} · ${receta.descripcion}

1. Abre un **chat nuevo** en la app de Gemini y elige el modelo de imagen **Nano Banana Pro** (si la app no te deja elegirlo, apunta cuál usó).
2. Adjunta las ${archivos.length} imágenes **en este orden y en un solo mensaje**.
3. Pega el contenido de \`prompt.txt\` y envía.
4. Descarga la imagen sin retocarla. Si la app genera varias o la repites, guárdalas **todas** (también las que no te gusten).
5. Súbelas con este nombre: \`${nombre}-intento-1.png\`, \`${nombre}-intento-2.png\`… y dime el modelo que mostraba la app y el día.

| Orden | Imagen | Qué gobierna | Qué no se copia |
|---|---|---|---|
${filas}

Medidas del prompt (plato de unos 26 cm, gambas de unos 18 cm): **estimadas** a partir de la foto; no las ha confirmado el restaurante.
`,
    );
    console.log(`${nombre}: ${archivos.length} imágenes + prompt.txt + LEEME.md → ${relative(RAIZ, carpeta)}`);
  }
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
