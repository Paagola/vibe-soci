/**
 * Resolutor: de la intención (retícula, relaciones, tokens) al documento resuelto (píxeles).
 * Decide tamaños, posiciones y ejes de las fuentes; comprueba las reglas y anota los problemas.
 * No pinta: eso lo hace el renderizador con el documento que sale de aquí.
 */
import type { Activo } from '../../dominio/activos.js';
import type { Caja, Capa, CapaDe, Color, EstiloTexto, Intencion, Retoque } from '../../dominio/diseno/intencion.js';
import type { CapaResuelta, EstiloResuelto, Problema, Resuelto } from '../../dominio/diseno/resuelto.js';
import { alinearEn, dentroDe, lienzoDe, rectDeCaja, zonaSegura, type Lienzo, type Rect } from '../../dominio/diseno/reticula.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
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

type Matriz = [number, number, number, number, number, number];

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

    const trasTexto: Array<{ capa: CapaDe<'recorte'>; comun: { id: string; z: number; opacidad: number; fusion: CapaResuelta['fusion'] } }> = [];

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
          resueltas.set(capa.id, { ...comun, tipo: 'recorte', activo: capa.activo, origen: { ...bbox }, destino, sujeto: destino, retoque: conColorResuelto(capa.retoque, color), bordeSuave: capa.bordeSuave, contraerBorde: capa.contraerBorde });
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
          });
          break;
        }
        case 'texto':
          resueltas.set(capa.id, this.resolverTexto(capa, comun, rect(capa.caja), estilo(capa.estilo), color, texto(capa.texto)));
          break;
        case 'forma':
          resueltas.set(capa.id, {
            ...comun,
            tipo: 'forma',
            figura: capa.figura,
            rect: capa.caja ? rect(capa.caja) : undefined,
            desde: capa.desde && { x: capa.desde.x * lienzo.ancho, y: capa.desde.y * lienzo.alto },
            hasta: capa.hasta && { x: capa.hasta.x * lienzo.ancho, y: capa.hasta.y * lienzo.alto },
            color: color(capa.color),
            grosor: capa.grosor,
            discontinua: capa.discontinua,
          });
          break;
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
      resueltas.set(capa.id, { ...comun, tipo: 'recorte', activo: capa.activo, origen: { ...activo.mascara.bbox }, destino, sujeto: destino, retoque: conColorResuelto(capa.retoque, color), bordeSuave: capa.bordeSuave, contraerBorde: capa.contraerBorde });
    }
    this.comprobar(intencion, resueltas, zona, problemas);

    return {
      esquema: 'diseno/resuelto@1',
      intencion: { id: intencion.id, version: intencion.version },
      lienzo,
      zonaSegura: zona,
      capas: [...resueltas.values()].sort((a, b) => a.z - b.z),
      medidas,
      problemas,
      activos: Object.fromEntries(
        Object.entries(activos).map(([papel, { activo }]) => [papel, { id: activo.id, sha256: activo.sha256, uso: activo.uso, tipo: activo.tipo, alteraciones: activo.alteraciones }]),
      ),
    };
  }

  private resolverTexto(
    capa: CapaDe<'texto'>,
    comun: { id: string; z: number; opacidad: number; fusion: CapaResuelta['fusion'] },
    marco: Rect,
    estilo: EstiloTexto,
    color: (valor: Color) => string,
    contenido: string,
  ): CapaTextoResuelta {
    const girado = capa.rotacion !== 0;
    const local = { x: 0, y: 0, w: girado ? marco.h : marco.w, h: girado ? marco.w : marco.h };
    const bloque = this.motor.componer({
      texto: contenido,
      estilo: { fuente: estilo.fuente, ejes: estilo.ejes, caso: estilo.caso, tracking: estilo.tracking, interlineado: estilo.interlineado },
      caja: local,
      ajuste: capa.ajuste,
      tamano: capa.tamano,
      alinear: capa.alinear,
      vertical: capa.vertical,
    });
    // Del sistema del bloque (sin girar) al lienzo. −90: se lee de abajo arriba; 90: de arriba abajo.
    const matriz: Matriz =
      capa.rotacion === 0
        ? [1, 0, 0, 1, marco.x, marco.y]
        : capa.rotacion === -90
          ? [0, -1, 1, 0, marco.x, marco.y + marco.h]
          : [0, 1, -1, 0, marco.x + marco.w, marco.y];
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
    };
  }

  /** Rect del sujeto que va detrás de la última letra de un texto, a escala de su altura de mayúscula. */
  private trasTexto(capa: CapaDe<'recorte'>, resueltas: Map<string, CapaResuelta>, bbox: Rect): Rect {
    const ancla = capa.trasTexto!;
    const texto = resueltas.get(ancla.texto);
    if (!texto || texto.tipo !== 'texto') throw new RangeError(`«${capa.id}» va tras «${ancla.texto}», que no es un texto visible.`);
    if (texto.rotacion !== 0) throw new RangeError(`«${capa.id}»: colocar tras un texto girado no está soportado.`);
    const linea = texto.lineas.at(-1)!;
    const mayuscula = this.motor.alturaMayusculas(texto.estilo, linea.tamano);
    const h = ancla.alto * mayuscula;
    const w = (bbox.w * h) / bbox.h;
    const [, , , , ex, ey] = texto.matriz;
    const fin = linea.fin ?? linea.x + linea.ancho;
    return { x: ex + fin + ancla.separacion * mayuscula, y: ey + linea.base - ancla.elevacion * mayuscula - h, w, h };
  }

  private recorteDe(resueltas: Map<string, CapaResuelta>, id: string, quien: string): CapaRecorteResuelta {
    const capa = resueltas.get(id);
    if (!capa || capa.tipo !== 'recorte') throw new RangeError(`«${quien}» depende de «${id}», que no es un recorte visible.`);
    return capa;
  }

  /** «detrás» mueve el texto en vertical hasta que el sujeto tape lo pedido; «noSolapar» mide y avisa. */
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
        alfa = await alfaDelSujeto(disponible.rutaMascara!, sujeto.origen, sujeto.destino, lienzo, ESCALA_MEDIDA, disponible.activo.ancho, disponible.activo.alto);
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
  }

  private comprobar(intencion: Intencion, resueltas: Map<string, CapaResuelta>, zona: Rect, problemas: Problema[]): void {
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
    }
    this.comprobarSeparacion(resueltas, problemas);
    void intencion;
  }

  /** Dos textos apilados (uno encima del otro, compartiendo columna) necesitan aire entre ellos. Se mide la tinta. */
  private comprobarSeparacion(resueltas: Map<string, CapaResuelta>, problemas: Problema[]): void {
    const textos = [...resueltas.values()]
      .filter((c): c is CapaTextoResuelta => c.tipo === 'texto' && c.rotacion === 0 && c.opacidad > 0)
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

/** El punto negro del retoque puede ser un token de la marca: aquí se pasa a HEX. */
function conColorResuelto(retoque: Retoque | undefined, color: (valor: Color) => string): Retoque | undefined {
  if (!retoque?.puntoNegro) return retoque;
  return { ...retoque, puntoNegro: color(retoque.puntoNegro) };
}

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

function aEstiloResuelto(estilo: EstiloTexto, color: (valor: Color) => string): EstiloResuelto {
  return { fuente: estilo.fuente, ejes: estilo.ejes, caso: estilo.caso, tracking: estilo.tracking, color: color(estilo.color) };
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

const acotar = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));
const redondear3 = (n: number) => Math.round(n * 1000) / 1000;
const pct = (n: number) => `${Math.round(n * 100)} %`;
