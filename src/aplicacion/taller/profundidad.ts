import sharp from 'sharp';
import type { EstiloMotor, MotorTexto } from '../../adaptadores/compositor/MotorTexto.js';
import { aplicarMascaraDeSujeto, alfaDeSvg, documentoSvg, medidorDeCobertura } from '../../adaptadores/compositor/raster.js';
import { luminancia } from '../../dominio/diseno/color.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { MaquetaDeTitulo, PlanoTitulo, Profundidad } from '../../dominio/taller.js';

const lienzo = { ancho: 1080, alto: 1350 };
const anchoMovil = 360, altoMovil = 450;
const tinta = '#fff6e7';
const luzTinta = luminancia(255, 246, 231);

export interface MascaraDePlano {
  png: Buffer;
  sha256: string;
  origen: Profundidad['origenMascara'];
  plano: PlanoTitulo;
}

/** Busca la posición contra la tinta real a 360 px. Usa el mismo medidor por franjas que el productor. */
export async function componerEnPlanos(motor: MotorTexto, base: Buffer, baseSha256: string, titulo: string, receta: MaquetaDeTitulo, mascara: MascaraDePlano) {
  const estilo: EstiloMotor = { fuente: receta.fuente, tracking: -.035, interlineado: .94, caso: 'tal-cual' as const,
    ejes: receta.estilo === 'CONDENSADA' ? { wdth: 77, wght: 820 } : {} };
  const cajaTexto = { x: 42, y: 0, w: 996, h: 270 };
  const medida = motor.componer({ texto: titulo, estilo, caja: cajaTexto, ajuste: 'caja', vertical: 'arriba', alinear: 'centro' });
  const cuerpo = Math.min(220, medida.tamano, medida.tamano * cajaTexto.h / Math.max(1, medida.visual.h));
  const bloque = motor.componer({ texto: titulo, estilo, caja: cajaTexto, ajuste: 'fijo', tamano: cuerpo, vertical: 'arriba', alinear: 'centro' });
  const visual = bloque.visual;
  if (bloque.tamano < 48 || visual.w > cajaTexto.w + 2 || visual.h > cajaTexto.h + 2) throw new ErrorDeUsuario('El título necesita más espacio. Prueba una posición en papel o un fragmento público más corto.');
  const trazos = bloque.lineas.map(l => motor.trazar(estilo, l.texto, l.tamano, l.x, l.base)).join('');
  const svg = (dy: number) => documentoSvg(lienzo, '<path transform="translate(0 ' + dy + ')" fill="' + tinta + '" d="' + trazos + '"/>');
  const [letras, silueta] = await Promise.all([
    alfaDeSvg(svg(0), anchoMovil, altoMovil),
    sharp(mascara.png).resize(anchoMovil, altoMovil).extractChannel(0).raw().toBuffer(),
  ]);
  const cobertura = medidorDeCobertura(letras, silueta, anchoMovil, altoMovil);
  const solape = mascara.plano === 'DETRAS';
  // Ambas maquetas comparten encuadre y veladura, y mantienen los píxeles del sujeto intactos.
  const alpha = await sharp(mascara.png).extractChannel(0).raw().toBuffer();
  const veladura = Buffer.alloc(alpha.length * 4);
  for (let i = 0; i < alpha.length; i++) {
    const y = Math.floor(i / lienzo.ancho) / lienzo.alto;
    veladura[4 * i + 3] = Math.round((255 - alpha[i]!) * .60 * Math.min(1, Math.max(0, (.68 - y) / .25)));
  }
  const fondo = await sharp(base).composite([{ input: veladura, raw: { width: 1080, height: 1350, channels: 4 } }]).png().toBuffer();
  const rgb = await sharp(fondo).resize(anchoMovil, altoMovil).removeAlpha().toColourspace('srgb').raw().toBuffer();
  const tintaMovil: number[] = [];
  for (let i = 0; i < letras.length; i++) if (letras[i]! >= 128) tintaMovil.push(i);
  const top = silueta.findIndex(v => v >= 160);
  if (top < 0) throw new ErrorDeUsuario('La máscara está vacía. Importa la silueta del sujeto de esta foto.');
  const borde = Math.floor(top / anchoMovil);
  const ideal = solape ? borde - (visual.y + visual.h) / 3 + 8 : Math.max(6, (borde - visual.h / 3) * .55 - visual.y / 3);
  // Se comparan posiciones dentro del tercio superior y central, empezando por el borde de contacto.
  const alturas = Array.from({ length: 160 }, (_, i) => {
    const dy = 6 + i * 2;
    const media = cobertura.media(dy);
    const coste = solape ? Math.abs(media - .08) * 1000 + Math.abs(dy - ideal) / 10 : Math.abs(dy - ideal);
    return { dy, media, coste };
  }).sort((a, b) => a.coste - b.coste);
  for (const { dy, media } of alturas) {
    if (solape ? media < .035 || media > .16 : media > 0) continue;
    const peor = cobertura.maxima(dy);
    if (peor > .36) continue;
    const ratios = [];
    for (const i of tintaMovil) {
      const j = i + dy * anchoMovil;
      if (silueta[j]! >= 128) continue;
      const k = j * 3;
      const l = luminancia(rgb[k]!, rgb[k + 1]!, rgb[k + 2]!);
      ratios.push((Math.max(l, luzTinta) + .05) / (Math.min(l, luzTinta) + .05));
    }
    ratios.sort((a, b) => a - b);
    const ratio = ratios[Math.floor(.08 * ratios.length)] ?? 0;
    if (ratio < 3) continue;
    const y = 3 * dy;
    const capa = await sharp(Buffer.from(svg(y))).png().toBuffer();
    // Quitar tinta de la capa de texto deja asomar los píxeles originales del producto.
    const visible = await aplicarMascaraDeSujeto(capa, alpha, 'fuera');
    const png = await sharp(fondo).composite([{ input: visible }]).png().toBuffer();
    const profundidad: Profundidad = { esquema: 'taller/capas@1', titulo, plano: mascara.plano, mascaraSha256: mascara.sha256, origenMascara: mascara.origen,
      oclusion: media, peorFranja: peor, cuerpo: bloque.tamano };
    return { png, composicion: { baseSha256, estilo: receta.estilo, posicionSolicitada: receta.posicion, posicion: 'CENTRADA_EN_SILUETA' as const, tinta, contraste: Math.round(ratio * 100) / 100,
      familia: receta.fuente, lineas: bloque.lineas.map(l => l.texto), caja: { x: visual.x, y: visual.y + y, ancho: visual.w, alto: visual.h }, profundidad } };
  }
  throw new ErrorDeUsuario('Esta silueta y este título no dejan una posición con suficiente lectura. Prueba el título en aire, cambia de familia o revisa la máscara sobre la foto base.');
}
