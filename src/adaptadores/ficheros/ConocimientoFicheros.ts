import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { leerDocumento, type DocumentoConocimiento } from '../../dominio/conocimiento.js';
import type { FuenteConocimiento } from '../../puertos/FuenteConocimiento.js';

/** Lee los .md de conocimiento/ (y subcarpetas). Los que no tienen cabecera, como los README, no se ofrecen. */
export class ConocimientoFicheros implements FuenteConocimiento {
  constructor(private readonly carpeta: string) {}

  async documentos(): Promise<DocumentoConocimiento[]> {
    const rutas = (await readdir(this.carpeta, { recursive: true })).filter((r) => r.endsWith('.md')).sort();
    const documentos: DocumentoConocimiento[] = [];
    for (const ruta of rutas) {
      const documento = leerDocumento(relative(this.carpeta, join(this.carpeta, ruta)), await readFile(join(this.carpeta, ruta), 'utf8'));
      if (documento) documentos.push(documento);
    }
    return documentos;
  }
}
