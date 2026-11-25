/**
 * El concepto de la serie: antes del plan, el director propone tres maneras distintas de contar el plato (historia,
 * fotografía y titular de portada). El cliente elige una o deja que decida el director.
 */
import { useState } from 'react';
import { Check, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import { api, type Bloque, type Conversacion } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ThinkingOrb } from '@/components/ui/ai-thiking-orb-and-input';
import { Titular } from './society';

type BloqueConceptos = Extract<Bloque, { tipo: 'conceptos' }>;

const boton = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-9 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';
const formatoDelConcepto = (n: number) => n === 1 ? 'Post' : `Carrusel de ${n} láminas`;

export function TarjetaConceptos(p: { conversacion: Conversacion; bloque: BloqueConceptos }) {
  const b = p.bloque;
  const [ocupado, setOcupado] = useState<number | 'auto'>();
  const [error, setError] = useState<string>();
  const elegir = async (eleccion: number | 'auto') => {
    setOcupado(eleccion);
    setError(undefined);
    try {
      await api.elegirConcepto(p.conversacion.id, b.id, eleccion);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(undefined);
    }
  };

  const esPost = b.pedido?.formato === 'post';
  if (b.estado === 'BUSCANDO') {
    return (
      <div className="hoja flex items-center gap-3 rounded-xl border border-border p-4 animate-in fade-in">
        <ThinkingOrb labels={['Pensando tres ideas', 'Buscando otra mirada', 'Eligiendo titulares']} size={36} />
        <div className="text-sm font-semibold">{esPost ? "Eligiendo el concepto del post" : "Tres maneras de contarlo"}</div>
      </div>
    );
  }
  if (b.estado === 'ERROR') return <div className="hoja rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">No se pudieron proponer conceptos: {b.error}. Planifico sin ellos.</div>;
  if (b.estado === 'HECHO') {
    const c = b.conceptos[b.elegido ?? 0];
    return (
      <div className="hoja flex items-start gap-3 rounded-xl border border-border p-3 animate-in fade-in">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-acento" />
        <div className="min-w-0 text-sm">
          <div className="font-medium">Concepto elegido · {c?.nombre}</div>
          {c && <>
            <div className="mt-1 text-sm font-semibold">«{c.titular}»</div>
            <p className="mt-1 text-sm text-muted-foreground">{c.idea}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.fotografia}</p>
          </>}
        </div>
        <Check className="ml-auto size-4 shrink-0 text-exito" />
      </div>
    );
  }
  if (esPost && b.conceptos[0]) return <div className="hoja space-y-2 rounded-xl border border-border p-4">
    <h3 className="text-sm font-semibold">{b.conceptos[0].nombre} · «{b.conceptos[0].titular}»</h3>
    <p className="text-sm text-muted-foreground">{b.conceptos[0].idea}</p>
    <button type="button" className={cn(boton, 'bg-primary text-primary-foreground')} disabled={ocupado !== undefined} onClick={() => void elegir('auto')}>Preparar esta propuesta</button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;

  return (
    <div className="hoja overflow-hidden rounded-xl border border-border">
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Lightbulb className="size-4" />
        </div>
        <div>
          <Titular grande="Elige" cursiva="el concepto" />
          <p className="mt-0.5 text-sm text-muted-foreground">Tres maneras distintas de contar el plato: la historia, cómo se fotografía y el titular de portada.</p>
        </div>
      </div>
      <div className="grid gap-px border-t border-border bg-border md:grid-cols-3">
        {b.conceptos.map((c, i) => (
          <div key={i} className="flex flex-col gap-2 bg-card p-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-cobalto">{c.nombre}</div>
            <div className="rounded-xl bg-cobalto px-3 py-3 font-display text-[28px] text-white">{c.titular}</div>
            <p className="text-sm text-muted-foreground">{c.idea}</p>
            <p className="text-xs text-tenue">
              <span className="font-medium text-muted-foreground">Fotografía: </span>
              {c.fotografia}
            </p>
            <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
              {c.laminas.map((l, k) => (
                <li key={k}>{l}</li>
              ))}
            </ol>
            <button type="button" className={cn(boton, 'mt-auto h-10 rounded-full border-2 border-cobalto font-semibold text-cobalto hover:bg-cobalto hover:text-white')} disabled={ocupado !== undefined} onClick={() => void elegir(i)}>
              {ocupado === i ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Elegir {formatoDelConcepto(c.laminas.length).toLowerCase()}
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-3">
        <span className="mr-auto text-xs text-destructive">{error}</span>
        <button type="button" className={cn(boton, 'h-11 rounded-full bg-primary px-6 font-display text-[17px] tracking-wide text-primary-foreground hover:brightness-95')} disabled={ocupado !== undefined} onClick={() => void elegir('auto')}>
          {ocupado === 'auto' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Decide tú
        </button>
      </div>
    </div>
  );
}
