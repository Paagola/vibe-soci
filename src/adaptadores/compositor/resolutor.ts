/**
 * Resolutor: de la intención (retícula, relaciones, tokens) al documento resuelto (píxeles).
 * Decide tamaños, posiciones y ejes de las fuentes; comprueba las reglas y anota los problemas.
 * No pinta: eso lo hace el renderizador con el documento que sale de aquí.
 */
import type { Activo } from '../../dominio/activos.js';
import { semillaDe } from '../../dominio/diseno/azar.js';
import type { Caja, Capa, CapaDe, Color, EstiloTexto, Intencion, Retoque, Tinta } from '../../dominio/diseno/intencion.js';
import { medirOficio, problemasDeOficio } from '../../dominio/diseno/oficio.js';
import type { CapaResuelta, EstiloResuelto, LineaDeSello, Problema, RecorteDeTexto, Resuelto, TintaResuelta } from '../../dominio/diseno/resuelto.js';
import { alinearEn, dentroDe, lienzoDe, rectDeCaja, zonaSegura, type Lienzo, type Rect } from '../../dominio/diseno/reticula.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import { radioInterior } from './formas.js';
import type { MotorTexto } from './MotorTexto.js';
import { alfaDeSvg, alfaDelSujeto, cobertura, documentoSvg, medidorDeCobertura, trazoDeTexto, type CapaRecorteResuelta, type CapaTextoResuelta } from './raster.js';

/** Resolución a la que se miden coberturas y solapes (un cuarto del lienzo basta y es rápido). */
const ESCALA_MEDIDA = 0.25;
/** A partir de aquí la foto se amplía tanto que se verá blanda. */
export const AMPLIACION_MAXIMA = 1.6;
/**
 * Altura de mayúscula mínima en px para que un texto se lea en el móvil (1080 px de ancho), unos 30 px de cuerpo.
 * Era 16; se subió el 08/11/2026 porque las líneas de 24 px de los posts F1.6 se leían mal en el móvil
 * (revisión de una diseñadora y de otras personas).
 */
export const ALTURA_MAYUSCULA_MINIMA = 22;
/**
 * Separación mínima entre dos bloques de texto que se apilan, en cuerpos (tamaño de letra) del más pequeño.
 * Por debajo se leen como un amasijo (revisión del 08/11/2026: «demasiado pegado», «muy apelotonado»).
 * Se mide en cuerpo y no en altura de mayúscula porque en las manuscritas la mayúscula es enorme y la minúscula,
 * que es lo que se ve, pequeña: «glaseado» bajo «Salmón» respira con 41 px y la mayúscula pedía 61.
 */
export const SEPARACION_MINIMA_EN_CUERPOS = 0.35;
/**
 * La tinta impresa (cobertura irregular, canto reseco) solo va en textos grandes: por debajo de esta altura de
 * mayúscula rompe la lectura, así que se ignora y se avisa.
 */
export const ALTURA_MINIMA_PARA_TINTA = 48;

type Matriz = [number, number, number, number, number, number];
type Comun = { id: string; z: number; opacidad: number; fusion: CapaResuelta['fusion'] };

interface Transformacion {
  escala: number;
  ox: number;
  oy: number;
  marco: Rect;
}

export class ResolutorDiseno {
  constructor(private readonly motor: MotorTexto) {}

  async resolver(intencion: Intencion, activos: Record<string, ActivoDisponible>): Promise<Resuelto> {
    const lienzo = lienzoDe(intencion.lienzo.formato);
    const zona = zonaSegura(lienzo, intencion.reticula.margen);
    const problemas: Problema[] = [];
    const medidas: Resuelto['medidas'] = { cobertura: {}, solape: {}, ampliacion: {}, contraste: {} };
    const rect = (caja: Caja) => rectDeCaja(caja, lienzo, intencion.reticula);
    const color = (valor: Color) => resolverColor(intencion, valor);
    const estilo = (id: string) => resolverEstilo(intencion, id);
    const texto = (valor: string) => resolverTexto(intencion, valor);
    const semilla = (capa: { id: string; semilla?: number }) => capa.semilla ?? semillaDe(`${intencion.id}:${capa.id}`);
    const tinta = (capa: { id: string; tinta?: Tinta }, propio: string) => resolverTinta(capa.tinta, color, propio, `${intencion.id}:${capa.id}`);
    const disponible = (papel: string) => {
      const activo = activos[papel];
      if (!activo) throw new RangeError(`La intención usa el activo «${papel}», pero no se ha cargado.`);
      return activo;
    };

    const resueltas = new Map<string, CapaResuelta>();
    const transformaciones = new Map<string, Transformacion>();
    const orden = (capa: Capa) => (capa.tipo === 'imagen' ? 0 : capa.tipo === 'recorte' ? 1 : 2);
    const indice = new Map(intencion.capas.map((capa, i) => [capa.id, i]));
    if (indice.size !== intencion.capas.length) throw new RangeError('Hay dos capas con el mismo id.');

    const trasTexto: Array<{ capa: CapaDe<'recorte'>; comun: Comun }> = [];
    const trazos: Array<{ capa: CapaDe<'trazo'>; comun: Comun }> = [];

    for (const capa of [...intencion.capas].sort((a, b) => orden(a) - orden(b))) {
      if (capa.oculta) continue;
      const comun = { id: capa.id, z: indice.get(capa.id)!, opacidad: capa.opacidad, fusion: capa.fusion };
      // Lo que va «tras un texto» se coloca al final, cuando el texto ya tiene su sitio definitivo.
      if (capa.tipo === 'recorte' && capa.trasTexto) {
        trasTexto.push({ capa, comun });
        continue;
      }
      switch (capa.tipo) {
        case 'relleno':
          resueltas.set(capa.id, { ...comun, tipo: 'relleno', color: color(capa.color) });
          break;
        case 'degradado':
          resueltas.set(capa.id, {
            ...comun,
            tipo: 'degradado',
            forma: capa.forma,
            rect: capa.caja ? rect(capa.caja) : { x: 0, y: 0, w: lienzo.ancho, h: lienzo.alto },
            angulo: capa.angulo,
            paradas: capa.paradas.map((p) => ({ en: p.en, color: color(p.color), opacidad: p.opacidad })),
          });
          break;
        case 'imagen': {
          const { activo } = disponible(capa.activo);
          const marco = rect(capa.caja);
          const escala = Math.max(marco.w / activo.ancho, marco.h / activo.alto) * capa.zoom;
          const w = marco.w / escala;
          const h = marco.h / escala;
          const ox = acotar(capa.enfoque.x * activo.ancho - w / 2, 0, activo.ancho - w);
          const oy = acotar(capa.enfoque.y * activo.alto - h / 2, 0, activo.alto - h);
          transformaciones.set(capa.id, { escala, ox, oy, marco });
          medidas.ampliacion[capa.id] = redondear3(escala);
          avisarAmpliacion(problemas, capa.id, escala, activo);
          resueltas.set(capa.id, { ...comun, tipo: 'imagen', activo: capa.activo, origen: { x: ox, y: oy, w, h }, destino: marco, marco, retoque: conColorResuelto(capa.retoque, color) });
          break;
        }
        case 'recorte': {
          const { activo } = disponible(capa.activo);
          if (!activo.mascara) throw new RangeError(`El activo «${activo.id}» no tiene máscara: no se puede recortar.`);
          const bbox = activo.mascara.bbox;
          let destino: Rect;
          let escala: number;
          if (capa.alineadoCon) {
            const t = transformaciones.get(capa.alineadoCon);
            if (!t) throw new RangeError(`«${capa.id}» se alinea con «${capa.alineadoCon}», que no es una capa de imagen.`);
            escala = t.escala;
            destino = { x: t.marco.x + (bbox.x - t.ox) * escala, y: t.marco.y + (bbox.y - t.oy) * escala, w: bbox.w * escala, h: bbox.h * escala };
          } else {
            if (!capa.ancla || !capa.escala) throw new RangeError(`«${capa.id}» necesita «escala» y «ancla», o «alineadoCon».`);
            const { anchoSujeto, altoSujeto } = capa.escala;
            if (anchoSujeto) escala = (anchoSujeto * lienzo.ancho) / bbox.w;
            else if (altoSujeto) escala = (altoSujeto * lienzo.alto) / bbox.h;
            else throw new RangeError(`«${capa.id}»: la escala necesita anchoSujeto o altoSujeto.`);
            const w = bbox.w * escala;
            const h = bbox.h * escala;
            const posicion = alinearEn(rect(capa.ancla.caja), w, h, capa.ancla.alinear);
            destino = { x: posicion.x, y: posicion.y + capa.sangradoAbajo * h, w, h };
          }
          medidas.ampliacion[capa.id] = redondear3(escala);
          avisarAmpliacion(problemas, capa.id, escala, activo);
          resueltas.set(capa.id, {
            ...comun,
            tipo: 'recorte',
            activo: capa.activo,
            origen: { ...bbox },
            destino,
            sujeto: destino,
            retoque: conColorResuelto(capa.retoque, color),
            bordeSuave: capa.bordeSuave,
            contraerBorde: capa.contraerBorde,
            ...(capa.giro !== 0 ? { giro: capa.giro } : {}),
          });
          break;
        }
        case 'sombra': {
          const sujeto = this.recorteDe(resueltas, capa.de, capa.id);
          const d = capa.desplazamiento;
          const r =
            capa.modo === 'proyectada'
              ? { ...sujeto.destino, x: sujeto.destino.x + d.x, y: sujeto.destino.y + d.y }
              : (() => {
                  const w = capa.ancho * sujeto.destino.w;
                  return { x: sujeto.destino.x + (sujeto.destino.w - w) / 2 + d.x, y: sujeto.destino.y + sujeto.destino.h - capa.alto / 2 + d.y, w, h: capa.alto };
                })();
          resueltas.set(capa.id, {
            ...comun,
            tipo: 'sombra',
            de: capa.de,
            modo: capa.modo,
            color: color(capa.color),
            desenfoque: capa.desenfoque,
            desplazamiento: d,
            rect: r,
            activo: sujeto.activo,
            origen: sujeto.origen,
            ...(capa.modo === 'proyectada' && sujeto.giro ? { giro: sujeto.giro } : {}),
          });
          break;
        }
        case 'texto': {
          const resuelta = this.resolverTexto(capa, comun, rect(capa.caja), estilo(capa.estilo), color, texto(capa.texto));
          const marcas = tinta(capa, resuelta.estilo.color);
          if (marcas) {
            const menor = Math.min(...resuelta.lineas.map((l) => this.motor.alturaMayusculas(resuelta.estilo, l.tamano)));
            if (menor < ALTURA_MINIMA_PARA_TINTA) {
              problemas.push({ gravedad: 'AVISO', capa: capa.id, tipo: 'TINTA', mensaje: `«${capa.id}» pide tinta impresa con mayúsculas de ${menor.toFixed(0)} px: por debajo de ${ALTURA_MINIMA_PARA_TINTA} px rompe la lectura, así que se pinta limpio.` });
            } else resuelta.tinta = marcas;
          }
          const silueta = this.siluetaDe(resueltas, capa);
          if (silueta) resuelta.recorte = silueta;
          resueltas.set(capa.id, resuelta);
          break;
        }
        case 'forma': {
          if (capa.figura === 'poligono' && !capa.puntos) throw new RangeError(`«${capa.id}»: un polígono necesita «puntos».`);
          if (capa.figura === 'mancha' && !capa.caja) throw new RangeError(`«${capa.id}»: una mancha necesita «caja».`);
          const relleno = color(capa.color);
          resueltas.set(capa.id, {
            ...comun,
            tipo: 'forma',
            figura: capa.figura,
            rect: capa.caja ? rect(capa.caja) : undefined,
            desde: capa.desde && { x: capa.desde.x * lienzo.ancho, y: capa.desde.y * lienzo.alto },
            hasta: capa.hasta && { x: capa.hasta.x * lienzo.ancho, y: capa.hasta.y * lienzo.alto },
            ...(capa.puntos ? { puntos: capa.puntos.map((p) => ({ x: redondear3(p.x * lienzo.ancho), y: redondear3(p.y * lienzo.alto) })) } : {}),
            color: relleno,
            grosor: capa.grosor,
            discontinua: capa.discontinua,
            ...(capa.radio ? { radio: capa.radio } : {}),
            ...(capa.giro !== 0 ? { giro: capa.giro } : {}),
            ...(capa.figura === 'mancha' ? { lobulos: capa.lobulos, irregularidad: capa.irregularidad, semilla: semilla(capa) } : {}),
            ...conTinta(tinta(capa, relleno)),
            ...conRecorte(this.siluetaDe(resueltas, capa)),
          });
          break;
        }
        case 'circulo-texto': {
          const e = estilo(capa.estilo);
          resueltas.set(capa.id, {
            ...comun,
            tipo: 'circulo-texto',
            texto: this.motor.aplicarCaso(texto(capa.texto), e.caso),
            estilo: aEstiloResuelto(e, color),
            centro: { x: capa.centro.x * lienzo.ancho, y: capa.centro.y * lienzo.alto },
            radio: capa.radio * lienzo.ancho,
            tamano: capa.tamano,
            fondo: capa.fondo && color(capa.fondo),
            giro: capa.giro,
            ...(capa.arco !== undefined ? { arco: capa.arco } : {}),
          });
          break;
        }
        case 'niveles': {
          const sujeto = this.recorteDe(resueltas, capa.de, capa.id);
          const { activo } = disponible(sujeto.activo);
          const e = estilo(capa.estilo);
          const lineas = capa.niveles.map((nivel) => {
            const punto = activo.niveles.find((n) => n.id === nivel.punto);
            if (!punto) throw new RangeError(`El activo «${activo.id}» no tiene el nivel «${nivel.punto}» anotado.`);
            return {
              y: sujeto.destino.y + punto.y * sujeto.destino.h,
              x1: capa.desdeX * lienzo.ancho,
              x2: capa.hastaX * lienzo.ancho,
              izquierda: nivel.izquierda && this.motor.aplicarCaso(texto(nivel.izquierda), e.caso),
              derecha: nivel.derecha && this.motor.aplicarCaso(texto(nivel.derecha), e.caso),
            };
          });
          resueltas.set(capa.id, { ...comun, tipo: 'niveles', estilo: aEstiloResuelto(e, color), tamano: capa.tamano, color: color(capa.color), grosor: capa.grosor, discontinua: capa.discontinua, lineas });
          break;
        }
        case 'textura':
          resueltas.set(capa.id, { ...comun, tipo: 'textura', recurso: capa.recurso, intensidad: capa.intensidad, escala: capa.escala, semilla: capa.semilla });
          break;
        case 'sello':
          resueltas.set(capa.id, this.resolverSello(capa, comun, lienzo, estilo, color, texto, tinta(capa, color(capa.fondo))));
          break;
        case 'patron':
          resueltas.set(capa.id, {
            ...this.resolverPatron(capa, comun, capa.caja ? rect(capa.caja) : { x: 0, y: 0, w: lienzo.ancho, h: lienzo.alto }, estilo, color, texto, tinta(capa, color(capa.color))),
            ...conRecorte(this.siluetaDe(resueltas, capa)),
          });
          break;
        case 'trazo':
          // Un trazo acompaña a un texto o señala al sujeto: se coloca cuando los dos tienen ya su sitio definitivo.
          trazos.push({ capa, comun });
          break;
      }
    }

    await this.aplicarRelaciones(intencion, resueltas, activos, lienzo, medidas, problemas);
    for (const { capa, comun } of trasTexto) {
      const { activo } = disponible(capa.activo);
      if (!activo.mascara) throw new RangeError(`El activo «${activo.id}» no tiene máscara: no se puede recortar.`);
      const destino = this.trasTexto(capa, resueltas, activo.mascara.bbox);
      const escala = destino.w / activo.mascara.bbox.w;
      medidas.ampliacion[capa.id] = redondear3(escala);
      avisarAmpliacion(problemas, capa.id, escala, activo);
      resueltas.set(capa.id, {
        ...comun,
        tipo: 'recorte',
        activo: capa.activo,
        origen: { ...activo.mascara.bbox },
        destino,
        sujeto: destino,
        retoque: conColorResuelto(capa.retoque, color),
        bordeSuave: capa.bordeSuave,
        contraerBorde: capa.contraerBorde,
        ...(capa.giro !== 0 ? { giro: capa.giro } : {}),
      });
    }
    for (const { capa, comun } of trazos) resueltas.set(capa.id, this.resolverTrazo(capa, comun, resueltas, lienzo, color(capa.color), semilla(capa)));
    this.comprobar(resueltas, zona, problemas);

    const capas = [...resueltas.values()].sort((a, b) => a.z - b.z);
    medidas.oficio = medirOficio(capas, lienzo, { alturaMayusculas: (e, tamano) => this.motor.alturaMayusculas(e, tamano), familia: (fuente) => this.motor.familia(fuente) });
    problemas.push(...problemasDeOficio(medidas.oficio, intencion.lienzo.formato, intencion.oficio));

    return {
      esquema: 'diseno/resuelto@1',
      intencion: { id: intencion.id, version: intencion.version },
      lienzo,
      zonaSegura: zona,
      capas,
      medidas,
      problemas,
      activos: Object.fromEntries(
        Object.entries(activos).map(([papel, { activo }]) => [papel, { id: activo.id, sha256: activo.sha256, uso: activo.uso, tipo: activo.tipo, alteraciones: activo.alteraciones }]),
      ),
    };
  }

  private resolverTexto(capa: CapaDe<'texto'>, comun: Comun, marco: Rect, estilo: EstiloTexto, color: (valor: Color) => string, contenido: string): CapaTextoResuelta {
    const girado = capa.rotacion !== 0;
    const local = { x: 0, y: 0, w: girado ? marco.h : marco.w, h: girado ? marco.w : marco.h };
    const bloque = this.motor.componer({
      texto: contenido,
      estilo: { fuente: estilo.fuente, ejes: estilo.ejes, caso: estilo.caso, tracking: estilo.tracking, interlineado: estilo.interlineado, ...(estilo.rasgos.length ? { rasgos: estilo.rasgos } : {}) },
      caja: local,
      ajuste: capa.ajuste,
      tamano: capa.tamano,
      alinear: capa.alinear,
      vertical: capa.vertical,
    });
    // Del sistema del bloque (sin girar) al lienzo. −90: se lee de abajo arriba; 90: de arriba abajo.
    const recta: Matriz =
      capa.rotacion === 0
        ? [1, 0, 0, 1, marco.x, marco.y]
        : capa.rotacion === -90
          ? [0, -1, 1, 0, marco.x, marco.y + marco.h]
          : [0, 1, -1, 0, marco.x + marco.w, marco.y];
    // El giro libre va después, alrededor del centro de la caja.
    const matriz = capa.giro === 0 ? recta : girarMatriz(recta, capa.giro, marco.x + marco.w / 2, marco.y + marco.h / 2);
    return {
      ...comun,
      tipo: 'texto',
      texto: contenido,
      estilo: { ...aEstiloResuelto(estilo, color), ejes: bloque.ejes, ...(capa.color ? { color: color(capa.color) } : {}) },
      tamano: redondear3(bloque.tamano),
      lineas: bloque.lineas.map((l) => ({ texto: l.texto, x: redondear3(l.x), base: redondear3(l.base), tamano: redondear3(l.tamano), ancho: redondear3(l.medida.ancho), fin: redondear3(l.x + l.medida.maxX) })),
      caja: transformarRect(bloque.visual, matriz),
      matriz,
      rotacion: capa.rotacion,
      contorno: capa.contorno,
      sangrado: capa.sangrado,
      ...(capa.giro !== 0 ? { giro: capa.giro } : {}),
      ...(capa.corte
        ? {
            corte: {
              // Un corte de pie cruza el bloque a lo ancho; uno tumbado, a lo alto.
              punto:
                Math.abs(capa.corte.angulo) >= 45
                  ? { x: redondear3(bloque.visual.x + capa.corte.en * bloque.visual.w), y: redondear3(bloque.visual.y + bloque.visual.h / 2) }
                  : { x: redondear3(bloque.visual.x + bloque.visual.w / 2), y: redondear3(bloque.visual.y + capa.corte.en * bloque.visual.h) },
              angulo: capa.corte.angulo,
              desplazamiento: capa.corte.desplazamiento,
              separacion: capa.corte.separacion,
            },
          }
        : {}),
    };
  }

  /** El sello: su forma en px y el texto del centro al tamaño más grande que cabe dentro de ella. */
  private resolverSello(
    capa: CapaDe<'sello'>,
    comun: Comun,
    lienzo: Lienzo,
    estilo: (id: string) => EstiloTexto,
    color: (valor: Color) => string,
    texto: (valor: string) => string,
    marcas: TintaResuelta | undefined,
  ): CapaResuelta {
    const centro = { x: capa.centro.x * lienzo.ancho, y: capa.centro.y * lienzo.alto };
    const radioX = capa.radio * lienzo.ancho;
    const alargado = capa.forma === 'ovalo' || capa.forma === 'pastilla';
    const radioY = alargado ? radioX * capa.proporcion : radioX;
    // Lo que queda dentro de las puntas y del filete es lo que se puede escribir.
    const util = radioInterior(capa.forma, 1, capa.profundidad);
    let utilX = radioX * util - (capa.filete > 0 ? capa.filete * 3.5 : 0);
    let utilY = radioY * util - (capa.filete > 0 ? capa.filete * 3.5 : 0);
    let anillo: Extract<CapaResuelta, { tipo: 'sello' }>['anillo'];
    if (capa.anillo && !alargado) {
      const e = estilo(capa.anillo.estilo);
      const mayuscula = this.motor.alturaMayusculas(e, capa.anillo.tamano);
      // Las letras miran hacia fuera: su línea base va en un círculo y suben hasta casi el borde útil.
      const radio = utilX * 0.95 - mayuscula;
      anillo = { texto: this.motor.aplicarCaso(texto(capa.anillo.texto), e.caso), estilo: aEstiloResuelto(e, color, capa.color), tamano: capa.anillo.tamano, radio: redondear3(radio) };
      utilX = radio - capa.anillo.tamano * 0.4;
      utilY = utilX;
    }
    const lineas = this.encajarEnSello(capa, estilo, color, texto, utilX * (alargado ? 0.9 : 0.92), utilY * (alargado ? 0.8 : 0.92));
    const giro = (capa.giro * Math.PI) / 180;
    const medioAncho = Math.abs(radioX * Math.cos(giro)) + Math.abs(radioY * Math.sin(giro));
    const medioAlto = Math.abs(radioX * Math.sin(giro)) + Math.abs(radioY * Math.cos(giro));
    return {
      ...comun,
      tipo: 'sello',
      forma: capa.forma,
      centro,
      radioX: redondear3(radioX),
      radioY: redondear3(radioY),
      puntas: capa.puntas,
      profundidad: capa.profundidad,
      fondo: color(capa.fondo),
      color: color(capa.color),
      filete: capa.filete,
      ...(anillo ? { anillo } : {}),
      lineas,
      giro: capa.giro,
      ...(capa.sombra ? { sombra: { dx: capa.sombra.dx, dy: capa.sombra.dy, color: color(capa.sombra.color) } } : {}),
      caja: { x: centro.x - medioAncho, y: centro.y - medioAlto, w: medioAncho * 2, h: medioAlto * 2 },
      ...conTinta(marcas),
    };
  }

  /**
   * Las líneas del centro de un sello, apiladas y centradas, al mayor tamaño con el que todas caben en la elipse útil.
   * `peso` reparte el tamaño entre ellas (la de peso 1 es la grande).
   */
  private encajarEnSello(
    capa: CapaDe<'sello'>,
    estilo: (id: string) => EstiloTexto,
    color: (valor: Color) => string,
    texto: (valor: string) => string,
    rx: number,
    ry: number,
  ): LineaDeSello[] {
    const datos = capa.lineas.map((linea) => {
      const e = estilo(linea.estilo);
      return { e, texto: this.motor.aplicarCaso(texto(linea.texto), e.caso), peso: linea.peso, capRatio: this.motor.alturaMayusculas(e, 1000) / 1000 };
    });
    const pesoMayor = Math.max(...datos.map((d) => d.peso));
    const componer = (k: number) => {
      // k es la altura de mayúscula de la línea más grande.
      const alturas = datos.map((d) => (k * d.peso) / pesoMayor);
      const huecos = alturas.slice(1).map((a, i) => 0.36 * Math.max(a, alturas[i]!) + 0.12 * Math.min(a, alturas[i]!));
      const total = alturas.reduce((s, a) => s + a, 0) + huecos.reduce((s, h) => s + h, 0);
      let y = -total / 2;
      return datos.map((d, i) => {
        const arriba = y;
        const base = y + alturas[i]!;
        y = base + (huecos[i] ?? 0);
        const tamano = alturas[i]! / d.capRatio;
        const ancho = this.motor.medir({ fuente: d.e.fuente, ejes: d.e.ejes, tracking: d.e.tracking, ...(d.e.rasgos.length ? { rasgos: d.e.rasgos } : {}) }, d.texto, tamano).ancho;
        // El ancho disponible es la cuerda de la forma a la altura más alejada del centro de las dos de la línea:
        // en una pastilla los lados son rectos y solo se pierden los extremos redondos; en el resto es una elipse.
        const lejos = Math.max(Math.abs(arriba), Math.abs(base));
        const cuerda = lejos >= ry ? 0 : capa.forma === 'pastilla' ? 2 * (rx - ry + Math.sqrt(ry * ry - lejos * lejos)) : 2 * rx * Math.sqrt(1 - (lejos / ry) ** 2);
        return { d, tamano, base, cabe: ancho <= cuerda };
      });
    };
    let bajo = 2;
    let alto = ry * 2;
    for (let i = 0; i < 26; i++) {
      const medio = (bajo + alto) / 2;
      if (componer(medio).every((l) => l.cabe)) bajo = medio;
      else alto = medio;
    }
    return componer(bajo).map((l) => ({ texto: l.d.texto, estilo: aEstiloResuelto(l.d.e, color, capa.color), tamano: redondear3(l.tamano), base: redondear3(l.base) }));
  }

  private resolverPatron(
    capa: CapaDe<'patron'>,
    comun: Comun,
    r: Rect,
    estilo: (id: string) => EstiloTexto,
    color: (valor: Color) => string,
    texto: (valor: string) => string,
    marcas: TintaResuelta | undefined,
  ): CapaResuelta {
    const base = { ...comun, tipo: 'patron' as const, motivo: capa.motivo, rect: r, color: color(capa.color), giro: capa.giro, ...conTinta(marcas) };
    if (capa.motivo !== 'palabra') return { ...base, paso: capa.paso, radios: capa.tamano, desvanece: capa.desvanece, angulo: capa.angulo };
    if (!capa.texto || !capa.estilo) throw new RangeError(`«${capa.id}»: un patrón de palabra necesita «texto» y «estilo».`);
    const e = estilo(capa.estilo);
    // Cada fila ocupa lo mismo; el interlineado del estilo decide cuánto aire queda entre una y otra.
    const avanceFila = r.h / capa.filas;
    return {
      ...base,
      texto: this.motor.aplicarCaso(texto(capa.texto), e.caso),
      estilo: aEstiloResuelto(e, color, capa.color),
      tamano: redondear3(avanceFila / e.interlineado),
      filas: capa.filas,
      avanceFila: redondear3(avanceFila),
      desfase: capa.desfase,
      separacion: capa.separacion,
      contornoAlterno: capa.contornoAlterno,
    };
  }

  /** Un trazo a mano: dónde empieza y acaba, según el texto al que acompaña o el punto del sujeto que señala. */
  private resolverTrazo(capa: CapaDe<'trazo'>, comun: Comun, resueltas: Map<string, CapaResuelta>, lienzo: Lienzo, color: string, semilla: number): CapaResuelta {
    const base = { ...comun, tipo: 'trazo' as const, gesto: capa.gesto, curva: capa.curva, cabeza: capa.cabeza, color, grosor: capa.grosor, temblor: capa.temblor, huecos: capa.huecos, semilla };
    const px = (p: { x: number; y: number }) => ({ x: p.x * lienzo.ancho, y: p.y * lienzo.alto });

    if (capa.gesto === 'flecha') {
      if (!capa.desde) throw new RangeError(`«${capa.id}»: una flecha necesita «desde».`);
      let hasta: { x: number; y: number };
      if (capa.hacia) {
        const sujeto = this.recorteDe(resueltas, capa.hacia.sujeto, capa.id);
        const d = sujeto.destino;
        hasta = girarPunto({ x: d.x + capa.hacia.punto.x * d.w, y: d.y + capa.hacia.punto.y * d.h }, sujeto.giro ?? 0, d.x + d.w / 2, d.y + d.h / 2);
      } else if (capa.hasta) hasta = px(capa.hasta);
      else throw new RangeError(`«${capa.id}»: una flecha necesita «hasta» o «hacia».`);
      return { ...base, desde: redondearPunto(px(capa.desde)), hasta: redondearPunto(hasta) };
    }

    if (!capa.de) {
      if (!capa.desde || !capa.hasta) throw new RangeError(`«${capa.id}»: el gesto «${capa.gesto}» necesita «de» (un texto) o «desde» y «hasta».`);
      const a = px(capa.desde);
      const b = px(capa.hasta);
      return { ...base, desde: redondearPunto(a), hasta: redondearPunto(b), ...(capa.gesto === 'circulo' ? { rect: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) } } : {}) };
    }

    const texto = resueltas.get(capa.de);
    if (!texto || texto.tipo !== 'texto') throw new RangeError(`«${capa.id}» acompaña a «${capa.de}», que no es un texto visible.`);
    if (capa.gesto === 'circulo') {
      // El círculo rodea el bloque entero, con aire: más a los lados que arriba y abajo.
      const c = texto.caja;
      const aireX = Math.max(18, c.h * 0.42);
      const aireY = Math.max(12, c.h * 0.3);
      const r = { x: c.x - aireX, y: c.y - aireY, w: c.w + 2 * aireX, h: c.h + 2 * aireY };
      return { ...base, desde: redondearPunto({ x: r.x, y: r.y }), hasta: redondearPunto({ x: r.x + r.w, y: r.y + r.h }), rect: r };
    }
    // Subrayado y tachado van con la última línea, en el sistema del bloque (así giran con el texto).
    const linea = texto.lineas.at(-1)!;
    const fin = linea.fin ?? linea.x + linea.ancho;
    const inicio = fin - linea.ancho;
    const mayuscula = this.motor.alturaMayusculas(texto.estilo, linea.tamano);
    const y = capa.gesto === 'subrayado' ? linea.base + Math.max(8, linea.tamano * 0.17) + capa.grosor / 2 : linea.base - mayuscula * 0.46;
    const vuelo = linea.ancho * 0.03;
    // Un subrayado a mano sube un poco hacia la derecha; el tachado, algo más.
    const sube = linea.ancho * (capa.gesto === 'subrayado' ? 0.012 : 0.03);
    return {
      ...base,
      desde: redondearPunto(aplicarMatriz(texto.matriz, inicio - vuelo, y + sube / 2)),
      hasta: redondearPunto(aplicarMatriz(texto.matriz, fin + vuelo, y - sube / 2)),
    };
  }

  /** Rect del sujeto que va detrás de la última letra de un texto, a escala de su altura de mayúscula. */
  private trasTexto(capa: CapaDe<'recorte'>, resueltas: Map<string, CapaResuelta>, bbox: Rect): Rect {
    const ancla = capa.trasTexto!;
    const texto = resueltas.get(ancla.texto);
    if (!texto || texto.tipo !== 'texto') throw new RangeError(`«${capa.id}» va tras «${ancla.texto}», que no es un texto visible.`);
    if (texto.rotacion !== 0 || texto.giro) throw new RangeError(`«${capa.id}»: colocar tras un texto girado no está soportado.`);
    const linea = texto.lineas.at(-1)!;
    const mayuscula = this.motor.alturaMayusculas(texto.estilo, linea.tamano);
    const h = ancla.alto * mayuscula;
    const w = (bbox.w * h) / bbox.h;
    const [, , , , ex, ey] = texto.matriz;
    const fin = linea.fin ?? linea.x + linea.ancho;
    return { x: ex + fin + ancla.separacion * mayuscula, y: ey + linea.base - ancla.elevacion * mayuscula - h, w, h };
  }

  /** La silueta del sujeto con el que se recorta una capa («recortarCon»), si lo pide. */
  private siluetaDe(resueltas: Map<string, CapaResuelta>, capa: { id: string; recortarCon?: { sujeto: string; modo: 'dentro' | 'fuera' } }): RecorteDeTexto | undefined {
    if (!capa.recortarCon) return undefined;
    const sujeto = this.recorteDe(resueltas, capa.recortarCon.sujeto, capa.id);
    return { activo: sujeto.activo, origen: sujeto.origen, destino: sujeto.destino, giro: sujeto.giro ?? 0, modo: capa.recortarCon.modo };
  }

  private recorteDe(resueltas: Map<string, CapaResuelta>, id: string, quien: string): CapaRecorteResuelta {
    const capa = resueltas.get(id);
    if (!capa || capa.tipo !== 'recorte') throw new RangeError(`«${quien}» depende de «${id}», que no es un recorte visible.`);
    return capa;
  }

  /** «detrás» mueve el texto en vertical hasta que el sujeto tape lo pedido; «noSolapar» y «cruza» miden y avisan. */
  private async aplicarRelaciones(
    intencion: Intencion,
    resueltas: Map<string, CapaResuelta>,
    activos: Record<string, ActivoDisponible>,
    lienzo: Lienzo,
    medidas: Resuelto['medidas'],
    problemas: Problema[],
  ): Promise<void> {
    const W = Math.round(lienzo.ancho * ESCALA_MEDIDA);
    const H = Math.round(lienzo.alto * ESCALA_MEDIDA);
    const alfaTexto = (capa: CapaTextoResuelta) =>
      alfaDeSvg(documentoSvg(lienzo, `<path d="${trazoDeTexto(this.motor, capa)}" transform="matrix(${capa.matriz.join(' ')})"/>`, ESCALA_MEDIDA), W, H);
    const alfasSujeto = new Map<string, Uint8Array>();
    const alfaSujeto = async (id: string) => {
      const sujeto = this.recorteDe(resueltas, id, 'relación');
      let alfa = alfasSujeto.get(id);
      if (!alfa) {
        const disponible = activos[sujeto.activo]!;
        alfa = await alfaDelSujeto(disponible.rutaMascara!, sujeto.origen, sujeto.destino, lienzo, ESCALA_MEDIDA, disponible.activo.ancho, disponible.activo.alto, sujeto.giro ?? 0);
        alfasSujeto.set(id, alfa);
      }
      return alfa;
    };
    const textoDe = (id: string) => {
      const capa = resueltas.get(id);
      if (!capa || capa.tipo !== 'texto') throw new RangeError(`La relación usa «${id}», que no es un texto visible.`);
      return capa;
    };

    for (const relacion of intencion.relaciones.filter((r) => r.tipo === 'detras')) {
      const capa = textoDe(relacion.texto);
      const sujeto = await alfaSujeto(relacion.sujeto);
      const medidor = medidorDeCobertura(await alfaTexto(capa), sujeto, W, H);
      const medir = (dy: number) => (relacion.medida === 'media' ? medidor.media(dy) : medidor.maxima(dy));
      const [minimo, maximo] = relacion.cobertura;
      const objetivo = (minimo + maximo) / 2;
      // Se busca el desplazamiento más pequeño que deje la cobertura dentro del rango (la caja de la intención manda).
      const permitido = (dy: number) => {
        if (!relacion.zona) return true;
        const y = capa.caja.y + dy / ESCALA_MEDIDA;
        return y >= relacion.zona.desde * lienzo.alto && y + capa.caja.h <= relacion.zona.hasta * lienzo.alto;
      };
      let mejor = { dy: 0, valor: permitido(0) ? medir(0) : -1 };
      for (let dy = -H; dy <= H; dy++) {
        if (!permitido(dy)) continue;
        const valor = medir(dy);
        const dentro = valor >= minimo && valor <= maximo;
        const mejorDentro = mejor.valor >= minimo && mejor.valor <= maximo;
        if ((dentro && (!mejorDentro || Math.abs(dy) < Math.abs(mejor.dy))) || (!dentro && !mejorDentro && Math.abs(valor - objetivo) < Math.abs(mejor.valor - objetivo))) {
          mejor = { dy, valor };
        }
      }
      const desplazamiento = mejor.dy / ESCALA_MEDIDA;
      capa.matriz[5] += desplazamiento;
      capa.caja = { ...capa.caja, y: capa.caja.y + desplazamiento };
      medidas.cobertura[capa.id] = redondear3(medidor.media(mejor.dy));
      medidas.cobertura[`${capa.id}:franja`] = redondear3(medidor.maxima(mejor.dy));
      if (mejor.valor < minimo || mejor.valor > maximo) {
        const que = relacion.medida === 'media' ? 'de media' : 'en su parte más tapada';
        problemas.push({ gravedad: 'AVISO', capa: capa.id, tipo: 'COBERTURA', mensaje: `El sujeto tapa ${pct(mejor.valor)} de «${capa.id}» ${que}; se pedía entre el ${pct(minimo)} y el ${pct(maximo)}.` });
      }
    }

    for (const relacion of intencion.relaciones.filter((r) => r.tipo === 'noSolapar')) {
      const sujeto = await alfaSujeto(relacion.sujeto);
      for (const id of relacion.textos) {
        const capa = textoDe(id);
        const valor = cobertura(await alfaTexto(capa), sujeto, W, H, 0);
        medidas.solape[id] = redondear3(valor);
        if (valor > relacion.maximo) {
          problemas.push({ gravedad: 'ERROR', capa: id, tipo: 'SOLAPE', mensaje: `«${id}» tapa el sujeto: el ${pct(valor)} de sus letras queda encima (máximo ${pct(relacion.maximo)}).` });
        }
      }
    }

    for (const relacion of intencion.relaciones.filter((r) => r.tipo === 'cruza')) {
      const capa = textoDe(relacion.texto);
      const valor = cobertura(await alfaTexto(capa), await alfaSujeto(relacion.sujeto), W, H, 0);
      medidas.solape[`${capa.id}:cruza`] = redondear3(valor);
      if (valor < relacion.minimo) {
        problemas.push({
          gravedad: 'AVISO',
          capa: capa.id,
          tipo: 'CRUCE',
          mensaje: `«${capa.id}» no toca al producto: solo el ${pct(valor)} de sus letras cae sobre él (se pedía al menos el ${pct(relacion.minimo)}). Titular y plato quedan como dos bloques apilados.`,
        });
      }
    }
  }

  private comprobar(resueltas: Map<string, CapaResuelta>, zona: Rect, problemas: Problema[]): void {
    for (const capa of resueltas.values()) {
      if (capa.tipo === 'texto') {
        // 4 px de tolerancia: las letras redondas sobresalen un poco de la línea base y eso es normal en tipografía.
        if (!capa.sangrado && !dentroDe(capa.caja, zona, 4)) {
          problemas.push({ gravedad: 'ERROR', capa: capa.id, tipo: 'ZONA_SEGURA', mensaje: `«${capa.id}» se sale de la zona segura (se cortaría en 4:5 o quedaría pegado al borde).` });
        }
        const menor = Math.min(...capa.lineas.map((l) => this.motor.alturaMayusculas(capa.estilo, l.tamano)));
        if (menor < ALTURA_MAYUSCULA_MINIMA) {
          problemas.push({ gravedad: 'ERROR', capa: capa.id, tipo: 'TAMANO_MINIMO', mensaje: `«${capa.id}» tiene mayúsculas de ${menor.toFixed(1)} px; el mínimo para leerse en el móvil es ${ALTURA_MAYUSCULA_MINIMA}.` });
        }
      }
      if (capa.tipo === 'niveles' || capa.tipo === 'circulo-texto') {
        const altura = this.motor.alturaMayusculas(capa.estilo, capa.tamano);
        if (altura < ALTURA_MAYUSCULA_MINIMA) {
          problemas.push({ gravedad: 'ERROR', capa: capa.id, tipo: 'TAMANO_MINIMO', mensaje: `«${capa.id}» tiene mayúsculas de ${altura.toFixed(1)} px; el mínimo es ${ALTURA_MAYUSCULA_MINIMA}.` });
        }
      }
      if (capa.tipo === 'sello') {
        // El dato del sello tiene que leerse: su línea más pequeña cumple el mismo mínimo que cualquier texto.
        const menor = Math.min(...capa.lineas.map((l) => this.motor.alturaMayusculas(l.estilo, l.tamano)));
        if (menor < ALTURA_MAYUSCULA_MINIMA) {
          problemas.push({ gravedad: 'ERROR', capa: capa.id, tipo: 'TAMANO_MINIMO', mensaje: `El texto de «${capa.id}» queda con mayúsculas de ${menor.toFixed(1)} px; el mínimo es ${ALTURA_MAYUSCULA_MINIMA}. Agranda el sello o acorta el texto.` });
        }
        if (!dentroDe(capa.caja, zona, 4)) {
          problemas.push({ gravedad: 'AVISO', capa: capa.id, tipo: 'ZONA_SEGURA', mensaje: `«${capa.id}» se sale de la zona segura: en 4:5 se cortará. Si es a propósito, comprueba que el dato se lee entero.` });
        }
      }
    }
    this.comprobarSeparacion(resueltas, problemas);
  }

  /** Dos textos apilados (uno encima del otro, compartiendo columna) necesitan aire entre ellos. Se mide la tinta. */
  private comprobarSeparacion(resueltas: Map<string, CapaResuelta>, problemas: Problema[]): void {
    const textos = [...resueltas.values()]
      .filter((c): c is CapaTextoResuelta => c.tipo === 'texto' && c.rotacion === 0 && !c.giro && c.opacidad > 0)
      .map((c) => ({ c, cuerpo: Math.min(...c.lineas.map((l) => l.tamano)) }))
      .sort((a, b) => a.c.caja.y - b.c.caja.y);
    for (let i = 0; i < textos.length; i++) {
      for (let j = i + 1; j < textos.length; j++) {
        const arriba = textos[i]!;
        const abajo = textos[j]!;
        const a = arriba.c.caja;
        const b = abajo.c.caja;
        const compartenColumna = a.x < b.x + b.w && b.x < a.x + a.w;
        if (!compartenColumna) continue;
        // La misma palabra dos veces en el mismo sitio (rellena fuera del sujeto y en contorno dentro) es un solo bloque.
        if (arriba.c.texto === abajo.c.texto && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2) continue;
        const hueco = b.y - (a.y + a.h);
        const minimo = SEPARACION_MINIMA_EN_CUERPOS * Math.min(arriba.cuerpo, abajo.cuerpo);
        if (hueco < minimo) {
          const que = hueco < 0 ? `se montan ${Math.round(-hueco)} px` : `quedan a ${Math.round(hueco)} px`;
          problemas.push({ gravedad: 'AVISO', capa: abajo.c.id, tipo: 'SEPARACION', mensaje: `«${arriba.c.id}» y «${abajo.c.id}» ${que}: deja al menos ${Math.round(minimo)} px para que respiren.` });
        }
      }
    }
  }
}

function avisarAmpliacion(problemas: Problema[], capa: string, escala: number, activo: Activo): void {
  if (escala > AMPLIACION_MAXIMA) {
    problemas.push({
      gravedad: 'AVISO',
      capa,
      tipo: 'RESOLUCION',
      mensaje: `La foto «${activo.id}» se amplía ${escala.toFixed(2)}× (${activo.ancho} × ${activo.alto} px): se verá blanda. Hace falta una foto con más resolución o usarla más pequeña.`,
    });
  }
}

/** Los colores del retoque pueden ser tokens de la marca: aquí se pasan a HEX. */
function conColorResuelto(retoque: Retoque | undefined, color: (valor: Color) => string): Retoque | undefined {
  if (!retoque || (!retoque.puntoNegro && !retoque.duotono && !retoque.tramado)) return retoque;
  return {
    ...retoque,
    ...(retoque.puntoNegro ? { puntoNegro: color(retoque.puntoNegro) } : {}),
    ...(retoque.duotono ? { duotono: { sombras: color(retoque.duotono.sombras), luces: color(retoque.duotono.luces) } } : {}),
    ...(retoque.tramado ? { tramado: { ...retoque.tramado, tinta: color(retoque.tramado.tinta), ...(retoque.tramado.papel ? { papel: color(retoque.tramado.papel) } : {}) } } : {}),
  };
}

/** La tinta impresa con su semilla y su color de registro. Sin ningún efecto pedido, no hay tinta. */
function resolverTinta(tinta: Tinta | undefined, color: (valor: Color) => string, propio: string, identidad: string): TintaResuelta | undefined {
  if (!tinta || (tinta.densidad === 0 && tinta.bordeSeco === 0 && !tinta.registro)) return undefined;
  return {
    densidad: tinta.densidad,
    bordeSeco: tinta.bordeSeco,
    ...(tinta.registro ? { registro: { dx: tinta.registro.dx, dy: tinta.registro.dy, color: tinta.registro.color ? color(tinta.registro.color) : propio, opacidad: tinta.registro.opacidad } } : {}),
    semilla: tinta.semilla ?? semillaDe(identidad),
  };
}

const conTinta = (tinta: TintaResuelta | undefined) => (tinta ? { tinta } : {});
const conRecorte = (recorte: RecorteDeTexto | undefined) => (recorte ? { recorte } : {});

export function resolverColor(intencion: Intencion, valor: Color): string {
  if (!valor.startsWith('@')) return valor.toUpperCase();
  const hex = intencion.tokens.colores[valor.slice(1)];
  if (!hex) throw new RangeError(`El color «${valor}» no está en los tokens de la marca ni de la pieza.`);
  return hex.toUpperCase();
}

function resolverEstilo(intencion: Intencion, id: string): EstiloTexto {
  const estilo = intencion.tokens.estilos[id];
  if (!estilo) throw new RangeError(`El estilo «${id}» no está en los tokens.`);
  return estilo;
}

function resolverTexto(intencion: Intencion, valor: string): string {
  if (!valor.startsWith('@')) return valor;
  const contenido = intencion.textos[valor.slice(1)];
  if (contenido === undefined) throw new RangeError(`El texto «${valor}» no está en «textos».`);
  return contenido;
}

/** `colorPropio`: el color de la capa manda sobre el del estilo (un sello escribe con su tinta, no con la del token). */
function aEstiloResuelto(estilo: EstiloTexto, color: (valor: Color) => string, colorPropio?: Color): EstiloResuelto {
  return {
    fuente: estilo.fuente,
    ejes: estilo.ejes,
    caso: estilo.caso,
    tracking: estilo.tracking,
    color: color(colorPropio ?? estilo.color),
    ...(estilo.rasgos.length ? { rasgos: estilo.rasgos } : {}),
  };
}

function transformarRect(r: Rect, m: Matriz): Rect {
  const puntos = [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ].map(([x, y]) => [m[0] * x! + m[2] * y! + m[4], m[1] * x! + m[3] * y! + m[5]] as const);
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

const aplicarMatriz = (m: Matriz, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/** La misma matriz con un giro (grados, sentido horario en pantalla) alrededor de un punto del lienzo. */
function girarMatriz(m: Matriz, grados: number, cx: number, cy: number): Matriz {
  const a = (grados * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    cos * m[0] - sin * m[1],
    sin * m[0] + cos * m[1],
    cos * m[2] - sin * m[3],
    sin * m[2] + cos * m[3],
    cos * (m[4] - cx) - sin * (m[5] - cy) + cx,
    sin * (m[4] - cx) + cos * (m[5] - cy) + cy,
  ];
}

function girarPunto(p: { x: number; y: number }, grados: number, cx: number, cy: number): { x: number; y: number } {
  if (grados === 0) return p;
  const a = (grados * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

const acotar = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));
const redondear3 = (n: number) => Math.round(n * 1000) / 1000;
const redondearPunto = (p: { x: number; y: number }) => ({ x: redondear3(p.x), y: redondear3(p.y) });
const pct = (n: number) => `${Math.round(n * 100)} %`;
