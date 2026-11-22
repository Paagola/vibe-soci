/**
 * F3.1 · Biblioteca de mecanismos: el código coloca a partir del mapa de la foto. Se comprueba lo que cada mecanismo
 * garantiza por construcción (cruce, escala, contraste, nada encima del plato) sobre mapas sintéticos. Sin pintar.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arreglosPara, acentoQuePide, vocesDisponibles } from '../src/aplicacion/diseno/proponerDiseno.js';
import { contraste } from '../src/dominio/diseno/color.js';
import { Tokens } from '../src/dominio/diseno/intencion.js';
import { construirMapa, type MapaDeFoto } from '../src/dominio/diseno/mapaDeFoto.js';
import { colocar, elegirTinta, type EntornoDeMecanismo } from '../src/dominio/diseno/mecanismos.js';
import { Composicion, type CapaPropuesta, type Maqueta } from '../src/dominio/diseno/propuesta.js';
import type { FichaReferencia } from '../src/dominio/referencia.js';

/** Un plato elíptico centrado en (cx, cy) sobre un fondo que pasa de `arriba` a `abajo` de luz. */
function mapaSintetico(o: { cx?: number; cy?: number; rx?: number; ry?: number; arriba?: number; abajo?: number } = {}): MapaDeFoto {
  const ancho = 120;
  const alto = 160;
  const { cx = 0.5, cy = 0.62, rx = 0.38, ry = 0.22, arriba = 20, abajo = 30 } = o;
  const rgb = new Uint8Array(ancho * alto * 3);
  const mascara = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const enPlato = (x / ancho - cx) ** 2 / rx ** 2 + (y / alto - cy) ** 2 / ry ** 2 <= 1;
      const fondo = Math.round(arriba + ((abajo - arriba) * y) / alto);
      rgb.set(enPlato ? [200, 80, 50] : [fondo, fondo, fondo], i * 3);
      mascara[i] = enPlato ? 255 : 0;
    }
  }
  return construirMapa({ ancho, alto, rgb, mascara });
}

const colores = [
  { token: 'principal', hex: '#B6AD49' },
  { token: 'negro', hex: '#131111' },
  { token: 'blanco', hex: '#F2F2F2' },
];
const textos = { titular: 'Entrecot de vaca', acento: 'de Galicia', firma: 'Torre de Vega', apoyo: 'Curado', sal: 'sal gruesa', anio: 'Desde 1980' };
const entorno = (mapa: MapaDeFoto, cambios: Partial<EntornoDeMecanismo> = {}): EntornoDeMecanismo => ({
  mapa,
  tieneMascara: true,
  colores,
  voces: { titular: 'titular', apoyo: 'texto', firma: 'rotulo', acento: 'acento', anotacion: 'anotacion' },
  colorDeVoz: { titular: 'blanco', texto: 'blanco', rotulo: 'principal', acento: 'principal', anotacion: 'principal' },
  anchoDeCaracter: { titular: 20, texto: 18, rotulo: 28, acento: 18, anotacion: 14 },
  textos,
  ...cambios,
});
const comp = (c: Record<string, unknown>) => Composicion.parse({ titular: 'titular', ...c });
const texto = (capas: CapaPropuesta[], id: string) => capas.find((c) => (c.tipo === 'texto' || c.tipo === 'anotacion') && c.id === id) as Extract<CapaPropuesta, { tipo: 'texto' }> | undefined;
const sujetoEn = (m: MapaDeFoto, col: number, fila: number) => (m.ocupacion[(fila - 1) * 12 + (col - 1)] ?? 0) >= 0.12;
const pisaElPlato = (m: MapaDeFoto, c: { col: number[]; fila: number[] }) => {
  for (let f = c.fila[0]!; f <= c.fila[1]!; f++) for (let k = c.col[0]!; k <= c.col[1]!; k++) if (sujetoEn(m, k, f)) return true;
  return false;
};

describe('F3.1 · mecanismos: TITULAR_DETRAS', () => {
  it('el titular ocupa el aire del lado con más sitio y puede bajar hasta meterse en el plato; lo pequeño va al otro lado, sin pisarlo', () => {
    const m = mapaSintetico();
    const r = colocar(comp({ mecanismo: 'TITULAR_DETRAS', firma: 'firma', apoyo: 'apoyo' }), entorno(m));
    assert.deepEqual(r.problemas, []);
    const t = texto(r.capas, 'titular')!;
    assert.equal(t.relacion, 'detras');
    assert.equal(t.ajuste, 'caja', 'llena su caja: el tamaño lo pone el sitio, no el modelo');
    assert.ok(t.caja.fila[0]! === 2 && t.caja.fila[1]! < m.sujeto!.fila[0], `su caja es el aire de encima: ${JSON.stringify(t.caja)} frente a ${JSON.stringify(m.sujeto)}`);
    assert.ok(alto(t.caja) >= 2, 'al menos dos filas: salto de escala por construcción');
    assert.ok(t.entre![1]! > m.sujeto!.fila[0], 'y el compositor lo puede acercar hasta que el plato lo tape');
    for (const id of ['firma', 'apoyo']) {
      const x = texto(r.capas, id)!;
      assert.equal(x.tamano, 34);
      assert.ok(!pisaElPlato(m, x.caja), `«${id}» no pisa el plato`);
      assert.ok(x.caja.fila[0]! > t.caja.fila[1]!, `«${id}» no comparte filas con el titular`);
    }
    assert.ok(texto(r.capas, 'firma')!.caja.fila[0]! > m.sujeto!.fila[1], 'la firma, en el lado contrario, pegada al borde');
  });

  it('lo pequeño nunca cae en la franja por la que el compositor mueve el titular hacia el plato (Etxebarri, 22/11)', () => {
    // El plato llega casi al borde de abajo: el apoyo y la firma no caben en el lado contrario y buscan sitio en el del
    // titular. Antes caían junto al plato, dentro de «entre», y el titular, al bajar, quedaba encima de ellos.
    for (const cy of [0.7, 0.74, 0.78]) {
      const m = mapaSintetico({ cy, ry: 0.2 });
      const r = colocar(comp({ mecanismo: 'TITULAR_DETRAS', firma: 'firma', apoyo: 'apoyo' }), entorno(m));
      const t = texto(r.capas, 'titular')!;
      assert.ok(t.entre, `cy ${cy}: el titular va detrás y tiene franja`);
      for (const id of ['firma', 'apoyo'] as const) {
        const x = texto(r.capas, id);
        if (!x) {
          assert.ok(r.problemas.some((p) => p.includes(textos[id])), `cy ${cy}: si «${id}» no cabe, lo dice`);
          continue;
        }
        assert.ok(x.caja.fila[0]! > t.entre![1]! || x.caja.fila[1]! < t.entre![0]!, `cy ${cy}: «${id}» ${JSON.stringify(x.caja)} cae en la franja del titular ${JSON.stringify(t.entre)}`);
      }
    }
  });

  it('con «lado: abajo» el titular va debajo; con más aire abajo, va abajo solo', () => {
    const m = mapaSintetico({ cy: 0.38 });
    const t = texto(colocar(comp({ mecanismo: 'TITULAR_DETRAS' }), entorno(m)).capas, 'titular')!;
    assert.ok(t.caja.fila[1]! === 15 && t.caja.fila[0]! > m.sujeto!.fila[1]);
    assert.ok(t.entre![0]! < m.sujeto!.fila[1], 'puede subir hasta meterse en el plato');
    assert.equal(t.vertical, 'arriba', 'pegado al plato');
  });

  it('la tinta sale de la luz medida: clara sobre oscuro, oscura sobre claro, y velo si ninguna llega', () => {
    const oscuro = mapaSintetico({ arriba: 15, abajo: 15 });
    assert.equal(texto(colocar(comp({ mecanismo: 'TITULAR_DETRAS', firma: 'firma' }), entorno(oscuro)).capas, 'titular')!.color, '@blanco');
    const claro = mapaSintetico({ arriba: 240, abajo: 240 });
    const r = colocar(comp({ mecanismo: 'TITULAR_DETRAS', firma: 'firma' }), entorno(claro));
    assert.equal(texto(r.capas, 'titular')!.color, '@negro');
    // Un gris medio no contrasta con ninguna tinta: velo y tinta clara.
    const medio = mapaSintetico({ arriba: 110, abajo: 110 });
    const conVelo = colocar(comp({ mecanismo: 'TITULAR_DETRAS', firma: 'firma' }), entorno(medio, { colores: [{ token: 'gris', hex: '#888888' }, { token: 'oro', hex: '#B6AD49' }, { token: 'negro', hex: '#131111' }] }));
    const foto = conVelo.capas.find((c) => c.tipo === 'foto') as Extract<CapaPropuesta, { tipo: 'foto' }>;
    assert.ok(foto.velo && foto.velo !== 'no', JSON.stringify(foto));
    assert.match(conVelo.notas.join(), /Velo/);
  });

  it('elegirTinta respeta la del estilo si contrasta y busca otra si no', () => {
    const m = mapaSintetico({ arriba: 15, abajo: 15 });
    const caja = { col: [1, 12] as [number, number], fila: [2, 3] as [number, number] };
    assert.equal(elegirTinta(caja, m, colores, 3, 'principal').tinta.token, 'principal', 'el oro sobre negro llega');
    assert.equal(elegirTinta(caja, m, colores, 3, 'negro').tinta.token, 'blanco', 'el negro sobre negro no');
  });
});

describe('F3.1 · mecanismos: TITULAR_CON_ACENTO, ANOTACIONES y sello', () => {
  it('el acento va en su voz, escalonado en el borde, pegado al titular y pintado antes (si se tocan, manda el titular)', () => {
    const m = mapaSintetico();
    const r = colocar(comp({ mecanismo: 'TITULAR_CON_ACENTO', acento: 'acento', firma: 'firma' }), entorno(m));
    assert.deepEqual(r.problemas, []);
    const a = texto(r.capas, 'acento')!;
    const t = texto(r.capas, 'titular')!;
    assert.equal(a.voz, 'acento');
    assert.equal(a.plano, 'fondo');
    assert.ok(r.capas.indexOf(a) < r.capas.indexOf(t), 'el acento se pinta antes');
    assert.equal(a.caja.fila[1]! + 1, t.caja.fila[0]!, 'pegados, sin compartir fila (el titular lo taparía)');
    assert.notEqual(a.color, t.color, 'en otra tinta');
    assert.deepEqual(t.entre?.[0], t.caja.fila[0]!, 'el titular no puede subir encima del acento al ajustar el cruce');
  });

  it('sin voz de acento, sin texto de acento o sin cuatro filas de aire, lo dice', () => {
    const m = mapaSintetico();
    assert.match(colocar(comp({ mecanismo: 'TITULAR_CON_ACENTO', acento: 'acento' }), entorno(mapaSintetico({ cy: 0.45, ry: 0.32 }))).problemas.join(), /cuatro filas de aire/);
    assert.match(colocar(comp({ mecanismo: 'TITULAR_CON_ACENTO', acento: 'acento' }), entorno(m, { voces: { titular: 'titular', apoyo: 'texto', firma: 'rotulo' } })).problemas.join(), /No hay voz de acento/);
    assert.match(colocar(comp({ mecanismo: 'TITULAR_CON_ACENTO' }), entorno(m)).problemas.join(), /necesita «acento»/);
  });

  it('ANOTACIONES: cada nota cerca de lo que señala, sin pisar el plato ni las demás; el titular, aparte en el aire', () => {
    const m = mapaSintetico();
    const r = colocar(comp({ mecanismo: 'ANOTACIONES', anotaciones: [{ texto: 'sal', apunta: { x: 0.1, y: 0.5 } }, { texto: 'apoyo', apunta: { x: 0.9, y: 0.9 } }] }), entorno(m));
    assert.deepEqual(r.problemas, []);
    assert.equal(texto(r.capas, 'titular')!.relacion, 'aparte');
    const notas = r.capas.filter((c) => c.tipo === 'anotacion') as Array<Extract<CapaPropuesta, { tipo: 'anotacion' }>>;
    assert.equal(notas.length, 2);
    for (const n of notas) assert.ok(!pisaElPlato(m, n.caja));
    assert.ok(notas[0]!.caja.col[0]! <= 6, 'la de la izquierda del plato, a la izquierda');
    assert.ok(notas[1]!.caja.fila[0]! > m.sujeto!.fila[0], 'la de abajo, abajo');
    // Un solo gesto: con otro mecanismo, una anotación como mucho.
    assert.match(colocar(comp({ mecanismo: 'TITULAR_DETRAS', anotaciones: [{ texto: 'sal', apunta: { x: 0, y: 0 } }, { texto: 'apoyo', apunta: { x: 1, y: 1 } }] }), entorno(m)).problemas.join(), /una anotación como mucho/);
  });

  it('el sello va en un hueco libre de 3 × 3, con letras que contrastan con su fondo; si no cabe, lo dice', () => {
    const m = mapaSintetico({ rx: 0.25, ry: 0.15 });
    const r = colocar(comp({ mecanismo: 'TITULAR_DETRAS', sello: { lineas: ['anio'] } }), entorno(m));
    assert.deepEqual(r.problemas, []);
    const sello = r.capas.find((c) => c.tipo === 'sello') as Extract<CapaPropuesta, { tipo: 'sello' }>;
    assert.ok(sello);
    const hex = (t: string) => colores.find((c) => c.token === t.slice(1))!.hex;
    assert.ok(contraste(hex(sello.fondo), hex(sello.color)) >= 4.5);
    const lleno = mapaSintetico({ rx: 0.9, ry: 0.5, cy: 0.5 });
    assert.match(colocar(comp({ mecanismo: 'TITULAR_DETRAS', sello: { lineas: ['anio'] } }), entorno(lleno)).problemas.join(), /sello/);
  });

  it('sin máscara no hay «detrás»: el titular va aparte, en la zona libre mayor', () => {
    const m = mapaSintetico();
    const t = texto(colocar(comp({ mecanismo: 'TITULAR_DETRAS' }), entorno(m, { tieneMascara: false })).capas, 'titular')!;
    assert.equal(t.relacion, 'aparte');
  });

});

describe('F3.1 · voces del estudio y arreglos del código', () => {
  const ficha = (clasificacion: string) => ({ tipografia: [{ rol: 'TITULAR', clasificacion }] }) as unknown as FichaReferencia;
  const tdv = Tokens.parse({
    colores: { principal: '#B6AD49', negro: '#131111', blanco: '#F2F2F2' },
    estilos: { titular: { fuente: 'bebas-neue', color: '@blanco' }, texto: { fuente: 'lora', color: '@blanco' }, rotulo: { fuente: 'montserrat', caso: 'mayusculas', tracking: 0.16, color: '@principal' } },
  });
  const disponibles = tdv && Object.entries(tdv.colores).map(([token, hex]) => ({ token, hex, papel: 'de la marca' }));

  it('la de pincel pide Kaushan (pincel, OFL)', () => {
    assert.equal(acentoQuePide(ficha('pincel de trazo seco, mayúsculas'))?.fuente, 'kaushan-script');
  });

  it('la referencia de florituras pide un acento de florituras; la didona, una didona; sin nada de eso, ninguno', () => {
    assert.equal(acentoQuePide(ficha('serif de florituras'))?.fuente, 'ballet');
    assert.equal(acentoQuePide(ficha('didona con florituras'))?.fuente, 'ballet');
    assert.equal(acentoQuePide(ficha('didona de alto contraste'))?.fuente, 'bodoni-moda-italica');
    assert.equal(acentoQuePide(ficha('grotesca extendida'))?.fuente, undefined);
  });

  it('el acento del estudio se añade marcado como propuesta pendiente, y el titular sigue siendo el de la marca', () => {
    const v = vocesDisponibles(tdv, disponibles, (f) => f, ficha('serif de florituras'));
    assert.equal(v.vocesDeEstudio.acento?.fuente, 'ballet');
    assert.match(v.voces.find((x) => x.id === 'acento')!.descripcion, /pendiente de confirmar con el local/);
    assert.deepEqual(v.roles, { titular: 'titular', apoyo: 'texto', firma: 'rotulo', acento: 'acento', anotacion: 'anotacion' });
    assert.equal(v.vocesDeEstudio.acento?.color, '@principal', 'en el color con más carácter de la marca');
    assert.ok(!('acento' in vocesDisponibles(tdv, disponibles, (f) => f, ficha('grotesca')).vocesDeEstudio), 'si la referencia no lo pide, no se añade');
  });

  it('un CONTRASTE se arregla con velo en su lado y la tinta más clara; una JERARQUIA, con el titular más alto', () => {
    const maqueta = { capas: [{ tipo: 'texto', id: 'firma', texto: 'firma', voz: 'rotulo', caja: { col: [1, 5], fila: [15, 15] }, ajuste: 'fijo', tamano: 34, relacion: 'aparte' }] } as unknown as Maqueta;
    const a = arreglosPara(['CONTRASTE: «firma» tiene un contraste de 1.7:1…', 'JERARQUIA: No hay salto de escala.'], maqueta, disponibles);
    assert.deepEqual(a?.ajustes, { velos: ['abajo'], tintas: { firma: 'blanco' }, titularMasAlto: 2 });
    assert.equal(arreglosPara(['SOLAPE: «firma» tapa el sujeto'], maqueta, disponibles), undefined, 'lo que no sabe arreglar, no lo toca');
  });
});

const alto = (c: { fila: number[] }) => c.fila[1]! - c.fila[0]! + 1;

describe('F3.2 · sin aire no hay titular detrás', () => {
  it('si el plato llena la foto (Sushita), TITULAR_DETRAS no se coloca y propone PLATO_SOBRE_COLOR', () => {
    const lleno = mapaSintetico({ cy: 0.5, rx: 0.6, ry: 0.48 });
    assert.match(colocar(comp({ mecanismo: 'TITULAR_DETRAS', firma: 'firma' }), entorno(lleno)).problemas.join(), /No hay aire .*PLATO_SOBRE_COLOR/);
  });
});

describe('F3.1 · mecanismos: detalles de oficio', () => {
  it('«sangra» corta los dos cantos con una sola palabra (ancho, centrado); con varias se ignora y se dice', () => {
    const m = mapaSintetico();
    const una = colocar(comp({ mecanismo: 'TITULAR_DETRAS', sangra: true }), entorno(m, { textos: { ...textos, titular: 'ENTRECOT' } }));
    const t = texto(una.capas, 'titular')!;
    assert.deepEqual([t.ajuste, t.alinear, t.sangra], ['ancho', 'centro', true]);
    const varias = colocar(comp({ mecanismo: 'TITULAR_DETRAS', sangra: true }), entorno(m));
    assert.equal(texto(varias.capas, 'titular')!.sangra, undefined);
    assert.match(varias.notas.join(), /sangra/);
  });

  it('con acento, el apoyo va en la voz de la firma: tres voces como mucho', () => {
    const r = colocar(comp({ mecanismo: 'TITULAR_CON_ACENTO', acento: 'acento', apoyo: 'apoyo', firma: 'firma' }), entorno(mapaSintetico()));
    assert.equal(texto(r.capas, 'apoyo')!.voz, 'rotulo');
    assert.equal(new Set(r.capas.flatMap((c) => ('voz' in c ? [c.voz] : []))).size, 3);
  });
});

describe('F3.2 · PLATO_SOBRE_COLOR (familias F1 y F3)', () => {
  const m = mapaSintetico();
  const silueta = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, anchoFoto: 1200, altoFoto: 1600 });

  it('con la silueta entera: campo de color partido en diagonal, el plato recortado girado y cortado por abajo, el titular entero por delante', () => {
    const r = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma', apoyo: 'apoyo' }), entorno(m, { silueta: silueta(200, 600, 800, 700) }));
    assert.deepEqual(r.problemas, []);
    assert.deepEqual(r.capas.slice(0, 2).map((c) => c.tipo), ['fondo', 'diagonal']);
    const [fondo, diagonal] = r.capas as Array<{ color: string }>;
    assert.notEqual(fondo!.color, diagonal!.color, 'dos colores de la marca');
    const plato = r.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }>;
    assert.ok(plato.giro && plato.sangra && plato.ancho);
    const t = texto(r.capas, 'titular')!;
    assert.equal(t.relacion, 'aparte', 'nada lo tapa: el compositor comprueba que no pisa el plato');
    assert.ok(t.caja.fila[1]! < plato.caja!.fila[0]!, 'el titular acaba antes que el plato');
    assert.deepEqual(['firma', 'apoyo', 'titular'].map((id) => Boolean(texto(r.capas, id))), [true, true, true], 'tres niveles');
    assert.ok(texto(r.capas, 'apoyo')!.tamano! > texto(r.capas, 'firma')!.tamano!, 'el segundo nivel, más grande que la firma');
    assert.ok(!r.capas.some((c) => c.tipo === 'foto'), 'sin la foto: solo el plato recortado');
  });

  it('si la foto corta el plato por los lados, se agranda hasta que esos cortes quedan fuera del lienzo', () => {
    const r = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma' }), entorno(m, { silueta: silueta(0, 200, 1200, 1400) }));
    assert.deepEqual(r.problemas, []);
    const plato = r.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }>;
    assert.ok(plato.ancho! >= 1.12 && plato.ancho! <= 1.5 && plato.giro);
    assert.match(r.notas.join(), /cortes quedan fuera del lienzo/);
    // Un producto de cerca y apaisado (los nigiris de la toma de Sushita): lo justo para esconder los cortes, no 1,5.
    const cerca = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma' }), entorno(m, { silueta: { x: 0, y: 769, w: 1792, h: 1471, anchoFoto: 1792, altoFoto: 2400 } }));
    assert.ok((cerca.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }>).ancho! < 1.3);
  });

  it('si la foto corta el plato por arriba, no se puede: lo dice', () => {
    assert.match(colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR' }), entorno(m, { silueta: silueta(100, 0, 900, 1000) })).problemas.join(), /corta el plato por arriba/);
  });

  it('sin máscara no hay recorte', () => {
    assert.match(colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR' }), entorno(m, { tieneMascara: false })).problemas.join(), /máscara/);
  });
});

describe('F3.3 · tratamiento de la referencia y elementos gráficos de la estética', () => {
  it('PLATO_SOBRE_COLOR reproduce la pegatina, el papel, el pincel y la tinta, y coloca los gráficos que admite la estética', () => {
    const m = mapaSintetico();
    const silueta = { x: 0, y: 200, w: 1200, h: 1400, anchoFoto: 1200, altoFoto: 1600 };
    const r = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma', apoyo: 'apoyo' }), entorno(m, { silueta, tratamientos: ['PEGATINA', 'PAPEL', 'PINCEL', 'TINTA'], graficos: { tipos: ['circulo', 'puntos'], maximo: 2 } }));
    assert.deepEqual(r.problemas, []);
    const plato = r.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }>;
    assert.ok(plato.filo, 'filo de pegatina');
    assert.ok(r.capas.some((c) => c.tipo === 'textura' && c.recurso === 'papel'));
    assert.equal(texto(r.capas, 'apoyo')!.voz, 'acento', 'el segundo nivel en la voz de pincel');
    assert.ok(r.capas.some((c) => c.tipo === 'trazo' && c.de === 'apoyo'));
    const iPlato = r.capas.indexOf(plato);
    assert.ok(r.capas.findIndex((c) => c.tipo === 'forma' && c.figura === 'circulo') < iPlato, 'el disco, detrás del plato');
    assert.ok(r.capas.some((c) => c.tipo === 'patron' && c.motivo === 'puntos'));
    // TRAMA: el patrón de línea de olas, flojo y por detrás de todo (justo encima del campo).
    const conTrama = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma' }), entorno(m, { silueta, tratamientos: ['TRAMA'], graficos: { tipos: [], maximo: 0 } }));
    const olas = conTrama.capas.findIndex((c) => c.tipo === 'patron' && c.motivo === 'olas' && c.suave);
    assert.equal(olas, 1, 'justo encima del fondo');
    // Un sello no bloquea: se quita y se dice (la corrección del crítico que lo pida no se pierde entera).
    const conSello = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma', sello: { lineas: ['firma'] } }), entorno(m, { silueta, tratamientos: [], graficos: { tipos: [], maximo: 0 } }));
    assert.deepEqual(conSello.problemas, []);
    assert.ok(!conSello.capas.some((c) => c.tipo === 'sello'));
    assert.match(conSello.notas.join(), /se quita/);
    // ILUSTRADO: el plato recortado, contorneado como un dibujo (el mismo filo que la pegatina).
    const ilustrado = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma' }), entorno(m, { silueta, tratamientos: ['ILUSTRADO'], graficos: { tipos: [], maximo: 0 } }));
    assert.ok((ilustrado.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }>).filo);
    // …y el gesto a tinta de la referencia: la rama de cerezo, detrás del plato, en el sitio de la trama de puntos.
    const conGraficos = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma' }), entorno(m, { silueta, tratamientos: ['ILUSTRADO'], graficos: { tipos: ['circulo', 'puntos'], maximo: 2 } }));
    const iRama = conGraficos.capas.findIndex((c) => c.tipo === 'forma' && c.figura === 'rama');
    assert.ok(iRama >= 0 && iRama < conGraficos.capas.findIndex((c) => c.tipo === 'plato'));
    assert.ok(!conGraficos.capas.some((c) => c.tipo === 'patron' && c.motivo === 'puntos'));
    // Cortado solo por la izquierda (un producto de cerca): pegado a ese canto, sin agrandarlo 1,5 veces.
    const deCerca = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma' }), entorno(m, { silueta: { x: 0, y: 700, w: 1000, h: 700, anchoFoto: 1200, altoFoto: 1600 }, tratamientos: [], graficos: { tipos: [], maximo: 0 } }));
    const p2 = deCerca.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }>;
    assert.equal(p2.alinear, 'abajo-izquierda');
    assert.ok(p2.ancho! < 1.2);
    // Sin tratamientos ni gráficos (editorial), nada de eso.
    const sobrio = colocar(comp({ mecanismo: 'PLATO_SOBRE_COLOR', firma: 'firma' }), entorno(m, { silueta, tratamientos: [], graficos: { tipos: [], maximo: 0 } }));
    assert.ok(!sobrio.capas.some((c) => c.tipo === 'textura' || c.tipo === 'patron' || c.tipo === 'trazo' || (c.tipo === 'forma' && c.figura === 'circulo')));
  });
});
