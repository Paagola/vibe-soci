/**
 * Trazo a mano (F3): subrayados, círculos, tachados y flechas que parecen hechos con un rotulador y no con una regla.
 *
 * Un trazo vectorial perfecto (grosor constante, extremos cuadrados) delata a la máquina. Aquí cada trazo es el CONTORNO
 * relleno de una pincelada: entra con presión y sale levantando (ancho variable), el pulso se aparta un poco de la línea
 * y, si se pide, el rotulador se queda sin tinta a trozos. Todo sale de una semilla: el mismo trazo se repite idéntico.
 * Funciones puras: devuelven trazados SVG en píxeles del lienzo.
 */
import { mulberry32, ruidoDeValor } from '../../dominio/diseno/azar.js';

interface P {
  x: number;
  y: number;
}

export interface OpcionesPincelada {
  grosor: number;
  /** 0 = tirado con regla; 1 = muy suelto. */
  temblor: number;
  /** Fracción del trazo que se queda sin tinta. */
  huecos: number;
  semilla: number;
  /** Cuánto se afina al final (0 = nada, 1 = acaba en punta). Por defecto, lo que hace un rotulador al levantarse. */
  salida?: number;
}

const n1 = (v: number) => Math.round(v * 10) / 10;
const suave = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Puntos a lo largo de una curva de Bézier cuadrática. */
export function cuadratica(a: P, control: P, b: P, pasos = 48): P[] {
  const puntos: P[] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const u = 1 - t;
    puntos.push({ x: u * u * a.x + 2 * u * t * control.x + t * t * b.x, y: u * u * a.y + 2 * u * t * control.y + t * t * b.y });
  }
  return puntos;
}

function distancias(puntos: P[]): number[] {
  const acumulado = [0];
  for (let i = 1; i < puntos.length; i++) acumulado.push(acumulado[i - 1]! + Math.hypot(puntos[i]!.x - puntos[i - 1]!.x, puntos[i]!.y - puntos[i - 1]!.y));
  return acumulado;
}

/** La misma línea con puntos a distancias iguales. */
function remuestrear(puntos: P[], paso: number): P[] {
  const acumulado = distancias(puntos);
  const total = acumulado[acumulado.length - 1]!;
  if (total === 0) return puntos.slice(0, 1);
  const n = Math.max(2, Math.round(total / paso));
  const salida: P[] = [];
  let j = 1;
  for (let i = 0; i <= n; i++) {
    const s = (total * i) / n;
    while (j < acumulado.length - 1 && acumulado[j]! < s) j++;
    const s0 = acumulado[j - 1]!;
    const s1 = acumulado[j]!;
    const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    salida.push({ x: puntos[j - 1]!.x + (puntos[j]!.x - puntos[j - 1]!.x) * t, y: puntos[j - 1]!.y + (puntos[j]!.y - puntos[j - 1]!.y) * t });
  }
  return salida;
}

function normales(puntos: P[]): P[] {
  return puntos.map((_, i) => {
    const a = puntos[Math.max(0, i - 1)]!;
    const b = puntos[Math.min(puntos.length - 1, i + 1)]!;
    const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / largo, y: (b.x - a.x) / largo };
  });
}

/** Contorno relleno de un tramo de pincelada: un lado hacia delante, el otro hacia atrás, con los extremos redondos. */
function contorno(puntos: P[], anchos: number[]): string {
  const n = normales(puntos);
  const izquierda = puntos.map((p, i) => ({ x: p.x + (n[i]!.x * anchos[i]!) / 2, y: p.y + (n[i]!.y * anchos[i]!) / 2 }));
  const derecha = puntos.map((p, i) => ({ x: p.x - (n[i]!.x * anchos[i]!) / 2, y: p.y - (n[i]!.y * anchos[i]!) / 2 }));
  const ultimo = puntos.length - 1;
  const r0 = anchos[0]! / 2;
  const r1 = anchos[ultimo]! / 2;
  // Los extremos se cierran con medio círculo hacia fuera (con el eje y hacia abajo, eso es barrido 0 en los dos).
  let d = `M${n1(izquierda[0]!.x)} ${n1(izquierda[0]!.y)}`;
  for (let i = 1; i <= ultimo; i++) d += `L${n1(izquierda[i]!.x)} ${n1(izquierda[i]!.y)}`;
  d += `A${n1(r1)} ${n1(r1)} 0 0 0 ${n1(derecha[ultimo]!.x)} ${n1(derecha[ultimo]!.y)}`;
  for (let i = ultimo - 1; i >= 0; i--) d += `L${n1(derecha[i]!.x)} ${n1(derecha[i]!.y)}`;
  return `${d}A${n1(r0)} ${n1(r0)} 0 0 0 ${n1(izquierda[0]!.x)} ${n1(izquierda[0]!.y)}Z`;
}

/**
 * De una línea central a los trazados de una pincelada. Devuelve uno por tramo con tinta (varios si hay huecos).
 */
export function pincelada(centro: P[], o: OpcionesPincelada): string[] {
  const linea = remuestrear(centro, Math.max(3, o.grosor * 0.55));
  if (linea.length < 2) return [];
  const acumulado = distancias(linea);
  const total = acumulado[acumulado.length - 1]!;
  const deriva = ruidoDeValor(o.semilla);
  const vibra = ruidoDeValor(o.semilla ^ 0x9e3779b9);
  const presion = ruidoDeValor(o.semilla ^ 0x51ed270b);
  const amplitud = o.temblor * Math.max(2, Math.min(9, o.grosor * 0.9));
  const salida = o.salida ?? 0.65;

  // El pulso: la mano se aparta de la línea despacio (deriva) y con un temblor fino. Los extremos se quedan en su sitio.
  const base = normales(linea);
  const movida = linea.map((p, i) => {
    const s = acumulado[i]!;
    const t = total > 0 ? s / total : 0;
    const anclaje = Math.sin(Math.PI * t) ** 0.5;
    const desvio = amplitud * anclaje * ((deriva(s / 85, 0) - 0.5) * 1.6 + (vibra(s / 17, 0) - 0.5) * 0.4);
    return { x: p.x + base[i]!.x * desvio, y: p.y + base[i]!.y * desvio };
  });
  const anchos = linea.map((_, i) => {
    const s = acumulado[i]!;
    const t = total > 0 ? s / total : 0;
    const entra = 0.55 + 0.45 * suave(0, 0.06, t);
    const sale = 1 - salida * suave(0.8, 1, t);
    const irregular = 1 + (presion(s / 40, 0) - 0.5) * 0.35 * o.temblor;
    return Math.max(0.8, o.grosor * entra * sale * (1.06 - 0.12 * t) * irregular);
  });

  // Tramos sin tinta: huecos repartidos por el trazo, nunca en el arranque ni al final.
  const azar = mulberry32(o.semilla ^ 0x2545f491);
  const huecos: Array<[number, number]> = [];
  if (o.huecos > 0 && total > 60) {
    const cuantos = Math.max(1, Math.round(o.huecos * 10));
    const largo = (o.huecos * total) / cuantos;
    for (let i = 0; i < cuantos; i++) {
      const inicio = total * (0.12 + (0.76 * (i + azar())) / cuantos);
      huecos.push([inicio, inicio + largo * (0.6 + azar() * 0.8)]);
    }
  }
  const enHueco = (s: number) => huecos.some(([a, b]) => s >= a && s <= b);

  const trazados: string[] = [];
  let tramo: number[] = [];
  const cerrar = () => {
    if (tramo.length >= 2) {
      // Donde el rotulador se seca, el tramo acaba afinándose.
      const cortadoAlInicio = tramo[0]! > 0;
      const cortadoAlFinal = tramo[tramo.length - 1]! < linea.length - 1;
      const puntos = tramo.map((i) => movida[i]!);
      const w = tramo.map((i, k) => {
        const desdeInicio = k / Math.max(1, tramo.length - 1);
        const afinaInicio = cortadoAlInicio ? 0.45 + 0.55 * suave(0, 0.25, desdeInicio) : 1;
        const afinaFinal = cortadoAlFinal ? 0.45 + 0.55 * (1 - suave(0.75, 1, desdeInicio)) : 1;
        return anchos[i]! * afinaInicio * afinaFinal;
      });
      trazados.push(contorno(puntos, w));
    }
    tramo = [];
  };
  for (let i = 0; i < linea.length; i++) {
    if (enHueco(acumulado[i]!)) cerrar();
    else tramo.push(i);
  }
  cerrar();
  return trazados;
}

export interface PeticionGesto {
  gesto: 'subrayado' | 'circulo' | 'flecha' | 'tachado';
  desde: P;
  hasta: P;
  /** Círculo: la caja que rodea (ya con su margen). */
  rect?: { x: number; y: number; w: number; h: number };
  curva: number;
  cabeza: 'abierta' | 'ninguna';
  grosor: number;
  temblor: number;
  huecos: number;
  semilla: number;
}

/** Los trazados (rellenos) de un gesto a mano. */
export function trazarGesto(p: PeticionGesto): string[] {
  const azar = mulberry32(p.semilla);
  const opciones = { grosor: p.grosor, temblor: p.temblor, huecos: p.huecos, semilla: p.semilla };
  const dx = p.hasta.x - p.desde.x;
  const dy = p.hasta.y - p.desde.y;
  const largo = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / largo, y: dx / largo };
  const medio = { x: (p.desde.x + p.hasta.x) / 2, y: (p.desde.y + p.hasta.y) / 2 };

  if (p.gesto === 'subrayado' || p.gesto === 'tachado') {
    // Una raya a mano nunca es recta: se comba un poco hacia un lado.
    const comba = largo * 0.014 * (azar() < 0.5 ? -1 : 1) * (0.5 + p.temblor);
    return pincelada(cuadratica(p.desde, { x: medio.x + normal.x * comba, y: medio.y + normal.y * comba }, p.hasta), opciones);
  }

  if (p.gesto === 'circulo') {
    const r = p.rect ?? { x: Math.min(p.desde.x, p.hasta.x), y: Math.min(p.desde.y, p.hasta.y), w: Math.abs(dx), h: Math.abs(dy) };
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    // Un círculo a mano no se cierra: da algo más de una vuelta y el final pasa por fuera del principio.
    const inicio = -2.55 + (azar() - 0.5) * 0.4;
    const vuelta = Math.PI * 2 + 0.45 + azar() * 0.3;
    const fase = azar() * Math.PI * 2;
    const pasos = 96;
    const puntos: P[] = [];
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const a = inicio + vuelta * t;
      const abre = 0.985 + 0.075 * t;
      const deforma = 1 + 0.03 * p.temblor * Math.sin(2 * a + fase);
      puntos.push({ x: cx + (r.w / 2) * abre * deforma * Math.cos(a), y: cy + (r.h / 2) * abre * Math.sin(a) });
    }
    return pincelada(puntos, { ...opciones, salida: 0.8 });
  }

  // Flecha: un astil combado y dos barbas cortas, cada una con su propio pulso.
  const control = { x: medio.x + normal.x * p.curva * 0.36 * largo, y: medio.y + normal.y * p.curva * 0.36 * largo };
  const trazados = pincelada(cuadratica(p.desde, control, p.hasta), { ...opciones, salida: 0.25 });
  if (p.cabeza === 'ninguna') return trazados;
  const tx = p.hasta.x - control.x;
  const ty = p.hasta.y - control.y;
  const t = Math.hypot(tx, ty) || 1;
  const direccion = Math.atan2(ty / t, tx / t);
  const barba = Math.max(20, Math.min(70, largo * 0.17));
  for (const lado of [-1, 1]) {
    const angulo = direccion + Math.PI + lado * ((27 + (azar() - 0.5) * 8) * Math.PI) / 180;
    const longitud = barba * (0.88 + azar() * 0.24);
    const fin = { x: p.hasta.x + Math.cos(angulo) * longitud, y: p.hasta.y + Math.sin(angulo) * longitud };
    trazados.push(...pincelada([p.hasta, { x: (p.hasta.x + fin.x) / 2, y: (p.hasta.y + fin.y) / 2 }, fin], { grosor: p.grosor * 0.92, temblor: p.temblor * 0.6, huecos: 0, semilla: p.semilla + 17 * (lado + 2), salida: 0.75 }));
  }
  return trazados;
}
