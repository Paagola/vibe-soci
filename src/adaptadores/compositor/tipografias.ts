/**
 * Catálogo de fuentes (recursos/tipografias/catalogo.json) y caché de variaciones.
 * Las fuentes variables se piden con sus ejes (wdth, wght…) y se recortan al rango que admite cada una.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openSync, type Fuente } from 'fontkit';

interface EntradaCatalogo {
  id: string;
  familia: string;
  archivo: string;
  licencia: string;
}

export interface FuenteResuelta {
  fuente: Fuente;
  /** Los ejes que se han aplicado de verdad (dentro de su rango). */
  ejes: Record<string, number>;
}

export class CatalogoTipografico {
  private readonly entradas: Map<string, EntradaCatalogo>;
  private readonly abiertas = new Map<string, Fuente>();
  private readonly variaciones = new Map<string, Fuente>();

  constructor(private readonly carpeta: string) {
    const catalogo = JSON.parse(readFileSync(join(carpeta, 'catalogo.json'), 'utf8')) as { fuentes: EntradaCatalogo[] };
    this.entradas = new Map(catalogo.fuentes.map((entrada) => [entrada.id, entrada]));
  }

  familia(id: string): string {
    return this.entrada(id).familia;
  }

  /** Rango de un eje variable, o undefined si la fuente no lo tiene. */
  rango(id: string, eje: string): [number, number] | undefined {
    const datos = this.base(id).variationAxes[eje];
    return datos ? [datos.min, datos.max] : undefined;
  }

  fuente(id: string, ejes: Record<string, number> = {}): FuenteResuelta {
    const base = this.base(id);
    const limpios: Record<string, number> = {};
    for (const [eje, valor] of Object.entries(ejes).sort(([a], [b]) => a.localeCompare(b))) {
      const rango = base.variationAxes[eje];
      if (rango) limpios[eje] = Math.round(Math.min(rango.max, Math.max(rango.min, valor)) * 100) / 100;
    }
    if (Object.keys(limpios).length === 0) return { fuente: base, ejes: limpios };
    const clave = `${id}|${JSON.stringify(limpios)}`;
    let variacion = this.variaciones.get(clave);
    if (!variacion) {
      variacion = base.getVariation(limpios);
      this.variaciones.set(clave, variacion);
    }
    return { fuente: variacion, ejes: limpios };
  }

  private base(id: string): Fuente {
    let fuente = this.abiertas.get(id);
    if (!fuente) {
      fuente = openSync(join(this.carpeta, this.entrada(id).archivo));
      this.abiertas.set(id, fuente);
    }
    return fuente;
  }

  private entrada(id: string): EntradaCatalogo {
    const entrada = this.entradas.get(id);
    if (!entrada) throw new RangeError(`La fuente «${id}» no está en el catálogo (${[...this.entradas.keys()].join(', ')}).`);
    return entrada;
  }
}
