import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { ClienteGemini, type ParteGemini } from '../src/adaptadores/gemini/ClienteGemini.js';
import { CriticoEditorialGemini } from '../src/adaptadores/gemini/CriticoEditorialGemini.js';
import {
  CriticoEditorialSimulado, esquemaDeCriticaEditorial, type EncargoCriticaEditorial, type IncidenciaEditorial,
} from '../src/aplicacion/productor/criticaEditorial.js';
import { MODELO_PRODUCTOR_GEMINI } from '../src/config.js';
import { BriefDelEncargo, confirmarInventario, crearBrief } from '../src/dominio/brief.js';
import { ErrorDeUsuario } from '../src/dominio/errores.js';

const FECHA = '2026-11-17T21:00:00.000Z';
const FOTOSHA = 'a'.repeat(64);
const REFSHA = 'b'.repeat(64);
const ELEMENTOS = [
  { nombre: 'gamba', estado: 'a la brasa', recuento: 2 },
  { nombre: 'pan', estado: 'tostado', recuento: 3 },
];

function briefDePrueba(): BriefDelEncargo {
  const propuesto = crearBrief({
    proyecto: 'critica', local: 'prueba', formato: 'carrusel', nota: 'Gamba a la brasa y pan tostado', usoFotoReal: 'PUBLICABLE',
    marca: { nombre: 'Casa de prueba', ciudad: 'Madrid', tonos: [], descripcion: '' },
    elementos: ELEMENTOS, tomas: [], referencia: { id: 'referencia-de-prueba' },
  }, FECHA);
  const confirmado = confirmarInventario(propuesto, { elementos: ELEMENTOS, tomas: [] }, 'web', FECHA, { fotos: 1, llamadasTexto: 3 });
  return BriefDelEncargo.parse({
    ...confirmado,
    modo: 'PRODUCTOR',
    editorial: {
      modelo: MODELO_PRODUCTOR_GEMINI,
      briefVersion: propuesto.version,
      fotoSha256: FOTOSHA,
      inventarioSha256: confirmado.hechos.inventario.huella,
      plan: {
        esquema: 'post/editorial@1', hiloVisual: 'LUZ',
        diapositivas: [
          { n: 1, papel: 'portada', tratamiento: 'FOTO_LIMPIA' },
          { n: 2, papel: 'detalle', tratamiento: 'RECORTE_DETALLE', enfoque: { x: 0.4, y: 0.5 }, zoom: 2, elemento: 0 },
          {
            n: 3, papel: 'detalle', tratamiento: 'FOTO_TEXTO_AL_BORDE', borde: 'SUPERIOR', gesto: 'CONTENIDO',
            texto: { fuente: 'ELEMENTO', indice: 1 }, arco: { centro: { x: 0.5, y: 0.5 }, radio: 0.2, grados: 80, inicio: -35, tinta: 'CLARA' },
          },
          { n: 4, papel: 'cierre', tratamiento: 'CIERRE_TEXTO', textos: [{ fuente: 'MARCA' }, { fuente: 'CIUDAD' }] },
        ],
      },
    },
  });
}

function materiales(bytesPorImagen: readonly Uint8Array[]): EncargoCriticaEditorial {
  const ids = ['post', 'detalle-1', 'detalle-2', 'cierre'];
  return {
    brief: briefDePrueba(),
    paginas: ids.map((id, i) => ({ id, version: i + 1, bytes: bytesPorImagen[i]! })),
    originales: [{ id: 'foto-fuente', bytes: bytesPorImagen[4]! }],
    referencia: { id: 'referencia-de-prueba', huella: REFSHA, ficha: 'Cada página usa un encuadre autónomo.' },
  };
}

const RECORTE: IncidenciaEditorial = {
  id: 'detalle-1',
  version: 2,
  motivo: 'El recorte corta la cabeza de la gamba.',
  correccion: { tipo: 'AJUSTAR_RECORTE', enfoque: { x: 0.61, y: 0.5 }, zoom: 1.5 },
};
const CONTRASTE: IncidenciaEditorial = {
  id: 'cierre',
  version: 4,
  motivo: 'La ciudad se confunde con el fondo.',
  correccion: { tipo: 'MEJORAR_CONTRASTE', dato: 2 },
};

const imagenesJpeg = () => Promise.all(['#a23', '#331b13', '#445561', '#441', '#ccd'].map((background) =>
  sharp({ create: { width: 30, height: 40, channels: 3, background } }).jpeg().toBuffer()));
const materialesParaEsquema = () => materiales(Array.from({ length: 5 }, () => new Uint8Array([1])));

interface Peticion {
  url: string;
  cuerpo: { systemInstruction: { parts: Array<{ text: string }> }; contents: Array<{ parts: ParteGemini[] }> };
}

function geminiFalso(...respuestas: unknown[]) {
  const peticiones: Peticion[] = [];
  const reservas: string[] = [];
  const cliente = new ClienteGemini('prueba', [MODELO_PRODUCTOR_GEMINI], {
    antesDeEnviar: async (modelo) => { reservas.push(modelo); },
    dormir: async () => {},
    fetch: async (url, init) => {
      peticiones.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) as Peticion['cuerpo'] });
      assert.equal(reservas.length, peticiones.length, 'cada petición reserva antes del transporte');
      assert.ok(respuestas.length, 'la crítica hizo una llamada de más');
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(respuestas.shift()) }] } }] });
    },
  });
  return { critico: new CriticoEditorialGemini(cliente), peticiones, reservas };
}

describe('Crítica editorial de páginas compuestas', () => {
  it('envía originales y páginas en un único lote con los bytes exactos, versión, hechos y ficha', async () => {
    const imagenes = await imagenesJpeg();
    const { critico, peticiones, reservas } = geminiFalso({ incidencias: [RECORTE, CONTRASTE] });
    assert.deepEqual(await critico.revisar(materiales(imagenes)), { incidencias: [RECORTE, CONTRASTE] });
    assert.equal(critico.modelo, MODELO_PRODUCTOR_GEMINI);
    assert.deepEqual(reservas, [MODELO_PRODUCTOR_GEMINI]);
    const peticion = peticiones[0]!;
    assert.match(peticion.url, /gemini-4-hydrogen:generateContent$/);
    const partes = peticion.cuerpo.contents[0]!.parts;
    assert.ok(partes[0] && 'text' in partes[0]);
    assert.match(partes[0].text, /"recuento":2/);
    assert.match(partes[0].text, /Cada página usa un encuadre autónomo/);
    assert.match(partes[0].text, new RegExp(REFSHA));
    const etiquetas = partes.slice(1).flatMap((parte) => 'text' in parte ? [parte.text] : []);
    assert.deepEqual(etiquetas, [
      'Foto original foto-fuente',
      'Página renderizada 1: id post, versión 1',
      'Página renderizada 2: id detalle-1, versión 2',
      'Página renderizada 3: id detalle-2, versión 3',
      'Página renderizada 4: id cierre, versión 4',
    ]);
    const fotos = partes.flatMap((p) => 'inlineData' in p ? [p.inlineData] : []);
    assert.ok(fotos.every((foto) => foto.mimeType === 'image/jpeg'));
    assert.deepEqual(fotos.map((f) => Buffer.from(f.data, 'base64')), [imagenes[4], ...imagenes.slice(0, 4)]);
  });

  it('acota las incidencias a páginas vistas, versiones exactas y cambios realizables', () => {
    const encargo = materialesParaEsquema();
    const esquema = esquemaDeCriticaEditorial(encargo);
    const invalidas = [
      [{ ...CONTRASTE, id: 'otra' }],
      [{ ...CONTRASTE, version: 8 }],
      [CONTRASTE, CONTRASTE],
      [{ ...RECORTE, correccion: { ...RECORTE.correccion, enfoque: { x: -0.1, y: 0.5 } } }],
      [{ ...RECORTE, correccion: { ...RECORTE.correccion, zoom: 6 } }],
      [{ ...RECORTE, id: 'post', version: 1 }],
      [{ ...CONTRASTE, correccion: { tipo: 'MEJORAR_CONTRASTE', dato: 3 } }],
      [{ ...CONTRASTE, correccion: { tipo: 'AJUSTAR_TAMANO', dato: 1, factor: 1.8 } }],
      [{ ...CONTRASTE, id: 'detalle-2', version: 3, correccion: { tipo: 'AJUSTAR_MARGEN', margen: 0.08 } }],
      [{ ...CONTRASTE, correccion: { tipo: 'REVISION_HUMANA', texto: 'Copy nuevo' } }],
    ];
    for (const incidencias of invalidas) assert.equal(esquema.safeParse({ incidencias }).success, false, JSON.stringify(incidencias));
    assert.equal(esquema.safeParse({ incidencias: [RECORTE, CONTRASTE] }).success, true);
    assert.equal(esquemaDeCriticaEditorial({ ...encargo, originales: [] }).safeParse({ incidencias: [RECORTE] }).success, false);
  });

  it('pide corregir el JSON si el modelo usa una versión ausente', async () => {
    const { critico, peticiones } = geminiFalso({ incidencias: [{ ...RECORTE, version: 10 }] }, { incidencias: [RECORTE] });
    assert.deepEqual(await critico.revisar(materiales(await imagenesJpeg())), { incidencias: [RECORTE] });
    assert.equal(peticiones.length, 2);
    const reparacion = peticiones[1]!.cuerpo.contents.at(-1)!.parts[0];
    assert.ok(reparacion && 'text' in reparacion);
    assert.match(reparacion.text, /id y la versión de una página renderizada/);
  });

  it('rechaza sin transporte un encargo sin confirmar, una página que falta o bytes que no sean JPEG', async () => {
    const encargo = materiales(await imagenesJpeg());
    const { critico, peticiones } = geminiFalso();
    const sinAprobar = { ...encargo, brief: { ...encargo.brief, hechos: { ...encargo.brief.hechos, inventario: { ...encargo.brief.hechos.inventario, estado: 'PROPUESTO' as const } } } };
    await assert.rejects(critico.revisar(sinAprobar), ErrorDeUsuario);
    await assert.rejects(critico.revisar({ ...encargo, paginas: encargo.paginas.slice(0, -1) }), /cada diapositiva del plan/);
    await assert.rejects(critico.revisar(materialesParaEsquema()), /debe ser JPEG/);
    assert.equal(peticiones.length, 0);
  });

  it('permite simular una corrección validada o una pieza que ya funciona', async () => {
    const entrada = materialesParaEsquema();
    const simulado = new CriticoEditorialSimulado([RECORTE]);
    assert.equal(simulado.modelo, 'SIMULADO');
    assert.deepEqual(await simulado.revisar(entrada), { incidencias: [RECORTE] });
    assert.deepEqual(await new CriticoEditorialSimulado().revisar(entrada), { incidencias: [] });
  });
});
