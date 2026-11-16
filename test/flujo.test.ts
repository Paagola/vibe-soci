/**
 * Recorre el flujo entero con el director y el generador simulados, sobre carpetas temporales.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { corregirDiapositiva } from '../src/aplicacion/corregirDiapositiva.js';
import { crearLocal } from '../src/aplicacion/crearLocal.js';
import { crearPieza } from '../src/aplicacion/crearPieza.js';
import type { Dependencias } from '../src/aplicacion/dependencias.js';
import { exportarPieza } from '../src/aplicacion/exportarPieza.js';
import { generarDiapositivas } from '../src/aplicacion/generarDiapositivas.js';
import { importarImagen } from '../src/aplicacion/importarImagen.js';
import { planificarPieza } from '../src/aplicacion/planificarPieza.js';
import { proponerConceptos } from '../src/aplicacion/proponerConceptos.js';
import { valorarDiapositiva } from '../src/aplicacion/valorarDiapositiva.js';
import { crearContenedor } from '../src/contenedor.js';
import { ErrorDeUsuario } from '../src/dominio/errores.js';

const siempreSi = async () => true;

describe('flujo completo en simulado', () => {
  let carpeta: string;
  let deps: Dependencias;
  let foto: string;
  const avisos: string[] = [];

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-'));
    const biblioteca = join(carpeta, 'biblioteca');
    await mkdir(biblioteca);
    await writeFile(join(biblioteca, 'principios.md'), '# Principios de prueba');
    foto = join(carpeta, 'plato.jpg');
    await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#8a2b1b' } }).jpeg().toFile(foto);

    deps = crearContenedor(
      {
        geminiModelo: 'x',
        geminiFacturacion: false,
        geminiTopeUsd: 1,
        geminiModeloImagen: 'gemini-3-pro-image',
        hfModelo: 'marketing-studio/image',
        hfResolucion: '2k',
        limiteImagenesDia: 40,
        carpetaDatos: join(carpeta, 'datos'),
        carpetaDatosSimulado: join(carpeta, 'datos-simulado'),
        carpetaBiblioteca: biblioteca,
        zonaHoraria: 'Europe/Madrid',
        productor: false,
      },
      { simular: true, avisar: (m) => avisos.push(m) },
    );
  });

  after(() => rm(carpeta, { recursive: true, force: true }));

  it('crea local y pieza, propone, planifica, genera, corrige, valora y exporta', async () => {
    await crearLocal(deps, { slug: 'el-boqueron', nombre: 'Bar El Boquerón Dorado', ciudad: 'Málaga', tonos: ['canalla'], colores: [{ nombre: 'Oro', hex: '#D4A017' }] });
    await assert.rejects(crearLocal(deps, { slug: 'el-boqueron', nombre: 'X', ciudad: 'Y', tonos: ['z'] }), ErrorDeUsuario);

    const pieza = await crearPieza(deps, {
      localSlug: 'el-boqueron',
      formato: 'CARRUSEL',
      numDiapositivas: 3,
      idea: 'Boquerones fritos recién hechos para el aperitivo',
      tipo: 'PLATO_ESTRELLA',
      fotos: [{ ruta: foto, papel: 'PLATO', nota: 'boquerones fritos' }],
    });
    assert.equal(pieza.fotos[0]?.archivo, 'fotos/01-plato.jpg');

    const conceptos = await proponerConceptos(deps, pieza.id);
    assert.equal(conceptos.length, 3);
    const otros = await proponerConceptos(deps, pieza.id);
    assert.equal(otros[0]?.titulo, 'Concepto simulado 4', 'los nuevos conceptos no repiten numeración');

    const plan = await planificarPieza(deps, pieza.id, 2);
    assert.equal(plan.diapositivas.length, 3);
    const planMd = await readFile(deps.piezas.rutaArchivo(pieza.id, 'plan.md'), 'utf8');
    assert.match(planMd, /Adjunta en este orden/);

    const resultado = await generarDiapositivas(deps, pieza.id, { confirmar: siempreSi });
    assert.equal(resultado.terminadas.filter((g) => g.estado === 'COMPLETADA').length, 3);
    const tras = await deps.piezas.obtener(pieza.id);
    const d2 = tras.generaciones.find((g) => g.diapositiva === 2);
    assert.deepEqual(d2?.referencias, ['fotos/01-plato.jpg', 'generadas/d1_v1.png'], 'la portada va como referencia de coherencia');
    assert.match(d2?.prompt ?? '', /Image 2: the approved cover/);

    await assert.rejects(generarDiapositivas(deps, pieza.id, { confirmar: siempreSi }), /No hay nada que generar/);

    const correccion = await corregirDiapositiva(deps, pieza.id, 1, 'El texto más grande', { manual: false, confirmar: siempreSi });
    assert.equal(correccion.generacion?.version, 2);
    assert.deepEqual(correccion.generacion?.referencias, ['generadas/d1_v1.png', 'fotos/01-plato.jpg']);
    assert.match(correccion.generacion?.prompt ?? '', /^Keep image 1 almost exactly/);

    const manual = await corregirDiapositiva(deps, pieza.id, 3, 'Más luz en el plato', { manual: true, confirmar: siempreSi });
    assert.equal(manual.generacion?.estado, 'PENDIENTE_MANUAL');
    const importada = await importarImagen(deps, pieza.id, 3, foto);
    assert.equal(importada.version, 2);
    assert.equal(importada.estado, 'COMPLETADA');

    await valorarDiapositiva(deps, pieza.id, 1, { veredicto: 'GUSTA', motivo: 'El texto detrás del plato funciona', version: 1 });
    const guia = await deps.biblioteca.leerGuia();
    assert.equal(guia.valoraciones[0]?.motivo, 'El texto detrás del plato funciona');

    const exportado = await exportarPieza(deps, pieza.id);
    assert.deepEqual(exportado.sinAprobar, [2, 3]);
    const tamano = async (archivo: string) => {
      const meta = await sharp(deps.piezas.rutaArchivo(pieza.id, archivo)).metadata();
      return [meta.width, meta.height];
    };
    assert.deepEqual(await tamano('exportadas/3x4/01.jpg'), [1080, 1440], 'se exporta a la proporción de diseño');
    assert.deepEqual(await tamano('exportadas/4x5/03.jpg'), [1080, 1350], 'y también a 4:5');
    assert.equal(exportado.archivos.length, 3 * 2 + 1);
    await stat(deps.piezas.rutaArchivo(pieza.id, 'exportadas/pie.txt'));
  });

  it('no deja crear una pieza sin foto de plato ni con fotos que no existen', async () => {
    await assert.rejects(
      crearPieza(deps, {
        localSlug: 'el-boqueron',
        formato: 'POST',
        idea: 'Una idea suficientemente larga',
        tipo: 'NOVEDAD',
        fotos: [{ ruta: join(carpeta, 'no-existe.jpg'), papel: 'LOCAL' }],
      }),
      (error: unknown) => error instanceof ErrorDeUsuario && error.detalles.length === 2,
    );
  });
});
