/**
 * Verificación determinista de una receta candidata (Fase C): la valida, pinta su hoja de muestras con el compositor de
 * verdad, la lee con un OCR y mide la letra (dominio/tipografia/verificacion.ts). No decide nada de gusto: eso es del
 * crítico y, al final, de una persona.
 *
 * La hoja: la palabra del encargo y una de control con mayúsculas, minúsculas, tilde y descendentes («Jamón y Queso»),
 * en tres fuentes (la de la marca, si se da, una grotesca y una serif del catálogo, ninguna de alto contraste) y sobre
 * fondo oscuro y claro: 12 paneles (8 sin marca).
 */
import { contraste, hexARgb } from '../../dominio/diseno/color.js';
import { problemasDeReceta, Receta } from '../../dominio/tipografia/receta.js';
import { coincideLectura, dictaminar, panelPasa, informeDeInvalida, medirForma, type Fondo, type InformeDeVerificacion, type MedidasDePanel, type PanelDeMuestra, type PapelFuente } from '../../dominio/tipografia/verificacion.js';
import { describirProblemas } from '../../dominio/validacion.js';
import type { LectorDeTexto } from '../../puertos/LectorDeTexto.js';
import type { EstiloDePanel, PanelPintado, PintorDeMuestras } from '../../puertos/PintorDeMuestras.js';

export const PALABRA_DE_CONTROL = 'Jamón y Queso';

/** Fuentes de control: trazo medio, sin alto contraste, con minúsculas. La primera que no sea la de la marca. */
const GROTESCAS: EstiloDePanel[] = [
  { fuente: 'archivo', ejes: { wdth: 100, wght: 800 }, caso: 'tal-cual', tracking: 0.005, interlineado: 0.95, rasgos: [] },
  { fuente: 'work-sans', ejes: { wght: 800 }, caso: 'tal-cual', tracking: 0.005, interlineado: 0.95, rasgos: [] },
];
const SERIFS: EstiloDePanel[] = [
  { fuente: 'lora', ejes: { wght: 700 }, caso: 'tal-cual', tracking: 0.005, interlineado: 0.95, rasgos: [] },
  { fuente: 'fraunces', ejes: { opsz: 72, wght: 700, SOFT: 0, WONK: 0 }, caso: 'tal-cual', tracking: 0.005, interlineado: 0.95, rasgos: [] },
];

/** Colores por defecto (sin marca): un oscuro y un claro cálidos, el texto en el contrario. */
const NEUTROS = { claro: '#F3EDE2', oscuro: '#17130F', acento: '#F3EDE2' };

export interface MarcaDeMuestra {
  slug: string;
  nombre: string;
  /** El estilo del titular de la marca (su fuente, ejes, caso y espaciado). */
  estilo: EstiloDePanel;
  colores: { claro: string; oscuro: string; acento: string };
}

const croma = (hex: string) => {
  const rgb = hexARgb(hex);
  return Math.max(...rgb) - Math.min(...rgb);
};

/** El claro, el oscuro y el acento (el más saturado) de los colores de una marca, como en la hoja de muestras del 19/11. */
export function paletaDeMarca(colores: string[]): MarcaDeMuestra['colores'] {
  const porLuz = [...colores].sort((a, b) => contraste(b, '#000000') - contraste(a, '#000000'));
  const claro = porLuz[0] ?? NEUTROS.claro;
  const oscuro = porLuz.at(-1) ?? NEUTROS.oscuro;
  const acento = [...colores].sort((a, b) => croma(b) - croma(a))[0] ?? claro;
  return { claro, oscuro, acento };
}

export interface PeticionDeVerificacion {
  palabra: string;
  control?: string;
  marca?: MarcaDeMuestra;
}

export interface DepsVerificacion {
  pintor: PintorDeMuestras;
  lector: LectorDeTexto;
  /** Lecturas a la vez (el OCR real lanza un proceso por panel). */
  concurrencia?: number;
}

export interface Verificacion {
  informe: InformeDeVerificacion;
  /** La receta validada (si lo es). */
  receta?: Receta;
  /** La hoja de muestras (si se ha pintado). */
  hoja?: Buffer;
}

/** Valida una candidata: esquema y grafo. Devuelve la receta o sus problemas. */
export function validarCandidata(candidata: unknown): { receta?: Receta; problemas: string[] } {
  const leida = Receta.safeParse(candidata);
  if (!leida.success) return { problemas: describirProblemas(leida.error) };
  const problemas = problemasDeReceta(leida.data);
  return problemas.length ? { problemas } : { receta: leida.data, problemas: [] };
}

export function panelesDeMuestra(peticion: PeticionDeVerificacion, pintor: Pick<PintorDeMuestras, 'familia' | 'clasificacion'>): Array<{ panel: PanelDeMuestra; estilo: EstiloDePanel }> {
  const marca = peticion.marca;
  const fuentes: Array<{ papel: PapelFuente; estilo: EstiloDePanel }> = [];
  if (marca) fuentes.push({ papel: 'marca', estilo: marca.estilo });
  const libre = (lista: EstiloDePanel[]) => lista.find((e) => e.fuente !== marca?.estilo.fuente && !pintor.clasificacion(e.fuente).includes('alto-contraste')) ?? lista[0]!;
  fuentes.push({ papel: 'grotesca', estilo: libre(GROTESCAS) }, { papel: 'serif', estilo: libre(SERIFS) });
  const c = marca?.colores ?? NEUTROS;
  const colores: Record<Fondo, { fondo: string; texto: string }> = {
    oscuro: { fondo: c.oscuro, texto: contraste(c.acento, c.oscuro) >= 3 ? c.acento : c.claro },
    claro: { fondo: c.claro, texto: contraste(c.acento, c.claro) >= 3 ? c.acento : c.oscuro },
  };
  const palabras = [
    { palabra: peticion.palabra, rol: 'encargo' as const },
    { palabra: peticion.control ?? PALABRA_DE_CONTROL, rol: 'control' as const },
  ];
  const paneles: Array<{ panel: PanelDeMuestra; estilo: EstiloDePanel }> = [];
  for (const f of fuentes) {
    for (const p of palabras) {
      for (const fondo of ['oscuro', 'claro'] as const) {
        paneles.push({
          panel: { indice: paneles.length, palabra: p.palabra, rol: p.rol, fuente: { id: f.estilo.fuente, familia: pintor.familia(f.estilo.fuente), papel: f.papel }, fondo, colorFondo: colores[fondo].fondo, colorTexto: colores[fondo].texto },
          estilo: f.estilo,
        });
      }
    }
  }
  return paneles;
}

async function enParalelo<T, R>(elementos: T[], limite: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const salida = new Array<R>(elementos.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < elementos.length) {
      const i = siguiente++;
      salida[i] = await fn(elementos[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, elementos.length) }, trabajador));
  return salida;
}

export async function verificarTratamiento(candidata: unknown, peticion: PeticionDeVerificacion, deps: DepsVerificacion): Promise<Verificacion> {
  const { receta, problemas } = validarCandidata(candidata);
  const meta = (candidata ?? {}) as { id?: string; version?: number };
  if (!receta) return { informe: informeDeInvalida(meta, problemas, deps.lector.nombre) };

  // Se pinta en serie (el tiempo de cada panel tiene que ser el suyo) y se lee en paralelo.
  const paneles = panelesDeMuestra(peticion, deps.pintor);
  const pintados: PanelPintado[] = [];
  for (const { panel, estilo } of paneles) pintados.push(await deps.pintor.pintarPanel(receta, panel, estilo));
  const lecturas = await enParalelo(paneles, deps.concurrencia ?? 4, ({ panel }) => deps.lector.leer(pintados[panel.indice]!.png, panel.palabra));

  const medidas: MedidasDePanel[] = paneles.map(({ panel }, i) => {
    const p = pintados[i]!;
    const forma = medirForma(p.limpia, p.tratada, hexARgb(panel.colorFondo), p.cap);
    const leido = lecturas[i]!;
    return {
      panel,
      aplicado: p.aplicado,
      avisos: p.avisos,
      cap: Math.round(p.cap * 10) / 10,
      leido,
      coincide: coincideLectura(panel.palabra, leido),
      conservacion: Math.round(forma.conservacion * 1000) / 1000,
      relleno: Math.round(forma.relleno * 1000) / 1000,
      msRender: Math.round(p.msRender),
      hash: p.hash,
      hashRepetido: p.hashRepetido,
    };
  });
  const informe = dictaminar(receta, medidas, deps.lector.nombre);
  const hoja = await deps.pintor.componerHoja(
    medidas.map((m, i) => ({
      panel: m.panel,
      png: pintados[i]!.png,
      nota: `${panelPasa(m) ? '✓' : '✗'} OCR «${m.leido.join(' ') || '—'}»\nconserva ${m.conservacion.toFixed(2)} · rellena ${m.relleno.toFixed(2)} · ${m.msRender} ms`,
    })),
    `${receta.nombre} (${receta.id} v${receta.version}) · ${informe.pasa ? 'PASA' : 'NO PASA'} la verificación`,
  );
  return { informe, receta, hoja };
}
