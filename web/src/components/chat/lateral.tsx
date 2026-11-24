/** La barra lateral (conversaciones) y el recorrido de la conversación (en qué paso estás). */
import { Check, MessageSquare, PanelLeftClose, PanelRightClose, Plus } from 'lucide-react';
import type { Conversacion } from '@/lib/api';
import { cn } from '@/lib/utils';

export function Lateral(p: {
  conversaciones: Array<{ id: string; titulo: string; actualizada: string }>;
  actual?: string;
  abrir: (id?: string) => void;
  cerrar?: () => void;
  desdeLaDerecha?: boolean;
  className?: string;
}) {
  const IconoCerrar = p.desdeLaDerecha ? PanelRightClose : PanelLeftClose;
  const hoy = new Date().toISOString().slice(0, 10);
  const grupos: Array<[string, typeof p.conversaciones]> = [
    ['Hoy', p.conversaciones.filter((c) => c.actualizada.slice(0, 10) === hoy)],
    ['Antes', p.conversaciones.filter((c) => c.actualizada.slice(0, 10) !== hoy)],
  ];
  return (
    <aside className={cn('flex h-full w-64 shrink-0 flex-col border-border bg-lateral text-foreground', p.className)}>
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="relative font-[family-name:var(--font-serif)] text-[26px] font-extrabold italic leading-none">
          Estudio
          <svg aria-hidden="true" viewBox="0 0 120 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-2.5 w-full text-cobalto">
            <path d="M2 8 C 30 2, 70 2, 118 6" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        {p.cerrar && (
          <button type="button" onClick={p.cerrar} aria-label="Ocultar las conversaciones" className="ml-auto rounded-lg p-2 text-tenue hover:bg-accent hover:text-foreground">
            <IconoCerrar className="size-5" />
          </button>
        )}
      </div>
      <div className="px-3 pb-3">
        <button type="button" onClick={() => p.abrir(undefined)} className="flex h-10 w-full items-center justify-center gap-2 rounded-full border-2 border-papel/80 text-sm font-semibold text-papel transition hover:bg-papel hover:text-tinta">
          <Plus className="size-4" /> Nueva conversación
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Conversaciones">
        {grupos.map(([nombre, lista]) =>
          lista.length ? (
            <div key={nombre} className="mb-3">
              <div className="px-2 pb-1 text-xs font-medium text-tenue">{nombre}</div>
              {lista.slice(0, 40).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => p.abrir(c.id)}
                  aria-current={c.id === p.actual ? 'page' : undefined}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition', c.id === p.actual ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground')}
                >
                  <MessageSquare className="size-3.5 shrink-0 text-tenue" />
                  <span className="truncate">{c.titulo}</span>
                </button>
              ))}
            </div>
          ) : null,
        )}
        {!p.conversaciones.length && <p className="px-2 text-sm text-tenue">Aún no hay conversaciones.</p>}
      </nav>
    </aside>
  );
}

const PASOS = ['Foto', 'Ficha del plato', 'Estética', 'Concepto', 'Plan', 'Producción', 'Listo'] as const;

/** Por dónde va la conversación: lo hecho, en verde; lo actual, en el color de acento. */
export function Recorrido({ c }: { c: Conversacion }) {
  const hechos = [
    c.imagenes.length > 0,
    Boolean(c.hechos),
    c.piezas.some((x) => x.plan) || c.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'referencias' && ['HECHO', 'DESCARTADO', 'ERROR'].includes(b.estado))),
    c.piezas.some((x) => x.plan) || c.mensajes.some((m) => m.bloques.some((b) => b.tipo === 'conceptos' && ['HECHO', 'ERROR'].includes(b.estado))),
    c.piezas.some((x) => x.plan),
    c.piezas.some((x) => x.estado === 'PRODUCIENDO' || x.estado === 'LISTA'),
    c.piezas.some((x) => x.estado === 'LISTA'),
  ];
  const actual = hechos.findIndex((x) => !x);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto text-xs" aria-label="Recorrido">
      {PASOS.map((paso, i) => {
        const hecho = hechos[i];
        const esActual = i === actual;
        return (
          <li key={paso} className="flex items-center gap-1">
            {i > 0 && <span className={cn('h-px w-4', hechos[i - 1] ? 'bg-papel/40' : 'bg-border')} />}
            <span
              aria-current={esActual ? 'step' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1',
                hecho ? 'text-papel/80' : esActual ? 'bg-cobalto font-semibold text-white' : 'text-tenue',
              )}
            >
              {hecho ? <Check className="size-3" /> : <span className={cn('size-1.5 rounded-full', esActual ? 'bg-mostaza' : 'bg-tenue/60')} />}
              {paso}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
