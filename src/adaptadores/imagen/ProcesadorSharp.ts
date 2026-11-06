import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import type { Formato } from '../../dominio/modelos.js';
import { TAMANO_PROPORCION, proporcionDe, type Proporcion } from '../../dominio/reglas.js';
import type { InfoImagen, ProcesadorImagen } from '../../puertos/ProcesadorImagen.js';

export class ProcesadorSharp implements ProcesadorImagen {
  async medir(ruta: string): Promise<InfoImagen> {
    const { width, height } = await sharp(ruta).rotate().metadata();
    return { ancho: width ?? 0, alto: height ?? 0 };
  }

  async reducir(ruta: string, ladoMaximo: number): Promise<Buffer> {
    return sharp(ruta)
      .rotate()
      .resize({ width: ladoMaximo, height: ladoMaximo, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  /**
   * Lleva la imagen al tamaño exacto de la proporción pedida, escalando y recortando lo mínimo por el centro.
   * Una pieza diseñada a 3:4 sale a 4:5 perdiendo 45 px arriba y 45 px abajo: por eso el texto va en la zona segura.
   */
  async exportar(origen: string, destino: string, proporcion: Proporcion): Promise<void> {
    await mkdir(dirname(destino), { recursive: true });
    const { ancho, alto } = TAMANO_PROPORCION[proporcion];
    await sharp(origen)
      .rotate()
      .resize({ width: ancho, height: alto, fit: 'cover', position: 'centre', kernel: 'lanczos3' })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
      .toFile(destino);
  }

  async crearMarcador(texto: string, formato: Formato): Promise<Buffer> {
    const { ancho, alto } = TAMANO_PROPORCION[proporcionDe(formato)];
    const lineas = partirEnLineas(texto, 34).slice(0, 14);
    const tspans = lineas
      .map((linea, i) => `<tspan x="60" dy="${i === 0 ? 0 : 52}">${escaparXml(linea)}</tspan>`)
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
      <rect width="100%" height="100%" fill="#1b1b1b"/>
      <text x="60" y="120" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#EDE7DD">SIMULADO</text>
      <text x="60" y="220" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#cfcfcf">${tspans}</text>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

function partirEnLineas(texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if ((actual + ' ' + palabra).trim().length > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = `${actual} ${palabra}`.trim();
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function escaparXml(texto: string): string {
  return texto.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c);
}
