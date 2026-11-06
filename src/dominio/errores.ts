/** Error que el usuario puede resolver: dato mal escrito, límite alcanzado, falta un paso… */
export class ErrorDeUsuario extends Error {
  constructor(
    message: string,
    readonly detalles: string[] = [],
  ) {
    super(message);
    this.name = 'ErrorDeUsuario';
  }
}

/** Fallo de un servicio externo (Gemini, Higgsfield). */
export class ErrorDeServicio extends Error {
  constructor(
    readonly servicio: string,
    message: string,
    readonly reintentable: boolean,
  ) {
    super(`${servicio}: ${message}`);
    this.name = 'ErrorDeServicio';
  }
}
