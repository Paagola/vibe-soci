/** La tarjeta de una herramienta: su formulario rápido, mientras corre y su resultado. */
import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { AlertTriangle, Check, Download, Library, Loader2, Plus, X } from 'lucide-react';
import { ThinkingOrb } from '@/components/ui/ai-thiking-orb-and-input';
import { aBase64, api, type Bloque, type Campo, type Conversacion, type Herramienta, type Local, type Resultado } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Rueda } from './rueda';
import { iconoDe } from './iconos';

const marco = 'hoja rounded-xl border border-border';
const boton = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-9 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';
const principal = cn(boton, 'bg-primary text-primary-foreground hover:opacity-90');
const secundario = cn(boton, 'border border-border hover:bg-accent');
const campoCss = 'w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30';

type BloqueHerramienta = Extract<Bloque, { tipo: 'herramienta' }>;

function valorInicial(c: Campo, c0: Conversacion): unknown {
  if ('valor' in c && c.valor !== undefined) return c.valor;
  if (c.tipo === 'local') return c0.hechos?.local ?? '';
  if (c.tipo === 'imagen') return c0.hechos?.foto ?? c0.imagenes.at(-1)?.id ?? '';
  if (c.tipo === 'imagenes' || (c.tipo === 'pieza' && c.multiple)) return [];
  return '';
}

export function TarjetaHerramienta(p: { conversacion: Conversacion; bloque: BloqueHerramienta; herramienta?: Herramienta; locales: Local[] }) {
  const { conversacion: c, bloque: b, herramienta: h } = p;
  const [valores, setValores] = useState<Record<string, unknown>>(() => Object.fromEntries((h?.campos ?? []).map((x) => [x.id, b.valores[x.id] ?? valorInicial(x, c)])));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string>();
  const Icono = iconoDe(h?.icono);
  const poner = (id: string, v: unknown) => setValores((x) => ({ ...x, [id]: v }));

  const lanzar = async (descartar = false) => {
    setOcupado(true);
    setError(undefined);
    try {
      await api.lanzarHerramienta(c.id, b.id, valores, descartar);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className={cn(marco, 'overflow-hidden', b.estado === 'DESCARTADO' && 'opacity-60')}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Icono className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{h?.nombre ?? b.herramienta}</div>
          {b.estado === 'FORMULARIO' && h && <p className="text-sm text-muted-foreground">{h.descripcion}</p>}
        </div>
        {h?.coste && b.estado === 'FORMULARIO' && <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{h.coste}</span>}
      </div>

      {b.estado === 'FORMULARIO' && h && (
        <>
          <div className="grid gap-3 px-4 pb-4">
            {h.conHechos && !c.hechos && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">Antes sube la foto del plato y confirma su ficha: esta herramienta usa esos datos.</p>}
            {h.campos.map((campo) => (
              <CampoDeHerramienta key={campo.id} campo={campo} valor={valores[campo.id]} poner={(v) => poner(campo.id, v)} conversacion={c} locales={p.locales} />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-4 py-3">
            {error && <span className="mr-auto text-xs text-destructive">{error}</span>}
            <button type="button" className={secundario} disabled={ocupado} onClick={() => lanzar(true)}>
              Descartar
            </button>
            <button type="button" className={principal} disabled={ocupado} onClick={() => lanzar(false)}>
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Lanzar
            </button>
          </div>
        </>
      )}

      {b.estado === 'EN_CURSO' && (
        <div className="grid gap-2 px-4 pb-4">
          <ThinkingOrb labels={['Trabajando', 'Midiendo', 'Componiendo', 'Revisando']} />
          {b.progreso.slice(-5).map((l, i) => (
            <div key={i} className="text-xs text-muted-foreground animate-in fade-in">
              {l}
            </div>
          ))}
        </div>
      )}

      {b.estado === 'ERROR' && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {b.error}
        </div>
      )}

      {b.estado === 'HECHO' && b.resultado !== undefined && <VistaResultado conversacion={c} resultado={b.resultado} titulo={h?.nombre ?? b.herramienta} />}
      {b.estado === 'HECHO' && b.resultado === undefined && <p className="px-4 pb-4 text-sm text-muted-foreground">Hecho: sigue abajo.</p>}
    </div>
  );
}

function CampoDeHerramienta(p: { campo: Campo; valor: unknown; poner: (v: unknown) => void; conversacion: Conversacion; locales: Local[] }) {
  const { campo, valor, poner, conversacion: c } = p;
  const etiqueta = (
    <span className="text-sm font-medium text-muted-foreground">
      {campo.etiqueta}
      {'opcional' in campo && campo.opcional ? <span className="font-normal normal-case tracking-normal"> · opcional</span> : null}
    </span>
  );
  const ayuda = 'ayuda' in campo && campo.ayuda ? <span className="text-xs text-muted-foreground">{campo.ayuda}</span> : null;
  switch (campo.tipo) {
    case 'texto':
      return (
        <label className="grid gap-1">
          {etiqueta}
          <input className={campoCss} value={String(valor ?? '')} onChange={(e) => poner(e.target.value)} />
          {ayuda}
        </label>
      );
    case 'parrafo':
      return (
        <label className="grid gap-1">
          {etiqueta}
          <textarea className={cn(campoCss, 'min-h-20 resize-y')} value={String(valor ?? '')} onChange={(e) => poner(e.target.value)} />
          {ayuda}
        </label>
      );
    case 'numero':
      return (
        <label className="grid gap-1">
          {etiqueta}
          <input className={cn(campoCss, 'max-w-40')} type="number" min={campo.min} max={campo.max} step={campo.paso ?? 1} value={valor === undefined || valor === '' ? '' : Number(valor)} onChange={(e) => poner(e.target.value === '' ? '' : Number(e.target.value))} />
          {ayuda}
        </label>
      );
    case 'seleccion':
      return (
        <label className="grid gap-1">
          {etiqueta}
          <select className={campoCss} value={String(valor ?? '')} onChange={(e) => poner(e.target.value)}>
            {campo.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.nombre}
              </option>
            ))}
          </select>
          {ayuda}
        </label>
      );
    case 'casilla':
      return (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={Boolean(valor)} onChange={(e) => poner(e.target.checked)} />
          <span>
            {campo.etiqueta}
            {ayuda && <span className="block">{ayuda}</span>}
          </span>
        </label>
      );
    case 'local':
      return (
        <label className="grid gap-1">
          {etiqueta}
          <select className={campoCss} value={String(valor ?? '')} onChange={(e) => poner(e.target.value)}>
            <option value="">{campo.opcional ? 'Ninguno' : 'Elige el local'}</option>
            {p.locales.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.nombre} · {l.ciudad}
              </option>
            ))}
          </select>
        </label>
      );
    case 'imagen':
    case 'imagenes':
      return <SelectorDeImagenes campo={campo} valor={valor} poner={poner} conversacion={c} etiqueta={etiqueta} ayuda={ayuda} />;
    case 'referencia':
      return <SelectorDeReferencia valor={String(valor ?? '')} poner={poner} etiqueta={etiqueta} />;
    case 'estilo':
      return <SelectorDeEstilo valor={String(valor ?? '')} poner={poner} etiqueta={etiqueta} />;
    case 'pieza': {
      const listas = c.piezas.filter((x) => x.estado === 'LISTA');
      const elegidas = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <div className="grid gap-1.5">
          {etiqueta}
          {!listas.length && <span className="text-xs text-muted-foreground">Aún no hay piezas terminadas en esta conversación.</span>}
          <div className="flex flex-wrap gap-2">
            {listas.map((x) => {
              const portada = x.diapositivas.find((d) => d.movil ?? d.png);
              const si = elegidas.includes(x.id);
              return (
                <button type="button" key={x.id} onClick={() => poner(si ? elegidas.filter((e) => e !== x.id) : [...elegidas, x.id])} className={cn('overflow-hidden rounded-lg ring-2 transition', si ? 'ring-acento' : 'ring-transparent opacity-70 hover:opacity-100')}>
                  {portada && <img src={api.archivo(c.id, (portada.movil ?? portada.png)!)} alt={x.formato} className="h-20 w-15 object-cover" />}
                </button>
              );
            })}
          </div>
          {ayuda}
        </div>
      );
    }
  }
}

function SelectorDeImagenes(p: { campo: Extract<Campo, { tipo: 'imagen' | 'imagenes' }>; valor: unknown; poner: (v: unknown) => void; conversacion: Conversacion; etiqueta: React.ReactNode; ayuda: React.ReactNode }) {
  const multiple = p.campo.tipo === 'imagenes';
  const elegidas = multiple ? (Array.isArray(p.valor) ? (p.valor as string[]) : []) : p.valor ? [String(p.valor)] : [];
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const alternar = (id: string) => (multiple ? p.poner(elegidas.includes(id) ? elegidas.filter((e) => e !== id) : [...elegidas, id]) : p.poner(elegidas[0] === id && p.campo.opcional ? '' : id));
  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      const ids = await api.subirImagenes(p.conversacion.id, await Promise.all([...files].map(async (f) => ({ nombre: f.name, datos: await aBase64(f) }))));
      p.poner(multiple ? [...elegidas, ...ids] : ids[0]);
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <div className="grid gap-1.5">
      {p.etiqueta}
      <div className="flex flex-wrap gap-2">
        {p.conversacion.imagenes.map((i) => (
          <button type="button" key={i.id} title={i.nombre} onClick={() => alternar(i.id)} className={cn('overflow-hidden rounded-lg ring-2 transition', elegidas.includes(i.id) ? 'ring-acento' : 'ring-transparent opacity-60 hover:opacity-100')}>
            <img src={api.archivo(p.conversacion.id, i.archivo)} alt={i.nombre} className="size-16 object-cover" />
          </button>
        ))}
        <button type="button" onClick={() => archivo.current?.click()} className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-accent" aria-label="Subir una imagen">
          {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </button>
        <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} hidden onChange={(e) => void subir(e.target.files)} />
      </div>
      {p.ayuda}
    </div>
  );
}

function SelectorDeReferencia(p: { valor: string; poner: (v: unknown) => void; etiqueta: React.ReactNode }) {
  const [familias, setFamilias] = useState<Array<{ id: string; nombre: string; posts: string[] }>>([]);
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    api.biblioteca().then(setFamilias, () => {});
  }, []);
  const items = useMemo(() => familias.flatMap((f) => f.posts.map((post) => ({ title: `${post} · ${f.nombre}`, image: api.imagenBiblioteca(post), post }))), [familias]);
  return (
    <div className="grid gap-1.5">
      {p.etiqueta}
      <div className="flex items-center gap-3">
        {p.valor && <img src={api.imagenBiblioteca(p.valor)} alt={p.valor} className="h-20 w-16 rounded-lg object-cover" />}
        <button type="button" className={secundario} onClick={() => setAbierta(true)} disabled={!items.length}>
          <Library className="size-4" /> {p.valor ? 'Cambiar' : 'Elegir en la biblioteca'}
        </button>
        {p.valor && <span className="text-xs text-muted-foreground">{p.valor}</span>}
      </div>
      {abierta && (
        <Rueda
          titulo="Referencias"
          items={items}
          ayuda="Gira para ver la biblioteca · pulsa la de delante para elegirla"
          alCerrar={() => setAbierta(false)}
          alElegir={(_item, i) => {
            p.poner(items[i]!.post);
            setAbierta(false);
          }}
        />
      )}
    </div>
  );
}

function SelectorDeEstilo(p: { valor: string; poner: (v: unknown) => void; etiqueta: React.ReactNode }) {
  const [estilos, setEstilos] = useState<Array<{ id: string; nombre: string; estado: string; hoja: boolean; identidades: string[] }>>([]);
  useEffect(() => {
    api.estilos().then(setEstilos, () => {});
  }, []);
  return (
    <div className="grid gap-1.5">
      {p.etiqueta}
      <div className="grid gap-2 sm:grid-cols-2">
        {estilos.map((e) => (
          <button type="button" key={e.id} onClick={() => p.poner(e.id)} className={cn('flex items-center gap-3 rounded-xl border p-2 text-left text-sm transition', p.valor === e.id ? 'border-acento bg-acento/10' : 'border-border hover:bg-accent')}>
            {e.hoja ? <img src={api.hojaDeEstilo(e.id)} alt="" className="h-12 w-16 rounded-md object-cover" /> : <span className="flex h-12 w-16 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">Aa</span>}
            <span className="min-w-0">
              <span className="block font-medium">{e.nombre}</span>
              <span className="block text-xs text-muted-foreground">{e.estado.toLowerCase()}{e.identidades.length ? ` · ${e.identidades.slice(0, 2).join(', ')}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function VistaResultado(p: { conversacion: Conversacion; resultado: Resultado; titulo: string }) {
  const r = p.resultado;
  const [rueda, setRueda] = useState(false);
  const url = (archivo: string) => api.archivo(p.conversacion.id, archivo);
  return (
    <div className="grid gap-3 px-4 pb-4 animate-in fade-in duration-300">
      {r.texto && (
        <div className="text-sm leading-relaxed [&_p]:my-1.5 [&_strong]:font-semibold">
          <Markdown>{r.texto}</Markdown>
        </div>
      )}
      {r.imagenes.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {r.imagenes.map((i, k) => (
            <figure key={k} className="group relative overflow-hidden rounded-xl bg-muted">
              <button type="button" className="block w-full" onClick={() => setRueda(true)}>
                <img src={url(i.archivo)} alt={i.pie ?? ''} className="max-h-72 w-full object-contain transition group-hover:scale-[1.02]" />
              </button>
              {i.pie && <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">{i.pie}</figcaption>}
              <a href={url(i.archivo)} download className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100" aria-label="Descargar">
                <Download className="size-3.5" />
              </a>
            </figure>
          ))}
        </div>
      )}
      {r.lista.length > 0 && (
        <ol className="grid gap-1.5">
          {r.lista.map((x, k) => (
            <li key={k} className="rounded-xl border border-border px-3 py-2 text-sm">
              <div className="font-medium">{x.titulo}</div>
              {x.detalle && <div className="text-xs text-muted-foreground">{x.detalle}</div>}
            </li>
          ))}
        </ol>
      )}
      {r.descargas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.descargas.map((x) => (
            <a key={x.archivo} href={url(x.archivo)} download className={secundario}>
              <Download className="size-4" /> {x.nombre}
            </a>
          ))}
        </div>
      )}
      {rueda && <Rueda titulo={p.titulo} items={r.imagenes.map((i, k) => ({ title: i.pie ?? `${k + 1}`, image: url(i.archivo), href: url(i.archivo) }))} alCerrar={() => setRueda(false)} />}
    </div>
  );
}

export { X };
