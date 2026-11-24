import sharp from 'sharp';
import { ErrorDeUsuario } from '../../dominio/errores.js';

const LADO = 36;
const PIXELES = LADO * LADO;
// Proporción que queda tras un zoom centrado habitual. Los recortes a la proporción de entrega se calculan aparte.
const VENTANAS = [1, 0.95, 0.9, 0.85, 5 / 6, 0.8, 0.75, 2 / 3];

const miniatura = (entrada: Buffer | string) => sharp(entrada).autoOrient()
  .resize(384, 384, { fit: 'inside' }).flatten({ background: '#ffffff' })
  .toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
type Miniatura = Awaited<ReturnType<typeof miniatura>>;

/** Solo se decodifica la foto grande una vez. Cada hipótesis posterior opera sobre esta miniatura. */
async function cuadricula(img: Miniatura, ancho = img.info.width, alto = img.info.height) {
  return sharp(img.data, { raw: img.info })
    .extract({ left: Math.floor((img.info.width - ancho) / 2), top: Math.floor((img.info.height - alto) / 2), width: ancho, height: alto })
    .resize(LADO, LADO, { fit: 'fill' }).raw().toBuffer();
}

function firma(rgb: Buffer) {
  const media = [0, 0, 0];
  let cuadrados = 0;
  let bordes = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const valor = rgb[i + c]!;
      media[c]! += valor / PIXELES;
      cuadrados += valor * valor / rgb.length;
    }
    const contrasteCon = (j: number) => Math.abs(rgb[i]! - rgb[j]!) + Math.abs(rgb[i + 1]! - rgb[j + 1]!) + Math.abs(rgb[i + 2]! - rgb[j + 2]!);
    const bordeHorizontal = i % (LADO * 3) !== 0 && contrasteCon(i - 3) > 24;
    const bordeVertical = i >= LADO * 3 && contrasteCon(i - LADO * 3) > 24;
    if (bordeHorizontal || bordeVertical) bordes++;
  }
  const contraste = Math.sqrt(Math.max(0, cuadrados - media.reduce((s, m) => s + m * m / 3, 0)));
  return { rgb, media, contraste, detalle: contraste >= 12 && bordes >= PIXELES * 0.06 };
}

function orientar(rgb: Buffer, giros: number, espejo: boolean) {
  const salida = Buffer.alloc(rgb.length);
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      let xx = espejo ? LADO - 1 - x : x;
      let yy = y;
      for (let n = 0; n < giros; n++) [xx, yy] = [LADO - 1 - yy, xx];
      const desde = (y * LADO + x) * 3;
      rgb.copy(salida, (yy * LADO + xx) * 3, desde, desde + 3);
    }
  }
  return salida;
}

type Firma = ReturnType<typeof firma>;

/** Compensa una variación moderada y global de exposición; el detalle y su posición tienen que coincidir. */
function mismaEstructura(a: Firma, b: Firma, orientaciones: Buffer[]) {
  if (!a.detalle || !b.detalle || a.media.some((m, c) => Math.abs(m - b.media[c]!) > 26)) return false;
  const escala = a.contraste / b.contraste;
  if (escala < 0.82 || escala > 1.22) return false;
  const compensacion = a.media.map((m, c) => m - b.media[c]! * escala);
  return orientaciones.some((muestra) => {
    let suma = 0;
    let distintos = 0;
    for (let i = 0; i < muestra.length; i += 3) {
      let maximo = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(muestra[i + c]! - b.rgb[i + c]! * escala - compensacion[c]!);
        suma += d;
        maximo = Math.max(maximo, d);
      }
      if (maximo > 24) distintos++;
      // Exigimos tanto error medio bajo como acuerdo local en el 98,2 % de la superficie.
      if (suma > muestra.length * 4.5 || distintos > PIXELES * 0.018) return false;
    }
    return true;
  });
}

export async function exigirTomaNueva(imagen: Buffer | string, referencias: ReadonlyArray<Buffer | string>): Promise<void> {
  if (!referencias.length) return;
  const error = () => new ErrorDeUsuario('La imagen reproduce una referencia. Hace falta una toma nueva para la pieza.');
  const candidata = await miniatura(imagen);
  const muestra = firma(await cuadricula(candidata));
  const proporcion = candidata.info.width / candidata.info.height;
  const orientaciones = muestra.detalle ? [0, 1, 2, 3].flatMap((n) => [orientar(muestra.rgb, n, false), orientar(muestra.rgb, n, true)]) : [];
  for (const referencia of referencias) {
    const origen = await miniatura(referencia);
    const entera = firma(await cuadricula(origen));
    if (muestra.rgb.equals(entera.rgb)) throw error();
    // Un campo plano o casi uniforme no tiene estructura suficiente para identificarlo por semejanza cromática.
    if (!muestra.detalle) continue;
    if (mismaEstructura(muestra, entera, orientaciones)) throw error();
    const { width, height } = origen.info;
    const vistas = new Set([`${width}x${height}`]);
    // A la proporción de la entrega o su inversa si hubo un giro de 90°. También reconoce el zoom sin cambio de formato.
    for (const aspecto of [proporcion, 1 / proporcion, width / height]) {
      const w = Math.min(width, height * aspecto);
      const h = Math.min(height, width / aspecto);
      for (const ventana of VENTANAS) {
        const ancho = Math.max(1, Math.round(w * ventana));
        const alto = Math.max(1, Math.round(h * ventana));
        const clave = `${ancho}x${alto}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        if (mismaEstructura(muestra, firma(await cuadricula(origen, ancho, alto)), orientaciones)) throw error();
      }
    }
  }
}
