/**
 * Un OCR: lee el texto de una imagen, línea a línea. Lo usa el creador de estilos para comprobar que una tipografía
 * especial se sigue leyendo.
 */
export interface LectorDeTexto {
  readonly nombre: string;
  /**
   * Las líneas que lee en la imagen (PNG). `esperado` solo lo usan los lectores simulados de las pruebas para saber qué
   * «leer»; un OCR de verdad lo ignora.
   */
  leer(png: Buffer, esperado?: string): Promise<string[]>;
}
