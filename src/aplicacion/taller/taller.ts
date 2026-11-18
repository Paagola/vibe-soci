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
import { componerTitulo } from './componerTitulo.js';
import { maquetaDeTitulo } from './puesta.js';
import { paqueteZip } from './paquete.js';

type Candidata = TallerDeArte['candidatas'][number];
const carpeta = (deps: DepsPost, e: EncargoPost) => join(deps.proyectos, e.proyecto, 'taller');
const original = (deps: DepsPost, e: EncargoPost) => readFile(resolve(deps.raiz, e.fotoSubida));

async function fuenteVerificada(deps: DepsPost, e: EncargoPost, comanda: ComandaDeArte) {
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
  const construir = (muestras?: ComandaDeArte['muestras']) => dirigir(e, marca, fotoSha256, fotografia, oficio, referencia?.ficha, edicion.direccion, edicion.nombrePlato, edicion.gesto, edicion.toma, muestras, edicion.ruta);
  const base = construir();
  const previa = e.taller?.comanda;
  const permiteMuestras = base.editorial?.ruta !== 'FOTO_ESPACIO' && base.toma?.camara.vista === 'CENITAL' && !base.toma.alternativa;
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
  const palabras = c.tipografiaLocal ? 'La imagen del generador es una fotografía base sin texto añadido. Importa esa foto en el taller: la maqueta local imprime exactamente el título confirmado.' : esFotoEditorial(c.editorial?.ruta) ? 'Entrega una fotografía sin texto añadido. Conserva los rótulos documentados en la fuente.' : 'Conserva las palabras de comanda.json.';
  return paqueteZip([
    { nombre: 'direccion.txt', bytes: Buffer.from(c.prompt) },
    { nombre: 'producto.jpg', bytes: foto },
    ...(muestras ? [{ nombre: 'muestras.jpg', bytes: muestras }] : []),
    { nombre: 'comanda.json', bytes: Buffer.from(JSON.stringify({ proyecto: e.proyecto, fuenteOriginal: e.fotoSubida.split('/').at(-1), ...c }, null, 2)) },
    { nombre: 'instrucciones.txt', bytes: Buffer.from(entrada + ' Utiliza direccion.txt como instrucción. ' + palabras + ' Guarda una pieza vertical 4:5 en PNG o JPEG. Impórtalo en este mismo encargo para su revisión. Uso de la fuente: ' + c.uso) },
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

async function incorporar(deps: DepsPost, e: EncargoPost, comanda: ComandaDeArte, bytes: Buffer, origen: Candidata['origen'], uso: Candidata['uso'], encuadreOriginal?: number, recomponer?: { receta: NonNullable<ComandaDeArte['tipografiaLocal']>; version: number }) {
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
  const impresa = receta && titulo ? await componerTitulo(base, huella(base), titulo, receta) : undefined;
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
    taller.comanda = await redactar(deps, e, { direccion: comanda.direccion, toma: seleccion });
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
  if (accion.accion === 'REABRIR_DIRECCION') {
    if (e.paso !== 'GENERAR') throw new ErrorDeUsuario('Ya hay una candidata en revisión.');
    delete taller.confirmada;
    return registrar(deps, e, 'CONFIRMAR_ELEMENTOS', 'Dirección reabierta para edición.');
  }
  if (accion.accion === 'USAR_ORIGINAL') {
    if (e.paso !== 'GENERAR' || !(esFotoEditorial(comanda.editorial?.ruta) || comanda.tipografiaLocal) || comanda.muestras) throw new ErrorDeUsuario('La foto original sólo se puede encuadrar en una dirección fotográfica con fuente completa.');
    const bytes = await fuenteVerificada(deps, e, comanda);
    const { width, height } = (await sharp(bytes).metadata()).autoOrient;
    const unidad = Math.floor(Math.min(width / 4, height / 5));
    if (unidad < 90) throw new ErrorDeUsuario('El encuadre real debe alcanzar 360 × 450 px.');
    const ancho = 4 * unidad, alto = 5 * unidad;
    const recorte = { left: Math.round((width - ancho) * accion.posicion), top: Math.round((height - alto) * accion.posicion), width: ancho, height: alto };
    const png = await sharp(bytes).rotate().extract(recorte).resize(1080, 1350).png().toBuffer();
    return incorporar(deps, e, comanda, png, 'ORIGINAL', e.usoFotoReal, accion.posicion);
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
    const base = await readFile(join(carpeta(deps, e), 'bases', ultimo.composicion.baseSha256 + '.png'));
    if (huella(base) !== ultimo.composicion.baseSha256) throw new ErrorDeUsuario('La fotografía ha cambiado desde que se ajustó la primera maqueta.');
    const receta = maquetaDeTitulo(e.plato, comanda.nombrePlato ?? e.plato, { opcion: 'AUTO', estiloTitulo: accion.estiloTitulo, posicionTitulo: accion.posicionTitulo });
    return incorporar(deps, e, comanda, base, ultimo.origen, ultimo.uso, ultimo.encuadreOriginal, { receta, version: ultimo.version });
  }
  if (accion.accion === 'DEVOLVER') {
    ultimo.devolucion = accion.motivo;
    delete taller.confirmada;
    const seleccion = accion.ajusteToma ? { ...comanda.toma?.seleccion, ...accion.ajusteToma } : comanda.toma?.seleccion;
    taller.comanda = await redactar(deps, e, { direccion: comanda.direccion, toma: seleccion });
    return registrar(deps, e, 'CONFIRMAR_ELEMENTOS', 'Candidata devuelta. Revisa la corrección antes de otra producción.');
  }
  if (ultimo.lectura.superficieUniforme ?? await superficieUniforme(bytes)) throw new ErrorDeUsuario('La imagen aparece uniforme a 360 px. Devuelve esta versión e importa una imagen donde se lean el producto y el texto.');
  const tomaNueva = ultimo.origen !== 'ORIGINAL' && comanda.toma;
  if (comanda.puesta && ultimo.origen !== 'ORIGINAL' && !accion.apetito) throw new ErrorDeUsuario('Comprueba a tamaño móvil el detalle sensorial descrito en la dirección.');
  if (ultimo.composicion && !accion.composicionTipografica) throw new ErrorDeUsuario('Comprueba en la imagen la escala y posición del título respecto al sujeto.');
  if (esFotoEditorial(comanda.editorial?.ruta) && !accion.sinTextoAnadido) throw new ErrorDeUsuario('Coteja la foto y confirma que sólo conserva las letras presentes en la fuente.');
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
  ultimo.revision = { fecha: deps.ahora(), ...(accion.apetito ? { apetito: true } : {}), ...(accion.composicionTipografica ? { composicionTipografica: true } : {}), ...(comanda.muestras ? { recuentoObservado: accion.recuentoObservado } : {}), ...(tomaNueva ? { cambioDeToma: true, vistaObservada } : {}), ...(accion.sinTextoAnadido ? { sinTextoAnadido: true } : {}), transcripcion: accion.transcripcion, producto: accion.producto, gesto: accion.gesto, legibilidad: accion.legibilidad };
  return registrar(deps, e, 'HECHO', 'Aprobada la versión ' + ultimo.version + ' tras cotejar el producto, el texto, el gesto y la miniatura.');
}
