import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { GeneradorImagen, ImagenGenerada, PeticionImagen, TrabajoEnviado } from '../../puertos/GeneradorImagen.js';
import type { ClienteHiggsfield } from './ClienteHiggsfield.js';
import type { EstrategiaModelo, Resolucion } from './modelos.js';

const TIPO_POR_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export class GeneradorHiggsfield implements GeneradorImagen {
  readonly origen = 'API' as const;
  /** Una foto se sube una vez por ejecución aunque la usen varias diapositivas. */
  private readonly subidas = new Map<string, Promise<string>>();

  constructor(
    private readonly cliente: ClienteHiggsfield,
    private readonly estrategia: EstrategiaModelo,
    private readonly resolucion: Resolucion,
    private readonly avisar: (mensaje: string) => void,
  ) {}

  get modelo(): string {
    return this.estrategia.id;
  }

  async enviar(peticion: PeticionImagen): Promise<TrabajoEnviado> {
    const { maxCaracteresPrompt, maxReferencias, id } = this.estrategia;
    if (maxCaracteresPrompt !== undefined && peticion.prompt.length > maxCaracteresPrompt) {
      throw new ErrorDeUsuario(`El prompt tiene ${peticion.prompt.length} caracteres y ${id} admite ${maxCaracteresPrompt}. Usa otro HF_MODELO.`);
    }
    let referencias = peticion.referencias;
    if (referencias.length > maxReferencias) {
      this.avisar(`${id} solo admite ${maxReferencias} imagen(es) de referencia: envío las ${maxReferencias} primeras.`);
      referencias = referencias.slice(0, maxReferencias);
    }

    const urls = await Promise.all(referencias.map((ruta) => this.subir(ruta)));
    const cuerpo = this.estrategia.construirCuerpo({ prompt: peticion.prompt, urls, formato: peticion.formato, resolucion: this.resolucion });
    return this.cliente.enviar(id, cuerpo, peticion.claveIdempotencia);
  }

  async esperarResultado(trabajo: TrabajoEnviado): Promise<ImagenGenerada> {
    const url = await this.cliente.esperar(trabajo.urlEstado);
    const { bytes, tipo } = await this.cliente.descargar(url);
    return { bytes, extension: extensionDe(tipo, url) };
  }

  /** Solo se recuerdan las subidas que salen bien: si una falla, el siguiente envío la vuelve a intentar. */
  private subir(ruta: string): Promise<string> {
    let subida = this.subidas.get(ruta);
    if (!subida) {
      const tipo = TIPO_POR_EXTENSION[extname(ruta).toLowerCase()] ?? 'image/jpeg';
      const nueva = readFile(ruta).then((bytes) => this.cliente.subirArchivo(bytes, tipo));
      this.subidas.set(ruta, nueva);
      nueva.catch(() => {
        if (this.subidas.get(ruta) === nueva) this.subidas.delete(ruta);
      });
      subida = nueva;
    }
    return subida;
  }
}

function extensionDe(tipo: string, url: string): string {
  if (tipo.includes('jpeg')) return 'jpg';
  if (tipo.includes('webp')) return 'webp';
  if (tipo.includes('png')) return 'png';
  const deUrl = extname(new URL(url).pathname).slice(1).toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp'].includes(deUrl) ? deUrl : 'png';
}
