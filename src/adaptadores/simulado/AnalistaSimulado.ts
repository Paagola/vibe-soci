/**
 * Analista de referencias SIMULADO (puntos 3 y 4): no mira la imagen. Devuelve lo que se le ponga en cola o, por
 * defecto, una ficha mínima marcada como simulada (familia F4) de un post limpio. Para `--simular` y las pruebas.
 */
import type { Aptitud } from '../../dominio/referencia.js';
import type { AnalistaDeReferencias, FichaAnalizada } from '../../puertos/AnalistaDeReferencias.js';

export const FICHA_SIMULADA: FichaAnalizada = {
  titulo: '(ficha simulada)',
  familia: 'F4',
  mecanismos: ['LOGOTIPO_TIPOGRAFICO'],
  capas: ['fondo oscuro (simulado)', 'plato en ¾ (simulado)'],
  reticula: 'titular arriba (simulado)',
  tipografia: [{ rol: 'TITULAR', clasificacion: 'serif (simulado)', escala: 10 }],
  paleta: [{ hex: '#111111', rol: 'fondo (simulado)' }],
  foto: 'clave baja (simulado)',
  lecturaFotografica: {
    camara: 'Vista oblicua simulada', distancia: 'Plano medio simulado', luz: 'Luz lateral simulada',
    gesto: 'Sujeto apoyado en mesa simulada', materiales: 'Cerámica mate simulada',
    sensacion: 'Calma simulada', traslado: 'Reservar aire sobre el sujeto simulado',
  },
  recursos: [],
  relacionesGraficas: [{ gesto: 'El titular sigue el borde del plato simulado', construccion: 'Alinear la base del titular con el inicio de la silueta simulada.' }],
  lectura: ['el plato', 'el titular', 'la marca'],
  porQueFunciona: 'Ficha simulada: no se ha mirado la imagen.',
};

export class AnalistaReferenciasSimulado implements AnalistaDeReferencias {
  readonly nombre = 'analista simulado';
  readonly analizadas: string[] = [];

  constructor(private readonly cola: Array<{ aptitud: Aptitud; ficha?: FichaAnalizada }> = []) {}

  async analizar(rutaImagen: string) {
    this.analizadas.push(rutaImagen);
    const r = this.cola.shift();
    return { aptitud: r?.aptitud ?? { tipo: 'POST' as const, problemas: [] }, ficha: r?.ficha ?? FICHA_SIMULADA };
  }
}
