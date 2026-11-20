import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { escribirJsonAtomico } from '../../adaptadores/ficheros/escribirJsonAtomico.js';
import { leerCartel } from '../../adaptadores/imagen/lecturaCartel.js';
import { reservarEnvio } from '../../adaptadores/openai/GeneradorCartel.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost, PasoPost } from '../../dominio/post.js';
import { esFotoEditorial, type RutaEditorial } from '../../dominio/taller.js';
import type { AccionTaller, ComandaDeArte, DireccionDeArte, Gesto, SeleccionDeMuestras, SeleccionDeToma, TallerDeArte } from '../../dominio/taller.js';
import { construirMapa } from '../../dominio/diseno/mapaDeFoto.js';
import { guardarFicha } from '../referencias/guardarFicha.js';
import { comprobarReferencia } from '../referencias/comprobarReferencia.js';
import { guardarEncargo, type DepsPost, type ResultadoAvance } from '../post/ordenPost.js';
import { coincideTexto, dirigir, huella } from './direccion.js';
import type { AlProgresar } from '../progreso.js';
import { guardarMuestras, leerMuestras } from './muestras.js';
import type { MascaraDePlano } from './profundidad.js';
import { componerTitulo } from './componerTitulo.js';
import { maquetaDeTitulo } from './puesta.js';
import { maquetarSerie, maquetarSoloFotos, leerMascaraDeSerie, leerSerie, type TomasParaSerie } from './serie.js';
import { paqueteZip } from './paquete.js';
import { guardarToma, leerToma, normalizarFotoDeSerie, paqueteDeToma, promptDeToma, rutaToma } from './secuencia.js';
import { DireccionSecuencia, esquemaDeLectura, formatoDeToma, GuionEditorial, ordenFotografico, puedeValorarFotografias, tomaPlaneada, type SecuenciaTaller, type TomaDeSerie } from '../../dominio/secuenciaTaller.js';
import { maquetarCarrusel } from './maquetarCarrusel.js';
import { luzSolicitada } from '../../dominio/luzFotografica.js';

type Candidata = TallerDeArte['candidatas'][number];
const carpeta = (deps: Pick<DepsPost, 'proyectos'>, e: EncargoPost) => join(deps.proyectos, e.proyecto, 'taller');
const original = (deps: Pick<DepsPost, 'raiz'>, e: EncargoPost) => readFile(resolve(deps.raiz, e.fotoSubida));

async function fuenteVerificada(deps: Pick<DepsPost, 'raiz'>, e: EncargoPost, comanda: ComandaDeArte) {
  const foto = await original(deps, e);
  if (huella(foto) !== comanda.fotoSha256) throw new ErrorDeUsuario('La foto fuente ha cambiado desde que se preparó la dirección.');
  return foto;
}
async function imagenFuente(deps: DepsPost, e: EncargoPost, comanda: ComandaDeArte) {
  const foto = await fuenteVerificada(deps, e, comanda);
  return sharp(foto).rotate().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}

interface EdicionDeComanda {
  ruta?: RutaEditorial;
  direccion?: DireccionDeArte;
  nombrePlato?: string;
  gesto?: Gesto;
  toma?: SeleccionDeToma;
  muestras?: SeleccionDeMuestras | null;
}

async function redactar(deps: DepsPost, e: EncargoPost, edicion: EdicionDeComanda = {}) {
  const [marca, foto, oficio, referencia] = await Promise.all([
    deps.referencias.locales.obtener(e.local), original(deps, e),
    e.taller?.seleccionEditorial ? '' : readFile(join(deps.raiz, 'conocimiento/oficios/arte-integrado.md'), 'utf8'),
    e.referencia ? deps.referencias.referencias.obtener(e.local, e.referencia) : undefined,
  ]);
  const { data: rgb, info } = await sharp(foto).rotate().resize(180, 180, { fit: 'inside' }).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mapa = construirMapa({ ancho: info.width, alto: info.height, rgb });
  const libre = mapa.libres[0];
  const fotografia = { temperatura: mapa.temperatura, dominantes: mapa.paleta.map(c => c.hex), acento: mapa.vivo,
    luz: mapa.luzMedia, aire: libre ? `Zona de poco detalle de la foto: columnas ${libre.col.join('–')}/12 y filas ${libre.fila.join('–')}/16.` : 'Toma de textura continua.' };
  const fotoSha256 = huella(foto);
  const previa = e.taller?.comanda;
  let propuesta = previa?.propuestaPortada;
  const construir = (muestras?: ComandaDeArte['muestras']) => dirigir(e, marca, fotoSha256, fotografia, oficio, referencia?.ficha, edicion.direccion, edicion.nombrePlato, edicion.gesto, edicion.toma, muestras, edicion.ruta, propuesta);
  let base = construir();
  if (base.editorial && base.puesta?.ambito && deps.directorPortada && (!previa || edicion.ruta && edicion.ruta !== previa.editorial?.ruta)) {
    const [recientes, referenciaVisual] = await Promise.all([
      deps.postsRecientes?.(e) ?? [],
      referencia?.origen.archivo ? readFile(deps.referencias.referencias.rutaArchivo(e.local, referencia.id, referencia.origen.archivo)).catch(() => undefined) : undefined,
    ]);
    propuesta = await deps.directorPortada({ original: foto, encargo: e.plato, tipo: base.puesta.ambito, formato: e.formato, referencia: base.referencia, referenciaVisual,
      luzSolicitada: luzSolicitada(e.plato) ?? (e.estetica === 'EDITORIAL_OSCURO' ? 'ESTUDIO' : undefined), recientes }).catch(() => undefined);
    if (propuesta || previa?.propuestaPortada) base = construir();
  }
  const permiteMuestras = !base.toma?.seleccion.escenaFuente && base.editorial?.ruta !== 'FOTO_ESPACIO' && base.toma?.camara.vista === 'CENITAL' && !base.toma.alternativa;
  if (edicion.muestras && !permiteMuestras) throw new ErrorDeUsuario('Para usar detalles, elige una cenital con el punto de vista de origen indicado.');
  if (!permiteMuestras || edicion.muestras === null) return base;
  if (!edicion.muestras && !previa?.muestras) return base;
  const dir = join(carpeta(deps, e), 'muestras');
  if (previa?.fotoSha256 !== base.fotoSha256) throw new ErrorDeUsuario('La foto de la que se seleccionaron los detalles ha cambiado.');
  if (edicion.muestras) {
    const imagen = await imagenFuente(deps, e, base);
    return construir(await guardarMuestras(dir, imagen, edicion.muestras));
  }
  return construir(previa.muestras);
}

async function registrar(deps: DepsPost, e: EncargoPost, paso: PasoPost, nota: string) {
  const nuevo = { ...e, paso, historial: [...e.historial, { fecha: deps.ahora(), paso, nota }] };
  await guardarEncargo(deps, nuevo);
  return nuevo;
}

export async function prepararTaller(deps: DepsPost, e: EncargoPost, sinReferencia = false): Promise<ResultadoAvance> {
  if (e.taller && e.paso === 'REFERENCIA') {
    if (e.taller.elegirReferenciaAlAbrir && !e.referencia && !sinReferencia) return { encargo: e, mensajes: [], parada: 'Elige una referencia o continúa con el estudio del encargo.' };
    if (!e.taller.seleccionEditorial || e.referencia) {
      const estado = await comprobarReferencia(deps.referencias, { local: e.local, referencia: e.referencia });
      if (!estado.paso.puede) return { encargo: e, mensajes: [], parada: estado.paso.motivo };
      if (!e.referencia && !sinReferencia) return { encargo: e, mensajes: [], parada: 'Puedes elegir una referencia o preparar el cartel con la foto del local.' };
    }
    if (e.referencia) {
      const referencia = await deps.referencias.referencias.obtener(e.local, e.referencia);
      if (referencia.analisis?.decision === 'RECHAZA' || !referencia.ficha || !referencia.origen.archivo) {
        return { encargo: e, mensajes: [], parada: 'Elige una referencia analizada con imagen y apta para dirigir el cartel.' };
      }
    }
    e.taller.comanda = await redactar(deps, e);
    e = await registrar(deps, e, 'CONFIRMAR_ELEMENTOS', 'Dirección, fotografía fuente y copy preparados para revisión.');
  }
  return { encargo: e, mensajes: [], parada: e.paso === 'HECHO' ? 'HECHO' : 'El taller espera tu decisión sobre el arte integrado.' };
}

function exigirConfirmada(e: EncargoPost): ComandaDeArte {
  const c = e.taller?.comanda;
  if (!c || e.taller?.confirmada?.huella !== c.huella) throw new ErrorDeUsuario('Confirma primero la dirección, el producto y el copy de esta versión.');
  return c;
}

export async function bytesDeMuestras(deps: DepsPost, e: EncargoPost, sha256: string) {
  if (!e.taller?.comanda) throw new ErrorDeUsuario('Este encargo no tiene lámina de detalles.');
  return leerMuestras(join(carpeta(deps, e), 'muestras'), e.taller.comanda, sha256);
}

export async function descargarPaquete(deps: DepsPost, e: EncargoPost): Promise<Buffer> {
  const c = exigirConfirmada(e);
  const foto = await imagenFuente(deps, e, c);
  const muestras = c.muestras ? await bytesDeMuestras(deps, e, c.muestras.sha256) : undefined;
  const entrada = muestras ? 'Adjunta solo muestras.jpg al generador. Conserva producto.jpg para cotejar el plato completo.' : 'Adjunta producto.jpg al generador.';
  const palabras = c.tipografiaLocal ? 'La imagen del generador es una fotografía base sin texto añadido. Importa esa foto en el taller: la maqueta local imprime exactamente el título confirmado.' : esFotoEditorial(c.editorial?.ruta) ? (c.toma?.seleccion.escenaFuente?.modo === 'EDITORIAL' ? 'Entrega una fotografía sin letras ni marcas escenificadas.' : 'Entrega una fotografía sin texto añadido. Conserva los rótulos documentados en la fuente.') : 'Conserva las palabras de comanda.json.';
  return paqueteZip([
    { nombre: 'direccion.txt', bytes: Buffer.from(c.prompt) },
    { nombre: 'producto.jpg', bytes: foto },
    ...(muestras ? [{ nombre: 'muestras.jpg', bytes: muestras }] : []),
    { nombre: 'comanda.json', bytes: Buffer.from(JSON.stringify({ proyecto: e.proyecto, fuenteOriginal: e.fotoSubida.split('/').at(-1), ...c }, null, 2)) },
    { nombre: 'instrucciones.txt', bytes: Buffer.from(entrada + ' Utiliza direccion.txt como instrucción. ' + palabras + ' Guarda una pieza vertical 4:5 en PNG o JPEG. Impórtalo en este mismo encargo para su revisión. Uso de la fuente: ' + c.uso) },
  ]);
}

export async function bytesDeCandidata(deps: Pick<DepsPost, 'proyectos'>, e: EncargoPost, version: number) {
  const candidata = e.taller?.candidatas.find(c => c.version === version);
  if (!candidata) throw new ErrorDeUsuario('No existe esa versión del cartel.');
  const bytes = await readFile(join(carpeta(deps, e), candidata.sha256 + '.png'));
  if (huella(bytes) !== candidata.sha256) throw new ErrorDeUsuario('El archivo ya no coincide con la versión revisada.');
  return { bytes, candidata };
}

export async function leerCapa(deps: Pick<DepsPost, 'proyectos'>, e: EncargoPost, version: number, tipo: 'base' | 'mascara') {
  const composicion = e.taller?.candidatas.find(c => c.version === version)?.composicion;
  const hash = tipo === 'base' ? composicion?.baseSha256 : composicion?.profundidad?.mascaraSha256;
  if (!hash) throw new ErrorDeUsuario('Esta versión carece de la capa solicitada.');
  const ruta = join(carpeta(deps, e), tipo === 'base' ? 'bases' : 'mascaras', hash + '.png');
  const bytes = await readFile(ruta);
  if (huella(bytes) !== hash) throw new ErrorDeUsuario('La capa ha cambiado desde la composición.');
  return { bytes, ruta };
}

async function mascaraDeBase(deps: DepsPost, e: EncargoPost, candidata: Candidata, rutaBase: string, plano: MascaraDePlano['plano'], subida?: string): Promise<MascaraDePlano> {
  const previa = e.taller?.candidatas.findLast(c => c.composicion?.baseSha256 === candidata.composicion!.baseSha256 && c.composicion?.profundidad);
  if (previa && !subida) {
    const capa = previa.composicion!.profundidad!;
    return { png: (await leerCapa(deps, e, previa.version, 'mascara')).bytes, sha256: capa.mascaraSha256, origen: capa.origenMascara, plano };
  }
  if (!subida && e.simulado) throw new ErrorDeUsuario('En una prueba simulada, importa la máscara PNG sobre la foto base.');
  const bytes = subida ? await readFile(subida) : await deps.segmentador.mascara(rutaBase).catch(() => { throw new ErrorDeUsuario('El segmentador local no encontró una silueta. Puedes importar la máscara sobre esta misma base.'); });
  const imagen = sharp(bytes, { limitInputPixels: 36_000_000 });
  const meta = await imagen.metadata();
  const transparente = meta.hasAlpha && (await imagen.stats()).channels.at(-1)!.min < 255;
  if (meta.format !== 'png' || meta.width !== 1080 || meta.height !== 1350 || (meta.pages ?? 1) !== 1 || transparente) throw new ErrorDeUsuario('Usa una máscara PNG opaca de 1080 × 1350 con sujeto blanco y fondo negro.');
  const png = await imagen.removeAlpha().greyscale().extractChannel(0).png().toBuffer();
  const sha256 = huella(png);
  const dir = join(carpeta(deps, e), 'mascaras');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, sha256 + '.png'), png);
  return { png, sha256, origen: subida ? 'IMPORTADA' : 'LOCAL', plano };
}

function portadaAprobada(e: EncargoPost) {
  const candidata = e.taller?.candidatas.at(-1);
  if (e.paso !== 'HECHO' || !candidata?.revision || candidata.comanda !== exigirConfirmada(e).huella ||
      (!candidata.composicion && !esFotoEditorial(e.taller?.comanda?.editorial?.ruta))) {
    throw new ErrorDeUsuario('Aprueba primero una portada con fotografía limpia o con texto editable.');
  }
  return candidata;
}

async function leerPortada(deps: DepsPost, e: EncargoPost, candidata = portadaAprobada(e)) {
  if (candidata.composicion) return leerCapa(deps, e, candidata.version, 'base');
  const { bytes } = await bytesDeCandidata(deps, e, candidata.version);
  return { bytes, ruta: join(carpeta(deps, e), candidata.sha256 + '.png') };
}

function secuenciaVigente(e: EncargoPost) {
  const portada = portadaAprobada(e);
  const serie = e.taller?.secuencia;
  if (!serie || serie.version !== portada.version || serie.comanda !== portada.comanda ||
    serie.baseSha256 !== (portada.composicion?.baseSha256 ?? portada.sha256)) {
    throw new ErrorDeUsuario('Falta una dirección de tomas para la portada vigente.');
  }
  return serie;
}

async function fotosAprobadasDelGuion(
  deps: DepsPost, e: EncargoPost, secuencia: SecuenciaTaller, guion: GuionEditorial, base: { bytes: Buffer; ruta: string }, usoBase: Candidata['uso'],
) {
  return Promise.all(ordenFotografico(guion).map(async id => {
    if (id === 'base') return { id, ...base, sha256: secuencia.baseSha256, uso: usoBase };
    const toma = secuencia.tomas[id]?.candidata;
    if (!toma?.aprobada) throw new ErrorDeUsuario('Revisa y aprueba las tomas del guion antes de maquetar.');
    return { id, bytes: await leerToma(carpeta(deps, e), toma.sha256), ruta: rutaToma(carpeta(deps, e), toma.sha256), sha256: toma.sha256, uso: toma.uso };
  }));
}

type FotoAprobada = Awaited<ReturnType<typeof fotosAprobadasDelGuion>>[number];

async function limitarMascara(
  bytes: Buffer, ancho: number, alto: number, region: NonNullable<DireccionSecuencia['portada']>['primerPlano'],
) {
  const alfa = await sharp(bytes).resize(ancho, alto, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  const recortada = Buffer.alloc(alfa.length);
  const izquierda = Math.floor(region.x * ancho), derecha = Math.min(ancho, Math.ceil((region.x + region.w) * ancho));
  for (let y = Math.floor(region.y * alto); y < Math.min(alto, Math.ceil((region.y + region.h) * alto)); y++) {
    const desde = y * ancho + izquierda;
    alfa.copy(recortada, desde, desde, y * ancho + derecha);
  }
  return sharp(recortada, { raw: { width: ancho, height: alto, channels: 1 } }).png().toBuffer();
}

async function prepararSerieFotografica(
  deps: DepsPost, e: EncargoPost, secuencia: SecuenciaTaller, portada: Candidata, fotos: FotoAprobada[],
) {
  if (fotos.length < 2) throw new ErrorDeUsuario('La versión fotográfica necesita al menos dos fotos aprobadas.');
  const comanda = exigirConfirmada(e);
  const orden = secuencia.lecturaFotografica?.orden ?? [];
  const ordenadas = orden.map(id => fotos.find(f => f.id === id));
  const serie = await maquetarSoloFotos(carpeta(deps, e), {
    comanda: comanda.huella, fotoSha256: comanda.fotoSha256, baseSha256: secuencia.baseSha256,
    versionBase: portada.version, origen: portada.origen,
    uso: portada.uso === 'PUBLICABLE' && fotos.every(f => f.uso === 'PUBLICABLE') ? 'PUBLICABLE' : 'SOLO_PRUEBA_COMPOSICION',
  }, secuencia.huella, ordenadas.length === fotos.length && ordenadas.every(f => f !== undefined) ? ordenadas : fotos);
  return serie;
}

async function valorarFotografias(deps: DepsPost, e: EncargoPost, secuencia: SecuenciaTaller, progreso?: AlProgresar) {
  if (!deps.revisorDeCarrusel || !puedeValorarFotografias(secuencia) || !('paginas' in secuencia.direccion)) return e;
  const portada = portadaAprobada(e);
  const base = await leerPortada(deps, e, portada);
  const fotos = await fotosAprobadasDelGuion(deps, e, secuencia, secuencia.direccion, base, portada.uso);
  progreso?.({ mensaje: 'El director revisa si las fotografías cuentan la historia por sí solas.', hechas: 0, total: 1,
    pasosRestantes: { director: 1, tandas: 0 } });
  const { modelo, ...lectura } = await deps.revisorDeCarrusel({
    nota: e.plato, preferencia: secuencia.preferencia, guion: secuencia.direccion,
    fotos: fotos.map(({ id, bytes }) => ({ id, bytes })),
  });
  const resultado = { ...esquemaDeLectura(fotos.map(f => f.id)).parse(lectura), modelo };
  const taller = e.taller!;
  if (resultado.recomendacion === 'FOTOGRAFIA' && taller.serieFotografica?.guionSha256 !== secuencia.huella) {
    taller.serieFotografica = await prepararSerieFotografica(deps, e, { ...secuencia, lecturaFotografica: resultado }, portada, fotos);
  }
  secuencia.lecturaFotografica = resultado;
  return registrar(deps, e, 'HECHO', 'Valoradas las fotos aprobadas y la aportación del guion gráfico.');
}

export async function descargarTomaSerie(deps: DepsPost, e: EncargoPost, toma: TomaDeSerie, paquete: boolean) {
  const secuencia = secuenciaVigente(e);
  if (!tomaPlaneada(secuencia.direccion, toma)) throw new ErrorDeUsuario('Esta toma no figura en la dirección del carrusel.');
  if (paquete) {
    const [producto, portada] = await Promise.all([imagenFuente(deps, e, exigirConfirmada(e)), leerPortada(deps, e)]);
    return paqueteDeToma(secuencia, toma, producto, portada.bytes);
  }
  const candidata = secuencia.tomas[toma]?.candidata;
  if (!candidata) throw new ErrorDeUsuario('Todavía no hay una toma para revisar.');
  return leerToma(carpeta(deps, e), candidata.sha256);
}

export async function descargarSerie(deps: Pick<DepsPost, 'raiz' | 'proyectos'>, e: EncargoPost, hash: string, pagina?: number) {
  const serie = [e.taller?.serie, e.taller?.serieFotografica].find(s => s?.huella === hash);
  if (e.paso !== 'HECHO' || !serie || serie.huella !== hash) throw new ErrorDeUsuario('Esta serie no corresponde a la edición vigente.');
  await fuenteVerificada(deps, e, exigirConfirmada(e));
  const candidata = e.taller?.candidatas.find(c => c.version === serie.versionBase);
  if (!candidata?.revision) throw new ErrorDeUsuario('Falta la revisión de la base de esta serie.');
  const base = pagina !== undefined || serie.soloFotos ? undefined : candidata.composicion ? (await leerCapa(deps, e, candidata.version, 'base')).bytes : (await bytesDeCandidata(deps, e, candidata.version)).bytes;
  const fotos = pagina !== undefined || serie.soloFotos ? [] : await Promise.all(serie.paginas.flatMap((p, i) => {
    if (p.fotoSha256) return [leerToma(carpeta(deps, e), p.fotoSha256).then(bytes => ({ nombre: 'foto-' + (i + 1) + '.png', bytes }))];
    return (p.fotosSha256 ?? []).flatMap((sha, j) => sha === serie.baseSha256 ? [] :
      [leerToma(carpeta(deps, e), sha).then(bytes => ({ nombre: 'foto-' + (i + 1) + '-' + (j + 1) + '.png', bytes }))]);
  }));
  if (pagina === undefined && serie.mascaraSha256) fotos.push({ nombre: 'mascara-portada.png', bytes: await leerToma(carpeta(deps, e), serie.mascaraSha256) });
  return { bytes: await leerSerie(carpeta(deps, e), serie, pagina, base, fotos), uso: serie.uso, soloFotos: serie.soloFotos };
}

export async function exportarArte(deps: DepsPost, e: EncargoPost) {
  const ultima = e.taller?.candidatas.at(-1);
  if (e.paso !== 'HECHO' || !ultima?.revision) throw new ErrorDeUsuario('Revisa y aprueba esta versión antes de exportarla.');
  if (ultima.uso !== 'PUBLICABLE') throw new ErrorDeUsuario('Esta composición es solo de prueba. La vista previa está disponible.');
  await imagenFuente(deps, e, exigirConfirmada(e));
  return (await bytesDeCandidata(deps, e, ultima.version)).bytes;
}

async function superficieUniforme(bytes: Buffer): Promise<boolean> {
  const movil = await sharp(bytes).resize(360, 450).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const medidas = await sharp(movil.data, { raw: movil.info }).stats();
  return medidas.channels.every(c => c.stdev < 1);
}

async function incorporar(deps: DepsPost, e: EncargoPost, comanda: ComandaDeArte, bytes: Buffer, origen: Candidata['origen'], uso: Candidata['uso'], encuadreOriginal?: number, recomponer?: { receta: NonNullable<ComandaDeArte['tipografiaLocal']>; version: number; mascara?: MascaraDePlano }) {
  const taller = e.taller!;
  if (!bytes.length || bytes.length > 32 * 1024 * 1024) throw new ErrorDeUsuario('La candidata no contiene una imagen del tamaño admitido.');
  const imagen = sharp(bytes, { failOn: 'warning', limitInputPixels: 36_000_000 });
  const meta = await imagen.metadata().catch(() => { throw new ErrorDeUsuario('La candidata debe poder abrirse como PNG, JPEG o WebP.'); });
  const { width, height } = meta.autoOrient;
  if (width < 360 || height < 450) throw new ErrorDeUsuario('El cartel debe alcanzar al menos 360 × 450 píxeles para revisarlo a tamaño móvil.');
  if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages ?? 1) !== 1 || Math.abs(width - 0.8 * height) > 2) {
    throw new ErrorDeUsuario('Importa una imagen fija vertical en proporción 4:5. El taller conserva el encuadre completo.');
  }
  const base = recomponer ? bytes : await imagen.rotate().flatten({ background: '#fff' }).resize(1080, 1350, { fit: 'fill' }).png().toBuffer();
  const receta = recomponer?.receta ?? comanda.tipografiaLocal;
  const titulo = comanda.textos.find(b => b.papel === 'TITULAR')?.texto;
  const impresa = receta && titulo ? await componerTitulo(base, huella(base), titulo, receta, recomponer?.mascara) : undefined;
  const png = impresa?.png ?? base;
  const sha256 = huella(png);
  if (recomponer ? taller.candidatas.at(-1)?.sha256 === sha256 : taller.candidatas.some(c => c.sha256 === sha256)) throw new ErrorDeUsuario('Esta misma imagen ya se revisó. Importa la versión corregida.');
  await mkdir(carpeta(deps, e), { recursive: true });
  const ruta = join(carpeta(deps, e), sha256 + '.png');
  if (impresa && !recomponer) {
    const bases = join(carpeta(deps, e), 'bases');
    await mkdir(bases, { recursive: true });
    await writeFile(join(bases, impresa.composicion.baseSha256 + '.png'), base);
  }
  await writeFile(ruta, png);
  const [ocr, uniforme] = await Promise.all([leerCartel(ruta, comanda.textos.map(b => b.texto)), superficieUniforme(base)]);
  // El OCR reconoce también la carta, la vajilla impresa o el rótulo del local. Sólo la persona puede cotejar su procedencia.
  const coincide = impresa && ocr.lineas.length ? coincideTexto(comanda.textos.map(b => b.texto), [ocr.lineas.join(' ')]) : ocr.coincide;
  const lectura = { ...ocr, coincide: esFotoEditorial(comanda.editorial?.ruta) ? null : coincide, superficieUniforme: uniforme };
  taller.candidatas.push({ version: taller.candidatas.length + 1, sha256, comanda: comanda.huella,
    origen, ...(impresa ? { composicion: { ...impresa.composicion, ...(recomponer ? { versionBase: recomponer.version } : {}) } } : {}), ...(encuadreOriginal !== undefined ? { encuadreOriginal } : {}), uso: e.usoFotoReal === 'PUBLICABLE' ? uso : 'SOLO_PRUEBA_COMPOSICION', fecha: deps.ahora(), lectura });
  return registrar(deps, e, 'CONFIRMAR_FOTO', 'Cartel raster 4:5 listo para cotejo con el producto y lectura en móvil.');
}

export async function decidirTaller(deps: DepsPost, e: EncargoPost, accion: AccionTaller, subida?: string, progreso?: AlProgresar): Promise<EncargoPost> {
  const taller = e.taller;
  if (accion.accion === 'SIN_REFERENCIA') {
    if (!taller || e.paso !== 'REFERENCIA' || e.referencia) throw new ErrorDeUsuario('La referencia ya está elegida.');
    const resultado = await prepararTaller(deps, e, true);
    if (!resultado.encargo.taller?.comanda) throw new ErrorDeUsuario(resultado.parada);
    return resultado.encargo;
  }
  if (accion.accion === 'FICHAR_REFERENCIA') {
    if (!taller || e.paso !== 'REFERENCIA' || !e.referencia) throw new ErrorDeUsuario('Elige primero la referencia que quieres analizar.');
    const ref = await deps.referencias.referencias.obtener(e.local, e.referencia);
    if (!ref.origen.archivo || ref.ficha || ref.analisis?.decision === 'RECHAZA') throw new ErrorDeUsuario('Esta referencia no admite una nueva ficha manual.');
    const archivo = deps.referencias.referencias.rutaArchivo(e.local, ref.id, ref.origen.archivo);
    const rgb = await sharp(archivo).rotate().resize(72, 90, { fit: 'cover' }).toColourspace('srgb').removeAlpha().raw().toBuffer();
    const colores = construirMapa({ ancho: 72, alto: 90, rgb }).paleta;
    await guardarFicha(deps.referencias, { local: e.local, id: ref.id, ficha: {
      esquema: 'referencia/ficha@1', titulo: 'Referencia del encargo ' + e.proyecto, familia: accion.familia, mecanismos: [accion.mecanismo],
      reticula: accion.reticula, foto: accion.foto, capas: [accion.foto, accion.voz], tipografia: [{ rol: 'TITULAR', clasificacion: accion.voz }],
      paleta: colores.map(c => ({ hex: c.hex, rol: 'Superficie medida' })), lectura: accion.lectura, porQueFunciona: accion.reticula,
      analizadaPor: 'ESTUDIO_A_MANO', analizadaEn: deps.ahora().slice(0, 10),
    } });
    return (await prepararTaller(deps, e)).encargo;
  }
  if (!taller?.comanda) throw new ErrorDeUsuario('Falta la dirección de este encargo de arte integrado.');
  const comanda = taller.comanda;
  const ultimo = taller.candidatas.at(-1);
  if (accion.accion === 'EXPLORAR_RUTA') {
    if (!taller.seleccionEditorial || e.paso !== 'CONFIRMAR_ELEMENTOS') throw new ErrorDeUsuario('Reabre la dirección editorial para explorar otra lectura.');
    if (accion.ruta === comanda.editorial?.ruta) return e;
    taller.comanda = await redactar(deps, e, { ruta: accion.ruta });
    return registrar(deps, e, e.paso, 'Preparada otra dirección editorial para esta fuente.');
  }
  if (accion.accion === 'AJUSTAR_MUESTRAS') {
    if (e.paso !== 'CONFIRMAR_ELEMENTOS') throw new ErrorDeUsuario('Reabre la dirección para cambiar los detalles del producto.');
    taller.comanda = await redactar(deps, e, { direccion: comanda.direccion, muestras: accion.muestras });
    return registrar(deps, e, e.paso, accion.muestras ? 'Lámina de detalles y nueva colocación preparadas para inspección.' : 'Foto completa seleccionada para producir el cartel.');
  }
  if (accion.accion === 'AJUSTAR_TOMA') {
    if (e.paso !== 'CONFIRMAR_ELEMENTOS') throw new ErrorDeUsuario('Reabre la dirección para ajustar la cámara.');
    const { accion: _accion, revision: _revision, ...seleccion } = accion;
    const cambiaEscena = JSON.stringify(seleccion.escenaFuente) !== JSON.stringify(comanda.toma?.seleccion.escenaFuente);
    taller.comanda = await redactar(deps, e, { direccion: cambiaEscena ? undefined : comanda.direccion, toma: seleccion });
    return registrar(deps, e, e.paso, 'Cámara, encuadre y evidencia de la nueva toma preparados.');
  }
  if (accion.accion === 'EDITAR' || accion.accion === 'PROPONER_GESTO' || accion.accion === 'CONFIRMAR_DIRECCION') {
    if (e.paso !== 'CONFIRMAR_ELEMENTOS') throw new ErrorDeUsuario('Esta dirección ya no se encuentra en revisión.');
    if (accion.accion === 'PROPONER_GESTO') {
      if (comanda.editorial && comanda.editorial.ruta !== 'CARTEL_EXPRESIVO') throw new ErrorDeUsuario('El gesto entre letra y sujeto se edita en el cartel expresivo.');
      taller.comanda = await redactar(deps, e, { gesto: accion.gesto });
      return registrar(deps, e, e.paso, 'Nueva propuesta de escena y tipografía.');
    }
    if (accion.accion === 'EDITAR') {
      taller.comanda = await redactar(deps, e, { direccion: accion.direccion, nombrePlato: accion.nombrePlato });
      return registrar(deps, e, e.paso, 'Dirección de arte editada.');
    }
    if (comanda.muestras) {
      if (!accion.confirmoMuestras) throw new ErrorDeUsuario('Revisa la lámina y confirma el recuento antes de producir.');
      await bytesDeMuestras(deps, e, comanda.muestras.sha256);
    }
    await imagenFuente(deps, e, comanda);
    await mkdir(join(carpeta(deps, e), 'comandas'), { recursive: true });
    await escribirJsonAtomico(join(carpeta(deps, e), 'comandas', comanda.huella + '.json'), comanda);
    taller.confirmada = { fecha: deps.ahora(), huella: comanda.huella };
    return registrar(deps, e, 'GENERAR', 'Dirección, sujeto y texto confirmados. Paquete de producción disponible.');
  }
  exigirConfirmada(e);
  if (accion.accion === 'DIRIGIR_SECUENCIA' || accion.accion === 'DIRIGIR_CARRUSEL') {
    const aprobada = portadaAprobada(e);
    const libre = accion.accion === 'DIRIGIR_CARRUSEL';
    const permitePuesta = comanda.puesta?.ambito === 'PRODUCTO' && comanda.toma?.seleccion.escenaFuente?.modo !== 'DOCUMENTAL';
    if (!libre && !permitePuesta) {
      throw new ErrorDeUsuario('La secuencia de estudio necesita una portada de producto que admita una puesta editorial.');
    }
    if (accion.version !== aprobada.version) throw new ErrorDeUsuario('La portada ha cambiado.');
    if (taller.secuencia && (!libre || 'paginas' in taller.secuencia.direccion)) return e;
    const director = libre ? deps.directorCarrusel : deps.directorSecuencia;
    if (!director) throw new ErrorDeUsuario('Configura Gemini para dirigir una secuencia o usa el modo simulado.');
    progreso?.({ mensaje: libre ? 'El director compara las referencias y decide el ritmo, las tomas y la maquetación.' :
      'Hydrogen estudia el alimento y prepara dos tomas que continúen la portada.', hechas: 0, total: 1, pasosRestantes: { director: 1, tandas: 0 } });
    const [fuente, portada, recientes] = await Promise.all([
      fuenteVerificada(deps, e, comanda), leerPortada(deps, e, aprobada), deps.postsRecientes?.(e),
    ]);
    const luz = comanda.modoDeLuz ?? luzSolicitada(e.plato) ?? 'NATURAL';
    let referenciaVisual: Buffer | undefined;
    if (libre && subida) referenciaVisual = await readFile(subida);
    else if (libre && e.referencia) {
      const r = await deps.referencias.referencias.obtener(e.local, e.referencia);
      if (r.origen.archivo) referenciaVisual = await readFile(deps.referencias.referencias.rutaArchivo(e.local, r.id, r.origen.archivo)).catch(() => undefined);
    }
    const documental = libre && !permitePuesta ? true as const : undefined;
    const salida = await director({ original: fuente, portada: portada.bytes, encargo: e.plato, producto: comanda.direccion.sujeto,
      referencia: comanda.referencia, luz, recientes, nombre: comanda.nombrePlato ?? e.plato,
      preferencia: libre ? accion.preferencia : undefined, referenciaVisual, documental });
    const direccion = libre ? GuionEditorial.parse(salida.direccion) : DireccionSecuencia.parse(salida.direccion);
    const base = { comanda: comanda.huella, version: aprobada.version, baseSha256: huella(portada.bytes), modelo: salida.modelo, luz, direccion, documental,
      ...(libre && accion.preferencia ? { preferencia: accion.preferencia } : {}),
      ...(referenciaVisual ? { referenciaVisualSha256: huella(referenciaVisual) } : {}) };
    const extra = 'paginas' in direccion && direccion.tomas.extra;
    taller.secuencia = { ...base, huella: huella(JSON.stringify(base)), tomas: { detalle: {}, cierre: {}, ...(extra ? { extra: {} } : {}) } };
    const modelo = salida.modelo;
    return registrar(deps, e, 'HECHO', 'Dirección de la secuencia preparada con ' + modelo + '.');
  }
  if (accion.accion === 'IMPORTAR_TOMA_SERIE' || accion.accion === 'GENERAR_TOMA_SERIE' || accion.accion === 'REVISAR_TOMA_SERIE') {
    const secuencia = secuenciaVigente(e);
    const estado = secuencia.tomas[accion.toma];
    const planeada = tomaPlaneada(secuencia.direccion, accion.toma);
    if (!estado || !planeada) throw new ErrorDeUsuario('Esta toma no figura en la dirección del carrusel.');
    const formato = formatoDeToma(planeada);
    const portada = portadaAprobada(e);
    await fuenteVerificada(deps, e, comanda);
    if (estado.candidata?.aprobada) throw new ErrorDeUsuario('Esta toma ya está aprobada.');
    if (accion.accion === 'REVISAR_TOMA_SERIE') {
      if (!estado.candidata || estado.candidata.sha256 !== accion.sha256) throw new ErrorDeUsuario('La candidata ha cambiado.');
      await leerToma(carpeta(deps, e), accion.sha256);
      if (accion.decision === 'APROBAR') estado.candidata.aprobada = true;
      else delete estado.candidata;
      const revisado = await registrar(deps, e, 'HECHO', accion.decision === 'APROBAR' ? 'Toma de serie aprobada.' : 'Toma devuelta. Puedes importar otra.');
      if (accion.decision !== 'APROBAR') return revisado;
      // La aprobación queda guardada incluso si falla el proveedor de lectura.
      return valorarFotografias(deps, revisado, secuencia, progreso).catch(() => revisado);
    }
    if (estado.candidata) throw new ErrorDeUsuario('Revisa la candidata antes de pedir otra toma.');
    let datos: Buffer;
    let modelo = 'Importación';
    let uso = portada.uso === 'PUBLICABLE' && accion.accion === 'IMPORTAR_TOMA_SERIE' ? accion.usoCandidata ?? 'SOLO_PRUEBA_COMPOSICION' : portada.uso;
    if (accion.accion === 'IMPORTAR_TOMA_SERIE') {
      if (!subida) throw new ErrorDeUsuario('Falta la foto que quieres importar.');
      datos = await readFile(subida);
    } else {
      if (secuencia.documental) throw new ErrorDeUsuario('Esta serie documenta una escena real. Importa una foto de ese plato o espacio.');
      if (estado.envioReservado) throw new ErrorDeUsuario('Esta dirección ya reservó un envío. Puedes importar el resultado o una alternativa.');
      const disponible = deps.generador.disponible();
      if (!disponible.ok) throw new ErrorDeUsuario(disponible.motivo);
      const base = await leerPortada(deps, e, portada);
      const reservar = async () => {
        estado.envioReservado = true;
        await registrar(deps, e, 'HECHO', 'Envío reservado para la toma de ' + accion.toma + '.');
      };
      if (!deps.generador.reservaEnEnvio) await reservar();
      progreso?.({ mensaje: 'Generando sólo la toma de ' + accion.toma + '.', hechas: 0, total: 1, pasosRestantes: { director: 0, tandas: 1 } });
      const nueva = await deps.generador.generar({
        id: e.proyecto + '-serie-' + secuencia.huella + '-' + accion.toma,
        referencias: [
          { ruta: resolve(deps.raiz, e.fotoSubida), etiqueta: 'Imagen 1. Evidencia del alimento.' },
          { ruta: base.ruta, etiqueta: 'Imagen 2. Portada aprobada.' },
        ],
        prompt: promptDeToma(secuencia, accion.toma), aspectRatio: formato, tamano: '1K',
        estimadoMaximoUsd: accion.estimadoMaximoUsd, ...(deps.generador.reservaEnEnvio ? { antesDeEnviar: reservar } : {}),
      });
      datos = nueva.bytes;
      modelo = nueva.modelo;
      if (e.simulado) uso = 'SOLO_PRUEBA_COMPOSICION';
    }
    const candidata = await guardarToma(carpeta(deps, e), datos, modelo, uso, formato);
    if (candidata.sha256 === secuencia.baseSha256 || Object.values(secuencia.tomas).some(t => t?.candidata?.sha256 === candidata.sha256)) {
      throw new ErrorDeUsuario('Esta imagen repite otra lámina. Importa una toma con otra cámara o gesto.');
    }
    estado.candidata = candidata;
    return registrar(deps, e, 'HECHO', 'Toma de ' + accion.toma + ' disponible para revisión.');
  }
  if (accion.accion === 'VALORAR_FOTOS_SERIE') {
    const secuencia = secuenciaVigente(e);
    if (secuencia.version !== accion.version) throw new ErrorDeUsuario('La portada ha cambiado.');
    if (secuencia.lecturaFotografica) return e;
    if (!deps.revisorDeCarrusel || !puedeValorarFotografias(secuencia)) throw new ErrorDeUsuario('La lectura requiere un guion gráfico con fotos aprobadas.');
    return valorarFotografias(deps, e, secuencia, progreso);
  }
  if (accion.accion === 'IMPORTAR_MASCARA_SERIE') {
    const secuencia = secuenciaVigente(e);
    const pagina = 'paginas' in secuencia.direccion ? secuencia.direccion.paginas[Number(accion.pagina) - 1] : undefined;
    if (secuencia.version !== accion.version || !subida || pagina?.tratamiento !== 'TEXTO_EN_AIRE') throw new ErrorDeUsuario('Elige una máscara para una lámina vigente con texto sobre fotografía.');
    await fuenteVerificada(deps, e, comanda);
    const id = pagina.fotos[0]!;
    const toma = id === 'base' ? undefined : secuencia.tomas[id]?.candidata;
    if (id !== 'base' && !toma?.aprobada) throw new ErrorDeUsuario('Aprueba la foto de la lámina antes de importar su máscara.');
    const foto = toma ? await leerToma(carpeta(deps, e), toma.sha256) : (await leerPortada(deps, e)).bytes;
    const { width, height } = await sharp(foto).metadata();
    const imagen = sharp(subida, { limitInputPixels: 36_000_000 });
    const meta = await imagen.metadata().catch(() => undefined);
    if (meta?.format !== 'png' || meta.width !== width || meta.height !== height || meta.hasAlpha || (meta.pages ?? 1) !== 1) {
      throw new ErrorDeUsuario('Sube un PNG opaco de ' + width + ' × ' + height + ' px. Usa blanco para el primer plano y negro para el fondo.');
    }
    const gris = imagen.greyscale().extractChannel(0);
    const mascara = await gris.png().toBuffer();
    const { min, max } = (await sharp(mascara).stats()).channels[0]!;
    if (min > 32 || max < 223) throw new ErrorDeUsuario('La máscara necesita un primer plano blanco y un fondo negro.');
    const sha = huella(mascara);
    await mkdir(join(carpeta(deps, e), 'tomas-serie'), { recursive: true });
    await writeFile(rutaToma(carpeta(deps, e), sha), mascara);
    secuencia.mascaras = { ...secuencia.mascaras, [accion.pagina]: sha };
    return registrar(deps, e, 'HECHO', 'Máscara guardada para la lámina ' + accion.pagina + '.');
  }
  if (accion.accion === 'MAQUETAR_SERIE' || accion.accion === 'MAQUETAR_SOLO_FOTOS') {
    if (e.paso !== 'HECHO' || !ultimo?.revision || ultimo.version !== accion.version || ultimo.comanda !== comanda.huella) throw new ErrorDeUsuario('Aprueba primero la candidata que quieres maquetar.');
    if (!ultimo.composicion && !esFotoEditorial(comanda.editorial?.ruta)) throw new ErrorDeUsuario('Una serie requiere una base fotográfica sin el texto integrado en los píxeles.');
    await fuenteVerificada(deps, e, comanda);
    await bytesDeCandidata(deps, e, ultimo.version);
    const base = await leerPortada(deps, e, ultimo);
    const soloFotos = accion.accion === 'MAQUETAR_SOLO_FOTOS';
    const secuencia = soloFotos || accion.usarTomas ? secuenciaVigente(e) : undefined;
    if (soloFotos) {
      if (!secuencia || !('paginas' in secuencia.direccion)) throw new ErrorDeUsuario('La versión fotográfica se prepara desde un guion editorial.');
      const fotos = await fotosAprobadasDelGuion(deps, e, secuencia, secuencia.direccion, base, ultimo.uso);
      taller.serieFotografica = await prepararSerieFotografica(deps, e, secuencia, ultimo, fotos);
      return registrar(deps, e, 'HECHO', 'Carrusel fotográfico guardado con las fotos aprobadas en su proporción.');
    }
    const baseSerie = {
      comanda: comanda.huella, fotoSha256: comanda.fotoSha256, baseSha256: huella(base.bytes), versionBase: ultimo.version, uso: ultimo.uso,
      origen: ultimo.origen, ...(comanda.referencia ? { referencia: { id: comanda.referencia.id, mecanismos: comanda.referencia.mecanismos, voces: comanda.referencia.voces } } : {}),
    };
    if (secuencia && 'paginas' in secuencia.direccion) {
      const guion = secuencia.direccion;
      const aprobadas = await fotosAprobadasDelGuion(deps, e, secuencia, guion, base, ultimo.uso);
      if (aprobadas.some(f => f.uso !== 'PUBLICABLE')) baseSerie.uso = 'SOLO_PRUEBA_COMPOSICION';
      const fotos = new Map(aprobadas.map(f => [f.id, f]));
      if (accion.paginas.length !== guion.paginas.length) throw new ErrorDeUsuario('La edición debe corresponder a las láminas dirigidas.');
      const previa = taller.serie?.guionSha256 === secuencia.huella ? taller.serie : undefined;
      taller.serie = await maquetarCarrusel(deps.raiz, carpeta(deps, e), baseSerie, secuencia, guion, accion.paginas, fotos, {
        marca: e.local,
        primerPlano: async (n, id) => {
          const manual = secuencia.mascaras?.[String(n) as '1' | '2' | '3' | '4' | '5'];
          if (manual) return leerToma(carpeta(deps, e), manual);
          const anterior = previa && await leerMascaraDeSerie(carpeta(deps, e), previa, n);
          if (anterior) return anterior;
          const region = guion.paginas[n - 1]?.profundidad?.primerPlano;
          const foto = fotos.get(id);
          if (!region || !foto || e.simulado) return undefined;
          const meta = await sharp(foto.bytes).metadata();
          return deps.segmentador.mascara(foto.ruta).then(bytes => limitarMascara(bytes, meta.width, meta.height, region)).catch(() => undefined);
        },
      });
      return registrar(deps, e, 'HECHO', 'Carrusel editorial compuesto con las fotografías revisadas y el texto confirmado.');
    }
    let tomas: TomasParaSerie | undefined;
    let uso = ultimo.uso;
    if (secuencia && !('paginas' in secuencia.direccion)) {
      if (accion.paginas.length !== 3) throw new ErrorDeUsuario('Usa una portada, un detalle y un cierre.');
      const { detalle, cierre } = secuencia.tomas;
      if (!detalle.candidata?.aprobada || !cierre.candidata?.aprobada) throw new ErrorDeUsuario('Revisa y aprueba las dos tomas antes de maquetar.');
      if (detalle.candidata.uso !== 'PUBLICABLE' || cierre.candidata.uso !== 'PUBLICABLE') uso = 'SOLO_PRUEBA_COMPOSICION';
      tomas = {
        detalle: { ruta: rutaToma(carpeta(deps, e), detalle.candidata.sha256), sha256: detalle.candidata.sha256 },
        cierre: { ruta: rutaToma(carpeta(deps, e), cierre.candidata.sha256), sha256: cierre.candidata.sha256 },
      };
      if (secuencia.direccion.portada && accion.paginas[0]?.titulo) {
        const region = secuencia.direccion.portada.primerPlano;
        const mascara = await deps.segmentador.mascara(base.ruta).then(bytes => limitarMascara(bytes, 1080, 1350, region)).catch(() => undefined);
        if (mascara) tomas.portada = { mascara, zona: secuencia.direccion.portada.zonaTexto };
      }
    }
    taller.serie = await maquetarSerie(deps.raiz, carpeta(deps, e), e.local, { ...baseSerie, uso }, base.ruta, accion.paginas, tomas);
    return registrar(deps, e, 'HECHO', 'Serie maquetada sobre la candidata revisada. Texto literal confirmado. Versión ' + taller.serie.huella);
  }
  if (accion.accion === 'REABRIR_DIRECCION') {
    if (e.paso !== 'GENERAR') throw new ErrorDeUsuario('Ya hay una candidata en revisión.');
    delete taller.confirmada;
    return registrar(deps, e, 'CONFIRMAR_ELEMENTOS', 'Dirección reabierta para edición.');
  }
  if (accion.accion === 'USAR_ORIGINAL') {
    if (e.paso !== 'GENERAR' || !(esFotoEditorial(comanda.editorial?.ruta) || comanda.tipografiaLocal) || comanda.muestras) throw new ErrorDeUsuario('La foto original sólo se puede encuadrar en una dirección fotográfica con fuente completa.');
    if (comanda.toma?.seleccion.escenaFuente?.modo === 'EDITORIAL') throw new ErrorDeUsuario('Importa la escena dirigida o elige el modo documental para usar la foto original.');
    const bytes = await fuenteVerificada(deps, e, comanda);
    const { width, height } = (await sharp(bytes).metadata()).autoOrient;
    if (accion.completa) {
      if (!comanda.tipografiaLocal) throw new ErrorDeUsuario('El margen de composición pertenece a la foto con título.');
      if (Math.min(width, height) < 360) throw new ErrorDeUsuario('La fotografía debe alcanzar 360 px en su lado menor.');
      const foto = await sharp(bytes).rotate().resize(1080, 1350, { fit: 'inside' }).removeAlpha().png().toBuffer({ resolveWithObject: true });
      const dx = 1080 - foto.info.width, dy = 1350 - foto.info.height;
      const left = Math.floor(dx / 2), top = dy;
      // Sólo los márgenes prolongan el color del borde. La fotografía completa queda intacta y legible.
      const extendida = await sharp(foto.data).extend({ top, left, right: dx - left, bottom: dy - top, extendWith: 'copy' }).png().toBuffer();
      const png = await sharp(extendida).blur(28).composite([{ input: foto.data, left, top }]).png().toBuffer();
      return incorporar(deps, e, comanda, png, 'ORIGINAL', e.usoFotoReal);
    }
    const unidad = Math.floor(Math.min(width / 4, height / 5));
    if (unidad < 90) throw new ErrorDeUsuario('El encuadre real debe alcanzar 360 × 450 px.');
    const ancho = 4 * unidad, alto = 5 * unidad;
    const recorte = { left: Math.round((width - ancho) * accion.posicion), top: Math.round((height - alto) * accion.posicion), width: ancho, height: alto };
    const png = await sharp(bytes).rotate().extract(recorte).resize(1080, 1350).png().toBuffer();
    return incorporar(deps, e, comanda, png, 'ORIGINAL', e.usoFotoReal, accion.posicion);
  }
  if (accion.accion === 'GENERAR_PORTADA_FOTO') {
    if (e.paso !== 'GENERAR' || comanda.puesta?.ambito !== 'PRODUCTO' || comanda.muestras ||
      comanda.toma?.seleccion.escenaFuente?.modo === 'DOCUMENTAL' || !(esFotoEditorial(comanda.editorial?.ruta) || comanda.tipografiaLocal)) {
      throw new ErrorDeUsuario('Esta dirección no admite generación de una base fotográfica.');
    }
    if (taller.envios.some(v => v.huella === comanda.huella)) throw new ErrorDeUsuario('Ya se reservó un envío para esta dirección. Puedes importar la foto.');
    await fuenteVerificada(deps, e, comanda);
    const disponible = deps.generador.disponible();
    if (!disponible.ok) throw new ErrorDeUsuario(disponible.motivo);
    const reservar = async () => {
      taller.envios.push({ huella: comanda.huella, fecha: deps.ahora(), numero: taller.envios.length + 1 });
      await registrar(deps, e, 'GENERAR', 'Envío de la base fotográfica reservado.');
    };
    if (!deps.generador.reservaEnEnvio) await reservar();
    progreso?.({ mensaje: 'El generador prepara la primera foto de la sesión.', hechas: 0, total: 1, pasosRestantes: { director: 0, tandas: 1 } });
    const nueva = await deps.generador.generar({
      id: e.proyecto + '-apertura-' + comanda.huella, referencias: [{ ruta: resolve(deps.raiz, e.fotoSubida), etiqueta: 'Imagen 1. Evidencia del producto.' }],
      prompt: comanda.prompt, aspectRatio: '4:5', tamano: '1K', estimadoMaximoUsd: accion.estimadoMaximoUsd,
      ...(deps.generador.reservaEnEnvio ? { antesDeEnviar: reservar } : {}),
    });
    return incorporar(deps, e, comanda, await normalizarFotoDeSerie(nueva.bytes), 'IMAGES_API', e.simulado ? 'SOLO_PRUEBA_COMPOSICION' : comanda.uso);
  }
  if (accion.accion === 'IMPORTAR' || accion.accion === 'GENERAR') {
    if (e.paso !== 'GENERAR') throw new ErrorDeUsuario('Revisa primero la candidata vigente.');
    const foto = await imagenFuente(deps, e, comanda);
    if (accion.accion === 'IMPORTAR') {
      if (!subida) throw new ErrorDeUsuario('Falta la imagen que vas a importar.');
      return incorporar(deps, e, comanda, await readFile(subida), 'IMPORTACION', accion.usoCandidata ?? 'SOLO_PRUEBA_COMPOSICION');
    }
    const api = deps.tallerApi;
    if (!api || e.simulado) throw new ErrorDeUsuario('La generación por API está desactivada. Descarga el paquete e importa la imagen.');
    if (taller.envios.some(envio => envio.huella === comanda.huella)) throw new ErrorDeUsuario('Ya se autorizó el envío de esta dirección. Puedes importar la candidata.');
    const entrada = comanda.muestras ? await bytesDeMuestras(deps, e, comanda.muestras.sha256) : foto;
    const numero = await reservarEnvio(api.reservas, api.limite, comanda.huella, e.proyecto, deps.ahora());
    taller.envios.push({ fecha: deps.ahora(), huella: comanda.huella, numero });
    const reservado = await registrar(deps, e, 'GENERAR', comanda.muestras ? 'Autorizado un único envío de la lámina confirmada y el prompt a Images API.' : 'Autorizado un único envío de la foto y el prompt a Images API.');
    progreso?.({ paso: 'GENERAR', mensaje: 'Generando el cartel completo con gpt-image-2…', hechas: 0, total: 1, pasosRestantes: { director: 0, tandas: 1 } });
    const imagen = await api.generador.generar(comanda.prompt, entrada, comanda.muestras ? 'muestras.jpg' : 'producto.jpg');
    progreso?.({ paso: 'COMPROBAR', mensaje: 'Comprobando formato y leyendo las palabras de la imagen…', hechas: 1, total: 1, pasosRestantes: { director: 0, tandas: 0 } });
    return incorporar(deps, reservado, comanda, imagen, 'IMAGES_API', comanda.uso);
  }
  if (e.paso !== 'CONFIRMAR_FOTO' || !ultimo || ultimo.version !== accion.version || ultimo.comanda !== comanda.huella) {
    throw new ErrorDeUsuario('La decisión debe corresponder a la candidata vigente.');
  }
  const { bytes } = await bytesDeCandidata(deps, e, ultimo.version);
  if (accion.accion === 'RECOMPONER_TITULO') {
    if (!comanda.tipografiaLocal || !ultimo.composicion) throw new ErrorDeUsuario('Esta versión carece de una fotografía base para recomponer el título.');
    if (accion.mascaraId && !accion.plano) throw new ErrorDeUsuario('Elige aire o solape para usar la máscara.');
    const { bytes: base, ruta } = await leerCapa(deps, e, ultimo.version, 'base');
    const mascara = accion.plano ? await mascaraDeBase(deps, e, ultimo, ruta, accion.plano, subida) : undefined;
    let vigente = comanda;
    if (accion.tituloLiteral && accion.tituloLiteral !== comanda.nombrePlato) {
      vigente = await redactar(deps, e, { nombrePlato: accion.tituloLiteral, direccion: comanda.direccion });
      if (vigente.fotoSha256 !== comanda.fotoSha256) throw new ErrorDeUsuario('La fuente ha cambiado desde que se preparó la foto base.');
      await escribirJsonAtomico(join(carpeta(deps, e), 'comandas', vigente.huella + '.json'), vigente);
      taller.comanda = vigente;
      taller.confirmada = { fecha: deps.ahora(), huella: vigente.huella };
    }
    const receta = maquetaDeTitulo(e.plato, vigente.nombrePlato ?? e.plato, { opcion: 'AUTO', estiloTitulo: accion.estiloTitulo, posicionTitulo: accion.posicionTitulo });
    return incorporar(deps, e, vigente, base, ultimo.origen, ultimo.uso, ultimo.encuadreOriginal, { receta, version: ultimo.version, mascara });
  }
  if (accion.accion === 'ANOTAR_REVISION') {
    ultimo.avisoVisual = accion.observacion;
    return registrar(deps, e, e.paso, 'Observación visual sobre la versión ' + ultimo.version + ': ' + accion.observacion);
  }
  if (accion.accion === 'DEVOLVER') {
    ultimo.devolucion = accion.motivo;
    delete taller.confirmada;
    const seleccion = accion.ajusteToma ? { ...comanda.toma?.seleccion, ...accion.ajusteToma } : comanda.toma?.seleccion;
    taller.comanda = await redactar(deps, e, { direccion: comanda.direccion, toma: seleccion });
    return registrar(deps, e, 'CONFIRMAR_ELEMENTOS', 'Candidata devuelta. Revisa la corrección antes de otra producción.');
  }
  if (ultimo.lectura.superficieUniforme ?? await superficieUniforme(bytes)) throw new ErrorDeUsuario('La imagen aparece uniforme a 360 px. Devuelve esta versión e importa una imagen donde se lean el producto y el texto.');
  const escenaFuente = comanda.toma?.seleccion.escenaFuente;
  if (escenaFuente && !accion.escenaCotejada) throw new ErrorDeUsuario('Coteja la evidencia de la foto y el tratamiento de la escena antes de aprobar.');
  const tomaNueva = ultimo.origen !== 'ORIGINAL' && !escenaFuente && comanda.toma;
  if (comanda.puesta && ultimo.origen !== 'ORIGINAL' && !accion.apetito) throw new ErrorDeUsuario('Comprueba a tamaño móvil el detalle sensorial descrito en la dirección.');
  if (ultimo.composicion && !accion.composicionTipografica) throw new ErrorDeUsuario('Comprueba en la imagen la escala y posición del título respecto al sujeto.');
  if (esFotoEditorial(comanda.editorial?.ruta) && !accion.sinTextoAnadido) throw new ErrorDeUsuario('Coteja la foto y confirma que la candidata respeta el criterio de texto de la escena.');
  if (tomaNueva && !accion.cambioDeToma) throw new ErrorDeUsuario('Compara el punto de vista del producto con la fuente y confirma el cambio visible de perspectiva.');
  const vistaObservada = accion.vistaObservada ?? (comanda.toma?.alternativa ? undefined : comanda.toma?.camara.vista);
  if (tomaNueva && (!vistaObservada || ![tomaNueva.camara.vista, tomaNueva.alternativa?.vista].includes(vistaObservada))) {
    throw new ErrorDeUsuario('Indica cuál de las posiciones dirigidas se aprecia en la imagen o devuelve la toma.');
  }
  if (comanda.muestras && accion.recuentoObservado !== comanda.muestras.recuento) {
    throw new ErrorDeUsuario('El número de piezas que se ven debe coincidir con el recuento confirmado en la fuente.');
  }
  if (!coincideTexto(comanda.textos.map(b => b.texto), accion.transcripcion)) throw new ErrorDeUsuario('La transcripción de los bloques visibles no coincide con el copy confirmado.');
  await imagenFuente(deps, e, comanda);
  ultimo.revision = { ...(escenaFuente ? { escenaCotejada: true } : {}), fecha: deps.ahora(), ...(accion.apetito ? { apetito: true } : {}), ...(accion.composicionTipografica ? { composicionTipografica: true } : {}), ...(comanda.muestras ? { recuentoObservado: accion.recuentoObservado } : {}), ...(tomaNueva ? { cambioDeToma: true, vistaObservada } : {}), ...(accion.sinTextoAnadido ? { sinTextoAnadido: true } : {}), transcripcion: accion.transcripcion, producto: accion.producto, gesto: accion.gesto, legibilidad: accion.legibilidad };
  return registrar(deps, e, 'HECHO', 'Aprobada la versión ' + ultimo.version + ' tras cotejar el producto, el texto, el gesto y la miniatura.');
}
