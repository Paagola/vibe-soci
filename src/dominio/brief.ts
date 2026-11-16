/**
 * Productor (fase 1): el brief del encargo de un post o carrusel. Única fuente de verdad del encargo: hechos, inventario
 * (inmutable una vez lo confirma el usuario), plan de diapositivas, restricciones y presupuesto. Dominio puro.
 */
import { z } from 'zod';
import { Estetica } from './diseno/estetica.js';
import { ErrorDeUsuario } from './errores.js';
import { type ElementoComparable, huellaDelInventario, textoDelInventario } from './inventario.js';
import { MAX_INTENTOS_SEGUIDOS } from './post.js';
import { segmentoDelElemento } from './nota.js';
import { EXPORTACIONES_POR_FORMATO, TAMANO_PROPORCION } from './reglas.js';

export const ViaDeConfirmacion = z.enum(['web', 'terminal']);
export type ViaDeConfirmacion = z.infer<typeof ViaDeConfirmacion>;

export const ElementoDelInventario = z.object({
  nombre: z.string().min(1),
  estado: z.string().min(1),
  recuento: z.number().int().positive().nullable(),
  cortados: z.number().int().nonnegative().optional(),
  origen: z.enum(['NOTA', 'FOTO']),
}).strict();
export type ElementoDelInventario = z.infer<typeof ElementoDelInventario>;

export const Inventario = z.object({
  estado: z.enum(['PROPUESTO', 'CONFIRMADO']),
  elementos: z.array(ElementoDelInventario).min(1),
  huella: z.string().regex(/^[0-9a-f]{64}$/),
  confirmadoEn: z.string().optional(),
  confirmadoPor: z.object({ via: ViaDeConfirmacion }).strict().optional(),
}).strict().superRefine((inv, ctx) => {
  if (inv.huella !== huellaDelInventario(inv.elementos)) {
    ctx.addIssue({ code: 'custom', message: 'La huella no corresponde a los elementos del inventario.', input: inv.huella });
  }
  if (inv.estado === 'CONFIRMADO' && (inv.confirmadoEn === undefined || inv.confirmadoPor === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Un inventario CONFIRMADO necesita confirmadoEn y confirmadoPor.', input: inv.estado });
  }
  if (inv.estado === 'PROPUESTO' && (inv.confirmadoEn !== undefined || inv.confirmadoPor !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Un inventario PROPUESTO no puede tener confirmadoEn ni confirmadoPor.', input: inv.estado });
  }
});
export type Inventario = z.infer<typeof Inventario>;

export const Lienzo = z.object({
  proporcion: z.literal('3:4'),
  ancho: z.number().int(),
  alto: z.number().int(),
  exporta: z.array(z.enum(['3:4', '4:5', '9:16'])).min(1),
}).strict().refine((l) => JSON.stringify(l) === JSON.stringify(lienzoDelEstudio()), 'El lienzo lo dice el código (dominio/reglas.ts), no se elige.');
export type Lienzo = z.infer<typeof Lienzo>;

export const DiapositivaDelPlan = z.object({
  n: z.number().int().positive(),
  papel: z.enum(['portada', 'detalle', 'cierre']),
  foto: z.enum(['FOTO_ELEGIDA', 'TOMA_NUEVA', 'FOTO_DEL_DUENO', 'RECORTE']),
  elemento: z.string().min(1).optional(),
  para: z.string().min(1),
}).strict();
export type DiapositivaDelPlan = z.infer<typeof DiapositivaDelPlan>;

export const REGLAS_DE_MARCA = ['sin logotipo inventado', 'sin precios', 'sin premios', 'sin afirmaciones comerciales'] as const;

export const BriefDelEncargo = z.object({
  esquema: z.literal('post/brief@1'),
  proyecto: z.string().min(1),
  local: z.string().min(1),
  version: z.number().int().positive(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
  /** CODIGO: lo escribe el código (fase 1, sin IA). PRODUCTOR: con el productor de IA (fase 2). */
  modo: z.enum(['CODIGO', 'PRODUCTOR']),
  marca: z.object({
    nombre: z.string(),
    ciudad: z.string(),
    descripcion: z.string(),
    tonos: z.array(z.string()),
    instagram: z.string().optional(),
    web: z.string().optional(),
  }).strict(),
  lienzo: Lienzo,
  hechos: z.object({
    nota: z.string().min(3),
    inventario: Inventario,
    datosPorConfirmar: z.array(z.string()),
  }).strict(),
  idea: z.object({ concepto: z.string().min(1), titular: z.string().optional(), porQue: z.string().min(1) }).strict().nullable(),
  formato: z.enum(['post', 'carrusel']),
  estetica: Estetica.optional(),
  referencia: z.object({ id: z.string(), familia: z.string().optional() }).strict().optional(),
  plan: z.array(DiapositivaDelPlan).min(1),
  restricciones: z.object({
    fidelidad: z.enum(['FLEXIBLE', 'ESTRICTA']),
    noInventar: z.literal(true),
    usoFotoReal: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']),
    reglasDeMarca: z.array(z.string()).min(1),
  }).strict(),
  presupuesto: z.object({ fotos: z.number().int().nonnegative(), llamadasTexto: z.number().int().nonnegative() }).strict(),
}).strict().superRefine((b, ctx) => {
  const plan = b.plan;
  plan.forEach((d, i) => {
    if (d.n !== i + 1) ctx.addIssue({ code: 'custom', message: `La diapositiva ${i + 1} tiene n=${d.n}; n tiene que ir 1, 2, 3… en orden.`, input: d.n, path: ['plan', i, 'n'] });
  });
  if (plan[0]?.papel !== 'portada') ctx.addIssue({ code: 'custom', message: 'La primera diapositiva tiene que ser la portada.', input: plan[0]?.papel, path: ['plan', 0, 'papel'] });
  if (b.formato === 'post' && plan.length !== 1) {
    ctx.addIssue({ code: 'custom', message: `Un post tiene exactamente 1 diapositiva (tiene ${plan.length}).`, input: plan.length, path: ['plan'] });
  }
  if (b.formato === 'carrusel') {
    if (plan.length < 3 || plan.length > 5) {
      ctx.addIssue({ code: 'custom', message: `Un carrusel tiene de 3 a 5 diapositivas (tiene ${plan.length}).`, input: plan.length, path: ['plan'] });
    }
    const ultima = plan[plan.length - 1];
    if (ultima?.papel !== 'cierre') ctx.addIssue({ code: 'custom', message: 'La última diapositiva de un carrusel es el cierre.', input: ultima?.papel, path: ['plan'] });
    plan.slice(1, -1).forEach((d, i) => {
      if (d.papel !== 'detalle') ctx.addIssue({ code: 'custom', message: 'Las diapositivas del medio de un carrusel son detalles.', input: d.papel, path: ['plan', i + 1, 'papel'] });
    });
  }
});
export type BriefDelEncargo = z.infer<typeof BriefDelEncargo>;

const MENSAJE_CONFIRMADO = 'El inventario está confirmado por el usuario: solo cambia con otra confirmación suya.';

/** Lienzo del estudio para los posts: lo fija el código (dominio/reglas.ts). */
export function lienzoDelEstudio(): { proporcion: '3:4'; ancho: number; alto: number; exporta: Array<'3:4' | '4:5' | '9:16'> } {
  return {
    proporcion: '3:4',
    ancho: TAMANO_PROPORCION['3:4'].ancho,
    alto: TAMANO_PROPORCION['3:4'].alto,
    exporta: [...EXPORTACIONES_POR_FORMATO.POST],
  };
}

export type ElementoEntrada = ElementoComparable & { dudoso?: boolean };
export interface TomaEntrada { elemento: string; real?: boolean; yaGenerada?: boolean }

/** El origen de un elemento: NOTA si la nota del dueño nombra su plato; si no, FOTO. */
function origenDe(nota: string, nombre: string): 'NOTA' | 'FOTO' {
  return segmentoDelElemento(nota, nombre) === undefined ? 'FOTO' : 'NOTA';
}

/** Tomas que el generador tiene que crear (máx. 3): las que no son reales ni ya están generadas. */
function tomasNuevasDe(tomas: readonly TomaEntrada[]): number {
  return Math.min(3, tomas.filter((t) => !t.real && !t.yaGenerada).length);
}

export function elementosDelInventario(nota: string, elementos: readonly ElementoEntrada[]): ElementoDelInventario[] {
  return elementos.map((e) => ({
    nombre: e.nombre,
    estado: e.estado,
    recuento: e.recuento,
    origen: origenDe(nota, e.nombre),
    ...(e.cortados !== undefined ? { cortados: e.cortados } : {}),
  }));
}

export function datosPorConfirmar(nota: string, elementos: readonly ElementoEntrada[]): string[] {
  const datos: string[] = [];
  for (const e of elementos) {
    if (origenDe(nota, e.nombre) === 'FOTO') datos.push(`«${e.nombre}»: lo ve el director en la foto; la nota del dueño no lo dice.`);
  }
  for (const e of elementos) {
    if (e.dudoso) datos.push(`«${e.nombre}»: el recuento es dudoso, míralo en la foto subida.`);
  }
  return datos;
}

export function planPorDefecto(formato: 'post' | 'carrusel', elementos: readonly ElementoComparable[], tomas: readonly TomaEntrada[]): DiapositivaDelPlan[] {
  const piezas: Array<Omit<DiapositivaDelPlan, 'n'>> = [{ papel: 'portada', foto: 'FOTO_ELEGIDA', para: 'el plato entero, con el titular' }];
  if (formato === 'carrusel') {
    if (tomas.length > 0) {
      for (const t of tomas.slice(0, 3)) {
        piezas.push({ papel: 'detalle', foto: t.real ? 'FOTO_DEL_DUENO' : 'TOMA_NUEVA', elemento: t.elemento, para: `el detalle de «${t.elemento}»` });
      }
    } else {
      for (const e of elementos.slice(0, 3)) {
        piezas.push({ papel: 'detalle', foto: 'RECORTE', elemento: e.nombre, para: 'un recorte de la foto elegida' });
      }
    }
    piezas.push({ papel: 'cierre', foto: 'FOTO_ELEGIDA', para: 'firma, ciudad e Instagram' });
  }
  return piezas.map((p, i) => ({ n: i + 1, ...p }));
}

/** Lo que autoriza el usuario al confirmar: las fotos y llamadas de texto de la pasada, más el margen de reintentos. */
export function presupuestoAutorizado(tomasNuevas: number, usadas: { fotos: number; llamadasTexto: number }): { fotos: number; llamadasTexto: number } {
  return {
    fotos: usadas.fotos + 1 + tomasNuevas + (MAX_INTENTOS_SEGUIDOS - 1),
    llamadasTexto: usadas.llamadasTexto + 3 * (MAX_INTENTOS_SEGUIDOS + tomasNuevas) + 6,
  };
}

/** Fase 1: la propuesta del productor la hace el código (sin IA): sin idea, plan por defecto. */
export function propuestaDelProductor(e: { formato: 'post' | 'carrusel'; nota: string; elementos: readonly ElementoEntrada[]; tomas: readonly TomaEntrada[] }): { modo: 'CODIGO'; idea: null; plan: DiapositivaDelPlan[]; datosPorConfirmar: string[] } {
  return {
    modo: 'CODIGO',
    idea: null,
    plan: planPorDefecto(e.formato, e.elementos, e.tomas),
    datosPorConfirmar: datosPorConfirmar(e.nota, e.elementos),
  };
}

export interface DatosParaElBrief {
  proyecto: string;
  local: string;
  nota: string;
  formato: 'post' | 'carrusel';
  estetica?: Estetica;
  referencia?: { id: string; familia?: string };
  usoFotoReal: 'PUBLICABLE' | 'SOLO_PRUEBA_COMPOSICION';
  marca: { nombre: string; ciudad: string; descripcion: string; tonos: string[]; instagram?: string; web?: string };
  elementos: readonly ElementoEntrada[];
  tomas: readonly TomaEntrada[];
}

export function crearBrief(d: DatosParaElBrief, ahora: string): BriefDelEncargo {
  const elementos = elementosDelInventario(d.nota, d.elementos);
  const propuesta = propuestaDelProductor({ formato: d.formato, nota: d.nota, elementos: d.elementos, tomas: d.tomas });
  return BriefDelEncargo.parse({
    esquema: 'post/brief@1',
    proyecto: d.proyecto,
    local: d.local,
    version: 1,
    creadoEn: ahora,
    actualizadoEn: ahora,
    modo: 'CODIGO',
    marca: {
      nombre: d.marca.nombre,
      ciudad: d.marca.ciudad,
      descripcion: d.marca.descripcion,
      tonos: d.marca.tonos,
      ...(d.marca.instagram !== undefined ? { instagram: d.marca.instagram } : {}),
      ...(d.marca.web !== undefined ? { web: d.marca.web } : {}),
    },
    lienzo: lienzoDelEstudio(),
    hechos: {
      nota: d.nota,
      inventario: { estado: 'PROPUESTO', elementos, huella: huellaDelInventario(elementos) },
      datosPorConfirmar: propuesta.datosPorConfirmar,
    },
    idea: null,
    formato: d.formato,
    ...(d.estetica !== undefined ? { estetica: d.estetica } : {}),
    ...(d.referencia !== undefined ? { referencia: d.referencia } : {}),
    plan: propuesta.plan,
    restricciones: {
      fidelidad: 'FLEXIBLE',
      noInventar: true,
      usoFotoReal: d.usoFotoReal,
      reglasDeMarca: [...REGLAS_DE_MARCA],
    },
    presupuesto: presupuestoAutorizado(tomasNuevasDe(d.tomas), { fotos: 0, llamadasTexto: 0 }),
  });
}

/** El único camino para confirmar (o volver a confirmar) el inventario: lo llama el orquestador cuando confirma el usuario. */
export function confirmarInventario(brief: BriefDelEncargo, d: { elementos: readonly ElementoEntrada[]; tomas: readonly TomaEntrada[] }, via: unknown, ahora: string, usadas: { fotos: number; llamadasTexto: number }): BriefDelEncargo {
  const viaValida = ViaDeConfirmacion.safeParse(via);
  if (!viaValida.success) {
    throw new ErrorDeUsuario('Solo el usuario confirma el inventario: la confirmación tiene que venir de la web o de una terminal interactiva.');
  }
  const elementos = elementosDelInventario(brief.hechos.nota, d.elementos);
  return BriefDelEncargo.parse({
    ...brief,
    version: brief.version + 1,
    actualizadoEn: ahora,
    hechos: {
      ...brief.hechos,
      inventario: {
        estado: 'CONFIRMADO',
        elementos,
        huella: huellaDelInventario(elementos),
        confirmadoEn: ahora,
        confirmadoPor: { via: viaValida.data },
      },
      datosPorConfirmar: datosPorConfirmar(brief.hechos.nota, d.elementos),
    },
    plan: planPorDefecto(brief.formato, d.elementos, d.tomas),
    presupuesto: presupuestoAutorizado(tomasNuevasDe(d.tomas), usadas),
  });
}

/** Cualquier otro cambio del brief. El inventario confirmado y los datos fijos (proyecto, local, nota) no cambian aquí. */
export function cambiarBrief(anterior: BriefDelEncargo, nuevo: BriefDelEncargo, ahora: string): BriefDelEncargo {
  if (nuevo.proyecto !== anterior.proyecto || nuevo.local !== anterior.local || nuevo.hechos.nota !== anterior.hechos.nota) {
    throw new ErrorDeUsuario('El proyecto, el local y la nota del dueño no cambian con un cambio del brief.');
  }
  if (anterior.hechos.inventario.estado === 'CONFIRMADO'
    && JSON.stringify(Inventario.parse(nuevo.hechos.inventario)) !== JSON.stringify(Inventario.parse(anterior.hechos.inventario))) {
    throw new ErrorDeUsuario(MENSAJE_CONFIRMADO);
  }
  return BriefDelEncargo.parse({ ...nuevo, version: anterior.version + 1, creadoEn: anterior.creadoEn, actualizadoEn: ahora });
}

/**
 * Antes de la confirmación: rehace el inventario propuesto, los datos por confirmar, el plan y el presupuesto con la
 * propuesta actual. Si nada cambia, devuelve el mismo objeto.
 */
export function actualizarInventarioPropuesto(brief: BriefDelEncargo, d: { elementos: readonly ElementoEntrada[]; tomas: readonly TomaEntrada[] }, ahora: string): BriefDelEncargo {
  if (brief.hechos.inventario.estado === 'CONFIRMADO') throw new ErrorDeUsuario(MENSAJE_CONFIRMADO);
  const elementos = elementosDelInventario(brief.hechos.nota, d.elementos);
  const candidato = BriefDelEncargo.parse({
    ...brief,
    hechos: {
      ...brief.hechos,
      inventario: { estado: 'PROPUESTO', elementos, huella: huellaDelInventario(elementos) },
      datosPorConfirmar: datosPorConfirmar(brief.hechos.nota, d.elementos),
    },
    plan: planPorDefecto(brief.formato, d.elementos, d.tomas),
    presupuesto: presupuestoAutorizado(tomasNuevasDe(d.tomas), { fotos: 0, llamadasTexto: 0 }),
  });
  const contenido = (b: BriefDelEncargo) => JSON.stringify([b.hechos.inventario, b.hechos.datosPorConfirmar, b.plan, b.presupuesto]);
  if (contenido(candidato) === contenido(brief)) return brief;
  return cambiarBrief(brief, candidato, ahora);
}

function textoDelPlan(plan: readonly DiapositivaDelPlan[]): string {
  return plan.map((d) => `${d.n} ${d.papel}${d.elemento ? ` «${d.elemento}»` : ''} (${d.foto}): ${d.para}`).join(' · ');
}

/** El brief en texto para los especialistas (directores y crítico). */
export function contextoDelBrief(brief: BriefDelEncargo): string {
  const { inventario, datosPorConfirmar: datos } = brief.hechos;
  const confirmado = inventario.estado === 'CONFIRMADO';
  const lineas = [
    `Brief v${brief.version} del encargo ${brief.proyecto} (${brief.formato}; lienzo ${brief.lienzo.ancho}×${brief.lienzo.alto}, ${brief.lienzo.proporcion}; se exporta en ${brief.lienzo.exporta.join(' y ')}).`,
    `Nota del dueño (manda sobre cómo se llama cada cosa): «${brief.hechos.nota}».`,
    `Inventario ${confirmado ? 'CONFIRMADO por el usuario (inmutable)' : 'PROPUESTO (sin confirmar)'}: ${textoDelInventario(inventario.elementos)}.`,
    `Plan: ${textoDelPlan(brief.plan)}.`,
    `Restricciones: fidelidad ${brief.restricciones.fidelidad}; no inventar ningún dato del restaurante; ${brief.restricciones.reglasDeMarca.join(', ')}.`,
  ];
  if (datos.length > 0) lineas.push(`Datos por confirmar: ${datos.join(' ')}`);
  return lineas.join('\n');
}

/** El añadido a la parada CONFIRMAR_ELEMENTOS. */
export function resumenParaLaParada(brief: BriefDelEncargo): string {
  const { inventario, datosPorConfirmar: datos } = brief.hechos;
  const texto = textoDelInventario(inventario.elementos);
  const lineas = ['  PRODUCTOR (código, sin IA; brief v' + brief.version + ' en brief.json):'];
  if (inventario.estado === 'PROPUESTO') {
    lineas.push(`    Inventario que congela tu --confirmo: ${texto}`);
  } else {
    lineas.push(`    Inventario confirmado por ti el ${inventario.confirmadoEn} (${inventario.confirmadoPor?.via}): ${texto}. Si lo cambias en la propuesta, tu --confirmo lo vuelve a confirmar.`);
  }
  lineas.push(`    Plan: ${textoDelPlan(brief.plan)}`);
  lineas.push(`    Datos por confirmar: ${datos.join(' ') || 'ninguno'}`);
  lineas.push(`    Presupuesto que autorizas: ≤ ${brief.presupuesto.fotos} fotos y ≤ ${brief.presupuesto.llamadasTexto} llamadas de texto en total.`);
  return lineas.join('\n');
}
