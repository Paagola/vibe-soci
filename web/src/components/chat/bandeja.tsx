/**
 * Debajo del campo: las tres acciones de siempre (subir la foto, un post o carrusel, un encargo paso a paso) y «Todas
 * las herramientas», que abre un panel con buscador donde cada herramienta dice qué hace y si cuesta. Elegir una abre su
 * formulario dentro del chat.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, LayoutGrid, Loader2, Search, X } from 'lucide-react';
import type { Herramienta } from '@/lib/api';
import { cn } from '@/lib/utils';
import { iconoDe } from './iconos';

const GRUPOS: Array<{ id: Herramienta['grupo']; nombre: string; detalle: string }> = [
  { id: 'Crear', nombre: 'Crear', detalle: 'Piezas, encargos, lotes y direcciones de arte' },
  { id: 'Fotos', nombre: 'Fotos', detalle: 'Tomas nuevas, recortes y comprobaciones' },
  { id: 'Tipografía', nombre: 'Tipografía', detalle: 'Estilos especiales para el titular' },
  { id: 'Referencias', nombre: 'Referencias', detalle: 'Posts que sirven de listón' },
  { id: 'Local', nombre: 'Local', detalle: 'Alta de locales y gasto' },
];
const RAPIDAS = ['pieza', 'encargo'];

export function Bandeja(p: { herramientas: Herramienta[]; abrir: (h: Herramienta) => Promise<void>; subirFoto: () => void; verTodas: () => void; className?: string }) {
  const [abriendo, setAbriendo] = useState<string>();
  const usar = async (h: Herramienta) => {
    setAbriendo(h.id);
    try {
      await p.abrir(h);
    } finally {
      setAbriendo(undefined);
    }
  };
  const rapidas = RAPIDAS.map((id) => p.herramientas.find((h) => h.id === id)).filter((h): h is Herramienta => Boolean(h));
  return (
    <>
      <div className={cn('mx-auto flex w-full max-w-[720px] flex-wrap items-center justify-center gap-2', p.className)}>
        <Accion icono={<Camera className="size-4" />} onClick={p.subirFoto}>
          Subir foto
        </Accion>
        {rapidas.map((h) => {
          const Icono = iconoDe(h.icono);
          return (
            <Accion key={h.id} icono={abriendo === h.id ? <Loader2 className="size-4 animate-spin" /> : <Icono className="size-4" />} onClick={() => void usar(h)} disabled={Boolean(abriendo)}>
              {h.nombre}
            </Accion>
          );
        })}
        <Accion icono={<LayoutGrid className="size-4" />} onClick={p.verTodas} destacada>
          Todas las herramientas
        </Accion>
      </div>
    </>
  );
}

function Accion(p: { icono: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; destacada?: boolean }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition disabled:opacity-60',
        p.destacada ? 'border-transparent bg-secondary text-foreground hover:bg-accent' : 'hoja border-border text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <span className={p.destacada ? 'text-foreground' : 'text-tenue'}>{p.icono}</span>
      {p.children}
    </button>
  );
}

export function PanelDeHerramientas(p: { herramientas: Herramienta[]; abrir: (h: Herramienta) => Promise<void>; cerrar: () => void }) {
  const [abriendo, setAbriendo] = useState<string>();
  const usar = async (h: Herramienta) => {
    setAbriendo(h.id);
    try {
      await p.abrir(h);
      p.cerrar();
    } finally {
      setAbriendo(undefined);
    }
  };
  const [buscar, setBuscar] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    campo.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && p.cerrar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [p]);
  const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const visibles = useMemo(() => p.herramientas.filter((h) => !buscar.trim() || norm(`${h.nombre} ${h.descripcion} ${h.grupo}`).includes(norm(buscar.trim()))), [p.herramientas, buscar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6 animate-in fade-in duration-150" onClick={p.cerrar}>
      <div role="dialog" aria-modal="true" aria-label="Herramientas" onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-popover shadow-2xl sm:rounded-2xl animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Herramientas</h2>
            <p className="text-sm text-muted-foreground">Elige una y se abre su formulario en el chat.</p>
          </div>
          <button type="button" onClick={p.cerrar} aria-label="Cerrar" className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="border-b border-border px-5 py-3">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-ring">
            <Search className="size-4 text-tenue" />
            <input ref={campo} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar: recorte, tipografía, referencia…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-tenue" />
          </label>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {GRUPOS.map((g) => {
            const del = visibles.filter((h) => h.grupo === g.id);
            if (!del.length) return null;
            return (
              <section key={g.id} className="mb-5 last:mb-0">
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{g.nombre}</h3>
                  <span className="text-xs text-tenue">{g.detalle}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {del.map((h) => {
                    const Icono = iconoDe(h.icono);
                    return (
                      <button type="button" key={h.id} onClick={() => void usar(h)} disabled={Boolean(abriendo)} className="hoja group flex items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-acento/60 hover:bg-accent disabled:opacity-60">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition group-hover:text-acento">
                          {abriendo === h.id ? <Loader2 className="size-4 animate-spin" /> : <Icono className="size-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {h.nombre}
                            {h.coste ? <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">{h.coste}</span> : <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">gratis</span>}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{h.descripcion}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!visibles.length && <p className="py-8 text-center text-sm text-muted-foreground">Nada coincide con «{buscar}».</p>}
        </div>
      </div>
    </div>
  );
}
