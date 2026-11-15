/**
 * Punto 1 (15/11): el carrusel de la orden única. La portada la escribe el director (su composición, como un post);
 * el resto lo coloca el código con la retícula, las voces y los colores de la portada, para que sea una serie:
 * - DETALLE (de dos a tres): la misma foto, ampliada sobre un elemento confirmado que el director ha situado en ella;
 *   su nombre en la voz del titular y una anotación a mano (su estado, tal como consta) con una flecha que lo señala;
 * - CIERRE: la firma del local en grande, con su ciudad y su Instagram, y la foto entera en una banda.
 * Ningún texto es nuevo: los nombres y estados salen de los elementos confirmados y la firma de los datos del local.
 * Dominio puro: devuelve maquetas en el dialecto, que compila compilarIntencion.
 */
import { conMayuscula, segmentoDelElemento } from '../nota.js';
import { contraste } from './color.js';
import type { CapaPropuesta, Carrusel, HechosDeLaPieza, Maqueta, TextoPropuesto } from './propuesta.js';

export interface EntornoDeCarrusel {
  colores: Array<{ token: string; hex: string }>;
  voces: { titular: string; firma: string; anotacion?: string };
  /** La estética admite la diagonal de color (color pop, maximalismo). */
  conDiagonal: boolean;
  /** F3.3: el papel de la foto del plato entero cuando la portada es una toma (recortes de los detalles y cierre). */
  fotoDeLaSerie?: string;
}

export interface Diapositiva {
  id: string;
  maqueta: Maqueta;
}

const COLUMNAS = 12;

/** El campo de la portada: el color de su capa «fondo» (o la tinta más oscura) y el de su diagonal, si la lleva. */
function camposDeLaPortada(portada: Maqueta, e: EntornoDeCarrusel): { campo: string; diagonal?: string } {
  const fondo = portada.capas.find((c) => c.tipo === 'fondo') as Extract<CapaPropuesta, { tipo: 'fondo' }> | undefined;
  const diagonal = portada.capas.find((c) => c.tipo === 'diagonal') as Extract<CapaPropuesta, { tipo: 'diagonal' }> | undefined;
  const oscura = [...e.colores].sort((a, b) => contraste(b.hex, '#FFFFFF') - contraste(a.hex, '#FFFFFF'))[0]!;
  return { campo: fondo?.color.slice(1) ?? oscura.token, ...(diagonal ? { diagonal: diagonal.color.slice(1) } : {}) };
}

/** La tinta de la marca que más contrasta con un color (los textos van sobre colores exactos). */
function tintaSobre(fondo: string, e: EntornoDeCarrusel, preferida?: string, ratio = 4.5): string {
  const hex = e.colores.find((c) => c.token === fondo)?.hex ?? '#000000';
  const pref = e.colores.find((c) => c.token === preferida);
  if (pref && pref.token !== fondo && contraste(pref.hex, hex) >= ratio * 1.3) return pref.token;
  return [...e.colores].filter((c) => c.token !== fondo).sort((a, b) => contraste(b.hex, hex) - contraste(a.hex, hex))[0]!.token;
}

/** Un estado confirmado, corto: hasta la primera coma, como mucho cinco palabras. */
function estadoCorto(estado: string): string {
  return (estado.split(/[,;(]/)[0] ?? estado).trim().split(/\s+/).slice(0, 5).join(' ');
}

const GRAMATICALES = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'sin', 'y', 'e', 'o', 'u']);

/** Las primeras palabras de un nombre (tres como mucho, sin acabar en «de», «con»…): un título que se lee grande. */
export function tituloCorto(t: string): string {
  const palabras = t.trim().split(/\s+/).slice(0, 3);
  while (palabras.length > 1 && GRAMATICALES.has(palabras[palabras.length - 1]!.toLowerCase())) palabras.pop();
  return palabras.join(' ');
}

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** F3.3: una toma propia de un elemento (su foto, por papel en la intención, y el elemento confirmado). */
export interface TomaDeCarrusel {
  papel: string;
  elemento: { nombre: string; estado: string };
}

export function diapositivasDeCarrusel(
  portada: Maqueta,
  carrusel: Carrusel | undefined,
  hechos: HechosDeLaPieza,
  e: EntornoDeCarrusel,
  tomas: TomaDeCarrusel[] = [],
): { diapositivas: Diapositiva[]; problemas: string[] } {
  const problemas: string[] = [];
  const diapositivas: Diapositiva[] = [];
  const { campo, diagonal } = camposDeLaPortada(portada, e);
  // La diagonal de la portada, repetida como una cuña entre los textos y la foto (en cada diapositiva, justo encima de
  // su banda de foto: así ningún texto queda partido entre dos colores).
  const fondo = (izquierda: number, derecha: number): CapaPropuesta[] => [
    { tipo: 'fondo', color: `@${campo}` },
    ...(diagonal && e.conDiagonal ? [{ tipo: 'diagonal' as const, color: `@${diagonal}`, izquierda, derecha }] : []),
  ];
  const vistos = new Set<string>();

  // F3.3 (punto 11): con tomas propias, cada detalle es su foto entera (no un recorte de la portada). Los elementos sin
  // toma (o cuya toma se descartó) vuelven a la alternativa barata: el recorte de la portada.
  const conToma = new Set(tomas.map((t) => normal(t.elemento.nombre)));
  // Si la portada recorta el plato (color pop, F1/F3), cada toma también va recortada, con el mismo filo y el mismo
  // fondo (textura y patrón flojo): la serie se lee como una. Si no, la toma va en una banda, como foto.
  const platoPortada = portada.capas.find((c) => c.tipo === 'plato') as Extract<CapaPropuesta, { tipo: 'plato' }> | undefined;
  const decorado = portada.capas.filter((c) => c.tipo === 'textura' || (c.tipo === 'patron' && c.suave));
  for (const t of tomas.slice(0, 3)) {
    vistos.add(normal(t.elemento.nombre));
    // El título, como lo llama el dueño si su nota nombra el elemento; si no, el nombre confirmado. Con mayúscula inicial.
    const delDueno = segmentoDelElemento(hechos.plato, t.elemento.nombre);
    const titulo = conMayuscula(tituloCorto(delDueno ?? t.elemento.nombre));
    const estado = estadoCorto(t.elemento.estado);
    const textos: TextoPropuesto[] = [delDueno ? { clave: 'titular', texto: titulo, fuente: 'PLATO', cita: delDueno } : { clave: 'titular', texto: titulo, fuente: 'ELEMENTO', cita: t.elemento.nombre }];
    const giro = diapositivas.length % 2 ? 6 : -6;
    const capas: CapaPropuesta[] = [
      { tipo: 'fondo', color: `@${campo}` },
      ...decorado.filter((c) => c.tipo === 'patron'),
      platoPortada
        ? { tipo: 'plato', activo: t.papel, caja: { col: [1, COLUMNAS], fila: [8, 16] }, ancho: 0.92, alinear: 'centro', giro, sombra: 'proyectada', ...(platoPortada.filo ? { filo: platoPortada.filo } : {}) }
        : { tipo: 'foto', encuadre: 'marco', caja: { col: [1, COLUMNAS], fila: [7, 16] }, sangra: true, activo: t.papel },
      { tipo: 'texto', id: 'titular', texto: 'titular', voz: e.voces.titular, caja: { col: [1, COLUMNAS], fila: [2, 4] }, ajuste: 'caja', alinear: 'izquierda', vertical: 'arriba', color: `@${tintaSobre(campo, e, undefined, 3)}`, relacion: 'aparte' },
    ];
    if (e.voces.anotacion) {
      textos.push({ clave: 'estado', texto: estado, fuente: 'ELEMENTO', cita: estado });
      // Recortada, la flecha llega al canto de arriba del elemento (al centro, lo cruzaba entero como un palo).
      capas.push({ tipo: 'anotacion', id: 'nota', texto: 'estado', voz: e.voces.anotacion, caja: { col: [5, COLUMNAS], fila: [5, 6] }, vertical: 'centro', tamano: 46, apunta: platoPortada ? { x: 0.5, y: 0.12 } : { x: 0.5, y: 0.5 }, hacia: { x: 0.56, y: 0.72 }, color: `@${tintaSobre(campo, e, diagonal, 3)}` });
    }
    capas.push(...decorado.filter((c) => c.tipo === 'textura'));
    diapositivas.push({ id: `detalle-${diapositivas.length + 1}`, maqueta: { ...portada, textos, capas, excepcion: 'Diapositiva de detalle de un carrusel: la firma va en la portada y en el cierre.' } });
  }

  // Con dos tomas propias o más, ningún recorte de la portada: mezclados, la serie se rompe (v003 de Sushita: dos
  // productos recortados y un tercero en banda). El recorte queda para cuando hay una sola toma, o ninguna.
  for (const d of tomas.length >= 2 ? [] : (carrusel?.detalles ?? [])) {
    if (diapositivas.length >= 3) break;
    const nombre = portada.textos.find((t) => t.clave === d.texto);
    if (!nombre) {
      problemas.push(`carrusel: no hay ningún texto con la clave «${d.texto}».`);
      continue;
    }
    const palabras = new Set(normal(nombre.texto).split(/\W+/).filter((p) => p.length > 3));
    const elemento = [...hechos.elementos].sort((a, b) => [...palabras].filter((p) => normal(b.nombre).includes(p)).length - [...palabras].filter((p) => normal(a.nombre).includes(p)).length)[0];
    // El estado de ese elemento, tal como se confirmó: el elemento cuyo nombre comparte más palabras con el texto.
    if (elemento && conToma.has(normal(elemento.nombre))) continue;
    if (vistos.has(normal(nombre.texto))) problemas.push(`carrusel: «${nombre.texto}» sale dos veces; cada detalle, un elemento distinto.`);
    vistos.add(normal(nombre.texto));
    // El título del detalle, corto para que se lea grande (salto de escala frente a la anotación): las primeras
    // palabras del nombre, tal cual (sigue respaldado por la misma cita).
    const delDueno = elemento ? segmentoDelElemento(hechos.plato, elemento.nombre) : undefined;
    const textos: TextoPropuesto[] = [delDueno ? { clave: nombre.clave, texto: conMayuscula(tituloCorto(delDueno)), fuente: 'PLATO', cita: delDueno } : { ...nombre, texto: conMayuscula(tituloCorto(nombre.texto)) }];
    // En los detalles no va la cuña: la anotación necesita el campo entero (en la prueba de Sushita se pisaban).
    const capas: CapaPropuesta[] = [
      { tipo: 'fondo', color: `@${campo}` },
      // La foto, ampliada sobre el elemento: queda en el centro de la banda.
      { tipo: 'foto', encuadre: 'marco', caja: { col: [1, COLUMNAS], fila: [7, 16] }, sangra: true, zoom: 2.4, enfoque: d.punto, ...(e.fotoDeLaSerie ? { activo: e.fotoDeLaSerie } : {}) },
      { tipo: 'texto', id: 'titular', texto: nombre.clave, voz: e.voces.titular, caja: { col: [1, COLUMNAS], fila: [2, 4] }, ajuste: 'caja', alinear: 'izquierda', vertical: 'arriba', color: `@${tintaSobre(campo, e, undefined, 3)}`, relacion: 'aparte' },
    ];
    if (elemento && e.voces.anotacion) {
      const estado = estadoCorto(elemento.estado);
      textos.push({ clave: 'estado', texto: estado, fuente: 'ELEMENTO', cita: estado });
      // La anotación, en el campo, con la flecha hasta el centro de la banda (donde quedó el elemento).
      // En el color de acento (el de la diagonal), si contrasta con el campo: es la voz humana de la serie.
      capas.push({ tipo: 'anotacion', id: 'nota', texto: 'estado', voz: e.voces.anotacion, caja: { col: [5, COLUMNAS], fila: [5, 6] }, vertical: 'centro', tamano: 46, apunta: { x: 0.5, y: 0.5 }, hacia: { x: 0.56, y: 0.72 }, color: `@${tintaSobre(campo, e, diagonal, 3)}` });
    }
    diapositivas.push({ id: `detalle-${diapositivas.length + 1}`, maqueta: { ...portada, textos, capas, excepcion: 'Diapositiva de detalle de un carrusel: la firma va en la portada y en el cierre.' } });
  }

  // El cierre: la firma del local, su ciudad y su Instagram (datos de la marca), y la foto entera en una banda.
  const l = hechos.local;
  const textos: TextoPropuesto[] = [{ clave: 'firma', texto: l.nombre, fuente: 'MARCA', cita: l.nombre }];
  const ciudad = l.ciudad.split('(')[0]!.trim();
  textos.push({ clave: 'ciudad', texto: ciudad, fuente: 'MARCA', cita: ciudad });
  if (l.instagram) textos.push({ clave: 'instagram', texto: `@${l.instagram.replace(/^@/, '')}`, fuente: 'MARCA', cita: l.instagram.replace(/^@/, '') });
  // La rama a tinta de la portada, si la lleva, también en el cierre (en el vacío a la derecha de la ciudad).
  const rama = portada.capas.find((c) => c.tipo === 'forma' && c.figura === 'rama') as Extract<CapaPropuesta, { tipo: 'forma' }> | undefined;
  const capas: CapaPropuesta[] = [
    ...fondo(0.66, 0.57),
    ...(rama ? [{ ...rama, caja: { col: [9, COLUMNAS], fila: [6, 8] }, color: `@${tintaSobre(campo, e, undefined, 3)}` } as CapaPropuesta] : []),
    { tipo: 'foto', encuadre: 'marco', caja: { col: [1, COLUMNAS], fila: [10, 16] }, sangra: true, ...(e.fotoDeLaSerie ? { activo: e.fotoDeLaSerie } : {}) },
    { tipo: 'texto', id: 'firma', texto: 'firma', voz: e.voces.titular, caja: { col: [1, COLUMNAS], fila: [3, 6] }, ajuste: 'caja', alinear: 'izquierda', vertical: 'abajo', color: `@${tintaSobre(campo, e, undefined, 3)}`, relacion: 'aparte' },
    { tipo: 'texto', id: 'ciudad', texto: 'ciudad', voz: e.voces.firma, caja: { col: [1, 8], fila: [8, 8] }, ajuste: 'fijo', tamano: 40, alinear: 'izquierda', vertical: 'arriba', color: `@${tintaSobre(campo, e, undefined)}`, relacion: 'aparte' },
    ...(l.instagram ? [{ tipo: 'texto' as const, id: 'instagram', texto: 'instagram', voz: e.voces.firma, caja: { col: [1, 8], fila: [9, 9] } as { col: number[]; fila: number[] }, ajuste: 'fijo' as const, tamano: 34, alinear: 'izquierda' as const, vertical: 'arriba' as const, color: `@${tintaSobre(campo, e, undefined)}`, relacion: 'aparte' as const }] : []),
  ];
  diapositivas.push({ id: 'cierre', maqueta: { ...portada, textos, capas } });
  return { diapositivas, problemas };
}
