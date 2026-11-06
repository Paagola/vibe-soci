import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ClienteHiggsfield } from '../src/adaptadores/higgsfield/ClienteHiggsfield.js';
import { MODELOS_HIGGSFIELD } from '../src/adaptadores/higgsfield/modelos.js';
import { ErrorDeServicio } from '../src/dominio/errores.js';

const sinEsperas = { dormir: async () => {} };

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('estrategias de modelo', () => {
  it('marketing-studio va en modo directo, sin 4:5 (3:4) y con todas las referencias', () => {
    const cuerpo = MODELOS_HIGGSFIELD['marketing-studio/image']!.construirCuerpo({ prompt: 'p', urls: ['a', 'b'], formato: 'CARRUSEL', resolucion: '4k' });
    assert.deepEqual(cuerpo, { prompt: 'p', image_urls: ['a', 'b'], resolution: '4k', aspect_ratio: '3:4', quality: 'high', enhance_prompt: false });
  });

  it('ideogram usa una sola imagen y el mismo lienzo 3:4 que los demás', () => {
    const cuerpo = MODELOS_HIGGSFIELD['ideogram/v4.0']!.construirCuerpo({ prompt: 'p', urls: ['a'], formato: 'POST', resolucion: '4k' });
    assert.deepEqual(cuerpo, { prompt: 'p', image_url: 'a', aspect_ratio: '3:4', rendering_speed: 'QUALITY' });
  });

  it('el feed se pide a 3:4 en todos los modelos', () => {
    for (const estrategia of Object.values(MODELOS_HIGGSFIELD)) {
      const cuerpo = estrategia.construirCuerpo({ prompt: 'p', urls: [], formato: 'CARRUSEL', resolucion: '2k' });
      assert.equal(cuerpo.aspect_ratio, '3:4', estrategia.id);
    }
  });

  it('las historias van a 9:16 en todos los modelos', () => {
    for (const estrategia of Object.values(MODELOS_HIGGSFIELD)) {
      const cuerpo = estrategia.construirCuerpo({ prompt: 'p', urls: [], formato: 'HISTORIA', resolucion: '2k' });
      assert.equal(cuerpo.aspect_ratio, '9:16', estrategia.id);
    }
  });
});

describe('ClienteHiggsfield', () => {
  it('envía con Idempotency-Key y espera hasta completed', async () => {
    const llamadas: { url: string; init?: RequestInit }[] = [];
    const estados = ['queued', 'in_progress', 'completed'];
    const fetchFalso: typeof fetch = async (entrada, init) => {
      const url = String(entrada);
      llamadas.push({ url, init });
      if (url.endsWith('/marketing-studio/image')) return respuestaJson({ request_id: 'r1', status_url: 'https://api.higgsfield.ai/requests/r1/status' });
      const status = estados.shift();
      return respuestaJson(status === 'completed' ? { status, images: [{ url: 'https://cdn/x.png' }] } : { status });
    };

    const cliente = new ClienteHiggsfield('id:secreto', { fetch: fetchFalso, ...sinEsperas });
    const trabajo = await cliente.enviar('marketing-studio/image', { prompt: 'p' }, 'pieza-d1-v1');
    assert.equal(trabajo.requestId, 'r1');
    assert.equal(new Headers(llamadas[0]!.init?.headers).get('Idempotency-Key'), 'pieza-d1-v1');
    assert.equal(new Headers(llamadas[0]!.init?.headers).get('Authorization'), 'Key id:secreto');

    assert.equal(await cliente.esperar(trabajo.urlEstado), 'https://cdn/x.png');
    assert.equal(llamadas.length, 4);
  });

  it('nsfw es un fallo definitivo de moderación', async () => {
    const cliente = new ClienteHiggsfield('id:s', { fetch: async () => respuestaJson({ status: 'nsfw' }), ...sinEsperas });
    await assert.rejects(cliente.esperar('https://api/estado'), (e: unknown) => e instanceof ErrorDeServicio && !e.reintentable && /MODERACION/.test(e.message));
  });

  it('si se agota la espera, el error es reintentable (el trabajo se retoma, no se reenvía)', async () => {
    const cliente = new ClienteHiggsfield('id:s', { fetch: async () => respuestaJson({ status: 'in_progress' }), esperaMaximaMs: -1, ...sinEsperas });
    await assert.rejects(cliente.esperar('https://api/estado'), (e: unknown) => e instanceof ErrorDeServicio && e.reintentable);
  });

  it('sube con las cabeceras que pide la URL firmada y sin nuestras credenciales', async () => {
    let cabecerasPut: Headers | undefined;
    const fetchFalso: typeof fetch = async (entrada, init) => {
      if (String(entrada).endsWith('/files/generate-upload-url')) {
        return respuestaJson({ public_url: 'https://cdn/in.jpg', upload_url: 'https://s3/firmada', upload_headers: { 'Content-Type': 'image/jpeg', 'x-amz-tagging': 'retention=temporary' } });
      }
      cabecerasPut = new Headers(init?.headers);
      return new Response(null, { status: 200 });
    };
    const cliente = new ClienteHiggsfield('id:s', { fetch: fetchFalso, ...sinEsperas });
    assert.equal(await cliente.subirArchivo(Buffer.from('x'), 'image/jpeg'), 'https://cdn/in.jpg');
    assert.equal(cabecerasPut?.get('x-amz-tagging'), 'retention=temporary');
    assert.equal(cabecerasPut?.get('Authorization'), null);
  });
});
