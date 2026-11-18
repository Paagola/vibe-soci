import { readFileSync } from 'node:fs';
import type { EncargoPost } from '../../dominio/post.js';
import type { FichaReferencia } from '../../dominio/referencia.js';
import type { ComandaDeArte, Gesto, RutaEditorial, SeleccionEditorial, VistaDeProducto } from '../../dominio/taller.js';

type Evidencia = SeleccionEditorial['evidencias'][number];
type Observacion = Evidencia & { tema: string; procedencia: string };
const corpus = JSON.parse(readFileSync(new URL('../../../conocimiento/referencias/corpus-editorial.json', import.meta.url), 'utf8')) as Observacion[];
const indice = new Map(corpus.map(e => [e.id, e]));

interface Pauta {
  enfoque: string;
  escena: string;
  comprobar: string;
  ejemplos: string[];
  vista: VistaDeProducto;
  gesto: Gesto;
}
const pautas = {
  umbral: {
    enfoque: 'Entrar en la sala', vista: 'RASANTE', gesto: 'LUZ_Y_SOMBRA',
    escena: 'Coloca la cámara a altura de visitante. Un borde de la entrada, una silla o el extremo de la barra, si aparece en la fuente, da paso al fondo. Conserva verticales, distancias y escala del mobiliario.',
    comprobar: 'Se reconoce por dónde se entra y qué queda al fondo. Las mesas, huecos, luz y rótulos pertenecen al mismo local.',
    ejemplos: ['hardy-09', 'shack-12'],
  },
  noche: {
    enfoque: 'La luz que queda encendida', vista: 'RASANTE', gesto: 'LUZ_Y_SOMBRA',
    escena: 'Elige el punto de luz real que organiza la sala. Mantén un primer término en media sombra y una referencia reconocible al fondo. Conserva la hora y los reflejos que permite la fuente.',
    comprobar: 'A 360 px se distinguen dos profundidades y se puede señalar qué fuente ilumina cada una.',
    ejemplos: ['lumiere-00', 'hardy-06'],
  },
  barra: {
    enfoque: 'Seguir la barra', vista: 'OBLICUA', gesto: 'RITMO',
    escena: 'Empieza en el extremo visible de la barra y sigue la línea del sobre hasta el servicio. Usa cambios de tamaño de los asientos o reflejos presentes para medir la profundidad.',
    comprobar: 'El borde de la barra conduce al servicio y los asientos permanecen en su lugar.',
    ejemplos: ['franke-11', 'hardy-22'],
  },
  servicio: {
    enfoque: 'El instante del servicio', vista: 'OBLICUA', gesto: 'MACRO',
    escena: 'Busca en la fuente el punto donde la mano, la herramienta o el recipiente tocan el sujeto. Deja aire en la dirección del movimiento. Usa sólo la acción y las personas documentadas; si faltan, cuenta el servicio mediante el apoyo real.',
    comprobar: 'Se entiende qué toca qué, y las manos, utensilios y cantidades coinciden con la fuente.',
    ejemplos: ['cin-04', 'blog-23', 'smacai-17'],
  },
  capas: {
    enfoque: 'El canto cuenta el interior', vista: 'RASANTE', gesto: 'MACRO',
    escena: 'Desde un flanco, sigue la unión de dos estratos que ya se ven. Deja el borde de apoyo en cuadro. El foco recorre ese canto, con una sombra pequeña que permita leer el grosor.',
    comprobar: 'El borde, la base y el espesor relativo siguen siendo reconocibles. Se conserva el corte real.',
    ejemplos: ['blog-11', 'smacai-19'],
  },
  bebida: {
    enfoque: 'El borde y el nivel', vista: 'OBLICUA', gesto: 'LUZ_Y_SOMBRA',
    escena: 'Encuadra el encuentro del líquido y el recipiente. Busca una franja de reflejo en el borde y una zona de fondo más tranquila detrás; respeta espuma, transparencia y nivel observables.',
    comprobar: 'A tamaño móvil se reconocen el nivel, el contorno y el apoyo. Las luces conservan detalle.',
    ejemplos: ['oak-07', 'lumiere-01', 'cin-06'],
  },
  piezas: {
    enfoque: 'Un intervalo entre piezas', vista: 'CENITAL', gesto: 'RITMO',
    escena: 'Compón a partir de los huecos que separan las unidades reales. Un extremo próximo y el siguiente perfil permiten seguir el ritmo y contar. Deja un borde completo que identifique la preparación.',
    comprobar: 'Se cuentan las unidades y se sigue el contorno de cada una, también donde hay solapes.',
    ejemplos: ['blog-60', 'oak-08'],
  },
  caparazon: {
    enfoque: 'El caparazón en relieve', vista: 'RASANTE', gesto: 'LUZ_Y_SOMBRA',
    escena: 'Gira físicamente la puesta. Fotografía los cuerpos por el flanco, con su eje largo cruzando el cuadro. Separa las cabezas para poder seguir cada abdomen y su abanico final. Una luz amplia, lateral y ligeramente posterior dibuja una banda de brillo cortado en las articulaciones. Deja respirar los extremos.',
    comprobar: 'El color y los reflejos describen la cocción a tamaño móvil. Cada cabeza conecta con su propio abdomen. La perspectiva cambia qué superficie queda visible.',
    ejemplos: ['blog-46', 'oak-04', 'blog-23'],
  },
  textura: {
    enfoque: 'Una huella de preparación', vista: 'OBLICUA', gesto: 'MACRO',
    escena: 'Acércate al rasgo que distingue la preparación: un pliegue, una corteza o un surco de cuchara que ya esté presente. Incluye un borde reconocible del conjunto para relacionar detalle y escala.',
    comprobar: 'El detalle identifica el plato y se puede localizar en la fuente. La textura conserva sus irregularidades.',
    ejemplos: ['blog-70', 'blog-82'],
  },
  mesa: {
    enfoque: 'El plato en su mesa', vista: 'OBLICUA', gesto: 'LUZ_Y_SOMBRA',
    escena: 'Deja que un borde de apoyo entre en primer término para dar escala a la porción. Sitúa el detalle de preparación fuera del centro. Conserva visible suficiente mesa para que la sombra sitúe el producto.',
    comprobar: 'El alimento se reconoce al primer vistazo. La mesa sitúa su escala y el apoyo conserva una sombra coherente.',
    ejemplos: ['oak-10', 'blog-21', 'lumiere-07'],
  },
} satisfies Record<string, Pauta>;

const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function esEspacio(s: string) {
  const sujeto = s.replace(/^(?:(?:post|foto(?:grafia)?|imagen|vista|detalle)\s+(?:del?\s+|de la\s+|de un\s+|de una\s+)?)+/, '').replace(/^(?:el|la|un|una|nuestro|nuestra)\s+/, '');
  if (/^barra de (?:pan|chocolate|cereal|turron)\b/.test(sujeto)) return false;
  return /^(?:sala|salon|terraza|comedor|interior|barra|fachada|entrada|local|patio|ventanal|ambiente|mesas? (?:puesta|vacia)|rincon)\b/.test(sujeto)
    || /(?:fotografiar|mostrar|retratar|ensenar|protagonista) (?:el |la |nuestr[oa] )?(?:local|sala|salon|barra|terraza|comedor|fachada|ambiente)\b/.test(s);
}
function pautaPara(s: string, espacio: boolean): Pauta {
  if (espacio) {
    if (/\bnoche|anochec|atardecer|penumbra|velas|nocturn/.test(s)) return pautas.noche;
    return /\bbarra\b/.test(s) ? pautas.barra : pautas.umbral;
  }
  if (/\b(mano|manos|sirviendo|sirve|servir|vierte|vertido|emplatando|emplata|pinzas|equipo|brigada|chef|camareros?|camareras?|cocineras?|cocineros?)\b/.test(s)) return pautas.servicio;
  if (/\b(hamburguesa|sandwich|bocadillo|milhojas|lasana|tarta|tortilla|tosta|capas|miga|corte)\b/.test(s)) return pautas.capas;
  if (/\b(cafe|coctel|copa|caldo|vino|cerveza|sopa|infusion|vermut|bebida|latte|gazpacho)\b/.test(s)) return pautas.bebida;
  if (/^(?:las? |los? |unas? |unos? )?(?:gambas?|langostinos?|cigalas?|carabineros?)\b/.test(s) && !/pelad|tartar|ajillo/.test(s)) return pautas.caparazon;
  if (/\b(gambas?|cigalas?|langostinos?|croquetas?|piezas|sushi|maki|ostras?|raviolis?|vieiras?)\b/.test(s)) return pautas.piezas;
  return /\b(detalle|textura|hummus|corteza|pulpo|focaccia|surco|brasa)\b/.test(s) ? pautas.textura : pautas.mesa;
}

// Un rasgo escrito en la nota puede precisar los casos guía. La procedencia evita que
// un anuncio con letras se convierta en referencia literal para una fotografía limpia.
function observacionAfin(nota: string, ruta: RutaEditorial, ids: string[]) {
  const palabras = nota.match(/\b[a-z]{4,}\b/g) ?? [];
  const generales = new Set(['foto', 'fotografia', 'post', 'solo', 'mostrar', 'quiero', 'nuestra', 'nuestro', 'para', 'letras', 'texto', 'nombre', 'plato', 'desde', 'sobre', 'local', 'esta', 'hacia', 'fondo', 'cartel']);
  const motivos = [...new Set(palabras.filter(p => !generales.has(p)).map(p => p.replace(/s$/, '')))];
  const candidatas = corpus.filter(e => !ids.includes(e.id) && e.tema !== 'exceso' && e.tema !== 'serie' && (
    ruta === 'FOTO_ESPACIO' ? e.tema === 'espacio' && ['fotografía comercial', 'fotografía de arquitectura'].includes(e.procedencia) :
    ruta === 'FOTO_PLATO' ? ['bebida', 'capas', 'detalle', 'servicio', 'plato'].includes(e.tema) && ['fotografía comercial', 'campaña social'].includes(e.procedencia) :
    ruta === 'TIPO_SOBRIA' ? e.tema === 'sobria' : e.tema === 'cartel'));
  let mayor = 0, elegida: Observacion | undefined;
  for (const c of candidatas) {
    const texto = new Set(normal(c.lectura).split(/[^a-z]+/).map(p => p.replace(/s$/, '')));
    const peso = motivos.filter(p => texto.has(p)).length;
    if (peso > mayor) { mayor = peso; elegida = c; }
  }
  return elegida?.id;
}

export function seleccionarEditorial(e: EncargoPost, foto: ComandaDeArte['fotografia'], solicitada?: RutaEditorial, ficha?: FichaReferencia) {
  const s = normal(e.plato);
  const espacio = esEspacio(s);
  const limpia = /\b(sin (?:anadir |ningun )?(?:texto|letras|rotulos|copy)|solo (?:la |una )?foto|fotografia pura)\b/.test(s);
  const expresiva = !/sin (?:efectos|adornos)/.test(s) && (/\b(cartel|poster|expresiv[oa]|tinta|tipografico|papel rasgado)\b/.test(s) || e.estetica === 'MAXIMALISMO' || ficha?.mecanismos.some(m => ['PAPEL_RASGADO', 'PATRON_REPETIDO', 'PALABRA_DETRAS'].includes(m)));
  const informativa = /\b(anunci\w*|apertura|inaugura\w*|horarios?|nombre impreso|titular|texto|rotulo|oferta|menu del dia|reservas|precio|tipografia)\b/.test(s);
  const fotografica = espacio ? 'FOTO_ESPACIO' : 'FOTO_PLATO';
  const sugerida: RutaEditorial = limpia ? fotografica : expresiva ? 'CARTEL_EXPRESIVO' : informativa || ficha?.familia === 'F4' ? 'TIPO_SOBRIA' : fotografica;
  const ruta = solicitada ?? sugerida;
  const esEspacial = ruta === 'FOTO_ESPACIO' || espacio;
  const pauta = pautaPara(s, esEspacial);
  const recursos: Record<RutaEditorial, { motivo: string; ejemplos: string[] }> = {
    FOTO_PLATO: { motivo: 'El encargo se puede contar con el alimento y su contexto de servicio.', ejemplos: [] },
    FOTO_ESPACIO: { motivo: 'La distribución y la luz del local cuentan la experiencia de estar allí.', ejemplos: [] },
    TIPO_SOBRIA: { motivo: 'Una información breve necesita un lugar de lectura que deje visible el sujeto.', ejemplos: ['editsoc-10', 'ig-14'] },
    CARTEL_EXPRESIVO: { motivo: 'Una acción gráfica puede relacionar un rasgo reconocible del sujeto con el nombre público.', ejemplos: ['smacai-03', 'house-02'] },
  };
  const tratamiento = recursos[ruta];
  const motivo = (solicitada && ruta !== sugerida ? 'Alternativa elegida. ' : '') + tratamiento.motivo + ' ' +
    (foto.luz < .38 ? 'La fuente tiene luminosidad media baja; conserva un borde legible en la sombra.' :
      foto.luz > .68 ? 'La fuente tiene luminosidad media alta; conserva el detalle en las luces.' : 'La fuente tiene luminosidad media intermedia; separa el foco por contraste local.');
  const ids = [...pauta.ejemplos, ...tratamiento.ejemplos];
  const afin = observacionAfin(s, ruta, ids);
  if (afin) ids.push(afin);
  const editorial: SeleccionEditorial = { ruta, motivo, enfoque: pauta.enfoque, comprobar: pauta.comprobar,
    evidencias: ids.map(id => {
      const entrada = indice.get(id);
      if (!entrada) throw new Error('Falta la observación editorial ' + id);
      const { fuente, pagina, imagen, lectura } = entrada;
      return { id, fuente, pagina, imagen, lectura };
    }) };
  return { editorial, pauta, espacio: esEspacial };
}
