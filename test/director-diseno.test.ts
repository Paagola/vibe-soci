/**
 * F3 · El director de diseño: mapa de la foto, comprobación de los textos frente a los hechos, compilación de la
 * propuesta a intención, el caso de uso con su reintento, el adaptador de Gemini (con un fetch falso) y la orden única
 * de punta a punta con el director simulado y el compositor de verdad. Sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { ComponedorProyectos } from '../src/adaptadores/compositor/ComponedorProyectos.js';
import { AlmacenActivosFicheros } from '../src/adaptadores/ficheros/AlmacenActivosFicheros.js';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenReferenciasFicheros } from '../src/adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../src/adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { PiezasHechasFicheros } from '../src/adaptadores/ficheros/PiezasHechasFicheros.js';
import { ClienteGemini } from '../src/adaptadores/gemini/ClienteGemini.js';
import { DirectorDisenoGemini } from '../src/adaptadores/gemini/DirectorDisenoGemini.js';
import { MedidorDeFotoSharp } from '../src/adaptadores/imagen/MedidorDeFotoSharp.js';
import { CriticoDisenoSimulado, DirectorDisenoSimulado, titularDeLaNota } from '../src/adaptadores/simulado/DisenoSimulado.js';
import { DirectorFotoSimulado, GeneradorFotoSimulado, RevisorVisualSimulado, SegmentadorSimulado } from '../src/adaptadores/simulado/FotoSimulada.js';
import { avisoDeCruce, coloresDisponibles, proponerDiseno, vocesDisponibles } from '../src/aplicacion/diseno/proponerDiseno.js';
import { avanzar, crearEncargo, type DepsPost } from '../src/aplicacion/post/ordenPost.js';
import type { DepsReferencias } from '../src/aplicacion/referencias/dependencias.js';
import { registrarReferencia } from '../src/aplicacion/referencias/registrarReferencia.js';
import { RAIZ } from '../src/config.js';
import { Intencion, Tokens } from '../src/dominio/diseno/intencion.js';
import { aireEn, construirMapa, mapaEnTexto, rectangulosLibres, type MapaDeFoto } from '../src/dominio/diseno/mapaDeFoto.js';
import { compilarIntencion, palabrasDeLaFicha, problemasDeTextos, PropuestaDeDiseno, type ContextoDeCompilacion, type HechosDeLaPieza, type Maqueta } from '../src/dominio/diseno/propuesta.js';
import { Marca } from '../src/dominio/modelos.js';
import type { ActivoDisponible } from '../src/puertos/Compositor.js';
import type { MedidorDeFoto } from '../src/puertos/DirectorDeDiseno.js';

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');
const PLATO = 'Gamba roja de Palamós a la brasa con sal gruesa';

const hechos: HechosDeLaPieza = {
  plato: PLATO,
  elementos: [{ nombre: 'gamba roja', estado: 'entera, a la brasa', recuento: 2 }],
  local: { nombre: 'Asador Etxebarri', ciudad: 'Axpe (Bizkaia)', descripcion: 'Asador de brasa con leña en la plaza de Axpe.', tonos: ['sobrio', 'fuego'] },
};

/** Una propuesta con casi todo lo nuevo: foto a sangre con el titular detrás del plato, sello, anotación con flecha. */
/** Una maqueta escrita capa a capa (sin mecanismo): la sigue compilando compilarIntencion. */
const maqueta = (x: unknown): Maqueta => PropuestaDeDiseno.parse(x) as Maqueta;

function propuestaRica(): Maqueta {
  return maqueta({
    idea: 'La gamba asoma por delante de su nombre, como sale de la brasa.',
    foco: 'PLATO',
    seToma: ['El producto tapa parte de la palabra grande.'],
    noSeCopia: ['Sus textos y su marca.'],
    textos: [
      { clave: 'titular', texto: 'GAMBA\nROJA', fuente: 'PLATO', cita: 'Gamba roja' },
      { clave: 'brasa', texto: 'A la brasa', fuente: 'PLATO', cita: 'a la brasa' },
      { clave: 'sal', texto: 'sal gruesa', fuente: 'PLATO', cita: 'sal gruesa' },
      { clave: 'firma', texto: 'Asador Etxebarri · Axpe', fuente: 'MARCA', cita: 'Asador Etxebarri' },
    ],
    capas: [
      { tipo: 'fondo', color: '@carbon' },
      { tipo: 'foto', encuadre: 'sangre', velo: 'abajo', colorVelo: '@carbon' },
      { tipo: 'texto', id: 'titular', texto: 'titular', voz: 'frase', caja: { col: [1, 12], fila: [3, 8] }, ajuste: 'ancho', color: '@hueso', relacion: 'detras', tinta: 'impresa' },
      { tipo: 'sello', forma: 'circulo', centro: { x: 0.8, y: 0.2 }, radio: 0.14, fondo: '@hueso', color: '@carbon', lineas: [{ texto: 'brasa', voz: 'firma' }] },
      { tipo: 'anotacion', id: 'nota', texto: 'sal', voz: 'anotacion', caja: { col: [1, 4], fila: [13, 14] }, apunta: { x: 0.4, y: 0.6 }, color: '@hueso' },
      { tipo: 'texto', id: 'firma', texto: 'firma', voz: 'firma', caja: { col: [1, 12], fila: [15, 15] }, ajuste: 'fijo', tamano: 34, color: '@hueso', relacion: 'aparte' },
    ],
  });
}

/** Una propuesta como la escribe ahora el director: mecanismo y textos, sin capas. */
function conMecanismo(): PropuestaDeDiseno {
  const { capas: _c, ...base } = propuestaRica();
  return PropuestaDeDiseno.parse({ ...base, composicion: { mecanismo: 'TITULAR_DETRAS', titular: 'titular', apoyo: 'brasa', firma: 'firma', anotaciones: [{ texto: 'sal', apunta: { x: 0.4, y: 0.6 } }] } });
}

const contexto = (cambios: Partial<ContextoDeCompilacion> = {}): ContextoDeCompilacion => ({
  id: 'post',
  version: 1,
  titulo: 'Prueba',
  marca: 'asador-etxebarri',
  foto: 'foto-1',
  tieneMascara: true,
  colores: { carbon: '#111111', hueso: '#EDE7DD' },
  voces: ['frase', 'firma', 'anotacion'],
  vocesDeEstudio: {},
  coloresMedidos: {},
  conReferencia: true,
  ...cambios,
});

describe('F3 · los textos solo dicen lo que consta', () => {
  it('acepta citas literales y palabras de los datos (singular y plural)', () => {
    assert.deepEqual(problemasDeTextos(propuestaRica().textos, hechos), []);
  });

  it('rechaza una palabra que no consta, una cifra inventada y una cita que no está en su fuente', () => {
    const p = problemasDeTextos(
      [
        { clave: 'a', texto: 'Gamba casera', fuente: 'PLATO', cita: 'Gamba' },
        { clave: 'b', texto: '3 gambas', fuente: 'RECUENTO', cita: '3 gamba roja' },
        { clave: 'c', texto: 'Axpe', fuente: 'PLATO', cita: 'Axpe' },
      ],
      hechos,
    );
    assert.ok(p.some((x) => /casera/.test(x)), 'palabra sin respaldo');
    assert.ok(p.some((x) => /cifra que no consta \(3\)/.test(x)), 'el recuento confirmado es 2, no 3');
    assert.ok(p.some((x) => /no está en la nota del dueño/.test(x)), 'Axpe es de la marca, no de la nota');
  });

  it('el titular creativo solo si el encargo lo permite, corto y sin reclamos; nada del post de referencia', () => {
    const creativo = [{ clave: 't', texto: 'Crujiente', fuente: 'CREATIVO' as const, cita: '' }];
    assert.match(problemasDeTextos(creativo, hechos).join(), /no lo permite/);
    assert.deepEqual(problemasDeTextos(creativo, hechos, { titularCreativo: true }), []);
    assert.match(problemasDeTextos([{ clave: 't', texto: 'Lo mejor', fuente: 'CREATIVO', cita: '' }], hechos, { titularCreativo: true }).join(), /afirma algo que no consta/);
    const ficha = { titulo: '«SANDWICH» ×6', capas: ['crema plano', '«SANDWICH» seis veces + «OF THE MONTH»', 'ORDER NOW y URL'] };
    const deReferencia = palabrasDeLaFicha(ficha);
    assert.ok(deReferencia.includes('sandwich') && deReferencia.includes('order'));
    assert.match(problemasDeTextos([{ clave: 't', texto: 'Sandwich', fuente: 'CREATIVO', cita: '' }], hechos, { titularCreativo: true, palabrasDeReferencia: deReferencia }).join(), /post de referencia/);
  });
});

describe('F3 · de la propuesta a la intención', () => {
  it('compila una propuesta rica en una intención válida, con la silueta del plato y las relaciones medibles', () => {
    const c = compilarIntencion(propuestaRica(), contexto());
    assert.deepEqual(c.problemas, []);
    const i = Intencion.parse(c.intencion);
    const ids = i.capas.map((x) => x.id);
    const fantasma = i.capas.find((x) => x.id === 'plato');
    assert.equal(fantasma?.tipo, 'recorte');
    assert.equal(fantasma?.opacidad, 0, 'la silueta del plato no se pinta');
    const titular = i.capas.find((x) => x.id === 'titular');
    assert.equal(titular?.tipo === 'texto' && titular.recortarCon?.modo, 'fuera', 'detrás del plato de la foto a sangre');
    assert.ok(titular?.tipo === 'texto' && titular.tinta && titular.tinta.densidad > 0, 'la tinta «impresa» trae los márgenes de INVESTIGACION.md');
    assert.ok(ids.indexOf('foto') < ids.indexOf('titular') && ids.indexOf('titular') < ids.indexOf('firma'), 'se pinta por planos');
    assert.ok(i.capas.some((x) => x.tipo === 'trazo' && x.gesto === 'flecha'), 'la anotación lleva su flecha');
    assert.ok(i.relaciones.some((r) => r.tipo === 'detras' && r.texto === 'titular'), 'detrás de la silueta: la cobertura se mide y se corrige para que se lea');
    assert.ok(i.relaciones.some((r) => r.tipo === 'noSolapar' && r.textos.includes('firma') && r.textos.includes('nota')));
  });

  it('dice lo que no se puede hacer: color o voz fuera de la lista, plato recortado sin máscara, sin decir qué toma de la referencia', () => {
    const p = propuestaRica();
    const mal = maqueta({
      ...p,
      seToma: [],
      capas: [...p.capas.slice(0, 2), { tipo: 'plato', caja: { col: [2, 11], fila: [5, 12] }, ancho: 0.7 }, { tipo: 'texto', id: 'x', texto: 'titular', voz: 'didona', caja: { col: [1, 12], fila: [3, 5] }, ajuste: 'ancho', color: '@oro', relacion: 'aparte' }],
    });
    const problemas = compilarIntencion(mal, contexto({ tieneMascara: false })).problemas.join(' | ');
    assert.match(problemas, /«seToma»/);
    assert.match(problemas, /no tiene máscara/);
    assert.match(problemas, /«@oro» no está en la lista/);
    assert.match(problemas, /«didona» no está en la lista/);
  });

  it('un texto en la fila 1 o la 16 se sale de la zona segura (salvo un titular que sangra)', () => {
    const p = propuestaRica();
    const capas = p.capas.map((c) => (c.tipo === 'texto' && c.id === 'firma' ? { ...c, caja: { col: [1, 12], fila: [16, 16] } } : c));
    assert.match(compilarIntencion(maqueta({ ...p, capas }), contexto()).problemas.join(), /filas 1 y 16/);
    const sangra = p.capas.map((c) => (c.tipo === 'texto' && c.id === 'titular' ? { ...c, caja: { col: [1, 12], fila: [1, 5] }, sangra: true } : c));
    assert.deepEqual(compilarIntencion(maqueta({ ...p, capas: sangra }), contexto()).problemas, []);
  });

  it('avisa si ningún texto toca al plato (titular encima y foto debajo: la plantilla)', () => {
    const p = propuestaRica();
    const apilada = maqueta({ ...p, capas: p.capas.filter((c) => c.tipo !== 'anotacion').map((c) => (c.tipo === 'texto' ? { ...c, relacion: 'aparte' } : c)) });
    assert.match(avisoDeCruce(apilada, true) ?? '', /^CRUCE/);
    assert.equal(avisoDeCruce(apilada, false), undefined, 'sin máscara no se le puede pedir');
    assert.equal(avisoDeCruce(p, true), undefined);
  });
});

/** Una foto sintética: arriba oscura y lisa, un plato claro y con detalle en el centro, abajo clara y lisa. */
function fotoSintetica(ancho = 120, alto = 160) {
  const rgb = new Uint8Array(ancho * alto * 3);
  const mascara = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const enPlato = (x - ancho / 2) ** 2 / (ancho * 0.3) ** 2 + (y - alto / 2) ** 2 / (alto * 0.15) ** 2 <= 1;
      const v = enPlato ? ((x + y) % 2 ? 230 : 120) : y < alto / 2 ? 20 : 235;
      rgb.set(enPlato ? [v, 40, 30] : [v, v, v], i * 3);
      mascara[i] = enPlato ? 255 : 0;
    }
  }
  return { ancho, alto, rgb, mascara };
}

describe('F3 · mapa de la foto', () => {
  it('sitúa el plato, encuentra zonas libres fuera de él (oscura arriba, clara abajo) y el color del plato', () => {
    const m = construirMapa(fotoSintetica());
    assert.ok(m.sujeto);
    assert.ok(m.sujeto.col[0] >= 2 && m.sujeto.col[1] <= 11 && m.sujeto.fila[0] >= 4 && m.sujeto.fila[1] <= 13, JSON.stringify(m.sujeto));
    assert.ok(m.libres.length >= 2);
    for (const z of m.libres) assert.ok(z.fila[1] < m.sujeto.fila[0] || z.fila[0] > m.sujeto.fila[1] || z.col[1] < m.sujeto.col[0] || z.col[0] > m.sujeto.col[1], 'una zona libre no pisa el plato');
    assert.ok(m.libres.some((z) => z.luz < 0.3) && m.libres.some((z) => z.luz > 0.7));
    assert.ok(m.vivo, 'el rojo del plato es el acento candidato');
    const texto = mapaEnTexto(m);
    assert.match(texto, /#/);
    assert.match(texto, /Zonas libres para texto/);
  });

  it('el mayor rectángulo libre se busca entero y no se pisan entre sí', () => {
    const libre = Array.from({ length: 4 * 4 }, (_, i) => i % 4 !== 3); // la última columna ocupada
    assert.deepEqual(rectangulosLibres(libre, 4, 4, 2), [{ col: [1, 3], fila: [1, 4] }]);
  });

  it('el medidor de sharp encuadra la foto y la máscara como caerán a sangre', async () => {
    const carpeta = await mkdtemp(join(tmpdir(), 'estudio-mapa-'));
    try {
      const s = fotoSintetica(300, 400);
      await sharp(Buffer.from(s.rgb), { raw: { width: 300, height: 400, channels: 3 } }).png().toFile(join(carpeta, 'foto.png'));
      // La máscara a la mitad de resolución: el medidor la lleva al tamaño de la foto.
      await sharp(Buffer.from(s.mascara), { raw: { width: 300, height: 400, channels: 1 } }).resize(150, 200).png().toFile(join(carpeta, 'mascara.png'));
      const foto = { activo: { id: 'f', ancho: 300, alto: 400 }, ruta: join(carpeta, 'foto.png'), rutaMascara: join(carpeta, 'mascara.png') } as unknown as ActivoDisponible;
      const m = await new MedidorDeFotoSharp().medir(foto);
      assert.equal(m.ocupacion.length, 12 * 16);
      assert.ok(m.sujeto && m.sujeto.area > 0.05 && m.sujeto.area < 0.25, JSON.stringify(m.sujeto));
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });
});

describe('F3 · el caso de uso: colores, voces y reintento', () => {
  const mapa: MapaDeFoto = construirMapa(fotoSintetica());
  const medidor: MedidorDeFoto = { medir: async () => mapa };
  const tokens = Tokens.parse({ colores: { carbon: '#111111', hueso: '#EDE7DD' }, estilos: { frase: { fuente: 'league-gothic', color: '@hueso' }, firma: { fuente: 'plex-mono', color: '@hueso' } } });
  const foto = { activo: { id: 'foto-1' }, ruta: FOTO, rutaMascara: '/m.png' } as unknown as ActivoDisponible;

  it('añade el color del plato y la voz manuscrita del estudio, sin repetir lo que la marca ya tiene', () => {
    const { colores, coloresMedidos } = coloresDisponibles(tokens, mapa);
    assert.ok(colores.some((c) => c.token === 'plato'));
    assert.ok('plato' in coloresMedidos && !('carbon' in coloresMedidos));
    const { voces, vocesDeEstudio } = vocesDisponibles(tokens, colores);
    assert.deepEqual(voces.map((v) => v.id), ['frase', 'firma', 'anotacion']);
    assert.equal(vocesDeEstudio.anotacion?.fuente, 'caveat');
    const conManuscrita = Tokens.parse({ ...tokens, estilos: { ...tokens.estilos, pincel: { fuente: 'kaushan-script', color: '@hueso' } } });
    assert.ok(!('anotacion' in vocesDisponibles(conManuscrita, colores).vocesDeEstudio), 'si la marca ya tiene manuscrita, no se añade otra');
  });

  it('si la primera propuesta inventa, se le devuelve con los problemas y la segunda pasa', async () => {
    const inventa = PropuestaDeDiseno.parse({ ...propuestaRica(), textos: propuestaRica().textos.map((t) => (t.clave === 'brasa' ? { ...t, texto: 'Brasa de encina' } : t)) });
    const director = new DirectorDisenoSimulado([inventa, propuestaRica()]);
    const pruebas: Intencion[] = [];
    const r = await proponerDiseno(
      { director, medidor, probar: async (i) => (pruebas.push(i), { errores: [], avisos: [] }) },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens, referencia: { id: 'ref-post-30' } },
    );
    assert.equal(r.intentos.length, 2);
    assert.match(r.intentos[0]!.problemas.join(), /encina/);
    assert.deepEqual(r.problemas, []);
    assert.ok(r.intencion);
    assert.equal(pruebas.length, 1, 'solo se prueba en el compositor lo que pasa las comprobaciones del dominio');
    assert.ok(r.intencion.tokens.estilos.anotacion, 'la voz del estudio va en la intención');
    assert.ok(r.intencion.tokens.colores.plato, 'y el color medido también');
  });

  it('el salto de escala y el cruce son obligatorios si la foto lo permite, salvo una excepción razonada', async () => {
    const jerarquia = { errores: [], avisos: ['JERARQUIA: No hay salto de escala.'] };
    let r = await proponerDiseno(
      { director: new DirectorDisenoSimulado([propuestaRica(), propuestaRica()]), medidor, probar: async () => jerarquia },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens, referencia: { id: 'ref-post-30' } },
    );
    assert.match(r.problemas.join(), /^JERARQUIA: .*obligatorio/);
    const conExcepcion = maqueta({ ...propuestaRica(), excepcion: 'El dato del origen pesa tanto como el plato: es a propósito.' });
    r = await proponerDiseno(
      { director: new DirectorDisenoSimulado([conExcepcion, conExcepcion]), medidor, probar: async () => jerarquia },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens, referencia: { id: 'ref-post-30' } },
    );
    assert.deepEqual(r.problemas, []);
    assert.deepEqual(r.avisos, ['JERARQUIA: No hay salto de escala.'], 'con la razón escrita, vuelve a ser un aviso');
    // Sin máscara no se puede exigir: queda en aviso.
    r = await proponerDiseno(
      { director: new DirectorDisenoSimulado([propuestaRica(), propuestaRica()]), medidor, probar: async () => jerarquia },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto: { ...foto, rutaMascara: undefined } as unknown as ActivoDisponible, hechos, tokensMarca: tokens, referencia: { id: 'ref-post-30' } },
    );
    assert.ok(!r.problemas.some((x) => /JERARQUIA/.test(x)));
  });

  it('lo que el código sabe arreglar (contraste, escala) lo arregla sin volver a llamar al director', async () => {
    const director = new DirectorDisenoSimulado();
    const pruebas: Intencion[] = [];
    const r = await proponerDiseno(
      {
        director,
        medidor,
        probar: async (i) => {
          pruebas.push(i);
          return pruebas.length === 1 ? { errores: ['CONTRASTE: «firma» tiene un contraste de 1.4:1 con su fondo en su peor zona; se pide al menos 4.5:1.'], avisos: [] } : { errores: [], avisos: [] };
        },
      },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens },
    );
    assert.deepEqual(r.problemas, []);
    assert.equal(director.encargos.length, 1, 'una sola llamada al director');
    assert.match(r.intentos[0]!.arreglos.join(), /velo abajo y tinta @hueso para «firma»/);
    assert.ok(r.intencion!.capas.some((c) => c.id.startsWith('velo')), 'la segunda prueba lleva el velo');
  });

  it('la crítica visual mira la pieza pintada y su corrección se adopta solo si pasa todo lo medible', async () => {
    const corregida = { ...(await new DirectorDisenoSimulado().proponer({ hechos } as never)), composicion: { mecanismo: 'TITULAR_DETRAS' as const, titular: 'titular', firma: 'firma', sangra: true } };
    const critico = new CriticoDisenoSimulado([{ llega: false, motivos: ['El titular no tiene tensión: que sangre.'], propuesta: corregida }]);
    const r = await proponerDiseno(
      { director: new DirectorDisenoSimulado(), critico, medidor, probar: async () => ({ errores: [], avisos: [], png: '/pieza.png' }) },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens },
    );
    assert.deepEqual(critico.piezas, ['/pieza.png', '/pieza.png'], 'la corrección adoptada se vuelve a criticar');
    assert.deepEqual(r.critica, { llega: true, motivos: [], adoptada: true });
    assert.equal(r.enRevision, false);
    assert.equal(r.intentos.at(-1)?.origen, 'critica');
    assert.equal(r.propuesta?.composicion?.sangra, true);
    // Si la corrección no pasa, se queda la pieza que ya pasaba y la crítica se apunta como aviso.
    const inventa = { ...corregida, textos: corregida.textos.map((t) => ({ ...t, texto: `${t.texto} casera` })) };
    const r2 = await proponerDiseno(
      { director: new DirectorDisenoSimulado(), critico: new CriticoDisenoSimulado([{ llega: false, motivos: ['Falta tensión.'], propuesta: inventa }]), medidor, probar: async () => ({ errores: [], avisos: [], png: '/p.png' }) },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens },
    );
    assert.equal(r2.critica?.adoptada, false);
    assert.deepEqual(r2.problemas, []);
    assert.ok(r2.avisos.includes('CRITICA: Falta tensión.'));
    assert.equal(r2.enRevision, true, 'no llega y su corrección no pasa: queda en revisión');
  });

  it('la firma del local es obligatoria, salvo excepción razonada', async () => {
    const sinFirma = { ...(await new DirectorDisenoSimulado().proponer({ hechos } as never)), composicion: { mecanismo: 'TITULAR_DETRAS' as const, titular: 'titular' } };
    const director = new DirectorDisenoSimulado([sinFirma, { ...sinFirma, excepcion: 'Pieza de serie: la firma va en la portada del carrusel.' }]);
    const r = await proponerDiseno({ director, medidor, probar: async () => ({ errores: [], avisos: [] }) }, { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens });
    assert.match(r.intentos[0]!.problemas.join(), /Falta la firma del local/);
    assert.deepEqual(r.problemas, []);
  });

  it('COBERTURA fuera de rango es un error: el código prueba el titular al otro lado antes de devolverlo', async () => {
    const pruebas: Intencion[] = [];
    const r = await proponerDiseno(
      {
        director: new DirectorDisenoSimulado(),
        medidor,
        probar: async (i) => (pruebas.push(i), pruebas.length === 1 ? { errores: [], avisos: ['COBERTURA: El sujeto tapa 76 % de «titular» en su parte más tapada; se pedía entre el 20 % y el 45 %.'] } : { errores: [], avisos: [] }),
      },
      { id: 'post', version: 1, titulo: 't', marca: 'asador-etxebarri', foto, hechos, tokensMarca: tokens },
    );
    assert.deepEqual(r.problemas, []);
    assert.match(r.intentos[0]!.arreglos.join(), /al otro lado del plato \(abajo\)/);
    const titular = (i: Intencion) => i.capas.find((c) => c.id === 'titular') as { caja: { y: number } };
    assert.ok(titular(pruebas[1]!).caja.y > titular(pruebas[0]!).caja.y, 'el titular baja');
  });

  it('el titular simulado sale literal de la nota, sin acabar en una palabra gramatical', () => {
    assert.equal(titularDeLaNota(PLATO), 'Gamba roja');
    assert.equal(titularDeLaNota('Croquetas de jamón'), 'Croquetas de jamón');
    assert.equal(titularDeLaNota('Manhattan Tower: brioche, tres carnes'), 'Manhattan Tower');
  });
});

describe('F3 · director de diseño con Gemini (fetch falso)', () => {
  it('manda el esquema en las instrucciones fijas, los hechos y el mapa en el mensaje, dos imágenes pequeñas, y valida la respuesta', async () => {
    const cuerpos: Array<{ systemInstruction: { parts: Array<{ text: string }> }; contents: Array<{ parts: Array<{ text?: string; inlineData?: { data: string } }> }> }> = [];
    const fetchFalso: typeof fetch = async (_url, init) => {
      cuerpos.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(conMecanismo()) }] } }] }), { status: 200 });
    };
    const director = new DirectorDisenoGemini(new ClienteGemini('k', ['m'], { fetch: fetchFalso, dormir: async () => {} }), ['m']);
    const mapa = construirMapa(fotoSintetica());
    const p = await director.proponer(
      { hechos, foto: FOTO, mapa, colores: [{ token: 'carbon', hex: '#111111', papel: 'de la marca' }], voces: [{ id: 'frase', descripcion: 'League Gothic' }], titularCreativo: false, referencia: { id: 'ref-post-30', imagen: FOTO } },
      ['un problema anterior'],
    );
    assert.equal(p.textos[0]?.clave, 'titular');
    const cuerpo = cuerpos[0]!;
    assert.match(cuerpo.systemInstruction.parts[0]!.text, /"composicion"/, 'el esquema del dialecto va en las instrucciones');
    assert.match(cuerpo.systemInstruction.parts[0]!.text, /TITULAR_CON_ACENTO/);
    assert.doesNotMatch(cuerpo.systemInstruction.parts[0]!.text, /"capas"/, 'el modelo ya no escribe capas');
    const partes = cuerpo.contents[0]!.parts;
    const texto = partes[0]!.text ?? '';
    assert.match(texto, /PLATO \(nota del dueño\): «Gamba roja de Palamós/);
    assert.match(texto, /Mapa de la foto/);
    assert.match(texto, /AIRE: \d+ filas libres encima del plato y \d+ debajo/);
    assert.match(texto, /@carbon #111111/);
    assert.match(texto, /un problema anterior/);
    const imagenes = partes.filter((x) => x.inlineData);
    assert.equal(imagenes.length, 2);
    for (const img of imagenes) {
      const meta = await sharp(Buffer.from(img.inlineData!.data, 'base64')).metadata();
      assert.ok(Math.max(meta.width ?? 0, meta.height ?? 0) <= 512);
    }
  });
});

describe('F3 · la orden única con el director de diseño (simulado) y el compositor de verdad', () => {
  let carpeta: string;
  let refs: DepsReferencias;
  const deps = (director: DirectorDisenoSimulado): DepsPost => ({
    raiz: RAIZ,
    proyectos: join(carpeta, 'proyectos'),
    activos: new AlmacenActivosFicheros(join(carpeta, 'datos', 'locales')),
    referencias: refs,
    director: new DirectorFotoSimulado(),
    generador: new GeneradorFotoSimulado(),
    revisor: new RevisorVisualSimulado(),
    segmentador: new SegmentadorSimulado(),
    componedor: new ComponedorProyectos(RAIZ, join(carpeta, 'datos')),
    disenador: { director, medidor: new MedidorDeFotoSharp() },
    ahora: () => '2026-11-14T10:00:00.000Z',
  });

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-f3-orden-'));
    const locales = new AlmacenLocalesFicheros(join(carpeta, 'locales'));
    await locales.guardar(Marca.parse(JSON.parse(await readFile(join(RAIZ, 'plantillas', 'marca.ejemplo.json'), 'utf8'))));
    refs = {
      piezas: { listar: async () => [] } as unknown as DepsReferencias['piezas'],
      piezasHechas: new PiezasHechasFicheros(join(carpeta, 'proyectos')),
      locales,
      referencias: new AlmacenReferenciasFicheros(join(carpeta, 'locales')),
      biblioteca: new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(RAIZ, 'biblioteca', 'referencias')),
      enlaces: { obtener: async () => ({ estado: 'PIDE_CAPTURA', motivo: 'x' }) },
      leerArchivo: (ruta) => readFile(ruta),
      ahora: () => '2026-11-14T10:00:00.000Z',
    };
    await registrarReferencia(refs, { local: 'asador-etxebarri', id: 'ref-post-30', deBiblioteca: 'post-30' });
  });
  after(() => rm(carpeta, { recursive: true, force: true }));

  async function hastaIntencion(d: DepsPost, proyecto: string) {
    await crearEncargo(d, { proyecto, local: 'asador-etxebarri', plato: PLATO, foto: FOTO, referencia: 'ref-post-30', simulado: true });
    await avanzar(d, proyecto);
    await avanzar(d, proyecto, { confirmo: true });
    return avanzar(d, proyecto, { confirmo: true });
  }

  it('ya no se para en INTENCION: el director la escribe, pasa las comprobaciones y la pieza se compone', async () => {
    const director = new DirectorDisenoSimulado();
    const d = deps(director);
    const r = await hastaIntencion(d, 'gamba-f3');
    assert.equal(r.parada, 'HECHO', r.parada);
    assert.ok(r.mensajes.some((m) => /Intención escrita por director de diseño simulado/.test(m)), r.mensajes.join('\n'));
    const enviado = director.encargos[0]!;
    assert.equal(enviado.referencia?.ficha?.familia, 'F7', 'el director recibe la ficha de la referencia');
    assert.ok(enviado.mapa.sujeto, 'y el mapa de la foto, con el plato de la máscara');
    const intencion = Intencion.parse(JSON.parse(await readFile(join(carpeta, 'proyectos', 'gamba-f3', 'intenciones', 'post.json'), 'utf8')));
    assert.equal(intencion.textos.titular, 'Gamba roja');
    await stat(join(carpeta, 'proyectos', 'gamba-f3', 'intenciones', 'post.propuesta.json'));
    await stat(join(carpeta, 'datos', 'disenos', 'gamba-f3', 'post', 'v001', 'exportadas', '4x5.jpg'));
  });

  it('la propuesta rica (detrás del plato, sello, anotación con flecha, tinta) se compone sin errores', async () => {
    // La máscara simulada es una elipse que no sigue a la gamba: la cobertura medida no dice nada, de ahí la excepción.
    const rica = maqueta({ ...propuestaRica(), excepcion: 'Prueba del compositor con una máscara simulada que no sigue al plato.' });
    const d = deps(new DirectorDisenoSimulado([rica, rica]));
    const r = await hastaIntencion(d, 'gamba-rica');
    assert.equal(r.parada, 'HECHO', r.parada);
    const resuelto = JSON.parse(await readFile(join(carpeta, 'datos', 'disenos', 'gamba-rica', 'post', 'v001', 'resuelto.json'), 'utf8'));
    assert.deepEqual(resuelto.problemas.filter((p: { gravedad: string }) => p.gravedad === 'ERROR'), []);
    assert.ok(resuelto.medidas.oficio, 'el documento resuelto lleva las medidas de oficio');
  });

  it('si la crítica visual dice que no llega y no hay corrección que pase, queda EN REVISIÓN con su borrador, no HECHO', async () => {
    const d = { ...deps(new DirectorDisenoSimulado()), disenador: { director: new DirectorDisenoSimulado(), critico: new CriticoDisenoSimulado([{ llega: false, motivos: ['No tiene la tensión de la referencia.'] }]), medidor: new MedidorDeFotoSharp() } };
    const r = await hastaIntencion(d, 'gamba-revision');
    assert.equal(r.encargo.paso, 'INTENCION');
    assert.match(r.parada, /EN REVISIÓN: .*No tiene la tensión de la referencia/);
    await stat(join(carpeta, 'proyectos', 'gamba-revision', 'intenciones', 'post.borrador.json'));
  });

  it('si la propuesta no pasa, deja el borrador y la propuesta, se para, y no vuelve a llamar al director al relanzar', async () => {
    const inventa = PropuestaDeDiseno.parse({ ...propuestaRica(), textos: propuestaRica().textos.map((t) => (t.clave === 'brasa' ? { ...t, texto: 'Brasa de encina' } : t)) });
    const director = new DirectorDisenoSimulado([inventa, inventa]);
    const d = deps(director);
    let r = await hastaIntencion(d, 'gamba-mal');
    assert.equal(r.encargo.paso, 'INTENCION');
    assert.match(r.parada, /FALTA LA INTENCIÓN DE DISEÑO: la propuesta del director no pasa.*encina/);
    await stat(join(carpeta, 'proyectos', 'gamba-mal', 'intenciones', 'post.borrador.json'));
    r = await avanzar(d, 'gamba-mal');
    assert.equal(director.encargos.length, 2, 'relanzar no gasta otra llamada');
    assert.match(r.parada, /ya hay una propuesta del director que no pasó/);
  });
});

describe('F3.2 · el plato que sale de su foto, compilado', () => {
  it('«sobreLaFoto» es un recorte alineado con la foto en marco; el marco que sangra llega a los cantos y abajo', () => {
    const p = maqueta({
      ...propuestaRica(),
      capas: [
        { tipo: 'fondo', color: '@hueso' },
        { tipo: 'foto', encuadre: 'marco', caja: { col: [1, 12], fila: [7, 16] }, sangra: true },
        { tipo: 'texto', id: 'titular', texto: 'titular', voz: 'frase', caja: { col: [1, 12], fila: [3, 6] }, ajuste: 'caja', color: '@carbon', relacion: 'detras' },
        { tipo: 'plato', sobreLaFoto: true },
        { tipo: 'texto', id: 'firma', texto: 'firma', voz: 'firma', caja: { col: [1, 6], fila: [2, 2] }, ajuste: 'fijo', tamano: 34, color: '@carbon', relacion: 'aparte' },
      ],
    });
    const c = compilarIntencion(p, contexto());
    assert.deepEqual(c.problemas, []);
    const i = Intencion.parse(c.intencion);
    const foto = i.capas.find((x) => x.id === 'foto') as { caja: { x: number; w: number; y: number; h: number } };
    assert.equal(foto.caja.x, 0);
    assert.equal(foto.caja.w, 1);
    assert.ok(Math.abs(foto.caja.y + foto.caja.h - 1) < 0.001);
    const plato = i.capas.find((x) => x.id === 'plato') as { tipo: string; alineadoCon?: string; opacidad: number };
    assert.deepEqual([plato.tipo, plato.alineadoCon, plato.opacidad], ['recorte', 'foto', 1]);
    assert.ok(i.relaciones.some((r) => r.tipo === 'detras' && r.texto === 'titular'));
  });
});

describe('F3.2 (punto 8) · aire medido con el mapa', () => {
  it('aireEn: la mitad de arriba de la foto sintética está libre de plato y la de abajo, en parte, no', () => {
    const m = construirMapa(fotoSintetica());
    assert.ok(aireEn(m, 'arriba')! > aireEn(m, 'abajo')!);
    assert.ok(aireEn(m, 'arriba-izquierda')! >= 0.5);
    assert.equal(aireEn({ ...m, ocupacion: [] }, 'arriba'), undefined, 'sin máscara no se mide');
  });
});
