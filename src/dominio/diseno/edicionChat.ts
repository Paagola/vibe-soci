import { z } from 'zod';
import { lienzoDe, rectDeCaja } from './reticula.js';
import { Caja, Capa, EstiloTexto, Intencion, type Relacion } from './intencion.js';

const Id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Un parche nombra cada capa afectada. Las capas y los activos omitidos permanecen en su sitio. */
export const EdicionDeCapas = z.strictObject({
  quitar: z.array(Id).max(48).default([]),
  capas: z.array(z.strictObject({
    id: Id,
    campos: z.record(z.string(), z.unknown()).describe('Solo propiedades modificadas. Para añadir una capa, incluye su tipo y propiedades obligatorias.'),
    antesDe: Id.optional(),
    despuesDe: Id.optional(),
    fuente: Id.optional().describe('Fuente del catálogo solo para esta capa. Conserva las otras propiedades de su estilo.'),
  })).max(48).default([]),
  textos: z.record(Id, z.string().min(1).max(500)).default({}),
  estilos: z.record(Id, EstiloTexto).default({}),
  colores: z.record(Id, Color).default({}),
  chips: z.array(z.strictObject({
    id: Id,
    descripcion: z.string().min(5).max(600),
    caja: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().positive().max(0.7), h: z.number().positive().max(0.7) }),
    radio: z.number().min(0).max(600).default(0),
  })).max(6).default([]),
});
export type EdicionDeCapas = z.infer<typeof EdicionDeCapas>;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Las coordenadas y los demás objetos se pueden modificar por propiedad; los arrays se reemplazan enteros. */
function mezclar(antes: unknown, cambios: unknown, base: Intencion, nombre = ''): unknown {
  if (!esObjeto(cambios)) return cambios;
  let original = esObjeto(antes) ? antes : {};
  if (nombre === 'caja' && 'col' in original && ['x', 'y', 'w', 'h'].some((k) => k in cambios)) {
    const lienzo = lienzoDe(base.lienzo.formato);
    const r = rectDeCaja(Caja.parse(original), lienzo, base.reticula);
    original = { x: r.x / lienzo.ancho, y: r.y / lienzo.alto, w: r.w / lienzo.ancho, h: r.h / lienzo.alto };
  } else if (nombre === 'caja' && 'x' in original && 'col' in cambios) {
    original = {};
  }
  const entradas = Object.entries(cambios).map(([k, v]) => {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error(`Propiedad no admitida: ${k}.`);
    return [k, mezclar(original[k], v, base, k)];
  });
  return { ...original, ...Object.fromEntries(entradas) };
}

/** Capa.parse aplica valores por defecto y descarta claves desconocidas. En una edición descartarlas ocultaría un fallo. */
function exigirCamposAplicados(cambios: unknown, resultado: unknown, ruta: string) {
  if (Array.isArray(cambios) && Array.isArray(resultado)) {
    cambios.forEach((v, i) => exigirCamposAplicados(v, resultado[i], `${ruta}[${i}]`));
  } else if (esObjeto(cambios) && esObjeto(resultado)) {
    for (const [k, v] of Object.entries(cambios)) {
      if (!Object.hasOwn(resultado, k)) throw new Error(`Campo desconocido en la capa: ${ruta}.${k}.`);
      exigirCamposAplicados(v, resultado[k], `${ruta}.${k}`);
    }
  }
}

function relacionesVisibles(relaciones: Relacion[], capas: Capa[]): Relacion[] {
  const visibles = new Set(capas.filter((c) => !c.oculta).map((c) => c.id));
  const resultado: Relacion[] = [];
  for (const r of relaciones) {
    if ('sujeto' in r && !visibles.has(r.sujeto)) continue;
    if (r.tipo === 'noSolapar') {
      const textos = r.textos.filter((t) => visibles.has(t));
      if (textos.length) resultado.push({ ...r, textos });
    } else if (visibles.has(r.texto)) resultado.push(r);
  }
  return resultado;
}

export function aplicarEdicion(base: Intencion, parche: EdicionDeCapas, nuevosActivos: Record<string, string>): Intencion {
  const quitar = new Set(parche.quitar);
  for (const id of quitar) if (!base.capas.some((c) => c.id === id)) throw new Error(`No encuentro la capa «${id}».`);
  const capas = base.capas.filter((c) => !quitar.has(c.id));
  const estilos = { ...base.tokens.estilos };
  for (const [id, estilo] of Object.entries(parche.estilos)) {
    if (Object.hasOwn(estilos, id) && JSON.stringify(estilos[id]) !== JSON.stringify(estilo)) throw new Error(`Crea un estilo nuevo y asígnalo a las capas concretas. «${id}» ya pertenece a la entrega.`);
    estilos[id] = estilo;
  }
  for (const { id, campos, antesDe, despuesDe, fuente } of parche.capas) {
    if (antesDe && despuesDe) throw new Error(`Elige una sola posición para la capa «${id}».`);
    const i = capas.findIndex((c) => c.id === id);
    const anterior = capas[i];
    if (anterior && campos.tipo && campos.tipo !== anterior.tipo) throw new Error('Para cambiar el tipo, añade una capa nueva.');
    if ('activo' in campos && campos.activo !== (anterior && 'activo' in anterior ? anterior.activo : undefined)) {
      throw new Error('Una edición de diseño debe conservar el activo de cada capa.');
    }
    if (quitar.has(id) || ('id' in campos && campos.id !== id)) throw new Error(`La edición de «${id}» es contradictoria.`);
    // En JSON, null permite retirar la máscara y recuperar todo el encuadre conservando la misma fotografía.
    const retirarVentana = anterior?.tipo === 'imagen' && campos.ventana === null;
    const propiedades = { ...campos };
    const origen = retirarVentana ? { ...anterior, ventana: undefined } : anterior;
    if (retirarVentana) delete propiedades.ventana;
    const nueva = Capa.parse(mezclar(origen, { ...propiedades, id }, base));
    exigirCamposAplicados(propiedades, nueva, id);
    if (fuente) {
      if (!('estilo' in nueva) || !nueva.estilo || !estilos[nueva.estilo]) throw new Error(`«${id}» necesita una capa con estilo de texto para cambiar la fuente.`);
      const propio = `edicion-${id}-v${base.version + 1}`;
      estilos[propio] = { ...estilos[nueva.estilo]!, fuente };
      nueva.estilo = propio;
    }
    if (i >= 0) capas.splice(i, 1);
    let destino = i < 0 ? capas.length : i;
    const vecina = antesDe ?? despuesDe;
    if (vecina) {
      const posicion = capas.findIndex((c) => c.id === vecina);
      if (posicion < 0) throw new Error(`No encuentro la capa «${vecina}» para colocar «${id}».`);
      destino = posicion + (despuesDe ? 1 : 0);
    }
    capas.splice(destino, 0, nueva);
  }
  for (const chip of parche.chips) {
    if (capas.some((c) => c.id === chip.id) || chip.id in base.activos || !nuevosActivos[chip.id]) throw new Error(`El chip «${chip.id}» necesita un identificador y una imagen propios.`);
    capas.push(Capa.parse({ id: chip.id, tipo: 'imagen', activo: chip.id, caja: chip.caja, ...(chip.radio ? { ventana: { forma: 'redondeada', radio: chip.radio } } : {}) }));
  }
  const activos = { ...base.activos, ...nuevosActivos };
  for (const c of base.capas) {
    if (quitar.has(c.id) && 'activo' in c && !capas.some((otra) => 'activo' in otra && otra.activo === c.activo)) delete activos[c.activo];
  }
  if (base.activos.foto && !capas.some((c) => 'activo' in c && c.activo === 'foto' && !c.oculta)) throw new Error('La edición de diseño debe conservar una capa visible de la fotografía principal.');
  const siguiente = Intencion.parse({
    ...base, capas, activos, relaciones: relacionesVisibles(base.relaciones, capas), textos: { ...base.textos, ...parche.textos },
    tokens: { estilos, colores: { ...base.tokens.colores, ...parche.colores } },
  });
  if (JSON.stringify(siguiente) === JSON.stringify(base)) throw new Error('El director devolvió un diseño idéntico al anterior.');
  return { ...siguiente, padre: base.version, version: base.version + 1 };
}
