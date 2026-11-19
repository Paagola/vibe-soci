/**
 * Tipografías especiales: la letra tratada como un material. Todo se pinta con filtros SVG sobre los contornos reales
 * de la fuente (librsvg, dentro de sharp), así que el texto no puede salir mal escrito, no cuesta nada y es
 * determinista: la misma semilla da el mismo resultado.
 *
 * - derretida: gotas que cuelgan de la base de las letras y se funden con ellas; brillo de líquido espeso opcional.
 * - papel: cada letra es un recorte de papel algo girado, con el canto rasgado, grano y una sombra que lo levanta.
 * - antigua: tipo de imprenta gastado: canto algo irregular, motas finas sin tinta y zonas más gastadas.
 * - neon: un tubo de luz que sigue el contorno de la letra, con alma clara y halo.
 *
 * Los parámetros visuales se ajustaron mirando las muestras (npm run muestras-tipo); las medidas van en alturas de
 * mayúscula para que el efecto sea el mismo a cualquier cuerpo.
 */
import { mulberry32 } from '../../dominio/diseno/azar.js';
import type { TratamientoResuelto } from '../../dominio/diseno/resuelto.js';
import type { GlifoTrazado } from './MotorTexto.js';

export interface TextoTratado {
  definiciones: string;
  cuerpo: string;
}

/**
 * El SVG de un texto con tratamiento, en el sistema del bloque (quien lo llama le pone la matriz que lo coloca).
 * `cap` es la altura de mayúscula de la línea más grande, en px.
 */
export function pintarTratamiento(tratamiento: TratamientoResuelto, glifos: GlifoTrazado[], cap: number, color: string, idCapa: string): TextoTratado {
  const id = `tt-${idCapa.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  if (glifos.length === 0) return { definiciones: '', cuerpo: '' };
  const zona = region(glifos, cap);
  switch (tratamiento.tipo) {
    case 'derretida':
      return derretida(tratamiento, glifos, cap, color, id, zona);
    case 'papel':
      return papel(tratamiento, glifos, cap, color, id, zona);
    case 'antigua':
      return antigua(tratamiento, glifos, cap, color, id, zona);
    case 'neon':
      return neon(tratamiento, glifos, cap, color, id, zona);
  }
}

type Zona = { x: number; y: number; w: number; h: number };

/** Zona de trabajo de los filtros: la caja de las letras con margen para gotas, halos y sombras. */
function region(glifos: GlifoTrazado[], cap: number): Zona {
  const x0 = Math.min(...glifos.map((g) => g.caja.x0)) - cap;
  const y0 = Math.min(...glifos.map((g) => g.caja.y0)) - cap;
  const x1 = Math.max(...glifos.map((g) => g.caja.x1)) + cap;
  const y1 = Math.max(...glifos.map((g) => g.caja.y1)) + cap * 2;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const filtro = (id: string, zona: Zona, contenido: string) =>
  `<filter id="${id}" filterUnits="userSpaceOnUse" x="${n(zona.x)}" y="${n(zona.y)}" width="${n(zona.w)}" height="${n(zona.h)}" color-interpolation-filters="sRGB">${contenido}</filter>`;

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const frecuencia = (porCap: number, cap: number) => (porCap / cap).toFixed(5);

function derretida(t: Extract<TratamientoResuelto, { tipo: 'derretida' }>, glifos: GlifoTrazado[], cap: number, color: string, id: string, zona: Zona): TextoTratado {
  const azar = mulberry32(t.semilla);
  const gotas: string[] = [];
  // Una gota no puede caer sobre la línea de debajo: su largo se limita al hueco hasta las mayúsculas de la siguiente.
  const lineas = [...new Set(glifos.map((g) => g.base))].sort((a, b) => a - b);
  const hueco = (base: number) => {
    const siguiente = lineas.find((b) => b > base + 1);
    return siguiente === undefined ? Infinity : siguiente - cap - base - cap * 0.2;
  };
  for (const g of glifos) {
    const cuantas = azar() >= t.gotas ? 0 : azar() < t.gotas * 0.4 ? 2 : 1;
    // La gota sale de la base de la letra (o de su línea base, si la letra baja: p, g, j).
    const arranque = Math.min(g.caja.y1, g.base);
    const libre = hueco(g.base);
    for (let k = 0; k < cuantas; k++) {
      const ancho = cap * (0.06 + azar() * 0.07);
      const x = g.caja.x0 + ancho + azar() * Math.max(1, g.caja.x1 - g.caja.x0 - 2 * ancho);
      // La bolita del final sobresale medio ancho por debajo del largo: también cuenta.
      const largo = Math.min(cap * (0.12 + Math.pow(azar(), 1.7) * Math.max(0, t.largo - 0.12)), libre - ancho * 0.45);
      if (largo < cap * 0.08) continue;
      const y0 = arranque - cap * 0.18;
      const y1 = arranque + largo;
      const arriba = ancho * 0.62;
      const abajo = ancho * 0.42;
      gotas.push(`<path d="M${n(x - arriba)} ${n(y0)}L${n(x + arriba)} ${n(y0)}L${n(x + abajo)} ${n(y1)}L${n(x - abajo)} ${n(y1)}Z"/>`);
      gotas.push(`<circle cx="${n(x)}" cy="${n(y1 - ancho * 0.2)}" r="${n(ancho * 0.62)}"/>`);
    }
  }
  const letras = glifos.map((g) => g.d).join('');
  // Las gotas se funden con la parte baja de cada línea (la franja); la letra en sí queda nítida.
  const bases = [...new Set(glifos.map((g) => Math.round(g.base)))];
  const franja = bases.map((b) => `<rect x="${n(zona.x)}" y="${n(b - cap * 0.22)}" width="${n(zona.w)}" height="${n(cap * 3)}"/>`).join('');
  const brillo = t.brillo
    ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(cap * 0.035)}" result="relieve"/>
       <feSpecularLighting in="relieve" surfaceScale="${n(cap * 0.04)}" specularConstant="0.8" specularExponent="30" lighting-color="#ffffff" result="luz">
         <fePointLight x="${n(zona.x - cap)}" y="${n(zona.y - cap * 3)}" z="${n(cap * 3)}"/>
       </feSpecularLighting>
       <feComposite in="luz" in2="SourceAlpha" operator="in" result="luzDentro"/>
       <feComposite in="luzDentro" in2="SourceGraphic" operator="arithmetic" k1="0" k2="0.7" k3="1" k4="0"/>`
    : '<feMerge><feMergeNode in="SourceGraphic"/></feMerge>';
  return {
    definiciones:
      `<clipPath id="${id}-franja">${franja}</clipPath>` +
      filtro(`${id}-goo`, zona, `<feGaussianBlur in="SourceGraphic" stdDeviation="${n(cap * 0.04)}" result="b"/><feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"/>`) +
      filtro(`${id}-brillo`, zona, brillo),
    cuerpo: `<g filter="url(#${id}-brillo)" fill="${color}"><path d="${letras}"/><g filter="url(#${id}-goo)"><g clip-path="url(#${id}-franja)"><path d="${letras}"/></g>${gotas.join('')}</g></g>`,
  };
}

function papel(t: Extract<TratamientoResuelto, { tipo: 'papel' }>, glifos: GlifoTrazado[], cap: number, color: string, id: string, zona: Zona): TextoTratado {
  const azar = mulberry32(t.semilla);
  const letras = glifos
    .map((g) => {
      const giro = (azar() - 0.5) * 2 * t.giro;
      const dy = (azar() - 0.5) * cap * 0.06;
      const cx = (g.caja.x0 + g.caja.x1) / 2;
      const cy = (g.caja.y0 + g.caja.y1) / 2;
      return `<path d="${g.d}" transform="translate(0 ${n(dy)}) rotate(${n(giro)} ${n(cx)} ${n(cy)})"/>`;
    })
    .join('');
  const contenido = `
    <feTurbulence type="fractalNoise" baseFrequency="${frecuencia(9, cap)}" numOctaves="3" seed="${t.semilla % 10000}" result="fibra"/>
    <feMorphology in="SourceAlpha" operator="dilate" radius="${n(cap * 0.022)}" result="ancho"/>
    <feDisplacementMap in="ancho" in2="fibra" scale="${n(cap * 0.05)}" xChannelSelector="R" yChannelSelector="G" result="rasgado"/>
    <feFlood flood-color="${t.alma}" result="alma"/>
    <feComposite in="alma" in2="rasgado" operator="in" result="canto"/>
    <feDisplacementMap in="SourceGraphic" in2="fibra" scale="${n(cap * 0.012)}" xChannelSelector="R" yChannelSelector="G" result="cara"/>
    <feTurbulence type="fractalNoise" baseFrequency="${frecuencia(2.5, cap)}" numOctaves="4" seed="${(t.semilla + 7) % 10000}" result="grano"/>
    <feColorMatrix in="grano" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 -0.35" result="manchas"/>
    <feComposite in="manchas" in2="cara" operator="in" result="manchasDentro"/>
    <feMerge result="hoja"><feMergeNode in="canto"/><feMergeNode in="cara"/><feMergeNode in="manchasDentro"/></feMerge>
    <feGaussianBlur in="rasgado" stdDeviation="${n(cap * 0.03)}" result="difusa"/>
    <feOffset in="difusa" dx="${n(cap * 0.025)}" dy="${n(cap * 0.05)}" result="caida"/>
    <feColorMatrix in="caida" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${t.sombra} 0" result="sombra"/>
    <feMerge><feMergeNode in="sombra"/><feMergeNode in="hoja"/></feMerge>`;
  return { definiciones: filtro(`${id}-papel`, zona, contenido), cuerpo: `<g filter="url(#${id}-papel)" fill="${color}">${letras}</g>` };
}

function antigua(t: Extract<TratamientoResuelto, { tipo: 'antigua' }>, glifos: GlifoTrazado[], cap: number, color: string, id: string, zona: Zona): TextoTratado {
  const letras = glifos.map((g) => g.d).join('');
  // Con más desgaste aparecen más zonas gastadas y más motas sueltas.
  const zonas = -3.6 + 0.7 * t.desgaste;
  const sueltas = -23.5 + 2 * t.desgaste;
  const contenido = `
    <feTurbulence type="fractalNoise" baseFrequency="${frecuencia(5, cap)}" numOctaves="3" seed="${t.semilla % 10000}" result="ruido"/>
    <feDisplacementMap in="SourceGraphic" in2="ruido" scale="${n(cap * 0.014)}" xChannelSelector="R" yChannelSelector="G" result="canto"/>
    <feTurbulence type="fractalNoise" baseFrequency="${frecuencia(55, cap)}" numOctaves="1" seed="${(t.semilla + 3) % 10000}" result="fino"/>
    <feColorMatrix in="fino" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  18 0 0 0 -12.2" result="motas"/>
    <feTurbulence type="fractalNoise" baseFrequency="${frecuencia(2.2, cap)}" numOctaves="2" seed="${(t.semilla + 8) % 10000}" result="zonas"/>
    <feColorMatrix in="zonas" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  6 0 0 0 ${zonas.toFixed(3)}" result="gastado"/>
    <feComposite in="motas" in2="gastado" operator="in" result="huecosGastados"/>
    <feColorMatrix in="fino" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  30 0 0 0 ${sueltas.toFixed(3)}" result="huecosSueltos"/>
    <feMerge result="huecos"><feMergeNode in="huecosGastados"/><feMergeNode in="huecosSueltos"/></feMerge>
    <feComposite in="canto" in2="huecos" operator="out"/>`;
  return { definiciones: filtro(`${id}-antigua`, zona, contenido), cuerpo: `<g filter="url(#${id}-antigua)" fill="${color}"><path d="${letras}"/></g>` };
}

function neon(t: Extract<TratamientoResuelto, { tipo: 'neon' }>, glifos: GlifoTrazado[], cap: number, color: string, id: string, zona: Zona): TextoTratado {
  const letras = glifos.map((g) => g.d).join('');
  const grosor = cap * 0.055;
  const cerca = cap * 0.05 * t.halo;
  const lejos = cap * 0.18 * t.halo;
  const halo =
    t.halo > 0
      ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${n(cerca)}" result="a"/><feGaussianBlur in="SourceGraphic" stdDeviation="${n(lejos)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge>`
      : '<feMerge><feMergeNode in="SourceGraphic"/></feMerge>';
  return {
    definiciones: filtro(`${id}-halo`, zona, halo),
    cuerpo:
      `<g filter="url(#${id}-halo)"><path d="${letras}" fill="none" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round"/></g>` +
      `<path d="${letras}" fill="none" stroke="${t.alma}" stroke-width="${n(grosor * 0.35)}" stroke-linejoin="round" opacity="0.9"/>`,
  };
}
