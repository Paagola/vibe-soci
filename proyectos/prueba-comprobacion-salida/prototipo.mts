/**
 * PROTOTIPO DESECHABLE de la comprobación de salida (09/11/2026). No es código del producto: no está en src/ ni se
 * ejecuta en ningún flujo. Sirve para medir, con los fallos ya conocidos, cuánto detectaría el diseño de ESTADO.md §8.
 *
 * Dos preguntas por imagen a Gemini (visión, tier gratuito, 0 USD):
 *   1. checklist: foto real + generada + lista confirmada → elemento a elemento, anatomía, añadidos y texto nuevo;
 *   2. punto de vista: las dos fotos lado a lado → ¿es la misma toma? (sin estimar grados).
 * El veredicto lo decide el código con las respuestas, no el modelo.
 *
 * Uso: npx tsx --env-file=.env proyectos/prueba-comprobacion-salida/prototipo.mts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { ClienteGemini } from '../../src/adaptadores/gemini/ClienteGemini.js';
import { RAIZ, leerConfig } from '../../src/config.js';

/** La imagen de un activo, con el nombre que dice su activo.json. */
const A = (local: string, id: string, _archivo?: string) => {
  const carpeta = join(RAIZ, 'datos', 'locales', local, 'activos', id);
  return join(carpeta, (JSON.parse(readFileSync(join(carpeta, 'activo.json'), 'utf8')) as { archivo: string }).archivo);
};
const lista = (archivo: string) => {
  const j = JSON.parse(readFileSync(join(RAIZ, 'proyectos', archivo), 'utf8'));
  return `${j.huecos.elementos}. ${j.huecos.recuento}`;
};

const REAL = {
  gamba: A('asador-etxebarri', 'etx-real-gamba'),
  gambaDegradada: A('asador-etxebarri', 'etx-real-gamba-degradada'),
  dak: A('dak-burger', 'dak-real-manhattan', 'original.jpg'),
  meson: A('meson-de-cervantes', 'meson-real-salmon'),
  cafe: A('cafe-albor', 'cafe-real-cafes', 'original.webp'),
  merluza: A('candamil', 'candamil-web-merluza'),
  habas: A('meson-lo-gueno', 'lo-gueno-web-habas'),
};
const LISTA = {
  gamba: lista('posts-f1-6/foto/etxebarri-2.final.json'),
  dak: lista('posts-f1-6/foto/dak.final.json'),
  meson: lista('posts-f1-6/foto/meson.final.json'),
  cafe: lista('posts-f1-6/foto/cafe.final.json'),
  merluza: lista('posts-tres-locales/foto/candamil.final.json'),
  habas: lista('posts-tres-locales/foto/meson-lo-gueno.final.json'),
};

type Plato = keyof typeof LISTA;
/** Veredicto humano ya dado (informes de F1.6): ELEMENTOS = CONSERVA o FALLA; TOMA = MISMA o DISTINTA. */
const CASOS: Array<{ id: string; plato: Plato; real: string; gen: string; elementos?: 'CONSERVA' | 'FALLA'; fallo?: string; toma?: 'MISMA' | 'DISTINTA' }> = [
  // Fallos de elementos conocidos (los 4 pedidos y S3)
  { id: 'V3D', plato: 'gamba', real: REAL.gambaDegradada, gen: A('asador-etxebarri', 'etx-soc-v3d-otro-angulo-degradada-mcp-1'), elementos: 'FALLA', fallo: 'tres colas (un cuerpo de más)' },
  { id: 'V1', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-soc-v1-tu-prompt-mcp-1'), elementos: 'FALLA', fallo: 'tercera cabeza a la derecha', toma: 'DISTINTA' },
  { id: 'DAK-2', plato: 'dak', real: REAL.dak, gen: A('dak-burger', 'dak-post-f2-foto-mcp-2'), elementos: 'FALLA', fallo: 'texto de periódico inventado en el papel', toma: 'MISMA' },
  { id: 'CAFE-1', plato: 'cafe', real: REAL.cafe, gen: A('cafe-albor', 'cafe-post-f10-foto-mcp-1'), elementos: 'FALLA', fallo: 'posavasos añadido' },
  { id: 'S3', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-soc-s3-nbp-nl-3refs-mcp-1'), elementos: 'FALLA', fallo: 'los cuerpos se funden; a la delantera no se le ve la cola' },
  // Imágenes que conservan los elementos (para medir falsas alarmas)
  { id: 'V3', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-soc-v3-otro-angulo-mcp-1'), elementos: 'CONSERVA', toma: 'DISTINTA' },
  { id: 'S1', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-soc-s1-nbp-json-3refs-mcp-1'), elementos: 'CONSERVA', toma: 'DISTINTA' },
  { id: 'ETX-2', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-post-f7-foto-mcp-2'), elementos: 'CONSERVA', toma: 'DISTINTA' },
  { id: 'CAFE-2', plato: 'cafe', real: REAL.cafe, gen: A('cafe-albor', 'cafe-post-f10-foto-mcp-2'), elementos: 'CONSERVA', toma: 'DISTINTA' },
  { id: 'DAK-1', plato: 'dak', real: REAL.dak, gen: A('dak-burger', 'dak-post-f2-foto-mcp-1'), elementos: 'CONSERVA', toma: 'MISMA' },
  { id: 'DAK-3', plato: 'dak', real: REAL.dak, gen: A('dak-burger', 'dak-post-f2-foto-mcp-3'), elementos: 'CONSERVA' },
  { id: 'MESON-1', plato: 'meson', real: REAL.meson, gen: A('meson-de-cervantes', 'meson-post-f4-foto-mcp-1'), elementos: 'CONSERVA', toma: 'MISMA' },
  { id: 'MESON-2', plato: 'meson', real: REAL.meson, gen: A('meson-de-cervantes', 'meson-post-f4-foto-mcp-2'), elementos: 'CONSERVA', toma: 'MISMA' },
  { id: 'MESON-3', plato: 'meson', real: REAL.meson, gen: A('meson-de-cervantes', 'meson-post-f4-foto-mcp-3'), elementos: 'CONSERVA', toma: 'DISTINTA' },
  { id: 'MERLUZA', plato: 'merluza', real: REAL.merluza, gen: A('candamil', 'candamil-post-foto-mcp-1'), elementos: 'CONSERVA', toma: 'DISTINTA' },
  { id: 'HABAS', plato: 'habas', real: REAL.habas, gen: A('meson-lo-gueno', 'meson-lo-gueno-post-foto-mcp-1'), elementos: 'CONSERVA', toma: 'DISTINTA' },
  // Solo punto de vista (benchmark y V2: la toma volvió a la de la foto subida, o no)
  { id: 'V2', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-soc-v2-tu-prompt-mejorado-mcp-1'), toma: 'MISMA' },
  { id: 'ETX-1', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-post-f7-foto-mcp-1'), toma: 'MISMA' },
  { id: 'b2-grok', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-bench-b2-a-f1-grok'), toma: 'MISMA' },
  { id: 'b6-grok', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-bench-b6-b-f4-grok'), toma: 'MISMA' },
  { id: 'b1-ms', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-bench-b1-a-f1-ms2'), toma: 'DISTINTA' },
  { id: 'b5-ms', plato: 'gamba', real: REAL.gamba, gen: A('asador-etxebarri', 'etx-bench-b5-b-f1-ms2'), toma: 'DISTINTA' },
];

const Checklist = z.object({
  elementos: z.array(z.object({ nombre: z.string(), esperado: z.number().nullable(), visto: z.number().nullable(), presente: z.boolean(), nota: z.string() })),
  anatomia: z.array(z.string()),
  anadidos: z.array(z.string()),
  textoNuevo: z.array(z.string()),
  seguro: z.boolean(),
});
const PuntoDeVista = z.object({
  alturaReal: z.string(),
  alturaNueva: z.string(),
  mismoLado: z.boolean(),
  mismaDistancia: z.boolean(),
  mismoPuntoDeVista: z.boolean(),
  explicacion: z.string(),
});

const INSTR_CHECK = `Eres el control de calidad de un estudio de fotografía gastronómica. Comparas la FOTO REAL de un plato (imagen 1) con una FOTO NUEVA generada por IA (imagen 2).
La foto nueva puede cambiar libremente la cámara, la luz, el fondo, la superficie, el encuadre y la colocación. NO puede cambiar los elementos del plato: qué son, cuántos hay, su anatomía ni la vajilla, ni añadir nada.
Mira la imagen 2 con mucho detalle, zona por zona, como si la ampliaras. Cuenta de verdad: cabezas, colas, cuerpos, piezas.
Respondes solo con JSON.`;

const textoCheck = (lista: string) => `Lista confirmada de elementos de la foto real (en inglés, tal como se pidió al generador):
«${lista}»

Para la imagen 2:
- "elementos": cada elemento de la lista con "esperado" (el número de la lista o null si no se cuenta), "visto" (lo que cuentas en la imagen 2, o null), "presente" y una "nota" breve.
- "anatomia": problemas de anatomía o forma (una cabeza o una cola de más o de menos, cuerpos fundidos, piezas cortadas que no deberían). Vacío si no hay.
- "anadidos": objetos, alimentos o vajilla de la imagen 2 que NO están en la lista (un posavasos, un plato de más, hierbas, un limón…). La superficie y el fondo no cuentan. Vacío si no hay.
- "textoNuevo": letras, palabras o logotipos visibles en la imagen 2 que NO están en la imagen 1. Vacío si no hay.
- "seguro": false si alguna respuesta es dudosa.
JSON: {"elementos":[{"nombre":"…","esperado":2,"visto":2,"presente":true,"nota":"…"}],"anatomia":[],"anadidos":[],"textoNuevo":[],"seguro":true}`;

const INSTR_TOMA = `Eres un fotógrafo profesional. Te enseñan dos fotos del mismo plato: imagen 1 (la que hizo el restaurante) e imagen 2 (una foto nueva).
La pregunta es si la imagen 2 es OTRA TOMA o la MISMA TOMA con otra luz: si la cámara está en el mismo sitio respecto al plato. No estimes grados: compara.
Respondes solo con JSON.`;
const TEXTO_TOMA = `Compara las dos fotos:
- "alturaReal" y "alturaNueva": desde dónde mira la cámara en cada una, en palabras (cenital, alta desde arriba, ¾, baja, a ras de mesa).
- "mismoLado": ¿se ve el plato desde el mismo lado?
- "mismaDistancia": ¿el plato ocupa más o menos lo mismo del encuadre?
- "mismoPuntoDeVista": true si un fotógrafo diría que la cámara está prácticamente en el mismo sitio (misma altura aproximada y mismo lado), aunque cambien la luz, el fondo o el encuadre.
- "explicacion": una frase.
JSON: {"alturaReal":"…","alturaNueva":"…","mismoLado":true,"mismaDistancia":true,"mismoPuntoDeVista":true,"explicacion":"…"}`;

const imagen = async (ruta: string) => ({
  inlineData: { mimeType: 'image/jpeg', data: (await sharp(ruta).rotate().flatten({ background: '#fff' }).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()).toString('base64') },
});
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** La regla del código: descarta si falta algo, cambia un recuento, hay anatomía rota, algo añadido o texto nuevo. */
function veredicto(c: z.infer<typeof Checklist>): { v: 'CONSERVA' | 'DESCARTA' | 'REVISAR'; motivos: string[] } {
  const motivos = [
    ...c.elementos.filter((e) => !e.presente).map((e) => `falta ${e.nombre}`),
    ...c.elementos.filter((e) => e.esperado !== null && e.visto !== null && e.visto !== e.esperado).map((e) => `${e.nombre}: ${e.visto} en vez de ${e.esperado}`),
    ...c.anatomia.map((a) => `anatomía: ${a}`),
    ...c.anadidos.map((a) => `añadido: ${a}`),
    ...c.textoNuevo.map((t) => `texto nuevo: ${t}`),
  ];
  if (motivos.length) return { v: 'DESCARTA', motivos };
  return { v: c.seguro ? 'CONSERVA' : 'REVISAR', motivos: c.seguro ? [] : ['el modelo no está seguro'] };
}

const config = leerConfig();
if (!config.geminiApiKey) throw new Error('Falta GEMINI_API_KEY');
const cliente = new ClienteGemini(config.geminiApiKey, [config.geminiModelo, ...(config.geminiModeloRespaldo ? [config.geminiModeloRespaldo] : [])], { avisar: (m) => console.error('  aviso:', m) });

/** Gemini gratis se satura (503): hasta 5 intentos con espera creciente. */
async function conReintentos<T>(f: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await f();
    } catch (e) {
      if (i >= 4 || !(e as { reintentable?: boolean }).reintentable) throw e;
      console.error(`  503 o similar; espero ${30 * (i + 1)} s y repito`);
      await dormir(30000 * (i + 1));
    }
  }
}

const SALIDA = join(RAIZ, 'proyectos', 'prueba-comprobacion-salida', 'resultados.json');
const previos: Array<{ id: string }> = existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, 'utf8')).resultados : [];
const resultados: unknown[] = [...previos];
const guardar = () => writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), modelos: [config.geminiModelo, config.geminiModeloRespaldo], resultados }, null, 2) + '\n');
for (const caso of CASOS) {
  if (previos.some((p) => p.id === caso.id)) continue;
  const real = await imagen(caso.real);
  const gen = await imagen(caso.gen);
  const fila: Record<string, unknown> = { id: caso.id, humano: { elementos: caso.elementos, fallo: caso.fallo, toma: caso.toma } };
  if (caso.elementos) {
    const c = await conReintentos(() => cliente.generarJson(INSTR_CHECK, [{ text: 'Imagen 1 (foto real):' }, real, { text: 'Imagen 2 (foto nueva):' }, gen, { text: textoCheck(LISTA[caso.plato]) }], Checklist));
    fila.checklist = c;
    fila.veredicto = veredicto(c);
    await dormir(9000);
  }
  if (caso.toma || caso.id === 'DAK-3') {
    const t = await conReintentos(() => cliente.generarJson(INSTR_TOMA, [{ text: 'Imagen 1:' }, real, { text: 'Imagen 2:' }, gen, { text: TEXTO_TOMA }], PuntoDeVista));
    fila.toma = t;
    await dormir(9000);
  }
  resultados.push(fila);
  guardar();
  const v = fila.veredicto as ReturnType<typeof veredicto> | undefined;
  const t = fila.toma as z.infer<typeof PuntoDeVista> | undefined;
  console.log(`${caso.id.padEnd(8)} elementos: humano ${caso.elementos ?? '—'} → ${v?.v ?? '—'} ${v?.motivos.join('; ') ?? ''} | toma: humano ${caso.toma ?? '—'} → ${t ? (t.mismoPuntoDeVista ? 'MISMA' : 'DISTINTA') : '—'}`);
}
guardar();
