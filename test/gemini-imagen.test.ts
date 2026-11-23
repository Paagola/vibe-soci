import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { construirPeticion, costeRealUsd, estimarUsd, leerRespuesta, inicioDelMes, RESERVA_RAZONAMIENTO_TOKENS, sumarGasto, Uso } from '../src/adaptadores/gemini/imagenGemini.js';

const ref = (etiqueta: string) => ({ etiqueta, bytes: Buffer.from(etiqueta), mime: 'image/jpeg' });

describe('Nano Banana Pro (imagenGemini)', () => {
  it('cada referencia va precedida de su etiqueta, en orden, y el brief al final', () => {
    const peticion = construirPeticion('BRIEF', [ref('@image1'), ref('@image2')], '3:4', '2K');
    const partes = peticion.contents[0]?.parts as Array<Record<string, unknown>>;
    assert.deepEqual(partes.map((p) => (p.text as string | undefined) ?? 'IMG'), ['@image1:', 'IMG', '@image2:', 'IMG', 'BRIEF']);
    assert.deepEqual(peticion.generationConfig, { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '2K' } });
  });

  it('la estimación va por arriba: entrada + reserva de razonamiento + una imagen 2K', () => {
    const usd = estimarUsd('gemini-3-pro-image', 3000, '2K');
    assert.equal(usd, (3000 * 2 + RESERVA_RAZONAMIENTO_TOKENS * 12 + 1120 * 120) / 1e6);
    assert.ok(usd > 0.134 && usd < 0.17);
  });

  it('el coste real separa los tokens de imagen de los de texto y razonamiento', () => {
    const uso = Uso.parse({ promptTokenCount: 3000, candidatesTokenCount: 1150, thoughtsTokenCount: 400, candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }] });
    assert.equal(costeRealUsd('gemini-3-pro-image', uso), (3000 * 2 + (30 + 400) * 12 + 1120 * 120) / 1e6);
  });

  it('el registro de gasto: el tier gratuito y los rechazos cuentan 0; lo enviado sin respuesta cuenta el estimado', () => {
    const linea = (o: Record<string, unknown>) => JSON.stringify({ fecha: 'f', receta: 'r', modelo: 'gemini-3-pro-image', estimadoUsd: 0.16, ...o });
    assert.equal(sumarGasto([linea({ activo: 'a', tier: 'GRATUITO', estado: 'ENVIADO' }), linea({ activo: 'a', tier: 'GRATUITO', estado: 'COMPLETADO', realUsd: 0.15 })]), 0);
    assert.equal(sumarGasto([linea({ activo: 'b', estado: 'ENVIADO' }), linea({ activo: 'b', estado: 'FALLIDO' })]), 0);
    assert.equal(sumarGasto([linea({ activo: 'c', estado: 'ENVIADO' })]), 0.16);
    assert.equal(sumarGasto([linea({ activo: 'd', estado: 'ENVIADO' }), linea({ activo: 'd', estado: 'COMPLETADO', realUsd: 0.141 }), '']), 0.141);
  });

  it('el tope es mensual: solo cuenta lo enviado desde el día 1 del mes en curso (por la fecha del envío, no de la respuesta)', () => {
    const linea = (o: Record<string, unknown>) => JSON.stringify({ receta: 'r', modelo: 'gemini-3-pro-image', estimadoUsd: 0.16, ...o });
    const lineas = [
      linea({ activo: 'octubre', fecha: '2026-10-30T10:00:00', estado: 'ENVIADO' }),
      linea({ activo: 'octubre', fecha: '2026-10-30T10:01:00', estado: 'COMPLETADO', realUsd: 0.15 }),
      // Enviado el 31 a última hora y contestado ya en noviembre: es de octubre.
      linea({ activo: 'frontera', fecha: '2026-10-31T23:59:30', estado: 'ENVIADO' }),
      linea({ activo: 'frontera', fecha: '2026-11-01T00:00:20', estado: 'COMPLETADO', realUsd: 0.14 }),
      linea({ activo: 'noviembre', fecha: '2026-11-05T09:00:00', estado: 'ENVIADO' }),
      linea({ activo: 'noviembre', fecha: '2026-11-05T09:01:00', estado: 'COMPLETADO', realUsd: 0.13 }),
    ];
    assert.equal(Math.round(sumarGasto(lineas) * 100) / 100, 0.42, 'sin «desde», todo');
    assert.equal(sumarGasto(lineas, inicioDelMes(new Date(2026, 10, 22))), 0.13, 'en noviembre, solo noviembre');
    assert.equal(sumarGasto(lineas, inicioDelMes(new Date(2026, 11, 1))), 0, 'el 1 de diciembre empieza de cero');
    assert.equal(inicioDelMes(new Date(2026, 10, 22, 15)).getTime(), new Date(2026, 10, 1).getTime());
  });

  it('sin tarifa comprobada no hay estimación (no se puede vigilar el tope)', () => {
    assert.throws(() => estimarUsd('modelo-sin-tarifa', 10, '2K'), /tarifa/);
  });

  it('lee la imagen final e ignora las de razonamiento; sin imagen devuelve el motivo', () => {
    const png = Buffer.from('final');
    const ok = leerRespuesta({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('borrador').toString('base64') }, thought: true }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }],
      usageMetadata: { promptTokenCount: 1 },
    });
    assert.ok(ok.ok && ok.bytes.equals(png));
    const no = leerRespuesta({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [{ text: 'no puedo' }] } }] });
    assert.ok(!no.ok && /IMAGE_SAFETY/.test(no.motivo) && no.texto[0] === 'no puedo');
  });
});

describe('Briefs de la prueba del método Society', () => {
  const carpeta = new URL('../proyectos/prueba-metodo-society/', import.meta.url);
  const leer = async (ruta: string) => readFile(new URL(ruta, carpeta), 'utf8');

  it('el JSON de S1 tiene los campos del Decoded Brief y de hostelería, y cada referencia con rol', async () => {
    const brief = JSON.parse(await leer('prompts/s1.json.txt')) as Record<string, unknown>;
    for (const campo of ['reference_roles', 'subject_identity', 'realism', 'environment', 'lighting', 'colour_allocation', 'camera', 'composition', 'scale', 'texture', 'imperfections', 'negatives']) {
      assert.ok(campo in brief, `falta ${campo}`);
    }
    for (const token of ['@image1', '@image2', '@image3']) assert.match(String(brief.reference_roles), new RegExp(`${token} [^.]*(governs|match)`));
    assert.match(String(brief.scale), /Exactly two prawns/);
    assert.doesNotMatch(JSON.stringify(brief), /#[0-9A-Fa-f]{6}|8k|hyperrealistic|masterpiece/, 'ni códigos hex ni palabras de render');
  });

  it('S2 es S1 sin la referencia de encuadre', async () => {
    const s1 = JSON.parse(await leer('prompts/s1.json.txt')) as Record<string, unknown>;
    const s2 = JSON.parse(await leer('prompts/s2.json.txt')) as Record<string, unknown>;
    assert.doesNotMatch(JSON.stringify(s2), /@image3/);
    assert.deepEqual(Object.keys(s2), Object.keys(s1));
    assert.deepEqual(s2.lighting, s1.lighting);
  });

  it('el párrafo NL termina con la coda fotográfica', async () => {
    assert.match((await leer('prompts/s1.nl.txt')).trim(), /Photographic realism, no text\.$/);
  });

  it('las recetas apuntan a referencias que existen, en el orden de las etiquetas', async () => {
    for (const r of ['s1', 's2', 's3']) {
      const receta = JSON.parse(await leer(`recetas/${r}.json`)) as { referencias: Array<{ etiqueta: string; archivo?: string }> };
      receta.referencias.forEach((ref, i) => assert.ok(ref.etiqueta.startsWith(`@image${i + 1}`)));
      for (const ref of receta.referencias.filter((x) => x.archivo)) await readFile(new URL(ref.archivo as string, new URL('../', import.meta.url)));
    }
  });
});

describe('Generación manual en la app de Gemini (appManual)', async () => {
  const { activoDeImportacion, nombresDelPaquete, promptParaApp, VIA_MANUAL, VIA_MCP_HIGGSFIELD } = await import('../src/adaptadores/gemini/appManual.js');
  const { RecetaGemini } = await import('../src/adaptadores/gemini/recetaGemini.js');
  const receta = RecetaGemini.parse(JSON.parse(await readFile(new URL('../proyectos/prueba-metodo-society/recetas/s1.json', import.meta.url), 'utf8')));

  it('el prompt de la app dice qué adjunto es cada @imageN y lleva el brief entero', () => {
    const p = promptParaApp('BRIEF {"a":1}', receta.referencias.map((r) => r.etiqueta), '3:4');
    assert.match(p, /Attached image 1 = @image1 \(real photograph of the dish\)/);
    assert.match(p, /Attached image 3 = @image3/);
    assert.match(p, /aspect ratio 3:4/);
    assert.ok(p.endsWith('BRIEF {"a":1}'));
  });

  it('las imágenes del paquete van numeradas en el orden de adjunto y cada una tiene su rol', () => {
    assert.deepEqual(nombresDelPaquete(receta), ['1-foto-real-del-plato.jpg', '2-ficha-de-texturas.jpg', '3-referencia-de-encuadre-post-11.jpg']);
    for (const r of receta.referencias) assert.ok(r.rol?.gobierna && r.rol.noSeCopia, `${r.etiqueta} sin rol`);
  });

  it('la imagen importada es GENERADO, solo para pruebas, coste de API 0 y con toda la procedencia', () => {
    const sha = 'a'.repeat(64);
    const activo = activoDeImportacion({
      receta, intento: 2, promptArchivo: 'p.txt', prompt: 'P', referencias: [{ origen: 'etx-real-gamba', sha256: 'b'.repeat(64) }],
      archivo: 'original.png', ruta: 'datos/x/original.png', ancho: 1536, alto: 2048, sha256: sha,
      origen: { via: VIA_MANUAL, modeloDeclarado: 'Nano Banana Pro' }, generadoEn: '2026-11-08', importadoEn: '2026-11-08T10:00:00Z', notas: ['con marca de agua'],
    });
    assert.equal(activo.id, `${receta.id}-app-2`);
    assert.equal(activo.tipo, 'GENERADO');
    assert.equal(activo.uso, 'SOLO_PRUEBA_COMPOSICION');
    assert.equal(activo.procedencia.generacion?.costeEstimadoUsd, 0);
    assert.equal(activo.procedencia.generacion?.parametros.via, VIA_MANUAL);
    assert.deepEqual(activo.procedencia.generacion?.referencias, [{ activo: 'etx-real-gamba', sha256: 'b'.repeat(64) }]);
    assert.ok(activo.alteraciones.some((a) => /ESTIMADAS/.test(a)), 'las medidas estimadas viajan con la imagen');
    assert.match(activo.descripcion, /con marca de agua/);
  });

  it('por el MCP de Higgsfield: guarda el modelo pedido y el servido, el trabajo y los créditos', () => {
    const activo = activoDeImportacion({
      receta, intento: 1, promptArchivo: 'prompts/mcp/s1.txt', prompt: '{}', referencias: [],
      archivo: 'original.png', ruta: 'datos/x/original.png', ancho: 1792, alto: 2400, sha256: 'c'.repeat(64),
      origen: { via: VIA_MCP_HIGGSFIELD, modeloPedido: 'nano_banana_pro', modeloServido: 'nano_banana_2', trabajo: 'job-1', creditos: 2, usdPorCredito: 0.06256 },
      generadoEn: '2026-11-07', importadoEn: '2026-11-07T17:00:00Z', notas: [],
    });
    assert.equal(activo.id, `${receta.id}-mcp-1`);
    assert.equal(activo.procedencia.generacion?.requestId, 'job-1');
    assert.match(activo.procedencia.generacion?.modelo ?? '', /nano_banana_2 \(pedido: nano_banana_pro\)/);
    assert.equal(activo.procedencia.generacion?.costeEstimadoUsd, 0.125);
    assert.match(activo.procedencia.generacion?.tarifa ?? '', /2 créditos/);
  });
});

describe('Ensayo del director: prompt de foto nueva', async () => {
  const { textoFotoNuevaDeEnsayo } = await import('../src/adaptadores/gemini/instrucciones.js');
  it('pide solo la foto, sin texto, y no añade reglas del estudio (el ensayo mide la biblioteca)', () => {
    const t = textoFotoNuevaDeEnsayo('salmón glaseado', 'fotos/01-plato.jpg');
    assert.match(t, /FOTO NUEVA/);
    assert.match(t, /sin ningún texto/);
    assert.match(t, /«salmón glaseado»/);
    assert.doesNotMatch(t, /CAMERA|list of elements|low-key|degrees/i);
  });
});
