import type { z } from 'zod';
import type { BriefDelEncargo } from '../../dominio/brief.js';
import { mulberry32, semillaDe } from '../../dominio/diseno/azar.js';
import { contraste, croma, mezclar } from '../../dominio/diseno/color.js';
import { Capa, Intencion, type Tokens } from '../../dominio/diseno/intencion.js';
import type { MapaDeFoto } from '../../dominio/diseno/mapaDeFoto.js';
import type { CartelEditorial } from '../../dominio/editorial.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { acentoQuePide } from '../diseno/proponerDiseno.js';
import { fichaDeCartel, textoConfirmado } from './editorial.js';

type Caja = { x: number; y: number; w: number; h: number };
const lienzo: Caja = { x: 0, y: 0, w: 1, h: 1 };

/** Dos cuerpos para un solo nombre. Conserva cada palabra y su orden en la fuente editable. */
function titularEnDosCuerpos(nombre: string): { completo: string; grande?: number } {
  const de = /^(.{2,22}?\s+de(?:l| la| los| las)?)\s+(\S{3,15})$/iu.exec(nombre);
  if (de) return { completo: de[1] + '\n' + de[2], grande: 1 };
  const modo = /^(\S{3,15})\s+(a (?:la|las|los)\s+.{2,22})$/iu.exec(nombre);
  if (modo) return { completo: modo[1] + '\n' + modo[2], grande: 0 };
  return { completo: nombre };
}

function columnaLibre(mapa?: MapaDeFoto): 'izquierda' | 'derecha' {
  if (!mapa) return 'izquierda';
  let suma = 0;
  for (let i = 0; i < mapa.detalle.length; i++) {
    const mitad = (i % mapa.columnas) < mapa.columnas / 2 ? -1 : 1;
    suma += mitad * ((mapa.ocupacion[i] ?? 0) * 3 + mapa.detalle[i]!);
  }
  return suma >= 0 ? 'izquierda' : 'derecha';
}

/** El canto irregular delimita el papel donde va la firma. La semilla conserva el mismo corte en cada reanudación. */
function cantoDePapel(semilla: number) {
  const azar = mulberry32(semilla);
  return Array.from({ length: 21 }, (_, i) => ({ x: i / 20, y: 0.861 + i * 0.00065 + (azar() - 0.5) * 0.009 }))
    .concat([{ x: 1, y: 1 }, { x: 0, y: 1 }]);
}

export function componerCartel(
  pagina: CartelEditorial, brief: BriefDelEncargo, marca: Tokens, activo: string, mapa?: MapaDeFoto,
): Intencion {
  const valor = textoConfirmado(brief, pagina.texto);
  if (!valor) throw new ErrorDeUsuario('El cartel necesita un dato confirmado.');
  const { completo, grande } = titularEnDosCuerpos(valor);
  const colores = Object.values(marca.colores);
  const negro = [...colores, '#201E19'].sort((a, b) => contraste(b, '#ffffff') - contraste(a, '#ffffff'))[0]!;
  const acento = [...colores].sort((a, b) => croma(b) - croma(a))[0];
  const pigmento = acento && croma(acento) > 0.045 ? acento : mapa?.vivo ?? '#B8A481';
  const papel = mezclar(pigmento, '#FBF5E8', 0.86);
  const fondo = contraste(pigmento, negro) >= 4.5 ? pigmento : mezclar(pigmento, papel, 0.68);
  const tinta = contraste(negro, fondo) >= 4.5 ? negro : '#111111';
  const firma = pagina.firma && brief.marca.nombre.trim() && brief.marca.nombre.trim() !== valor;
  const textos = { nombre: completo, ...(firma ? { firma: brief.marca.nombre.trim() } : {}) };
  const voz = marca.estilos.titular ?? Object.values(marca.estilos)[0];
  const rotulo = marca.estilos.rotulo ?? marca.estilos.texto ?? voz;
  const semilla = semillaDe(brief.proyecto + activo);
  const vertical = pagina.estructura === 'EJE_VERTICAL';
  const impreso = pagina.superficie === 'PAPEL';
  const recorte = Boolean(mapa?.sujeto && mapa.sujeto.area > 0.025 && mapa.sujeto.area < 0.93);
  const lado = columnaLibre(mapa);
  const izquierda = lado === 'izquierda';
  const caja = (x: number, y: number, w: number, h: number): Caja => ({ x: izquierda ? x : 1 - x - w, y, w, h });
  const capas: z.input<typeof Capa>[] = [];
  const relaciones: Intencion['relaciones'] = [];
  const estilos = Object.values(marca.estilos);
  const acentoDeMarca = estilos.find(e => /italica|script|sacramento|caveat|ballet/.test(e.fuente));
  const vozDeAcento = acentoDeMarca ?? acentoQuePide(fichaDeCartel(brief.editorial?.fichaReferencia)) ?? { fuente: 'instrument-serif-italica' };
  const inicioSujeto = mapa?.sujeto ? (mapa.sujeto.fila[0] - 1) / mapa.filas : 0.20;
  const margenDeFoto = Math.max(0, 0.307 - inicioSujeto);
  const comienzoLateral = mapa?.sujeto
    ? (izquierda ? mapa.sujeto.col[0] - 1 : mapa.columnas - mapa.sujeto.col[1]) / mapa.columnas : 0;
  // Reducir una toma que ya llega hasta el borde conserva en su sitio el canto cortado de la foto.
  const escalaLateral = Math.min(1, 0.68 / (1 - comienzoLateral));
  const marco = vertical ? caja(1 - escalaLateral, 0.21, escalaLateral, escalaLateral) : { ...lienzo, y: margenDeFoto };
  const baseFoto = { tipo: 'imagen' as const, id: 'foto', activo: 'foto', caja: marco };
  const fondoFoto = !impreso && recorte;
  capas.push({ tipo: 'relleno', id: 'fondo', color: impreso ? fondo : papel });
  if (fondoFoto) capas.push(baseFoto);
  if (!impreso && recorte && !vertical) {
    capas.push({ tipo: 'degradado', id: 'luz-de-cabecera', forma: 'lineal', angulo: 90,
      caja: { x: 0, y: 0, w: 1, h: 0.40 }, paradas: [
        { en: 0, color: papel, opacidad: 1 }, { en: 0.51, color: papel, opacidad: 1 }, { en: 1, color: papel, opacidad: 0 },
      ] });
  }
  if (!impreso && recorte && vertical) {
    capas.push({ tipo: 'forma', id: 'papel', figura: 'rect', color: papel, caja: caja(0, 0, 0.40, 1) });
  }
  if (impreso) {
    capas.push({ tipo: 'textura', id: 'fibra', recurso: 'papel', intensidad: 0.16, fusion: 'soft-light', semilla });
  }
  if (!recorte) {
    // Conservar una foto sin silueta como fotografía, con el espacio de lectura reservado fuera de su marco.
    capas.push({ ...baseFoto, caja: vertical ? caja(0.40, 0.19, 0.60, 0.64) : { x: 0, y: 0.34, w: 1, h: 0.52 } });
  }
  const titulo = vertical ? caja(0.072, 0.172, 0.307, 0.66) : { x: 0.067, y: 0.163, w: 0.866, h: 0.165 };
  capas.push({ tipo: 'texto', id: 'titular', texto: '@nombre', estilo: 'voz', caja: titulo, ajuste: 'caja',
    alinear: 'centro', vertical: 'centro', rotacion: vertical ? izquierda ? -90 : 90 : 0,
    ...(grande !== undefined ? { linea: grande } : {}), ...(impreso ? { tinta: { densidad: 0.07, bordeSeco: 0.012, semilla } } : {}) });
  relaciones.push({ tipo: 'contrasteMinimo', texto: 'titular', ratio: 3 });
  if (recorte) {
    if (impreso) {
      const ancla = vertical ? caja(0.335, 0.245, 0.713, 0.59) : { x: -0.01, y: 0.28, w: 1.02, h: 0.58 };
      capas.push({ tipo: 'sombra', id: 'sombra', de: 'plato', modo: 'proyectada', opacidad: 0.23, desenfoque: 19, desplazamiento: { x: 4, y: 10 } });
      capas.push({ tipo: 'recorte', id: 'plato', activo: 'foto', escala: { anchoSujeto: ancla.w }, ancla: { caja: ancla, alinear: vertical ? 'centro' : 'arriba-centro' }, contraerBorde: 1 });
    } else {
      capas.push({ tipo: 'recorte', id: 'plato', activo: 'foto', alineadoCon: 'foto', contraerBorde: 1 });
    }
    relaciones.push({ tipo: 'noSolapar', textos: ['titular'], sujeto: 'plato', maximo: 0.21 });
  }
  if (grande !== undefined) {
    const prefijo = vertical ? caja(0.425, 0.107, 0.50, 0.08) : { x: 0.074, y: 0.084, w: 0.51, h: 0.049 };
    capas.push({ tipo: 'texto', id: 'inflexion', texto: '@nombre', linea: 1 - grande, estilo: 'acento', caja: prefijo,
      ajuste: 'caja', alinear: vertical && !izquierda ? 'derecha' : 'izquierda', vertical: 'centro' });
    relaciones.push({ tipo: 'contrasteMinimo', texto: 'inflexion', ratio: 3 });
  }
  if (firma) {
    if (impreso) capas.push({ tipo: 'forma', id: 'pie', figura: 'poligono', puntos: cantoDePapel(semilla), color: papel });
    else if (vertical) capas.push({ tipo: 'forma', id: 'pie', figura: 'rect', caja: { x: 0, y: 0.86, w: 1, h: 0.14 }, color: papel });
    const firmaArriba = !impreso && !vertical;
    const cajaFirma = firmaArriba ? { x: 0.58, y: 0.091, w: 0.348, h: 0.026 } : { x: 0.075, y: 0.887, w: 0.85, h: 0.021 };
    capas.push({ tipo: 'texto', id: 'firma', texto: '@firma', estilo: 'firma', caja: cajaFirma,
      ajuste: 'caja', vertical: 'centro', alinear: firmaArriba ? 'derecha' : 'izquierda' });
    relaciones.push({ tipo: 'contrasteMinimo', texto: 'firma', ratio: 4.5 });
  }
  return Intencion.parse({
    esquema: 'diseno/intencion@1', id: 'post', version: 1, marca: brief.local, titulo: brief.marca.nombre + ' · portada',
    notas: `Cartel · ${pagina.estructura} · ${pagina.superficie}. Columna tranquila a la ${lado}. ${recorte ? 'Silueta de la toma elegida.' : 'Fotografía en su marco.'}`,
    activos: { foto: activo }, textos, capas, relaciones,
    tokens: { estilos: {
      voz: { ...voz, fuente: voz?.fuente ?? 'league-gothic', caso: 'mayusculas', interlineado: 0.90, tracking: -0.012, color: tinta },
      acento: { ...vozDeAcento, caso: 'tal-cual', tracking: -0.012, color: tinta },
      firma: { ...rotulo, fuente: rotulo?.fuente ?? 'archivo', caso: 'mayusculas', tracking: 0.12, color: negro },
    } },
  });
}
