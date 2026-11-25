import { useEffect, useRef, useState } from 'react';
import { ArrowUp, CalendarDays, RotateCcw } from 'lucide-react';
import { CalendarioLocal, hoy } from '@/components/agencia';
import { ThinkingOrb } from '@/components/ui/ai-thiking-orb-and-input';
import { agencia, type Campana, type SolicitudCampana } from '@/lib/agencia';

type Paso = 'local' | 'objetivo' | 'hecho' | 'inicio' | 'semanas' | 'renovar' | 'anticipar';
type Respuestas = Partial<Record<Paso, string>>;
type Borrador = { clave: string; respuestas: Respuestas; campana?: Campana; simulado?: boolean };
type Opcion = { valor: string; etiqueta: string };
const preguntas: Record<Paso, string> = {
  local: '¿Para qué local preparamos la campaña?',
  objetivo: '¿Qué quieres conseguir con esta campaña?',
  hecho: '¿Hay algún plato, novedad o dato confirmado del local que quieras contar?',
  inicio: '¿Qué día quieres que empiece el calendario?',
  semanas: '¿Cuánto debe durar?',
  renovar: '¿Quieres que prepare otro calendario cuando termine este?',
  anticipar: '¿Enviamos cada encargo al director al acercarse su fecha? El coste de las imágenes se aprueba en el estudio.',
};
const metas = ['Que más vecinos nos conozcan', 'Recibir más visitas entre semana', 'Que quienes ya vienen nos recomienden'];
const opcion = (valor: string, etiqueta = valor): Opcion => ({ valor, etiqueta });
const boton = 'rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50';
const clave = 'estudio-borrador-chat-campana';

function nuevo(local?: string): Borrador {
  return { clave: crypto.randomUUID(), respuestas: local ? { local } : {} };
}

function recuperar(local?: string): Borrador {
  try {
    const previo = JSON.parse(sessionStorage.getItem(clave) ?? 'null') as Borrador | null;
    if (previo?.clave && previo.respuestas && (!local || previo.respuestas.local === local)) return previo;
  } catch {
    // El chat también funciona si el navegador bloquea el almacenamiento de sesión.
  }
  return nuevo(local);
}

export function ChatCampana({ localInicial, alCrear }: { localInicial?: string; alCrear: () => void }) {
  const [borrador, setBorrador] = useState(() => recuperar(localInicial));
  const [directorio, setDirectorio] = useState<Awaited<ReturnType<typeof agencia.locales>>>();
  const [reintento, setReintento] = useState(0);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const final = useRef<HTMLDivElement>(null);
  const resultado = useRef<HTMLDivElement>(null);
  const r = borrador.respuestas;
  const pasos = (Object.keys(preguntas) as Paso[]).filter(p => p !== 'anticipar' || !directorio?.simulado);
  const paso = pasos.find(p => r[p] === undefined);
  const locales = directorio?.locales ?? [];

  useEffect(() => {
    let activa = true;
    agencia.locales().then(d => {
      if (!activa) return;
      setDirectorio(d);
      setBorrador(b => b.respuestas.local && !d.locales.some(l => l.slug === b.respuestas.local) ? nuevo() : b);
    }, e => { if (activa) setError(e.message); });
    return () => { activa = false; };
  }, [reintento]);

  useEffect(() => {
    try { sessionStorage.setItem(clave, JSON.stringify(borrador)); } catch { /* Se conserva el borrador en memoria. */ }
  }, [borrador]);
  useEffect(() => { final.current?.scrollIntoView({ block: 'nearest' }); }, [paso, ocupado, error]);
  useEffect(() => { resultado.current?.scrollIntoView({ block: 'start' }); }, [borrador.campana?.id]);

  const opciones = (p: Paso): Opcion[] => {
    switch (p) {
      case 'local': return locales.map(l => opcion(l.slug, l.nombre));
      case 'objetivo': return metas.map(m => opcion(m));
      case 'hecho': return [opcion('', 'Saltar este dato')];
      case 'inicio': return [opcion(hoy(), 'Empezar hoy')];
      case 'semanas': return [1, 2, 3, 4].map(n => opcion(String(n), n === 1 ? '1 semana' : n + ' semanas'));
      case 'renovar':
      case 'anticipar': return [opcion('si', 'Sí'), opcion('no', 'No')];
    }
  };
  const responder = (valor: string) => {
    if (paso === undefined) return;
    setBorrador(b => ({ ...b, respuestas: { ...b.respuestas, [paso]: valor } }));
    setTexto('');
    setError('');
  };
  const preparar = async () => {
    if (bloqueo.current || !directorio || paso || borrador.campana || !r.local || !r.objetivo || !r.inicio) return;
    bloqueo.current = true;
    setOcupado(true);
    setError('');
    const solicitud: SolicitudCampana = { objetivo: r.objetivo, hecho: r.hecho ?? '', inicio: r.inicio,
      semanas: Number(r.semanas), renovar: r.renovar === 'si', anticipar: !directorio.simulado && r.anticipar === 'si' };
    try {
      const { campana } = await agencia.crear(r.local, directorio.simulado, solicitud, borrador.clave);
      const listo = { ...borrador, campana, simulado: directorio.simulado };
      try {
        if (recuperar().clave === borrador.clave) sessionStorage.setItem(clave, JSON.stringify(listo));
      } catch { /* El calendario también queda guardado en el servidor. */ }
      setBorrador(listo);
      alCrear();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  };
  const editar = (p: Paso) => {
    setBorrador({ ...nuevo(), respuestas: Object.fromEntries(pasos.slice(0, pasos.indexOf(p)).map(k => [k, r[k]])) });
    setTexto('');
    setError('');
  };
  const entrada = paso === 'objetivo' || paso === 'hecho' || paso === 'inicio';
  return <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold"><CalendarDays className="size-5 text-acento" /> Planificar una campaña</h1>
        {borrador.campana && <button type="button" className={boton} onClick={() => setBorrador(nuevo(r.local))}><RotateCcw className="mr-1 inline size-4" /> Nueva campaña</button>}
      </div>
      {!directorio && !error && <p role="status">Buscando los locales del estudio…</p>}
      {directorio && !locales.length && <p>Añade un local al estudio para poder preparar campañas.</p>}
      {locales.length > 0 && <>
        {pasos.map(p => r[p] === undefined ? null : <div className="space-y-2" key={p}>
          <p className="text-sm text-muted-foreground">{preguntas[p]}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="max-w-full break-words rounded-2xl rounded-tr-sm bg-accent px-4 py-2 text-sm">{opciones(p).find(o => o.valor === r[p])?.etiqueta ?? r[p]}</p>
            {!ocupado && !borrador.campana && <button type="button" className="px-2 text-xs text-muted-foreground underline" aria-label={'Editar respuesta. ' + preguntas[p]} onClick={() => editar(p)}>Editar</button>}
          </div>
        </div>)}
        {paso && <section className="hoja space-y-3 rounded-2xl border border-border p-4" key={paso}>
          <h2 id="pregunta-campana" className="font-semibold">{preguntas[paso]}</h2>
          <div className="flex flex-wrap gap-2">{opciones(paso).map(o => <button className={boton} type="button" key={o.valor} onClick={() => responder(o.valor)}>{o.etiqueta}</button>)}</div>
          {entrada && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (texto.trim()) responder(texto.trim()); }}>
            <input aria-labelledby="pregunta-campana" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              type={paso === 'inicio' ? 'date' : 'text'} maxLength={paso === 'objetivo' ? 500 : 400} value={texto}
              onChange={e => setTexto(e.target.value)} placeholder="Escribe tu respuesta…" required />
            <button type="submit" className="rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-50" disabled={!texto.trim()} aria-label="Enviar respuesta"><ArrowUp className="size-4" /></button>
          </form>}
        </section>}
        {ocupado && <div className="hoja rounded-2xl rounded-tl-sm border border-acento/40 px-4 py-3">
          <ThinkingOrb labels={['Preparando el calendario']} size={40} />
        </div>}
        {!paso && !borrador.campana && !ocupado && <div className="hoja space-y-3 rounded-xl border border-border p-4">
          <p>Con tus respuestas puedo preparar la estrategia, las fechas y los formatos de publicación.</p>
          <button type="button" className={boton} onClick={() => void preparar()}>{error ? 'Reintentar' : 'Preparar calendario'}</button>
        </div>}
        {borrador.campana && <div ref={resultado}>
          <CalendarioLocal key={borrador.campana.id} local={borrador.campana.local} simulado={borrador.simulado ?? directorio!.simulado} campanaInicial={borrador.campana} />
        </div>}
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error} {!directorio && <button className={boton} type="button" onClick={() => { setError(''); setReintento(n => n + 1); }}>Reintentar</button>}</p>}
      <div ref={final} />
    </div>
  </main>;
}
