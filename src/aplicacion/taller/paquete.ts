import { crc32 } from 'node:zlib';

/** ZIP sin compresión. Las fotos ya están comprimidas y los nombres los fija la aplicación. */
export function paqueteZip(archivos: Array<{ nombre: string; bytes: Buffer }>): Buffer {
  const locales: Buffer[] = [];
  const indice: Buffer[] = [];
  let posicion = 0;
  for (const { nombre, bytes } of archivos) {
    const ruta = Buffer.from(nombre);
    const crc = crc32(bytes);
    const cabecera = Buffer.alloc(30);
    cabecera.writeUInt32LE(0x04034b50);
    cabecera.writeUInt16LE(20, 4);
    cabecera.writeUInt32LE(crc, 14);
    cabecera.writeUInt32LE(bytes.length, 18);
    cabecera.writeUInt32LE(bytes.length, 22);
    cabecera.writeUInt16LE(ruta.length, 26);
    locales.push(cabecera, ruta, bytes);
    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50);
    entrada.writeUInt16LE(20, 4);
    cabecera.copy(entrada, 6, 4, 28);
    entrada.writeUInt32LE(posicion, 42);
    indice.push(entrada, ruta);
    posicion += cabecera.length + ruta.length + bytes.length;
  }
  const directorio = Buffer.concat(indice);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(posicion, 16);
  return Buffer.concat([...locales, directorio, fin]);
}
