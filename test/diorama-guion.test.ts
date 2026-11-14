/**
 * El guion del diorama (src/web/publico/js/diorama/guion.js): del estado REAL de /api/procesos a una línea de tiempo.
 * Comprueba que la escena cuenta lo que dicen los datos (paso, intentos, retornos, propuestas del director de diseño)
 * y nada más: sin encargos, reposo; al abrir, el material aparece donde está, sin repetir el pasado.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { RAIZ } from '../src/config.js';

// Es JavaScript del navegador (sin tipos): se importa con una ruta calculada.
const ruta = pathToFileURL(join(RAIZ, 'src', 'web', 'publico', 'js', 'diorama', 'guion.js')).href;
const G: any = await import(ruta);

type Paso = string;
const encargo = (paso: Paso, recorrido: Paso[], extra: Record<string, unknown> = {}) => ({
  proyecto: 'p1',
  paso,
  bloqueo: null,
  actualizadoEn: '2026-11-14T10:00:00Z',
  intentos: [],
  diseno: null,
  recorrido: recorrido.map((p) => ({ fecha: '2026-11-14T10:00:00Z', paso: p })),
  trabajo: { estado: 'TERMINADO', iniciadoEn: 1, avisos: [], error: null },
  ...extra,
});
const estado = (...encargos: unknown[]) => ({ modo: 'SIMULADO', ahora: 0, encargos });
const tipos = (g: any) => g.segmentos.map((s: any) => `${s.tipo}${s.puesto ? `@${s.puesto}` : ''}`);

describe('diorama · guion (del estado real a la escena)', () => {
  it('sin encargos: reposo, sin material', () => {
    const g = new G.Guion();
    assert.equal(g.actualizar(estado(), 0), false);
    const e = g.evaluar(5);
    assert.equal(e.seg.tipo, 'quieto');
    assert.equal(e.seg.mano, null);
    assert.equal(e.expuesto, null);
  });

  it('rellena los pasos intermedios y deja los retornos tal cual', () => {
    const pasos = G.pasosDelRecorrido(encargo('CONFIRMAR_FOTO', ['REFERENCIA', 'REFERENCIA', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'GENERAR', 'COMPROBAR']));
    assert.deepEqual(pasos, ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'GENERAR', 'COMPROBAR', 'CONFIRMAR_FOTO']);
  });

  it('el veredicto de cada comprobación y el rechazo de la persona salen de los intentos', () => {
    const e = encargo('CONFIRMAR_FOTO', ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'GENERAR', 'COMPROBAR', 'CONFIRMAR_FOTO', 'GENERAR', 'COMPROBAR'], {
      intentos: [{ n: 1, final: 'DESCARTA' }, { n: 2, final: 'RECHAZADA' }, { n: 3, final: 'PASA' }],
    });
    const v = G.visitasDe(e);
    const revisor = v.filter((x: any) => x.puesto === 'revisor').map((x: any) => x.sale);
    assert.deepEqual(revisor, ['fotoMal', 'fotoOk', 'fotoOk']);
    const paradas = v.filter((x: any) => x.puesto === 'parada2');
    assert.deepEqual(paradas.map((x: any) => x.rechazada), [true, false]);
    assert.equal(paradas[0].sale, 'fotoMal');
  });

  it('la propuesta devuelta UNA vez al director de diseño (2 propuestas) pasa por el compositor y vuelve', () => {
    const e = encargo('HECHO', ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'CONFIRMAR_FOTO', 'MASCARA', 'INTENCION', 'COMPONER'], {
      intentos: [{ n: 1, final: 'PASA' }],
      diseno: { propuestas: 2, pasa: true },
    });
    const puestos = G.visitasDe(e).map((x: any) => `${x.puesto}${x.prueba ? '(prueba)' : ''}`);
    assert.deepEqual(puestos.slice(-5), ['directorDiseno', 'compositor(prueba)', 'directorDiseno', 'compositor', 'salida']);
    const una = G.visitasDe({ ...e, diseno: { propuestas: 1, pasa: true } }).map((x: any) => x.puesto);
    assert.deepEqual(una.slice(-3), ['directorDiseno', 'compositor', 'salida']);
  });

  it('al abrir coloca el material donde está (parada 1, esperando a la persona) sin contar el pasado', () => {
    const g = new G.Guion();
    g.actualizar(estado(encargo('CONFIRMAR_ELEMENTOS', ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA'])), 10);
    assert.deepEqual(tipos(g), ['mostrar@parada1']);
    const e = g.evaluar(11);
    assert.equal(e.seg.espera, true);
    assert.equal(e.seg.mano, 'propuesta');
    assert.equal(e.seg.t1, Infinity);
  });

  it('cuenta lo nuevo en orden: confirmar → generar → comprobar → parada 2, con el material de mano en mano', () => {
    const g = new G.Guion();
    g.actualizar(estado(encargo('CONFIRMAR_ELEMENTOS', ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA'])), 10);
    const cambio = g.actualizar(estado(encargo('CONFIRMAR_FOTO', ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR'], { intentos: [{ n: 1, final: 'PASA' }] })), 20);
    assert.equal(cambio, true);
    assert.deepEqual(tipos(g), ['mostrar@parada1', 'andar', 'dejar@generador', 'procesar@generador', 'recoger@generador', 'andar', 'dejar@revisor', 'procesar@revisor', 'recoger@revisor', 'andar', 'mostrar@parada2']);
    // La parada 1 se cierra cuando llega el dato (t = 20), no antes; todo lo demás va detrás, sin solaparse.
    assert.equal(g.segmentos[0].t1, 20);
    for (let i = 1; i < g.segmentos.length; i++) assert.equal(g.segmentos[i].t0, g.segmentos[i - 1].t1);
    const recogidas = g.segmentos.filter((s: any) => s.tipo === 'recoger').map((s: any) => s.recoge);
    assert.deepEqual(recogidas, ['fotoNueva', 'fotoOk']);
    assert.equal(g.segmentos.find((s: any) => s.puesto === 'revisor' && s.tipo === 'procesar').sella, true);
    const ultimo = g.segmentos.at(-1);
    assert.equal(ultimo.mano, 'fotoOk');
    assert.equal(ultimo.espera, true);
    // Repetir la misma consulta no cambia nada.
    assert.equal(g.actualizar(estado(encargo('CONFIRMAR_FOTO', ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR'], { intentos: [{ n: 1, final: 'PASA' }] })), 30), false);
  });

  it('el rechazo en la parada 2 devuelve la foto con la cruz al generador', () => {
    const g = new G.Guion();
    const base = ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR'];
    g.actualizar(estado(encargo('CONFIRMAR_FOTO', base, { intentos: [{ n: 1, final: 'PASA' }] })), 0);
    g.actualizar(estado(encargo('CONFIRMAR_FOTO', [...base, 'CONFIRMAR_FOTO', 'GENERAR', 'COMPROBAR'], { intentos: [{ n: 1, final: 'RECHAZADA' }, { n: 2, final: 'PASA' }] })), 5);
    const parada = g.segmentos[0];
    assert.equal(parada.tipo, 'mostrar');
    assert.equal(parada.manoFin, 'fotoMal');
    assert.equal(parada.rechazada, true);
    const andar = g.segmentos[1];
    assert.equal(andar.tipo, 'andar');
    assert.equal(andar.mano, 'fotoMal');
    assert.equal(g.segmentos[2].puesto, 'generador');
  });

  it('trabajo en curso: el puesto trabaja sin fin hasta la siguiente consulta; un fallo real pone la nube', () => {
    const g = new G.Guion();
    const r = ['REFERENCIA', 'FOTO_REAL'];
    g.actualizar(estado(encargo('PROPUESTA', r, { trabajo: { estado: 'EN_CURSO', iniciadoEn: 5, avisos: [], error: null } })), 0);
    assert.deepEqual(tipos(g), ['procesar@directorFoto']);
    assert.equal(g.evaluar(500).seg.trabajando, true);
    // Gemini contesta 503 y la orden pasa al modelo de respaldo: sigue trabajando, con la nube del reintento.
    g.actualizar(estado(encargo('PROPUESTA', r, { trabajo: { estado: 'EN_CURSO', iniciadoEn: 5, avisos: ['gemini-x no responde ahora (Gemini HTTP 503: overloaded). Sigo con gemini-y.'], error: null } })), 40);
    assert.equal(g.evaluar(41).seg.aviso, '503');
    assert.equal(g.evaluar(41).seg.trabajando, true);
    // Y al final falla de verdad: se queda esperando a la persona, con el error.
    g.actualizar(estado(encargo('PROPUESTA', r, { trabajo: { estado: 'ERROR', iniciadoEn: 5, avisos: [], error: { code: 'PROVEEDOR_NO_DISPONIBLE', message: 'Gemini: no contesta a tiempo', retryable: true } } })), 90);
    const e = g.evaluar(91);
    assert.equal(e.seg.espera, true);
    assert.equal(e.seg.error, '…');
    assert.equal(e.seg.trabajando, false);
  });

  it('hecho: el corredor deja el post en el expositor y vuelve a descansar; el post se queda expuesto', () => {
    const g = new G.Guion();
    const r = ['REFERENCIA', 'FOTO_REAL', 'PROPUESTA', 'CONFIRMAR_ELEMENTOS', 'GENERAR', 'COMPROBAR', 'CONFIRMAR_FOTO', 'MASCARA', 'INTENCION'];
    g.actualizar(estado(encargo('COMPONER', r, { intentos: [{ n: 1, final: 'PASA' }], diseno: { propuestas: 1, pasa: true }, trabajo: { estado: 'EN_CURSO', iniciadoEn: 5, avisos: [], error: null } })), 0);
    g.actualizar(estado(encargo('HECHO', [...r, 'COMPONER'], { intentos: [{ n: 1, final: 'PASA' }], diseno: { propuestas: 1, pasa: true } })), 3);
    const ult = g.segmentos.at(-1);
    assert.equal(ult.tipo, 'quieto');
    assert.equal(ult.expuesto, 'post');
    assert.equal(g.evaluar(ult.t0 + 100).expuesto, 'post');
    assert.ok(tipos(g).includes('dejar@salida'));
    // Un encargo nuevo cambia el foco: se coloca sin contar el anterior.
    g.actualizar(estado({ ...encargo('REFERENCIA', [], { proyecto: 'p2', actualizadoEn: '2026-11-14T11:00:00Z' }) }, encargo('HECHO', [...r, 'COMPONER'])), 200);
    assert.equal(g.proyecto, 'p2');
    assert.deepEqual(tipos(g), ['espera@referencia']);
  });

  it('los avisos se leen del texto real: código HTTP, tiempo agotado o «!»', () => {
    assert.equal(G.rotuloDeAviso('Gemini HTTP 429: quota'), '429');
    assert.equal(G.rotuloDeAviso('Gemini: no contesta a tiempo'), '…');
    assert.equal(G.rotuloDeAviso('algo raro'), '!');
  });
});
