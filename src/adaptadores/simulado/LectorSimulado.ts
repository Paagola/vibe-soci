/**
 * OCR SIMULADO para las pruebas: no mira la imagen. Por defecto «lee» lo esperado; con una función se le hace leer
 * otra cosa (p. ej. «TURRE DE VGE»), para probar que la verificación rechaza una lectura mala.
 */
import type { LectorDeTexto } from '../../puertos/LectorDeTexto.js';

export class LectorSimulado implements LectorDeTexto {
  readonly nombre = 'OCR simulado';
  readonly lecturas: string[] = [];

  constructor(private readonly leerComo: (esperado: string, indice: number) => string[] = (esperado) => [esperado]) {}

  async leer(_png: Buffer, esperado = ''): Promise<string[]> {
    const lineas = this.leerComo(esperado, this.lecturas.length);
    this.lecturas.push(esperado);
    return lineas;
  }
}
