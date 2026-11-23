/**
 * La tarjeta del encargo paso a paso (la orden de El pase): sin encargo, el alta con una foto del chat (o retomar uno
 * de los que ya hay); con encargo, las fichas de la orden montadas dentro (legacy/encargo.js), con todas sus paradas.
 */
import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Loader2, Plus } from 'lucide-react';
import { aBase64, api, type Bloque, type Conversacion, type Local } from '@/lib/api';
import { cn } from '@/lib/utils';
import { montarEncargo } from '@/legacy/encargo.js';
import '@/legacy/legado.css';

const marco = 'rounded-xl border border-border bg-card text-card-foreground';
const boton = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-9 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';
const principal = cn(boton, 'bg-primary text-primary-foreground hover:opacity-90');
const secundario = cn(boton, 'border border-border hover:bg-accent');
const campo = 'w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30';

export const MODOS: Array<{ valor: string; nombre: string; detalle: string; cuerpo: Record<string, unknown> }> = [
  { valor: 'editorial', nombre: 'Post editorial', detalle: 'Una toma nueva del plato (otro ángulo, otra luz y otra puesta) y el título sobre la foto.', cuerpo: { arte: 'EDITORIAL', formato: 'post' } },
  { valor: 'carrusel-editorial', nombre: 'Carrusel editorial', detalle: 'El guion de un carrusel con tomas dirigidas, láminas y revisión a 360 px.', cuerpo: { arte: 'EDITORIAL', formato: 'carrusel' } },
  { valor: 'integrado', nombre: 'Cartel integrado', detalle: 'Un cartel con referencia: dirección, muestras del producto y aprobación.', cuerpo: { arte: 'INTEGRADO', formato: 'post' } },
  { valor: 'capas', nombre: 'Post por capas', detalle: 'El productor: inventario confirmado, plan editorial y crítica del render.', cuerpo: { productorEditorial: true, formato: 'post' } },
  { valor: 'carrusel-capas', nombre: 'Carrusel por capas', detalle: 'Portada, detalles y cierre con el productor.', cuerpo: { productorEditorial: true, formato: 'carrusel' } },
  { valor: 'f3', nombre: 'Post con el director F3', detalle: 'El director de diseño elige el mecanismo (titular detrás, plato sobre color, anotaciones, sello…).', cuerpo: { formato: 'post' } },
  { valor: 'carrusel-f3', nombre: 'Carrusel con el director F3', detalle: 'Con varias tomas de detalle y tus fotos de más para los detalles.', cuerpo: { formato: 'carrusel' } },
];

const ESTETICAS = [
  ['', 'A partir de la referencia'],
  ['EDITORIAL_SERENO', 'Editorial sereno'],
  ['EDITORIAL_OSCURO', 'Editorial oscuro'],
  ['COLOR_POP', 'Color pop'],
  ['MAXIMALISMO', 'Maximalismo'],
  ['MEDITERRANEO_LUMINOSO', 'Mediterráneo luminoso'],
  ['RUSTICO_FUEGO', 'Rústico de fuego'],
];

export function TarjetaEncargo(p: { conversacion: Conversacion; bloque: Extract<Bloque, { tipo: 'encargo' }>; locales: Local[] }) {
  const { conversacion: c, bloque: b } = p;
  return (
    <div className={cn(marco, 'overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300')}>
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <ClipboardList className="size-4" />
        </span>
        <div className="text-sm font-semibold">Encargo paso a paso</div>
        {b.proyecto && <span className="ml-auto truncate text-xs text-muted-foreground">{b.proyecto}</span>}
      </div>
      {b.proyecto ? <EncargoMontado proyecto={b.proyecto} /> : <AltaDeEncargo conversacion={c} bloque={b} locales={p.locales} />}
    </div>
  );
}

function EncargoMontado(p: { proyecto: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!raiz.current) return;
    const control = montarEncargo(raiz.current, { proyecto: p.proyecto, alCrear: undefined, alCambiar: undefined });
    return () => control.cerrar();
  }, [p.proyecto]);
  return <div ref={raiz} className="legado p-4" />;
}

function AltaDeEncargo(p: { conversacion: Conversacion; bloque: Extract<Bloque, { tipo: 'encargo' }>; locales: Local[] }) {
  const c = p.conversacion;
  const [modo, setModo] = useState(p.bloque.modo && MODOS.some((m) => m.valor === p.bloque.modo) ? p.bloque.modo : 'editorial');
  const [foto, setFoto] = useState(c.hechos?.foto ?? c.imagenes.at(-1)?.id ?? '');
  const [local, setLocal] = useState(c.hechos?.local ?? p.locales[0]?.slug ?? '');
  const [plato, setPlato] = useState(c.hechos?.plato ?? '');
  const [estetica, setEstetica] = useState('');
  const [uso, setUso] = useState('PUBLICABLE');
  const [elegirReferencia, setElegirReferencia] = useState(false);
  const [estiloReferencia, setEstiloReferencia] = useState(false);
  const [creativo, setCreativo] = useState(false);
  const [extras, setExtras] = useState<Array<{ imagen: string; elemento: string }>>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string>();
  const [encargos, setEncargos] = useState<Awaited<ReturnType<typeof api.encargos>>>([]);
  const [retomar, setRetomar] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const m = MODOS.find((x) => x.valor === modo)!;
  const editorial = modo.includes('editorial');
  const conExtras = modo === 'carrusel-f3';

  useEffect(() => {
    if (!local && p.locales[0]) setLocal(p.locales[0].slug);
  }, [p.locales, local]);
  useEffect(() => {
    if (retomar) api.encargos().then(setEncargos, () => {});
  }, [retomar]);

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    const ids = await api.subirImagenes(c.id, await Promise.all([...files].map(async (f) => ({ nombre: f.name, datos: await aBase64(f) }))));
    setFoto(ids[0]!);
  };

  const crear = async () => {
    setOcupado(true);
    setError(undefined);
    try {
      const img = c.imagenes.find((i) => i.id === foto);
      if (!img) throw new Error('Elige la foto del encargo.');
      if (plato.trim().length < 3) throw new Error('Describe el plato o lo que se ve (mínimo 3 caracteres).');
      const subidaId = await api.subidaDesde(api.archivo(c.id, img.archivo), img.nombre);
      const extrasIds: string[] = [];
      for (const x of conExtras ? extras.filter((e) => e.imagen) : []) {
        const i = c.imagenes.find((y) => y.id === x.imagen)!;
        extrasIds.push(await api.subidaDesde(api.archivo(c.id, i.archivo), i.nombre));
      }
      const proyecto = await api.crearEncargo({
        subidaId,
        local,
        plato: plato.trim(),
        usoFotoReal: uso,
        ...m.cuerpo,
        ...(estetica ? { estetica } : {}),
        ...(editorial && elegirReferencia ? { elegirReferenciaAlAbrir: true } : {}),
        ...(estiloReferencia ? { estiloDeReferencia: true } : {}),
        ...(creativo ? { titularCreativo: true } : {}),
        ...(extrasIds.length ? { extrasIds, elementosExtra: extras.filter((e) => e.imagen).map((e) => e.elemento) } : {}),
      });
      await api.vincularEncargo(c.id, p.bloque.id, proyecto);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  if (retomar) {
    return (
      <div className="grid gap-2 p-4">
        {encargos.length === 0 && <p className="text-sm text-muted-foreground">Cargando encargos…</p>}
        <ul className="grid max-h-80 gap-1.5 overflow-y-auto">
          {encargos.map((e) => (
            <li key={e.proyecto}>
              <button type="button" onClick={() => void api.vincularEncargo(c.id, p.bloque.id, e.proyecto)} className="flex w-full items-center gap-3 rounded-xl border border-border p-2 text-left text-sm hover:bg-accent">
                {e.miniatura ? <img src={e.miniatura} alt="" className="size-11 rounded-lg object-cover" /> : <span className="size-11 rounded-lg bg-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.plato}</span>
                  <span className="block truncate text-xs text-muted-foreground">{e.nombreLocal ?? e.local}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">{e.paso.toLowerCase().replace(/_/g, ' ')}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={cn(secundario, 'justify-self-start')} onClick={() => setRetomar(false)}>
          Crear uno nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {MODOS.map((x) => (
          <button type="button" key={x.valor} onClick={() => setModo(x.valor)} className={cn('rounded-xl border p-3 text-left transition', modo === x.valor ? 'border-acento bg-acento/10' : 'border-border hover:bg-accent')}>
            <span className="block text-sm font-medium">{x.nombre}</span>
            <span className="block text-xs text-muted-foreground">{x.detalle}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Foto</span>
        <div className="flex flex-wrap gap-2">
          {c.imagenes.map((i) => (
            <button type="button" key={i.id} onClick={() => setFoto(i.id)} className={cn('overflow-hidden rounded-lg ring-2 transition', foto === i.id ? 'ring-acento' : 'ring-transparent opacity-60 hover:opacity-100')}>
              <img src={api.archivo(c.id, i.archivo)} alt={i.nombre} className="size-16 object-cover" />
            </button>
          ))}
          <button type="button" onClick={() => archivo.current?.click()} aria-label="Subir una foto" className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-accent">
            <Plus className="size-4" />
          </button>
          <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void subir(e.target.files)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Local</span>
          <select className={campo} value={local} onChange={(e) => setLocal(e.target.value)}>
            {p.locales.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estética</span>
          <select className={campo} value={estetica} onChange={(e) => setEstetica(e.target.value)}>
            {ESTETICAS.map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qué quieres mostrar</span>
        <input className={campo} value={plato} onChange={(e) => setPlato(e.target.value)} placeholder="Ej. Croquetas de jamón con un tinto" />
      </label>

      <details className="rounded-xl border border-border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Opciones</summary>
        <div className="mt-2 grid gap-2">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Uso de la foto</span>
            <select className={campo} value={uso} onChange={(e) => setUso(e.target.value)}>
              <option value="PUBLICABLE">Foto del local (publicable)</option>
              <option value="SOLO_PRUEBA_COMPOSICION">Solo para una prueba</option>
            </select>
          </label>
          {editorial && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={elegirReferencia} onChange={(e) => setElegirReferencia(e.target.checked)} /> Elegir una referencia propia o de biblioteca al abrir
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={estiloReferencia} onChange={(e) => setEstiloReferencia(e.target.checked)} /> El generador ve también la referencia, solo de estilo (@image2)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={creativo} onChange={(e) => setCreativo(e.target.checked)} /> Titular creativo (un copy con idea, sin afirmar nada que no conste)
          </label>
          {conExtras && (
            <div className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tus fotos de más para los detalles (hasta 3)</span>
              {extras.map((x, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className={cn(campo, 'max-w-40')} value={x.imagen} onChange={(e) => setExtras(extras.map((y, k) => (k === i ? { ...y, imagen: e.target.value } : y)))}>
                    <option value="">Foto…</option>
                    {c.imagenes.filter((im) => im.id !== foto).map((im) => (
                      <option key={im.id} value={im.id}>
                        {im.nombre}
                      </option>
                    ))}
                  </select>
                  <input className={campo} placeholder="Qué enseña (ej. el corte de la croqueta)" value={x.elemento} onChange={(e) => setExtras(extras.map((y, k) => (k === i ? { ...y, elemento: e.target.value } : y)))} />
                </div>
              ))}
              {extras.length < 3 && (
                <button type="button" className={cn(secundario, 'justify-self-start')} onClick={() => setExtras([...extras, { imagen: '', elemento: '' }])}>
                  <Plus className="size-4" /> Añadir foto
                </button>
              )}
            </div>
          )}
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && <span className="mr-auto text-xs text-destructive">{error}</span>}
        <button type="button" className={secundario} onClick={() => setRetomar(true)}>
          Retomar uno
        </button>
        <button type="button" className={principal} disabled={ocupado || !foto || !local} onClick={() => void crear()}>
          {ocupado ? <Loader2 className="size-4 animate-spin" /> : null} Crear encargo
        </button>
      </div>
    </div>
  );
}
