import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { ClienteGemini, type ParteGemini } from '../src/adaptadores/gemini/ClienteGemini.js';
import { ProductorEditorialGemini } from '../src/adaptadores/gemini/ProductorEditorialGemini.js';
import {
  esquemaDelPlanEditorial,
  ProductorEditorialSimulado,
  textoConfirmado,
  type EncargoEditorial,
  type PlanEditorial,
} from '../src/aplicacion/productor/editorial.js';
import { leerConfig, MODELO_PRODUCTOR_GEMINI } from '../src/config.js';
import { confirmarInventario, crearBrief } from '../src/dominio/brief.js';
import { ErrorDeServicio, ErrorDeUsuario } from '../src/dominio/errores.js';

const AHORA = '2026-11-17T12:00:00Z';
const ELEMENTOS = [
  { nombre: 'gamba', estado: 'a la brasa', recuento: 1 },
  { nombre: 'pan', estado: 'tostado', recuento: 2 },
];

const briefDe = (formato: 'post' | 'carrusel') => crearBrief({
  proyecto: 'editorial',
  local: 'prueba',
  formato,
  nota: 'Gamba a la brasa y pan tostado',
  usoFotoReal: 'PUBLICABLE',
  marca: { nombre: 'Local de prueba', ciudad: 'Madrid', descripcion: '', tonos: [], instagram: 'el.local' },
  elementos: ELEMENTOS,
  tomas: [],
}, AHORA);

const encargoDe = async (formato: 'post' | 'carrusel'): Promise<EncargoEditorial> => ({
  brief: briefDe(formato),
  foto: {
    bytes: await sharp({ create: { width: 30, height: 40, channels: 3, background: '#a43f28' } }).png().toBuffer(),
    mimeType: 'image/png',
  },
  oficio: 'Referencia de oficio preparada para la prueba',
  fichaReferencia: 'Ficha local con el encuadre y la luz',
});

const PLAN_POST: PlanEditorial = {
  esquema: 'post/editorial@1',
  hiloVisual: 'LUZ',
  diapositivas: [{ n: 1, papel: 'portada', tratamiento: 'FOTO_LIMPIA' }],
};

const PLAN_CARRUSEL: PlanEditorial = {
  esquema: 'post/editorial@1',
  hiloVisual: 'ENCUADRE',
  diapositivas: [
    { n: 1, papel: 'portada', tratamiento: 'FOTO_TEXTO_AL_BORDE', borde: 'INFERIOR', gesto: 'ANUNCIO', texto: { fuente: 'MARCA' } },
    { n: 2, papel: 'detalle', tratamiento: 'RECORTE_DETALLE', enfoque: { x: 0.7, y: 0.4 }, zoom: 2.2, elemento: 0 },
    { n: 3, papel: 'detalle', tratamiento: 'FOTO_LIMPIA' },
    { n: 4, papel: 'cierre', tratamiento: 'CIERRE_TEXTO', textos: [{ fuente: 'MARCA' }, { fuente: 'INSTAGRAM' }] },
  ],
};

interface Peticion {
  url: string;
  cuerpo: { systemInstruction: { parts: Array<{ text: string }> }; contents: Array<{ role: string; parts: ParteGemini[] }> };
}

function geminiFalso(...respuestas: unknown[]) {
  const peticiones: Peticion[] = [];
  const fetchFalso: typeof fetch = async (url, init) => {
    peticiones.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) as Peticion['cuerpo'] });
    const respuesta = respuestas.shift();
    assert.ok(respuesta, 'petición extra a Gemini');
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(respuesta) }] } }] });
  };
  const cliente = new ClienteGemini('prueba', [MODELO_PRODUCTOR_GEMINI], { fetch: fetchFalso, dormir: async () => {} });
  return { productor: new ProductorEditorialGemini(cliente), peticiones };
}

describe('Productor editorial', () => {
  it('envía al modelo los bytes fuente y el brief con las fichas de oficio', async () => {
    const encargo = await encargoDe('carrusel');
    const { productor, peticiones } = geminiFalso(PLAN_CARRUSEL);
    assert.deepEqual(await productor.proponer(encargo), PLAN_CARRUSEL);
    assert.equal(productor.modelo, MODELO_PRODUCTOR_GEMINI);
    assert.equal(peticiones.length, 1);
    const peticion = peticiones[0]!;
    assert.match(peticion.url, /gemini-4-hydrogen:generateContent$/);
    assert.match(peticion.cuerpo.systemInstruction.parts[0]!.text, /Andaaz[\s\S]*Camarónshine[\s\S]*Gatehouse/);
    const [datos, foto] = peticion.cuerpo.contents[0]!.parts;
    assert.ok(datos && 'text' in datos);
    assert.match(datos.text, /PROPUESTO/);
    assert.match(datos.text, /Gamba a la brasa y pan tostado/);
    assert.match(datos.text, /Referencia de oficio preparada para la prueba/);
    assert.match(datos.text, /Ficha local con el encuadre y la luz/);
    assert.ok(foto && 'inlineData' in foto);
    assert.equal(foto.inlineData.mimeType, 'image/png');
    assert.deepEqual(Buffer.from(foto.inlineData.data, 'base64'), encargo.foto.bytes);
  });

  it('pide corregir una referencia fuera del brief una sola vez', async () => {
    const invalido = {
      ...PLAN_POST,
      diapositivas: [{
        n: 1,
        papel: 'portada',
        tratamiento: 'FOTO_TEXTO_AL_BORDE',
        borde: 'SUPERIOR',
        gesto: 'CONTENIDO',
        texto: { fuente: 'ELEMENTO', indice: 9 },
      }],
    };
    const { productor, peticiones } = geminiFalso(invalido, PLAN_POST);
    assert.deepEqual(await productor.proponer(await encargoDe('post')), PLAN_POST);
    assert.equal(peticiones.length, 2);
    const reparacion = peticiones[1]!.cuerpo.contents.at(-1)!.parts[0];
    assert.ok(reparacion && 'text' in reparacion);
    assert.match(reparacion.text, /diapositivas\.0\.texto/);

    const fallido = geminiFalso(invalido, invalido);
    await assert.rejects(fallido.productor.proponer(await encargoDe('post')), ErrorDeServicio);
    assert.equal(fallido.peticiones.length, 2);
  });

  it('rechaza copy, cambios de orden, recortes inválidos y cierres sin respaldo', () => {
    const brief = briefDe('carrusel');
    brief.marca.instagram = undefined;
    const esquema = esquemaDelPlanEditorial(brief);
    const [portada, recorte, limpio, cierre] = PLAN_CARRUSEL.diapositivas;
    const variaciones = [
      [portada, recorte, cierre],
      [portada, limpio, recorte, cierre],
      [{ ...portada, copy: 'El mejor plato de Madrid' }, recorte, limpio, cierre],
      [portada, { ...recorte, enfoque: { x: -0.1, y: 0.4 } }, limpio, cierre],
      [portada, { ...recorte, zoom: 6 }, limpio, cierre],
      [portada, { ...recorte, elemento: 1 }, limpio, cierre],
      [portada, recorte, limpio, { ...cierre, textos: [] }],
      [portada, recorte, limpio, { ...cierre, textos: [{ fuente: 'MARCA' }, { fuente: 'MARCA' }] }],
      [portada, recorte, limpio, cierre],
    ];
    for (const diapositivas of variaciones) {
      assert.equal(esquema.safeParse({ ...PLAN_CARRUSEL, diapositivas }).success, false, JSON.stringify(diapositivas));
    }
  });

  it('no contacta Gemini si el contenido de la foto no coincide con su formato', async () => {
    const encargo = await encargoDe('post');
    encargo.foto.mimeType = 'image/jpeg';
    const { productor, peticiones } = geminiFalso();
    await assert.rejects(productor.proponer(encargo), ErrorDeUsuario);
    assert.equal(peticiones.length, 0);
  });

  it('simula el mismo plan y solo resuelve los elementos cuando quedan confirmados', async () => {
    const productor = new ProductorEditorialSimulado();
    const encargo = await encargoDe('carrusel');
    const plan = await productor.proponer(encargo);
    assert.deepEqual(await productor.proponer(encargo), plan);
    assert.deepEqual(plan.diapositivas.map((d) => d.tratamiento), ['FOTO_LIMPIA', 'RECORTE_DETALLE', 'RECORTE_DETALLE', 'CIERRE_TEXTO']);
    const gamba = { fuente: 'ELEMENTO', indice: 0 } as const;
    assert.equal(textoConfirmado(encargo.brief, gamba), undefined);
    const confirmado = confirmarInventario(encargo.brief, { elementos: ELEMENTOS, tomas: [] }, 'web', AHORA, { fotos: 0, llamadasTexto: 0 });
    assert.equal(textoConfirmado(confirmado, gamba), 'gamba');
    assert.equal(textoConfirmado(confirmado, { fuente: 'INSTAGRAM' }), '@el.local');
  });

  it('usa Hydrogen en el Productor y conserva la configuración de texto e imagen existente', () => {
    const config = leerConfig({});
    assert.equal(config.geminiModeloProductor, MODELO_PRODUCTOR_GEMINI);
    assert.equal(config.geminiModeloProductorRespaldo, undefined);
    assert.equal(config.geminiModelo, 'gemini-3.8-flash');
    assert.equal(config.geminiModeloImagen, 'gemini-3-pro-image');
    const alternativo = leerConfig({ GEMINI_MODELO_PRODUCTOR: 'otro-vision', GEMINI_MODELO_PRODUCTOR_RESPALDO: 'otro-respaldo' });
    assert.equal(alternativo.geminiModeloProductor, 'otro-vision');
    assert.equal(alternativo.geminiModeloProductorRespaldo, 'otro-respaldo');
  });
});
