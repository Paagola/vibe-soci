/**
 * El buscador de la estética de referencia, con dobles de Pinterest y de Hydrogen: junta lo de Pinterest (lo que el
 * director elige, en su orden), los posts anteriores del local, la biblioteca y el corpus, y lo copia a la conversación.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import type { PinDePinterest } from '../src/adaptadores/referencias/PinterestPublico.js';
import type { Marca } from '../src/dominio/modelos.js';
import type { Tokens } from '../src/dominio/diseno/intencion.js';
import { consultasPorDefecto, crearBuscadorDeReferencias } from '../src/web/referenciasChat.js';

const jpg = (ruta: string, color: string) => sharp({ create: { width: 40, height: 50, channels: 3, background: color } }).jpeg().toFile(ruta);

describe('estética de referencia · buscador', () => {
  it('junta Pinterest (curado), el local, la biblioteca y el corpus en la carpeta de la conversación', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'refs-'));
    const datos = join(raiz, 'datos');
    const destino = join(raiz, 'conv', 'referencias', 'refs-1');
    await mkdir(destino, { recursive: true });
    await mkdir(join(raiz, 'biblioteca', 'referencias'), { recursive: true });
    await jpg(join(raiz, 'biblioteca', 'referencias', 'post-01.jpg'), '#111111');
    await jpg(join(raiz, 'biblioteca', 'referencias', 'post-02.jpg'), '#222222');
    await writeFile(join(raiz, 'biblioteca', 'referencias', 'indice.json'), JSON.stringify({ referencias: [{ archivo: 'post-01.jpg', palabras: ['sushi'], tratamiento: 'oscuro' }, { archivo: 'post-02.jpg', palabras: ['croquetas'], tratamiento: 'claro', descripcion: 'Croquetas sobre papel' }] }));
    await mkdir(join(raiz, 'proyectos', '2026-11-20-croquetas'), { recursive: true });
    await writeFile(join(raiz, 'proyectos', '2026-11-20-croquetas', 'post.json'), JSON.stringify({ local: 'asador', plato: 'Croquetas' }));
    await mkdir(join(datos, 'disenos', '2026-11-20-croquetas', 'post', 'v002', 'exportadas'), { recursive: true });
    await jpg(join(datos, 'disenos', '2026-11-20-croquetas', 'post', 'v002', 'exportadas', '4x5.jpg'), '#333333');
    const anterior = join(raiz, 'anterior.png');
    await sharp({ create: { width: 40, height: 50, channels: 3, background: '#444444' } }).png().toFile(anterior);

    const pins: PinDePinterest[] = [1, 2, 3].map((n) => ({ id: `p${n}`, titulo: `Pin ${n}`, enlace: `https://www.pinterest.com/pin/p${n}/`, miniatura: `https://i.pinimg.com/236x/${n}.jpg`, grande: `https://i.pinimg.com/736x/${n}.jpg`, ancho: 736, alto: 920 }));
    const buscadas: string[] = [];
    let vistas = 0;
    const buscar = crearBuscadorDeReferencias({
      raiz,
      datos,
      locales: async () => [{ slug: 'asador', marca: { nombre: 'Asador', descripcion: 'Asador vasco', tonos: ['sobrio'] } as unknown as Marca, tokens: {} as Tokens }],
      corpus: { piezas: [], ruta: (a) => join(raiz, a) },
      pinterest: {
        buscar: async (q) => (buscadas.push(q), pins),
        descargar: async (_url, ruta) => void (await jpg(ruta, '#555555')),
      },
      cliente: {
        generarJson: (async (_i: string, partes: Array<{ inlineData?: unknown }>) => {
          vistas = partes.filter((x) => x.inlineData).length;
          return { elegidas: [{ n: 3, motivo: 'Titular monumental detrás del plato' }, { n: 1, motivo: 'Color plano' }] };
        }) as never,
      },
    });
    const progreso: string[] = [];
    const r = await buscar({ destino, prefijo: 'referencias/refs-1', local: 'asador', plato: 'Croquetas de jamón', elementos: ['croqueta'], indicaciones: '', formato: 'post', consultas: ['croquetas poster', 'tapas typography'], anteriores: [{ ruta: anterior, titulo: 'Post · Pulpo' }] }, (l) => progreso.push(l));

    assert.deepEqual(buscadas, ['croquetas poster', 'tapas typography']);
    assert.equal(vistas, 3, 'sin duplicados entre búsquedas');
    const pin = r.candidatas.filter((c) => c.origen === 'pinterest');
    assert.deepEqual(pin.map((c) => c.titulo), ['Pin 3', 'Pin 1'], 'en el orden del director');
    assert.equal(pin[0]!.motivo, 'Titular monumental detrás del plato');
    assert.equal(r.candidatas[0]!.origen, 'pinterest', '«Decide tú» toma la mejor de Pinterest');
    assert.deepEqual(r.candidatas.filter((c) => c.origen === 'local').map((c) => c.titulo), ['Post · Pulpo', 'Encargo · Croquetas']);
    assert.equal(r.candidatas.find((c) => c.origen === 'biblioteca')?.motivo, 'Croquetas sobre papel', 'primero la que casa con el plato');
    const ficheros = await readdir(destino);
    assert.ok(r.candidatas.every((c) => ficheros.includes(c.archivo.replace('referencias/refs-1/', ''))));
    assert.ok(!ficheros.some((f) => f.startsWith('.')), 'sin ficheros de trabajo');
    assert.ok(progreso.at(-1)!.includes('candidatas'));
  });

  it('sin búsquedas del director, unas razonables', () => {
    const q = consultasPorDefecto({ plato: 'Croquetas «de la casa»', formato: 'carrusel', tipoDeLocal: 'restaurant' });
    assert.equal(q.length, 3);
    assert.ok(q.every((x) => x.includes('Croquetas de la casa') || x.includes('restaurant')));
    assert.ok(q.some((x) => x.includes('carousel')));
  });
});
