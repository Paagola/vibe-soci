import { stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { z } from 'zod';
import { ErrorDeUsuario } from '../dominio/errores.js';
import { Condiciones, Formato, PapelFoto, Pieza, TipoPieza } from '../dominio/modelos.js';
import { RANGO_DIAPOSITIVAS, idDePieza, problemaDeFoto, problemasDelBrief } from '../dominio/reglas.js';
import { validar } from '../dominio/validacion.js';
import type { AlmacenPiezas } from '../puertos/Almacenes.js';
import type { Dependencias } from './dependencias.js';

/** Lo que llega del asistente o de un brief.json. Las rutas de las fotos son las originales del usuario. */
export const BriefNuevaPieza = z.object({
  localSlug: z.string().min(1),
  formato: Formato,
  numDiapositivas: z.number().int().min(1).max(5).optional(),
  idea: z.string().trim().min(10).max(300),
  tipo: TipoPieza,
  condiciones: Condiciones.default({}),
  fotos: z
    .array(z.object({ ruta: z.string().min(1), papel: PapelFoto, nota: z.string().trim().max(160).optional() }))
    .min(1),
  referenciaEstilo: z.object({ ruta: z.string().min(1), nota: z.string().trim().max(160).optional() }).optional(),
});
export type BriefNuevaPieza = z.infer<typeof BriefNuevaPieza>;

const RUTA_REFERENCIA = 'referencia/estilo';

export async function crearPieza(deps: Pick<Dependencias, 'piezas' | 'locales' | 'reloj'>, entrada: unknown): Promise<Pieza> {
  const brief = validar(BriefNuevaPieza, entrada, 'El brief de la pieza no es válido.');

  if (!(await deps.locales.existe(brief.localSlug))) {
    throw new ErrorDeUsuario(`No existe el local «${brief.localSlug}». Créalo antes con nuevo-local.`);
  }

  const fotos = brief.fotos.map((foto, indice) => ({
    origen: foto.ruta,
    archivo: `fotos/${String(indice + 1).padStart(2, '0')}-${foto.papel.toLowerCase()}${extname(foto.ruta).toLowerCase()}`,
    papel: foto.papel,
    nota: foto.nota,
  }));
  const referencia = brief.referenciaEstilo && {
    origen: brief.referenciaEstilo.ruta,
    archivo: `${RUTA_REFERENCIA}${extname(brief.referenciaEstilo.ruta).toLowerCase()}`,
    nota: brief.referenciaEstilo.nota,
  };

  const numDiapositivas = brief.numDiapositivas ?? RANGO_DIAPOSITIVAS[brief.formato].min;
  const problemas = [
    ...(await problemasDeArchivos([...fotos.map((foto) => foto.origen), ...(referencia ? [referencia.origen] : [])])),
    ...problemasDelBrief({ ...brief, numDiapositivas, fotos }),
  ];
  if (problemas.length > 0) throw new ErrorDeUsuario('No se puede crear la pieza.', problemas);

  const ahora = deps.reloj();
  const pieza = Pieza.parse({
    id: await idLibre(deps.piezas, idDePieza(ahora, brief.idea)),
    localSlug: brief.localSlug,
    creadaEn: ahora.toISOString(),
    formato: brief.formato,
    numDiapositivas,
    idea: brief.idea,
    tipo: brief.tipo,
    condiciones: brief.condiciones,
    fotos: fotos.map(({ archivo, papel, nota }) => ({ archivo, papel, nota })),
    referenciaEstilo: referencia && { archivo: referencia.archivo, nota: referencia.nota },
  });

  for (const archivo of [...fotos, ...(referencia ? [referencia] : [])]) {
    await deps.piezas.copiarArchivo(pieza.id, archivo.origen, archivo.archivo);
  }
  await deps.piezas.guardar(pieza);
  return pieza;
}

async function problemasDeArchivos(rutas: string[]): Promise<string[]> {
  const problemas = await Promise.all(
    rutas.map(async (ruta) => {
      const bytes = await stat(ruta).then((info) => (info.isFile() ? info.size : undefined), () => undefined);
      return problemaDeFoto(bytes === undefined ? ruta : basename(ruta), bytes);
    }),
  );
  return problemas.filter((problema): problema is string => problema !== undefined);
}

async function idLibre(piezas: AlmacenPiezas, base: string): Promise<string> {
  let id = base;
  for (let n = 2; await piezas.existe(id); n++) id = `${base}-${n}`;
  return id;
}
