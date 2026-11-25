import { pedir } from './api';

export interface SolicitudCampana {
  objetivo: string;
  inicio: string;
  semanas: number;
  hecho: string;
  renovar: boolean;
  anticipar: boolean;
}

export interface PiezaCampana {
  fecha: string;
  formato: string;
  laminas: number;
  proposito: string;
  audiencia: string;
  enfoque: string;
  motivoFormato?: string;
  imagenesDirector?: string[];
  texto: string;
  llamada: string;
  metrica: string;
  evidencia: string;
  guion: string[];
  conversacion?: string;
  estadoProduccion?: string;
  avisoProduccion?: string;
  entrega?: string;
  resultado?: { valor: number; nota: string; primerosSieteDias?: boolean };
}

export interface Campana {
  id: string;
  local: string;
  solicitud: Pick<SolicitudCampana, 'objetivo' | 'inicio' | 'semanas'>;
  nombre: string;
  estrategia: string;
  fundamento?: string;
  referenciaSemanal?: { formato: string; llamada: string; metrica: string; muestras: number; mediana: number };
  piezas: PiezaCampana[];
}

export interface AgendaLocal {
  campanas: Campana[];
  renovacion: { proxima: string; objetivo: string; error?: string } | null;
}

type LocalAgencia = { slug: string; nombre: string };
const ruta = (local: string) => '/api/agencia/' + encodeURIComponent(local);
const pieza = (local: string, id: string, indice: number) => ruta(local) + '/' + encodeURIComponent(id) + '/piezas/' + indice;
const modo = (simulado: boolean) => ({ 'X-Agencia-Modo': simulado ? 'simulado' : 'real' });

export const agencia = {
  locales: () => pedir<{ locales: LocalAgencia[]; simulado: boolean }>('/api/agencia/locales'),
  leer: (local: string) => pedir<AgendaLocal>(ruta(local)),
  crear: (local: string, simulado: boolean, solicitud: SolicitudCampana, clave: string) =>
    pedir<{ campana: Campana }>(ruta(local), { method: 'POST', headers: modo(simulado), body: JSON.stringify({ ...solicitud, clave }) }),
  abrir: (local: string, simulado: boolean, id: string, indice: number) =>
    pedir<{ conversacion: string }>(pieza(local, id, indice) + '/abrir', { method: 'POST', headers: modo(simulado), body: '{}' }),
  resultado: (local: string, simulado: boolean, id: string, indice: number, valor: number, nota: string, primerosSieteDias: boolean) =>
    pedir<{ campana: Campana }>(pieza(local, id, indice) + '/resultado', { method: 'PUT', headers: modo(simulado), body: JSON.stringify({ valor, nota, primerosSieteDias }) }),
  detener: (local: string, simulado: boolean) => pedir(ruta(local) + '/renovacion', { method: 'DELETE', headers: modo(simulado) }),
};
