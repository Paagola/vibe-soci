import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { consumoMensual } from '../src/web/rutas/panel.js';

test('el consumo conserva el mes local del envío, separa estimaciones y excluye rechazos y tier gratuito del gasto', async t => {
  const carpeta = await mkdtemp(join(tmpdir(), 'consumo-'));
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const guardar = (archivo: string, registros: unknown[]) => writeFile(join(carpeta, archivo), registros.map(r => JSON.stringify(r)).join('\n') + '\n{');
  const fecha = '2026-10-31T22:50:00Z';
  const respuesta = '2026-10-31T23:10:00Z';
  const imagen = { fecha, modelo: 'm', receta: 'r', activo: 'a', estimadoUsd: 1, estado: 'ENVIADO' };
  await guardar('gemini.jsonl', [imagen, { ...imagen, fecha: respuesta, estado: 'COMPLETADO', realUsd: 0.4, uso: { promptTokenCount: 2, candidatesTokenCount: 8 } },
    { ...imagen, activo: 'b', estado: 'FALLIDO' }, { ...imagen, activo: 'c', tier: 'GRATUITO' }, { ...imagen, activo: 'd', fecha: respuesta }]);
  await guardar('gemini-texto.jsonl', [{ fecha: respuesta, modelo: 'gemini-4-hydrogen', tier: 'PAGO', tokensEntrada: 1000, tokensSalida: 900, tokensRazonamiento: 100 },
    { fecha: respuesta, modelo: 'otro', tier: 'PAGO', tokensEntrada: 4 }]);
  await guardar('higgsfield.jsonl', [{ fecha, requestId: 'x', estimadoUsd: 2, estado: 'ENVIADO' }, { fecha: respuesta, requestId: 'x', estado: 'COMPLETADO' },
    { fecha: respuesta, requestId: 'y', via: 'MCP', creditos: 5 }]);
  const { actual, meses } = await consumoMensual(carpeta, 'Europe/Madrid', new Date(respuesta));
  assert.equal(actual, '2026-11');
  const [nov, oct] = meses;
  assert.equal(oct!.imagenUsd, 0.4);
  assert.equal(oct!.higgsfieldEstimadoUsd, 2);
  assert.equal(oct!.entrada + oct!.salida, 10);
  assert.equal(oct!.imagenEstimadaUsd, 0);
  assert.equal(nov!.imagenEstimadaUsd, 1);
  assert.equal(nov!.textoEstimadoUsd, 0.009);
  assert.equal(nov!.sinTarifa, 1);
  assert.equal(nov!.creditos, 5);
  assert.equal(nov!.entrada + nov!.salida + nov!.razonamiento, 2004);
});
