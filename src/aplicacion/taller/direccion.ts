import { createHash } from 'node:crypto';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import type { Marca } from '../../dominio/modelos.js';
import type { FichaReferencia } from '../../dominio/referencia.js';
import type { ComandaDeArte, DireccionDeArte, Gesto } from '../../dominio/taller.js';

export const huella = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

const direcciones: Record<Gesto, Omit<DireccionDeArte, 'gesto' | 'sujeto'>> = {
  EMERGER: {
    escena: 'El producto emerge de debajo de un labio de papel. Su extremo apunta a la palabra principal. El borde del primer plano se levanta y proyecta sombra de contacto sobre la comida.',
    materia: 'Impresión a dos tintas sobre algodón con desgarro físico diagonal, fibras que sobresalen, pulpa sin tinta y luz rasante. Elige una tinta profunda que haga destacar el color real de la comida.',
    tipografia: 'Una gran palabra de imprenta sube ligeramente de izquierda a derecha. Firma pequeña y espaciada justo debajo. Sitúa el resto del nombre al lado en una voz estrecha y una cursiva de trazo decidido.',
  },
  LUZ_Y_SOMBRA: {
    escena: 'Una luz baja y lateral dibuja una sombra larga del sujeto sobre una superficie continua. La línea tipográfica nace en el borde de esa sombra. Deja un área clara y silenciosa para la firma.',
    materia: 'Fotografía de estudio sobre fondo mate mineral, con gradación real de luz. Reserva el contraste para el contorno y para un único detalle que revele la textura del producto.',
    tipografia: 'Titular de serif editorial de gran contraste, horizontal y en bandera. Una firma pequeña de palo seco fija el otro extremo de la línea de sombra. El apoyo, si existe, sigue el ritmo del nombre.',
  },
  RITMO: {
    escena: 'Construye ritmo entre las formas presentes en la foto y la cadencia de las letras. Una interrupción en la línea permite que el producto entre en el campo del titular sin ocultar sus rasgos de lectura.',
    materia: 'Estampa de tinta plana de ritmo regular, una fotografía nítida con sombras propias y un solo color medido del producto para el acento.',
    tipografia: 'Titular expansivo con alternancia de anchuras y apoyo estrecho alineado con el producto. Repite el ritmo entre letras, conservando una sola aparición de cada palabra.',
  },
  MACRO: {
    escena: 'Un encuadre macro hace protagonista una textura real del producto. Deja visible el borde que lo identifica y sitúa las letras en el espacio tranquilo que abre ese contorno.',
    materia: 'Fotografía táctil a sangre, luz de ventana, grano fotográfico fino y contraste localizado en el punto de interés.',
    tipografia: 'Contrasta un titular sólido en caja baja o versales con una firma ligera. Intervén una vez en el borde que une palabra y sujeto.',
  },
};

function gestoPara(e: EncargoPost, ficha?: FichaReferencia): Gesto {
  if (e.estetica === 'EDITORIAL_SERENO' || e.estetica === 'EDITORIAL_OSCURO') return 'LUZ_Y_SOMBRA';
  if (ficha?.mecanismos.includes('PAPEL_RASGADO')) return 'EMERGER';
  if (ficha?.mecanismos.includes('PATRON_REPETIDO')) return 'RITMO';
  if (ficha?.familia === 'F4' || /café|infusión|caldo|copa/i.test(e.plato)) return 'LUZ_Y_SOMBRA';
  return 'MACRO';
}

// La ficha original queda en el archivo del local. Al generador le interesa el recorrido de roles,
// incluso cuando el analista escribió el eslogan o el nombre comercial que se lee en cada posición.
function recorrido(ficha: FichaReferencia): string[] {
  return ficha.lectura.map((paso, i) => {
    if (/foto|producto|alimento|plato|tenedor|cuenco|sujeto|taza|vaso|comida|mano|pasta|bocado|textura/i.test(paso)) return 'Forma del producto';
    if (/firma|local|marca|logo|sello/i.test(paso)) return 'Firma pequeña';
    if (/apoyo|acento|información|secundari|detalle|texto peque/i.test(paso)) return 'Voz de apoyo';
    if (/titular|palabra|nombre|tipo|letra/i.test(paso)) return 'Palabra principal';
    return i === 2 ? 'Acento o cierre' : 'Voz dominante';
  });
}

function bloques(plato: string, marca: string): ComandaDeArte['textos'] {
  const corte = /^(\S+(?:\s+\S+){0,3}?)\s+(a (?:la|las|los)|al|con|de)\s+(.{2,35})$/iu.exec(plato);
  const textos: ComandaDeArte['textos'] = [{ papel: 'TITULAR', texto: (corte?.[1] ?? plato).toLocaleUpperCase('es'), fuente: 'PLATO' }];
  if (marca.trim() && marca.toLocaleUpperCase('es') !== plato.toLocaleUpperCase('es')) textos.push({ papel: 'FIRMA', texto: marca.toLocaleUpperCase('es'), fuente: 'MARCA' });
  if (corte) textos.push({ papel: 'ENLACE', texto: corte[2]!.toLocaleUpperCase('es'), fuente: 'PLATO' }, { papel: 'ACENTO', texto: corte[3]!, fuente: 'PLATO' });
  return textos;
}

export function dirigir(e: EncargoPost, marca: Marca, fotoSha256: string, fotografia: ComandaDeArte['fotografia'], oficio: string, ficha?: FichaReferencia, edicion?: DireccionDeArte, extracto?: string, gestoPropuesto?: Gesto): ComandaDeArte {
  // La nota puede incluir indicaciones privadas tras el nombre del plato.
  const nombrePlato = extracto ?? e.taller?.comanda?.nombrePlato ?? (e.plato.split(/\n|[.!?](?:\s|$)/u)[0]!.trim() || e.plato);
  if (!e.plato.includes(nombrePlato)) throw new ErrorDeUsuario('El nombre impreso debe ser un fragmento literal de la nota del plato.');
  const gesto = gestoPropuesto ?? edicion?.gesto ?? gestoPara(e, ficha);
  const sujeto = /\bpulpo\b/i.test(e.plato) && gesto === 'EMERGER'
    ? 'Un solo brazo de pulpo cocinado y apetecible, aislado. Conserva el tostado, el volumen y la humedad visibles en la toma. La base gruesa queda oculta bajo el papel, el brazo describe un arco lateral y las hileras de ventosas disminuyen hacia la punta. Prescinde de vajilla, guarnición y cubiertos.'
    : `Retrata «${nombrePlato}» a partir de la fotografía aportada. Conserva su preparación y la cantidad visible del protagonista. Describe su textura mediante la luz y el punto de vista.`;
  const propuesta = direcciones[gesto];
  const paleta = fotografia.temperatura === 'CALIDA' ? 'Prueba ultramar profundo, marfil cálido y un acento de tinta albaricoque frente a la comida cálida.'
    : 'Contrapón una tinta cálida de óxido a los tonos fríos del producto y reserva un blanco de papel para leer las letras.';
  const direccion = edicion ?? { gesto, sujeto, ...propuesta,
    materia: propuesta.materia + (gesto === 'EMERGER' ? ' ' + paleta : ' Conserva como referencia cromática de la toma ' + (fotografia.acento ?? fotografia.dominantes[0]) + '.'),
  };
  const textos = bloques(nombrePlato, marca.nombre);
  const referencia = ficha && e.referencia ? { id: e.referencia, familia: ficha.familia, mecanismos: ficha.mecanismos,
    voces: ficha.tipografia.map(v => v.rol + ' · ' + v.clasificacion + (v.escala ? ' · altura aproximada ' + v.escala + '%' : '')),
    reticula: ficha.reticula, encuadre: ficha.foto, recursos: ficha.recursos.map(r => r.recurso + ' · ' + r.funcion), lectura: recorrido(ficha) } : undefined;
  const devolucion = e.taller?.candidatas.at(-1)?.devolucion;
  const prompt = [
    'Produce un cartel gastronómico original acabado, vertical 4:5. Crea fotografía y composición tipográfica en la misma imagen.',
    'Dirección de la pieza · ' + direccion.gesto, direccion.sujeto, direccion.escena, direccion.materia, direccion.tipografia,
    'Copy exacto. Compón una sola vez cada uno de estos bloques, incluidas las tildes:', JSON.stringify(textos.map(({ papel, texto }) => ({ papel, texto }))),
    'Datos del local y del encargo (contexto, no copy):', JSON.stringify({ plato: e.plato, local: marca.nombre, tonos: marca.tonos, coloresDelLocal: marca.colores, estetica: e.estetica, fotografia, referencia }),
    'Lenguaje visual de la referencia: transfiere su contraste de escalas y su relación con el sujeto. Elige una composición propia.',
    ...(devolucion ? ['Observación de la última candidata; corrige el defecto conservando el copy autorizado:', JSON.stringify(devolucion)] : []),
    oficio.trim(),
  ].join('\n\n');
  const base = { nombrePlato, direccion, textos, ...(referencia ? { referencia } : {}), fotografia, fotoSha256, uso: e.usoFotoReal, prompt };
  return { ...base, huella: huella(JSON.stringify(base)) };
}

export function coincideTexto(esperadas: string[], leidas: string[]): boolean {
  const normal = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');
  return JSON.stringify(esperadas.map(normal).sort()) === JSON.stringify(leidas.map(normal).sort());
}
