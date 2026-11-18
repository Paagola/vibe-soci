import { randomUUID } from 'node:crypto';
import { link, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';

export const MODELO_CARTEL = 'gpt-image-2';
export interface GeneradorCartel {
  generar(prompt: string, foto: Buffer, nombre?: 'producto.jpg' | 'muestras.jpg'): Promise<Buffer>;
}

export async function enviosDisponibles(carpeta: string, limite: number): Promise<number> {
  const archivos = await readdir(carpeta).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  return limite - archivos.filter(nombre => /^[1-9][0-9]*\.json$/.test(nombre) && Number.parseInt(nombre, 10) <= limite).length;
}

/** Cada fichero es una plaza del presupuesto de envíos del estudio. La creación exclusiva funciona entre procesos.
 * Un resultado incierto conserva la plaza. Ningún timeout da lugar a un reenvío automático. */
export async function reservarEnvio(carpeta: string, limite: number, huella: string, proyecto: string, fecha: string): Promise<number> {
  await mkdir(carpeta, { recursive: true });
  const temporal = join(carpeta, randomUUID() + '.tmp');
  await writeFile(temporal, JSON.stringify({ proyecto, huella, fecha, modelo: MODELO_CARTEL }), { flag: 'wx' });
  try {
    for (let numero = 1; numero <= limite; numero++) {
      const ruta = join(carpeta, numero + '.json');
      try {
        // El enlace hace visible la reserva completa de una vez, también para un segundo proceso.
        await link(temporal, ruta);
        return numero;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const reserva = JSON.parse(await readFile(ruta, 'utf8'));
        if (reserva.huella === huella && reserva.proyecto === proyecto) {
          throw new ErrorDeUsuario('Ya existe un envío para esta dirección. Puedes importar el resultado o editar la dirección.');
        }
      }
    }
    throw new ErrorDeUsuario('El taller ha agotado el presupuesto de envíos configurado.');
  } finally {
    await unlink(temporal);
  }
}

export class GeneradorCartelOpenAI implements GeneradorCartel {
  constructor(private readonly clave: string, private readonly transporte: typeof fetch = fetch) {}
  async generar(prompt: string, foto: Buffer, nombre: 'producto.jpg' | 'muestras.jpg' = 'producto.jpg'): Promise<Buffer> {
    const cuerpo = new FormData();
    cuerpo.set('model', MODELO_CARTEL);
    cuerpo.set('size', '1088x1360');
    cuerpo.set('quality', 'high');
    cuerpo.set('n', '1');
    cuerpo.set('output_format', 'png');
    cuerpo.set('prompt', prompt);
    cuerpo.set('image', new Blob([Uint8Array.from(foto)], { type: 'image/jpeg' }), nombre);
    const respuesta = await this.transporte('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: 'Bearer ' + this.clave }, body: cuerpo, signal: AbortSignal.timeout(300_000),
    });
    if (!respuesta.ok) throw new ErrorDeUsuario(`Images API devolvió HTTP ${respuesta.status}. La reserva se conserva. Puedes importar una candidata.`);
    const json = await respuesta.json() as { data?: Array<{ b64_json?: string }> };
    const imagen = json.data?.[0]?.b64_json;
    if (typeof imagen !== 'string' || !imagen.length) throw new ErrorDeUsuario('El proveedor no devolvió una imagen. El envío queda reservado.');
    return Buffer.from(imagen, 'base64');
  }
}
