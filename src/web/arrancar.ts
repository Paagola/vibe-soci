/**
 * Entrada del estudio: npm run estudio → http://127.0.0.1:4321
 * Solo escucha en la máquina local.
 */
import { join } from 'node:path';
import { RAIZ, leerConfig } from '../config.js';
import { ErrorDeUsuario } from '../dominio/errores.js';
import { crearEstudio } from './estudio.js';
import { crearApp } from './servidor.js';

const HOST = '127.0.0.1';

function principal(): void {
  const config = leerConfig();
  const puerto = Number(process.env.ESTUDIO_PUERTO ?? 4321);
  const simulado = process.env.ESTUDIO_SIMULAR === '1';

  const estudio = crearEstudio(config, { simuladoAlArrancar: simulado, carpetaPlantillas: join(RAIZ, 'plantillas') });
  crearApp(estudio).listen(puerto, HOST, () => {
    console.log(`Estudio de contenido en http://localhost:${puerto}${simulado ? '  (modo simulado: no gasta)' : ''}`);
    if (!config.geminiApiKey) console.log('  Sin GEMINI_API_KEY: usa el modo simulado o añade la clave en .env.');
    if (!config.hfKey) console.log('  Sin HF_KEY: genera a mano con plan.md e importa, o usa el modo simulado.');
  });
}

try {
  principal();
} catch (error) {
  if (error instanceof ErrorDeUsuario) {
    console.error(`✖ ${error.message}`);
    error.detalles.forEach((detalle) => console.error(`  · ${detalle}`));
    process.exitCode = 1;
  } else {
    throw error;
  }
}
