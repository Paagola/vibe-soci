/**
 * Productor (fase 1): el brief y la bitácora de un encargo en ficheros (carpeta_de_proyectos/<proyecto>/).
 */
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BriefDelEncargo } from '../../dominio/brief.js';
import { EntradaBitacora } from '../../dominio/bitacora.js';
import type { AlmacenBrief } from '../../puertos/AlmacenBrief.js';

/** Escritura atómica: primero a un temporal y después rename a la ruta final. */
async function escribirAtomico(ruta: string, contenido: string): Promise<void> {
  const temporal = `${ruta}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporal, contenido, 'utf8');
  await rename(temporal, ruta);
}

function esNoEncontrado(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'ENOENT';
}

export class AlmacenBriefFicheros implements AlmacenBrief {
  constructor(private readonly carpetaProyectos: string) {}

  private carpeta(proyecto: string): string {
    return join(this.carpetaProyectos, proyecto);
  }

  async leer(proyecto: string): Promise<BriefDelEncargo | undefined> {
    let texto: string;
    try {
      texto = await readFile(join(this.carpeta(proyecto), 'brief.json'), 'utf8');
    } catch (e) {
      if (esNoEncontrado(e)) return undefined;
      throw e;
    }
    return BriefDelEncargo.parse(JSON.parse(texto));
  }

  async guardar(brief: BriefDelEncargo): Promise<void> {
    const valido = BriefDelEncargo.parse(brief);
    const anterior = await this.leer(valido.proyecto);
    const esperada = anterior ? anterior.version + 1 : 1;
    if (valido.version !== esperada) {
      throw new Error(`Versión del brief ${valido.version} no encadena: se esperaba la ${esperada} (${anterior ? 'hay brief previo' : 'sin brief previo'}).`);
    }
    const carpeta = this.carpeta(valido.proyecto);
    await mkdir(carpeta, { recursive: true });
    const json = JSON.stringify(valido, null, 2) + '\n';
    const copia = `brief.v${String(valido.version).padStart(3, '0')}.json`;
    await escribirAtomico(join(carpeta, copia), json);
    await escribirAtomico(join(carpeta, 'brief.json'), json);
  }

  async anotar(proyecto: string, entrada: EntradaBitacora): Promise<void> {
    const carpeta = this.carpeta(proyecto);
    await mkdir(carpeta, { recursive: true });
    await appendFile(join(carpeta, 'bitacora.jsonl'), JSON.stringify(EntradaBitacora.parse(entrada)) + '\n', 'utf8');
  }

  async bitacora(proyecto: string): Promise<EntradaBitacora[]> {
    let texto: string;
    try {
      texto = await readFile(join(this.carpeta(proyecto), 'bitacora.jsonl'), 'utf8');
    } catch (e) {
      if (esNoEncontrado(e)) return [];
      throw e;
    }
    return texto
      .split('\n')
      .filter((linea) => linea.trim() !== '')
      .map((linea) => EntradaBitacora.parse(JSON.parse(linea)));
  }
}
