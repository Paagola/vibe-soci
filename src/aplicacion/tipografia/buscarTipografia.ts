/**
 * Tipografía especial · el buscador (SISTEMA.md §3, pasos 1 a 3): de un local y un plato a los estilos de la biblioteca
 * ordenados por lo bien que casan, con sus razones. Determinista: lo mismo da siempre lo mismo. La elección final es
 * de quien diseña (o de nadie: «ninguno» es una respuesta válida y frecuente).
 */
import { candidatos, type Candidato, type FuenteDeMarca } from '../../dominio/tipografia/consulta.js';
import { materialesDelPlato, rasgosDelLocal } from '../../dominio/tipografia/rasgos.js';
import type { Receta } from '../../dominio/tipografia/receta.js';
import { perfilDesdeMarca } from '../../dominio/marca/perfil.js';
import type { Tokens } from '../../dominio/diseno/intencion.js';
import type { Marca } from '../../dominio/modelos.js';

export interface EntradaBuscador {
  marca: Marca;
  tokens: Tokens;
  /** La clasificación y la familia de cada fuente (el catálogo tipográfico). */
  catalogo: { familia(id: string): string; clasificacion(id: string): string[] };
  recetas: Receta[];
  plato?: { texto?: string; elementos?: Array<{ nombre: string; estado?: string }> };
  rol?: 'titular' | 'secundario' | 'apoyo';
  fondo?: 'claro' | 'oscuro';
  /** Lo que dice la ficha de la referencia sobre su titular. */
  referencia?: string;
}

export function buscarTipografia(e: EntradaBuscador): Candidato[] {
  const { rasgos, materiales } = rasgosDelLocal({ slug: e.marca.slug, marca: { nombre: e.marca.nombre, descripcion: e.marca.descripcion, tonos: e.marca.tonos }, perfil: perfilDesdeMarca(e.marca, 'marca.json') });
  const estilos = Object.entries(e.tokens.estilos ?? {}) as Array<[string, { fuente: string; ejes?: Record<string, number> }]>;
  const fuentes: FuenteDeMarca[] = estilos.map(([estilo, s]) => ({ estilo, fuente: s.fuente, familia: e.catalogo.familia(s.fuente), clasificacion: e.catalogo.clasificacion(s.fuente), ejes: s.ejes ?? {} }));
  return candidatos(e.recetas, {
    local: { slug: e.marca.slug, nombre: e.marca.nombre, rasgos, materiales },
    plato: { ...(e.plato?.texto ? { texto: e.plato.texto } : {}), materiales: materialesDelPlato({ ...(e.plato?.texto ? { texto: e.plato.texto } : {}), elementos: (e.plato?.elementos ?? []).map((x) => ({ nombre: x.nombre, estado: x.estado ?? '' })) as never }) },
    ...(e.referencia ? { referencia: { tipografia: e.referencia } } : {}),
    fuentes,
    rol: e.rol ?? 'titular',
    ...(e.fondo ? { fondo: e.fondo } : {}),
  });
}
