/**
 * Las herramientas del chat: todo lo que el estudio sabe hacer fuera de la conversación con el director, como
 * formularios rápidos dentro del chat. Aquí está el catálogo (lo que ve la web para pintar cada formulario y lo que lee
 * el director para abrirlos); quién las ejecuta lo pone la raíz de composición (src/web/herramientasChat.ts).
 */
import { z } from 'zod';

export type Campo =
  | { tipo: 'imagen'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string }
  | { tipo: 'imagenes'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string; max?: number }
  | { tipo: 'texto' | 'parrafo'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string; valor?: string; max?: number }
  | { tipo: 'numero'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string; valor?: number; min?: number; max?: number; paso?: number }
  | { tipo: 'seleccion'; id: string; etiqueta: string; opciones: Array<{ valor: string; nombre: string }>; valor?: string; ayuda?: string }
  | { tipo: 'local'; id: string; etiqueta: string; opcional?: boolean }
  | { tipo: 'casilla'; id: string; etiqueta: string; valor?: boolean; ayuda?: string }
  | { tipo: 'referencia'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string }
  | { tipo: 'estilo'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string }
  | { tipo: 'pieza'; id: string; etiqueta: string; multiple?: boolean; ayuda?: string };

export type GrupoDeHerramientas = 'Crear' | 'Fotos' | 'Tipografía' | 'Referencias' | 'Local';

export interface DefinicionHerramienta {
  id: string;
  grupo: GrupoDeHerramientas;
  nombre: string;
  /** Una frase: qué hace y qué devuelve. */
  descripcion: string;
  /** Nombre de un icono de lucide (lo pinta la web). */
  icono: string;
  campos: Campo[];
  /** Lo que cuesta, si cuesta («≈ 0,15 USD por foto»). */
  coste?: string;
  /** Necesita los hechos del plato confirmados en la conversación. */
  conHechos?: boolean;
  /** No es un formulario: la web abre una tarjeta propia (el encargo paso a paso). */
  especial?: 'encargo';
}

export const ResultadoHerramienta = z.object({
  texto: z.string().optional(),
  /** Rutas relativas a la carpeta de la conversación. */
  imagenes: z.array(z.object({ archivo: z.string(), pie: z.string().optional() })).default([]),
  lista: z.array(z.object({ titulo: z.string(), detalle: z.string().optional(), imagen: z.string().optional() })).default([]),
  descargas: z.array(z.object({ nombre: z.string(), archivo: z.string() })).default([]),
});
export type ResultadoHerramienta = z.infer<typeof ResultadoHerramienta>;

const ESTETICAS = [
  { valor: '', nombre: 'A partir de la referencia' },
  { valor: 'EDITORIAL_SERENO', nombre: 'Editorial sereno' },
  { valor: 'EDITORIAL_OSCURO', nombre: 'Editorial oscuro' },
  { valor: 'COLOR_POP', nombre: 'Color pop' },
  { valor: 'MAXIMALISMO', nombre: 'Maximalismo' },
  { valor: 'MEDITERRANEO_LUMINOSO', nombre: 'Mediterráneo luminoso' },
  { valor: 'RUSTICO_FUEGO', nombre: 'Rústico de fuego' },
];

export const CATALOGO: DefinicionHerramienta[] = [
  // ------------------------------------------------------------------ Crear
  {
    id: 'pieza',
    grupo: 'Crear',
    nombre: 'Post o carrusel',
    descripcion: 'El director planifica cada diapositiva (foto nueva o la tuya) y el estudio de arte la diseña. Ves el plan y el coste antes de producir.',
    icono: 'Sparkles',
    conHechos: true,
    coste: 'Ves el coste en el plan',
    campos: [
      { tipo: 'seleccion', id: 'formato', etiqueta: 'Formato', opciones: [{ valor: 'carrusel', nombre: 'Carrusel' }, { valor: 'post', nombre: 'Post' }], valor: 'carrusel' },
      { tipo: 'numero', id: 'diapositivas', etiqueta: 'Diapositivas (carrusel)', valor: 5, min: 3, max: 6 },
      { tipo: 'parrafo', id: 'indicaciones', etiqueta: 'Qué quieres', opcional: true, ayuda: 'Tono, momento, tipo de fotos…' },
      { tipo: 'seleccion', id: 'esfuerzo', etiqueta: 'Esfuerzo', opciones: [{ valor: 'rapido', nombre: 'Rápido' }, { valor: 'normal', nombre: 'Normal' }, { valor: 'maximo', nombre: 'Máximo (con crítica)' }], valor: 'normal' },
    ],
  },
  {
    id: 'encargo',
    grupo: 'Crear',
    nombre: 'Encargo paso a paso',
    descripcion: 'La orden completa: post o carrusel editorial (toma nueva con otro ángulo y luz), cartel integrado, por capas con el productor o con el director de diseño F3. Con todas sus paradas.',
    icono: 'ClipboardList',
    coste: 'Te pide permiso antes de generar',
    campos: [],
    especial: 'encargo',
  },
  {
    id: 'direcciones',
    grupo: 'Crear',
    nombre: 'Direcciones de arte',
    descripcion: 'Varias direcciones pintadas, criticadas y comparadas a ciegas. Con una referencia, hermanas que la mejoran. Con acabado, Nano Banana 2 le da el remate profesional (fondo, sello, luz).',
    icono: 'Palette',
    conHechos: true,
    coste: '≈ 0,3–1,3 USD',
    campos: [
      { tipo: 'numero', id: 'direcciones', etiqueta: 'Direcciones', valor: 2, min: 1, max: 3 },
      { tipo: 'numero', id: 'vueltas', etiqueta: 'Vueltas de crítica', valor: 1, min: 0, max: 2 },
      { tipo: 'casilla', id: 'referencia', etiqueta: 'Partir de la referencia de la conversación', valor: true, ayuda: 'La que pusiste en la ficha del plato.' },
      { tipo: 'casilla', id: 'enriquecer', etiqueta: 'Acabado con Nano Banana 2', valor: false },
    ],
  },
  {
    id: 'lote',
    grupo: 'Crear',
    nombre: 'Lote de contenido',
    descripcion: 'Tres posts de tipos distintos y un carrusel (plato, ambiente, gente, proceso, cartel), con fotos nuevas y una auditoría estética al final.',
    icono: 'LayoutGrid',
    conHechos: true,
    coste: '≈ 1–1,5 USD',
    campos: [{ tipo: 'casilla', id: 'evaluar', etiqueta: 'Auditar el lote al terminar', valor: true }],
  },
  {
    id: 'auditoria',
    grupo: 'Crear',
    nombre: 'Auditoría estética',
    descripcion: 'Hydrogen mira las piezas a tamaño de móvil y las puntúa como un director de agencia.',
    icono: 'ScanEye',
    coste: '≈ 0,06 USD',
    campos: [{ tipo: 'pieza', id: 'piezas', etiqueta: 'Piezas', multiple: true }],
  },
  {
    id: 'foto-nueva',
    grupo: 'Fotos',
    nombre: 'Foto nueva',
    descripcion: 'Una toma nueva con Nano Banana Pro. Con la foto del plato como referencia, el plato se conserva.',
    icono: 'Camera',
    coste: '≈ 0,15 USD',
    campos: [
      { tipo: 'imagen', id: 'imagen', etiqueta: 'Foto del plato', opcional: true },
      { tipo: 'parrafo', id: 'prompt', etiqueta: 'La foto, como la pediría un fotógrafo', ayuda: 'Encuadre, luz, punto de vista, ambiente…' },
    ],
  },
  // ------------------------------------------------------------------ Fotos
  {
    id: 'recorte',
    grupo: 'Fotos',
    nombre: 'Recortar el plato',
    descripcion: 'Máscara del sujeto con Apple Vision (local, sin coste) y el plato recortado en PNG transparente.',
    icono: 'Scissors',
    campos: [{ tipo: 'imagen', id: 'imagen', etiqueta: 'Foto' }],
  },
  {
    id: 'combinar-luz',
    grupo: 'Fotos',
    nombre: 'Combinar luz y detalle',
    descripcion: 'La luz de una foto y el detalle de otra (alineadas, del mismo plato), sin halos.',
    icono: 'SunMedium',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'imagen', id: 'real', etiqueta: 'Foto real del plato' },
      { tipo: 'imagen', id: 'luz', etiqueta: 'Foto con la luz buena' },
      { tipo: 'imagen', id: 'detalle', etiqueta: 'Foto con el detalle' },
      { tipo: 'casilla', id: 'conservan', etiqueta: 'He comprobado que las dos conservan el plato de la foto real', valor: false, ayuda: 'Se apunta como veredicto de fidelidad (CONSERVA): sin él no se combinan.' },
      { tipo: 'numero', id: 'relleno', etiqueta: 'Relleno de sombras', valor: 0.3, min: 0, max: 1, paso: 0.05 },
    ],
  },
  {
    id: 'detalle',
    grupo: 'Fotos',
    nombre: 'Extraer un detalle',
    descripcion: 'Saca un detalle real de la foto (un grano de sal, una hoja) como recurso recortado, con máscara por brillo.',
    icono: 'Crop',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'imagen', id: 'imagen', etiqueta: 'Foto' },
      { tipo: 'texto', id: 'recorte', etiqueta: 'Zona (x, y, ancho, alto, en fracciones 0–1)', valor: '0.4,0.4,0.2,0.2' },
      { tipo: 'seleccion', id: 'canal', etiqueta: 'Canal que separa el detalle', opciones: [{ valor: 'g', nombre: 'Verde' }, { valor: 'r', nombre: 'Rojo' }, { valor: 'b', nombre: 'Azul' }], valor: 'g' },
      { tipo: 'numero', id: 'desde', etiqueta: 'Brillo desde', valor: 120, min: 0, max: 255 },
      { tipo: 'numero', id: 'hasta', etiqueta: 'Brillo hasta', valor: 255, min: 0, max: 255 },
    ],
  },
  {
    id: 'fidelidad',
    grupo: 'Fotos',
    nombre: 'Comprobar fidelidad',
    descripcion: '¿La foto generada conserva el plato de la real? Mide los bordes dentro del producto y saca recortes lado a lado.',
    icono: 'GitCompare',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'imagen', id: 'real', etiqueta: 'Foto real' },
      { tipo: 'imagen', id: 'generada', etiqueta: 'Foto generada' },
    ],
  },
  {
    id: 'degradar',
    grupo: 'Fotos',
    nombre: 'Foto de móvil con prisa',
    descripcion: 'Una versión «mala» de una foto (pequeña, torcida, luz fría, comprimida) para probar que el estudio la mejora.',
    icono: 'ImageDown',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'imagen', id: 'imagen', etiqueta: 'Foto' },
    ],
  },
  {
    id: 'papel',
    grupo: 'Fotos',
    nombre: 'Papel rasgado',
    descripcion: 'Una franja de papel rasgado procedural (sin IA), lista para usar como recurso.',
    icono: 'StickyNote',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'texto', id: 'color', etiqueta: 'Color del papel', valor: '#141414' },
      { tipo: 'texto', id: 'fibra', etiqueta: 'Color de la fibra', valor: '#5a5550' },
      { tipo: 'numero', id: 'semilla', etiqueta: 'Semilla', valor: 7, min: 1, max: 9999 },
    ],
  },
  // ------------------------------------------------------------------ Tipografía
  {
    id: 'muestras-tipo',
    grupo: 'Tipografía',
    nombre: 'Muestras de estilos',
    descripcion: 'Cada estilo de tipografía especial sobre la fuente y los colores del local, pintado con el compositor real.',
    icono: 'Type',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'texto', id: 'texto', etiqueta: 'Palabra', valor: 'Croquetas' },
    ],
  },
  {
    id: 'buscar-tipo',
    grupo: 'Tipografía',
    nombre: 'Sugerir tipografía especial',
    descripcion: 'Qué estilo de la biblioteca casa con el local y el plato, con sus razones. «Ninguno» también es una respuesta.',
    icono: 'SearchCheck',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'texto', id: 'plato', etiqueta: 'Plato', opcional: true, ayuda: 'Si hay hechos confirmados, se usan esos.' },
      { tipo: 'seleccion', id: 'rol', etiqueta: 'Para', opciones: [{ valor: 'titular', nombre: 'Titular' }, { valor: 'secundario', nombre: 'Texto secundario' }, { valor: 'apoyo', nombre: 'Apoyo' }], valor: 'titular' },
      { tipo: 'seleccion', id: 'fondo', etiqueta: 'Sobre', opciones: [{ valor: '', nombre: 'Cualquier fondo' }, { valor: 'oscuro', nombre: 'Fondo oscuro' }, { valor: 'claro', nombre: 'Fondo claro' }], valor: '' },
    ],
  },
  {
    id: 'crear-estilo',
    grupo: 'Tipografía',
    nombre: 'Crear un estilo',
    descripcion: 'Describe un material (queso fundido, tiza, neón de barra…) y el agente escribe la receta, la pinta, la lee con OCR y la critica hasta 4 rondas. Queda en PRUEBA hasta que la apruebes.',
    icono: 'WandSparkles',
    coste: 'Solo texto de Hydrogen (≈ 0,1–0,4 USD)',
    campos: [
      { tipo: 'parrafo', id: 'brief', etiqueta: 'El material y por qué', ayuda: 'Ej. «letra de queso fundido que gotea, para unas croquetas de queso»' },
      { tipo: 'texto', id: 'palabra', etiqueta: 'Palabra de prueba', valor: 'Croquetas' },
      { tipo: 'local', id: 'local', etiqueta: 'Local', opcional: true },
    ],
  },
  {
    id: 'aprobar-estilo',
    grupo: 'Tipografía',
    nombre: 'Aprobar o retirar un estilo',
    descripcion: 'La puerta humana: un estilo en PRUEBA pasa a APROBADO (o se retira) viendo su hoja.',
    icono: 'BadgeCheck',
    campos: [
      { tipo: 'estilo', id: 'estilo', etiqueta: 'Estilo' },
      { tipo: 'seleccion', id: 'estado', etiqueta: 'Decisión', opciones: [{ valor: 'APROBADO', nombre: 'Aprobar' }, { valor: 'RETIRADO', nombre: 'Retirar' }], valor: 'APROBADO' },
    ],
  },
  // ------------------------------------------------------------------ Referencias
  {
    id: 'referencia-biblioteca',
    grupo: 'Referencias',
    nombre: 'Elegir una referencia',
    descripcion: 'Una de las referencias estudiadas de la biblioteca. Queda como referencia de la conversación para las próximas piezas.',
    icono: 'Library',
    campos: [{ tipo: 'referencia', id: 'referencia', etiqueta: 'Referencia' }],
  },
  {
    id: 'analizar-referencia',
    grupo: 'Referencias',
    nombre: 'Analizar una referencia',
    descripcion: 'Ficha automática de un post que te gusta (familia, retícula, lectura) y aviso si es un mockup o una captura. Queda en las referencias del local.',
    icono: 'ScanSearch',
    coste: '≈ 0,02 USD',
    campos: [
      { tipo: 'local', id: 'local', etiqueta: 'Local' },
      { tipo: 'imagen', id: 'imagen', etiqueta: 'El post de referencia' },
      { tipo: 'casilla', id: 'usar', etiqueta: 'Usarla como referencia de esta conversación', valor: true },
    ],
  },
  // ------------------------------------------------------------------ Local
  {
    id: 'nuevo-local',
    grupo: 'Local',
    nombre: 'Dar de alta un local',
    descripcion: 'Su marca, sus tokens de diseño y sus fuentes (Google Fonts, OFL).',
    icono: 'Store',
    campos: [
      { tipo: 'texto', id: 'nombre', etiqueta: 'Nombre' },
      { tipo: 'texto', id: 'ciudad', etiqueta: 'Ciudad y zona' },
      { tipo: 'parrafo', id: 'descripcion', etiqueta: 'Qué es', ayuda: 'Una o dos frases: tipo de cocina, ambiente.' },
      { tipo: 'texto', id: 'tonos', etiqueta: 'Tono (hasta 5, separados por comas)', valor: 'cercano, artesano' },
      { tipo: 'texto', id: 'colores', etiqueta: 'Colores (#hex separados por comas)', opcional: true },
      { tipo: 'texto', id: 'titulos', etiqueta: 'Letra de los titulares', opcional: true, ayuda: 'Ej. «serif elegante de alto contraste»' },
      { tipo: 'texto', id: 'instagram', etiqueta: 'Instagram', opcional: true },
    ],
  },
  {
    id: 'gasto',
    grupo: 'Local',
    nombre: 'Gasto',
    descripcion: 'Lo gastado este mes en imágenes de Gemini frente al tope, y el texto de Hydrogen.',
    icono: 'Wallet',
    campos: [],
  },
];

/** Para el director: el catálogo en una línea por herramienta. */
export function catalogoEnTexto(catalogo: DefinicionHerramienta[]): string {
  return catalogo.map((h) => `- ${h.id}: ${h.nombre}. ${h.descripcion}${h.campos.length ? ` Campos: ${h.campos.map((c) => c.id).join(', ')}.` : ''}`).join('\n');
}
export { ESTETICAS };
