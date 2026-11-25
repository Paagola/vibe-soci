import type { Bloque, Conversacion, FuentesDePieza, Pieza } from '../../dominio/chat.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';

/** La pieza conserva el plato, la foto, el local y la lectura de estilo aprobados aunque después cambie el chat. */
export function fuentesDePieza(c: Conversacion, origen?: Pieza | Extract<Bloque, { tipo: 'referencias' | 'conceptos' }>): FuentesDePieza {
  const guardadas = origen && ('pedido' in origen ? origen.pedido.fuentes : origen.encargo?.fuentes);
  if (guardadas) return guardadas;
  const referencia = (id?: string) => {
    const imagen = c.imagenes.find(i => i.id === id);
    const analisis = c.fichaReferencia?.imagen === imagen?.id ? c.fichaReferencia : undefined;
    return imagen && { id: imagen.id, archivo: imagen.archivo, ...(analisis ? { ficha: analisis.ficha, revision: analisis.revision } : {}) };
  };
  if (origen) {
    // Para piezas anteriores al guardado de fuentes, reconstruye solo lo que se había confirmado al proponer su plan.
    const inicio = c.mensajes.findIndex(m => m.bloques.some(b => 'pedido' in origen ? b.id === origen.id : 'pieza' in b && b.pieza === origen.id));
    let fuente: FuentesDePieza | undefined;
    for (const m of c.mensajes.slice(0, Math.max(0, inicio))) for (const b of m.bloques) {
      if (b.tipo === 'hechos' && b.estado === 'HECHO') {
        fuente = { hechos: { ...b.propuesta, activoReal: `chat-${c.id}-${b.propuesta.foto}` }, referencia: referencia(b.propuesta.referencia) };
      }
      if (b.tipo === 'referencias' && fuente) {
        if (b.estado === 'DESCARTADO') delete fuente.referencia;
        if (b.estado === 'HECHO' && b.elegida) {
          const candidata = b.candidatas.find(x => x.id === b.elegida);
          fuente.referencia = referencia(b.imagenElegida) ?? (candidata && { id: candidata.id, archivo: candidata.archivo });
        }
      }
    }
    if (fuente) return fuente;
  }
  if (!c.hechos) throw new ErrorDeUsuario('Confirma primero los datos del plato.');
  return { hechos: c.hechos, referencia: referencia(c.hechos.referencia ?? c.referencia) };
}
