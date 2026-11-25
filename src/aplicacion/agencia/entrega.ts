import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pieza } from '../../dominio/chat.js';

interface Publicacion {
  id: string;
  local: string;
  fecha: string;
  formato?: 'post' | 'carrusel' | 'historia';
  texto: string;
  metrica: string;
  campana: string;
  indice: number;
}

/** Un conector local puede recoger la carpeta completa tras el rename y deduplicar por id. */
export async function entregarPublicacion(carpeta: string, publicacion: Publicacion, pieza: Pieza, ruta: (archivo: string) => string) {
  const destino = join(carpeta, publicacion.id);
  try {
    const previa = JSON.parse(await readFile(join(destino, 'publicacion.json'), 'utf8'));
    if (previa.id !== publicacion.id) throw new Error('El identificador de la entrega guardada no coincide.');
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const laminas = [...pieza.diapositivas].sort((a, b) => a.n - b.n);
  if (pieza.estado !== 'LISTA' || !laminas.length || laminas.length !== pieza.plan?.diapositivas.length ||
      laminas.some((d, i) => !d.png || d.n !== i + 1)) throw new Error('Faltan imágenes definitivas para entregar esta pieza.');
  await mkdir(carpeta, { recursive: true });
  const temporal = await mkdtemp(join(carpeta, '.preparando-'));
  try {
    const imagenes: string[] = [];
    for (const d of laminas) {
      const nombre = String(d.n).padStart(2, '0') + '.png';
      await copyFile(ruta(d.png!), join(temporal, nombre));
      imagenes.push(nombre);
    }
    await writeFile(join(temporal, 'publicacion.json'), JSON.stringify({ ...publicacion, formato: publicacion.formato ?? pieza.formato, imagenes }, null, 2));
    await rename(temporal, destino);
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}
