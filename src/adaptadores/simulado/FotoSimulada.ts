/**
 * Director, generador, revisor y segmentador SIMULADOS para la orden única (`npm run post -- … --simular`) y las pruebas.
 * No gastan ni llaman a nada. La «foto nueva» simulada es una lámina sintética con un sello SIMULADA: nunca se
 * confunde con una foto de verdad.
 */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import type { ChecklistVisual, ComparacionToma, ConteoAnatomia } from '../../dominio/comprobacionSalida.js';
import type { PropuestaFotoNueva } from '../../dominio/fotoNueva.js';
import type { DirectorDeFoto, EncargoDeFoto, FotoGenerada, GeneradorFoto, PeticionFoto, Segmentador } from '../../puertos/Foto.js';
import type { ParDeFotos, RevisorVisual } from '../../puertos/RevisorVisual.js';

export class DirectorFotoSimulado implements DirectorDeFoto {
  readonly nombre = 'director simulado';

  /** F3.3: con `tomas`, en un carrusel propone esa cantidad de tomas de detalle (una por pieza simulada). */
  constructor(private readonly opciones: { tomas?: number } = {}) {}

  async proponer(e: EncargoDeFoto): Promise<PropuestaFotoNueva> {
    const n = e.formato === 'carrusel' ? (this.opciones.tomas ?? 0) : 0;
    const piezas = Array.from({ length: n }, (_, i) => ({ nombre: `pieza simulada ${i + 1}`, estado: `cortada en dos, simulada ${i + 1}`, recuento: 1, ...(e.alGenerador?.desdeElInventario ? { ingles: `simulated piece ${i + 1}, cut in half`, enEncuadre: true } : {}) }));
    const base = this.base(e);
    if (!n) return base;
    return {
      ...base,
      descripcion: { ...base.descripcion, elementos: [...base.descripcion.elementos, ...piezas] },
      tomas: piezas.map((p) => ({
        elemento: p.nombre,
        huecos: { ...base.huecos, plato: p.nombre, elementos: `only the ${p.nombre}, ${p.estado}`, recuento: 'Exactly one piece.', camara: { anguloGrados: 20, distancia: 'MACRO', descripcion: 'a low macro close-up, 20 degrees', objetivoMm: 100, apertura: 4 }, ideaGrafica: 'the piece large, clean empty space above for a title', aire: 'arriba' },
      })),
    };
  }

  private base(e: EncargoDeFoto): PropuestaFotoNueva {
    return {
      descripcion: {
        anguloGrados: 45,
        distancia: 'MEDIO',
        encuadre: 'plano medio en ¾ (simulado)',
        luz: 'luz de día plana (simulado)',
        elementos: [{ nombre: 'plato', estado: e.plato, recuento: 1, ...(e.alGenerador?.desdeElInventario ? { ingles: `the dish described as «${e.plato}», on its own plate`, enEncuadre: true } : {}) }],
        defectos: ['simulado: resolución sin comprobar'],
        utilizable: true,
        motivo: 'simulado',
      },
      huecos: {
        plato: `the dish described as «${e.plato}»`,
        origen: 'from a restaurant',
        elementos: `the same real dish described as «${e.plato}», on its own plate`,
        recuento: 'Exactly one plate.',
        camara: { anguloGrados: 90, distancia: 'MEDIO', descripcion: 'a straight top-down view from directly above, 90 degrees', objetivoMm: 50, apertura: 8 },
        ideaGrafica: 'the plate centred in the lower part of the frame, the upper third empty and dark for a headline',
        luz: 'Low-key, one hard light from the upper right on a dark wooden table',
        colorDominante: 'the colours of the dish the only strong colours',
      },
      decisiones: ['Simulado: cenital, otra toma por altura.'],
    };
  }
}

export class GeneradorFotoSimulado implements GeneradorFoto {
  readonly nombre = 'generador simulado';
  readonly peticiones: PeticionFoto[] = [];

  disponible(): { ok: true } {
    return { ok: true };
  }

  async estimarUsd(): Promise<number> {
    return 0;
  }

  async generar(p: PeticionFoto): Promise<FotoGenerada> {
    this.peticiones.push(p);
    const ruta = p.referencias[0]?.ruta;
    if (!ruta) throw new Error('El generador simulado necesita la foto real como @image1.');
    const w = 1536, h = p.aspectRatio === '1:1' ? w : p.aspectRatio === '4:5' ? 1920 : 2048;
    const variacion = createHash('sha256').update(p.id).digest();
    const cx = Math.round(w * (0.42 + variacion[0]! / 1600));
    const cy = Math.round(h * (0.5 + variacion[1]! / 1800));
    const color = `rgb(${150 + variacion[2]! % 80}, ${80 + variacion[3]! % 80}, 68)`;
    const escena = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="mesa" x2="0.8" y2="1"><stop stop-color="#807064"/><stop offset="1" stop-color="#49382f"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#mesa)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${w * .34}" ry="${h * .20}" fill="#e9dfd3"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${w * .23}" ry="${h * .15}" fill="${color}"/>
      <text x="70" y="122" font-family="Helvetica" font-weight="bold" font-size="72" fill="white">SIMULADA</text></svg>`;
    const bytes = await sharp(Buffer.from(escena)).png().toBuffer();
    return { bytes, modelo: 'simulado', costeUsd: 0, tier: 'SIMULADO', detalle: 'Lámina sintética para probar el diseño.' };
  }
}

/** Contesta lo que se le diga (cola de respuestas); por defecto, todo bien y otra toma. */
export class RevisorVisualSimulado implements RevisorVisual {
  readonly nombre = 'revisor simulado';

  constructor(private readonly cola: Array<{ checklist?: Partial<ChecklistVisual>; toma?: Partial<ComparacionToma>; colasDeMas?: number }> = []) {}

  private siguiente = { checklist: {}, toma: {}, colasDeMas: 0 } as { checklist?: Partial<ChecklistVisual>; toma?: Partial<ComparacionToma>; colasDeMas?: number };

  async comprobarElementos(_f: ParDeFotos, lista: string): Promise<ChecklistVisual> {
    this.siguiente = this.cola.shift() ?? {};
    return { elementos: [{ nombre: lista.slice(0, 40), esperado: null, visto: null, presente: true, nota: 'simulado' }], anatomia: [], anadidos: [], textoNuevo: [], cambiados: [], copiadoDeReferencia: [], seguro: true, ...this.siguiente.checklist } as ChecklistVisual;
  }

  async compararToma(): Promise<ComparacionToma> {
    return { alturaReal: '¾', alturaNueva: 'cenital', mismoLado: false, mismaDistancia: true, mismoPuntoDeVista: false, mismaDistribucion: false, explicacion: 'simulado', ...this.siguiente.toma };
  }

  async contarAnatomia(_g: string, piezas: Array<{ nombre: string; esperado: number }>): Promise<ConteoAnatomia> {
    const extra = this.siguiente.colasDeMas ?? 0;
    return { piezas: piezas.map((p) => ({ ...p, cabezas: null, colas: null, cuerpos: p.esperado + extra, nota: 'simulado' })), seguro: true };
  }
}

/** Una elipse blanca en el centro: basta para probar el recorte. */
export class SegmentadorSimulado implements Segmentador {
  readonly metodo = 'UMBRAL' as const;

  async mascara(ruta: string): Promise<Buffer> {
    const { width = 100, height = 100 } = await sharp(ruta).metadata();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000"/><ellipse cx="${width / 2}" cy="${height * 0.6}" rx="${width * 0.35}" ry="${height * 0.25}" fill="#fff"/></svg>`;
    return sharp(Buffer.from(svg)).extractChannel(0).png().toBuffer();
  }
}
