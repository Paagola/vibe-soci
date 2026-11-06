import type { GeneradorImagen, ImagenGenerada, PeticionImagen, TrabajoEnviado } from '../../puertos/GeneradorImagen.js';
import type { ProcesadorImagen } from '../../puertos/ProcesadorImagen.js';

/** Generador falso: devuelve un marcador con el principio del prompt. No gasta créditos. */
export class GeneradorSimulado implements GeneradorImagen {
  readonly origen = 'SIMULADO' as const;
  readonly modelo = 'simulado';
  private readonly peticiones = new Map<string, PeticionImagen>();

  constructor(private readonly procesador: ProcesadorImagen) {}

  async enviar(peticion: PeticionImagen): Promise<TrabajoEnviado> {
    const requestId = `simulado-${peticion.claveIdempotencia}`;
    this.peticiones.set(requestId, peticion);
    return { requestId, urlEstado: '' };
  }

  async esperarResultado(trabajo: TrabajoEnviado): Promise<ImagenGenerada> {
    const peticion = this.peticiones.get(trabajo.requestId);
    const texto = peticion ? `${trabajo.requestId} · ${peticion.prompt.slice(0, 300)}` : trabajo.requestId;
    return { bytes: await this.procesador.crearMarcador(texto, peticion?.formato ?? 'POST'), extension: 'png' };
  }
}
