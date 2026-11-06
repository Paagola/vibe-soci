/**
 * El documento resuelto: la intención pasada a píxeles por el resolutor.
 * Es reproducible (misma intención y mismos activos → mismo documento) y es lo que pinta el renderizador.
 */
import type { Fusion, Retoque } from './intencion.js';
import type { Lienzo, Rect } from './reticula.js';

export interface EstiloResuelto {
  fuente: string;
  ejes: Record<string, number>;
  caso: 'mayusculas' | 'tal-cual';
  tracking: number;
  color: string;
}

export interface LineaResuelta {
  texto: string;
  /** Posición del origen de la línea y de su línea base, en el sistema del bloque (antes de girar). */
  x: number;
  base: number;
  /** Cuerpo de esta línea en px (en «ancho-por-linea» cada línea tiene el suyo). */
  tamano: number;
  /** Ancho visual (de borde de glifo a borde de glifo). */
  ancho: number;
}

interface BaseResuelta {
  id: string;
  z: number;
  opacidad: number;
  fusion: Fusion;
}

export type CapaResuelta = BaseResuelta &
  (
    | { tipo: 'relleno'; color: string }
    | { tipo: 'degradado'; forma: 'lineal' | 'radial'; rect: Rect; angulo: number; paradas: Array<{ en: number; color: string; opacidad: number }> }
    | { tipo: 'imagen'; activo: string; origen: Rect; destino: Rect; marco: Rect; retoque?: Retoque }
    | { tipo: 'recorte'; activo: string; origen: Rect; destino: Rect; sujeto: Rect; retoque?: Retoque; bordeSuave: number; contraerBorde: number }
    | {
        tipo: 'sombra';
        de: string;
        modo: 'proyectada' | 'contacto';
        color: string;
        desenfoque: number;
        desplazamiento: { x: number; y: number };
        /** Proyectada: dónde va el sujeto. Contacto: la elipse. */
        rect: Rect;
        activo: string;
        origen: Rect;
      }
    | {
        tipo: 'texto';
        texto: string;
        estilo: EstiloResuelto;
        tamano: number;
        lineas: LineaResuelta[];
        /** Caja visual del texto ya colocado (y girado), en el lienzo. */
        caja: Rect;
        /** Del sistema del bloque al lienzo: matrix(a, b, c, d, e, f) de SVG. Recoge el giro y el desplazamiento. */
        matriz: [number, number, number, number, number, number];
        rotacion: 0 | 90 | -90;
        contorno?: number;
        sangrado: boolean;
      }
    | { tipo: 'forma'; figura: 'rect' | 'elipse' | 'linea'; rect?: Rect; desde?: { x: number; y: number }; hasta?: { x: number; y: number }; color: string; grosor?: number; discontinua?: [number, number] }
    | { tipo: 'circulo-texto'; texto: string; estilo: EstiloResuelto; centro: { x: number; y: number }; radio: number; tamano: number; fondo?: string; giro: number }
    | {
        tipo: 'niveles';
        estilo: EstiloResuelto;
        tamano: number;
        color: string;
        grosor: number;
        discontinua?: [number, number];
        lineas: Array<{ y: number; x1: number; x2: number; izquierda?: string; derecha?: string }>;
      }
    | { tipo: 'textura'; recurso: 'grano'; intensidad: number; escala: number; semilla: number }
  );

/** Nombre del PNG de una capa dentro de la carpeta de la versión (capas/03-titular.png). */
export function nombreDeCapa(capa: { z: number; id: string }): string {
  return `${String(capa.z + 1).padStart(2, '0')}-${capa.id}.png`;
}

export interface Problema {
  gravedad: 'AVISO' | 'ERROR';
  capa?: string;
  tipo: 'ZONA_SEGURA' | 'SOLAPE' | 'COBERTURA' | 'RESOLUCION' | 'CONTRASTE' | 'TAMANO_MINIMO' | 'FIDELIDAD' | 'ACTIVO';
  mensaje: string;
}

export interface Resuelto {
  esquema: 'diseno/resuelto@1';
  intencion: { id: string; version: number };
  lienzo: Lienzo;
  zonaSegura: Rect;
  capas: CapaResuelta[];
  /** Medidas que comprueban las relaciones: cobertura, solape, ampliación de la foto y contraste. */
  medidas: {
    cobertura: Record<string, number>;
    solape: Record<string, number>;
    ampliacion: Record<string, number>;
    contraste: Record<string, number>;
  };
  problemas: Problema[];
  activos: Record<string, { id: string; sha256: string; uso: string; tipo: string; alteraciones: string[] }>;
}
