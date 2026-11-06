import type { FotoPieza, PapelFoto, Pieza } from '../dominio/modelos.js';
import type { ContextoCreativo } from '../puertos/DirectorCreativo.js';
import type { Dependencias } from './dependencias.js';

const PAPELES: Record<PapelFoto, string> = {
  PLATO: 'foto real del plato',
  LOCAL: 'foto real del local',
  VAJILLA: 'foto real de la vajilla',
  PERSONAS: 'foto real con personas',
  OTRO: 'foto real',
};

export function describirFoto(foto: FotoPieza): string {
  return foto.nota ? `${PAPELES[foto.papel]} · ${foto.nota}` : PAPELES[foto.papel];
}

/** Junta la marca, la pieza, sus imágenes y la biblioteca para el director creativo. */
export async function construirContexto(
  deps: Pick<Dependencias, 'piezas' | 'locales' | 'biblioteca'>,
  pieza: Pieza,
): Promise<ContextoCreativo> {
  const afinidad = { tipo: pieza.tipo, formato: pieza.formato, texto: [pieza.idea, ...pieza.fotos.map((f) => f.nota ?? '')].join(' ') };
  const [marca, guia] = await Promise.all([deps.locales.obtener(pieza.localSlug), deps.biblioteca.leerGuia(afinidad)]);
  const ruta = (archivo: string) => deps.piezas.rutaArchivo(pieza.id, archivo);

  return {
    marca,
    pieza,
    guia,
    fotos: pieza.fotos.map((foto) => ({ ruta: ruta(foto.archivo), archivo: foto.archivo, descripcion: describirFoto(foto) })),
    referenciaEstilo: pieza.referenciaEstilo && {
      ruta: ruta(pieza.referenciaEstilo.archivo),
      archivo: pieza.referenciaEstilo.archivo,
      descripcion: ['referencia de estilo: solo inspiración, nunca se publica', pieza.referenciaEstilo.nota].filter(Boolean).join(' · '),
    },
  };
}
