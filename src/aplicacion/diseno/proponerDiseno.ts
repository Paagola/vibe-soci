/**
 * F3 · El director escribe la intención de diseño (antes la escribía una persona).
 *
 *   foto confirmada ─► mapa de la foto (código, sin visión) ─► propuesta del director (dialecto corto)
 *   ─► comprobación de los textos frente a los hechos ─► compilación a intención ─► prueba en el compositor
 *   ─► si algo falla, se le devuelve UNA vez con los problemas.
 *
 * Decide el código, no el modelo: lo que no se puede comprobar no se le pide, y lo que se puede, se comprueba.
 */
import { contraste, croma, type ColorDominante } from '../../dominio/diseno/color.js';
import { Intencion, type EstiloTexto, type Tokens } from '../../dominio/diseno/intencion.js';
import type { MapaDeFoto } from '../../dominio/diseno/mapaDeFoto.js';
import { compilarIntencion, palabrasDeLaFicha, problemasDeTextos, type HechosDeLaPieza, type PropuestaDeDiseno } from '../../dominio/diseno/propuesta.js';
import type { FichaReferencia } from '../../dominio/referencia.js';
import { describirProblemas } from '../../dominio/validacion.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { ColorDisponible, DirectorDeDiseno, EncargoDeDiseno, MedidorDeFoto, VozDisponible } from '../../puertos/DirectorDeDiseno.js';

/** Lo que dice el compositor al probar una intención: los ERROR impiden usarla; los AVISO se le devuelven al director una vez. */
export interface PruebaDeIntencion {
  errores: string[];
  avisos: string[];
}

export interface DepsProponerDiseno {
  director: DirectorDeDiseno;
  medidor: MedidorDeFoto;
  /** Resuelve (y pinta en borrador) la intención y devuelve sus problemas. Sin ella, solo se comprueba el esquema. */
  probar?: (intencion: Intencion) => Promise<PruebaDeIntencion>;
  /** Cómo es una fuente del catálogo («grotesca ultracondensada…»), para describirle las voces al director. */
  describirFuente?: (fuente: string) => string;
}

export interface EntradaDiseno {
  id: string;
  version: number;
  titulo: string;
  /** Slug del local. */
  marca: string;
  /** La foto nueva confirmada, con su máscara si la tiene. */
  foto: ActivoDisponible;
  hechos: HechosDeLaPieza;
  tokensMarca: Tokens;
  referencia?: { id: string; ficha?: FichaReferencia; imagen?: string };
  titularCreativo?: boolean;
}

export interface ResultadoDiseno {
  propuesta?: PropuestaDeDiseno;
  /** La intención compilada (válida con su esquema) o undefined si la propuesta no se pudo compilar. */
  intencion?: Intencion;
  /** Lo que sigue impidiendo usar la intención tras el reintento. Vacío = se puede componer. */
  problemas: string[];
  /** Avisos de oficio que quedan (no impiden componer; se apuntan para que los veas). */
  avisos: string[];
  intentos: Array<{ problemas: string[]; avisos: string[] }>;
  mapa: MapaDeFoto;
}

/** Voz que el estudio añade si la marca no la tiene: la manuscrita corta de las anotaciones (INVESTIGACION.md §3.1, voces). */
const VOZ_ANOTACION = 'anotacion';

/** Los avisos que no dependen del director (la foto o los activos): no se le devuelven. */
const AVISOS_AJENOS = /^(ACTIVO|FIDELIDAD|RESOLUCION):/;

export const MAX_PROPUESTAS = 2;

export async function proponerDiseno(deps: DepsProponerDiseno, entrada: EntradaDiseno): Promise<ResultadoDiseno> {
  const mapa = await deps.medidor.medir(entrada.foto);
  const { colores, coloresMedidos } = coloresDisponibles(entrada.tokensMarca, mapa);
  const { voces, vocesDeEstudio } = vocesDisponibles(entrada.tokensMarca, colores, deps.describirFuente);
  const encargo: EncargoDeDiseno = {
    hechos: entrada.hechos,
    ...(entrada.referencia ? { referencia: entrada.referencia } : {}),
    foto: entrada.foto.ruta,
    mapa,
    colores,
    voces,
    titularCreativo: entrada.titularCreativo ?? false,
  };
  const contexto = {
    id: entrada.id,
    version: entrada.version,
    titulo: entrada.titulo,
    marca: entrada.marca,
    foto: entrada.foto.activo.id,
    tieneMascara: Boolean(entrada.foto.rutaMascara),
    colores: Object.fromEntries(colores.map((c) => [c.token, c.hex])),
    voces: voces.map((v) => v.id),
    vocesDeEstudio,
    coloresMedidos,
    conReferencia: Boolean(entrada.referencia),
  };
  const palabrasDeReferencia = entrada.referencia?.ficha ? palabrasDeLaFicha(entrada.referencia.ficha) : [];

  const intentos: ResultadoDiseno['intentos'] = [];
  let devolver: string[] = [];
  let ultimo: Omit<ResultadoDiseno, 'intentos' | 'mapa'> = { problemas: [], avisos: [] };
  for (let n = 1; n <= MAX_PROPUESTAS; n++) {
    const propuesta = await deps.director.proponer(encargo, devolver);
    const problemas = [...problemasDeTextos(propuesta.textos, entrada.hechos, { titularCreativo: encargo.titularCreativo, palabrasDeReferencia })];
    const compilada = compilarIntencion(propuesta, contexto);
    problemas.push(...compilada.problemas);
    let intencion: Intencion | undefined;
    let avisos: string[] = [];
    if (compilada.problemas.length === 0) {
      const leida = Intencion.safeParse(compilada.intencion);
      if (!leida.success) problemas.push(...describirProblemas(leida.error).map((p) => `La intención compilada no es válida: ${p}`));
      else {
        intencion = leida.data;
        // Solo se pinta lo que ya pasa las comprobaciones del dominio: pintar cuesta segundos y no cambia el veredicto.
        if (deps.probar && problemas.length === 0) {
          const prueba = await deps.probar(intencion);
          problemas.push(...prueba.errores);
          avisos = prueba.avisos;
        }
        const aviso = avisoDeCruce(propuesta, contexto.tieneMascara);
        if (aviso) avisos = [...avisos, aviso];
      }
    }
    intentos.push({ problemas, avisos });
    ultimo = { propuesta, ...(intencion ? { intencion } : {}), problemas, avisos };
    // Los avisos de oficio se le devuelven una vez: si en el segundo intento quedan, se apuntan y se compone igual.
    const devolubles = avisos.filter((a) => !AVISOS_AJENOS.test(a));
    if (problemas.length === 0 && (devolubles.length === 0 || n === MAX_PROPUESTAS)) break;
    devolver = [...problemas, ...devolubles.map((a) => `(aviso de oficio) ${a}`)];
  }
  return { ...ultimo, intentos, mapa };
}

/**
 * El compositor solo mide el cruce que se le pide: si todos los textos van «aparte», no avisa de nada aunque la pieza sea
 * el titular encima y la foto debajo, que es justo lo que delata una plantilla (INVESTIGACION.md §3.1, relación «cruza»).
 * La primera prueba real (14/11) salió así. Es un aviso: se devuelve una vez y no impide componer.
 */
export function avisoDeCruce(p: PropuestaDeDiseno, tieneMascara: boolean): string | undefined {
  if (!tieneMascara) return undefined;
  const tocan = p.capas.some((c) => (c.tipo === 'texto' && c.relacion !== 'aparte') || c.tipo === 'anotacion' || (c.tipo === 'patron' && c.motivo === 'palabra'));
  if (tocan) return undefined;
  return 'CRUCE: ningún texto se relaciona con el plato (todos van «aparte»): titular y foto quedan como dos bloques apilados. Prueba «detras», «delante» o «contorno» en el titular, o una anotación que señale algo del plato; si es a propósito, dilo en la idea.';
}

/**
 * Los colores de la marca y, medidos en la foto, el del plato (el acento que «sale de la comida») y el que domina la
 * foto (para que un fondo liso continúe la foto). Un color medido que casi repite uno de la marca no se añade.
 */
export function coloresDisponibles(marca: Tokens, mapa: MapaDeFoto): { colores: ColorDisponible[]; coloresMedidos: Record<string, string> } {
  const colores: ColorDisponible[] = Object.entries(marca.colores).map(([token, hex]) => ({ token, hex: hex.toUpperCase(), papel: 'de la marca' }));
  const coloresMedidos: Record<string, string> = {};
  const parecido = (hex: string) => colores.some((c) => contraste(c.hex, hex) < 1.15);
  const anadir = (token: string, hex: string | undefined, papel: string) => {
    if (!hex || token in marca.colores || parecido(hex)) return;
    colores.push({ token, hex: hex.toUpperCase(), papel });
    coloresMedidos[token] = hex.toUpperCase();
  };
  anadir('plato', mapa.vivo, 'medido: el color más vivo del plato');
  const dominante: ColorDominante | undefined = mapa.paleta[0];
  anadir('foto', dominante?.hex, `medido: el que domina la foto (${Math.round((dominante?.peso ?? 0) * 100)} %)${dominante && croma(dominante.hex) < 0.04 ? ', casi neutro' : ''}`);
  return { colores, coloresMedidos };
}

/** Las voces de la marca y, si no la tiene, una manuscrita corta del estudio para las anotaciones. */
export function vocesDisponibles(
  marca: Tokens,
  colores: ColorDisponible[],
  describirFuente: (fuente: string) => string = (f) => f,
): { voces: VozDisponible[]; vocesDeEstudio: Record<string, EstiloTexto> } {
  const describir = (e: EstiloTexto) =>
    [
      describirFuente(e.fuente),
      Object.entries(e.ejes).map(([k, v]) => `${k} ${v}`).join(', '),
      e.caso === 'mayusculas' ? 'en mayúsculas' : '',
      e.tracking >= 0.08 ? 'espaciada' : '',
      `color ${e.color}`,
    ]
      .filter(Boolean)
      .join(' · ');
  const voces: VozDisponible[] = Object.entries(marca.estilos).map(([id, e]) => ({ id, descripcion: `${describir(e)} (de la marca)` }));
  const vocesDeEstudio: Record<string, EstiloTexto> = {};
  const manuscrita = Object.values(marca.estilos).some((e) => /caveat|sacramento|kaushan|ballet/.test(e.fuente));
  if (!(VOZ_ANOTACION in marca.estilos) && !manuscrita && colores[0]) {
    const estilo: EstiloTexto = { fuente: 'caveat', ejes: { wght: 600 }, caso: 'tal-cual', tracking: 0, interlineado: 1.05, color: `@${colores[0].token}`, rasgos: [] };
    vocesDeEstudio[VOZ_ANOTACION] = estilo;
    voces.push({ id: VOZ_ANOTACION, descripcion: `${describir(estilo)} (del estudio: solo para una anotación corta o un rótulo con flecha; nunca un dato)` });
  }
  return { voces, vocesDeEstudio };
}
