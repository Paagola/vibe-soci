// Paleta y materiales del diorama (preset stroked-toon del kit Diorama: colores planos, cuatro escalones de sombra y
// contorno de tinta). Los colores de marca son los de SOCIETY; el amarillo se reserva SIEMPRE para lo que espera a la
// persona (la señal de las paradas), como en la interfaz. Ningún otro objeto de la escena es amarillo, salvo la
// estrella de la sudadera de la mascota, que es parte de su identidad.
import * as THREE from 'three';

export const COLOR = Object.freeze({
  azul: 0x1033ef,
  azulHondo: 0x0b25b0,
  amarillo: 0xf5c518,
  tinta: 0x151515,
  papel: 0xf2f1ec,
  losa: 0xf7f6f1,
  pasillo: 0xe6e3da,
  mesa: 0xd8d2c4,
  mesaCanto: 0xbfb6a3,
  pata: 0x4a4a52,
  maquina: 0xeceae4,
  maquinaOscura: 0x3b3d46,
  blanco: 0xfbfbf8,
  gris: 0xa9a7a0,
  corcho: 0xc89a62,
  madera: 0xb98b5b,
  verde: 0x24a148,
  rojo: 0xe0413a,
  lampara: 0x6f8dff,
  pantalon: 0x2a2a31,
});

/** Crea los materiales a partir del helper del kit (`look.toon` / `look.flat`). */
export function crearMateriales(look) {
  const t = (c, o) => look.toon(c, o);
  return {
    losa: t(COLOR.losa),
    losaCanto: t(COLOR.azul),
    pasillo: t(COLOR.pasillo, { outline: false }),
    marca: t(COLOR.gris, { outline: false }),
    mesa: t(COLOR.mesa),
    mesaCanto: t(COLOR.mesaCanto),
    pata: t(COLOR.pata),
    maquina: t(COLOR.maquina),
    maquinaOscura: t(COLOR.maquinaOscura),
    azul: t(COLOR.azul),
    azulHondo: t(COLOR.azulHondo),
    blanco: t(COLOR.blanco),
    tinta: t(COLOR.tinta),
    gris: t(COLOR.gris),
    corcho: t(COLOR.corcho),
    madera: t(COLOR.madera),
    verde: t(COLOR.verde),
    rojo: t(COLOR.rojo),
    amarillo: t(COLOR.amarillo),
    pantalon: t(COLOR.pantalon),
    // Lámpara de «trabajando»: un cristal que se enciende (emisivo), sin halo plano (regla FLAT_GLOW del kit).
    lamparaApagada: t(0x9aa3c4),
    lamparaEncendida: look.flat(COLOR.lampara),
    // Sombra de contacto: plano sin contorno (el OutlineEffect lee material.userData.outlineParameters).
    sombra: look.flat(0x000000, { transparent: true, opacity: 0.16, depthWrite: false }),
  };
}

// ---------------------------------------------------------------- Texturas pintadas (lo que viaja de mano en mano)

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

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/** La foto del plato: la subida (de lado, con prisa) o la nueva (cenital, limpia). */
function pintarFoto(g, w, h, nueva) {
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, w, h);
  const m = w * 0.07;
  g.fillStyle = nueva ? '#2b2420' : '#8d8577';
  g.fillRect(m, m, w - 2 * m, h - 2 * m * 2.2);
  const cx = w / 2;
  const cy = m + (h - 2 * m * 2.2) / 2;
  g.save();
  if (!nueva) {
    g.translate(cx, cy + h * 0.04);
    g.scale(1, 0.55);
    g.rotate(-0.15);
  } else {
    g.translate(cx, cy);
  }
  g.fillStyle = '#f4f1ea';
  g.beginPath();
  g.arc(0, 0, w * 0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e0613a';
  g.beginPath();
  g.ellipse(0, 0, w * 0.17, w * 0.12, 0.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f2a33a';
  g.beginPath();
  g.ellipse(w * 0.05, -w * 0.03, w * 0.07, w * 0.05, 0.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4c8a3f';
  g.beginPath();
  g.ellipse(-w * 0.08, w * 0.05, w * 0.04, w * 0.025, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function sello(g, w, h, ok) {
  g.save();
  g.lineWidth = w * 0.06;
  g.lineCap = 'round';
  g.strokeStyle = ok ? hex(COLOR.verde) : hex(COLOR.rojo);
  g.beginPath();
  if (ok) {
    g.moveTo(w * 0.62, h * 0.8);
    g.lineTo(w * 0.72, h * 0.89);
    g.lineTo(w * 0.9, h * 0.7);
  } else {
    g.moveTo(w * 0.25, h * 0.15);
    g.lineTo(w * 0.75, h * 0.62);
    g.moveTo(w * 0.75, h * 0.15);
    g.lineTo(w * 0.25, h * 0.62);
  }
  g.stroke();
  g.restore();
}

function lineas(g, x, y, ancho, n, paso, color = '#7b7a74') {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) g.fillRect(x, y + i * paso, ancho * (i % 3 === 2 ? 0.6 : 1), paso * 0.35);
}

/** Textura de cada clase de material. */
export function texturaDe(tipo) {
  switch (tipo) {
    case 'ficha':
      return lienzo('ficha', 128, 160, (g, w, h) => {
        g.fillStyle = '#fbfbf8';
        g.fillRect(0, 0, w, h);
        g.fillStyle = hex(COLOR.azul);
        g.fillRect(w * 0.1, h * 0.08, w * 0.8, h * 0.45);
        g.fillStyle = '#fbfbf8';
        g.beginPath();
        g.arc(w * 0.5, h * 0.3, w * 0.18, 0, Math.PI * 2);
        g.fill();
        lineas(g, w * 0.1, h * 0.62, w * 0.8, 4, h * 0.08);
      });
    case 'foto':
      return lienzo('foto', 128, 160, (g, w, h) => pintarFoto(g, w, h, false));
    case 'propuesta':
      return lienzo('propuesta', 128, 160, (g, w, h) => {
        g.fillStyle = '#fbfbf8';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#151515';
        g.lineWidth = 3;
        g.strokeRect(w * 0.12, h * 0.08, w * 0.42, h * 0.3);
        g.beginPath();
        g.moveTo(w * 0.33, h * 0.12);
        g.lineTo(w * 0.33, h * 0.34);
        g.stroke();
        lineas(g, w * 0.6, h * 0.1, w * 0.3, 4, h * 0.07);
        lineas(g, w * 0.12, h * 0.46, w * 0.78, 6, h * 0.08);
      });
    case 'fotoNueva':
      return lienzo('fotoNueva', 128, 160, (g, w, h) => pintarFoto(g, w, h, true));
    case 'fotoOk':
      return lienzo('fotoOk', 128, 160, (g, w, h) => {
        pintarFoto(g, w, h, true);
        sello(g, w, h, true);
      });
    case 'fotoMal':
      return lienzo('fotoMal', 128, 160, (g, w, h) => {
        pintarFoto(g, w, h, true);
        sello(g, w, h, false);
      });
    case 'recorte':
      return lienzo('recorte', 128, 160, (g, w, h) => {
        g.fillStyle = '#fbfbf8';
        g.fillRect(0, 0, w, h);
        g.save();
        g.setLineDash([7, 5]);
        g.strokeStyle = '#151515';
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(w / 2, h * 0.42, w * 0.33, w * 0.33, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
        g.fillStyle = '#e0613a';
        g.beginPath();
        g.ellipse(w / 2, h * 0.42, w * 0.17, w * 0.12, 0.4, 0, Math.PI * 2);
        g.fill();
        lineas(g, w * 0.12, h * 0.82, w * 0.76, 2, h * 0.07);
      });
    case 'boceto':
      return lienzo('boceto', 128, 160, (g, w, h) => {
        g.fillStyle = '#fbfbf8';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#d9d6cf';
        g.fillRect(w * 0.1, h * 0.36, w * 0.8, h * 0.56);
        g.fillStyle = '#e0613a';
        g.beginPath();
        g.arc(w * 0.5, h * 0.64, w * 0.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#151515';
        g.fillRect(w * 0.1, h * 0.08, w * 0.7, h * 0.12);
        g.fillRect(w * 0.1, h * 0.24, w * 0.4, h * 0.05);
      });
    case 'pruebaMal':
      return lienzo('pruebaMal', 128, 160, (g, w, h) => {
        g.drawImage(texturaDe('boceto').image, 0, 0);
        g.strokeStyle = hex(COLOR.rojo);
        g.lineWidth = 5;
        g.beginPath();
        g.ellipse(w * 0.45, h * 0.15, w * 0.42, h * 0.11, 0, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(w * 0.8, h * 0.3);
        g.lineTo(w * 0.66, h * 0.52);
        g.stroke();
      });
    case 'post':
      return lienzo('post', 128, 160, (g, w, h) => {
        g.fillStyle = '#2b2420';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#f4f1ea';
        g.beginPath();
        g.arc(w * 0.5, h * 0.62, w * 0.34, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e0613a';
        g.beginPath();
        g.ellipse(w * 0.5, h * 0.62, w * 0.19, w * 0.13, 0.4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fbfbf8';
        g.font = `900 ${Math.round(h * 0.15)}px "Nunito", system-ui, sans-serif`;
        g.fillText('BRASA', w * 0.1, h * 0.2);
        g.fillStyle = hex(COLOR.azul);
        g.fillRect(w * 0.1, h * 0.26, w * 0.36, h * 0.04);
      });
    default:
      return null;
  }
}

/** Letrero pintado: la señal de la parada («TE TOCA») y la nube de aviso («503», «!»…). */
export function texturaLetrero(texto, { fondo = COLOR.amarillo, tinta = COLOR.tinta, ancho = 256, alto = 128, tamano = 0.5 } = {}) {
  return lienzo(`letrero:${texto}:${fondo}:${ancho}x${alto}`, ancho, alto, (g, w, h) => {
    g.fillStyle = hex(fondo);
    g.fillRect(0, 0, w, h);
    g.fillStyle = hex(tinta);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${Math.round(h * tamano)}px "Nunito", system-ui, sans-serif`;
    g.fillText(texto, w / 2, h * 0.54);
  });
}
