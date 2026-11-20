/**
 * Compone un diseño a partir de su intención y guarda la versión entera
 * (intención, documento resuelto, render, capas, SVG y exportaciones 3:4 y 4:5).
 */
import { Intencion, type Tokens } from '../../dominio/diseno/intencion.js';
import { conTokensDeMarca } from '../../dominio/diseno/operaciones.js';
import { exportacionesDe } from '../../dominio/diseno/reticula.js';
import type { Problema, Resuelto } from '../../dominio/diseno/resuelto.js';
import { validar } from '../../dominio/validacion.js';
import type { AlmacenActivos } from '../../puertos/AlmacenActivos.js';
import type { AlmacenDisenos, VersionGuardada } from '../../puertos/AlmacenDisenos.js';
import type { ActivoDisponible, Compositor, Renderizado } from '../../puertos/Compositor.js';
import type { ProcesadorImagen } from '../../puertos/ProcesadorImagen.js';

export interface DepsDiseno {
  compositor: Compositor;
  activos: AlmacenActivos;
  disenos: AlmacenDisenos;
  procesador: ProcesadorImagen;
}

export interface ResultadoComponer {
  intencion: Intencion;
  resuelto: Resuelto;
  renderizado: Renderizado;
  guardado: VersionGuardada;
  /** Exportaciones relativas a la carpeta de la versión. */
  exportadas: string[];
}

export async function componerDiseno(
  deps: DepsDiseno,
  entrada: unknown,
  destino: string,
  opciones: { tokensMarca?: Tokens } = {},
): Promise<ResultadoComponer> {
  const leida = validar(Intencion, entrada, 'La intención del diseño no es válida.');
  const intencion = opciones.tokensMarca ? conTokensDeMarca(leida, opciones.tokensMarca) : leida;

  const activos: Record<string, ActivoDisponible> = {};
  for (const [papel, id] of Object.entries(intencion.activos)) activos[papel] = await deps.activos.obtener(intencion.marca, id);

  const resuelto = await deps.compositor.resolver(intencion, activos);
  const renderizado = await deps.compositor.renderizar(resuelto, activos);
  const final = conContraste(intencion, resuelto, renderizado.contraste);
  avisarActivosDePrueba(final);

  const guardado = await deps.disenos.guardar(destino, intencion, final, renderizado);
  const exportadas: string[] = [];
  for (const proporcion of exportacionesDe[intencion.lienzo.formato]) {
    const archivo = `exportadas/${proporcion.replace(':', 'x')}.jpg`;
    await deps.procesador.exportar(`${guardado.carpeta}/diseno.png`, `${guardado.carpeta}/${archivo}`, proporcion);
    exportadas.push(archivo);
  }
  return { intencion, resuelto: final, renderizado, guardado, exportadas };
}

/** Añade el contraste medido al pintar y comprueba las relaciones de contraste mínimo. */
function conContraste(intencion: Intencion, resuelto: Resuelto, contraste: Record<string, number>): Resuelto {
  const problemas: Problema[] = [...resuelto.problemas];
  for (const relacion of intencion.relaciones) {
    if (relacion.tipo !== 'contrasteMinimo') continue;
    const medido = contraste[relacion.texto];
    if (medido !== undefined && medido < relacion.ratio) {
      problemas.push({
        gravedad: 'ERROR',
        capa: relacion.texto,
        tipo: 'CONTRASTE',
        mensaje: `«${relacion.texto}» tiene un contraste de ${medido}:1 con su fondo en su peor zona; se pide al menos ${relacion.ratio}:1.`,
      });
    }
  }
  return { ...resuelto, medidas: { ...resuelto.medidas, contraste }, problemas };
}

/** Un activo de prueba (p. ej. una imagen generada que cambia el producto) no se puede publicar. */
function avisarActivosDePrueba(resuelto: Resuelto): void {
  for (const [papel, activo] of Object.entries(resuelto.activos)) {
    if (activo.uso === 'PUBLICABLE') continue;
    resuelto.problemas.push({
      gravedad: 'AVISO',
      tipo: 'FIDELIDAD',
      mensaje: `«${papel}» usa el activo «${activo.id}», que es solo para probar la composición y no se puede publicar${activo.alteraciones.length ? `: ${activo.alteraciones.join('; ')}` : ''}.`,
    });
  }
}
