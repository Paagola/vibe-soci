import { join } from 'node:path';
import { z } from 'zod';
import { FamiliaBiblioteca, FichaReferencia } from '../../dominio/referencia.js';
import type { BibliotecaDeReferencias } from '../../puertos/BibliotecaDeReferencias.js';
import { leerJson } from './json.js';

/** conocimiento/referencias/{familias.json, fichas/post-NN.json} y las imágenes de biblioteca/referencias/. */
export class BibliotecaDeReferenciasFicheros implements BibliotecaDeReferencias {
  constructor(
    private readonly carpetaConocimiento: string,
    private readonly carpetaImagenes: string,
  ) {}

  async familias(): Promise<FamiliaBiblioteca[]> {
    const { familias } = await leerJson(join(this.carpetaConocimiento, 'familias.json'), z.object({ familias: z.array(FamiliaBiblioteca) }));
    return familias;
  }

  async ficha(post: string): Promise<FichaReferencia> {
    return leerJson(join(this.carpetaConocimiento, 'fichas', `${post}.json`), FichaReferencia);
  }

  rutaImagen(post: string): string {
    return join(this.carpetaImagenes, `${post}.jpg`);
  }
}
