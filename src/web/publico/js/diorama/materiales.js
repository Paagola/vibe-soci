// Paleta y materiales del loft (preset stroked-toon del kit Diorama: MeshToonMaterial con cuatro escalones y contorno
// de tinta). Marca SOCIETY + paleta secundaria por zonas (DESIGN.md):
// - fotografía: neutros cálidos, negro, azul y madera;   - laboratorio: azul petróleo, azul, gris y blanco;
// - dirección creativa: terracota, crema, madera;          - jardín: verdes variados;
// - composición: madera, grafito y colores de impresión;   - zonas comunes: cálidos y materiales naturales.
// El AMARILLO se reserva para lo que espera a la persona (paradas); la única excepción es la estrella de la mascota.
import * as THREE from 'three';

export const COLOR = Object.freeze({
  azul: 0x1033ef,
  azulHondo: 0x0b25b0,
  amarillo: 0xf5c518,
  tinta: 0x151515,
  // Arquitectura
  suelo: 0xd7d1c4,
  sueloJunta: 0xc3bcae,
  hormigon: 0xbab5ab,
  hormigonOscuro: 0x8f8a80,
  pared: 0xeee7da,
  cristal: 0xb9dde3,
  marco: 0x34363d,
  // Maderas y naturales
  madera: 0xc99a68,
  maderaClara: 0xe0bd8c,
  maderaOscura: 0x8a5a38,
  crema: 0xf1e6cf,
  arena: 0xdcc8a0,
  blancoCalido: 0xf7f2e8,
  corcho: 0xc6955c,
  // Zonas
  petroleo: 0x1f5f6b,
  petroleoClaro: 0x4a909b,
  terracota: 0xc65f3e,
  naranja: 0xe9893b,
  salvia: 0x9fb89b,
  bosque: 0x2f6a45,
  oliva: 0x7a8a3d,
  hoja: 0x4f8f50,
  hojaClara: 0x86b56c,
  hojaOscura: 0x2d5a3a,
  tierra: 0x5a4130,
  // Técnicos
  grafito: 0x34363d,
  metal: 0x6b6f78,
  metalClaro: 0xa9adb5,
  blanco: 0xfbfbf8,
  gris: 0xa8a69f,
  maquina: 0xeceae4,
  verde: 0x24a148,
  rojo: 0xe0413a,
  lampara: 0x8fb0ff,
  calida: 0xffd8a0,
  pantalon: 0x2a2a31,
  // Impresión (cian, magenta y el rojo de la tinta)
  cian: 0x1aa6c9,
  magenta: 0xc23a7a,
});

/** Crea los materiales a partir del helper del kit (`look.toon` / `look.flat`). Un material por color: se comparten. */
export function crearMateriales(look) {
  const t = (c, o) => look.toon(c, o);
  const m = {};
  for (const [nombre, c] of Object.entries(COLOR)) m[nombre] = t(c);
  Object.assign(m, {
    // Lo que no lleva contorno: suelos, juntas, alfombras, láminas y superficies planas de lectura.
    sueloPlano: t(COLOR.suelo, { outline: false }),
    juntas: t(COLOR.sueloJunta, { outline: false }),
    alfombra: t(COLOR.arena, { outline: false }),
    alfombraTerracota: t(COLOR.terracota, { outline: false }),
    cespedPlano: t(COLOR.hoja, { outline: false }),
    tierraPlana: t(COLOR.tierra, { outline: false }),
    // Cristal estilizado: un tinte claro, sin contorno (las cristaleras se leen por sus marcos).
    cristal: look.flat(COLOR.cristal, { transparent: true, opacity: 0.22, depthWrite: false }),
    cristalNoche: look.flat(0x1b2a4a, { transparent: true, opacity: 0.55, depthWrite: false }),
    // Luces de actividad: un cristal que se enciende (emisivo plano), nunca un halo plano (regla FLAT_GLOW del kit).
    lamparaApagada: t(0x9aa3c4),
    lamparaEncendida: look.flat(COLOR.lampara),
    calidaEncendida: look.flat(COLOR.calida),
    pantallaApagada: look.flat(0x1b1f2b),
    pantallaEncendida: look.flat(0x3a64ff),
    pilotoVerde: look.flat(0x3ddc84),
    pilotoRojo: look.flat(0xff5a4f),
    amarilloLuz: look.flat(COLOR.amarillo),
    papel: look.flat(COLOR.blancoCalido),
    sombra: look.flat(0x000000, { transparent: true, opacity: 0.16, depthWrite: false }),
  });
  return m;
}

// ---------------------------------------------------------------- Texturas pintadas (solo lo que NO es una imagen real)

const cache = new Map();

function lienzo(clave, ancho, alto, pintar) {
  if (cache.has(clave)) return cache.get(clave);
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const g = c.getContext('2d');
  pintar(g, ancho, alto);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(clave, tex);
  return tex;
}
export function liberarTexturasPintadas() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
function lineas(g, x, y, ancho, n, paso, color = '#7b7a74') {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) g.fillRect(x, y + i * paso, ancho * (i % 3 === 2 ? 0.6 : 1), paso * 0.35);
}

/**
 * Papeles de trabajo que no son imágenes (la propuesta del director de foto y la intención de diseño son JSON):
 * se pintan como hojas genéricas, sin fingir un contenido concreto.
 */
export function texturaDe(tipo) {
  switch (tipo) {
    case 'propuesta':
      return lienzo('propuesta', 192, 256, (g, w, h) => {
        g.fillStyle = '#fbfaf5';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#151515';
        g.lineWidth = 3;
        g.strokeRect(w * 0.12, h * 0.08, w * 0.4, h * 0.26);
        g.beginPath();
        g.moveTo(w * 0.32, h * 0.12);
        g.lineTo(w * 0.32, h * 0.3);
        g.stroke();
        lineas(g, w * 0.6, h * 0.1, w * 0.3, 4, h * 0.06);
        lineas(g, w * 0.12, h * 0.42, w * 0.78, 8, h * 0.065);
      });
    case 'boceto':
      return lienzo('boceto', 192, 256, (g, w, h) => {
        g.fillStyle = '#fbfaf5';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#3b3b3b';
        g.lineWidth = 2;
        g.setLineDash([6, 4]);
        g.strokeRect(w * 0.1, h * 0.36, w * 0.8, h * 0.56);
        g.setLineDash([]);
        g.beginPath();
        g.arc(w * 0.5, h * 0.64, w * 0.2, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = '#151515';
        g.fillRect(w * 0.1, h * 0.08, w * 0.7, h * 0.1);
        g.fillRect(w * 0.1, h * 0.22, w * 0.4, h * 0.04);
      });
    case 'pruebaMal':
      return lienzo('pruebaMal', 192, 256, (g, w, h) => {
        g.drawImage(texturaDe('boceto').image, 0, 0);
        g.strokeStyle = hex(COLOR.rojo);
        g.lineWidth = 6;
        g.beginPath();
        g.ellipse(w * 0.45, h * 0.13, w * 0.42, h * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(w * 0.8, h * 0.3);
        g.lineTo(w * 0.62, h * 0.52);
        g.stroke();
      });
    case 'carpeta':
      return lienzo('carpeta', 192, 256, (g, w, h) => {
        g.fillStyle = hex(COLOR.maderaClara);
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#fbfaf5';
        g.fillRect(w * 0.12, h * 0.1, w * 0.76, h * 0.8);
        lineas(g, w * 0.2, h * 0.2, w * 0.6, 8, h * 0.08);
      });
    default:
      return null;
  }
}

/** El sello del revisor sobre la foto: el veredicto REAL de la comprobación (PASA, DESCARTA, REVISAR, RECHAZADA). */
export function texturaSello(veredicto) {
  return lienzo(`sello:${veredicto}`, 256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const color = veredicto === 'DESCARTA' || veredicto === 'RECHAZADA' ? hex(COLOR.rojo) : veredicto === 'REVISAR' ? hex(COLOR.naranja) : hex(COLOR.verde);
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.12);
    g.strokeStyle = color;
    g.lineWidth = 9;
    g.strokeRect(-w * 0.44, -h * 0.36, w * 0.88, h * 0.72);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${Math.round(h * 0.42)}px "Nunito", system-ui, sans-serif`;
    g.fillText(veredicto, 0, h * 0.03);
    g.restore();
  });
}

/** Letrero pintado: la señal de la parada («TE TOCA»), la nube de aviso, rótulos del loft. */
export function texturaLetrero(texto, { fondo = COLOR.amarillo, tinta = COLOR.tinta, ancho = 256, alto = 128, tamano = 0.5, fuente = 'Nunito', peso = 900 } = {}) {
  return lienzo(`letrero:${texto}:${fondo}:${tinta}:${ancho}x${alto}:${fuente}`, ancho, alto, (g, w, h) => {
    if (fondo === null) g.clearRect(0, 0, w, h);
    else {
      g.fillStyle = hex(fondo);
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = hex(tinta);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${peso} ${Math.round(h * tamano)}px "${fuente}", system-ui, sans-serif`;
    g.fillText(texto, w / 2, h * 0.54);
  });
}

/** Pizarra con una lista de textos reales (los platos de los encargos abiertos), escrita a mano. */
export function texturaPizarra(titulo, lineasTexto) {
  const clave = `pizarra:${titulo}:${lineasTexto.join('|')}`;
  return lienzo(clave, 512, 320, (g, w, h) => {
    g.fillStyle = '#f9f8f3';
    g.fillRect(0, 0, w, h);
    g.fillStyle = hex(COLOR.azul);
    g.font = `800 34px "Nunito", system-ui, sans-serif`;
    g.fillText(titulo, 24, 48);
    g.font = `700 26px "Nunito", system-ui, sans-serif`;
    lineasTexto.slice(0, 6).forEach((l, i) => {
      g.fillStyle = ['#151515', hex(COLOR.terracota), hex(COLOR.petroleo)][i % 3];
      g.fillText(`· ${l.length > 30 ? `${l.slice(0, 29)}…` : l}`, 30, 98 + i * 38);
    });
    if (!lineasTexto.length) {
      g.fillStyle = '#9a978f';
      g.fillText('(sin encargos abiertos)', 30, 98);
    }
    // Notas adhesivas (ambiente; sin texto inventado).
    for (const [x, y, c] of [[w - 130, 24, '#9fd3c7'], [w - 90, 120, '#f2b8a2'], [w - 150, 210, '#c9d98f']]) {
      g.fillStyle = c;
      g.fillRect(x, y, 84, 72);
    }
  });
}
