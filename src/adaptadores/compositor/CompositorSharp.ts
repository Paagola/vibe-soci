/**
 * Compositor por capas con sharp (raster), SVG (vectorial) y fontkit (texto como trazos).
 * Cada capa se pinta sola en un PNG del tamaño del lienzo y se guarda en caché: si una capa no cambia,
 * no se vuelve a pintar. Así cambiar un titular no regenera la foto ni el resto.
 *
 * F3 añade capas y tratamientos (sello, patrón, trazo a mano, giro libre, corte, tinta impresa, texto recortado por el
 * sujeto, duotono y trama): la geometría de cada uno está en su archivo (formas, trazoAMano, tramado, tinta) y aquí
 * solo se monta y se pinta.
 */
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import sharp, { type Blend, type Sharp } from 'sharp';
import { mulberry32 } from '../../dominio/diseno/azar.js';
import { hexARgb, luminancia } from '../../dominio/diseno/color.js';
import type { Fusion, Intencion, Retoque } from '../../dominio/diseno/intencion.js';
import { nombreDeCapa, type CapaResuelta, type Resuelto } from '../../dominio/diseno/resuelto.js';
import type { Lienzo, Rect } from '../../dominio/diseno/reticula.js';
import { RAIZ } from '../../config.js';
import type { BibliotecaDeTratamientos } from '../../puertos/BibliotecaDeTratamientos.js';
import type { ActivoDisponible, CapaRenderizada, Compositor, Renderizado } from '../../puertos/Compositor.js';
import { BibliotecaTratamientosFicheros } from '../ficheros/BibliotecaTratamientosFicheros.js';
import { dibujoRama, trazadoDeSello, trazadoElipse, trazadoMancha, trazadoPoligono } from './formas.js';
import type { MotorTexto } from './MotorTexto.js';
import { aplicarMascaraDeSujeto, alfaDelSujeto, conOpacidad, documentoSvg, enLienzo, escaparXml, estiloDeTexto, mascaraAlTamano, redondear, trazoDeTexto, type CapaTextoResuelta } from './raster.js';
import { ResolutorDiseno } from './resolutor.js';
import { aplicarTinta, papel } from './tinta.js';
import { interpretarReceta } from './interpreteRecetas.js';
import type { CatalogoTipografico } from './tipografias.js';
import { radioDeCampo, tablaDuotono, tramar, tramarLuminancia } from './tramado.js';
import { trazarGesto } from './trazoAMano.js';

const FUSION_SHARP: Record<Fusion, Blend> = {
  normal: 'over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft-light': 'soft-light',
  darken: 'darken',
  lighten: 'lighten',
};

type CapaSello = Extract<CapaResuelta, { tipo: 'sello' }>;
type CapaPatron = Extract<CapaResuelta, { tipo: 'patron' }>;
type CapaForma = Extract<CapaResuelta, { tipo: 'forma' }>;

export class CompositorSharp implements Compositor {
  private readonly resolutor: ResolutorDiseno;
  /** PNG de cada capa ya pintada, por el contenido que la define. */
  private readonly cache = new Map<string, Buffer>();

  constructor(
    private readonly motor: MotorTexto,
    private readonly catalogo: CatalogoTipografico,
    /** Los estilos de tipografía especial; por defecto, los de recursos/tratamientos/. */
    biblioteca: BibliotecaDeTratamientos = new BibliotecaTratamientosFicheros(join(RAIZ, 'recursos', 'tratamientos')),
  ) {
    this.resolutor = new ResolutorDiseno(motor, biblioteca);
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
        const foto = await (await retocar(sharp(disponible.ruta).rotate().removeAlpha().extract(redondear(capa.origen, ancho, alto)).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }), capa.retoque))
          .ensureAlpha()
          .png()
          .toBuffer();
        return conOpacidad(await enLienzo(foto, capa.destino.x, capa.destino.y, lienzo), capa.opacidad);
      }

      case 'recorte': {
        // Un recorte invisible solo presta su silueta a otras capas (el sujeto de una foto a sangre): no hay nada que pintar.
        if (capa.opacidad <= 0) return vectorial(lienzo, '');
        const disponible = activos[capa.activo]!;
        let recorte = await recortar(disponible, capa.origen, capa.destino.w, capa.destino.h, capa.bordeSuave, capa.contraerBorde, capa.retoque);
        let x = capa.destino.x;
        let y = capa.destino.y;
        if (capa.filo) {
          recorte = await conFilo(recorte, capa.filo.color, capa.filo.grosor);
          x -= capa.filo.grosor;
          y -= capa.filo.grosor;
        }
        if (capa.giro) {
          // El sujeto gira alrededor de su centro: el lienzo del recorte crece para que no se corte ninguna esquina.
          const girado = await sharp(recorte).rotate(capa.giro, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
          x = capa.destino.x + capa.destino.w / 2 - girado.info.width / 2;
          y = capa.destino.y + capa.destino.h / 2 - girado.info.height / 2;
          recorte = girado.data;
        }
        return conOpacidad(await enLienzo(recorte, x, y, lienzo), capa.opacidad);
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
        let w = Math.max(1, Math.round(capa.rect.w));
        let h = Math.max(1, Math.round(capa.rect.h));
        let silueta = await alfaRecortado(disponible, capa.origen, w, h);
        let x = capa.rect.x;
        let y = capa.rect.y;
        if (capa.giro) {
          // La sombra gira con el sujeto.
          const girada = await sharp(await silueta.png().toBuffer()).rotate(capa.giro, { background: '#000000' }).extractChannel(0).png().toBuffer({ resolveWithObject: true });
          x = capa.rect.x + capa.rect.w / 2 - girada.info.width / 2;
          y = capa.rect.y + capa.rect.h / 2 - girada.info.height / 2;
          w = girada.info.width;
          h = girada.info.height;
          silueta = sharp(girada.data);
        }
        // Primero se agranda el lienzo de la máscara y después se difumina (en pasos separados: sharp tiene un orden fijo).
        const ampliada = await silueta.extend({ top: margen, bottom: margen, left: margen, right: margen, background: '#000000' }).png().toBuffer();
        const alfa = await sharp(ampliada).blur(sigma).linear(capa.opacidad, 0).toBuffer();
        const sombra = await sharp({ create: { width: w + 2 * margen, height: h + 2 * margen, channels: 3, background: capa.color } }).joinChannel(alfa).png().toBuffer();
        return enLienzo(sombra, x - margen, y - margen, lienzo);
      }

      case 'texto': {
        const { cuerpo, definiciones } = this.svgDeTexto(capa, `opacity="${capa.opacidad}"`);
        return this.acabar(await vectorial(lienzo, cuerpo, definiciones), capa, lienzo, activos);
      }

      case 'forma':
        return this.acabar(await vectorial(lienzo, `<g opacity="${capa.opacidad}">${figura(capa)}</g>`), capa, lienzo, activos);

      case 'circulo-texto': {
        const altura = this.motor.alturaMayusculas(capa.estilo, capa.tamano);
        const disco = capa.fondo ? `<circle cx="${capa.centro.x}" cy="${capa.centro.y}" r="${capa.radio + altura + capa.tamano * 0.55}" fill="${capa.fondo}"/>` : '';
        const letras = this.motor.trazarCircular(capa.estilo, capa.texto, capa.tamano, capa.centro.x, capa.centro.y, capa.radio, capa.giro, capa.arco);
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
        return capa.recurso === 'papel' ? papel(lienzo, capa.intensidad, capa.escala, capa.semilla) : grano(lienzo, capa.intensidad, capa.escala, capa.semilla);

      case 'sello':
        return this.conTinta(await vectorial(lienzo, this.svgDeSello(capa)), capa);

      case 'patron':
        return this.acabar(await this.pintarPatron(capa, lienzo), capa, lienzo, activos);

      case 'trazo': {
        const trazados = trazarGesto(capa);
        return vectorial(lienzo, `<g opacity="${capa.opacidad}" fill="${capa.color}">${trazados.map((d) => `<path d="${d}"/>`).join('')}</g>`);
      }
    }
  }

  private async conTinta(png: Buffer, capa: { tinta?: Parameters<typeof aplicarTinta>[1] }): Promise<Buffer> {
    return capa.tinta ? aplicarTinta(png, capa.tinta) : png;
  }

  /** Los dos acabados que comparten texto, forma y patrón: la tinta impresa y el recorte por la silueta del sujeto. */
  private async acabar(png: Buffer, capa: { tinta?: Parameters<typeof aplicarTinta>[1]; recorte?: CapaTextoResuelta['recorte'] }, lienzo: Lienzo, activos: Record<string, ActivoDisponible>): Promise<Buffer> {
    const entintada = await this.conTinta(png, capa);
    return capa.recorte ? this.recortarConSujeto(entintada, capa.recorte, lienzo, activos) : entintada;
  }

  /**
   * El SVG de un texto: sus trazos con la matriz que lo coloca y lo gira. Con «corte», la palabra va dos veces, cada
   * mitad recortada por su lado de la línea y desplazada (el recorte viaja con la mitad, así que el canto queda limpio).
   */
  private svgDeTexto(capa: CapaTextoResuelta, atributos: string): { cuerpo: string; definiciones: string } {
    const pintura = capa.contorno
      ? `fill="none" stroke="${capa.estilo.color}" stroke-width="${capa.contorno}" stroke-linejoin="round"`
      : `fill="${capa.estilo.color}"`;
    const matriz = `matrix(${capa.matriz.join(' ')})`;
    if (capa.tratamiento) {
      // Tipografía especial: cada letra por separado (ya con su forma), para que el tratamiento las trabaje una a una.
      const glifos = this.motor.glifosDeBloque(estiloDeTexto(capa), capa.lineas).flat();
      const cap = Math.max(...capa.lineas.map((l) => this.motor.alturaMayusculas(capa.estilo, l.tamano)));
      const { receta, valores, semilla } = capa.tratamiento;
      const tratado = interpretarReceta({ receta, valores, semilla, glifos, cap, color: capa.estilo.color, idCapa: capa.id });
      return { cuerpo: `<g transform="${matriz}" ${atributos}>${tratado.cuerpo}</g>`, definiciones: tratado.definiciones };
    }
    const d = trazoDeTexto(this.motor, capa);
    if (!capa.corte) return { cuerpo: `<path d="${d}" transform="${matriz}" ${pintura} ${atributos}/>`, definiciones: '' };

    const { punto: p, angulo, desplazamiento, separacion } = capa.corte;
    const a = (angulo * Math.PI) / 180;
    // u va a lo largo del corte tal como se ve (el eje y de la pantalla baja); n es su perpendicular.
    const u = { x: Math.cos(a), y: -Math.sin(a) };
    const n = { x: Math.sin(a), y: Math.cos(a) };
    const L = 8000;
    const lado = (signo: number) =>
      [
        [p.x - L * u.x, p.y - L * u.y],
        [p.x + L * u.x, p.y + L * u.y],
        [p.x + L * u.x + signo * L * n.x, p.y + L * u.y + signo * L * n.y],
        [p.x - L * u.x + signo * L * n.x, p.y - L * u.y + signo * L * n.y],
      ]
        .map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`)
        .join(' ');
    const mover = (signo: number) => `translate(${((signo * (desplazamiento * u.x + separacion * n.x)) / 2).toFixed(2)} ${((signo * (desplazamiento * u.y + separacion * n.y)) / 2).toFixed(2)})`;
    const id = `corte-${capa.id}`;
    return {
      definiciones: `<clipPath id="${id}-a"><polygon points="${lado(-1)}"/></clipPath><clipPath id="${id}-b"><polygon points="${lado(1)}"/></clipPath>`,
      cuerpo: `<g transform="${matriz}" ${pintura} ${atributos}><g transform="${mover(-1)}"><g clip-path="url(#${id}-a)"><path d="${d}"/></g></g><g transform="${mover(1)}"><g clip-path="url(#${id}-b)"><path d="${d}"/></g></g></g>`,
    };
  }

  /** Deja el texto solo donde está el sujeto («dentro») o solo donde no está («fuera»). */
  private async recortarConSujeto(png: Buffer, recorte: NonNullable<CapaTextoResuelta['recorte']>, lienzo: Lienzo, activos: Record<string, ActivoDisponible>): Promise<Buffer> {
    const disponible = activos[recorte.activo]!;
    if (!disponible.rutaMascara) throw new RangeError(`El activo «${disponible.activo.id}» no tiene máscara: no se puede recortar un texto con él.`);
    const sujeto = await alfaDelSujeto(disponible.rutaMascara, recorte.origen, recorte.destino, lienzo, 1, disponible.activo.ancho, disponible.activo.alto, recorte.giro);
    return aplicarMascaraDeSujeto(png, sujeto, recorte.modo);
  }

  /** El sello entero: sombra dura, forma, filete, anillo de texto y líneas del centro, todo girado como una pieza. */
  private svgDeSello(capa: CapaSello): string {
    const { centro: c } = capa;
    const giro = `rotate(${capa.giro} ${c.x} ${c.y})`;
    const contorno = trazadoDeSello(capa.forma, c.x, c.y, capa.radioX, capa.radioY, capa.puntas, capa.profundidad);
    const partes: string[] = [];
    // La sombra se desplaza en el lienzo (la luz no gira con la pegatina), pero tiene su misma forma girada.
    if (capa.sombra) partes.push(`<g transform="translate(${capa.sombra.dx} ${capa.sombra.dy})"><path d="${contorno}" transform="${giro}" fill="${capa.sombra.color}"/></g>`);
    const dentro: string[] = [`<path d="${contorno}" fill="${capa.fondo}" stroke="${capa.fondo}" stroke-width="2" stroke-linejoin="round"/>`];
    if (capa.filete > 0) {
      const conPuntas = capa.forma === 'estrella' || capa.forma === 'festoneado';
      const filete = conPuntas
        ? trazadoElipse(c.x, c.y, capa.radioX * (1 - capa.profundidad) - capa.filete * 1.6, capa.radioX * (1 - capa.profundidad) - capa.filete * 1.6)
        : trazadoDeSello(capa.forma, c.x, c.y, capa.radioX - capa.filete * 2.2, capa.radioY - capa.filete * 2.2, capa.puntas, capa.profundidad);
      dentro.push(`<path d="${filete}" fill="none" stroke="${capa.color}" stroke-width="${capa.filete}"/>`);
    }
    if (capa.anillo) {
      dentro.push(`<path d="${this.motor.trazarCircular(capa.anillo.estilo, capa.anillo.texto, capa.anillo.tamano, c.x, c.y, capa.anillo.radio, 0)}" fill="${capa.color}"/>`);
    }
    for (const linea of capa.lineas) {
      const medida = this.motor.medir(linea.estilo, linea.texto, linea.tamano);
      const x = c.x - (medida.minX + medida.maxX) / 2;
      dentro.push(`<path d="${this.motor.trazar(linea.estilo, linea.texto, linea.tamano, x, c.y + linea.base)}" fill="${capa.color}"/>`);
    }
    partes.push(`<g transform="${giro}">${dentro.join('')}</g>`);
    return `<g opacity="${capa.opacidad}">${partes.join('')}</g>`;
  }

  private async pintarPatron(capa: CapaPatron, lienzo: Lienzo): Promise<Buffer> {
    const r = capa.rect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const giro = capa.giro ? ` transform="rotate(${capa.giro} ${cx} ${cy})"` : '';
    const marco = `<clipPath id="marco"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/></clipPath>`;

    if (capa.motivo === 'puntos') {
      // Campo de semitonos: se pinta en raster, punto a punto, y solo dentro de la caja (girada, si lo está).
      const campo = radioDeCampo(r, capa.paso!, capa.radios!, capa.desvanece!);
      const a = (-(capa.giro ?? 0) * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const cobertura = tramar(lienzo.ancho, lienzo.alto, { forma: 'punto', paso: capa.paso!, angulo: capa.angulo! + capa.giro }, (x, y) => {
        // Al sistema de la caja sin girar, para saber si el punto cae dentro.
        const lx = cx + (x - cx) * cos - (y - cy) * sin;
        const ly = cy + (x - cx) * sin + (y - cy) * cos;
        return lx < r.x || lx > r.x + r.w || ly < r.y || ly > r.y + r.h ? 0 : campo(lx, ly);
      });
      const [cr, cg, cb] = hexARgb(capa.color);
      const datos = Buffer.alloc(lienzo.ancho * lienzo.alto * 4);
      for (let i = 0; i < cobertura.length; i++) {
        if (cobertura[i] === 0) continue;
        datos[i * 4] = cr;
        datos[i * 4 + 1] = cg;
        datos[i * 4 + 2] = cb;
        datos[i * 4 + 3] = Math.round(cobertura[i]! * capa.opacidad);
      }
      return sharp(datos, { raw: { width: lienzo.ancho, height: lienzo.alto, channels: 4 } }).png().toBuffer();
    }

    if (capa.motivo === 'cuadros') {
      // Solo cuadros enteros: la tira se ajusta a un número exacto de ellos, centrada en su caja.
      const p = capa.paso!;
      const w = Math.max(p, Math.floor(r.w / p) * p);
      const h = Math.max(p, Math.floor(r.h / p) * p);
      const x = Math.round(r.x + (r.w - w) / 2);
      const y = Math.round(r.y + (r.h - h) / 2);
      // Cada cuadro se dibuja a mano, en píxeles enteros: un <pattern> de SVG deja una costura fina entre baldosas.
      let d = '';
      for (let j = 0; j < h / p; j++) for (let i = j % 2; i < w / p; i += 2) d += `M${x + i * p} ${y + j * p}h${p}v${p}h${-p}z`;
      return vectorial(lienzo, `<g opacity="${capa.opacidad}"${giro}><path d="${d}" fill="${capa.color}"${capa.giro ? '' : ' shape-rendering="crispEdges"'}/></g>`);
    }

    if (capa.motivo === 'olas') {
      // Seigaiha: escamas de radio R cada 2R, filas cada R/2 y las impares a media escama. Cada escama tapa con su relleno
      // lo de las filas anteriores; se pinta en blanco sobre negro y eso hace de alfa del color (así tapa sin saber el fondo).
      const R = capa.paso! / 2;
      const linea = Math.max(1.5, R * 0.07).toFixed(2);
      let escamas = '';
      for (let j = 0, y = r.y - R; y <= r.y + r.h + R; j++, y += R / 2) {
        for (let x = r.x - R + (j % 2 ? R : 0); x <= r.x + r.w + R; x += 2 * R) {
          escamas += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${R}" fill="#000"/>${[0.92, 0.66, 0.4].map((f) => `<circle r="${(R * f).toFixed(1)}" fill="none" stroke="#fff" stroke-width="${linea}"/>`).join('')}</g>`;
        }
      }
      const mascara = await sharp(Buffer.from(documentoSvg(lienzo, `<rect width="${lienzo.ancho}" height="${lienzo.alto}" fill="#000"/><g clip-path="url(#marco)"><g${giro}>${escamas}</g></g>`, 1, marco)))
        .extractChannel(0)
        .linear(capa.opacidad, 0)
        .raw()
        .toBuffer();
      return sharp({ create: { width: lienzo.ancho, height: lienzo.alto, channels: 3, background: capa.color } })
        .joinChannel(mascara, { raw: { width: lienzo.ancho, height: lienzo.alto, channels: 1 } })
        .png()
        .toBuffer();
    }

    if (capa.motivo === 'rayas') {
      const p = capa.paso!;
      const trama = `<pattern id="p" width="${p}" height="${p}" patternUnits="userSpaceOnUse" patternTransform="rotate(${capa.angulo} ${cx} ${cy})"><rect width="${p}" height="${(p * capa.radios![0]).toFixed(2)}" fill="${capa.color}"/></pattern>`;
      return vectorial(lienzo, `<g opacity="${capa.opacidad}"${giro}><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#p)"/></g>`, trama);
    }

    // Palabra repetida: una fila se traza una vez y se reutiliza. La caja gira con sus filas, que así nunca quedan
    // cortadas por arriba ni por abajo; para un patrón girado que llene el lienzo, la caja se da más grande que él.
    const estilo = capa.estilo!;
    const palabra = capa.texto!;
    const tamano = capa.tamano!;
    const avanceFila = capa.avanceFila!;
    const mayuscula = this.motor.alturaMayusculas(estilo, tamano);
    const avance = this.motor.avance(estilo, palabra, tamano) + capa.separacion! * this.motor.avance(estilo, ' ', tamano);
    const repeticiones = Math.ceil(r.w / avance) + 2;
    let fila = '';
    for (let k = 0; k < repeticiones; k++) fila += this.motor.trazar(estilo, palabra, tamano, k * avance, 0);
    const usos: string[] = [];
    for (let i = 0; i < capa.filas!; i++) {
      // La mayúscula va centrada en su fila; cada fila arranca desplazada lo que diga «desfase».
      const base = r.y + i * avanceFila + (avanceFila + mayuscula) / 2;
      const x = r.x - ((i * capa.desfase! * avance) % avance);
      const contorno = capa.contornoAlterno && i % 2 === 1;
      usos.push(`<use href="#fila" x="${x.toFixed(2)}" y="${base.toFixed(2)}" ${contorno ? `fill="none" stroke="${capa.color}" stroke-width="${capa.contornoAlterno}"` : `fill="${capa.color}"`}/>`);
    }
    return vectorial(lienzo, `<g opacity="${capa.opacidad}"${giro}><g clip-path="url(#marco)">${usos.join('')}</g></g>`, `${marco}<path id="fila" d="${fila}"/>`);
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
      // Cada píxel se cuenta en su línea: una línea sobre un fondo bueno no debe tapar a otra sobre uno malo
      // (pulpo-2, 18/11: «A LA BRASA» negro sobre el degradado oscuro, con el bloque entero en 3,8).
      const linea = lineaDePixel(capa, this.motor, resuelto.lienzo.ancho / w);
      const porLinea = capa.lineas.map(() => [] as number[]);
      for (let p = 0; p < w * h; p++) {
        if (texto[p]! < 200 || (encima && encima[p]! > 60)) continue;
        const lb = luminancia(debajo[p * 3]!, debajo[p * 3 + 1]!, debajo[p * 3 + 2]!);
        porLinea[linea(p % w, Math.floor(p / w))]!.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05));
      }
      // La medida es la de la peor línea (el peor 10 % de sus píxeles). Las líneas con muy poca tinta visible
      // (casi tapadas por el sujeto) no cuentan: diez píxeles no son una línea que se lea.
      const peores = porLinea
        .filter((ratios) => ratios.length >= 40)
        .map((ratios) => ratios.sort((a, b) => a - b)[Math.floor(ratios.length * 0.1)]!);
      if (peores.length === 0) continue;
      resultado[capa.id] = Math.round(Math.min(...peores) * 100) / 100;
    }
    return resultado;
  }

  // ------------------------------------------------------------------ SVG por capas

  /**
   * SVG con una entrada por capa, en orden. Las capas de imagen van incrustadas (PNG en base64), para que
   * el archivo se abra solo en Figma o Illustrator; también están sueltas en capas/.
   * Editable: el texto va como <text> (se cambia si están instaladas las fuentes de recursos/tipografias).
   * Exacto: el texto va como trazos (igual que el PNG, sin depender de las fuentes).
   * Un texto con tinta impresa o recortado por el sujeto va, en el exacto, como imagen (es lo que se ve); en el
   * editable sigue siendo texto limpio, que es lo que se puede retocar.
   * Con forma (edición fina de la letra), el exacto lleva los trazos ya transformados. El editable aplica a cada línea
   * la escala, la inclinación y su espaciado con un transform del <text>, pero NO los ajustes por letra (kerning, subir,
   * escalar o girar una letra): un <text> no los puede guardar sin partirse en letras sueltas, que ya no se editan como
   * texto. Para ver la pieza exacta está el exacto (o el PNG).
   */
  private svg(resuelto: Resuelto, capas: CapaRenderizada[], modo: 'editable' | 'exacto'): string {
    const { ancho, alto } = resuelto.lienzo;
    const partes = resuelto.capas.map((capa, i) => {
      const fusion = capa.fusion === 'normal' ? '' : ` style="mix-blend-mode:${capa.fusion}"`;
      const rasterizado = capa.tipo === 'texto' && modo === 'exacto' && (capa.tinta || capa.recorte || capa.tratamiento);
      if (capa.tipo !== 'texto' || rasterizado) {
        const datos = capas[i]!.png.toString('base64');
        return `  <image id="${capa.id}" data-archivo="capas/${nombreDeCapa(capa)}" href="data:image/png;base64,${datos}" x="0" y="0" width="${ancho}" height="${alto}"${fusion}/>`;
      }
      const matriz = `matrix(${capa.matriz.join(' ')})`;
      if (modo === 'exacto') {
        const { cuerpo, definiciones } = this.svgDeTexto(capa, `opacity="${capa.opacidad}"${fusion}`);
        const marcado = cuerpo.replace(/^<(path|g) /, `<$1 id="${capa.id}" `);
        return `  ${definiciones ? `<defs>${definiciones}</defs>` : ''}${marcado}`;
      }
      const familia = this.catalogo.familia(capa.estilo.fuente);
      const peso = capa.estilo.ejes.wght ?? 400;
      const anchura = capa.estilo.ejes.wdth ?? 100;
      const pintura = capa.contorno ? `fill="none" stroke="${capa.estilo.color}" stroke-width="${capa.contorno}"` : `fill="${capa.estilo.color}"`;
      const forma = capa.estilo.forma;
      const lineas = capa.lineas
        .map((l, i) => {
          if (!forma) return `<text x="${l.x}" y="${l.base}" font-size="${l.tamano}" letter-spacing="${capa.estilo.tracking * l.tamano}">${escaparXml(l.texto)}</text>`;
          // El espaciado se da antes de escalar: se divide por la escala para que, ya escalado, mida lo mismo que en el PNG.
          const tracking = forma.trackingPorLinea?.[i] ?? capa.estilo.tracking;
          const transformacion = `translate(${l.x} ${l.base}) skewX(${-forma.inclinacion}) scale(${forma.escalaX} ${forma.escalaY})`;
          return `<text transform="${transformacion}" font-size="${l.tamano}" letter-spacing="${redondear4((tracking * l.tamano) / forma.escalaX)}">${escaparXml(l.texto)}</text>`;
        })
        .join('');
      return `  <g id="${capa.id}" transform="${matriz}" font-family="${familia}" font-weight="${Math.round(peso)}" style="font-variation-settings:'wdth' ${anchura}, 'wght' ${peso}${capa.fusion === 'normal' ? '' : `; mix-blend-mode:${capa.fusion}`}" ${pintura} opacity="${capa.opacidad}">${lineas}</g>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">\n${partes.join('\n')}\n</svg>\n`;
  }
}

// ------------------------------------------------------------------ Ayudantes

const redondear4 = (n: number) => Math.round(n * 10000) / 10000;

/** Lo que define el contenido de una capa: si no cambia, la capa no se vuelve a pintar. */
function claveDe(capa: CapaResuelta, lienzo: Lienzo, activos: Record<string, ActivoDisponible>): string {
  const { z: _z, ...contenido } = capa;
  const activo = 'activo' in capa ? activos[capa.activo]?.activo.sha256 : undefined;
  // Una capa recortada por el sujeto depende también de la foto de ese sujeto.
  const sujeto = 'recorte' in capa && capa.recorte ? activos[capa.recorte.activo]?.activo.sha256 : undefined;
  return createHash('sha256').update(JSON.stringify({ contenido, lienzo, activo, ...(sujeto ? { sujeto } : {}) })).digest('hex');
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

/** La figura de una capa de forma, con su giro alrededor de su centro. */
function figura(capa: CapaForma): string {
  const trazo = capa.grosor
    ? `fill="none" stroke="${capa.color}" stroke-width="${capa.grosor}"${capa.discontinua ? ` stroke-dasharray="${capa.discontinua.join(' ')}"` : ''}`
    : `fill="${capa.color}"`;
  let dibujo = '';
  let centro: { x: number; y: number } | undefined;
  const centroDe = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  if (capa.figura === 'linea' && capa.desde && capa.hasta) {
    dibujo = `<line x1="${capa.desde.x}" y1="${capa.desde.y}" x2="${capa.hasta.x}" y2="${capa.hasta.y}" ${trazo}/>`;
    centro = { x: (capa.desde.x + capa.hasta.x) / 2, y: (capa.desde.y + capa.hasta.y) / 2 };
  } else if (capa.figura === 'rect' && capa.rect) {
    dibujo = `<rect x="${capa.rect.x}" y="${capa.rect.y}" width="${capa.rect.w}" height="${capa.rect.h}"${capa.radio ? ` rx="${capa.radio}"` : ''} ${trazo}/>`;
    centro = centroDe(capa.rect);
  } else if (capa.figura === 'elipse' && capa.rect) {
    dibujo = `<ellipse cx="${capa.rect.x + capa.rect.w / 2}" cy="${capa.rect.y + capa.rect.h / 2}" rx="${capa.rect.w / 2}" ry="${capa.rect.h / 2}" ${trazo}/>`;
    centro = centroDe(capa.rect);
  } else if (capa.figura === 'mancha' && capa.rect) {
    dibujo = `<path d="${trazadoMancha(capa.rect, capa.lobulos ?? 5, capa.irregularidad ?? 0.35, capa.semilla ?? 7)}" ${trazo}/>`;
    centro = centroDe(capa.rect);
  } else if (capa.figura === 'rama' && capa.rect) {
    dibujo = dibujoRama(capa.rect, capa.color, capa.semilla ?? 7);
    centro = centroDe(capa.rect);
  } else if (capa.figura === 'poligono' && capa.puntos) {
    dibujo = `<path d="${trazadoPoligono(capa.puntos)}" ${trazo}/>`;
    const xs = capa.puntos.map((p) => p.x);
    const ys = capa.puntos.map((p) => p.y);
    centro = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return capa.giro && centro ? `<g transform="rotate(${capa.giro} ${centro.x} ${centro.y})">${dibujo}</g>` : dibujo;
}

/**
 * Ajustes fotográficos suaves: brillo y saturación (modulate), contraste (linear) y calidez (recomb).
 * El punto negro va en una segunda pasada: tiene que aplicarse sobre la foto ya recortada a 0–255
 * (si se combina con el contraste en un solo linear, el contraste lleva el negro por debajo de 0 y el punto negro no llega).
 * Después, si se piden, el desenfoque y la reproducción a tinta: duotono (dos tintas) o trama de semitonos (una).
 * La trama sin color de papel devuelve una imagen con transparencia: el papel es lo que haya debajo.
 */
async function retocar(imagen: Sharp, retoque?: Retoque): Promise<Sharp> {
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
  if (retoque.puntoNegro) {
    // 0 → el color pedido (p. ej. el carbón de la marca) y 255 → 255, canal a canal.
    const negro = [1, 3, 5].map((i) => parseInt(retoque.puntoNegro!.slice(i, i + 2), 16));
    const intermedia = await resultado.png().toBuffer();
    resultado = sharp(intermedia).linear(
      negro.map((c) => (255 - c) / 255),
      negro,
    );
  }
  if (retoque.desenfoque) resultado = sharp(await resultado.png().toBuffer()).blur(Math.max(0.3, retoque.desenfoque / 2));
  if (!retoque.tramado && !retoque.duotono) return resultado;

  // Reproducción a tinta: se parte de la foto en grises.
  const { data: grises, info } = await sharp(await resultado.png().toBuffer()).greyscale().removeAlpha().extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  if (retoque.tramado) {
    const t = retoque.tramado;
    const cobertura = tramarLuminancia(new Uint8Array(grises), w, h, w, h, { forma: t.forma, paso: t.paso, angulo: t.angulo });
    const tinta = hexARgb(t.tinta);
    const fondo = t.papel ? hexARgb(t.papel) : undefined;
    const datos = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const c = cobertura[i]! / 255;
      for (let k = 0; k < 3; k++) datos[i * 4 + k] = fondo ? Math.round(fondo[k]! + (tinta[k]! - fondo[k]!) * c) : tinta[k]!;
      datos[i * 4 + 3] = fondo ? 255 : cobertura[i]!;
    }
    return sharp(datos, { raw: { width: w, height: h, channels: 4 } });
  }
  const tabla = tablaDuotono(hexARgb(retoque.duotono!.sombras), hexARgb(retoque.duotono!.luces));
  const datos = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const v = grises[i]! * 3;
    datos[i * 3] = tabla[v]!;
    datos[i * 3 + 1] = tabla[v + 1]!;
    datos[i * 3 + 2] = tabla[v + 2]!;
  }
  return sharp(datos, { raw: { width: w, height: h, channels: 3 } });
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
  const retocada = await retocar(sharp(disponible.ruta).rotate().removeAlpha().extract(redondear(origen, ancho, alto)).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }), retoque);
  let alfa = await (await alfaRecortado(disponible, origen, w, h)).png().toBuffer();
  if (contraerBorde > 0) {
    // Encoger: se difumina y se vuelve a cortar por arriba de la mitad; el borde entra unos px hacia dentro.
    alfa = await sharp(alfa).blur(Math.max(0.3, contraerBorde)).linear(3, -3 * 170).png().toBuffer();
  }
  if (bordeSuave > 0) alfa = await sharp(alfa).blur(Math.max(0.3, bordeSuave)).png().toBuffer();
  // Sin reproducción a tinta, el camino de siempre (el mismo resultado que antes de F3, píxel a píxel).
  if (!retoque?.tramado && !retoque?.duotono) return sharp(await retocada.toBuffer()).joinChannel(alfa).png().toBuffer();
  if (!retoque.tramado || retoque.tramado.papel) return sharp(await retocada.removeAlpha().png().toBuffer()).joinChannel(alfa).png().toBuffer();
  // Trama sin papel: la tinta solo está donde hay punto Y donde está el sujeto.
  const tramada = await retocada.ensureAlpha().raw().toBuffer();
  const mascara = await sharp(alfa).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < w * h; i++) tramada[i * 4 + 3] = Math.round((tramada[i * 4 + 3]! * mascara[i]!) / 255);
  return sharp(tramada, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
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

/**
 * Filo de pegatina (F3.3): el sujeto, con un borde de color alrededor de su silueta. La silueta se ensancha difuminando
 * el canal alfa y volviéndolo a cortar con un umbral bajo (una dilatación suave), se pinta del color y el sujeto encima.
 * El resultado crece `grosor` px por cada lado.
 */
async function conFilo(recorte: Buffer, color: string, grosor: number): Promise<Buffer> {
  const conMargen = await sharp(recorte).extend({ top: grosor, bottom: grosor, left: grosor, right: grosor, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
  const { width, height } = conMargen.info;
  // Cada paso en su propia tubería: sharp aplica las operaciones en un orden fijo, no en el de las llamadas.
  const difuminada = await sharp(conMargen.data).extractChannel(3).blur(Math.max(0.5, grosor / 2)).png().toBuffer();
  const cortada = await sharp(difuminada).threshold(6).png().toBuffer();
  const alfa = await sharp(cortada).blur(1).extractChannel(0).raw().toBuffer();
  const relleno = await sharp({ create: { width, height, channels: 3, background: color } }).joinChannel(alfa, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return sharp(relleno).composite([{ input: conMargen.data }]).png().toBuffer();
}

/**
 * A qué línea de un texto pertenece un píxel de la medida (x, y a escala 1/escala del lienzo): se lleva al sistema
 * del bloque con la matriz inversa y se elige la línea cuyo centro de mayúsculas queda más cerca.
 */
function lineaDePixel(capa: CapaTextoResuelta, motor: MotorTexto, escala: number): (x: number, y: number) => number {
  if (capa.lineas.length <= 1) return () => 0;
  const [a, b, c, d, e, f] = capa.matriz;
  const det = a * d - b * c;
  // Con forma, la altura de mayúscula ya es la de la letra estirada o encogida (escalaY).
  const centros = capa.lineas.map((l) => l.base - motor.alturaMayusculas(capa.estilo, l.tamano) / 2);
  return (x, y) => {
    const px = (x + 0.5) * escala - e;
    const py = (y + 0.5) * escala - f;
    const by = (-b * px + a * py) / det;
    let mejor = 0;
    for (let i = 1; i < centros.length; i++) if (Math.abs(by - centros[i]!) < Math.abs(by - centros[mejor]!)) mejor = i;
    return mejor;
  };
}
