import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { elegirReferencias } from '../src/adaptadores/ficheros/elegirReferencias.js';
import type { Generacion, Pieza } from '../src/dominio/modelos.js';
import {
  cifrasNoAutorizadas,
  contarPalabras,
  quitarCifrasPermitidas,
  correccionesUsadas,
  idDePieza,
  problemaDeFoto,
  problemasDelBrief,
  problemasDeCamara,
  problemasDelPlan,
  versionElegida,
  proporcionDe,
  EXPORTACIONES_POR_FORMATO,
  RECORTE_4_5_PX,
} from '../src/dominio/reglas.js';

const piezaBase: Pieza = {
  id: 'p',
  localSlug: 'local',
  creadaEn: '2026-11-03T10:00:00.000Z',
  formato: 'CARRUSEL',
  numDiapositivas: 3,
  idea: 'Menú de 3 platos los jueves',
  tipo: 'OFERTA',
  condiciones: { precio: '25 €' },
  fotos: [{ archivo: 'fotos/01-plato.jpg', papel: 'PLATO' }],
  conceptos: [],
  generaciones: [],
};

const generacion = (cambios: Partial<Generacion>): Generacion => ({
  diapositiva: 1,
  version: 1,
  origen: 'API',
  modelo: 'm',
  prompt: 'p',
  referencias: [],
  estado: 'COMPLETADA',
  archivo: 'generadas/d1_v1.png',
  creadaEn: '2026-11-03T10:00:00.000Z',
  ...cambios,
});

describe('brief', () => {
  it('exige una foto de plato', () => {
    const problemas = problemasDelBrief({ ...piezaBase, fotos: [{ archivo: 'fotos/01-local.jpg', papel: 'LOCAL' }] });
    assert.ok(problemas.some((p) => p.includes('plato')));
  });

  it('exige condiciones en ofertas y eventos', () => {
    assert.equal(problemasDelBrief({ ...piezaBase, condiciones: {} }).length, 1);
    assert.equal(problemasDelBrief({ ...piezaBase, tipo: 'NOVEDAD', condiciones: {} }).length, 0);
  });

  it('respeta el número de diapositivas del formato', () => {
    assert.equal(problemasDelBrief({ ...piezaBase, numDiapositivas: 2 }).length, 1);
    assert.equal(problemasDelBrief({ ...piezaBase, formato: 'POST', numDiapositivas: 1 }).length, 0);
  });

  it('rechaza fotos que no existen, pesadas o en HEIC', () => {
    assert.match(problemaDeFoto('a.jpg', undefined) ?? '', /No encuentro/);
    assert.match(problemaDeFoto('a.heic', 100) ?? '', /JPG, PNG o WEBP/);
    assert.match(problemaDeFoto('a.png', 11 * 1024 * 1024) ?? '', /10 MB/);
    assert.equal(problemaDeFoto('a.webp', 100), undefined);
  });
});

describe('cifras', () => {
  it('solo deja las cifras que dio el dueño', () => {
    const fuentes = ['Menú de 3 platos los jueves', '25,50 €'];
    assert.deepEqual(cifrasNoAutorizadas(['3 platos', 'Por 25.50 €', 'Sin cifras'], fuentes), []);
    assert.deepEqual(cifrasNoAutorizadas(['Solo 19 €', '01/05'], fuentes), ['Solo 19 €', '01/05']);
  });
});

describe('plan', () => {
  const diapositiva = (posicion: number, textos: string[] = ['Hola']) => ({
    posicion,
    funcion: 'f',
    textos,
    fotos: ['fotos/01-plato.jpg'],
    prompt: `Instagram slide. CAMERA: Image 1 is shot from above. Use Image 1 only as the list of elements, not as a layout to copy. The new photograph is shot at table level. CREATIVE TYPOGRAPHY: ${textos.map((t) => `"${t}"`).join(', ')}. ${'x'.repeat(40)}`,
  });
  const plan = {
    diapositivas: [1, 2, 3].map((p) => diapositiva(p)),
    pie: 'Ven',
    hashtags: [],
    textoAlt: 'alt',
    hiloVisual: 'El mismo magenta y el plato que pasa de una a otra',
  };

  it('acepta un plan correcto', () => {
    assert.deepEqual(problemasDelPlan(piezaBase, plan), []);
  });

  it('detecta diapositivas de más, fotos inventadas y precios inventados', () => {
    const malo = {
      ...plan,
      diapositivas: [diapositiva(1, ['Solo 9 €']), { ...diapositiva(2), fotos: ['fotos/99.jpg'] }],
    };
    const problemas = problemasDelPlan(piezaBase, malo);
    assert.equal(problemas.length, 3);
  });

  it('un carrusel necesita hilo visual; un post no', () => {
    const { hiloVisual: _, ...sinHilo } = plan;
    assert.ok(problemasDelPlan(piezaBase, sinHilo).some((p) => p.includes('hiloVisual')));
    const post = { ...piezaBase, formato: 'POST' as const, numDiapositivas: 1 };
    assert.deepEqual(problemasDelPlan(post, { ...sinHilo, diapositivas: [diapositiva(1)] }), []);
  });

  it('limita las palabras en la imagen y el largo del titular', () => {
    const largo = 'una frase muy larga que no se puede leer de un vistazo en el móvil mientras pasas el dedo';
    const cargada = { ...diapositiva(1, [largo, largo]), titular: largo };
    const problemas = problemasDelPlan(piezaBase, { ...plan, diapositivas: [cargada, diapositiva(2), diapositiva(3)] });
    assert.ok(problemas.some((p) => p.includes('palabras en la imagen')));
    assert.ok(problemas.some((p) => p.includes('titular') && p.includes('más de')));
  });

  it('exige que cada texto esté escrito literalmente en el prompt', () => {
    const sinTexto = { ...diapositiva(1), prompt: 'CAMERA: not as a layout to copy. A prompt that forgets the typography entirely. '.repeat(2) };
    const problemas = problemasDelPlan(piezaBase, { ...plan, diapositivas: [sinTexto, diapositiva(2), diapositiva(3)] });
    assert.ok(problemas.some((p) => p.includes('no escribe literalmente')));
  });

  it('acepta el contador del carrusel y los contactos, pero no otras cifras', () => {
    assert.equal(quitarCifrasPermitidas('2/3 · @bar2go · bar2go.es', 3).match(/\d/), null);
    assert.equal(quitarCifrasPermitidas('(03)', 3).match(/\d/), null);
    assert.match(quitarCifrasPermitidas('4/5', 3), /4\/5/, 'un contador que no cuadra con el carrusel sigue siendo una cifra');
    assert.match(quitarCifrasPermitidas('1/3', 1), /1\/3/, 'en un post no hay contador');
    const conContador = { ...plan, diapositivas: [diapositiva(1, ['1/3', 'Hola']), diapositiva(2), diapositiva(3)] };
    assert.deepEqual(problemasDelPlan(piezaBase, conContador), []);
  });

  it('cuenta palabras sin contar separadores', () => {
    assert.equal(contarPalabras('RUBIA GALLEGA ✦ CHEDDAR · MAYO — 25 €'), 5);
  });
});

describe('versiones', () => {
  it('exporta la última que gustó y, si no, la última completada', () => {
    const pieza = {
      ...piezaBase,
      generaciones: [
        generacion({ version: 1, valoracion: { veredicto: 'GUSTA' as const, motivo: 'bien' } }),
        generacion({ version: 2 }),
      ],
    };
    assert.equal(versionElegida(pieza, 1)?.version, 1);
    assert.equal(versionElegida({ ...pieza, generaciones: [generacion({ version: 2 })] }, 1)?.version, 2);
  });

  it('los fallos del proveedor no gastan cambios', () => {
    const pieza = {
      ...piezaBase,
      generaciones: [generacion({ version: 2, comentario: 'a' }), generacion({ version: 3, comentario: 'b', estado: 'FALLIDA' })],
    };
    assert.equal(correccionesUsadas(pieza, 1), 1);
  });
});

describe('nombres', () => {
  it('crea ids legibles y sin tildes', () => {
    assert.equal(idDePieza(new Date('2026-11-03T12:00:00Z'), '¡Gamba roja de Palamós a la brasa!'), '2026-11-03-gamba-roja-de-palamos-a');
  });
});

describe('referencias visuales', () => {
  const entrada = (archivo: string, tratamiento: string, palabras: string[], tipos: Pieza['tipo'][] = []) => ({
    archivo,
    tratamiento,
    palabras,
    tipos,
    descripcion: archivo,
  });
  const indice = [
    entrada('sushi-plano.jpg', 'color-plano', ['sushi']),
    entrada('sushi-plano-2.jpg', 'color-plano', ['sushi']),
    entrada('sushi-oscuro.jpg', 'oscuro', ['sushi']),
    entrada('burger.jpg', 'macro', ['burger'], ['OFERTA']),
    entrada('pasta.jpg', 'blanco', ['pasta']),
  ];

  it('elige por afinidad, pero con tratamientos distintos', () => {
    const elegidas = elegirReferencias(indice, { tipo: 'PLATO_ESTRELLA', formato: 'POST', texto: 'Nuestro sushi de salmón' }, 3);
    assert.equal(elegidas.length, 3);
    assert.equal(new Set(elegidas.map((e) => e.tratamiento)).size, 3);
    assert.ok(elegidas.slice(0, 2).every((e) => e.archivo.startsWith('sushi')));
  });

  it('el tipo de pieza también cuenta y no hace falta que coincidan tildes ni mayúsculas', () => {
    const [primera] = elegirReferencias(indice, { tipo: 'OFERTA', formato: 'POST', texto: 'BURGER del mes' }, 1);
    assert.equal(primera?.archivo, 'burger.jpg');
  });
});

describe('cámara', () => {
  const diapositiva = (prompt: string) => ({ posicion: 1, funcion: 'f', textos: [], fotos: ['fotos/01-plato.jpg'], prompt });
  it('exige describir la toma original y pedir otra posición de cámara', () => {
    assert.equal(problemasDeCamara(diapositiva('PHOTO: same dish, nicer light.')).length, 1);
    assert.deepEqual(
      problemasDeCamara(diapositiva('CAMERA: Image 1 is shot from above. Use Image 1 only as the list of elements, not as a layout to copy. The new photograph is shot at table level.')),
      [],
    );
  });
});

describe('proporciones y exportación (3:4 con zona segura 4:5)', () => {
  it('el feed se diseña a 3:4, se exporta a 3:4 y a 4:5, y las historias a 9:16', () => {
    assert.equal(proporcionDe('POST'), '3:4');
    assert.equal(proporcionDe('CARRUSEL'), '3:4');
    assert.equal(proporcionDe('HISTORIA'), '9:16');
    assert.deepEqual(EXPORTACIONES_POR_FORMATO.CARRUSEL, ['3:4', '4:5']);
    assert.deepEqual(EXPORTACIONES_POR_FORMATO.HISTORIA, ['9:16']);
    assert.equal(RECORTE_4_5_PX, 45);
  });

  it('la exportación 4:5 recorta 45 px arriba y abajo de una pieza 3:4, y nada más', async () => {
    const sharp = (await import('sharp')).default;
    const { ProcesadorSharp } = await import('../src/adaptadores/imagen/ProcesadorSharp.js');
    const carpeta = await mkdtemp(join(tmpdir(), 'estudio-export-'));
    try {
      // Pieza 3:4 con una franja roja de 40 px arriba: tiene que desaparecer en 4:5 y seguir en 3:4.
      const origen = join(carpeta, 'pieza.png');
      await sharp({ create: { width: 1080, height: 1440, channels: 3, background: '#1f4fd1' } })
        .composite([{ input: { create: { width: 1080, height: 40, channels: 3, background: '#ff0000' } }, top: 0, left: 0 }])
        .png()
        .toFile(origen);
      const procesador = new ProcesadorSharp();
      const filaDeArriba = async (ruta: string) => {
        const { data } = await sharp(ruta).extract({ left: 540, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
        return data[0]! > 200 && data[2]! < 80 ? 'rojo' : 'azul';
      };
      for (const [proporcion, alto, arriba] of [['3:4', 1440, 'rojo'], ['4:5', 1350, 'azul']] as const) {
        const destino = join(carpeta, `${proporcion.replace(':', 'x')}.jpg`);
        await procesador.exportar(origen, destino, proporcion);
        const meta = await sharp(destino).metadata();
        assert.deepEqual([meta.width, meta.height], [1080, alto], proporcion);
        assert.equal(await filaDeArriba(destino), arriba, proporcion);
      }
      const historia = join(carpeta, 'historia.jpg');
      await procesador.exportar(origen, historia, '9:16');
      const meta = await sharp(historia).metadata();
      assert.deepEqual([meta.width, meta.height], [1080, 1920]);
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });
});
