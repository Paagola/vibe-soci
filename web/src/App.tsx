/**
 * El estudio, entero, es este chat.
 * - El historial queda a la izquierda en escritorio y se abre desde el borde derecho en móvil.
 * - Arriba, el recorrido de la conversación (foto → ficha → plan → producción → listo): siempre sabes en qué paso estás.
 * - Portada: el orbe (escribes, piensa mientras responde el director y la respuesta se despliega) y tres maneras de
 *   empezar.
 * - Conversación: los mensajes con sus tarjetas (ficha del plato, plan, progreso, pieza, herramientas y encargos) y,
 *   debajo del campo, las acciones de siempre y «Todas las herramientas».
 * La conversación vive en el servidor y llega por SSE.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Camera, ClipboardList, GalleryHorizontalEnd, LayoutGrid, PanelLeftOpen, PanelRightOpen, Sparkles, Square, Wand2 } from 'lucide-react';
import { PromptInput } from '@/components/ui/ai-chat-input';
import { TarjetaReferencias } from '@/components/chat/referencias';
import { TarjetaConceptos } from '@/components/chat/conceptos';
import MorphOrb from '@/components/ui/ai-thiking-orb-and-input';
import { Bandeja, PanelDeHerramientas } from '@/components/chat/bandeja';
import { TarjetaEncargo } from '@/components/chat/encargo';
import { TarjetaHerramienta } from '@/components/chat/herramienta';
import { Lateral, Recorrido } from '@/components/chat/lateral';
import { AgenteTrabajando } from '@/components/chat/society';
import { TarjetaHechos, TarjetaPlan, TarjetaProgreso, VisorPieza } from '@/components/chat/tarjetas';
import { aBase64, api, type Bloque, type Conversacion, type Esfuerzo, type Formato, type Herramienta, type Local, type Mensaje } from '@/lib/api';
import { cn } from '@/lib/utils';

const FORMATOS: Record<string, Formato | 'auto'> = { Automático: 'auto', Post: 'post', Carrusel: 'carrusel' };
const ESFUERZOS: Record<string, Esfuerzo> = { Rápido: 'rapido', Normal: 'normal', Máximo: 'maximo' };
const ICONOS = {
  Automático: <Wand2 className="size-3.5" />,
  Post: <Square className="size-3.5" />,
  Carrusel: <GalleryHorizontalEnd className="size-3.5" />,
};

const idDeLaRuta = () => /^\/c\/([a-z0-9-]+)/.exec(location.pathname)?.[1];
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const consultaEscritorio = '(min-width: 64rem)';

export default function App() {
  const [conversacion, setConversacion] = useState<Conversacion>();
  const [locales, setLocales] = useState<Local[]>([]);
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [conversaciones, setConversaciones] = useState<Array<{ id: string; titulo: string; actualizada: string }>>([]);
  const [lateral, setLateral] = useState(true);
  const [panel, setPanel] = useState(false);
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
      if (!id) {
        setConversacion(undefined);
        setPortada(true);
        history.pushState(null, '', '/');
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
    void abrir(idDeLaRuta());
    void refrescarLista();
    api.locales().then(setLocales, (e: Error) => setError(e.message));
    api.herramientas().then(setHerramientas, () => {});
    const atras = () => void abrir(idDeLaRuta());
    window.addEventListener('popstate', atras);
    return () => window.removeEventListener('popstate', atras);
  }, [abrir, refrescarLista]);

  useEffect(() => {
    const escritorio = window.matchMedia(consultaEscritorio);
    const ajustarHistorial = () => {
      if (escritorio.matches) historialMovil.current?.close();
    };
    escritorio.addEventListener('change', ajustarHistorial);
    return () => escritorio.removeEventListener('change', ajustarHistorial);
  }, []);

  useEffect(() => {
    if (!conversacion?.id) return;
    return api.escuchar(conversacion.id, setConversacion);
  }, [conversacion?.id]);

  // La lista de la izquierda se pone al día cuando cambia el título de la conversación abierta.
  useEffect(() => {
    void refrescarLista();
  }, [conversacion?.id, conversacion?.titulo, refrescarLista]);

  useEffect(() => {
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!portada) fin.current?.scrollIntoView({ behavior: reducirMovimiento ? 'instant' : 'smooth', block: 'end' });
  }, [portada, conversacion?.id, conversacion?.mensajes.length, conversacion?.pensando, conversacion?.piezas.map((p) => `${p.estado}${p.progreso.length}`).join()]);

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
  const historial = { conversaciones, actual: portada ? undefined : conversacion?.id, abrir: (id?: string) => void abrir(id) };

  return (
    <div className="flex h-dvh overflow-x-clip">
      {lateral && (
        <Lateral {...historial} cerrar={() => setLateral(false)} className="hidden border-r lg:flex" />
      )}
      <dialog
        ref={historialMovil}
        id="historial-movil"
        aria-label="Conversaciones"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-72 max-w-[calc(100%-2rem)] bg-lateral text-foreground backdrop:bg-black/60 motion-safe:open:animate-in motion-safe:open:slide-in-from-right motion-safe:open:duration-200"
      >
        <Lateral {...historial} cerrar={() => historialMovil.current?.close()} desdeLaDerecha className="flex w-full border-l" />
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="cristal z-20 m-3 mb-0 flex h-14 shrink-0 items-center gap-3 rounded-2xl px-4">
          {!lateral && (
            <button type="button" onClick={() => setLateral(true)} aria-label="Mostrar las conversaciones" className="hidden shrink-0 rounded-lg p-2 text-tenue hover:bg-accent hover:text-foreground lg:inline-flex">
              <PanelLeftOpen className="size-4" />
            </button>
          )}
          {portada || !conversacion ? (
            <span className="text-sm font-semibold">Nueva conversación</span>
          ) : (
            <>
              <span className="min-w-0 max-w-[20rem] truncate text-sm font-semibold">{conversacion.titulo}</span>
              <div className="ml-auto hidden min-w-0 md:block">
                <Recorrido c={conversacion} />
              </div>
            </>
          )}
          <button type="button" onClick={() => historialMovil.current?.showModal()} aria-label="Mostrar las conversaciones" aria-haspopup="dialog" aria-controls="historial-movil" className="ml-auto shrink-0 rounded-lg p-2 text-tenue hover:bg-accent hover:text-foreground lg:hidden">
            <PanelRightOpen className="size-5" />
          </button>
        </header>

        <input ref={foto} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void subirFotos(e.target.files)} />

        {portada ? (
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="min-h-60 flex-1">
              <MorphOrb onSubmit={preguntarDesdeElOrbe} minThinkMs={1800} onAnswered={() => setTimeout(() => setPortada(false), 2200)} onContinue={() => setPortada(false)} />
            </div>
            <div className="shrink-0 px-4 pb-6 sm:pb-8">
              <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
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
              <div className="mx-auto grid max-w-3xl gap-6 px-4 pb-10 pt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-8 motion-safe:duration-300">
                {conversacion?.mensajes.map((m) => (
                  <BurbujaMensaje key={m.id} m={m} c={conversacion} locales={locales} herramientas={herramientas} nuevo={!iniciales.current.has(m.id)} />
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
