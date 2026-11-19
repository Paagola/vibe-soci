/**
 * Generador de pago de la vía de producción (Gemini de imagen), con un fetch falso: sin red ni gasto.
 * Lo que importa: sin facturación no envía nada, el tope se comprueba ANTES de enviar y el gasto queda apuntado.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { GeneradorFotoGemini, apuntarGastoGemini, gastoAcumuladoGemini } from '../src/adaptadores/gemini/GeneradorFotoGemini.js';
import { RAIZ } from '../src/config.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');
let carpeta: string;
let png: string;

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-gen-gemini-'));
  png = (await sharp({ create: { width: 30, height: 40, channels: 3, background: '#a33' } }).png().toBuffer()).toString('base64');
});
after(() => rm(carpeta, { recursive: true, force: true }));

function fetchFalso(llamadas: string[]): typeof fetch {
  return (async (url: string | URL) => {
    const u = String(url);
    llamadas.push(u.split(':').pop() ?? u);
    if (u.endsWith(':countTokens')) return new Response(JSON.stringify({ totalTokens: 1500 }));
    return new Response(
      JSON.stringify({
        modelVersion: 'gemini-3-pro-image',
        candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }],
        usageMetadata: { promptTokenCount: 2060, candidatesTokenCount: 1120, thoughtsTokenCount: 300, candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }] },
      }),
    );
  }) as typeof fetch;
}

const peticion = { id: 'x-foto-1', prompt: 'p', referencias: [{ ruta: FOTO, etiqueta: '@image1' }], aspectRatio: '3:4', tamano: '2K' as const };

describe('Generador de foto con Gemini de pago', () => {
  it('sin facturación no está disponible y no envía nada', async () => {
    const llamadas: string[] = [];
    const g = new GeneradorFotoGemini({ apiKey: 'k', modelo: 'gemini-3-pro-image', facturacion: false, topeUsd: 1, carpetaDatos: carpeta, origen: 'prueba', fetch: fetchFalso(llamadas) });
    assert.match(String((g.disponible() as { motivo: string }).motivo), /GEMINI_FACTURACION=no/);
    await assert.rejects(g.generar(peticion), /No se puede generar/);
    assert.deepEqual(llamadas, []);
  });

  it('genera, apunta ENVIADO y COMPLETADO con el coste real de la respuesta', async () => {
    const llamadas: string[] = [];
    const g = new GeneradorFotoGemini({ apiKey: 'k', modelo: 'gemini-3-pro-image', facturacion: true, topeUsd: 1, carpetaDatos: carpeta, origen: 'prueba', fetch: fetchFalso(llamadas) });
    const foto = await g.generar(peticion);
    assert.deepEqual(llamadas, ['countTokens', 'generateContent']);
    // 2060 × 2 + 300 × 12 + 1120 × 120 por millón = 0,14212 USD
    assert.equal(Number(foto.costeUsd.toFixed(5)), 0.14212);
    assert.equal(foto.tier, 'PAGO');
    const lineas = (await readFile(join(carpeta, 'gasto', 'gemini.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lineas.map((l) => l.estado), ['ENVIADO', 'COMPLETADO']);
    assert.equal(lineas[1].tier, 'PAGO');
    assert.deepEqual(lineas[1].uso, {
      promptTokenCount: 2060, candidatesTokenCount: 1120, thoughtsTokenCount: 300,
      candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }],
    });
  });

  it('se niega ANTES de enviar si el gasto apuntado más el estimado pasa del tope', async () => {
    await apuntarGastoGemini(join(carpeta, 'gasto', 'gemini.jsonl'), { fecha: 'x', receta: 'otra', activo: 'y', modelo: 'gemini-3-pro-image', tier: 'PAGO', estimadoUsd: 0.9, realUsd: 0.9, estado: 'COMPLETADO' });
    const llamadas: string[] = [];
    const g = new GeneradorFotoGemini({ apiKey: 'k', modelo: 'gemini-3-pro-image', facturacion: true, topeUsd: 1, carpetaDatos: carpeta, origen: 'prueba', fetch: fetchFalso(llamadas) });
    await assert.rejects(g.generar(peticion), /Se pasaría del tope de Gemini/);
    assert.deepEqual(llamadas, ['countTokens'], 'solo cuenta tokens (gratis): no llega a generar');
  });

  it('reserva el coste antes del envío y los 503 conservan el importe estimado', async () => {
    const carpetaDatos = join(carpeta, 'concurrente');
    const registro = join(carpetaDatos, 'gasto', 'gemini.jsonl');
    const reservas: string[] = [];
    let envios = 0;
    const g = new GeneradorFotoGemini({
      apiKey: 'k', modelo: 'gemini-3-pro-image', facturacion: true, topeUsd: 0.2, carpetaDatos, origen: 'prueba',
      fetch: async (url) => {
        if (String(url).endsWith(':countTokens')) return Response.json({ totalTokens: 1500 });
        envios++;
        assert.equal(reservas.length, 1);
        assert.ok(await gastoAcumuladoGemini(registro) > 0);
        return new Response('servidor sin respuesta', { status: 503 });
      },
    });
    const alEnviar = async () => { reservas.push('reservada'); };
    const dos = await Promise.allSettled([
      g.generar({ ...peticion, antesDeEnviar: alEnviar }),
      g.generar({ ...peticion, id: 'y-foto-1', antesDeEnviar: alEnviar }),
    ]);
    assert.equal(envios, 1);
    assert.match(dos.map((r) => r.status === 'rejected' ? String(r.reason) : '').join('\n'), /pasaría del tope/);
    assert.ok(await gastoAcumuladoGemini(registro) > 0);
  });
});
