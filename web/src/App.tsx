/**
 * El estudio, entero, es este chat.
 * - El historial se abre desde la cabecera del estudio.
 * - Arriba, el recorrido de la conversación (foto → ficha → plan → producción → listo): siempre sabes en qué paso estás.
 * - Portada: el orbe (escribes, piensa mientras responde el director y la respuesta se despliega) y tres maneras de
 *   empezar.
 * - Conversación: los mensajes con sus tarjetas (ficha del plato, plan, progreso, pieza, herramientas y encargos) y,
 *   debajo del campo, las acciones de siempre y «Todas las herramientas».
 * La conversación vive en el servidor y llega por SSE.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { CalendarDays, Camera, ClipboardList, GalleryHorizontalEnd, LayoutGrid, LayoutDashboard, MessagesSquare, Plus, Sparkles, Square, Wand2 } from 'lucide-react';
import { ChatCampana } from '@/components/chat/campana';
import { PanelAgencia } from '@/components/agencia';
import { PromptInput } from '@/components/ui/ai-chat-input';
import { TarjetaReferencias } from '@/components/chat/referencias';
import { TarjetaConceptos } from '@/components/chat/conceptos';
import MorphOrb from '@/components/ui/ai-thiking-orb-and-input';
import { Bandeja, PanelDeHerramientas } from '@/components/chat/bandeja';
import { TarjetaEncargo } from '@/components/chat/encargo';
import { TarjetaHerramienta } from '@/components/chat/herramienta';
import { Historial, Recorrido } from '@/components/chat/lateral';
import { AgenteTrabajando } from '@/components/chat/society';
import { MesaDeEdicion } from '@/components/chat/mesa';
import { TarjetaHechos, TarjetaPlan, TarjetaProgreso, VisorPieza } from '@/components/chat/tarjetas';
import { aBase64, api, type Bloque, type Conversacion, type Esfuerzo, type Formato, type Herramienta, type Local, type Mensaje, type ResumenConversacion } from '@/lib/api';
import { cn } from '@/lib/utils';

const PanelEstudio = lazy(() => import('@/components/panel-estudio'));

const FORMATOS: Record<string, Formato | 'auto'> = { Automático: 'auto', Post: 'post', Carrusel: 'carrusel' };
const ESFUERZOS: Record<string, Esfuerzo> = { Rápido: 'rapido', Normal: 'normal', Máximo: 'maximo' };
const ICONOS = {
  Automático: <Wand2 className="size-3.5" />,
  Post: <Square className="size-3.5" />,
  Carrusel: <GalleryHorizontalEnd className="size-3.5" />,
};

const idDeLaRuta = () => /^\/c\/([a-z0-9-]+)/.exec(location.pathname)?.[1];
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rutaCampana = '/campanas/nueva';

export default function App() {
  const [conversacion, setConversacion] = useState<Conversacion>();
  const [locales, setLocales] = useState<Local[]>([]);
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [conversaciones, setConversaciones] = useState<ResumenConversacion[]>([]);
  const [chatCampana, setChatCampana] = useState(location.pathname === rutaCampana);
  const [localChatCampana, setLocalChatCampana] = useState<string>();
  const [panel, setPanel] = useState(false);
  const [actividad, verActividad] = useState(location.pathname === '/panel');
  const [localAgencia, setLocalAgencia] = useState<string>();
  const [revision, refrescarPanel] = useState(0);
  const gestionar = (local?: string) => { setLocalAgencia(local); setAgenciaAbierta(true); };
  const nuevaCampana = (local?: string) => {
    setAgenciaAbierta(false);
    historialMovil.current?.close();
    setLocalChatCampana(local);
    setChatCampana(true);
    verActividad(false);
    setConversacion(undefined);
    if (location.pathname !== rutaCampana) history.pushState(null, '', rutaCampana);
  };
  const [agenciaAbierta, setAgenciaAbierta] = useState(false);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState('');
  const [portada, setPortada] = useState(!idDeLaRuta());
  const historialMovil = useRef<HTMLDialogElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  /** Los mensajes que ya estaban al abrir la conversación: solo los nuevos entran como una hoja que cae. */
  const iniciales = useRef<Set<string>>(new Set());
  const abierta = useRef<string | undefined>(undefined);
  if (conversacion && abierta.current !== conversacion.id) {
    abierta.current = conversacion.id;
    iniciales.current = new Set(conversacion.mensajes.map((m) => m.id));
  }
  const foto = useRef<HTMLInputElement>(null);

  const refrescarLista = useCallback(() => api.conversaciones().then(setConversaciones, () => {}), []);

  const abrir = useCallback(
    async (id?: string) => {
      historialMovil.current?.close();
      verActividad(false);
      setChatCampana(false);
      if (!id) {
        setConversacion(undefined);
        setPortada(true);
        if (location.pathname !== '/') history.pushState(null, '', '/');
        return;
      }
      try {
        setConversacion(await api.leer(id));
        setPortada(false);
        if (idDeLaRuta() !== id) history.pushState(null, '', `/c/${id}`);
      } catch {
        setConversacion(undefined);
        setPortada(true);
        history.replaceState(null, '', '/');
      }
    },
    [],
  );

  useEffect(() => {
    const sincronizar = () => {
      if (location.pathname === '/panel' || location.pathname === rutaCampana) {
        verActividad(location.pathname === '/panel');
        setChatCampana(location.pathname === rutaCampana);
      } else void abrir(idDeLaRuta());
    };
    sincronizar();
    void refrescarLista();
    api.locales().then(setLocales, (e: Error) => setError(e.message));
    api.herramientas().then(setHerramientas, () => {});
    const atras = sincronizar;
    window.addEventListener('popstate', atras);
    return () => window.removeEventListener('popstate', atras);
  }, [abrir, refrescarLista]);

  useEffect(() => {
    if (!conversacion?.id) return;
    return api.escuchar(conversacion.id, setConversacion);
  }, [conversacion?.id]);

  // El historial se pone al día cuando cambia el título de la conversación abierta.
  useEffect(() => {
    void refrescarLista();
  }, [conversacion?.id, conversacion?.titulo, refrescarLista]);

  useEffect(() => {
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!portada) fin.current?.scrollIntoView({ behavior: reducirMovimiento ? 'instant' : 'smooth', block: 'end' });
  }, [portada, conversacion?.id, conversacion?.mensajes.length, conversacion?.pensando, conversacion?.piezas.map((p) => `${p.estado}${p.progreso.length}${p.edicion ? 'e' : ''}`).join()]);

  const asegurar = async (): Promise<Conversacion> => {
    if (conversacion) return conversacion;
    const c = await api.crear();
    setConversacion(c);
    history.pushState(null, '', `/c/${c.id}`);
    return c;
  };

  const enviar = async (valor: string, meta: { model: string; effort: string; attachments: File[] }) => {
    setError(undefined);
    setEnviando(true);
    try {
      const c = await asegurar();
      const imagenes = await Promise.all(meta.attachments.map(async (f) => ({ nombre: f.name, datos: await aBase64(f) })));
      await api.enviar(c.id, { texto: valor, imagenes, formato: FORMATOS[meta.model] ?? 'auto', esfuerzo: ESFUERZOS[meta.effort] ?? 'normal' });
      setTexto('');
      setPortada(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  /** Desde el orbe: el mensaje y, cuando el director contesta, su respuesta para la tarjeta del orbe. */
  const preguntarDesdeElOrbe = async (valor: string): Promise<string> => {
    const c = await asegurar();
    await api.enviar(c.id, { texto: valor, imagenes: [], formato: 'auto', esfuerzo: 'normal' });
    for (let i = 0; i < 120; i++) {
      await esperar(1000);
      const x = await api.leer(c.id);
      const respuesta = [...x.mensajes].reverse().find((m) => m.rol === 'asistente');
      if (!x.pensando && respuesta) return respuesta.texto.replace(/[*_#>`]/g, '').slice(0, 170);
    }
    return 'Sigo con ello en el chat.';
  };

  const subirFotos = async (files: FileList | null) => {
    if (!files?.length) return;
    await enviar('Aquí tienes la foto del plato.', { model: 'Automático', effort: 'Normal', attachments: [...files] });
  };

  const abrirHerramienta = async (h: Herramienta) => {
    setError(undefined);
    try {
      const c = await asegurar();
      if (h.especial === 'encargo') await api.abrirEncargo(c.id);
      else await api.abrirHerramienta(c.id, h.id);
      setPortada(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const abrirPorId = (id: string) => {
    const h = herramientas.find((x) => x.id === id);
    if (h) void abrirHerramienta(h);
  };

  const ocupado = enviando || Boolean(conversacion?.pensando);
  const verPanel = () => {
    if (!actividad) history.pushState(null, '', '/panel');
    verActividad(true);
    setChatCampana(false);
  };

  return (
    <div className="flex h-dvh overflow-x-clip">
      <dialog ref={historialMovil} id="historial" aria-labelledby="titulo-historial"
        onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
        className="m-auto max-h-[90dvh] w-[min(42rem,94vw)] overflow-hidden rounded-2xl border border-border bg-popover text-foreground shadow-xl backdrop:bg-black/60">
        <Historial conversaciones={conversaciones} actual={actividad || chatCampana || portada ? undefined : conversacion?.id}
          abrir={id => void abrir(id)} cerrar={() => historialMovil.current?.close()}
          gestionar={() => { historialMovil.current?.close(); gestionar(); }} />
      </dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="cristal z-20 m-3 mb-0 flex min-h-14 shrink-0 flex-wrap items-center gap-x-2 gap-y-0 rounded-2xl px-3 sm:px-4">
          <button type="button" onClick={() => void abrir()} title="Nueva conversación" aria-label="Nueva conversación" className="rounded-lg p-2 hover:bg-accent"><Plus className="size-4" /></button>
          <button type="button" onClick={() => { void refrescarLista(); historialMovil.current?.showModal(); }} aria-haspopup="dialog" aria-controls="historial" className="inline-flex items-center gap-2 rounded-lg p-2 text-sm font-medium hover:bg-accent">
            <MessagesSquare className="size-4" /> Conversaciones
          </button>
          {actividad ? <span className="text-sm font-semibold">Panel del estudio</span> : chatCampana ? <span className="hidden text-sm font-semibold md:inline">Campaña</span> : portada || !conversacion ? (
            <span className="hidden text-sm font-semibold md:inline">Nueva conversación</span>
          ) : (
            <>
              <span className="hidden min-w-0 max-w-[20rem] truncate md:inline text-sm font-semibold">{conversacion.titulo}</span>
              <div className="ml-auto hidden min-w-0 md:block">
                <Recorrido c={conversacion} />
              </div>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={verPanel} className="inline-flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent" aria-label="Panel del estudio"><LayoutDashboard className="size-4" /><span className="hidden sm:inline">Panel</span></button>
            <button type="button" onClick={() => gestionar()} aria-haspopup="dialog" aria-label="Campañas" className="inline-flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent"><CalendarDays className="size-4" /><span className="hidden sm:inline">Campañas</span></button>
          </div>
        </header>

        <input ref={foto} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void subirFotos(e.target.files)} />

        {actividad ? <Suspense fallback={<p role="status" className="p-6">Cargando panel…</p>}><PanelEstudio gestionar={gestionar} revision={revision} /></Suspense> : chatCampana ? <ChatCampana key={localChatCampana ?? 'chat-campana'} localInicial={localChatCampana} alCrear={() => refrescarPanel(n => n + 1)} /> : portada ? (
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="min-h-60 flex-1">
              <MorphOrb onSubmit={preguntarDesdeElOrbe} minThinkMs={1800} onAnswered={() => setTimeout(() => setPortada(false), 2200)} onContinue={() => setPortada(false)} />
            </div>
            <div className="shrink-0 px-4 pb-6 sm:pb-8">
              <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Inicio icono={<CalendarDays className="size-5" />} titulo="Campañas del local" texto="Cuéntanos qué quieres conseguir y recibe un calendario de publicaciones." onClick={() => nuevaCampana()} />
                <Inicio icono={<Camera className="size-5" />} titulo="Empieza con una foto" texto="Sube la foto del plato: el director la mira y te propone su ficha." onClick={() => foto.current?.click()} />
                <Inicio icono={<Sparkles className="size-5" />} titulo="Post o carrusel" texto="Cada diapositiva con su foto y su diseño. Ves el plan y el coste antes." onClick={() => abrirPorId('pieza')} />
                <Inicio icono={<ClipboardList className="size-5" />} titulo="Encargo paso a paso" texto="Editorial, cartel, por capas o director F3, con todas sus paradas." onClick={() => abrirPorId('encargo')} />
              </div>
              <div className="mt-4 flex justify-center">
                <button type="button" onClick={() => setPanel(true)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <LayoutGrid className="size-4" /> Ver todas las herramientas
                </button>
              </div>
              {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
            </div>
          </main>
        ) : (
          <>
            <main key={conversacion?.id} className="min-h-0 flex-1 overflow-y-auto">
              {conversacion && (
                <div className="border-b border-border px-4 py-2 md:hidden">
                  <Recorrido c={conversacion} />
                </div>
              )}
              <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-10 pt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-8 motion-safe:duration-300">
                {conversacion?.encargoCampana && <details className="hoja rounded-xl border border-border p-4" open={!conversacion.piezas.length}>
                  <summary className="cursor-pointer font-semibold">Encargo del director · {conversacion.encargoCampana.brief?.campana ?? conversacion.titulo}</summary>
                  <p className="mt-3 whitespace-pre-line text-sm">{conversacion.encargoCampana.indicaciones}</p>
                </details>}
                {conversacion?.mensajes.map((m) => (
                  <BurbujaMensaje key={m.id} m={m} c={conversacion} locales={locales} herramientas={herramientas} nuevo={!iniciales.current.has(m.id)} />
                ))}
                {conversacion?.piezas
                  .filter((p) => p.edicion)
                  .map((p) => (
                    <MesaDeEdicion key={`edicion-${p.id}`} conversacion={conversacion} pieza={p} />
                  ))}
                <div ref={fin} />
              </div>
            </main>
            <footer className="shrink-0 space-y-3 px-4 pb-4 pt-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-8 motion-safe:duration-300">
              <AgenteTrabajando {...(conversacion ? { c: conversacion } : {})} />
              <PromptInput
                onSubmit={enviar}
                value={texto}
                onChange={setTexto}
                placeholder="Escribe al director o pide un cambio…"
                models={Object.keys(FORMATOS)}
                modelIcons={ICONOS}
                efforts={Object.keys(ESFUERZOS)}
                collapsedWidth={720}
                expandedWidth={720}
                submitDisabled={ocupado}
                className="mx-auto"
              />
              <Bandeja herramientas={herramientas} abrir={abrirHerramienta} subirFoto={() => foto.current?.click()} verTodas={() => setPanel(true)} />
              {error && <p className="text-center text-sm text-destructive">{error}</p>}
            </footer>
          </>
        )}
      </div>

      {panel && <PanelDeHerramientas herramientas={herramientas} abrir={abrirHerramienta} cerrar={() => setPanel(false)} />}
      {agenciaAbierta && <PanelAgencia localInicial={localAgencia} nueva={nuevaCampana} cerrar={() => { setAgenciaAbierta(false); refrescarPanel(n => n + 1); }} />}
    </div>
  );
}

function Inicio(p: { icono: React.ReactNode; titulo: string; texto: string; onClick: () => void }) {
  return (
    <button type="button" onClick={p.onClick} className="hoja group flex items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-acento/60 hover:bg-accent sm:flex-col sm:p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition group-hover:text-acento">{p.icono}</span>
      <span className="grid gap-1">
        <span className="text-sm font-semibold">{p.titulo}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">{p.texto}</span>
      </span>
    </button>
  );
}

function BurbujaMensaje({ m, c, locales, herramientas, nuevo }: { m: Mensaje; c: Conversacion; locales: Local[]; herramientas: Herramienta[]; nuevo: boolean }) {
  const imagenes = m.imagenes.map((id) => c.imagenes.find((i) => i.id === id)).filter((i): i is Conversacion['imagenes'][number] => Boolean(i));
  if (m.rol === 'usuario') {
    return (
      <div className={cn('flex flex-col items-end gap-2', nuevo && 'hoja-entra')}>
        {imagenes.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {imagenes.map((i) => (
              <img key={i.id} src={api.archivo(c.id, i.archivo)} alt={i.nombre} className="h-40 max-w-56 rounded-xl border border-border object-cover" />
            ))}
          </div>
        )}
        {m.texto && <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-cobalto px-4 py-2.5 text-sm font-medium wrap-anywhere text-white">{m.texto}</div>}
      </div>
    );
  }
  return (
    <div className={cn('flex gap-3', nuevo && 'hoja-entra')}>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-papel font-[family-name:var(--font-serif)] text-base font-extrabold italic text-tinta" aria-hidden="true">
        s
      </span>
      <div className="grid min-w-0 flex-1 gap-3">
        {m.texto && (
          <div className="max-w-[68ch] text-[15px] leading-relaxed wrap-anywhere text-foreground [&_a]:text-acento [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_pre]:overflow-x-auto [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
            <Markdown>{m.texto}</Markdown>
          </div>
        )}
        {m.bloques.map((b) => (
          <BloqueDelMensaje key={b.id} b={b} c={c} locales={locales} herramientas={herramientas} />
        ))}
      </div>
    </div>
  );
}

function BloqueDelMensaje({ b, c, locales, herramientas }: { b: Bloque; c: Conversacion; locales: Local[]; herramientas: Herramienta[] }) {
  const pieza = 'pieza' in b ? c.piezas.find((p) => p.id === b.pieza) : undefined;
  switch (b.tipo) {
    case 'hechos':
      return <TarjetaHechos conversacion={c} bloque={b} locales={locales} />;
    case 'plan':
      return pieza ? <TarjetaPlan conversacion={c} bloque={b} pieza={pieza} /> : null;
    case 'progreso':
      return <TarjetaProgreso conversacion={c} {...(pieza ? { pieza } : {})} />;
    case 'pieza':
      return pieza ? <VisorPieza conversacion={c} pieza={pieza} mostrar={b.mostrar} /> : null;
    case 'herramienta': {
      const h = herramientas.find((x) => x.id === b.herramienta);
      return <TarjetaHerramienta conversacion={c} bloque={b} locales={locales} {...(h ? { herramienta: h } : {})} />;
    }
    case 'referencias':
      return <TarjetaReferencias conversacion={c} bloque={b} />;
    case 'conceptos':
      return <TarjetaConceptos conversacion={c} bloque={b} />;
    case 'encargo':
      return <TarjetaEncargo conversacion={c} bloque={b} locales={locales} />;
    case 'error':
      return <div className={cn('rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive')}>{b.texto}</div>;
  }
}
