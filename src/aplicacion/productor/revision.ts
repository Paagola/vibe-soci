import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BriefDelEncargo } from '../../dominio/brief.js';
import type { EncargoPost } from '../../dominio/post.js';

/** Identifica el encargo y los documentos que la persona puede haber visto o corregido. */
export async function revisionDeEncargo(proyectos: string, e: Readonly<EncargoPost>, brief?: BriefDelEncargo): Promise<string> {
  const huella = createHash('sha256').update(JSON.stringify(e)).update(JSON.stringify(brief ?? null));
  const archivos = e.propuesta ? [e.propuesta.archivo] : [];
  if (e.productorEditorial && ['INTENCION', 'COMPONER', 'HECHO'].includes(e.paso)) {
    archivos.push('plan.json', 'revision-editorial.json');
    for (const pagina of brief?.plan ?? []) {
      const id = pagina.papel === 'portada' ? 'post' : pagina.papel === 'cierre' ? 'cierre' : `detalle-${pagina.n - 1}`;
      archivos.push(`intenciones/${id}.json`);
    }
  }
  for (const archivo of archivos) {
    huella.update(archivo);
    try {
      huella.update(await readFile(join(proyectos, e.proyecto, archivo)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      huella.update('ausente');
    }
  }
  return huella.digest('hex');
}
