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
import { costeEstimado, problemasDePieza, propuestaDeConceptos, type Conversacion, type PlanDePieza } from '../src/dominio/chat.js';
import type { Marca } from '../src/dominio/modelos.js';
import type { Tokens } from '../src/dominio/diseno/intencion.js';

const receta = (esqueleto: string) =>
  Receta.parse({
    nombre: `Dirección ${esqueleto}`,
    idea: 'Una receta de prueba para el chat',
    lecturas: ['el plato', 'el titular', 'la firma'],
    esqueleto,
    fondo: '@negro',
    textos: [{ clave: 'titular', texto: 'Una más', fuente: 'CREATIVO', cita: '' }, { clave: 'firma', texto: 'Asador Etxebarri', fuente: 'MARCA', cita: 'Asador Etxebarri' }],
    firma: { texto: 'firma', voz: 'rotulo' },
    producto: { escala: 'grande' },
    titular: { texto: 'titular', voz: 'titular', escala: 'monumental', relacion: 'detras' },
    operaciones: [],
  });

const toma = (prompt: string) => ({ foto: 'generada' as const, generar: { tipo: 'plato' as const, prompt: `${prompt} — a new photograph of the real dish with a different point of view and light, shot for an editorial feed.`, conPlato: true } });

const plan = (n: number): PlanDePieza => ({
  idea: 'Las croquetas desde cuatro miradas distintas',
  diapositivas: [
    { papel: 'portada', resumen: 'Una toma nueva con el titular detrás del plato', visual: { ...toma('Side lit opening photograph'), receta: receta('FOTO_A_SANGRE') } },
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
      return { bytes: await sharp({ create: { width: 108, height: 144, channels: 3, background: { r: 50 + llamadas.fotos * 9, g: 25, b: 42 } } }).png().toBuffer(), costeUsd: 0.14, modelo: 'doble' };
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
    assert.equal(llamadas.fotos, 4, 'una toma nueva por diapositiva, incluida la portada');
    assert.equal(llamadas.composiciones, 4);
    assert.equal(lista.piezas[0]!.diapositivas.filter((d) => d.png).length, 4);
    assert.equal(lista.piezas[0]!.costeRealUsd, 0.56);
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

  it('elegir una estética pendiente conserva el plato de su tarjeta y respeta el nuevo plato abierto en el chat', async () => {
    const m = await hastaReferencias(candidatas);
    const primera = await esperar(m.chat, m.id, c => !c.pensando && c.mensajes.some(mm => mm.bloques.some(b => b.tipo === 'referencias' && b.estado === 'PENDIENTE')));
    const tarjeta = primera.mensajes.flatMap(mm => mm.bloques).find(b => b.tipo === 'referencias')!;
    const [foto] = await m.chat.subirImagenes(m.id, [{ nombre: 'cafe.png', bytes: await sharp({ create: { width: 30, height: 40, channels: 3, background: '#abc123' } }).png().toBuffer() }]);
    const segunda = await m.chat.leer(m.id);
    segunda.hechos = { ...segunda.hechos!, foto: foto!, activoReal: foto!, plato: 'Café con leche' };
    await writeFile(join(m.carpeta, m.id, 'conversacion.json'), JSON.stringify(segunda));
    await m.chat.elegirEstetica(m.id, tarjeta.id, 'local-2');
    const resultado = await m.chat.leer(m.id);
    assert.equal(resultado.hechos?.plato, 'Café con leche');
    assert.equal(resultado.referencia, undefined);
    assert.equal(resultado.piezas[0]?.encargo?.fuentes?.hechos.foto, primera.hechos!.foto);
    assert.ok(resultado.piezas[0]?.encargo?.fuentes?.referencia?.archivo);
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

  it('si el diseño falla, el carrusel conserva texto en portada y cierre sobre las tomas ya generadas', async () => {
    const reparadas: boolean[] = [];
    const m = await montar({ extra: {
      componer: async (_e, receta) => ({ receta, reparada: false, problemas: ['sin aire para texto'] }),
      componerFotografiaConTexto: async (e, receta, cabecera) => {
        reparadas.push(cabecera);
        return { png: e.foto.ruta, receta, reparada: true, problemas: [] };
      },
    } });
    const c = await producir(m);
    assert.equal(c.piezas[0]?.estado, 'LISTA');
    assert.deepEqual(reparadas.sort(), [false, true]);
    assert.equal(m.llamadas.fotos, 4);
    const paginas = c.piezas[0]!.diapositivas;
    assert.ok(paginas[0]?.png && !paginas[0].soloFoto);
    assert.ok(paginas[3]?.png && !paginas[3].soloFoto);
    assert.ok(paginas[1]?.soloFoto && paginas[2]?.soloFoto);
  });

  it('cuando la foto tapa el título o la firma, comprueba el texto reparado a tamaño móvil', async () => {
    const reparadas: boolean[] = [];
    const m = await montar({ extra: {
      componer: async (e, receta) => ({ png: e.foto.ruta, movil: 'tapada', receta, reparada: false, problemas: [] }),
      leerTextoMovil: async png => png === 'tapada' ? ['Asador'] : ['Una más', 'Asador Etxebarri'],
      componerFotografiaConTexto: async (e, receta, cabecera) => {
        reparadas.push(cabecera);
        return { png: e.foto.ruta, movil: 'legible', receta, reparada: true, problemas: [] };
      },
    } });
    const c = await producir(m);
    assert.equal(c.piezas[0]?.estado, 'LISTA');
    assert.deepEqual(reparadas.sort(), [false, true]);
    assert.equal(m.llamadas.fotos, 4);
  });

  it('una maqueta sin texto obligatorio se queda en error aunque exista una foto nueva', async () => {
    const m = await montar({ extra: { componer: async (_e, receta) => ({ receta, reparada: false, problemas: ['no cabe'] }) } });
    const c = await producir(m);
    assert.equal(c.piezas[0]?.estado, 'ERROR');
    assert.match(c.piezas[0]?.error ?? '', /2 de 4/);
    assert.ok(!c.piezas[0]?.diapositivas[0]?.png);
    assert.ok(!c.piezas[0]?.diapositivas[3]?.png);
  });

  it('si el proveedor devuelve la referencia recomprimida, repite una vez y detiene la entrega', async () => {
    let envios = 0;
    const m = await montar({ extra: {
      generarFoto: async ({ referencias }) => {
        envios++;
        return { bytes: await sharp(referencias[0]!.ruta).resize(144).jpeg({ quality: 82 }).toBuffer(), costeUsd: .02, modelo: 'eco' };
      },
    } });
    const c = await producir(m);
    assert.equal(envios, 2);
    assert.equal(c.piezas[0]?.estado, 'ERROR');
    assert.match(c.piezas[0]?.error ?? '', /referencia/);
    assert.equal(m.llamadas.composiciones, 0);
    assert.deepEqual(c.piezas[0]?.fotos, []);
  });

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
    assert.match(g[0]!.id, /-1$/);
    assert.equal(g[0]!.referencias.length, 1);
    assert.doesNotMatch(g[0]!.prompt, /session continuity/);
    const repetida = g.find(x => x.id.endsWith('-2-2'))!;
    assert.match(repetida.prompt, /CORRECTION after reviewing a first attempt: Remove the bottle\./);
    for (const x of g.slice(1)) {
      assert.equal(x.referencias.length, 2);
      assert.match(x.referencias[1]!.etiqueta, /session continuity/);
      assert.match(x.referencias[1]!.ruta, /fotos\/01\.png$/);
      assert.match(x.prompt, /@image2 is an earlier photograph from this same shoot/);
    }
    assert.equal(m.llamadas.fotos, 5);
    // La 3 va sin texto: no se maqueta. Las demás sí; el acabado, solo en la portada.
    assert.equal(m.llamadas.composiciones, 3);
    const conAcabado = m.llamadas.compuestas.filter((x) => x.enriquecer === true);
    assert.equal(conAcabado.length, 1, 'el acabado, solo en una lámina');
    assert.match(conAcabado[0]!.id, /^chat-pieza-.*-1$/, 'se compone sobre la portada generada');
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
    const repetida = g.find(x => x.id.endsWith('-2-2'))!;
    assert.match(repetida.prompt, /CORRECTION after a first attempt that came out with «una dominante amarilla de IA/);
    assert.match(repetida.prompt, /whites must read truly white/);
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
    const relacionesGraficas = [{ gesto: 'La inicial cruza el pie del titular', construccion: 'Separar ambas voces en dos capas y cruzar sus cajas en el tercio superior.' }];
    const lecturaFotografica = {
      camara: 'El borde elíptico revela una mirada oblicua', distancia: 'El plato ocupa el tercio inferior',
      luz: 'Una sombra corta cae hacia la derecha', gesto: 'El cuenco se apoya en la tabla',
      materiales: 'Brillo ancho en el esmalte y estrecho en el metal', sensacion: 'Quietud por el aire superior',
      traslado: 'Cambiar de lado y reservar espacio sobre la mesa',
    };
    const m = await montar({
      buscarReferencias: async (o) => {
        await sharp({ create: { width: 40, height: 50, channels: 3, background: '#224466' } }).jpeg().toFile(join(o.destino, 'pinterest-01.jpg'));
        return { consultas: ['x'], candidatas: [{ id: 'pinterest-1', origen: 'pinterest', archivo: `${o.prefijo}/pinterest-01.jpg`, titulo: 'Pin' }] };
      },
      extra: {
        analizarReferencia: async (ruta) => {
          analizadas.push(ruta);
          return { ficha: { familia: 'F2', titulo: 'Patrón', lecturaFotografica, relacionesGraficas }, apta: true, problemas: [] };
        },
      },
    });
    const c = await m.chat.crear();
    const jpg = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#996633' } }).jpeg().toBuffer();
    const estilo = await sharp({ create: { width: 40, height: 50, channels: 3, background: '#113322' } }).jpeg().toBuffer();
    await m.chat.enviar(c.id, { texto: 'Un carrusel de croquetas con mi referencia', imagenes: [
      { nombre: 'croquetas.jpg', bytes: jpg }, { nombre: 'cartel.jpg', bytes: estilo },
    ] });
    const conHechos = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'hechos')));
    const ficha = conHechos.mensajes.flatMap(mm => mm.bloques).find(b => b.tipo === 'hechos')!;
    const propia = conHechos.imagenes.find(i => i.nombre === 'cartel.jpg')!.id;
    await m.chat.responderHechos(c.id, ficha.id, { confirmar: true, hechos: { ...ficha.propuesta, referencia: propia } });
    const conRefs = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'referencias' && b.estado === 'PENDIENTE')));
    const opciones = conRefs.mensajes.flatMap(mm => mm.bloques).find(b => b.tipo === 'referencias')!;
    assert.equal(opciones.candidatas[0]?.id, propia);
    await m.chat.elegirEstetica(c.id, opciones.id, 'auto');
    const conPlan = await esperar(m.chat, c.id, (x) => x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'plan')));
    assert.equal(analizadas.length, 1);
    assert.equal(conPlan.fichaReferencia?.apta, true);
    assert.equal(conPlan.fichaReferencia?.imagen, conPlan.referencia);
    const ref = m.llamadas.encargos.at(-1)!.referencia as { id: string; ficha?: unknown };
    assert.equal(ref.id, conPlan.referencia);
    assert.deepEqual(ref.ficha, { familia: 'F2', titulo: 'Patrón', lecturaFotografica, relacionesGraficas });
    const tarjeta = conPlan.mensajes.flatMap(m => m.bloques).find(b => b.tipo === 'referencias');
    assert.equal(tarjeta?.lectura?.find(x => x.titulo === 'Sensación')?.detalle, lecturaFotografica.sensacion);
    assert.equal(tarjeta?.lectura?.find(x => x.titulo === relacionesGraficas[0]!.gesto)?.detalle, relacionesGraficas[0]!.construccion);
  });

  it('conserva una fuente de luz motivada y mantiene el control de franjas y de las otras tomas', async () => {
    const iluminacion = 'A red neon sign to the right colours the lip of the glass.';
    const p = plan(4);
    p.diapositivas[1]!.visual.generar!.luzDeEscena = iluminacion;
    const revisadas: Array<string | undefined> = [];
    const corregidas: string[] = [];
    const m = await montar({ plan: () => p, extra: {
      defectoDeFoto: async (_ruta, luz) => { revisadas.push(luz); return undefined; },
      corregirFoto: async ruta => { corregidas.push(ruta); return undefined; },
    } });
    const c = await producir(m);
    assert.equal(c.piezas[0]?.estado, 'LISTA');
    assert.equal(revisadas.filter(luz => luz === iluminacion).length, 1);
    assert.equal(corregidas.length, 3);
    const foto = m.llamadas.generadas.find(g => g.id.endsWith('-2'))!;
    assert.ok(foto.prompt.includes(iluminacion));
    assert.doesNotMatch(foto.prompt, /Neutral daylight white balance/);
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
    assert.ok(p.some((x) => /Diapositiva 2: la foto subida solo sirve de referencia/.test(x)));
    assert.ok(p.some((x) => /repiten el esqueleto/.test(x)));
    assert.deepEqual(problemasDePieza(plan(4), 'carrusel', 4), []);
    assert.ok(problemasDePieza(plan(3), 'carrusel', 4).some((x) => /Hacen falta 4/.test(x)));
  });

  it('el coste cuenta las fotos nuevas y las reparaciones (y en un ajuste, solo lo que se rehace)', () => {
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'rapido' }), 0.60);
    // normal: 4 fotos (0,60) + crítica de 4 láminas (0,40) + revisión de 4 fotos (0,08) + acabado de la portada (0,20).
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'normal' }), 1.28);
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'normal', soloDiapositivas: [2] }), 0.27);
    // máximo: acabado en todas.
    assert.equal(costeEstimado(plan(4), { usdPorFoto: 0.15, esfuerzo: 'maximo' }), 2.28);
    // Una lámina «solo foto» no se critica ni lleva acabado.
    const conSola = plan(4);
    conSola.diapositivas[3] = { ...conSola.diapositivas[3]!, soloFoto: true };
    assert.equal(costeEstimado(conSola, { usdPorFoto: 0.15, esfuerzo: 'normal' }), 1.18);
  });
});

describe('chat del estudio · formato aprobado', () => {
  it('produce con el plato y el local del plan después de confirmar otro en la conversación, incluso en planes antiguos', async () => {
    for (const antigua of [false, true]) {
      const m = await montar();
      const c = await m.chat.crear();
      const jpg = await sharp({ create: { width: 32, height: 40, channels: 3, background: '#883311' } }).jpeg().toBuffer();
      await m.chat.enviar(c.id, { texto: 'Un carrusel de croquetas', imagenes: [{ nombre: 'croquetas.jpg', bytes: jpg }] });
      const ficha = (await esperar(m.chat, c.id, x => !x.pensando && x.mensajes.some(mm => mm.bloques.some(b => b.tipo === 'hechos')))).mensajes.flatMap(mm => mm.bloques).find(b => b.tipo === 'hechos')!;
      await m.chat.responderHechos(c.id, ficha.id, { confirmar: true });
      const planeada = await esperar(m.chat, c.id, x => !x.pensando && Boolean(x.piezas[0]?.plan));
      const primeraFoto = m.chat.rutaArchivo(c.id, planeada.imagenes[0]!.archivo);
      assert.equal(planeada.piezas[0]!.encargo?.fuentes?.hechos.foto, ficha.propuesta.foto);
      if (antigua) {
        delete planeada.piezas[0]!.encargo;
        await writeFile(join(m.carpeta, c.id, 'conversacion.json'), JSON.stringify(planeada));
      }
      const d = (m.chat as unknown as { d: DepsChat }).d;
      const primero = (await d.locales())[0]!;
      d.locales = async () => [primero, { ...primero, slug: 'cafe-albor', marca: { ...primero.marca, nombre: 'Café Albor' } }];
      d.director!.turnoDelChat = async (_ctx, imgs) => ({
        mensaje: 'Ficha del café', accion: { tipo: 'PROPONER_HECHOS', hechos: { ...ficha.propuesta, local: 'cafe-albor', plato: 'Café con leche', foto: imgs.at(-1)!.id } },
      });
      await m.chat.enviar(c.id, { texto: 'También tengo un café de otro local', imagenes: [{ nombre: 'cafe.jpg', bytes: jpg }] });
      const siguiente = await esperar(m.chat, c.id, x => !x.pensando && x.mensajes.flatMap(mm => mm.bloques).some(b => b.tipo === 'hechos' && b.estado === 'PENDIENTE'));
      const fichaCafe = siguiente.mensajes.flatMap(mm => mm.bloques).find(b => b.tipo === 'hechos' && b.estado === 'PENDIENTE')!;
      d.director!.turnoDelChat = async () => ({ mensaje: 'Ficha guardada' });
      await m.chat.responderHechos(c.id, fichaCafe.id, { confirmar: true });
      const conCafe = await esperar(m.chat, c.id, x => !x.pensando && x.hechos?.local === 'cafe-albor');
      const planCroquetas = conCafe.mensajes.flatMap(mm => mm.bloques).find(b => b.tipo === 'plan')!;
      await m.chat.responderPlan(c.id, planCroquetas.id, true);
      const entrega = await esperar(m.chat, c.id, x => x.piezas[0]?.estado === 'LISTA');
      assert.equal(entrega.hechos?.plato, 'Café con leche');
      assert.equal(m.llamadas.generadas[0]!.referencias[0]!.ruta, primeraFoto);
    }
  });

  it('mantiene la selección de la ficha y produce todas las láminas de un concepto antiguo aunque el selector dijera post', async () => {
    const m = await montar();
    const c = await m.chat.crear();
    const director = (m.chat as unknown as { d: DepsChat }).d.director!;
    const concepto = {
      nombre: 'El gesto de la mesa', idea: 'El plato se descubre en un gesto de la mesa.',
      titular: 'Una más', fotografia: 'Luz lateral y una mano que presenta el plato.',
      laminas: ['El gesto en la mesa'],
    };
    director.proponerConceptos = async (_e, o) => {
      assert.equal(o.formato, 'post');
      assert.equal(o.diapositivas, 1);
      return [concepto, concepto, concepto];
    };
    const imagen = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#996633' } }).jpeg().toBuffer();
    await m.chat.enviar(c.id, { texto: 'Prepara la pieza', formato: 'post', esfuerzo: 'rapido', imagenes: [{ nombre: 'plato.jpg', bytes: imagen }] });
    const conFicha = await esperar(m.chat, c.id, (x) => !x.pensando && x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'hechos')));
    const ficha = conFicha.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'hechos')!;
    assert.equal(ficha.formato, 'post');
    await m.chat.responderHechos(c.id, ficha.id, { confirmar: true });
    const conConceptos = await esperar(m.chat, c.id, (x) => !x.pensando && x.mensajes.some((mm) => mm.bloques.some((b) => b.tipo === 'conceptos' && b.estado === 'PENDIENTE')));
    const tarjeta = conConceptos.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'conceptos')!;
    assert.equal(tarjeta.pedido.esfuerzo, 'rapido');
    assert.doesNotMatch(conConceptos.mensajes.find((mm) => mm.bloques.some((b) => b.id === tarjeta.id))!.texto, /carrusel/i);
    // Las tarjetas guardadas antes de verificar la longitud podían presentar 1, 4 y 3 láminas en el mismo pedido post.
    tarjeta.conceptos[1]!.laminas = ['Presentación del plato', 'El corte en primer plano', 'El gesto de la mesa', 'La firma del local'];
    assert.equal(propuestaDeConceptos(1).safeParse({ conceptos: tarjeta.conceptos }).success, false);
    await writeFile(join(m.carpeta, c.id, 'conversacion.json'), JSON.stringify(conConceptos));
    await m.chat.elegirConcepto(c.id, tarjeta.id, 1);
    const conPlan = await m.chat.leer(c.id);
    const pieza = conPlan.piezas[0]!;
    assert.equal(pieza.formato, 'carrusel');
    assert.equal(pieza.plan?.diapositivas.length, 4);
    assert.equal(m.llamadas.fotos, 0);
    const planAprobado = conPlan.mensajes.flatMap((mm) => mm.bloques).find((b) => b.tipo === 'plan')!;
    await m.chat.responderPlan(c.id, planAprobado.id, true);
    const entrega = await esperar(m.chat, c.id, (x) => x.piezas[0]?.estado === 'LISTA');
    assert.deepEqual(entrega.piezas[0]!.diapositivas.filter((x) => x.png).map((x) => x.n), [1, 2, 3, 4]);
  });
});

describe('chat del estudio · plan con JSON roto', () => {
  it('repite el plan hasta tres veces si la respuesta llega con formato roto, y luego lo dice', async () => {
    const carpeta = await mkdtemp(join(tmpdir(), 'chat-json-'));
    let planes = 0;
    const chat = new ServicioChat({
      carpeta,
      usdPorFoto: 0.15,
      locales: async () => [{ slug: 'l', marca: { nombre: 'Asador Etxebarri', ciudad: 'C', descripcion: 'D', tonos: [] } as unknown as Marca, tokens: {} as Tokens }],
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

describe('edición de diseño en el chat', () => {
  async function entrega(formato: 'post' | 'carrusel', turno: NonNullable<DepsChat['director']>['turnoDelChat'], editarDiseno: NonNullable<DepsChat['editarDiseno']>) {
    let planes = 0;
    const { chat, llamadas } = await montar({ extra: { director: { turnoDelChat: turno, planificarPieza: async () => { planes++; return plan(4); } }, editarDiseno } });
    const c = await chat.crear();
    const p = plan(formato === 'post' ? 1 : 4);
    // El original y los activos entregados tienen identificadores distintos.
    c.hechos = { local: 'asador-etxebarri', plato: 'Croquetas', elementos: [{ nombre: 'croqueta', estado: 'frita', recuento: null }], mensaje: 'En la barra', foto: 'original', activoReal: 'foto-real' };
    c.piezas = [{
      id: 'pieza-base', estado: 'LISTA', formato, plan: p, esfuerzo: 'normal', indicaciones: '', costeEstimadoUsd: 1, costeRealUsd: 1, rehacer: [], progreso: [], fotos: [], agentes: [], bitacora: [],
      diapositivas: p.diapositivas.map((_, i) => ({ n: i + 1, png: `piezas/base/${i}.png`, foto: `toma-${i + 1}`, capas: [], problemas: [], decisiones: [] })),
    }];
    await writeFile(chat.rutaArchivo(c.id, 'conversacion.json'), JSON.stringify(c));
    return { chat, inicial: c, llamadas, planes: () => planes };
  }

  it('un ajuste de tipografía mal clasificado como PROPONER_PIEZA cambia el post existente sin plan ni foto', async () => {
    const e = await entrega('post', async () => ({ mensaje: 'Propongo otro post', accion: { tipo: 'PROPONER_PIEZA', formato: 'post', diapositivas: 1, indicaciones: 'Más al centro', busqueda: [] } }), async (o) => {
      assert.equal(o.conChips, false);
      assert.equal(o.lamina.foto, 'toma-1');
      return { lamina: { ...o.lamina, png: `${o.carpeta}/final.png` }, costeUsd: 0 };
    });
    await e.chat.enviar(e.inicial.id, { texto: 'Centra más la letra.', imagenes: [] });
    const c = await esperar(e.chat, e.inicial.id, (v) => !v.pensando);
    assert.equal(c.piezas.length, 1);
    assert.match(c.piezas[0]!.diapositivas[0]!.png!, /ediciones/);
    assert.equal(c.piezas[0]!.costeRealUsd, 1);
    assert.equal(e.planes(), 0);
    assert.equal(e.llamadas.fotos, 0);
    assert.ok(!c.mensajes.flatMap((m) => m.bloques).some((b) => b.tipo === 'plan'));
  });

  it('dos peticiones simultáneas no cobran ni publican dos revisiones sobre la misma base', async () => {
    let avisarInicio!: () => void;
    const enEdicion = new Promise<void>((resolver) => { avisarInicio = resolver; });
    let terminar!: () => void;
    const fin = new Promise<void>((resolver) => { terminar = resolver; });
    let ediciones = 0;
    const e = await entrega('post', async () => ({ mensaje: 'Edito', accion: { tipo: 'AJUSTAR_PIEZA', pieza: 'pieza-base', diapositivas: [1], indicaciones: 'Centrar título' } }), async (o) => {
      ediciones++;
      avisarInicio();
      await fin;
      return { lamina: { ...o.lamina, png: 'v1.png' }, costeUsd: 0 };
    });
    await e.chat.enviar(e.inicial.id, { texto: 'Centra el título', imagenes: [] });
    await enEdicion;
    await e.chat.enviar(e.inicial.id, { texto: 'Centra más el título', imagenes: [] });
    const duplicada = await esperar(e.chat, e.inicial.id, (v) => v.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'error')));
    assert.match(JSON.stringify(duplicada.mensajes.at(-1)), /edición en curso/);
    assert.equal(duplicada.pensando, true, 'el primer render sigue en curso');
    terminar();
    await esperar(e.chat, e.inicial.id, (v) => v.piezas[0]!.diapositivas[0]!.png === 'v1.png');
    assert.equal(ediciones, 1);
    assert.equal(e.llamadas.fotos, 0);
  });

  it('una referencia antigua en otra lámina bloquea la reentrega antes de cualquier gasto', async () => {
    let ediciones = 0;
    const e = await entrega('carrusel', async () => ({ mensaje: 'Edito', accion: { tipo: 'AJUSTAR_PIEZA', pieza: 'pieza-base', diapositivas: [2], indicaciones: 'Centrar título' } }), async () => {
      ediciones++; throw new Error('No se debe editar');
    });
    const p = e.inicial.piezas[0]!;
    p.plan!.diapositivas[0]!.visual.foto = 'real';
    p.diapositivas[0]!.foto = e.inicial.hechos!.activoReal;
    await writeFile(e.chat.rutaArchivo(e.inicial.id, 'conversacion.json'), JSON.stringify(e.inicial));
    await e.chat.enviar(e.inicial.id, { texto: 'Centra solo el título de la segunda', imagenes: [] });
    const c = await esperar(e.chat, e.inicial.id, (v) => !v.pensando);
    assert.match(JSON.stringify(c.mensajes.at(-1)), /referencia/);
    assert.equal(ediciones, 0);
    assert.equal(e.llamadas.fotos, 0);
    assert.deepEqual(c.piezas[0]!.diapositivas, p.diapositivas);
  });

  it('un chip en la segunda lámina conserva las otras tres y un fallo posterior preserva toda la entrega', async () => {
    let version = 1;
    const acciones: number[][] = [[2], [1, 3]];
    const e = await entrega('carrusel', async () => ({ mensaje: 'Edito', accion: { tipo: 'AJUSTAR_PIEZA', alcance: 'diseno-con-imagen-secundaria', pieza: 'pieza-base', diapositivas: acciones[version - 1]!, indicaciones: 'Chip al margen' } }), async (o) => {
      assert.equal(o.conChips, true);
      if (o.lamina.n === 3) throw new Error('El recurso no ha llegado.');
      return { lamina: { ...o.lamina, png: `${o.carpeta}/chip.png` }, costeUsd: 0.05 };
    });
    await e.chat.enviar(e.inicial.id, { texto: 'Añade un chip con Nano Banana 2 a la segunda lámina', imagenes: [] });
    const v1 = await esperar(e.chat, e.inicial.id, (v) => !v.pensando);
    const p = v1.piezas[0]!;
    assert.equal(p.formato, 'carrusel');
    const vista = v1.mensajes.at(-1)?.bloques[0];
    assert.equal(vista?.tipo === 'pieza' && vista.mostrar, 2, 'el visor se abre en la lámina editada');
    assert.equal(p.costeRealUsd, 1.05);
    assert.deepEqual(p.diapositivas.filter((d) => d.n !== 2), e.inicial.piezas[0]!.diapositivas.filter((d) => d.n !== 2));
    version = 2;
    await e.chat.enviar(e.inicial.id, { texto: 'Añade chips en la primera y la tercera.', imagenes: [] });
    const v2 = await esperar(e.chat, e.inicial.id, (v) => !v.pensando);
    assert.deepEqual(v2.piezas[0], p);
    assert.equal(v2.mensajes.at(-1)?.bloques[0]?.tipo, 'error');
    assert.equal(e.planes(), 0);
    assert.equal(e.llamadas.fotos, 0);
  });
});
