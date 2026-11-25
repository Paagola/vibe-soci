import { useState } from 'react';
import { CalendarDays, Check, Clapperboard, GalleryHorizontalEnd, MessageSquare, Plus, Search, Square, X } from 'lucide-react';
import type { Conversacion, ResumenConversacion } from '@/lib/api';
import { cn } from '@/lib/utils';

const filtros = [
  ['todas', 'Todas'], ['post', 'Posts'], ['carrusel', 'Carruseles'], ['historia', 'Historias'],
  ['campana', 'Campañas'], ['otras', 'Otras'],
] as const;
const tipoVisible = { post: 'Post', carrusel: 'Carrusel', historia: 'Historia', campana: 'Campaña' };
const iconos = { post: Square, carrusel: GalleryHorizontalEnd, historia: Clapperboard, campana: CalendarDays };
const mes = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
const dia = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const normalizar = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function Historial({ conversaciones, actual, abrir, cerrar, gestionar }: {
  conversaciones: ResumenConversacion[]; actual?: string; abrir: (id?: string) => void;
  cerrar: () => void; gestionar: () => void;
}) {
  const [filtro, setFiltro] = useState<(typeof filtros)[number][0]>('todas');
  const [busqueda, setBusqueda] = useState('');
  const ahora = new Date();
  const grupos = new Map<string, ResumenConversacion[]>();
  for (const c of conversaciones) {
    const tipos = c.tipos ?? [];
    if (filtro === 'otras' ? tipos.length : filtro !== 'todas' && !tipos.includes(filtro)) continue;
    if (!normalizar(c.titulo + ' ' + (c.campana ?? '')).includes(normalizar(busqueda.trim()))) continue;
    const fecha = new Date(c.actualizada);
    const etiqueta = fecha.toDateString() === ahora.toDateString() ? 'Hoy' : mes.format(fecha);
    const grupo = grupos.get(etiqueta) ?? [];
    grupo.push(c);
    grupos.set(etiqueta, grupo);
  }
  return <section className="flex max-h-[85dvh] flex-col">
    <header className="grid shrink-0 gap-4 border-b border-border p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <h2 id="titulo-historial" className="mr-auto font-serif text-xl font-semibold sm:text-2xl">Conversaciones</h2>
        <button type="button" className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" onClick={() => abrir()}><Plus className="size-4" /> Nueva</button>
        <button type="button" className="rounded-lg p-2 hover:bg-accent" aria-label="Cerrar conversaciones" onClick={cerrar}><X className="size-5" /></button>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input aria-label="Buscar conversaciones" placeholder="Buscar por conversación o campaña" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de conversación">
        {filtros.map(([id, nombre]) => <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)}
          className={cn('rounded-full border border-border px-3 py-1 text-sm hover:bg-accent', filtro === id && 'bg-accent font-semibold text-acento')}>{nombre}</button>)}
      </div>
    </header>
    <div className="min-h-0 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
      {filtro === 'campana' && <button type="button" onClick={gestionar} className="text-sm font-medium text-acento underline">Abrir calendarios de campaña</button>}
      {!grupos.size && <p className="text-sm text-muted-foreground">No hay conversaciones que coincidan.</p>}
      {[...grupos].map(([fecha, lista]) => <section key={fecha}>
        <h3 className="mb-2 text-xs font-semibold capitalize text-muted-foreground">{fecha}</h3>
        <ul className="space-y-1">{lista.map(c => {
          const tipo = filtro !== 'todas' && filtro !== 'otras' ? filtro : c.tipos?.[0];
          const Icono = tipo ? iconos[tipo] : MessageSquare;
          return <li key={c.id}><button type="button" onClick={() => abrir(c.id)} aria-current={c.id === actual ? 'page' : undefined}
            className={cn('grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2 text-left hover:bg-accent', c.id === actual && 'bg-accent')}>
            <span className="rounded-lg bg-secondary p-2"><Icono className="size-4 text-acento" /></span>
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{c.titulo}</span>
              {(tipo || c.campana) && <span className="block truncate text-xs text-muted-foreground">{[tipo && tipoVisible[tipo], c.campana].filter(Boolean).join(' · ')}</span>}
            </span>
            <time className="text-xs text-muted-foreground" dateTime={c.actualizada}>{dia.format(new Date(c.actualizada))}</time>
          </button></li>;
        })}</ul>
      </section>)}
    </div>
  </section>;
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
