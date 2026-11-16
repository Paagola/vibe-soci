import { existsSync } from 'node:fs';
import type { Marca } from '../../dominio/modelos.js';
import type { ReferenciaLocal } from '../../dominio/referencia.js';
import type { AlmacenLocales } from '../../puertos/Almacenes.js';
import type { AlmacenReferencias } from '../../puertos/AlmacenReferencias.js';

/** Los locales del modo (propio) por encima de otros de solo lectura (los reales). Se lee del propio y, si no está, del de solo lectura; se escribe SIEMPRE en el propio. */
export class LocalesSuperpuestos implements AlmacenLocales {
  constructor(
    private readonly propio: AlmacenLocales,
    private readonly soloLectura: AlmacenLocales,
  ) {}

  async existe(slug: string): Promise<boolean> {
    return (await this.propio.existe(slug)) || (await this.soloLectura.existe(slug));
  }

  async obtener(slug: string): Promise<Marca> {
    if (await this.propio.existe(slug)) return this.propio.obtener(slug);
    return this.soloLectura.obtener(slug);
  }

  async guardar(marca: Marca): Promise<void> {
    await this.propio.guardar(marca);
  }

  async listar(): Promise<Marca[]> {
    const porSlug = new Map<string, Marca>();
    for (const marca of await this.soloLectura.listar()) porSlug.set(marca.slug, marca);
    for (const marca of await this.propio.listar()) porSlug.set(marca.slug, marca);
    return [...porSlug.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  }

  /** true si el local solo está en los de solo lectura. */
  async esDeSoloLectura(slug: string): Promise<boolean> {
    return !(await this.propio.existe(slug)) && (await this.soloLectura.existe(slug));
  }
}

/** Igual para las referencias de cada local. */
export class ReferenciasSuperpuestas implements AlmacenReferencias {
  constructor(
    private readonly propio: AlmacenReferencias,
    private readonly soloLectura: AlmacenReferencias,
  ) {}

  async existe(local: string, id: string): Promise<boolean> {
    return (await this.propio.existe(local, id)) || (await this.soloLectura.existe(local, id));
  }

  async obtener(local: string, id: string): Promise<ReferenciaLocal> {
    if (await this.propio.existe(local, id)) return this.propio.obtener(local, id);
    return this.soloLectura.obtener(local, id);
  }

  async guardar(referencia: ReferenciaLocal): Promise<void> {
    await this.propio.guardar(referencia);
  }

  async listar(local: string): Promise<ReferenciaLocal[]> {
    const porId = new Map<string, ReferenciaLocal>();
    for (const referencia of await this.soloLectura.listar(local)) porId.set(referencia.id, referencia);
    for (const referencia of await this.propio.listar(local)) porId.set(referencia.id, referencia);
    return [...porId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  async escribirArchivo(local: string, id: string, archivo: string, contenido: Buffer): Promise<void> {
    await this.propio.escribirArchivo(local, id, archivo, contenido);
  }

  rutaArchivo(local: string, id: string, archivo: string): string {
    const p = this.propio.rutaArchivo(local, id, archivo);
    return existsSync(p) ? p : this.soloLectura.rutaArchivo(local, id, archivo);
  }
}
