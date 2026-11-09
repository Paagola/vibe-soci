/**
 * Compone un carrusel de un proyecto (proyectos/<slug>/plan.json) con el compositor y monta las hojas de revisión.
 * La lógica está en adaptadores/compositor/ComponedorProyectos.ts (la usa también la orden única, `npm run post`).
 *
 * Cada diapositiva se guarda como versión entera e inmutable en datos/disenos/<slug>/<id>/vNNN (la versión la
 * pone la intención). Con --borrador se compone en la carpeta temporal y se sobrescribe: sirve para afinar sin
 * llenar el historial; la versión buena se guarda después sin --borrador.
 *
 * Hojas (en <salida>/revision/<etiqueta>/): carrusel.jpg, movil.jpg y capas-<id>.jpg.
 *
 * Uso: tsx src/herramientas/carrusel.ts proyectos/<slug> [--borrador] [--etiqueta it1] [--solo 2]
 */
import { parseArgs } from 'node:util';
import { ComponedorProyectos } from '../adaptadores/compositor/ComponedorProyectos.js';
import { RAIZ, leerConfig } from '../config.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { borrador: { type: 'boolean', default: false }, etiqueta: { type: 'string' }, solo: { type: 'string' } },
});

async function principal(): Promise<void> {
  const componedor = new ComponedorProyectos(RAIZ, leerConfig().carpetaDatos);
  const pieza = await componedor.componer(positionals[0] ?? '', {
    borrador: values.borrador,
    ...(values.etiqueta ? { etiqueta: values.etiqueta } : {}),
    ...(values.solo ? { solo: values.solo } : {}),
    informar: (linea) => console.log(linea),
  });
  console.log(`\nRevisión: ${pieza.revision}`);
}

principal().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
