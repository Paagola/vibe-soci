/**
 * La estética de referencia de cada pieza del chat. Antes de planificar un post o un carrusel se juntan candidatas de
 * cuatro sitios y el cliente elige una (o deja que decida el director):
 * - Pinterest: dos o tres búsquedas sobre lo pedido. Hydrogen mira las miniaturas y se queda con los posts diseñados que
 *   enseñan oficio (descarta fotos sueltas, mockups y marcas de agua).
 * - Del local: sus piezas ya hechas en el chat, los encargos exportados y las referencias que tiene registradas.
 * - Biblioteca: los posts de referencia del estudio (biblioteca/referencias) que mejor casan con el plato.
 * - Corpus: piezas anotadas de referencias-pinterest/diseno-visual del tipo de local.
 * Todo se copia a la carpeta de la conversación. Lo de Pinterest solo se usa como listón de oficio y nunca se publica.
 */
import { copyFile, readdir, readFile, rm, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { z } from 'zod';
import { PinterestPublico, type PinDePinterest } from '../adaptadores/referencias/PinterestPublico.js';
import type { ClienteGemini, ParteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import type { DepsChat, LocalDelChat } from '../aplicacion/chat/servicioChat.js';
import { carpetaDelLocal, elegirReferencias, type PiezaDeReferencia } from '../dominio/arte/referencias.js';
import type { CandidataDeReferencia } from '../dominio/chat.js';

type Buscar = NonNullable<DepsChat['buscarReferencias']>;
type Entrada = Parameters<Buscar>[0];

const existe = (r: string) => stat(r).then(() => true, () => false);
const normal = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Si el director no propuso búsquedas, unas razonables a partir del plato y el formato. */
export function consultasPorDefecto(o: { plato: string; formato: string; tipoDeLocal: string }): string[] {
  const plato = o.plato.replace(/[«»"]/g, '').slice(0, 50);
  return [`${plato} poster design typography`, `${o.tipoDeLocal} instagram post graphic design`, o.formato === 'carrusel' ? `food carousel instagram design ${plato}` : `food social media post design ${plato}`];
}

const Elegida = z.preprocess(
  (x) => (typeof x === 'number' ? { n: x } : x && typeof x === 'object' ? { n: Number((x as Record<string, unknown>).n ?? (x as Record<string, unknown>).numero ?? (x as Record<string, unknown>).indice ?? (x as Record<string, unknown>).id), motivo: (x as Record<string, unknown>).motivo ?? (x as Record<string, unknown>).razon ?? '' } : x),
  z.object({ n: z.number().int().min(1), motivo: z.string().transform((t) => t.slice(0, 300)) }),
);
/** {"elegidas":[{"n":3,"motivo":"…"}]}; se aceptan también la lista sola o la lista bajo otra clave. */
const Curado = z.preprocess(
  (x) => (Array.isArray(x) ? { elegidas: x } : x && typeof x === 'object' && !('elegidas' in x) ? { elegidas: Object.values(x).find(Array.isArray) ?? [] } : x),
  z.object({ elegidas: z.array(Elegida).transform((l) => l.slice(0, 8)) }),
);

const INSTRUCCIONES_CURADOR = `Eres el director de arte de un estudio que diseña posts de Instagram para restaurantes. Te paso miniaturas
numeradas de una búsqueda de Pinterest. Elige las que sirvan de LISTÓN DE OFICIO para la pieza que te describo:
- Sí: posts o carteles DISEÑADOS (foto o ilustración con tipografía compuesta, jerarquía clara, una idea gráfica).
- No: fotos sueltas sin diseño, mockups de móvil o de mano, collages de varias piezas, capturas con interfaz, marcas de agua,
  plantillas genéricas de banco de imágenes, texto ilegible o en exceso, nada que no sea comida o bebida.
- Prefiere variedad: que no sean todas la misma solución gráfica.
- En «motivo», en español y en una frase, qué decisión de oficio enseña (composición, tipografía, color, recurso). No describas el plato.
Ordena de mejor a peor. Como mucho 6. Si ninguna vale, devuelve la lista vacía.
Responde SOLO este JSON: {"elegidas":[{"n":3,"motivo":"…"}]} (n es el número de la miniatura).`;

export function crearBuscadorDeReferencias(d: {
  raiz: string;
  datos: string;
  locales: () => Promise<LocalDelChat[]>;
  corpus: { piezas: PiezaDeReferencia[]; ruta: (archivo: string) => string };
  cliente?: Pick<ClienteGemini, 'generarJson'>;
  pinterest?: Pick<PinterestPublico, 'buscar' | 'descargar'>;
}): Buscar {
  const pinterest = d.pinterest ?? new PinterestPublico();

  return async (o: Entrada, progreso) => {
    const local = (await d.locales()).find((l) => l.slug === o.local);
    const tipoDeLocal = local?.marca.descripcion || 'restaurant';
    const consultas = (o.consultas.length ? o.consultas : consultasPorDefecto({ plato: o.plato, formato: o.formato, tipoDeLocal: 'restaurant' })).slice(0, 3);
    const candidatas: CandidataDeReferencia[] = [];
    const copiar = async (origen: CandidataDeReferencia['origen'], ruta: string, titulo: string, motivo?: string, enlace?: string) => {
      const n = candidatas.length + 1;
      const nombre = `${origen}-${String(n).padStart(2, '0')}${extname(ruta).toLowerCase() || '.jpg'}`;
      await copyFile(ruta, join(o.destino, nombre));
      candidatas.push({ id: `${origen}-${n}`, origen, archivo: `${o.prefijo}/${nombre}`, titulo: titulo.slice(0, 200), ...(motivo ? { motivo: motivo.slice(0, 400) } : {}), ...(enlace ? { enlace } : {}) });
    };

    // 1. Pinterest.
    const pins: PinDePinterest[] = [];
    for (const q of consultas) {
      progreso(`Pinterest: «${q}»…`);
      try {
        for (const p of await pinterest.buscar(q, 25)) if (!pins.some((x) => x.id === p.id) && p.alto >= p.ancho * 0.9) pins.push(p);
      } catch (error) {
        progreso(`Pinterest no respondió a «${q}»: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const muestra = pins.slice(0, 30);
    const miniaturas: Array<{ pin: PinDePinterest; bytes: Buffer }> = [];
    await Promise.all(
      muestra.map(async (pin) => {
        const ruta = join(o.destino, `.mini-${pin.id}.jpg`);
        try {
          await pinterest.descargar(pin.miniatura, ruta);
          miniaturas.push({ pin, bytes: await readFile(ruta) });
        } catch {
          /* una miniatura que no baja no importa */
        }
      }),
    );
    miniaturas.sort((a, b) => muestra.indexOf(a.pin) - muestra.indexOf(b.pin));
    let elegidos: Array<{ pin: PinDePinterest; motivo?: string }> = [];
    if (miniaturas.length && d.cliente) {
      progreso(`El director mira ${miniaturas.length} resultados de Pinterest…`);
      try {
        const partes: ParteGemini[] = [{ text: `PIEZA: ${o.formato} de «${o.plato}» para ${local?.marca.nombre ?? o.local} (${tipoDeLocal}). ${o.indicaciones ? `Indicaciones: ${o.indicaciones}` : ''}` }];
        miniaturas.forEach((m, i) => partes.push({ text: `Nº ${i + 1}` }, { inlineData: { mimeType: 'image/jpeg', data: m.bytes.toString('base64') } }));
        const r = await d.cliente.generarJson(INSTRUCCIONES_CURADOR, partes, Curado);
        elegidos = r.elegidas.flatMap((e) => (miniaturas[e.n - 1] ? [{ pin: miniaturas[e.n - 1]!.pin, motivo: e.motivo }] : [])).filter((e, i, a) => a.findIndex((x) => x.pin.id === e.pin.id) === i).slice(0, 6);
      } catch (error) {
        progreso(`El director no pudo filtrar: me quedo con los primeros (${error instanceof Error ? error.message.slice(0, 120) : String(error)}).`);
        elegidos = miniaturas.slice(0, 6).map((m) => ({ pin: m.pin }));
      }
    } else {
      elegidos = miniaturas.slice(0, 6).map((m) => ({ pin: m.pin }));
    }
    if (elegidos.length) progreso(`Descargo ${elegidos.length} de Pinterest en grande…`);
    for (const e of elegidos) {
      const ruta = join(o.destino, `.grande-${e.pin.id}.jpg`);
      try {
        await pinterest.descargar(e.pin.grande, ruta);
        await copiar('pinterest', ruta, e.pin.titulo || 'Pin de Pinterest', e.motivo, e.pin.enlace);
      } catch {
        /* sigue con el resto */
      }
    }

    // 2. Del local: piezas del chat, encargos exportados y referencias registradas.
    progreso('Busco posts anteriores del local…');
    const delLocal: Array<{ ruta: string; titulo: string; motivo: string }> = o.anteriores.map((a) => ({ ruta: a.ruta, titulo: a.titulo, motivo: 'Ya hecha para este local en el chat.' }));
    const proyectos = join(d.raiz, 'proyectos');
    for (const p of (await readdir(proyectos).catch(() => [] as string[])).sort().reverse()) {
      if (delLocal.length >= 8) break;
      try {
        const post = JSON.parse(await readFile(join(proyectos, p, 'post.json'), 'utf8')) as { local?: string; plato?: { nombre?: string } | string };
        if (post.local !== o.local) continue;
        const versiones = (await readdir(join(d.datos, 'disenos', p, 'post')).catch(() => [] as string[])).filter((v) => /^v\d+$/.test(v)).sort().reverse();
        for (const v of versiones) {
          const ruta = join(d.datos, 'disenos', p, 'post', v, 'exportadas', '4x5.jpg');
          if (await existe(ruta)) {
            const plato = typeof post.plato === 'string' ? post.plato : (post.plato?.nombre ?? p.replace(/^\d{4}-\d{2}-\d{2}-/, '').replaceAll('-', ' '));
            delLocal.push({ ruta, titulo: `Encargo · ${plato}`, motivo: 'Encargo editorial ya entregado para este local.' });
            break;
          }
        }
      } catch {
        /* proyecto sin post.json válido */
      }
    }
    const registradas = join(d.datos, 'locales', o.local, 'referencias');
    for (const r of await readdir(registradas).catch(() => [] as string[])) {
      if (delLocal.length >= 10) break;
      const imagen = join(registradas, r, 'imagen.jpg');
      if (!(await existe(imagen))) continue;
      const ficha = await readFile(join(registradas, r, 'referencia.json'), 'utf8').then((t) => JSON.parse(t) as { ficha?: { titulo?: string; familia?: string } }, () => undefined);
      delLocal.push({ ruta: imagen, titulo: ficha?.ficha?.titulo ? `Referencia · ${ficha.ficha.titulo}` : `Referencia · ${r}`, motivo: `Referencia ya registrada para el local${ficha?.ficha?.familia ? ` (familia ${ficha.ficha.familia})` : ''}.` });
    }
    for (const x of delLocal.slice(0, 8)) await copiar('local', x.ruta, x.titulo, x.motivo).catch(() => {});

    // 3. Biblioteca del estudio: por palabras del plato.
    const palabras = new Set(normal(`${o.plato} ${o.elementos.join(' ')} ${o.indicaciones}`).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2));
    const indice = await readFile(join(d.raiz, 'biblioteca', 'referencias', 'indice.json'), 'utf8').then((t) => JSON.parse(t) as { referencias?: Array<{ archivo: string; palabras?: string[]; tratamiento?: string; descripcion?: string }> }, () => ({ referencias: [] }));
    const biblioteca = (indice.referencias ?? [])
      .map((r, orden) => ({ r, orden, puntos: (r.palabras ?? []).filter((w) => palabras.has(normal(w))).length }))
      .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden);
    const tratamientos = new Set<string>();
    let deBiblioteca = 0;
    for (const { r } of biblioteca) {
      if (deBiblioteca >= 3) break;
      if (r.tratamiento && tratamientos.has(r.tratamiento)) continue;
      const ruta = join(d.raiz, 'biblioteca', 'referencias', r.archivo);
      if (!(await existe(ruta))) continue;
      await copiar('biblioteca', ruta, `Biblioteca · ${r.archivo.replace(/\.\w+$/, '')}`, r.descripcion);
      if (r.tratamiento) tratamientos.add(r.tratamiento);
      deBiblioteca++;
    }

    // 4. Corpus anotado del estudio.
    const delCorpus = elegirReferencias(d.corpus.piezas, { carpetas: carpetaDelLocal(tipoDeLocal), n: 3, semilla: `${o.local}-${o.plato}-${o.prefijo}` });
    if (o.formato === 'carrusel') delCorpus.unshift(...d.corpus.piezas.filter((p) => p.carpeta === 'carruseles').slice(0, 2));
    for (const p of delCorpus.slice(0, 4)) {
      const ruta = d.corpus.ruta(p.archivo);
      if (await existe(ruta)) await copiar('estudio', ruta, `Estudio · ${p.contiene}`, p.decision).catch(() => {});
    }

    // Las miniaturas y descargas de trabajo sobran.
    for (const f of await readdir(o.destino).catch(() => [] as string[])) if (f.startsWith('.mini-') || f.startsWith('.grande-')) await rm(join(o.destino, f), { force: true });
    progreso(`${candidatas.length} candidatas listas.`);
    return { consultas, candidatas };
  };
}
