/**
 * La estética de referencia: antes de planificar cada post o carrusel, el estudio trae candidatas de Pinterest, de los
 * posts anteriores del local y de las referencias del estudio. El cliente elige una (o «Decide tú», o sin referencia).
 */
import { useState } from 'react';
import { Check, ExternalLink, GalleryHorizontal, Images, Loader2, Sparkles } from 'lucide-react';
import { api, type Bloque, type Conversacion } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ThinkingOrb } from '@/components/ui/ai-thiking-orb-and-input';
import { Rueda } from './rueda';

type BloqueReferencias = Extract<Bloque, { tipo: 'referencias' }>;
type Candidata = BloqueReferencias['candidatas'][number];

const SECCIONES: Array<{ id: string; nombre: string; detalle: string; de: Array<Candidata['origen']> }> = [
  { id: 'pinterest', nombre: 'Pinterest', detalle: 'Elegidas por el director entre la búsqueda', de: ['pinterest'] },
  { id: 'local', nombre: 'Del local', detalle: 'Piezas ya hechas y referencias suyas', de: ['local'] },
  { id: 'estudio', nombre: 'Del estudio', detalle: 'Biblioteca y corpus anotado', de: ['biblioteca', 'estudio'] },
];

const boton = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-9 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';

export function TarjetaReferencias(p: { conversacion: Conversacion; bloque: BloqueReferencias }) {
  const b = p.bloque;
  const [marcada, setMarcada] = useState<string>();
  const [rueda, setRueda] = useState<Candidata[]>();
  const [ocupado, setOcupado] = useState<string>();
  const [error, setError] = useState<string>();
  const elegir = async (eleccion: string) => {
    setOcupado(eleccion);
    setError(undefined);
    try {
      await api.elegirEstetica(p.conversacion.id, b.id, eleccion);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(undefined);
    }
  };
  const src = (c: Candidata) => api.archivo(p.conversacion.id, c.archivo);
  const pendiente = b.estado === 'PENDIENTE';
  const elegida = b.candidatas.find((c) => c.id === b.elegida);
  const actual = b.candidatas.find((c) => c.id === marcada);

  if (b.estado === 'BUSCANDO') {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-in fade-in">
        <div className="flex items-center gap-3">
          <ThinkingOrb labels={['Buscando en Pinterest', 'Mirando posts del local', 'Eligiendo referencias']} size={36} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Buscando la estética de referencia</div>
            {b.consultas.length > 0 && <div className="truncate text-xs text-muted-foreground">{b.consultas.map((q) => `«${q}»`).join(' · ')}</div>}
          </div>
        </div>
        {b.progreso.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {b.progreso.map((l, i) => (
              <li key={i} className={cn(i === b.progreso.length - 1 && 'text-foreground')}>
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (b.estado === 'ERROR') return <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">No se pudieron buscar referencias: {b.error}. Sigo sin ellas.</div>;

  if (!pendiente) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 animate-in fade-in">
        {elegida ? <img src={src(elegida)} alt="" className="h-16 w-13 rounded-md object-cover" /> : <span className="flex h-16 w-13 items-center justify-center rounded-md bg-muted text-muted-foreground"><Images className="size-4" /></span>}
        <div className="min-w-0 text-sm">
          <div className="font-medium">{elegida ? 'Estética de referencia elegida' : b.estado === 'DESCARTADO' ? 'Sin referencia' : 'Sin candidatas'}</div>
          {elegida && <div className="line-clamp-2 text-xs text-muted-foreground">{elegida.titulo}{elegida.motivo ? ` — ${elegida.motivo}` : ''}</div>}
        </div>
        <Check className="ml-auto size-4 shrink-0 text-exito" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Images className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Elige la estética de referencia</div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Se toma su oficio (composición, tipografía, color), nunca su contenido. {b.pedido.formato === 'carrusel' ? `Carrusel de ${b.pedido.diapositivas}` : 'Post'}.
          </p>
        </div>
        <button type="button" onClick={() => setRueda(b.candidatas)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          <GalleryHorizontal className="size-3.5" /> Ver en rueda
        </button>
      </div>
      {SECCIONES.map((s) => {
        const del = b.candidatas.filter((c) => s.de.includes(c.origen));
        if (!del.length) return null;
        return (
          <section key={s.id} className="border-t border-border px-4 py-3">
            <div className="mb-2 flex items-baseline gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.nombre}</h4>
              <span className="text-xs text-tenue">{s.detalle}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {del.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setMarcada(c.id === marcada ? undefined : c.id)}
                  aria-pressed={c.id === marcada}
                  title={c.motivo ?? c.titulo}
                  className={cn('group relative aspect-[4/5] overflow-hidden rounded-lg border-2 bg-muted transition', c.id === marcada ? 'border-acento' : 'border-transparent hover:border-border')}
                >
                  <img src={src(c)} alt={c.titulo} loading="lazy" className="size-full object-cover" />
                  {c.id === marcada && (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-acento text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                  {c === b.candidatas[0] && <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">la del director</span>}
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {actual && (
        <div className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{actual.titulo}</span>
          {actual.motivo && ` — ${actual.motivo}`}
          {actual.enlace && (
            <a href={actual.enlace} target="_blank" rel="noreferrer noopener" className="ml-2 inline-flex items-center gap-1 text-acento hover:underline">
              ver el original <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-3">
        <span className="mr-auto text-xs text-destructive">{error}</span>
        <button type="button" className={cn(boton, 'text-muted-foreground hover:bg-accent hover:text-foreground')} disabled={Boolean(ocupado)} onClick={() => void elegir('ninguna')}>
          Sin referencia
        </button>
        <button type="button" className={cn(boton, 'border border-border hover:bg-accent')} disabled={Boolean(ocupado)} onClick={() => void elegir('auto')}>
          {ocupado === 'auto' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Decide tú
        </button>
        <button type="button" className={cn(boton, 'bg-primary text-primary-foreground hover:opacity-90')} disabled={!marcada || Boolean(ocupado)} onClick={() => marcada && void elegir(marcada)}>
          {ocupado && ocupado === marcada ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Usar esta
        </button>
      </div>
      {rueda && (
        <Rueda
          titulo="Referencias"
          items={rueda.map((c) => ({ title: c.titulo, image: src(c) }))}
          vertical
          ayuda="Pulsa una para marcarla"
          alCerrar={() => setRueda(undefined)}
          alElegir={(_, i) => {
            setMarcada(rueda[i]!.id);
            setRueda(undefined);
          }}
        />
      )}
    </div>
  );
}
