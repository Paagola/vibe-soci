import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { ClienteGemini, interpretarJson } from '../src/adaptadores/gemini/ClienteGemini.js';

const respuestaTexto = (texto: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), { status: 200 });

describe('ClienteGemini', () => {
  it('pasa al modelo de respaldo si el principal está saturado', async () => {
    const pedidos: string[] = [];
    const avisos: string[] = [];
    const fetchFalso: typeof fetch = async (url) => {
      pedidos.push(String(url));
      return String(url).includes('principal') ? new Response('{"error":"high demand"}', { status: 503 }) : respuestaTexto('{"ok":true}');
    };
    const cliente = new ClienteGemini('k', ['principal', 'respaldo'], { fetch: fetchFalso, dormir: async () => {}, avisar: (m) => avisos.push(m) });

    assert.deepEqual(await cliente.generarJson('i', [{ text: 'x' }], z.object({ ok: z.boolean() })), { ok: true });
    assert.equal(pedidos.filter((u) => u.includes('principal')).length, 2, 'reintenta una vez el principal');
    assert.equal(avisos.length, 1);
  });

  it('si la respuesta no cuadra con el esquema, se la devuelve una vez para que la corrija', async () => {
    const respuestas = ['{"ok":"si"}', '{"ok":true}'];
    const cuerpos: string[] = [];
    const fetchFalso: typeof fetch = async (_url, init) => {
      cuerpos.push(String(init?.body));
      return respuestaTexto(respuestas.shift()!);
    };
    const cliente = new ClienteGemini('k', ['m'], { fetch: fetchFalso, dormir: async () => {} });
    assert.deepEqual(await cliente.generarJson('i', [{ text: 'x' }], z.object({ ok: z.boolean() })), { ok: true });
    assert.match(cuerpos[1] ?? '', /Tu respuesta no es válida/);
  });

  it('el presupuesto corta el reintento del transporte antes del siguiente envío', async () => {
    let envios = 0;
    let reservas = 0;
    const cliente = new ClienteGemini('k', ['hydrogen', 'respaldo'], {
      antesDeEnviar: async () => { if (++reservas > 1) throw new Error('Presupuesto agotado'); },
      fetch: async () => { envios++; return new Response('', { status: 503 }); },
      dormir: async () => {},
    });
    await assert.rejects(cliente.generarJson('i', [{ text: 'x' }], z.boolean()), /Presupuesto agotado/);
    assert.equal(envios, 1);
  });

  it('acepta JSON envuelto en un bloque de código', () => {
    assert.deepEqual(interpretarJson('```json\n{"a":1}\n```', z.object({ a: z.number() })), { ok: true, datos: { a: 1 } });
  });
});
