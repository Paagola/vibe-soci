/**
 * Motor de texto: mide, ajusta y convierte el texto en trazos a partir de los archivos de fuente.
 * No depende de las fuentes instaladas en el sistema: el mismo texto sale igual en cualquier máquina.
 */
import type { Fuente } from 'fontkit';
import type { CatalogoTipografico } from './tipografias.js';

export interface EstiloMotor {
  fuente: string;
  ejes: Record<string, number>;
  caso: 'mayusculas' | 'tal-cual';
  /** em */
  tracking: number;
  /** múltiplos del cuerpo */
  interlineado: number;
}

/** Medida de una línea a un cuerpo dado, en px. Las coordenadas son relativas al origen de la línea. */
export interface Medida {
  /** Ancho visual: del borde del primer glifo al del último. */
  ancho: number;
  minX: number;
  maxX: number;
  /** Lo que sube el glifo más alto por encima de la línea base (positivo). */
  arriba: number;
  /** Lo que baja el glifo más bajo por debajo de la línea base (positivo). */
  abajo: number;
}

export interface LineaCompuesta {
  texto: string;
  x: number;
  base: number;
  tamano: number;
  medida: Medida;
}

export interface BloqueCompuesto {
  lineas: LineaCompuesta[];
  /** Cuerpo de referencia (el de la primera línea). */
  tamano: number;
  ejes: Record<string, number>;
  /** Caja visual del bloque, en el sistema de la caja de entrada. */
  visual: { x: number; y: number; w: number; h: number };
}

export type ModoAjuste = 'ancho' | 'ancho-por-linea' | 'alto' | 'eje-ancho' | 'caja' | 'fijo';

export interface PeticionBloque {
  texto: string;
  estilo: EstiloMotor;
  caja: { x: number; y: number; w: number; h: number };
  ajuste: ModoAjuste;
  tamano?: number;
  alinear: 'izquierda' | 'centro' | 'derecha';
  vertical: 'arriba' | 'centro' | 'abajo';
}

/** Palabras que no deben quedarse colgando al final de una línea. */
const NO_AL_FINAL = new Set(['a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'que', 'sin', 'su', 'u', 'un', 'una', 'y']);

interface MedidaUnidades {
  minX: number;
  maxX: number;
  arriba: number;
  abajo: number;
}

export class MotorTexto {
  private readonly medidas = new Map<string, MedidaUnidades>();

  constructor(private readonly catalogo: CatalogoTipografico) {}

  aplicarCaso(texto: string, caso: EstiloMotor['caso']): string {
    return caso === 'mayusculas' ? texto.toLocaleUpperCase('es-ES') : texto;
  }

  alturaMayusculas(estilo: Pick<EstiloMotor, 'fuente' | 'ejes'>, tamano: number): number {
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    return (fuente.capHeight * tamano) / fuente.unitsPerEm;
  }

  medir(estilo: Pick<EstiloMotor, 'fuente' | 'ejes' | 'tracking'>, texto: string, tamano: number): Medida {
    const { fuente, ejes } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const clave = `${estilo.fuente}|${JSON.stringify(ejes)}|${estilo.tracking}|${texto}`;
    let unidades = this.medidas.get(clave);
    if (!unidades) {
      unidades = medirEnUnidades(fuente, texto, estilo.tracking);
      this.medidas.set(clave, unidades);
    }
    const s = tamano / fuente.unitsPerEm;
    return { ancho: (unidades.maxX - unidades.minX) * s, minX: unidades.minX * s, maxX: unidades.maxX * s, arriba: unidades.arriba * s, abajo: unidades.abajo * s };
  }

  /** Trazo SVG de una línea con su origen en (x, base). */
  trazar(estilo: Pick<EstiloMotor, 'fuente' | 'ejes' | 'tracking'>, texto: string, tamano: number, x: number, base: number): string {
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const s = tamano / fuente.unitsPerEm;
    const linea = fuente.layout(texto);
    let pluma = 0;
    const trazos: string[] = [];
    linea.glyphs.forEach((glifo, i) => {
      const posicion = linea.positions[i]!;
      if (glifo.path.commands.length > 0) {
        trazos.push(glifo.path.scale(s, -s).translate(x + (pluma + posicion.xOffset) * s, base - posicion.yOffset * s).toSVG());
      }
      pluma += posicion.xAdvance + estilo.tracking * fuente.unitsPerEm;
    });
    return trazos.join('');
  }

  /** Texto repartido alrededor de un círculo completo, con las letras mirando hacia fuera. */
  trazarCircular(estilo: Pick<EstiloMotor, 'fuente' | 'ejes' | 'tracking'>, texto: string, tamano: number, cx: number, cy: number, radio: number, giroGrados: number): string {
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const s = tamano / fuente.unitsPerEm;
    const linea = fuente.layout(texto);
    const avances = linea.positions.map((p) => (p.xAdvance + estilo.tracking * fuente.unitsPerEm) * s);
    const total = avances.reduce((a, b) => a + b, 0);
    const escala = (2 * Math.PI * radio) / total;
    let arco = 0;
    const trazos: string[] = [];
    linea.glyphs.forEach((glifo, i) => {
      const avance = avances[i]!;
      const angulo = (giroGrados * Math.PI) / 180 + (arco + (avance * escala) / 2) / radio;
      arco += avance * escala;
      if (glifo.path.commands.length === 0) return;
      const c = Math.cos(angulo);
      const sn = Math.sin(angulo);
      const ancho = linea.positions[i]!.xAdvance * s;
      trazos.push(glifo.path.scale(s, -s).translate(-ancho / 2, 0).transform(c, sn, -sn, c, 0, 0).translate(cx + radio * sn, cy - radio * c).toSVG());
    });
    return trazos.join('');
  }

  /**
   * Compone un bloque dentro de una caja: elige el cuerpo (y el ancho de la fuente si es variable),
   * parte las líneas y las coloca. Todo en el sistema de coordenadas de la caja.
   */
  componer(peticion: PeticionBloque): BloqueCompuesto {
    const { estilo, caja } = peticion;
    const texto = this.aplicarCaso(peticion.texto, estilo.caso);
    let ejes = { ...estilo.ejes };
    const conEjes = (e: Record<string, number>) => ({ ...estilo, ejes: e });
    const parrafos = texto.split('\n').map((p) => p.trim()).filter(Boolean);
    let lineas: Array<{ texto: string; tamano: number }>;

    switch (peticion.ajuste) {
      case 'ancho': {
        const tamano = this.tamanoParaAncho(conEjes(ejes), parrafos, caja.w);
        lineas = parrafos.map((t) => ({ texto: t, tamano }));
        break;
      }
      case 'ancho-por-linea':
        lineas = parrafos.map((t) => ({ texto: t, tamano: this.tamanoParaAncho(conEjes(ejes), [t], caja.w) }));
        break;
      case 'alto': {
        const tamano = this.tamanoParaAlto(conEjes(ejes), parrafos.length, caja.h);
        lineas = parrafos.map((t) => ({ texto: t, tamano }));
        break;
      }
      case 'eje-ancho': {
        const ajustado = this.ajustarEjeAncho(conEjes(ejes), parrafos, caja);
        ejes = ajustado.ejes;
        lineas = parrafos.map((t) => ({ texto: t, tamano: ajustado.tamano }));
        break;
      }
      case 'caja': {
        const tamano = this.tamanoParaCaja(conEjes(ejes), parrafos, caja);
        lineas = this.partirParrafos(conEjes(ejes), parrafos, caja.w, tamano).map((t) => ({ texto: t, tamano }));
        break;
      }
      case 'fijo': {
        const tamano = peticion.tamano ?? 32;
        lineas = this.partirParrafos(conEjes(ejes), parrafos, caja.w, tamano).map((t) => ({ texto: t, tamano }));
        break;
      }
    }
    return this.colocar(conEjes(ejes), lineas, peticion);
  }

  private colocar(estilo: EstiloMotor, lineas: Array<{ texto: string; tamano: number }>, peticion: PeticionBloque): BloqueCompuesto {
    const { caja } = peticion;
    // Línea base de cada línea: la primera, con sus mayúsculas tocando el techo; las siguientes, con el interlineado.
    const capRatio = this.alturaMayusculas(estilo, 1000) / 1000;
    const bases: number[] = [];
    lineas.forEach((linea, i) => {
      if (i === 0) bases.push(capRatio * linea.tamano);
      else {
        const anterior = lineas[i - 1]!;
        bases.push(bases[i - 1]! + (estilo.interlineado - capRatio) * anterior.tamano + capRatio * linea.tamano);
      }
    });
    const altoMayusculas = bases.at(-1) ?? 0;
    const desplazamiento = peticion.vertical === 'arriba' ? 0 : peticion.vertical === 'abajo' ? caja.h - altoMayusculas : (caja.h - altoMayusculas) / 2;

    const compuestas = lineas.map((linea, i) => {
      const medida = this.medir(estilo, linea.texto, linea.tamano);
      const x =
        peticion.alinear === 'izquierda'
          ? caja.x - medida.minX
          : peticion.alinear === 'derecha'
            ? caja.x + caja.w - medida.maxX
            : caja.x + (caja.w - medida.ancho) / 2 - medida.minX;
      return { texto: linea.texto, x, base: caja.y + desplazamiento + bases[i]!, tamano: linea.tamano, medida };
    });

    const izquierda = Math.min(...compuestas.map((l) => l.x + l.medida.minX));
    const derecha = Math.max(...compuestas.map((l) => l.x + l.medida.maxX));
    const arriba = Math.min(...compuestas.map((l) => l.base - l.medida.arriba));
    const abajo = Math.max(...compuestas.map((l) => l.base + l.medida.abajo));
    return {
      lineas: compuestas,
      tamano: compuestas[0]?.tamano ?? 0,
      ejes: this.catalogo.fuente(estilo.fuente, estilo.ejes).ejes,
      visual: { x: izquierda, y: arriba, w: derecha - izquierda, h: abajo - arriba },
    };
  }

  /** Cuerpo con el que la línea más ancha ocupa justo `ancho`. */
  private tamanoParaAncho(estilo: EstiloMotor, lineas: string[], ancho: number): number {
    const mayor = Math.max(...lineas.map((t) => this.medir(estilo, t, 1000).ancho));
    return (1000 * ancho) / mayor;
  }

  /** Cuerpo con el que n líneas de mayúsculas ocupan justo `alto`. */
  private tamanoParaAlto(estilo: EstiloMotor, n: number, alto: number): number {
    const capRatio = this.alturaMayusculas(estilo, 1000) / 1000;
    return alto / (capRatio + (n - 1) * estilo.interlineado);
  }

  /**
   * Las mayúsculas ocupan el alto de la caja y el eje de anchura (wdth) se ajusta para que ocupen
   * también el ancho. Si la fuente no da para tanto, se queda en su límite y el cuerpo baja para caber.
   */
  private ajustarEjeAncho(estilo: EstiloMotor, lineas: string[], caja: { w: number; h: number }): { tamano: number; ejes: Record<string, number> } {
    const rango = this.catalogo.rango(estilo.fuente, 'wdth');
    const anchoCon = (wdth: number) => {
      const ejes = { ...estilo.ejes, wdth };
      const tamano = this.tamanoParaAlto({ ...estilo, ejes }, lineas.length, caja.h);
      const ancho = Math.max(...lineas.map((t) => this.medir({ ...estilo, ejes }, t, tamano).ancho));
      return { tamano, ancho, ejes };
    };
    if (!rango) {
      const tamano = Math.min(this.tamanoParaAlto(estilo, lineas.length, caja.h), this.tamanoParaAncho(estilo, lineas, caja.w));
      return { tamano, ejes: estilo.ejes };
    }
    let [bajo, alto] = rango;
    if (anchoCon(bajo).ancho > caja.w) {
      // Ni con la anchura mínima cabe: se reduce el cuerpo.
      const ejes = { ...estilo.ejes, wdth: bajo };
      return { tamano: this.tamanoParaAncho({ ...estilo, ejes }, lineas, caja.w), ejes };
    }
    if (anchoCon(alto).ancho <= caja.w) return { tamano: anchoCon(alto).tamano, ejes: { ...estilo.ejes, wdth: alto } };
    for (let i = 0; i < 18; i++) {
      const medio = (bajo + alto) / 2;
      if (anchoCon(medio).ancho > caja.w) alto = medio;
      else bajo = medio;
    }
    const final = anchoCon(bajo);
    return { tamano: final.tamano, ejes: final.ejes };
  }

  /** El cuerpo más grande con el que el texto, partido en líneas, cabe en la caja. */
  private tamanoParaCaja(estilo: EstiloMotor, parrafos: string[], caja: { w: number; h: number }): number {
    const capRatio = this.alturaMayusculas(estilo, 1000) / 1000;
    const cabe = (tamano: number) => {
      const lineas = this.partirParrafos(estilo, parrafos, caja.w, tamano);
      const alto = capRatio * tamano + (lineas.length - 1) * estilo.interlineado * tamano;
      return alto <= caja.h && lineas.every((l) => this.medir(estilo, l, tamano).ancho <= caja.w + 0.5);
    };
    let bajo = 4;
    let alto = 2000;
    for (let i = 0; i < 30; i++) {
      const medio = (bajo + alto) / 2;
      if (cabe(medio)) bajo = medio;
      else alto = medio;
    }
    return bajo;
  }

  /** Parte cada párrafo en líneas que caben en `ancho`, sin dejar «de», «la», «y»… al final de una línea. */
  partirParrafos(estilo: EstiloMotor, parrafos: string[], ancho: number, tamano: number): string[] {
    const cabe = (t: string) => this.medir(estilo, t, tamano).ancho <= ancho + 0.5;
    const lineas: string[] = [];
    for (const parrafo of parrafos) {
      const palabras = parrafo.split(/\s+/).filter(Boolean);
      const propias: string[][] = [];
      let actual: string[] = [];
      for (const palabra of palabras) {
        const candidata = [...actual, palabra];
        if (actual.length === 0 || cabe(candidata.join(' '))) actual = candidata;
        else {
          propias.push(actual);
          actual = [palabra];
        }
      }
      if (actual.length) propias.push(actual);
      // 1. Sin viudas: si la última línea se queda con una sola palabra, baja otra de la línea anterior (si cabe).
      const ultima = propias.at(-1);
      const penultima = propias.at(-2);
      if (ultima && penultima && ultima.length === 1 && penultima.length > 2) {
        const candidata = [penultima.at(-1)!, ...ultima];
        if (cabe(candidata.join(' '))) {
          penultima.pop();
          propias[propias.length - 1] = candidata;
        }
      }
      // 2. Una palabra corta que queda al final de una línea pasa al principio de la siguiente.
      //    Va después de lo anterior, porque bajar una palabra puede dejar al descubierto una corta («en una»).
      for (let i = 0; i < propias.length - 1; i++) {
        const linea = propias[i]!;
        while (linea.length > 1 && NO_AL_FINAL.has(linea.at(-1)!.toLocaleLowerCase('es-ES'))) {
          propias[i + 1]!.unshift(linea.pop()!);
        }
      }
      lineas.push(...propias.map((p) => p.join(' ')));
    }
    return lineas;
  }
}

function medirEnUnidades(fuente: Fuente, texto: string, tracking: number): MedidaUnidades {
  const linea = fuente.layout(texto);
  let pluma = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let arriba = 0;
  let abajo = 0;
  linea.glyphs.forEach((glifo, i) => {
    const posicion = linea.positions[i]!;
    if (glifo.path.commands.length > 0) {
      const caja = glifo.path.bbox;
      minX = Math.min(minX, pluma + posicion.xOffset + caja.minX);
      maxX = Math.max(maxX, pluma + posicion.xOffset + caja.maxX);
      arriba = Math.max(arriba, caja.maxY + posicion.yOffset);
      abajo = Math.max(abajo, -(caja.minY + posicion.yOffset));
    }
    pluma += posicion.xAdvance + tracking * fuente.unitsPerEm;
  });
  if (minX === Infinity) return { minX: 0, maxX: 0, arriba: 0, abajo: 0 };
  return { minX, maxX, arriba, abajo };
}
