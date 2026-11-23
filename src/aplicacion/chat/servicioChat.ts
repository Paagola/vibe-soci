/**
 * El chat del estudio: una conversación con el director (Hydrogen) que acaba en posts y carruseles.
 *
 * Flujo:
 *   1. El cliente escribe y sube fotos. El director mira y, si toca, propone los HECHOS del plato (tarjeta).
 *   2. El cliente corrige y confirma la tarjeta: la foto real se registra como activo del local (con su máscara).
 *   3. El director propone una pieza; el código la PLANIFICA (cada diapositiva con su foto, real o nueva, y su receta),
 *      comprueba el plan y los textos, y enseña el plan con su coste (tarjeta). Nada se gasta en imágenes todavía.
 *   4. El cliente aprueba: se generan las tomas nuevas (Nano Banana Pro con el plato real de referencia) y el estudio
 *      de arte maqueta cada diapositiva, reparando con el director lo que no cabe en la foto de verdad.
 *   5. Ajustes: «rehaz la 3 más oscura» → plan nuevo solo de esas diapositivas, que se aprueba igual.
 *
 * Todo cambio de la conversación se guarda y se avisa a quien la esté mirando (la web la recibe por SSE).
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import type { EncargoDeArte } from '../../puertos/EstudioDeArte.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { Tokens } from '../../dominio/diseno/intencion.js';
import { problemasDeTextos, type HechosDeLaPieza } from '../../dominio/diseno/propuesta.js';
import type { Marca } from '../../dominio/modelos.js';
import type { Receta } from '../../dominio/arte/receta.js';
import {
  Conversacion, costeEstimado, type CandidataDeReferencia, HechosDelPlato, problemasDePieza,
  type AccionDelDirector, type Bloque, type Esfuerzo, type Formato, type Mensaje, type Pieza, type PlanDePieza, type TurnoDelDirector,
} from '../../dominio/chat.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EntradaEstudioDeArte } from '../arte/estudioDeArte.js';
import { catalogoEnTexto, ResultadoHerramienta, type DefinicionHerramienta } from './herramientas.js';
import type { VisualCompuesto } from '../arte/pieza.js';

export interface LocalDelChat {
  slug: string;
  marca: Marca;
  tokens: Tokens;
}

export interface DepsChat {
  carpeta: string;
  ahora?: () => Date;
  locales(): Promise<LocalDelChat[]>;
  /** El director: habla, planifica y repara. */
  director?: {
    turnoDelChat(contexto: string, imagenes: Array<{ id: string; ruta: string }>): Promise<TurnoDelDirector>;
    planificarPieza(e: EncargoDeArte, o: { formato: Formato; diapositivas: number; indicaciones: string; base?: { plan: PlanDePieza; rehacer: number[] } }, devolver: string[]): Promise<PlanDePieza>;
  };
  /** Registra una foto como activo del local (con su máscara); la real, además, con su máscara principal. */
  registrarFoto(o: { local: string; id: string; ruta: string; tipo: 'REAL' | 'GENERADO'; descripcion: string; prompt?: string; modelo?: string }): Promise<ActivoDisponible>;
  /** El encargo de arte del estudio (mapa de la foto, colores, voces…), para planificar. */
  prepararEncargo(entrada: EntradaEstudioDeArte): Promise<EncargoDeArte>;
  /** Genera una toma nueva. Devuelve los bytes (PNG o JPEG) y lo que costó. */
  generarFoto(o: { id: string; prompt: string; referencias: Array<{ ruta: string; etiqueta: string }>; tamano: '1K' | '2K' }): Promise<{ bytes: Buffer; costeUsd: number; modelo: string }>;
  /** Comprueba una foto generada; devuelve el defecto si hay que repetirla. */
  defectoDeFoto?(ruta: string): Promise<string | undefined>;
  /** Maqueta un visual con su receta (y repara si hace falta, según el esfuerzo). */
  componer(entrada: EntradaEstudioDeArte, receta: Receta, esfuerzo: Esfuerzo): Promise<VisualCompuesto>;
  usdPorFoto: number;
  /**
   * Busca candidatas a estética de referencia para una pieza (Pinterest curado, corpus del estudio, biblioteca y los posts
   * anteriores del local) y las deja en `destino` (carpeta absoluta); devuelve sus rutas relativas a la conversación.
   */
  buscarReferencias?(
    o: { destino: string; prefijo: string; local: string; plato: string; elementos: string[]; indicaciones: string; formato: Formato; consultas: string[]; anteriores: Array<{ ruta: string; titulo: string }> },
    progreso: (linea: string) => void,
  ): Promise<{ consultas: string[]; candidatas: CandidataDeReferencia[] }>;
  /** Las herramientas del catálogo y quién las ejecuta. */
  herramientas?: {
    catalogo: DefinicionHerramienta[];
    ejecutar(herramienta: string, ctx: ContextoDeHerramienta, valores: Record<string, unknown>): Promise<ResultadoHerramienta>;
  };
  /** Para avisar de errores que no van a la conversación. */
  avisar?: (mensaje: string) => void;
}

/** Lo que tiene a mano una herramienta mientras corre. */
export interface ContextoDeHerramienta {
  conversacion: Conversacion;
  /** Carpeta absoluta de la conversación. */
  carpeta: string;
  /** Una carpeta propia para esta ejecución (relativa a la conversación). */
  trabajo: string;
  rutaImagen(id: string): string;
  /** Guarda un archivo de la herramienta en su carpeta de trabajo; devuelve su ruta relativa a la conversación. */
  guardar(nombre: string, datos: Buffer): Promise<string>;
  /** Añade una imagen a la conversación (para usarla después en otras herramientas o piezas); devuelve su id. */
  anadirImagen(origen: string, nombre: string): Promise<string>;
  /** La deja como referencia de la conversación (y de la ficha del plato, si la hay). */
  usarReferencia(imagen: string): Promise<void>;
  progreso(linea: string): Promise<void>;
  /** Las diapositivas producidas de una pieza (rutas absolutas). */
  diapositivasDe(pieza: string): string[];
}

type Oyente = (c: Conversacion) => void;

const id = () => randomUUID().slice(0, 8);
const ID_CONVERSACION = /^[a-z0-9][a-z0-9-]{0,80}$/;

export class ServicioChat {
  private readonly oyentes = new Map<string, Set<Oyente>>();
  private readonly colas = new Map<string, Promise<unknown>>();

  constructor(private readonly d: DepsChat) {}

  private ahora() {
    return (this.d.ahora?.() ?? new Date()).toISOString();
  }

  private carpetaDe(conversacion: string) {
    if (!ID_CONVERSACION.test(conversacion)) throw new ErrorDeUsuario('Esa conversación no existe.');
    return join(this.d.carpeta, conversacion);
  }

  /** La ruta absoluta de un archivo de la conversación (imágenes, piezas), sin salir de su carpeta. */
  rutaArchivo(conversacion: string, archivo: string): string {
    if (archivo.split('/').some((s) => s === '..' || s === '')) throw new ErrorDeUsuario('Ese archivo no existe.');
    return join(this.carpetaDe(conversacion), archivo);
  }

  /** Los locales con los que se puede trabajar (los que tienen marca y tokens). */
  async locales(): Promise<Array<{ slug: string; nombre: string; ciudad: string }>> {
    return (await this.d.locales()).map((l) => ({ slug: l.slug, nombre: l.marca.nombre, ciudad: l.marca.ciudad }));
  }

  // ------------------------------------------------------------------ Persistencia y avisos

  async listar(): Promise<Array<{ id: string; titulo: string; actualizada: string }>> {
    const ids = await readdir(this.d.carpeta).catch(() => [] as string[]);
    const todas = await Promise.all(ids.filter((x) => ID_CONVERSACION.test(x)).map((x) => this.leer(x).catch(() => undefined)));
    return todas.filter((c): c is Conversacion => Boolean(c)).map((c) => ({ id: c.id, titulo: c.titulo, actualizada: c.actualizada })).sort((a, b) => (a.actualizada < b.actualizada ? 1 : -1));
  }

  async leer(conversacion: string): Promise<Conversacion> {
    const texto = await readFile(join(this.carpetaDe(conversacion), 'conversacion.json'), 'utf8').catch(() => {
      throw new ErrorDeUsuario('Esa conversación no existe.');
    });
    return Conversacion.parse(JSON.parse(texto));
  }

  async crear(): Promise<Conversacion> {
    const ahora = this.ahora();
    const c = Conversacion.parse({ id: `${ahora.slice(0, 10)}-${id()}`, creada: ahora, actualizada: ahora });
    await mkdir(this.carpetaDe(c.id), { recursive: true });
    await this.guardar(c);
    return c;
  }

  suscribir(conversacion: string, oyente: Oyente): () => void {
    const set = this.oyentes.get(conversacion) ?? new Set();
    set.add(oyente);
    this.oyentes.set(conversacion, set);
    return () => set.delete(oyente);
  }

  private async guardar(c: Conversacion): Promise<void> {
    c.actualizada = this.ahora();
    const ruta = join(this.carpetaDe(c.id), 'conversacion.json');
    await writeFile(`${ruta}.tmp`, `${JSON.stringify(c, null, 2)}\n`);
    await rename(`${ruta}.tmp`, ruta);
    for (const o of this.oyentes.get(c.id) ?? []) o(c);
  }

  /** Cambios de una conversación en fila (nunca dos a la vez): leer, cambiar, guardar y avisar. */
  private cambiar<T>(conversacion: string, f: (c: Conversacion) => Promise<T> | T): Promise<T> {
    const anterior = this.colas.get(conversacion) ?? Promise.resolve();
    const siguiente = anterior.catch(() => {}).then(async () => {
      const c = await this.leer(conversacion);
      const r = await f(c);
      await this.guardar(c);
      return r;
    });
    this.colas.set(conversacion, siguiente);
    return siguiente;
  }

  private mensaje(rol: 'usuario' | 'asistente', texto: string, extra: Partial<Mensaje> = {}): Mensaje {
    return { id: id(), rol, fecha: this.ahora(), texto, imagenes: [], bloques: [], ...extra };
  }

  private async decir(conversacion: string, texto: string, bloques: Bloque[] = []): Promise<Mensaje> {
    return this.cambiar(conversacion, (c) => {
      const m = this.mensaje('asistente', texto, { bloques });
      c.mensajes.push(m);
      return m;
    });
  }

  // ------------------------------------------------------------------ Lo que hace el cliente

  /**
   * Un mensaje del cliente (texto e imágenes). Responde el director en segundo plano: la promesa se resuelve cuando el
   * mensaje del cliente ya está guardado; la respuesta llega por los avisos.
   */
  async enviar(conversacion: string, entrada: { texto: string; imagenes: Array<{ nombre: string; bytes: Buffer }>; formato?: Formato | 'auto'; esfuerzo?: Esfuerzo }): Promise<void> {
    if (!entrada.texto.trim() && !entrada.imagenes.length) throw new ErrorDeUsuario('Escribe algo o sube una foto.');
    const carpeta = this.carpetaDe(conversacion);
    await mkdir(join(carpeta, 'imagenes'), { recursive: true });
    const nuevas: Conversacion['imagenes'] = [];
    for (const img of entrada.imagenes.slice(0, 6)) {
      const ext = extname(img.nombre).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) throw new ErrorDeUsuario(`${img.nombre}: usa JPG, PNG o WEBP.`);
      const meta = await sharp(img.bytes).metadata().catch(() => {
        throw new ErrorDeUsuario(`${img.nombre} no es una imagen válida.`);
      });
      const idImagen = `img-${id()}`;
      const archivo = `imagenes/${idImagen}${ext === '.jpeg' ? '.jpg' : ext}`;
      await writeFile(join(carpeta, archivo), img.bytes);
      nuevas.push({ id: idImagen, archivo, nombre: img.nombre.slice(0, 120), ancho: meta.width ?? 1, alto: meta.height ?? 1 });
    }
    await this.cambiar(conversacion, (c) => {
      c.imagenes.push(...nuevas);
      c.mensajes.push(this.mensaje('usuario', entrada.texto.trim(), { imagenes: nuevas.map((i) => i.id) }));
      if (c.titulo === 'Nueva conversación') c.titulo = (entrada.texto.trim() || 'Foto del plato').slice(0, 60);
      c.pensando = true;
    });
    void this.responder(conversacion, { formato: entrada.formato ?? 'auto', esfuerzo: entrada.esfuerzo ?? 'normal' });
  }

  /** Imágenes para la conversación sin mensaje (las que se adjuntan en un formulario rápido). Devuelve sus ids. */
  async subirImagenes(conversacion: string, imagenes: Array<{ nombre: string; bytes: Buffer }>): Promise<string[]> {
    const carpeta = this.carpetaDe(conversacion);
    await mkdir(join(carpeta, 'imagenes'), { recursive: true });
    const nuevas: Conversacion['imagenes'] = [];
    for (const img of imagenes.slice(0, 6)) {
      const ext = extname(img.nombre).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) throw new ErrorDeUsuario(`${img.nombre}: usa JPG, PNG o WEBP.`);
      const meta = await sharp(img.bytes).metadata().catch(() => {
        throw new ErrorDeUsuario(`${img.nombre} no es una imagen válida.`);
      });
      const idImagen = `img-${id()}`;
      const archivo = `imagenes/${idImagen}${ext === '.jpeg' ? '.jpg' : ext}`;
      await writeFile(join(carpeta, archivo), img.bytes);
      nuevas.push({ id: idImagen, archivo, nombre: img.nombre.slice(0, 120), ancho: meta.width ?? 1, alto: meta.height ?? 1 });
    }
    await this.cambiar(conversacion, (c) => {
      c.imagenes.push(...nuevas);
    });
    return nuevas.map((i) => i.id);
  }

  /** La tarjeta de hechos: el cliente la confirma (con sus correcciones) o la descarta. */
  async responderHechos(conversacion: string, bloque: string, r: { confirmar: boolean; hechos?: unknown; formato?: Formato | 'auto'; esfuerzo?: Esfuerzo }): Promise<void> {
    const c0 = await this.leer(conversacion);
    const tarjeta = this.tarjeta(c0, bloque, 'hechos');
    if (tarjeta.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Esa tarjeta ya está respondida.');
    if (!r.confirmar) {
      await this.cambiar(conversacion, (c) => {
        this.tarjeta(c, bloque, 'hechos').estado = 'DESCARTADO';
      });
      return;
    }
    const leidos = HechosDelPlato.safeParse(r.hechos ?? tarjeta.propuesta);
    if (!leidos.success) throw new ErrorDeUsuario(`Revisa la tarjeta: ${leidos.error.issues.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`).join('; ')}`);
    const hechos = leidos.data;
    const local = (await this.d.locales()).find((l) => l.slug === hechos.local);
    if (!local) throw new ErrorDeUsuario(`No hay ningún local «${hechos.local}».`);
    const foto = c0.imagenes.find((i) => i.id === hechos.foto);
    if (!foto) throw new ErrorDeUsuario('La foto del plato no está en la conversación.');
    if (hechos.referencia && !c0.imagenes.some((i) => i.id === hechos.referencia)) throw new ErrorDeUsuario('La referencia no está en la conversación.');
    const real = await this.d.registrarFoto({ local: hechos.local, id: `chat-${conversacion}-${foto.id}`, ruta: this.rutaArchivo(conversacion, foto.archivo), tipo: 'REAL', descripcion: `Foto real de «${hechos.plato}» subida en el chat (${conversacion}).` });
    await this.cambiar(conversacion, (c) => {
      const t = this.tarjeta(c, bloque, 'hechos');
      t.estado = 'HECHO';
      t.propuesta = hechos;
      c.hechos = { ...hechos, ...(!hechos.referencia && c.referencia ? { referencia: c.referencia } : {}), activoReal: real.activo.id };
      if (hechos.referencia) c.referencia = hechos.referencia;
      c.mensajes.push(this.mensaje('usuario', `✓ Confirmo los datos del plato: ${hechos.plato}.`));
      c.pensando = true;
    });
    void this.responder(conversacion, { formato: r.formato ?? 'auto', esfuerzo: r.esfuerzo ?? 'normal', nota: 'El cliente acaba de confirmar los hechos del plato. Si ya pidió una pieza, propónla ahora.' });
  }

  /** La tarjeta del plan: el cliente lo aprueba (se produce) o lo descarta. */
  async responderPlan(conversacion: string, bloque: string, aprobar: boolean): Promise<void> {
    let pieza: Pieza | undefined;
    await this.cambiar(conversacion, (c) => {
      const t = this.tarjeta(c, bloque, 'plan');
      if (t.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Ese plan ya está respondido.');
      t.estado = aprobar ? 'HECHO' : 'DESCARTADO';
      pieza = c.piezas.find((p) => p.id === t.pieza);
      if (!pieza) throw new ErrorDeUsuario('Esa pieza no existe.');
      pieza.estado = aprobar ? 'PRODUCIENDO' : 'DESCARTADA';
      if (aprobar) {
        pieza.progreso = [];
        c.mensajes.push(this.mensaje('asistente', 'Manos a la obra.', { bloques: [{ tipo: 'progreso', id: `prog-${id()}`, pieza: pieza.id }] }));
      }
    });
    if (aprobar && pieza) void this.producir(conversacion, pieza.id);
  }

  private tarjeta<T extends 'hechos' | 'plan'>(c: Conversacion, bloque: string, tipo: T): Extract<Bloque, { tipo: T }> {
    for (const m of c.mensajes) for (const b of m.bloques) if (b.id === bloque && b.tipo === tipo) return b as Extract<Bloque, { tipo: T }>;
    throw new ErrorDeUsuario('Esa tarjeta no existe.');
  }

  // ------------------------------------------------------------------ Herramientas y encargos

  catalogo(): DefinicionHerramienta[] {
    return this.d.herramientas?.catalogo ?? [];
  }

  /** Abre una herramienta en la conversación: su formulario (con lo que ya se sepa) o, si no pide nada, la ejecuta. */
  async abrirHerramienta(conversacion: string, herramienta: string, valores: Record<string, unknown> = {}, mensaje = ''): Promise<string> {
    const def = this.catalogo().find((h) => h.id === herramienta);
    if (!def) throw new ErrorDeUsuario(`No hay ninguna herramienta «${herramienta}».`);
    const bloque = def.especial === 'encargo' ? `enc-${id()}` : `herr-${id()}`;
    const texto = mensaje || (def.especial === 'encargo' ? 'Vamos con un encargo paso a paso.' : def.campos.length ? `${def.nombre}: revisa los datos y lánzalo.` : `${def.nombre}:`);
    await this.decir(conversacion, texto, [def.especial === 'encargo' ? { tipo: 'encargo', id: bloque, ...(typeof valores.modo === 'string' ? { modo: valores.modo } : {}) } : { tipo: 'herramienta', id: bloque, herramienta, estado: 'FORMULARIO', valores, progreso: [] }]);
    if (!def.especial && !def.campos.length) await this.ejecutarHerramienta(conversacion, bloque, {});
    return bloque;
  }

  /** El cliente rellena el formulario y la lanza (o la descarta). */
  async ejecutarHerramienta(conversacion: string, bloque: string, valores: Record<string, unknown>, descartar = false): Promise<void> {
    const c0 = await this.leer(conversacion);
    const t0 = this.bloqueHerramienta(c0, bloque);
    if (t0.estado !== 'FORMULARIO') throw new ErrorDeUsuario('Esa herramienta ya se lanzó.');
    const def = this.catalogo().find((h) => h.id === t0.herramienta);
    if (!def) throw new ErrorDeUsuario('Esa herramienta ya no existe.');
    if (descartar) {
      await this.cambiar(conversacion, (c) => {
        this.bloqueHerramienta(c, bloque).estado = 'DESCARTADO';
      });
      return;
    }
    if (def.conHechos && !c0.hechos) throw new ErrorDeUsuario('Primero sube la foto del plato y confirma su ficha: esta herramienta escribe textos con esos datos.');
    // «Post o carrusel» es el camino del director: plan con su coste, que se aprueba aparte.
    if (def.id === 'pieza') {
      await this.cambiar(conversacion, (c) => {
        const t = this.bloqueHerramienta(c, bloque);
        t.estado = 'HECHO';
        t.valores = valores;
      });
      const formato = valores.formato === 'post' ? 'post' : 'carrusel';
      const esfuerzo = (['rapido', 'normal', 'maximo'] as const).find((x) => x === valores.esfuerzo) ?? 'normal';
      await this.planificarPiezaNueva(conversacion, { formato, diapositivas: Number(valores.diapositivas) || 5, indicaciones: String(valores.indicaciones ?? ''), esfuerzo }, 'Planifico la pieza con lo que me has dicho.');
      return;
    }
    if (!this.d.herramientas) throw new ErrorDeUsuario('Las herramientas no están disponibles.');
    await this.cambiar(conversacion, (c) => {
      const t = this.bloqueHerramienta(c, bloque);
      t.estado = 'EN_CURSO';
      t.valores = valores;
      t.progreso = [];
    });
    void (async () => {
      try {
        const resultado = await this.d.herramientas!.ejecutar(def.id, await this.contextoDeHerramienta(conversacion, bloque), valores);
        await this.cambiar(conversacion, (c) => {
          const t = this.bloqueHerramienta(c, bloque);
          t.estado = 'HECHO';
          t.resultado = ResultadoHerramienta.parse(resultado);
        });
      } catch (error) {
        const texto = error instanceof Error ? error.message : String(error);
        this.d.avisar?.(`herramienta ${def.id}: ${texto}`);
        await this.cambiar(conversacion, (c) => {
          const t = this.bloqueHerramienta(c, bloque);
          t.estado = 'ERROR';
          t.error = texto.slice(0, 1200);
        }).catch(() => {});
      }
    })();
  }

  private bloqueHerramienta(c: Conversacion, bloque: string): Extract<Bloque, { tipo: 'herramienta' }> {
    for (const m of c.mensajes) for (const b of m.bloques) if (b.id === bloque && b.tipo === 'herramienta') return b;
    throw new ErrorDeUsuario('Esa herramienta no está en la conversación.');
  }

  private async contextoDeHerramienta(conversacion: string, bloque: string): Promise<ContextoDeHerramienta> {
    const c = await this.leer(conversacion);
    const trabajo = `herramientas/${bloque}`;
    await mkdir(this.rutaArchivo(conversacion, trabajo), { recursive: true });
    return {
      conversacion: c,
      carpeta: this.carpetaDe(conversacion),
      trabajo,
      rutaImagen: (imagen) => {
        const i = c.imagenes.find((x) => x.id === imagen);
        if (!i) throw new ErrorDeUsuario(`La imagen «${imagen}» no está en la conversación.`);
        return this.rutaArchivo(conversacion, i.archivo);
      },
      guardar: async (nombre, datos) => {
        const archivo = `${trabajo}/${nombre.replace(/[^\w.-]+/g, '-')}`;
        await writeFile(this.rutaArchivo(conversacion, archivo), datos);
        return archivo;
      },
      anadirImagen: async (origen, nombre) => {
        const meta = await sharp(origen).metadata();
        const idImagen = `img-${id()}`;
        const ext = extname(origen).toLowerCase() || '.png';
        const archivo = `imagenes/${idImagen}${ext === '.jpeg' ? '.jpg' : ext}`;
        await mkdir(this.rutaArchivo(conversacion, 'imagenes'), { recursive: true });
        await copyFile(origen, this.rutaArchivo(conversacion, archivo));
        await this.cambiar(conversacion, (cc) => {
          cc.imagenes.push({ id: idImagen, archivo, nombre: nombre.slice(0, 120), ancho: meta.width ?? 1, alto: meta.height ?? 1 });
        });
        return idImagen;
      },
      usarReferencia: async (imagen) => {
        await this.cambiar(conversacion, (cc) => {
          cc.referencia = imagen;
          if (cc.hechos) cc.hechos.referencia = imagen;
        });
      },
      progreso: async (linea) => {
        await this.cambiar(conversacion, (cc) => {
          this.bloqueHerramienta(cc, bloque).progreso.push(linea.slice(0, 300));
        });
      },
      diapositivasDe: (pieza) => (c.piezas.find((p) => p.id === pieza)?.diapositivas ?? []).flatMap((d) => (d.png ? [this.rutaArchivo(conversacion, d.png)] : [])),
    };
  }

  /** Abre una tarjeta de encargo paso a paso (para crear uno nuevo o retomar uno). */
  async abrirEncargo(conversacion: string, modo?: string): Promise<string> {
    const bloque = `enc-${id()}`;
    await this.decir(conversacion, 'Vamos con un encargo paso a paso.', [{ tipo: 'encargo', id: bloque, ...(modo ? { modo } : {}) }]);
    return bloque;
  }

  /** La tarjeta ya tiene su encargo (creado o retomado desde la web). */
  async vincularEncargo(conversacion: string, bloque: string, proyecto: string): Promise<void> {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(proyecto)) throw new ErrorDeUsuario('Ese encargo no existe.');
    await this.cambiar(conversacion, (c) => {
      for (const m of c.mensajes) for (const b of m.bloques) if (b.id === bloque && b.tipo === 'encargo') b.proyecto = proyecto;
    });
  }

  // ------------------------------------------------------------------ El director

  private async contexto(c: Conversacion, o: { formato: Formato | 'auto'; esfuerzo: Esfuerzo; nota?: string }): Promise<string> {
    const locales = await this.d.locales();
    const resumenBloque = (b: Bloque) => {
      if (b.tipo === 'hechos') return `[tarjeta de hechos ${b.estado === 'PENDIENTE' ? 'sin responder' : b.estado === 'HECHO' ? 'confirmada' : 'descartada'}]`;
      if (b.tipo === 'plan') return `[plan de la pieza «${b.pieza}» ${b.estado === 'PENDIENTE' ? 'sin aprobar' : b.estado === 'HECHO' ? 'aprobado' : 'descartado'}]`;
      if (b.tipo === 'pieza') return `[pieza «${b.pieza}» entregada]`;
      if (b.tipo === 'error') return `[error: ${b.texto.slice(0, 160)}]`;
      return '';
    };
    return [
      `LOCALES (slug · nombre · ciudad · qué es):\n${locales.map((l) => `- ${l.slug} · ${l.marca.nombre} · ${l.marca.ciudad} · ${l.marca.descripcion}`).join('\n') || '- (ninguno)'}`,
      `IMÁGENES DE LA CONVERSACIÓN: ${c.imagenes.map((i) => `«${i.id}» (${i.nombre})`).join(', ') || 'ninguna'}`,
      c.hechos
        ? `HECHOS CONFIRMADOS: local ${c.hechos.local}; plato «${c.hechos.plato}»; elementos ${c.hechos.elementos.map((e) => `${e.recuento ? `${e.recuento} ` : ''}${e.nombre} (${e.estado})`).join(', ')}; mensaje «${c.hechos.mensaje}»; foto «${c.hechos.foto}»${c.hechos.referencia ? `; referencia «${c.hechos.referencia}»` : ''}.`
        : 'HECHOS CONFIRMADOS: ninguno todavía.',
      `PIEZAS: ${c.piezas.map((p) => `«${p.id}» ${p.formato} de ${p.plan?.diapositivas.length ?? '?'} (${p.estado})${p.estado === 'LISTA' && p.plan ? `: ${p.plan.diapositivas.map((d, i) => `${i + 1}. ${d.resumen}`).join(' | ')}` : ''}`).join(' · ') || 'ninguna'}`,
      c.referencia ? `REFERENCIA DE LA CONVERSACIÓN: imagen «${c.referencia}».` : '',
      this.d.herramientas ? `HERRAMIENTAS (ábrelas con ABRIR_HERRAMIENTA cuando el cliente pida algo que hacen; el encargo paso a paso, con ABRIR_ENCARGO):\n${catalogoEnTexto(this.d.herramientas.catalogo)}` : '',
      `SELECTORES DEL CLIENTE: formato ${o.formato === 'auto' ? 'automático (decides tú)' : o.formato}; esfuerzo ${o.esfuerzo}.`,
      'CONVERSACIÓN (la última línea es lo nuevo):',
      ...c.mensajes.slice(-16).map((m) => `${m.rol === 'usuario' ? 'CLIENTE' : 'TÚ'}: ${m.texto}${m.imagenes.length ? ` [imágenes: ${m.imagenes.join(', ')}]` : ''} ${m.bloques.map(resumenBloque).join(' ')}`.trim()),
      ...(o.nota ? [`NOTA DEL SISTEMA: ${o.nota}`] : []),
    ].join('\n\n');
  }

  private async responder(conversacion: string, o: { formato: Formato | 'auto'; esfuerzo: Esfuerzo; nota?: string }): Promise<void> {
    try {
      if (!this.d.director) throw new ErrorDeUsuario('El director no está disponible: falta GEMINI_API_KEY en .env.');
      const c = await this.leer(conversacion);
      const ultimo = [...c.mensajes].reverse().find((m) => m.rol === 'usuario');
      const ids = new Set([...(ultimo?.imagenes ?? []), ...(c.hechos ? [c.hechos.foto] : [])]);
      const imagenes = c.imagenes.filter((i) => ids.has(i.id)).slice(0, 4).map((i) => ({ id: i.id, ruta: this.rutaArchivo(conversacion, i.archivo) }));
      const turno = await this.d.director.turnoDelChat(await this.contexto(c, o), imagenes);
      await this.ejecutar(conversacion, turno, o);
    } catch (error) {
      await this.fallo(conversacion, error);
    } finally {
      await this.cambiar(conversacion, (c) => {
        c.pensando = false;
      }).catch(() => {});
    }
  }

  private async fallo(conversacion: string, error: unknown) {
    const texto = error instanceof Error ? error.message : String(error);
    this.d.avisar?.(`chat ${conversacion}: ${texto}`);
    // El aviso y el fin del «pensando» van en el mismo cambio: la web nunca ve el error con el orbe aún girando.
    await this.cambiar(conversacion, (c) => {
      c.mensajes.push(this.mensaje('asistente', 'No he podido terminar eso.', { bloques: [{ tipo: 'error', id: `err-${id()}`, texto: texto.slice(0, 600) }] }));
      c.pensando = false;
    }).catch(() => {});
  }

  private async ejecutar(conversacion: string, turno: TurnoDelDirector, o: { formato: Formato | 'auto'; esfuerzo: Esfuerzo }) {
    const a: AccionDelDirector | undefined = turno.accion;
    if (!a) {
      await this.decir(conversacion, turno.mensaje);
      return;
    }
    if (a.tipo === 'PROPONER_HECHOS') {
      const c = await this.leer(conversacion);
      const locales = await this.d.locales();
      if (!locales.some((l) => l.slug === a.hechos.local)) a.hechos.local = locales[0]?.slug ?? a.hechos.local;
      if (!c.imagenes.some((i) => i.id === a.hechos.foto)) throw new Error(`El director señaló una foto que no existe («${a.hechos.foto}»).`);
      if (a.hechos.referencia && !c.imagenes.some((i) => i.id === a.hechos.referencia)) delete a.hechos.referencia;
      await this.decir(conversacion, turno.mensaje, [{ tipo: 'hechos', id: `hechos-${id()}`, estado: 'PENDIENTE', propuesta: a.hechos }]);
      return;
    }
    if (a.tipo === 'ABRIR_HERRAMIENTA') {
      await this.abrirHerramienta(conversacion, a.herramienta, a.valores, turno.mensaje);
      return;
    }
    if (a.tipo === 'ABRIR_ENCARGO') {
      await this.decir(conversacion, turno.mensaje, [{ tipo: 'encargo', id: `enc-${id()}`, modo: a.modo }]);
      return;
    }
    await this.planificarPiezaNueva(
      conversacion,
      a.tipo === 'AJUSTAR_PIEZA'
        ? { ajustar: a.pieza, rehacer: a.diapositivas, indicaciones: a.indicaciones, esfuerzo: o.esfuerzo }
        : { formato: o.formato !== 'auto' ? o.formato : a.formato, diapositivas: a.diapositivas, indicaciones: a.indicaciones, esfuerzo: o.esfuerzo, busqueda: a.busqueda },
      turno.mensaje,
    );
  }

  /** Planifica una pieza (o el ajuste de una hecha) y deja el plan con su coste para aprobarlo. */
  async planificarPiezaNueva(
    conversacion: string,
    p: { formato?: Formato; diapositivas?: number; ajustar?: string; rehacer?: number[]; indicaciones: string; esfuerzo: Esfuerzo; busqueda?: string[]; conReferenciaElegida?: boolean },
    mensaje: string,
  ): Promise<void> {
    const c = await this.leer(conversacion);
    if (!c.hechos) {
      await this.decir(conversacion, `${mensaje}\n\nAntes necesito que confirmes los datos del plato (sube la foto si aún no está).`);
      return;
    }
    // Una pieza nueva empieza eligiendo su estética de referencia (un ajuste conserva la que tenía).
    if (!p.ajustar && !p.conReferenciaElegida && this.d.buscarReferencias) {
      await this.buscarEsteticaDeReferencia(conversacion, { formato: p.formato ?? 'carrusel', diapositivas: p.formato === 'post' ? 1 : Math.min(6, Math.max(3, p.diapositivas ?? 5)), indicaciones: p.indicaciones, esfuerzo: p.esfuerzo }, p.busqueda ?? [], mensaje);
      return;
    }
    const base = p.ajustar ? c.piezas.find((x) => x.id === p.ajustar && x.estado === 'LISTA') : undefined;
    if (p.ajustar && !base) {
      await this.decir(conversacion, `${mensaje}\n\nNo encuentro esa pieza terminada para ajustarla.`);
      return;
    }
    const formato: Formato = base ? base.formato : p.formato ?? 'carrusel';
    const n = base?.plan ? base.plan.diapositivas.length : formato === 'post' ? 1 : Math.min(6, Math.max(3, p.diapositivas ?? 5));
    const rehacer = base ? (p.rehacer ?? []).filter((x) => x >= 1 && x <= n) : [];
    const a = { indicaciones: p.indicaciones };
    const o = { esfuerzo: p.esfuerzo };
    const piezaId = `pieza-${id()}`;
    const progreso = `prog-${id()}`;
    await this.decir(conversacion, mensaje, [{ tipo: 'progreso', id: progreso, pieza: piezaId }]);
    await this.cambiar(conversacion, (cc) => {
      cc.piezas.push({ id: piezaId, formato, esfuerzo: o.esfuerzo, indicaciones: a.indicaciones, estado: 'PROPUESTA', costeEstimadoUsd: 0, ...(base ? { base: base.id } : {}), rehacer, progreso: [{ texto: base ? 'Replanteando las diapositivas' : 'Planificando cada diapositiva', estado: 'en-curso' }], diapositivas: [] });
    });
    try {
      const encargo = await this.encargo(c, piezaId);
      let plan: PlanDePieza | undefined;
      let devolver: string[] = [];
      for (let intento = 1; intento <= 2; intento++) {
        plan = await this.planificarConReintentos(encargo, { formato, diapositivas: n, indicaciones: a.indicaciones, ...(base?.plan ? { base: { plan: base.plan, rehacer } } : {}) }, devolver);
        const problemas = problemasDePieza(plan, formato, n);
        const hechos = await this.hechosDeLaPieza(c);
        for (const [i, d] of plan.diapositivas.entries()) problemas.push(...problemasDeTextos(d.visual.receta.textos, hechos, { titularCreativo: true, creativo: { maxPalabras: 4, maxTextos: 2 } }).map((x) => `Diapositiva ${i + 1}: ${x}`));
        if (!problemas.length) break;
        devolver = problemas;
        if (intento === 2) throw new Error(`El plan no pasa las comprobaciones: ${problemas.slice(0, 3).join(' · ')}`);
      }
      // En un ajuste, lo que no se rehace se queda exactamente como estaba.
      if (base?.plan && rehacer.length) plan!.diapositivas = plan!.diapositivas.map((d, i) => (rehacer.includes(i + 1) ? d : base.plan!.diapositivas[i] ?? d));
      const coste = costeEstimado(plan!, { usdPorFoto: this.d.usdPorFoto, esfuerzo: o.esfuerzo, ...(rehacer.length ? { soloDiapositivas: rehacer } : {}) });
      await this.cambiar(conversacion, (cc) => {
        const p = cc.piezas.find((x) => x.id === piezaId)!;
        p.plan = plan!;
        p.costeEstimadoUsd = coste;
        p.progreso = [{ texto: 'Plan listo', estado: 'hecho' }];
        for (const m of cc.mensajes) m.bloques = m.bloques.map((b) => (b.id === progreso ? { tipo: 'plan' as const, id: `plan-${id()}`, estado: 'PENDIENTE' as const, pieza: piezaId } : b));
      });
    } catch (error) {
      await this.cambiar(conversacion, (cc) => {
        const p = cc.piezas.find((x) => x.id === piezaId)!;
        p.estado = 'ERROR';
        p.error = error instanceof Error ? error.message : String(error);
        p.progreso = [{ texto: 'No se pudo planificar', estado: 'error' }];
      });
      throw error;
    }
  }

  /**
   * El plan es la respuesta más larga del director (cada diapositiva con su receta) y a veces llega como JSON roto dos
   * veces seguidas (chat del 23/11: «no es JSON válido» con 5 diapositivas). Se repite la petición entera hasta tres
   * veces antes de rendirse; los errores que no son de formato no se repiten.
   */
  private async planificarConReintentos(...args: Parameters<NonNullable<DepsChat['director']>['planificarPieza']>): Promise<PlanDePieza> {
    for (let vez = 1; ; vez++) {
      try {
        return await this.d.director!.planificarPieza(...args);
      } catch (error) {
        if (vez >= 3 || !/formato pedido|JSON/i.test(error instanceof Error ? error.message : '')) throw error;
        this.d.avisar?.(`plan con JSON roto (vez ${vez}): se repite`);
      }
    }
  }

  // ------------------------------------------------------------------ Estética de referencia

  /** Las piezas terminadas de este local en cualquier conversación (las más recientes primero). */
  private async piezasDelLocal(local: string, excepto?: string): Promise<Array<{ ruta: string; titulo: string; idea: string }>> {
    const fuera: Array<{ ruta: string; titulo: string; idea: string; fecha: string }> = [];
    for (const otra of await this.listar()) {
      if (otra.id === excepto) continue;
      const c = await this.leer(otra.id).catch(() => undefined);
      if (!c || c.hechos?.local !== local) continue;
      for (const p of c.piezas) {
        const portada = p.diapositivas.find((d) => d.png);
        if (p.estado !== 'LISTA' || !portada?.png || !p.plan) continue;
        fuera.push({ ruta: this.rutaArchivo(c.id, portada.png), titulo: `${p.formato === 'carrusel' ? 'Carrusel' : 'Post'} · ${c.hechos.plato}`, idea: p.plan.idea, fecha: c.actualizada });
      }
    }
    return fuera.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 8);
  }

  private async buscarEsteticaDeReferencia(conversacion: string, pedido: { formato: Formato; diapositivas: number; indicaciones: string; esfuerzo: Esfuerzo }, consultas: string[], mensaje: string) {
    const bloque = `refs-${id()}`;
    await this.decir(conversacion, mensaje ? `${mensaje}\n\nAntes, busco referencias para elegir la estética.` : 'Busco referencias para elegir la estética.', [{ tipo: 'referencias', id: bloque, estado: 'BUSCANDO', pedido, consultas, candidatas: [], progreso: [] }]);
    void (async () => {
      try {
        const c = await this.leer(conversacion);
        const h = c.hechos!;
        const anteriores = await this.piezasDelLocal(h.local, conversacion);
        const destino = this.rutaArchivo(conversacion, `referencias/${bloque}`);
        await mkdir(destino, { recursive: true });
        const r = await this.d.buscarReferencias!(
          { destino, prefijo: `referencias/${bloque}`, local: h.local, plato: h.plato, elementos: h.elementos.map((e) => e.nombre), indicaciones: pedido.indicaciones, formato: pedido.formato, consultas, anteriores: anteriores.map((a) => ({ ruta: a.ruta, titulo: a.titulo })) },
          (linea) => void this.cambiar(conversacion, (cc) => {
            const b = this.bloqueReferencias(cc, bloque);
            b.progreso = [...b.progreso, linea.slice(0, 200)].slice(-6);
          }).catch(() => {}),
        );
        await this.cambiar(conversacion, (cc) => {
          const b = this.bloqueReferencias(cc, bloque);
          b.estado = r.candidatas.length ? 'PENDIENTE' : 'HECHO';
          b.consultas = r.consultas;
          b.candidatas = r.candidatas;
        });
        // Sin nada que elegir, se sigue sin referencia.
        if (!r.candidatas.length) await this.planificarPiezaNueva(conversacion, { ...pedido, conReferenciaElegida: true }, 'No he encontrado referencias que valgan: planifico sin ellas.');
      } catch (error) {
        const texto = error instanceof Error ? error.message : String(error);
        await this.cambiar(conversacion, (cc) => {
          const b = this.bloqueReferencias(cc, bloque);
          b.estado = 'ERROR';
          b.error = texto.slice(0, 600);
        }).catch(() => {});
        // La búsqueda no bloquea la pieza: se planifica igual.
        await this.planificarPiezaNueva(conversacion, { ...pedido, conReferenciaElegida: true }, 'No he podido buscar referencias: planifico sin ellas.');
      }
    })();
  }

  private bloqueReferencias(c: Conversacion, bloque: string): Extract<Bloque, { tipo: 'referencias' }> {
    for (const m of c.mensajes) for (const b of m.bloques) if (b.id === bloque && b.tipo === 'referencias') return b;
    throw new ErrorDeUsuario('Esa tarjeta de referencias no existe.');
  }

  /** El cliente elige la estética: una candidata, «auto» (la primera, la que mejor puntuó) o «ninguna». */
  async elegirEstetica(conversacion: string, bloque: string, eleccion: string): Promise<void> {
    const c0 = await this.leer(conversacion);
    const b0 = this.bloqueReferencias(c0, bloque);
    if (b0.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Esa elección ya está hecha.');
    const candidata = eleccion === 'auto' ? b0.candidatas[0] : b0.candidatas.find((x) => x.id === eleccion);
    if (eleccion !== 'ninguna' && !candidata) throw new ErrorDeUsuario('Esa referencia no está entre las candidatas.');
    let imagen: string | undefined;
    if (candidata) {
      const ruta = this.rutaArchivo(conversacion, candidata.archivo);
      const meta = await sharp(ruta).metadata();
      imagen = `img-${id()}`;
      const archivo = `imagenes/${imagen}${extname(ruta).toLowerCase() || '.jpg'}`;
      await mkdir(this.rutaArchivo(conversacion, 'imagenes'), { recursive: true });
      await copyFile(ruta, this.rutaArchivo(conversacion, archivo));
      await this.cambiar(conversacion, (c) => {
        c.imagenes.push({ id: imagen!, archivo, nombre: `referencia-${candidata.origen}${extname(ruta)}`, ancho: meta.width ?? 1, alto: meta.height ?? 1 });
      });
    }
    await this.cambiar(conversacion, (c) => {
      const b = this.bloqueReferencias(c, bloque);
      b.estado = eleccion === 'ninguna' ? 'DESCARTADO' : 'HECHO';
      if (candidata) b.elegida = candidata.id;
      if (imagen) {
        c.referencia = imagen;
        if (c.hechos) c.hechos.referencia = imagen;
      }
    });
    const texto = candidata ? `Tomo como listón ${candidata.origen === 'local' ? 'un post anterior del local' : candidata.origen === 'pinterest' ? 'esa referencia de Pinterest' : 'esa referencia del estudio'}: me quedo con su oficio, no con su contenido. Planifico la pieza.` : 'Sin referencia: planifico con el criterio del estudio.';
    await this.planificarPiezaNueva(conversacion, { ...b0.pedido, conReferenciaElegida: true }, texto);
  }

  private async hechosDeLaPieza(c: Conversacion): Promise<HechosDeLaPieza> {
    const local = (await this.d.locales()).find((l) => l.slug === c.hechos!.local)!;
    const m = local.marca;
    return {
      plato: c.hechos!.plato,
      elementos: c.hechos!.elementos,
      local: { nombre: m.nombre, ciudad: m.ciudad, descripcion: m.descripcion, tonos: m.tonos, ...(m.instagram ? { instagram: m.instagram } : {}), ...(m.web ? { web: m.web } : {}) },
    };
  }

  private async entrada(c: Conversacion, pieza: string, foto?: ActivoDisponible): Promise<EntradaEstudioDeArte> {
    const local = (await this.d.locales()).find((l) => l.slug === c.hechos!.local);
    if (!local) throw new ErrorDeUsuario(`El local «${c.hechos!.local}» ya no existe.`);
    const real = foto ?? (await this.d.registrarFoto({ local: local.slug, id: `chat-${c.id}-${c.hechos!.foto}`, ruta: this.rutaArchivo(c.id, c.imagenes.find((i) => i.id === c.hechos!.foto)!.archivo), tipo: 'REAL', descripcion: `Foto real de «${c.hechos!.plato}» subida en el chat (${c.id}).` }));
    const idRef = c.hechos!.referencia ?? c.referencia;
    const ref = idRef ? c.imagenes.find((i) => i.id === idRef) : undefined;
    const anteriores = (await this.piezasDelLocal(local.slug)).map((a) => `${a.titulo}: ${a.idea}`.slice(0, 240));
    return {
      id: pieza,
      local: local.slug,
      ...(anteriores.length ? { anteriores } : {}),
      foto: real,
      hechos: await this.hechosDeLaPieza(c),
      tokensMarca: local.tokens,
      mensaje: c.hechos!.mensaje,
      creativo: true,
      direcciones: 1,
      vueltas: 0,
      salida: this.rutaArchivo(c.id, `piezas/${pieza}`),
      ...(ref ? { referencia: { id: ref.id, ruta: this.rutaArchivo(c.id, ref.archivo) } } : {}),
    };
  }

  private async encargo(c: Conversacion, pieza: string): Promise<EncargoDeArte> {
    return this.d.prepararEncargo(await this.entrada(c, pieza));
  }

  // ------------------------------------------------------------------ Producción

  private async paso(conversacion: string, pieza: string, texto: string, estado: 'en-curso' | 'hecho' | 'error' = 'en-curso') {
    await this.cambiar(conversacion, (c) => {
      const p = c.piezas.find((x) => x.id === pieza)!;
      const i = p.progreso.findIndex((x) => x.texto === texto);
      if (i >= 0) p.progreso[i] = { texto, estado };
      else p.progreso.push({ texto, estado });
    });
  }

  private async producir(conversacion: string, piezaId: string): Promise<void> {
    try {
      const c = await this.leer(conversacion);
      const pieza = c.piezas.find((p) => p.id === piezaId)!;
      if (!pieza.plan) throw new Error('La pieza no tiene plan.');
      const plan = pieza.plan;
      const base = pieza.base ? c.piezas.find((p) => p.id === pieza.base) : undefined;
      const rehacer = (n: number) => !base || !pieza.rehacer.length || pieza.rehacer.includes(n);
      const entradaBase = await this.entrada(c, piezaId);
      const carpeta = `piezas/${piezaId}`;
      await mkdir(this.rutaArchivo(conversacion, `${carpeta}/fotos`), { recursive: true });
      let coste = 0;

      // 1. Las tomas nuevas, de tres en tres.
      const fotos = new Map<number, ActivoDisponible>();
      const pendientes = plan.diapositivas.map((d, i) => ({ d, n: i + 1 })).filter(({ d, n }) => d.visual.foto === 'generada' && rehacer(n));
      const local = (await this.d.locales()).find((l) => l.slug === c.hechos!.local)!;
      const { promptFinal } = await import('../arte/pieza.js');
      let siguiente = 0;
      const trabajar = async () => {
        for (let k = siguiente++; k < pendientes.length; k = siguiente++) {
          const { d, n } = pendientes[k]!;
          const texto = `Foto nueva de la diapositiva ${n}`;
          await this.paso(conversacion, piezaId, texto);
          const prompt = promptFinal(d.visual.generar!, { nombre: local.marca.nombre, ciudad: local.marca.ciudad, descripcion: local.marca.descripcion });
          let archivo = '';
          for (let intento = 1; intento <= 2; intento++) {
            const r = await this.d.generarFoto({ id: `${piezaId}-${n}${intento > 1 ? `-${intento}` : ''}`, prompt, referencias: d.visual.generar!.conPlato ? [{ ruta: entradaBase.foto.ruta, etiqueta: 'image1: the real dish' }] : [], tamano: pieza.esfuerzo === 'rapido' ? '1K' : '2K' });
            coste += r.costeUsd;
            archivo = `${carpeta}/fotos/${String(n).padStart(2, '0')}${intento > 1 ? `-${intento}` : ''}.png`;
            await sharp(r.bytes).png().toFile(this.rutaArchivo(conversacion, archivo));
            const defecto = await this.d.defectoDeFoto?.(this.rutaArchivo(conversacion, archivo));
            if (!defecto) break;
            this.d.avisar?.(`${piezaId} diapositiva ${n}: ${defecto}${intento === 1 ? ' (se repite)' : ''}`);
          }
          fotos.set(n, await this.d.registrarFoto({ local: local.slug, id: `chat-${piezaId}-${n}`, ruta: this.rutaArchivo(conversacion, archivo), tipo: 'GENERADO', descripcion: `Toma nueva de la diapositiva ${n} (${d.resumen}).`, prompt }));
          await this.paso(conversacion, piezaId, texto, 'hecho');
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, pendientes.length) }, trabajar));

      // 2. Cada diapositiva con su receta; las que no se rehacen, copiadas de la pieza base.
      const producidas: Pieza['diapositivas'] = [];
      for (const [i, d] of plan.diapositivas.entries()) {
        const n = i + 1;
        const anterior = base?.diapositivas.find((x) => x.n === n);
        if (!rehacer(n) && anterior?.png) {
          producidas.push(anterior);
          continue;
        }
        const texto = `Diseño de la diapositiva ${n}`;
        await this.paso(conversacion, piezaId, texto);
        const foto = d.visual.foto === 'real' ? entradaBase.foto : fotos.get(n);
        if (!foto) {
          producidas.push({ n, problemas: ['sin foto'] });
          await this.paso(conversacion, piezaId, texto, 'error');
          continue;
        }
        const hecho = await this.d.componer({ ...entradaBase, foto, salida: this.rutaArchivo(conversacion, `${carpeta}/d${n}`) }, d.visual.receta, pieza.esfuerzo);
        let png: string | undefined;
        let movil: string | undefined;
        if (hecho.png) {
          png = `${carpeta}/${String(n).padStart(2, '0')}.png`;
          movil = `${carpeta}/${String(n).padStart(2, '0')}-movil.jpg`;
          await copyFile(hecho.png, this.rutaArchivo(conversacion, png));
          await sharp(hecho.png).resize(540).jpeg({ quality: 84 }).toFile(this.rutaArchivo(conversacion, movil));
        }
        producidas.push({ n, ...(png ? { png } : {}), ...(movil ? { movil } : {}), problemas: hecho.problemas, foto: foto.activo.id });
        await this.paso(conversacion, piezaId, texto, png ? 'hecho' : 'error');
      }

      const listas = producidas.filter((x) => x.png).length;
      await this.cambiar(conversacion, (cc) => {
        const p = cc.piezas.find((x) => x.id === piezaId)!;
        p.diapositivas = producidas;
        p.costeRealUsd = Math.round(coste * 1000) / 1000;
        p.estado = listas ? 'LISTA' : 'ERROR';
        if (!listas) p.error = 'Ninguna diapositiva se pudo maquetar.';
        const conErrores = producidas.filter((x) => x.png && x.problemas.length).map((x) => x.n);
        cc.mensajes.push(
          this.mensaje(
            'asistente',
            listas
              ? `Aquí está${pieza.formato === 'carrusel' ? ` el carrusel (${listas} de ${producidas.length} diapositivas)` : ' el post'}.${conErrores.length ? ` La${conErrores.length > 1 ? 's' : ''} ${conErrores.join(', ')} tiene${conErrores.length > 1 ? 'n' : ''} detalles que el código midió (contraste o solape): dime si la rehago.` : ''} Pídeme cualquier cambio.`
              : 'No he conseguido maquetar ninguna diapositiva.',
            { bloques: [{ tipo: 'pieza', id: `res-${id()}`, pieza: piezaId }] },
          ),
        );
      });
    } catch (error) {
      await this.cambiar(conversacion, (cc) => {
        const p = cc.piezas.find((x) => x.id === piezaId);
        if (p) {
          p.estado = 'ERROR';
          p.error = error instanceof Error ? error.message : String(error);
        }
      }).catch(() => {});
      await this.fallo(conversacion, error);
    }
  }
}
