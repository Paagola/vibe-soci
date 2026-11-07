/**
 * F1.5 · Sistema de conocimiento: perfil de marca v2, aprendizaje (observaciones) y recuperación de oficios.
 * Lee los archivos reales de conocimiento/ y marcas/ (sin gastar ni escribir).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ConocimientoFicheros } from '../src/adaptadores/ficheros/ConocimientoFicheros.js';
import { RAIZ } from '../src/config.js';
import { Observacion, estadoDe, paraElDirector, type Evidencia } from '../src/dominio/aprendizaje.js';
import { leerDocumento, seleccionar } from '../src/dominio/conocimiento.js';
import { PerfilDeMarca, perfilDesdeMarca } from '../src/dominio/marca/perfil.js';
import { Marca, Valoracion } from '../src/dominio/modelos.js';

const leerJson = async (ruta: string) => JSON.parse(await readFile(join(RAIZ, ruta), 'utf8')) as unknown;

describe('F1.5 · perfil de marca v2', () => {
  it('el perfil de Etxebarri es válido y cada dato dice de dónde sale', async () => {
    const perfil = PerfilDeMarca.parse(await leerJson('marcas/asador-etxebarri/perfil.json'));
    assert.equal(perfil.constantes.nombre.valor, 'Asador Etxebarri');
    assert.ok(perfil.pendientes.some((p) => p.includes('logotipo')), 'el logotipo consta como pendiente, no se inventa');
    const propuestas = Object.values(perfil.variables).filter((d) => d && d.fuente === 'ESTUDIO');
    assert.ok(propuestas.every((d) => d!.confirmado === false), 'lo que propone el estudio no está confirmado');
  });

  it('desde el marca.json de la web solo saca lo que hay; el resto queda pendiente', async () => {
    const marca = Marca.parse(await leerJson('plantillas/marca.ejemplo.json'));
    const perfil = perfilDesdeMarca(marca, 'plantillas/marca.ejemplo.json');
    assert.equal(perfil.constantes.ubicacion.valor, 'Axpe (Bizkaia)');
    assert.equal(perfil.constantes.paleta?.valor.length, 2);
    assert.equal(perfil.constantes.firma, undefined, 'sin Instagram ni web no hay firma');
    assert.deepEqual(perfil.variables, {}, 'las variables no salen de ningún dato');
    assert.ok(perfil.pendientes.includes('datos de contacto para la llamada a la acción (reservas, web, teléfono)'));
    assert.ok(Object.values(perfil.constantes).every((d) => !d || (d.fuente === 'DOCUMENTO' && !d.confirmado)));
  });
});

describe('F1.5 · aprendizaje: hipótesis, observada, confirmada', () => {
  const ev = (pieza: string, juicio: 'A_FAVOR' | 'EN_CONTRA', cambios: Partial<Evidencia> = {}): Evidencia => ({
    origen: 'HUMANA',
    autor: 'PROPIETARIO',
    fecha: '2026-11-07',
    pieza,
    explicita: false,
    motivo: { aspecto: 'FOTOGRAFIA', juicio, detalle: 'la luz de brasa' },
    ...cambios,
  });
  const obs = (evidencias: Evidencia[], marca = 'asador-etxebarri') =>
    Observacion.parse({ id: 'claroscuro', marca, aspecto: 'FOTOGRAFIA', enunciado: 'prefiere el claroscuro de brasa', evidencias });

  it('una valoración es una hipótesis; dos piezas, observada; tres, confirmada', () => {
    assert.equal(estadoDe(obs([ev('p1', 'A_FAVOR')])), 'HIPOTESIS');
    assert.equal(estadoDe(obs([ev('p1', 'A_FAVOR'), ev('p1', 'A_FAVOR')])), 'HIPOTESIS', 'dos votos de la misma pieza no son dos piezas');
    assert.equal(estadoDe(obs([ev('p1', 'A_FAVOR'), ev('p2', 'A_FAVOR')])), 'OBSERVADA');
    assert.equal(estadoDe(obs([ev('p1', 'A_FAVOR'), ev('p2', 'A_FAVOR'), ev('p3', 'A_FAVOR')])), 'CONFIRMADA');
    assert.equal(estadoDe(obs([ev('p1', 'A_FAVOR', { explicita: true })])), 'CONFIRMADA', 'si el dueño lo dice como regla');
  });

  it('las votaciones de un script, del crítico o de una medida no se convierten en preferencia del dueño', () => {
    const otras = (['AUTOMATICA', 'CRITICO', 'DETERMINISTA'] as const).flatMap((origen) => [ev('p1', 'A_FAVOR', { origen }), ev('p2', 'A_FAVOR', { origen }), ev('p3', 'A_FAVOR', { origen })]);
    assert.equal(estadoDe(obs(otras)), 'HIPOTESIS');
    assert.deepEqual(paraElDirector([obs(otras)]).preferencias, []);
  });

  it('el criterio del estudio no es el gusto de un restaurante, y viceversa', () => {
    const delEstudio = [ev('p1', 'A_FAVOR', { autor: 'ESTUDIO' }), ev('p2', 'A_FAVOR', { autor: 'ESTUDIO' })];
    assert.equal(estadoDe(obs(delEstudio, 'asador-etxebarri')), 'HIPOTESIS');
    assert.equal(estadoDe(obs(delEstudio, 'estudio')), 'OBSERVADA');
  });

  it('si las valoraciones humanas se contradicen, queda en duda y no se aplica', () => {
    const o = obs([ev('p1', 'A_FAVOR'), ev('p2', 'A_FAVOR'), ev('p3', 'EN_CONTRA')]);
    assert.equal(estadoDe(o), 'EN_DUDA');
    assert.deepEqual(paraElDirector([o]).enDuda.map((x) => x.id), ['claroscuro']);
  });

  it('las observaciones del estudio (valoración de la F1) son válidas y están confirmadas', async () => {
    const { observaciones } = (await leerJson('conocimiento/observaciones/estudio.json')) as { observaciones: unknown[] };
    const lista = observaciones.map((o) => Observacion.parse(o));
    assert.ok(lista.length >= 4);
    assert.ok(lista.every((o) => estadoDe(o) === 'CONFIRMADA'), lista.map((o) => `${o.id}:${estadoDe(o)}`).join(' '));
  });

  it('una valoración admite motivos estructurados, y las antiguas sin ellos siguen siendo válidas', () => {
    const base = { fecha: '2026-11-07', localSlug: 'x', piezaId: 'p', diapositiva: 1, version: 1, veredicto: 'GUSTA', motivo: 'la luz', prompt: 'p', archivo: 'a.png' };
    assert.ok(Valoracion.parse(base));
    const con = Valoracion.parse({ ...base, motivos: [{ aspecto: 'TIPOGRAFIA', juicio: 'A_FAVOR', detalle: 'la frase en bandera' }] });
    assert.equal(con.motivos?.[0]?.aspecto, 'TIPOGRAFIA');
  });
});

describe('F1.5 · recuperación de conocimiento', () => {
  it('lee la cabecera y rechaza fases desconocidas', () => {
    const d = leerDocumento('x.md', '---\nnombre: x\nresumen: algo\nfases: revision, texto\nformatos: carrusel\n---\n# Cuerpo');
    assert.deepEqual(d?.fases, ['revision', 'texto']);
    assert.equal(d?.cuerpo, '# Cuerpo');
    assert.equal(leerDocumento('readme.md', '# Sin cabecera'), null);
    assert.throws(() => leerDocumento('y.md', '---\nnombre: y\nresumen: algo\nfases: inventada\n---\n'), /desconocid/);
  });

  it('el director recibe solo lo que toca en cada fase', async () => {
    const documentos = await new ConocimientoFicheros(join(RAIZ, 'conocimiento')).documentos();
    const nombres = (fase: Parameters<typeof seleccionar>[1]['fase']) => seleccionar(documentos, { fase, formato: 'carrusel' }).map((d) => d.nombre);
    assert.ok(nombres('fotografia').includes('fotografia-gastronomica'));
    assert.ok(!nombres('fotografia').includes('texto-publicitario'));
    assert.ok(nombres('revision').includes('rubrica') && nombres('revision').includes('revision-visual'));
    assert.ok(nombres('concepto').includes('ref-think-small'));
    assert.ok(!documentos.some((d) => d.ruta.endsWith('README.md')), 'los README no se ofrecen');
    assert.ok(documentos.length >= 12, `${documentos.length} documentos`);
  });
});
