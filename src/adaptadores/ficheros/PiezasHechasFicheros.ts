import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { PiezaHecha } from '../../dominio/referencia.js';
import type { PiezasHechas } from '../../puertos/PiezasHechas.js';

/** Lo que se lee del plan: solo `local` y, si el plan es una pieza, `pieza`. El resto del plan no importa aquí. */
const PlanConPieza = z.object({
  local: z.string().min(1),
  pieza: z.object({ fecha: z.string(), referencia: z.string().optional() }).optional(),
});

/**
 * proyectos/<p>/plan.json y proyectos/<p>/<sub>/plan.json. Cuenta solo los planes que declaran `pieza`.
 * Solo lee.
 */
export class PiezasHechasFicheros implements PiezasHechas {
  constructor(private readonly carpetaProyectos: string) {}

  async listar(): Promise<PiezaHecha[]> {
    const planes: string[] = [];
    const buscar = async (carpeta: string, nivel: number) => {
      const entradas = await readdir(carpeta, { withFileTypes: true }).catch(() => []);
      for (const e of entradas) {
        if (e.isFile() && e.name === 'plan.json' && nivel > 0) planes.push(join(carpeta, e.name));
        if (e.isDirectory() && nivel < 2) await buscar(join(carpeta, e.name), nivel + 1);
      }
    };
    await buscar(this.carpetaProyectos, 0);

    const piezas: PiezaHecha[] = [];
    for (const ruta of planes.sort()) {
      const plan = PlanConPieza.safeParse(JSON.parse(await readFile(ruta, 'utf8')));
      if (!plan.success || !plan.data.pieza) continue;
      const pieza = PiezaHecha.safeParse({
        proyecto: relative(this.carpetaProyectos, join(ruta, '..')),
        local: plan.data.local,
        ...plan.data.pieza,
      });
      if (!pieza.success) throw new ErrorDeUsuario(`${ruta}: el campo "pieza" no es válido.`, pieza.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      piezas.push(pieza.data);
    }
    return piezas;
  }
}
