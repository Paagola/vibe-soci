/**
 * Estudio de arte: de la receta a la maqueta (compilarReceta), la rúbrica, la distancia entre direcciones y el corpus de
 * referencias. Sin modelos y sin pintar: se comprueba lo que el código garantiza por construcción.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compilarReceta, partirTitular, type EntornoArte } from '../src/dominio/arte/compilarReceta.js';
import { Receta, type RecetaEntrada } from '../src/dominio/arte/receta.js';
import { elegirReferencias, leerCorpus } from '../src/dominio/arte/referencias.js';
import { distancia, nota, problemasDeVariedad, type Critica } from '../src/dominio/arte/rubrica.js';
import { contraste } from '../src/dominio/diseno/color.js';
import { construirMapa, type MapaDeFoto } from '../src/dominio/diseno/mapaDeFoto.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { mascaraPrincipal } from '../src/adaptadores/imagen/mascaraPrincipal.js';
import { ajustesPara, aplicarAjustes } from '../src/aplicacion/arte/estudioDeArte.js';
import { componerProtegido } from '../src/adaptadores/imagen/insercion.js';
import { MedidorDeFotoSharp } from '../src/adaptadores/imagen/MedidorDeFotoSharp.js';
import type { CapaPropuesta } from '../src/dominio/diseno/propuesta.js';

/** Un plato elíptico centrado en (cx, cy) sobre fondo oscuro, con su máscara. */
function mapaSintetico(cx = 0.5, cy = 0.62, rx = 0.36, ry = 0.2): MapaDeFoto {
  const ancho = 120;
  const alto = 160;
  const rgb = new Uint8Array(ancho * alto * 3);
  const mascara = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const dentro = (x / ancho - cx) ** 2 / rx ** 2 + (y / alto - cy) ** 2 / ry ** 2 <= 1;
      rgb.set(dentro ? [200, 80, 50] : [24, 24, 24], i * 3);
      mascara[i] = dentro ? 255 : 0;
    }
  }
  return construirMapa({ ancho, alto, rgb, mascara, columnas: 12, filas: 16 });
}

/** Rejilla de la silueta: una elipse que llena su caja. */
function rejillaElipse(lado = 32) {
  const ocupacion: number[] = [];
  for (let f = 0; f < lado; f++) for (let c = 0; c < lado; c++) ocupacion.push(((c + 0.5) / lado - 0.5) ** 2 / 0.25 + ((f + 0.5) / lado - 0.5) ** 2 / 0.25 <= 1 ? 1 : 0);
  return { columnas: lado, filas: lado, ocupacion };
}

const TEXTOS = {
  titular: 'MANHATTAN TOWER',
  apoyo: '3 carnes · 3 bacon · 3 cheddar',
  firma: 'DAK Burger',
  torre: 'TOWER',
  nota1: 'bacon crujiente',
  nota2: 'cheddar fundido',
  lugar: 'La Cala',
};

function entorno(): EntornoArte {
  return {
    mapa: mapaSintetico(),
    tieneMascara: true,
    colores: [
      { token: 'rojo', hex: '#FF3B1F' },
      { token: 'negro', hex: '#0B0B0B' },
      { token: 'papel', hex: '#EFE6D6' },
    ],
    voces: ['titular', 'rotulo', 'texto', 'estudio-madera', 'estudio-didona', 'estudio-rotulador', 'estudio-floritura'],
    vocesDeMarca: ['titular', 'rotulo', 'texto'],
    marca: { titular: 'titular', apoyo: 'texto', firma: 'rotulo', anotacion: 'estudio-rotulador' },
    textos: TEXTOS,
    colorDeVoz: { titular: 'negro', rotulo: 'negro', texto: 'negro', 'estudio-madera': 'rojo', 'estudio-didona': 'negro', 'estudio-rotulador': 'rojo', 'estudio-floritura': 'rojo' },
    anchoDeCaracter: { titular: 24, rotulo: 30, texto: 20, 'estudio-madera': 20, 'estudio-didona': 20, 'estudio-rotulador': 18, 'estudio-floritura': 18 },
    silueta: { x: 200, y: 900, w: 1400, h: 1000, anchoFoto: 1800, altoFoto: 2400, rejilla: rejillaElipse() },
  };
}

const T = (clave: string, fuente = 'PLATO') => ({ clave, texto: TEXTOS[clave as keyof typeof TEXTOS], fuente, cita: TEXTOS[clave as keyof typeof TEXTOS] });

function receta(extra: Partial<RecetaEntrada>): Receta {
  return Receta.parse({
    nombre: 'Prueba',
    idea: 'Una receta de prueba para el compilador',
    lecturas: ['el producto', 'el titular', 'la firma'],
    esqueleto: 'PRODUCTO_SOBRE_COLOR',
    fondo: '@rojo',
    acento: '@negro',
    textos: Object.keys(TEXTOS).map((k) => T(k)),
    producto: { escala: 'grande' },
    titular: { texto: 'titular', voz: 'titular', escala: 'monumental', relacion: 'detras' },
    apoyo: { texto: 'apoyo', voz: 'texto' },
    firma: { texto: 'firma', voz: 'rotulo' },
    operaciones: [],
    ...extra,
  });
}

const textosDe = (capas: CapaPropuesta[]) => capas.filter((c): c is Extract<CapaPropuesta, { tipo: 'texto' }> => c.tipo === 'texto');

describe('Estudio de arte · partir líneas', () => {
  it('corta por los separadores y no deja palabras vacías al final de una línea', () => {
    assert.equal(partirTitular('3 carnes · 3 bacon · 3 cheddar', 2), '3 carnes · 3 bacon\n3 cheddar');
    assert.equal(partirTitular('PULPO A LA GALLEGA', 2), 'PULPO\nA LA GALLEGA');
    assert.equal(partirTitular('MANHATTAN TOWER', 2), 'MANHATTAN\nTOWER');
    assert.equal(partirTitular('TOWER', 3), 'TOWER');
  });
});

describe('Estudio de arte · compilar la receta', () => {
  for (const esqueleto of ['PRODUCTO_SOBRE_COLOR', 'CARTEL', 'COLUMNA', 'MARCO', 'EDITORIAL'] as const) {
    it(`${esqueleto}: coloca titular, producto, apoyo y firma sin problemas`, () => {
      const r = receta({ esqueleto, fondo: esqueleto === 'PRODUCTO_SOBRE_COLOR' ? '@rojo' : '@papel', ...(esqueleto === 'COLUMNA' ? { titular: { texto: 'torre', voz: 'estudio-madera', escala: 'monumental', relacion: 'aparte' } } : {}) });
      const c = compilarReceta(r, entorno());
      assert.deepEqual(c.problemas, []);
      const textos = textosDe(c.capas);
      assert.ok(textos.some((t) => t.id === 'titular'), 'hay titular');
      assert.ok(textos.some((t) => t.id === 'firma'), 'hay firma');
      assert.ok(textos.some((t) => t.id === 'apoyo'), 'hay apoyo');
      assert.ok(c.capas.some((k) => k.tipo === 'plato'), 'hay producto');
    });
  }

  it('la firma es un invariante: en una voz que no es de la marca, se rechaza', () => {
    const c = compilarReceta(receta({ firma: { texto: 'firma', voz: 'estudio-floritura' } }), entorno());
    assert.ok(c.problemas.some((p) => /invariante de la marca/.test(p)));
  });

  it('la tinta de cada texto contrasta con el campo de color', () => {
    const c = compilarReceta(receta({ fondo: '@negro' }), entorno());
    for (const t of textosDe(c.capas)) assert.notEqual(t.color, '@negro', `«${t.id}» no puede ir en negro sobre negro`);
  });

  it('fuera de PATRON la repetición es fondo: una tinta que grita se calla a ~1,45:1 con el campo (Torre, lote-1)', () => {
    const repeticion = { tipo: 'REPETICION', texto: 'torre', voz: 'titular', filas: 5, contornoAlterno: true } as const;
    const fuerte = compilarReceta(receta({ fondo: '@papel', operaciones: [{ ...repeticion, color: '@negro' }] }), entorno());
    const capa = fuerte.capas.find((k) => k.tipo === 'patron') as Extract<CapaPropuesta, { tipo: 'patron' }>;
    assert.match(String(capa.color), /^#[0-9A-F]{6}$/, 'un tono derivado, no el negro de la marca');
    const c = contraste(String(capa.color), '#EFE6D6');
    assert.ok(c > 1.3 && c <= 1.46, `contraste con el campo ${c.toFixed(2)}:1`);
    assert.ok(fuerte.notas.some((n) => /va de fondo/.test(n)), 'y lo dice en las notas');
    // Una tinta ya callada se respeta tal cual.
    const suave = compilarReceta(receta({ fondo: '@rojo', operaciones: [{ ...repeticion, color: '@rojo' }] }), entorno());
    assert.equal((suave.capas.find((k) => k.tipo === 'patron') as Extract<CapaPropuesta, { tipo: 'patron' }>).color, '@rojo');
  });

  it('en CARTEL el titular nunca va «aparte»: el producto tapa las letras', () => {
    const c = compilarReceta(receta({ esqueleto: 'CARTEL', fondo: '@papel', titular: { texto: 'titular', voz: 'titular', escala: 'monumental', relacion: 'aparte' } }), entorno());
    assert.equal(textosDe(c.capas).find((t) => t.id === 'titular')?.relacion, 'detras');
  });

  it('el sello va donde quepa sin tapar otro texto; si no cabe, se quita con una nota (la dirección no se pierde)', () => {
    const conAire = compilarReceta(receta({ esqueleto: 'EDITORIAL', fondo: '@papel', producto: { escala: 'contenida' }, operaciones: [{ tipo: 'SELLO', forma: 'estrella', lineas: ['lugar'] }] }), entorno());
    assert.deepEqual(conAire.problemas, []);
    assert.ok(conAire.capas.some((k) => k.tipo === 'sello'));
    const lleno = compilarReceta(receta({ esqueleto: 'CARTEL', fondo: '@papel', operaciones: [{ tipo: 'SELLO', forma: 'estrella', lineas: ['lugar'] }] }), entorno());
    assert.deepEqual(lleno.problemas, []);
    assert.ok(lleno.capas.some((k) => k.tipo === 'sello') || lleno.notas.some((n) => /Se quitó el sello/.test(n)));
  });

  it('ESCENA: la imagen generada va a sangre encima del campo y los textos miden su tinta contra ella', () => {
    const r = receta({ esqueleto: 'CARTEL', fondo: '@papel', operaciones: [{ tipo: 'ESCENA', describe: 'charred oak planks lit by low orange ember light from the left' }] });
    const sinImagen = compilarReceta(r, entorno());
    assert.ok(!sinImagen.capas.some((k) => k.tipo === 'foto'), 'sin imagen, campo liso');
    const c = compilarReceta(r, { ...entorno(), escena: mapaSintetico(0.5, 0.5, 0.01, 0.01) });
    assert.deepEqual(c.problemas, []);
    const foto = c.capas[1];
    assert.ok(foto?.tipo === 'foto' && foto.activo === 'escena' && foto.encuadre === 'sangre');
    // La escena sintética es oscura: ningún texto va en negro.
    for (const t of textosDe(c.capas)) assert.notEqual(t.color, '@negro', `«${t.id}» sobre la escena oscura`);
  });

  it('las anotaciones que no caben se quitan si cabe alguna; la dirección no se pierde', () => {
    const r = receta({ esqueleto: 'COLUMNA', producto: { escala: 'enorme' }, titular: { texto: 'torre', voz: 'estudio-madera', escala: 'monumental', relacion: 'aparte' }, operaciones: [{ tipo: 'ANOTACIONES', notas: [{ texto: 'nota1', apunta: { x: 0.8, y: 0.5 } }, { texto: 'nota2', apunta: { x: 0.2, y: 0.4 } }, { texto: 'lugar', apunta: { x: 0.5, y: 0.9 } }] }] });
    const c = compilarReceta(r, entorno());
    assert.ok(!c.problemas.some((p) => /anotaci/.test(p)));
    assert.ok(c.capas.some((k) => k.tipo === 'anotacion'));
  });

  it('una foto sin máscara no se puede recortar: se pide otro esqueleto', () => {
    const e = { ...entorno(), tieneMascara: false };
    const c = compilarReceta(receta({}), e);
    assert.ok(c.problemas.some((p) => /no tiene máscara/.test(p)));
  });
});

describe('Estudio de arte · rúbrica y variedad', () => {
  const p = (n: number) => ({ nivel: n, motivo: 'motivo de prueba' });
  it('la nota va de 0 a 100 y la compuerta de fidelidad la anula', () => {
    const todas = (n: number) => ({ idea: p(n), composicion: p(n), tipografia: p(n), relacion: p(n), identidad: p(n), acabado: p(n) }) as Critica['puntuaciones'];
    assert.equal(nota(todas(4)), 100);
    assert.equal(nota(todas(2)), 50);
    assert.equal(nota(todas(4), false), 0);
  });

  it('dos direcciones con el mismo esqueleto son variaciones, no direcciones', () => {
    const a = receta({ nombre: 'Dirección A' });
    const b = receta({ nombre: 'Dirección B', fondo: '@negro' });
    assert.ok(problemasDeVariedad([a, b]).some((x) => /mismo esqueleto/.test(x)));
    const c = receta({ nombre: 'Dirección C', esqueleto: 'EDITORIAL', producto: { escala: 'contenida' }, titular: { texto: 'titular', voz: 'estudio-didona', escala: 'grande', relacion: 'aparte' }, operaciones: [{ tipo: 'FILETES' }] });
    assert.ok(distancia(a, c) >= 0.45);
    assert.deepEqual(problemasDeVariedad([a, c]), []);
  });
});

describe('Estudio de arte · corpus de referencias', () => {
  const README = [
    '| [a.jpg](hamburgueserias/a.jpg) | Hamburguesa sobre rojo | Oclusión monumental | `OCLUSION, TIPOGRAFIA_MONUMENTAL` | POST | pin |',
    '| [b.jpg](hamburgueserias/b.jpg) | Palabra repetida | Patrón | `REPETICION` | POST | pin |',
    '| [c.jpg](historias-verticales/c.jpg) | Historia | Vertical | `ANOTACION` | 9:16 | pin |',
    '| [d.jpg](restaurantes/d.jpg) | Revista | Aire | `VACIO, RETICULA_EDITORIAL` | POST | pin |',
    '| [e.jpg](restaurantes/e.jpg) | Sin operación ejecutable | — | `PERSONA` | POST | pin |',
  ].join('\n');

  it('lee las filas de las tablas del README', () => {
    const corpus = leerCorpus(README);
    assert.equal(corpus.length, 5);
    assert.deepEqual(corpus[0]!.operaciones, ['OCLUSION', 'TIPOGRAFIA_MONUMENTAL']);
  });

  it('elige posts con operaciones ejecutables, del tipo de local primero, sin repetir operación', () => {
    const elegidas = elegirReferencias(leerCorpus(README), { carpetas: ['hamburgueserias'], n: 5, semilla: 'x' });
    assert.ok(elegidas.every((p) => p.carpeta !== 'historias-verticales' && p.archivo !== 'restaurantes/e.jpg'));
    assert.equal(elegidas.length, 3);
    assert.equal(elegidas[0]!.carpeta, 'hamburgueserias');
  });
});

describe('Estudio de arte · máscara principal', () => {
  /** Un plato grande abajo y, pegado a él, un trozo de otro plato cortado por el borde de arriba (como el pulpo). */
  async function mascaraConIntruso(conIntruso: boolean) {
    const w = 300;
    const h = 400;
    const m = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const plato = ((x - 150) / 140) ** 2 + ((y - 250) / 140) ** 2 <= 1;
      const intruso = conIntruso && ((x - 150) / 150) ** 2 + ((y + 20) / 130) ** 2 <= 1 && (Math.abs(x - 150) < 40 || y < 100);
      m[y * w + x] = plato || intruso ? 255 : 0;
    }
    const ruta = join(await mkdtemp(join(tmpdir(), 'mascara-')), 'm.png');
    await writeFile(ruta, await sharp(m, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer());
    return ruta;
  }

  it('quita otro objeto cortado por el borde que toca al principal por una cintura', async () => {
    const r = await mascaraPrincipal(await mascaraConIntruso(true), 300, 400);
    assert.ok(r, 'encuentra la cintura');
    assert.ok(r.bbox.y > 90, `la caja empieza en el plato principal (y = ${r.bbox.y})`);
    assert.ok(r.quitado > 0.1 && r.quitado < 0.35);
  });

  it('no quita las piezas sueltas de un conjunto que no tocan el borde (las tazas junto a la bandeja)', async () => {
    const w = 300;
    const h = 400;
    const m = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bandeja = ((x - 120) / 90) ** 2 + ((y - 230) / 120) ** 2 <= 1;
      const taza = ((x - 250) / 30) ** 2 + ((y - 120) / 30) ** 2 <= 1;
      m[y * w + x] = bandeja || taza ? 255 : 0;
    }
    const ruta = join(await mkdtemp(join(tmpdir(), 'mascara-')), 'm.png');
    await writeFile(ruta, await sharp(m, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer());
    assert.equal(await mascaraPrincipal(ruta, w, h), undefined);
  });

  it('no toca una máscara de una sola pieza', async () => {
    assert.equal(await mascaraPrincipal(await mascaraConIntruso(false), 300, 400), undefined);
  });
});

describe('Estudio de arte · imágenes de un canal (regresión: sharp devuelve 3 canales al leer un gris en crudo)', () => {
  it('la rejilla de la silueta tiene lado × lado valores y su forma', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'silueta-'));
    const m = Buffer.alloc(200 * 200);
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) m[y * 200 + x] = x < 100 ? 255 : 0;
    await writeFile(join(dir, 'm.png'), await sharp(m, { raw: { width: 200, height: 200, channels: 1 } }).png().toBuffer());
    await writeFile(join(dir, 'f.png'), await sharp({ create: { width: 200, height: 200, channels: 3, background: '#888' } }).png().toBuffer());
    const foto = { ruta: join(dir, 'f.png'), rutaMascara: join(dir, 'm.png'), activo: { ancho: 200, alto: 200, mascara: { bbox: { x: 0, y: 0, w: 200, h: 200 } } } } as never;
    const r = await new MedidorDeFotoSharp().silueta(foto, 8);
    assert.equal(r!.ocupacion.length, 64);
    assert.ok(r!.ocupacion[0]! > 0.9 && r!.ocupacion[7]! < 0.1, 'izquierda llena, derecha vacía');
  });

  it('la inserción protegida restaura lo protegido y conserva lo añadido fuera', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'insercion-'));
    const original = join(dir, 'o.png');
    await writeFile(original, await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } }).png().toBuffer());
    // Capa protegida: un cuadrado opaco en el centro (30–70).
    const alfa = Buffer.alloc(100 * 100 * 4);
    for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) alfa[(y * 100 + x) * 4 + 3] = 255;
    const capa = join(dir, 'c.png');
    await writeFile(capa, await sharp(alfa, { raw: { width: 100, height: 100, channels: 4 } }).png().toBuffer());
    const editada = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const r = await componerProtegido(original, editada, [capa], 100, 100);
    const px = await sharp(r.png).raw().toBuffer();
    const en = (x: number, y: number) => [px[(y * 100 + x) * 3]!, px[(y * 100 + x) * 3 + 1]!, px[(y * 100 + x) * 3 + 2]!];
    assert.deepEqual(en(50, 50), [255, 255, 255], 'el centro protegido vuelve a ser el original');
    assert.deepEqual(en(5, 5), [255, 0, 0], 'fuera se queda lo añadido');
    assert.ok(r.cambioDentro > 0.9 && r.cambioFuera > 0.9);
  });
});

describe('Estudio de arte · arreglos del código tras pintar', () => {
  const colores = [
    { token: 'carbon', hex: '#151311' },
    { token: 'hueso', hex: '#EFE6D6' },
    { token: 'brasa', hex: '#B5452B' },
  ];
  const capas = (): CapaPropuesta[] => [
    { tipo: 'fondo', color: '@carbon' },
    { tipo: 'foto', encuadre: 'sangre' },
    { tipo: 'texto', id: 'titular', texto: 'titular', voz: 'titular', caja: { col: [1, 12], fila: [2, 5] }, ajuste: 'caja', alinear: 'izquierda', vertical: 'abajo', color: '@hueso', relacion: 'detras' },
    { tipo: 'texto', id: 'apoyo', texto: 'apoyo', voz: 'texto', caja: { col: [1, 6], fila: [14, 14] }, ajuste: 'fijo', tamano: 34, alinear: 'izquierda', vertical: 'centro', color: '@carbon', relacion: 'aparte' },
  ] as CapaPropuesta[];

  it('un texto pequeño sin contraste sobre la foto a sangre: velo oscuro en su lado y tinta clara (lote-1)', () => {
    const a = ajustesPara(['CONTRASTE: «apoyo» tiene un contraste de 2.57:1 con su fondo en su peor zona; se pide al menos 4.5:1.'], colores)!;
    const r = aplicarAjustes(capas(), a);
    const foto = r.find((c) => c.tipo === 'foto') as Extract<CapaPropuesta, { tipo: 'foto' }>;
    assert.equal(foto.velo, 'abajo', 'el apoyo está abajo: se oscurece abajo');
    assert.equal(foto.colorVelo, '@carbon', 'con el color más oscuro de la marca');
    assert.equal((r.find((c) => c.tipo === 'texto' && c.id === 'apoyo') as Extract<CapaPropuesta, { tipo: 'texto' }>).color, '@hueso', 'y el texto, en la tinta clara');
  });

  it('el titular (o un texto sobre un campo liso) solo cambia de tinta, sin velo', () => {
    const r = aplicarAjustes(capas(), ajustesPara(['CONTRASTE: «titular» tiene un contraste de 2:1 con su fondo en su peor zona; se pide al menos 3:1.'], colores)!);
    assert.equal((r.find((c) => c.tipo === 'foto') as Extract<CapaPropuesta, { tipo: 'foto' }>).velo, undefined);
    assert.equal((r.find((c) => c.tipo === 'texto' && c.id === 'titular') as Extract<CapaPropuesta, { tipo: 'texto' }>).color, '@carbon');
    const sinFoto = capas().filter((c) => c.tipo !== 'foto');
    const r2 = aplicarAjustes(sinFoto, ajustesPara(['CONTRASTE: «apoyo» tiene un contraste de 2:1 con su fondo en su peor zona; se pide al menos 4.5:1.'], colores)!);
    assert.equal((r2.find((c) => c.tipo === 'texto' && c.id === 'apoyo') as Extract<CapaPropuesta, { tipo: 'texto' }>).color, '@hueso');
    assert.ok(!r2.some((c) => c.tipo === 'foto'));
  });

  it('si la foto ya tenía velo en el otro lado, quedan los dos', () => {
    const conVelo = capas().map((c) => (c.tipo === 'foto' ? { ...c, velo: 'arriba' as const, colorVelo: '@carbon' } : c));
    const r = aplicarAjustes(conVelo, ajustesPara(['CONTRASTE: «apoyo» tiene un contraste de 3.34:1 con su fondo en su peor zona; se pide al menos 4.5:1.'], colores)!);
    assert.equal((r.find((c) => c.tipo === 'foto') as Extract<CapaPropuesta, { tipo: 'foto' }>).velo, 'ambos');
  });
});

describe('estudio de arte · legibilidad del titular a 360 px', () => {
  it('tolera una letra confundida por el OCR, pero no una palabra tapada', async () => {
    const { seLee } = await import('../src/aplicacion/arte/estudioDeArte.js');
    assert.equal(seLee('Croquetas\nvariadas', ['EL ANDEN', 'Croquelas', 'variadas', 'ETXEBARRI']), true);
    assert.equal(seLee('CHULETÓN\nTRINCHADO', ['CARNES A LA BRASA', 'TORRE DE VEGA', 'CHU', 'TRJ', '[TON']), false);
    assert.equal(seLee('CHULETÓN\nTRINCHADO', ['CHULETÓNI', 'TRINCHAD0']), true);
    assert.equal(seLee('AL CENTRO', ['ALCELTRO', 'TORRE DE VEGA']), true, 'palabras pegadas con una letra mal');
    assert.equal(seLee('AL CENTRO', ['AL', 'CHIRO']), false);
  });
});

describe('estudio de arte · textos que explican', () => {
  it('un «parentesco» o una idea demasiado largos se recortan en lugar de tumbar el plan (Argon, 23/11)', async () => {
    const { Receta } = await import('../src/dominio/arte/receta.js');
    const largo = 'Toma de la referencia la retícula vertical, el titular gigante entrelazado y los filetes finos '.repeat(5);
    const r = Receta.shape.parentesco.parse(largo)!;
    assert.ok(r.length <= 240);
    assert.ok(r.endsWith('…'));
    assert.ok(Receta.shape.idea.parse(largo).length <= 280);
  });
});
