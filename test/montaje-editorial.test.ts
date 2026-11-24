import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { it } from 'node:test';
import sharp from 'sharp';
import { CompositorSharp } from '../src/adaptadores/compositor/CompositorSharp.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { MotorTexto } from '../src/adaptadores/compositor/MotorTexto.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { MedidorDeFotoSharp } from '../src/adaptadores/imagen/MedidorDeFotoSharp.js';
import { ProcesadorSharp } from '../src/adaptadores/imagen/ProcesadorSharp.js';
import { componerVisual, crearPintor, registrarFotoGenerada } from '../src/aplicacion/arte/pieza.js';
import { RAIZ } from '../src/config.js';
import { Receta, type RecetaEntrada } from '../src/dominio/arte/receta.js';
import { Intencion, Tokens } from '../src/dominio/diseno/intencion.js';

const cabecera = { x: .08, y: .11, w: .65, h: .09 };
const corte: RecetaEntrada = {
  nombre: 'El corte', idea: 'Los estratos del pan sugieren el eje de lectura de una sección transversal.',
  lecturas: ['la sección', 'el nombre', 'el obrador'], esqueleto: 'MONTAJE_EDITORIAL', fondo: '@negro',
  producto: { escala: 'grande' }, titular: { texto: 'nombre', voz: 'titular', escala: 'grande', relacion: 'aparte' },
  firma: { texto: 'firma', voz: 'rotulo' },
  textos: [{ clave: 'nombre', texto: 'Corte\ntransversal', fuente: 'PLATO', cita: 'Corte transversal' },
    { clave: 'firma', texto: 'Obrador', fuente: 'MARCA', cita: 'Obrador' }],
  montaje: { capas: [
    { tipo: 'texto', id: 'eco', texto: 'nombre', voz: 'titular', caja: { x: -.1, y: .42, w: 1.2, h: .3 }, decorativo: true, desenfoque: 16, opacidad: .4, sangrado: true, linea: 1, color: '@principal' },
    { tipo: 'foto', caja: { x: .2, y: .39, w: .72, h: .4 }, ventana: { forma: 'poligono', puntos: [{ x: 0, y: 0 }, { x: 1, y: .12 }, { x: .92, y: 1 }, { x: 0, y: .91 }] } },
    { tipo: 'texto', id: 'primera', texto: 'nombre', linea: 0, voz: 'titular', caja: cabecera, color: '@blanco' },
    { tipo: 'texto', id: 'segunda', texto: 'nombre', linea: 1, voz: 'estudio-serif-editorial', caja: { ...cabecera, x: .27, y: .21 }, color: '@principal' },
    { tipo: 'linea', id: 'eje', desde: { x: .08, y: .34 }, hasta: { x: .92, y: .34 }, color: '@blanco' },
    { tipo: 'marco', id: 'cartela', caja: { x: .07, y: .82, w: .38, h: .072 }, color: '@blanco', grosor: 2, radio: 24 },
    { tipo: 'texto', id: 'firma', texto: 'firma', voz: 'rotulo', caja: { x: .09, y: .832, w: .34, h: .045 }, color: '@blanco' },
  ] },
};

it('produce una tercera composición desde una receta editorial con dos voces, eco y ventana, como capas revisables', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'pan-en-seccion-'));
  try {
    const activos = new AlmacenActivosFicheros(join(carpeta, 'locales'));
    const ruta = join(carpeta, 'pan.png');
    await sharp({ create: { width: 480, height: 640, channels: 3, background: '#ca8d51' } }).png().toFile(ruta);
    const foto = await registrarFotoGenerada(activos, { mascara: async () => { throw new Error('La ventana funciona sin máscara de sujeto.'); } }, { ruta, id: 'corte-nuevo', local: 'obrador', descripcion: 'Miga de pan' });
    const tokensMarca = Tokens.parse(JSON.parse(await readFile(join(RAIZ, 'marcas/torre-de-vega/tokens.json'), 'utf8')));
    const familias = new CatalogoTipografico(join(RAIZ, 'recursos/tipografias'));
    const pintar = crearPintor({ activos, procesador: new ProcesadorSharp(), tokensMarca, compositor: new CompositorSharp(new MotorTexto(familias), familias) });
    const salida = await componerVisual({ pintar, medidor: new MedidorDeFotoSharp(), corpus: { piezas: [], ruta: a => a } }, {
      id: 'seccion', local: 'obrador', foto, tokensMarca, mensaje: 'La miga vista en sección', creativo: false,
      hechos: { plato: 'Corte transversal de pan', elementos: [], local: { nombre: 'Obrador', ciudad: 'Madrid', descripcion: 'Panadería', tonos: [] } },
      direcciones: 1, vueltas: 0, salida: carpeta,
    }, Receta.parse(corte));
    assert.deepEqual(salida.problemas, []);
    assert.ok(salida.png && salida.capas);
    const intencion = Intencion.parse(JSON.parse(await readFile(join(dirname(salida.png), 'intencion.json'), 'utf8')));
    assert.deepEqual(intencion.capas.map(c => c.id), ['fondo', 'eco', 'foto', 'primera', 'segunda', 'eje', 'cartela', 'firma']);
    assert.deepEqual(intencion.activos, { foto: 'corte-nuevo' });
    assert.ok(intencion.capas.some(c => c.tipo === 'texto' && c.id === 'eco' && c.decorativo && c.desenfoque === 16));
    assert.ok(intencion.capas.some(c => c.tipo === 'imagen' && c.ventana?.forma === 'poligono'));
    assert.equal(intencion.relaciones.length, 3);
    assert.equal((await readdir(salida.capas)).filter(x => x.endsWith('.png')).length, 8);
    const { width, height } = await sharp(salida.png).metadata();
    assert.deepEqual([width, height], [1080, 1440]);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});

it('exige la foto, ids únicos y una versión informativa completa de cada texto, incluso si se repite en el fondo', () => {
  const sin = (id: string) => corte.montaje!.capas.filter(c => (c.tipo === 'foto' ? 'foto' : c.id) !== id);
  for (const id of ['foto', 'firma', 'segunda']) assert.equal(Receta.safeParse({ ...corte, montaje: { capas: sin(id) } }).success, false);
  assert.equal(Receta.safeParse({ ...corte, montaje: { capas: [...corte.montaje!.capas, corte.montaje!.capas[0]] } }).success, false);
});
