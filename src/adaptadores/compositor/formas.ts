/**
 * Formas vectoriales del compositor (F3): los contornos de los sellos y las manchas orgánicas, como trazados SVG.
 * Funciones puras y deterministas: la misma entrada da el mismo trazado.
 */
import { mulberry32 } from '../../dominio/diseno/azar.js';

const n2 = (v: number) => Math.round(v * 100) / 100;

/** Estrella de sello («estallido»): puntas alternando el radio exterior y el interior. */
export function trazadoEstrella(cx: number, cy: number, radio: number, puntas: number, profundidad: number): string {
  const interior = radio * (1 - profundidad);
  const partes: string[] = [];
  for (let i = 0; i < puntas * 2; i++) {
    const a = (Math.PI * i) / puntas - Math.PI / 2;
    const r = i % 2 === 0 ? radio : interior;
    partes.push(`${i === 0 ? 'M' : 'L'}${n2(cx + r * Math.cos(a))} ${n2(cy + r * Math.sin(a))}`);
  }
  return `${partes.join('')}Z`;
}

/** Borde festoneado: ondas redondas alrededor de un círculo (el sello de pastelería). */
export function trazadoFestoneado(cx: number, cy: number, radio: number, ondas: number, profundidad: number): string {
  const interior = radio * (1 - profundidad);
  const delta = (2 * Math.PI) / ondas;
  // Con una curva cuadrática entre dos puntos del círculo interior, el punto de control que hace llegar la onda al radio exterior.
  const control = 2 * radio - interior * Math.cos(delta / 2);
  const punto = (r: number, a: number) => `${n2(cx + r * Math.cos(a))} ${n2(cy + r * Math.sin(a))}`;
  let d = `M${punto(interior, -Math.PI / 2)}`;
  for (let i = 0; i < ondas; i++) {
    const a0 = -Math.PI / 2 + i * delta;
    d += `Q${punto(control, a0 + delta / 2)} ${punto(interior, a0 + delta)}`;
  }
  return `${d}Z`;
}

/** Elipse como trazado (para poder aplicarle el mismo tratamiento que al resto de formas). */
export function trazadoElipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n2(cx - rx)} ${n2(cy)}A${n2(rx)} ${n2(ry)} 0 1 0 ${n2(cx + rx)} ${n2(cy)}A${n2(rx)} ${n2(ry)} 0 1 0 ${n2(cx - rx)} ${n2(cy)}Z`;
}

/** Pastilla: rectángulo con los extremos redondos. */
export function trazadoPastilla(cx: number, cy: number, rx: number, ry: number): string {
  const r = Math.min(rx, ry);
  const x0 = cx - rx;
  const x1 = cx + rx;
  const y0 = cy - ry;
  const y1 = cy + ry;
  return `M${n2(x0 + r)} ${n2(y0)}H${n2(x1 - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x1)} ${n2(y0 + r)}V${n2(y1 - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x1 - r)} ${n2(y1)}H${n2(x0 + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x0)} ${n2(y1 - r)}V${n2(y0 + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x0 + r)} ${n2(y0)}Z`;
}

/** El contorno de un sello según su forma. `escala` lo encoge o agranda desde su centro (para el filete interior). */
export function trazadoDeSello(
  forma: 'circulo' | 'estrella' | 'festoneado' | 'ovalo' | 'pastilla',
  cx: number,
  cy: number,
  radioX: number,
  radioY: number,
  puntas: number,
  profundidad: number,
  escala = 1,
): string {
  const rx = radioX * escala;
  const ry = radioY * escala;
  switch (forma) {
    case 'estrella':
      return trazadoEstrella(cx, cy, rx, puntas, profundidad);
    case 'festoneado':
      return trazadoFestoneado(cx, cy, rx, puntas, profundidad);
    case 'ovalo':
      return trazadoElipse(cx, cy, rx, ry);
    case 'pastilla':
      return trazadoPastilla(cx, cy, rx, ry);
    case 'circulo':
      return trazadoElipse(cx, cy, rx, rx);
  }
}

/** Radio útil para el texto del centro: lo que queda dentro de las puntas, del filete y del anillo. */
export function radioInterior(forma: 'circulo' | 'estrella' | 'festoneado' | 'ovalo' | 'pastilla', radio: number, profundidad: number): number {
  return forma === 'estrella' || forma === 'festoneado' ? radio * (1 - profundidad) : radio;
}

/** Curva cerrada y suave por una lista de puntos (Catmull-Rom pasado a Bézier cúbicas). */
export function curvaCerrada(puntos: Array<{ x: number; y: number }>): string {
  const n = puntos.length;
  if (n < 3) return '';
  const p = (i: number) => puntos[((i % n) + n) % n]!;
  let d = `M${n2(p(0).x)} ${n2(p(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    d += `C${n2(p1.x + (p2.x - p0.x) / 6)} ${n2(p1.y + (p2.y - p0.y) / 6)} ${n2(p2.x - (p3.x - p1.x) / 6)} ${n2(p2.y - (p3.y - p1.y) / 6)} ${n2(p2.x)} ${n2(p2.y)}`;
  }
  return `${d}Z`;
}

/**
 * Mancha orgánica dentro de una caja: una elipse a la que se le suman unos pocos armónicos con fase y amplitud al azar.
 * `irregularidad` 0 es una elipse; 1, una forma muy lobulada. Siempre ocupa su caja entera.
 */
export function trazadoMancha(rect: { x: number; y: number; w: number; h: number }, lobulos: number, irregularidad: number, semilla: number): string {
  const azar = mulberry32(semilla);
  const armonicos: Array<{ k: number; amplitud: number; fase: number }> = [];
  for (let k = 2; k <= lobulos; k++) armonicos.push({ k, amplitud: ((0.55 + azar() * 0.45) * irregularidad) / (k * 0.9), fase: azar() * Math.PI * 2 });
  const muestras = 96;
  const crudos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < muestras; i++) {
    const a = (2 * Math.PI * i) / muestras;
    const r = 1 + armonicos.reduce((s, h) => s + h.amplitud * Math.cos(h.k * a + h.fase), 0);
    crudos.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  // Se ajusta a la caja: los extremos de la forma tocan sus cuatro lados.
  const xs = crudos.map((q) => q.x);
  const ys = crudos.map((q) => q.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return curvaCerrada(crudos.map((q) => ({ x: rect.x + ((q.x - minX) / (maxX - minX)) * rect.w, y: rect.y + ((q.y - minY) / (maxY - minY)) * rect.h })));
}

/** Polígono cerrado por sus vértices. */
export function trazadoPoligono(puntos: Array<{ x: number; y: number }>): string {
  return `${puntos.map((q, i) => `${i === 0 ? 'M' : 'L'}${n2(q.x)} ${n2(q.y)}`).join('')}Z`;
}

/**
 * F3.3 (punto 12): una rama de cerezo dibujada a tinta, como la de los flyers japoneses (ref-pin-34). Entra por el canto
 * derecho de su caja y crece hacia la izquierda: un tallo principal que adelgaza, unas ramitas y unas flores de cinco
 * pétalos en contorno con el centro relleno. Todo del mismo color, como un dibujo a pluma; la semilla la hace estable.
 */
export function dibujoRama(rect: { x: number; y: number; w: number; h: number }, color: string, semilla: number): string {
  const azar = mulberry32(semilla);
  const g = Math.min(rect.w, rect.h);
  const partes: string[] = [];
  /** Un trazo de pincel: una curva cuadrática cuyo grosor va de `w0` a `w1`, rellena (no un stroke: así adelgaza). */
  const trazo = (p0: P, p1: P, p2: P, w0: number, w1: number): P[] => {
    const n = 24;
    const izquierda: P[] = [];
    const derecha: P[] = [];
    const puntos: P[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
      const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
      const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
      const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
      const largo = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * t) * (0.85 + azar() * 0.3);
      izquierda.push({ x: x - (dy / largo) * (w / 2), y: y + (dx / largo) * (w / 2) });
      derecha.push({ x: x + (dy / largo) * (w / 2), y: y - (dx / largo) * (w / 2) });
      puntos.push({ x, y });
    }
    const d = [...izquierda, ...derecha.reverse()].map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    partes.push(`<path d="${d}Z" fill="${color}"/>`);
    return puntos;
  };
  const flor = (c: P, r: number) => {
    const giro = azar() * 72;
    const linea = Math.max(1.4, r * 0.09);
    for (let k = 0; k < 5; k++) {
      const a = ((giro + k * 72) * Math.PI) / 180;
      partes.push(`<ellipse cx="${(c.x + Math.cos(a) * r * 0.62).toFixed(1)}" cy="${(c.y + Math.sin(a) * r * 0.62).toFixed(1)}" rx="${(r * 0.5).toFixed(1)}" ry="${(r * 0.38).toFixed(1)}" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${(c.x + Math.cos(a) * r * 0.62).toFixed(1)} ${(c.y + Math.sin(a) * r * 0.62).toFixed(1)})" fill="none" stroke="${color}" stroke-width="${linea.toFixed(2)}"/>`);
    }
    partes.push(`<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${(r * 0.18).toFixed(1)}" fill="${color}"/>`);
  };
  // El tallo: del canto derecho, a media altura, hasta cerca del izquierdo, con una comba hacia arriba.
  const inicio = { x: rect.x + rect.w + g * 0.05, y: rect.y + rect.h * 0.62 };
  const fin = { x: rect.x + rect.w * 0.08, y: rect.y + rect.h * 0.3 };
  const tallo = trazo(inicio, { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.75 }, fin, g * 0.07, g * 0.012);
  // Las ramitas: salen del tallo hacia arriba o hacia abajo, cada vez más finas.
  const salidas = [0.3, 0.5, 0.68, 0.84];
  const puntas: P[] = [fin];
  for (const [i, s] of salidas.entries()) {
    const base = tallo[Math.round(s * (tallo.length - 1))]!;
    const arriba = i % 2 === 0;
    const largo = g * (0.32 - s * 0.15) * (0.8 + azar() * 0.4);
    const punta = { x: base.x - largo * 0.75, y: base.y + (arriba ? -1 : 1) * largo * 0.7 };
    trazo(base, { x: base.x - largo * 0.2, y: base.y + (arriba ? -1 : 1) * largo * 0.55 }, punta, g * 0.035 * (1 - s * 0.5), g * 0.008);
    puntas.push(punta);
  }
  // Las flores: en cada punta y alguna a lo largo del tallo.
  for (const p of puntas) flor(p, g * (0.075 + azar() * 0.03));
  for (const s of [0.58, 0.92]) {
    const b = tallo[Math.round(s * (tallo.length - 1))]!;
    flor({ x: b.x + g * 0.02, y: b.y - g * 0.07 }, g * 0.055);
  }
  // Unos capullos: puntos de tinta junto a las ramitas.
  for (const p of puntas.slice(1)) partes.push(`<circle cx="${(p.x + g * 0.09).toFixed(1)}" cy="${(p.y - g * 0.02).toFixed(1)}" r="${(g * 0.016).toFixed(1)}" fill="${color}"/>`);
  return partes.join('');
}

type P = { x: number; y: number };
