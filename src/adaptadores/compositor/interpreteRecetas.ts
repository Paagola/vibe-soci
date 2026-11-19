/**
 * Intérprete de recetas de tipografía especial: de una receta (src/dominio/tipografia/receta.ts) y las letras ya
 * colocadas, al SVG que la pinta. Solo traduce piezas de la lista blanca a filtros y formas SVG (librsvg, dentro de
 * sharp): una receta no puede hacer nada que no esté aquí. Determinista: la semilla fija el azar.
 */
import { mulberry32 } from '../../dominio/diseno/azar.js';
import type { ColorReceta, Dibujo, Emisor, NodoFiltro, Receta, Valor } from '../../dominio/tipografia/receta.js';
import type { GlifoTrazado } from './MotorTexto.js';

export interface TextoTratado {
  definiciones: string;
  cuerpo: string;
}

export interface PeticionReceta {
  receta: Receta;
  /** Valores ya comprobados de los parámetros (los colores, ya en hex). */
  valores: Record<string, number | boolean | string>;
  semilla: number;
  glifos: GlifoTrazado[];
  /** Altura de mayúscula de la línea más grande, en px. */
  cap: number;
  /** Color del estilo del texto («@texto»). */
  color: string;
  /** Para que los ids del SVG no choquen entre capas. */
  idCapa: string;
}

type Zona = { x: number; y: number; w: number; h: number };

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const ENTRADAS: Record<string, string> = { origen: 'SourceGraphic', alfa: 'SourceAlpha' };
const OPERADORES = { dentro: 'in', fuera: 'out', sobre: 'over', encima: 'atop', aritmetico: 'arithmetic' } as const;

export function interpretarReceta(p: PeticionReceta): TextoTratado {
  const { receta, valores, glifos, cap } = p;
  if (glifos.length === 0) return { definiciones: '', cuerpo: '' };
  const id = `tt-${p.idCapa.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const zona = region(glifos, cap);

  const num = (v: Valor): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(valores[v.slice(1)]);
    return Number(valores[v.param]) * v.por + v.mas;
  };
  const color = (c: ColorReceta): string => (c === '@texto' ? p.color : c.startsWith('$') ? String(valores[c.slice(1)]) : c);
  const activo = (si?: string) => !si || valores[si] === true;

  // Las letras, con su variación (giro y salto por letra) si la receta la pide.
  const letras = (() => {
    const v = receta.letras;
    if (!v || (num(v.giro) === 0 && num(v.desplazamientoY) === 0)) return `<path d="${glifos.map((g) => g.d).join('')}"/>`;
    const azar = mulberry32(p.semilla);
    return glifos
      .map((g) => {
        const giro = (azar() - 0.5) * 2 * num(v.giro);
        const dy = (azar() - 0.5) * 2 * num(v.desplazamientoY) * cap;
        const cx = (g.caja.x0 + g.caja.x1) / 2;
        const cy = (g.caja.y0 + g.caja.y1) / 2;
        return `<path d="${g.d}" transform="translate(0 ${n(dy)}) rotate(${n(giro)} ${n(cx)} ${n(cy)})"/>`;
      })
      .join('');
  })();

  const definiciones: string[] = [];
  const filtrosHechos = new Map<string, string | undefined>();
  const filtro = (nombre: string): string | undefined => {
    if (filtrosHechos.has(nombre)) return filtrosHechos.get(nombre);
    const nodos = receta.filtros[nombre]!.filter((nodo) => activo(nodo.si));
    // Un filtro sin ningún nodo activo (todo condicionado a un «no») no se aplica: la letra queda tal cual.
    const ref = nodos.length ? `${id}-${nombre}` : undefined;
    if (ref) definiciones.push(`<filter id="${ref}" filterUnits="userSpaceOnUse" x="${n(zona.x)}" y="${n(zona.y)}" width="${n(zona.w)}" height="${n(zona.h)}" color-interpolation-filters="sRGB">${nodos.map((nodo) => nodoSvg(nodo, num, color, cap, zona, p.semilla)).join('')}</filter>`);
    filtrosHechos.set(nombre, ref);
    return ref;
  };

  let franjas = 0;
  const pintar = (d: Dibujo): string => {
    if (!activo(d.si)) return '';
    if ('emisor' in d) return emitir(receta.emisores.find((e) => e.id === d.emisor)!, glifos, cap, num, p.semilla + receta.emisores.findIndex((e) => e.id === d.emisor));
    if ('letras' in d) {
      const opacidad = d.opacidad !== undefined ? ` opacity="${d.opacidad}"` : '';
      let svg = d.trazo
        ? letras.replaceAll('<path ', `<path fill="none" stroke="${color(d.trazo.color)}" stroke-width="${n(num(d.trazo.grosor) * cap)}" stroke-linejoin="round"${opacidad} `)
        : opacidad
          ? `<g${opacidad}>${letras}</g>`
          : letras;
      if (d.franja) {
        const clip = `${id}-franja${++franjas}`;
        const bases = [...new Set(glifos.map((g) => Math.round(g.base)))];
        definiciones.push(`<clipPath id="${clip}">${bases.map((b) => `<rect x="${n(zona.x)}" y="${n(b - d.franja!.desde * cap)}" width="${n(zona.w)}" height="${n(d.franja!.alto * cap)}"/>`).join('')}</clipPath>`);
        svg = `<g clip-path="url(#${clip})">${svg}</g>`;
      }
      return svg;
    }
    const ref = d.filtro ? filtro(d.filtro) : undefined;
    const atributos = [
      ref ? `filter="url(#${ref})"` : '',
      d.relleno ? `fill="${color(d.relleno)}"` : '',
      d.trazo ? `fill="none" stroke="${color(d.trazo.color)}" stroke-width="${n(num(d.trazo.grosor) * cap)}" stroke-linejoin="round"` : '',
      d.opacidad !== undefined ? `opacity="${d.opacidad}"` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return `<g${atributos ? ` ${atributos}` : ''}>${d.grupo.map(pintar).join('')}</g>`;
  };
  const cuerpo = pintar(receta.dibujo);
  return { definiciones: definiciones.join(''), cuerpo };
}

/** Zona de trabajo de los filtros: la caja de las letras con margen para gotas, halos y sombras. */
function region(glifos: GlifoTrazado[], cap: number): Zona {
  const x0 = Math.min(...glifos.map((g) => g.caja.x0)) - cap;
  const y0 = Math.min(...glifos.map((g) => g.caja.y0)) - cap;
  const x1 = Math.max(...glifos.map((g) => g.caja.x1)) + cap;
  const y1 = Math.max(...glifos.map((g) => g.caja.y1)) + cap * 2;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function nodoSvg(nodo: NodoFiltro, num: (v: Valor) => number, color: (c: ColorReceta) => string, cap: number, zona: Zona, semilla: number): string {
  const entrada = nodo.entrada ? ` in="${ENTRADAS[nodo.entrada] ?? nodo.entrada}"` : '';
  const resultado = nodo.resultado ? ` result="${nodo.resultado}"` : '';
  const ref = (e: string) => ENTRADAS[e] ?? e;
  switch (nodo.tipo) {
    case 'turbulencia': {
      const [fx, fy] = Array.isArray(nodo.frecuencia) ? nodo.frecuencia : [nodo.frecuencia];
      const frecuencia = [fx, fy].filter((f): f is Valor => f !== undefined).map((f) => (num(f) / cap).toFixed(5)).join(' ');
      return `<feTurbulence type="${nodo.ruido === 'fractal' ? 'fractalNoise' : 'turbulence'}" baseFrequency="${frecuencia}" numOctaves="${nodo.octavas}" seed="${(semilla + nodo.semilla) % 10000}"${resultado}/>`;
    }
    case 'desplazar':
      return `<feDisplacementMap${entrada} in2="${ref(nodo.mapa)}" scale="${n(num(nodo.escala) * cap)}" xChannelSelector="R" yChannelSelector="G"${resultado}/>`;
    case 'desenfocar':
      return `<feGaussianBlur${entrada} stdDeviation="${n(num(nodo.radio) * cap)}"${resultado}/>`;
    case 'alfa': {
      const rgb = nodo.conservarColor ? '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0' : '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0';
      const a = num(nodo.a);
      const b = num(nodo.b);
      const fila = nodo.canal === 'R' ? `${a} 0 0 0 ${b}` : `0 0 0 ${a} ${b}`;
      return `<feColorMatrix${entrada} type="matrix" values="${rgb}  ${fila}"${resultado}/>`;
    }
    case 'dilatar':
    case 'erosionar':
      return `<feMorphology${entrada} operator="${nodo.tipo === 'dilatar' ? 'dilate' : 'erode'}" radius="${n(num(nodo.radio) * cap)}"${resultado}/>`;
    case 'inundar':
      return `<feFlood flood-color="${color(nodo.color)}" flood-opacity="${num(nodo.opacidad)}"${resultado}/>`;
    case 'componer': {
      const k = nodo.operador === 'aritmetico' && nodo.k ? ` k1="${num(nodo.k[0])}" k2="${num(nodo.k[1])}" k3="${num(nodo.k[2])}" k4="${num(nodo.k[3])}"` : '';
      return `<feComposite${entrada} in2="${ref(nodo.con)}" operator="${OPERADORES[nodo.operador]}"${k}${resultado}/>`;
    }
    case 'mover':
      return `<feOffset${entrada} dx="${n(num(nodo.dx) * cap)}" dy="${n(num(nodo.dy) * cap)}"${resultado}/>`;
    case 'fundir':
      return `<feMerge${resultado}>${nodo.entradas.map((e) => `<feMergeNode in="${ref(e)}"/>`).join('')}</feMerge>`;
    case 'brillo':
      return `<feSpecularLighting${entrada} surfaceScale="${n(num(nodo.relieve) * cap)}" specularConstant="${num(nodo.constante)}" specularExponent="${num(nodo.exponente)}" lighting-color="#ffffff"${resultado}><fePointLight x="${n(zona.x + nodo.luz.x * cap)}" y="${n(zona.y + nodo.luz.y * cap)}" z="${n(nodo.luz.z * cap)}"/></feSpecularLighting>`;
  }
}

/** Las formas que salen de las letras (gotas, círculos), con su azar propio. */
function emitir(e: Emisor, glifos: GlifoTrazado[], cap: number, num: (v: Valor) => number, semilla: number): string {
  const azar = mulberry32(semilla);
  const probabilidad = num(e.probabilidad);
  const largoMaximo = num(e.largo.max);
  // No caer sobre la línea de debajo: el largo se limita al hueco hasta las mayúsculas de la siguiente.
  const lineas = [...new Set(glifos.map((g) => g.base))].sort((a, b) => a - b);
  const hueco = (base: number) => {
    const siguiente = lineas.find((b) => b > base + 1);
    return siguiente === undefined ? Infinity : siguiente - cap - base - cap * 0.2;
  };
  const formas: string[] = [];
  for (const g of glifos) {
    const cuantas = azar() >= probabilidad ? 0 : azar() < probabilidad * e.segunda ? 2 : 1;
    const arranque = Math.min(g.caja.y1, g.base);
    const libre = e.noInvadir ? hueco(g.base) : Infinity;
    for (let k = 0; k < cuantas; k++) {
      const ancho = cap * (e.ancho[0] + azar() * (e.ancho[1] - e.ancho[0]));
      const x = g.caja.x0 + ancho + azar() * Math.max(1, g.caja.x1 - g.caja.x0 - 2 * ancho);
      // El remate redondo sobresale medio ancho por debajo del largo: también cuenta para no invadir.
      const largo = Math.min(cap * (e.largo.min + Math.pow(azar(), e.largo.curva) * Math.max(0, largoMaximo - e.largo.min)), libre - ancho * 0.45);
      if (largo < cap * 0.08) continue;
      const y0 = arranque - cap * e.solape;
      const y1 = arranque + largo;
      if (e.forma === 'gota') {
        const arriba = ancho * 0.62;
        const abajo = ancho * 0.42;
        formas.push(`<path d="M${n(x - arriba)} ${n(y0)}L${n(x + arriba)} ${n(y0)}L${n(x + abajo)} ${n(y1)}L${n(x - abajo)} ${n(y1)}Z"/>`);
        formas.push(`<circle cx="${n(x)}" cy="${n(y1 - ancho * 0.2)}" r="${n(ancho * 0.62)}"/>`);
      } else {
        formas.push(`<circle cx="${n(x)}" cy="${n(y1)}" r="${n(ancho / 2)}"/>`);
      }
    }
  }
  return formas.join('');
}
