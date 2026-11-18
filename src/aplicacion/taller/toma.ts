import { ErrorDeUsuario } from '../../dominio/errores.js';
import { esOtraToma } from '../../dominio/fotoNueva.js';
import type { Gesto, SeleccionDeToma, TomaDelCartel, VistaDeProducto } from '../../dominio/taller.js';

type Posicion = TomaDelCartel['camara'];

const posiciones: Record<VistaDeProducto, Omit<Posicion, 'vista' | 'distancia'>> = {
  RASANTE: {
    anguloGrados: 12, giroGrados: 75, objetivoMm: 70, apertura: 8,
    descripcion: 'Coloca el objetivo apenas por encima del plano de apoyo, desde un flanco.',
    evidencia: 'El borde próximo se levanta delante del lejano. Se ve espesor de perfil y la superficie superior se estrecha.',
  },
  OBLICUA: {
    anguloGrados: 42, giroGrados: 85, objetivoMm: 65, apertura: 8,
    descripcion: 'Rodea el producto hasta otro flanco y acércate en tres cuartos. El primer término entra en diagonal.',
    evidencia: 'Se ven a la vez una cara lateral y la parte superior. Cambia qué borde queda delante y qué rasgos oculta.',
  },
  CENITAL: {
    anguloGrados: 90, giroGrados: 0, objetivoMm: 85, apertura: 11,
    descripcion: 'Sitúa la cámara sobre el producto con el sensor paralelo al plano de apoyo.',
    evidencia: 'Se lee el contorno en planta. La cara frontal se comprime y las formas antes superpuestas se separan allí donde la fuente lo permite.',
  },
};

const puesta: Record<Gesto, string> = {
  EMERGER: 'La posición de cámara pertenece al alimento fotografiado. El cartel impreso sigue viéndose de frente. Encaja la base del alimento bajo el labio del papel y conserva contacto con el gesto tipográfico.',
  LUZ_Y_SOMBRA: 'Orienta el producto y su sombra para que formen dos direcciones diferentes sobre la superficie. Deja que una termine junto al titular, con aire para la firma.',
  RITMO: 'Ordena los intervalos entre el contorno real y las letras. La cadencia nace de la forma y de los huecos; conserva el número de piezas.',
  MACRO: 'Encuadra cerca. Un borde identificable sitúa el detalle dentro del alimento; prolonga ese borde hacia un espacio de lectura.',
};

interface Motivo {
  vista: VistaDeProducto;
  prueba?: Partial<Record<VistaDeProducto, string>>;
  foco: string;
  accion: string;
  luz: string;
  conservar: string;
}

const nombrePrincipal = (plato: string) => plato.trim().replace(/^(?:el|la|los|las|un|una|unos|unas)\s+/iu, '');
export const protagonizaPulpo = (plato: string) => /^(?:pulpo\b|(?:tentáculos?|patas?|brazos?|ración) de pulpo\b)/iu.test(nombrePrincipal(plato));

function motivoDelPlato(plato: string, gesto: Gesto): Motivo {
  const nombre = nombrePrincipal(plato);
  if (protagonizaPulpo(nombre)) return {
    vista: 'RASANTE',
    prueba: {
      RASANTE: 'Las ventosas del flanco próximo aparecen por delante de la carne. Se ve su relieve de costado y la punta se acorta al alejarse de la base.',
      OBLICUA: 'Compara el tramo de la curva que tapa al siguiente. Desde el nuevo flanco se ve un borde de piel que antes quedaba detrás de la cara de corte, si esa cara existe.',
      CENITAL: 'La curva se lee en planta. Se separan sus dos bordes y disminuye la profundidad aparente de las ventosas laterales.',
    }, foco: 'Lleva el foco desde las ventosas cercanas hacia la curva. Debe reconocerse el volumen continuo hasta la punta.',
    accion: gesto === 'EMERGER' ? 'La base del brazo asoma por debajo del desgarro, ancha en primer término. El arco retrocede en profundidad y la punta vuelve hacia la palabra. El peso dobla el papel en el contacto.'
      : 'Haz que el arco natural guíe la mirada desde su base hacia la punta. Conserva el apoyo real de la carne.',
    luz: 'Luz rasante de tres cuartos desde atrás, con relleno suave delante. Las ventosas arrojan sombras pequeñas sobre la piel y la superficie cocinada mantiene su brillo satinado.',
    conservar: 'Piel, cocción y volumen de la foto. Hileras de ventosas que disminuyen hacia la punta del mismo brazo. Mantén los elementos que la dirección incluye en cuadro.',
  };
  if (/^(gambas?|langostinos?|carabineros?|cigalas?)\b/i.test(nombre) && !/pelad|ajillo|tartar|carpaccio/i.test(nombre)) return {
    vista: 'CENITAL',
    prueba: {
      CENITAL: 'Observa la unión de cabeza y abdomen desde su vertical. La cresta dorsal se lee en planta y el flanco con las patas pierde altura aparente. Si sigue dominando la cara frontal, la toma sigue siendo picada. Conserva el recuento y el apoyo.',
      RASANTE: 'La cabeza más próxima oculta parte de lo que hay detrás. Bajo el caparazón se ven el perfil articulado, las patas que tocan el apoyo y la sombra entre ambos.',
      OBLICUA: 'Muévete hasta el flanco opuesto al visible en la fuente. El caparazón próximo tapa la base de otras patas y su unión con el abdomen se ve desde otro lado.',
    }, foco: 'Sitúa la nitidez en la articulación que permite seguir de cabeza a abdomen. Deja legibles las antenas y el último segmento visible.',
    accion: 'Deja que cada curva visible y su sombra dibujen un recorrido. Cada pieza conserva el apoyo que permite la fuente. Al mover la cámara, vuelve a proyectar los solapes de cabeza, patas y abdomen desde el nuevo flanco.',
    luz: 'Un haz lateral bajo dibuja una sombra alargada de los cuerpos. Una fuente amplia de relleno deja leer las patas en sombra. Limita el reflejo a una franja de caparazón.',
    conservar: 'Cuenta las piezas visibles en la fuente. Mantén el color de cocción y los condimentos visibles. Comprueba qué cabezas, patas, antenas y colas están presentes y conserva únicamente las que muestre el producto.',
  };
  if (/^(café|cafe|sopa|consomé|crema de|caldo|infusión|gazpacho)(?![\p{L}\p{N}_])/iu.test(nombre)) return {
    vista: 'OBLICUA',
    prueba: {
      RASANTE: 'El borde próximo del recipiente se interpone delante de parte de la superficie del líquido.',
      CENITAL: 'La boca se ve en planta y deja de ocultar el líquido por delante. La pared exterior pierde altura visible.',
      OBLICUA: 'La proporción entre la abertura y la pared exterior cambia. En el borde próximo se ve dónde queda oculto el líquido.',
    }, foco: 'Enfoca el encuentro del líquido con el borde. Conserva visible superficie suficiente para reconocer preparación y color.',
    accion: 'La curva del líquido guía hacia el rótulo desde un lado distinto del recipiente. Conserva su superficie y su nivel.',
    luz: 'Luz lateral amplia reflejada en un solo costado del recipiente. Una bandera oscura fuera de plano separa el borde próximo del fondo.',
    conservar: 'Recipiente, nivel y aspecto reales. Respeta la presencia o ausencia de espuma, vapor, decoración e ingredientes.',
  };
  if (/^(hamburguesa|bocadillo|s[aá]ndwich|milhojas|lasaña|tarta|tortilla)\b/i.test(nombre)) return {
    vista: 'RASANTE', foco: 'Enfoca el borde donde se tocan dos de las superficies ya visibles. Mantén textura y espesor reconocibles.',
    accion: 'La línea de espesor atraviesa el encuadre y acompaña la voz principal. Conserva la pieza apoyada con su altura real.',
    luz: 'Una fuente lateral amplia roza las capas; relleno tenue en el borde opuesto conserva los huecos y el punto de cocción.',
    conservar: 'Número, secuencia y espesor relativo de las capas visibles. Conserva intacta la pieza donde la foto no muestre un corte.',
  };
  return {
    vista: gesto === 'RITMO' ? 'CENITAL' : 'OBLICUA',
    foco: 'Enfoca el rasgo que identifica el plato en la foto y conserva una segunda referencia de profundidad junto al contorno.',
    accion: 'Usa un borde real del alimento como entrada de la mirada. Su volumen y el punto donde toca la superficie dan continuidad al gesto del cartel.',
    luz: 'Una fuente lateral define la textura del producto y dibuja su sombra de apoyo. Ajusta el relleno hasta leer sus zonas oscuras.',
    conservar: 'Identidad, preparación, color, forma y cantidad visibles. Mantén las zonas ocultas sin fabricar cortes, rellenos o partes nuevas.',
  };
}

export function dirigirToma(plato: string, gesto: Gesto, seleccion: SeleccionDeToma = { opcion: 'AUTO' }, fotoReferencia = ''): TomaDelCartel {
  const { vista, prueba, ...motivo } = motivoDelPlato(plato, gesto);
  const recomendada = /cenital|desde arriba|a plomo/i.test(fotoReferencia) ? 'CENITAL'
    : /rasante|ras de|nivel de la mesa/i.test(fotoReferencia) ? 'RASANTE'
    : /tres cuartos|¾|3\/4/.test(fotoReferencia) ? 'OBLICUA' : vista;
  const primera = seleccion.opcion === 'AUTO' ? recomendada : seleccion.opcion;
  const posicion = (vista: VistaDeProducto): Posicion => {
    const distancia = seleccion.plano ?? (gesto === 'MACRO' ? 'MACRO' : vista === 'CENITAL' ? 'MEDIO' : 'PRIMER_PLANO');
    const optica = distancia === 'MACRO' ? { objetivoMm: 100, apertura: 11 } : distancia === 'GENERAL' ? { objetivoMm: 50, apertura: 8 } : {};
    return { vista, ...posiciones[vista], evidencia: prueba?.[vista] ?? posiciones[vista].evidencia, distancia, ...optica };
  };
  const posibilidades = [primera, ...(['RASANTE', 'OBLICUA', 'CENITAL'] as const).filter(v => v !== primera)].map(posicion);
  const origen = seleccion.origen;
  let camara = posibilidades[0]!;
  let cambios: string[] = [];
  let alternativa: Posicion | undefined;
  if (origen) {
    const valida = posibilidades.find(v => esOtraToma(origen, v).otra)!;
    if (seleccion.opcion !== 'AUTO' && valida.vista !== primera) {
      throw new ErrorDeUsuario('Esa posición repite la cámara de origen. Prueba la vista ' + valida.vista.toLocaleLowerCase('es') + ' o la propuesta automática.');
    }
    camara = valida;
    cambios = esOtraToma(origen, camara).cambios;
  } else {
    // La altura de la fotografía no se deduce de sus colores. El generador observa la fuente y ejecuta una toma.
    alternativa = posibilidades.slice(1).sort((a, b) => Math.abs(b.anguloGrados - camara.anguloGrados) - Math.abs(a.anguloGrados - camara.anguloGrados))[0];
  }
  return { seleccion, camara, ...(alternativa ? { alternativa } : {}), cambios, encuadre: puesta[gesto], ...motivo, luz: seleccion.luz ?? motivo.luz, accion: seleccion.accionProducto ?? motivo.accion };
}

export function describirCamara(p: Posicion): string {
  return p.vista + ' · ' + p.anguloGrados + '° sobre el apoyo, giro alrededor del producto ' + p.giroGrados + '°, ' +
    p.distancia.toLowerCase().replaceAll('_', ' ') + ', ' + p.objetivoMm + ' mm, f/' + p.apertura + '. ' + p.descripcion + ' ' + p.evidencia;
}

export function instruccionDeToma(t: TomaDelCartel): string {
  const origen = t.seleccion.origen;
  return [
    'Sesión fotográfica. Observa primero la imagen adjunta como fuente de identidad y reconstruye el producto desde una cámara físicamente distinta. El ángulo indicado dirige al alimento dentro del cartel. La referencia editorial guía el ritmo y las voces tipográficas. Presenta el cartel terminado de frente.',
    origen ? 'La persona describe el origen a ' + origen.anguloGrados + '°, plano ' + origen.distancia + '. Cambios dirigidos: ' + t.cambios.join(', ') + '.' : 'La altura original queda por observar en la foto adjunta.',
    'Toma principal. ' + describirCamara(t.camara),
    t.alternativa ? 'Solo si al mirar la foto fuente ya reconoces la perspectiva principal, ejecuta en su lugar esta segunda posición: ' + describirCamara(t.alternativa) + ' Entrega una sola foto dentro del cartel.' : '',
    t.encuadre, t.accion, t.luz, t.foco, t.conservar,
    t.seleccion.rasgoFuente ? 'Observación del usuario para conservar en el producto: ' + JSON.stringify(t.seleccion.rasgoFuente) : '',
    'Comprueba que cambió la proyección de una parte reconocible. Un giro del lienzo, un recorte o una luz distinta mantienen la misma perspectiva y requieren repetir la toma antes de dar por acabada la imagen. Conserva las caras ocultas que no se puedan reconstruir con fidelidad.',
  ].filter(Boolean).join('\n');
}
