/**
 * Productor (fase 1) · El brief del encargo: su construcción, la confirmación del inventario y su almacén.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  type DatosParaElBrief,
  BriefDelEncargo,
  Inventario,
  actualizarInventarioPropuesto,
  cambiarBrief,
  confirmarInventario,
  contextoDelBrief,
  crearBrief,
  presupuestoAutorizado,
  resumenParaLaParada,
} from '../src/dominio/brief.js';
import { huellaDelInventario } from '../src/dominio/inventario.js';
import { ErrorDeUsuario } from '../src/dominio/errores.js';
import { AlmacenBriefFicheros } from '../src/adaptadores/ficheros/AlmacenBriefFicheros.js';

const NOTA = 'Tabla de sushi: nigiris de salmón, gunkan de toro y uramaki de atún';
const ELEMENTOS = [
  { nombre: 'nigiri de salmón', estado: 'salmón sobre arroz', recuento: 4 },
  { nombre: 'gunkan de toro', estado: 'tartar de toro sobre arroz y alga', recuento: 2 },
  { nombre: 'jengibre', estado: 'en láminas', recuento: null, dudoso: true },
];
const AHORA = '2026-11-16T10:00:00.000Z';
const DESPUES = '2026-11-16T11:00:00.000Z';
const USADAS = { fotos: 0, llamadasTexto: 0 };

function datos(extra: Partial<DatosParaElBrief> = {}): DatosParaElBrief {
  return {
    proyecto: 'sushita-tabla',
    local: 'sushita',
    nota: NOTA,
    formato: 'carrusel',
    usoFotoReal: 'SOLO_PRUEBA_COMPOSICION',
    marca: { nombre: 'Sushita', ciudad: 'Vigo', descripcion: 'Sushi', tonos: ['cercano'] },
    elementos: ELEMENTOS,
    tomas: [],
    ...extra,
  };
}

describe('crearBrief', () => {
  it('carrusel sin tomas: versión 1, CODIGO, inventario propuesto, origen por la nota y plan por defecto', () => {
    const b = crearBrief(datos(), AHORA);
    assert.equal(b.version, 1);
    assert.equal(b.modo, 'CODIGO');
    assert.equal(b.idea, null);
    assert.equal(b.hechos.inventario.estado, 'PROPUESTO');
    assert.deepEqual(b.hechos.inventario.elementos.map((e) => e.origen), ['NOTA', 'NOTA', 'FOTO']);
    assert.equal(b.hechos.datosPorConfirmar.length, 2);
    assert.deepEqual(b.plan.map((d) => d.papel), ['portada', 'detalle', 'detalle', 'detalle', 'cierre']);
    assert.deepEqual(b.plan.slice(1, 4).map((d) => d.foto), ['RECORTE', 'RECORTE', 'RECORTE']);
    assert.deepEqual({ ancho: b.lienzo.ancho, alto: b.lienzo.alto, exporta: b.lienzo.exporta }, { ancho: 1080, alto: 1440, exporta: ['3:4', '4:5'] });
  });

  it('un lienzo distinto no pasa el parse', () => {
    const b = crearBrief(datos(), AHORA);
    assert.throws(() => BriefDelEncargo.parse({ ...b, lienzo: { ...b.lienzo, alto: 1350 } }));
    assert.throws(() => BriefDelEncargo.parse({ ...b, lienzo: { ...b.lienzo, exporta: ['3:4'] } }));
  });

  it('una clave extra en la raíz o en hechos no pasa', () => {
    const b = crearBrief(datos(), AHORA);
    assert.throws(() => BriefDelEncargo.parse({ ...b, extra: 1 }));
    assert.throws(() => BriefDelEncargo.parse({ ...b, hechos: { ...b.hechos, extra: 1 } }));
  });

  it('reglas del plan: post de 1 diapositiva; post con 2 no pasa; carrusel cuya última no es cierre no pasa', () => {
    const post = crearBrief(datos({ formato: 'post' }), AHORA);
    assert.equal(post.plan.length, 1);
    assert.throws(() => BriefDelEncargo.parse({ ...post, plan: [...post.plan, { ...post.plan[0]!, n: 2 }] }));
    const carrusel = crearBrief(datos(), AHORA);
    const ultima = carrusel.plan[carrusel.plan.length - 1]!;
    assert.throws(() => BriefDelEncargo.parse({ ...carrusel, plan: [...carrusel.plan.slice(0, -1), { ...ultima, papel: 'detalle' }] }));
  });

  it('con tomas: detalle TOMA_NUEVA y FOTO_DEL_DUENO, y presupuesto 3 fotos y 15 llamadas', () => {
    const b = crearBrief(datos({ tomas: [{ elemento: 'gunkan de toro' }, { elemento: 'nigiri de salmón', real: true }] }), AHORA);
    assert.equal(b.plan[1]?.foto, 'TOMA_NUEVA');
    assert.equal(b.plan[1]?.elemento, 'gunkan de toro');
    assert.equal(b.plan[2]?.foto, 'FOTO_DEL_DUENO');
    assert.deepEqual(b.presupuesto, { fotos: 3, llamadasTexto: 15 });
  });
});

describe('confirmarInventario', () => {
  const b = crearBrief(datos(), AHORA);

  it('sin una vía válida lanza ErrorDeUsuario', () => {
    assert.throws(() => confirmarInventario(b, { elementos: ELEMENTOS, tomas: [] }, undefined, DESPUES, USADAS), (e: unknown) => e instanceof ErrorDeUsuario && /Solo el usuario confirma/.test(e.message));
    assert.throws(() => confirmarInventario(b, { elementos: ELEMENTOS, tomas: [] }, 'script', DESPUES, USADAS), (e: unknown) => e instanceof ErrorDeUsuario && /Solo el usuario confirma/.test(e.message));
  });

  it('con terminal: versión 2, CONFIRMADO, vía y huella de los elementos', () => {
    const c = confirmarInventario(b, { elementos: ELEMENTOS, tomas: [] }, 'terminal', DESPUES, USADAS);
    assert.equal(c.version, 2);
    assert.equal(c.hechos.inventario.estado, 'CONFIRMADO');
    assert.equal(c.hechos.inventario.confirmadoPor?.via, 'terminal');
    assert.equal(c.hechos.inventario.huella, huellaDelInventario(c.hechos.inventario.elementos));
  });
});

describe('cambiarBrief', () => {
  const propuesto = crearBrief(datos(), AHORA);
  const confirmado = confirmarInventario(propuesto, { elementos: ELEMENTOS, tomas: [] }, 'web', AHORA, USADAS);

  it('con inventario confirmado y otro inventario lanza', () => {
    const otro = crearBrief(datos({ elementos: [{ ...ELEMENTOS[0]!, recuento: 5 }, ELEMENTOS[1]!, ELEMENTOS[2]!] }), DESPUES);
    assert.throws(() => cambiarBrief(confirmado, { ...confirmado, hechos: { ...confirmado.hechos, inventario: otro.hechos.inventario } }, DESPUES), (e: unknown) => e instanceof ErrorDeUsuario && /solo cambia con otra confirmación suya/.test(e.message));
  });

  it('cambiar solo idea funciona y sube la versión', () => {
    const r = cambiarBrief(confirmado, { ...confirmado, idea: { concepto: 'La tabla entera', porQue: 'Se ve el conjunto' } }, DESPUES);
    assert.equal(r.version, 3);
    assert.equal(r.creadoEn, AHORA);
    assert.equal(r.idea?.concepto, 'La tabla entera');
  });

  it('cambiar hechos.nota lanza', () => {
    assert.throws(() => cambiarBrief(confirmado, { ...confirmado, hechos: { ...confirmado.hechos, nota: 'Otra nota del dueño' } }, DESPUES), ErrorDeUsuario);
  });
});

describe('actualizarInventarioPropuesto', () => {
  const b = crearBrief(datos(), AHORA);

  it('sin cambios devuelve el mismo objeto', () => {
    const r = actualizarInventarioPropuesto(b, { elementos: ELEMENTOS, tomas: [] }, DESPUES);
    assert.equal(r, b);
  });

  it('con otro recuento sube la versión', () => {
    const r = actualizarInventarioPropuesto(b, { elementos: [{ ...ELEMENTOS[0]!, recuento: 5 }, ELEMENTOS[1]!, ELEMENTOS[2]!], tomas: [] }, DESPUES);
    assert.equal(r.version, 2);
    assert.equal(r.hechos.inventario.elementos[0]?.recuento, 5);
  });

  it('sobre un inventario confirmado lanza', () => {
    const confirmado = confirmarInventario(b, { elementos: ELEMENTOS, tomas: [] }, 'web', AHORA, USADAS);
    assert.throws(() => actualizarInventarioPropuesto(confirmado, { elementos: ELEMENTOS, tomas: [] }, DESPUES), ErrorDeUsuario);
  });
});

describe('huella del inventario', () => {
  it('una huella mal no pasa el parse', () => {
    const b = crearBrief(datos(), AHORA);
    const inv = { ...b.hechos.inventario, huella: 'a'.repeat(64) };
    assert.equal(Inventario.safeParse(inv).success, false);
  });
});

describe('textos para los especialistas y la parada', () => {
  const propuesto = crearBrief(datos(), AHORA);

  it('contextoDelBrief trae la nota, el elemento y la regla de marca', () => {
    const texto = contextoDelBrief(propuesto);
    assert.match(texto, /Nota del dueño/);
    assert.match(texto, /gunkan de toro/);
    assert.match(texto, /sin precios/);
  });

  it('resumenParaLaParada distingue propuesto de confirmado', () => {
    assert.match(resumenParaLaParada(propuesto), /Inventario que congela tu --confirmo/);
    const confirmado = confirmarInventario(propuesto, { elementos: ELEMENTOS, tomas: [] }, 'terminal', DESPUES, USADAS);
    assert.match(resumenParaLaParada(confirmado), /Inventario confirmado por ti/);
  });

  it('presupuestoAutorizado usa la fórmula de la especificación', () => {
    assert.deepEqual(presupuestoAutorizado(0, USADAS), { fotos: 2, llamadasTexto: 12 });
  });
});

describe('AlmacenBriefFicheros', () => {
  let carpeta: string;
  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'brief-test-'));
  });
  after(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  it('leer sin brief devuelve undefined; guardar v1 y leer devuelve lo mismo', async () => {
    const almacen = new AlmacenBriefFicheros(carpeta);
    const proyecto = 'almacen-1';
    assert.equal(await almacen.leer(proyecto), undefined);
    const v1 = crearBrief(datos({ proyecto }), AHORA);
    await almacen.guardar(v1);
    assert.deepEqual(await almacen.leer(proyecto), v1);
  });

  it('guardar otra v1 lanza; guardar v2 crea brief.v002.json y brief.json es la v2; sin temporales', async () => {
    const almacen = new AlmacenBriefFicheros(carpeta);
    const proyecto = 'almacen-1';
    const v1 = crearBrief(datos({ proyecto }), AHORA);
    await assert.rejects(almacen.guardar(v1));
    const v2 = confirmarInventario(v1, { elementos: ELEMENTOS, tomas: [] }, 'web', DESPUES, USADAS);
    await almacen.guardar(v2);
    const ficheros = await readdir(join(carpeta, proyecto));
    assert.ok(ficheros.includes('brief.v002.json'));
    assert.equal((await almacen.leer(proyecto))?.version, 2);
    assert.equal(ficheros.some((f) => f.includes('.tmp-')), false);
  });

  it('anotar dos entradas y bitacora las devuelve en orden; una línea basura hace lanzar', async () => {
    const almacen = new AlmacenBriefFicheros(carpeta);
    const proyecto = 'almacen-bitacora';
    assert.deepEqual(await almacen.bitacora(proyecto), []);
    const e1 = { fecha: AHORA, quien: 'productor' as const, paso: 'PROPUESTA' as const, tipo: 'ENCARGO' as const, texto: 'primera' };
    const e2 = { fecha: DESPUES, quien: 'usuario' as const, paso: 'CONFIRMAR_ELEMENTOS' as const, tipo: 'CONFIRMACION' as const, texto: 'segunda' };
    await almacen.anotar(proyecto, e1);
    await almacen.anotar(proyecto, e2);
    assert.deepEqual(await almacen.bitacora(proyecto), [e1, e2]);

    const { appendFile } = await import('node:fs/promises');
    await appendFile(join(carpeta, proyecto, 'bitacora.jsonl'), 'esto no es json\n', 'utf8');
    await assert.rejects(almacen.bitacora(proyecto));
  });
});
