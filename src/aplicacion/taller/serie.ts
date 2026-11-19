import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { CompositorSharp } from '../../adaptadores/compositor/CompositorSharp.js';
import { CatalogoTipografico } from '../../adaptadores/compositor/tipografias.js';
import { MotorTexto } from '../../adaptadores/compositor/MotorTexto.js';
import { Activo } from '../../dominio/activos.js';
import { Intencion } from '../../dominio/diseno/intencion.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { DireccionSecuencia } from '../../dominio/secuenciaTaller.js';
import type { PaginaDeSerie, SerieDelTaller } from '../../dominio/serieTaller.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import { huella } from './direccion.js';
import { paqueteZip } from './paquete.js';

type Pagina = SerieDelTaller['paginas'][number];
type Tratamiento = Exclude<Pagina['tratamiento'], 'MARCO_ARQUEADO' | 'DIPTICO' | 'TIPOGRAFIA'>;
export type BaseDeSerie = Pick<SerieDelTaller, 'baseSha256' | 'fotoSha256' | 'comanda' | 'versionBase' | 'uso' | 'origen' | 'referencia'>;
type Base = BaseDeSerie;
type ZonaDePortada = NonNullable<DireccionSecuencia['portada']>;
export interface TomasParaSerie {
  detalle: { ruta: string; sha256: string };
  cierre: { ruta: string; sha256: string };
  portada?: { zona: ZonaDePortada['zonaTexto']; mascara: Buffer };
}
const criterios = {
  PORTADA_DETRAS: ['https://id.pinterest.com/pin/9922061674879618/', 'El primer plano pasa por delante de un borde del titular. El apoyo mantiene su lectura y el plato queda visible.'],
  ECO_EN_CONTORNO: ['https://www.behance.net/gallery/200507419/Johnz-Cafe-Rebrand-Social-Media-Concept-project/modules/1136688049', 'El eco de contorno, desplazado y secundario, mantiene una lectura maciza del nombre en primer plano.'],
  TITULO_EN_AIRE: ['https://www.behance.net/gallery/247552933/Social-Media-Design-Food-Instagram-Carousel-Campaign', 'Un nombre breve ocupa el aire de la apertura y deja reconocible el sujeto.'],
  APERTURA_EN_PAPEL: ['https://www.behance.net/gallery/238133329/Carrusel-Burgers', 'El espacio reservado permite saltos legibles y mantiene la voz de apoyo subordinada a la apertura.'],
  ACENTO_INCLINADO: ['https://www.behance.net/gallery/238125357/Instagram-Carousel-Design', 'Una voz breve en cursiva se inclina junto al título macizo. El apoyo tiene espacio propio, conserva la grafía y mantiene la lectura del nombre.'],
  PIE_DE_FOTO: ['https://www.pinterest.com/pin/instagram-carousel-japanese-food--109001253473874334/', 'Una franja alinea la nota con el detalle y mantiene las palabras dentro de esta lámina.'],
  CIERRE_A_DOS_VOCES: ['https://www.behance.net/gallery/238125357/Instagram-Carousel-Design', 'El titular final adquiere una voz editorial y el apoyo conserva el eje izquierdo de la serie.'],
} as const;

const papel = '#F7F2E8';
const tinta = '#251E1A';
// El compositor trabaja en 3:4; toda caja se define en el 4:5 que verá el lector.
const caja = (x: number, y: number, w: number, h: number) => ({ x, y: (45 + y * 1350) / 1440, w, h: h * 1350 / 1440 });

async function activoFoto(ruta: string, bytes: Buffer, marca: string, fuente: Base, sha256: string): Promise<ActivoDisponible> {
  if (huella(bytes) !== sha256) throw new ErrorDeUsuario('La foto ya no coincide con la versión revisada.');
  const meta = await sharp(bytes).metadata();
  return { ruta, activo: Activo.parse({ id: 'base', localSlug: marca, tipo: fuente.origen === 'ORIGINAL' ? 'REAL' : 'GENERADO',
    uso: fuente.uso, descripcion: 'Foto base de maquetación', archivo: 'base.png', ancho: meta.width, alto: meta.height,
    sha256, procedencia: { ruta: 'base.png', sha256, copiadoEn: '' } }) };
}

async function capaFrontal(base: Buffer, mascara: Buffer) {
  const alfa = await sharp(mascara).extractChannel(0).raw().toBuffer();
  const rgba = await sharp(base).removeAlpha().ensureAlpha().raw().toBuffer();
  for (let i = 0; i < alfa.length; i++) rgba[4 * i + 3] = alfa[i]!;
  const png = await sharp(rgba, { raw: { width: 1080, height: 1350, channels: 4 } }).png().toBuffer();
  return '<image id="silueta-delante" x="0" y="45" width="1080" height="1350" href="data:image/png;base64,' + png.toString('base64') + '"/>';
}

function intencionTrasSilueta(p: PaginaDeSerie, zona: ZonaDePortada['zonaTexto'], marca: string) {
  const altoTitular = p.apoyo ? zona.h * .6 : zona.h;
  const recortarCon = { sujeto: 'primer-plano', modo: 'fuera' };
  const capas: unknown[] = [
    { tipo: 'imagen', id: 'fotografia', activo: 'foto', caja: caja(0, 0, 1, 1) },
    { tipo: 'recorte', id: 'primer-plano', activo: 'foto', alineadoCon: 'fotografia', opacidad: 0 },
    { tipo: 'texto', id: 'titulo', texto: '@titulo', estilo: 'voz', ajuste: 'caja', caja: caja(zona.x, zona.y, zona.w, altoTitular), recortarCon },
  ];
  if (p.apoyo) capas.push({ tipo: 'texto', id: 'apoyo', texto: '@apoyo', estilo: 'apoyo', ajuste: 'caja',
    caja: caja(zona.x + zona.w * .02, zona.y + zona.h * .68, zona.w * .73, zona.h * .32), recortarCon });
  const w = 45 / 1440, h = 1350 / 1440;
  return Intencion.parse({
    esquema: 'diseno/intencion@1', id: 'lamina-1', marca, titulo: 'PORTADA', reticula: { margen: 46 },
    notas: criterios.PORTADA_DETRAS[1], activos: { foto: 'base' },
    textos: { titulo: p.titulo, ...(p.apoyo ? { apoyo: p.apoyo } : {}) }, capas,
    relaciones: [
      { tipo: 'detras', sujeto: 'primer-plano', texto: 'titulo', cobertura: [.02, .10], medida: 'media',
        zona: { desde: w + Math.max(.04, zona.y - .035) * h, hasta: w + (zona.y + altoTitular + .025) * h } },
      ...(p.apoyo ? [{ tipo: 'noSolapar', sujeto: 'primer-plano', textos: ['apoyo'], maximo: .06 }] : []),
    ],
    tokens: { estilos: {
      voz: { fuente: 'fraunces', color: '#FFF3DB', ejes: { wght: 870, opsz: 70, SOFT: 35, WONK: 1 }, tracking: -.05 },
      apoyo: { fuente: 'instrument-serif-italica', color: '#FFE3BC' },
    } },
  });
}

function componerIntencion(n: number, p: PaginaDeSerie, tratamiento: Tratamiento, marca: string, color: string, fotoPropia = false) {
  const portada = p.funcion === 'PORTADA', cierre = p.funcion === 'CIERRE', aire = tratamiento === 'TITULO_EN_AIRE' || tratamiento === 'ECO_EN_CONTORNO';
  const conPapel = tratamiento !== 'FOTO' && !aire;
  const altoPapel = !conPapel ? 0 : portada ? (p.apoyo ? .34 : .27) : cierre ? (p.titulo && p.apoyo ? .36 : .25) : (p.titulo && p.apoyo ? .25 : .16);
  const cuerpo = p.titulo && p.apoyo;
  const acento = tratamiento === 'ACENTO_INCLINADO';
  const capas: unknown[] = [{ tipo: 'relleno', id: 'papel', color: papel }, {
    tipo: 'imagen', id: 'fotografia', activo: 'foto', caja: caja(0, portada ? altoPapel : 0, 1, 1 - altoPapel), enfoque: p.enfoque,
    zoom: p.zoom ?? (fotoPropia ? 1 : p.funcion === 'DETALLE' ? 1.55 : cierre ? 1.12 : 1),
  }];
  const textos: Record<string, string> = {};
  const y = portada ? .066 : 1 - altoPapel + .025;
  const altoTitulo = acento ? .13 : aire ? .16 : (altoPapel - (cuerpo ? .15 : .095));
  if (p.titulo) {
    textos.titulo = p.titulo;
    if (tratamiento === 'ECO_EN_CONTORNO') capas.push({ tipo: 'texto', id: 'eco', texto: '@titulo', estilo: 'voz', ajuste: 'caja', caja: caja(.076, y + .035, .77, altoTitulo), vertical: 'centro', contorno: 2.4, opacidad: .62 });
    capas.push({ tipo: 'texto', id: 'titulo', texto: '@titulo', estilo: 'voz', ajuste: 'caja', caja: caja(.07, y, aire ? .77 : .86, altoTitulo), vertical: 'centro' });
  }
  if (p.apoyo) {
    textos.apoyo = p.apoyo;
    capas.push({ tipo: 'texto', id: 'apoyo', texto: '@apoyo', estilo: 'apoyo', giro: acento ? -4 : 0, ajuste: 'caja', caja: acento ? caja(.11, .213, .68, .064) : caja(.07, cuerpo ? y + altoTitulo + .01 : y, .86, cuerpo ? .055 : Math.min(.085, altoPapel - .098)), vertical: 'centro' });
  }
  return Intencion.parse({
    esquema: 'diseno/intencion@1', id: 'lamina-' + n, marca, titulo: p.funcion, notas: tratamiento === 'FOTO' ? 'El encuadre sostiene la lectura.' : criterios[tratamiento][1],
    activos: { foto: 'base' }, textos, capas, tokens: { estilos: {
      voz: cierre ? { fuente: 'instrument-serif', color } : { fuente: 'archivo', ejes: { wght: portada ? 840 : 620, wdth: portada ? 78 : 95 }, interlineado: .98, color },
      apoyo: { fuente: acento ? 'instrument-serif-italica' : 'archivo', ejes: acento ? {} : { wght: 460 }, interlineado: 1.1, color },
    } },
  });
}

async function renderizar(compositor: CompositorSharp, foto: ActivoDisponible, intencion: Intencion) {
  const resuelto = await compositor.resolver(intencion, { foto });
  if (resuelto.problemas.some(p => p.gravedad === 'ERROR')) throw new ErrorDeUsuario('Revisa la lámina ' + intencion.id + '. ' + resuelto.problemas.filter(p => p.gravedad === 'ERROR').map(p => p.mensaje).join(' '));
  const render = await compositor.renderizar(resuelto, { foto });
  const medidas = resuelto.capas.flatMap(c => c.tipo === 'texto' && !c.contorno ? [{
    capa: c.id, cuerpoMovil: Math.floor(Math.min(...c.lineas.map(l => l.tamano)) / 3 * 10) / 10,
    contraste: render.contraste[c.id] ?? 0, lineas: c.lineas.map(l => l.texto),
  }] : []);
  return { render, medidas, cobertura: resuelto.medidas.cobertura };
}

/** Sólo lee la base revisada. La relación entre texto y foto se mide antes de guardar una versión. */
export async function maquetarSerie(raiz: string, carpeta: string, marca: string, base: Base, ruta: string, paginas: PaginaDeSerie[], tomas?: TomasParaSerie): Promise<SerieDelTaller> {
  const bytes = await readFile(ruta);
  const fotoBase = await activoFoto(ruta, bytes, marca, base, base.baseSha256);
  const mascaraSha256 = tomas?.portada && huella(tomas.portada.mascara);
  const rutaMascara = mascaraSha256 ? join(carpeta, 'tomas-serie', mascaraSha256 + '.png') : undefined;
  if (rutaMascara && tomas?.portada) {
    await mkdir(join(carpeta, 'tomas-serie'), { recursive: true });
    await writeFile(rutaMascara, tomas.portada.mascara);
  }
  const catalogo = new CatalogoTipografico(join(raiz, 'recursos/tipografias'));
  const compositor = new CompositorSharp(new MotorTexto(catalogo), catalogo);
  const piezas: Pagina[] = [];
  const archivos: { nombre: string; bytes: Buffer }[] = [];
  let guardaMascara = false;
  for (const [i, edicion] of paginas.entries()) {
    const toma = i === 1 ? tomas?.detalle : i === 2 ? tomas?.cierre : undefined;
    const entrada = toma && await readFile(toma.ruta);
    const foto = toma && entrada ? await activoFoto(toma.ruta, entrada, marca, base, toma.sha256) : fotoBase;
    const pixeles = entrada ?? bytes;
    const { titulo, apoyo, funcion } = edicion;
    let tratamiento: Tratamiento = !titulo && !apoyo ? 'FOTO' : funcion === 'PORTADA' ? (titulo && !apoyo && titulo.length <= 27 ? 'TITULO_EN_AIRE' : 'APERTURA_EN_PAPEL') : funcion === 'CIERRE' ? 'CIERRE_A_DOS_VOCES' : 'PIE_DE_FOTO';
    if (funcion === 'PORTADA' && titulo && apoyo && titulo.length <= 28 && apoyo.length <= 22 && !apoyo.includes('\n')) tratamiento = 'ACENTO_INCLINADO';
    const mecanismos = base.referencia?.mecanismos ?? [];
    const ecoPedido = mecanismos.includes('PATRON_REPETIDO');
    const manuscrita = base.referencia?.voces.some(v => /cursiv|script|manuscrit|caligr/iu.test(v));
    let razon = '';
    if (funcion === 'PORTADA' && manuscrita && titulo && apoyo && apoyo.length <= 32 && !apoyo.includes('\n')) {
      tratamiento = 'ACENTO_INCLINADO';
      razon = 'La ficha ' + base.referencia!.id + ' pide una segunda voz manuscrita o cursiva.';
    }
    if (funcion === 'PORTADA' && mecanismos.includes('PALABRA_DETRAS')) razon += ' La ficha pide profundidad. Esta serie trabaja con la foto limpia y carece de máscara medida para este encuadre.';
    let color = tinta;
    if (tratamiento === 'TITULO_EN_AIRE') {
      const { data } = await sharp(pixeles).resize(100, 125, { fit: 'cover' }).extract({ left: 7, top: 6, width: 77, height: ecoPedido ? 26 : 20 }).greyscale().raw().toBuffer({ resolveWithObject: true });
      const media = data.reduce((a, b) => a + b, 0) / data.length;
      color = media < 135 ? papel : tinta;
      const dispersion = Math.sqrt(data.reduce((a, b) => a + (b - media) ** 2, 0) / data.length);
      if (dispersion > 38) {
        tratamiento = 'APERTURA_EN_PAPEL'; color = tinta;
        razon += ' La variación de luz en el hueco del titular aconseja reservar papel.' + (ecoPedido ? ' Se descarta el eco de la ficha.' : '');
      } else if (ecoPedido) {
        tratamiento = 'ECO_EN_CONTORNO';
        razon += ' El patrón repetido de la ficha ' + base.referencia!.id + ' cabe en el aire medido de esta foto.';
      }
    }
    let intencion = componerIntencion(i + 1, edicion, tratamiento, marca, color, Boolean(toma));
    let salida;
    if (i === 0 && edicion.titulo && rutaMascara && tomas?.portada) {
      const intencionCapas = intencionTrasSilueta(edicion, tomas.portada.zona, marca);
      const fotoConMascara = { ...foto, rutaMascara, activo: { ...foto.activo,
        mascara: { archivo: 'mascara-portada.png', metodo: 'MANUAL' as const, creadaEn: '',
          bbox: { x: 0, y: 0, w: foto.activo.ancho, h: foto.activo.alto }, incluye: 'Primer plano indicado por la dirección' } } };
      const prueba = await renderizar(compositor, fotoConMascara, intencionCapas).catch(error => {
        if (!(error instanceof ErrorDeUsuario)) throw error;
        return undefined;
      });
      const oclusion = prueba?.cobertura.titulo ?? 0;
      if (prueba && oclusion >= .02 && oclusion <= .10 && (prueba.cobertura['titulo:franja'] ?? 1) <= .58 &&
        prueba.medidas.every(m => m.cuerpoMovil >= 12 && m.contraste >= 4.5)) {
        salida = prueba;
        intencion = intencionCapas;
        tratamiento = 'PORTADA_DETRAS';
        guardaMascara = true;
        razon = ' La silueta cubre el ' + Math.round(100 * oclusion) + '% del titular.';
      } else razon += ' El solape sugerido se descartó para mantener la lectura.';
    }
    salida ??= await renderizar(compositor, foto, intencion);
    if ((tratamiento === 'TITULO_EN_AIRE' || tratamiento === 'ECO_EN_CONTORNO') && salida.medidas.some(m => m.contraste < 4.5)) {
      tratamiento = 'APERTURA_EN_PAPEL';
      razon += ' La tinta sobre la foto quedó por debajo de 4,5 a 1.';
      intencion = componerIntencion(i + 1, edicion, tratamiento, marca, tinta, Boolean(toma));
      salida = await renderizar(compositor, foto, intencion);
    }
    if (salida.medidas.some(m => m.cuerpoMovil < 12 || m.contraste < 4.5)) throw new ErrorDeUsuario('La lámina ' + (i + 1) + ' pierde lectura a 360 px. Reduce el texto o cambia sus saltos de línea.');
    const png = await sharp(salida.render.png).extract({ left: 0, top: 45, width: 1080, height: 1350 }).png().toBuffer();
    const json = Buffer.from(JSON.stringify(intencion, null, 2) + '\n');
    let editable = salida.render.svgEditable.replace('width="1080" height="1440" viewBox="0 0 1080 1440"', 'width="1080" height="1350" viewBox="0 45 1080 1350"');
    if (tratamiento === 'PORTADA_DETRAS' && tomas?.portada) {
      editable = editable.replace('</svg>', await capaFrontal(bytes, tomas.portada.mascara) + '</svg>');
    }
    const svg = salida.medidas.length ? Buffer.from(editable) : undefined;
    if (svg) archivos.push({ nombre: (i + 1) + '.svg', bytes: svg });
    const criterio = tratamiento === 'FOTO' ? undefined : criterios[tratamiento];
    piezas.push({ edicion, ...(toma ? { fotoSha256: toma.sha256 } : {}), tratamiento, referente: criterio?.[0], motivo: [(criterio?.[1] ?? 'La persona dejó la lámina sin texto.'), razon.trim()].filter(Boolean).join(' '), sha256: huella(png), intencionSha256: huella(json), ...(svg ? { svgSha256: huella(svg) } : {}), medidas: salida.medidas });
    archivos.push({ nombre: (i + 1) + '.png', bytes: png }, { nombre: (i + 1) + '.json', bytes: json });
  }
  const cuerpo = { esquema: 'taller/serie@1' as const, ...base, ...(guardaMascara && mascaraSha256 ? { mascaraSha256 } : {}), paginas: piezas };
  return guardarSerie(carpeta, cuerpo, archivos);
}

export async function guardarSerie(carpeta: string, cuerpo: Omit<SerieDelTaller, 'huella'>, archivos: { nombre: string; bytes: Buffer }[]) {
  const serie = { ...cuerpo, huella: huella(JSON.stringify(cuerpo)) };
  const destino = join(carpeta, 'series', serie.huella);
  const directorio = join(carpeta, 'series');
  await mkdir(directorio, { recursive: true });
  const temporal = await mkdtemp(join(directorio, '.serie-'));
  try {
    archivos.push({ nombre: 'serie.json', bytes: Buffer.from(JSON.stringify(serie, null, 2)) });
    for (const archivo of archivos) await writeFile(join(temporal, archivo.nombre), archivo.bytes);
    try { await rename(temporal, destino); }
    catch (error) { if (!['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error; }
  } finally { await rm(temporal, { recursive: true, force: true }); }
  return serie;
}

export async function leerSerie(carpeta: string, serie: SerieDelTaller, pagina?: number, base?: Buffer, tomas: { nombre: string; bytes: Buffer }[] = []) {
  const destino = join(carpeta, 'series', serie.huella);
  const archivo = async (nombre: string, hash: string) => {
    const bytes = await readFile(join(destino, nombre));
    if (huella(bytes) !== hash) throw new ErrorDeUsuario('El archivo ya no coincide con la serie compuesta.');
    return { nombre, bytes };
  };
  if (pagina !== undefined) {
    const p = serie.paginas[pagina - 1];
    if (!p) throw new ErrorDeUsuario('Esta lámina no figura en la serie.');
    return (await archivo(pagina + '.png', p.sha256)).bytes;
  }
  const archivos: { nombre: string; bytes: Buffer }[] = [{ nombre: 'serie.json', bytes: Buffer.from(JSON.stringify(serie, null, 2)) }];
  if (base) {
    if (huella(base) !== serie.baseSha256) throw new ErrorDeUsuario('La base del paquete no coincide con la composición.');
    archivos.push({ nombre: 'base.png', bytes: base });
  }
  for (const [i, p] of serie.paginas.entries()) {
    archivos.push(await archivo((i + 1) + '.png', p.sha256), await archivo((i + 1) + '.json', p.intencionSha256));
    if (p.svgSha256) archivos.push(await archivo((i + 1) + '.svg', p.svgSha256));
  }
  return paqueteZip([...archivos, ...tomas]);
}
