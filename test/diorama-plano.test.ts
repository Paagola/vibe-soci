/**
 * Pruebas espaciales del plano del loft (src/web/publico/js/diorama/plano.js), la única fuente de verdad de la
 * distribución: todo dentro de la losa y de las paredes, nada solapado, las calles con su anchura libre, cada entrega
 * fuera de los muebles y alcanzable a pie, y las copas de los árboles con su sitio.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { RAIZ } from '../src/config.js';

const P: any = await import(pathToFileURL(join(RAIZ, 'src', 'web', 'publico', 'js', 'diorama', 'plano.js')).href);

type Rect = { x0: number; z0: number; x1: number; z1: number };
type Punto = { x: number; z: number };
const dentroDe = (r: Rect, p: Punto, margen = 0) => p.x > r.x0 - margen && p.x < r.x1 + margen && p.z > r.z0 - margen && p.z < r.z1 + margen;
const distRect = (r: Rect, p: Punto) => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.z0 - p.z, 0, p.z - r.z1));
const solapan = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
/** Distancia mínima de un tramo a un rectángulo (muestreado cada 2 cm: exacto de sobra para muebles de decímetros). */
function distTramo(a: Punto, b: Punto, r: Rect) {
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.02));
  let d = Infinity;
  for (let i = 0; i <= n; i++) d = Math.min(d, distRect(r, { x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n }));
  return d;
}
const circulo = (c: { x: number; z: number; copa?: number }, r = c.copa ?? 0.22): Rect => ({ x0: c.x - r, z0: c.z - r, x1: c.x + r, z1: c.z + r });

const interior: Rect = { x0: P.LOSA.x0 + P.PARED.grueso, z0: P.LOSA.z0 + P.PARED.grueso, x1: P.LOSA.x1, z1: P.LOSA.z1 };
const estaciones = Object.entries(P.PUESTOS).flatMap(([id, p]: [string, any]) => p.ocupa.map((r: Rect) => ({ id, r })));
const zonas = Object.entries(P.ZONAS).flatMap(([id, z]: [string, any]) => z.ocupa.map((r: Rect) => ({ id, r })));
const pilares = P.PILARES.map((p: Punto, i: number) => ({ id: `pilar${i}`, r: circulo(p, 0.22) }));
const jardineras = P.JARDINERAS.map((j: any, i: number) => ({ id: `jardinera${i}`, r: { x0: j.x - j.ancho / 2, z0: j.z - j.fondo / 2, x1: j.x + j.ancho / 2, z1: j.z + j.fondo / 2 } }));
const arboles = P.VEGETACION.map((v: any) => ({ id: v.especie, r: circulo(v), centro: v }));
const tramos = P.CALLES.tramos.map(([a, b]: [string, string]) => ({ id: `${a}-${b}`, a: P.CALLES.nodos[a], b: P.CALLES.nodos[b] }));

describe('diorama · plano del loft (pruebas espaciales)', () => {
  it('todo está dentro de la losa y de las paredes', () => {
    for (const { id, r } of [...estaciones, ...zonas, ...pilares, ...jardineras]) {
      assert.ok(r.x0 >= interior.x0 - 1e-9 && r.x1 <= interior.x1 + 1e-9 && r.z0 >= interior.z0 - 1e-9 && r.z1 <= interior.z1 + 1e-9, `${id} se sale: ${JSON.stringify(r)}`);
    }
    for (const a of arboles) assert.ok(dentroDe(interior, a.centro), `el ${a.id} tiene la jardinera fuera`);
  });

  it('ninguna estación, zona ni pilar se solapa con otra', () => {
    const todo = [...estaciones, ...zonas, ...pilares, ...jardineras];
    for (let i = 0; i < todo.length; i++) {
      for (let j = i + 1; j < todo.length; j++) {
        if (todo[i]!.id === todo[j]!.id) continue;
        assert.ok(!solapan(todo[i]!.r, todo[j]!.r), `${todo[i]!.id} pisa ${todo[j]!.id}`);
      }
    }
  });

  it('las copas de los árboles no invaden estaciones, pilares ni calles', () => {
    for (const a of arboles) {
      for (const { id, r } of [...estaciones, ...pilares]) assert.ok(!solapan(a.r, r), `la copa del ${a.id} invade ${id}`);
      for (const t of tramos) assert.ok(distTramo(t.a, t.b, a.r) >= P.ANCHO_CALLE / 2 - 1e-9, `la copa del ${a.id} invade la calle ${t.id}`);
    }
  });

  it('las calles tienen su anchura libre: no las cruza ningún mueble, zona ni pilar', () => {
    for (const t of tramos) {
      for (const { id, r } of [...estaciones, ...zonas, ...pilares, ...jardineras]) {
        const d = distTramo(t.a, t.b, r);
        assert.ok(d >= P.ANCHO_CALLE / 2 - 1e-9, `la calle ${t.id} pasa a ${d.toFixed(2)} m de ${id}`);
      }
    }
  });

  it('cada entrega queda fuera de los muebles y se llega a ella a pie desde el reposo, sin atravesar nada', () => {
    for (const [id, p] of Object.entries(P.PUESTOS) as Array<[string, any]>) {
      for (const { id: otro, r } of [...estaciones, ...zonas, ...pilares, ...jardineras]) assert.ok(distRect(r, p.entrega) >= 0.25, `la entrega de ${id} está pegada a ${otro}`);
      const { puntos, largo } = P.ruta(P.REPOSO, p.entrega);
      assert.ok(Number.isFinite(largo) && largo > 0, `${id} no se alcanza`);
      // El tramo final (calle → entrega) es el único que no es calle: se le pide el ancho de una persona.
      const [a, b] = puntos.slice(-2);
      for (const { id: otro, r } of [...estaciones, ...zonas, ...pilares, ...jardineras]) {
        assert.ok(distTramo(a, b, r) >= 0.25 - 1e-9 || (otro === id && distRect(r, b) >= 0.25), `el acceso a ${id} roza ${otro}`);
      }
    }
  });

  it('los profesionales trabajan dentro de su estación y el recorrido del material es un circuito', () => {
    for (const [id, p] of Object.entries(P.PUESTOS) as Array<[string, any]>) {
      if (!p.operario) continue;
      // Trabaja en su estación (dentro o pegado a su mesa, como el director de diseño, que trabaja desde el pasillo) …
      assert.ok(p.ocupa.some((r: Rect) => distRect(r, p.operario) <= 0.7), `el operario de ${id} está lejos de su estación`);
      // … y nunca dentro de otra estación, zona ni calle.
      for (const { id: otro, r } of [...estaciones, ...zonas, ...pilares, ...jardineras]) if (otro !== id) assert.ok(distRect(r, p.operario) >= 0.25, `el operario de ${id} pisa ${otro}`);
    }
    // De cada paso al siguiente hay ruta; el total del circuito es finito y razonable para una oficina de 19 × 13 m.
    let total = 0;
    for (let i = 1; i < P.ORDEN.length; i++) {
      const a = P.PUESTOS[P.PUESTO_DE_PASO[P.ORDEN[i - 1]]].entrega;
      const b = P.PUESTOS[P.PUESTO_DE_PASO[P.ORDEN[i]]].entrega;
      total += P.ruta(a, b).largo;
    }
    assert.ok(total > 20 && total < 80, `circuito de ${total.toFixed(1)} m`);
  });

  it('enRuta recorre la polilínea con su rumbo', () => {
    const r = P.ruta(P.PUESTOS.directorFoto.entrega, P.PUESTOS.generador.entrega);
    const inicio = P.enRuta(r.puntos, 0);
    const fin = P.enRuta(r.puntos, r.largo);
    assert.ok(Math.hypot(inicio.x - P.PUESTOS.directorFoto.entrega.x, inicio.z - P.PUESTOS.directorFoto.entrega.z) < 1e-9);
    assert.ok(Math.hypot(fin.x - P.PUESTOS.generador.entrega.x, fin.z - P.PUESTOS.generador.entrega.z) < 1e-9);
  });
});
