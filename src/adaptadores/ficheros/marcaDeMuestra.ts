/**
 * La marca de un local para la hoja de muestras del creador de estilos: el estilo de su titular (marcas/<slug>/tokens.json),
 * su paleta y su nombre (datos/locales/<slug>/marca.json, si existe). Solo lee.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MarcaDeMuestra } from '../../aplicacion/tipografia/verificarTratamiento.js';
import { paletaDeMarca } from '../../aplicacion/tipografia/verificarTratamiento.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import { Tokens } from '../../dominio/diseno/intencion.js';

export function leerMarcaDeMuestra(carpetaMarcas: string, carpetaDatos: string, slug: string): MarcaDeMuestra {
  const ruta = join(carpetaMarcas, slug, 'tokens.json');
  if (!existsSync(ruta)) throw new ErrorDeUsuario(`No hay tokens del local «${slug}» (${ruta}).`);
  const tokens = Tokens.parse(JSON.parse(readFileSync(ruta, 'utf8')));
  const titular = tokens.estilos.titular ?? Object.values(tokens.estilos)[0];
  if (!titular) throw new ErrorDeUsuario(`El local «${slug}» no tiene ningún estilo de texto en sus tokens.`);
  const { color: _color, ...estilo } = titular;
  const rutaMarca = join(carpetaDatos, 'locales', slug, 'marca.json');
  const nombre = existsSync(rutaMarca) ? ((JSON.parse(readFileSync(rutaMarca, 'utf8')) as { nombre?: string }).nombre ?? slug) : slug;
  return { slug, nombre, estilo, colores: paletaDeMarca(Object.values(tokens.colores)) };
}
