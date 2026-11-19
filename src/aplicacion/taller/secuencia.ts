import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { formatoDeToma, tomaPlaneada, type SecuenciaTaller, type TomaDeSerie } from '../../dominio/secuenciaTaller.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { pautaDeLuz } from '../../dominio/luzFotografica.js';
import { huella } from './direccion.js';
import { paqueteZip } from './paquete.js';

const proyeccion = {
  CENITAL: 'Sitúa la cámara a plomo, a 90°, con el sensor paralelo a la mesa. En un plato redondo, el borde se ve circular, sin pared frontal. Reencuadra el espacio desde arriba.',
  RASANTE: 'Sitúa la cámara cerca de la superficie de apoyo. Debe dominar el perfil del alimento y el borde visible, con oclusiones coherentes con una vista baja.',
  OBLICUA: 'Sitúa la cámara en diagonal, entre la vista frontal y cenital, desde un flanco. Deben verse una cara superior y una lateral en proporciones acordes con esa perspectiva.',
};

export function promptDeToma(serie: SecuenciaTaller, toma: TomaDeSerie) {
  const planeada = tomaPlaneada(serie.direccion, toma);
  if (!planeada) throw new ErrorDeUsuario('Esta toma no figura en la dirección del carrusel.');
  const { vista, plano, gesto, encuadre } = planeada;
  const formato = formatoDeToma(planeada);
  if (serie.documental) return [
    'Instrucción de cámara para una fotografía documental real. Haz o aporta una foto ' + formato + '.',
    'Conserva la escena, la luz existente, las personas, el espacio y el producto realmente documentados. Las fotos adjuntas son el contexto de la sesión.',
    'Nueva cámara: ' + vista + ', plano ' + plano + '. Gesto o motivo: ' + gesto + ' Encuadre: ' + encuadre,
    proyeccion[vista],
    ...('reserva' in planeada && planeada.reserva ? ['Espacio para la composición posterior: ' + planeada.reserva] : []),
  ].join('\n\n');
  return [
    formato === '1:1' ? 'Crea una sola fotografía gastronómica editorial cuadrada 1:1.' :
      'Crea una sola fotografía gastronómica editorial vertical 4:5.',
    'Imagen 1: evidencia del alimento. Conserva su forma, preparación y acabado visibles. Imagen 2: portada aprobada, referencia de continuidad de la escena.',
    'Continúa la misma sesión: ' + serie.direccion.continuidad,
    'Nueva cámara: ' + vista + ', plano ' + plano + '. Gesto: ' + gesto + ' Encuadre: ' + encuadre,
    ...('reserva' in planeada && planeada.reserva ? ['Espacio para la composición posterior: ' + planeada.reserva] : []),
    proyeccion[vista] + ' Reproyecta el sujeto y el fondo desde esa cámara. Cambiar un accesorio, girar el lienzo o recortar la portada no cambia la perspectiva.',
    'La primera imagen certifica el alimento, aunque esté en una bandeja de transporte, sobre un apoyo casual o iluminado con el móvil. Conserva sus capas, volumen y color de cocción. Si hay un gesto, muestra un apoyo real y manos o utensilios físicamente coherentes.',
    'Entrega una toma distinta de la portada. Mantén sus materiales, vajilla y paleta. Conserva los ingredientes observados. No inventes rellenos, adornos ni datos del restaurante. Deja las caras fuera de cuadro y no añadas letras, marcas, marcos ni montaje.',
    'La pauta de luz manda sobre la dominante de cualquier referencia: ' + pautaDeLuz(serie.luz ?? 'NATURAL'),
  ].join('\n\n');
}

export function paqueteDeToma(serie: SecuenciaTaller, toma: TomaDeSerie, fuente: Buffer, portada: Buffer) {
  return paqueteZip([
    { nombre: 'direccion.txt', bytes: Buffer.from(promptDeToma(serie, toma)) },
    { nombre: '01-producto.jpg', bytes: fuente },
    { nombre: '02-portada.png', bytes: portada },
  ]);
}

export const rutaToma = (carpeta: string, sha256: string) => join(carpeta, 'tomas-serie', sha256 + '.png');

export async function guardarToma(carpeta: string, datos: Buffer, modelo: string, uso: 'PUBLICABLE' | 'SOLO_PRUEBA_COMPOSICION', formato?: '1:1' | '4:5') {
  const bytes = await normalizarFotoDeSerie(datos, formato);
  const sha256 = huella(bytes);
  await mkdir(join(carpeta, 'tomas-serie'), { recursive: true });
  await writeFile(rutaToma(carpeta, sha256), bytes);
  return { sha256, modelo, uso, aprobada: false };
}

export async function normalizarFotoDeSerie(datos: Buffer, formato: '1:1' | '4:5' = '4:5') {
  if (!datos.length || datos.length > 32 * 1024 * 1024) throw new ErrorDeUsuario('El archivo de la toma supera el tamaño admitido.');
  const foto = sharp(datos, { limitInputPixels: 36_000_000 });
  const meta = await foto.metadata().catch(() => { throw new ErrorDeUsuario('Abre la toma como un PNG, JPEG o WebP vertical.'); });
  const { width, height } = meta.autoOrient;
  const cuadrada = formato === '1:1';
  const altoMinimo = cuadrada ? 360 : 450;
  const proporcion = cuadrada ? 1 : .8;
  if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages ?? 1) !== 1 || width < 360 || height < altoMinimo || Math.abs(width - proporcion * height) > .012 * height) {
    throw new ErrorDeUsuario('Importa una sola foto ' + formato + ' con al menos 360 × ' + altoMinimo + ' px.');
  }
  return foto.rotate().resize(1080, cuadrada ? 1080 : 1350).flatten({ background: '#fff' }).png().toBuffer();
}

export async function leerToma(carpeta: string, sha256: string) {
  const bytes = await readFile(rutaToma(carpeta, sha256));
  if (huella(bytes) !== sha256) throw new ErrorDeUsuario('Los píxeles de la toma han cambiado desde la revisión.');
  return bytes;
}
