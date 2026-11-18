import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CatalogoTipografico } from '../../adaptadores/compositor/tipografias.js';
import { MotorTexto, type EstiloMotor } from '../../adaptadores/compositor/MotorTexto.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { MaquetaDeTitulo, TallerDeArte } from '../../dominio/taller.js';

type Composicion = NonNullable<TallerDeArte['candidatas'][number]['composicion']>;
type Caja = Composicion['caja'];
const motor = new MotorTexto(new CatalogoTipografico(fileURLToPath(new URL('../../../recursos/tipografias/', import.meta.url))));
const lienzo = { width: 1080, height: 1350 };
const muestra = { width: 108, height: 135 };
const papel = '#f3eddf';
const tintas = ['#241912', '#fff6e7'];
const lineal = (c: number) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
function luminancia(r: number, g: number, b: number) { return .2126 * lineal(r / 255) + .7152 * lineal(g / 255) + .0722 * lineal(b / 255); }
function luzHex(color: string) {
  const canal = (inicio: number) => parseInt(color.slice(inicio, inicio + 2), 16);
  return luminancia(canal(1), canal(3), canal(5));
}
const contraste = (a: number, b: number) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);

function medirTinta(rgb: Buffer, caja: Caja) {
  const valores: number[] = [];
  let bordes = 0;
  const inicioX = Math.max(0, Math.floor(caja.x / 10));
  const finX = Math.min(muestra.width, Math.ceil((caja.x + caja.ancho) / 10));
  const inicioY = Math.max(0, Math.floor(caja.y / 10));
  const finY = Math.min(muestra.height, Math.ceil((caja.y + caja.alto) / 10));
  for (let y = inicioY; y < finY; y++) {
    let anterior: number | undefined;
    for (let x = inicioX; x < finX; x++) {
      const i = (y * muestra.width + x) * 3;
      const valor = luminancia(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!);
      valores.push(valor);
      if (anterior !== undefined && Math.abs(valor - anterior) > .075) bordes++;
      anterior = valor;
    }
  }
  const opciones = tintas.map(tinta => {
    const luz = luzHex(tinta);
    const ratios = valores.map(valor => contraste(luz, valor)).sort((a, b) => a - b);
    return { tinta, contraste: ratios[Math.floor(ratios.length * .08)] ?? 0 };
  });
  return { ...opciones.sort((a, b) => b.contraste - a.contraste)[0]!, detalle: bordes / Math.max(valores.length, 1) };
}

function trazar(titulo: string, receta: MaquetaDeTitulo, posicion: MaquetaDeTitulo['posicion']) {
  const enPapel = posicion === 'PAPEL';
  const derecha = posicion === 'SUPERIOR_DERECHA';
  const x = derecha ? 140 : 64;
  const y = enPapel ? 1083 : posicion === 'INFERIOR_IZQUIERDA' ? 944 : 130;
  const ancho = enPapel ? 950 : derecha ? 876 : 591, alto = enPapel ? 218 : 278;
  const ejes: Record<string, number> = receta.estilo === 'CONDENSADA' ? { wdth: 77, wght: 760 } : {};
  const estilo: EstiloMotor = { fuente: receta.fuente, ejes, caso: 'tal-cual', interlineado: .91, tracking: -.028 };
  const partes = enPapel || receta.estilo !== 'CONTRASTE' ? null : /^(.{2,20}?)\s+((?:de|del|a|con|en)\s+.{2,24})$/iu.exec(titulo);
  const cajas: Caja[] = [], trazos: string[] = [], lineas: string[] = [];
  function bloque(texto: string, voz: EstiloMotor, izquierda: number, arriba: number, w: number, h: number, max: number) {
    // Encaja por medida real de los glifos y conserva interlineado cuando el título ocupa dos líneas.
    const caja = { x: izquierda, y: arriba, w, h };
    const ajuste = motor.componer({ texto, estilo: voz, caja, ajuste: 'caja', alinear: 'izquierda', vertical: 'centro' });
    const cuerpo = Math.min(max, ajuste.tamano);
    const bloque = motor.componer({ texto, estilo: voz, caja, ajuste: 'fijo', tamano: cuerpo, alinear: derecha ? 'derecha' : 'izquierda', vertical: 'arriba' });
    for (const linea of bloque.lineas) {
      lineas.push(linea.texto);
      trazos.push(motor.trazar(voz, linea.texto, linea.tamano, linea.x, linea.base));
    }
    cajas.push({ x: bloque.visual.x, y: bloque.visual.y, ancho: bloque.visual.w, alto: bloque.visual.h });
    return cuerpo;
  }
  let cuerpo: number;
  if (partes && derecha) {
    const apoyo = { ...estilo, fuente: receta.apoyo, tracking: -.015 };
    const medidaGrande = motor.medir(estilo, partes[1]!, 191);
    const medidaCursiva = motor.medir(apoyo, partes[2]!, 94);
    const escala = Math.min(1, ancho / (medidaGrande.ancho + medidaCursiva.ancho + 30));
    cuerpo = 191 * escala;
    const ultimo = motor.medir(apoyo, partes[2]!, 94 * escala);
    const primero = motor.medir(estilo, partes[1]!, cuerpo);
    const final = x + ancho;
    const base = y + primero.arriba;
    const comienzo = final - ultimo.ancho - 30 * escala - primero.ancho;
    trazos.push(motor.trazar(estilo, partes[1]!, cuerpo, comienzo - primero.minX, base));
    trazos.push(motor.trazar(apoyo, partes[2]!, 94 * escala, final - ultimo.maxX, base));
    cajas.push({ x: comienzo, y: base - Math.max(primero.arriba, ultimo.arriba), ancho: final - comienzo,
      alto: Math.max(primero.arriba, ultimo.arriba) + Math.max(primero.abajo, ultimo.abajo) });
    lineas.push(titulo);
  } else if (partes) {
    cuerpo = bloque(partes[1]!, estilo, x, y, ancho, 160, 188);
    const primera = cajas[0]!;
    const sangria = Math.min(112, primera.ancho * .22);
    bloque(partes[2]!, { ...estilo, fuente: receta.apoyo, tracking: -.014 }, x + sangria, primera.y + primera.alto + 14, ancho - 112, 90, 83);
  } else {
    cuerpo = bloque(titulo, estilo, x, y, ancho, alto, enPapel ? 138 : 164);
  }
  const izquierda = Math.floor(Math.min(...cajas.map(b => b.x)));
  const arriba = Math.floor(Math.min(...cajas.map(b => b.y)));
  const caja = { x: izquierda, y: arriba, ancho: Math.ceil(Math.max(...cajas.map(b => b.x + b.ancho)) - izquierda),
    alto: Math.ceil(Math.max(...cajas.map(b => b.y + b.alto)) - arriba) };
  return { caja, trazos: trazos.join(''), lineas, cuerpo };
}

/** La fotografía y la capa tipográfica tienen procedencias distintas. */
export async function componerTitulo(base: Buffer, baseSha256: string, titulo: string, receta: MaquetaDeTitulo) {
  const rgb = await sharp(base).resize(muestra.width, muestra.height).removeAlpha().toColourspace('srgb').raw().toBuffer();
  let posicion = receta.posicion;
  let letras = trazar(titulo, receta, posicion);
  let tinta = tintas[0]!;
  let ratio = contraste(luzHex(tinta), luzHex(papel));
  let fondo = base;
  if (posicion !== 'PAPEL') {
    const zona = medirTinta(rgb, letras.caja);
    if (zona.contraste >= 4.5 && zona.detalle <= .12 && letras.cuerpo >= 48) {
      tinta = zona.tinta;
      ratio = zona.contraste;
    } else {
      posicion = 'PAPEL';
      letras = trazar(titulo, receta, posicion);
    }
  }
  if (posicion === 'PAPEL') {
    if (letras.cuerpo < 36 || letras.caja.y + letras.caja.alto > 1330) throw new ErrorDeUsuario('El título ocupa demasiado para leerlo a 360 px. Revisa el fragmento público en dirección.');
    const foto = await sharp(base).resize(1080, 1044, { fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
    const margen = Math.round((lienzo.width - foto.info.width) / 2);
    fondo = await sharp({ create: { ...lienzo, channels: 3, background: papel } }).composite([{ input: foto.data, left: margen, top: 18 }]).png().toBuffer();
  }
  const tintaSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><path fill="' + tinta + '" d="' + letras.trazos + '"/></svg>');
  const png = await sharp(fondo).composite([{ input: tintaSvg }]).png().toBuffer();
  const composicion: Composicion = { baseSha256, estilo: receta.estilo, posicionSolicitada: receta.posicion, posicion, tinta,
    contraste: Math.round(ratio * 100) / 100, familia: receta.fuente, lineas: letras.lineas, caja: letras.caja };
  return { png, composicion };
}
