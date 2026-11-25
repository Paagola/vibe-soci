/** Cliente de la API del chat (src/web/rutas/chat.ts). Los tipos reflejan src/dominio/chat.ts. */

export type Formato = 'post' | 'carrusel';
export type Esfuerzo = 'rapido' | 'normal' | 'maximo';
export type EstadoTarjeta = 'PENDIENTE' | 'HECHO' | 'DESCARTADO';

export interface Elemento {
  nombre: string;
  estado: string;
  recuento: number | null;
}

export interface Hechos {
  local: string;
  plato: string;
  elementos: Elemento[];
  mensaje: string;
  foto: string;
  fotosPorLamina?: Array<{ lamina: number; foto: string }>;
  referencia?: string;
}

export type Bloque =
  | { tipo: 'hechos'; id: string; estado: EstadoTarjeta; propuesta: Hechos; formato?: Formato | 'auto'; esfuerzo?: Esfuerzo }
  | { tipo: 'plan'; id: string; estado: EstadoTarjeta; pieza: string }
  | { tipo: 'progreso'; id: string; pieza: string }
  | { tipo: 'pieza'; id: string; pieza: string; mostrar?: number }
  | { tipo: 'error'; id: string; texto: string }
  | { tipo: 'herramienta'; id: string; herramienta: string; estado: 'FORMULARIO' | 'EN_CURSO' | 'HECHO' | 'ERROR' | 'DESCARTADO'; valores: Record<string, unknown>; progreso: string[]; resultado?: Resultado; error?: string }
  | { tipo: 'encargo'; id: string; proyecto?: string; modo?: string }
  | {
      tipo: 'conceptos';
      id: string;
      estado: 'BUSCANDO' | 'PENDIENTE' | 'HECHO' | 'ERROR';
      pedido: { formato: Formato; diapositivas: number; indicaciones: string; esfuerzo: Esfuerzo };
      conceptos: Array<{ nombre: string; idea: string; titular: string; fotografia: string; laminas: string[] }>;
      elegido?: number;
      error?: string;
    }
  | {
      tipo: 'referencias';
      id: string;
      estado: 'BUSCANDO' | 'PENDIENTE' | 'HECHO' | 'DESCARTADO' | 'ERROR';
      pedido: { formato: Formato; diapositivas: number; indicaciones: string; esfuerzo: Esfuerzo };
      consultas: string[];
      candidatas: Array<{ id: string; origen: 'pinterest' | 'estudio' | 'biblioteca' | 'local' | 'propia'; archivo: string; titulo: string; motivo?: string; enlace?: string }>;
      progreso: string[];
      elegida?: string;
      lectura?: Array<{ titulo: string; detalle: string }>;
      error?: string;
    };

export interface Resultado {
  texto?: string;
  imagenes: Array<{ archivo: string; pie?: string }>;
  lista: Array<{ titulo: string; detalle?: string; imagen?: string }>;
  descargas: Array<{ nombre: string; archivo: string }>;
}

export type Campo =
  | { tipo: 'imagen' | 'imagenes'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string; max?: number }
  | { tipo: 'texto' | 'parrafo'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string; valor?: string }
  | { tipo: 'numero'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string; valor?: number; min?: number; max?: number; paso?: number }
  | { tipo: 'seleccion'; id: string; etiqueta: string; opciones: Array<{ valor: string; nombre: string }>; valor?: string; ayuda?: string }
  | { tipo: 'local'; id: string; etiqueta: string; opcional?: boolean }
  | { tipo: 'casilla'; id: string; etiqueta: string; valor?: boolean; ayuda?: string }
  | { tipo: 'referencia' | 'estilo'; id: string; etiqueta: string; opcional?: boolean; ayuda?: string }
  | { tipo: 'pieza'; id: string; etiqueta: string; multiple?: boolean; ayuda?: string };

export interface Herramienta {
  id: string;
  grupo: 'Crear' | 'Fotos' | 'Tipografía' | 'Referencias' | 'Local';
  nombre: string;
  descripcion: string;
  icono: string;
  campos: Campo[];
  coste?: string;
  conHechos?: boolean;
  especial?: 'encargo';
}

export interface Mensaje {
  id: string;
  rol: 'usuario' | 'asistente';
  fecha: string;
  texto: string;
  imagenes: string[];
  bloques: Bloque[];
}

export interface Diapositiva {
  papel: string;
  resumen: string;
  visual: { foto: 'real' | 'generada'; generar?: { tipo: string; prompt: string; conPlato: boolean }; receta: { esqueleto: string; nombre: string } };
  soloFoto?: boolean;
}

export type RolDeAgente = 'director' | 'fotografo' | 'maquetador' | 'revisor';
/** Una zona de la lámina en fracciones del lienzo (0–1). */
export interface Zona {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AgenteEnLaMesa {
  id: string;
  rol: RolDeAgente;
  n?: number;
  zona?: Zona;
  accion: string;
  desde: string;
}

export interface Pieza {
  id: string;
  formato: Formato;
  esfuerzo: Esfuerzo;
  indicaciones: string;
  plan?: { idea: string; diapositivas: Diapositiva[] };
  estado: 'PROPUESTA' | 'PRODUCIENDO' | 'LISTA' | 'ERROR' | 'DESCARTADA';
  costeEstimadoUsd: number;
  costeRealUsd?: number;
  base?: string;
  rehacer: number[];
  progreso: Array<{ texto: string; estado: 'en-curso' | 'hecho' | 'error' }>;
  fotos?: Array<{ n: number; archivo: string }>;
  /** Quién trabaja ahora mismo en la pieza (sus cursores en la mesa). */
  agentes?: AgenteEnLaMesa[];
  bitacora?: Array<{ id: string; rol: RolDeAgente; n?: number; texto: string; fecha: string }>;
  /** Una edición de capas en marcha. */
  edicion?: { laminas: number[]; pedido: string; desde: string };
  diapositivas: Array<{ n: number; png?: string; movil?: string; problemas: string[]; soloFoto?: boolean; decisiones?: string[]; capas?: string[] }>;
  error?: string;
}

export interface Conversacion {
  encargoCampana?: { titulo: string; indicaciones: string; canal?: 'historia'; formato: string; laminas: number;
    brief?: { campana: string; objetivo: string; estrategia: string; fecha: string; audiencia: string; proposito: string; motivoFormato?: string; llamada: string; metrica: string } };
  id: string;
  titulo: string;
  creada: string;
  actualizada: string;
  imagenes: Array<{ id: string; archivo: string; nombre: string; ancho: number; alto: number }>;
  hechos?: Hechos & { activoReal: string };
  piezas: Pieza[];
  mensajes: Mensaje[];
  pensando: boolean;
  referencia?: string;
}

export interface Local {
  slug: string;
  nombre: string;
  ciudad: string;
}

export async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(ruta, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((cuerpo as { error?: { message?: string } }).error?.message ?? `Error ${r.status}`);
  return cuerpo as T;
}

export interface ResumenConversacion {
  id: string;
  titulo: string;
  actualizada: string;
  tipos?: Array<'post' | 'carrusel' | 'historia' | 'campana'>;
  campana?: string;
}

export const api = {
  conversaciones: () => pedir<{ conversaciones: ResumenConversacion[] }>('/api/chat').then((r) => r.conversaciones),
  locales: () => pedir<{ locales: Local[] }>('/api/chat/locales').then((r) => r.locales),
  crear: () => pedir<{ conversacion: Conversacion }>('/api/chat', { method: 'POST' }).then((r) => r.conversacion),
  leer: (id: string) => pedir<{ conversacion: Conversacion }>(`/api/chat/${id}`).then((r) => r.conversacion),
  enviar: (id: string, m: { texto: string; imagenes: Array<{ nombre: string; datos: string }>; formato: Formato | 'auto'; esfuerzo: Esfuerzo }) =>
    pedir(`/api/chat/${id}/mensajes`, { method: 'POST', body: JSON.stringify(m) }),
  hechos: (id: string, bloque: string, r: { confirmar: boolean; hechos?: Hechos; formato?: Formato | 'auto'; esfuerzo?: Esfuerzo }) =>
    pedir(`/api/chat/${id}/tarjetas/${bloque}/hechos`, { method: 'POST', body: JSON.stringify(r) }),
  elegirConcepto: (id: string, bloque: string, eleccion: number | 'auto') => pedir(`/api/chat/${id}/tarjetas/${bloque}/conceptos`, { method: 'POST', body: JSON.stringify({ eleccion }) }),
  elegirEstetica: (id: string, bloque: string, eleccion: string) => pedir(`/api/chat/${id}/tarjetas/${bloque}/referencias`, { method: 'POST', body: JSON.stringify({ eleccion }) }),
  plan: (id: string, bloque: string, aprobar: boolean) => pedir(`/api/chat/${id}/tarjetas/${bloque}/plan`, { method: 'POST', body: JSON.stringify({ aprobar }) }),
  archivo: (id: string, ruta: string) => `/api/chat/${id}/archivos/${ruta.split('/').map(encodeURIComponent).join('/')}`,
  herramientas: () => pedir<{ herramientas: Herramienta[] }>('/api/chat/herramientas').then((r) => r.herramientas),
  biblioteca: () => pedir<{ familias: Array<{ id: string; nombre: string; posts: string[] }> }>('/api/chat/biblioteca').then((r) => r.familias),
  estilos: () => pedir<{ estilos: Array<{ id: string; nombre: string; estado: string; hoja: boolean; identidades: string[] }> }>('/api/chat/estilos').then((r) => r.estilos),
  imagenBiblioteca: (post: string) => `/api/chat/biblioteca/${post}`,
  hojaDeEstilo: (id: string) => `/api/chat/estilos/${id}/hoja`,
  subirImagenes: (id: string, imagenes: Array<{ nombre: string; datos: string }>) => pedir<{ imagenes: string[] }>(`/api/chat/${id}/imagenes`, { method: 'POST', body: JSON.stringify({ imagenes }) }).then((r) => r.imagenes),
  abrirHerramienta: (id: string, herramienta: string, valores: Record<string, unknown> = {}) => pedir(`/api/chat/${id}/herramientas/${herramienta}`, { method: 'POST', body: JSON.stringify({ valores }) }),
  lanzarHerramienta: (id: string, bloque: string, valores: Record<string, unknown>, descartar = false) => pedir(`/api/chat/${id}/tarjetas/${bloque}/herramienta`, { method: 'POST', body: JSON.stringify({ valores, descartar }) }),
  abrirEncargo: (id: string, modo?: string) => pedir(`/api/chat/${id}/encargos`, { method: 'POST', body: JSON.stringify(modo ? { modo } : {}) }),
  vincularEncargo: (id: string, bloque: string, proyecto: string) => pedir(`/api/chat/${id}/tarjetas/${bloque}/encargo`, { method: 'POST', body: JSON.stringify({ proyecto }) }),
  /** Los encargos de la orden (para retomar uno). */
  encargos: () => pedir<{ encargos: Array<{ proyecto: string; plato: string; local: string; nombreLocal?: string; paso: string; miniatura?: string | null }> }>('/api/encargos').then((r) => r.encargos),
  /** Sube una imagen del chat como subida de la orden (para crear un encargo con ella). */
  async subidaDesde(url: string, nombre: string): Promise<string> {
    const blob = await (await fetch(url)).blob();
    const r = await fetch('/api/subidas', { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream', 'X-Nombre-Archivo': encodeURIComponent(nombre) }, body: blob });
    const cuerpo = (await r.json().catch(() => ({}))) as { subida?: { id: string }; error?: { message?: string } };
    if (!r.ok || !cuerpo.subida) throw new Error(cuerpo.error?.message ?? `Error ${r.status}`);
    return cuerpo.subida.id;
  },
  crearEncargo: (cuerpo: Record<string, unknown>) => pedir<{ encargo: { proyecto: string } }>('/api/encargos', { method: 'POST', body: JSON.stringify(cuerpo) }).then((r) => r.encargo.proyecto),
  /** La conversación cada vez que cambia. Devuelve cómo dejar de escuchar. */
  escuchar(id: string, alCambiar: (c: Conversacion) => void): () => void {
    const fuente = new EventSource(`/api/chat/${id}/eventos`);
    fuente.onmessage = (e) => alCambiar(JSON.parse(e.data) as Conversacion);
    return () => fuente.close();
  },
};

/** Un archivo como base64 (data URL) para mandarlo dentro del JSON. */
export function aBase64(f: File): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(r.error);
    r.readAsDataURL(f);
  });
}
