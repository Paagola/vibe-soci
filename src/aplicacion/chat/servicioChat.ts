/**
 * El chat del estudio: una conversación con el director (Hydrogen) que acaba en posts y carruseles.
 *
 * Flujo:
 *   1. El cliente escribe y sube fotos. El director mira y, si toca, propone los HECHOS del plato (tarjeta).
 *   2. El cliente corrige y confirma la tarjeta: la foto real se registra como activo del local (con su máscara).
 *   3. El director propone una pieza; el código la PLANIFICA (cada diapositiva con su toma nueva y su receta),
 *      comprueba el plan y los textos, y enseña el plan con su coste (tarjeta). Nada se gasta en imágenes todavía.
 *   4. El cliente aprueba: se generan las tomas nuevas (Nano Banana Pro con el plato real de referencia) y el estudio
 *      de arte maqueta cada diapositiva, reparando con el director lo que no cabe en la foto de verdad.
 *   5. El diseño se ajusta en las capas de la entrega. Una nueva toma sí se planifica y se aprueba.
 *
 * Todo cambio de la conversación se guarda y se avisa a quien la esté mirando (la web la recibe por SSE).
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile, copyFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { exigirTomaNueva } from '../../adaptadores/imagen/copiaDeReferencia.js';
import type { EncargoDeArte } from '../../puertos/EstudioDeArte.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { Tokens } from '../../dominio/diseno/intencion.js';
import { problemasDeTextos, type HechosDeLaPieza } from '../../dominio/diseno/propuesta.js';
import type { Marca } from '../../dominio/modelos.js';
import { LecturaFotografica, RelacionesGraficas, detallesFotograficos, detallesGraficos } from '../../dominio/referencia.js';
import type { Receta } from '../../dominio/arte/receta.js';
import {
  Conversacion, costeEstimado, type CandidataDeReferencia, HechosDelPlato, llevaAcabado, problemasDePieza,
  type AccionDelDirector, type ConceptoDeSerie, type DiapositivaDePieza, type RevisionDeFoto, type Bloque, type Esfuerzo, type Formato, type Mensaje, type Pieza, type PlanDePieza, type TurnoDelDirector,
} from '../../dominio/chat.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { seLee, type EntradaEstudioDeArte } from '../arte/estudioDeArte.js';
import { catalogoEnTexto, ResultadoHerramienta, type DefinicionHerramienta } from './herramientas.js';
import type { EditorDeDiseno } from './editarDiseno.js';
import type { VisualCompuesto } from '../arte/pieza.js';
import { fuentesDePieza } from './fuentesDePieza.js';
import type { FuentesDePieza, PedidoDePieza, RolDeAgente, ZonaDeLamina } from '../../dominio/chat.js';

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
    planificarPieza(e: EncargoDeArte, o: { formato: Formato; diapositivas: number; indicaciones: string; base?: { plan: PlanDePieza; rehacer: number[] }; concepto?: ConceptoDeSerie }, devolver: string[]): Promise<PlanDePieza>;
    /** Antes del plan: tres conceptos de serie distintos (historia y fotografía) para que el cliente elija. */
    proponerConceptos?(e: EncargoDeArte, o: { formato: Formato; diapositivas: number; indicaciones: string }): Promise<ConceptoDeSerie[]>;
  };
  /** Registra una foto como activo del local (con su máscara); la real, además, con su máscara principal. */
  registrarFoto(o: { local: string; id: string; ruta: string; tipo: 'REAL' | 'GENERADO'; descripcion: string; prompt?: string; modelo?: string }): Promise<ActivoDisponible>;
  /** El encargo de arte del estudio (mapa de la foto, colores, voces…), para planificar. */
  prepararEncargo(entrada: EntradaEstudioDeArte): Promise<EncargoDeArte>;
  /** Genera una toma nueva. Devuelve los bytes (PNG o JPEG) y lo que costó. */
  generarFoto(o: { id: string; prompt: string; referencias: Array<{ ruta: string; etiqueta: string }>; tamano: '1K' | '2K' }): Promise<{ bytes: Buffer; costeUsd: number; modelo: string }>;
  /** Comprueba una foto generada; devuelve el defecto si hay que repetirla (franjas planas, dominante amarilla excesiva). */
  defectoDeFoto?(ruta: string, luzDeEscena?: string): Promise<string | undefined>;
  /** Corrige en el sitio lo que el código sabe corregir de una foto (una dominante amarilla moderada); devuelve qué hizo. */
  corregirFoto?(ruta: string): Promise<string | undefined>;
  /**
   * El director mira una foto generada antes de maquetarla (contra la foto real del plato y la toma anterior de la
   * sesión): si la repite y por qué, y si se sostiene sola sin texto.
   */
  revisarFoto?(o: { foto: string; real?: string; continuidad?: string; anterior?: string; toma: string; papel: string; portada: boolean }): Promise<RevisionDeFoto>;
  /** Analiza una referencia (su ficha: familia, retícula, capas, tipografía, paleta) y dice si es un post de verdad. */
  analizarReferencia?(ruta: string): Promise<{ ficha: unknown; apta: boolean; problemas: string[] }>;
  /** Maqueta un visual con su receta (y repara si hace falta, según el esfuerzo). */
  componer(entrada: EntradaEstudioDeArte, receta: Receta, esfuerzo: Esfuerzo): Promise<VisualCompuesto>;
  leerTextoMovil?(png: string): Promise<string[]>;
  componerFotografiaConTexto?(entrada: EntradaEstudioDeArte, receta: Receta, cabecera: boolean): Promise<VisualCompuesto>;
  editarDiseno?: EditorDeDiseno;
  comprobarFotosEdicion?(local: string, laminas: Pieza['diapositivas'], referencias: string[]): Promise<void>;
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
  private readonly ediciones = new Set<string>();
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
      if (t.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Esa tarjeta ya está respondida.');
      t.estado = 'HECHO';
      t.propuesta = hechos;
      c.hechos = { ...hechos, ...(!hechos.referencia && c.referencia ? { referencia: c.referencia } : {}), activoReal: real.activo.id };
      if (hechos.referencia) c.referencia = hechos.referencia;
      t.formato = r.formato ?? t.formato ?? 'auto';
      t.esfuerzo = r.esfuerzo ?? t.esfuerzo ?? 'normal';
      c.mensajes.push(this.mensaje('usuario', `✓ Confirmo los datos del plato: ${hechos.plato}.${t.formato === 'auto' ? '' : ` Quiero un ${t.formato}.`}`));
      c.pensando = true;
    });
    void this.responder(conversacion, { formato: r.formato ?? tarjeta.formato ?? 'auto', esfuerzo: r.esfuerzo ?? tarjeta.esfuerzo ?? 'normal', nota: 'El cliente acaba de confirmar los hechos del plato. Si ya pidió una pieza, propónla ahora.' });
  }

  /** La tarjeta del plan: el cliente lo aprueba (se produce) o lo descarta. */
  async responderPlan(conversacion: string, bloque: string, aprobar: boolean): Promise<void> {
    let pieza: Pieza | undefined;
    await this.cambiar(conversacion, (c) => {
      const t = this.tarjeta(c, bloque, 'plan');
      if (t.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Ese plan ya está respondido.');
      pieza = c.piezas.find((p) => p.id === t.pieza);
      if (!pieza) throw new ErrorDeUsuario('Esa pieza no existe.');
      if (aprobar && (!pieza.plan || (pieza.formato === 'post') !== (pieza.plan.diapositivas.length === 1))) {
        throw new ErrorDeUsuario('El número de láminas del plan no coincide con su formato. Revisa el plan antes de producir.');
      }
      t.estado = aprobar ? 'HECHO' : 'DESCARTADO';
      if (aprobar && pieza.plan?.diapositivas.some(d => d.visual.foto !== 'generada' || !d.visual.generar)) {
        throw new ErrorDeUsuario('Este plan antiguo incluye una foto subida. Descártalo y pide un plan con todas las tomas nuevas para revisar su coste.');
      }
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
      const contexto = await this.contexto(c, o);
      let turno = await this.d.director.turnoDelChat(contexto, imagenes);
      const pedido = ultimo?.texto ?? '';
      const lista = c.piezas.findLast((p) => p.estado === 'LISTA');
      // Recupera una clasificación equivocada antes de que pueda abrir otro formulario o presupuestar fotografías.
      if (lista && !o.nota && esRetoqueDeDiseno(pedido) && turno.accion && (turno.accion.tipo !== 'AJUSTAR_PIEZA' || turno.accion.alcance === 'nueva-toma')) {
        if (lista.formato === 'post' && c.piezas.filter((p) => p.estado === 'LISTA').length === 1) {
          turno = { mensaje: 'Edito el diseño entregado.', accion: {
            tipo: 'AJUSTAR_PIEZA', pieza: lista.id, diapositivas: [1], indicaciones: pedido,
            alcance: /(?:nano banana|imagen(?:es)? secundaria|foto secundaria|chip.*(?:imagen|foto))/i.test(pedido) ? 'diseno-con-imagen-secundaria' : 'diseno',
          } };
        } else {
          turno = await this.d.director.turnoDelChat(`${contexto}\nEs una edición de diseño. Identifica la pieza y las posiciones pedidas mediante AJUSTAR_PIEZA. Pregunta si son ambiguas.`, imagenes);
          if (turno.accion && (turno.accion.tipo !== 'AJUSTAR_PIEZA' || turno.accion.alcance === 'nueva-toma')) throw new ErrorDeUsuario('Indica qué pieza y qué láminas quieres editar.');
        }
      }
      await this.ejecutar(conversacion, turno, o, pedido);
    } catch (error) {
      await this.fallo(conversacion, error);
    } finally {
      await this.cambiar(conversacion, (c) => {
        c.pensando = c.piezas.some((p) => this.ediciones.has(`${conversacion}/${p.id}`));
      }).catch(() => {});
    }
  }

  private async fallo(conversacion: string, error: unknown) {
    const texto = error instanceof Error ? error.message : String(error);
    this.d.avisar?.(`chat ${conversacion}: ${texto}`);
    // El aviso y el fin del «pensando» van en el mismo cambio: la web nunca ve el error con el orbe aún girando.
    await this.cambiar(conversacion, (c) => {
      c.mensajes.push(this.mensaje('asistente', 'No he podido terminar eso.', { bloques: [{ tipo: 'error', id: `err-${id()}`, texto: texto.slice(0, 600) }] }));
      c.pensando = c.piezas.some((p) => this.ediciones.has(`${conversacion}/${p.id}`));
    }).catch(() => {});
  }

  private async ejecutar(conversacion: string, turno: TurnoDelDirector, o: { formato: Formato | 'auto'; esfuerzo: Esfuerzo }, pedido: string) {
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
      await this.decir(conversacion, turno.mensaje, [{ tipo: 'hechos', id: `hechos-${id()}`, estado: 'PENDIENTE', propuesta: a.hechos, formato: o.formato, esfuerzo: o.esfuerzo }]);
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
    if (a.tipo === 'AJUSTAR_PIEZA' && a.alcance !== 'nueva-toma') {
      await this.editarDiseno(conversacion, a, pedido);
      return;
    }
    // El comentario libre del director puede anunciar el formato contrario al elegido en el formulario.
    const mensaje = a.tipo === 'PROPONER_PIEZA' && o.formato !== 'auto' && o.formato !== a.formato
      ? `Preparo el ${o.formato} que has seleccionado.`
      : turno.mensaje;
    await this.planificarPiezaNueva(
      conversacion,
      a.tipo === 'AJUSTAR_PIEZA'
        ? { ajustar: a.pieza, rehacer: a.diapositivas, indicaciones: a.indicaciones, esfuerzo: o.esfuerzo }
        : { formato: o.formato !== 'auto' ? o.formato : a.formato, diapositivas: a.diapositivas, indicaciones: a.indicaciones, esfuerzo: o.esfuerzo, busqueda: a.busqueda },
      mensaje,
    );
  }

  private async editarDiseno(conversacion: string, a: Extract<AccionDelDirector, { tipo: 'AJUSTAR_PIEZA' }>, pedido: string) {
    const editar = this.d.editarDiseno;
    if (!editar) throw new ErrorDeUsuario('El editor de capas no está disponible.');
    const c = await this.leer(conversacion);
    const pieza = c.piezas.find((p) => p.id === a.pieza && p.estado === 'LISTA');
    if (!pieza?.plan) throw new ErrorDeUsuario('Elige una pieza terminada de esta conversación.');
    const fuentes = fuentesDePieza(c, pieza);
    if (pieza.plan.diapositivas.some((d, i) => d.visual.foto === 'real' || pieza.diapositivas.find((l) => l.n === i + 1)?.foto === fuentes.hechos.activoReal)) {
      throw new ErrorDeUsuario('Esta pieza antigua incluye una referencia del usuario. Pide una toma nueva para esa lámina antes de entregar la revisión.');
    }
    const posiciones = new Set(a.diapositivas.length ? a.diapositivas : pieza.diapositivas.map((l) => l.n));
    const laminas = pieza.diapositivas.filter((l) => posiciones.has(l.n) && l.png);
    if (!laminas.length || laminas.length !== posiciones.size) throw new ErrorDeUsuario('Alguna de las láminas solicitadas no está disponible.');
    const local = (await this.d.locales()).find((l) => l.slug === fuentes.hechos.local);
    if (!local) throw new ErrorDeUsuario('No encuentro la marca de la pieza.');
    if (this.d.comprobarFotosEdicion) {
      const foto = c.imagenes.find(i => i.id === fuentes.hechos.foto);
      if (!foto) throw new ErrorDeUsuario('La foto de referencia del plan ya no está disponible.');
      const referencias = [foto.archivo, ...(fuentes.referencia ? [fuentes.referencia.archivo] : [])];
      await this.d.comprobarFotosEdicion(local.slug, pieza.diapositivas, referencias.map(archivo => this.rutaArchivo(c.id, archivo)));
    }
    const clave = `${conversacion}/${pieza.id}`;
    if (this.ediciones.has(clave)) throw new ErrorDeUsuario('Ya hay una edición en curso para esta pieza.');
    this.ediciones.add(clave);
    // La mesa de edición: la pieza enseña qué láminas se tocan y los cursores de quien las toca.
    await this.cambiar(conversacion, (cc) => {
      const p = cc.piezas.find((x) => x.id === pieza.id)!;
      p.edicion = { laminas: laminas.map((l) => l.n), pedido: pedido.slice(0, 300), desde: this.ahora() };
      p.agentes = [];
      p.bitacora = [];
    });
    try {
      const revision = id();
      const cambios: Awaited<ReturnType<EditorDeDiseno>>[] = [];
      for (const lamina of laminas) {
        cambios.push(await editar({
          lamina, local: local.slug, tokens: local.tokens, pedido: `Petición del cliente: ${pedido}\nIndicaciones para la lámina ${lamina.n}: ${a.indicaciones}`,
          conChips: a.alcance === 'diseno-con-imagen-secundaria', carpeta: `piezas/${pieza.id}/ediciones/${revision}/${lamina.n}`,
          ruta: (archivo) => this.rutaArchivo(conversacion, archivo),
          avisar: ({ rol, accion, zona }) => this.agente(conversacion, pieza.id, { id: `${rol}-1`, rol, n: lamina.n, ...(accion ? { accion } : {}), ...(zona ? { zona } : {}) }),
        }));
      }
      // Todos los archivos de la revisión ya existen. Publica las láminas en un único cambio de la conversación.
      await this.cambiar(conversacion, (cc) => {
        const actual = cc.piezas.find((p) => p.id === pieza.id)!;
        const editadas = new Map(cambios.map((r) => [r.lamina.n, r.lamina]));
        actual.diapositivas = actual.diapositivas.map((l) => editadas.get(l.n) ?? l);
        actual.costeRealUsd = Math.round(((actual.costeRealUsd ?? 0) + cambios.reduce((s, r) => s + r.costeUsd, 0)) * 1000) / 1000;
        const destino = pieza.formato === 'post' ? 'del post'
          : `de ${posiciones.size === 1 ? 'la lámina' : 'las láminas'} ${[...posiciones].join(', ')}`;
        cc.mensajes.push(this.mensaje('asistente', `He actualizado el diseño ${destino}.`, { bloques: [{ tipo: 'pieza', id: `res-${id()}`, pieza: pieza.id, mostrar: laminas[0]!.n }] }));
      });
    } finally {
      this.ediciones.delete(clave);
      await this.cambiar(conversacion, (cc) => {
        const p = cc.piezas.find((x) => x.id === pieza.id);
        if (p) {
          delete p.edicion;
          p.agentes = [];
        }
      }).catch(() => {});
    }
  }

  /** Planifica una pieza (o el ajuste de una hecha) y deja el plan con su coste para aprobarlo. */
  async planificarPiezaNueva(
    conversacion: string,
    p: { formato?: Formato; diapositivas?: number; ajustar?: string; rehacer?: number[]; indicaciones: string; esfuerzo: Esfuerzo; busqueda?: string[]; conReferenciaElegida?: boolean; concepto?: ConceptoDeSerie | null; fuentes?: FuentesDePieza },
    mensaje: string,
  ): Promise<void> {
    const c0 = await this.leer(conversacion);
    if (!c0.hechos) {
      await this.decir(conversacion, `${mensaje}\n\nAntes necesito que confirmes los datos del plato (sube la foto si aún no está).`);
      return;
    }
    // Un concepto ya presentado puede venir de una conversación antigua donde el guion y el selector diferían.
    // Al elegirlo, el cliente acepta las láminas que ha visto en esa tarjeta.
    const laminasElegidas = p.concepto?.laminas.length;
    const formatoPedido: Formato = laminasElegidas ? (laminasElegidas === 1 ? 'post' : 'carrusel') : p.formato ?? 'carrusel';
    const numeroPedido = laminasElegidas ?? (formatoPedido === 'post' ? 1 : Math.min(6, Math.max(3, p.diapositivas ?? 5)));
    const base = p.ajustar ? c0.piezas.find((x) => x.id === p.ajustar && x.estado === 'LISTA') : undefined;
    if (p.ajustar && !base) {
      await this.decir(conversacion, `${mensaje}\n\nNo encuentro esa pieza terminada para ajustarla.`);
      return;
    }
    const fuentes = p.fuentes ?? fuentesDePieza(c0, base);
    const pedido = { formato: formatoPedido, diapositivas: numeroPedido, indicaciones: p.indicaciones, esfuerzo: p.esfuerzo, fuentes };
    // Una pieza nueva empieza eligiendo su estética de referencia (un ajuste conserva la que tenía).
    if (!p.ajustar && !p.conReferenciaElegida && this.d.buscarReferencias) {
      await this.buscarEsteticaDeReferencia(conversacion, pedido, p.busqueda ?? [], mensaje);
      return;
    }
    // Con referencia, su ficha antes de planificar: el plan parte de ella (una hermana), no solo de su imagen.
    if (!p.ajustar && fuentes.referencia && fuentes.referencia.revision !== 2) {
      fuentes.referencia = await this.asegurarFicha(conversacion, fuentes.referencia);
    }
    // Y antes del plan, el concepto: tres maneras distintas de contar el plato para que el cliente elija.
    if (!p.ajustar && p.concepto === undefined && this.d.director?.proponerConceptos) {
      await this.proponerConceptosDeSerie(conversacion, pedido, mensaje);
      return;
    }
    const c = await this.leer(conversacion);
    const formato: Formato = base?.formato ?? formatoPedido;
    const n = base?.plan?.diapositivas.length ?? numeroPedido;
    const rehacer = base ? [...new Set(p.rehacer ?? [])] : [];
    if (rehacer.some(x => x < 1 || x > n)) throw new ErrorDeUsuario(`La pieza tiene ${n} láminas. Indica cuáles quieres rehacer.`);
    const originales = base?.plan?.diapositivas.flatMap((d, i) => d.visual.foto === 'real' && !rehacer.includes(i + 1) ? [i + 1] : []) ?? [];
    if (rehacer.length && originales.length) {
      rehacer.push(...originales);
      mensaje += `\n\nEl plan incluye una toma nueva para las láminas ${originales.join(', ')} que usaban una foto subida. Podrás revisar el coste antes de producir.`;
    }
    const a = { indicaciones: p.indicaciones };
    const o = { esfuerzo: p.esfuerzo };
    const piezaId = `pieza-${id()}`;
    const progreso = `prog-${id()}`;
    await this.decir(conversacion, mensaje, [{ tipo: 'progreso', id: progreso, pieza: piezaId }]);
    await this.cambiar(conversacion, (cc) => {
      cc.piezas.push({ id: piezaId, formato, esfuerzo: o.esfuerzo, indicaciones: a.indicaciones, estado: 'PROPUESTA', costeEstimadoUsd: 0, fotos: [], agentes: [], bitacora: [], ...(base ? { base: base.id } : {}), rehacer, progreso: [{ texto: base ? 'Replanteando las diapositivas' : 'Planificando cada diapositiva', estado: 'en-curso' }], diapositivas: [] });
    });
    try {
      const encargo = await this.encargo(c, piezaId, fuentes);
      let plan: PlanDePieza | undefined;
      let devolver: string[] = [];
      for (let intento = 1; intento <= 2; intento++) {
        plan = await this.planificarConReintentos(encargo, { formato, diapositivas: n, indicaciones: a.indicaciones, ...(base?.plan ? { base: { plan: base.plan, rehacer } } : {}), ...(p.concepto ? { concepto: p.concepto } : {}) }, devolver);
        // Valida exactamente la secuencia que podrá aprobar el cliente, con las láminas conservadas ya en su sitio.
        if (base?.plan && rehacer.length) plan.diapositivas = plan.diapositivas.map((d, i) => rehacer.includes(i + 1) ? d : base.plan!.diapositivas[i] ?? d);
        const problemas = problemasDePieza(plan, formato, n);
        const hechos = await this.hechosDeLaPieza(fuentes.hechos);
        for (const [i, d] of plan.diapositivas.entries()) problemas.push(...problemasDeTextos(d.visual.receta.textos, hechos, { titularCreativo: true, creativo: { maxPalabras: 4, maxTextos: 2 } }).map((x) => `Diapositiva ${i + 1}: ${x}`));
        if (!problemas.length) break;
        devolver = problemas;
        if (intento === 2) throw new Error(`El plan no pasa las comprobaciones: ${problemas.slice(0, 3).join(' · ')}`);
      }
      const coste = costeEstimado(plan!, { usdPorFoto: this.d.usdPorFoto, esfuerzo: o.esfuerzo, ...(rehacer.length ? { soloDiapositivas: rehacer } : {}) });
      const datosDelEncargo = { local: fuentes.hechos.local, plato: fuentes.hechos.plato, fotografia: p.concepto?.fotografia ?? base?.encargo?.fotografia, fuentes };
      await this.cambiar(conversacion, (cc) => {
        const p = cc.piezas.find((x) => x.id === piezaId)!;
        p.plan = plan!;
        p.encargo = datosDelEncargo;
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

  // ------------------------------------------------------------------ Concepto de la serie

  private async proponerConceptosDeSerie(conversacion: string, pedido: PedidoDePieza, mensaje: string) {
    const bloque = `conc-${id()}`;
    await this.decir(conversacion, mensaje ? `${mensaje}\n\nAntes del plan, te propongo tres maneras de contarlo.` : 'Antes del plan, te propongo tres maneras de contarlo.', [{ tipo: 'conceptos', id: bloque, estado: 'BUSCANDO', pedido, conceptos: [] }]);
    void (async () => {
      try {
        const c = await this.leer(conversacion);
        const encargo = await this.encargo(c, bloque, pedido.fuentes);
        const conceptos = await this.d.director!.proponerConceptos!(encargo, { formato: pedido.formato, diapositivas: pedido.diapositivas, indicaciones: pedido.indicaciones });
        if (conceptos.length !== 3 || conceptos.some((c) => c.laminas.length !== pedido.diapositivas)) {
          throw new Error(`Cada uno de los tres conceptos debe contener las ${pedido.diapositivas} láminas del pedido.`);
        }
        await this.cambiar(conversacion, (cc) => {
          const b = this.bloqueConceptos(cc, bloque);
          b.estado = 'PENDIENTE';
          b.conceptos = conceptos;
        });
      } catch (error) {
        await this.cambiar(conversacion, (cc) => {
          const b = this.bloqueConceptos(cc, bloque);
          b.estado = 'ERROR';
          b.error = (error instanceof Error ? error.message : String(error)).slice(0, 600);
        }).catch(() => {});
        // Sin conceptos, se planifica igual: el concepto ayuda, no bloquea.
        await this.planificarPiezaNueva(conversacion, { ...pedido, conReferenciaElegida: true, concepto: null }, 'No he podido proponer conceptos: planifico directamente.');
      }
    })();
  }

  private bloqueConceptos(c: Conversacion, bloque: string): Extract<Bloque, { tipo: 'conceptos' }> {
    for (const m of c.mensajes) for (const b of m.bloques) if (b.id === bloque && b.tipo === 'conceptos') return b;
    throw new ErrorDeUsuario('Esa tarjeta de conceptos no existe.');
  }

  /** El cliente elige un concepto (0, 1 o 2) o «auto» (el primero, el que el director propone en cabeza). */
  async elegirConcepto(conversacion: string, bloque: string, eleccion: number | 'auto'): Promise<void> {
    const c0 = await this.leer(conversacion);
    const b0 = this.bloqueConceptos(c0, bloque);
    if (b0.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Esa elección ya está hecha.');
    const i = eleccion === 'auto' ? 0 : eleccion;
    const concepto = b0.conceptos[i];
    if (!concepto) throw new ErrorDeUsuario('Ese concepto no está entre los propuestos.');
    await this.cambiar(conversacion, (c) => {
      const b = this.bloqueConceptos(c, bloque);
      if (b.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Esa elección ya está hecha.');
      b.estado = 'HECHO';
      b.elegido = i;
    });
    await this.planificarPiezaNueva(conversacion, { ...b0.pedido, fuentes: fuentesDePieza(c0, b0), conReferenciaElegida: true, concepto }, `Vamos con «${concepto.nombre}». Planifico cada lámina.`);
  }

  // ------------------------------------------------------------------ Estética de referencia

  /** Las piezas terminadas de este local en cualquier conversación (las más recientes primero). */
  private async piezasDelLocal(local: string, excepto?: string): Promise<Array<{ ruta: string; titulo: string; idea: string }>> {
    const fuera: Array<{ ruta: string; titulo: string; idea: string; fecha: string }> = [];
    for (const otra of await this.listar()) {
      if (otra.id === excepto) continue;
      const c = await this.leer(otra.id).catch(() => undefined);
      if (!c) continue;
      for (const p of [...c.piezas].reverse()) {
        const encargo = p.encargo ?? (c.hechos && fuentesDePieza(c, p).hechos);
        if (!encargo || encargo.local !== local || p.base) continue;
        const portada = p.diapositivas.find((d) => d.png);
        if (p.estado !== 'LISTA' || !portada?.png || !p.plan) continue;
        const primera = p.plan.diapositivas[0]!.visual;
        const fotografia = p.encargo?.fotografia ?? primera.generar?.prompt;
        const secuencia = p.plan.diapositivas.map(d => d.papel + '/' + d.visual.receta.esqueleto).join(' → ');
        const idea = [p.plan.idea.slice(0, 160), fotografia?.slice(0, 280), secuencia].filter(Boolean).join(' · ');
        fuera.push({ ruta: this.rutaArchivo(c.id, portada.png), titulo: `${p.formato === 'carrusel' ? 'Carrusel' : 'Post'} · ${encargo.plato}`, idea, fecha: c.actualizada });
      }
    }
    return fuera.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
  }

  private async buscarEsteticaDeReferencia(conversacion: string, pedido: PedidoDePieza, consultas: string[], mensaje: string) {
    const bloque = `refs-${id()}`;
    await this.decir(conversacion, mensaje ? `${mensaje}\n\nAntes, busco referencias para elegir la estética.` : 'Busco referencias para elegir la estética.', [{ tipo: 'referencias', id: bloque, estado: 'BUSCANDO', pedido, consultas, candidatas: [], progreso: [] }]);
    void (async () => {
      try {
        const c = await this.leer(conversacion);
        const h = pedido.fuentes?.hechos ?? c.hechos!;
        const propia = c.imagenes.find(i => i.id === h.referencia && i.id !== h.foto && c.mensajes.some(m => m.rol === 'usuario' && m.imagenes.includes(i.id)));
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
        if (propia) r.candidatas.unshift({ id: propia.id, origen: 'propia', archivo: propia.archivo, titulo: 'Tu referencia' });
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
    const fuentes = fuentesDePieza(c0, b0);
    const candidata = eleccion === 'auto' ? b0.candidatas[0] : b0.candidatas.find((x) => x.id === eleccion);
    if (eleccion !== 'ninguna' && !candidata) throw new ErrorDeUsuario('Esa referencia no está entre las candidatas.');
    let imagen = candidata?.origen === 'propia' ? candidata.id : undefined;
    if (candidata && !imagen) {
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
      if (b.estado !== 'PENDIENTE') throw new ErrorDeUsuario('Esa elección ya está hecha.');
      b.estado = eleccion === 'ninguna' ? 'DESCARTADO' : 'HECHO';
      if (candidata) b.elegida = candidata.id;
      if (imagen) b.imagenElegida = imagen;
      const elegida = c.imagenes.find(i => i.id === imagen);
      fuentes.referencia = elegida && { id: elegida.id, archivo: elegida.archivo };
      if (c.hechos?.foto !== fuentes.hechos.foto || c.hechos.local !== fuentes.hechos.local) return;
      if (imagen) {
        c.referencia = imagen;
        if (c.hechos) c.hechos.referencia = imagen;
      } else {
        delete c.referencia;
        delete c.fichaReferencia;
        if (c.hechos) delete c.hechos.referencia;
      }
    });
    const texto = candidata ? `Planifico la pieza a partir de «${candidata.titulo || 'Referencia elegida'}».` : 'Planifico la pieza sin referencia.';
    await this.planificarPiezaNueva(conversacion, { ...b0.pedido, fuentes, conReferenciaElegida: true }, texto);
  }

  private async hechosDeLaPieza(hechos: FuentesDePieza['hechos']): Promise<HechosDeLaPieza> {
    const local = (await this.d.locales()).find((l) => l.slug === hechos.local)!;
    const m = local.marca;
    return {
      plato: hechos.plato,
      elementos: hechos.elementos,
      local: { nombre: m.nombre, ciudad: m.ciudad, descripcion: m.descripcion, tonos: m.tonos, ...(m.instagram ? { instagram: m.instagram } : {}), ...(m.web ? { web: m.web } : {}) },
    };
  }

  private async entrada(c: Conversacion, pieza: string, fuentes: FuentesDePieza): Promise<EntradaEstudioDeArte> {
    const { hechos, referencia: ref } = fuentes;
    const local = (await this.d.locales()).find((l) => l.slug === hechos.local);
    if (!local) throw new ErrorDeUsuario(`El local «${hechos.local}» ya no existe.`);
    const imagen = c.imagenes.find(i => i.id === hechos.foto);
    if (!imagen) throw new ErrorDeUsuario('La foto de referencia del plan ya no está disponible.');
    const real = await this.d.registrarFoto({ local: local.slug, id: hechos.activoReal, ruta: this.rutaArchivo(c.id, imagen.archivo), tipo: 'REAL', descripcion: `Foto real de «${hechos.plato}» subida en el chat (${c.id}).` });
    const anteriores = (await this.piezasDelLocal(local.slug)).map(a => a.titulo + ' · ' + a.idea);
    return {
      id: pieza,
      local: local.slug,
      ...(anteriores.length ? { anteriores } : {}),
      foto: real,
      hechos: await this.hechosDeLaPieza(hechos),
      tokensMarca: local.tokens,
      mensaje: hechos.mensaje,
      creativo: true,
      direcciones: 1,
      vueltas: 0,
      salida: this.rutaArchivo(c.id, `piezas/${pieza}`),
      ...(ref ? { referencia: { id: ref.id, ruta: this.rutaArchivo(c.id, ref.archivo), ficha: ref.ficha } } : {}),
    };
  }

  /** La ficha de la referencia de la conversación, si aún no la tiene: el director parte de ella para hacer hermanas. */
  private async asegurarFicha(conversacion: string, ref: NonNullable<FuentesDePieza['referencia']>): Promise<NonNullable<FuentesDePieza['referencia']>> {
    if (!this.d.analizarReferencia) return ref;
    const c = await this.leer(conversacion);
    try {
      const previa = c.fichaReferencia;
      const a = previa?.imagen === ref.id && previa.revision === 2 ? previa : await this.d.analizarReferencia(this.rutaArchivo(conversacion, ref.archivo));
      const ficha = a.ficha as { lecturaFotografica?: unknown; relacionesGraficas?: unknown } | null;
      const foto = LecturaFotografica.safeParse(ficha?.lecturaFotografica);
      const grafica = RelacionesGraficas.safeParse(ficha?.relacionesGraficas);
      const lectura = [...(grafica.success ? detallesGraficos(grafica.data) : []), ...(foto.success ? detallesFotograficos(foto.data) : [])];
      await this.cambiar(conversacion, (cc) => {
        if ((cc.hechos?.referencia ?? cc.referencia) === ref.id) {
          cc.fichaReferencia = { imagen: ref.id, ficha: a.ficha, apta: a.apta, problemas: a.problemas.slice(0, 6), revision: 2 };
        }
        if (lectura.length) for (const m of cc.mensajes) for (const b of m.bloques) {
          if (b.tipo === 'referencias' && b.imagenElegida === ref.id) b.lectura = lectura;
        }
      });
      return { ...ref, ficha: a.ficha, revision: 2 };
    } catch (error) {
      this.d.avisar?.(`No se pudo analizar la referencia de ${conversacion}: ${error instanceof Error ? error.message : String(error)}`);
      return ref;
    }
  }

  private async encargo(c: Conversacion, pieza: string, fuentes = fuentesDePieza(c)): Promise<EncargoDeArte> {
    return this.d.prepararEncargo(await this.entrada(c, pieza, fuentes));
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

  /**
   * Un agente se pone a trabajar en la mesa (o cambia de tarea): la web mueve su cursor a la lámina y a la zona.
   * Con `accion: undefined` se levanta de la mesa. Nunca para la producción si falla.
   */
  private async agente(conversacion: string, pieza: string, a: { id: string; rol: RolDeAgente; n?: number; zona?: ZonaDeLamina; accion?: string; apuntar?: boolean }) {
    await this.cambiar(conversacion, (c) => {
      const p = c.piezas.find((x) => x.id === pieza);
      if (!p) return;
      p.agentes = p.agentes.filter((x) => x.id !== a.id);
      if (!a.accion) return;
      const ahora = this.ahora();
      p.agentes.push({ id: a.id, rol: a.rol, accion: a.accion.slice(0, 160), desde: ahora, ...(a.n ? { n: a.n } : {}), ...(a.zona ? { zona: a.zona } : {}) });
      if (a.apuntar !== false) p.bitacora = [...p.bitacora, { id: a.id, rol: a.rol, texto: a.accion.slice(0, 160), fecha: ahora, ...(a.n ? { n: a.n } : {}) }].slice(-14);
    }).catch(() => {});
  }

  /** Todos se levantan de la mesa (al terminar, bien o mal). */
  private async despejarMesa(conversacion: string, pieza: string) {
    await this.cambiar(conversacion, (c) => {
      const p = c.piezas.find((x) => x.id === pieza);
      if (p) p.agentes = [];
    }).catch(() => {});
  }

  private async producir(conversacion: string, piezaId: string): Promise<void> {
    const mesa = (a: Parameters<ServicioChat['agente']>[2]) => this.agente(conversacion, piezaId, a);
    try {
      const c = await this.leer(conversacion);
      const pieza = c.piezas.find((p) => p.id === piezaId)!;
      if (!pieza.plan) throw new Error('La pieza no tiene plan.');
      const plan = pieza.plan;
      const base = pieza.base ? c.piezas.find((p) => p.id === pieza.base) : undefined;
      const rehacer = (n: number) => !base || !pieza.rehacer.length || pieza.rehacer.includes(n);
      const fuentes = fuentesDePieza(c, pieza);
      const entradaBase = await this.entrada(c, piezaId, fuentes);
      if (base && pieza.rehacer.length && this.d.comprobarFotosEdicion) {
        const conservadas = base.diapositivas.filter(l => !rehacer(l.n));
        await this.d.comprobarFotosEdicion(fuentes.hechos.local, conservadas, [entradaBase.foto.ruta, ...(entradaBase.referencia ? [entradaBase.referencia.ruta] : [])]);
      }
      const carpeta = `piezas/${piezaId}`;
      await mkdir(this.rutaArchivo(conversacion, `${carpeta}/fotos`), { recursive: true });
      let coste = 0;
      const esfuerzo = pieza.esfuerzo;
      const decisiones = new Map<number, string[]>();
      const decidir = (n: number, t: string) => decisiones.set(n, [...(decisiones.get(n) ?? []), t.slice(0, 400)]);
      /** Láminas que el director, al ver su foto, decidió dejar sin texto. */
      const sinTexto = new Set<number>();

      // 1. Las tomas nuevas. La primera va sola y es la continuidad de la sesión: las demás la reciben como referencia
      //    (misma mesa, vajilla, luz y paleta; otro encuadre), como en el carrusel de la ensalada y en el Taller.
      //    Cada foto la mira el director antes de maquetarla: si no vale, se repite una vez con su corrección.
      const fotos = new Map<number, ActivoDisponible>();
      const pendientes = plan.diapositivas.map((d, i) => ({ d, n: i + 1 })).filter(({ d, n }) => d.visual.foto === 'generada' && rehacer(n));
      const local = (await this.d.locales()).find((l) => l.slug === fuentes.hechos.local)!;
      const { promptFinal } = await import('../arte/pieza.js');
      const revisar = esfuerzo !== 'rapido' && this.d.revisarFoto ? this.d.revisarFoto.bind(this.d) : undefined;
      const tomar = async ({ d, n }: { d: DiapositivaDePieza; n: number }, continuidad?: string, puesto = 1): Promise<string> => {
        const texto = `Foto nueva de la diapositiva ${n}`;
        const fotografo = `fotografo-${puesto}`;
        await this.paso(conversacion, piezaId, texto);
        const generar = d.visual.generar!;
        const etiquetaContinuidad = generar.conPlato ? '@image2' : '@image1';
        let prompt = [
          promptFinal(generar, { nombre: local.marca.nombre, ciudad: local.marca.ciudad, descripcion: local.marca.descripcion }),
          continuidad
            ? `${etiquetaContinuidad} is an earlier photograph from this same shoot: keep its session continuity (the same table surface, tableware, props, light direction, colour temperature and palette) but NOT its camera angle, distance or framing: this is a different shot of the series.`
            : '',
        ]
          .filter(Boolean)
          .join(' ');
        let ruta = '';
        let archivo = '';
        let rutaAnterior: string | undefined;
        for (let intento = 1; intento <= 2; intento++) {

          const referencias = [...(generar.conPlato ? [{ ruta: entradaBase.foto.ruta, etiqueta: 'image1: the real dish' }] : []), ...(continuidad ? [{ ruta: continuidad, etiqueta: `${etiquetaContinuidad.slice(1)}: session continuity` }] : [])];
          await mesa({ id: fotografo, rol: 'fotografo', n, accion: intento > 1 ? `Repite la toma de la ${n}` : `Dispara la toma de la ${n}${continuidad ? ', con la luz de la sesión' : ''}` });
          const r = await this.d.generarFoto({ id: `${piezaId}-${n}${intento > 1 ? `-${intento}` : ''}`, prompt, referencias, tamano: esfuerzo === 'rapido' ? '1K' : '2K' });
          coste += r.costeUsd;
          archivo = `${carpeta}/fotos/${String(n).padStart(2, '0')}${intento > 1 ? `-${intento}` : ''}.png`;
          ruta = this.rutaArchivo(conversacion, archivo);
          try {
            await exigirTomaNueva(r.bytes, [entradaBase.foto.ruta, ...(entradaBase.referencia ? [entradaBase.referencia.ruta] : []), ...(continuidad ? [continuidad] : [])]);
          } catch (error) {
            if (!(error instanceof ErrorDeUsuario) || intento === 2) throw error;
            decidir(n, 'Repetí la foto porque reproducía una imagen de referencia.');
            prompt += ' Make a new exposure from the directed camera position. Change visible perspective and scene relationships.';
            continue;
          }
          await sharp(r.bytes).png().toFile(ruta);
          // La foto ya se ve en su marco mientras se revisa.
          await this.cambiar(conversacion, (cc) => {
            const p = cc.piezas.find((x) => x.id === piezaId)!;
            p.fotos = [...p.fotos.filter((x) => x.n !== n), { n, archivo: relative(this.carpetaDe(conversacion), ruta) }];
          });
          await mesa({ id: fotografo, rol: 'fotografo', n, accion: `Revela la toma de la ${n}`, apuntar: false });
          await mesa({ id: `revisor-${puesto}`, rol: 'revisor', n, accion: `Mide la luz y el color de la ${n}`, zona: { x: 0.15, y: 0.2, w: 0.7, h: 0.6 } });
          const defecto = await this.d.defectoDeFoto?.(ruta, generar.luzDeEscena);
          await mesa({ id: `revisor-${puesto}`, rol: 'revisor' });
          if (defecto) {
            this.d.avisar?.(`${piezaId} diapositiva ${n}: ${defecto}${intento === 1 ? ' (se repite)' : ''}`);
            if (intento === 1) {
              rutaAnterior = ruta;
              decidir(n, `Repetí la foto: salió con ${defecto}.`);
              await mesa({ id: 'director', rol: 'director', n, accion: `Pide repetir la ${n}: ${defecto}` });
              const luz = generar.luzDeEscena
                ? `Keep the directed light source and falloff: ${generar.luzDeEscena}.`
                : 'If it was a colour cast, use neutral daylight white balance: whites must read truly white, no yellow or orange tint.';
              prompt = `${prompt} CORRECTION after a first attempt that came out with «${defecto}»: avoid it. ${luz}`;
              continue;
            }
          }
          // Lo que el código sabe arreglar (una dominante amarilla), antes de que el director la mire.
          const corregida = generar.luzDeEscena ? undefined : await this.d.corregirFoto?.(ruta).catch(() => undefined);
          if (corregida) decidir(n, corregida);
          if (revisar) {
            try {
              // La portada y el cierre de un carrusel llevan texto; como mucho N−2 láminas solas en total.
              const protegida = pieza.formato === 'carrusel' && (n === 1 || n === plan.diapositivas.length);
              const toma = [d.resumen, generar.prompt, generar.luzDeEscena && 'Fuente de color prevista: ' + generar.luzDeEscena].filter(Boolean).join(' — ');
              await mesa({ id: 'director', rol: 'director', n, accion: rutaAnterior ? `Compara los dos intentos de la ${n}` : `Mira la foto de la ${n}${generar.conPlato ? ' frente al plato real' : ''}` });
              const v = await revisar({ foto: ruta, ...(generar.conPlato ? { real: entradaBase.foto.ruta } : {}), ...(continuidad ? { continuidad } : {}), ...(rutaAnterior ? { anterior: rutaAnterior } : {}), toma, papel: d.papel, portada: protegida });
              if (v.veredicto === 'REPETIR' && intento === 1) {
                rutaAnterior = ruta;
                decidir(n, `Repetí la foto: ${v.motivo}`);
                await mesa({ id: 'director', rol: 'director', n, accion: `Pide repetir la ${n}: ${v.motivo}` });
                prompt = `${prompt} CORRECTION after reviewing a first attempt: ${v.corregir ?? v.motivo}`;
                continue;
              }
              if (rutaAnterior && v.frenteAAnterior === 'PEOR') {
                // El segundo intento salió peor que el primero: se queda el primero (antes se usaba siempre el último).
                ruta = rutaAnterior;
                decidir(n, `Me quedo con el primer intento: el segundo salió peor (${v.motivo})`);
              } else if (v.veredicto === 'REPETIR') decidir(n, `La segunda foto tampoco es perfecta (${v.motivo}); sigo con ella.`);
              const solas = plan.diapositivas.filter((x) => x.soloFoto).length + sinTexto.size;
              const tope = pieza.formato === 'carrusel' ? plan.diapositivas.length - 2 : 0;
              if (v.sinTexto && !protegida && !d.soloFoto && solas < tope) {
                sinTexto.add(n);
                decidir(n, `Va sin texto: la foto se sostiene sola. ${v.motivo}`);
                await mesa({ id: 'director', rol: 'director', n, accion: `La ${n} va sin texto: la foto se sostiene sola` });
              } else await mesa({ id: 'director', rol: 'director', n, accion: `Aprueba la foto de la ${n}` });
            } catch (error) {
              this.d.avisar?.(`${piezaId} diapositiva ${n}: no se pudo revisar la foto (${error instanceof Error ? error.message : String(error)})`);
            }
          }
          break;
        }
        fotos.set(n, await this.d.registrarFoto({ local: local.slug, id: `chat-${piezaId}-${n}`, ruta, tipo: 'GENERADO', descripcion: `Toma nueva de la diapositiva ${n} (${d.resumen}).`, prompt }));
        // La foto, a la vista en cuanto está (la web la enseña mientras se compone la pieza).
        await this.cambiar(conversacion, (cc) => {
          const p = cc.piezas.find((x) => x.id === piezaId)!;
          p.fotos = [...p.fotos.filter((x) => x.n !== n), { n, archivo: relative(this.carpetaDe(conversacion), ruta) }];
        });
        await this.paso(conversacion, piezaId, texto, 'hecho');
        await mesa({ id: fotografo, rol: 'fotografo' });
        return ruta;
      };
      // En un ajuste, la continuidad es la primera foto de la pieza de la que parte.
      const deLaBase = base ? this.rutaArchivo(conversacion, `piezas/${base.id}/fotos/01.png`) : undefined;
      let continuidad = deLaBase && (await stat(deLaBase).then(() => true, () => false)) ? deLaBase : undefined;
      const [primera, ...resto] = pendientes;
      if (primera) {
        const ruta = await tomar(primera, continuidad);
        continuidad ??= ruta;
      }
      let siguiente = 0;
      const trabajar = async (puesto: number) => {
        for (let k = siguiente++; k < resto.length; k = siguiente++) await tomar(resto[k]!, continuidad, puesto);
      };
      await Promise.all(Array.from({ length: Math.min(3, resto.length) }, (_, w) => trabajar(w + 1)));
      await mesa({ id: 'director', rol: 'director' });

      // 2. Cada diapositiva: la foto sola (si lo pidió el plan o lo decidió el director al verla) o maquetada con su
      //    receta, ya viendo la foto real, con crítica y, donde toque, el acabado de Nano Banana 2.
      const producidas: Pieza['diapositivas'] = [];
      const guardar = async (n: number, origen: string, deFoto: boolean, carpetaCapas?: string) => {
        const nn = String(n).padStart(2, '0');
        const png = `${carpeta}/${nn}.png`;
        const movil = `${carpeta}/${nn}-movil.jpg`;
        if (deFoto) await sharp(origen).rotate().resize(1080, 1440, { fit: 'cover', position: 'attention' }).png().toFile(this.rutaArchivo(conversacion, png));
        else await copyFile(origen, this.rutaArchivo(conversacion, png));
        await sharp(this.rutaArchivo(conversacion, png)).resize(540).jpeg({ quality: 84 }).toFile(this.rutaArchivo(conversacion, movil));
        // Las capas, de fondo a frente, en una carpeta propia de la lámina: la web las monta una a una.
        const capas: string[] = [];
        for (const f of carpetaCapas ? (await readdir(carpetaCapas).catch(() => [] as string[])).filter((x) => x.endsWith('.png')).sort() : []) {
          const destino = `${carpeta}/capas/${nn}/${f}`;
          await mkdir(this.rutaArchivo(conversacion, `${carpeta}/capas/${nn}`), { recursive: true });
          await copyFile(join(carpetaCapas!, f), this.rutaArchivo(conversacion, destino));
          capas.push(destino);
        }
        return { png, movil, capas, ...(carpetaCapas ? { intencion: relative(this.carpetaDe(conversacion), join(dirname(carpetaCapas), 'intencion.json')) } : {}) };
      };
      // De tres en tres (cada lámina con su crítica y su acabado tarda minutos); el orden se mantiene.
      const resultado: Array<Pieza['diapositivas'][number] | undefined> = plan.diapositivas.map(() => undefined);
      const maquetar = async (i: number, d: DiapositivaDePieza, puesto = 1): Promise<Pieza['diapositivas'][number]> => {
        const n = i + 1;
        const anterior = base?.diapositivas.find((x) => x.n === n);
        if (!rehacer(n) && anterior?.png) return anterior;
        const texto = `Diseño de la diapositiva ${n}`;
        const maquetador = `maquetador-${puesto}`;
        const revisor = `revisor-${puesto}`;
        await this.paso(conversacion, piezaId, texto);
        await mesa({ id: maquetador, rol: 'maquetador', n, accion: `Traza la retícula de la ${n}` });
        const foto = fotos.get(n);
        if (!foto) {
          await this.paso(conversacion, piezaId, texto, 'error');
          return { n, problemas: ['sin foto'], decisiones: decisiones.get(n) ?? [], capas: [] };
        }
        if (d.soloFoto || sinTexto.has(n)) {
          if (d.soloFoto) decidir(n, 'Foto sola, como pedía el plan.');
          await mesa({ id: maquetador, rol: 'maquetador', n, accion: `Encuadra la ${n} a sangre, sin texto` });
          const sola = { n, ...(await guardar(n, foto.ruta, true)), problemas: [], foto: foto.activo.id, soloFoto: true, decisiones: decisiones.get(n) ?? [] };
          await this.paso(conversacion, piezaId, texto, 'hecho');
          return sola;
        }
        // Las maquetas de las otras láminas: un parche o una reparación no puede convertir esta en una de ellas.
        // La foto a sangre no cuenta: cada lámina a sangre es distinta por su foto (Torre de Vega, 23/11: la regla bloqueó
        // la reparación buena de una portada que no cabía como cartel).
        const evitarEsqueletos = [...new Set(plan.diapositivas.filter((x, k) => k !== i && !x.soloFoto && !sinTexto.has(k + 1) && x.visual.receta.esqueleto !== d.visual.receta.esqueleto).map((x) => x.visual.receta.esqueleto))].filter((e) => e !== 'FOTO_A_SANGRE');
        await mesa({ id: maquetador, rol: 'maquetador', n, accion: `Compone la ${n}: ${d.visual.receta.nombre || d.visual.receta.esqueleto.toLowerCase().replace(/_/g, ' ')}`, zona: { x: 0.08, y: 0.06, w: 0.84, h: 0.3 } });
        let hecho = await this.d.componer({ ...entradaBase, foto, salida: this.rutaArchivo(conversacion, `${carpeta}/d${n}`), evitarEsqueletos, ...(llevaAcabado(n, esfuerzo) ? { enriquecer: true } : {}) }, d.visual.receta, esfuerzo);
        for (const x of hecho.decisiones ?? []) decidir(n, x);
        const pequeno = hecho.problemas.find((x) => x.startsWith('PRODUCTO_PEQUEÑO'));
        if ((!hecho.png || pequeno) && d.visual.foto === 'generada' && d.visual.receta.esqueleto !== 'FOTO_A_SANGRE') {
          // Antes de la foto sola (o de un producto diminuto): la foto a sangre con solo el titular y la firma, en el aire
          // real de la foto. Así se decidió a mano en Torre de Vega (23/11) y ahora lo hace el sistema.
          const r = d.visual.receta;
          const claves = new Set([r.titular.texto, ...(r.firma ? [r.firma.texto] : [])]);
          const { apoyo: _apoyo, acentoManuscrito: _acento, ...base } = r;
          const sencilla = { ...base, esqueleto: 'FOTO_A_SANGRE' as const, operaciones: [], elementos: [], textos: r.textos.filter((t) => claves.has(t.clave)) };
          await mesa({ id: maquetador, rol: 'maquetador', n, accion: pequeno ? `El plato queda pequeño: prueba la ${n} a sangre` : `No cabe: prueba la ${n} a sangre` });
          const otra = await this.d.componer({ ...entradaBase, foto, salida: this.rutaArchivo(conversacion, `${carpeta}/d${n}-sangre`), evitarEsqueletos: [] }, sencilla, esfuerzo);
          if (otra.png && (!pequeno || !otra.problemas.length)) {
            decidir(n, pequeno ? `En ${r.esqueleto} el producto quedaba diminuto (${pequeno.replace(/^PRODUCTO_PEQUEÑO: /, '')}): la hice a sangre, con la misma foto y el titular en su aire.` : `${r.esqueleto} no cabía en la foto (${hecho.problemas.slice(0, 1).join('').slice(0, 160)}): la hice a sangre, con el titular y la firma en el aire de la foto.`);
            for (const x of otra.decisiones ?? []) decidir(n, x);
            hecho = otra;
          }
        }
        const cierre = pieza.formato === 'carrusel' && n === plan.diapositivas.length;
        const textoObligatorio = pieza.formato === 'post' || n === 1 || cierre;
        const textoIlegible = async (visual: VisualCompuesto, zonaPropia = false) => {
          const receta = d.visual.receta;
          const titulo = receta.textos.find(t => t.clave === receta.titular.texto)?.texto;
          const firma = receta.textos.find(t => t.clave === receta.firma?.texto)?.texto ?? local.marca.nombre;
          if (cierre && !zonaPropia && !visual.receta.firma && !seLee(firma, [titulo ?? ''])) return true;
          if (!visual.movil || !this.d.leerTextoMovil) return false;
          await mesa({ id: revisor, rol: 'revisor', n, accion: `Lee el texto de la ${n} a tamaño de móvil`, zona: { x: 0.05, y: 0.04, w: 0.9, h: 0.36 } });
          const lineas = await this.d.leerTextoMovil(visual.movil).finally(() => mesa({ id: revisor, rol: 'revisor' }));
          if (!lineas.length) return false;
          return Boolean(titulo && (zonaPropia || visual.receta.esqueleto !== 'COLUMNA') && !seLee(titulo, lineas)) ||
            (cierre && !seLee(firma, lineas));
        };
        if (textoObligatorio && (!hecho.png || hecho.problemas.some(p => /^(PRODUCTO_PEQUEÑO|LEGIBILIDAD)/.test(p)) || await textoIlegible(hecho))) {
          if (this.d.componerFotografiaConTexto) {
            await mesa({ id: maquetador, rol: 'maquetador', n, accion: `Busca una zona propia para el texto de la ${n}`, zona: { x: 0.06, y: 0.62, w: 0.88, h: 0.32 } });
            hecho = await this.d.componerFotografiaConTexto({ ...entradaBase, foto, salida: this.rutaArchivo(conversacion, `${carpeta}/d${n}-texto`) }, d.visual.receta, n === 1);
            if (hecho.png && await textoIlegible(hecho, true)) {
              hecho = { ...hecho, png: undefined, problemas: [...hecho.problemas, 'El texto aprobado no se lee a tamaño móvil.'] };
            }
            if (hecho.png) decidir(n, 'La fotografía conserva el texto aprobado en una zona propia de la maqueta.');
          } else {
            hecho = { ...hecho, png: undefined };
          }
          if (!hecho.png) {
            await this.paso(conversacion, piezaId, texto, 'error');
            return { n, foto: foto.activo.id, problemas: ['No se pudo componer el texto obligatorio.', ...hecho.problemas], decisiones: decisiones.get(n) ?? [], capas: [] };
          }
        }
        if (!hecho.png && d.visual.foto === 'generada') {
          // El texto no cabe sin estropear la foto: se entrega la foto, que es buena, antes que un diseño degradado.
          decidir(n, `El texto no cabía sin tapar la foto (${hecho.problemas.slice(0, 2).join(' · ').slice(0, 200)}): va la foto sola.`);
          const sola = { n, ...(await guardar(n, foto.ruta, true)), problemas: [], foto: foto.activo.id, soloFoto: true, decisiones: decisiones.get(n) ?? [] };
          await this.paso(conversacion, piezaId, texto, 'hecho');
          return sola;
        }
        await mesa({ id: maquetador, rol: 'maquetador', n, accion: `Exporta las capas de la ${n}`, apuntar: false });
        const guardada = hecho.png ? await guardar(n, hecho.png, false, hecho.capas) : undefined;
        await this.paso(conversacion, piezaId, texto, guardada ? 'hecho' : 'error');
        await mesa({ id: maquetador, rol: 'maquetador' });
        return { n, ...(guardada ?? {}), capas: guardada?.capas ?? [], problemas: hecho.problemas, foto: foto.activo.id, decisiones: decisiones.get(n) ?? [] };
      };
      let siguienteLamina = 0;
      const maquetador = async (puesto: number) => {
        for (let k = siguienteLamina++; k < plan.diapositivas.length; k = siguienteLamina++) {
          const hecha = await maquetar(k, plan.diapositivas[k]!, puesto);
          await mesa({ id: `maquetador-${puesto}`, rol: 'maquetador' });
          resultado[k] = hecha;
          // Cada lámina, a la vista en cuanto está (la web la compone delante del cliente).
          if (hecha.png) {
            await this.cambiar(conversacion, (cc) => {
              const p = cc.piezas.find((x) => x.id === piezaId)!;
              p.diapositivas = [...p.diapositivas.filter((x) => x.n !== hecha.n), hecha].sort((a, b) => a.n - b.n);
            });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, plan.diapositivas.length) }, (_, w) => maquetador(w + 1)));
      producidas.push(...resultado.filter((x): x is Pieza['diapositivas'][number] => Boolean(x)));

      const listas = producidas.filter((x) => x.png).length;
      await this.cambiar(conversacion, (cc) => {
        const p = cc.piezas.find((x) => x.id === piezaId)!;
        p.diapositivas = producidas;
        p.costeRealUsd = Math.round(coste * 1000) / 1000;
        const total = plan.diapositivas.length;
        const completa = listas === total;
        p.estado = completa ? 'LISTA' : 'ERROR';
        if (!completa) {
          const detalle = producidas.filter(x => !x.png && x.problemas[0]).map(x => `Lámina ${x.n}. ${x.problemas[0]}`);
          p.error = [`Entrega incompleta. Se han terminado ${listas} de ${total} láminas.`, ...detalle].join(' ');
        }
        const conErrores = producidas.filter((x) => x.png && x.problemas.length).map((x) => x.n);
        const decididas = producidas.flatMap((x) => x.decisiones.slice(0, 1).map((t) => `**${x.n}:** ${t}`)).slice(0, 4);
        cc.mensajes.push(
          this.mensaje(
            'asistente',
            completa
              ? `Aquí está${pieza.formato === 'carrusel' ? ` el carrusel (${listas} de ${total} diapositivas)` : ' el post'}.${conErrores.length ? ` La${conErrores.length > 1 ? 's' : ''} ${conErrores.join(', ')} tiene${conErrores.length > 1 ? 'n' : ''} detalles que el código midió (contraste o solape): dime si la rehago.` : ''}${decididas.length ? `\n\nLo que decidí por el camino:\n${decididas.map((t) => `- ${t}`).join('\n')}` : ''}\n\nPídeme cualquier cambio.`
              : p.error!,
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
    } finally {
      await this.despejarMesa(conversacion, piezaId);
    }
  }
}

/** Respaldo para imperativos inequívocos si el director propone producir otra pieza. */
function esRetoqueDeDiseno(pedido: string): boolean {
  const t = pedido.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (/\b(?:nuevo|otro) (?:post|carrusel)|\b(?:post|carrusel|foto|toma) nuev[oa]|\botra (?:foto|toma)\b/.test(t)) return false;
  return /\b(?:mueve|centra|alinea|cambia|cambiar|pon|quita|anade|agrega|ajusta|desplaza|sube|baja|acerca|mas al centro|otra tipografia|otra fuente)\b/.test(t)
    && /\b(?:diseno|texto|titulo|titular|letras?|tipografia|fuente|chips?|sello|alineacion|margen|color|logo|composicion)\b/.test(t);
}
