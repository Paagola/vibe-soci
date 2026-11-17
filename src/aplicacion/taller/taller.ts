import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { escribirJsonAtomico } from '../../adaptadores/ficheros/escribirJsonAtomico.js';
import { leerCartel } from '../../adaptadores/imagen/lecturaCartel.js';
import { reservarEnvio } from '../../adaptadores/openai/GeneradorCartel.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost, PasoPost } from '../../dominio/post.js';
import type { AccionTaller, ComandaDeArte, DireccionDeArte, Gesto, TallerDeArte } from '../../dominio/taller.js';
import { construirMapa } from '../../dominio/diseno/mapaDeFoto.js';
import { guardarFicha } from '../referencias/guardarFicha.js';
import { comprobarReferencia } from '../referencias/comprobarReferencia.js';
import { guardarEncargo, type DepsPost, type ResultadoAvance } from '../post/ordenPost.js';
import { coincideTexto, dirigir, huella } from './direccion.js';
import type { AlProgresar } from '../progreso.js';
import { paqueteZip } from './paquete.js';

type Candidata = TallerDeArte['candidatas'][number];
const carpeta = (deps: DepsPost, e: EncargoPost) => join(deps.proyectos, e.proyecto, 'taller');
const original = (deps: DepsPost, e: EncargoPost) => readFile(resolve(deps.raiz, e.fotoSubida));

async function imagenFuente(deps: DepsPost, e: EncargoPost, comanda: ComandaDeArte) {
  const foto = await original(deps, e);
  if (huella(foto) !== comanda.fotoSha256) throw new ErrorDeUsuario('La foto fuente ha cambiado desde que se preparó la dirección.');
  return sharp(foto).rotate().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}

async function redactar(deps: DepsPost, e: EncargoPost, edicion?: DireccionDeArte, nombrePlato?: string, gestoPropuesto?: Gesto) {
  const [marca, foto, oficio, referencia] = await Promise.all([
    deps.referencias.locales.obtener(e.local), original(deps, e),
    readFile(join(deps.raiz, 'conocimiento/oficios/arte-integrado.md'), 'utf8'),
    e.referencia ? deps.referencias.referencias.obtener(e.local, e.referencia) : undefined,
  ]);
  const rgb = await sharp(foto).rotate().resize(120, 150, { fit: 'cover' }).toColourspace('srgb').removeAlpha().raw().toBuffer();
  const mapa = construirMapa({ ancho: 120, alto: 150, rgb });
  const libre = mapa.libres[0];
  const fotografia = { temperatura: mapa.temperatura, dominantes: mapa.paleta.map(c => c.hex), acento: mapa.vivo,
    luz: mapa.luzMedia, aire: libre ? `Zona de poco detalle de la foto: columnas ${libre.col.join('–')}/12 y filas ${libre.fila.join('–')}/16.` : 'Toma de textura continua.' };
  return dirigir(e, marca, huella(foto), fotografia, oficio, referencia?.ficha, edicion, nombrePlato, gestoPropuesto);
}

async function registrar(deps: DepsPost, e: EncargoPost, paso: PasoPost, nota: string) {
  const nuevo = { ...e, paso, historial: [...e.historial, { fecha: deps.ahora(), paso, nota }] };
  await guardarEncargo(deps, nuevo);
  return nuevo;
}

export async function prepararTaller(deps: DepsPost, e: EncargoPost, sinReferencia = false): Promise<ResultadoAvance> {
  if (e.taller && e.paso === 'REFERENCIA') {
    const estado = await comprobarReferencia(deps.referencias, { local: e.local, referencia: e.referencia });
    if (!estado.paso.puede) return { encargo: e, mensajes: [], parada: estado.paso.motivo };
    if (!e.referencia && !sinReferencia) return { encargo: e, mensajes: [], parada: 'Puedes elegir una referencia o preparar el cartel con la foto del local.' };
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

export async function descargarPaquete(deps: DepsPost, e: EncargoPost): Promise<Buffer> {
  const c = exigirConfirmada(e);
  const foto = await imagenFuente(deps, e, c);
  return paqueteZip([
    { nombre: 'direccion.txt', bytes: Buffer.from(c.prompt) },
    { nombre: 'producto.jpg', bytes: foto },
    { nombre: 'comanda.json', bytes: Buffer.from(JSON.stringify({ proyecto: e.proyecto, fuenteOriginal: e.fotoSubida.split('/').at(-1), ...c }, null, 2)) },
    { nombre: 'instrucciones.txt', bytes: Buffer.from('Adjunta producto.jpg al generador de imágenes que elijas y utiliza direccion.txt como instrucción. Conserva las palabras de comanda.json. Guarda un cartel vertical 4:5 en PNG o JPEG. Impórtalo en este mismo encargo para su revisión. Uso de la fuente: ' + c.uso) },
  ]);
}

export async function bytesDeCandidata(deps: DepsPost, e: EncargoPost, version: number) {
  const candidata = e.taller?.candidatas.find(c => c.version === version);
  if (!candidata) throw new ErrorDeUsuario('No existe esa versión del cartel.');
  const bytes = await readFile(join(carpeta(deps, e), candidata.sha256 + '.png'));
  if (huella(bytes) !== candidata.sha256) throw new ErrorDeUsuario('El archivo ya no coincide con la versión revisada.');
  return { bytes, candidata };
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

async function incorporar(deps: DepsPost, e: EncargoPost, comanda: ComandaDeArte, bytes: Buffer, origen: Candidata['origen'], uso: Candidata['uso']) {
  const taller = e.taller!;
  if (!bytes.length || bytes.length > 32 * 1024 * 1024) throw new ErrorDeUsuario('La candidata no contiene una imagen del tamaño admitido.');
  const imagen = sharp(bytes, { failOn: 'warning', limitInputPixels: 36_000_000 });
  const meta = await imagen.metadata().catch(() => { throw new ErrorDeUsuario('La candidata debe poder abrirse como PNG, JPEG o WebP.'); });
  const { width, height } = meta.autoOrient;
  if (width < 360 || height < 450) throw new ErrorDeUsuario('El cartel debe alcanzar al menos 360 × 450 píxeles para revisarlo a tamaño móvil.');
  if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages ?? 1) !== 1 || Math.abs(width - 0.8 * height) > 2) {
    throw new ErrorDeUsuario('Importa una imagen fija vertical en proporción 4:5. El taller conserva el encuadre completo.');
  }
  const png = await imagen.rotate().flatten({ background: '#fff' }).resize(1080, 1350, { fit: 'fill' }).png().toBuffer();
  const sha256 = huella(png);
  if (taller.candidatas.some(c => c.sha256 === sha256)) throw new ErrorDeUsuario('Esta misma imagen ya se revisó. Importa la versión corregida.');
  await mkdir(carpeta(deps, e), { recursive: true });
  const ruta = join(carpeta(deps, e), sha256 + '.png');
  await writeFile(ruta, png);
  const [ocr, uniforme] = await Promise.all([leerCartel(ruta, comanda.textos.map(b => b.texto)), superficieUniforme(png)]);
  const lectura = { ...ocr, superficieUniforme: uniforme };
  taller.candidatas.push({ version: taller.candidatas.length + 1, sha256, comanda: comanda.huella,
    origen, uso: e.usoFotoReal === 'PUBLICABLE' ? uso : 'SOLO_PRUEBA_COMPOSICION', fecha: deps.ahora(), lectura });
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
  if (accion.accion === 'EDITAR' || accion.accion === 'PROPONER_GESTO' || accion.accion === 'CONFIRMAR_DIRECCION') {
    if (e.paso !== 'CONFIRMAR_ELEMENTOS') throw new ErrorDeUsuario('Esta dirección ya no se encuentra en revisión.');
    if (accion.accion === 'PROPONER_GESTO') {
      taller.comanda = await redactar(deps, e, undefined, comanda.nombrePlato, accion.gesto);
      return registrar(deps, e, e.paso, 'Nueva propuesta de escena y tipografía.');
    }
    if (accion.accion === 'EDITAR') {
      taller.comanda = await redactar(deps, e, accion.direccion, accion.nombrePlato);
      return registrar(deps, e, e.paso, 'Dirección de arte editada.');
    }
    await imagenFuente(deps, e, comanda);
    await mkdir(join(carpeta(deps, e), 'comandas'), { recursive: true });
    await escribirJsonAtomico(join(carpeta(deps, e), 'comandas', comanda.huella + '.json'), comanda);
    taller.confirmada = { fecha: deps.ahora(), huella: comanda.huella };
    return registrar(deps, e, 'GENERAR', 'Dirección, sujeto y texto confirmados. Paquete de producción disponible.');
  }
  exigirConfirmada(e);
  if (accion.accion === 'REABRIR_DIRECCION') {
    if (e.paso !== 'GENERAR') throw new ErrorDeUsuario('Ya hay una candidata en revisión.');
    delete taller.confirmada;
    return registrar(deps, e, 'CONFIRMAR_ELEMENTOS', 'Dirección reabierta para edición.');
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
    const numero = await reservarEnvio(api.reservas, api.limite, comanda.huella, e.proyecto, deps.ahora());
    taller.envios.push({ fecha: deps.ahora(), huella: comanda.huella, numero });
    const reservado = await registrar(deps, e, 'GENERAR', 'Autorizado un único envío de la foto y el prompt a Images API.');
    progreso?.({ paso: 'GENERAR', mensaje: 'Generando el cartel completo con gpt-image-2…', hechas: 0, total: 1, pasosRestantes: { director: 0, tandas: 1 } });
    const imagen = await api.generador.generar(comanda.prompt, foto);
    progreso?.({ paso: 'COMPROBAR', mensaje: 'Comprobando formato y leyendo las palabras de la imagen…', hechas: 1, total: 1, pasosRestantes: { director: 0, tandas: 0 } });
    return incorporar(deps, reservado, comanda, imagen, 'IMAGES_API', comanda.uso);
  }
  if (e.paso !== 'CONFIRMAR_FOTO' || !ultimo || ultimo.version !== accion.version || ultimo.comanda !== comanda.huella) {
    throw new ErrorDeUsuario('La decisión debe corresponder a la candidata vigente.');
  }
  const { bytes } = await bytesDeCandidata(deps, e, ultimo.version);
  if (accion.accion === 'DEVOLVER') {
    ultimo.devolucion = accion.motivo;
    delete taller.confirmada;
    taller.comanda = await redactar(deps, e, comanda.direccion);
    return registrar(deps, e, 'CONFIRMAR_ELEMENTOS', 'Candidata devuelta. Revisa la corrección antes de otra producción.');
  }
  if (ultimo.lectura.superficieUniforme ?? await superficieUniforme(bytes)) throw new ErrorDeUsuario('La imagen aparece uniforme a 360 px. Devuelve esta versión e importa una imagen donde se lean el producto y el texto.');
  if (!coincideTexto(comanda.textos.map(b => b.texto), accion.transcripcion)) throw new ErrorDeUsuario('La transcripción de los bloques visibles no coincide con el copy confirmado.');
  await imagenFuente(deps, e, comanda);
  ultimo.revision = { fecha: deps.ahora(), transcripcion: accion.transcripcion, producto: accion.producto, gesto: accion.gesto, legibilidad: accion.legibilidad };
  return registrar(deps, e, 'HECHO', 'Aprobada la versión ' + ultimo.version + ' tras cotejar el producto, el texto, el gesto y la miniatura.');
}
