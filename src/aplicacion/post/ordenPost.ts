/**
 * ORDEN ÚNICA de punta a punta (09/11/2026): de la foto subida al post exportado, con paradas para confirmar.
 *
 *   REFERENCIA       exige la referencia mientras el local tenga menos de 5 piezas (comprobarReferencia)
 *   FOTO_REAL        registra la foto subida como activo REAL
 *   PROPUESTA        el director rellena la plantilla de foto nueva; el código comprueba «otra toma» y lo demás
 *   CONFIRMAR_ELEMENTOS  ■ parada: confirmas los elementos, el prompt y el gasto (como mucho 2 intentos)
 *   GENERAR          la foto nueva (Gemini de pago, con el tope del código), o la que importes a mano
 *   COMPROBAR        comprobación de salida automática; sus avisos acompañan a la candidata
 *   CONFIRMAR_FOTO   ■ parada: eliges una foto o autorizas otra candidata dentro del presupuesto
 *   MASCARA          la máscara del sujeto
 *   INTENCION        la intención de diseño: la escribe el director de diseño (F3) desde la ficha de la referencia y el
 *                    mapa de la foto, y pasa a post.json solo si cumple todo lo comprobable; si no hay director o no
 *                    pasa, deja un borrador y se para (la escribe una persona)
 *   COMPONER         compositor, exportación 3:4 y 4:5, hojas de revisión
 *   HECHO            el plan se marca como pieza (cuenta para el umbral de 5)
 *
 * Cada llamada a `avanzar` sigue hasta la siguiente parada o bloqueo y guarda el estado en <proyecto>/post.json.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { escribirJsonAtomico } from '../../adaptadores/ficheros/escribirJsonAtomico.js';
import type { CriticoEditorial } from '../productor/criticaEditorial.js';
import { revisarEntrega } from '../productor/revisarEntrega.js';
import { direccionParaLaFoto } from '../productor/editorial.js';
import { materializarEditorial } from '../productor/componerEditorial.js';
import { Activo } from '../../dominio/activos.js';
import { Intencion, Tokens } from '../../dominio/diseno/intencion.js';
import type { HechosDeLaPieza } from '../../dominio/diseno/propuesta.js';
import { AIRE_MINIMO, type AireMedido } from '../../dominio/comprobacionSalida.js';
import { aireEn } from '../../dominio/diseno/mapaDeFoto.js';
import { choqueConFamilia, ESTETICAS, esteticaDeFamilia, type Estetica } from '../../dominio/diseno/estetica.js';
import { ErrorDeServicio, ErrorDeUsuario } from '../../dominio/errores.js';
import type { Marca } from '../../dominio/modelos.js';
import { proponerDiseno, type DepsProponerDiseno, type EntradaDiseno, type PruebaDeIntencion, type ResultadoDiseno } from '../diseno/proponerDiseno.js';
import { montarPromptFotoNueva, PropuestaFotoNueva, recuentosQueMirar, type OpcionesDePrompt } from '../../dominio/fotoNueva.js';
import { huecosDeTomaEfectivos, huecosEfectivos, opcionesDeRevision, revisarPropuesta, textoDeMarca } from '../../dominio/promptFiel.js';
import { explicarBloqueo } from '../../dominio/explicaciones.js';
import { contradiccionesConLaNota } from '../../dominio/nota.js';
import { EncargoPost, MAX_INTENTOS_SEGUIDOS, PARADAS, puedeReintentarFoto, recuperarRevisionFotografica, type IntentoFoto, type PasoPost, type TomaDelEncargo } from '../../dominio/post.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { ComponedorDePiezas } from '../../puertos/ComponedorDePiezas.js';
import type { DirectorDeFoto, GeneradorFoto, PeticionFoto, Segmentador } from '../../puertos/Foto.js';
import type { RevisorVisual } from '../../puertos/RevisorVisual.js';
import { comprobarFotoNueva } from '../fotos/comprobarFotoNueva.js';
import { proponerFotoNueva } from '../fotos/proponerFotoNueva.js';
import { comprobarReferencia } from '../referencias/comprobarReferencia.js';
import { analizarReferencia } from '../referencias/analizarReferencia.js';
import type { AnalistaDeReferencias } from '../../puertos/AnalistaDeReferencias.js';
import type { HistorialDeDisenos } from '../../puertos/HistorialDeDisenos.js';
import { efectosDeLaReferencia, huellaDelLocal, textoDeHuella } from '../../dominio/diseno/huella.js';
import type { DepsReferencias } from '../referencias/dependencias.js';
import type { GanchosDeOrden, Via } from './ganchos.js';
import { prepararRecuperacion } from './recuperarGeneracion.js';

import { prepararTaller } from '../taller/taller.js';
import type { GeneradorCartel } from '../../adaptadores/openai/GeneradorCartel.js';

import type { DirectorCarrusel, DirectorPortada, DirectorSecuencia, PostReciente, RevisorDeCarrusel } from '../../dominio/secuenciaTaller.js';
import { luzSolicitada } from '../../dominio/luzFotografica.js';

export interface DepsPost {
  directorSecuencia?: DirectorSecuencia;
  directorCarrusel?: DirectorCarrusel;
  revisorDeCarrusel?: RevisorDeCarrusel;
  directorPortada?: DirectorPortada;
  postsRecientes?: (encargo: EncargoPost) => Promise<PostReciente[]>;
  tallerApi?: { generador: GeneradorCartel; limite: number; reservas: string };
  /** Raíz del repositorio (para marcas/ y rutas relativas). */
  raiz: string;
  /** Carpeta de los proyectos (proyectos/ o, en simulado, datos-simulado/proyectos/). */
  proyectos: string;
  activos: AlmacenActivos;
  referencias: DepsReferencias;
  director: DirectorDeFoto;
  generador: GeneradorFoto;
  revisor: RevisorVisual;
  segmentador: Segmentador;
  componedor: ComponedorDePiezas;
  /**
   * F3: el director de diseño y el medidor de la foto. Sin ellos, INTENCION deja un borrador y se para (la escribe una
   * persona). La prueba en el compositor la pone la orden, con el mismo componedor.
   */
  disenador?: Omit<DepsProponerDiseno, 'probar'>;
  /** F3.3 (punto 14): las piezas anteriores del local, para su huella tipográfica. */
  historial?: HistorialDeDisenos;
  /** Puntos 3 y 4: escribe la ficha de una referencia nueva (y mira si es un post de verdad). Sin él, se pide a mano. */
  analista?: AnalistaDeReferencias;
  /** El productor (orquestador): observa cada paso, anota y puede parar la orden. Sin él, la orden es la de siempre. */
  productor?: GanchosDeOrden;
  criticoEditorial?: CriticoEditorial;
  ahora: () => string;
}

export interface Accion {
  revision?: string;
  confirmo?: boolean;
  rechazo?: string;
  foto?: 'original' | number;
  /** Conserva la decisión humana y espera si es false. */
  reintentar?: boolean;
  volverAlInventario?: boolean;
  /** De dónde viene la confirmación (la web o una terminal interactiva). */
  via?: Via;
  /** Ruta de una foto hecha a mano para el paso GENERAR (sin facturación, o por el MCP). */
  importar?: string;
  /** F3.3, al confirmar la foto: la portada del carrusel sale de esta toma (un producto aislado); la foto confirmada queda para los recortes y el cierre. */
  portadaToma?: number;
  /** F3.3, al confirmar la foto: tomas de detalle que no valen (su diapositiva no sale, o sale de un recorte). */
  sinToma?: number[];
}

export interface ResultadoAvance {
  encargo: EncargoPost;
  /** Lo que ha pasado, en orden. */
  mensajes: string[];
  /** Por qué se ha parado (parada, bloqueo o fin). */
  parada: string;
}

const ASPECTO = '3:4';
const TAMANO = '2K';
const ETIQUETA_REAL = '@image1 (real photograph of the dish)';
const ETIQUETA_ESTILO = '@image2 (published reference post: style reference only)';
const ARCHIVO_REFERENCIA_DE_ESTILO = 'foto/referencia-estilo.jpg';
const LADO_REFERENCIA_DE_ESTILO = 768;
export const rutaEncargo = (deps: DepsPost, proyecto: string) => join(deps.proyectos, proyecto, 'post.json');
const existe = (ruta: string) => stat(ruta).then(() => true, () => false);

export async function leerEncargo(deps: Pick<DepsPost, 'proyectos'>, proyecto: string): Promise<EncargoPost> {
  const ruta = join(deps.proyectos, proyecto, 'post.json');
  if (!(await existe(ruta))) throw new ErrorDeUsuario(`No existe el encargo «${proyecto}». Créalo con: npm run post -- nuevo ${proyecto} --local … --foto … --plato "…" --referencia …`);
  return recuperarRevisionFotografica(EncargoPost.parse(JSON.parse(await readFile(ruta, 'utf8'))));
}

export async function guardarEncargo(deps: DepsPost, e: EncargoPost): Promise<void> {
  await mkdir(join(deps.proyectos, e.proyecto), { recursive: true });
  await escribirJsonAtomico(rutaEncargo(deps, e.proyecto), EncargoPost.parse(e));
}

export async function crearEncargo(
  deps: DepsPost,
  datos: {
    proyecto: string;
    arte?: 'EDITORIAL' | 'INTEGRADO' | 'CAPAS';
    elegirReferenciaAlAbrir?: true;
    productorEditorial?: boolean;
    local: string;
    plato: string;
    foto: string;
    referencia?: string;
    usoFotoReal?: 'PUBLICABLE' | 'SOLO_PRUEBA_COMPOSICION';
    simulado?: boolean;
    titularCreativo?: boolean;
    estiloDeReferencia?: boolean;
    estetica?: Estetica;
    formato?: 'post' | 'carrusel';
    /** F3.3: fotos reales de más para los detalles del carrusel («qué elemento enseña» cada una). */
    fotosExtra?: Array<{ ruta: string; elemento: string }>;
  },
): Promise<EncargoPost> {
  if (await existe(rutaEncargo(deps, datos.proyecto))) throw new ErrorDeUsuario(`El encargo «${datos.proyecto}» ya existe: continúa con npm run post -- ${datos.proyecto}`);
  if (!(await existe(resolve(deps.raiz, datos.foto)))) throw new ErrorDeUsuario(`No encuentro la foto «${datos.foto}».`);
  for (const x of datos.fotosExtra ?? []) if (!(await existe(resolve(deps.raiz, x.ruta)))) throw new ErrorDeUsuario(`No encuentro la foto de más «${x.ruta}».`);
  if (datos.fotosExtra?.length && datos.formato !== 'carrusel') throw new ErrorDeUsuario('Las fotos de más son para los detalles de un carrusel: añade --formato carrusel.');
  await deps.referencias.locales.obtener(datos.local); // el local tiene que existir y ser válido
  const ahora = deps.ahora();
  const encargo = EncargoPost.parse({
    esquema: 'post/encargo@1',
    ...(datos.arte === 'EDITORIAL' ? { taller: { seleccionEditorial: true, ...(datos.elegirReferenciaAlAbrir ? { elegirReferenciaAlAbrir: true } : {}) } } : datos.arte === 'INTEGRADO' ? { taller: {} } : datos.productorEditorial ? { productorEditorial: true } : {}),
    proyecto: datos.proyecto,
    local: datos.local,
    plato: datos.plato,
    fotoSubida: datos.foto,
    usoFotoReal: datos.usoFotoReal ?? 'PUBLICABLE',
    ...(datos.referencia ? { referencia: datos.referencia } : {}),
    simulado: datos.simulado ?? false,
    titularCreativo: datos.titularCreativo ?? false,
    estiloDeReferencia: datos.estiloDeReferencia ?? false,
    ...(datos.estetica ? { estetica: datos.estetica } : {}),
    formato: datos.formato ?? 'post',
    fotosExtra: datos.fotosExtra ?? [],
    creadoEn: ahora,
    historial: [{ fecha: ahora, paso: 'REFERENCIA', nota: 'encargo creado' }],
  });
  await guardarEncargo(deps, encargo);
  return encargo;
}

export interface OpcionesAvance {
  /** Se llama justo antes de ejecutar cada paso: para que la capa de entrada (la web) enseñe por dónde va. */
  alEmpezarPaso?: (paso: PasoPost, encargo: EncargoPost) => void;
}

/** Avanza el encargo hasta la siguiente parada o bloqueo. */
export async function avanzar(deps: DepsPost, proyecto: string, accion: Accion = {}, opciones: OpcionesAvance = {}): Promise<ResultadoAvance> {
  let e = await leerEncargo(deps, proyecto);
  if (e.taller) {
    if (Object.keys(accion).some(k => k !== 'via' && k !== 'revision')) throw new ErrorDeUsuario('Esta decisión corresponde al taller de arte integrado.');
    if (e.taller.seleccionEditorial && deps.directorPortada && e.paso === 'REFERENCIA') opciones.alEmpezarPaso?.('PROPUESTA', e);
    return prepararTaller(deps, e);
  }
  const mensajes: string[] = [];
  const nota = (texto: string) => {
    mensajes.push(texto);
    e.historial.push({ fecha: deps.ahora(), paso: e.paso, nota: texto });
  };
  let usada = false; // la acción (--confirmo, --rechazo, --importar) vale para un solo paso

  for (let vueltas = 0; vueltas < 30; vueltas++) {
    if (e.bloqueo && !(accion.confirmo && e.paso === 'CONFIRMAR_ELEMENTOS' && !usada)) {
      await guardarEncargo(deps, e);
      const explicacion = explicarBloqueo(e);
      const motivo = explicacion ? [explicacion.queHaPasado, ...explicacion.quePuedesHacer].join('\n') : e.bloqueo;
      return { encargo: e, mensajes, parada: `BLOQUEADO en ${e.paso}: ${motivo}` };
    }
    const paso: PasoPost = e.paso;
    if (paso === 'HECHO') {
      await guardarEncargo(deps, e);
      return { encargo: e, mensajes, parada: 'HECHO' };
    }
    const accionAhora = usada ? {} : accion;
    opciones.alEmpezarPaso?.(paso, e);
    if (deps.productor) {
      const antes = await deps.productor.antesDePaso(paso, e, accionAhora);
      for (const n of antes.notas ?? []) nota(n);
      if (antes.parar) {
        await guardarEncargo(deps, e);
        return { encargo: e, mensajes, parada: antes.parar };
      }
    }
    const anterior = e;
    const r = await PASOS[paso](deps, e, accionAhora, nota);
    if (r.usaAccion) usada = true;
    e = r.encargo;
    let parar = r.parar;
    if (deps.productor) {
      const tras = await deps.productor.trasPaso(paso, anterior, e, accionAhora, r.parar);
      for (const n of tras.notas ?? []) nota(n);
      if (parar && tras.textoParada) parar = `${parar}\n${tras.textoParada}`;
      if (!parar && tras.parar) parar = tras.parar;
    }
    await guardarEncargo(deps, e);
    if (parar) return { encargo: e, mensajes, parada: parar };
  }
  throw new Error('La orden no avanza (más de 30 pasos seguidos).');
}

type Nota = (texto: string) => void;
type ResultadoPaso = { encargo: EncargoPost; parar?: string; usaAccion?: boolean };
type Paso = (deps: DepsPost, e: EncargoPost, accion: Accion, nota: Nota) => Promise<ResultadoPaso>;

const ir = (e: EncargoPost, paso: PasoPost, cambios: Partial<EncargoPost> = {}): EncargoPost => ({ ...e, ...cambios, paso });

const PASOS: Record<Exclude<PasoPost, 'HECHO'>, Paso> = {
  async REFERENCIA(deps, e, _a, nota) {
    let estado = await comprobarReferencia(deps.referencias, { local: e.local, ...(e.referencia ? { referencia: e.referencia } : {}) });
    // Una referencia sin ficha la analiza el analista (Gemini visión) en vez de pararse a esperar una ficha a mano.
    if (!estado.paso.puede && estado.paso.falta === 'FICHA' && e.referencia && deps.analista) {
      const r = await analizarReferencia({ ...deps.referencias, analista: deps.analista }, { local: e.local, id: e.referencia });
      const a = r.analisis!;
      nota(
        a.decision === 'RECHAZA'
          ? `Referencia ${r.id} rechazada: no es un post publicado (${a.aptitud.tipo}: ${a.aptitud.problemas.join('; ')}).`
          : `Ficha automática de ${r.id} (${a.analista}): ${r.ficha?.familia} · ${r.ficha?.titulo}.${a.decision === 'AVISA' ? ` AVISO: ${a.aptitud.tipo} (${a.aptitud.problemas.join('; ')}).` : ''}`,
      );
      estado = await comprobarReferencia(deps.referencias, { local: e.local, referencia: e.referencia });
    }
    if (!estado.paso.puede) {
      const familias = estado.propuestas.map((f) => `${f.id} ${f.nombre} (${f.posts.join(', ')})`).join(' · ');
      // No se guarda como bloqueo: se vuelve a comprobar cada vez, así que basta con registrar la referencia y relanzar.
      return {
        encargo: e,
        parar: `FALTA LA REFERENCIA: ${estado.paso.motivo}${familias ? ` Familias propuestas: ${familias}.` : ''} Regístrala (npm run referencia -- registrar …), ponla en "referencia" de post.json y vuelve a lanzar la orden.`,
      };
    }
    nota(`Referencia: ${estado.paso.motivo} (${estado.piezasReales} piezas del local; obligatoria hasta ${estado.umbral}).`);
    // Punto 10: la estética del post. Si no se eligió, sale de la familia de la referencia; si se eligió, se avisa si choca.
    const familia = e.referencia ? (await deps.referencias.referencias.obtener(e.local, e.referencia)).ficha?.familia : undefined;
    const estetica = e.estetica ?? esteticaDeFamilia(familia);
    const choque = choqueConFamilia(estetica, familia);
    nota(e.estetica ? `Estética elegida: ${ESTETICAS[estetica].nombre}.${choque ? ` AVISO: ${choque}` : ''}` : `Estética deducida de la referencia${familia ? ` (${familia})` : ''}: ${ESTETICAS[estetica].nombre}.`);
    // F3.3 (punto 12): si la ficha (a mano) no dice el tratamiento de la referencia (ilustrado, tinta, pegatina…), lo
    // mira el analista una vez; queda en el encargo, sin tocar la ficha.
    let tratamiento = e.tratamiento;
    if (e.referencia && !tratamiento && deps.analista) {
      const r = await deps.referencias.referencias.obtener(e.local, e.referencia);
      if (r.ficha && !r.ficha.tratamiento && r.origen.archivo) {
        try {
          const { ficha } = await deps.analista.analizar(deps.referencias.referencias.rutaArchivo(e.local, r.id, r.origen.archivo));
          tratamiento = ficha.tratamiento ?? [];
          nota(`Tratamiento de ${r.id} (lo mira ${deps.analista.nombre}; la ficha a mano no se toca): ${tratamiento.join(', ') || 'ninguno'}.`);
        } catch (error) {
          nota(`AVISO: no se ha podido mirar el tratamiento de ${r.id} (${(error as Error).message}); el diseño sigue sin él.`);
        }
      }
    }
    return { encargo: ir(e, 'FOTO_REAL', { estetica, ...(tratamiento ? { tratamiento } : {}) }) };
  },

  async FOTO_REAL(deps, e, _a, nota) {
    const id = `${e.proyecto}-real`;
    await registrarFotoReal(deps, e, id, e.fotoSubida, `Foto subida para el encargo ${e.proyecto}: ${e.plato}`, nota);
    const fotosExtra = [];
    for (const [i, x] of e.fotosExtra.entries()) {
      const idExtra = `${e.proyecto}-real-${i + 2}`;
      await registrarFotoReal(deps, e, idExtra, x.ruta, `Foto de más del encargo ${e.proyecto} (la sube el dueño): ${x.elemento}`, nota);
      fotosExtra.push({ ...x, activo: idExtra });
    }
    return { encargo: ir(e, 'PROPUESTA', { activoReal: id, fotosExtra }) };
  },

  async PROPUESTA(deps, e, _a, nota) {
    const real = await deps.activos.obtener(e.local, e.activoReal as string);
    let referencia: { id: string; resumen: string; imagen?: string } | undefined;
    let familia: string | undefined;
    if (e.referencia) {
      const r = await deps.referencias.referencias.obtener(e.local, e.referencia);
      const f = r.ficha;
      const imagen = r.origen.archivo; // la imagen o captura guardada (en un enlace bloqueado, no hay)
      referencia = {
        id: r.id,
        resumen: f ? [f.titulo, f.familia, `capas: ${f.capas.join(' / ')}`, `retícula: ${f.reticula}`].join(' · ') : 'sin ficha',
        ...(imagen ? { imagen: deps.referencias.referencias.rutaArchivo(e.local, r.id, imagen) } : {}),
      };
      familia = f?.familia;
    }
    // Punto 9: con «estiloDeReferencia», el generador verá la referencia como @image2, reducida a 768 px.
    const estilo = Boolean(e.estiloDeReferencia && referencia?.imagen);
    if (estilo) {
      await mkdir(join(deps.proyectos, e.proyecto, 'foto'), { recursive: true });
      await sharp(referencia!.imagen!).rotate().resize(LADO_REFERENCIA_DE_ESTILO, LADO_REFERENCIA_DE_ESTILO, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(join(deps.proyectos, e.proyecto, ARCHIVO_REFERENCIA_DE_ESTILO));
    }
    const alGenerador = { ...(estilo ? { estiloDeReferencia: true } : {}), ...(familia ? { familia } : {}), ...(e.estetica ? { estetica: e.estetica } : {}), ...(deps.productor ? { desdeElInventario: true } : {}) };
    const hechos = deps.productor ? { marca: textoDeMarca(await deps.referencias.locales.obtener(e.local)) } : {};
    const recientes = await deps.postsRecientes?.(e);
    const modoDeLuz = luzSolicitada(e.plato) ?? (e.estetica === 'EDITORIAL_OSCURO' ? 'ESTUDIO' : 'NATURAL');
    const resultado = await proponerFotoNueva(deps.director, {
      foto: real.ruta, plato: e.plato, ...(referencia ? { referencia } : {}), alGenerador: { ...alGenerador, modoDeLuz },
      formato: e.formato, recientes,
    }, hechos);
    const archivo = 'foto/propuesta.json';
    await mkdir(join(deps.proyectos, e.proyecto, 'foto'), { recursive: true });
    await writeFile(join(deps.proyectos, e.proyecto, archivo), `${JSON.stringify({ director: deps.director.nombre, fecha: deps.ahora(), ...resultado }, null, 2)}\n`);
    nota(`Propuesta del director (${resultado.intentos.length} intento(s))${resultado.problemas.length ? `, con problemas: ${resultado.problemas.join(' | ')}` : ''}.`);
    return { encargo: ir(e, 'CONFIRMAR_ELEMENTOS', { propuesta: { archivo, prompt: resultado.prompt, problemas: resultado.problemas } }) };
  },

  async CONFIRMAR_ELEMENTOS(deps, e, accion, nota) {
    // La propuesta se puede corregir a mano (huecos y descripción) antes de confirmar: se vuelve a leer y a comprobar.
    const ruta = join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? 'foto/propuesta.json');
    const guardada = JSON.parse(await readFile(ruta, 'utf8')) as { propuesta: unknown; opcionesPrompt?: OpcionesDePrompt };
    const propuesta = PropuestaFotoNueva.parse(guardada.propuesta);
    const real = await deps.activos.obtener(e.local, e.activoReal as string);
    const opcionesPrompt = opcionesDeRevision(guardada.opcionesPrompt, Boolean(deps.productor));
    const hechos = opcionesPrompt?.desdeElInventario ? { marca: textoDeMarca(await deps.referencias.locales.obtener(e.local)) } : {};
    const revision = revisarPropuesta(propuesta, opcionesPrompt, { lado: { ancho: real.activo.ancho, alto: real.activo.alto }, nota: e.plato, ...hechos });
    const problemas = revision.problemas;
    const prompt = revision.prompt + (e.productorEditorial ? direccionParaLaFoto(await deps.productor?.leerBrief?.(e.proyecto)) : '');
    // F3.3 (punto 11): en un carrusel, cada diapositiva de detalle con su propia foto: la foto de más que haya subido el
    // dueño para ese elemento (no se genera) o, si no, una toma nueva sacada de la misma foto real.
    // F3.3: un elemento que la nota del dueño llama con otra preparación no se confirma (gunkan / rollito de papel de arroz).
    problemas.push(...contradiccionesConLaNota(e.plato, propuesta.descripcion.elementos));
    const nombres = propuesta.descripcion.elementos.map((x) => x.nombre);
    const extras = e.fotosExtra.map((x) => ({ ...x, nombre: elementoParecido(x.elemento, nombres) }));
    for (const x of extras) if (!x.nombre) problemas.push(`La foto de más «${x.ruta}» dice que enseña «${x.elemento}», pero no es ninguno de los elementos descritos (${nombres.join(', ')}): corrige el elemento o la descripción.`);
    const tomas: TomaDelEncargo[] =
      e.formato !== 'carrusel'
        ? []
        : [
            ...extras.filter((x) => x.nombre && x.activo).map((x) => ({ elemento: x.nombre!, prompt: '', real: true, elegida: x.activo })),
            ...(e.productorEditorial ? [] : propuesta.tomas ?? []).filter((t) => !extras.some((x) => x.nombre === t.elemento)).map((t) => ({ elemento: t.elemento, prompt: montarPromptFotoNueva(huecosDeTomaEfectivos(propuesta, t, opcionesPrompt), { ...opcionesPrompt, deDetalle: true }) })),
          ]
            .slice(0, 3)
            .map((t, i) => ({ n: i + 1, ...t }));
    const generadas = tomas.filter((t) => !t.real);
    const encargo = { ...e, propuesta: { archivo: e.propuesta?.archivo ?? 'foto/propuesta.json', prompt, problemas } };
    await writeFile(ruta, `${JSON.stringify({ ...guardada, propuesta, opcionesPrompt, prompt, problemas }, null, 2)}\n`);
    if (accion.confirmo && problemas.length) return { encargo, parar: `No se puede confirmar con problemas: ${problemas.join(' | ')}. Corrige ${relative(deps.raiz, ruta)}.`, usaAccion: true };

    const disponible = deps.generador.disponible();
    const estimado = disponible.ok ? await deps.generador.estimarUsd(peticion(e, real.ruta, prompt, 0, await rutaDeEstilo(deps, e))) : 0;
    const fotos = 1 + generadas.length;
    const elementos = propuesta.descripcion.elementos.map((x) => `${x.nombre}${x.recuento !== null ? ` ×${x.recuento}` : ''}${x.cortados ? ` (+${x.cortados} cortado por el borde)` : ''}${x.dudoso ? ' ¿?' : ''} (${x.estado})`).join('; ');
    const mirar = recuentosQueMirar(propuesta.descripcion);
    if (!accion.confirmo) {
      return {
        encargo,
        parar: [
          'CONFIRMA LOS ELEMENTOS Y EL GASTO',
          `  Elementos: ${elementos}`,
          ...(mirar.length ? [`  MIRA ESTOS RECUENTOS EN LA FOTO SUBIDA (el director no está seguro o hay piezas cortadas): ${mirar.join(' | ')}`] : []),
          `  Cámara: de ${propuesta.descripcion.anguloGrados}° a ${propuesta.huecos.camara.anguloGrados}° · ${propuesta.huecos.camara.descripcion}`,
          ...(opcionesPrompt?.desdeElInventario && propuesta.descripcion.elementos.every((x) => x.enEncuadre === true) ? ['  Toma: entran todos los elementos de la lista.'] : []),
          `  Prompt${tomas.length ? ' de la portada' : ''}: ${prompt}`,
          ...tomas.map((t) => (t.real ? `  Detalle ${t.n} («${t.elemento}»): la foto de más del dueño, tal cual (no se genera).` : `  Toma de detalle ${t.n} («${t.elemento}»): ${t.prompt}`)),
          problemas.length ? `  PROBLEMAS (hay que corregirlos en ${relative(deps.raiz, ruta)} antes de confirmar): ${problemas.join(' | ')}` : '  Cumple la plantilla y la regla «otra toma».',
          disponible.ok
            ? generadas.length
              ? `  FOTOS: ${fotos} (la portada y ${generadas.length} detalle(s)). Gasto: ≤ ${(estimado * fotos).toFixed(3)} USD con ${deps.generador.nombre} (≤ ${estimado.toFixed(3)} cada una). Podrás pedir otra portada después de ver la primera, dentro del límite de ${MAX_INTENTOS_SEGUIDOS} candidatas. Un detalle que no pase usa un recorte.`
              : `  Gasto: ≤ ${estimado.toFixed(3)} USD por candidata con ${deps.generador.nombre}. Se hará una: podrás pedir otra después de verla, dentro del límite de ${MAX_INTENTOS_SEGUIDOS}.`
            : `  Generación por la API no disponible: ${disponible.motivo}.`,
          `  Para corregir: edita ${relative(deps.raiz, ruta)} («propuesta»). Para seguir: --confirmo`,
        ].join('\n'),
      };
    }
    nota(`Confirmado: elementos, prompt y hasta ${MAX_INTENTOS_SEGUIDOS} intentos${disponible.ok ? ` (≤ ${estimado.toFixed(3)} USD cada uno)` : ''}.`);
    const { bloqueo: _fuera, ...sinBloqueo } = encargo;
    return {
      encargo: ir(sinBloqueo as EncargoPost, 'GENERAR', {
        autorizacion: { fecha: deps.ahora(), maxIntentos: MAX_INTENTOS_SEGUIDOS, estimadoPorIntentoUsd: estimado, intentosPrevios: e.intentos.length }, tomas,
      }),
      usaAccion: true,
    };
  },

  async GENERAR(deps, e, accion, nota) {
    const real = await deps.activos.obtener(e.local, e.activoReal as string);
    const n = e.intentos.length + 1;
    const id = `${e.proyecto}-foto-${n}`;
    const prompt = e.propuesta?.prompt ?? '';
    const estilo = await rutaDeEstilo(deps, e);
    const resolverFoto = async (
      solicitud: PeticionFoto, numero: number, descripcion: string, importar?: string, soloRecuperar = false,
    ): Promise<{ intento?: IntentoFoto; parada?: string; pendiente?: true }> => {
      const recuperar = async (p: PeticionFoto) => {
        const recuperacion = await prepararRecuperacion(deps.proyectos, e, p, real, numero, deps.ahora);
        const existe = await deps.activos.existe(e.local, p.id);
        const intento = existe ? await recuperacion.recuperar(await deps.activos.obtener(e.local, p.id)) : undefined;
        return { existe, intento, recuperacion };
      };
      const original = await recuperar(solicitud);
      const idManual = `${solicitud.id}-manual`;
      const manual = original.existe && !original.intento ? await recuperar({ ...solicitud, id: idManual }) : undefined;
      const recuperado = original.intento ?? manual?.intento;
      if (recuperado) {
        nota(`Foto ${recuperado.activo} recuperada con su procedencia y sin otro envío.`);
        return { intento: recuperado };
      }
      if (soloRecuperar) return {};
      if (importar) {
        const bytes = await readFile(resolve(deps.raiz, importar));
        const acabado = manual ? idManual : solicitud.id;
        if (manual?.existe) throw new ErrorDeUsuario(`El activo de importación ${acabado} ya existe y no coincide con esta solicitud.`);
        const generacion = { modelo: 'importada a mano (fuera de la orden)', costeUsd: 0, tarifa: `importada de ${importar}; el coste, si lo hubo, no pasa por la orden` };
        await registrarFotoGenerada(deps, e, real, { id: acabado, bytes, generacion, prompt: solicitud.prompt, n: numero, descripcion });
        nota(`Foto ${acabado} importada de ${importar}.`);
        return { intento: { n: numero, activo: acabado, final: 'PENDIENTE', motivos: [], costeUsd: 0 } };
      }
      if (original.existe || await original.recuperacion.reservada()) {
        return { parada: 'Existe un intento anterior sin foto compatible.', pendiente: true };
      }
      const disponible = deps.generador.disponible();
      if (!disponible.ok) return { parada: disponible.motivo };
      if (e.productorEditorial && !e.autorizacion) return { parada: 'Falta la autorización de gasto de la comanda.' };
      const reservar = original.recuperacion.reservar;
      try {
        if (!deps.generador.reservaEnEnvio) await reservar();
        const foto = await deps.generador.generar({
          ...solicitud,
          ...(e.productorEditorial && e.autorizacion ? { estimadoMaximoUsd: e.autorizacion.estimadoPorIntentoUsd } : {}),
          ...(deps.generador.reservaEnEnvio ? { antesDeEnviar: reservar } : {}),
        });
        const generacion = { modelo: foto.modelo, costeUsd: foto.costeUsd, tarifa: foto.detalle };
        await registrarFotoGenerada(deps, e, real, { id: solicitud.id, bytes: foto.bytes, generacion, prompt: solicitud.prompt, n: numero, descripcion });
        nota(`Foto ${solicitud.id} generada con ${deps.generador.nombre} (${foto.modelo}): ${foto.costeUsd.toFixed(4)} USD.`);
        return { intento: { n: numero, activo: solicitud.id, final: 'PENDIENTE', motivos: [], costeUsd: foto.costeUsd } };
      } catch (error) {
        const posterior = await recuperar(solicitud);
        if (posterior.intento) {
          nota(`Foto ${posterior.intento.activo} recuperada con su procedencia y sin otro envío.`);
          return { intento: posterior.intento };
        }
        if (!(await original.recuperacion.reservada())) throw error;
        return { parada: `El intento reservado no dejó una foto recuperable. ${(error as Error).message}`, pendiente: true };
      }
    };
    const portada = await resolverFoto(peticion(e, real.ruta, prompt, n, estilo), n, `Foto nueva del encargo ${e.proyecto}, intento ${n}: ${e.plato}`, accion.importar);
    if (!portada.intento) {
      const ruta = relative(deps.raiz, join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? ''));
      const situacion = portada.pendiente ? 'GENERACION PENDIENTE DE IMPORTACION' : 'No puedo generar';
      return { encargo: e, parar: `${situacion}: ${portada.parada}. Prompt para generarla a mano: ${ruta}. Después: --importar <imagen>` };
    }
    const tomas: TomaDelEncargo[] = [];
    for (const t of e.tomas) {
      if (t.intento || t.real) {
        tomas.push(t);
        continue;
      }
      const solicitud = { ...peticion(e, real.ruta, t.prompt, 0, estilo), id: `${e.proyecto}-toma-${t.n}` };
      const detalle = await resolverFoto(solicitud, 1, `Toma de detalle ${t.n} del encargo ${e.proyecto}: ${t.elemento}`, undefined, Boolean(accion.importar));
      if (detalle.parada) nota(`Toma de detalle ${t.n}: ${detalle.parada} Se usará un recorte de la foto confirmada.`);
      tomas.push(detalle.intento ? { ...t, intento: detalle.intento } : t);
    }
    return { encargo: ir(e, 'COMPROBAR', { intentos: [...e.intentos, portada.intento], tomas }), usaAccion: Boolean(accion.importar) };
  },

  async COMPROBAR(deps, e, _a, nota) {
    const ultimo = e.intentos[e.intentos.length - 1] as IntentoFoto;
    const guardada = JSON.parse(await readFile(join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? ''), 'utf8')) as { propuesta: unknown; opcionesPrompt?: OpcionesDePrompt };
    const propuesta = PropuestaFotoNueva.parse(guardada.propuesta);
    const h = huecosEfectivos(propuesta, guardada.opcionesPrompt);
    const lista = `${h.elementos.replace(/[.\s]+$/, '')}. ${h.recuento}`;
    // Un recuento dudoso no sirve de patrón para contar piezas en la foto nueva.
    const piezas = propuesta.descripcion.elementos.filter((x) => x.recuento !== null && x.recuento > 0 && !x.dudoso).map((x) => ({ nombre: x.nombre, esperado: x.recuento as number }));
    // El aire que pidió el director de foto, medido con la máscara de la foto nueva (que se guarda ya para el diseño).
    let aire: AireMedido | undefined;
    const lado = propuesta.huecos.aire;
    if (lado && lado !== 'ninguno' && deps.disenador) {
      await asegurarMascara(deps, e.local, ultimo.activo, nota);
      const mapa = await deps.disenador.medidor.medir(await deps.activos.obtener(e.local, ultimo.activo));
      const libre = aireEn(mapa, lado);
      if (libre !== undefined) aire = { lado, libre, minimo: AIRE_MINIMO };
    }
    const revision = await comprobarFotoNueva(
      { activos: deps.activos, revisor: deps.revisor, ahora: deps.ahora },
      { local: e.local, generado: ultimo.activo, real: e.activoReal as string, lista, piezas, ...(aire ? { aire } : {}), ...((await rutaDeEstilo(deps, e)) ? { referencia: (await rutaDeEstilo(deps, e))! } : {}) },
    ).catch(error => {
      if (!(error instanceof ErrorDeServicio)) throw error;
      return { final: 'REVISAR' as const, motivos: ['La revisión automática no ha podido completarse. Compara la candidata con la foto original.'] };
    });
    const intentos = e.intentos.map((i) => (i.n === ultimo.n ? { ...i, final: revision.final, motivos: revision.motivos } : i));
    nota(`Comprobación del intento ${ultimo.n}: ${revision.final}${revision.motivos.length ? ` (${revision.motivos.join('; ')})` : ''}.`);
    // F3.3: cada toma de detalle, por separado, frente a su propia lista (solo su elemento). Sin comparar la toma con la
    // foto subida: un primer plano de un elemento ya es otra toma; sí el aire que pidió.
    const tomas = [];
    for (const t of e.tomas) {
      const hueco = propuesta.tomas?.find((x) => x.elemento === t.elemento);
      if (!t.intento || t.intento.final !== 'PENDIENTE' || !hueco) {
        tomas.push(t);
        continue;
      }
      const ht = huecosDeTomaEfectivos(propuesta, hueco, guardada.opcionesPrompt);
      let aireToma: AireMedido | undefined;
      if (hueco.huecos.aire && hueco.huecos.aire !== 'ninguno' && deps.disenador) {
        await asegurarMascara(deps, e.local, t.intento.activo, nota);
        const libre = aireEn(await deps.disenador.medidor.medir(await deps.activos.obtener(e.local, t.intento.activo)), hueco.huecos.aire);
        if (libre !== undefined) aireToma = { lado: hueco.huecos.aire, libre, minimo: AIRE_MINIMO };
      }
      const r = await comprobarFotoNueva(
        { activos: deps.activos, revisor: deps.revisor, ahora: deps.ahora },
        { local: e.local, generado: t.intento.activo, real: e.activoReal as string, lista: `${ht.elementos.replace(/[.\s]+$/, '')}. ${ht.recuento}`, comprobarToma: false, ...(aireToma ? { aire: aireToma } : {}) },
      );
      nota(`Comprobación de la toma de detalle ${t.n} («${t.elemento}»): ${r.final}${r.motivos.length ? ` (${r.motivos.join('; ')})` : ''}${r.final === 'DESCARTA' ? '. Su diapositiva usará un recorte de la portada.' : ''}.`);
      tomas.push({ ...t, intento: { ...t.intento, final: r.final, motivos: r.motivos } });
    }
    return { encargo: ir(e, 'CONFIRMAR_FOTO', { intentos, tomas }) };
  },

  async CONFIRMAR_FOTO(deps, e, accion, nota) {
    if (accion.volverAlInventario) {
      nota('El usuario volvió al inventario para ajustar la toma.');
      return { encargo: ir(e, 'CONFIRMAR_ELEMENTOS'), parar: 'Revisa el inventario y la toma antes de autorizar otra candidata.', usaAccion: true };
    }
    const original = accion.foto === 'original';
    const intento = typeof accion.foto === 'number' ? e.intentos.find(i => i.n === accion.foto) : e.intentos.at(-1);
    if (accion.rechazo) {
      if (!intento || original || intento.final === 'PENDIENTE') throw new ErrorDeUsuario('Elige una candidata revisada para rechazarla.');
      const brief = await deps.productor?.leerBrief?.(e.proyecto);
      const puedeGenerar = accion.reintentar !== false && deps.generador.disponible().ok && puedeReintentarFoto(e, brief?.presupuesto.fotos);
      if (accion.reintentar && !puedeGenerar) throw new ErrorDeUsuario('No se puede pedir otra candidata con la autorización y el generador actuales.');
      const intentos = e.intentos.map(i => i.n === intento.n ? { ...i, final: 'RECHAZADA' as const, motivos: [...i.motivos, `rechazada por ti: ${accion.rechazo}`] } : i);
      nota(`Intento ${intento.n} rechazado: ${accion.rechazo}.`);
      return {
        encargo: ir(e, puedeGenerar ? 'GENERAR' : 'CONFIRMAR_FOTO', { intentos }),
        ...(puedeGenerar ? {} : { parar: 'Revisa las fotos disponibles y elige con cuál continuar.' }),
        usaAccion: true,
      };
    }
    if (!accion.confirmo) {
      const fotos = await Promise.all(e.intentos.map(async i => {
        if (!await deps.activos.existe(e.local, i.activo)) return `  Intento ${i.n}: archivo no disponible.`;
        const foto = await deps.activos.obtener(e.local, i.activo);
        return `  Intento ${i.n}: ${relative(deps.raiz, foto.ruta)} · ${i.final}`;
      }));
      return {
        encargo: e,
        parar: [
          'MIRA LA FOTO Y CONFIRMA',
          ...fotos,
          ...(intento?.motivos.length ? [`  Avisos de la última candidata: ${intento.motivos.join('; ')}`] : []),
          ...(await Promise.all(
            e.tomas.filter((t) => t.real).map(async (t) => `  Detalle ${t.n} («${t.elemento}»): la foto de más del dueño, ${relative(deps.raiz, (await deps.activos.obtener(e.local, t.elegida!)).ruta)}`),
          )),
          ...(await Promise.all(
            e.tomas.filter((t) => t.intento).map(async (t) => `  Toma de detalle ${t.n} («${t.elemento}»): ${relative(deps.raiz, (await deps.activos.obtener(e.local, t.intento!.activo)).ruta)} · ${t.intento!.final}${t.intento!.final === 'DESCARTA' ? ' (no se usará: su diapositiva irá con un recorte de la portada)' : ''}`),
          )),
          '  Elige con --confirmo [--foto N | --foto original]. Para descartar y pedir otra dentro del presupuesto: --rechazo "motivo".',
          ...(e.tomas.length ? ['  En un carrusel: --sin-toma N quita una toma de detalle que no vale · --portada-toma N hace la portada con esa toma (un producto aislado) y deja la foto para los recortes y el cierre'] : []),
        ].join('\n'),
      };
    }
    if (!original && (!intento || intento.final === 'PENDIENTE')) throw new ErrorDeUsuario('Elige una foto que ya esté lista para revisar.');
    const fotoElegida = original ? e.activoReal : intento?.activo;
    if (!fotoElegida || !await deps.activos.existe(e.local, fotoElegida)) throw new ErrorDeUsuario('El archivo de la foto elegida no está disponible.');
    if (original && e.usoFotoReal !== 'PUBLICABLE') throw new ErrorDeUsuario('La foto original está marcada solo para pruebas de composición.');
    const fuera = new Set(accion.sinToma ?? []);
    const tomas = e.tomas.map((t): TomaDelEncargo => {
      if (fuera.has(t.n) || (original && !t.real)) {
        const { elegida: _x, ...sin } = t;
        return sin;
      }
      return t.intento && t.intento.final !== 'DESCARTA' ? { ...t, elegida: t.intento.activo } : t;
    });
    if (fuera.size) nota(`Tomas de detalle quitadas por ti: ${[...fuera].join(', ')}.`);
    const confirmadas = tomas.filter((t) => t.elegida);
    if (confirmadas.length) nota(`Tomas de detalle confirmadas: ${confirmadas.map((t) => `${t.n} («${t.elemento}»)`).join(', ')}.`);
    const portada = accion.portadaToma !== undefined ? confirmadas.find((t) => t.n === accion.portadaToma) : undefined;
    if (accion.portadaToma !== undefined && !portada) return { encargo: e, parar: `La toma ${accion.portadaToma} no está confirmada: no puede ser la portada.`, usaAccion: true };
    if (original) {
      nota('El usuario eligió la foto original para la composición.');
    } else if (intento) {
      await deps.activos.actualizar(e.local, intento.activo, {
        fidelidad: {
          frente: e.activoReal as string,
          veredicto: 'CONSERVA',
          metodo: `revisión humana en la orden única, tras la comprobación automática (${intento.final})`,
          medidas: {},
          notas: intento.motivos,
          revisadoEn: deps.ahora(),
        },
      });
      nota(`Foto del intento ${intento.n} confirmada por el usuario (comprobación automática: ${intento.final}).`);
    }
    if (portada) nota(`La portada sale de la toma ${portada.n} («${portada.elemento}»); los recortes y el cierre usan la foto confirmada.`);
    return { encargo: ir(e, 'MASCARA', { fotoElegida, tomas, ...(portada ? { portadaDeToma: portada.n } : {}) }), usaAccion: true };
  },

  async MASCARA(deps, e, _a, nota) {
    await asegurarMascara(deps, e.local, e.fotoElegida as string, nota);
    for (const t of e.tomas) if (t.elegida) await asegurarMascara(deps, e.local, t.elegida, nota);
    return { encargo: ir(e, 'INTENCION') };
  },

  async INTENCION(deps, e, _a, nota) {
    const carpeta = join(deps.proyectos, e.proyecto);
    const tokens = join(deps.raiz, 'marcas', e.local, 'tokens.json');
    if (!(await existe(tokens))) return { encargo: e, parar: `Falta marcas/${e.local}/tokens.json (los colores y estilos de la marca para el compositor).` };
    if (e.productorEditorial) {
      const brief = await deps.productor?.leerBrief?.(e.proyecto);
      if (!brief?.editorial) return { encargo: e, parar: 'Falta el plan editorial aprobado de la comanda.' };
      const medidor = deps.disenador?.medidor;
      await materializarEditorial(carpeta, tokens, e, brief, medidor
        ? async id => medidor.medir(await deps.activos.obtener(e.local, id)) : undefined);
      nota(`Composición lista: ${brief.editorial.plan.diapositivas.length} página(s), brief v${brief.version}.`);
      return { encargo: ir(e, 'COMPONER') };
    }
    const plan = join(carpeta, 'plan.json');
    if (!(await existe(plan))) {
      await writeFile(
        plan,
        `${JSON.stringify({ nota: `Encargo ${e.proyecto} (orden única). Referencia: ${e.referencia ?? 'ninguna'}.`, local: e.local, marca: relative(carpeta, tokens), diapositivas: [{ intencion: 'intenciones/post.json' }] }, null, 2)}\n`,
      );
    }
    const intencion = join(carpeta, 'intenciones', 'post.json');
    if (!(await existe(intencion))) {
      await mkdir(join(carpeta, 'intenciones'), { recursive: true });
      const borrador = join(carpeta, 'intenciones', 'post.borrador.json');
      const marca = await deps.referencias.locales.obtener(e.local);
      let motivo = 'no hay director de diseño';
      // F3: la escribe el director. Una propuesta solo pasa a post.json si cumple todo lo comprobable.
      if (deps.disenador) {
        const archivoPropuesta = join(carpeta, 'intenciones', 'post.propuesta.json');
        if (await existe(archivoPropuesta)) {
          motivo = `ya hay una propuesta del director que no pasó (${relative(deps.raiz, archivoPropuesta)}); bórrala para pedir otra`;
        } else {
          try {
            const r = await disenarIntencion(deps, deps.disenador, e, marca, tokens);
            await writeFile(
              archivoPropuesta,
              `${JSON.stringify({ director: deps.disenador.director.nombre, critico: deps.disenador.critico?.nombre ?? null, fecha: deps.ahora(), propuesta: r.propuesta, problemas: r.problemas, avisos: r.avisos, critica: r.critica ?? null, enRevision: r.enRevision, intentos: r.intentos, mapa: { sujeto: r.mapa.sujeto, libres: r.mapa.libres, vivo: r.mapa.vivo } }, null, 2)}\n`,
            );
            if (r.intencion && r.problemas.length === 0 && !r.enRevision) {
              await writeFile(intencion, `${JSON.stringify(r.intencion, null, 2)}\n`);
              // Carrusel: cada diapositiva en su archivo, y el plan con todas, en orden (la portada primero).
              if (r.diapositivas?.length) {
                for (const d of r.diapositivas) await writeFile(join(carpeta, 'intenciones', `${d.id}.json`), `${JSON.stringify(d.intencion, null, 2)}\n`);
                const actual = JSON.parse(await readFile(plan, 'utf8')) as Record<string, unknown>;
                await writeFile(plan, `${JSON.stringify({ ...actual, diapositivas: [{ intencion: 'intenciones/post.json' }, ...r.diapositivas.map((d) => ({ intencion: `intenciones/${d.id}.json` }))] }, null, 2)}\n`);
                nota(`Carrusel: portada, ${r.diapositivas.length - 1} detalle(s) y cierre.`);
              }
              const critica = r.critica ? ` Crítica visual: ${r.critica.llega ? 'llega al oficio de la referencia' : `no llega (${r.critica.motivos.join('; ')})`}${r.critica.adoptada ? '; se adopta su corrección' : ''}.` : '';
              nota(`Intención escrita por ${deps.disenador.director.nombre} (${r.intentos.length} propuesta(s))${r.avisos.length ? `, con avisos: ${r.avisos.join(' | ')}` : ''}.${critica}`);
              return { encargo: ir(e, 'COMPONER') };
            }
            if (r.intencion) await writeFile(borrador, `${JSON.stringify(r.intencion, null, 2)}\n`);
            // Cumple todo lo medible pero la crítica visual dice que no llega: queda EN REVISIÓN, no se compone sola.
            motivo = r.problemas.length
              ? `la propuesta del director no pasa las comprobaciones: ${r.problemas.join(' | ')}`
              : `EN REVISIÓN: cumple todo lo medible, pero la crítica visual dice que no llega al oficio de la referencia (${r.critica?.motivos.join('; ') ?? 'sin motivos'}). El borrador es su mejor propuesta: si te vale, guárdalo como intención`;
          } catch (error) {
            if (!(error instanceof ErrorDeServicio || error instanceof ErrorDeUsuario)) throw error;
            motivo = `el director de diseño no ha podido responder (${error.message})`;
          }
        }
      }
      if (!(await existe(borrador))) await writeFile(borrador, `${JSON.stringify(intencionBorrador(e, marca.nombre), null, 2)}\n`);
      nota(`Falta la intención de diseño: ${motivo}. Hay un borrador.`);
      return {
        encargo: e,
        parar: `FALTA LA INTENCIÓN DE DISEÑO: ${motivo}. Parte de la ficha de la referencia ${e.referencia ?? ''} y del borrador ${relative(deps.raiz, borrador)}; guárdala como ${relative(deps.raiz, intencion)} y vuelve a lanzar la orden.`,
      };
    }
    Intencion.parse(JSON.parse(await readFile(intencion, 'utf8')));
    return { encargo: ir(e, 'COMPONER') };
  },

  async COMPONER(deps, e, _a, nota) {
    const carpeta = join(deps.proyectos, e.proyecto);
    const pieza = await deps.componedor.componer(carpeta, { etiqueta: 'orden-post' });
    const errores = pieza.diapositivas.flatMap((d) => d.problemas.filter((p) => p.gravedad === 'ERROR').map((p) => `${d.id} v${d.version}: ${p.tipo}: ${p.mensaje}`));
    if (errores.length) {
      return { encargo: e, parar: `El compositor da errores: ${errores.join(' | ')}. Corrige la intención, sube su versión y vuelve a lanzar la orden.` };
    }
    if (e.productorEditorial) {
      const brief = await deps.productor?.leerBrief?.(e.proyecto);
      if (!brief) throw new ErrorDeUsuario('Falta el brief con el que revisar la entrega.');
      const decision = await revisarEntrega(deps, e, brief, pieza);
      if (decision === 'COMPONER') {
        nota('Crítica del render: devolución localizada para componer las versiones corregidas.');
        return { encargo: e };
      }
      if (decision.estado === 'REVISION_HUMANA') {
        const motivos = decision.incidencias.map(i => `${i.id} v${i.version}: ${i.motivo}`).join(' · ');
        return { encargo: e, parar: `Revisión editorial pendiente. ${motivos}` };
      }
      nota(`Crítica del render (${decision.modelo}): ${decision.estado}.`);
    }
    const plan = join(carpeta, 'plan.json');
    const contenido = JSON.parse(await readFile(plan, 'utf8')) as Record<string, unknown>;
    await writeFile(plan, `${JSON.stringify({ ...contenido, pieza: { fecha: deps.ahora().slice(0, 10), ...(e.referencia ? { referencia: e.referencia } : {}) } }, null, 2)}\n`);
    for (const d of pieza.diapositivas) nota(`Compuesta ${d.id} v${d.version}: ${relative(deps.raiz, join(d.carpeta, 'exportadas'))} (3:4 y 4:5).`);
    nota(`Hojas de revisión: ${relative(deps.raiz, pieza.revision)}. La pieza cuenta para el umbral de referencia.`);
    return { encargo: ir(e, 'HECHO') };
  },
};

/** La máscara del sujeto de una foto, si aún no la tiene (la necesitan la comprobación del aire y el diseño). */
async function asegurarMascara(deps: DepsPost, local: string, activo: string, nota: Nota): Promise<void> {
  const foto = await deps.activos.obtener(local, activo);
  if (foto.activo.mascara) return;
  const png = await deps.segmentador.mascara(foto.ruta);
  const recortada = await sharp(png).trim({ background: '#000000', threshold: 40 }).toBuffer({ resolveWithObject: true });
  const bbox = { x: -(recortada.info.trimOffsetLeft ?? 0), y: -(recortada.info.trimOffsetTop ?? 0), w: recortada.info.width, h: recortada.info.height };
  await deps.activos.actualizar(
    local,
    foto.activo.id,
    { mascara: { archivo: 'mascara.png', metodo: deps.segmentador.metodo, creadaEn: deps.ahora(), bbox, incluye: `lo que detecte ${deps.segmentador.metodo}` } },
    { 'mascara.png': png },
  );
  nota(`Máscara del sujeto (${deps.segmentador.metodo}): caja ${bbox.w} × ${bbox.h} px.`);
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** El elemento descrito que más palabras comparte con lo que dice el dueño (o ninguno si no comparten ninguna). */
export function elementoParecido(dicho: string, nombres: string[]): string | undefined {
  const tokens = (t: string) => sinAcentos(t).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 2 || /\d/.test(p));
  const palabras = tokens(dicho);
  // La misma palabra o la misma raíz (nigiri / nigiris).
  const igual = (a: string, b: string) => a === b || (Math.min(a.length, b.length) > 3 && (a.startsWith(b) || b.startsWith(a)));
  const puntos = nombres.map((n) => ({ n, p: palabras.filter((p) => tokens(n).some((t) => igual(t, p))).length }));
  const mejor = puntos.sort((a, b) => b.p - a.p)[0];
  return mejor && mejor.p > 0 ? mejor.n : undefined;
}

/** Registra una foto real subida (la del plato o una de más) como activo REAL del local, si no estaba. */
async function registrarFotoReal(deps: DepsPost, e: EncargoPost, id: string, ruta: string, descripcion: string, nota: (t: string) => void): Promise<void> {
  if (await deps.activos.existe(e.local, id)) return;
  const origen = resolve(deps.raiz, ruta);
  const bytes = await readFile(origen);
  const meta = await sharp(bytes).metadata();
  const sha = createHash('sha256').update(bytes).digest('hex');
  const archivo = `original${extname(origen).toLowerCase() || '.jpg'}`;
  await deps.activos.crear(
    Activo.parse({
      id,
      localSlug: e.local,
      tipo: 'REAL',
      uso: e.usoFotoReal,
      descripcion,
      archivo,
      ancho: meta.width,
      alto: meta.height,
      sha256: sha,
      procedencia: { ruta: relative(deps.raiz, origen), sha256: sha, copiadoEn: deps.ahora() },
      alteraciones: [],
      niveles: [],
    }),
    { [archivo]: bytes },
  );
  nota(`Foto subida registrada como activo ${id} (${meta.width} × ${meta.height} px).`);
}

/** Registra una foto generada (o importada) como activo GENERADO del local, con su procedencia. */
async function registrarFotoGenerada(
  deps: DepsPost,
  e: EncargoPost,
  real: { activo: { sha256: string } },
  f: { id: string; bytes: Buffer; generacion: { modelo: string; costeUsd: number; tarifa: string }; prompt: string; n: number; descripcion: string },
): Promise<void> {
  const { id, bytes, generacion, prompt, n } = f;
  const meta = await sharp(bytes).metadata();
  const extension = meta.format === 'jpeg' ? 'jpg' : (meta.format ?? 'png');
  const archivo = `original.${extension}`;
  const sha = createHash('sha256').update(bytes).digest('hex');
  await deps.activos.crear(
    Activo.parse({
      id,
      localSlug: e.local,
      tipo: 'GENERADO',
      uso: 'SOLO_PRUEBA_COMPOSICION',
      descripcion: f.descripcion,
      archivo,
      ancho: meta.width,
      alto: meta.height,
      sha256: sha,
      procedencia: {
        ruta: relative(deps.raiz, join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? '')),
        sha256: sha,
        copiadoEn: deps.ahora(),
        generacion: {
          modelo: generacion.modelo,
          requestId: `sin-id-${sha.slice(0, 12)}`,
          promptArchivo: relative(deps.raiz, join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? '')),
          prompt,
          parametros: { aspectRatio: ASPECTO, imageSize: TAMANO, intento: n, orden: 'post' },
          referencias: [{ activo: e.activoReal as string, sha256: real.activo.sha256 }],
          costeEstimadoUsd: generacion.costeUsd,
          tarifa: generacion.tarifa,
          generadoEn: deps.ahora(),
        },
      },
      alteraciones: ['Cámara, luz, encuadre y colocación nuevos (plantilla de foto nueva, regla «otra toma»).', 'Superficie y fondo libres.'],
      niveles: [],
    }),
    { [archivo]: bytes },
  );
}

/** Reúne lo que el director de diseño necesita (hechos, referencia, foto, tokens) y le pide la intención. También sirve para rehacer el diseño de un encargo terminado (una versión nueva). */
export async function disenarIntencion(deps: DepsPost, disenador: Omit<DepsProponerDiseno, 'probar'>, e: EncargoPost, marca: Marca, rutaTokens: string): Promise<ResultadoDiseno> {
  // F3.3: con «portadaDeToma», la portada es esa toma (un producto aislado) y la foto elegida queda para la serie.
  const deToma = e.portadaDeToma !== undefined ? e.tomas.find((t) => t.n === e.portadaDeToma && t.elegida) : undefined;
  const foto = await deps.activos.obtener(e.local, deToma?.elegida ?? (e.fotoElegida as string));
  const guardada = JSON.parse(await readFile(join(deps.proyectos, e.proyecto, e.propuesta?.archivo ?? 'foto/propuesta.json'), 'utf8')) as { propuesta: unknown };
  const propuestaFoto = PropuestaFotoNueva.parse(guardada.propuesta);
  const hechos: HechosDeLaPieza = {
    plato: e.plato,
    elementos: propuestaFoto.descripcion.elementos.map((x) => ({ nombre: x.nombre, estado: x.estado, recuento: x.recuento })),
    local: {
      nombre: marca.nombre,
      ciudad: marca.ciudad,
      descripcion: marca.descripcion,
      tonos: marca.tonos,
      ...(marca.instagram ? { instagram: marca.instagram } : {}),
      ...(marca.web ? { web: marca.web } : {}),
    },
  };
  let referencia: EntradaDiseno['referencia'];
  if (e.referencia) {
    const r = await deps.referencias.referencias.obtener(e.local, e.referencia);
    const imagen = r.origen.archivo;
    // F3.3: el tratamiento que miró el analista completa la ficha a mano que no lo decía.
    const ficha = r.ficha && !r.ficha.tratamiento && e.tratamiento ? { ...r.ficha, tratamiento: e.tratamiento } : r.ficha;
    referencia = { id: r.id, ...(ficha ? { ficha } : {}), ...(imagen ? { imagen: deps.referencias.referencias.rutaArchivo(e.local, r.id, imagen) } : {}) };
  }
  const tokensMarca = Tokens.parse(JSON.parse(await readFile(rutaTokens, 'utf8')));
  // Punto 14: la huella tipográfica del local (sus piezas anteriores y su marca) y los efectos de la referencia.
  let huella: string | undefined;
  if (deps.historial) {
    const describir = disenador.describirFuente ?? ((f: string) => f);
    const h = huellaDelLocal(e.local, await deps.historial.intencionesDelLocal(e.local), tokensMarca, (f) => /script|manuscrit|pincel|florituras|caligr/i.test(describir(f)));
    await deps.historial.guardarHuella(e.local, h);
    huella = textoDeHuella(h, efectosDeLaReferencia(referencia?.ficha));
  }
  return proponerDiseno(
    { ...disenador, probar: (intencion) => probarIntencion(deps, e, rutaTokens, intencion) },
    {
      id: 'post',
      version: 1,
      titulo: `${marca.nombre} · ${cortarPorPalabras(e.plato, 60)}`,
      marca: e.local,
      foto,
      hechos,
      tokensMarca,
      ...(referencia ? { referencia } : {}),
      titularCreativo: e.titularCreativo,
      ...(e.estetica ? { estetica: e.estetica } : {}),
      formato: e.formato,
      ...(huella ? { huella } : {}),
      // F3.3: las tomas de detalle confirmadas, con su elemento tal como se confirmó.
      ...(deToma ? { fotoDeLaSerie: e.fotoElegida as string } : {}),
      tomas: e.tomas
        .filter((t) => t.elegida && t !== deToma)
        .map((t) => ({ papel: `detalle${t.n}`, activo: t.elegida!, elemento: { nombre: t.elemento, estado: propuestaFoto.descripcion.elementos.find((x) => x.nombre === t.elemento)?.estado ?? t.elemento } })),
    },
  );
}

/**
 * Compone la intención en borrador (carpeta temporal, se sobrescribe) y devuelve lo que dice el compositor:
 * los ERROR (y los fallos de resolución) impiden usarla; los AVISO se le devuelven al director.
 */
async function probarIntencion(deps: DepsPost, e: EncargoPost, rutaTokens: string, intencion: Intencion): Promise<PruebaDeIntencion> {
  const carpeta = join(tmpdir(), 'estudio-contenido-propuestas', `${e.simulado ? 'simulado' : 'real'}--${e.proyecto}`);
  await mkdir(carpeta, { recursive: true });
  await writeFile(join(carpeta, 'plan.json'), `${JSON.stringify({ nota: `Prueba de la propuesta del director para ${e.proyecto}.`, local: e.local, marca: rutaTokens, diapositivas: [{ intencion: 'intencion.json' }] }, null, 2)}\n`);
  await writeFile(join(carpeta, 'intencion.json'), `${JSON.stringify(intencion, null, 2)}\n`);
  try {
    const pieza = await deps.componedor.componer(carpeta, { borrador: true, etiqueta: 'propuesta' });
    const problemas = pieza.diapositivas.flatMap((d) => d.problemas);
    const png = pieza.diapositivas[0]?.png;
    return {
      errores: problemas.filter((p) => p.gravedad === 'ERROR').map((p) => `${p.tipo}: ${p.mensaje}`),
      avisos: problemas.filter((p) => p.gravedad === 'AVISO').map((p) => `${p.tipo}: ${p.mensaje}`),
      ...(png ? { png } : {}),
    };
  } catch (error) {
    if (error instanceof RangeError) return { errores: [`El compositor no puede resolverla: ${error.message}`], avisos: [] };
    throw error;
  }
}

/** La petición que la orden manda al generador para el intento `n` (también sirve para estimar su coste antes de autorizarlo). */
export function peticion(e: EncargoPost, rutaReal: string, prompt: string, n: number, rutaEstilo?: string): PeticionFoto {
  const referencias = [{ ruta: rutaReal, etiqueta: ETIQUETA_REAL }, ...(rutaEstilo ? [{ ruta: rutaEstilo, etiqueta: ETIQUETA_ESTILO }] : [])];
  return { id: `${e.proyecto}-foto-${n}`, prompt, referencias, aspectRatio: ASPECTO, tamano: TAMANO };
}

/** La referencia reducida que va al generador como @image2, si este encargo la manda (se prepara en PROPUESTA). */
async function rutaDeEstilo(deps: Pick<DepsPost, 'proyectos'>, e: EncargoPost): Promise<string | undefined> {
  if (!e.estiloDeReferencia) return undefined;
  const ruta = join(deps.proyectos, e.proyecto, ARCHIVO_REFERENCIA_DE_ESTILO);
  return (await existe(ruta)) ? ruta : undefined;
}

/** Como mucho `max` caracteres, sin partir palabras. */
export function cortarPorPalabras(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max + 1).lastIndexOf(' ');
  return texto.slice(0, corte > 0 ? corte : max).trim();
}

/** Un punto de partida válido para el compositor, NO un diseño: la persona lo rehace desde la ficha de la referencia. */
export function intencionBorrador(e: EncargoPost, nombreLocal: string) {
  return {
    esquema: 'diseno/intencion@1',
    id: 'post',
    version: 1,
    titulo: `${nombreLocal} · ${e.plato}`,
    notas: `BORRADOR de la orden única: la foto a sangre, un titular y la marca. Rehazlo desde la ficha de la referencia ${e.referencia ?? ''} (qué se toma y qué no se copia) antes de componer.`,
    marca: e.local,
    tokens: {
      colores: { fondo: '#111111', claro: '#F2EEE8' },
      estilos: {
        titular: { fuente: 'archivo', ejes: { wdth: 75, wght: 800 }, caso: 'mayusculas', tracking: 0, interlineado: 0.9, color: '@claro' },
        firma: { fuente: 'archivo', ejes: { wdth: 62, wght: 600 }, caso: 'mayusculas', tracking: 0.2, interlineado: 1.3, color: '@claro' },
      },
    },
    activos: { foto: e.fotoElegida },
    textos: { titular: cortarPorPalabras(e.plato, 40), firma: nombreLocal },
    capas: [
      { id: 'fondo', tipo: 'relleno', color: '@fondo' },
      { id: 'foto', tipo: 'imagen', activo: 'foto', caja: { x: 0, y: 0, w: 1, h: 1 } },
      { id: 'velo', tipo: 'degradado', forma: 'lineal', caja: { x: 0, y: 0.6, w: 1, h: 0.4 }, angulo: 90, paradas: [{ en: 0, color: '@fondo', opacidad: 0 }, { en: 1, color: '@fondo', opacidad: 0.85 }] },
      { id: 'titular', tipo: 'texto', texto: '@titular', estilo: 'titular', caja: { x: 0.067, y: 0.76, w: 0.866, h: 0.1 }, ajuste: 'ancho' },
      { id: 'firma', tipo: 'texto', texto: '@firma', estilo: 'firma', caja: { x: 0.067, y: 0.885, w: 0.866, h: 0.024 }, ajuste: 'fijo', tamano: 34 },
    ],
  };
}

export { PARADAS };
