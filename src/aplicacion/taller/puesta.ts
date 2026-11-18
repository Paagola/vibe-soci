import type { ComandaDeArte, MaquetaDeTitulo, SeleccionDeToma } from '../../dominio/taller.js';

export function puestaDeEstudio(nota: string, espacio: boolean, seleccion?: SeleccionDeToma): NonNullable<ComandaDeArte['puesta']> {
  const servicio = /(?:^|[.!?]\s*)(?:(?:foto(?:grafía)?|retrato) (?:de |del |de la ))?(?:(?:el|la|nuestro|nuestra) )?(?:equipo|brigada|chef|cociner[oa]s?|camarer[oa]s?)\b/iu.test(nota);
  const marisco = /\b(gambas?|langostinos?|cigalas?|carabineros?)\b/iu.test(nota) && !/pelad|tartar|arroz|pasta|croqueta/iu.test(nota);
  const bebida = /^(?:(?:el|la|un|una|unos|unas|nuestro|nuestra) )?(?:caf[ée]s?|espressos?|lattes?|copas?|vino|cóctel|infusión)(?![\p{L}\d])/iu.test(nota.trim());
  const pideOriginal = /sin cambiar (?:la vajilla|las tazas|el recipiente)|(?:manten|mantén|conserva|respeta|misma?|original)\s+(?:la |el |las |los )?(?:vajilla|plato original|tazas?|cuencos?|recipiente)/iu.test(nota);
  const pideEstudio = /(?:cambia|sustituye|reemplaza) (?:la vajilla|el plato|las tazas|el soporte)|(?:otra vajilla|vajilla de estudio)/iu.test(nota);
  const vajilla = espacio || servicio ? 'ORIGINAL' : seleccion?.vajilla ?? (pideOriginal || bebida && !pideEstudio ? 'ORIGINAL' : 'ESTUDIO');
  const soporte = espacio ? 'Reconstruye solamente el espacio aportado. Conserva mobiliario, cartelería y luz real.'
    : servicio ? 'Documenta a las mismas personas en la acción aportada. Conserva ropa, herramientas y entorno reales. Encuadra sólo los gestos visibles.'
    : vajilla === 'ORIGINAL' ? 'Conserva el recipiente documentado y el número de unidades. Puedes desplazar la cámara y reorganizar el encuadre.'
    : marisco ? 'Sustituye el soporte de la fuente por una fuente oval de gres mate color carbón cálido. Que el borde entre por un solo lateral. Monta las piezas de nuevo sobre esa superficie y separa los contornos.'
    : 'Elige un soporte de estudio de gres mate en un único tono que contraste con el alimento. Recompón desde cero el reparto de la porción. Conserva todo ingrediente y respeta los apoyos físicos.';
  const apetito = espacio ? 'Se distinguen un lugar para sentarse y la profundidad del local al primer vistazo.'
    : servicio ? 'El gesto y la identidad de las personas se pueden cotejar con la fuente a tamaño móvil.'
    : marisco ? 'Se distinguen a 360 px el color de cocción y el brillo localizado del caparazón. Respeta los cristales de sal si aparecen en la fuente. Cada cabeza continúa en un solo abdomen y su cola; comprueba ambos extremos y el apoyo. Conserva los tostados reales.'
    : bebida ? 'Se distinguen superficie, borde y volumen de cada bebida; espuma o transparencia conservan su textura real y no hay brillos quemados.'
    : 'Debe verse el punto de preparación mediante el corte, la rugosidad o el brillo que documenta la fuente. Conserva volumen, color y humedad naturales.';
  return { ambito: espacio ? 'ESPACIO' : servicio ? 'SERVICIO' : 'PRODUCTO', vajilla, soporte, apetito };
}

export function maquetaDeTitulo(nota: string, titulo: string, seleccion?: SeleccionDeToma): MaquetaDeTitulo {
  const cafe = /caf[ée]|latte|espresso|infusi[oó]n|vino|postre/iu.test(nota);
  const estilo = seleccion?.estiloTitulo ?? (cafe ? 'CONTRASTE' : 'CONDENSADA');
  const largo = Array.from(titulo).length > 42;
  return { estilo, posicion: seleccion?.posicionTitulo ?? (largo ? 'PAPEL' : cafe ? 'SUPERIOR_DERECHA' : 'INFERIOR_IZQUIERDA'),
    fuente: estilo === 'CONTRASTE' ? 'instrument-serif' : 'archivo',
    apoyo: estilo === 'CONTRASTE' ? 'instrument-serif-italica' : 'archivo' };
}

export function reservaFotografica(t: MaquetaDeTitulo): string {
  if (t.posicion === 'PAPEL') return 'Compón la fotografía vertical para que el sujeto se reconozca dentro del 78% superior. El taller montará el título en un margen de papel independiente.';
  const lado = { SUPERIOR_IZQUIERDA: 'superior izquierda', SUPERIOR_DERECHA: 'superior derecha', INFERIOR_IZQUIERDA: 'inferior izquierda' }[t.posicion];
  return 'Reserva la esquina ' + lado + ' como parte natural de la fotografía: una superficie de luz continua, con poco detalle, de aproximadamente 55% del ancho por 26% de la altura. Haz que el sujeto nazca del flanco opuesto y conserve su silueta. El taller colocará el título sobre esa área. Devuelve exclusivamente la fotografía limpia, sin letras.';
}
