/**
 * Comprobación de salida de una foto nueva (diseno/f1_6/ESTADO.md §9): checklist de elementos, toma lado a lado y anatomía
 * por teselas, con Gemini (visión). Decide el dominio (decidirSalida). Guarda el resultado en el activo generado
 * (revisionAutomatica); el veredicto humano (fidelidad) no se toca.
 *
 * Uso:
 *   npm run comprobar-foto -- --local L --generado ID --real ID (--propuesta foto/x.final.json | --lista "…")
 *        [--pieza "prawns=2" …] [--sin-toma] [--sin-anatomia] [--sin-guardar]
 * Con --propuesta, la lista sale de huecos.elementos + huecos.recuento, y las piezas de descripcion.elementos con recuento.
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { RevisorVisualGemini } from '../adaptadores/gemini/RevisorVisualGemini.js';
import { comprobarFotoNueva } from '../aplicacion/fotos/comprobarFotoNueva.js';
import { listaYPiezas } from '../aplicacion/fotos/listaDePropuesta.js';
import { leerConfig } from '../config.js';
import { ErrorDeUsuario } from '../dominio/errores.js';

const { values } = parseArgs({
  options: {
    local: { type: 'string' },
    generado: { type: 'string' },
    real: { type: 'string' },
    propuesta: { type: 'string' },
    lista: { type: 'string' },
    pieza: { type: 'string', multiple: true, default: [] },
    'sin-toma': { type: 'boolean', default: false },
    'sin-anatomia': { type: 'boolean', default: false },
    'sin-guardar': { type: 'boolean', default: false },
  },
});

async function principal(): Promise<void> {
  const config = leerConfig();
  if (!config.geminiApiKey) throw new ErrorDeUsuario('Falta GEMINI_API_KEY en .env');
  const pedir = (v: string | undefined, n: string) => {
    if (!v) throw new ErrorDeUsuario(`Falta --${n}`);
    return v;
  };
  const { lista, piezas } = await listaYPiezas({ ...(values.propuesta ? { propuesta: values.propuesta } : {}), ...(values.lista ? { lista: values.lista } : {}), pieza: values.pieza });
  const modelos = [config.geminiModelo, ...(config.geminiModeloRespaldo ? [config.geminiModeloRespaldo] : [])];
  const cliente = new ClienteGemini(config.geminiApiKey, modelos, {
    avisar: (m) => console.error(`  aviso: ${m}`),
    alUsar: registradorDeUso(config.carpetaDatos, 'comprobacion-salida', config.geminiFacturacion),
  });
  const revision = await comprobarFotoNueva(
    { activos: new AlmacenActivosFicheros(join(config.carpetaDatos, 'locales')), revisor: new RevisorVisualGemini(cliente, modelos), ahora: () => new Date().toISOString() },
    {
      local: pedir(values.local, 'local'),
      generado: pedir(values.generado, 'generado'),
      real: pedir(values.real, 'real'),
      lista,
      piezas: values['sin-anatomia'] ? [] : piezas,
      comprobarToma: !values['sin-toma'],
      guardar: !values['sin-guardar'],
    },
  );
  const icono = { PASA: '✓', DESCARTA: '✖', REVISAR: '?' }[revision.final];
  console.log(`${icono} ${revision.final} · elementos ${revision.elementos} · toma ${revision.toma}`);
  for (const m of revision.motivos) console.log(`  · ${m}`);
  if (!values['sin-guardar']) console.log(`  Guardado en el activo ${values.generado} (revisionAutomatica). Tu veredicto (fidelidad) no cambia.`);
}

principal().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof ErrorDeUsuario && error.detalles.length) for (const d of error.detalles) console.error(`  · ${d}`);
  process.exitCode = 1;
});
