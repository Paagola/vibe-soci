import { dirname, join } from 'node:path';
import type { Receta } from '../../dominio/arte/receta.js';
import { VOCES_DE_ESTUDIO } from '../../dominio/arte/receta.js';
import { contraste } from '../../dominio/diseno/color.js';
import { Capa, Intencion } from '../../dominio/diseno/intencion.js';
import type { EntradaEstudioDeArte, DepsEstudioDeArte } from './estudioDeArte.js';
import type { VisualCompuesto } from './pieza.js';

/** El texto obtiene una zona propia cuando falla su encaje sobre la fotografía. Cada capa sigue siendo editable. */
export async function componerFotografiaConTexto(
  pintar: DepsEstudioDeArte['pintar'], entrada: EntradaEstudioDeArte, receta: Receta, cabecera: boolean,
): Promise<VisualCompuesto> {
  const { colores, estilos } = entrada.tokensMarca;
  const literal = (clave?: string) => receta.textos.find(t => t.clave === clave)?.texto.replace(/\s+/g, ' ').trim();
  const titular = literal(receta.titular.texto);
  if (!titular) return { receta, reparada: false, problemas: ['Falta el texto aprobado del titular.'] };
  const firma = literal(receta.firma?.texto) ?? entrada.hechos.local.nombre;
  const apoyo = literal(receta.apoyo?.texto);
  const color = (token?: string) => token?.startsWith('@') ? colores[token.slice(1)] : token;
  const fondo = color(receta.fondo) ?? '#191817';
  const tinta = (token?: string) => {
    const propuesta = color(token);
    if (propuesta && contraste(fondo, propuesta) >= 4.5) return propuesta;
    return [...Object.values(colores), '#ffffff', '#000000'].sort((a, b) => contraste(fondo, b) - contraste(fondo, a))[0]!;
  };
  const voz = (nombre: string, base: string) => estilos[nombre] ?? VOCES_DE_ESTUDIO[nombre]?.estilo ?? estilos[base] ?? { fuente: 'archivo' };
  const estiloTitular = estilos.titular ?? voz(receta.titular.voz, 'titular');
  const y = cabecera ? .103 : .705;
  const intencion = Intencion.parse({
    esquema: 'diseno/intencion@1', id: 'fotografia', titulo: titular, marca: entrada.local,
    activos: { foto: entrada.foto.activo.id }, textos: { titular, firma, ...(apoyo ? { apoyo } : {}) },
    tokens: { estilos: {
      titulo: { ...estiloTitular, color: tinta(receta.titular.color) },
      firma: { ...voz(receta.firma?.voz ?? 'rotulo', 'rotulo'), color: tinta(receta.firma?.color) },
      apoyo: { ...voz(receta.apoyo?.voz ?? 'texto', 'texto'), color: tinta(receta.apoyo?.color) },
    } },
    capas: [
      { tipo: 'relleno', id: 'fondo', color: fondo },
      { tipo: 'imagen', id: 'fotografia', activo: 'foto', caja: { x: 0, y: cabecera ? .335 : 0, w: 1, h: cabecera ? .665 : .685 } },
      { tipo: 'texto', id: 'titular', texto: '@titular', estilo: 'titulo', ajuste: 'caja', vertical: 'centro', caja: { x: .067, y, w: .866, h: .108 } },
      ...(apoyo ? [{ tipo: 'texto', id: 'apoyo', texto: '@apoyo', estilo: 'apoyo', ajuste: 'caja', vertical: 'centro', caja: { x: .069, y: y + .112, w: .856, h: .038 } }] : []),
      { tipo: 'texto', id: 'firma', texto: '@firma', estilo: 'firma', ajuste: 'caja', vertical: 'centro', caja: { x: .069, y: y + .167, w: .856, h: .030 } },
    ],
    relaciones: ['titular', 'firma', ...(apoyo ? ['apoyo'] : [])].map(texto => ({ tipo: 'contrasteMinimo', texto, ratio: 4.5 })),
  });
  if (receta.esqueleto === 'MONTAJE_EDITORIAL') {
    // Una hoja de horarios o de ingredientes puede reunir más datos que el titular, el apoyo y la firma.
    // Mantener cada literal en su propia capa permite reordenarlo después de la recuperación.
    const datos = receta.textos.filter(t => t.clave !== receta.titular.texto && t.clave !== receta.firma?.texto);
    const columnas = datos.length > 2 ? 2 : 1;
    const filas = Math.ceil(datos.length / columnas);
    const altoFila = Math.min(.083, .36 / Math.max(1, filas));
    const finFoto = .80 - altoFila * filas;
    intencion.textos = Object.fromEntries(receta.textos.map(t => [t.clave, t.texto]));
    const claveFirma = receta.firma?.texto ?? 'firma-local';
    intencion.textos[claveFirma] = firma;
    intencion.capas = [
      { tipo: 'relleno', id: 'fondo', color: fondo },
      { tipo: 'texto', id: 'titular', estilo: 'titulo', texto: `@${receta.titular.texto}`, caja: { x: .07, y: .098, w: .86, h: .119 }, ajuste: 'caja', vertical: 'centro' },
      { tipo: 'imagen', id: 'foto', activo: 'foto', caja: { x: .07, y: .237, w: .86, h: finFoto - .255 } },
      ...datos.map((t, i) => ({ tipo: 'texto', id: `dato-${i + 1}`, texto: `@${t.clave}`, estilo: 'apoyo', caja: {
        x: .07 + (i % columnas) * .45, y: finFoto + Math.floor(i / columnas) * altoFila, w: columnas === 1 ? .86 : .41, h: altoFila - .009,
      }, ajuste: 'caja', vertical: 'centro' })),
      { tipo: 'texto', id: 'firma', estilo: 'firma', texto: `@${claveFirma}`, caja: { x: .07, y: .838, w: .86, h: .052 }, ajuste: 'caja', vertical: 'centro' },
    ].map(capa => Capa.parse(capa));
    intencion.relaciones = intencion.capas.filter(c => c.tipo === 'texto').map(c => ({ tipo: 'contrasteMinimo', texto: c.id, ratio: 4.5 }));
  }
  const pintada = await pintar(intencion, entrada.salida);
  return {
    receta, reparada: true, problemas: pintada.errores,
    ...(!pintada.errores.length ? { png: pintada.png, movil: pintada.movil, capas: join(dirname(pintada.png), 'capas') } : {}),
  };
}
