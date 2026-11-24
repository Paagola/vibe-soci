/**
 * Quién ejecuta cada herramienta del chat (catálogo en aplicacion/chat/herramientas.ts). La mayoría reutilizan tal cual
 * lo que ya existía:
 * - las herramientas de línea de comandos (src/herramientas/*.ts) se lanzan como procesos, sobre activos del local
 *   registrados a partir de las imágenes de la conversación; su salida vuelve como imágenes del chat;
 * - el estudio de arte (direcciones) y los lotes, con sus propias órdenes (`arte`, `lote`), sobre un encargo escrito con
 *   los hechos confirmados de la conversación;
 * - la tipografía especial (buscador y creador), las referencias y el alta de un local, con sus casos de uso.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { CatalogoTipografico } from '../adaptadores/compositor/tipografias.js';
import { PintorDeMuestrasSharp } from '../adaptadores/compositor/PintorDeMuestrasSharp.js';
import { AlmacenActivosFicheros } from '../adaptadores/ficheros/AlmacenActivosFicheros.js';
import { BibliotecaTratamientosFicheros } from '../adaptadores/ficheros/BibliotecaTratamientosFicheros.js';
import { leerMarcaDeMuestra } from '../adaptadores/ficheros/marcaDeMuestra.js';
import { GoogleFontsGithub } from '../adaptadores/fuentes/GoogleFontsGithub.js';
import { ClienteGemini } from '../adaptadores/gemini/ClienteGemini.js';
import { EstudioArteGemini } from '../adaptadores/gemini/EstudioArteGemini.js';
import { gastoAcumuladoGemini } from '../adaptadores/gemini/GeneradorFotoGemini.js';
import { registradorDeUso } from '../adaptadores/gemini/registroUso.js';
import { TipografiaGemini } from '../adaptadores/gemini/TipografiaGemini.js';
import { exigirTomaNueva } from '../adaptadores/imagen/copiaDeReferencia.js';
import { LectorAppleVision } from '../adaptadores/imagen/LectorAppleVision.js';
import { SegmentadorVision } from '../adaptadores/imagen/SegmentadorVision.js';
import { promptFinal, registrarFotoGenerada } from '../aplicacion/arte/pieza.js';
import type { ContextoDeHerramienta } from '../aplicacion/chat/servicioChat.js';
import type { ResultadoHerramienta } from '../aplicacion/chat/herramientas.js';
import { crearLocal } from '../aplicacion/crearLocal.js';
import { prepararMarca } from '../aplicacion/prepararMarca.js';
import { analizarReferencia } from '../aplicacion/referencias/analizarReferencia.js';
import { registrarReferencia } from '../aplicacion/referencias/registrarReferencia.js';
import { buscarTipografia } from '../aplicacion/tipografia/buscarTipografia.js';
import { cambiarEstadoDeTratamiento, crearTratamiento } from '../aplicacion/tipografia/crearTratamiento.js';
import { verificarTratamiento } from '../aplicacion/tipografia/verificarTratamiento.js';
import { RAIZ, type Config } from '../config.js';
import { Tokens } from '../dominio/diseno/intencion.js';
import { ErrorDeUsuario } from '../dominio/errores.js';
import { Marca } from '../dominio/modelos.js';
import { detallesFotograficos, detallesGraficos } from '../dominio/referencia.js';
import { idDesdeBrief } from '../dominio/tipografia/creacion.js';
import { ejemplosDelManual, manualDelLenguaje } from '../dominio/tipografia/manual.js';
import type { Estudio } from './estudio.js';

type Valores = Record<string, unknown>;
type Res = ResultadoHerramienta;

const texto = (v: Valores, k: string, porDefecto = '') => (typeof v[k] === 'string' ? (v[k] as string).trim() : porDefecto);
const numero = (v: Valores, k: string, porDefecto: number) => (Number.isFinite(Number(v[k])) && v[k] !== '' && v[k] !== undefined ? Number(v[k]) : porDefecto);
const exigir = (v: Valores, k: string, nombre: string) => {
  const x = texto(v, k);
  if (!x) throw new ErrorDeUsuario(`Falta ${nombre}.`);
  return x;
};
const slug = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const vacio = (): Res => ({ imagenes: [], lista: [], descargas: [] });

export interface DepsHerramientasChat {
  config: Config;
  estudio: Estudio;
  /** Genera una foto con Nano Banana Pro (el del chat, con el tope mensual). */
  generarFoto(o: { id: string; prompt: string; referencias: Array<{ ruta: string; etiqueta: string }>; tamano: '1K' | '2K' }): Promise<{ bytes: Buffer; costeUsd: number; modelo: string }>;
}

/** Lanza una orden de src/herramientas/ (como en la terminal) y devuelve lo que escribió. */
export function orden(guion: string, args: string[], alLinea?: (l: string) => void): Promise<string> {
  return new Promise((ok, mal) => {
    const p = spawn(process.execPath, ['--import', 'tsx', join(RAIZ, 'src', 'herramientas', `${guion}.ts`), ...args], { cwd: RAIZ, env: process.env });
    let salida = '';
    let errores = '';
    const leer = (b: Buffer) => {
      const t = b.toString();
      salida += t;
      for (const l of t.split('\n').map((x) => x.trim()).filter(Boolean)) alLinea?.(l);
    };
    p.stdout.on('data', leer);
    p.stderr.on('data', (b: Buffer) => {
      errores += b.toString();
      leer(b);
    });
    p.on('error', mal);
    p.on('close', (codigo) => (codigo === 0 ? ok(salida) : mal(new Error(`${guion}: ${(errores || salida).trim().split('\n').slice(-4).join(' · ').slice(0, 900) || `salió con ${codigo}`}`))));
  });
}

export function crearHerramientasChat(d: DepsHerramientasChat) {
  const datos = d.config.carpetaDatos;
  const activos = new AlmacenActivosFicheros(join(datos, 'locales'));
  const segmentador = new SegmentadorVision(RAIZ);
  const catalogo = new CatalogoTipografico(join(RAIZ, 'recursos', 'tipografias'));
  const carpetaEstilos = join(RAIZ, 'recursos', 'tratamientos');
  const modelos = [process.env.GEMINI_MODELO_ARTE ?? 'gemini-4-hydrogen', d.config.geminiModelo];
  const cliente = (motivo: string) => {
    if (!d.config.geminiApiKey) throw new ErrorDeUsuario('Falta GEMINI_API_KEY en .env.');
    return new ClienteGemini(d.config.geminiApiKey, modelos, { alUsar: registradorDeUso(datos, motivo, d.config.geminiFacturacion), tiempoMaximoMs: 300_000 });
  };

  /** Una imagen del chat como activo del local (para las órdenes que trabajan con activos). */
  const comoActivo = async (ctx: ContextoDeHerramienta, local: string, imagen: string, papel: string) => {
    const ruta = ctx.rutaImagen(imagen);
    const a = await registrarFotoGenerada(activos, segmentador, { local, id: `chat-${slug(ctx.trabajo.split('/').pop() ?? 'h')}-${papel}`, ruta, tipo: 'REAL', uso: 'SOLO_PRUEBA_COMPOSICION', descripcion: `Imagen del chat (${ctx.conversacion.id}) para una herramienta.` });
    return a.activo.id;
  };
  /** El original de un activo del local, copiado a la carpeta de la herramienta (y, si tiene, su recorte con la máscara). */
  const traerActivo = async (ctx: ContextoDeHerramienta, local: string, id: string, pie: string): Promise<Res['imagenes']> => {
    const a = await activos.obtener(local, id);
    const fuera: Res['imagenes'] = [{ archivo: await ctx.guardar(`${id}.png`, await sharp(a.ruta).png().toBuffer()), pie }];
    if (a.rutaMascara) {
      const recorte = await recortar(a.ruta, await readFile(a.rutaMascara));
      fuera.push({ archivo: await ctx.guardar(`${id}-recorte.png`, recorte), pie: `${pie} · recortado` });
    }
    return fuera;
  };
  const marcaDe = async (local: string) => Marca.parse(JSON.parse(await readFile(join(datos, 'locales', local, 'marca.json'), 'utf8')));
  const tokensDe = async (local: string) => Tokens.parse(JSON.parse(await readFile(join(RAIZ, 'marcas', local, 'tokens.json'), 'utf8')));

  /** El encargo del banco (para `arte` y `lote`) a partir de los hechos confirmados de la conversación. */
  const encargoDelBanco = async (ctx: ContextoDeHerramienta, conReferencia: boolean, fotografiar = false) => {
    const h = ctx.conversacion.hechos;
    if (!h) throw new ErrorDeUsuario('Confirma antes la ficha del plato.');
    const id = `chat-${slug(ctx.trabajo.split('/').pop() ?? 'x')}`;
    let referencia: string | undefined;
    const imagenRef = conReferencia ? h.referencia ?? ctx.conversacion.referencia : undefined;
    if (imagenRef) {
      const deps = await d.estudio.post();
      referencia = `${id}-ref`;
      if (!(await deps.referencias.referencias.existe(h.local, referencia))) {
        await registrarReferencia(deps.referencias, { local: h.local, id: referencia, imagen: ctx.rutaImagen(imagenRef), nota: `Referencia del chat ${ctx.conversacion.id}.` });
        if (deps.analista) await analizarReferencia({ ...deps.referencias, analista: deps.analista }, { local: h.local, id: referencia }).catch(() => undefined);
      }
    }
    let activo = h.activoReal;
    if (fotografiar) {
      const fuente = await activos.obtener(h.local, h.activoReal);
      const marca = await marcaDe(h.local);
      const prompt = promptFinal({ tipo: 'plato', conPlato: true, prompt: 'Photograph the dish from a new three-quarter camera position with tactile local detail and clear separation around its silhouette.' }, marca);
      await ctx.progreso('Se fotografía el plato para las direcciones de arte.');
      const toma = await d.generarFoto({ id: id + '-toma', prompt, referencias: [{ ruta: fuente.ruta, etiqueta: 'Product identity reference' }], tamano: '2K' });
      await exigirTomaNueva(toma.bytes, [fuente.ruta, ...(imagenRef ? [ctx.rutaImagen(imagenRef)] : [])]);
      const archivo = await ctx.guardar('toma.png', await sharp(toma.bytes).png().toBuffer());
      const nueva = await registrarFotoGenerada(activos, segmentador, { local: h.local, id: id + '-toma', ruta: join(ctx.carpeta, archivo),
        descripcion: 'Toma nueva para las direcciones de arte', modelo: toma.modelo, prompt, referencias: [{ activo: h.activoReal, sha256: fuente.activo.sha256 }] });
      activo = nueva.activo.id;
    }
    const banco = { id, local: h.local, activo, plato: h.plato, elementos: h.elementos, mensaje: h.mensaje, creativo: true, ...(referencia ? { referencia } : {}) };
    const carpeta = join(ctx.carpeta, ctx.trabajo, 'banco');
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, `${id}.json`), `${JSON.stringify(banco, null, 2)}\n`);
    return { id, carpeta, archivo: join(carpeta, `${id}.json`) };
  };

  const ejecutores: Record<string, (ctx: ContextoDeHerramienta, v: Valores) => Promise<Res>> = {
    // ---------------------------------------------------------------- Crear
    async direcciones(ctx, v) {
      const b = await encargoDelBanco(ctx, v.referencia !== false, true);
      const corrida = `chat-${ctx.conversacion.id}`;
      await ctx.progreso('El director propone las direcciones; el código las pinta y el crítico las puntúa…');
      const args = [b.archivo, '--corrida', corrida, '--direcciones', String(numero(v, 'direcciones', 2)), '--vueltas', String(numero(v, 'vueltas', 1))];
      if (v.enriquecer === true) args.push('--enriquecer');
      await orden('arte', args, (l) => {
        if (/^(·|■|✖|  crítica|  comparación|  arreglo)/.test(l)) void ctx.progreso(l.slice(0, 200));
      });
      const salida = join(datos, 'arte', corrida, b.id);
      const imagenes: Res['imagenes'] = [];
      for (const nombre of ['hoja.jpg', 'enriquecida.jpg', 'enriquecida-1.jpg']) {
        if (existsSync(join(salida, nombre))) imagenes.push({ archivo: await ctx.guardar(nombre, await readFile(join(salida, nombre))), pie: nombre.startsWith('hoja') ? 'Hoja de direcciones' : 'Con acabado' });
      }
      const informe = existsSync(join(salida, 'informe.md')) ? await readFile(join(salida, 'informe.md'), 'utf8') : '';
      return { ...vacio(), imagenes, texto: informe.slice(0, 4000) || 'Direcciones terminadas.' };
    },

    async lote(ctx, v) {
      const b = await encargoDelBanco(ctx, true);
      const corrida = `chat-${ctx.conversacion.id}-${slug(ctx.trabajo.split('/').pop() ?? '')}`;
      await ctx.progreso('Hydrogen planifica el lote: tres posts de tipos distintos y un carrusel…');
      await orden('lote', ['plan', b.archivo, '--corrida', corrida]);
      const carpeta = join(datos, 'arte', corrida, b.id);
      const pedidos = JSON.parse(await readFile(join(carpeta, 'pedidos.json'), 'utf8')) as Array<{ id: string; prompt: string; referencia?: string }>;
      await mkdir(join(carpeta, 'generadas'), { recursive: true });
      for (const [i, p] of pedidos.entries()) {
        await ctx.progreso(`Foto nueva ${i + 1} de ${pedidos.length} (Nano Banana Pro)…`);
        const r = await d.generarFoto({ id: `${corrida}-${p.id}`, prompt: p.prompt, referencias: p.referencia ? [{ ruta: p.referencia, etiqueta: 'image1: the real dish' }] : [], tamano: '2K' });
        await sharp(r.bytes).png().toFile(join(carpeta, 'generadas', `${p.id}.png`));
        await writeFile(join(carpeta, 'generadas', `${p.id}.json`), `${JSON.stringify({ modelo: r.modelo, trabajo: p.id, prompt: p.prompt })}\n`);
      }
      await ctx.progreso('El estudio de arte maqueta cada pieza (y Hydrogen repara lo que no cabe)…');
      await orden('lote', ['componer', '--corrida', corrida, '--encargos', b.id, '--banco', b.carpeta]);
      const imagenes: Res['imagenes'] = [{ archivo: await ctx.guardar('hoja.jpg', await readFile(join(carpeta, 'hoja.jpg'))), pie: 'El lote' }];
      for (const sub of ['posts', 'carruseles']) {
        const dir = join(carpeta, sub);
        if (!existsSync(dir)) continue;
        for (const x of (await readdir(dir, { recursive: true })).filter((n) => String(n).endsWith('.png')).sort()) imagenes.push({ archivo: await ctx.guardar(`${sub}-${String(x).replace(/\//g, '-')}`, await readFile(join(dir, String(x)))), pie: String(x).replace(/\.png$/, '') });
      }
      let textoFinal = `${pedidos.length} fotos nuevas y ${imagenes.length - 1} piezas.`;
      if (v.evaluar !== false) {
        await ctx.progreso('Auditoría estética del lote…');
        await orden('lote', ['evaluar', '--corrida', corrida, '--banco', b.carpeta]);
        const ev = JSON.parse(await readFile(join(carpeta, 'evaluacion.json'), 'utf8')) as { veredicto: string; piezas: Array<{ id: string; nivel: number; comentario: string }> };
        const media = ev.piezas.length ? ev.piezas.reduce((a, p) => a + p.nivel, 0) / ev.piezas.length : 0;
        textoFinal += `\n\n**Auditoría: ${media.toFixed(1)}/4.** ${ev.veredicto}`;
        return { ...vacio(), imagenes, texto: textoFinal, lista: ev.piezas.map((p) => ({ titulo: `${p.id} · ${p.nivel}/4`, detalle: p.comentario })) };
      }
      return { ...vacio(), imagenes, texto: textoFinal };
    },

    async auditoria(ctx, v) {
      const ids = Array.isArray(v.piezas) ? (v.piezas as string[]) : typeof v.piezas === 'string' ? [v.piezas] : ctx.conversacion.piezas.filter((p) => p.estado === 'LISTA').map((p) => p.id);
      const imagenes = ids.flatMap((p) => ctx.diapositivasDe(p).map((ruta, i) => ({ ruta, id: `${p}-${i + 1}` })));
      if (!imagenes.length) throw new ErrorDeUsuario('No hay piezas terminadas que auditar.');
      const ancho = 300;
      const columnas = Math.min(5, imagenes.length);
      const filas = Math.ceil(imagenes.length / columnas);
      const capas = await Promise.all(imagenes.map(async (x, i) => ({ input: await sharp(x.ruta).resize(ancho, 400, { fit: 'contain', background: '#ddd' }).png().toBuffer(), left: 10 + (i % columnas) * (ancho + 10), top: 10 + Math.floor(i / columnas) * 410 })));
      const hoja = join(ctx.carpeta, ctx.trabajo, 'hoja.jpg');
      await sharp({ create: { width: columnas * (ancho + 10) + 10, height: filas * 410 + 10, channels: 3, background: '#f2f2f2' } }).composite(capas).jpeg({ quality: 86 }).toFile(hoja);
      await ctx.progreso('Hydrogen audita las piezas a tamaño de móvil…');
      const h = ctx.conversacion.hechos;
      const marca = h ? await marcaDe(h.local) : undefined;
      const ev = await new EstudioArteGemini(cliente('chat/auditoria'), modelos).evaluarLote(hoja, imagenes.map((x) => x.id), marca ? `Restaurante: ${marca.nombre} (${marca.ciudad}). ${marca.descripcion}` : 'Piezas de Instagram de un restaurante.');
      const media = ev.piezas.length ? ev.piezas.reduce((a, p) => a + p.nivel, 0) / ev.piezas.length : 0;
      return {
        ...vacio(),
        imagenes: [{ archivo: `${ctx.trabajo}/hoja.jpg`, pie: 'Lo que se auditó' }],
        texto: `**${media.toFixed(1)}/4 · ${ev.pareceFeedProfesional ? 'parece un feed profesional' : 'aún no parece un feed profesional'}.** ${ev.veredicto}\n\n**Fortalezas:** ${ev.fortalezas.join(' · ')}\n\n**Debilidades:** ${ev.debilidades.join(' · ')}`,
        lista: ev.piezas.map((p) => ({ titulo: `${p.id} · ${p.nivel}/4`, detalle: p.comentario })),
      };
    },

    async 'foto-nueva'(ctx, v) {
      const prompt = exigir(v, 'prompt', 'la descripción de la foto');
      const imagen = texto(v, 'imagen');
      const h = ctx.conversacion.hechos;
      const marca = h ? await marcaDe(h.local) : undefined;
      const final = promptFinal({ tipo: 'plato', prompt, conPlato: Boolean(imagen) }, marca ? { nombre: marca.nombre, ciudad: marca.ciudad, descripcion: marca.descripcion } : { nombre: 'el restaurante', ciudad: '', descripcion: 'Un restaurante' });
      await ctx.progreso('Nano Banana Pro hace la foto…');
      const r = await d.generarFoto({ id: `chat-${slug(ctx.trabajo.split('/').pop() ?? 'f')}`, prompt: final, referencias: imagen ? [{ ruta: ctx.rutaImagen(imagen), etiqueta: 'image1: the real dish' }] : [], tamano: '2K' });
      if (imagen) await exigirTomaNueva(r.bytes, [ctx.rutaImagen(imagen)]);
      const archivo = await ctx.guardar('foto.png', await sharp(r.bytes).png().toBuffer());
      await ctx.anadirImagen(join(ctx.carpeta, archivo), 'foto-nueva.png');
      return { ...vacio(), imagenes: [{ archivo, pie: `Nano Banana Pro · ${r.costeUsd.toFixed(3)} USD` }], texto: 'Queda en la conversación para usarla en otras herramientas o piezas.' };
    },

    // ---------------------------------------------------------------- Fotos
    async recorte(ctx, v) {
      const ruta = ctx.rutaImagen(exigir(v, 'imagen', 'la foto'));
      await ctx.progreso('Apple Vision busca el sujeto…');
      const mascara = await segmentador.mascara(ruta);
      const recorte = await recortar(ruta, mascara);
      const archivo = await ctx.guardar('recorte.png', recorte);
      await ctx.anadirImagen(join(ctx.carpeta, archivo), 'recorte.png');
      return { ...vacio(), imagenes: [{ archivo, pie: 'Recortado (PNG transparente)' }, { archivo: await ctx.guardar('mascara.png', await sharp(mascara).png().toBuffer()), pie: 'Máscara' }] };
    },

    async 'combinar-luz'(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const real = await comoActivo(ctx, local, exigir(v, 'real', 'la foto real'), 'real');
      const luz = await comoActivo(ctx, local, exigir(v, 'luz', 'la foto con la luz'), 'luz');
      const detalle = await comoActivo(ctx, local, exigir(v, 'detalle', 'la foto con el detalle'), 'detalle');
      // La regla de la orden: solo se combinan fotos con veredicto de fidelidad CONSERVA. El veredicto es tuyo.
      if (v.conservan !== true) throw new ErrorDeUsuario('Marca que las dos fotos conservan el plato de la real (o compruébalo antes con «Comprobar fidelidad»).');
      for (const id of [luz, detalle]) await orden('fidelidad', ['--local', local, '--generado', id, '--real', real, '--veredicto', 'CONSERVA', '--nota', 'Confirmado en el chat por quien lo lanzó.']);
      const id = `chat-${slug(ctx.trabajo.split('/').pop() ?? 'c')}-combinada`;
      await orden('combinarLuz', ['--local', local, '--id', id, '--luz', luz, '--detalle', detalle, '--relleno', String(numero(v, 'relleno', 0.3)), '--descripcion', 'Combinación de luz y detalle desde el chat.']);
      return { ...vacio(), imagenes: await traerActivo(ctx, local, id, 'Luz de una, detalle de otra') };
    },

    async detalle(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const imagen = exigir(v, 'imagen', 'la foto');
      const desde = await comoActivo(ctx, local, imagen, 'fuente');
      const meta = await sharp(ctx.rutaImagen(imagen)).metadata();
      const [x, y, w, h] = texto(v, 'recorte', '0.4,0.4,0.2,0.2').split(',').map(Number);
      if (![x, y, w, h].every((n) => Number.isFinite(n) && n! >= 0 && n! <= 1)) throw new ErrorDeUsuario('La zona son cuatro fracciones entre 0 y 1: x, y, ancho, alto.');
      const px = [x! * meta.width!, y! * meta.height!, w! * meta.width!, h! * meta.height!].map((n) => Math.max(1, Math.round(n)));
      const id = `chat-${slug(ctx.trabajo.split('/').pop() ?? 'd')}-detalle`;
      await orden('extraerDetalle', ['--local', local, '--id', id, '--desde', desde, '--recorte', px.join(','), '--canal', texto(v, 'canal', 'g'), '--desde-valor', String(numero(v, 'desde', 120)), '--hasta-valor', String(numero(v, 'hasta', 255)), '--descripcion', 'Detalle extraído desde el chat.']);
      return { ...vacio(), imagenes: await traerActivo(ctx, local, id, 'Detalle') };
    },

    async fidelidad(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const real = await comoActivo(ctx, local, exigir(v, 'real', 'la foto real'), 'real');
      const generada = await comoActivo(ctx, local, exigir(v, 'generada', 'la foto generada'), 'generada');
      const salida = await orden('fidelidad', ['--local', local, '--generado', generada, '--real', real]);
      const hoja = /Hoja: (.+\.jpg)/.exec(salida)?.[1]?.trim();
      const medida = /correlación de bordes ([\d.,-]+)/.exec(salida)?.[1];
      return {
        ...vacio(),
        imagenes: hoja && existsSync(hoja) ? [{ archivo: await ctx.guardar('fidelidad.jpg', await readFile(hoja)), pie: 'Real | generada, por zonas' }] : [],
        texto: medida ? `Correlación de bordes dentro del producto: **${medida}** (1 = idénticos). La medida avisa; el veredicto lo das tú mirando los recortes.` : salida.slice(-600),
      };
    },

    async degradar(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const desde = await comoActivo(ctx, local, exigir(v, 'imagen', 'la foto'), 'buena');
      const id = `chat-${slug(ctx.trabajo.split('/').pop() ?? 'g')}-degradada`;
      await orden('degradarFoto', ['--local', local, '--desde', desde, '--id', id]);
      const imagenes = await traerActivo(ctx, local, id, 'Como la subiría alguien con prisa');
      await ctx.anadirImagen(join(ctx.carpeta, imagenes[0]!.archivo), 'degradada.png');
      return { ...vacio(), imagenes };
    },

    async papel(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const id = `chat-${slug(ctx.trabajo.split('/').pop() ?? 'p')}-papel`;
      await orden('papelRasgado', ['--local', local, '--id', id, '--color', texto(v, 'color', '#141414'), '--fibra', texto(v, 'fibra', '#5a5550'), '--semilla', String(numero(v, 'semilla', 7))]);
      return { ...vacio(), imagenes: await traerActivo(ctx, local, id, 'Papel rasgado') };
    },

    // ---------------------------------------------------------------- Tipografía
    async 'muestras-tipo'(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const base = join(datos, 'disenos', 'muestras-tipograficas');
      const antes = new Set(existsSync(base) ? await readdir(base) : []);
      await ctx.progreso('Pintando cada estilo con el compositor…');
      await orden('muestrasTipograficas', ['--locales', local, '--texto', texto(v, 'texto', 'Croquetas')]);
      const nuevas = (existsSync(base) ? await readdir(base) : []).filter((x) => !antes.has(x));
      const imagenes: Res['imagenes'] = [];
      for (const carpeta of nuevas) {
        for (const f of (await readdir(join(base, carpeta), { recursive: true })).map(String).filter((x) => /\.(png|jpe?g)$/.test(x)).sort()) imagenes.push({ archivo: await ctx.guardar(`${carpeta}-${f.replace(/\//g, '-')}`, await readFile(join(base, carpeta, f))), pie: f.replace(/\.(png|jpe?g)$/, '') });
      }
      return { ...vacio(), imagenes, ...(imagenes.length ? {} : { texto: 'No salió ninguna hoja.' }) };
    },

    async 'buscar-tipo'(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const h = ctx.conversacion.hechos?.local === local ? ctx.conversacion.hechos : undefined;
      const recetas = new BibliotecaTratamientosFicheros(carpetaEstilos).listar();
      const fondo = texto(v, 'fondo');
      const lista = buscarTipografia({
        marca: await marcaDe(local),
        tokens: await tokensDe(local),
        catalogo,
        recetas,
        plato: { texto: texto(v, 'plato') || h?.plato || '', elementos: h?.elementos ?? [] },
        rol: (['titular', 'secundario', 'apoyo'] as const).find((x) => x === v.rol) ?? 'titular',
        ...(fondo === 'claro' || fondo === 'oscuro' ? { fondo } : {}),
      });
      const aptos = lista.filter((c) => c.apto);
      return {
        ...vacio(),
        texto: aptos.length ? `El que mejor casa: **${aptos[0]!.nombre}**. Si ninguno se justifica con el material o la identidad, lo mejor es no usar tipografía especial.` : 'Ninguno: no hay un estilo que se justifique con este local y este plato. Mejor sin tipografía especial (o crea uno).',
        lista: lista.slice(0, 6).map((c) => ({ titulo: `${c.nombre} · ${c.apto ? `${c.puntuacion} puntos` : 'no apto'}`, detalle: c.razones.join(' · ') })),
      };
    },

    async 'crear-estilo'(ctx, v) {
      const brief = exigir(v, 'brief', 'el brief');
      const palabra = texto(v, 'palabra', 'Croquetas');
      const local = texto(v, 'local');
      const biblioteca = new BibliotecaTratamientosFicheros(carpetaEstilos);
      let id = idDesdeBrief(brief);
      for (let n = 2; existsSync(join(carpetaEstilos, id)); n++) id = `${idDesdeBrief(brief).slice(0, 36)}-${n}`;
      const marca = local ? leerMarcaDeMuestra(join(RAIZ, 'marcas'), datos, local) : undefined;
      const ia = new TipografiaGemini(cliente('chat/crear-estilo'));
      const r = await crearTratamiento(
        {
          disenador: ia,
          critico: ia,
          verificar: (candidata, peticion) => verificarTratamiento(candidata, peticion, { pintor: new PintorDeMuestrasSharp(catalogo), lector: new LectorAppleVision() }),
          contexto: { manual: manualDelLenguaje(), ejemplos: ejemplosDelManual(biblioteca.listar()) },
          carpeta: carpetaEstilos,
          carpetaTrabajo: join(datos, 'tratamientos-en-prueba'),
          ahora: () => new Date().toISOString(),
          alProgresar: (l) => void ctx.progreso(l),
        },
        { texto: brief, id, palabra },
        { palabra, ...(marca ? { marca } : {}) },
      );
      biblioteca.olvidar();
      const imagenes: Res['imagenes'] = r.hoja ? [{ archivo: await ctx.guardar('hoja.png', await readFile(r.hoja)), pie: `Hoja de muestras · ${id}` }] : [];
      return {
        ...vacio(),
        imagenes,
        texto: r.guardado ? `**«${id}» creado y guardado en PRUEBA.** Apruébalo con «Aprobar o retirar un estilo» si te convence.` : `No pasó en ${r.rondas.length} rondas: no se guarda. Prueba con un brief más concreto.`,
        lista: r.rondas.map((x) => ({ titulo: `Ronda ${x.n} · ${x.pasa ? 'pasa las medidas' : 'no pasa'}${x.critica ? ` · crítica: ${x.critica.veredicto}` : ''}`, detalle: [x.resumen, x.critica?.parece ? `Parece: ${x.critica.parece}` : '', ...x.problemas.slice(0, 3)].filter(Boolean).join(' · ') })),
      };
    },

    async 'aprobar-estilo'(_ctx, v) {
      const id = exigir(v, 'estilo', 'el estilo');
      const estado = v.estado === 'RETIRADO' ? 'RETIRADO' : 'APROBADO';
      const r = await cambiarEstadoDeTratamiento(carpetaEstilos, id, estado, 'estudio (web)', new Date().toISOString());
      return { ...vacio(), texto: `«${r.id}» queda **${r.estado}**.` };
    },

    // ---------------------------------------------------------------- Referencias
    async 'referencia-biblioteca'(ctx, v) {
      const post = exigir(v, 'referencia', 'la referencia');
      if (!/^post-\d{2}$/.test(post)) throw new ErrorDeUsuario('Elige una referencia de la biblioteca.');
      const ruta = join(d.config.carpetaBiblioteca, 'referencias', `${post}.jpg`);
      if (!existsSync(ruta)) throw new ErrorDeUsuario(`No encuentro la imagen de ${post}.`);
      const imagen = await ctx.anadirImagen(ruta, `${post}.jpg`);
      await ctx.usarReferencia(imagen);
      return { ...vacio(), imagenes: [{ archivo: await ctx.guardar(`${post}.jpg`, await readFile(ruta)), pie: post }], texto: 'Es la referencia de la conversación: las próximas piezas la tomarán como listón (sin copiarla).' };
    },

    async 'analizar-referencia'(ctx, v) {
      const local = exigir(v, 'local', 'el local');
      const imagen = exigir(v, 'imagen', 'la imagen');
      const deps = await d.estudio.post();
      if (!deps.analista) throw new ErrorDeUsuario('El analista de referencias no está disponible (falta GEMINI_API_KEY).');
      const id = `ref-chat-${createHash('sha1').update(ctx.trabajo).digest('hex').slice(0, 8)}`;
      await registrarReferencia(deps.referencias, { local, id, imagen: ctx.rutaImagen(imagen), nota: `Desde el chat (${ctx.conversacion.id}).` });
      await ctx.progreso('El analista mira la referencia…');
      const r = await analizarReferencia({ ...deps.referencias, analista: deps.analista }, { local, id });
      if (v.usar !== false) await ctx.usarReferencia(imagen);
      const f = r.ficha;
      return {
        ...vacio(),
        texto: f ? `**${f.titulo}** · familia ${f.familia}. Retícula: ${f.reticula}.` : 'La referencia quedó registrada, pero no se pudo fichar.',
        lista: f
          ? [
              { titulo: 'Capas (del fondo al frente)', detalle: f.capas.join(' → ') },
              ...detallesGraficos(f.relacionesGraficas ?? []),
              ...(f.lecturaFotografica ? detallesFotograficos(f.lecturaFotografica) : [{ titulo: 'Fotografía', detalle: f.foto }]),
              ...(f.mecanismos.length ? [{ titulo: 'Recursos', detalle: f.mecanismos.join(', ') }] : []),
              ...f.tipografia.map((t) => ({ titulo: `Letra · ${t.rol.toLowerCase()}`, detalle: t.clasificacion })),
              { titulo: 'Guardada como', detalle: `${local} · ${id}` },
            ]
          : [],
      };
    },

    // ---------------------------------------------------------------- Local
    async 'nuevo-local'(_ctx, v) {
      const nombre = exigir(v, 'nombre', 'el nombre');
      const colores = texto(v, 'colores').split(',').map((x) => x.trim()).filter((x) => /^#[0-9a-f]{6}$/i.test(x));
      const marca = Marca.parse({
        slug: slug(nombre),
        nombre,
        ciudad: exigir(v, 'ciudad', 'la ciudad'),
        descripcion: texto(v, 'descripcion'),
        tonos: texto(v, 'tonos', 'cercano').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5),
        colores: colores.map((hex, i) => ({ nombre: `Color ${i + 1}`, hex })),
        tipografias: texto(v, 'titulos') ? [{ rol: 'TITULOS', descripcion: texto(v, 'titulos') }] : [],
        ...(texto(v, 'instagram') ? { instagram: texto(v, 'instagram') } : {}),
      });
      const local = await crearLocal(d.estudio.deps(), marca);
      const preparada = await prepararMarca({ raiz: RAIZ, proveedor: new GoogleFontsGithub(), hoy: () => new Date().toISOString().slice(0, 10) }, local);
      return { ...vacio(), texto: `**${local.nombre}** dado de alta (${local.slug}).${preparada.creados ? ` Tokens creados${preparada.fuentes.length ? ` y fuentes descargadas: ${preparada.fuentes.join(', ')}` : ''}.` : ''}` };
    },

    async gasto() {
      const imagenes = await gastoAcumuladoGemini(join(datos, 'gasto', 'gemini.jsonl'));
      const mes = new Date().toISOString().slice(0, 7);
      let texto = 0;
      const ruta = join(datos, 'gasto', 'gemini-texto.jsonl');
      if (existsSync(ruta)) {
        for (const l of (await readFile(ruta, 'utf8')).split('\n')) {
          if (!l.trim()) continue;
          const x = JSON.parse(l) as { fecha?: string; tier?: string; modelo?: string; tokensEntrada?: number; tokensSalida?: number; tokensRazonamiento?: number };
          if (x.tier !== 'PAGO' || !x.fecha?.startsWith(mes)) continue;
          // Hydrogen: 1,50 USD/M de entrada y 7,50 USD/M de salida (razonamiento incluido).
          texto += (x.tokensEntrada ?? 0) * 1.5e-6 + ((x.tokensSalida ?? 0) + (x.tokensRazonamiento ?? 0)) * 7.5e-6;
        }
      }
      return { ...vacio(), texto: `**Imágenes de Gemini este mes:** ${imagenes.toFixed(2)} de ${d.config.geminiTopeUsd.toFixed(2)} USD (tope mensual).\n\n**Texto (Hydrogen) este mes:** ≈ ${texto.toFixed(2)} USD.` };
    },
  };

  return {
    async ejecutar(herramienta: string, ctx: ContextoDeHerramienta, valores: Valores): Promise<Res> {
      const f = ejecutores[herramienta];
      if (!f) throw new ErrorDeUsuario(`La herramienta «${herramienta}» no tiene quién la ejecute.`);
      return f(ctx, valores);
    },
    /** Para los selectores de la web: la biblioteca de referencias y los estilos de tipografía especial. */
    async biblioteca() {
      const deps = await d.estudio.post();
      const familias = await deps.referencias.biblioteca.familias().catch(() => []);
      return familias.map((f) => ({ id: f.id, nombre: f.nombre, posts: f.posts }));
    },
    estilos() {
      return new BibliotecaTratamientosFicheros(carpetaEstilos).listar({ conRetiradas: true }).map((r) => ({ id: r.id, nombre: (r as { nombre?: string }).nombre ?? r.id, identidades: r.ficha?.identidades ?? [], estado: r.estado, hoja: existsSync(join(carpetaEstilos, r.id, 'hoja.png')) }));
    },
    rutaHojaDeEstilo: (id: string) => join(carpetaEstilos, id.replace(/[^a-z0-9-]/g, ''), 'hoja.png'),
    rutaDeBiblioteca: (post: string) => join(d.config.carpetaBiblioteca, 'referencias', `${post.replace(/[^a-z0-9-]/g, '')}.jpg`),
  };
}

/** El sujeto con su máscara, en PNG transparente y recortado a su caja. */
async function recortar(ruta: string, mascara: Buffer): Promise<Buffer> {
  const meta = await sharp(ruta).metadata();
  const alfa = await sharp(mascara).resize(meta.width, meta.height, { fit: 'fill' }).extractChannel(0).toBuffer();
  return sharp(await sharp(ruta).rotate().removeAlpha().joinChannel(alfa).png().toBuffer()).trim({ threshold: 1 }).png().toBuffer();
}

void stat;
void copyFile;
