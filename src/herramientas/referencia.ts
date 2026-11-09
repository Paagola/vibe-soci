/**
 * Referencias de diseño de un local (F1.6). Línea de comandos; la web aún no lo usa (sus pantallas se aprueban aparte).
 *
 *   referencia registrar --local L --id ID (--imagen ruta | --enlace url | --biblioteca post-11) [--nota "…"]
 *   referencia captura   --local L --id ID --imagen ruta        (cuando el enlace no se pudo leer)
 *   referencia ficha     --local L --id ID --desde ficha.json   (añade el análisis)
 *   referencia comprobar --local L [--referencia ID]            (¿puede la pieza pasar a concepto?)
 *   referencia listar    --local L
 *   referencia familias
 *
 * Si falta la referencia, «comprobar» propone tres familias y pinta su ficha visual en
 * datos/locales/<L>/referencias/propuestas.jpg para que el usuario elija.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp, { type OverlayOptions } from 'sharp';
import { AlmacenLocalesFicheros } from '../adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { AlmacenPiezasFicheros } from '../adaptadores/ficheros/AlmacenPiezasFicheros.js';
import { AlmacenReferenciasFicheros } from '../adaptadores/ficheros/AlmacenReferenciasFicheros.js';
import { BibliotecaDeReferenciasFicheros } from '../adaptadores/ficheros/BibliotecaDeReferenciasFicheros.js';
import { ObtenedorEnlacesHttp } from '../adaptadores/enlaces/ObtenedorEnlacesHttp.js';
import { anadirCaptura } from '../aplicacion/referencias/anadirCaptura.js';
import { comprobarReferencia } from '../aplicacion/referencias/comprobarReferencia.js';
import type { DepsReferencias } from '../aplicacion/referencias/dependencias.js';
import { guardarFicha } from '../aplicacion/referencias/guardarFicha.js';
import { registrarReferencia } from '../aplicacion/referencias/registrarReferencia.js';
import { RAIZ, leerConfig } from '../config.js';
import { ErrorDeUsuario } from '../dominio/errores.js';
import type { FamiliaBiblioteca } from '../dominio/referencia.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    local: { type: 'string' },
    id: { type: 'string' },
    imagen: { type: 'string' },
    enlace: { type: 'string' },
    biblioteca: { type: 'string' },
    nota: { type: 'string' },
    desde: { type: 'string' },
    referencia: { type: 'string' },
  },
});

async function principal(): Promise<void> {
  const config = leerConfig();
  const carpetaLocales = join(config.carpetaDatos, 'locales');
  const biblioteca = new BibliotecaDeReferenciasFicheros(join(RAIZ, 'conocimiento', 'referencias'), join(config.carpetaBiblioteca, 'referencias'));
  const deps: DepsReferencias = {
    piezas: new AlmacenPiezasFicheros(join(config.carpetaDatos, 'piezas')),
    locales: new AlmacenLocalesFicheros(carpetaLocales),
    referencias: new AlmacenReferenciasFicheros(carpetaLocales),
    biblioteca,
    enlaces: new ObtenedorEnlacesHttp(),
    leerArchivo: (ruta) => readFile(resolve(ruta)),
    ahora: () => new Date().toISOString(),
  };
  const orden = positionals[0];
  const local = values.local;
  const pedir = (valor: string | undefined, nombre: string) => {
    if (!valor) throw new ErrorDeUsuario(`Falta --${nombre}`);
    return valor;
  };

  switch (orden) {
    case 'registrar': {
      const base = { local: pedir(local, 'local'), id: pedir(values.id, 'id'), ...(values.nota ? { nota: values.nota } : {}) };
      const referencia = values.imagen
        ? await registrarReferencia(deps, { ...base, imagen: values.imagen })
        : values.enlace
          ? await registrarReferencia(deps, { ...base, enlace: values.enlace })
          : await registrarReferencia(deps, { ...base, deBiblioteca: pedir(values.biblioteca, 'imagen, --enlace o --biblioteca') });
      if (referencia.origen.tipo === 'ENLACE' && referencia.origen.estado === 'PIDE_CAPTURA') {
        console.log(`! No he podido leer el enlace: ${referencia.origen.motivo}.`);
        console.log(`  No invento su contenido. Sube una captura del post con: referencia captura --local ${base.local} --id ${base.id} --imagen <captura>`);
      } else {
        console.log(`✓ Referencia «${referencia.id}» guardada${referencia.ficha ? ` con su ficha (${referencia.ficha.familia} · ${referencia.ficha.titulo})` : '. Falta su ficha de análisis'}.`);
        if (referencia.origen.tipo === 'ENLACE') {
          console.log(`  Comprueba que la imagen leída del enlace es el post: ${relative(RAIZ, deps.referencias.rutaArchivo(referencia.local, referencia.id, referencia.origen.archivo ?? ''))}`);
        }
      }
      return;
    }
    case 'captura': {
      const r = await anadirCaptura(deps, { local: pedir(local, 'local'), id: pedir(values.id, 'id'), imagen: pedir(values.imagen, 'imagen') });
      console.log(`✓ Captura añadida a «${r.id}». Falta su ficha de análisis.`);
      return;
    }
    case 'ficha': {
      const ficha = JSON.parse(await readFile(resolve(pedir(values.desde, 'desde')), 'utf8')) as unknown;
      const r = await guardarFicha(deps, { local: pedir(local, 'local'), id: pedir(values.id, 'id'), ficha });
      console.log(`✓ Ficha guardada en «${r.id}»: ${r.ficha?.familia} · ${r.ficha?.titulo}`);
      return;
    }
    case 'comprobar': {
      const estado = await comprobarReferencia(deps, { local: pedir(local, 'local'), ...(values.referencia ? { referencia: values.referencia } : {}) });
      console.log(`${estado.paso.puede ? '✓' : '✖'} ${estado.paso.motivo}`);
      console.log(`  Piezas reales del local: ${estado.piezasReales} · referencia obligatoria hasta ${estado.umbral}.`);
      if (estado.propuestas.length) {
        console.log('  Familias propuestas (elige una y regístrala con --biblioteca <post>):');
        for (const f of estado.propuestas) console.log(`   ${f.id} · ${f.nombre} · posts ${f.posts.join(', ')}`);
        const destino = join(carpetaLocales, local!, 'referencias', 'propuestas.jpg');
        await fichaVisual(destino, estado.propuestas, biblioteca);
        console.log(`  Ficha visual: ${relative(RAIZ, destino)}`);
      }
      return;
    }
    case 'listar': {
      for (const r of await deps.referencias.listar(pedir(local, 'local'))) {
        const origen = r.origen.tipo === 'IMAGEN' ? (r.origen.deBiblioteca ? `biblioteca ${r.origen.deBiblioteca}` : 'imagen') : `${r.origen.plataforma} (${r.origen.estado})`;
        console.log(`${r.id} · ${origen} · ${r.ficha ? `${r.ficha.familia} ${r.ficha.titulo}` : 'sin ficha'}`);
      }
      return;
    }
    case 'familias': {
      for (const f of await biblioteca.familias()) console.log(`${f.id} · ${f.nombre} · ${f.posts.join(', ')} · encaja con: ${f.encajaCon.join(', ')}`);
      return;
    }
    default:
      throw new ErrorDeUsuario('Órdenes: registrar, captura, ficha, comprobar, listar, familias');
  }
}

/** Una fila por familia: su nombre, sus posts de referencia y su receta. */
async function fichaVisual(destino: string, familias: FamiliaBiblioteca[], biblioteca: BibliotecaDeReferenciasFicheros): Promise<void> {
  const W = 240;
  const H = 300;
  const ancho = 24 + 4 * (W + 16) + 520;
  const capas: OverlayOptions[] = [];
  let y = 24;
  const escapar = (t: string) => t.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c);
  for (const familia of familias) {
    capas.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="40"><text x="24" y="30" font-family="Helvetica" font-weight="bold" font-size="26" fill="#111">${escapar(`${familia.id} · ${familia.nombre}`)}</text></svg>`), left: 0, top: y });
    y += 44;
    for (const [i, post] of familia.posts.slice(0, 4).entries()) {
      capas.push({ input: await sharp(biblioteca.rutaImagen(post)).resize(W, H).toBuffer(), left: 24 + i * (W + 16), top: y });
    }
    const lineas = partir(familia.receta, 46);
    const texto = lineas.map((l, i) => `<text x="0" y="${22 + i * 26}" font-family="Helvetica" font-size="19" fill="#333">${escapar(l)}</text>`).join('');
    capas.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="${H}">${texto}</svg>`), left: 24 + 4 * (W + 16), top: y });
    y += H + 32;
  }
  await mkdir(dirname(destino), { recursive: true });
  await sharp({ create: { width: ancho, height: y, channels: 3, background: '#f4f2ee' } }).composite(capas).jpeg({ quality: 86 }).toFile(destino);
}

function partir(texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    if ((actual + ' ' + palabra).trim().length > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else actual = (actual + ' ' + palabra).trim();
  }
  if (actual) lineas.push(actual);
  return lineas;
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof ErrorDeUsuario && error.detalles.length) for (const d of error.detalles) console.error(`  · ${d}`);
  process.exitCode = 1;
});
