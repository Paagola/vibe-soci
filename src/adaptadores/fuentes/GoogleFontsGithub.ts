/**
 * Punto 2: las fuentes de Google Fonts con licencia OFL, desde su repositorio público (github.com/google/fonts, carpeta
 * ofl/<familia>). Solo OFL: lo que esté en apache/ o ufl/ no se toma (otra licencia). Sin clave ni cuenta.
 */
import type { FuenteDescargada, ProveedorDeFuentes } from '../../puertos/ProveedorDeFuentes.js';

const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl';

/** «Abril Fatface» → «abrilfatface», como nombra Google Fonts sus carpetas. */
export const carpetaDeGoogle = (familia: string) => familia.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Los archivos de un METADATA.pb: el estilo normal, variable si lo hay; si no, el de peso 400. */
export function archivoPrincipal(metadata: string): { archivo?: string; categoria?: string; licencia?: string } {
  const fuentes = [...metadata.matchAll(/fonts\s*\{([\s\S]*?)\n\}/g)].map((m) => ({
    estilo: /style:\s*"([^"]+)"/.exec(m[1]!)?.[1],
    peso: Number(/weight:\s*(\d+)/.exec(m[1]!)?.[1] ?? 0),
    archivo: /filename:\s*"([^"]+)"/.exec(m[1]!)?.[1],
  }));
  const normales = fuentes.filter((f) => f.estilo === 'normal' && f.archivo);
  const elegida = normales.find((f) => f.archivo!.includes('[')) ?? normales.find((f) => f.peso === 400) ?? normales[0];
  return { ...(elegida?.archivo ? { archivo: elegida.archivo } : {}), ...(metadata.match(/category:\s*"([^"]+)"/) ? { categoria: /category:\s*"([^"]+)"/.exec(metadata)![1]! } : {}), ...(metadata.match(/license:\s*"([^"]+)"/) ? { licencia: /license:\s*"([^"]+)"/.exec(metadata)![1]! } : {}) };
}

export class GoogleFontsGithub implements ProveedorDeFuentes {
  readonly nombre = 'Google Fonts (github.com/google/fonts, OFL)';

  constructor(private readonly f: typeof fetch = fetch) {}

  async buscar(familia: string): Promise<FuenteDescargada | undefined> {
    const carpeta = carpetaDeGoogle(familia);
    if (!carpeta) return undefined;
    const traer = async (ruta: string) => {
      const r = await this.f(`${BASE}/${carpeta}/${ruta}`, { signal: AbortSignal.timeout(20_000) }).catch(() => undefined);
      return r?.ok ? Buffer.from(await r.arrayBuffer()) : undefined;
    };
    const metadata = await traer('METADATA.pb');
    if (!metadata) return undefined;
    const { archivo, categoria, licencia } = archivoPrincipal(metadata.toString('utf8'));
    if (!archivo || (licencia && licencia !== 'OFL')) return undefined;
    const [bytes, ofl] = await Promise.all([traer(archivo), traer('OFL.txt')]);
    if (!bytes || !ofl) return undefined;
    return { familia, archivo: { nombre: archivo, bytes }, licencia: ofl, url: `https://github.com/google/fonts/tree/main/ofl/${carpeta}`, ...(categoria ? { categoria } : {}) };
  }
}
