/**
 * F1 · Compositor: retícula, motor de texto, resolutor y renderizador.
 * Usa activos sintéticos creados aquí (un «plato» redondo con su máscara): no depende de datos/ ni gasta.
 * La calidad visual de los diseños de DAK Burger se revisa a ojo (diseno/f1/); aquí se comprueba que el motor hace lo que dice.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { CompositorSharp } from '../src/adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../src/adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenDisenosFicheros } from '../src/adaptadores/ficheros/AlmacenDisenosFicheros.js';
import { ProcesadorSharp } from '../src/adaptadores/imagen/ProcesadorSharp.js';
import { componerDiseno } from '../src/aplicacion/diseno/componerDiseno.js';
import { RAIZ } from '../src/config.js';
import type { Activo } from '../src/dominio/activos.js';
import { Intencion } from '../src/dominio/diseno/intencion.js';
import { conActivo, conTexto } from '../src/dominio/diseno/operaciones.js';
import { rectDeCaja, zonaSegura } from '../src/dominio/diseno/reticula.js';
import type { ActivoDisponible } from '../src/puertos/Compositor.js';

const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
const motor = new MotorTexto(catalogo);
const lienzo = { ancho: 1080, alto: 1440 };
const reticula = { columnas: 12, filas: 16, margen: 72, medianil: 12 };
const titular = { fuente: 'anybody', ejes: { wdth: 50, wght: 900 }, caso: 'mayusculas' as const, tracking: 0, interlineado: 0.85 };

let carpeta: string;
let activos: AlmacenActivosFicheros;
let plato: ActivoDisponible;
let platoPequeno: ActivoDisponible;

/** Un «plato» sintético: círculo rojo sobre gris, con su máscara y su activo.json. */
async function crearActivo(id: string, lado: number, uso: Activo['uso']): Promise<ActivoDisponible> {
  const dir = join(carpeta, 'locales', 'prueba', 'activos', id);
  await mkdir(dir, { recursive: true });
  const r = lado * 0.4;
  const circulo = (relleno: string, fondo: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="100%" height="100%" fill="${fondo}"/><circle cx="${lado / 2}" cy="${lado / 2}" r="${r}" fill="${relleno}"/></svg>`);
  await sharp(circulo('#c0392b', '#777777')).png().toFile(join(dir, 'original.png'));
  await sharp(circulo('#ffffff', '#000000')).greyscale().png().toFile(join(dir, 'mascara.png'));
  const sha = createHash('sha256').update(await readFile(join(dir, 'original.png'))).digest('hex');
  const bbox = { x: Math.round(lado / 2 - r), y: Math.round(lado / 2 - r), w: Math.round(2 * r), h: Math.round(2 * r) };
  const activo: Activo = {
    id,
    localSlug: 'prueba',
    tipo: uso === 'PUBLICABLE' ? 'REAL' : 'GENERADO',
    uso,
    descripcion: 'plato sintético de prueba',
    archivo: 'original.png',
    ancho: lado,
    alto: lado,
    sha256: sha,
    procedencia: { ruta: 'test', sha256: sha, copiadoEn: '2026-11-06T00:00:00Z' },
    alteraciones: uso === 'PUBLICABLE' ? [] : ['círculo de prueba'],
    mascara: { archivo: 'mascara.png', metodo: 'MANUAL', creadaEn: '2026-11-06T00:00:00Z', bbox, incluye: 'el círculo' },
    niveles: [
      { id: 'arriba', y: 0.1, nombre: 'arriba' },
      { id: 'abajo', y: 0.9, nombre: 'abajo' },
    ],
  };
  await writeFile(join(dir, 'activo.json'), JSON.stringify(activo));
  return activos.obtener('prueba', id);
}

/** Una intención mínima: fondo, titular detrás del plato y un texto pequeño arriba. */
function intencionBase(cambios: Partial<Intencion> = {}): Intencion {
  return Intencion.parse({
    esquema: 'diseno/intencion@1',
    id: 'prueba',
    titulo: 'prueba',
    marca: 'prueba',
    activos: { plato: 'plato-grande' },
    tokens: {
      colores: { rojo: '#FF3B1F', negro: '#0B0B0B' },
      estilos: {
        titular: { ...titular, color: '@negro' },
        pequeno: { fuente: 'archivo', ejes: { wdth: 100, wght: 600 }, caso: 'mayusculas', tracking: 0.14, interlineado: 1.3, color: '@negro' },
      },
    },
    textos: { titular: 'TRES', firma: 'DAK Burger' },
    capas: [
      { id: 'fondo', tipo: 'relleno', color: '@rojo' },
      { id: 'titular', tipo: 'texto', texto: '@titular', estilo: 'titular', caja: { col: [1, 12], fila: [4, 10] }, ajuste: 'eje-ancho', alinear: 'centro' },
      { id: 'plato', tipo: 'recorte', activo: 'plato', escala: { anchoSujeto: 0.6 }, ancla: { caja: { x: 0, y: 0, w: 1, h: 1 }, alinear: 'abajo-centro' }, sangradoAbajo: 0.1 },
      { id: 'firma', tipo: 'texto', texto: '@firma', estilo: 'pequeno', caja: { col: [1, 6], fila: [2, 2] }, ajuste: 'fijo', tamano: 26 },
      { id: 'grano', tipo: 'textura', recurso: 'grano', intensidad: 0.08, fusion: 'overlay' },
    ],
    relaciones: [
      { tipo: 'detras', texto: 'titular', sujeto: 'plato', cobertura: [0.2, 0.3] },
      { tipo: 'noSolapar', textos: ['firma'], sujeto: 'plato', maximo: 0 },
    ],
    ...cambios,
  });
}

before(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'estudio-f1-'));
  activos = new AlmacenActivosFicheros(join(carpeta, 'locales'));
  plato = await crearActivo('plato-grande', 1400, 'SOLO_PRUEBA_COMPOSICION');
  platoPequeno = await crearActivo('plato-pequeno', 300, 'PUBLICABLE');
});

after(() => rm(carpeta, { recursive: true, force: true }));

describe('F1 · retícula y zona segura', () => {
  it('pasa celdas y fracciones a píxeles', () => {
    assert.deepEqual(rectDeCaja({ col: [1, 12], fila: [1, 1] }, lienzo, reticula), { x: 72, y: 72, w: 936, h: 69.75 });
    const caja = rectDeCaja({ col: [7, 12], fila: [16, 16] }, lienzo, reticula);
    assert.equal(caja.x + caja.w, 1008);
    assert.equal(caja.y + caja.h, 1368);
    assert.deepEqual(rectDeCaja({ x: -0.1, y: 0.5, w: 1.2, h: 0.25 }, lienzo, reticula), { x: -108, y: 720, w: 1296, h: 360 });
    assert.throws(() => rectDeCaja({ col: [0, 13], fila: [1, 1] }, lienzo, reticula), /fuera de la retícula/);
  });

  it('la zona segura del feed deja libre lo que recorta el 4:5', () => {
    assert.deepEqual(zonaSegura(lienzo, 72), { x: 72, y: 117, w: 936, h: 1206 });
  });
});

describe('F1 · motor de texto', () => {
  it('«ancho»: la palabra ocupa exactamente el ancho de la caja', () => {
    const bloque = motor.componer({ texto: 'MANHATTAN', estilo: titular, caja: { x: 0, y: 0, w: 800, h: 400 }, ajuste: 'ancho', alinear: 'izquierda', vertical: 'arriba' });
    assert.ok(Math.abs(bloque.visual.w - 800) < 0.6, `ancho visual ${bloque.visual.w}`);
    assert.ok(Math.abs(bloque.visual.x) < 0.6, 'empieza en el borde visual de la caja');
  });

  it('«eje-ancho»: las mayúsculas llenan el alto y el eje de anchura de la fuente llena el ancho', () => {
    const bloque = motor.componer({ texto: 'TRES', estilo: titular, caja: { x: 0, y: 0, w: 900, h: 300 }, ajuste: 'eje-ancho', alinear: 'izquierda', vertical: 'arriba' });
    assert.ok(Math.abs(motor.alturaMayusculas({ ...titular, ejes: bloque.ejes }, bloque.tamano) - 300) < 1, 'mayúsculas de 300 px');
    assert.ok(Math.abs(bloque.visual.w - 900) < 2, `ancho ${bloque.visual.w}`);
    assert.ok(bloque.ejes.wdth! > 50 && bloque.ejes.wdth! < 150, `wdth ajustado: ${bloque.ejes.wdth}`);
  });

  it('parte las líneas sin dejar «de», «en», «una»… al final ni una palabra sola en la última', () => {
    const estilo = { fuente: 'archivo', ejes: { wdth: 100, wght: 500 }, caso: 'tal-cual' as const, tracking: 0, interlineado: 1.3 };
    const cortas = new Set(['de', 'en', 'una', 'y', 'la', 'el']);
    // 383 px es el ancho en el que la regla contra viudas dejaba «…en una» al final (fallo visto en el diseño B).
    for (const ancho of [330, 383, 450]) {
      const lineas = motor.partirParrafos(estilo, ['Tres carnes, tres de bacon y tres de cheddar en una sola torre.'], ancho, 28);
      for (const linea of lineas.slice(0, -1)) assert.ok(!cortas.has(linea.split(' ').at(-1)!), `${ancho} px: «${linea}» termina en palabra corta`);
      assert.ok(lineas.at(-1)!.split(' ').length > 1, `${ancho} px: viuda «${lineas.at(-1)}»`);
    }
  });

  it('las dos fuentes tienen todos los caracteres del español', () => {
    for (const fuente of ['anybody', 'archivo']) {
      const { fuente: f } = catalogo.fuente(fuente);
      const linea = f.layout('ÁÉÍÓÚÜÑáéíóúüñ¿¡«»€·');
      assert.ok(linea.glyphs.every((g) => g.id !== 0), `${fuente}: falta algún glifo`);
    }
  });
});

describe('F1 · resolutor', () => {
  const compositor = new CompositorSharp(motor, catalogo);

  it('«detrás»: mueve el titular hasta que el plato tape lo pedido en su parte más tapada', async () => {
    const resuelto = await compositor.resolver(intencionBase(), { plato });
    const franja = resuelto.medidas.cobertura['titular:franja']!;
    assert.ok(franja >= 0.2 && franja <= 0.3, `cobertura ${franja}`);
    assert.ok(resuelto.medidas.cobertura.titular! < franja, 'la media es menor que la peor franja');
    assert.equal(resuelto.problemas.filter((p) => p.tipo === 'COBERTURA').length, 0);
  });

  it('avisa del solape, la zona segura, el tamaño mínimo y la ampliación excesiva', async () => {
    const intencion = intencionBase();
    const capas = intencion.capas.map((c) => {
      if (c.id === 'firma') return { ...c, caja: { x: 0.3, y: 0.85, w: 0.4, h: 0.04 }, tamano: 18 } as typeof c; // encima del plato y pequeña
      if (c.id === 'titular') return { ...c, caja: { x: 0.0667, y: 0.0, w: 0.8667, h: 0.2 } } as typeof c; // fuera de la zona segura
      return c;
    });
    const resuelto = await compositor.resolver(
      { ...intencion, capas, activos: { plato: 'plato-pequeno' }, relaciones: intencion.relaciones.filter((r) => r.tipo !== 'detras') },
      { plato: platoPequeno },
    );
    const tipos = resuelto.problemas.map((p) => `${p.tipo}:${p.capa}`);
    assert.ok(tipos.includes('SOLAPE:firma'), tipos.join(' '));
    assert.ok(tipos.includes('ZONA_SEGURA:titular'), tipos.join(' '));
    assert.ok(tipos.includes('TAMANO_MINIMO:firma'), tipos.join(' '));
    assert.ok(tipos.includes('RESOLUCION:plato'), tipos.join(' '));
  });

  it('el mínimo de lectura en el móvil es de 22 px de mayúscula: una línea de 24 px de cuerpo no llega (revisión 08/11)', async () => {
    const intencion = intencionBase({ relaciones: [] });
    const capas = intencion.capas.map((c) => (c.id === 'firma' ? ({ ...c, tamano: 24 } as typeof c) : c));
    const pequena = await compositor.resolver({ ...intencion, capas }, { plato });
    assert.ok(pequena.problemas.some((p) => p.tipo === 'TAMANO_MINIMO' && p.capa === 'firma'));
    const grande = await compositor.resolver({ ...intencion, capas: capas.map((c) => (c.id === 'firma' ? ({ ...c, tamano: 34 } as typeof c) : c)) }, { plato });
    assert.ok(!grande.problemas.some((p) => p.tipo === 'TAMANO_MINIMO' && p.capa === 'firma'));
  });

  it('avisa si dos textos apilados van pegados o montados, y no si respiran o están lado a lado (revisión 08/11)', async () => {
    const texto = (id: string, x: number, y: number) =>
      ({ id, tipo: 'texto', texto: '@firma', estilo: 'pequeno', caja: { x, y, w: 0.35, h: 0.03 }, ajuste: 'fijo', tamano: 40 }) as const;
    const separacion = async (b: { x: number; y: number }) => {
      const intencion = intencionBase({
        capas: [{ id: 'fondo', tipo: 'relleno', color: '@rojo' }, texto('arriba', 0.1, 0.3), texto('abajo', b.x, b.y)] as Intencion['capas'],
        relaciones: [],
      });
      return (await compositor.resolver(intencion, { plato })).problemas.filter((p) => p.tipo === 'SEPARACION');
    };
    const pegados = await separacion({ x: 0.1, y: 0.3 + 32 / 1440 });
    assert.equal(pegados.length, 1);
    assert.equal(pegados[0]?.capa, 'abajo');
    assert.equal((await separacion({ x: 0.1, y: 0.4 })).length, 0, 'con aire de sobra');
    assert.equal((await separacion({ x: 0.55, y: 0.3 })).length, 0, 'lado a lado, en otra columna');
  });

  it('«alineadoCon»: el recorte se queda en el mismo sitio y a la misma escala que su foto, aunque se salga del marco', async () => {
    const intencion = intencionBase({
      capas: [
        { id: 'fondo', tipo: 'relleno', color: '@rojo', opacidad: 1, fusion: 'normal', oculta: false },
        { id: 'ventana', tipo: 'imagen', activo: 'plato', caja: { col: [1, 6], fila: [2, 8] }, enfoque: { x: 0.5, y: 0.5 }, zoom: 1.6, opacidad: 1, fusion: 'normal', oculta: false },
        { id: 'plato', tipo: 'recorte', activo: 'plato', alineadoCon: 'ventana', sangradoAbajo: 0, bordeSuave: 0.8, contraerBorde: 0, opacidad: 1, fusion: 'normal', oculta: false },
      ],
      relaciones: [],
    });
    const resuelto = await compositor.resolver(intencion, { plato });
    const ventana = resuelto.capas.find((c) => c.id === 'ventana')!;
    const recorte = resuelto.capas.find((c) => c.id === 'plato')!;
    assert.ok(ventana.tipo === 'imagen' && recorte.tipo === 'recorte');
    const escala = ventana.destino.w / ventana.origen.w;
    assert.ok(Math.abs(recorte.destino.w / recorte.origen.w - escala) < 1e-9, 'misma escala');
    assert.ok(Math.abs(recorte.destino.x - (ventana.destino.x + (recorte.origen.x - ventana.origen.x) * escala)) < 1e-6, 'misma posición');
    assert.ok(recorte.destino.x < ventana.marco.x || recorte.destino.x + recorte.destino.w > ventana.marco.x + ventana.marco.w, 'el plato se sale del marco');
  });
});

describe('F1 · renderizador', () => {
  it('pinta cada capa aparte, a 1080 × 1440, y siempre igual', async () => {
    const compositor = new CompositorSharp(motor, catalogo);
    const resuelto = await compositor.resolver(intencionBase(), { plato });
    const primero = await compositor.renderizar(resuelto, { plato });
    const meta = await sharp(primero.png).metadata();
    assert.deepEqual([meta.width, meta.height], [1080, 1440]);
    assert.equal(primero.capas.length, 5);
    for (const capa of primero.capas) {
      const m = await sharp(capa.png).metadata();
      assert.deepEqual([m.width, m.height, m.channels], [1080, 1440, 4], capa.id);
    }
    const otro = await new CompositorSharp(motor, catalogo).renderizar(resuelto, { plato });
    assert.equal(createHash('sha256').update(otro.png).digest('hex'), createHash('sha256').update(primero.png).digest('hex'), 'mismo documento → mismos píxeles');
  });

  it('cambiar el titular solo repinta el titular; cambiar la foto no repinta los textos', async () => {
    const compositor = new CompositorSharp(motor, catalogo);
    const base = intencionBase();
    await compositor.renderizar(await compositor.resolver(base, { plato }), { plato });

    const conOtroTexto = conTexto(base, 'titular', 'TORRE');
    const r1 = await compositor.renderizar(await compositor.resolver(conOtroTexto, { plato }), { plato });
    assert.deepEqual(r1.capas.filter((c) => !c.reutilizada).map((c) => c.id), ['titular']);
    assert.equal(conOtroTexto.version, 2);
    assert.equal(conOtroTexto.padre, 1);

    const sinDetras = { ...base, relaciones: base.relaciones.filter((r) => r.tipo !== 'detras') };
    await compositor.renderizar(await compositor.resolver(sinDetras, { plato }), { plato });
    const conOtraFoto = conActivo(sinDetras, 'plato', 'plato-pequeno');
    const r2 = await compositor.renderizar(await compositor.resolver(conOtraFoto, { plato: platoPequeno }), { plato: platoPequeno });
    assert.deepEqual(r2.capas.filter((c) => !c.reutilizada).map((c) => c.id), ['plato']);
  });

  it('el SVG editable lleva el texto como texto y el exacto como trazos', async () => {
    const compositor = new CompositorSharp(motor, catalogo);
    const r = await compositor.renderizar(await compositor.resolver(intencionBase(), { plato }), { plato });
    assert.match(r.svgEditable, /<text[^>]*>TRES<\/text>/);
    assert.match(r.svgEditable, /font-family="Anybody"/);
    assert.doesNotMatch(r.svgExacto, /<text/);
    assert.match(r.svgExacto, /data-archivo="capas\/03-plato\.png" href="data:image\/png;base64,/);
  });

  it('mide el contraste real del texto con su fondo', async () => {
    const compositor = new CompositorSharp(motor, catalogo);
    const r = await compositor.renderizar(await compositor.resolver(intencionBase(), { plato }), { plato });
    // Negro #0B0B0B sobre rojo #FF3B1F: unos 5,5:1.
    assert.ok(Math.abs(r.contraste.firma! - 5.5) < 0.3, `contraste ${r.contraste.firma}`);
  });
});

describe('F1 · componer y guardar una versión', () => {
  it('guarda la versión entera, exporta a 3:4 y 4:5, avisa del activo de prueba y no sobrescribe', async () => {
    const salida = join(carpeta, 'disenos');
    const deps = { compositor: new CompositorSharp(motor, catalogo), activos, disenos: new AlmacenDisenosFicheros(salida), procesador: new ProcesadorSharp() };
    const resultado = await componerDiseno(deps, intencionBase(), 'prueba/composicion');
    for (const archivo of ['intencion.json', 'resuelto.json', 'diseno.png', 'diseno.svg', 'diseno-trazos.svg', 'capas/01-fondo.png', 'exportadas/3x4.jpg', 'exportadas/4x5.jpg']) {
      await stat(join(resultado.guardado.carpeta, archivo));
    }
    const m45 = await sharp(join(resultado.guardado.carpeta, 'exportadas/4x5.jpg')).metadata();
    assert.deepEqual([m45.width, m45.height], [1080, 1350]);
    assert.ok(resultado.resuelto.problemas.some((p) => p.tipo === 'FIDELIDAD'), 'avisa de que el activo no es publicable');
    await assert.rejects(componerDiseno(deps, intencionBase(), 'prueba/composicion'), /no se sobrescriben/);
  });
});
