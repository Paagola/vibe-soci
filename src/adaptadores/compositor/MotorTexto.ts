/**
 * Motor de texto: mide, ajusta y convierte el texto en trazos a partir de los archivos de fuente.
 * No depende de las fuentes instaladas en el sistema: el mismo texto sale igual en cualquier máquina.
 */
import type { Fuente } from 'fontkit';
import type { AjusteLetra, FormaTexto } from '../../dominio/diseno/intencion.js';
import type { CatalogoTipografico } from './tipografias.js';

export interface EstiloMotor {
  fuente: string;
  ejes: Record<string, number>;
  caso: 'mayusculas' | 'tal-cual';
  /** em */
  tracking: number;
  /** múltiplos del cuerpo */
  interlineado: number;
  /** Rasgos OpenType que se activan además de los de serie (smcp, onum, swsh…). */
  rasgos?: string[];
  /**
   * Edición fina de la letra (escala, inclinación, espaciado por línea, ajustes por letra). Se aplica aquí, al
   * generar cada glifo, y por eso vale igual para medir, ajustar, pintar, tratar y comprobar el texto.
   */
  forma?: FormaTexto;
}

/**
 * Lo que hace falta para medir o trazar una línea. Con `forma`, los ajustes por letra cuentan desde la primera letra
 * de la línea y el espaciado es el de la primera de `trackingPorLinea`: para la línea i de un bloque se usa deLinea().
 */
export type EstiloDeLinea = Pick<EstiloMotor, 'fuente' | 'ejes' | 'tracking' | 'rasgos' | 'forma'>;

/** Una línea ya colocada de un bloque (lo que guarda el documento resuelto). */
export interface LineaColocada {
  texto: string;
  tamano: number;
  x: number;
  base: number;
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

/**
 * Una letra ya colocada: su trazo SVG, el carácter, su caja (y crece hacia abajo) y la línea base de su línea (un
 * ajuste por letra que la sube o la baja mueve el trazo y la caja, no la base: así se sabe a qué línea pertenece).
 */
export interface GlifoTrazado {
  d: string;
  caracter: string;
  caja: { x0: number; y0: number; x1: number; y1: number };
  base: number;
}

/** Letras visibles de un texto: todo menos los espacios. Es lo que cuenta el `indice` de los ajustes por letra. */
export function contarLetras(texto: string): number {
  let n = 0;
  for (const c of texto) if (!/\s/u.test(c)) n++;
  return n;
}

const esEspacio = (codigo: number) => /\s/u.test(String.fromCodePoint(codigo));

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
  /** Medidas con forma, en px a cuerpo 1000 (no en unidades de fuente). */
  private readonly medidasConForma = new Map<string, MedidaUnidades>();

  constructor(private readonly catalogo: CatalogoTipografico) {}

  aplicarCaso(texto: string, caso: EstiloMotor['caso']): string {
    return caso === 'mayusculas' ? texto.toLocaleUpperCase('es-ES') : texto;
  }

  /** Altura de mayúscula en px. Con `forma`, la de la letra ya estirada o encogida en vertical (escalaY). */
  alturaMayusculas(estilo: Pick<EstiloMotor, 'fuente' | 'ejes'> & { forma?: Pick<FormaTexto, 'escalaY'> }, tamano: number): number {
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const altura = (fuente.capHeight * tamano) / fuente.unitsPerEm;
    return estilo.forma ? altura * estilo.forma.escalaY : altura;
  }

  /**
   * El estilo de la línea `i` de un bloque cuya primera letra es la número `desde` del texto: su espaciado (el de
   * `trackingPorLinea`, si lo hay) y sus ajustes por letra, contados desde su primera letra. Sin forma, el mismo estilo.
   */
  deLinea(estilo: EstiloDeLinea, i: number, desde: number): EstiloDeLinea {
    const f = estilo.forma;
    if (!f) return estilo;
    const { trackingPorLinea, letras, ...resto } = f;
    return {
      fuente: estilo.fuente,
      ejes: estilo.ejes,
      tracking: trackingPorLinea?.[i] ?? estilo.tracking,
      ...(estilo.rasgos ? { rasgos: estilo.rasgos } : {}),
      forma: { ...resto, letras: letras.filter((l) => l.indice >= desde).map((l) => ({ ...l, indice: l.indice - desde })) },
    };
  }

  /** El estilo de cada línea de un bloque, en orden (ver deLinea). */
  estilosDeLineas(estilo: EstiloDeLinea, textos: string[]): EstiloDeLinea[] {
    if (!estilo.forma) return textos.map(() => estilo);
    let desde = 0;
    return textos.map((texto, i) => {
      const deEsta = this.deLinea(estilo, i, desde);
      desde += contarLetras(texto);
      return deEsta;
    });
  }

  /** Las letras de cada línea de un bloque ya colocado, con la forma de cada una. Es lo que pintan y miden todos. */
  glifosDeBloque(estilo: EstiloDeLinea, lineas: LineaColocada[]): GlifoTrazado[][] {
    const estilos = this.estilosDeLineas(estilo, lineas.map((l) => l.texto));
    return lineas.map((l, i) => this.glifos(estilos[i]!, l.texto, l.tamano, l.x, l.base));
  }

  /** Trazo SVG de todas las líneas de un bloque ya colocado. */
  trazarBloque(estilo: EstiloDeLinea, lineas: LineaColocada[]): string {
    return this.glifosDeBloque(estilo, lineas)
      .map((glifos) => glifos.map((g) => g.d).join(''))
      .join('');
  }

  /** Nombre de la familia de una fuente del catálogo (para contar las voces de una pieza). */
  familia(fuente: string): string {
    return this.catalogo.familia(fuente);
  }

  /** Las etiquetas de una fuente del catálogo (para saber, por ejemplo, si tiene trazos muy finos). */
  clasificacion(fuente: string): string[] {
    return this.catalogo.clasificacion(fuente);
  }

  medir(estilo: EstiloDeLinea, texto: string, tamano: number): Medida {
    if (estilo.forma) return this.medirConForma(estilo, texto, tamano);
    const { fuente, ejes } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const rasgos = estilo.rasgos?.length ? estilo.rasgos : undefined;
    const clave = `${estilo.fuente}|${JSON.stringify(ejes)}|${estilo.tracking}|${rasgos ? `${rasgos.join(',')}|` : ''}${texto}`;
    let unidades = this.medidas.get(clave);
    if (!unidades) {
      unidades = medirEnUnidades(componerLinea(fuente, texto, rasgos), fuente.unitsPerEm, estilo.tracking);
      this.medidas.set(clave, unidades);
    }
    const s = tamano / fuente.unitsPerEm;
    return { ancho: (unidades.maxX - unidades.minX) * s, minX: unidades.minX * s, maxX: unidades.maxX * s, arriba: unidades.arriba * s, abajo: unidades.abajo * s };
  }

  /**
   * Medida con forma: la caja exacta de las letras ya transformadas (estiradas, inclinadas, movidas, giradas). Toda la
   * geometría es proporcional al cuerpo, así que se mide una vez a 1000 px y se escala.
   */
  private medirConForma(estilo: EstiloDeLinea, texto: string, tamano: number): Medida {
    const { ejes } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const rasgos = estilo.rasgos?.length ? estilo.rasgos : undefined;
    const clave = `${estilo.fuente}|${JSON.stringify(ejes)}|${estilo.tracking}|${rasgos ? `${rasgos.join(',')}|` : ''}${JSON.stringify(estilo.forma)}|${texto}`;
    let mil = this.medidasConForma.get(clave);
    if (!mil) {
      const { glifos } = this.glifosConForma(estilo, texto, 1000, 0, 0);
      mil = glifos.length
        ? {
            minX: Math.min(...glifos.map((g) => g.caja.x0)),
            maxX: Math.max(...glifos.map((g) => g.caja.x1)),
            arriba: Math.max(0, ...glifos.map((g) => -g.caja.y0)),
            abajo: Math.max(0, ...glifos.map((g) => g.caja.y1)),
          }
        : { minX: 0, maxX: 0, arriba: 0, abajo: 0 };
      this.medidasConForma.set(clave, mil);
    }
    const s = tamano / 1000;
    return { ancho: (mil.maxX - mil.minX) * s, minX: mil.minX * s, maxX: mil.maxX * s, arriba: mil.arriba * s, abajo: mil.abajo * s };
  }

  /** Lo que avanza la pluma al escribir un texto (con su espaciado): sirve para repetirlo en fila sin que se pise. */
  avance(estilo: EstiloDeLinea, texto: string, tamano: number): number {
    if (estilo.forma) return this.glifosConForma(estilo, texto, tamano, 0, 0).avance;
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const linea = componerLinea(fuente, texto, estilo.rasgos);
    const unidades = linea.positions.reduce((suma, p) => suma + p.xAdvance + estilo.tracking * fuente.unitsPerEm, 0);
    return (unidades * tamano) / fuente.unitsPerEm;
  }

  /** Rasgos OpenType que tiene de verdad una fuente del catálogo. */
  rasgosDisponibles(fuente: string): string[] {
    return this.catalogo.fuente(fuente).fuente.availableFeatures ?? [];
  }

  /** Trazo SVG de una línea con su origen en (x, base). */
  trazar(estilo: EstiloDeLinea, texto: string, tamano: number, x: number, base: number): string {
    return this.glifos(estilo, texto, tamano, x, base)
      .map((g) => g.d)
      .join('');
  }

  /**
   * Cada letra de una línea por separado: su trazo, el carácter que representa y su caja, con el origen en (x, base).
   * Sirve para tratar las letras una a una (un recorte de papel que gira, una gota que cuelga de una letra) y para
   * comprobar cuánto se ve de cada una.
   */
  glifos(estilo: EstiloDeLinea, texto: string, tamano: number, x: number, base: number): GlifoTrazado[] {
    if (estilo.forma) return this.glifosConForma(estilo, texto, tamano, x, base).glifos;
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const s = tamano / fuente.unitsPerEm;
    const linea = componerLinea(fuente, texto, estilo.rasgos);
    let pluma = 0;
    const glifos: GlifoTrazado[] = [];
    linea.glyphs.forEach((glifo, i) => {
      const posicion = linea.positions[i]!;
      if (glifo.path.commands.length > 0) {
        const gx = x + (pluma + posicion.xOffset) * s;
        const gy = base - posicion.yOffset * s;
        const b = glifo.path.bbox;
        glifos.push({
          d: glifo.path.scale(s, -s).translate(gx, gy).toSVG(),
          caracter: glifo.codePoints.length ? String.fromCodePoint(...glifo.codePoints) : '',
          caja: { x0: gx + b.minX * s, x1: gx + b.maxX * s, y0: gy - b.maxY * s, y1: gy - b.minY * s },
          base: gy,
        });
      }
      pluma += posicion.xAdvance + estilo.tracking * fuente.unitsPerEm;
    });
    return glifos;
  }

  /**
   * Las letras de una línea con su forma. Cada glifo se lleva de unidades de fuente a px con una sola matriz:
   * escala (la de la línea × la de la letra), inclinación respecto a la línea base y su sitio; el giro de una letra va
   * después, alrededor del centro de su caja. La pluma avanza con la letra ya escalada, así que una letra más ancha o
   * más grande empuja a las siguientes en vez de montarse. Devuelve también el avance total, en px.
   */
  private glifosConForma(estilo: EstiloDeLinea, texto: string, tamano: number, x: number, base: number): { glifos: GlifoTrazado[]; avance: number } {
    const f = estilo.forma!;
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const unidades = fuente.unitsPerEm;
    const s = tamano / unidades;
    const tracking = f.trackingPorLinea?.[0] ?? estilo.tracking;
    const inclinacion = Math.tan((f.inclinacion * Math.PI) / 180);
    const ajustes = new Map<number, AjusteLetra>(f.letras.map((l) => [l.indice, l]));
    const linea = componerLinea(fuente, texto, estilo.rasgos);
    let pluma = 0;
    let letra = 0;
    let anterior: AjusteLetra | undefined;
    const glifos: GlifoTrazado[] = [];
    linea.glyphs.forEach((glifo, i) => {
      const posicion = linea.positions[i]!;
      const propias = glifo.codePoints.filter((c) => !esEspacio(c)).length;
      // Un glifo sin carácter (una tilde que la fuente separa de su letra) va con la letra de antes, sin repetir su kerning.
      let ajuste: AjusteLetra | undefined;
      if (glifo.codePoints.length === 0) ajuste = anterior && { ...anterior, dx: 0 };
      else if (propias > 0) {
        ajuste = ajustes.get(letra);
        anterior = ajuste;
      }
      letra += propias;
      if (ajuste) pluma += ajuste.dx * unidades;
      const escala = ajuste?.escala ?? 1;
      if (glifo.path.commands.length > 0) {
        const gx = x + (pluma + posicion.xOffset * f.escalaX * escala) * s;
        const gy = base - posicion.yOffset * f.escalaY * escala * s - (ajuste?.dy ?? 0) * tamano;
        const sx = s * escala * f.escalaX;
        const sy = s * escala * f.escalaY;
        let trazo = glifo.path.transform(sx, 0, sy * inclinacion, -sy, gx, gy);
        if (ajuste && ajuste.giro !== 0) {
          const b = trazo.bbox;
          const cx = (b.minX + b.maxX) / 2;
          const cy = (b.minY + b.maxY) / 2;
          const a = (ajuste.giro * Math.PI) / 180;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          trazo = trazo.transform(cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos);
        }
        const b = trazo.bbox;
        glifos.push({
          d: trazo.toSVG(),
          caracter: glifo.codePoints.length ? String.fromCodePoint(...glifo.codePoints) : '',
          caja: { x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY },
          base,
        });
      }
      pluma += posicion.xAdvance * f.escalaX * escala + tracking * unidades;
    });
    return { glifos, avance: pluma * s };
  }

  /** Texto repartido alrededor de un círculo completo, con las letras mirando hacia fuera. */
  /** Letras sobre una circunferencia desde `giroGrados` (0 = arriba). Ocupan `arcoGrados` (360 = la vuelta entera). */
  trazarCircular(estilo: EstiloDeLinea, texto: string, tamano: number, cx: number, cy: number, radio: number, giroGrados: number, arcoGrados = 360): string {
    const { fuente } = this.catalogo.fuente(estilo.fuente, estilo.ejes);
    const s = tamano / fuente.unitsPerEm;
    const linea = componerLinea(fuente, texto, estilo.rasgos);
    const avances = linea.positions.map((p) => (p.xAdvance + estilo.tracking * fuente.unitsPerEm) * s);
    const total = avances.reduce((a, b) => a + b, 0);
    const escala = ((arcoGrados / 360) * 2 * Math.PI * radio) / total;
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
        lineas = parrafos.map((t, i) => ({ texto: t, tamano: this.tamanoParaAncho(conEjes(ejes), parrafos, caja.w, i) }));
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
    const estilos = this.estilosDeLineas(estilo, lineas.map((l) => l.texto));

    const compuestas = lineas.map((linea, i) => {
      const medida = this.medir(estilos[i]!, linea.texto, linea.tamano);
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

  /** Cuerpo con el que la línea más ancha (o solo la línea `solo`) ocupa justo `ancho`. Cada línea, con su forma. */
  private tamanoParaAncho(estilo: EstiloMotor, lineas: string[], ancho: number, solo?: number): number {
    const estilos = this.estilosDeLineas(estilo, lineas);
    const cuales = solo === undefined ? lineas.map((_, i) => i) : [solo];
    const mayor = Math.max(...cuales.map((i) => this.medir(estilos[i]!, lineas[i]!, 1000).ancho));
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
      const estilos = this.estilosDeLineas({ ...estilo, ejes }, lineas);
      const ancho = Math.max(...lineas.map((t, i) => this.medir(estilos[i]!, t, tamano).ancho));
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
      const estilos = this.estilosDeLineas(estilo, lineas);
      return alto <= caja.h && lineas.every((l, i) => this.medir(estilos[i]!, l, tamano).ancho <= caja.w + 0.5);
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

  /**
   * Parte cada párrafo en líneas que caben en `ancho`, sin dejar «de», «la», «y»… al final de una línea.
   * Cada línea candidata se mide con la forma que tendría en su sitio (su número de línea y su primera letra), así que
   * el corte es el mismo que luego se pinta. Sin forma, todas se miden con el mismo estilo, como siempre.
   */
  partirParrafos(estilo: EstiloMotor, parrafos: string[], ancho: number, tamano: number): string[] {
    const lineas: string[] = [];
    let letrasAntes = 0;
    for (const parrafo of parrafos) {
      const palabras = parrafo.split(/\s+/).filter(Boolean);
      // La primera letra de cada palabra en el texto entero (para los ajustes por letra de la línea en que caiga).
      const inicio: number[] = [];
      for (const palabra of palabras) {
        inicio.push(letrasAntes);
        letrasAntes += contarLetras(palabra);
      }
      const texto = (linea: number[]) => linea.map((k) => palabras[k]!).join(' ');
      const cabe = (linea: number[], fila: number) => this.medir(this.deLinea(estilo, fila, inicio[linea[0]!]!), texto(linea), tamano).ancho <= ancho + 0.5;
      const propias: number[][] = [];
      let actual: number[] = [];
      palabras.forEach((_, k) => {
        const candidata = [...actual, k];
        if (actual.length === 0 || cabe(candidata, lineas.length + propias.length)) actual = candidata;
        else {
          propias.push(actual);
          actual = [k];
        }
      });
      if (actual.length) propias.push(actual);
      // 1. Sin viudas: si la última línea se queda con una sola palabra, baja otra de la línea anterior (si cabe).
      const ultima = propias.at(-1);
      const penultima = propias.at(-2);
      if (ultima && penultima && ultima.length === 1 && penultima.length > 2) {
        const candidata = [penultima.at(-1)!, ...ultima];
        if (cabe(candidata, lineas.length + propias.length - 1)) {
          penultima.pop();
          propias[propias.length - 1] = candidata;
        }
      }
      // 2. Una palabra corta que queda al final de una línea pasa al principio de la siguiente.
      //    Va después de lo anterior, porque bajar una palabra puede dejar al descubierto una corta («en una»).
      for (let i = 0; i < propias.length - 1; i++) {
        const linea = propias[i]!;
        while (linea.length > 1 && NO_AL_FINAL.has(palabras[linea.at(-1)!]!.toLocaleLowerCase('es-ES'))) {
          propias[i + 1]!.unshift(linea.pop()!);
        }
      }
      lineas.push(...propias.map(texto));
    }
    return lineas;
  }
}

/** La línea compuesta por la fuente. Sin rasgos pedidos se llama igual que siempre: el resultado no cambia. */
function componerLinea(fuente: Fuente, texto: string, rasgos?: string[]): ReturnType<Fuente['layout']> {
  return rasgos?.length ? fuente.layout(texto, rasgos) : fuente.layout(texto);
}

function medirEnUnidades(linea: ReturnType<Fuente['layout']>, unidadesPorEm: number, tracking: number): MedidaUnidades {
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
    pluma += posicion.xAdvance + tracking * unidadesPorEm;
  });
  if (minX === Infinity) return { minX: 0, maxX: 0, arriba: 0, abajo: 0 };
  return { minX, maxX, arriba, abajo };
}
