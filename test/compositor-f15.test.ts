/**
 * F1.5 · Lo que se ha añadido al compositor para el carrusel de Etxebarri:
 *   - un recorte que se coloca tras la última letra de un texto (el grano de sal que hace de punto final);
 *   - el punto negro del retoque (la foto comparte el negro de la marca con el fondo liso).
 * Activos sintéticos creados aquí: no depende de datos/ ni gasta.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { CompositorSharp } from '../src/adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../src/adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { RAIZ } from '../src/config.js';
import type { Activo } from '../src/dominio/activos.js';
import { Intencion } from '../src/dominio/diseno/intencion.js';
import type { ActivoDisponible } from '../src/puertos/Compositor.js';

const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
const motor = new MotorTexto(catalogo);
const compositor = new CompositorSharp(motor, catalogo);

let carpeta: string;
let grano: ActivoDisponible;
let negra: ActivoDisponible;

async function crear(id: string, svg: string, mascara: string | undefined, lado: number): Promise<ActivoDisponible> {
  const dir = join(carpeta, 'locales', 'prueba', 'activos', id);
  await mkdir(dir, { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(join(dir, 'original.png'));
  if (mascara) await sharp(Buffer.from(mascara)).greyscale().png().toFile(join(dir, 'mascara.png'));
  const sha = createHash('sha256').update(await readFile(join(dir, 'original.png'))).digest('hex');
  const activo: Activo = {
    id,
    localSlug: 'prueba',
    tipo: 'REAL',
    uso: 'PUBLICABLE',
    descripcion: 'activo sintético',
    archivo: 'original.png',
    ancho: lado,
    alto: lado,
    sha256: sha,
    procedencia: { ruta: 'test', sha256: sha, copiadoEn: '2026-11-07T00:00:00Z' },
    alteraciones: [],
    ...(mascara ? { mascara: { archivo: 'mascara.png', metodo: 'UMBRAL' as const, creadaEn: '2026-11-07T00:00:00Z', bbox: { x: 20, y: 20, w: 60, h: 60 }, incluye: 'el cuadrado' } } : {}),
    niveles: [],
  };
  await writeFile(join(dir, 'activo.json'), JSON.stringify(activo));
  return new AlmacenActivosFicheros(join(carpeta, 'locales')).obtener('prueba', id);
}

function intencion(capas: unknown[], activos: Record<string, string>): Intencion {
  return Intencion.parse({
    esquema: 'diseno/intencion@1',
    id: 'prueba-f15',
    titulo: 'prueba',
    marca: 'prueba',
    activos,
    tokens: {
      colores: { carbon: '#111111', hueso: '#EDE7DD' },
      estilos: { frase: { fuente: 'league-gothic', ejes: { wdth: 100 }, caso: 'tal-cual', tracking: 0, interlineado: 0.9, color: '@hueso' } },
    },
    textos: { frase: 'y nada más' },
    capas,
    relaciones: [],
  });
}

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-f15-'));
  const cuadrado = (relleno: string, fondo: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${fondo}"/><rect x="20" y="20" width="60" height="60" fill="${relleno}"/></svg>`;
  grano = await crear('grano', cuadrado('#ffffff', '#c0392b'), cuadrado('#ffffff', '#000000'), 100);
  negra = await crear('negra', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#000000"/></svg>', undefined, 100);
});

after(() => rm(carpeta, { recursive: true, force: true }));

describe('F1.5 · recorte tras un texto', () => {
  const capas = (caja: { x: number; y: number; w: number; h: number }) => [
    { id: 'fondo', tipo: 'relleno', color: '@carbon' },
    { id: 'frase', tipo: 'texto', texto: '@frase', estilo: 'frase', caja, ajuste: 'alto' },
    { id: 'grano', tipo: 'recorte', activo: 'grano', trasTexto: { texto: 'frase', alto: 0.5, separacion: 0.1, elevacion: 0 } },
  ];

  it('va justo detrás de la tinta de la última letra, apoyado en la línea base y a escala de la mayúscula', async () => {
    const resuelto = await compositor.resolver(intencion(capas({ x: 0.067, y: 0.45, w: 0.6, h: 0.05 }), { grano: 'grano' }), { grano });
    const frase = resuelto.capas.find((c) => c.id === 'frase');
    const recorte = resuelto.capas.find((c) => c.id === 'grano');
    assert.ok(frase?.tipo === 'texto' && recorte?.tipo === 'recorte');
    const linea = frase.lineas.at(-1)!;
    const mayuscula = motor.alturaMayusculas(frase.estilo, linea.tamano);
    const [, , , , ex, ey] = frase.matriz;
    assert.ok(Math.abs(recorte.destino.h - 0.5 * mayuscula) < 1e-6, 'alto = media mayúscula');
    assert.ok(Math.abs(recorte.destino.x - (ex + linea.fin! + 0.1 * mayuscula)) < 1e-6, 'tras la tinta, con su hueco');
    assert.ok(Math.abs(recorte.destino.y + recorte.destino.h - (ey + linea.base)) < 1e-6, 'apoyado en la línea base');
    assert.ok(linea.fin! > linea.x, 'la tinta acaba a la derecha del origen');
  });

  it('si el texto se mueve, el grano lo sigue', async () => {
    const a = await compositor.resolver(intencion(capas({ x: 0.067, y: 0.45, w: 0.6, h: 0.05 }), { grano: 'grano' }), { grano });
    const b = await compositor.resolver(intencion(capas({ x: 0.2, y: 0.6, w: 0.6, h: 0.05 }), { grano: 'grano' }), { grano });
    const pos = (r: typeof a) => r.capas.find((c) => c.id === 'grano')!;
    const ga = pos(a);
    const gb = pos(b);
    assert.ok(ga.tipo === 'recorte' && gb.tipo === 'recorte');
    assert.ok(Math.abs(gb.destino.x - ga.destino.x - (0.2 - 0.067) * 1080) < 1, 'se desplaza en x lo mismo que el texto');
    assert.ok(Math.abs(gb.destino.y - ga.destino.y - (0.6 - 0.45) * 1440) < 1, 'y en y');
  });

  it('se pinta: hay píxeles claros del grano justo detrás de la frase', async () => {
    const resuelto = await compositor.resolver(intencion(capas({ x: 0.067, y: 0.45, w: 0.6, h: 0.05 }), { grano: 'grano' }), { grano });
    const render = await compositor.renderizar(resuelto, { grano });
    const g = resuelto.capas.find((c) => c.id === 'grano')!;
    assert.ok(g.tipo === 'recorte');
    const centro = await sharp(render.png).extract({ left: Math.round(g.destino.x + g.destino.w / 2), top: Math.round(g.destino.y + g.destino.h / 2), width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.ok(centro[0]! > 200 && centro[1]! > 200 && centro[2]! > 200, `centro del grano ${[...centro]}`);
  });
});

describe('F1.5 · punto negro del retoque', () => {
  const capas = (retoque: Record<string, unknown>) => [
    { id: 'fondo', tipo: 'relleno', color: '@carbon' },
    { id: 'foto', tipo: 'imagen', activo: 'foto', caja: { x: 0, y: 0.5, w: 1, h: 0.5 }, retoque },
  ];
  const pixel = async (png: Buffer, y: number) => [...(await sharp(png).extract({ left: 540, top: y, width: 1, height: 1 }).removeAlpha().raw().toBuffer())];

  it('el negro de la foto pasa a ser el carbón de la marca: no hay escalón con el fondo liso', async () => {
    const resuelto = await compositor.resolver(intencion(capas({ puntoNegro: '@carbon' }), { foto: 'negra' }), { foto: negra });
    const foto = resuelto.capas.find((c) => c.id === 'foto');
    assert.ok(foto?.tipo === 'imagen' && foto.retoque?.puntoNegro === '#111111', 'el token se resuelve a HEX');
    const render = await compositor.renderizar(resuelto, { foto: negra });
    assert.deepEqual(await pixel(render.png, 300), [17, 17, 17], 'fondo liso');
    assert.deepEqual(await pixel(render.png, 1100), [17, 17, 17], 'la foto, con el mismo negro');
  });

  it('con contraste también: el contraste no se lleva el negro por debajo del punto negro', async () => {
    const resuelto = await compositor.resolver(intencion(capas({ contraste: 1.3, puntoNegro: '#111111' }), { foto: 'negra' }), { foto: negra });
    const render = await compositor.renderizar(resuelto, { foto: negra });
    assert.deepEqual(await pixel(render.png, 1100), [17, 17, 17]);
  });
});
