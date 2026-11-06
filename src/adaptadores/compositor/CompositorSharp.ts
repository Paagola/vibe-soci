/**
 * Compositor por capas con sharp (raster), SVG (vectorial) y fontkit (texto como trazos).
 * Cada capa se pinta sola en un PNG del tamaño del lienzo y se guarda en caché: si una capa no cambia,
 * no se vuelve a pintar. Así cambiar un titular no regenera la foto ni el resto.
 */
import { createHash } from 'node:crypto';
import sharp, { type Blend, type OverlayOptions, type Sharp } from 'sharp';
import type { Fusion, Intencion, Retoque } from '../../dominio/diseno/intencion.js';
import { nombreDeCapa, type CapaResuelta, type Resuelto } from '../../dominio/diseno/resuelto.js';
import type { Lienzo } from '../../dominio/diseno/reticula.js';
import type { ActivoDisponible, CapaRenderizada, Compositor, Renderizado } from '../../puertos/Compositor.js';
import type { MotorTexto } from './MotorTexto.js';
import { conOpacidad, documentoSvg, enLienzo, escaparXml, mascaraAlTamano, redondear, trazoDeTexto } from './raster.js';
import { ResolutorDiseno } from './resolutor.js';
import type { CatalogoTipografico } from './tipografias.js';

const FUSION_SHARP: Record<Fusion, Blend> = {
  normal: 'over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft-light': 'soft-light',
  darken: 'darken',
  lighten: 'lighten',
};

export class CompositorSharp implements Compositor {
  private readonly resolutor: ResolutorDiseno;
  /** PNG de cada capa ya pintada, por el contenido que la define. */
  private readonly cache = new Map<string, Buffer>();

  constructor(
    private readonly motor: MotorTexto,
    private readonly catalogo: CatalogoTipografico,
  ) {
    this.resolutor = new ResolutorDiseno(motor);
  }

  resolver(intencion: Intencion, activos: Record<string, ActivoDisponible>): Promise<Resuelto> {
    return this.resolutor.resolver(intencion, activos);
  }

  async renderizar(resuelto: Resuelto, activos: Record<string, ActivoDisponible>): Promise<Renderizado> {
    const capas: CapaRenderizada[] = [];
    for (const capa of resuelto.capas) {
      const clave = claveDe(capa, resuelto.lienzo, activos);
      const guardada = this.cache.get(clave);
      const png = guardada ?? (await this.pintar(capa, resuelto.lienzo, activos));
      if (!guardada) this.cache.set(clave, png);
      capas.push({ id: capa.id, z: capa.z, png, reutilizada: Boolean(guardada) });
    }
    return {
      png: await componer(resuelto, capas, 0, capas.length),
      capas,
      svgEditable: this.svg(resuelto, capas, 'editable'),
      svgExacto: this.svg(resuelto, capas, 'exacto'),
      contraste: await this.medirContraste(resuelto, capas),
    };
  }

  // ------------------------------------------------------------------ Pintar cada capa

  private async pintar(capa: CapaResuelta, lienzo: Lienzo, activos: Record<string, ActivoDisponible>): Promise<Buffer> {
    switch (capa.tipo) {
      case 'relleno':
        return vectorial(lienzo, `<rect width="${lienzo.ancho}" height="${lienzo.alto}" fill="${capa.color}" opacity="${capa.opacidad}"/>`);

      case 'degradado': {
        const { rect: r } = capa;
        const paradas = capa.paradas.map((p) => `<stop offset="${p.en}" stop-color="${p.color}" stop-opacity="${p.opacidad}"/>`).join('');
        let definicion: string;
        if (capa.forma === 'radial') {
          definicion = `<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" r="${Math.max(r.w, r.h) / 2}">${paradas}</radialGradient>`;
        } else {
          const a = (capa.angulo * Math.PI) / 180;
          const mitad = (Math.abs(r.w * Math.cos(a)) + Math.abs(r.h * Math.sin(a))) / 2;
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          definicion = `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${cx - Math.cos(a) * mitad}" y1="${cy - Math.sin(a) * mitad}" x2="${cx + Math.cos(a) * mitad}" y2="${cy + Math.sin(a) * mitad}">${paradas}</linearGradient>`;
        }
        return vectorial(lienzo, `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#g)" opacity="${capa.opacidad}"/>`, definicion);
      }

      case 'imagen': {
        const disponible = activos[capa.activo]!;
        const { ancho, alto } = disponible.activo;
        const w = Math.max(1, Math.round(capa.destino.w));
        const h = Math.max(1, Math.round(capa.destino.h));
        const foto = await retocar(sharp(disponible.ruta).rotate().removeAlpha().extract(redondear(capa.origen, ancho, alto)).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }), capa.retoque)
          .ensureAlpha()
          .png()
          .toBuffer();
        return conOpacidad(await enLienzo(foto, capa.destino.x, capa.destino.y, lienzo), capa.opacidad);
      }

      case 'recorte': {
        const disponible = activos[capa.activo]!;
        const recorte = await recortar(disponible, capa.origen, capa.destino.w, capa.destino.h, capa.bordeSuave, capa.contraerBorde, capa.retoque);
        return conOpacidad(await enLienzo(recorte, capa.destino.x, capa.destino.y, lienzo), capa.opacidad);
      }

      case 'sombra': {
        const sigma = Math.max(0.3, capa.desenfoque / 2);
        if (capa.modo === 'contacto') {
          const { x, y, w, h } = capa.rect;
          const svg = documentoSvg(lienzo, `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${capa.color}"/>`);
          const difuminada = await sharp(Buffer.from(svg)).blur(sigma).png().toBuffer();
          return conOpacidad(difuminada, capa.opacidad);
        }
        const disponible = activos[capa.activo]!;
        const margen = Math.ceil(capa.desenfoque * 1.5) + 2;
        const w = Math.max(1, Math.round(capa.rect.w));
        const h = Math.max(1, Math.round(capa.rect.h));
        // Primero se agranda el lienzo de la máscara y después se difumina (en pasos separados: sharp tiene un orden fijo).
        const ampliada = await (await alfaRecortado(disponible, capa.origen, w, h))
          .extend({ top: margen, bottom: margen, left: margen, right: margen, background: '#000000' })
          .png()
          .toBuffer();
        const alfa = await sharp(ampliada).blur(sigma).linear(capa.opacidad, 0).toBuffer();
        const sombra = await sharp({ create: { width: w + 2 * margen, height: h + 2 * margen, channels: 3, background: capa.color } }).joinChannel(alfa).png().toBuffer();
        return enLienzo(sombra, capa.rect.x - margen, capa.rect.y - margen, lienzo);
      }

      case 'texto': {
        const pintura = capa.contorno
          ? `fill="none" stroke="${capa.estilo.color}" stroke-width="${capa.contorno}" stroke-linejoin="round"`
          : `fill="${capa.estilo.color}"`;
        return vectorial(lienzo, `<path d="${trazoDeTexto(this.motor, capa)}" transform="matrix(${capa.matriz.join(' ')})" ${pintura} opacity="${capa.opacidad}"/>`);
      }

      case 'forma': {
        const trazo = capa.grosor
          ? `fill="none" stroke="${capa.color}" stroke-width="${capa.grosor}"${capa.discontinua ? ` stroke-dasharray="${capa.discontinua.join(' ')}"` : ''}`
          : `fill="${capa.color}"`;
        let figura = '';
        if (capa.figura === 'linea' && capa.desde && capa.hasta) figura = `<line x1="${capa.desde.x}" y1="${capa.desde.y}" x2="${capa.hasta.x}" y2="${capa.hasta.y}" ${trazo}/>`;
        else if (capa.figura === 'rect' && capa.rect) figura = `<rect x="${capa.rect.x}" y="${capa.rect.y}" width="${capa.rect.w}" height="${capa.rect.h}" ${trazo}/>`;
        else if (capa.figura === 'elipse' && capa.rect) figura = `<ellipse cx="${capa.rect.x + capa.rect.w / 2}" cy="${capa.rect.y + capa.rect.h / 2}" rx="${capa.rect.w / 2}" ry="${capa.rect.h / 2}" ${trazo}/>`;
        return vectorial(lienzo, `<g opacity="${capa.opacidad}">${figura}</g>`);
      }

      case 'circulo-texto': {
        const altura = this.motor.alturaMayusculas(capa.estilo, capa.tamano);
        const disco = capa.fondo ? `<circle cx="${capa.centro.x}" cy="${capa.centro.y}" r="${capa.radio + altura + capa.tamano * 0.55}" fill="${capa.fondo}"/>` : '';
        const letras = this.motor.trazarCircular(capa.estilo, capa.texto, capa.tamano, capa.centro.x, capa.centro.y, capa.radio, capa.giro);
        return vectorial(lienzo, `<g opacity="${capa.opacidad}">${disco}<path d="${letras}" fill="${capa.estilo.color}"/></g>`);
      }

      case 'niveles': {
        const separacion = capa.tamano * 0.5;
        const partes = capa.lineas.map((linea) => {
          const raya = `<line x1="${linea.x1}" y1="${linea.y}" x2="${linea.x2}" y2="${linea.y}" stroke="${capa.color}" stroke-width="${capa.grosor}"${capa.discontinua ? ` stroke-dasharray="${capa.discontinua.join(' ')}"` : ''}/>`;
          const base = linea.y - separacion;
          const izquierda = linea.izquierda ? this.rotulo(capa, linea.izquierda, linea.x1, base, 'izquierda') : '';
          const derecha = linea.derecha ? this.rotulo(capa, linea.derecha, linea.x2, base, 'derecha') : '';
          return raya + izquierda + derecha;
        });
        return vectorial(lienzo, `<g opacity="${capa.opacidad}">${partes.join('')}</g>`);
      }

      case 'textura':
        return grano(lienzo, capa.intensidad, capa.escala, capa.semilla);
    }
  }

  private rotulo(capa: Extract<CapaResuelta, { tipo: 'niveles' }>, texto: string, x: number, base: number, alinear: 'izquierda' | 'derecha'): string {
    const medida = this.motor.medir(capa.estilo, texto, capa.tamano);
    const origen = alinear === 'izquierda' ? x - medida.minX : x - medida.maxX;
    return `<path d="${this.motor.trazar(capa.estilo, texto, capa.tamano, origen, base)}" fill="${capa.color}"/>`;
  }

  // ------------------------------------------------------------------ Contraste

  /**
   * Contraste WCAG de cada texto con lo que tiene detrás, solo donde el texto se ve (no donde lo tapa el sujeto).
   * Se da el peor 10 % de sus píxeles: si una parte del texto cae sobre una zona clara, se nota.
   */
  private async medirContraste(resuelto: Resuelto, capas: CapaRenderizada[]): Promise<Record<string, number>> {
    const resultado: Record<string, number> = {};
    const w = Math.round(resuelto.lienzo.ancho / 2);
    const h = Math.round(resuelto.lienzo.alto / 2);
    for (const [i, capa] of resuelto.capas.entries()) {
      if (capa.tipo !== 'texto' || capa.contorno) continue;
      const debajo = await sharp(await componer(resuelto, capas, 0, i)).resize(w, h).removeAlpha().raw().toBuffer();
      const texto = await sharp(capas[i]!.png).resize(w, h).extractChannel(3).raw().toBuffer();
      const encima = i + 1 < capas.length ? await sharp(await componer(resuelto, capas, i + 1, capas.length)).resize(w, h).extractChannel(3).raw().toBuffer() : undefined;
      const lt = luminancia(...hexARgb(capa.estilo.color));
      const ratios: number[] = [];
      for (let p = 0; p < w * h; p++) {
        if (texto[p]! < 200 || (encima && encima[p]! > 60)) continue;
        const lb = luminancia(debajo[p * 3]!, debajo[p * 3 + 1]!, debajo[p * 3 + 2]!);
        ratios.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05));
      }
      if (ratios.length === 0) continue;
      ratios.sort((a, b) => a - b);
      resultado[capa.id] = Math.round(ratios[Math.floor(ratios.length * 0.1)]! * 100) / 100;
    }
    return resultado;
  }

  // ------------------------------------------------------------------ SVG por capas

  /**
   * SVG con una entrada por capa, en orden. Las capas de imagen van incrustadas (PNG en base64), para que
   * el archivo se abra solo en Figma o Illustrator; también están sueltas en capas/.
   * Editable: el texto va como <text> (se cambia si están instaladas las fuentes de recursos/tipografias).
   * Exacto: el texto va como trazos (igual que el PNG, sin depender de las fuentes).
   */
  private svg(resuelto: Resuelto, capas: CapaRenderizada[], modo: 'editable' | 'exacto'): string {
    const { ancho, alto } = resuelto.lienzo;
    const partes = resuelto.capas.map((capa, i) => {
      const fusion = capa.fusion === 'normal' ? '' : ` style="mix-blend-mode:${capa.fusion}"`;
      if (capa.tipo !== 'texto') {
        const datos = capas[i]!.png.toString('base64');
        return `  <image id="${capa.id}" data-archivo="capas/${nombreDeCapa(capa)}" href="data:image/png;base64,${datos}" x="0" y="0" width="${ancho}" height="${alto}"${fusion}/>`;
      }
      const matriz = `matrix(${capa.matriz.join(' ')})`;
      if (modo === 'exacto') {
        const pintura = capa.contorno ? `fill="none" stroke="${capa.estilo.color}" stroke-width="${capa.contorno}"` : `fill="${capa.estilo.color}"`;
        return `  <path id="${capa.id}" d="${trazoDeTexto(this.motor, capa)}" transform="${matriz}" ${pintura} opacity="${capa.opacidad}"${fusion}/>`;
      }
      const familia = this.catalogo.familia(capa.estilo.fuente);
      const peso = capa.estilo.ejes.wght ?? 400;
      const anchura = capa.estilo.ejes.wdth ?? 100;
      const pintura = capa.contorno ? `fill="none" stroke="${capa.estilo.color}" stroke-width="${capa.contorno}"` : `fill="${capa.estilo.color}"`;
      const lineas = capa.lineas
        .map((l) => `<text x="${l.x}" y="${l.base}" font-size="${l.tamano}" letter-spacing="${capa.estilo.tracking * l.tamano}">${escaparXml(l.texto)}</text>`)
        .join('');
      return `  <g id="${capa.id}" transform="${matriz}" font-family="${familia}" font-weight="${Math.round(peso)}" style="font-variation-settings:'wdth' ${anchura}, 'wght' ${peso}${capa.fusion === 'normal' ? '' : `; mix-blend-mode:${capa.fusion}`}" ${pintura} opacity="${capa.opacidad}">${lineas}</g>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">\n${partes.join('\n')}\n</svg>\n`;
  }
}

// ------------------------------------------------------------------ Ayudantes

/** Lo que define el contenido de una capa: si no cambia, la capa no se vuelve a pintar. */
function claveDe(capa: CapaResuelta, lienzo: Lienzo, activos: Record<string, ActivoDisponible>): string {
  const { z: _z, ...contenido } = capa;
  const activo = 'activo' in capa ? activos[capa.activo]?.activo.sha256 : undefined;
  return createHash('sha256').update(JSON.stringify({ contenido, lienzo, activo })).digest('hex');
}

async function componer(resuelto: Resuelto, capas: CapaRenderizada[], desde: number, hasta: number): Promise<Buffer> {
  const { ancho, alto } = resuelto.lienzo;
  const entradas = capas.slice(desde, hasta).map((capa, i) => ({ input: capa.png, blend: FUSION_SHARP[resuelto.capas[desde + i]!.fusion] }));
  return sharp({ create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(entradas)
    .png()
    .toBuffer();
}

function vectorial(lienzo: Lienzo, cuerpo: string, definiciones = ''): Promise<Buffer> {
  return sharp(Buffer.from(documentoSvg(lienzo, cuerpo, 1, definiciones))).png().toBuffer();
}

/** Ajustes fotográficos suaves: brillo y saturación (modulate), contraste (linear) y calidez (recomb). */
function retocar(imagen: Sharp, retoque?: Retoque): Sharp {
  if (!retoque) return imagen;
  let resultado = imagen;
  if (retoque.brillo !== undefined || retoque.saturacion !== undefined) resultado = resultado.modulate({ brightness: retoque.brillo ?? 1, saturation: retoque.saturacion ?? 1 });
  if (retoque.contraste !== undefined) resultado = resultado.linear(retoque.contraste, 128 * (1 - retoque.contraste));
  if (retoque.calidez) {
    const c = retoque.calidez;
    resultado = resultado.recomb([
      [1 + c, 0, 0],
      [0, 1, 0],
      [0, 0, 1 - c],
    ]);
  }
  return resultado;
}

async function alfaRecortado(disponible: ActivoDisponible, origen: { x: number; y: number; w: number; h: number }, w: number, h: number): Promise<Sharp> {
  const { ancho, alto } = disponible.activo;
  if (!disponible.rutaMascara) throw new RangeError(`El activo «${disponible.activo.id}» no tiene máscara.`);
  return sharp(await mascaraAlTamano(disponible.rutaMascara, ancho, alto)).extract(redondear(origen, ancho, alto)).resize(w, h, { fit: 'fill' }).extractChannel(0);
}

async function recortar(
  disponible: ActivoDisponible,
  origen: { x: number; y: number; w: number; h: number },
  anchoDestino: number,
  altoDestino: number,
  bordeSuave: number,
  contraerBorde: number,
  retoque?: Retoque,
): Promise<Buffer> {
  const { ancho, alto } = disponible.activo;
  const w = Math.max(1, Math.round(anchoDestino));
  const h = Math.max(1, Math.round(altoDestino));
  const color = await retocar(sharp(disponible.ruta).rotate().removeAlpha().extract(redondear(origen, ancho, alto)).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }), retoque).toBuffer();
  let alfa = await (await alfaRecortado(disponible, origen, w, h)).png().toBuffer();
  if (contraerBorde > 0) {
    // Encoger: se difumina y se vuelve a cortar por arriba de la mitad; el borde entra unos px hacia dentro.
    alfa = await sharp(alfa).blur(Math.max(0.3, contraerBorde)).linear(3, -3 * 170).png().toBuffer();
  }
  if (bordeSuave > 0) alfa = await sharp(alfa).blur(Math.max(0.3, bordeSuave)).png().toBuffer();
  return sharp(color).joinChannel(alfa).png().toBuffer();
}

/** Grano de película determinista (misma semilla, mismo grano): gris neutro con un poco de alfa, para fusionar en overlay. */
async function grano(lienzo: Lienzo, intensidad: number, escala: number, semilla: number): Promise<Buffer> {
  const w = Math.ceil(lienzo.ancho / escala);
  const h = Math.ceil(lienzo.alto / escala);
  const datos = Buffer.alloc(w * h * 4);
  const azar = mulberry32(semilla);
  const alfa = Math.round(255 * intensidad);
  for (let i = 0; i < w * h; i++) {
    // Suma de tres uniformes: aproxima una campana sin coste.
    const valor = Math.max(0, Math.min(255, Math.round(128 + (azar() + azar() + azar() - 1.5) * 150)));
    datos[i * 4] = valor;
    datos[i * 4 + 1] = valor;
    datos[i * 4 + 2] = valor;
    datos[i * 4 + 3] = alfa;
  }
  return sharp(datos, { raw: { width: w, height: h, channels: 4 } }).resize(lienzo.ancho, lienzo.alto, { kernel: 'cubic' }).png().toBuffer();
}

function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexARgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa (WCAG 2). */
function luminancia(r: number, g: number, b: number): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
