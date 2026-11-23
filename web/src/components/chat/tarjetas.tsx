/** Las tarjetas que el director pone dentro de sus mensajes: hechos del plato, plan de la pieza, progreso y resultado. */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, Check, ChevronLeft, ChevronRight, Download, GalleryHorizontal, ImageIcon, Loader2, Minus, Plus, Sparkles, X } from 'lucide-react';
import { api, type Conversacion, type Elemento, type Hechos, type Local, type Pieza } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Rueda } from './rueda';

const marco = 'rounded-xl border border-border bg-card text-card-foreground';
const boton = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-9 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';
const principal = cn(boton, 'bg-primary text-primary-foreground hover:opacity-90');
const secundario = cn(boton, 'border border-border hover:bg-accent');
const campo = 'w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30';
const usd = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>;
}

function useEnvio() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string>();
  const enviar = async (f: () => Promise<unknown>) => {
    setOcupado(true);
    setError(undefined);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  return { ocupado, error, enviar };
}

// ------------------------------------------------------------------ Hechos del plato

export function TarjetaHechos(p: { conversacion: Conversacion; bloque: { id: string; estado: string; propuesta: Hechos }; locales: Local[] }) {
  const [h, setH] = useState<Hechos>(p.bloque.propuesta);
  const { ocupado, error, enviar } = useEnvio();
  const pendiente = p.bloque.estado === 'PENDIENTE';
  const img = (id?: string) => p.conversacion.imagenes.find((i) => i.id === id);
  const foto = img(h.foto);
  const ref = img(h.referencia);
  const cambiar = (i: number, e: Partial<Elemento>) => setH({ ...h, elementos: h.elementos.map((x, k) => (k === i ? { ...x, ...e } : x)) });
  const local = p.locales.find((l) => l.slug === h.local);

  if (!pendiente) {
    return (
      <div className={cn(marco, 'flex items-center gap-3 p-3 text-sm', p.bloque.estado === 'DESCARTADO' && 'opacity-60')}>
        {foto && <img src={api.archivo(p.conversacion.id, foto.archivo)} alt="" className="size-10 rounded-lg object-cover" />}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            {p.bloque.estado === 'HECHO' ? <Check className="size-4 text-exito" /> : <X className="size-4" />}
            {h.plato}
          </div>
          <div className="truncate text-muted-foreground">
            {local?.nombre ?? h.local} · {h.elementos.map((e) => `${e.recuento ? `${e.recuento} ` : ''}${e.nombre}`).join(', ')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(marco, 'overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300')}>
      <div className="flex gap-4 p-4">
        {foto && (
          <div className="flex shrink-0 flex-col gap-2">
            <img src={api.archivo(p.conversacion.id, foto.archivo)} alt="La foto del plato" className="h-32 w-24 rounded-xl object-cover" />
            {ref && (
              <div className="relative">
                <img src={api.archivo(p.conversacion.id, ref.archivo)} alt="La referencia" className="h-16 w-24 rounded-lg object-cover opacity-80" />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">referencia</span>
              </div>
            )}
          </div>
        )}
        <div className="grid min-w-0 flex-1 gap-3">
          <div className="grid gap-1">
            <Etiqueta>Local</Etiqueta>
            <select className={campo} value={h.local} onChange={(e) => setH({ ...h, local: e.target.value })}>
              {!local && <option value={h.local}>{h.local}</option>}
              {p.locales.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.nombre} · {l.ciudad}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Etiqueta>Plato</Etiqueta>
            <input className={campo} value={h.plato} onChange={(e) => setH({ ...h, plato: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="grid gap-2 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Etiqueta>Lo que se ve en el plato</Etiqueta>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setH({ ...h, elementos: [...h.elementos, { nombre: '', estado: '', recuento: null }] })}>
            <Plus className="inline size-3.5" /> Añadir
          </button>
        </div>
        {h.elementos.map((e, i) => (
          <div key={i} className="grid grid-cols-[3.5rem_1fr_1.4fr_auto] items-center gap-2">
            <input className={cn(campo, 'px-2 text-center')} inputMode="numeric" placeholder="nº" value={e.recuento ?? ''} onChange={(x) => cambiar(i, { recuento: x.target.value ? Math.max(1, Number.parseInt(x.target.value, 10) || 1) : null })} />
            <input className={campo} placeholder="elemento" value={e.nombre} onChange={(x) => cambiar(i, { nombre: x.target.value })} />
            <input className={campo} placeholder="cómo está" value={e.estado} onChange={(x) => cambiar(i, { estado: x.target.value })} />
            <button type="button" aria-label="Quitar" className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setH({ ...h, elementos: h.elementos.filter((_, k) => k !== i) })}>
              <Minus className="size-4" />
            </button>
          </div>
        ))}
        <div className="mt-1 grid gap-1">
          <Etiqueta>Qué quiere contar el local</Etiqueta>
          <textarea className={cn(campo, 'min-h-16 resize-y')} value={h.mensaje} onChange={(e) => setH({ ...h, mensaje: e.target.value })} />
        </div>
        <p className="text-xs text-muted-foreground">Los textos de las piezas solo dirán lo que pongas aquí. Corrige lo que no sea exacto.</p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-4 py-3">
        {error && <span className="mr-auto text-xs text-destructive">{error}</span>}
        <button type="button" className={secundario} disabled={ocupado} onClick={() => enviar(() => api.hechos(p.conversacion.id, p.bloque.id, { confirmar: false }))}>
          Descartar
        </button>
        <button type="button" className={principal} disabled={ocupado || !h.plato.trim() || !h.elementos.some((e) => e.nombre.trim())} onClick={() => enviar(() => api.hechos(p.conversacion.id, p.bloque.id, { confirmar: true, hechos: { ...h, elementos: h.elementos.filter((e) => e.nombre.trim()) } }))}>
          {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmar
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Plan de la pieza

const PAPEL: Record<string, string> = { portada: 'Portada', detalle: 'Detalle', ambiente: 'Ambiente', proceso: 'Proceso', dato: 'Dato', cierre: 'Cierre', post: 'Post' };

export function TarjetaPlan(p: { conversacion: Conversacion; bloque: { id: string; estado: string }; pieza: Pieza }) {
  const { ocupado, error, enviar } = useEnvio();
  const plan = p.pieza.plan;
  if (!plan) return null;
  const pendiente = p.bloque.estado === 'PENDIENTE';
  const nuevas = plan.diapositivas.filter((d, i) => d.visual.foto === 'generada' && (!p.pieza.rehacer.length || p.pieza.rehacer.includes(i + 1))).length;
  const real = p.conversacion.imagenes.find((i) => i.id === p.conversacion.hechos?.foto);
  return (
    <div className={cn(marco, 'overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300', p.bloque.estado === 'DESCARTADO' && 'opacity-60')}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {p.pieza.formato === 'carrusel' ? `Carrusel de ${plan.diapositivas.length}` : 'Post'}
            {p.pieza.base && <span className="font-normal text-muted-foreground"> · ajuste{p.pieza.rehacer.length ? ` de la ${p.pieza.rehacer.join(', ')}` : ''}</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{plan.idea}</p>
        </div>
      </div>
      <ol className="grid gap-px border-t border-border bg-border">
        {plan.diapositivas.map((d, i) => {
          const rehace = !p.pieza.rehacer.length || p.pieza.rehacer.includes(i + 1);
          return (
            <li key={i} className={cn('flex items-center gap-3 bg-card px-4 py-2.5', !rehace && 'opacity-45')}>
              <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              {d.visual.foto === 'real' && real ? (
                <img src={api.archivo(p.conversacion.id, real.archivo)} alt="" className="size-9 rounded-md object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Camera className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm">{d.resumen}</div>
                <div className="text-xs text-muted-foreground">
                  {PAPEL[d.papel] ?? d.papel} · {d.visual.foto === 'real' ? 'tu foto' : 'foto nueva'} · {d.visual.receta.esqueleto.toLowerCase().replace(/_/g, ' ')}
                  {!rehace && ' · se queda igual'}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-3">
        <span className="mr-auto text-xs text-muted-foreground">
          {nuevas} foto{nuevas === 1 ? '' : 's'} nueva{nuevas === 1 ? '' : 's'} · ≈ {usd(p.pieza.costeEstimadoUsd)}
          {error && <span className="ml-2 text-destructive">{error}</span>}
        </span>
        {pendiente ? (
          <>
            <button type="button" className={secundario} disabled={ocupado} onClick={() => enviar(() => api.plan(p.conversacion.id, p.bloque.id, false))}>
              Descartar
            </button>
            <button type="button" className={principal} disabled={ocupado} onClick={() => enviar(() => api.plan(p.conversacion.id, p.bloque.id, true))}>
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Producir
            </button>
          </>
        ) : (
          <span className="text-xs font-medium">{p.bloque.estado === 'HECHO' ? 'Aprobado' : 'Descartado'}</span>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Progreso

export function TarjetaProgreso(p: { pieza?: Pieza }) {
  const pasos = p.pieza?.progreso ?? [];
  // Solo mientras se planifica o se produce (y si algo falla): lo terminado ya lo enseñan el plan y el visor.
  const visible = !p.pieza || p.pieza.estado === 'PRODUCIENDO' || p.pieza.estado === 'ERROR' || (p.pieza.estado === 'PROPUESTA' && !p.pieza.plan);
  if (!visible) return null;
  return (
    <div className={cn(marco, 'grid gap-1.5 p-4 text-sm')}>
      {pasos.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Preparando…
        </div>
      )}
      {pasos.map((x, i) => (
        <div key={i} className={cn('flex items-center gap-2', x.estado === 'hecho' && 'text-muted-foreground')}>
          {x.estado === 'en-curso' ? <Loader2 className="size-4 animate-spin text-acento" /> : x.estado === 'hecho' ? <Check className="size-4 text-exito" /> : <AlertTriangle className="size-4 text-destructive" />}
          {x.texto}
        </div>
      ))}
      {p.pieza?.error && <div className="text-destructive">{p.pieza.error}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ La pieza terminada

export function VisorPieza(p: { conversacion: Conversacion; pieza: Pieza }) {
  const listas = useMemo(() => p.pieza.diapositivas.filter((d) => d.png), [p.pieza.diapositivas]);
  const [i, setI] = useState(0);
  const [grande, setGrande] = useState(false);
  const [rueda, setRueda] = useState(false);
  useEffect(() => {
    if (!grande) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGrande(false);
      if (e.key === 'ArrowRight') setI((x) => Math.min(listas.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [grande, listas.length]);
  if (!listas.length) return <div className={cn(marco, 'p-4 text-sm text-destructive')}>{p.pieza.error ?? 'No hay diapositivas.'}</div>;
  const actual = listas[Math.min(i, listas.length - 1)]!;
  const url = (r?: string) => (r ? api.archivo(p.conversacion.id, r) : '');
  const resumen = p.pieza.plan?.diapositivas[actual.n - 1]?.resumen;

  const flechas = (clase = '') => (
    <>
      {i > 0 && (
        <button type="button" aria-label="Anterior" onClick={(e) => (e.stopPropagation(), setI(i - 1))} className={cn('absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white backdrop-blur hover:bg-black/60', clase)}>
          <ChevronLeft className="size-5" />
        </button>
      )}
      {i < listas.length - 1 && (
        <button type="button" aria-label="Siguiente" onClick={(e) => (e.stopPropagation(), setI(i + 1))} className={cn('absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white backdrop-blur hover:bg-black/60', clase)}>
          <ChevronRight className="size-5" />
        </button>
      )}
    </>
  );

  return (
    <div className={cn(marco, 'overflow-hidden animate-in fade-in zoom-in-95 duration-300')}>
      <div className="flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative mx-auto w-full max-w-[320px] shrink-0 cursor-zoom-in" onClick={() => setGrande(true)}>
          <img key={actual.n} src={url(actual.movil ?? actual.png)} alt={resumen ?? `Diapositiva ${actual.n}`} className="aspect-[3/4] w-full rounded-xl object-cover animate-in fade-in duration-200" />
          {flechas()}
          {listas.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">{i + 1}/{listas.length}</span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <div className="text-sm font-semibold">{p.pieza.formato === 'carrusel' ? 'Carrusel' : 'Post'} · diapositiva {actual.n}</div>
            {resumen && <p className="text-sm text-muted-foreground">{resumen}</p>}
            {actual.problemas.length > 0 && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-500">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> El código midió: {actual.problemas[0]}
              </p>
            )}
          </div>
          {listas.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {listas.map((d, k) => (
                <button type="button" key={d.n} onClick={() => setI(k)} className={cn('overflow-hidden rounded-md ring-2 ring-transparent transition', k === i ? 'ring-acento' : 'opacity-60 hover:opacity-100')}>
                  <img src={url(d.movil ?? d.png)} alt="" className="h-16 w-12 object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <a className={secundario} href={url(actual.png)} download={`${p.pieza.id}-${String(actual.n).padStart(2, '0')}.png`}>
              <Download className="size-4" /> Esta
            </a>
            {listas.length > 1 && (
              <button type="button" className={secundario} onClick={() => listas.forEach((d, k) => setTimeout(() => descargar(url(d.png), `${p.pieza.id}-${String(d.n).padStart(2, '0')}.png`), k * 250))}>
                <ImageIcon className="size-4" /> Todas
              </button>
            )}
            {listas.length > 1 && (
              <button type="button" className={secundario} onClick={() => setRueda(true)}>
                <GalleryHorizontal className="size-4" /> Ver en rueda
              </button>
            )}
            {p.pieza.costeRealUsd !== undefined && <span className="text-xs text-muted-foreground">Fotos: {usd(p.pieza.costeRealUsd)}</span>}
          </div>
        </div>
      </div>
      {rueda && (
        <Rueda
          titulo={p.pieza.formato === 'carrusel' ? 'Carrusel' : 'Post'}
          items={listas.map((d) => ({ title: `${d.n}. ${p.pieza.plan?.diapositivas[d.n - 1]?.resumen ?? ''}`.slice(0, 60), image: url(d.png), href: url(d.png) }))}
          alCerrar={() => setRueda(false)}
        />
      )}
      {grande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setGrande(false)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img src={url(actual.png)} alt="" className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain" />
            {flechas('p-2')}
          </div>
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setGrande(false)}>
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function descargar(href: string, nombre: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = nombre;
  a.click();
}
