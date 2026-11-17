import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';

export async function escribirJsonAtomico(ruta: string, contenido: unknown): Promise<void> {
  const temporal = `${ruta}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporal, JSON.stringify(contenido, null, 2) + '\n');
    await rename(temporal, ruta);
  } finally {
    await rm(temporal, { force: true });
  }
}
