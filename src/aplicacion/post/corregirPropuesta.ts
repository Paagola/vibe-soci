import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { esOtraToma, montarPromptFotoNueva, problemasFotoNueva, PropuestaFotoNueva, type OpcionesDePrompt } from '../../dominio/fotoNueva.js';
import { validar } from '../../dominio/validacion.js';
import { guardarEncargo, leerEncargo, type DepsPost } from './ordenPost.js';

export interface PropuestaCorregida {
  propuesta: PropuestaFotoNueva;
  prompt: string;
  problemas: string[];
  toma: { otra: boolean; cambios: string[] };
}

/**
 * Corrige a mano la propuesta del director en la parada de elementos (la lista de elementos, la toma, la luz…).
 * Es lo que la línea de comandos pide hacer editando foto/propuesta.json. El prompt lo vuelve a montar el código y
 * se vuelven a comprobar las reglas: con problemas se puede guardar, pero no confirmar.
 * La propuesta original del director se conserva en el mismo archivo (`propuestaDelDirector`).
 */
export async function corregirPropuesta(deps: DepsPost, proyecto: string, entrada: unknown): Promise<PropuestaCorregida> {
  const e = await leerEncargo(deps, proyecto);
  if (e.paso !== 'CONFIRMAR_ELEMENTOS' || !e.activoReal) {
    throw new ErrorDeUsuario('La propuesta solo se corrige en la parada de elementos, antes de confirmarla.');
  }
  const propuesta = validar(PropuestaFotoNueva, entrada, 'La propuesta no es válida.');
  const archivo = e.propuesta?.archivo ?? 'foto/propuesta.json';
  const ruta = join(deps.proyectos, e.proyecto, archivo);
  const guardada = JSON.parse(await readFile(ruta, 'utf8')) as Record<string, unknown>;

  const real = await deps.activos.obtener(e.local, e.activoReal);
  const problemas = problemasFotoNueva(propuesta, { ancho: real.activo.ancho, alto: real.activo.alto });
  const prompt = montarPromptFotoNueva(propuesta.huecos, guardada.opcionesPrompt as OpcionesDePrompt | undefined);
  const ahora = deps.ahora();

  await writeFile(
    ruta,
    `${JSON.stringify({ ...guardada, propuestaDelDirector: guardada.propuestaDelDirector ?? guardada.propuesta, propuesta, prompt, problemas, corregidaEn: ahora }, null, 2)}\n`,
  );
  await guardarEncargo(deps, {
    ...e,
    propuesta: { archivo, prompt, problemas },
    historial: [...e.historial, { fecha: ahora, paso: e.paso, nota: `Propuesta corregida a mano${problemas.length ? `, con problemas: ${problemas.join(' | ')}` : ''}.` }],
  });
  return { propuesta, prompt, problemas, toma: esOtraToma(propuesta.descripcion, propuesta.huecos.camara) };
}
