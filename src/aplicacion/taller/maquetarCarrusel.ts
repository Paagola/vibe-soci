import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CompositorSharp } from '../../adaptadores/compositor/CompositorSharp.js';
import { ALTURA_MAYUSCULA_MINIMA } from '../../adaptadores/compositor/resolutor.js';
import { CatalogoTipografico } from '../../adaptadores/compositor/tipografias.js';
import { MotorTexto } from '../../adaptadores/compositor/MotorTexto.js';
import { contraste, mezclar } from '../../dominio/diseno/color.js';
import { Intencion, type CapaDe } from '../../dominio/diseno/intencion.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { FotoDePagina, GuionEditorial, PaginaEditorial, SecuenciaTaller } from '../../dominio/secuenciaTaller.js';
import type { PaginaDeSerie, SerieDelTaller } from '../../dominio/serieTaller.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import { huella } from './direccion.js';
import { activoFoto, guardarSerie, type BaseDeSerie } from './serie.js';

type Pieza = SerieDelTaller['paginas'][number];
type Foto = { sha256: string; bytes: Buffer; ruta?: string };
type Caja = { x: number; y: number; w: number; h: number };
type Preparacion = {
  marca: string;
  primerPlano?: (pagina: number, id: FotoDePagina) => Promise<Buffer | undefined>;
};
const W = 1080, H = 1350;
const lienzo = { x: 0, y: 0, w: 1, h: 1 };
const papel = '#F6F4E9';
const paletas = {
  HERBAL: { fondo: '#DCED98', tinta: '#243729' },
  MINERAL: { fondo: '#DCE5ED', tinta: '#253247' },
  FRUTA: { fondo: '#F1D5CB', tinta: '#48283A' },
};
const estilo = (fuente: string, ejes: Record<string, number> = {}) => ({ fuente, ejes, caso: 'tal-cual' as const, tracking: -.015, interlineado: 1.02 });
const voz = estilo('bodoni-moda', { wght: 760, opsz: 60 });
const vozEnProfundidad = estilo('fraunces', { wght: 870, opsz: 70, SOFT: 35, WONK: 1 });
const cursiva = estilo('instrument-serif-italica');
const pie = estilo('archivo', { wght: 650, wdth: 100 });
const caja = (x: number, y: number, w: number, h: number): Caja => ({ x: x / W, y: y / H, w: w / W, h: h / H });

function planDeCapas(
  numero: number, marca: string, p: PaginaEditorial, e: PaginaDeSerie, activos: Record<string, ActivoDisponible>,
  paleta: (typeof paletas)[keyof typeof paletas], motor: MotorTexto, colorTexto: string, variante: 'NORMAL' | 'PAPEL' | 'PROFUNDIDAD',
) {
  let tratamiento: Pieza['tratamiento'] = p.tratamiento === 'ARCO' ? 'MARCO_ARQUEADO' : p.tratamiento === 'TEXTO_EN_AIRE' ? 'TITULO_EN_AIRE' : p.tratamiento;
  const { tinta, fondo } = paleta;
  const capas: unknown[] = [];
  const textos: Record<string, string> = {};
  const relaciones: unknown[] = [];
  const estilos = {
    voz: { ...(variante === 'PROFUNDIDAD' ? vozEnProfundidad : voz), color: colorTexto },
    cursiva: { ...cursiva, color: colorTexto }, pie: { ...pie, color: colorTexto },
  };
  const texto = (id: string, literal: string, estilo: keyof typeof estilos, cajaDeTexto: Caja, alinear = 'izquierda') => {
    if (!literal) return;
    textos[id] = literal;
    capas.push({ tipo: 'texto', id, texto: '@' + id, estilo, caja: cajaDeTexto, alinear, vertical: 'centro', ajuste: 'caja' });
  };
  const foto = (i: number, marco: Caja, ventana?: CapaDe<'imagen'>['ventana']) => capas.push({
    tipo: 'imagen', id: 'foto-' + (i + 1), activo: p.fotos[i], caja: marco, ventana,
    enfoque: p.encuadres?.[i], zoom: p.encuadres?.[i]?.zoom,
  });
  const relleno = (color: string) => capas.push({ tipo: 'relleno', id: 'fondo', color });
  const filete = (id: string, x1: number, x2: number, y: number) => capas.push({
    tipo: 'forma', id, figura: 'linea', desde: { x: x1 / W, y: y / H }, hasta: { x: x2 / W, y: y / H }, color: tinta, grosor: 2.5,
  });

  switch (p.tratamiento) {
    case 'FOTO':
      foto(0, lienzo);
      break;
    case 'ARCO': {
      relleno(fondo);
      capas.push({ tipo: 'forma', id: 'filete-arco', figura: 'arco', caja: caja(90, 389, 900, 862), color: tinta, grosor: 2.5 });
      foto(0, caja(108, 407, 864, 826), { forma: 'arco' });
      const radio = 430;
      const arco = Math.min(55, Math.max(24, e.apoyo.length * 5.15));
      const tamano = Math.min(47, (arco * Math.PI / 180 * radio) * .82 / Math.max(1, motor.avance(pie, e.apoyo, 1)));
      if (e.apoyo && tamano >= 36 && motor.alturaMayusculas(pie, tamano) >= ALTURA_MAYUSCULA_MINIMA) {
        textos.apoyo = e.apoyo;
        capas.push({ tipo: 'circulo-texto', id: 'apoyo', texto: '@apoyo', estilo: 'pie', centro: { x: .5, y: 561 / H },
          radio: radio / W, giro: -arco / 2, arco, tamano });
      } else texto('apoyo', e.apoyo, 'pie', caja(136, 84, 808, 63), 'centro');
      texto('titular', e.titulo, 'voz', caja(82, 183, 916, 217), 'centro');
      break;
    }
    case 'DIPTICO':
      relleno(papel);
      texto('titular', e.titulo, 'cursiva', caja(72, 77, 936, 174));
      filete('filete-titular', 72, 1008, 270);
      foto(0, caja(72, 442, 530, 678));
      foto(1, caja(639, 323, 369, 550), { forma: 'redondeada', radio: 184 });
      if (e.apoyo) filete('filete-primer-pie', 72, 602, 1166);
      texto('primer-pie', e.apoyo, 'pie', caja(72, 1185, 530, 90));
      if (e.nota) filete('filete-segundo-pie', 639, 1008, 919);
      texto('segundo-pie', e.nota ?? '', 'cursiva', caja(639, 945, 369, 155));
      break;
    case 'TIPOGRAFIA':
      relleno(tinta);
      texto('titular', e.titulo, 'voz', caja(78, 251, 924, 570));
      texto('apoyo', e.apoyo, 'cursiva', caja(86, 890, 900, 210));
      break;
    case 'TEXTO_EN_AIRE': {
      foto(0, lienzo);
      const esquina = p.esquina ?? 'SUPERIOR_IZQUIERDA';
      const enPapel = variante === 'PAPEL';
      const zonaHabitual = caja(esquina.endsWith('IZQUIERDA') ? 64 : 522, esquina.startsWith('SUPERIOR') ? 74 : 926, 494, 310);
      const zona = e.zonaTexto ?? p.profundidad?.zonaTexto ?? zonaHabitual;
      if (enPapel) {
        tratamiento = 'PIE_DE_FOTO';
        capas.push({ tipo: 'forma', id: 'papel', figura: 'rect', caja: zona, color: papel });
      }
      const espacio = enPapel ? { x: zona.x + 22 / W, y: zona.y + 18 / H, w: zona.w - 44 / W, h: zona.h - 36 / H } : zona;
      const arriba = p.ordenTexto === 'APOYO_ANTES' && e.apoyo;
      const titulo = { ...espacio, y: arriba ? espacio.y + espacio.h * .36 : espacio.y, h: e.apoyo ? espacio.h * .64 : espacio.h };
      texto('titular', e.titulo, 'voz', titulo);
      texto('apoyo', e.apoyo, 'cursiva', { ...espacio, w: variante === 'PROFUNDIDAD' ? espacio.w * .70 : espacio.w,
        y: arriba ? espacio.y : espacio.y + espacio.h * .7, h: espacio.h * .30 });
      if (variante === 'PROFUNDIDAD') {
        tratamiento = 'PORTADA_DETRAS';
        capas.push({ tipo: 'recorte', id: 'primer-plano', activo: p.fotos[0], alineadoCon: 'foto-1', bordeSuave: 0 });
        relaciones.push({ tipo: 'detras', sujeto: 'primer-plano', texto: 'titular', cobertura: [.02, .10], medida: 'media',
          zona: { desde: Math.max(.04, titulo.y - .035), hasta: Math.min(.96, titulo.y + titulo.h + .035) } });
        if (e.apoyo) relaciones.push({ tipo: 'noSolapar', textos: ['apoyo'], sujeto: 'primer-plano', maximo: .06 });
      }
      break;
    }
  }
  const intencion = Intencion.parse({
    esquema: 'diseno/intencion@1', id: 'lamina-' + numero, marca, titulo: e.funcion, notas: p.intencion,
    lienzo: { formato: 'FEED_4_5' }, reticula: { margen: 40 },
    activos: Object.fromEntries(Object.entries(activos).map(([id, f]) => [id, f.activo.id])),
    textos, capas, relaciones, tokens: { estilos },
  });
  return { intencion, tratamiento };
}

export async function maquetarCarrusel(
  raiz: string, carpeta: string, base: BaseDeSerie, secuencia: SecuenciaTaller, guion: GuionEditorial, ediciones: PaginaDeSerie[],
  fotos: Map<FotoDePagina, Foto>, preparacion: Preparacion = { marca: 'serie' },
) {
  const catalogo = new CatalogoTipografico(join(raiz, 'recursos/tipografias'));
  const motor = new MotorTexto(catalogo);
  const compositor = new CompositorSharp(motor, catalogo);
  const temporal = await mkdtemp(join(carpeta, '.capas-carrusel-'));
  try {
    const paginas: Pieza[] = [];
    const archivos: { nombre: string; bytes: Buffer }[] = [];
    for (const [i, p] of guion.paginas.entries()) {
      const n = i + 1, edicion = ediciones[i]!;
      if (p.tratamiento === 'FOTO' ? Boolean(edicion.titulo || edicion.apoyo || edicion.nota) : !edicion.titulo) {
        throw new ErrorDeUsuario('Revisa el texto de la lámina ' + n + '. Las páginas de fotografía limpia se mantienen sin palabras.');
      }
      if (p.tratamiento !== 'DIPTICO' && edicion.nota) throw new ErrorDeUsuario('La nota adicional corresponde al segundo pie de un díptico.');
      const activos: Record<string, ActivoDisponible> = {};
      for (const [j, id] of p.fotos.entries()) {
        const original = fotos.get(id);
        if (!original) throw new ErrorDeUsuario('Falta una foto aprobada de la lámina ' + n + '.');
        const nombre = id === 'base' ? 'base' : 'foto-' + n + '-' + (j + 1);
        const ruta = original.ruta ?? join(temporal, nombre + '.png');
        if (!original.ruta) await writeFile(ruta, original.bytes);
        activos[id] = await activoFoto(ruta, original.bytes, preparacion.marca, base, original.sha256, nombre);
      }

      const renderizar = async (color: string, variante: 'NORMAL' | 'PAPEL' | 'PROFUNDIDAD', disponibles = activos) => {
        const { intencion, tratamiento } = planDeCapas(n, preparacion.marca, p, edicion, disponibles, paletas[guion.acento], motor, color, variante);
        const resuelto = await compositor.resolver(intencion, disponibles);
        const problemas = resuelto.problemas.filter(problema => problema.gravedad === 'ERROR');
        if (problemas.length) throw new ErrorDeUsuario('Revisa la lámina ' + n + '. ' + problemas.map(p => p.mensaje).join(' '));
        const render = await compositor.renderizar(resuelto, disponibles);
        const medidas = resuelto.capas.flatMap(c => {
          if (c.tipo !== 'texto' && c.tipo !== 'circulo-texto') return [];
          const lineas = c.tipo === 'texto' ? c.lineas : [c];
          return [{ capa: c.id, cuerpoMovil: Math.floor(Math.min(...lineas.map(l => l.tamano)) / 3 * 10) / 10,
            contraste: c.tipo === 'texto' ? render.contraste[c.id] ?? 0 : contraste(color, paletas[guion.acento].fondo),
            lineas: lineas.map(l => l.texto) }];
        });
        return { intencion, tratamiento, render, medidas, cobertura: resuelto.medidas.cobertura,
          legible: medidas.every(m => m.cuerpoMovil >= 12 && m.contraste >= 4.5) };
      };
      const { tinta, fondo } = paletas[guion.acento];
      let salida: Awaited<ReturnType<typeof renderizar>> | undefined;
      let motivo = p.intencion;
      let mascaraSha256: string | undefined;
      if (p.tratamiento === 'TEXTO_EN_AIRE') {
        const id = p.fotos[0]!;
        const foto = activos[id]!;
        const mascara = await preparacion.primerPlano?.(n, id);
        if (mascara) {
          const sha = huella(mascara);
          const rutaMascara = join(temporal, 'mascara-' + n + '.png');
          await writeFile(rutaMascara, mascara);
          const conMascara: ActivoDisponible = { ...foto, rutaMascara, mascaraSha256: sha, activo: { ...foto.activo, mascara: {
            archivo: 'mascara-' + n + '.png', metodo: 'MANUAL', creadaEn: '',
            bbox: { x: 0, y: 0, w: foto.activo.ancho, h: foto.activo.alto }, incluye: 'Primer plano de la lámina',
          } } };
          const disponibles = { ...activos, [id]: conMascara };
          for (const color of [papel, tinta]) {
            const prueba = await renderizar(color, 'PROFUNDIDAD', disponibles).catch(error => {
              if (!(error instanceof ErrorDeUsuario)) throw error;
              return undefined;
            });
            const oclusion = prueba?.cobertura.titular ?? 0;
            if (prueba?.legible && oclusion >= .02 && oclusion <= .10 && (prueba.cobertura['titular:franja'] ?? 1) <= .58) {
              salida = prueba;
              mascaraSha256 = sha;
              archivos.push({ nombre: 'mascara-' + n + '.png', bytes: mascara });
              motivo += ' El primer plano cubre el ' + Math.round(100 * oclusion) + '% del titular.';
              break;
            }
          }
        }
        if (!salida) {
          if (p.profundidad || mascara) motivo += ' El titular queda delante para que se lea completo.';
          for (const color of [tinta, papel, mezclar(tinta, '#101010', .65)]) {
            const prueba = await renderizar(color, 'NORMAL').catch(error => {
              if (!(error instanceof ErrorDeUsuario)) throw error;
              return undefined;
            });
            if (prueba?.legible) { salida = prueba; break; }
          }
        }
        if (!salida) {
          salida = await renderizar(tinta, 'PAPEL');
          motivo += ' El recuadro de papel conserva el contraste.';
        }
      } else salida = await renderizar(p.tratamiento === 'TIPOGRAFIA' ? fondo : tinta, 'NORMAL');

      if (!salida.legible) throw new ErrorDeUsuario('La lámina ' + n + ' pierde lectura a 360 px. Acorta el texto o ajusta su posición.');
      const { png, svgEditable } = salida.render;
      const svg = Buffer.from(svgEditable);
      const json = Buffer.from(JSON.stringify(salida.intencion, null, 2) + '\n');
      paginas.push({ edicion, fotosSha256: p.fotos.map(id => fotos.get(id)!.sha256), tratamiento: salida.tratamiento, motivo, medidas: salida.medidas,
        sha256: huella(png), intencionSha256: huella(json), svgSha256: huella(svg), ...(mascaraSha256 ? { mascaraSha256 } : {}) });
      archivos.push({ nombre: n + '.png', bytes: png }, { nombre: n + '.svg', bytes: svg }, { nombre: n + '.json', bytes: json });
    }
    return await guardarSerie(carpeta, { esquema: 'taller/serie@1', ...base, guionSha256: secuencia.huella, paginas }, archivos);
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}
