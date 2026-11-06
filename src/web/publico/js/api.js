// Acceso a la API del estudio. Todos los errores llegan como {error:{code,message,detalles,retryable}}.

export class ErrorApi extends Error {
  constructor(status, { code, message, detalles = [], retryable = false }) {
    super(message);
    this.status = status;
    this.code = code;
    this.detalles = detalles;
    this.retryable = retryable;
  }
}

export async function api(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.error ?? { code: 'ERROR', message: `Error HTTP ${respuesta.status}` });
  return datos;
}

/** Sube una foto en crudo y devuelve {id, nombre, bytes}. */
export async function subirArchivo(archivo) {
  const respuesta = await fetch('/api/subidas', {
    method: 'POST',
    headers: { 'Content-Type': archivo.type || 'application/octet-stream', 'X-Nombre-Archivo': encodeURIComponent(archivo.name) },
    body: archivo,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.error ?? { code: 'ERROR', message: `Error HTTP ${respuesta.status}` });
  return datos.subida;
}

const INTERVALO_MS = 2000;

/**
 * Consulta un trabajo cada 2 s hasta que termina. `alActualizar` recibe cada estado.
 * Devuelve el trabajo final (TERMINADO o ERROR). `cancelado()` permite dejar de seguirlo al cambiar de vista.
 */
export async function seguirTrabajo(id, alActualizar, cancelado = () => false) {
  for (;;) {
    const { trabajo } = await api('GET', `/trabajos/${id}`);
    if (cancelado()) return trabajo;
    alActualizar(trabajo);
    if (trabajo.estado !== 'EN_CURSO') return trabajo;
    await new Promise((resolver) => setTimeout(resolver, INTERVALO_MS));
  }
}
