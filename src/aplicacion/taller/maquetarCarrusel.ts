import { join } from 'node:path';
import sharp from 'sharp';
import { CatalogoTipografico } from '../../adaptadores/compositor/tipografias.js';
import { MotorTexto, type EstiloMotor } from '../../adaptadores/compositor/MotorTexto.js';
import { contraste, mezclar, rgbAHex } from '../../dominio/diseno/color.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { FotoDePagina, GuionEditorial, PaginaEditorial, SecuenciaTaller } from '../../dominio/secuenciaTaller.js';
import type { PaginaDeSerie, SerieDelTaller } from '../../dominio/serieTaller.js';
import { huella } from './direccion.js';
import { guardarSerie, type BaseDeSerie } from './serie.js';

type Pieza = SerieDelTaller['paginas'][number];
type Caja = { x: number; y: number; w: number; h: number };
type Foto = { sha256: string; bytes: Buffer };
type Imagen = { bytes: Buffer; ancho: number; alto: number };
type Enfoque = NonNullable<PaginaEditorial['encuadres']>[number];
const W = 1080, H = 1350;
const lienzo = { x: 0, y: 0, w: W, h: H };
const paper = '#F6F4E9';
const paletas = {
  HERBAL: { fondo: '#DCED98', tinta: '#243729' },
  MINERAL: { fondo: '#DCE5ED', tinta: '#253247' },
  FRUTA: { fondo: '#F1D5CB', tinta: '#48283A' },
};
const estilo = (fuente: string, ejes: Record<string, number> = {}): EstiloMotor => ({ fuente, ejes, caso: 'tal-cual', tracking: -.015, interlineado: 1.02 });
const voz = estilo('bodoni-moda', { wght: 760, opsz: 60 });
const cursiva = estilo('instrument-serif-italica');
const pie = estilo('archivo', { wght: 650, wdth: 100 });
const svg = (contenido: string) => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">' + contenido + '</svg>');
const rect = (c: Caja, color = '#fff', radio = 0) => `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${radio}" fill="${color}"/>`;
const filete = (d: string, tinta: string) => `<path d="${d}" fill="none" stroke="${tinta}" stroke-width="2.5"/>`;
const trazo = (d: string, tinta: string) => `<path d="${d}" fill="${tinta}"/>`;

function fotoEn(foto: Imagen, c: Caja, id: string, forma = rect(c), enfoque: Enfoque = { x: .5, y: .5, zoom: 1 }) {
  const escala = Math.max(c.w / foto.ancho, c.h / foto.alto) * enfoque.zoom;
  const w = foto.ancho * escala, h = foto.alto * escala;
  const x = c.x - Math.max(0, Math.min(w - c.w, enfoque.x * w - c.w / 2));
  const y = c.y - Math.max(0, Math.min(h - c.h, enfoque.y * h - c.h / 2));
  return `<defs><clipPath id="${id}">${forma}</clipPath></defs><image x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#${id})" xlink:href="data:image/jpeg;base64,${foto.bytes.toString('base64')}"/>`;
}

async function tintaSobreFoto(foto: Buffer, zona: Caja, oscura: string) {
  const { data, info } = await sharp(foto).extract({ left: zona.x, top: zona.y, width: zona.w, height: zona.h })
    .resize(30, 25, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const colores = Array.from({ length: info.width * info.height }, (_, i) => rgbAHex([data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!]));
  const opciones = [oscura, paper, mezclar(oscura, '#101010', .65)].map(tinta => {
    const valores = colores.map(c => contraste(tinta, c)).sort((a, b) => a - b);
    return { tinta, minimo: valores[Math.floor(valores.length * .05)]! };
  });
  return opciones.find(opcion => opcion.minimo >= 4.5) ?? opciones[0]!;
}

async function dibujar(
  p: PaginaEditorial, e: PaginaDeSerie, fotos: Imagen[], paleta: (typeof paletas)[keyof typeof paletas], motor: MotorTexto,
) {
  let tratamiento: Pieza['tratamiento'] = p.tratamiento === 'ARCO' ? 'MARCO_ARQUEADO' : p.tratamiento === 'TEXTO_EN_AIRE' ? 'TITULO_EN_AIRE' : p.tratamiento;
  const medidas: Pieza['medidas'] = [];
  const { tinta, fondo } = paleta;
  let detalle = '';
  const texto = (id: string, literal: string, estilo: EstiloMotor, caja: Caja, color: string, ratio: number, alinear: 'izquierda' | 'centro' = 'izquierda') => {
    if (!literal) return '';
    const peticion = { texto: literal, estilo, caja, alinear, vertical: 'centro' as const };
    const ajuste = motor.componer({ ...peticion, ajuste: 'caja' });
    const bloque = ajuste.visual.h <= caja.h ? ajuste : motor.componer({ ...peticion, ajuste: 'fijo',
      tamano: ajuste.tamano * caja.h / ajuste.visual.h });
    const cuerpoMovil = Math.floor(bloque.tamano / 3 * 10) / 10;
    if (cuerpoMovil < 12 || ratio < 4.5) throw new ErrorDeUsuario('La lámina pierde lectura a 360 px. Acorta el texto de ' + id + '.');
    medidas.push({ capa: id, cuerpoMovil, contraste: Math.floor(ratio * 100) / 100, lineas: bloque.lineas.map(l => l.texto) });
    const dy = caja.y + (caja.h - bloque.visual.h) / 2 - bloque.visual.y;
    return trazo(bloque.lineas.map(l => motor.trazar(estilo, l.texto, l.tamano, l.x, l.base + dy)).join(''), color);
  };
  const titulo = e.titulo, apoyo = e.apoyo, nota = e.nota ?? '';
  const foto = (i: number, caja: Caja, id: string, forma?: string) => fotoEn(fotos[i]!, caja, id, forma, p.encuadres?.[i]);
  let lienzoSvg: string;
  switch (p.tratamiento) {
    case 'FOTO':
      lienzoSvg = foto(0, lienzo, 'foto');
      break;
    case 'ARCO': {
      const marco = { x: 108, y: 407, w: 864, h: 826 };
      const arco = 'M108 1233 V839 A432 432 0 0 1 972 839 V1233 Z';
      const ratio = contraste(tinta, fondo);
      const radio = 430;
      const arcoTexto = Math.min(55, Math.max(24, apoyo.length * 5.15));
      const tamano = Math.min(47, (arcoTexto * Math.PI / 180 * radio) * .82 / Math.max(1, motor.avance(pie, apoyo, 1)));
      const sobrelinea = apoyo && tamano >= 36
        ? trazo(motor.trazarCircular(pie, apoyo, tamano, 540, 561, radio, -arcoTexto / 2, arcoTexto), tinta)
        : texto('apoyo', apoyo, pie, { x: 136, y: 84, w: 808, h: 63 }, tinta, ratio, 'centro');
      if (apoyo && tamano >= 36) medidas.push({ capa: 'apoyo', cuerpoMovil: tamano / 3, contraste: ratio, lineas: [apoyo] });
      lienzoSvg = rect(lienzo, fondo) + filete('M90 1251 V839 A450 450 0 0 1 990 839 V1251 Z', tinta) +
        foto(0, marco, 'ventana', trazo(arco, tinta)) + sobrelinea +
        texto('titular', titulo, voz, { x: 82, y: 183, w: 916, h: 217 }, tinta, ratio, 'centro');
      break;
    }
    case 'DIPTICO': {
      const izquierda = { x: 72, y: 442, w: 530, h: 678 }, derecha = { x: 639, y: 323, w: 369, h: 550 };
      const ratio = contraste(tinta, paper);
      lienzoSvg = rect(lienzo, paper) + texto('titular', titulo, cursiva, { x: 72, y: 77, w: 936, h: 174 }, tinta, ratio) +
        filete('M72 270 H1008', tinta) + foto(0, izquierda, 'principal') +
        foto(1, derecha, 'segunda', rect(derecha, '#fff', 184)) +
        (apoyo ? filete('M72 1166 H602', tinta) + texto('primer pie', apoyo, pie, { x: 72, y: 1185, w: 530, h: 90 }, tinta, ratio) : '') +
        (nota ? filete('M639 919 H1008', tinta) + texto('segundo pie', nota, cursiva, { x: 639, y: 945, w: 369, h: 155 }, tinta, ratio) : '');
      break;
    }
    case 'TIPOGRAFIA': {
      const ratio = contraste(fondo, tinta);
      lienzoSvg = rect(lienzo, tinta) + texto('titular', titulo, voz, { x: 78, y: 251, w: 924, h: 570 }, fondo, ratio) +
        texto('apoyo', apoyo, cursiva, { x: 86, y: 890, w: 890, h: 210 }, fondo, ratio);
      break;
    }
    case 'TEXTO_EN_AIRE': {
      const esquina = p.esquina ?? 'SUPERIOR_IZQUIERDA';
      const zona = { x: esquina.endsWith('IZQUIERDA') ? 64 : 522, y: esquina.startsWith('SUPERIOR') ? 74 : 926, w: 494, h: 310 };
      const fondoFoto = foto(0, lienzo, 'foto');
      const medicion = await tintaSobreFoto(svg(fondoFoto), zona, tinta);
      const directo = medicion.minimo >= 4.5;
      if (!directo) {
        tratamiento = 'PIE_DE_FOTO';
        detalle = ' El texto se apoyó en un recuadro para conservar su contraste.';
      }
      const color = directo ? medicion.tinta : tinta;
      const ratio = directo ? medicion.minimo : contraste(tinta, paper);
      const caja = directo ? zona : { ...zona, x: zona.x + 22, y: zona.y + 18, w: zona.w - 44, h: zona.h - 36 };
      const arriba = p.ordenTexto === 'APOYO_ANTES' && apoyo;
      const cajaTitulo = { ...caja, y: arriba ? caja.y + caja.h * .36 : caja.y, h: apoyo ? caja.h * .64 : caja.h };
      const cajaApoyo = { ...caja, y: arriba ? caja.y : caja.y + caja.h * .7, h: caja.h * .3 };
      lienzoSvg = fondoFoto + (directo ? '' : rect(zona, paper)) +
        texto('titular', titulo, voz, cajaTitulo, color, ratio) +
        texto('apoyo', apoyo, cursiva, cajaApoyo, color, ratio);
      break;
    }
  }
  return { lienzoSvg, medidas, tratamiento, detalle };
}

export async function maquetarCarrusel(
  raiz: string, carpeta: string, base: BaseDeSerie, secuencia: SecuenciaTaller, guion: GuionEditorial, ediciones: PaginaDeSerie[],
  fotos: Map<FotoDePagina, Foto>,
) {
  const motor = new MotorTexto(new CatalogoTipografico(join(raiz, 'recursos/tipografias')));
  const imagenes = new Map(await Promise.all([...fotos].map(async ([id, foto]) => {
    const { data, info } = await sharp(foto.bytes).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer({ resolveWithObject: true });
    return [id, { bytes: data, ancho: info.width, alto: info.height }] as const;
  })));
  const paginas: Pieza[] = [];
  const archivos: { nombre: string; bytes: Buffer }[] = [];
  for (const [i, p] of guion.paginas.entries()) {
    const edicion = ediciones[i]!;
    if (p.tratamiento === 'FOTO' ? Boolean(edicion.titulo || edicion.apoyo || edicion.nota) : !edicion.titulo) {
      throw new ErrorDeUsuario('Revisa el texto de la lámina ' + (i + 1) + '. Las páginas de fotografía limpia se mantienen sin palabras.');
    }
    if (p.tratamiento !== 'DIPTICO' && edicion.nota) throw new ErrorDeUsuario('La nota adicional corresponde al segundo pie de un díptico.');
    const escena = await dibujar(p, edicion, p.fotos.map(id => imagenes.get(id)!), paletas[guion.acento], motor);
    const svgEditado = svg(escena.lienzoSvg);
    const png = await sharp(svgEditado).png().toBuffer();
    const json = Buffer.from(JSON.stringify({ pagina: { ...p, ...edicion }, acento: guion.acento, idea: guion.idea }, null, 2));
    paginas.push({ edicion, fotosSha256: p.fotos.map(id => fotos.get(id)!.sha256), tratamiento: escena.tratamiento,
      motivo: p.intencion + escena.detalle, medidas: escena.medidas, sha256: huella(png), intencionSha256: huella(json), svgSha256: huella(svgEditado) });
    archivos.push({ nombre: (i + 1) + '.png', bytes: png }, { nombre: (i + 1) + '.svg', bytes: svgEditado }, { nombre: (i + 1) + '.json', bytes: json });
  }
  return guardarSerie(carpeta, { esquema: 'taller/serie@1', ...base, guionSha256: secuencia.huella, paginas }, archivos);
}
