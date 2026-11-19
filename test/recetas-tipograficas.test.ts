/**
 * Recetas de tipografía especial (tipografia/receta@1): el lenguaje con el que se describen los estilos para que un
 * agente pueda crear estilos nuevos sin escribir código. Se comprueba que la validación caza recetas rotas, que los
 * parámetros se respetan, que una receta en pruebas se puede pintar pero no publicar y que la biblioteca es válida.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { CompositorSharp } from '../src/adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../src/adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { BibliotecaTratamientosFicheros } from '../src/adaptadores/ficheros/BibliotecaTratamientosFicheros.js';
import { RAIZ } from '../src/config.js';
import { Intencion } from '../src/dominio/diseno/intencion.js';
import { problemasDeReceta, Receta, valoresDeParametros } from '../src/dominio/tipografia/receta.js';

const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
const compositor = new CompositorSharp(new MotorTexto(catalogo), catalogo);
const biblioteca = new BibliotecaTratamientosFicheros(join(RAIZ, 'recursos', 'tratamientos'));

/** Una receta mínima válida: letras con un desenfoque que depende de un parámetro. */
function receta(cambios: Record<string, unknown> = {}): Receta {
  return Receta.parse({
    esquema: 'tipografia/receta@1',
    id: 'humo',
    nombre: 'Humo',
    version: 1,
    estado: 'PRUEBA',
    descripcion: 'Letra que se deshace como humo (prueba).',
    origen: { autor: 'AGENTE', fecha: '2026-11-19', brief: 'prueba' },
    ficha: { materiales: ['humo'] },
    parametros: { niebla: { tipo: 'numero', min: 0, max: 0.2, defecto: 0.05, descripcion: 'Cuánto se difumina.' } },
    filtros: { humo: [{ tipo: 'desenfocar', entrada: 'origen', radio: '$niebla' }] },
    dibujo: { grupo: [{ letras: true }], filtro: 'humo', relleno: '@texto' },
    ...cambios,
  });
}

function intencion(tratamiento: unknown): Intencion {
  return Intencion.parse({
    esquema: 'diseno/intencion@1',
    id: 'prueba-recetas',
    titulo: 'prueba',
    marca: 'prueba',
    activos: {},
    tokens: { colores: { fondo: '#1A1A1A', tinta: '#F2C14E' }, estilos: { cartel: { fuente: 'bebas-neue', ejes: {}, caso: 'mayusculas', tracking: 0, interlineado: 0.9, color: '@tinta' } } },
    capas: [
      { id: 'fondo', tipo: 'relleno', color: '@fondo' },
      { id: 't', tipo: 'texto', texto: 'HUMO', estilo: 'cartel', caja: { x: 0.1, y: 0.3, w: 0.8, h: 0.2 }, ajuste: 'ancho', tratamiento },
    ],
  });
}

describe('recetas: validación', () => {
  it('una receta bien hecha no tiene problemas', () => {
    assert.deepEqual(problemasDeReceta(receta()), []);
  });

  it('caza parámetros sin declarar o del tipo equivocado, entradas que no existen y filtros o emisores que faltan', () => {
    const p = (cambios: Record<string, unknown>) => problemasDeReceta(receta(cambios)).join(' | ');
    assert.match(p({ filtros: { humo: [{ tipo: 'desenfocar', entrada: 'origen', radio: '$espesor' }] } }), /«espesor» no está declarado/);
    assert.match(p({ filtros: { humo: [{ tipo: 'inundar', color: '$niebla' }] } }), /es de tipo numero y aquí se usa como color/);
    assert.match(p({ filtros: { humo: [{ tipo: 'desplazar', entrada: 'origen', mapa: 'ruido', escala: 0.02 }] } }), /usa «ruido», que no existe todavía/);
    assert.match(p({ dibujo: { grupo: [{ letras: true }], filtro: 'vapor' } }), /filtro «vapor», que no está/);
    assert.match(p({ dibujo: { grupo: [{ emisor: 'chispas' }] } }), /emisor «chispas», que no está/);
    assert.match(p({ parametros: { niebla: { tipo: 'numero', min: 0, max: 0.2, defecto: 0.5, descripcion: 'x' } } }), /entre el mínimo y el máximo/);
  });

  it('una receta demasiado grande no pasa', () => {
    const nodos = Array.from({ length: 21 }, () => ({ tipo: 'desenfocar', entrada: 'origen', radio: 0.01 }));
    assert.match(problemasDeReceta(receta({ filtros: { a: nodos, b: nodos } })).join(), /máximo es 40/);
  });

  it('el esquema rechaza piezas que no están en la lista blanca', () => {
    assert.throws(() => receta({ filtros: { humo: [{ tipo: 'script', codigo: 'alert(1)' }] } }));
    assert.throws(() => receta({ filtros: { humo: [{ tipo: 'desenfocar', entrada: 'origen', radio: 0.1, href: 'http://x' }] } }));
  });

  it('los parámetros pedidos se comprueban; los que faltan toman su valor por defecto', () => {
    const r = receta();
    assert.deepEqual(valoresDeParametros(r, {}), { valores: { niebla: 0.05 }, problemas: [] });
    assert.match(valoresDeParametros(r, { niebla: 0.9 }).problemas.join(), /va de 0 a 0.2/);
    assert.match(valoresDeParametros(r, { humo: 1 }).problemas.join(), /no tiene el parámetro «humo»/);
  });
});

describe('recetas: en el compositor', () => {
  it('una receta en línea se pinta, pero en PRUEBA no se puede publicar (error)', async () => {
    const resuelto = await compositor.resolver(intencion({ receta: receta(), parametros: { niebla: 0.1 } }), {});
    const t = resuelto.capas.find((c) => c.tipo === 'texto');
    assert.ok(t?.tipo === 'texto' && t.tratamiento?.receta.id === 'humo' && t.tratamiento.valores.niebla === 0.1);
    assert.ok(resuelto.problemas.some((p) => p.gravedad === 'ERROR' && p.tipo === 'TRATAMIENTO' && /PRUEBA/.test(p.mensaje)));
    const { png } = await compositor.renderizar(resuelto, {});
    assert.ok(png.length > 1000);
  });

  it('un parámetro fuera de rango o un estilo que no existe paran con un error claro', async () => {
    await assert.rejects(compositor.resolver(intencion({ receta: receta(), parametros: { niebla: 3 } }), {}), /va de 0 a 0.2/);
    await assert.rejects(compositor.resolver(intencion({ receta: 'caramelo-imposible' }), {}), /No hay ningún estilo «caramelo-imposible».*Hay: antigua, derretida, neon, papel/);
  });

  it('un estilo retirado no se puede usar', async () => {
    await assert.rejects(compositor.resolver(intencion({ receta: receta({ estado: 'RETIRADO' }) }), {}), /retirado/);
  });

  it('un color de parámetro puede ser un token de la marca', async () => {
    const resuelto = await compositor.resolver(intencion({ receta: 'papel', parametros: { alma: '@fondo' } }), {});
    const t = resuelto.capas.find((c) => c.tipo === 'texto');
    assert.ok(t?.tipo === 'texto' && t.tratamiento?.valores.alma === '#1A1A1A');
  });
});

describe('recetas: biblioteca', () => {
  it('las recetas de recursos/tratamientos son válidas, están aprobadas y su id coincide con su carpeta', () => {
    const recetas = biblioteca.listar();
    assert.deepEqual(
      recetas.map((r) => r.id),
      ['antigua', 'derretida', 'neon', 'papel'],
    );
    for (const r of recetas) {
      assert.equal(r.estado, 'APROBADO', r.id);
      assert.deepEqual(problemasDeReceta(r), [], r.id);
      assert.ok(r.ficha.materiales.length > 0 && r.ficha.identidades.length > 0, `${r.id} tiene ficha para el buscador`);
    }
  });

  it('cada receta declara en su ficha lo que observamos en la hoja del 19/11', () => {
    const derretida = Receta.parse(JSON.parse(readFileSync(join(RAIZ, 'recursos', 'tratamientos', 'derretida', 'receta.json'), 'utf8')));
    assert.ok(derretida.ficha.fuentes.noAptas.includes('alto-contraste'));
    assert.ok(derretida.ficha.materiales.includes('chocolate'));
  });
});
