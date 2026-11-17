import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { escribirJsonAtomico } from '../../adaptadores/ficheros/escribirJsonAtomico.js';
import type { BriefDelEncargo } from '../../dominio/brief.js';
import { Intencion } from '../../dominio/diseno/intencion.js';
import { contraste } from '../../dominio/diseno/color.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import type { PiezaCompuesta } from '../../puertos/ComponedorDePiezas.js';
import { leerPlan, rutasDeIntencion } from '../post/consultasPost.js';
import type { DepsPost } from '../post/ordenPost.js';
import { comprobarEdicionEditorial } from './componerEditorial.js';
import { CriticaEditorial, esquemaDeCriticaEditorial, type CorreccionEditorial } from './criticaEditorial.js';

const Incidencias = CriticaEditorial.shape.incidencias;
const VersionVista = z.object({ id: z.string(), version: z.int().positive(), sha256: z.string() });
const Informe = z.object({ huella: z.string(), briefVersion: z.int(), paginas: z.array(VersionVista), modelo: z.string(), incidencias: Incidencias });
const Cambio = z.object({ id: z.string(), desde: z.int(), hasta: z.int() });
const Versiones = z.array(z.object({ id: z.string(), version: z.int() }));
const Devolucion = z.object({ anteriores: Versiones, siguientes: Versiones, cambios: z.array(Cambio), intenciones: z.array(Intencion) });
const RevisionEntrega = z.object({
  modelo: z.string(), huella: z.string(), estado: z.enum(['APROBADA', 'CORREGIDA', 'REVISION_HUMANA']),
  incidencias: Incidencias, correcciones: z.array(Cambio),
});
export type RevisionEntrega = z.infer<typeof RevisionEntrega>;

async function leer<T>(ruta: string, esquema: z.ZodType<T>): Promise<T | undefined> {
  try { return esquema.parse(JSON.parse(await readFile(ruta, 'utf8'))); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function leerRevisionEntrega(carpeta: string) {
  return leer(join(carpeta, 'revision-editorial.json'), RevisionEntrega);
}

function corregirPagina(base: Intencion, correccion: CorreccionEditorial): Intencion | undefined {
  const nueva = structuredClone(base);
  switch (correccion.tipo) {
    case 'REVISION_HUMANA': return undefined;
    case 'AJUSTAR_RECORTE': {
      const foto = nueva.capas.find(c => c.tipo === 'imagen');
      if (!foto || !base.id.startsWith('detalle-')) return undefined;
      foto.enfoque = correccion.enfoque;
      foto.zoom = correccion.zoom;
      break;
    }
    case 'AJUSTAR_MARGEN': {
      const textos = nueva.capas.filter(c => c.tipo === 'texto' && 'x' in c.caja);
      if (!textos.length) return undefined;
      for (const texto of textos) {
        if (texto.tipo === 'texto' && 'x' in texto.caja) Object.assign(texto.caja, { x: correccion.margen, w: 1 - 2 * correccion.margen });
      }
      break;
    }
    case 'AJUSTAR_TAMANO':
    case 'MEJORAR_CONTRASTE': {
      const texto = nueva.capas.find(c => c.tipo === 'texto' && c.id === `dato-${correccion.dato}`);
      if (texto?.tipo !== 'texto' || !('h' in texto.caja)) return undefined;
      if (correccion.tipo === 'AJUSTAR_TAMANO') {
        texto.caja.h = Math.min(1 - texto.caja.y, texto.caja.h * correccion.factor);
        if (texto.tamano) texto.tamano *= correccion.factor;
      } else {
        const campo = nueva.capas.find(c => c.id === 'campo' && c.tipo === 'forma');
        if (campo?.tipo !== 'forma' || !campo.color?.startsWith('#')) return undefined;
        texto.color = contraste(campo.color, '#FFFFFF') >= contraste(campo.color, '#000000') ? '#FFFFFF' : '#000000';
      }
      break;
    }
  }
  if (JSON.stringify(nueva.capas) === JSON.stringify(base.capas)) return undefined;
  return Intencion.parse({ ...nueva, version: base.version + 1, padre: base.version });
}

const sha = (datos: Buffer | string) => createHash('sha256').update(datos).digest('hex');
const vista = (ruta: string) => sharp(ruta).rotate().resize(800, 960, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();

/** Una crítica por conjunto de píxeles/versiones. La devolución sólo cambia intenciones identificadas por el crítico. */
export async function revisarEntrega(deps: DepsPost, e: EncargoPost, brief: BriefDelEncargo, pieza: PiezaCompuesta): Promise<'COMPONER' | RevisionEntrega> {
  const critico = deps.criticoEditorial;
  if (!critico) throw new ErrorDeUsuario('Falta el crítico editorial para revisar la entrega.');
  const carpeta = join(deps.proyectos, e.proyecto);
  const archivoPlan = await leerPlan(deps, e.proyecto);
  const rutas = pieza.diapositivas.map((_, i) => join(carpeta, rutasDeIntencion(deps, e.proyecto, archivoPlan, i).final));
  const actuales = await Promise.all(rutas.map(ruta => readFile(ruta, 'utf8').then(s => Intencion.parse(JSON.parse(s)))));
  const versiones = pieza.diapositivas.map(({ id, version }) => ({ id, version }));
  if (actuales.some((p, i) => p.id !== versiones[i]?.id || p.version !== versiones[i]?.version)) throw new ErrorDeUsuario('La composición cambió durante la revisión.');
  const carpetaCriticas = join(carpeta, 'criticas');
  await mkdir(carpetaCriticas, { recursive: true });

  // La devolución completa se escribe antes de aplicar su primera página. Tras un corte se terminan solo las pendientes.
  const rutaDevolucion = join(carpetaCriticas, 'devolucion.json');
  const previa = await leer(rutaDevolucion, Devolucion);
  const segundaLectura = previa && previa.siguientes.length === versiones.length && versiones.every((p, i) =>
    p.id === previa.siguientes[i]?.id && (p.version === previa.siguientes[i]?.version || p.version === previa.anteriores[i]?.version));
  if (previa && segundaLectura) {
    let aplicada = false;
    for (const intencion of previa.intenciones) {
      const i = actuales.findIndex(p => p.id === intencion.id);
      if (actuales[i]?.version === intencion.padre) {
        await escribirJsonAtomico(rutas[i]!, intencion);
        aplicada = true;
      }
    }
    if (aplicada) return 'COMPONER';
  }

  const paginas = await Promise.all(pieza.diapositivas.map(async ({ id, version, png }) => ({ id, version, bytes: await vista(png) })));
  const vistas = paginas.map(({ id, version, bytes }) => ({ id, version, sha256: sha(bytes) }));
  const huella = sha(JSON.stringify([brief.version, e.fotoElegida, vistas]));
  const archivo = join(carpetaCriticas, huella + '.json');
  let informe = await leer(archivo, Informe);
  if (!informe) {
    const originales = await Promise.all([...new Set([e.activoReal!, e.fotoElegida!])].map(async id => ({
      id, bytes: await vista((await deps.activos.obtener(e.local, id)).ruta),
    })));
    const referencia = brief.editorial;
    const entrada = { brief, paginas, originales, ...(referencia?.referencia && referencia.fichaSha256
      ? { referencia: { id: referencia.referencia, huella: referencia.fichaSha256, ficha: referencia.fichaReferencia } } : {}) };
    const resultado = esquemaDeCriticaEditorial(entrada).parse(await critico.revisar(entrada));
    // La lectura puede tardar; un cambio en disco hace caducar las sugerencias antes de tocar las intenciones.
    for (const [i, ruta] of rutas.entries()) {
      const vigente = Intencion.parse(JSON.parse(await readFile(ruta, 'utf8')));
      if (JSON.stringify(vigente) !== JSON.stringify(actuales[i])) throw new ErrorDeUsuario('Una página cambió durante la crítica. Revisa su nueva versión.');
    }
    informe = { huella, briefVersion: brief.version, modelo: critico.modelo, paginas: vistas, incidencias: resultado.incidencias };
    await escribirJsonAtomico(archivo, informe);
  }
  if (informe.incidencias.length && !segundaLectura) {
    const intenciones: Intencion[] = [];
    for (const incidencia of informe.incidencias) {
      const base = actuales.find(p => p.id === incidencia.id && p.version === incidencia.version);
      if (!base) throw new ErrorDeUsuario('El crítico se refiere a una versión anterior.');
      const intencion = corregirPagina(base, incidencia.correccion);
      if (!intencion) continue;
      comprobarEdicionEditorial(intencion, e, brief);
      intenciones.push(intencion);
    }
    if (intenciones.length) {
      const cambios = intenciones.map(p => ({ id: p.id, desde: p.padre!, hasta: p.version }));
      const siguientes = versiones.map(p => ({ ...p, version: cambios.find(c => c.id === p.id)?.hasta ?? p.version }));
      await escribirJsonAtomico(rutaDevolucion, { anteriores: versiones, siguientes, intenciones, cambios });
      for (const intencion of intenciones) await escribirJsonAtomico(rutas[actuales.findIndex(p => p.id === intencion.id)]!, intencion);
      return 'COMPONER';
    }
  }
  const correcciones = segundaLectura ? previa.cambios : [];
  const estado = informe.incidencias.length ? 'REVISION_HUMANA' : correcciones.length ? 'CORREGIDA' : 'APROBADA';
  const revision = { huella, modelo: informe.modelo, estado, incidencias: informe.incidencias, correcciones } satisfies RevisionEntrega;
  await escribirJsonAtomico(join(carpeta, 'revision-editorial.json'), revision);
  return revision;
}
