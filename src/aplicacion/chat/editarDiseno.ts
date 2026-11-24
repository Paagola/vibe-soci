import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import sharp from 'sharp';
import { exigirTomaNueva } from '../../adaptadores/imagen/copiaDeReferencia.js';
import { AlmacenDisenosFicheros } from '../../adaptadores/ficheros/AlmacenDisenosFicheros.js';
import type { Pieza } from '../../dominio/chat.js';
import { aplicarEdicion, type EdicionDeCapas } from '../../dominio/diseno/edicionChat.js';
import { Intencion, type Tokens } from '../../dominio/diseno/intencion.js';
import { nombreDeCapa, type Resuelto } from '../../dominio/diseno/resuelto.js';
import { rectDeCaja, type Rect } from '../../dominio/diseno/reticula.js';
import type { ActivoDisponible, Compositor } from '../../puertos/Compositor.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';

type Lamina = Pieza['diapositivas'][number];
export interface EncargoEdicion {
  lamina: Lamina;
  /** Resuelve solo archivos de esta conversación. */
  ruta(archivo: string): string;
  local: string;
  tokens: Tokens;
  /** Carpeta relativa nueva por revisión y lámina. */
  carpeta: string;
  pedido: string;
  conChips: boolean;
}
export type EditorDeDiseno = (o: EncargoEdicion) => Promise<{ lamina: Lamina; costeUsd: number }>;

type DepsEdicion = {
  activos: AlmacenActivos;
  compositor: Compositor;
  fuentes: string[];
  dirigir(o: { pedido: string; png: string; intencion: Intencion; conChips: boolean; fuentes: string[] }): Promise<EdicionDeCapas>;
  chip(local: string, clave: string, descripcion: string): Promise<{ activo: ActivoDisponible; costeUsd: number }>;
};

/** Revalida la procedencia de toda la entrega, incluidas las láminas heredadas que volverán a verse sin cambios. */
export async function comprobarFotosEdicion(activos: AlmacenActivos, local: string, laminas: Lamina[], referencias: string[]) {
  for (const id of new Set(laminas.map((l) => l.foto))) {
    if (!id) throw new Error('La entrega archivada contiene una lámina sin origen fotográfico verificable.');
    const foto = await activos.obtener(local, id);
    if (foto.activo.tipo !== 'GENERADO') throw new Error('Esta entrega antigua contiene la foto de referencia. Pide una toma nueva para esa lámina.');
    await exigirTomaNueva(foto.ruta, referencias);
  }
}

/** En entregas anteriores se guardaban las pasadas en disco, sin puntero a la que ganó. Se identifica por sus PNG. */
async function documentoEntregado(o: EncargoEdicion, png: string): Promise<string | undefined> {
  if (o.lamina.intencion) return o.ruta(o.lamina.intencion);
  if (o.lamina.soloFoto) return;
  const pieza = dirname(png);
  const entregada = await readFile(png);
  const capas = await Promise.all(o.lamina.capas.map(async (p) => ({ nombre: basename(p), bytes: await readFile(o.ruta(p)) })));
  const pasadas = (await readdir(pieza, { withFileTypes: true })).filter((d) => d.isDirectory() && (d.name === `d${o.lamina.n}` || d.name.startsWith(`d${o.lamina.n}-`)));
  for (const pasada of pasadas) {
    const raiz = join(pieza, pasada.name);
    const archivos = await readdir(raiz, { recursive: true });
    for (const ruta of archivos.filter((p) => basename(p) === 'intencion.json')) {
      const doc = join(raiz, ruta);
      const version = dirname(doc);
      if ((await readFile(join(version, 'diseno.png')).catch(() => undefined))?.equals(entregada)) return doc;
      if (!capas.length) continue;
      const nombres = await readdir(join(version, 'capas')).catch(() => [] as string[]);
      if (nombres.length === capas.length && nombres.every((n) => capas.some((c) => c.nombre === n))) {
        let identicas = true;
        for (const c of capas) if (!(await readFile(join(version, 'capas', c.nombre))).equals(c.bytes)) { identicas = false; break; }
        if (identicas) return doc;
      }
    }
  }
  throw new Error('No encuentro las capas que corresponden a esta versión archivada. Se conserva la entrega original.');
}

/** Conserva el acabado aprobado en los píxeles que el parche local dejó intactos. */
async function conservarAcabado(visible: string, limpio: string, nuevo: Buffer) {
  const rgb = (entrada: string | Buffer) => sharp(entrada).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [final, antes, despues] = await Promise.all([rgb(visible), rgb(limpio), rgb(nuevo)]);
  if (final.info.width !== antes.info.width || final.info.height !== antes.info.height || final.data.length !== despues.data.length) throw new Error('Las dimensiones del diseño archivado han cambiado.');
  if (final.data.equals(antes.data)) return nuevo;
  for (let i = 0; i < despues.data.length; i += 3) {
    if (despues.data[i] === antes.data[i] && despues.data[i + 1] === antes.data[i + 1] && despues.data[i + 2] === antes.data[i + 2]) {
      final.data.copy(despues.data, i, i, i + 3);
    }
  }
  return sharp(despues.data, { raw: despues.info }).png().toBuffer();
}

function exceso(caja: Rect, zona: Rect) {
  return [zona.x - caja.x, zona.y - caja.y, caja.x + caja.w - zona.x - zona.w, caja.y + caja.h - zona.y - zona.h].map(n => Math.max(0, n));
}

function textosFueraDeMargen(resuelto: Resuelto, anterior?: Resuelto) {
  const problemasPrevios = anterior?.problemas ?? [];
  return resuelto.capas.flatMap(capa => {
    if (capa.tipo !== 'texto') return [];
    const errores = resuelto.problemas.filter(p => p.capa === capa.id && p.gravedad === 'ERROR' && (p.tipo === 'ZONA_SEGURA' || p.tipo === 'LETRA_PERDIDA'));
    if (!errores.length) return [];
    const zona = capa.sangrado ? { x: 0, y: 0, w: resuelto.lienzo.ancho, h: resuelto.lienzo.alto } : resuelto.zonaSegura;
    const original = anterior?.capas.find(c => c.id === capa.id);
    if (original?.tipo === 'texto' && errores.every(e => problemasPrevios.some(p =>
      p.capa === capa.id && p.gravedad === 'ERROR' && p.tipo === e.tipo && (e.tipo !== 'LETRA_PERDIDA' || p.mensaje === e.mensaje)))) {
      const antes = exceso(original.caja, zona);
      if (exceso(capa.caja, zona).every((v, i) => v <= antes[i]! + 0.5)) return [];
    }
    return [{ id: capa.id, tinta: capa.caja, zona }];
  });
}

function limites(r: Rect) {
  return `x ${Math.round(r.x)}–${Math.round(r.x + r.w)}, y ${Math.round(r.y)}–${Math.round(r.y + r.h)} px`;
}

/** Desplaza solo las letras que el cambio ha sacado de su margen. El sangrado intencionado admite el borde del lienzo. */
async function resolverEdicion(compositor: Compositor, base: Intencion, intencion: Intencion, activos: Record<string, ActivoDisponible>) {
  let resuelto = await compositor.resolver(intencion, activos);
  if (!textosFueraDeMargen(resuelto).length) return resuelto;
  const original = await compositor.resolver(base, activos);
  const afectadas = textosFueraDeMargen(resuelto, original);
  if (!afectadas.length) return resuelto;
  const { ancho, alto } = resuelto.lienzo;
  for (const { id, tinta, zona } of afectadas) {
    const capa = intencion.capas.find(c => c.id === id);
    if (capa?.tipo !== 'texto') continue;
    const caja = rectDeCaja(capa.caja, resuelto.lienzo, intencion.reticula);
    const x = Math.max(zona.x, Math.min(tinta.x, zona.x + zona.w - tinta.w));
    const y = Math.max(zona.y, Math.min(tinta.y, zona.y + zona.h - tinta.h));
    capa.caja = { x: (caja.x + x - tinta.x) / ancho, y: (caja.y + y - tinta.y) / alto, w: caja.w / ancho, h: caja.h / alto };
  }
  resuelto = await compositor.resolver(intencion, activos);
  const pendientes = textosFueraDeMargen(resuelto, original);
  if (pendientes.length) {
    const medidas = pendientes.map(p => `«${p.id}» ocupa ${limites(p.tinta)} y el espacio disponible es ${limites(p.zona)}.`).join(' ');
    throw new Error(`He conservado la versión anterior porque el texto no cabe con estas medidas. ${medidas}`);
  }
  return resuelto;
}

export function crearEditorDeDiseno(d: DepsEdicion): EditorDeDiseno {
  return async (o) => {
    const l = o.lamina;
    if (!l.png || !l.foto) throw new Error('Esta lámina carece de una fotografía entregada.');
    const png = o.ruta(l.png);
    const foto = await d.activos.obtener(o.local, l.foto);
    if (foto.activo.tipo !== 'GENERADO') throw new Error('Esta entrega antigua contiene la foto de referencia. Pide una toma nueva para esa lámina.');
    const documento = await documentoEntregado(o, png);
    const fondoPlano = l.fondoPlano ?? (!documento ? l.png : undefined);
    const base = documento ? Intencion.parse(JSON.parse(await readFile(documento, 'utf8'))) : Intencion.parse({
      esquema: 'diseno/intencion@1', id: 'lamina', titulo: 'Fotografía', marca: o.local, tokens: o.tokens,
      activos: { foto: l.foto }, capas: [{ id: 'foto', tipo: 'imagen', activo: 'foto', caja: { x: 0, y: 0, w: 1, h: 1 } }],
    });
    if (base.marca !== o.local || !Object.values(base.activos).includes(l.foto)) throw new Error('Las capas archivadas no corresponden al activo de esta lámina.');
    const parche = await d.dirigir({ pedido: o.pedido, png, intencion: base, conChips: o.conChips, fuentes: d.fuentes });
    if (!o.conChips && parche.chips.length) throw new Error('La edición solicitada es de diseño. El director intentó añadir una imagen de pago.');
    if (o.conChips && !parche.chips.length) throw new Error('El director no indicó cómo dibujar la imagen secundaria solicitada.');
    // Valida todo el parche antes de encargar ninguna imagen de pago.
    const intencion = aplicarEdicion(base, parche, Object.fromEntries(parche.chips.map((c) => [c.id, c.id])));
    const disponibles: Record<string, ActivoDisponible> = {};
    for (const [papel, id] of Object.entries(base.activos)) disponibles[papel] = await d.activos.obtener(o.local, id);
    if (fondoPlano && disponibles.foto) {
      // El recorte de la foto sola (attention) ya fue aprobado. Se usa su raster exacto como capa de fondo.
      const ruta = o.ruta(fondoPlano);
      const bytes = await readFile(ruta);
      const meta = await sharp(bytes).metadata();
      disponibles.foto = { activo: { ...foto.activo, ancho: meta.width!, alto: meta.height!, sha256: createHash('sha256').update(bytes).digest('hex') }, ruta };
    }
    let costeUsd = 0;
    for (const c of parche.chips) {
      const r = await d.chip(o.local, `${o.carpeta}/${c.id}`, c.descripcion);
      disponibles[c.id] = r.activo;
      intencion.activos[c.id] = r.activo.activo.id;
      costeUsd += r.costeUsd;
    }
    const resuelto = await resolverEdicion(d.compositor, base, intencion, disponibles);
    const render = await d.compositor.renderizar(resuelto, disponibles);
    const raiz = o.ruta(o.carpeta);
    const archivo = await new AlmacenDisenosFicheros(raiz).guardar('editable', intencion, resuelto, render);
    const relativa = (p: string) => join(o.carpeta, relative(raiz, p));
    const final = documento ? await conservarAcabado(png, join(dirname(documento), 'diseno.png'), render.png) : render.png;
    await mkdir(raiz, { recursive: true });
    await writeFile(join(raiz, 'final.png'), final);
    await sharp(final).resize(540).jpeg({ quality: 84 }).toFile(join(raiz, 'movil.jpg'));
    return {
      costeUsd,
      lamina: {
        ...l, soloFoto: false, ...(fondoPlano ? { fondoPlano } : {}), png: join(o.carpeta, 'final.png'), movil: join(o.carpeta, 'movil.jpg'),
        intencion: relativa(join(archivo.carpeta, 'intencion.json')), capas: render.capas.map((c) => relativa(join(archivo.carpeta, 'capas', nombreDeCapa(c)))),
        problemas: resuelto.problemas.filter((p) => p.gravedad === 'ERROR').map((p) => p.mensaje),
      },
    };
  };
}
