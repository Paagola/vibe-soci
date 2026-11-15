/**
 * F3 · Lo que se ha añadido al esquema de intención y al compositor: giro libre, tinta impresa, corte tipográfico,
 * capas recortadas por el sujeto, sello, patrón, trazo a mano, duotono, trama, desenfoque, papel, rasgos OpenType,
 * las fuentes nuevas y las medidas de oficio.
 * Activos sintéticos creados aquí: no depende de datos/ ni gasta. Se comprueba lo que hace el motor midiendo los
 * píxeles que pinta; la calidad visual se revisa a ojo (diseno/f3/).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { CompositorSharp } from '../src/adaptadores/compositor/CompositorSharp.js';
import { trazadoEstrella, trazadoMancha } from '../src/adaptadores/compositor/formas.js';
import { MotorTexto } from '../src/adaptadores/compositor/MotorTexto.js';
import { ALTURA_MINIMA_PARA_TINTA } from '../src/adaptadores/compositor/resolutor.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { radioParaCobertura, tramar } from '../src/adaptadores/compositor/tramado.js';
import { pincelada, trazarGesto } from '../src/adaptadores/compositor/trazoAMano.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { RAIZ } from '../src/config.js';
import type { Activo } from '../src/dominio/activos.js';
import { mulberry32, ruidoDeValor, semillaDe } from '../src/dominio/diseno/azar.js';
import { colorVivo, contraste, hexARgb, mejorTinta, mezclar, oklabARgb, paletaDominante, rgbAOklab, temperaturaDe } from '../src/dominio/diseno/color.js';
import { Intencion } from '../src/dominio/diseno/intencion.js';
import { medirOficio, nivelesDeTamano, problemasDeOficio, SALTO_DE_ESCALA_MINIMO } from '../src/dominio/diseno/oficio.js';
import type { CapaResuelta } from '../src/dominio/diseno/resuelto.js';
import type { ActivoDisponible, Renderizado } from '../src/puertos/Compositor.js';

const carpetaFuentes = join(RAIZ, 'recursos', 'tipografias');
const catalogo = new CatalogoTipografico(carpetaFuentes);
const motor = new MotorTexto(catalogo);
const compositor = new CompositorSharp(motor, catalogo);
const ANCHO = 1080;
const ALTO = 1440;

let carpeta: string;
let barra: ActivoDisponible;
let disco: ActivoDisponible;

async function crear(id: string, ancho: number, alto: number, figura: string, bbox: { x: number; y: number; w: number; h: number }): Promise<ActivoDisponible> {
  const dir = join(carpeta, 'locales', 'prueba', 'activos', id);
  await mkdir(dir, { recursive: true });
  const svg = (relleno: string, fondo: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="${fondo}"/>${figura.replace('RELLENO', relleno)}</svg>`);
  await sharp(svg('#c0392b', '#777777')).png().toFile(join(dir, 'original.png'));
  await sharp(svg('#ffffff', '#000000')).greyscale().png().toFile(join(dir, 'mascara.png'));
  const sha = createHash('sha256').update(await readFile(join(dir, 'original.png'))).digest('hex');
  const activo: Activo = {
    id,
    localSlug: 'prueba',
    tipo: 'REAL',
    uso: 'PUBLICABLE',
    descripcion: 'activo sintético',
    archivo: 'original.png',
    ancho,
    alto,
    sha256: sha,
    procedencia: { ruta: 'test', sha256: sha, copiadoEn: '2026-11-13T00:00:00Z' },
    alteraciones: [],
    mascara: { archivo: 'mascara.png', metodo: 'MANUAL', creadaEn: '2026-11-13T00:00:00Z', bbox, incluye: 'la figura' },
    niveles: [],
  };
  await writeFile(join(dir, 'activo.json'), JSON.stringify(activo));
  return new AlmacenActivosFicheros(join(carpeta, 'locales')).obtener('prueba', id);
}

function intencion(capas: unknown[], activos: Record<string, string> = {}, extra: Record<string, unknown> = {}): Intencion {
  return Intencion.parse({
    esquema: 'diseno/intencion@1',
    id: 'prueba-f3',
    titulo: 'prueba',
    marca: 'prueba',
    activos,
    tokens: {
      colores: { rojo: '#FF3B1F', negro: '#0B0B0B', papel: '#EFE6D6' },
      estilos: {
        cartel: { fuente: 'anybody', ejes: { wdth: 75, wght: 900 }, caso: 'mayusculas', tracking: 0, interlineado: 0.9, color: '@negro' },
        pequeno: { fuente: 'archivo', ejes: { wdth: 100, wght: 600 }, caso: 'mayusculas', tracking: 0.1, interlineado: 1.3, color: '@negro' },
        mano: { fuente: 'caveat', ejes: { wght: 600 }, caso: 'tal-cual', tracking: 0, interlineado: 1.1, color: '@negro' },
      },
    },
    capas,
    ...extra,
  });
}

const cargados = () => ({ barra, disco });

async function pintar(i: Intencion): Promise<{ render: Renderizado; capas: CapaResuelta[]; problemas: string[] }> {
  const usados = Object.fromEntries(Object.entries(i.activos).map(([papel, id]) => [papel, id === 'barra' ? barra : disco]));
  const resuelto = await compositor.resolver(i, usados);
  return { render: await compositor.renderizar(resuelto, usados), capas: resuelto.capas, problemas: resuelto.problemas.map((p) => `${p.tipo}:${p.capa ?? ''}`) };
}

/** El alfa de una capa pintada (0–255 por píxel). */
async function alfaDe(render: Renderizado, id: string): Promise<Uint8Array> {
  const capa = render.capas.find((c) => c.id === id);
  assert.ok(capa, `no se pintó la capa «${id}»`);
  return new Uint8Array(await sharp(capa.png).ensureAlpha().extractChannel(3).raw().toBuffer());
}

/** Caja de lo pintado y cuánta tinta hay (suma de alfa, en píxeles enteros). */
function medir(alfa: Uint8Array, umbral = 40): { x0: number; y0: number; x1: number; y1: number; w: number; h: number; tinta: number } {
  let x0 = ANCHO;
  let y0 = ALTO;
  let x1 = -1;
  let y1 = -1;
  let tinta = 0;
  for (let y = 0; y < ALTO; y++) {
    for (let x = 0; x < ANCHO; x++) {
      const a = alfa[y * ANCHO + x]!;
      tinta += a / 255;
      if (a > umbral) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, tinta };
}

const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const fondo = { id: 'fondo', tipo: 'relleno', color: '@papel' };

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-f3-'));
  // Una barra de pie (para ver un giro) y un disco (para recortar capas con él).
  barra = await crear('barra', 400, 800, '<rect x="140" y="100" width="120" height="600" fill="RELLENO"/>', { x: 140, y: 100, w: 120, h: 600 });
  disco = await crear('disco', 1000, 1000, '<circle cx="500" cy="500" r="300" fill="RELLENO"/>', { x: 200, y: 200, w: 600, h: 600 });
  void cargados;
});

after(() => rm(carpeta, { recursive: true, force: true }));

describe('F3 · azar determinista', () => {
  it('la misma semilla da la misma secuencia, y la semilla de un texto es estable', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
    assert.equal(semillaDe('post:titular'), semillaDe('post:titular'));
    assert.notEqual(semillaDe('post:titular'), semillaDe('post:apoyo'));
  });

  it('el ruido de valor es continuo, está entre 0 y 1 y no depende del orden en que se pida', () => {
    const ruido = ruidoDeValor(7);
    let mayorSalto = 0;
    for (let i = 0; i < 400; i++) {
      const v = ruido(i / 40, 0.3);
      assert.ok(v >= 0 && v <= 1);
      mayorSalto = Math.max(mayorSalto, Math.abs(v - ruido((i + 1) / 40, 0.3)));
    }
    assert.ok(mayorSalto < 0.08, `salto de ${mayorSalto} entre dos puntos pegados`);
    assert.equal(ruido(3.2, 1.7), ruidoDeValor(7)(3.2, 1.7));
  });
});

describe('F3 · color', () => {
  it('contraste WCAG: 21 entre blanco y negro, 1 entre un color y sí mismo', () => {
    assert.ok(Math.abs(contraste('#FFFFFF', '#000000') - 21) < 0.01);
    assert.equal(contraste('#C8261D', '#C8261D'), 1);
  });

  it('OKLab va y vuelve sin perder el color, y mezclar en él da un punto medio limpio', () => {
    for (const hex of ['#FF3B1F', '#2F5D50', '#EDE7DD', '#111111']) {
      const vuelta = oklabARgb(rgbAOklab(hexARgb(hex)));
      hexARgb(hex).forEach((v, i) => assert.ok(Math.abs(v - vuelta[i]!) < 1, `${hex}: canal ${i}`));
    }
    assert.equal(mezclar('#000000', '#FFFFFF', 0), '#000000');
    // El punto medio perceptual entre negro y blanco es un gris medio (L ≈ 0,5), más claro que el #808080 de RGB lineal no: en torno a #636363.
    const medio = hexARgb(mezclar('#000000', '#FFFFFF', 0.5));
    assert.ok(medio[0] > 85 && medio[0] < 115 && medio[0] === medio[1] && medio[1] === medio[2], `gris ${medio.join(',')}`);
  });

  it('saca la paleta dominante de una imagen, con sus pesos, y siempre la misma', () => {
    // 70 % rojo, 25 % crema y 5 % verde, con un poco de variación.
    const pixeles = new Uint8Array(2000 * 3);
    const azar = mulberry32(5);
    for (let i = 0; i < 2000; i++) {
      const base = i < 1400 ? [200, 40, 30] : i < 1900 ? [240, 230, 210] : [40, 160, 70];
      for (let c = 0; c < 3; c++) pixeles[i * 3 + c] = Math.max(0, Math.min(255, base[c]! + Math.round((azar() - 0.5) * 12)));
    }
    const paleta = paletaDominante(pixeles, 5);
    assert.deepEqual(paleta, paletaDominante(pixeles, 5), 'determinista');
    assert.ok(paleta.length >= 3 && paleta.length <= 5);
    assert.ok(Math.abs(paleta[0]!.peso - 0.7) < 0.03, `peso del rojo ${paleta[0]!.peso}`);
    assert.equal(temperaturaDe(paleta[0]!.hex), 'CALIDA');
    const [r, g, b] = hexARgb(paleta[0]!.hex);
    assert.ok(r > 180 && g < 70 && b < 60, `el dominante es el rojo: ${paleta[0]!.hex}`);
    // El más vivo con peso suficiente es el rojo; el verde no llega al 4 %... con 5 % sí llega, y es menos vivo por área.
    assert.equal(colorVivo(paleta)!.hex, paleta[0]!.hex);
  });

  it('solo cuentan los píxeles válidos (los del sujeto), y una foto sin color vivo no da acento', () => {
    const pixeles = new Uint8Array([255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 255]);
    const soloRojo = paletaDominante(pixeles, 3, new Uint8Array([255, 0, 0, 0]));
    assert.equal(soloRojo.length, 1);
    assert.equal(soloRojo[0]!.hex, '#FF0000');
    const grises = new Uint8Array(300 * 3).map((_, i) => 90 + (i % 3 === 0 ? 4 : 0));
    assert.equal(colorVivo(paletaDominante(grises, 4)), undefined);
  });

  it('elige la tinta que más contrasta y dice cuándo ninguna llega', () => {
    assert.equal(mejorTinta('#111111', ['#EDE7DD', '#4A2414'])!.hex, '#EDE7DD');
    assert.equal(mejorTinta('#808080', ['#909090', '#707070']), undefined);
    assert.equal(temperaturaDe('#1E4F86'), 'FRIA');
  });
});

describe('F3 · giro libre', () => {
  it('un texto girado conserva su centro y su caja es la del bloque ya girado', async () => {
    const texto = (giro: number) => ({ id: 't', tipo: 'texto', texto: 'TORRE', estilo: 'cartel', caja: { x: 0.2, y: 0.4, w: 0.6, h: 0.1 }, ajuste: 'ancho', giro });
    const recto = await pintar(intencion([fondo, texto(0)]));
    const girado = await pintar(intencion([fondo, texto(90)]));
    const a = medir(await alfaDe(recto.render, 't'));
    const b = medir(await alfaDe(girado.render, 't'));
    // Girado 90°, lo ancho pasa a ser alto.
    assert.ok(Math.abs(a.w - b.h) <= 3 && Math.abs(a.h - b.w) <= 3, `${a.w}×${a.h} frente a ${b.w}×${b.h}`);
    // El giro es alrededor del centro de la caja de la intención (y la palabra va arriba en ella): mismo eje horizontal.
    assert.ok(Math.abs((a.x0 + a.x1) / 2 - 540) <= 2, 'el texto recto está centrado en su caja');
    const capa = girado.capas.find((c) => c.id === 't')!;
    assert.ok(capa.tipo === 'texto' && capa.giro === 90);
    assert.ok(Math.abs(capa.caja.w - b.w) <= 3 && Math.abs(capa.caja.h - b.h) <= 3, 'la caja resuelta es la pintada');
    assert.ok(Math.abs(capa.matriz[0] * capa.matriz[3] - capa.matriz[1] * capa.matriz[2] - 1) < 1e-9, 'la matriz es un giro puro');
  });

  it('un giro pequeño inclina el texto: el final queda más abajo que el principio (sentido horario)', async () => {
    const { render } = await pintar(intencion([fondo, { id: 't', tipo: 'texto', texto: 'TORRE TORRE', estilo: 'cartel', caja: { x: 0.1, y: 0.45, w: 0.8, h: 0.1 }, ajuste: 'ancho', giro: 8 }]));
    const alfa = await alfaDe(render, 't');
    const centroY = (desde: number, hasta: number) => {
      let suma = 0;
      let n = 0;
      for (let y = 0; y < ALTO; y++) for (let x = desde; x < hasta; x++) if (alfa[y * ANCHO + x]! > 128) (suma += y), n++;
      return suma / n;
    };
    assert.ok(centroY(700, 950) - centroY(120, 370) > 50, 'la derecha baja');
  });

  it('un recorte girado gira de verdad alrededor de su centro, y su sombra con él', async () => {
    const capas = (giro: number) => [
      fondo,
      { id: 'sombra', tipo: 'sombra', de: 'b', modo: 'proyectada', desenfoque: 0, desplazamiento: { x: 0, y: 0 } },
      { id: 'b', tipo: 'recorte', activo: 'barra', escala: { altoSujeto: 0.4 }, ancla: { caja: { x: 0, y: 0, w: 1, h: 1 }, alinear: 'centro' }, bordeSuave: 0, giro },
    ];
    const recta = await pintar(intencion(capas(0), { barra: 'barra' }));
    const girada = await pintar(intencion(capas(90), { barra: 'barra' }));
    const a = medir(await alfaDe(recta.render, 'b'));
    const b = medir(await alfaDe(girada.render, 'b'));
    assert.ok(a.h > a.w * 4, 'de pie es alta');
    assert.ok(Math.abs(a.w - b.h) <= 3 && Math.abs(a.h - b.w) <= 3, `girada 90° es ancha: ${b.w}×${b.h}`);
    assert.ok(Math.abs((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2) <= 2 && Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) <= 2, 'mismo centro');
    const sombra = medir(await alfaDe(girada.render, 'sombra'));
    assert.ok(Math.abs(sombra.w - b.w) <= 6 && Math.abs(sombra.h - b.h) <= 6, 'la sombra tiene la forma girada');
    assert.equal(recta.capas.find((c) => c.id === 'b')!.tipo === 'recorte' && 'giro' in recta.capas.find((c) => c.id === 'b')!, false, 'sin giro, el documento resuelto no cambia');
  });
});

describe('F3 · tinta impresa', () => {
  const palabra = (tinta?: unknown, tamano = 0.2) => ({ id: 't', tipo: 'texto', texto: 'BRASA', estilo: 'cartel', caja: { x: 0.1, y: 0.4, w: 0.8, h: tamano }, ajuste: 'ancho', ...(tinta ? { tinta } : {}) });

  it('quita un poco de tinta, de forma desigual, sin salirse de la letra, y siempre igual', async () => {
    const limpia = await pintar(intencion([fondo, palabra()]));
    const impresa = await pintar(intencion([fondo, palabra({ densidad: 0.1, bordeSeco: 0.03 })]));
    const a = await alfaDe(limpia.render, 't');
    const b = await alfaDe(impresa.render, 't');
    const antes = medir(a);
    const despues = medir(b);
    const perdida = 1 - despues.tinta / antes.tinta;
    assert.ok(perdida > 0.02 && perdida < 0.12, `pierde un ${(perdida * 100).toFixed(1)} % de tinta`);
    // No aparece tinta lejos de donde había letra (3 px de margen por el canto).
    assert.ok(despues.x0 >= antes.x0 - 3 && despues.x1 <= antes.x1 + 3 && despues.y0 >= antes.y0 - 3 && despues.y1 <= antes.y1 + 3);
    // Desigual: dentro de la letra el alfa ya no es uniforme.
    let dentro = 0;
    let rebajados = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === 255) (dentro++, b[i]! < 250 && rebajados++);
    assert.ok(rebajados / dentro > 0.3, 'la cobertura varía en buena parte de la letra');
    const otra = await new CompositorSharp(motor, catalogo).renderizar(await compositor.resolver(intencion([fondo, palabra({ densidad: 0.1, bordeSeco: 0.03 })]), {}), {});
    assert.equal(hash(otra.capas[1]!.png), hash(impresa.render.capas[1]!.png), 'misma capa, mismas marcas');
    const capa = impresa.capas.find((c) => c.id === 't')!;
    assert.ok(capa.tipo === 'texto' && capa.tinta?.semilla === semillaDe('prueba-f3:t'), 'la semilla sale de la identidad de la capa');
  });

  it('el registro añade una segunda impresión desplazada, en su color', async () => {
    const { render } = await pintar(intencion([fondo, palabra({ registro: { dx: 12, dy: 8, color: '@rojo', opacidad: 1 } })]));
    const limpia = await pintar(intencion([fondo, palabra()]));
    const a = medir(await alfaDe(limpia.render, 't'));
    const b = medir(await alfaDe(render, 't'));
    assert.ok(Math.abs(b.x1 - a.x1 - 12) <= 1 && Math.abs(b.y1 - a.y1 - 8) <= 1, 'la capa crece lo que se desplaza la segunda pasada');
    // Justo fuera de la letra, hacia abajo a la derecha, lo que se ve es el rojo.
    const png = render.capas.find((c) => c.id === 't')!.png;
    const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const i = ((a.y1 + 6) * ANCHO + a.x1 + 8) * 4;
    assert.deepEqual([data[i], data[i + 1], data[i + 2]], hexARgb('#FF3B1F'));
  });

  it('en un texto pequeño no se aplica y se avisa', async () => {
    const { capas, problemas } = await pintar(intencion([fondo, { id: 't', tipo: 'texto', texto: 'Asador Etxebarri', estilo: 'pequeno', caja: { x: 0.1, y: 0.4, w: 0.8, h: 0.05 }, ajuste: 'fijo', tamano: 40, tinta: { densidad: 0.1, bordeSeco: 0.03 } }]));
    const capa = capas.find((c) => c.id === 't')!;
    assert.ok(capa.tipo === 'texto' && capa.tinta === undefined);
    assert.ok(problemas.includes('TINTA:t'));
    assert.ok(motor.alturaMayusculas({ fuente: 'archivo', ejes: { wdth: 100, wght: 600 } }, 40) < ALTURA_MINIMA_PARA_TINTA);
  });
});

describe('F3 · corte tipográfico', () => {
  it('parte la palabra en dos mitades que se deslizan a lo largo del corte, sin perder tinta', async () => {
    const palabra = (corte?: unknown) => ({ id: 't', tipo: 'texto', texto: 'CRUJE', estilo: 'cartel', caja: { x: 0.1, y: 0.4, w: 0.8, h: 0.2 }, ajuste: 'ancho', ...(corte ? { corte } : {}) });
    const entera = medir(await alfaDe((await pintar(intencion([fondo, palabra()]))).render, 't'));
    // Corte vertical: una mitad sube y la otra baja 30 px cada una.
    const cortada = medir(await alfaDe((await pintar(intencion([fondo, palabra({ angulo: 90, en: 0.5, desplazamiento: 60 })]))).render, 't'));
    // Unos píxeles de holgura: las letras redondas sobresalen un poco, y al separarse ya no coinciden arriba y abajo.
    assert.ok(Math.abs(cortada.h - entera.h - 60) <= 6, `la altura crece lo que se deslizan: ${entera.h} → ${cortada.h}`);
    assert.ok(Math.abs(cortada.w - entera.w) <= 2, 'el ancho no cambia');
    assert.ok(Math.abs(cortada.tinta / entera.tinta - 1) < 0.02, 'la misma tinta');
    // Con separación, además se abre un hueco entre las dos mitades.
    const separada = medir(await alfaDe((await pintar(intencion([fondo, palabra({ angulo: 90, en: 0.5, desplazamiento: 0, separacion: 40 })]))).render, 't'));
    assert.ok(Math.abs(separada.w - entera.w - 40) <= 2, `el ancho crece con el hueco: ${entera.w} → ${separada.w}`);
  });
});

describe('F3 · capas recortadas por el sujeto', () => {
  const sujeto = { id: 's', tipo: 'recorte', activo: 'disco', escala: { anchoSujeto: 0.5 }, ancla: { caja: { x: 0, y: 0, w: 1, h: 1 }, alinear: 'centro' }, bordeSuave: 0, opacidad: 0 };
  const palabra = (modo?: string, extra: Record<string, unknown> = {}) => ({
    id: 't',
    tipo: 'texto',
    texto: 'BRASA',
    estilo: 'cartel',
    caja: { x: 0.05, y: 0.4, w: 0.9, h: 0.2 },
    ajuste: 'ancho',
    ...(modo ? { recortarCon: { sujeto: 's', modo } } : {}),
    ...extra,
  });

  it('«fuera» deja el texto solo donde no está el sujeto; «dentro», solo donde está; juntos son el texto entero', async () => {
    const entero = await alfaDe((await pintar(intencion([fondo, sujeto, palabra()], { disco: 'disco' }))).render, 't');
    const fuera = await alfaDe((await pintar(intencion([fondo, sujeto, palabra('fuera')], { disco: 'disco' }))).render, 't');
    const dentro = await alfaDe((await pintar(intencion([fondo, sujeto, palabra('dentro')], { disco: 'disco' }))).render, 't');
    // El disco está centrado en el lienzo y mide 540 px.
    // El disco mide 270 px de radio; se dejan unos píxeles a cada lado de su borde, que va suavizado.
    const enDisco = (x: number, y: number) => Math.hypot(x - 540, y - 720) < 264;
    const lejos = (x: number, y: number) => Math.hypot(x - 540, y - 720) > 276;
    let diferencia = 0;
    for (let y = 500; y < 940; y += 3) {
      for (let x = 60; x < 1020; x += 3) {
        const i = y * ANCHO + x;
        if (enDisco(x, y)) assert.equal(fuera[i], 0, `(${x}, ${y}) está tapado por el sujeto`);
        if (lejos(x, y)) assert.equal(dentro[i], 0, `(${x}, ${y}) queda fuera del sujeto`);
        diferencia = Math.max(diferencia, Math.abs(fuera[i]! + dentro[i]! - entero[i]!));
      }
    }
    assert.ok(diferencia <= 2, `las dos mitades suman el texto entero (${diferencia})`);
    assert.ok(medir(fuera).tinta > 1000 && medir(dentro).tinta > 1000, 'las dos tienen tinta');
  });

  it('el recorte invisible no pinta nada, pero sigue contando como sujeto en las medidas', async () => {
    const { render, capas } = await pintar(intencion([fondo, sujeto, palabra('fuera')], { disco: 'disco' }));
    assert.equal(medir(await alfaDe(render, 's')).tinta, 0);
    const resuelto = await compositor.resolver(intencion([fondo, sujeto, palabra('fuera')], { disco: 'disco' }), { disco });
    assert.ok(Math.abs(resuelto.medidas.oficio!.sujeto! - (540 * 540) / (ANCHO * ALTO)) < 0.005);
    assert.ok(capas.some((c) => c.id === 't' && c.tipo === 'texto' && c.recorte?.modo === 'fuera'));
  });

  it('también recorta formas y patrones (un bloque de color detrás del plato de una foto a sangre)', async () => {
    const bloque = { id: 'b', tipo: 'forma', figura: 'rect', caja: { x: 0, y: 0.3, w: 1, h: 0.4 }, color: '@rojo', recortarCon: { sujeto: 's', modo: 'fuera' } };
    const alfa = await alfaDe((await pintar(intencion([fondo, sujeto, bloque], { disco: 'disco' }))).render, 'b');
    assert.equal(alfa[720 * ANCHO + 540], 0, 'el centro del disco queda limpio');
    assert.equal(alfa[720 * ANCHO + 60], 255, 'fuera del disco está el bloque');
  });

  it('«cruza» avisa cuando el titular no toca al producto, y no cuando lo pisa', async () => {
    const visible = { ...sujeto, opacidad: 1 };
    const lejos = { ...palabra(), caja: { x: 0.1, y: 0.1, w: 0.8, h: 0.08 } };
    const relacion = [{ tipo: 'cruza', texto: 't', sujeto: 's', minimo: 0.1 }];
    const separado = await pintar(intencion([fondo, visible, lejos], { disco: 'disco' }, { relaciones: relacion }));
    assert.ok(separado.problemas.includes('CRUCE:t'));
    const encima = await pintar(intencion([fondo, visible, palabra()], { disco: 'disco' }, { relaciones: relacion }));
    assert.ok(!encima.problemas.includes('CRUCE:t'));
  });
});

describe('F3 · sello', () => {
  const sello = (extra: Record<string, unknown> = {}) => ({
    id: 's',
    tipo: 'sello',
    forma: 'circulo',
    centro: { x: 0.5, y: 0.5 },
    radio: 0.18,
    fondo: '@negro',
    color: '@papel',
    lineas: [{ texto: '1932', estilo: 'cartel', peso: 1 }],
    giro: 0,
    ...extra,
  });

  it('el texto del centro se ajusta solo: cabe dentro de la forma, y un texto más largo sale más pequeño', async () => {
    const corto = await pintar(intencion([fondo, sello()]));
    const largo = await pintar(intencion([fondo, sello({ lineas: [{ texto: 'desde 1932 en Málaga', estilo: 'cartel', peso: 1 }] })]));
    const a = corto.capas.find((c) => c.id === 's')!;
    const b = largo.capas.find((c) => c.id === 's')!;
    assert.ok(a.tipo === 'sello' && b.tipo === 'sello');
    assert.ok(a.lineas[0]!.tamano > b.lineas[0]!.tamano * 2, `${a.lineas[0]!.tamano} frente a ${b.lineas[0]!.tamano}`);
    const radio = 0.18 * ANCHO;
    for (const capa of [a, b]) {
      const linea = capa.lineas[0]!;
      const ancho = motor.medir(linea.estilo, linea.texto, linea.tamano).ancho;
      const mayuscula = motor.alturaMayusculas(linea.estilo, linea.tamano);
      // Las cuatro esquinas del texto quedan dentro del círculo.
      assert.ok(Math.hypot(ancho / 2, Math.max(Math.abs(linea.base), Math.abs(linea.base - mayuscula))) < radio, 'el texto cabe en el círculo');
    }
    // Y lo pintado no se sale del disco.
    const m = medir(await alfaDe(corto.render, 's'));
    assert.ok(Math.abs(m.w - 2 * radio) <= 4 && Math.abs(m.h - 2 * radio) <= 4, `el sello mide ${m.w}×${m.h}`);
  });

  it('con varias líneas, `peso` reparte el tamaño; y el anillo deja menos sitio al centro', async () => {
    const dos = (await pintar(intencion([fondo, sello({ lineas: [{ texto: 'desde', estilo: 'pequeno', peso: 0.4 }, { texto: '1932', estilo: 'cartel', peso: 1 }] })]))).capas.find((c) => c.id === 's')!;
    assert.ok(dos.tipo === 'sello' && dos.lineas.length === 2);
    const alturas = dos.lineas.map((l) => motor.alturaMayusculas(l.estilo, l.tamano));
    assert.ok(Math.abs(alturas[0]! / alturas[1]! - 0.4) < 0.01, 'la línea de peso 0,4 mide el 40 % de la grande');
    assert.ok(dos.lineas[0]!.base < dos.lineas[1]!.base, 'apiladas de arriba abajo');
    const conAnillo = (await pintar(intencion([fondo, sello({ anillo: { texto: 'CASA ARANDA · MÁLAGA · ', estilo: 'pequeno', tamano: 26 } })]))).capas.find((c) => c.id === 's')!;
    const sinAnillo = (await pintar(intencion([fondo, sello()]))).capas.find((c) => c.id === 's')!;
    assert.ok(conAnillo.tipo === 'sello' && sinAnillo.tipo === 'sello' && conAnillo.anillo && conAnillo.lineas[0]!.tamano < sinAnillo.lineas[0]!.tamano);
  });

  it('las formas: la estrella tiene sus puntas, el óvalo es más ancho que alto, y la sombra dura lo desplaza', async () => {
    assert.equal((trazadoEstrella(0, 0, 100, 16, 0.15).match(/[ML]/g) ?? []).length, 32);
    const ovalo = medir(await alfaDe((await pintar(intencion([fondo, sello({ forma: 'ovalo', proporcion: 0.5, lineas: [{ texto: 'Málaga', estilo: 'cartel', peso: 1 }] })]))).render, 's'));
    assert.ok(Math.abs(ovalo.h / ovalo.w - 0.5) < 0.02, `óvalo de ${ovalo.w}×${ovalo.h}`);
    const sinSombra = medir(await alfaDe((await pintar(intencion([fondo, sello()]))).render, 's'));
    const conSombra = medir(await alfaDe((await pintar(intencion([fondo, sello({ sombra: { dx: 10, dy: 14, color: '@rojo' } })]))).render, 's'));
    assert.ok(Math.abs(conSombra.w - sinSombra.w - 10) <= 2 && Math.abs(conSombra.h - sinSombra.h - 14) <= 2);
  });

  it('un sello con el texto demasiado pequeño es un error, y uno que se sale de la zona segura avisa', async () => {
    const { problemas } = await pintar(intencion([fondo, sello({ radio: 0.06, centro: { x: 0.95, y: 0.5 }, lineas: [{ texto: 'premiada en The Champions Burger', estilo: 'pequeno', peso: 1 }] })]));
    assert.ok(problemas.includes('TAMANO_MINIMO:s'));
    assert.ok(problemas.includes('ZONA_SEGURA:s'));
  });
});

describe('F3 · patrón', () => {
  it('palabra repetida: llena su caja en filas, no pinta fuera de ella y las filas en contorno llevan menos tinta', async () => {
    const patron = (extra: Record<string, unknown> = {}) => ({ id: 'p', tipo: 'patron', motivo: 'palabra', texto: 'TOWER', estilo: 'cartel', color: '@rojo', caja: { x: 0.1, y: 0.25, w: 0.8, h: 0.5 }, filas: 4, ...extra });
    const lleno = await alfaDe((await pintar(intencion([fondo, patron()]))).render, 'p');
    const m = medir(lleno);
    assert.ok(m.x0 >= 108 && m.x1 <= 972 && m.y0 >= 360 && m.y1 <= 1080, `dentro de su caja: ${m.x0}–${m.x1} × ${m.y0}–${m.y1}`);
    assert.ok(m.w > 840 && m.h > 600, 'y la llena');
    // Cuatro filas: cuatro bandas de tinta separadas por huecos.
    const tintaDeFila = (alfa: Uint8Array, y: number) => {
      let suma = 0;
      for (let x = 108; x < 972; x++) suma += alfa[y * ANCHO + x]!;
      return suma;
    };
    let bandas = 0;
    let enBanda = false;
    for (let y = 360; y < 1080; y++) {
      const hay = tintaDeFila(lleno, y) > 0;
      if (hay && !enBanda) bandas++;
      enBanda = hay;
    }
    assert.equal(bandas, 4);
    const alterno = await alfaDe((await pintar(intencion([fondo, patron({ contornoAlterno: 3 })]))).render, 'p');
    const centroDeFila = (i: number) => Math.round(360 + (i + 0.5) * 180);
    assert.ok(tintaDeFila(alterno, centroDeFila(1)) < tintaDeFila(alterno, centroDeFila(0)) * 0.4, 'la segunda fila va en contorno');
    assert.ok(Math.abs(tintaDeFila(alterno, centroDeFila(0)) - tintaDeFila(lleno, centroDeFila(0))) < 255 * 4, 'la primera sigue rellena');
  });

  it('el desfase desplaza cada fila, y el patrón girado gira con su caja', async () => {
    const patron = (extra: Record<string, unknown>) => ({ id: 'p', tipo: 'patron', motivo: 'palabra', texto: 'TOWER', estilo: 'cartel', color: '@rojo', caja: { x: 0.2, y: 0.3, w: 0.6, h: 0.4 }, filas: 2, ...extra });
    const recto = await alfaDe((await pintar(intencion([fondo, patron({})]))).render, 'p');
    const ladrillo = await alfaDe((await pintar(intencion([fondo, patron({ desfase: 0.5 })]))).render, 'p');
    const fila = (alfa: Uint8Array, y: number) => Array.from({ length: 648 }, (_, i) => alfa[y * ANCHO + 216 + i]!);
    assert.deepEqual(fila(recto, 500), fila(ladrillo, 500), 'la primera fila no se mueve');
    assert.notDeepEqual(fila(recto, 800), fila(ladrillo, 800), 'la segunda, sí');
    const girado = medir(await alfaDe((await pintar(intencion([fondo, patron({ giro: 90 })]))).render, 'p'));
    assert.ok(girado.h > girado.w, `girado 90°, el bloque queda de pie: ${girado.w}×${girado.h}`);
  });

  it('puntos: el campo se desvanece hacia donde se le dice', async () => {
    const alfa = await alfaDe((await pintar(intencion([fondo, { id: 'p', tipo: 'patron', motivo: 'puntos', color: '@rojo', caja: { x: 0, y: 0, w: 1, h: 0.5 }, paso: 20, tamano: [0.45, 0], desvanece: 'abajo' }]))).render, 'p');
    const banda = (desde: number, hasta: number) => {
      let suma = 0;
      for (let y = desde; y < hasta; y++) for (let x = 0; x < ANCHO; x++) suma += alfa[y * ANCHO + x]!;
      return suma / ((hasta - desde) * ANCHO * 255);
    };
    assert.ok(banda(0, 100) > 0.5, `arriba, mucha tinta: ${banda(0, 100).toFixed(2)}`);
    assert.ok(banda(300, 400) < banda(0, 100) * 0.4, 'a media altura, mucha menos');
    assert.ok(banda(650, 720) < 0.01 && banda(760, 900) === 0, 'abajo, nada, y fuera de la caja tampoco');
  });

  it('cuadros: cuadros enteros que cubren la mitad; rayas: el grosor que se pide', async () => {
    const cuadros = medir(await alfaDe((await pintar(intencion([fondo, { id: 'p', tipo: 'patron', motivo: 'cuadros', color: '@negro', caja: { x: 0.1, y: 0.4, w: 0.45, h: 0.07 }, paso: 40 }]))).render, 'p'));
    assert.equal(cuadros.w % 40, 0, `ancho de cuadros enteros: ${cuadros.w}`);
    assert.equal(cuadros.h % 40, 0);
    assert.ok(Math.abs(cuadros.tinta / (cuadros.w * cuadros.h) - 0.5) < 0.01, 'la mitad del área');
    const rayas = medir(await alfaDe((await pintar(intencion([fondo, { id: 'p', tipo: 'patron', motivo: 'rayas', color: '@negro', caja: { x: 0, y: 0.4, w: 1, h: 0.2 }, paso: 30, tamano: [0.3, 0.3], angulo: 0 }]))).render, 'p'));
    assert.ok(Math.abs(rayas.tinta / (ANCHO * 288) - 0.3) < 0.03, `cubren el ${((rayas.tinta / (ANCHO * 288)) * 100).toFixed(0)} %`);
  });
});

describe('F3 · trama de semitonos', () => {
  it('la cobertura crece con el radio y un punto de radio pleno llena su celda', () => {
    const cubierto = (d: number) => {
      const a = tramar(200, 200, { forma: 'punto', paso: 20, angulo: 45 }, () => radioParaCobertura(d, 20, 'punto'));
      return a.reduce((s, v) => s + v, 0) / (a.length * 255);
    };
    assert.ok(cubierto(0) === 0);
    assert.ok(cubierto(0.25) < cubierto(0.5) && cubierto(0.5) < cubierto(0.75));
    assert.ok(cubierto(1) > 0.995, `negro pleno: ${cubierto(1)}`);
    const lineas = tramar(200, 200, { forma: 'linea', paso: 20, angulo: 0 }, () => radioParaCobertura(0.5, 20, 'linea'));
    assert.ok(Math.abs(lineas.reduce((s, v) => s + v, 0) / (lineas.length * 255) - 0.5) < 0.03, 'una línea al 50 % cubre la mitad');
  });
});

describe('F3 · trazo a mano', () => {
  it('una pincelada es un contorno relleno, determinista, que no es una recta de grosor constante', () => {
    const centro = [{ x: 100, y: 500 }, { x: 900, y: 500 }];
    const a = pincelada(centro, { grosor: 8, temblor: 0.5, huecos: 0, semilla: 3 });
    assert.equal(a.length, 1);
    assert.deepEqual(a, pincelada(centro, { grosor: 8, temblor: 0.5, huecos: 0, semilla: 3 }));
    assert.notDeepEqual(a, pincelada(centro, { grosor: 8, temblor: 0.5, huecos: 0, semilla: 4 }));
    const ys = [...a[0]!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
    assert.ok(Math.max(...ys) - Math.min(...ys) > 8, 'el pulso se aparta de la línea');
    assert.ok(Math.max(...ys) - Math.min(...ys) < 40, 'pero no se desmanda');
    // Con huecos, el trazo se parte en varios tramos.
    assert.ok(pincelada(centro, { grosor: 8, temblor: 0.5, huecos: 0.1, semilla: 3 }).length >= 2);
  });

  it('el subrayado va bajo la última línea del texto y ocupa su ancho; el círculo lo rodea', async () => {
    const texto = { id: 't', tipo: 'texto', texto: 'sal gruesa', estilo: 'mano', caja: { x: 0.2, y: 0.4, w: 0.6, h: 0.08 }, ajuste: 'fijo', tamano: 90 };
    const raya = await pintar(intencion([fondo, texto, { id: 'r', tipo: 'trazo', gesto: 'subrayado', de: 't', color: '@rojo', grosor: 6 }]));
    const t = medir(await alfaDe(raya.render, 't'));
    const r = medir(await alfaDe(raya.render, 'r'));
    assert.ok(r.y0 > t.y0 + t.h * 0.5, 'por debajo de la mitad de las letras');
    assert.ok(r.x0 <= t.x0 && r.x1 >= t.x1, 'de lado a lado, con algo de vuelo');
    assert.ok(r.w < t.w * 1.15, 'sin pasarse');
    const circulo = await pintar(intencion([fondo, texto, { id: 'c', tipo: 'trazo', gesto: 'circulo', de: 't', color: '@rojo', grosor: 5 }]));
    const c = medir(await alfaDe(circulo.render, 'c'));
    assert.ok(c.x0 < t.x0 && c.x1 > t.x1 && c.y0 < t.y0 && c.y1 > t.y1, 'el círculo rodea el texto');
    // El texto queda dentro: el centro del círculo no tiene tinta del trazo.
    assert.equal((await alfaDe(circulo.render, 'c'))[Math.round((t.y0 + t.y1) / 2) * ANCHO + Math.round((t.x0 + t.x1) / 2)], 0);
  });

  it('la flecha señala un punto del sujeto y lo sigue cuando el sujeto se mueve', async () => {
    const capas = (x: number) => [
      fondo,
      { id: 's', tipo: 'recorte', activo: 'disco', escala: { anchoSujeto: 0.3 }, ancla: { caja: { x, y: 0.5, w: 0.3, h: 0.3 }, alinear: 'centro' } },
      { id: 'f', tipo: 'trazo', gesto: 'flecha', desde: { x: 0.1, y: 0.2 }, hacia: { sujeto: 's', punto: { x: 0.5, y: 0 } }, color: '@negro' },
    ];
    const a = (await pintar(intencion(capas(0.2), { disco: 'disco' }))).capas.find((c) => c.id === 'f')!;
    const b = (await pintar(intencion(capas(0.6), { disco: 'disco' }))).capas.find((c) => c.id === 'f')!;
    assert.ok(a.tipo === 'trazo' && b.tipo === 'trazo');
    // La punta va al borde superior del disco, en su centro.
    assert.ok(Math.abs(a.hasta.x - 0.35 * ANCHO) < 1 && Math.abs(a.hasta.y - (0.65 * ALTO - 162)) < 1, `punta en ${a.hasta.x}, ${a.hasta.y}`);
    assert.ok(Math.abs(b.hasta.x - a.hasta.x - 0.4 * ANCHO) < 1, 'se mueve con el sujeto');
    assert.deepEqual(a.desde, b.desde, 'la cola no se mueve');
    assert.equal(trazarGesto({ ...a, cabeza: 'ninguna' }).length, 1);
    assert.equal(trazarGesto(a).length, 3, 'astil y dos barbas');
  });

  it('una mancha es una curva cerrada que ocupa su caja, siempre la misma para la misma semilla', () => {
    const caja = { x: 100, y: 200, w: 400, h: 300 };
    const d = trazadoMancha(caja, 5, 0.5, 11);
    assert.equal(d, trazadoMancha(caja, 5, 0.5, 11));
    assert.notEqual(d, trazadoMancha(caja, 5, 0.5, 12));
    const puntos = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)(?=[CZ]|$)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => p[1]);
    assert.ok(Math.abs(Math.min(...xs) - 100) < 1 && Math.abs(Math.max(...xs) - 500) < 1 && Math.abs(Math.min(...ys) - 200) < 1 && Math.abs(Math.max(...ys) - 500) < 1);
    assert.ok(d.endsWith('Z'));
  });
});

describe('F3 · reproducción a tinta de una foto', () => {
  const imagen = (retoque: unknown) => ({ id: 'i', tipo: 'imagen', activo: 'disco', caja: { x: 0, y: 0.125, w: 1, h: 0.75 }, retoque });

  async function colores(retoque: unknown): Promise<{ datos: Buffer; alfa: Uint8Array }> {
    const { render } = await pintar(intencion([fondo, imagen(retoque)], { disco: 'disco' }));
    const png = render.capas.find((c) => c.id === 'i')!.png;
    return { datos: await sharp(png).ensureAlpha().raw().toBuffer(), alfa: await alfaDe(render, 'i') };
  }

  it('duotono: todos los colores quedan entre las dos tintas', async () => {
    const sombras = hexARgb('#0B0B0B');
    const luces = hexARgb('#EFE6D6');
    const { datos } = await colores({ duotono: { sombras: '@negro', luces: '@papel' } });
    for (let y = 200; y < 1240; y += 37) {
      for (let x = 20; x < 1060; x += 41) {
        const i = (y * ANCHO + x) * 4;
        // t sale del canal rojo; los otros dos tienen que caer en el mismo punto de la recta.
        const t = (datos[i]! - sombras[0]) / (luces[0] - sombras[0]);
        assert.ok(t >= -0.01 && t <= 1.01, `t = ${t}`);
        for (let c = 1; c < 3; c++) assert.ok(Math.abs(datos[i + c]! - (sombras[c]! + (luces[c]! - sombras[c]!) * t)) <= 2);
      }
    }
  });

  it('trama: sin papel solo hay tinta o transparencia; con papel, solo tinta o papel', async () => {
    const sin = await colores({ tramado: { forma: 'punto', paso: 14, angulo: 45, tinta: '@negro' } });
    const tinta = hexARgb('#0B0B0B');
    let opacos = 0;
    let transparentes = 0;
    for (let p = 0; p < sin.alfa.length; p += 7) {
      if (sin.alfa[p]! > 250) {
        opacos++;
        assert.deepEqual([sin.datos[p * 4], sin.datos[p * 4 + 1], sin.datos[p * 4 + 2]], tinta);
      } else if (sin.alfa[p] === 0) transparentes++;
    }
    assert.ok(opacos > 5000 && transparentes > 5000, 'hay puntos y hay papel');
    const con = await colores({ tramado: { forma: 'linea', paso: 24, angulo: 0, tinta: '@negro', papel: '@papel' } });
    const papel = hexARgb('#EFE6D6');
    let puros = 0;
    let total = 0;
    for (let y = 200; y < 1240; y += 5) {
      for (let x = 0; x < ANCHO; x += 5) {
        const i = (y * ANCHO + x) * 4;
        total++;
        const esTinta = Math.abs(con.datos[i]! - tinta[0]) < 3;
        const esPapel = Math.abs(con.datos[i]! - papel[0]) < 3;
        if (esTinta || esPapel) puros++;
        assert.equal(con.datos[i + 3], 255, 'con papel, la imagen es opaca');
      }
    }
    assert.ok(puros / total > 0.85, `casi todo es tinta o papel (${((puros / total) * 100).toFixed(0)} %): lo demás es el borde suavizado`);
  });

  it('el desenfoque ablanda los bordes', async () => {
    // El salto más brusco entre dos píxeles vecinos: en la foto nítida es el canto del disco; desenfocada, casi no hay salto.
    const cantoMasDuro = async (retoque: unknown) => {
      const { datos } = await colores(retoque);
      let mayor = 0;
      for (let y = 300; y < 1100; y += 2) for (let x = 100; x < 980; x++) mayor = Math.max(mayor, Math.abs(datos[(y * ANCHO + x) * 4 + 1]! - datos[(y * ANCHO + x + 1) * 4 + 1]!));
      return mayor;
    };
    const nitida = await cantoMasDuro({});
    const blanda = await cantoMasDuro({ desenfoque: 20 });
    assert.ok(nitida > 40 && blanda < nitida * 0.25, `canto de ${nitida} a ${blanda}`);
  });
});

describe('F3 · tipografía', () => {
  it('las fuentes del catálogo existen, tienen su licencia OFL al lado y todos los caracteres del español', () => {
    const { fuentes } = JSON.parse(readFileSync(join(carpetaFuentes, 'catalogo.json'), 'utf8')) as { fuentes: Array<{ id: string; archivo: string; licencia: string }> };
    assert.ok(fuentes.length >= 17);
    for (const f of fuentes) {
      assert.ok(existsSync(join(carpetaFuentes, f.archivo)), `${f.id}: falta ${f.archivo}`);
      assert.equal(f.licencia, 'OFL-1.1', f.id);
      assert.match(readFileSync(join(carpetaFuentes, dirname(f.archivo), 'OFL.txt'), 'utf8'), /SIL Open Font License/, `${f.id}: licencia`);
      const linea = catalogo.fuente(f.id).fuente.layout('ÁÉÍÓÚÜÑáéíóúüñ¿¡«»€·');
      assert.ok(linea.glyphs.every((g) => g.id !== 0), `${f.id}: falta algún glifo del español`);
    }
  });

  it('las cuatro familias nuevas cubren los dos huecos pendientes: didona condensada y manuscrita monolineal', () => {
    for (const id of ['noto-serif-display', 'instrument-serif', 'instrument-serif-italica', 'sacramento', 'caveat']) assert.ok(catalogo.familia(id));
    assert.deepEqual(catalogo.rango('noto-serif-display', 'wdth'), [62.5, 100]);
    const estrecha = motor.medir({ fuente: 'noto-serif-display', ejes: { wdth: 62.5, wght: 700 }, tracking: 0 }, 'MOCKTAIL', 200).ancho;
    const normal = motor.medir({ fuente: 'noto-serif-display', ejes: { wdth: 100, wght: 700 }, tracking: 0 }, 'MOCKTAIL', 200).ancho;
    assert.ok(estrecha < normal * 0.9, `condensada: ${estrecha.toFixed(0)} frente a ${normal.toFixed(0)}`);
  });

  it('los rasgos OpenType se aplican si la fuente los tiene y se ignoran si no', () => {
    const base = { fuente: 'noto-serif-display', ejes: { wdth: 80, wght: 600 }, tracking: 0 };
    assert.ok(motor.rasgosDisponibles('noto-serif-display').includes('smcp'));
    const normal = motor.medir(base, 'Casa Aranda', 100).ancho;
    const versalitas = motor.medir({ ...base, rasgos: ['smcp'] }, 'Casa Aranda', 100).ancho;
    assert.ok(versalitas > normal * 1.05, `las versalitas son más anchas que las minúsculas: ${normal.toFixed(0)} → ${versalitas.toFixed(0)}`);
    assert.notEqual(motor.trazar({ ...base, rasgos: ['smcp'] }, 'Casa', 100, 0, 0), motor.trazar(base, 'Casa', 100, 0, 0));
    // Cifras elzevirianas: bajan de la línea base.
    assert.ok(motor.medir({ ...base, rasgos: ['onum'] }, '1932', 100).abajo > motor.medir(base, '1932', 100).abajo + 5);
    assert.equal(motor.medir({ fuente: 'sacramento', ejes: {}, tracking: 0, rasgos: ['smcp'] }, 'de leña', 100).ancho, motor.medir({ fuente: 'sacramento', ejes: {}, tracking: 0 }, 'de leña', 100).ancho);
  });

  it('el estilo de una intención lleva los rasgos hasta el render', async () => {
    const i = intencion([fondo, { id: 't', tipo: 'texto', texto: 'Casa Aranda', estilo: 'versal', caja: { x: 0.1, y: 0.4, w: 0.8, h: 0.1 }, ajuste: 'fijo', tamano: 120 }]);
    const con = { ...i, tokens: { ...i.tokens, estilos: { ...i.tokens.estilos, versal: { fuente: 'noto-serif-display', ejes: { wdth: 80, wght: 600 }, caso: 'tal-cual' as const, tracking: 0, interlineado: 1, color: '@negro', rasgos: ['smcp'] } } } };
    const sin = { ...i, tokens: { ...i.tokens, estilos: { ...i.tokens.estilos, versal: { ...con.tokens.estilos.versal!, rasgos: [] } } } };
    const a = medir(await alfaDe((await pintar(con)).render, 't'));
    const b = medir(await alfaDe((await pintar(sin)).render, 't'));
    assert.ok(a.w > b.w * 1.05, `con versalitas ocupa más: ${b.w} → ${a.w}`);
  });
});

describe('F3 · papel', () => {
  it('es gris neutro de media (no cambia el color de la marca), con textura, y determinista', async () => {
    const { render } = await pintar(intencion([fondo, { id: 'p', tipo: 'textura', recurso: 'papel', intensidad: 0.1, fusion: 'soft-light' }]));
    const png = render.capas.find((c) => c.id === 'p')!.png;
    const datos = await sharp(png).extractChannel(0).raw().toBuffer();
    const media = datos.reduce((s, v) => s + v, 0) / datos.length;
    assert.ok(Math.abs(media - 128) < 3, `media ${media.toFixed(1)}`);
    assert.ok(Math.max(...datos.subarray(0, 50000)) - Math.min(...datos.subarray(0, 50000)) > 6, 'tiene textura');
    const otra = await new CompositorSharp(motor, catalogo).renderizar(await compositor.resolver(intencion([fondo, { id: 'p', tipo: 'textura', recurso: 'papel', intensidad: 0.1, fusion: 'soft-light' }]), {}), {});
    assert.equal(hash(otra.capas[1]!.png), hash(png));
  });
});

describe('F3 · medidas de oficio', () => {
  it('los niveles de tamaño se cuentan por saltos de más de un 25 %', () => {
    assert.equal(nivelesDeTamano([200, 60, 58, 30, 29]), 3);
    assert.equal(nivelesDeTamano([40, 38, 36]), 1);
    assert.equal(nivelesDeTamano([]), 0);
  });

  it('el documento resuelto lleva las medidas, y una pieza plana da aviso de jerarquía', async () => {
    const texto = (id: string, y: number, tamano: number) => ({ id, tipo: 'texto', texto: 'Churros con chocolate', estilo: 'pequeno', caja: { x: 0.1, y, w: 0.8, h: 0.06 }, ajuste: 'fijo', tamano });
    const plana = await compositor.resolver(intencion([fondo, texto('a', 0.3, 60), texto('b', 0.5, 44)]), {});
    assert.ok(plana.medidas.oficio);
    assert.ok(plana.medidas.oficio.saltoDeEscala < SALTO_DE_ESCALA_MINIMO);
    assert.equal(plana.medidas.oficio.palabras, 6);
    assert.equal(plana.medidas.oficio.voces, 1);
    assert.ok(plana.problemas.some((p) => p.tipo === 'JERARQUIA' && p.gravedad === 'AVISO'));
    const conFoco = await compositor.resolver(intencion([fondo, { id: 'a', tipo: 'texto', texto: 'CHURROS', estilo: 'cartel', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.2 }, ajuste: 'ancho' }, texto('b', 0.6, 44)]), {});
    assert.ok(conFoco.medidas.oficio!.saltoDeEscala > 5);
    assert.ok(!conFoco.problemas.some((p) => p.tipo === 'JERARQUIA'));
    assert.equal(conFoco.medidas.oficio!.voces, 2);
  });

  it('avisa de demasiadas palabras, voces, gestos y recursos', () => {
    const base = { saltoDeEscala: 6, palabras: 12, niveles: 3, voces: 2, gestos: 1, recursos: 1, aire: 0.5, todoCentrado: false };
    assert.deepEqual(problemasDeOficio(base), []);
    assert.deepEqual(problemasDeOficio({ ...base, palabras: 31 }).map((p) => p.tipo), ['DENSIDAD']);
    assert.deepEqual(problemasDeOficio({ ...base, palabras: 25 }, 'HISTORIA_9_16').map((p) => p.tipo), ['DENSIDAD'], 'en historias el máximo es 20');
    assert.deepEqual(problemasDeOficio({ ...base, voces: 4 }).map((p) => p.tipo), ['VOCES']);
    assert.deepEqual(problemasDeOficio({ ...base, gestos: 2 }).map((p) => p.tipo), ['GESTOS']);
    assert.deepEqual(problemasDeOficio({ ...base, recursos: 3 }).map((p) => p.tipo), ['GESTOS']);
    assert.ok(problemasDeOficio({ ...base, palabras: 40, voces: 5, gestos: 3 }).every((p) => p.gravedad === 'AVISO'), 'son avisos, no errores');
  });

  it('cuenta gestos y recursos de las capas nuevas', async () => {
    const resuelto = await compositor.resolver(
      intencion([
        fondo,
        { id: 't', tipo: 'texto', texto: 'TORRE', estilo: 'cartel', caja: { x: 0.1, y: 0.2, w: 0.8, h: 0.2 }, ajuste: 'ancho' },
        { id: 'r', tipo: 'trazo', gesto: 'subrayado', de: 't', color: '@rojo' },
        { id: 'c', tipo: 'trazo', gesto: 'circulo', de: 't', color: '@rojo' },
        { id: 's', tipo: 'sello', centro: { x: 0.5, y: 0.7 }, radio: 0.15, fondo: '@negro', color: '@papel', lineas: [{ texto: '3×3', estilo: 'cartel' }] },
      ]),
      {},
    );
    const o = medirOficio(resuelto.capas, resuelto.lienzo, { alturaMayusculas: (e, t) => motor.alturaMayusculas(e, t), familia: (f) => motor.familia(f) });
    assert.equal(o.gestos, 2);
    assert.equal(o.recursos, 1);
    assert.ok(resuelto.problemas.some((p) => p.tipo === 'GESTOS'));
  });
});

describe('F3 · lo anterior no cambia', () => {
  it('una intención sin nada de lo nuevo se resuelve sin ninguna de las claves nuevas', async () => {
    const resuelto = await compositor.resolver(
      intencion(
        [
          fondo,
          { id: 't', tipo: 'texto', texto: 'TORRE', estilo: 'cartel', caja: { x: 0.1, y: 0.2, w: 0.8, h: 0.2 }, ajuste: 'ancho' },
          { id: 'b', tipo: 'recorte', activo: 'barra', escala: { altoSujeto: 0.4 }, ancla: { caja: { x: 0, y: 0, w: 1, h: 1 }, alinear: 'centro' } },
          { id: 'f', tipo: 'forma', figura: 'rect', caja: { x: 0.1, y: 0.8, w: 0.3, h: 0.05 }, color: '@rojo' },
        ],
        { barra: 'barra' },
      ),
      { barra },
    );
    const nuevas = ['giro', 'corte', 'tinta', 'recorte', 'puntos', 'radio', 'lobulos', 'irregularidad', 'semilla'];
    for (const capa of resuelto.capas) {
      for (const clave of nuevas) assert.ok(!(clave in capa), `«${capa.id}» lleva «${clave}» sin haberlo pedido`);
      if (capa.tipo === 'texto') assert.ok(!('rasgos' in capa.estilo));
    }
  });
});

describe('F3.3 · filo de pegatina', () => {
  it('el recorte con «filo» crece el grosor por cada lado y el borde nuevo es del color pedido', async () => {
    const capa = (filo?: unknown) => ({ id: 's', tipo: 'recorte', activo: 'disco', escala: { anchoSujeto: 0.4 }, ancla: { caja: { x: 0, y: 0, w: 1, h: 1 }, alinear: 'centro' }, bordeSuave: 0, ...(filo ? { filo } : {}) });
    const sin = await pintar(intencion([fondo, capa()], { disco: 'disco' }));
    const con = await pintar(intencion([fondo, capa({ color: '#FFFFFF', grosor: 16 })], { disco: 'disco' }));
    const a = medir(await alfaDe(sin.render, 's'));
    const b = medir(await alfaDe(con.render, 's'));
    assert.ok(b.w >= a.w + 24 && b.w <= a.w + 36, `${a.w} → ${b.w}`);
    // Justo fuera del disco, a la izquierda de su centro, el píxel es blanco.
    const png = await sharp(con.render.png).removeAlpha().raw().toBuffer();
    const y = Math.round((b.y0 + b.y1) / 2);
    const x = a.x0 - 6;
    const i = (y * ANCHO + x) * 3;
    assert.deepEqual([png[i], png[i + 1], png[i + 2]].map((v) => v! > 240), [true, true, true]);
  });
});

describe('F3.3 · patrón de línea de olas', () => {
  it('pinta arcos finos, solo dentro de su caja, y flojo con la opacidad pedida', async () => {
    const olas = { id: 'o', tipo: 'patron', motivo: 'olas', caja: { x: 0, y: 0, w: 0.5, h: 1 }, color: '#FFFFFF', paso: 80, opacidad: 0.5 };
    const r = await pintar(intencion([{ id: 'fondo', tipo: 'relleno', color: '@negro' }, olas], {}));
    const png = await sharp(r.render.png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = png.info;
    let izquierda = 0;
    let derecha = 0;
    let maximo = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const v = png.data[(y * width + x) * 3]!;
        if (x < width / 2 - 4) izquierda += v > 60 ? 1 : 0;
        else if (x > width / 2 + 4) derecha += v > 60 ? 1 : 0;
        maximo = Math.max(maximo, v);
      }
    }
    assert.ok(izquierda > 500, `líneas a la izquierda: ${izquierda}`);
    assert.equal(derecha, 0, 'nada fuera de la caja');
    assert.ok(maximo < 200, `flojo: ${maximo}`);
  });
});

describe('F3.3 · la rama dibujada a tinta', () => {
  it('pinta tinta dentro de su caja y nada fuera', async () => {
    const rama = { id: 'r', tipo: 'forma', figura: 'rama', caja: { x: 0.5, y: 0.1, w: 0.5, h: 0.3 }, color: '@negro' };
    const r = await pintar(intencion([fondo, rama]));
    const png = await sharp(r.render.png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = png.info;
    let dentro = 0;
    let fuera = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const oscuro = png.data[(y * width + x) * 3]! < 100;
        if (x > width * 0.48 && y > height * 0.08 && y < height * 0.42) dentro += oscuro ? 1 : 0;
        else fuera += oscuro ? 1 : 0;
      }
    }
    assert.ok(dentro > 400, `tinta en la caja: ${dentro}`);
    assert.equal(fuera, 0);
  });
});
