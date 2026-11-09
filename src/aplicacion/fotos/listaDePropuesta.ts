import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ErrorDeUsuario } from '../../dominio/errores.js';

const Propuesta = z.object({
  huecos: z.object({ elementos: z.string(), recuento: z.string() }),
  descripcion: z.object({ elementos: z.array(z.object({ nombre: z.string(), recuento: z.number().nullable() })) }).optional(),
});

/** Lista confirmada y piezas que se cuentan, desde la propuesta de foto nueva (x.final.json) o desde las opciones. */
export async function listaYPiezas(opciones: { propuesta?: string; lista?: string; pieza: string[] }) {
  let lista = opciones.lista;
  let piezas: Array<{ nombre: string; esperado: number }> = [];
  if (opciones.propuesta) {
    const p = Propuesta.parse(JSON.parse(await readFile(resolve(opciones.propuesta), 'utf8')));
    lista = `${p.huecos.elementos.replace(/[.\s]+$/, '')}. ${p.huecos.recuento}`;
    piezas = (p.descripcion?.elementos ?? []).filter((e) => e.recuento !== null && e.recuento > 0).map((e) => ({ nombre: e.nombre, esperado: e.recuento as number }));
  }
  if (opciones.pieza.length) {
    piezas = opciones.pieza.map((t) => {
      const [nombre, n] = t.split('=');
      const esperado = Number(n);
      if (!nombre || !Number.isInteger(esperado) || esperado < 1) throw new ErrorDeUsuario(`--pieza tiene que ser «nombre=N»: «${t}»`);
      return { nombre: nombre.trim(), esperado };
    });
  }
  if (!lista) throw new ErrorDeUsuario('Falta la lista de elementos: --propuesta <x.final.json> o --lista "…"');
  return { lista, piezas };
}

