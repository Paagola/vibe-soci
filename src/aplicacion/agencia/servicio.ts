import { entregarPublicacion } from './entrega.js';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { escribirJson } from '../../adaptadores/ficheros/json.js';
import { PlanCampana, ReferenciaSemanal, SolicitudCampana, type ContextoCampana } from '../../dominio/campana.js';
import type { Conversacion } from '../../dominio/chat.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { Marca } from '../../dominio/modelos.js';
import { validar } from '../../dominio/validacion.js';
import type { AgentesCampana } from './agentes.js';
import type { ServicioChat } from '../chat/servicioChat.js';

const Slug = Marca.shape.slug;
export const PedidoAgencia = z.object({
  solicitud: SolicitudCampana,
  hecho: z.string().trim().max(400).default(''),
  renovar: z.boolean().default(false),
  anticipar: z.boolean().default(false),
});
export const ResultadoCampana = z.object({
  valor: z.number().int().nonnegative(),
  primerosSieteDias: z.boolean().optional(),
  nota: z.string().trim().max(400).default(''),
});

const Registro = z.object({
  referenciaSemanal: ReferenciaSemanal.optional(), anticipacionDetenida: z.boolean().optional(),
  id: z.string(), pedido: PedidoAgencia, plan: PlanCampana, evidencias: z.record(z.string(), z.string()),
  seguimiento: z.record(z.string(), z.object({ entrega: z.string().optional(), conversacion: z.string().optional(), avisoProduccion: z.string().optional(), resultado: ResultadoCampana.optional() })),
});
const Cartera = z.object({
  campanas: z.array(Registro),
  renovacion: z.object({
    serie: z.string(), anticipar: z.boolean(), proxima: z.iso.date(), objetivo: z.string(), semanas: z.number().int().positive(),
    error: z.string().optional(), reintentarDesde: z.number().optional(), fallos: z.number().int().optional(),
  }).nullable(),
});
type Cartera = z.infer<typeof Cartera>;
type Registro = z.infer<typeof Registro>;
type Pedido = z.infer<typeof PedidoAgencia>;
type Productor = Pick<ServicioChat, 'abrirPiezaDeCampana' | 'hechosParaCampana' | 'locales' | 'leer'>;

interface DepsAgencia {
  carpeta: string;
  marca(local: string): Promise<Marca>;
  agentes(local: string): AgentesCampana;
  productor?: Productor;
  archivoChat?(conversacion: string, archivo: string): string;
  perfil?(local: string): Promise<{ voz?: string; restricciones: string[] }>;
  ahora(): Date;
  zonaHoraria: string;
}

function fechaRelativa(inicio: string, dias: number): string {
  const d = new Date(inicio + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function etapa(c: Conversacion) {
  const p = c.piezas.at(-1);
  if (p?.estado === 'LISTA') return 'Pieza lista';
  if (p?.estado === 'PRODUCIENDO') return 'Produciendo imágenes';
  if (p?.estado === 'DESCARTADA') return 'Plan descartado';
  if (c.mensajes.some(m => m.bloques.some(b => b.tipo === 'referencias' && b.estado === 'PENDIENTE'))) return 'Elegir referencia';
  if (c.pensando) return 'Preparando el plan';
  if (p?.estado === 'ERROR' || c.mensajes.at(-1)?.bloques.some(b => b.tipo === 'error')) return 'Revisar en el estudio';
  if (p?.plan) return 'Plan listo para aprobar';
  return c.hechos ? 'Preparando el plan' : 'Falta confirmar la foto del plato';
}

function vista(local: string, r: Registro) {
  return {
    id: r.id, local, solicitud: r.pedido.solicitud, nombre: r.plan.nombre, estrategia: r.plan.estrategia, fundamento: r.plan.fundamento,
    referenciaSemanal: r.referenciaSemanal,
    piezas: r.plan.piezas.map((p, i) => ({
      ...p, fecha: fechaRelativa(r.pedido.solicitud.inicio, p.dia), evidencia: r.evidencias[p.fuente], ...r.seguimiento[i],
    })),
  };
}

/** Cada pieza aporta un solo recuento. Se conserva el grupo con más observaciones
 * del mismo objetivo y, si empatan, el primero de las campañas más recientes. */
function referenciaSemanal(cartera: Cartera, objetivo: string, inicio: string) {
  const grupos = new Map<string, { pieza: PlanCampana['piezas'][number]; valores: number[] }>();
  for (const registro of cartera.campanas.filter(r => r.pedido.solicitud.objetivo === objetivo).slice(0, 6)) {
    for (const [i, pieza] of registro.plan.piezas.entries()) {
      const resultado = registro.seguimiento[i]?.resultado;
      if (!resultado?.primerosSieteDias || fechaRelativa(registro.pedido.solicitud.inicio, pieza.dia + 7) > inicio) continue;
      const clave = JSON.stringify([pieza.formato, pieza.metrica, pieza.llamada]);
      const grupo = grupos.get(clave) ?? { pieza, valores: [] };
      grupo.valores.push(resultado.valor);
      grupos.set(clave, grupo);
    }
  }
  const grupo = [...grupos.values()].sort((a, b) => b.valores.length - a.valores.length)[0];
  if (!grupo || grupo.valores.length < 2) return;
  const valores = grupo.valores.sort((a, b) => a - b);
  const mitad = Math.floor(valores.length / 2);
  return { formato: grupo.pieza.formato, llamada: grupo.pieza.llamada, metrica: grupo.pieza.metrica,
    muestras: valores.length, mediana: (valores[mitad]! + valores[Math.floor((valores.length - 1) / 2)]!) / 2 };
}

/** Un calendario y una renovación por negocio y modo. Las mutaciones de un mismo local se ejecutan en orden. */
export class Agencia {
  private readonly colas = new Map<string, Promise<unknown>>();
  constructor(private readonly d: DepsAgencia) {}

  private ruta(local: string) {
    validar(Slug, local, 'El identificador del local no es válido.');
    return join(this.d.carpeta, local, 'cartera.json');
  }

  private async leer(local: string): Promise<Cartera> {
    try {
      return Cartera.parse(JSON.parse(await readFile(this.ruta(local), 'utf8')));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { campanas: [], renovacion: null };
      throw e;
    }
  }

  private async cambiar<T>(local: string, f: (c: Cartera) => Promise<T>): Promise<T> {
    const ruta = this.ruta(local);
    const turno = (this.colas.get(local) ?? Promise.resolve()).catch(() => {}).then(async () => {
      const c = await this.leer(local);
      const resultado = await f(c);
      await escribirJson(ruta, c);
      return resultado;
    });
    this.colas.set(local, turno);
    try {
      return await turno;
    } finally {
      if (this.colas.get(local) === turno) this.colas.delete(local);
    }
  }

  async actividad(local: string) {
    const c = await this.leer(local);
    const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: this.d.zonaHoraria }).format(this.d.ahora());
    const pendientes = c.campanas.filter(r => r.pedido.anticipar && !r.anticipacionDetenida).flatMap(r =>
      r.plan.piezas.filter((p, i) => {
        const estado = r.seguimiento[i];
        return !estado?.entrega && (estado?.conversacion || fechaRelativa(r.pedido.solicitud.inicio, p.dia) >= hoy);
      }));
    const pasos = c.campanas.flatMap(r => Object.values(r.seguimiento));
    return { renovacion: c.renovacion, preparacion: Boolean(this.d.productor && (pendientes.length || c.renovacion?.anticipar)),
      campanas: c.campanas.length, piezas: c.campanas.reduce((n, r) => n + r.plan.piezas.length, 0),
      entregas: pasos.filter(p => p.entrega).length, incidencias: pasos.filter(p => p.avisoProduccion).length };
  }

  async listar(local: string) {
    this.ruta(local);
    await this.d.marca(local);
    const c = await this.leer(local);
    const campanas = await Promise.all(c.campanas.map(async registro => {
      const campana = vista(local, registro);
      return { ...campana, piezas: await Promise.all(campana.piezas.map(async pieza => {
        if (!pieza.conversacion || !this.d.productor) return pieza;
        const chat = await this.d.productor.leer(pieza.conversacion).catch(() => undefined);
        const estadoProduccion = chat?.encargoCampana?.local === local ? etapa(chat) : 'Reabrir en el estudio';
        const final = chat?.encargoCampana?.local === local && chat.piezas.findLast(p =>
          p.estado === 'LISTA' && !p.edicion && p.indicaciones === chat.encargoCampana!.indicaciones &&
          p.formato === (pieza.formato === 'historia' ? 'post' : pieza.formato) && p.diapositivas.length === pieza.laminas);
        const imagenesDirector = final ? [...final.diapositivas].sort((a, b) => a.n - b.n).flatMap(d => d.png ? [d.png] : []) : [];
        return { ...pieza, estadoProduccion, imagenesDirector };
      })) };
    }));
    return { campanas, renovacion: c.renovacion };
  }

  private async preparar(local: string, c: Cartera, id: string, pedido: Pedido, serie = id) {
    const existente = c.campanas.find(r => r.id === id);
    if (existente) {
      if (JSON.stringify(existente.pedido) !== JSON.stringify(pedido)) throw new ErrorDeUsuario('Esta petición ya se usó con otros datos.');
      return vista(local, existente);
    }
    const marca = await this.d.marca(local);
    const [platos, perfil] = await Promise.all([
      this.d.productor?.hechosParaCampana(local), this.d.perfil?.(local),
    ]);
    const hechos = {
      'marca.nombre': marca.nombre, 'marca.ciudad': marca.ciudad,
      ...(marca.descripcion ? { 'marca.descripcion': marca.descripcion } : {}),
      ...(marca.web ? { 'marca.web': marca.web } : {}),
      ...(marca.instagram ? { 'marca.instagram': marca.instagram } : {}),
      ...platos, ...(pedido.hecho ? { 'propietario.dato': pedido.hecho } : {}),
    };
    const historial = c.campanas.slice(0, 4).flatMap(r => r.plan.piezas.map((p, i) => {
      const resultado = r.seguimiento[i]?.resultado;
      return JSON.stringify({
        fecha: fechaRelativa(r.pedido.solicitud.inicio, p.dia), objetivo: r.pedido.solicitud.objetivo,
        formato: p.formato, enfoque: p.enfoque, metrica: p.metrica, resultado: resultado ?? null,
      });
    }));
    const referencia = referenciaSemanal(c, pedido.solicitud.objetivo, pedido.solicitud.inicio);
    const contexto: ContextoCampana = {
      referenciaSemanal: referencia,
      solicitud: pedido.solicitud, nombreLocal: marca.nombre, hechos, historial,
      voz: [perfil?.voz || marca.tonos.join(', '), ...(perfil?.restricciones ?? [])].join('\n'),
    };
    const plan = await this.d.agentes(local).planificar(contexto);
    const registro = Registro.parse({ id, pedido, plan, referenciaSemanal: referencia, evidencias: hechos, seguimiento: {} });
    c.campanas.unshift(registro);
    if (pedido.renovar) c.renovacion = {
      serie, anticipar: pedido.anticipar, objetivo: pedido.solicitud.objetivo, semanas: pedido.solicitud.semanas,
      proxima: fechaRelativa(pedido.solicitud.inicio, pedido.solicitud.semanas * 7),
    };
    return vista(local, registro);
  }

  crear(local: string, id: string, pedido: Pedido) {
    return this.cambiar(local, c => this.preparar(local, c, id, pedido));
  }

  async archivoDeEntrega(local: string, id: string, indice: number, archivo: string) {
    const c = await this.leer(local);
    const { r, pieza } = this.buscar(c, id, indice);
    const entrega = r.seguimiento[indice]?.entrega;
    const archivos = Array.from({ length: pieza.laminas }, (_, i) => String(i + 1).padStart(2, '0') + '.png');
    if (!entrega || !/^campana-[a-f0-9]{40}$/.test(entrega) || !['publicacion.json', ...archivos].includes(archivo)) {
      throw new ErrorDeUsuario('Ese archivo de entrega no está disponible.');
    }
    return join(this.d.carpeta, local, 'salidas', entrega, archivo);
  }

  async cancelarRenovacion(local: string) {
    this.ruta(local);
    await this.d.marca(local);
    await this.cambiar(local, async c => {
      c.renovacion = null;
      for (const r of c.campanas) if (r.pedido.anticipar) r.anticipacionDetenida = true;
    });
  }

  private buscar(c: Cartera, id: string, indice: number) {
    const r = c.campanas.find(r => r.id === id);
    const pieza = r?.plan.piezas[indice];
    if (!r || !pieza) throw new ErrorDeUsuario('No encuentro esa pieza en las campañas de este local.');
    return { r, pieza };
  }

  resultado(local: string, id: string, indice: number, resultado: z.infer<typeof ResultadoCampana>) {
    return this.cambiar(local, async c => {
      const { r } = this.buscar(c, id, indice);
      r.seguimiento[indice] = { ...r.seguimiento[indice], resultado };
      return vista(local, r);
    });
  }

  abrir(local: string, id: string, indice: number) {
    return this.cambiar(local, c => this.abrirEnEstudio(c, local, id, indice));
  }

  private async abrirEnEstudio(c: Cartera, local: string, id: string, indice: number) {
    const { r, pieza: p } = this.buscar(c, id, indice);
    const productor = this.d.productor;
    if (!productor) throw new ErrorDeUsuario('La producción de imágenes de campaña se abre en el estudio en modo real.');
    if (!(await productor.locales()).some(l => l.slug === local)) throw new ErrorDeUsuario('Completa la ficha de marca y sus tipografías para producir en este local.');
    const estable = createHash('sha256').update(JSON.stringify([local, id, indice])).digest('hex').slice(0, 40);
    const conversacion = await productor.abrirPiezaDeCampana('campana-' + estable, {
      local, titulo: p.enfoque, formato: p.formato === 'historia' ? 'post' : p.formato, laminas: p.laminas,
      ...(p.formato === 'historia' ? { canal: 'historia' as const } : {}),
      brief: { campana: r.plan.nombre, objetivo: r.pedido.solicitud.objetivo, estrategia: r.plan.estrategia,
        fecha: fechaRelativa(r.pedido.solicitud.inicio, p.dia), audiencia: p.audiencia, proposito: p.proposito,
        motivoFormato: p.motivoFormato, llamada: p.llamada, metrica: p.metrica },
      ...(p.fuente.startsWith('plato:') ? { origen: p.fuente.slice(6), evidenciaOrigen: r.evidencias[p.fuente] } : {}),
      indicaciones: [
        r.plan.nombre, r.plan.estrategia, ...(r.plan.fundamento ? ['Fundamento: ' + r.plan.fundamento] : []), 'Objetivo del dueño: ' + r.pedido.solicitud.objetivo,
        'Fecha prevista: ' + fechaRelativa(r.pedido.solicitud.inicio, p.dia),
        ...(p.formato === 'historia' ? ['Historia vertical 9:16. Componer en la zona segura para la interfaz.'] : []),
        ...(p.motivoFormato ? ['Por qué este formato: ' + p.motivoFormato] : []),
        'Para quién: ' + p.audiencia, 'Para qué: ' + p.proposito, 'Enfoque: ' + p.enfoque,
        'Dato documentado: ' + r.evidencias[p.fuente], 'Pie de publicación: ' + p.texto,
        'Acción: ' + p.llamada, 'Medir: ' + p.metrica,
        ...p.guion.map((g, i) => 'Lámina ' + (i + 1) + ': ' + g),
      ].join('\n'),
    });
    r.seguimiento[indice] = { ...r.seguimiento[indice], conversacion, avisoProduccion: undefined };
    return conversacion;
  }

  private siguienteEncargo(c: Cartera, hoy: string) {
    const manana = fechaRelativa(hoy, 1);
    for (const r of c.campanas) {
      if (!r.pedido.anticipar || r.anticipacionDetenida) continue;
      const indice = r.plan.piezas.findIndex((p, i) => {
        const fecha = fechaRelativa(r.pedido.solicitud.inicio, p.dia);
        const estado = r.seguimiento[i];
        return fecha >= hoy && fecha <= manana && !estado?.conversacion && !estado?.avisoProduccion;
      });
      if (indice >= 0) return { r, indice };
    }
  }

  private async entregarListas(local: string, cartera: Cartera) {
    const productor = this.d.productor;
    const archivo = this.d.archivoChat;
    if (!productor || !archivo) return;
    for (const r of cartera.campanas) {
      if (!r.pedido.anticipar || r.anticipacionDetenida) continue;
      for (const [i, p] of r.plan.piezas.entries()) {
        const estado = r.seguimiento[i];
        if (!estado?.conversacion || estado.entrega || estado.avisoProduccion) continue;
        const id = estado.conversacion;
        const chat = await productor.leer(id).catch(() => undefined);
        if (chat?.encargoCampana?.local !== local) continue;
        const pieza = chat.piezas.findLast(pieza => pieza.estado === 'LISTA' && !pieza.edicion &&
          pieza.encargo?.local === local && pieza.indicaciones === chat.encargoCampana!.indicaciones &&
          pieza.formato === (p.formato === 'historia' ? 'post' : p.formato) && pieza.diapositivas.length === p.laminas);
        if (!pieza) continue;
        await this.cambiar(local, async c => {
          const { r: actual } = this.buscar(c, r.id, i);
          const seguimiento = actual.seguimiento[i];
          if (!seguimiento || seguimiento.entrega || actual.anticipacionDetenida) return;
          await entregarPublicacion(join(this.d.carpeta, local, 'salidas'), {
            id, local, fecha: fechaRelativa(r.pedido.solicitud.inicio, p.dia),
            texto: p.texto, formato: p.formato, metrica: p.metrica, campana: r.id, indice: i,
          }, pieza, f => archivo(id, f));
          seguimiento.entrega = id;
        }).catch(async e => {
          await this.cambiar(local, async c => {
            const { r: actual } = this.buscar(c, r.id, i);
            actual.seguimiento[i]!.avisoProduccion = 'Revisa la entrega de las imágenes. ' + String(e);
          });
        });
      }
    }
  }

  /** Reanuda al arrancar. Si el estudio estuvo cerrado, solo prepara el periodo actual. */
  async renovarPendientes(avisar: (m: string) => void): Promise<void> {
    const ahora = this.d.ahora();
    const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: this.d.zonaHoraria }).format(ahora);
    const locales = await readdir(this.d.carpeta).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    });
    for (const local of locales.filter(l => Slug.safeParse(l).success)) {
      const vence = (c: Cartera) => c.renovacion && c.renovacion.proxima <= hoy && (c.renovacion.reintentarDesde ?? 0) <= +ahora;
      try {
        const cartera = await this.leer(local);
        if (vence(cartera)) await this.cambiar(local, async c => {
          if (!vence(c)) return;
          const renovacion = c.renovacion!;
          const { semanas, objetivo, serie, anticipar } = renovacion;
          try {
            // Un especial de la primera campaña puede haber caducado al renovar.
            await this.preparar(local, c, 'periodo-' + serie + '-' + hoy, {
              solicitud: { objetivo, semanas, inicio: hoy }, hecho: '', renovar: true, anticipar,
            }, serie);
          } catch (e) {
            renovacion.fallos = (renovacion.fallos ?? 0) + 1;
            renovacion.error = e instanceof Error ? e.message : String(e);
            renovacion.reintentarDesde = +ahora + Math.min(24, 2 ** Math.min(5, renovacion.fallos - 1)) * 3600000;
            avisar('Renovación de ' + local + ': ' + renovacion.error);
          }
        });
        await this.entregarListas(local, cartera);
        if (this.d.productor && this.siguienteEncargo(vence(cartera) ? await this.leer(local) : cartera, hoy)) {
          await this.cambiar(local, async c => {
            const tarea = this.siguienteEncargo(c, hoy);
            if (!tarea) return;
            const { r, indice } = tarea;
            try {
              await this.abrirEnEstudio(c, local, r.id, indice);
            } catch (e) {
              r.seguimiento[indice] = { ...r.seguimiento[indice], avisoProduccion: e instanceof Error ? e.message : String(e) };
            }
          });
        }
      } catch (e) {
        avisar('No se pudo leer el calendario de ' + local + ': ' + String(e));
      }
    }
  }
}
