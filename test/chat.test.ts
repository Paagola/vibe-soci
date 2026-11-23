/**
 * El chat del estudio, de punta a punta con dobles (sin Gemini): foto → tarjeta de hechos → confirmación → plan con
 * su coste → aprobación → tomas nuevas y diseño de cada diapositiva → carrusel entregado. Y las reglas del plan.
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { ServicioChat, type DepsChat } from '../src/aplicacion/chat/servicioChat.js';
import { Receta } from '../src/dominio/arte/receta.js';
import { costeEstimado, problemasDePieza, type Conversacion, type PlanDePieza } from '../src/dominio/chat.js';
import type { Marca } from '../src/dominio/modelos.js';
import type { Tokens } from '../src/dominio/diseno/intencion.js';

const receta = (esqueleto: string) =>
  Receta.parse({
    nombre: `Dirección ${esqueleto}`,
    idea: 'Una receta de prueba para el chat',
    lecturas: ['el plato', 'el titular', 'la firma'],
    esqueleto,
    fondo: '@negro',
    textos: [{ clave: 'titular', texto: 'CROQUETAS', fuente: 'PLATO', cita: 'Croquetas de jamón' }],
    producto: { escala: 'grande' },
    titular: { texto: 'titular', voz: 'titular', escala: 'monumental', relacion: 'detras' },
    operaciones: [],
  });

const toma = (prompt: string) => ({ foto: 'generada' as const, generar: { tipo: 'plato' as const, prompt: `${prompt} — a new photograph of the real dish with a different point of view and light, shot for an editorial feed.`, conPlato: true } });

const plan = (n: number): PlanDePieza => ({
  idea: 'Las croquetas desde cuatro miradas distintas',
  diapositivas: [
    { papel: 'portada', resumen: 'La foto real con el titular detrás del plato', visual: { foto: 'real', receta: receta('FOTO_A_SANGRE') } },
    { papel: 'detalle', resumen: 'Un macro del corte, a ras de mesa', visual: { ...toma('Macro of the cut'), receta: receta('PARTIDA') } },
    { papel: 'ambiente', resumen: 'El plato en la barra con gente', visual: { ...toma('At the bar with people'), receta: receta('MARCO') } },
    { papel: 'cierre', resumen: 'Cenital tranquilo con la firma', visual: { ...toma('Overhead calm'), receta: receta('EDITORIAL') } },
  ].slice(0, n) as PlanDePieza['diapositivas'],
});

async function montar(o: { conDirector?: boolean; buscarReferencias?: DepsChat['buscarReferencias'] } = {}) {
  const carpeta = await mkdtemp(join(tmpdir(), 'chat-'));
  const png = join(carpeta, 'pintada.png');
  await sharp({ create: { width: 108, height: 144, channels: 3, background: '#553311' } }).png().toFile(png);
  const llamadas = { turnos: 0, planes: 0, fotos: 0, composiciones: 0, registros: [] as string[] };
  const deps: DepsChat = {
    carpeta,
    usdPorFoto: 0.15,
    ...(o.buscarReferencias ? { buscarReferencias: o.buscarReferencias } : {}),
    locales: async () => [{ slug: 'asador-etxebarri', marca: { slug: 'asador-etxebarri', nombre: 'Asador Etxebarri', ciudad: 'Axpe', descripcion: 'Asador', tonos: ['sobrio'] } as unknown as Marca, tokens: {} as Tokens }],
    ...(o.conDirector === false
      ? {}
      : {
          director: {
            turnoDelChat: async (contexto: string) => {
              llamadas.turnos++;
              const imagen = /«(img-[a-z0-9]+)»/.exec(contexto)?.[1] ?? 'x';
              if (!/HECHOS CONFIRMADOS: local/.test(contexto)) return { mensaje: 'Veo unas croquetas. ¿Es esto?', accion: { tipo: 'PROPONER_HECHOS' as const, hechos: { local: 'asador-etxebarri', plato: 'Croquetas de jamón', elementos: [{ nombre: 'croqueta', estado: 'rebozada', recuento: 4 }], mensaje: 'Para picar con vino', foto: imagen } } };
              return { mensaje: 'Te propongo un carrusel de 4.', accion: { tipo: 'PROPONER_PIEZA' as const, formato: 'carrusel' as const, diapositivas: 4, indicaciones: 'Oscuro y con vino', busqueda: [] } };
            },
            planificarPieza: async () => {
              llamadas.planes++;
              return plan(4);
            },
          },
        }),
    registrarFoto: async (x) => {
      llamadas.registros.push(`${x.tipo}:${x.id}`);
      return { ruta: x.ruta, activo: { id: x.id, sha256: 'a'.repeat(64) } } as never;
    },
    prepararEncargo: async () => ({}) as never,
    generarFoto: async () => {
      llamadas.fotos++;
      return { bytes: await sharp(png).toBuffer(), costeUsd: 0.14, modelo: 'doble' };
    },
    componer: async (_e, r) => {
      llamadas.composiciones++;
      return { png, problemas: [], reparada: false, receta: r };
    },
  };
  return { chat: new ServicioChat(deps), llamadas, carpeta };
}

/** Espera a que la conversación cumpla algo (los turnos del director van en segundo plano). */
async function esperar(chat: ServicioChat, id: string, cumple: (c: Conversacion) => boolean): Promise<Conversacion> {
  for (let i = 0; i < 200; i++) {
    const c = await chat.leer(id);
    if (cumple(c)) return c;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`No se cumplió: ${JSON.stringify((await chat.leer(id)).mensajes.map((m) => [m.texto, m.bloques]))}`);
}

describe('chat del estudio', () => {
  it('foto → hechos → plan → aprobación → carrusel; nada se genera antes de aprobar', async () => {
    const { chat, llamadas } = await montar();
    const c = await chat.crear();
    const jpg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#996633' } }).jpeg().toBuffer();
    await chat.enviar(c.id, { texto: 'Hazme un carrusel de estas croquetas', imagenes: [{ nombre: 'croquetas.jpg', bytes: jpg }] });

    const conHechos = await esperar(chat, c.id, (x) => x.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'hechos')));
    const tarjeta = conHechos.mensajes.flatMap((m) => m.bloques).find((b) => b.tipo === 'hechos')!;
    assert.equal(llamadas.fotos, 0);
    assert.equal(conHechos.titulo, 'Hazme un carrusel de estas croquetas');

    await chat.responderHechos(c.id, tarjeta.id, { confirmar: true, hechos: { ...(tarjeta as { propuesta: object }).propuesta, plato: 'Croquetas de jamón ibérico' } });
    const conPlan = await esperar(chat, c.id, (x) => x.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'plan')));
    assert.equal(conPlan.hechos?.plato, 'Croquetas de jamón ibérico', 'manda la corrección del cliente');
    assert.ok(llamadas.registros.some((r) => r.startsWith('REAL:')), 'la foto real se registra al confirmar');
    const pieza = conPlan.piezas[0]!;
    assert.equal(pieza.plan?.diapositivas.length, 4);
    assert.equal(pieza.costeEstimadoUsd, costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'normal' }));
    assert.equal(llamadas.fotos, 0, 'el plan no gasta en imágenes');

    const bloquePlan = conPlan.mensajes.flatMap((m) => m.bloques).find((b) => b.tipo === 'plan')!;
    await chat.responderPlan(c.id, bloquePlan.id, true);
    const lista = await esperar(chat, c.id, (x) => x.piezas[0]?.estado === 'LISTA');
    assert.equal(llamadas.fotos, 3, 'una toma nueva por diapositiva generada');
    assert.equal(llamadas.composiciones, 4);
    assert.equal(lista.piezas[0]!.diapositivas.filter((d) => d.png).length, 4);
    assert.equal(lista.piezas[0]!.costeRealUsd, 0.42);
    assert.ok(lista.mensajes.at(-1)!.bloques.some((b) => b.tipo === 'pieza'));
    await assert.rejects(chat.responderPlan(c.id, bloquePlan.id, true), /ya está respondido/);
  });

  it('sin director (sin clave) la conversación lo dice en un mensaje de error, sin romperse', async () => {
    const { chat } = await montar({ conDirector: false });
    const c = await chat.crear();
    await chat.enviar(c.id, { texto: 'hola', imagenes: [] });
    const x = await esperar(chat, c.id, (y) => y.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'error')));
    assert.match(JSON.stringify(x.mensajes.at(-1)), /GEMINI_API_KEY/);
    assert.equal(x.pensando, false);
  });

  it('no deja salir de la carpeta de la conversación', async () => {
    const { chat } = await montar();
    const c = await chat.crear();
    assert.throws(() => chat.rutaArchivo(c.id, '../otra/conversacion.json'));
    assert.throws(() => chat.rutaArchivo('../x', 'a.png'));
  });
});

describe('chat del estudio · estética de referencia', () => {
  const hastaReferencias = async (buscar: DepsChat['buscarReferencias']) => {
    const m = await montar({ buscarReferencias: buscar });
    const c = await m.chat.crear();
    const jpg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#996633' } }).jpeg().toBuffer();
    await m.chat.enviar(c.id, { texto: 'Un carrusel de croquetas', imagenes: [{ nombre: 'croquetas.jpg', bytes: jpg }] });
    const conHechos = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'hechos')));
    const tarjeta = conHechos.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'hechos')!;
    await m.chat.responderHechos(c.id, tarjeta.id, { confirmar: true });
    return { ...m, id: c.id };
  };
  const candidatas: NonNullable<DepsChat['buscarReferencias']> = async (o, progreso) => {
    progreso('Pinterest: «croquetas»…');
    await sharp({ create: { width: 40, height: 50, channels: 3, background: '#224466' } }).jpeg().toFile(join(o.destino, 'pinterest-01.jpg'));
    await sharp({ create: { width: 40, height: 50, channels: 3, background: '#664422' } }).jpeg().toFile(join(o.destino, 'local-02.jpg'));
    return {
      consultas: o.consultas.length ? o.consultas : ['croquetas post'],
      candidatas: [
        { id: 'pinterest-1', origen: 'pinterest', archivo: `${o.prefijo}/pinterest-01.jpg`, titulo: 'Pin', motivo: 'Titular gigante detrás', enlace: 'https://www.pinterest.com/pin/1/' },
        { id: 'local-2', origen: 'local', archivo: `${o.prefijo}/local-02.jpg`, titulo: 'Post anterior' },
      ],
    };
  };

  it('antes del plan se eligen referencias; la elegida pasa a ser la referencia de la conversación', async () => {
    let pedido: Parameters<NonNullable<DepsChat['buscarReferencias']>>[0] | undefined;
    const { chat, llamadas, id } = await hastaReferencias(async (o, p) => ((pedido = o), candidatas(o, p)));
    const conRefs = await esperar(chat, id, (x) => x.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'referencias' && b.estado === 'PENDIENTE')));
    assert.equal(llamadas.planes, 0, 'no se planifica hasta elegir');
    assert.equal(pedido?.plato, 'Croquetas de jamón');
    assert.equal(pedido?.formato, 'carrusel');
    const bloque = conRefs.mensajes.flatMap((m) => m.bloques).find((b) => b.tipo === 'referencias')!;
    await assert.rejects(chat.elegirEstetica(id, bloque.id, 'otra'), /no está entre las candidatas/);
    await chat.elegirEstetica(id, bloque.id, 'local-2');
    const conPlan = await esperar(chat, id, (x) => x.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'plan')));
    assert.equal(llamadas.planes, 1);
    assert.ok(conPlan.referencia, 'la conversación tiene referencia');
    assert.equal(conPlan.hechos?.referencia, conPlan.referencia);
    assert.ok(conPlan.imagenes.some((i) => i.id === conPlan.referencia && i.nombre.startsWith('referencia-local')));
    const hecho = conPlan.mensajes.flatMap((m) => m.bloques).find((b) => b.id === bloque.id);
    assert.equal(hecho?.tipo === 'referencias' && hecho.elegida, 'local-2');
    await assert.rejects(chat.elegirEstetica(id, bloque.id, 'auto'), /ya está hecha/);
  });

  it('«ninguna» planifica sin referencia; un fallo de la búsqueda no bloquea la pieza', async () => {
    const a = await hastaReferencias(candidatas);
    const c1 = await esperar(a.chat, a.id, (x) => x.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'referencias' && b.estado === 'PENDIENTE')));
    await a.chat.elegirEstetica(a.id, c1.mensajes.flatMap((m) => m.bloques).find((b) => b.tipo === 'referencias')!.id, 'ninguna');
    const p1 = await esperar(a.chat, a.id, (x) => x.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'plan')));
    assert.equal(p1.referencia, undefined);

    const b = await hastaReferencias(async () => {
      throw new Error('Pinterest caído');
    });
    const p2 = await esperar(b.chat, b.id, (x) => x.mensajes.some((m) => m.bloques.some((bb) => bb.tipo === 'plan')));
    assert.ok(p2.mensajes.some((m) => m.bloques.some((bb) => bb.tipo === 'referencias' && bb.estado === 'ERROR')));
  });
});

describe('plan de una pieza', () => {
  it('un carrusel no repite la foto real ni el esqueleto en dos seguidas', () => {
    const malo = plan(4);
    malo.diapositivas[1] = { ...malo.diapositivas[1]!, visual: { foto: 'real', receta: receta('FOTO_A_SANGRE') } };
    const p = problemasDePieza(malo, 'carrusel', 4);
    assert.ok(p.some((x) => /foto real sale en 2/.test(x)));
    assert.ok(p.some((x) => /repiten el esqueleto/.test(x)));
    assert.deepEqual(problemasDePieza(plan(4), 'carrusel', 4), []);
    assert.ok(problemasDePieza(plan(3), 'carrusel', 4).some((x) => /Hacen falta 4/.test(x)));
  });

  it('el coste cuenta las fotos nuevas y las reparaciones (y en un ajuste, solo lo que se rehace)', () => {
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'rapido' }), 0.45);
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'normal' }), 0.65);
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'normal', soloDiapositivas: [2] }), 0.2);
  });
});

void writeFile;

describe('chat del estudio · plan con JSON roto', () => {
  it('repite el plan hasta tres veces si la respuesta llega con formato roto, y luego lo dice', async () => {
    const carpeta = await mkdtemp(join(tmpdir(), 'chat-json-'));
    let planes = 0;
    const chat = new ServicioChat({
      carpeta,
      usdPorFoto: 0.15,
      locales: async () => [{ slug: 'l', marca: { nombre: 'L', ciudad: 'C', descripcion: 'D', tonos: [] } as unknown as Marca, tokens: {} as Tokens }],
      director: {
        turnoDelChat: async (ctx) =>
          /HECHOS CONFIRMADOS: local/.test(ctx)
            ? { mensaje: 'Va', accion: { tipo: 'PROPONER_PIEZA' as const, formato: 'carrusel' as const, diapositivas: 4, indicaciones: 'x', busqueda: [] } }
            : { mensaje: 'Ficha', accion: { tipo: 'PROPONER_HECHOS' as const, hechos: { local: 'l', plato: 'Croquetas de jamón', elementos: [{ nombre: 'croqueta', estado: 'frita', recuento: 4 }], mensaje: 'Para picar', foto: /«(img-[a-z0-9]+)»/.exec(ctx)?.[1] ?? 'x' } } },
        planificarPieza: async () => {
          planes++;
          if (planes < 3) throw new Error('Gemini: la respuesta no tiene el formato pedido (no es JSON válido)');
          return plan(4);
        },
      },
      registrarFoto: async (x) => ({ ruta: x.ruta, activo: { id: x.id, sha256: 'a'.repeat(64) } }) as never,
      prepararEncargo: async () => ({}) as never,
      generarFoto: async () => ({ bytes: Buffer.alloc(0), costeUsd: 0, modelo: 'x' }),
      componer: async (_e, r) => ({ problemas: [], reparada: false, receta: r }),
    });
    const c = await chat.crear();
    await chat.enviar(c.id, { texto: 'croquetas', imagenes: [{ nombre: 'a.jpg', bytes: await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).jpeg().toBuffer() }] });
    const t = (await esperar(chat, c.id, (x) => x.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'hechos')))).mensajes.flatMap((m) => m.bloques).find((b) => b.tipo === 'hechos')!;
    await chat.responderHechos(c.id, t.id, { confirmar: true });
    const x = await esperar(chat, c.id, (y) => y.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'plan')));
    assert.equal(planes, 3, 'dos respuestas rotas y la tercera vale');
    assert.equal(x.piezas[0]!.plan?.diapositivas.length, 4);
  });
});
