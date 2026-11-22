/**
 * El documento resuelto: la intención pasada a píxeles por el resolutor.
 * Es reproducible (misma intención y mismos activos → mismo documento) y es lo que pinta el renderizador.
 */
import type { Receta } from '../tipografia/receta.js';
import type { CapaDe, FormaTexto, Fusion, Retoque } from './intencion.js';
import type { MedidasDeOficio } from './oficio.js';
import type { Lienzo, Rect } from './reticula.js';

export interface EstiloResuelto {
  fuente: string;
  ejes: Record<string, number>;
  caso: 'mayusculas' | 'tal-cual';
  tracking: number;
  color: string;
  /** Rasgos OpenType activados (solo si hay alguno). */
  rasgos?: string[];
  /**
   * Edición fina de la letra de una capa de texto (escala, inclinación, espaciado por línea, ajustes por letra), solo
   * si cambia algo. Viaja con el estilo para que todo lo que mide o pinta el texto (MotorTexto) use la misma geometría.
   */
  forma?: FormaTexto;
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
  /** Dónde acaba la tinta de la última letra, en el sistema del bloque (para colocar algo «tras el texto»). */
  fin?: number;
}

/** Tinta impresa ya resuelta: con su semilla y el color del registro en HEX. */
/** Una tipografía especial resuelta: la receta entera (para que el documento se pueda volver a pintar sin la
 * biblioteca), los valores comprobados de sus parámetros (colores en hex) y la semilla fijada. */
export interface TratamientoResuelto {
  receta: Receta;
  valores: Record<string, number | boolean | string>;
  semilla: number;
}

export interface TintaResuelta {
  densidad: number;
  bordeSeco: number;
  registro?: { dx: number; dy: number; color: string; opacidad: number };
  semilla: number;
}

/** Corte tipográfico en el sistema del bloque: por dónde pasa la línea y cuánto se mueve cada mitad. */
export interface CorteResuelto {
  punto: { x: number; y: number };
  angulo: number;
  desplazamiento: number;
  separacion: number;
}

/** El sujeto con el que se recorta una capa (texto, forma o patrón): lo necesario para pintar su máscara en el lienzo. */
export interface RecorteDeTexto {
  activo: string;
  origen: Rect;
  destino: Rect;
  giro: number;
  modo: 'dentro' | 'fuera';
}

export interface LineaDeSello {
  texto: string;
  estilo: EstiloResuelto;
  tamano: number;
  /** Línea base respecto al centro del sello (px, positivo hacia abajo), antes de girar. */
  base: number;
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
    | { tipo: 'imagen'; activo: string; origen: Rect; destino: Rect; marco: Rect; retoque?: Retoque; ventana?: CapaDe<'imagen'>['ventana'] }
    | {
        tipo: 'recorte';
        activo: string;
        origen: Rect;
        /** Dónde va el sujeto sin girar; el giro es alrededor de su centro. */
        destino: Rect;
        sujeto: Rect;
        retoque?: Retoque;
        bordeSuave: number;
        contraerBorde: number;
        giro?: number;
        /** Filo de pegatina alrededor de la silueta. */
        filo?: { color: string; grosor: number };
      }
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
        /** Proyectada: el giro del sujeto, para que la sombra gire con él. */
        giro?: number;
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
        /** Giro libre (grados), ya incluido en la matriz. */
        giro?: number;
        corte?: CorteResuelto;
        tinta?: TintaResuelta;
        tratamiento?: TratamientoResuelto;
        recorte?: RecorteDeTexto;
      }
    | {
        tipo: 'forma';
        figura: CapaDe<'forma'>['figura'];
        rect?: Rect;
        desde?: { x: number; y: number };
        hasta?: { x: number; y: number };
        puntos?: Array<{ x: number; y: number }>;
        color: string;
        grosor?: number;
        discontinua?: [number, number];
        radio?: number;
        giro?: number;
        /** mancha */
        lobulos?: number;
        irregularidad?: number;
        semilla?: number;
        tinta?: TintaResuelta;
        recorte?: RecorteDeTexto;
      }
    | { tipo: 'circulo-texto'; texto: string; estilo: EstiloResuelto; centro: { x: number; y: number }; radio: number; tamano: number; fondo?: string; giro: number; arco?: number }
    | {
        tipo: 'niveles';
        estilo: EstiloResuelto;
        tamano: number;
        color: string;
        grosor: number;
        discontinua?: [number, number];
        lineas: Array<{ y: number; x1: number; x2: number; izquierda?: string; derecha?: string }>;
      }
    | { tipo: 'textura'; recurso: 'grano' | 'papel'; intensidad: number; escala: number; semilla: number }
    | {
        tipo: 'sello';
        forma: 'circulo' | 'estrella' | 'festoneado' | 'ovalo' | 'pastilla';
        centro: { x: number; y: number };
        /** Medio ancho y medio alto de la forma, en px. */
        radioX: number;
        radioY: number;
        puntas: number;
        profundidad: number;
        fondo: string;
        color: string;
        filete: number;
        anillo?: { texto: string; estilo: EstiloResuelto; tamano: number; radio: number };
        lineas: LineaDeSello[];
        giro: number;
        sombra?: { dx: number; dy: number; color: string };
        /** Caja que ocupa ya girado (para las comprobaciones). */
        caja: Rect;
        tinta?: TintaResuelta;
      }
    | {
        tipo: 'patron';
        motivo: 'palabra' | 'puntos' | 'cuadros' | 'rayas' | 'olas';
        rect: Rect;
        color: string;
        giro: number;
        /** palabra */
        texto?: string;
        estilo?: EstiloResuelto;
        tamano?: number;
        filas?: number;
        /** Distancia entre líneas base, en px. */
        avanceFila?: number;
        desfase?: number;
        separacion?: number;
        contornoAlterno?: number;
        /** puntos, cuadros y rayas */
        paso?: number;
        radios?: [number, number];
        desvanece?: 'no' | 'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'centro';
        angulo?: number;
        tinta?: TintaResuelta;
        recorte?: RecorteDeTexto;
      }
    | {
        tipo: 'trazo';
        gesto: 'subrayado' | 'circulo' | 'flecha' | 'tachado';
        /** Subrayado y tachado: los extremos. Círculo: la caja que rodea. Flecha: cola y punta. Todo en px del lienzo. */
        desde: { x: number; y: number };
        hasta: { x: number; y: number };
        rect?: Rect;
        curva: number;
        cabeza: 'abierta' | 'ninguna';
        color: string;
        grosor: number;
        temblor: number;
        huecos: number;
        semilla: number;
      }
  );

/** Nombre del PNG de una capa dentro de la carpeta de la versión (capas/03-titular.png). */
export function nombreDeCapa(capa: { z: number; id: string }): string {
  return `${String(capa.z + 1).padStart(2, '0')}-${capa.id}.png`;
}

export interface Problema {
  gravedad: 'AVISO' | 'ERROR';
  capa?: string;
  /**
   * Los seis últimos son avisos de oficio (F3): no rompen nada, pero señalan lo que delata una pieza de plantilla.
   * JERARQUIA: no hay salto de escala. DENSIDAD: demasiadas palabras o niveles. VOCES: demasiadas tipografías.
   * GESTOS: más de un gesto a mano. CRUCE: el titular no toca al producto. TINTA: tinta impresa en un texto pequeño.
   * LETRA_PERDIDA: una letra se sale del lienzo y deja de leerse. LETRA_TAPADA: el sujeto tapa casi toda una letra.
   * MARCADOR: queda un hueco de plantilla sin rellenar («[NOMBRE]»). TRATAMIENTO: tipografía especial mal usada.
   */
  tipo:
    | 'ZONA_SEGURA'
    | 'SOLAPE'
    | 'COBERTURA'
    | 'RESOLUCION'
    | 'CONTRASTE'
    | 'TAMANO_MINIMO'
    | 'SEPARACION'
    | 'FIDELIDAD'
    | 'ACTIVO'
    | 'JERARQUIA'
    | 'DENSIDAD'
    | 'VOCES'
    | 'GESTOS'
    | 'CRUCE'
    | 'TINTA'
    | 'LETRA_PERDIDA'
    | 'LETRA_TAPADA'
    | 'MARCADOR'
    | 'TRATAMIENTO';
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
    /** Medidas de oficio (F3): salto de escala, palabras, voces, gestos y aire. */
    oficio?: MedidasDeOficio;
  };
  problemas: Problema[];
  activos: Record<string, { id: string; sha256: string; uso: string; tipo: string; alteraciones: string[] }>;
}
