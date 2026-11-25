/**
 * Entrada del estudio: npm run estudio → http://127.0.0.1:4321
 * Solo escucha en la máquina local.
 */
import { join } from 'node:path';
import { RAIZ, leerConfig } from '../config.js';
import { ErrorDeUsuario } from '../dominio/errores.js';
import { crearEstudio } from './estudio.js';
import { crearServicioChat } from './chat.js';
import { crearAgenciaWeb, arrancarRenovaciones } from './agencia.js';
import { crearApp } from './servidor.js';

const HOST = '127.0.0.1';

async function principal(): Promise<void> {
  const config = leerConfig();
  const puerto = Number(process.env.ESTUDIO_PUERTO ?? 4321);
  const simulado = process.env.ESTUDIO_SIMULAR === '1';

  const estudio = crearEstudio(config, { simuladoAlArrancar: simulado, carpetaPlantillas: join(RAIZ, 'plantillas') });
  const { chat, herramientas } = await crearServicioChat(config, estudio);
  const agencia = crearAgenciaWeb(estudio, chat);
  const servidor = crearApp(estudio, chat, herramientas, agencia).listen(puerto, HOST, () => {
    servidor.once('close', arrancarRenovaciones(agencia));
    console.log(`Estudio de contenido en http://localhost:${puerto}${simulado ? '  (modo simulado: no gasta)' : ''}`);
    if (!config.geminiApiKey) console.log('  Sin GEMINI_API_KEY: usa el modo simulado o añade la clave en .env.');
    if (!config.hfKey) console.log('  Sin HF_KEY: genera a mano con plan.md e importa, o usa el modo simulado.');
  });
}

principal().catch((error: unknown) => {
  if (error instanceof ErrorDeUsuario) {
    console.error(`✖ ${error.message}`);
    error.detalles.forEach((detalle) => console.error(`  · ${detalle}`));
    process.exitCode = 1;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
});
