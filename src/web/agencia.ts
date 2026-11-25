import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AlmacenLocalesFicheros } from '../adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { LocalesSuperpuestos } from '../adaptadores/ficheros/Superpuestos.js';
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { agentesGemini, agentesSimulados } from '../aplicacion/agencia/agentes.js';
import { Agencia } from '../aplicacion/agencia/servicio.js';
import type { ServicioChat } from '../aplicacion/chat/servicioChat.js';
import { RAIZ } from '../config.js';
import { ErrorDeUsuario } from '../dominio/errores.js';
import { PerfilDeMarca } from '../dominio/marca/perfil.js';
import type { Estudio } from './estudio.js';

export function crearAgenciaWeb(estudio: Estudio, chat?: ServicioChat) {
  const config = estudio.config;
  const reales = new AlmacenLocalesFicheros(join(config.carpetaDatos, 'locales'));
  const simulados = new LocalesSuperpuestos(new AlmacenLocalesFicheros(join(config.carpetaDatosSimulado, 'locales')), reales);
  const crear = (simulado: boolean) => new Agencia({
    carpeta: join(simulado ? config.carpetaDatosSimulado : config.carpetaDatos, 'agencia'),
    marca: local => (simulado ? simulados : reales).obtener(local),
    agentes: local => {
      if (simulado) return agentesSimulados();
      if (!config.geminiApiKey) throw new ErrorDeUsuario('Configura GEMINI_API_KEY para preparar una campaña real o abre el estudio en modo simulado.');
      const cliente = (rol: string, modelo: string) => new ClienteGemini(config.geminiApiKey!, [modelo], {
        alUsar: registradorDeUso(config.carpetaDatos, 'agencia/' + rol, config.geminiFacturacion, local),
        tiempoMaximoMs: 180_000,
      });
      return agentesGemini(cliente('estrategia', config.geminiModeloEstrategia ?? 'gemini-4-argon'),
        cliente('redaccion', config.geminiModeloRedaccion ?? 'gemini-4-hydrogen'));
    },
    productor: simulado ? undefined : chat,
    archivoChat: !simulado && chat ? (id, ruta) => chat.rutaArchivo(id, ruta) : undefined,
    perfil: async local => {
      try {
        const perfil = PerfilDeMarca.parse(JSON.parse(await readFile(join(RAIZ, 'marcas', local, 'perfil.json'), 'utf8')));
        if (perfil.slug !== local) throw new ErrorDeUsuario('El perfil de marca corresponde a otro local.');
        return {
          voz: perfil.constantes.voz?.confirmado ? perfil.constantes.voz.valor.join(', ') : undefined,
          restricciones: perfil.restricciones.filter(r => r.confirmado).map(r => r.valor),
        };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { restricciones: [] };
        throw e;
      }
    },
    zonaHoraria: config.zonaHoraria, ahora: () => new Date(),
  });
  const real = crear(false);
  const simulado = crear(true);
  return {
    actual: () => estudio.simulado() ? simulado : real,
    locales: () => (estudio.simulado() ? simulados : reales).listar(),
    simulado: estudio.simulado,
  };
}
export type AgenciaWeb = ReturnType<typeof crearAgenciaWeb>;

/** Un solo recorrido activo por servidor. El modo se fija al empezar cada recorrido. */
export function arrancarRenovaciones(agencia: AgenciaWeb) {
  let activo = false;
  const avisar = (m: string) => console.warn(m);
  const comprobar = async () => {
    if (activo) return;
    activo = true;
    try {
      await agencia.actual().renovarPendientes(avisar);
    } catch (e) {
      avisar('No se han podido comprobar las renovaciones: ' + String(e));
    } finally {
      activo = false;
    }
  };
  void comprobar();
  const reloj = setInterval(() => void comprobar(), 60_000);
  reloj.unref();
  return () => clearInterval(reloj);
}
