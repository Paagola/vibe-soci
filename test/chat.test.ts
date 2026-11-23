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
import { degrada } from '../src/aplicacion/arte/pieza.js';
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
    textos: [{ clave: 'titular', texto: 'Una más', fuente: 'CREATIVO', cita: '' }],
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

async function montar(o: { conDirector?: boolean; buscarReferencias?: DepsChat['buscarReferencias']; extra?: Partial<DepsChat>; plan?: () => PlanDePieza } = {}) {
  const carpeta = await mkdtemp(join(tmpdir(), 'chat-'));
  const png = join(carpeta, 'pintada.png');
  await sharp({ create: { width: 108, height: 144, channels: 3, background: '#553311' } }).png().toFile(png);
  const llamadas = { turnos: 0, planes: 0, fotos: 0, composiciones: 0, registros: [] as string[], generadas: [] as Array<Parameters<DepsChat['generarFoto']>[0]>, compuestas: [] as Array<{ id: string; enriquecer: unknown; esqueleto: string }>, encargos: [] as Array<{ referencia?: unknown }> };
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
              return o.plan ? o.plan() : plan(4);
            },
          },
        }),
    registrarFoto: async (x) => {
      llamadas.registros.push(`${x.tipo}:${x.id}`);
      return { ruta: x.ruta, activo: { id: x.id, sha256: 'a'.repeat(64) } } as never;
    },
    prepararEncargo: async (entrada) => {
      llamadas.encargos.push({ ...(entrada.referencia ? { referencia: entrada.referencia } : {}) });
      return {} as never;
    },
    generarFoto: async (x) => {
      llamadas.fotos++;
      llamadas.generadas.push(x);
      return { bytes: await sharp(png).toBuffer(), costeUsd: 0.14, modelo: 'doble' };
    },
    componer: async (e, r) => {
      llamadas.composiciones++;
      llamadas.compuestas.push({ id: e.foto.activo.id, enriquecer: e.enriquecer, esqueleto: r.esqueleto });
      return { png, problemas: [], reparada: false, receta: r };
    },
    ...o.extra,
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

describe('chat del estudio · producción con criterio (sesión, revisión, foto sola, acabado)', () => {
  /** De la foto al plan aprobado y la pieza lista. */
  const producir = async (m: Awaited<ReturnType<typeof montar>>) => {
    const c = await m.chat.crear();
    const jpg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#996633' } }).jpeg().toBuffer();
    await m.chat.enviar(c.id, { texto: 'Un carrusel de croquetas', imagenes: [{ nombre: 'croquetas.jpg', bytes: jpg }] });
    const conHechos = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'hechos')));
    await m.chat.responderHechos(c.id, conHechos.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'hechos')!.id, { confirmar: true });
    const conPlan = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'plan')));
    await m.chat.responderPlan(c.id, conPlan.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'plan')!.id, true);
    return esperar(m.chat, c.id, (x) => x.piezas[0]?.estado === 'LISTA' || x.piezas[0]?.estado === 'ERROR');
  };

  it('la primera toma va sola y es la continuidad de las demás; el director repite la que no vale y deja sin texto la que se sostiene sola', async () => {
    const revisiones: string[] = [];
    const m = await montar({
      extra: {
        revisarFoto: async (o) => {
          revisiones.push(o.toma.slice(0, 20));
          if (/macro/i.test(o.toma) && !o.foto.endsWith('-2.png')) return { veredicto: 'REPETIR', motivo: 'Sale una botella que no se pidió', corregir: 'Remove the bottle.', sinTexto: false };
          if (/barra/i.test(o.toma)) return { veredicto: 'USAR', motivo: 'El gesto lo cuenta todo', sinTexto: true };
          return { veredicto: 'USAR', motivo: 'Bien', sinTexto: false };
        },
      },
    });
    const lista = await producir(m);
    const p = lista.piezas[0]!;
    assert.equal(p.estado, 'LISTA');
    const g = m.llamadas.generadas;
    // La diapositiva 1 es la foto real; la 2 es la primera toma: va sola, solo con el plato real.
    assert.match(g[0]!.id, /-2$/);
    assert.equal(g[0]!.referencias.length, 1);
    assert.doesNotMatch(g[0]!.prompt, /session continuity/);
    // El director la repite con su corrección.
    assert.match(g[1]!.id, /-2-2$/);
    assert.match(g[1]!.prompt, /CORRECTION after reviewing a first attempt: Remove the bottle\./);
    // Las demás reciben la toma aceptada como continuidad de la sesión.
    for (const x of g.slice(2)) {
      assert.equal(x.referencias.length, 2);
      assert.match(x.referencias[1]!.etiqueta, /session continuity/);
      assert.match(x.referencias[1]!.ruta, /fotos\/02-2\.png$/);
      assert.match(x.prompt, /@image2 is an earlier photograph from this same shoot/);
    }
    assert.equal(m.llamadas.fotos, 4);
    // La 3 va sin texto: no se maqueta. Las demás sí; el acabado, solo en la portada.
    assert.equal(m.llamadas.composiciones, 3);
    const conAcabado = m.llamadas.compuestas.filter((x) => x.enriquecer === true);
    assert.equal(conAcabado.length, 1, 'el acabado, solo en una lámina');
    assert.doesNotMatch(conAcabado[0]!.id, /^chat-pieza-/, 'y es la portada (la foto real), no una toma nueva');
    const d = (n: number) => p.diapositivas.find((x) => x.n === n)!;
    assert.equal(d(3).soloFoto, true);
    assert.match(d(3).decisiones.join(), /Va sin texto: la foto se sostiene sola/);
    assert.match(d(2).decisiones.join(), /Repetí la foto: Sale una botella/);
    assert.ok(d(3).png && d(3).movil);
    assert.match((await sharp(m.chat.rutaArchivo(lista.id, d(3).png!)).metadata()).width!.toString(), /^1080$/);
    assert.match(lista.mensajes.at(-1)!.texto, /Lo que decidí por el camino/);
  });

  it('una foto con dominante excesiva se repite con la corrección en el prompt, y una moderada la neutraliza el código', async () => {
    const m = await montar({
      extra: {
        defectoDeFoto: async (ruta) => (/02\.png$/.test(ruta) ? 'una dominante amarilla de IA (blancos R−B 120)' : undefined),
        corregirFoto: async (ruta) => (/03\.png$/.test(ruta) ? 'Neutralicé la dominante amarilla de la foto (blancos R−B 50 → 9): los blancos tiraban a crema.' : undefined),
      },
    });
    const lista = await producir(m);
    const g = m.llamadas.generadas;
    assert.match(g[1]!.id, /-2-2$/, 'la toma con dominante excesiva se repite');
    assert.match(g[1]!.prompt, /CORRECTION after a first attempt that came out with «una dominante amarilla de IA/);
    assert.match(g[1]!.prompt, /whites must read truly white/);
    const d = (n: number) => lista.piezas[0]!.diapositivas.find((x) => x.n === n)!;
    assert.match(d(2).decisiones.join(), /Repetí la foto: salió con una dominante amarilla de IA/);
    assert.match(d(3).decisiones.join(), /Neutralicé la dominante amarilla/);
  });

  it('una lámina «solo foto» del plan no se maqueta, y si el texto no cabe sin tapar una foto nueva, va la foto sola', async () => {
    const m = await montar({
      plan: () => {
        const p = plan(4);
        p.diapositivas[2] = { ...p.diapositivas[2]!, soloFoto: true };
        return p;
      },
      extra: {
        componer: async (e, r) => {
          intentos.push({ id: e.foto.activo.id, esqueleto: r.esqueleto });
          return /-2$/.test(e.foto.activo.id) ? { problemas: ['No cabe «apoyo»'], reparada: true, receta: r } : { png: join(e.salida, '..', 'fotos', '03.png'), problemas: [], reparada: false, receta: r };
        },
      },
    });
    const intentos: Array<{ id: string; esqueleto: string }> = [];
    const lista = await producir(m);
    const d = (n: number) => lista.piezas[0]!.diapositivas.find((x) => x.n === n)!;
    assert.equal(d(3).soloFoto, true);
    assert.match(d(3).decisiones.join(), /Foto sola, como pedía el plan/);
    // Antes de la foto sola, se probó la foto a sangre con titular y firma.
    assert.ok(intentos.some((x) => /-2$/.test(x.id) && x.esqueleto === 'FOTO_A_SANGRE'));
    assert.equal(d(2).soloFoto, true, 'sin maqueta posible, la foto nueva antes que un diseño degradado');
    assert.match(d(2).decisiones.join(), /El texto no cabía sin tapar la foto/);
    assert.ok(d(2).png);
  });

  it('si el segundo intento sale peor, se queda el primero; el cierre nunca va sin texto; y cada lámina conoce las maquetas de las demás', async () => {
    const m = await montar({
      extra: {
        revisarFoto: async (o) => {
          if (/macro/i.test(o.toma) && !o.anterior) return { veredicto: 'REPETIR', motivo: 'Corta el plato', corregir: 'Wider.', sinTexto: false };
          if (/macro/i.test(o.toma)) return { veredicto: 'USAR', motivo: 'Más amarilla que la primera', sinTexto: false, frenteAAnterior: 'PEOR' };
          return { veredicto: 'USAR', motivo: 'Se sostiene sola', sinTexto: true };
        },
        componer: async (e, r) => {
          llamadasEvitar.push({ esqueleto: r.esqueleto, evitar: e.evitarEsqueletos ?? [] });
          return { png: join(e.salida, '..', 'fotos', '03.png'), problemas: [], reparada: false, receta: r };
        },
      },
    });
    const llamadasEvitar: Array<{ esqueleto: string; evitar: string[] }> = [];
    const lista = await producir(m);
    const d = (n: number) => lista.piezas[0]!.diapositivas.find((x) => x.n === n)!;
    assert.match(d(2).decisiones.join(), /Me quedo con el primer intento: el segundo salió peor/);
    assert.match(d(2).foto ?? '', /-2$/);
    // La 3 se sostiene sola; la 4 es el cierre: lleva texto aunque el director la vea sola.
    assert.equal(d(3).soloFoto, true);
    assert.notEqual(d(4).soloFoto, true);
    const portada = llamadasEvitar.find((x) => x.esqueleto === 'FOTO_A_SANGRE')!;
    assert.deepEqual(portada.evitar.sort(), ['EDITORIAL', 'PARTIDA'], 'la portada no puede pasar a la maqueta de otra lámina con texto (la 3, sin texto, no cuenta)');
    const otra = llamadasEvitar.find((x) => x.esqueleto === 'PARTIDA')!;
    assert.ok(!otra.evitar.includes('FOTO_A_SANGRE'), 'la foto a sangre nunca se bloquea: cada una es distinta por su foto');
  });

  it('la portada lleva un titular creativo: describir el plato no vale', () => {
    const p = plan(4);
    const r = p.diapositivas[0]!.visual.receta;
    p.diapositivas[0] = { ...p.diapositivas[0]!, visual: { ...p.diapositivas[0]!.visual, receta: { ...r, textos: [{ clave: 'titular', texto: 'ROJO JUGOSO', fuente: 'ELEMENTO', cita: 'rojo y jugoso' }] } } };
    assert.match(problemasDePieza(p, 'carrusel', 4).join(), /La portada lleva un titular CREATIVO .*«ROJO JUGOSO» es ELEMENTO/);
    assert.doesNotMatch(problemasDePieza(plan(4), 'carrusel', 4).join(), /titular CREATIVO/);
  });

  it('antes del plan, tres conceptos: el cliente elige uno y el plan lo sigue; si fallan, se planifica igual', async () => {
    const recibidos: Array<string | undefined> = [];
    const conceptos = ['El ritual del corte', 'Del fuego a la mesa', 'El hueso en pie'].map((nombre, i) => ({ nombre, idea: `Una idea distinta número ${i + 1} para contar el plato`, titular: ['Despacio', 'Antes del fuego', 'En pie'][i]!, fotografia: 'Manos, cuchillo y tabla; sin el comedor ni otra comida.', laminas: ['uno uno uno', 'dos dos dos', 'tres tres tres', 'cuatro cuatro'] }));
    const m = await montar();
    const director = (m.chat as unknown as { d: DepsChat }).d.director!;
    const planificar = director.planificarPieza.bind(director);
    director.planificarPieza = async (e, o, dev) => {
      recibidos.push(o.concepto?.nombre);
      return planificar(e, o, dev);
    };
    director.proponerConceptos = async () => conceptos;
    const c = await m.chat.crear();
    const jpg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#996633' } }).jpeg().toBuffer();
    await m.chat.enviar(c.id, { texto: 'Un carrusel de croquetas', imagenes: [{ nombre: 'croquetas.jpg', bytes: jpg }] });
    const conHechos = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'hechos')));
    await m.chat.responderHechos(c.id, conHechos.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'hechos')!.id, { confirmar: true });
    const conConceptos = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'conceptos' && b.estado === 'PENDIENTE')));
    assert.equal(m.llamadas.planes, 0, 'no se planifica hasta elegir el concepto');
    const bloque = conConceptos.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'conceptos')!;
    await m.chat.elegirConcepto(c.id, bloque.id, 1);
    const conPlan = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'plan')));
    assert.deepEqual(recibidos, ['Del fuego a la mesa']);
    const hecho = conPlan.mensajes.flatMap((mm) => mm.bloques).find((b) => b.id === bloque.id);
    assert.equal(hecho?.tipo === 'conceptos' && hecho.elegido, 1);
    await assert.rejects(m.chat.elegirConcepto(c.id, bloque.id, 'auto'), /ya está hecha/);

    // Si el director no puede proponer conceptos, la pieza se planifica igual.
    const m2 = await montar();
    (m2.chat as unknown as { d: DepsChat }).d.director!.proponerConceptos = async () => {
      throw new Error('Gemini caído');
    };
    const c2 = await m2.chat.crear();
    await m2.chat.enviar(c2.id, { texto: 'Un carrusel de croquetas', imagenes: [{ nombre: 'croquetas.jpg', bytes: jpg }] });
    const h2 = await esperar(m2.chat, c2.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'hechos')));
    await m2.chat.responderHechos(c2.id, h2.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'hechos')!.id, { confirmar: true });
    const p2 = await esperar(m2.chat, c2.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'plan')));
    assert.ok(p2.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'conceptos' && b.estado === 'ERROR')));
  });

  it('si una maqueta de recorte deja el producto diminuto en una foto nueva, se rehace a sangre con la misma foto', async () => {
    const intentos: Array<{ n: string; esqueleto: string }> = [];
    const m = await montar({
      extra: {
        componer: async (e, r) => {
          intentos.push({ n: e.foto.activo.id, esqueleto: r.esqueleto });
          const png = join(e.salida, '..', 'fotos', '03.png');
          return /-3$/.test(e.foto.activo.id) && r.esqueleto === 'MARCO' ? { png, problemas: ['PRODUCTO_PEQUEÑO: en MARCO el producto ocupa el 30 % del ancho (mínimo 45 %).'], reparada: false, receta: r } : { png, problemas: [], reparada: false, receta: r };
        },
      },
    });
    const lista = await producir(m);
    const d3 = lista.piezas[0]!.diapositivas.find((x) => x.n === 3)!;
    assert.ok(intentos.some((x) => /-3$/.test(x.n) && x.esqueleto === 'FOTO_A_SANGRE'), 'probó la foto a sangre');
    assert.deepEqual(d3.problemas, []);
    assert.match(d3.decisiones.join(), /el producto quedaba diminuto .*la hice a sangre/);
  });

  it('el plan de un carrusel: portada y cierre con texto, y como mucho N−2 láminas solas', () => {
    const p = plan(4);
    p.diapositivas[0] = { ...p.diapositivas[0]!, soloFoto: true };
    p.diapositivas[3] = { ...p.diapositivas[3]!, soloFoto: true };
    p.diapositivas[1] = { ...p.diapositivas[1]!, soloFoto: true };
    const problemas = problemasDePieza(p, 'carrusel', 4).join(' | ');
    assert.match(problemas, /La portada de un carrusel lleva texto/);
    assert.match(problemas, /El cierre de un carrusel lleva al menos la firma/);
    assert.match(problemas, /Hay 3 láminas «soloFoto» en un carrusel de 4: como mucho 2/);
  });

  it('con referencia, el director la analiza una vez y el plan la recibe con su ficha', async () => {
    const analizadas: string[] = [];
    const m = await montar({
      buscarReferencias: async (o) => {
        await sharp({ create: { width: 40, height: 50, channels: 3, background: '#224466' } }).jpeg().toFile(join(o.destino, 'pinterest-01.jpg'));
        return { consultas: ['x'], candidatas: [{ id: 'pinterest-1', origen: 'pinterest', archivo: `${o.prefijo}/pinterest-01.jpg`, titulo: 'Pin' }] };
      },
      extra: {
        analizarReferencia: async (ruta) => {
          analizadas.push(ruta);
          return { ficha: { familia: 'F2', titulo: 'Patrón' }, apta: true, problemas: [] };
        },
      },
    });
    const c = await m.chat.crear();
    const jpg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#996633' } }).jpeg().toBuffer();
    await m.chat.enviar(c.id, { texto: 'Un carrusel de croquetas', imagenes: [{ nombre: 'croquetas.jpg', bytes: jpg }] });
    const conHechos = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'hechos')));
    await m.chat.responderHechos(c.id, conHechos.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'hechos')!.id, { confirmar: true });
    const conRefs = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'referencias' && b.estado === 'PENDIENTE')));
    await m.chat.elegirEstetica(c.id, conRefs.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'referencias')!.id, 'auto');
    const conPlan = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'plan')));
    assert.equal(analizadas.length, 1);
    assert.equal(conPlan.fichaReferencia?.apta, true);
    assert.equal(conPlan.fichaReferencia?.imagen, conPlan.referencia);
    const ref = m.llamadas.encargos.at(-1)!.referencia as { id: string; ficha?: unknown };
    assert.equal(ref.id, conPlan.referencia);
    assert.deepEqual(ref.ficha, { familia: 'F2', titulo: 'Patrón' });
  });

  it('una reparación que pasa de foto a sangre a plato recortado sobre color degrada la pieza', () => {
    assert.equal(degrada(receta('FOTO_A_SANGRE'), receta('PRODUCTO_SOBRE_COLOR')), true);
    assert.equal(degrada(receta('PARTIDA'), receta('EDITORIAL')), true);
    assert.equal(degrada(receta('FOTO_A_SANGRE'), receta('PARTIDA')), false);
    assert.equal(degrada(receta('CARTEL'), receta('PRODUCTO_SOBRE_COLOR')), false);
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
    // normal: 3 fotos (0,45) + crítica de 4 láminas (0,40) + revisión de 3 fotos (0,06) + acabado de la portada (0,20).
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'normal' }), 1.11);
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'normal', soloDiapositivas: [2] }), 0.27);
    // máximo: acabado en todas.
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'maximo' }), 2.11);
    // Una lámina «solo foto» no se critica ni lleva acabado.
    const conSola = plan(4);
    conSola.diapositivas[3] = { ...conSola.diapositivas[3]!, soloFoto: true };
    assert.equal(costeEstimado(conSola, { usdPorFoto: 0.15, esfuerzo: 'normal' }), 1.01);
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
