/**
 * Edición fina de la letra (Fase B, `forma` en la capa de texto): escala horizontal y vertical, inclinación, espaciado
 * por línea y ajustes por letra. Lo que se comprueba es la coherencia: la misma geometría al ajustar el bloque, al
 * pintar, en los tratamientos, en las comprobaciones de letra y en el SVG exacto. Y que, sin forma, todo pinta
 * exactamente lo mismo que antes (hashes tomados con el código anterior a la Fase B). Activos sintéticos, sin gasto.
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
import { FormaTexto, Intencion } from '../src/dominio/diseno/intencion.js';
import type { CapaResuelta, Resuelto } from '../src/dominio/diseno/resuelto.js';
import type { ActivoDisponible, Renderizado } from '../src/puertos/Compositor.js';

const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
const motor = new MotorTexto(catalogo);
const compositor = new CompositorSharp(motor, catalogo);
const ANCHO = 1080;
const ALTO = 1440;
const h16 = (x: string | Buffer) => createHash('sha256').update(x).digest('hex').slice(0, 16);

const TOKENS = {
  colores: { a: '#F2C14E', b: '#2A1A12', c: '#EFE6D2' },
  estilos: {
    cartel: { fuente: 'bebas-neue', ejes: {}, caso: 'mayusculas', tracking: 0.01, interlineado: 0.9, color: '@a' },
    fr: { fuente: 'fraunces', ejes: { opsz: 144, wght: 800, SOFT: 100 }, caso: 'tal-cual', tracking: -0.02, interlineado: 0.95, color: '@a' },
    any: { fuente: 'anybody', ejes: { wdth: 100, wght: 900 }, caso: 'mayusculas', tracking: -0.01, interlineado: 0.85, color: '@c' },
    arch: { fuente: 'archivo', ejes: { wdth: 100, wght: 600 }, caso: 'mayusculas', tracking: 0.14, interlineado: 1.3, color: '@c', rasgos: [] },
    script: { fuente: 'kaushan-script', ejes: {}, caso: 'tal-cual', tracking: 0, interlineado: 1.1, color: '@a' },
    lora: { fuente: 'lora', ejes: { wght: 500 }, caso: 'tal-cual', tracking: 0, interlineado: 1.25, color: '@c', rasgos: ['smcp'] },
  },
};

function intencion(id: string, capas: unknown[], activos: Record<string, string> = {}): Intencion {
  return Intencion.parse({ esquema: 'diseno/intencion@1', id, titulo: id, marca: 'prueba', activos, tokens: TOKENS, capas });
}

const fondo = { id: 'fondo', tipo: 'relleno', color: '@b' };
const t = (extra: Record<string, unknown> = {}) => ({ id: 't', tipo: 'texto', texto: 'ENTRECOT', estilo: 'cartel', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.15 }, ajuste: 'ancho', ...extra });
const texto = (r: Resuelto, id = 't') => r.capas.find((c) => c.id === id) as Extract<CapaResuelta, { tipo: 'texto' }>;

async function pintar(i: Intencion, activos: Record<string, ActivoDisponible> = {}): Promise<{ resuelto: Resuelto; render: Renderizado }> {
  const resuelto = await compositor.resolver(i, activos);
  return { resuelto, render: await compositor.renderizar(resuelto, activos) };
}

/** Columnas y filas extremas con tinta de una capa (alfa > 128). */
async function tintaDe(render: Renderizado, id: string): Promise<{ x0: number; x1: number; y0: number; y1: number }> {
  const alfa = await sharp(render.capas.find((c) => c.id === id)!.png).ensureAlpha().extractChannel(3).raw().toBuffer();
  let x0 = ANCHO;
  let x1 = -1;
  let y0 = ALTO;
  let y1 = -1;
  for (let y = 0; y < ALTO; y++)
    for (let x = 0; x < ANCHO; x++)
      if (alfa[y * ANCHO + x]! > 128) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return { x0, x1, y0, y1 };
}

describe('forma: sin ella, nada cambia', () => {
  // Hashes (sha256, 16 primeros hex) del PNG, del SVG exacto y del editable, tomados con el código ANTERIOR a la Fase B
  // (commit 5514032) con estas mismas intenciones. Si la forma tocara el camino de siempre, cambiarían. El del editable
  // se volvió a tomar cuando el SVG editable pasó a llevar rellenos y formas como vectores, y todos los ejes y rasgos.
  const ESCENARIOS: Record<string, { capas: unknown[]; hashes: [string, string, string] }> = {
    ancho: { capas: [fondo, t()], hashes: ['32381c247502acab', '8abc3bc3688dfd45', 'e56a566788ad6498'] },
    'ancho-por-linea': { capas: [fondo, t({ texto: 'Pulpo a la\nbrasa', estilo: 'fr', ajuste: 'ancho-por-linea', caja: { x: 0.1, y: 0.2, w: 0.8, h: 0.4 } })], hashes: ['9e3ccdda5043a5c4', '94e776dbc8b671d2', '8cc120edb820a751'] },
    'eje-ancho': { capas: [fondo, t({ texto: 'MESON\nLO GUENO', estilo: 'any', ajuste: 'eje-ancho', caja: { x: 0.1, y: 0.2, w: 0.8, h: 0.3 } })], hashes: ['20a5752cf0fe061c', '747e7ee3e2d85994', '8c1ce020220e0b77'] },
    caja: {
      capas: [fondo, t({ texto: 'Churros con chocolate de la casa desde mil novecientos treinta y dos', estilo: 'arch', ajuste: 'caja', caja: { x: 0.1, y: 0.5, w: 0.6, h: 0.3 }, alinear: 'derecha', vertical: 'abajo' })],
      hashes: ['f8af9fa24cb25686', 'a76ba390a62a7a2c', 'f9b1b2ba81dd47b4'],
    },
    fijo: { capas: [fondo, t({ texto: 'Una mesa larga para comer en familia los domingos', estilo: 'lora', ajuste: 'fijo', tamano: 64, caja: { x: 0.1, y: 0.6, w: 0.7, h: 0.3 } })], hashes: ['2450f2f0c4de9e09', '73d5c228f5c9a705', 'f5609fee5cd324d6'] },
    // La semilla de la derretida sale del id de la intención: tiene que ser el mismo que el de entonces.
    derretida2: { capas: [fondo, t({ texto: 'CASA\nARANDA', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }, tratamiento: { receta: 'derretida', parametros: { gotas: 1, largo: 1.2 } } })], hashes: ['edd0d061e2b9f8fc', '2910bbef413191af', 'c5e19add5e98d874'] },
    papel: { capas: [fondo, t({ estilo: 'fr', texto: 'Café Albor', tratamiento: { receta: 'papel' } })], hashes: ['bbba71128d2c589e', '031eb5d7d1399962', 'c831661301e4ef46'] },
    corte: { capas: [fondo, t({ corte: { en: 0.5, angulo: 8, desplazamiento: 20, separacion: 6 } })], hashes: ['c749a6fb06cc49b4', '160104041b521987', 'e56a566788ad6498'] },
  };

  for (const [nombre, { capas, hashes }] of Object.entries(ESCENARIOS)) {
    it(`${nombre}: los mismos píxeles y los mismos SVG que antes de la Fase B`, async () => {
      const { render } = await pintar(intencion(`esc-${nombre}`, capas));
      assert.deepEqual([h16(render.png), h16(render.svgExacto), h16(render.svgEditable)], hashes);
    });
  }

  it('una forma neutra (todo a su valor por defecto) pinta lo mismo que no tenerla', async () => {
    const sin = await pintar(intencion('neutra', [fondo, t()]));
    const neutra = await pintar(intencion('neutra', [fondo, t({ forma: { escalaX: 1, letras: [{ indice: 2 }] } })]));
    assert.equal(h16(neutra.render.png), h16(sin.render.png));
    assert.equal(texto(neutra.resuelto).estilo.forma, undefined);
  });
});

describe('forma: la misma geometría al medir, ajustar y pintar', () => {
  it('escalaX estrecha la letra: con ajuste «ancho» el cuerpo crece y el bloque sigue ocupando justo la caja', async () => {
    const normal = texto((await pintar(intencion('ex', [fondo, t()]))).resuelto);
    const { resuelto, render } = await pintar(intencion('ex', [fondo, t({ forma: { escalaX: 0.85 } })]));
    const estrecha = texto(resuelto);
    assert.ok(estrecha.tamano > normal.tamano * 1.12, `${normal.tamano} → ${estrecha.tamano}`);
    assert.ok(Math.abs(estrecha.caja.w - 864) < 0.5, `ancho del bloque ${estrecha.caja.w}`);
    // Lo pintado ocupa lo medido.
    const tinta = await tintaDe(render, 't');
    assert.ok(Math.abs(tinta.x0 - estrecha.caja.x) <= 2 && Math.abs(tinta.x1 + 1 - (estrecha.caja.x + estrecha.caja.w)) <= 2, JSON.stringify({ tinta, caja: estrecha.caja }));
  });

  it('inclinación y ajustes por letra: la caja medida es la de la tinta pintada', async () => {
    const forma = { inclinacion: 12, letras: [{ indice: 0, escala: 1.4 }, { indice: 3, dy: 0.12, giro: -12 }, { indice: 5, dx: 0.15 }, { indice: 7, giro: 18, dy: -0.06 }] };
    const { resuelto, render } = await pintar(intencion('in', [fondo, t({ forma })]));
    const c = texto(resuelto);
    assert.ok(Math.abs(c.caja.w - 864) < 0.5);
    const tinta = await tintaDe(render, 't');
    for (const [pintado, medido] of [
      [tinta.x0, c.caja.x],
      [tinta.x1 + 1, c.caja.x + c.caja.w],
      [tinta.y0, c.caja.y],
      [tinta.y1 + 1, c.caja.y + c.caja.h],
    ] as const)
      assert.ok(Math.abs(pintado - medido) <= 2, `pintado ${pintado} y medido ${medido} (${JSON.stringify({ tinta, caja: c.caja })})`);
  });

  it('escalaY cambia la altura de mayúscula: el ajuste «alto» da un cuerpo mayor y las mayúsculas llenan la caja', async () => {
    const caja = { x: 0.1, y: 0.3, w: 0.8, h: 0.1 };
    const normal = texto((await pintar(intencion('ey', [fondo, t({ ajuste: 'alto', caja })]))).resuelto);
    const { resuelto, render } = await pintar(intencion('ey', [fondo, t({ ajuste: 'alto', caja, forma: { escalaY: 0.88 } })]));
    const baja = texto(resuelto);
    assert.ok(Math.abs(baja.tamano * 0.88 - normal.tamano) < 0.01, `${normal.tamano} y ${baja.tamano}`);
    assert.ok(Math.abs(motor.alturaMayusculas(baja.estilo, baja.tamano) - motor.alturaMayusculas(normal.estilo, normal.tamano)) < 0.01);
    // La tinta mide lo mismo de alto que sin forma (las mayúsculas llenan la caja; la C y la O sobresalen igual).
    const sinForma = await tintaDe((await pintar(intencion('ey', [fondo, t({ ajuste: 'alto', caja })]))).render, 't');
    const tinta = await tintaDe(render, 't');
    assert.ok(Math.abs(tinta.y1 - tinta.y0 - (sinForma.y1 - sinForma.y0)) <= 2, `alto de la tinta ${tinta.y1 - tinta.y0} y sin forma ${sinForma.y1 - sinForma.y0}`);
  });

  it('trackingPorLinea: cada línea con su espaciado; uno por línea o un error claro', async () => {
    const dos = { texto: 'CASA\nARANDA', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }, ajuste: 'fijo', tamano: 200 };
    const sin = texto((await pintar(intencion('tl', [fondo, t(dos)]))).resuelto);
    const con = texto((await pintar(intencion('tl', [fondo, t({ ...dos, forma: { trackingPorLinea: [0.2, 0.01] } })]))).resuelto);
    // CASA tiene 4 letras: 3 huecos de (0,2 − 0,01) em a 200 px.
    assert.ok(Math.abs(con.lineas[0]!.ancho - sin.lineas[0]!.ancho - 3 * 0.19 * 200) < 0.5, `${sin.lineas[0]!.ancho} → ${con.lineas[0]!.ancho}`);
    assert.equal(con.lineas[1]!.ancho, sin.lineas[1]!.ancho);
    await assert.rejects(pintar(intencion('tl', [fondo, t({ ...dos, forma: { trackingPorLinea: [0.2] } })])), /trackingPorLinea tiene 1 valor\(es\) y el texto sale en 2 línea\(s\)/);
  });

  it('los ajustes por letra cuentan las letras sin espacios y a través de las líneas; fuera de rango es un error claro', async () => {
    // «PULPO A\nFEIRA»: la A suelta es la 5 y la F la 6.
    const base = { texto: 'PULPO A\nFEIRA', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.3 }, ajuste: 'fijo', tamano: 180 };
    const r = texto((await pintar(intencion('ix', [fondo, t({ ...base, forma: { letras: [{ indice: 6, dy: 0.3 }] } })]))).resuelto);
    const glifos = motor.glifosDeBloque(r.estilo, r.lineas);
    const sin = motor.glifosDeBloque({ ...r.estilo, forma: undefined }, r.lineas);
    const movidas = glifos.flat().filter((g, i) => g.caja.y0 !== sin.flat()[i]!.caja.y0).map((g) => g.caracter);
    assert.deepEqual(movidas, ['F']);
    await assert.rejects(pintar(intencion('ix', [fondo, t({ ...base, forma: { letras: [{ indice: 11 }, { indice: 12, dy: 0.1 }] } })])), /ajusta la letra 11, 12, pero «PULPO A \/ FEIRA» tiene 11 letras \(de la 0 a la 10/);
    assert.throws(() => FormaTexto.parse({ letras: [{ indice: 2, dy: 0.1 }, { indice: 2, giro: 5 }] }), /indice» repetido/);
    assert.throws(() => FormaTexto.parse({ escalaX: 1.3 }));
    assert.throws(() => FormaTexto.parse({ letras: [{ indice: 0, giro: 40 }] }));
  });

  it('una letra agrandada empuja a las siguientes (no se monta) y el trazo es la suma de sus letras', () => {
    const estilo = { fuente: 'bebas-neue', ejes: {}, tracking: 0.01 };
    const normal = motor.glifos(estilo, 'PULPO', 200, 0, 300);
    const forma = FormaTexto.parse({ letras: [{ indice: 1, escala: 1.4 }] });
    const grande = motor.glifos({ ...estilo, forma }, 'PULPO', 200, 0, 300);
    assert.ok(grande[2]!.caja.x0 - grande[1]!.caja.x1 >= normal[2]!.caja.x0 - normal[1]!.caja.x1 - 0.01, 'el hueco entre la U y la L no se cierra');
    assert.ok(Math.abs(grande[1]!.caja.y1 - normal[1]!.caja.y1) < 1 && grande[1]!.caja.y0 < normal[1]!.caja.y0 - 30, 'crece desde su pie');
    assert.equal(grande.map((g) => g.d).join(''), motor.trazar({ ...estilo, forma }, 'PULPO', 200, 0, 300));
    assert.ok(motor.avance({ ...estilo, forma }, 'PULPO', 200) > motor.avance(estilo, 'PULPO', 200) + 30);
  });

  it('el SVG exacto lleva la letra transformada (igual que el PNG); el editable, la escala y la inclinación en el <text>', async () => {
    const forma = { escalaX: 0.9, inclinacion: 10, trackingPorLinea: [0.05], letras: [{ indice: 3, dy: 0.1 }] };
    const { render } = await pintar(intencion('svg', [fondo, t({ forma })]));
    const exacto = await sharp(Buffer.from(render.svgExacto)).removeAlpha().raw().toBuffer();
    const png = await sharp(render.png).removeAlpha().raw().toBuffer();
    let distintos = 0;
    for (let i = 0; i < png.length; i++) if (Math.abs(png[i]! - exacto[i]!) > 8) distintos++;
    assert.ok(distintos / png.length < 0.001, `${distintos} canales distintos`);
    assert.match(render.svgEditable, /<text transform="translate\([^)]*\) skewX\(-10\) scale\(0\.9 1\)"[^>]*letter-spacing="/);
  });
});

describe('forma: las comprobaciones miden la letra donde queda', () => {
  let carpeta: string;
  let disco: ActivoDisponible;
  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-forma-'));
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

  it('LETRA_PERDIDA: una letra que la escala horizontal saca del lienzo se detecta (sin forma, cabe)', async () => {
    // A 300 px, ENTRECOT mide 925 px: desde x = 130 cabe entero; con la letra un 15 % más ancha, la T se sale.
    const sangra = t({ ajuste: 'fijo', tamano: 300, caja: { x: 0.12, y: 0.3, w: 0.8, h: 0.2 }, sangrado: true });
    const sin = await compositor.resolver(intencion('lp', [fondo, sangra]), {});
    assert.ok(!sin.problemas.some((p) => p.tipo === 'LETRA_PERDIDA'), JSON.stringify(sin.problemas));
    const con = await compositor.resolver(intencion('lp', [fondo, { ...sangra, forma: { escalaX: 1.15, letras: [{ indice: 7, dx: 0.3 }] } }]), {});
    const error = con.problemas.find((p) => p.tipo === 'LETRA_PERDIDA');
    assert.ok(error && error.gravedad === 'ERROR', JSON.stringify(con.problemas));
    assert.match(error.mensaje, /«T»/);
  });

  it('LETRA_TAPADA: una letra que se baja sobre el plato se detecta (sin bajarla, el plato no la toca)', async () => {
    const sujeto = { id: 's', tipo: 'recorte', activo: 'disco', escala: { anchoSujeto: 0.4 }, ancla: { caja: { x: 0, y: 0, w: 1, h: 1 }, alinear: 'centro' }, bordeSuave: 0 };
    // ENTRECOT a 150 px con su segunda E justo encima del centro del disco (que empieza en y = 504): sin forma, libre.
    const encima = t({ ajuste: 'fijo', tamano: 150, caja: { x: 0.257, y: 0.2708, w: 0.6, h: 0.1 } });
    const libre = await compositor.resolver(intencion('lt', [fondo, encima, sujeto], { disco: 'disco' }), { disco });
    assert.ok(!libre.problemas.some((p) => p.tipo === 'LETRA_TAPADA'), JSON.stringify(libre.problemas));
    const bajada = await compositor.resolver(intencion('lt', [fondo, { ...encima, forma: { letras: [{ indice: 4, dy: -0.5 }] } }, sujeto], { disco: 'disco' }), { disco });
    const aviso = bajada.problemas.find((p) => p.tipo === 'LETRA_TAPADA');
    assert.ok(aviso, JSON.stringify(bajada.problemas));
    assert.match(aviso.mensaje, /la «E»/);
  });

  it('SEPARACION: la letra más alta (escalaY) acerca dos textos apilados y se avisa', async () => {
    const arriba = t({ ajuste: 'fijo', tamano: 150, caja: { x: 0.1, y: 0.2, w: 0.8, h: 0.2 } });
    // 175 px entre los techos de mayúscula: con mayúsculas de 105 px quedan unos 68 px de aire (el mínimo es 52,5).
    const abajo = { ...t({ ajuste: 'fijo', tamano: 150, caja: { x: 0.1, y: 0.2 + 175 / ALTO, w: 0.8, h: 0.2 } }), id: 'u', texto: 'DE VACA' };
    const sin = await compositor.resolver(intencion('se', [fondo, arriba, abajo]), {});
    assert.ok(!sin.problemas.some((p) => p.tipo === 'SEPARACION'), JSON.stringify(sin.problemas));
    const con = await compositor.resolver(intencion('se', [fondo, { ...arriba, forma: { escalaY: 1.15, letras: [{ indice: 2, dy: -0.15 }] } }, abajo]), {});
    assert.ok(con.problemas.some((p) => p.tipo === 'SEPARACION'), JSON.stringify(con.problemas));
  });

  it('el tratamiento recibe las letras con su forma: la antigua sobre una letra estrecha ocupa menos', async () => {
    const fijo = t({ ajuste: 'fijo', tamano: 220, caja: { x: 0.05, y: 0.3, w: 0.9, h: 0.2 }, tratamiento: { receta: 'antigua' } });
    const ancha = await tintaDe((await pintar(intencion('tr', [fondo, fijo]))).render, 't');
    const estrecha = await tintaDe((await pintar(intencion('tr', [fondo, { ...fijo, forma: { escalaX: 0.85 } }]))).render, 't');
    const proporcion = (estrecha.x1 - estrecha.x0) / (ancha.x1 - ancha.x0);
    assert.ok(proporcion > 0.84 && proporcion < 0.88, `proporción ${proporcion.toFixed(3)}`);
  });
});
