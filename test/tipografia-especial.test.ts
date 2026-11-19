/**
 * Tipografías especiales (derretida, papel, antigua, neón) y las comprobaciones de letra que se añadieron con ellas:
 * letra perdida por el borde, letra tapada por el sujeto, huecos de plantilla sin rellenar y textos girados que se
 * montan. Activos sintéticos: no depende de datos/ ni gasta. La calidad visual se revisa a ojo (npm run muestras-tipo).
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
import type { ActivoDisponible, Renderizado } from '../src/puertos/Compositor.js';

const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
const motor = new MotorTexto(catalogo);
const compositor = new CompositorSharp(motor, catalogo);
const ANCHO = 1080;
const ALTO = 1440;

let carpeta: string;
let disco: ActivoDisponible;

function intencion(capas: unknown[], activos: Record<string, string> = {}): Intencion {
  return Intencion.parse({
    esquema: 'diseno/intencion@1',
    id: 'prueba-especial',
    titulo: 'prueba',
    marca: 'prueba',
    activos,
    tokens: {
      colores: { queso: '#F2C14E', cacao: '#2A1A12', rojo: '#B3261E', negro: '#1D1A17', papel: '#EFE6D2' },
      estilos: {
        cartel: { fuente: 'bebas-neue', ejes: {}, caso: 'mayusculas', tracking: 0.01, interlineado: 0.9, color: '@queso' },
        script: { fuente: 'kaushan-script', ejes: {}, caso: 'tal-cual', tracking: 0, interlineado: 1.1, color: '@rojo' },
      },
    },
    capas,
  });
}

const fondo = { id: 'fondo', tipo: 'relleno', color: '@cacao' };
const titular = (extra: Record<string, unknown> = {}) => ({ id: 't', tipo: 'texto', texto: 'ENTRECOT', estilo: 'cartel', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.15 }, ajuste: 'ancho', ...extra });

async function pintar(i: Intencion, activos: Record<string, ActivoDisponible> = {}): Promise<{ render: Renderizado; problemas: Array<{ tipo: string; gravedad: string; mensaje: string }> }> {
  const resuelto = await compositor.resolver(i, activos);
  return { render: await compositor.renderizar(resuelto, activos), problemas: resuelto.problemas };
}

async function alfaDe(render: Renderizado, id: string): Promise<Uint8Array> {
  const capa = render.capas.find((c) => c.id === id)!;
  return new Uint8Array(await sharp(capa.png).ensureAlpha().extractChannel(3).raw().toBuffer());
}

/** Tinta (suma de alfa) en una franja horizontal [y0, y1). */
function tintaEntre(alfa: Uint8Array, y0: number, y1: number): number {
  let suma = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < ANCHO; x++) suma += alfa[y * ANCHO + x]! / 255;
  return suma;
}

/** La fila más baja con tinta. */
function fondoDeTinta(alfa: Uint8Array): number {
  for (let y = ALTO - 1; y >= 0; y--) for (let x = 0; x < ANCHO; x++) if (alfa[y * ANCHO + x]! > 40) return y;
  return -1;
}

const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-especial-'));
  const dir = join(carpeta, 'locales', 'prueba', 'activos', 'disco');
  await mkdir(dir, { recursive: true });
  const svg = (relleno: string, fondoColor: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="100%" height="100%" fill="${fondoColor}"/><circle cx="500" cy="500" r="300" fill="${relleno}"/></svg>`);
  await sharp(svg('#c0392b', '#777777')).png().toFile(join(dir, 'original.png'));
  await sharp(svg('#ffffff', '#000000')).greyscale().png().toFile(join(dir, 'mascara.png'));
  const sha = createHash('sha256').update(await readFile(join(dir, 'original.png'))).digest('hex');
  const activo: Activo = {
    id: 'disco',
    localSlug: 'prueba',
    tipo: 'REAL',
    uso: 'PUBLICABLE',
    descripcion: 'activo sintético',
    archivo: 'original.png',
    ancho: 1000,
    alto: 1000,
    sha256: sha,
    procedencia: { ruta: 'test', sha256: sha, copiadoEn: '2026-11-19T00:00:00Z' },
    alteraciones: [],
    mascara: { archivo: 'mascara.png', metodo: 'MANUAL', creadaEn: '2026-11-19T00:00:00Z', bbox: { x: 200, y: 200, w: 600, h: 600 }, incluye: 'el disco' },
    niveles: [],
  };
  await writeFile(join(dir, 'activo.json'), JSON.stringify(activo));
  disco = await new AlmacenActivosFicheros(join(carpeta, 'locales')).obtener('prueba', 'disco');
});

after(() => rm(carpeta, { recursive: true, force: true }));

describe('tipografías especiales', () => {
  it('el motor da cada letra por separado, con su carácter, y juntas son el mismo trazo de siempre', () => {
    const estilo = { fuente: 'bebas-neue', ejes: {}, tracking: 0.01 };
    const glifos = motor.glifos(estilo, 'PULPO', 200, 10, 300);
    assert.deepEqual(
      glifos.map((g) => g.caracter),
      ['P', 'U', 'L', 'P', 'O'],
    );
    assert.equal(glifos.map((g) => g.d).join(''), motor.trazar(estilo, 'PULPO', 200, 10, 300));
    assert.ok(glifos.every((g) => g.caja.x1 > g.caja.x0 && g.caja.y1 > g.caja.y0 && g.base === 300));
  });

  it('derretida: cuelgan gotas por debajo de la línea base que el texto limpio no tiene', async () => {
    const limpio = await alfaDe((await pintar(intencion([fondo, titular()]))).render, 't');
    const derretido = await alfaDe((await pintar(intencion([fondo, titular({ tratamiento: { receta: 'derretida', parametros: { gotas: 1, largo: 1 } } })]))).render, 't');
    const base = fondoDeTinta(limpio);
    assert.ok(fondoDeTinta(derretido) > base + 40, `las gotas bajan de la base (${base} → ${fondoDeTinta(derretido)})`);
    assert.ok(tintaEntre(derretido, base + 4, ALTO) > 500, 'hay tinta bajo la línea base');
    // La letra sigue entera: por encima de la base la tinta apenas cambia.
    const arriba = (a: Uint8Array) => tintaEntre(a, 0, base - 10);
    assert.ok(Math.abs(arriba(derretido) - arriba(limpio)) / arriba(limpio) < 0.08, 'la letra no se deforma');
  });

  it('es determinista: la misma intención pinta los mismos píxeles; otra semilla, otras gotas', async () => {
    const t = { receta: 'derretida', semilla: 7 };
    const a = (await pintar(intencion([fondo, titular({ tratamiento: t })]))).render.capas.find((c) => c.id === 't')!.png;
    const b = (await pintar(intencion([fondo, titular({ tratamiento: t })]))).render.capas.find((c) => c.id === 't')!.png;
    const c = (await pintar(intencion([fondo, titular({ tratamiento: { ...t, semilla: 8 } })]))).render.capas.find((c2) => c2.id === 't')!.png;
    assert.equal(hash(a), hash(b));
    assert.notEqual(hash(a), hash(c));
  });

  it('papel, antigua y neón pintan y cambian la letra; el neón se sale de la letra (halo)', async () => {
    const limpio = await alfaDe((await pintar(intencion([fondo, titular()]))).render, 't');
    const suma = (a: Uint8Array) => a.reduce((s, v) => s + v / 255, 0);
    for (const tipo of ['papel', 'antigua', 'neon'] as const) {
      const alfa = await alfaDe((await pintar(intencion([fondo, titular({ tratamiento: { receta: tipo } })]))).render, 't');
      assert.ok(suma(alfa) > 1000, `${tipo} pinta`);
      assert.notEqual(suma(alfa).toFixed(0), suma(limpio).toFixed(0), `${tipo} cambia la letra`);
    }
    const neon = await alfaDe((await pintar(intencion([fondo, titular({ tratamiento: { receta: 'neon', parametros: { halo: 1 } } })]))).render, 't');
    assert.ok(fondoDeTinta(neon) > fondoDeTinta(limpio) + 10, 'el halo pasa del borde de la letra');
  });

  it('en un texto pequeño no se aplica: avisa y lo pinta limpio', async () => {
    const pequeno = titular({ caja: { x: 0.1, y: 0.3, w: 0.2, h: 0.05 }, tratamiento: { receta: 'derretida' } });
    const { render, problemas } = await pintar(intencion([fondo, pequeno]));
    assert.ok(problemas.some((p) => p.tipo === 'TRATAMIENTO' && p.mensaje.includes('56 px')));
    const limpio = (await pintar(intencion([fondo, { ...pequeno, tratamiento: undefined }]))).render;
    assert.equal(hash(render.capas.find((c) => c.id === 't')!.png), hash(limpio.capas.find((c) => c.id === 't')!.png));
  });

  it('no se combina con contorno, corte ni tinta; y dos en la misma pieza avisan', async () => {
    await assert.rejects(pintar(intencion([fondo, titular({ contorno: 3, tratamiento: { receta: 'papel' } })])), /no se combina/);
    const dos = await pintar(intencion([fondo, titular({ tratamiento: { receta: 'papel' } }), { ...titular({ tratamiento: { receta: 'neon' } }), id: 't2', texto: 'BRASA', caja: { x: 0.1, y: 0.6, w: 0.8, h: 0.15 } }]));
    assert.ok(dos.problemas.some((p) => p.tipo === 'TRATAMIENTO' && /compiten/.test(p.mensaje)));
  });
});

describe('cada letra se lee', () => {
  it('LETRA_PERDIDA: un sangrado que se come la «E» de ENTRECOT es error; uno que solo roza el borde, no', async () => {
    const comido = await pintar(intencion([fondo, titular({ caja: { x: -0.12, y: 0.3, w: 1.1, h: 0.15 }, sangrado: true })]));
    const error = comido.problemas.find((p) => p.tipo === 'LETRA_PERDIDA');
    assert.ok(error && error.gravedad === 'ERROR', JSON.stringify(comido.problemas));
    assert.match(error.mensaje, /«E»/);
    assert.match(error.mensaje, /se lee «NTRECOT»/);
    const roza = await pintar(intencion([fondo, titular({ caja: { x: -0.01, y: 0.3, w: 1.02, h: 0.15 }, sangrado: true })]));
    assert.ok(!roza.problemas.some((p) => p.tipo === 'LETRA_PERDIDA'), JSON.stringify(roza.problemas));
  });

  it('LETRA_TAPADA: avisa cuando el plato tapa casi entera una letra, no cuando solo pisa su pie', async () => {
    const sujeto = { id: 's', tipo: 'recorte', activo: 'disco', escala: { anchoSujeto: 0.4 }, ancla: { caja: { x: 0, y: 0, w: 1, h: 1 }, alinear: 'centro' }, bordeSuave: 0 };
    // El disco (432 px) centrado en el lienzo y la palabra encima de él, por detrás: la mitad central desaparece.
    const tapada = await pintar(intencion([fondo, titular({ caja: { x: 0.1, y: 0.46, w: 0.8, h: 0.08 } }), sujeto], { disco: 'disco' }), { disco });
    const aviso = tapada.problemas.find((p) => p.tipo === 'LETRA_TAPADA');
    assert.ok(aviso && aviso.gravedad === 'AVISO', JSON.stringify(tapada.problemas));
    assert.match(aviso.mensaje, /deja de leerse/);
    // La palabra justo encima del disco: el plato no la toca.
    const libre = await pintar(intencion([fondo, titular({ caja: { x: 0.1, y: 0.2, w: 0.8, h: 0.08 } }), sujeto], { disco: 'disco' }), { disco });
    assert.ok(!libre.problemas.some((p) => p.tipo === 'LETRA_TAPADA'), JSON.stringify(libre.problemas));
  });

  it('MARCADOR: un hueco de plantilla sin rellenar es error', async () => {
    const { problemas } = await pintar(intencion([fondo, titular({ texto: 'Bienvenidos a [NOMBRE DEL CHIRINGUITO]', ajuste: 'caja' })]));
    const error = problemas.find((p) => p.tipo === 'MARCADOR');
    assert.ok(error && error.gravedad === 'ERROR');
    assert.match(error.mensaje, /\[NOMBRE DEL CHIRINGUITO\]/);
  });

  it('una script girada que se monta sobre el titular avisa; apartada, no', async () => {
    const script = (y: number) => ({ id: 'acento', tipo: 'texto', texto: 'directo de Galicia', estilo: 'script', caja: { x: 0.35, y, w: 0.55, h: 0.08 }, ajuste: 'ancho', giro: -6 });
    const encima = await pintar(intencion([fondo, titular(), script(0.33)]));
    assert.ok(encima.problemas.some((p) => p.tipo === 'SEPARACION' && /se montan/.test(p.mensaje)), JSON.stringify(encima.problemas));
    const aparte = await pintar(intencion([fondo, titular(), script(0.12)]));
    assert.ok(!aparte.problemas.some((p) => /se montan/.test(p.mensaje)), JSON.stringify(aparte.problemas));
  });
});

describe('tipografías especiales y fuentes de trazo fino', () => {
  it('derretida o antigua sobre una didona de alto contraste avisa y pinta limpio; papel sí se aplica', async () => {
    const didona = (tipo: string) =>
      Intencion.parse({
        ...intencion([fondo, titular({ texto: 'Mesón', tratamiento: { receta: tipo } })]),
        tokens: { colores: { queso: '#F2C14E', cacao: '#2A1A12' }, estilos: { cartel: { fuente: 'bodoni-moda-italica', ejes: { wght: 600 }, caso: 'tal-cual', tracking: 0, interlineado: 1, color: '@queso' } } },
      });
    for (const tipo of ['derretida', 'antigua']) {
      const r = await compositor.resolver(didona(tipo), {});
      assert.ok(r.problemas.some((p) => p.tipo === 'TRATAMIENTO' && /alto-contraste/.test(p.mensaje)), tipo);
      assert.ok(r.capas.every((c) => c.tipo !== 'texto' || !c.tratamiento), `${tipo} se pinta limpio`);
    }
    const papel = await compositor.resolver(didona('papel'), {});
    assert.ok(papel.capas.some((c) => c.tipo === 'texto' && c.tratamiento?.receta.id === 'papel'));
  });
});

describe('contraste por líneas', () => {
  it('una línea sobre fondo malo no se esconde detrás de otra sobre fondo bueno', async () => {
    const t = { id: 't', tipo: 'texto', texto: 'PULPO A LA GALLEGA\nI', estilo: 'cartel', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }, ajuste: 'ancho', color: '@negro' };
    // Primero se mira dónde caen las dos líneas; el fondo oscuro empieza entre una y otra.
    const previo = (await compositor.resolver(intencion([{ id: 'claro', tipo: 'relleno', color: '@papel' }, t]), {})).capas.find((c) => c.tipo === 'texto')!;
    assert.ok(previo.tipo === 'texto' && previo.lineas.length === 2, 'dos líneas');
    const l1 = previo.lineas[0]!;
    const l2 = previo.lineas[1]!;
    // Las líneas base van en el sistema del bloque: la matriz las lleva al lienzo.
    const corte = previo.matriz[5] + (l1.base + l2.base - motor.alturaMayusculas(previo.estilo, l2.tamano)) / 2;
    const capas = [
      { id: 'claro', tipo: 'relleno', color: '@papel' },
      { id: 'oscuro', tipo: 'forma', figura: 'rect', caja: { x: 0, y: corte / ALTO, w: 1, h: 1 - corte / ALTO }, color: '#202020' },
      t,
    ];
    const resuelto = await compositor.resolver(intencion(capas), {});
    const { contraste } = await compositor.renderizar(resuelto, {});
    // La primera línea tiene contraste de sobra; la segunda, casi ninguno: manda la peor.
    assert.ok(contraste.t! < 1.6, `cuenta la peor línea (${contraste.t})`);
  });
});

describe('derretida en varias líneas', () => {
  it('las gotas de una línea no caen sobre la de debajo', async () => {
    const dos = { id: 't', tipo: 'texto', texto: 'CASA\nARANDA', estilo: 'cartel', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }, ajuste: 'ancho', tratamiento: { receta: 'derretida', parametros: { gotas: 1, largo: 1.2 } } };
    const limpio = { ...dos, tratamiento: undefined };
    const resuelto = await compositor.resolver(intencion([fondo, limpio]), {});
    const t = resuelto.capas.find((c) => c.tipo === 'texto')!;
    assert.ok(t.tipo === 'texto' && t.lineas.length === 2);
    // Entre la base de la primera línea y el techo de la segunda solo puede haber gotas, y ninguna llega a tocarla.
    const techo = t.matriz[5] + t.lineas[1]!.base - motor.alturaMayusculas(t.estilo, t.lineas[1]!.tamano);
    const alfa = await alfaDe((await pintar(intencion([fondo, dos]))).render, 't');
    const sinGotas = await alfaDe((await pintar(intencion([fondo, limpio]))).render, 't');
    // Los vértices de la A ya asoman un poco por encima de la altura de mayúscula: se compara con el texto limpio.
    const franja = (a: Uint8Array) => tintaEntre(a, Math.round(techo) - 10, Math.round(techo));
    // Sin el límite, las gotas meten unas 900 unidades de tinta en esa franja; el filtro solo suaviza el canto (~100).
    assert.ok(franja(alfa) - franja(sinGotas) < 250, `el hueco encima de la segunda línea queda limpio (${franja(alfa).toFixed(0)} vs ${franja(sinGotas).toFixed(0)})`);
  });
});
