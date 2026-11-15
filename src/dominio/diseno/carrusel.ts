/**
 * Punto 1 (15/11): el carrusel de la orden única. La portada la escribe el director (su composición, como un post);
 * el resto lo coloca el código con la retícula, las voces y los colores de la portada, para que sea una serie:
 * - DETALLE (de dos a tres): la misma foto, ampliada sobre un elemento confirmado que el director ha situado en ella;
 *   su nombre en la voz del titular y una anotación a mano (su estado, tal como consta) con una flecha que lo señala;
 * - CIERRE: la firma del local en grande, con su ciudad y su Instagram, y la foto entera en una banda.
 * Ningún texto es nuevo: los nombres y estados salen de los elementos confirmados y la firma de los datos del local.
 * Dominio puro: devuelve maquetas en el dialecto, que compila compilarIntencion.
 */
import { contraste } from './color.js';
import type { CapaPropuesta, Carrusel, HechosDeLaPieza, Maqueta, TextoPropuesto } from './propuesta.js';

export interface EntornoDeCarrusel {
  colores: Array<{ token: string; hex: string }>;
  voces: { titular: string; firma: string; anotacion?: string };
  /** La estética admite la diagonal de color (color pop, maximalismo). */
  conDiagonal: boolean;
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

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function diapositivasDeCarrusel(
  portada: Maqueta,
  carrusel: Carrusel,
  hechos: HechosDeLaPieza,
  e: EntornoDeCarrusel,
): { diapositivas: Diapositiva[]; problemas: string[] } {
  const problemas: string[] = [];
  const diapositivas: Diapositiva[] = [];
  const { campo, diagonal } = camposDeLaPortada(portada, e);
  const fondo = (): CapaPropuesta[] => [
    { tipo: 'fondo', color: `@${campo}` },
    ...(diagonal && e.conDiagonal ? [{ tipo: 'diagonal' as const, color: `@${diagonal}`, izquierda: 0.36, derecha: 0.3 }] : []),
  ];
  const vistos = new Set<string>();

  for (const [i, d] of carrusel.detalles.entries()) {
    const nombre = portada.textos.find((t) => t.clave === d.texto);
    if (!nombre) {
      problemas.push(`carrusel: no hay ningún texto con la clave «${d.texto}».`);
      continue;
    }
    if (vistos.has(normal(nombre.texto))) problemas.push(`carrusel: «${nombre.texto}» sale dos veces; cada detalle, un elemento distinto.`);
    vistos.add(normal(nombre.texto));
    // El estado de ese elemento, tal como se confirmó: el elemento cuyo nombre comparte más palabras con el texto.
    const palabras = new Set(normal(nombre.texto).split(/\W+/).filter((p) => p.length > 3));
    const elemento = [...hechos.elementos].sort((a, b) => [...palabras].filter((p) => normal(b.nombre).includes(p)).length - [...palabras].filter((p) => normal(a.nombre).includes(p)).length)[0];
    const textos: TextoPropuesto[] = [nombre];
    const capas: CapaPropuesta[] = [
      ...fondo(),
      // La foto, ampliada sobre el elemento: queda en el centro de la banda.
      { tipo: 'foto', encuadre: 'marco', caja: { col: [1, COLUMNAS], fila: [6, 16] }, sangra: true, zoom: 2.4, enfoque: d.punto },
      { tipo: 'texto', id: 'titular', texto: nombre.clave, voz: e.voces.titular, caja: { col: [1, COLUMNAS], fila: [2, 3] }, ajuste: 'caja', alinear: 'izquierda', vertical: 'abajo', color: `@${tintaSobre(campo, e, undefined, 3)}`, relacion: 'aparte' },
    ];
    if (elemento && e.voces.anotacion) {
      const estado = estadoCorto(elemento.estado);
      textos.push({ clave: 'estado', texto: estado, fuente: 'ELEMENTO', cita: estado });
      // La anotación, en el campo, con la flecha hasta el centro de la banda (donde quedó el elemento).
      capas.push({ tipo: 'anotacion', id: 'nota', texto: 'estado', voz: e.voces.anotacion, caja: { col: [5, COLUMNAS], fila: [4, 5] }, tamano: 44, apunta: { x: 0.5, y: 0.5 }, hacia: { x: 0.56, y: 0.66 }, color: `@${tintaSobre(campo, e, undefined, 3)}` });
    }
    diapositivas.push({ id: `detalle-${i + 1}`, maqueta: { ...portada, textos, capas, excepcion: 'Diapositiva de detalle de un carrusel: la firma va en la portada y en el cierre.' } });
  }

  // El cierre: la firma del local, su ciudad y su Instagram (datos de la marca), y la foto entera en una banda.
  const l = hechos.local;
  const textos: TextoPropuesto[] = [{ clave: 'firma', texto: l.nombre, fuente: 'MARCA', cita: l.nombre }];
  const ciudad = l.ciudad.split('(')[0]!.trim();
  textos.push({ clave: 'ciudad', texto: ciudad, fuente: 'MARCA', cita: ciudad });
  if (l.instagram) textos.push({ clave: 'instagram', texto: `@${l.instagram.replace(/^@/, '')}`, fuente: 'MARCA', cita: l.instagram.replace(/^@/, '') });
  const capas: CapaPropuesta[] = [
    ...fondo(),
    { tipo: 'foto', encuadre: 'marco', caja: { col: [1, COLUMNAS], fila: [10, 16] }, sangra: true },
    { tipo: 'texto', id: 'firma', texto: 'firma', voz: e.voces.titular, caja: { col: [1, COLUMNAS], fila: [3, 6] }, ajuste: 'caja', alinear: 'izquierda', vertical: 'abajo', color: `@${tintaSobre(campo, e, undefined, 3)}`, relacion: 'aparte' },
    { tipo: 'texto', id: 'ciudad', texto: 'ciudad', voz: e.voces.firma, caja: { col: [1, 8], fila: [7, 7] }, ajuste: 'fijo', tamano: 40, alinear: 'izquierda', vertical: 'arriba', color: `@${tintaSobre(campo, e, undefined)}`, relacion: 'aparte' },
    ...(l.instagram ? [{ tipo: 'texto' as const, id: 'instagram', texto: 'instagram', voz: e.voces.firma, caja: { col: [1, 8], fila: [8, 8] } as { col: number[]; fila: number[] }, ajuste: 'fijo' as const, tamano: 34, alinear: 'izquierda' as const, vertical: 'arriba' as const, color: `@${tintaSobre(campo, e, undefined)}`, relacion: 'aparte' as const }] : []),
  ];
  diapositivas.push({ id: 'cierre', maqueta: { ...portada, textos, capas } });
  return { diapositivas, problemas };
}
