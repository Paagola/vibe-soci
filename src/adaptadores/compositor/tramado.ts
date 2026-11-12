/**
 * Trama de semitonos (F3): la forma mecánica de reproducir una imagen con una sola tinta. La rejilla va girada
 * (45° por defecto, el ángulo en que menos se nota como rejilla) y cada punto es más gordo donde hay que poner más
 * tinta. Es el mismo principio de la prensa y de la risografía; aquí está escrito desde cero, con el borde de cada punto
 * suavizado un píxel para que no parezca un mapa de bits.
 *
 * Dos usos: reproducir una foto (`tramarLuminancia`) y pintar un campo de puntos o rayas que se desvanece
 * (`tramar` con un radio que depende de la posición), que es una forma de dar textura al «aire» sin usar un degradado.
 */

export interface OpcionesTrama {
  forma: 'punto' | 'linea';
  /** Distancia entre puntos o líneas, en px. */
  paso: number;
  /** Ángulo de la rejilla, en grados. */
  angulo: number;
}

/**
 * Cobertura de tinta (0–255) de una trama sobre un lienzo de w × h.
 * `radio(x, y)` dice, para el centro de cada celda, el radio del punto (o la mitad del grosor de la línea) en px.
 */
export function tramar(w: number, h: number, o: OpcionesTrama, radio: (x: number, y: number) => number): Uint8Array {
  const salida = new Uint8Array(w * h);
  const a = (o.angulo * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const paso = o.paso;

  // Puntos: el radio de cada celda se calcula una vez (hay miles de celdas y millones de píxeles).
  let radios = new Float32Array(0);
  let i0 = 0;
  let j0 = 0;
  let ni = 0;
  if (o.forma === 'punto') {
    const us = [0, w * cos, h * sin, w * cos + h * sin];
    const vs = [0, -w * sin, h * cos, -w * sin + h * cos];
    i0 = Math.floor(Math.min(...us) / paso) - 2;
    j0 = Math.floor(Math.min(...vs) / paso) - 2;
    ni = Math.ceil(Math.max(...us) / paso) + 2 - i0 + 1;
    const nj = Math.ceil(Math.max(...vs) / paso) + 2 - j0 + 1;
    radios = new Float32Array(ni * nj);
    for (let j = 0; j < nj; j++) {
      for (let i = 0; i < ni; i++) {
        const uc = (i + i0) * paso;
        const vc = (j + j0) * paso;
        radios[j * ni + i] = radio(uc * cos - vc * sin, uc * sin + vc * cos);
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // A coordenadas de la rejilla (girada).
      const u = x * cos + y * sin;
      const v = -x * sin + y * cos;
      let cobertura = 0;
      if (o.forma === 'linea') {
        const vc = Math.round(v / paso) * paso;
        // El grosor se mira justo debajo del píxel: la línea engorda y adelgaza a lo largo de su recorrido.
        cobertura = radio(u * cos - vc * sin, u * sin + vc * cos) - Math.abs(v - vc) + 0.5;
      } else {
        const ic = Math.round(u / paso);
        const jc = Math.round(v / paso);
        // Un punto gordo invade las celdas vecinas: se miran las nueve.
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const r = radios[(jc + dj - j0) * ni + (ic + di - i0)]!;
            if (r <= 0) continue;
            const c = r - Math.hypot(u - (ic + di) * paso, v - (jc + dj) * paso) + 0.5;
            if (c > cobertura) cobertura = c;
          }
        }
      }
      salida[y * w + x] = cobertura <= 0 ? 0 : cobertura >= 1 ? 255 : Math.round(cobertura * 255);
    }
  }
  return salida;
}

/** Radio del punto que da una cobertura de tinta `d` (0–1) en una celda de lado `paso`. Con d = 1 la celda queda llena. */
export function radioParaCobertura(d: number, paso: number, forma: 'punto' | 'linea'): number {
  const tinta = Math.max(0, Math.min(1, d));
  return forma === 'linea' ? (paso * tinta) / 2 : paso * 0.7213 * Math.sqrt(tinta);
}

/**
 * Trama de una imagen en grises: `grises` es un canal (0–255) de gw × gh que cubre todo el lienzo de w × h.
 * Las sombras piden tinta y las luces dejan ver el papel.
 */
export function tramarLuminancia(grises: Uint8Array, gw: number, gh: number, w: number, h: number, o: OpcionesTrama): Uint8Array {
  const muestra = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(gw - 1, (x / w) * gw));
    const gy = Math.max(0, Math.min(gh - 1, (y / h) * gh));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(gw - 1, x0 + 1);
    const y1 = Math.min(gh - 1, y0 + 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const arriba = grises[y0 * gw + x0]! * (1 - tx) + grises[y0 * gw + x1]! * tx;
    const abajo = grises[y1 * gw + x0]! * (1 - tx) + grises[y1 * gw + x1]! * tx;
    return (arriba * (1 - ty) + abajo * ty) / 255;
  };
  return tramar(w, h, o, (x, y) => radioParaCobertura(1 - muestra(x, y), o.paso, o.forma));
}

/**
 * Campo de trama que se desvanece: el radio va de `fuerte` a `debil` (los dos, respecto al paso) en la dirección pedida,
 * dentro de la caja. Sirve de «aire con textura»: un vacío que no es plano y tampoco es un degradado.
 */
export function radioDeCampo(
  rect: { x: number; y: number; w: number; h: number },
  paso: number,
  [fuerte, debil]: [number, number],
  desvanece: 'no' | 'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'centro',
): (x: number, y: number) => number {
  return (x, y) => {
    const fx = Math.max(0, Math.min(1, (x - rect.x) / rect.w));
    const fy = Math.max(0, Math.min(1, (y - rect.y) / rect.h));
    let t = 0;
    if (desvanece === 'abajo') t = fy;
    else if (desvanece === 'arriba') t = 1 - fy;
    else if (desvanece === 'derecha') t = fx;
    else if (desvanece === 'izquierda') t = 1 - fx;
    else if (desvanece === 'centro') t = 1 - Math.min(1, Math.hypot(fx - 0.5, fy - 0.5) * 2);
    return paso * (fuerte + (debil - fuerte) * t);
  };
}

/** Tabla de 256 colores de un duotono: el negro de la foto da `sombras` y el blanco, `luces`. */
export function tablaDuotono(sombras: [number, number, number], luces: [number, number, number]): Uint8Array {
  const tabla = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    for (let c = 0; c < 3; c++) tabla[v * 3 + c] = Math.round(sombras[c]! + (luces[c]! - sombras[c]!) * t);
  }
  return tabla;
}
