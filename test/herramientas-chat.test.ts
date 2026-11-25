/**
 * Las herramientas del chat (tarjetas de formulario → en curso → resultado), el creador de estilos de tipografía especial
 * (bucle con dobles) y el buscador de tipografía sobre la biblioteca real.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ServicioChat, type DepsChat } from '../src/aplicacion/chat/servicioChat.js';
import { CATALOGO } from '../src/aplicacion/chat/herramientas.js';
import { buscarTipografia } from '../src/aplicacion/tipografia/buscarTipografia.js';
import { cambiarEstadoDeTratamiento, crearTratamiento } from '../src/aplicacion/tipografia/crearTratamiento.js';
import { CatalogoTipografico } from '../src/adaptadores/compositor/tipografias.js';
import { BibliotecaTratamientosFicheros } from '../src/adaptadores/ficheros/BibliotecaTratamientosFicheros.js';
import { Tokens } from '../src/dominio/diseno/intencion.js';
import { Marca } from '../src/dominio/modelos.js';
import type { Conversacion } from '../src/dominio/chat.js';

const RAIZ = join(import.meta.dirname, '..');

async function esperar(chat: ServicioChat, id: string, cumple: (c: Conversacion) => boolean): Promise<Conversacion> {
  for (let i = 0; i < 200; i++) {
    const c = await chat.leer(id);
    if (cumple(c)) return c;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error('No se cumplió');
}

function servicio(ejecutar: NonNullable<DepsChat['herramientas']>['ejecutar']) {
  return mkdtemp(join(tmpdir(), 'herr-')).then(
    (carpeta) =>
      new ServicioChat({
        carpeta,
        usdPorFoto: 0.15,
        locales: async () => [],
        registrarFoto: async () => ({}) as never,
        prepararEncargo: async () => ({}) as never,
        generarFoto: async () => ({ bytes: Buffer.alloc(0), costeUsd: 0, modelo: 'x' }),
        componer: async (_e, r) => ({ problemas: [], reparada: false, receta: r }),
        herramientas: { catalogo: CATALOGO, ejecutar },
      }),
  );
}

describe('herramientas del chat', () => {
  it('abrir → formulario; lanzar → en curso → hecho, con lo que devuelve la herramienta y su progreso', async () => {
    let recibidos: Record<string, unknown> | undefined;
    const chat = await servicio(async (h, ctx, valores) => {
      recibidos = { h, ...valores };
      await ctx.progreso('midiendo');
      const archivo = await ctx.guardar('a b.png', Buffer.from('x'));
      return { texto: 'hecho', imagenes: [{ archivo, pie: 'p' }], lista: [], descargas: [] };
    });
    const c = await chat.crear();
    const b = await chat.abrirHerramienta(c.id, 'papel', { color: '#000000' });
    const abierta = (await chat.leer(c.id)).mensajes.at(-1)!.bloques[0]!;
    assert.equal(abierta.tipo, 'herramienta');
    assert.equal((abierta as { estado: string }).estado, 'FORMULARIO');
    await chat.ejecutarHerramienta(c.id, b, { local: 'l', color: '#111111' });
    const hecha = await esperar(chat, c.id, (x) => x.mensajes.some((m) => m.bloques.some((y) => y.id === b && y.tipo === 'herramienta' && y.estado === 'HECHO')));
    const t = hecha.mensajes.flatMap((m) => m.bloques).find((y) => y.id === b) as { progreso: string[]; resultado: { imagenes: Array<{ archivo: string }> } };
    assert.deepEqual(recibidos, { h: 'papel', local: 'l', color: '#111111' });
    assert.deepEqual(t.progreso, ['midiendo']);
    assert.match(t.resultado.imagenes[0]!.archivo, /^herramientas\/herr-[a-z0-9]+\/a-b\.png$/, 'el nombre se limpia y queda en su carpeta');
    await assert.rejects(chat.ejecutarHerramienta(c.id, b, {}), /ya se lanzó/);
  });

  it('un fallo queda en la tarjeta (ERROR con su motivo), sin romper la conversación', async () => {
    const chat = await servicio(async () => {
      throw new Error('la orden falló');
    });
    const c = await chat.crear();
    const b = await chat.abrirHerramienta(c.id, 'recorte');
    await chat.ejecutarHerramienta(c.id, b, { imagen: 'x' });
    const x = await esperar(chat, c.id, (y) => y.mensajes.some((m) => m.bloques.some((z) => z.id === b && z.tipo === 'herramienta' && z.estado === 'ERROR')));
    assert.match(JSON.stringify(x.mensajes), /la orden falló/);
  });

  it('las que usan los hechos del plato no se lanzan sin ellos; las que no piden nada se ejecutan al abrirlas; el encargo abre su tarjeta', async () => {
    let llamadas = 0;
    const chat = await servicio(async () => {
      llamadas++;
      return { texto: 'gasto', imagenes: [], lista: [], descargas: [] };
    });
    const c = await chat.crear();
    const b = await chat.abrirHerramienta(c.id, 'lote');
    await assert.rejects(chat.ejecutarHerramienta(c.id, b, {}), /confirma su ficha/);
    await chat.abrirHerramienta(c.id, 'gasto');
    await esperar(chat, c.id, () => llamadas === 1);
    const enc = await chat.abrirHerramienta(c.id, 'encargo');
    await chat.vincularEncargo(c.id, enc, '2026-11-23-croquetas');
    const x = await chat.leer(c.id);
    assert.deepEqual(x.mensajes.flatMap((m) => m.bloques).find((y) => y.id === enc), { tipo: 'encargo', id: enc, proyecto: '2026-11-23-croquetas' });
    await assert.rejects(chat.abrirHerramienta(c.id, 'no-existe'), /ninguna herramienta/);
  });

  it('el catálogo: ids únicos y cada campo con id', () => {
    assert.equal(new Set(CATALOGO.map((h) => h.id)).size, CATALOGO.length);
    for (const h of CATALOGO) assert.equal(new Set(h.campos.map((c) => c.id)).size, h.campos.length, h.id);
  });
});

describe('tipografía especial · creador (Fase C)', () => {
  const receta = JSON.parse(readFileSync(join(RAIZ, 'recursos', 'tratamientos', 'papel', 'receta.json'), 'utf8')) as Record<string, unknown>;
  const verificar = (pasa: boolean) => async (candidata: unknown) => ({
    informe: { pasa, validez: [], fallos: pasa ? [] : ['la marca no se lee'], resumen: { lecturas: { marca: '3/3', resto: '4/6' }, conservacion: { minima: 0.8, media: 0.9 }, relleno: { maximo: 0.1, medio: 0.05 }, msMaximo: 120, deterministas: true } } as never,
    receta: candidata as never,
    hoja: Buffer.from('png'),
  });

  it('corrige con las medidas y la crítica hasta que pasa; se guarda en PRUEBA (nunca APROBADO solo) y se aprueba aparte', async () => {
    const carpeta = await mkdtemp(join(tmpdir(), 'trat-'));
    const informes: unknown[] = [];
    let ronda = 0;
    const r = await crearTratamiento(
      {
        disenador: { escribir: async (_b, _c, informe) => (informes.push(informe), { ...receta, estado: 'APROBADO' }) },
        critico: { criticar: async () => (ronda++ === 0 ? { veredicto: 'NO_PASA', parece: 'pintura', correcciones: ['más grano'] } : { veredicto: 'PASA', parece: 'tiza', correcciones: [] }) },
        verificar: verificar(true),
        contexto: { manual: 'm', ejemplos: 'e' },
        carpeta,
        ahora: () => '2026-11-23T10:00:00Z',
      },
      { texto: 'tiza sobre pizarra', id: 'tiza-pizarra', palabra: 'Croquetas' },
      { palabra: 'Croquetas' },
    );
    assert.equal(r.guardado, true);
    assert.equal(r.rondas.length, 2, 'la primera ronda no pasó la crítica');
    assert.equal(informes[0], undefined);
    assert.match(JSON.stringify(informes[1]), /más grano/, 'la crítica vuelve al diseñador');
    const guardada = JSON.parse(await readFile(join(carpeta, 'tiza-pizarra', 'receta.json'), 'utf8')) as { id: string; estado: string; origen: { autor: string } };
    assert.deepEqual([guardada.id, guardada.estado, guardada.origen.autor], ['tiza-pizarra', 'PRUEBA', 'AGENTE'], 'el estudio sella id, estado y origen');
    assert.ok(existsSync(join(carpeta, 'tiza-pizarra', 'hoja.png')));
    const aprobada = await cambiarEstadoDeTratamiento(carpeta, 'tiza-pizarra', 'APROBADO', 'yo', '2026-11-23T11:00:00Z');
    assert.equal(aprobada.estado, 'APROBADO');
    assert.equal(aprobada.origen.aprobado?.por, 'yo');
  });

  it('si el diseñador falla en una ronda, se cierra con lo que había (sin lanzar el error)', async () => {
    const carpeta = await mkdtemp(join(tmpdir(), 'trat-'));
    let n = 0;
    const r = await crearTratamiento(
      { disenador: { escribir: async () => { if (++n === 2) throw new Error('no contesta a tiempo'); return receta; } }, verificar: verificar(false), contexto: { manual: 'm', ejemplos: 'e' }, carpeta, carpetaTrabajo: join(carpeta, 'trabajo'), ahora: () => 'x' },
      { texto: 'b', id: 'corta', palabra: 'P' },
      { palabra: 'P' },
    );
    assert.equal(r.guardado, false);
    assert.equal(r.rondas.length, 2);
    assert.match(r.rondas[1]!.problemas[0]!, /no contesta a tiempo/);
    assert.ok(r.hoja, 'queda la hoja de la primera ronda');
  });

  it('si no pasa en 4 rondas no se guarda nada', async () => {
    const carpeta = await mkdtemp(join(tmpdir(), 'trat-'));
    const r = await crearTratamiento(
      { disenador: { escribir: async () => receta }, verificar: verificar(false), contexto: { manual: 'm', ejemplos: 'e' }, carpeta, carpetaTrabajo: join(carpeta, 'trabajo'), ahora: () => 'x' },
      { texto: 'b', id: 'nunca', palabra: 'P' },
      { palabra: 'P' },
    );
    assert.equal(r.guardado, false);
    assert.equal(r.rondas.length, 4);
    assert.ok(!existsSync(join(carpeta, 'nunca', 'receta.json')));
  });
});

describe('tipografía especial · buscador (Fase B)', () => {
  it('para Etxebarri (asador sobrio) ordena la biblioteca con razones y descarta la derretida', async () => {
    const marca = Marca.parse(JSON.parse(await readFile(join(RAIZ, 'datos', 'locales', 'asador-etxebarri', 'marca.json'), 'utf8').catch(() => '{"slug":"asador-etxebarri","nombre":"Asador Etxebarri","ciudad":"Axpe","descripcion":"Asador de brasa con leña. Producto y fuego, sin artificios.","tonos":["sobrio","artesano","fuego"]}')));
    const tokens = Tokens.parse(JSON.parse(await readFile(join(RAIZ, 'marcas', 'asador-etxebarri', 'tokens.json'), 'utf8')));
    const lista = buscarTipografia({ marca, tokens, catalogo: new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias')), recetas: new BibliotecaTratamientosFicheros(join(RAIZ, 'recursos', 'tratamientos')).listar(), plato: { texto: 'Croquetas de jamón' } });
    assert.ok(lista.length >= 4);
    assert.ok(lista.every((c) => c.razones.length > 0), 'cada uno con sus razones');
    const derretida = lista.find((c) => c.id === 'derretida');
    assert.equal(derretida?.apto, false, 'un asador sobrio no lleva letra derretida');
    assert.ok(lista[0]!.apto);
  });
});
