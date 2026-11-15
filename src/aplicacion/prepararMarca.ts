/**
 * Punto 2 (15/11): al dar de alta un local, sus tokens para el compositor (marcas/<local>/tokens.json) y sus fuentes en
 * el catálogo (recursos/tipografias/). Con Torre de Vega y con Sushita se hizo a mano.
 * - Colores: los de marca.json, con un token por nombre.
 * - Fuentes: las de marca.json. Si ya están en el catálogo, se usan; si no, se buscan en Google Fonts (solo OFL), se
 *   descargan y se comprueba con fontkit que tienen la Ñ, las tildes y los signos de apertura; si no están o no pasan,
 *   la más parecida del catálogo, marcada como pendiente.
 * - Estilos: titular, texto y rótulo con pesos y colores puestos por el estudio, pendientes de confirmar con el local.
 * Nunca sobrescribe unos tokens que ya existan.
 */
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openSync } from 'fontkit';
import { contraste } from '../dominio/diseno/color.js';
import type { Marca } from '../dominio/modelos.js';
import type { ProveedorDeFuentes } from '../puertos/ProveedorDeFuentes.js';

/** Lo que tiene que tener una fuente para escribir en castellano. */
export const GLIFOS_DEL_CASTELLANO = 'ÑñÁÉÍÓÚáéíóúÜü¿¡';

export interface FuenteDeMarca {
  rol: 'TITULOS' | 'TEXTOS' | 'ROTULO';
  pedida: string;
  id: string;
  estado: 'EN_CATALOGO' | 'DESCARGADA' | 'SUSTITUIDA';
  nota: string;
}

export interface MarcaPreparada {
  tokens: string;
  creados: boolean;
  fuentes: FuenteDeMarca[];
}

interface EntradaCatalogo {
  id: string;
  familia: string;
  archivo: string;
  licencia: string;
  clasificacion?: string[];
  [clave: string]: unknown;
}

const existe = (ruta: string) => stat(ruta).then(() => true, () => false);
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const tokenDeColor = (nombre: string) => sinTildes(nombre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, 'c$1') || 'color';
const idDeFuente = (familia: string) => sinTildes(familia).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** «Bebas Neue Sans-Serif» → «Bebas Neue»: quita las palabras de clasificación que la gente añade al nombre. */
export function familiaDe(descripcion: string): string {
  return descripcion
    .replace(/\b(sans[- ]?serif|serif|script|display|monospace|regular|bold)\b/gi, '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sin la familia pedida, la del catálogo que más se le parece por lo que dice la descripción. */
export function parecidaDelCatalogo(descripcion: string, rol: FuenteDeMarca['rol']): string {
  const d = sinTildes(descripcion).toLowerCase();
  if (/script|manuscrit|pincel|caligraf|handwriting/.test(d)) return 'kaushan-script';
  if (/didon|bodoni|fatface/.test(d)) return 'bodoni-moda';
  if (/condensad|gothic|bebas|oswald|anton/.test(d)) return 'league-gothic';
  if (/mono/.test(d)) return 'plex-mono';
  if (/serif/.test(d) && !/sans/.test(d)) return 'fraunces';
  return rol === 'TITULOS' ? 'anybody' : 'archivo';
}

/** ¿Tiene la fuente todos los glifos del castellano? (fontkit: un glifo 0 es el de «no existe»). */
export function cubreElCastellano(ruta: string): { ok: boolean; faltan: string[] } {
  const fuente = openSync(ruta) as unknown as { glyphForCodePoint: (c: number) => { id: number } };
  const faltan = [...GLIFOS_DEL_CASTELLANO].filter((c) => fuente.glyphForCodePoint(c.codePointAt(0)!).id === 0);
  return { ok: faltan.length === 0, faltan };
}

export async function prepararMarca(deps: { raiz: string; proveedor?: ProveedorDeFuentes; hoy: () => string }, marca: Marca): Promise<MarcaPreparada> {
  const rutaTokens = join(deps.raiz, 'marcas', marca.slug, 'tokens.json');
  if (await existe(rutaTokens)) return { tokens: rutaTokens, creados: false, fuentes: [] };
  const carpetaFuentes = join(deps.raiz, 'recursos', 'tipografias');
  const rutaCatalogo = join(carpetaFuentes, 'catalogo.json');
  const catalogo = JSON.parse(await readFile(rutaCatalogo, 'utf8')) as { fuentes: EntradaCatalogo[]; [k: string]: unknown };
  const fuentes: FuenteDeMarca[] = [];

  const resolver = async (rol: FuenteDeMarca['rol'], descripcion: string): Promise<FuenteDeMarca> => {
    // «Playfair Display» es un nombre entero; «Bebas Neue Sans-Serif», no: se prueba primero tal cual y después limpio.
    const candidatas = [...new Set([descripcion.trim(), familiaDe(descripcion)].filter(Boolean))];
    const enCatalogo = catalogo.fuentes.find((f) => candidatas.some((c) => f.familia.toLowerCase() === c.toLowerCase()));
    if (enCatalogo) return { rol, pedida: descripcion, id: enCatalogo.id, estado: 'EN_CATALOGO', nota: `${enCatalogo.familia} ya estaba en el catálogo.` };
    let familia = familiaDe(descripcion);
    let descargada: Awaited<ReturnType<ProveedorDeFuentes['buscar']>>;
    for (const c of deps.proveedor ? candidatas : []) {
      descargada = await deps.proveedor!.buscar(c).catch(() => undefined);
      if (descargada) {
        familia = c;
        break;
      }
    }
    if (descargada) {
      const id = idDeFuente(familia);
      await mkdir(join(carpetaFuentes, id), { recursive: true });
      await writeFile(join(carpetaFuentes, id, descargada.archivo.nombre), descargada.archivo.bytes);
      const cubre = cubreElCastellano(join(carpetaFuentes, id, descargada.archivo.nombre));
      if (cubre.ok) {
        await writeFile(join(carpetaFuentes, id, 'OFL.txt'), descargada.licencia);
        catalogo.fuentes.push({
          id,
          familia,
          archivo: `${id}/${descargada.archivo.nombre}`,
          licencia: 'OFL-1.1',
          fuente: descargada.url,
          descargada: deps.hoy(),
          clasificacion: descargada.categoria ? [descargada.categoria.toLowerCase().replace('_', '-')] : [],
          nota: `Tipografía de marca de ${marca.nombre} (${rol.toLowerCase()}), descargada al dar de alta el local.`,
        });
        return { rol, pedida: descripcion, id, estado: 'DESCARGADA', nota: `${familia}, de ${deps.proveedor!.nombre}; tiene Ñ, tildes y signos de apertura.` };
      }
      await rm(join(carpetaFuentes, id), { recursive: true, force: true });
      const parecida = parecidaDelCatalogo(descripcion, rol);
      return { rol, pedida: descripcion, id: parecida, estado: 'SUSTITUIDA', nota: `${familia} no tiene ${cubre.faltan.join(' ')}: se usa ${parecida}, PENDIENTE de confirmar con el local.` };
    }
    const id = parecidaDelCatalogo(descripcion, rol);
    return { rol, pedida: descripcion, id, estado: 'SUSTITUIDA', nota: `«${familia || descripcion}» no está en el catálogo ni en Google Fonts (OFL): se usa ${id}, la más parecida, PENDIENTE de confirmar con el local.` };
  };

  const porRol = (rol: FuenteDeMarca['rol']) => marca.tipografias.find((t) => t.rol === rol)?.descripcion;
  const titulos = await resolver('TITULOS', porRol('TITULOS') ?? 'grotesca display');
  const textos = await resolver('TEXTOS', porRol('TEXTOS') ?? 'grotesca de texto');
  const rotulo = porRol('ROTULO') ? await resolver('ROTULO', porRol('ROTULO')!) : { ...textos, rol: 'ROTULO' as const };
  fuentes.push(titulos, textos, ...(porRol('ROTULO') ? [rotulo] : []));
  if (fuentes.some((f) => f.estado === 'DESCARGADA')) await writeFile(rutaCatalogo, `${JSON.stringify(catalogo, null, 2)}\n`);

  // Colores: un token por nombre. Titular y texto en el más claro (los fondos de las piezas suelen ser oscuros o fotos);
  // el rótulo, en el de más carácter (ni el más oscuro ni el más claro).
  const colores = Object.fromEntries(marca.colores.map((c) => [tokenDeColor(c.nombre), c.hex.toUpperCase()]));
  const porLuz = Object.entries(colores).sort((a, b) => contraste(b[1], '#FFFFFF') - contraste(a[1], '#FFFFFF'));
  const clara = porLuz[porLuz.length - 1]?.[0] ?? 'blanco';
  const caracter = porLuz.slice(1, -1)[0]?.[0] ?? clara;
  if (!porLuz.length) Object.assign(colores, { negro: '#111111', blanco: '#F5F5F5' });
  const ejes = (id: string, peso: number) => {
    const entrada = catalogo.fuentes.find((f) => f.id === id) as { ejes?: Record<string, unknown> } | undefined;
    return entrada?.ejes && 'wght' in entrada.ejes ? { wght: peso } : {};
  };
  const tokens = {
    nota: `Tokens del compositor para ${marca.nombre}, creados al dar de alta el local. Colores y familias de su marca.json; pesos, espaciado y color de cada estilo los pone el estudio: PENDIENTES de confirmar con el local.${fuentes.some((f) => f.estado === 'SUSTITUIDA') ? ' Hay fuentes sustituidas (ver «fuentes»).' : ''}`,
    colores,
    estilos: {
      titular: { fuente: titulos.id, ejes: ejes(titulos.id, 700), caso: 'tal-cual', tracking: 0, interlineado: 0.95, color: `@${clara}` },
      texto: { fuente: textos.id, ejes: ejes(textos.id, 400), caso: 'tal-cual', tracking: 0, interlineado: 1.3, color: `@${clara}` },
      rotulo: { fuente: rotulo.id, ejes: ejes(rotulo.id, 500), caso: 'mayusculas', tracking: 0.16, interlineado: 1.3, color: `@${caracter}` },
    },
    fuentes,
  };
  await mkdir(join(deps.raiz, 'marcas', marca.slug), { recursive: true });
  await writeFile(rutaTokens, `${JSON.stringify(tokens, null, 2)}\n`);
  return { tokens: rutaTokens, creados: true, fuentes };
}
