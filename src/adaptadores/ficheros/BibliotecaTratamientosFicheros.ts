/**
 * Biblioteca de estilos de tipografía especial en recursos/tratamientos/<id>/receta.json.
 * Lectura síncrona y con caché: el compositor la consulta al resolver cada texto y son pocos ficheros pequeños.
 * Cada receta se valida (esquema y grafo) al leerla: una receta rota no llega nunca al compositor.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { problemasDeReceta, Receta } from '../../dominio/tipografia/receta.js';
import { describirProblemas } from '../../dominio/validacion.js';
import type { BibliotecaDeTratamientos } from '../../puertos/BibliotecaDeTratamientos.js';

export class BibliotecaTratamientosFicheros implements BibliotecaDeTratamientos {
  private cache?: Map<string, Receta>;

  constructor(private readonly carpeta: string) {}

  obtener(id: string): Receta {
    const receta = this.todas().get(id);
    if (!receta) throw new ErrorDeUsuario(`No hay ningún estilo «${id}» en la biblioteca. Hay: ${[...this.todas().keys()].join(', ') || 'ninguno'}.`);
    return receta;
  }

  listar(opciones: { conRetiradas?: boolean } = {}): Receta[] {
    return [...this.todas().values()].filter((r) => opciones.conRetiradas || r.estado !== 'RETIRADO');
  }

  /** Para cuando se añade o cambia una receta en esta misma ejecución. */
  olvidar(): void {
    this.cache = undefined;
  }

  private todas(): Map<string, Receta> {
    if (this.cache) return this.cache;
    const recetas = new Map<string, Receta>();
    if (existsSync(this.carpeta)) {
      for (const id of readdirSync(this.carpeta).sort()) {
        const ruta = join(this.carpeta, id, 'receta.json');
        if (!existsSync(ruta)) continue;
        const leida = Receta.safeParse(JSON.parse(readFileSync(ruta, 'utf8')));
        if (!leida.success) throw new ErrorDeUsuario(`${ruta} no es una receta válida.`, describirProblemas(leida.error));
        const problemas = problemasDeReceta(leida.data);
        if (problemas.length) throw new ErrorDeUsuario(`${ruta} no es una receta válida.`, problemas);
        if (leida.data.id !== id) throw new ErrorDeUsuario(`${ruta}: el id «${leida.data.id}» no coincide con su carpeta «${id}».`);
        recetas.set(id, leida.data);
      }
    }
    this.cache = recetas;
    return recetas;
  }
}
