/**
 * Comprobación de salida (09/11/2026): la regla del dominio, el caso de uso con un revisor falso y las teselas.
 * Las respuestas de V1, DAK 2, café 1 y V3D son las que dio Gemini de verdad en el prototipo
 * (proyectos/prueba-comprobacion-salida/resultados.json). Sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { teselas } from '../src/adaptadores/gemini/RevisorVisualGemini.js';
import { comprobarFotoNueva } from '../src/aplicacion/fotos/comprobarFotoNueva.js';
import { listaYPiezas } from '../src/aplicacion/fotos/listaDePropuesta.js';
import { RAIZ } from '../src/config.js';
import { ChecklistVisual, ComparacionToma, ConteoAnatomia, decidirSalida } from '../src/dominio/comprobacionSalida.js';
import type { RevisorVisual } from '../src/puertos/RevisorVisual.js';

const reales = JSON.parse(await readFile(join(RAIZ, 'proyectos', 'prueba-comprobacion-salida', 'resultados.json'), 'utf8')) as {
  resultados: Array<{ id: string; checklist?: unknown; toma?: unknown }>;
};
const respuesta = (id: string) => {
  const r = reales.resultados.find((x) => x.id === id);
  if (!r) throw new Error(`falta ${id} en resultados.json`);
  return { checklist: ChecklistVisual.parse(r.checklist), toma: r.toma ? ComparacionToma.parse(r.toma) : undefined };
};
const otraToma = ComparacionToma.parse({ alturaReal: '¾ alta', alturaNueva: 'a ras de mesa', mismoLado: false, mismaDistancia: false, mismoPuntoDeVista: false });

describe('Comprobación de salida · la regla del dominio con las respuestas reales del prototipo', () => {
  it('V1 (tercera cabeza): DESCARTA por recuento y anatomía', () => {
    const { checklist, toma } = respuesta('V1');
    const d = decidirSalida(checklist, toma);
    assert.equal(d.final, 'DESCARTA');
    assert.ok(d.motivos.some((m) => /3 en vez de 2/.test(m)));
  });

  it('DAK 2 (texto inventado en el papel): DESCARTA por texto nuevo', () => {
    const d = decidirSalida(respuesta('DAK-2').checklist, otraToma);
    assert.equal(d.elementos, 'DESCARTA');
    assert.ok(d.motivos.some((m) => m.startsWith('texto nuevo')));
  });

  it('café 1 (posavasos): DESCARTA por elemento añadido', () => {
    const d = decidirSalida(respuesta('CAFE-1').checklist, otraToma);
    assert.ok(d.motivos.some((m) => m.startsWith('añadido') && /posavasos/.test(m)));
  });

  it('V3D (tres colas): el checklist solo no lo ve; con la anatomía por teselas que cuente 3 colas, DESCARTA', () => {
    const { checklist } = respuesta('V3D');
    assert.equal(decidirSalida(checklist, otraToma).final, 'PASA', 'es el fallo que se escapó en el prototipo');
    const teselasConTresColas = ConteoAnatomia.parse({ piezas: [{ nombre: 'gamba', esperado: 2, cabezas: 2, colas: 3, cuerpos: 2 }], seguro: true });
    const d = decidirSalida(checklist, otraToma, teselasConTresColas);
    assert.equal(d.final, 'DESCARTA');
    assert.ok(d.motivos.some((m) => /3 colas/.test(m)));
  });

  it('V3 (bien): PASA, y con la misma toma que la foto subida, DESCARTA', () => {
    const { checklist, toma } = respuesta('V3');
    assert.equal(decidirSalida(checklist, toma).final, 'PASA');
    const misma = { ...otraToma, mismoPuntoDeVista: true, explicacion: 'misma altura y mismo lado' };
    const d = decidirSalida(checklist, misma);
    assert.equal(d.toma, 'MISMA');
    assert.equal(d.final, 'DESCARTA');
  });

  it('si el revisor no está seguro, REVISAR (nunca PASA sin más)', () => {
    const { checklist } = respuesta('V3');
    assert.equal(decidirSalida({ ...checklist, seguro: false }, otraToma).final, 'REVISAR');
    const dudosa = ConteoAnatomia.parse({ piezas: [{ nombre: 'gamba', esperado: 2, cabezas: 2, colas: 2, cuerpos: 2 }], seguro: false });
    assert.equal(decidirSalida(checklist, otraToma, dudosa).final, 'REVISAR');
  });

  it('sin la pregunta de la toma, la toma queda SIN_COMPROBAR y no descarta', () => {
    assert.equal(decidirSalida(respuesta('V3').checklist).toma, 'SIN_COMPROBAR');
  });
});

describe('Comprobación de salida · caso de uso con un revisor falso', () => {
  let carpeta: string;
  let almacen: AlmacenActivosFicheros;
  const activo = (id: string, tipo: 'REAL' | 'GENERADO', extra: object = {}) => ({
    id,
    localSlug: 'prueba',
    tipo,
    uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: id,
    archivo: 'original.png',
    ancho: 40,
    alto: 30,
    sha256: 'a'.repeat(64),
    procedencia: { ruta: 'x', sha256: 'a'.repeat(64), copiadoEn: '2026-11-09' },
    ...extra,
  });

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-salida-'));
    for (const [id, tipo, extra] of [
      ['real', 'REAL', {}],
      ['nueva', 'GENERADO', { notaNiveles: 'campo que el esquema no conoce', fidelidad: { frente: 'real', veredicto: 'CONSERVA', metodo: 'a mano', revisadoEn: '2026-11-09' } }],
    ] as const) {
      const dir = join(carpeta, 'locales', 'prueba', 'activos', id);
      await mkdir(dir, { recursive: true });
      await sharp({ create: { width: 40, height: 30, channels: 3, background: '#a33' } }).png().toFile(join(dir, 'original.png'));
      await writeFile(join(dir, 'activo.json'), JSON.stringify(activo(id, tipo, extra)));
    }
    almacen = new AlmacenActivosFicheros(join(carpeta, 'locales'));
  });
  after(() => rm(carpeta, { recursive: true, force: true }));

  const revisorFalso = (contestaColas: number): RevisorVisual & { llamadas: string[] } => {
    const llamadas: string[] = [];
    return {
      nombre: 'falso',
      llamadas,
      async comprobarElementos(_f, lista) {
        llamadas.push(`elementos:${lista}`);
        return respuesta('V3D').checklist;
      },
      async compararToma() {
        llamadas.push('toma');
        return otraToma;
      },
      async contarAnatomia(_g, piezas) {
        llamadas.push(`anatomia:${piezas.map((p) => p.nombre).join(',')}`);
        return ConteoAnatomia.parse({ piezas: piezas.map((p) => ({ ...p, cabezas: p.esperado, colas: contestaColas, cuerpos: p.esperado })), seguro: true });
      },
    };
  };

  it('pregunta lo que toca, decide y guarda la revisión sin tocar el veredicto humano ni los campos desconocidos', async () => {
    const revisor = revisorFalso(3);
    const r = await comprobarFotoNueva(
      { activos: almacen, revisor, ahora: () => '2026-11-09T20:00:00Z' },
      { local: 'prueba', generado: 'nueva', real: 'real', lista: 'two prawns. Exactly two.', piezas: [{ nombre: 'gamba', esperado: 2 }] },
    );
    assert.deepEqual(revisor.llamadas, ['elementos:two prawns. Exactly two.', 'toma', 'anatomia:gamba']);
    assert.equal(r.final, 'DESCARTA');
    const guardado = JSON.parse(await readFile(join(carpeta, 'locales', 'prueba', 'activos', 'nueva', 'activo.json'), 'utf8'));
    assert.equal(guardado.revisionAutomatica.final, 'DESCARTA');
    assert.equal(guardado.fidelidad.veredicto, 'CONSERVA', 'el veredicto humano no cambia');
    assert.equal(guardado.notaNiveles, 'campo que el esquema no conoce', 'no se pierden campos');
  });

  it('sin piezas no hay pasada de anatomía; con --sin-guardar no escribe; y solo revisa fotos generadas', async () => {
    const revisor = revisorFalso(2);
    const r = await comprobarFotoNueva({ activos: almacen, revisor, ahora: () => 'x' }, { local: 'prueba', generado: 'nueva', real: 'real', lista: 'l', guardar: false });
    assert.equal(r.final, 'PASA');
    assert.ok(!revisor.llamadas.some((l) => l.startsWith('anatomia')));
    const guardado = JSON.parse(await readFile(join(carpeta, 'locales', 'prueba', 'activos', 'nueva', 'activo.json'), 'utf8'));
    assert.equal(guardado.revisionAutomatica.fecha, '2026-11-09T20:00:00Z', 'sigue la revisión anterior');
    await assert.rejects(comprobarFotoNueva({ activos: almacen, revisor, ahora: () => 'x' }, { local: 'prueba', generado: 'real', real: 'real', lista: 'l' }), /no es una foto generada/);
  });
});

describe('Comprobación de salida · teselas y lista', () => {
  it('cuatro recortes 2×2 que se solapan y cubren la foto entera', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'estudio-teselas-'));
    try {
      const ruta = join(dir, 'f.png');
      await sharp({ create: { width: 1000, height: 1200, channels: 3, background: '#fff' } }).png().toFile(ruta);
      const recortes = await teselas(ruta);
      assert.equal(recortes.length, 4);
      for (const r of recortes) {
        const m = await sharp(r).metadata();
        assert.equal(m.width, 575);
        assert.equal(m.height, 690);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('la lista y las piezas salen de la propuesta de foto nueva', async () => {
    const { lista, piezas } = await listaYPiezas({ propuesta: join(RAIZ, 'proyectos', 'posts-f1-6', 'foto', 'dak-3.final.json'), pieza: [] });
    assert.match(lista, /^a tall stacked burger .*\. Exactly one burger with three beef patties/);
    assert.ok(piezas.some((p) => p.nombre === 'carne de vacuno' && p.esperado === 3));
    const manual = await listaYPiezas({ lista: 'x', pieza: ['gamba=2'] });
    assert.deepEqual(manual.piezas, [{ nombre: 'gamba', esperado: 2 }]);
    await assert.rejects(listaYPiezas({ lista: 'x', pieza: ['gamba'] }), /nombre=N/);
  });
});
