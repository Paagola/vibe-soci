import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ArrowUpRight, CalendarDays, ChevronDown, Plus, Repeat2, X } from 'lucide-react';
import { agencia, type AgendaLocal, type Campana, type PiezaCampana } from '@/lib/agencia';

const campo = 'mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm';
const boton = 'rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50';
const accion = 'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95 disabled:opacity-50';
const desplegable = 'group flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden';
const etiqueta = 'block text-sm font-medium';
const fechaLarga = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const mostrarFecha = (valor: string) => fechaLarga.format(new Date(valor.slice(0, 10) + 'T12:00:00'));
const mesCorto = new Intl.DateTimeFormat('es', { month: 'short' });
const fechaCorta = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fechaLocal = (fecha: string) => new Date(fecha + 'T12:00:00');
const formato = (pieza: PiezaCampana) => pieza.formato === 'carrusel' ? 'Carrusel' : pieza.formato === 'historia' ? 'Historia' : 'Post';

function estadoPieza(pieza: PiezaCampana, simulado: boolean) {
  if (pieza.avisoProduccion) return { texto: 'Requiere revisión', estilo: 'text-acento bg-acento/10' };
  switch (pieza.estadoProduccion) {
    case 'Falta confirmar la foto del plato': return { texto: 'Confirmar foto', estilo: 'text-acento bg-acento/10' };
    case 'Elegir referencia': return { texto: 'Elegir referencia', estilo: 'text-acento bg-acento/10' };
    case 'Plan listo para aprobar': return { texto: 'Aprobar plan', estilo: 'text-acento bg-acento/10' };
    case 'Reabrir en el estudio':
    case 'Revisar en el estudio': return { texto: 'Requiere revisión', estilo: 'text-acento bg-acento/10' };
    case 'Pieza lista': return { texto: 'Lista', estilo: 'text-exito bg-exito/10' };
    default: return { texto: pieza.estadoProduccion ?? (simulado ? 'Planificada' : 'Por enviar'), estilo: 'bg-secondary text-muted-foreground' };
  }
}
const mensajeError = (e: unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación.';

export function hoy() {
  const fecha = new Date();
  return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-');
}

export function PanelAgencia({ cerrar, localInicial, nueva }: { cerrar: () => void; localInicial?: string; nueva: (local: string) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [directorio, setDirectorio] = useState<Awaited<ReturnType<typeof agencia.locales>>>();
  const [local, setLocal] = useState('');
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [intento, setIntento] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    const nodo = dialogo.current!;
    nodo.showModal();
    return () => nodo.close();
  }, []);
  useEffect(() => {
    let vigente = true;
    setError('');
    agencia.locales().then((datos) => {
      if (!vigente) return;
      setDirectorio(datos);
      setLocal(datos.locales.find(l => l.slug === localInicial)?.slug ?? datos.locales[0]?.slug ?? '');
    }, (e: unknown) => { if (vigente) setError(mensajeError(e)); });
    return () => { vigente = false; };
  }, [intento, localInicial]);

  const nombreLocal = directorio?.locales.find(l => l.slug === local)?.nombre ?? 'Local';
  return (
    <dialog ref={dialogo} aria-labelledby="titulo-agencia" onCancel={cerrar} className="m-auto max-h-[94dvh] w-[min(52rem,96vw)] overflow-y-auto rounded-2xl border border-border bg-popover p-0 text-foreground shadow-2xl backdrop:bg-black/65">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-popover px-4 py-3 sm:px-6">
        <CalendarDays className="size-5 text-acento" aria-hidden="true" />
        <h1 id="titulo-agencia" className="min-w-0 flex-1 text-lg font-semibold">Campañas del local</h1>
        <button type="button" aria-label="Cerrar campañas" onClick={cerrar} className="rounded-lg p-2 hover:bg-accent"><X className="size-5" /></button>
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-6">
        {!directorio && !error && <p role="status">Cargando locales…</p>}
        {error && <div role="alert"><p>{error}</p><button className={boton} onClick={() => setIntento((n) => n + 1)}>Volver a cargar</button></div>}
        {directorio && (directorio.locales.length ? <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <details className="relative min-w-0 flex-1 sm:max-w-64" onToggle={e => setSelectorAbierto(e.currentTarget.open)}>
              <summary className={desplegable + ' rounded-lg border border-input bg-background px-3 py-2'} aria-label={'Cambiar local · ' + nombreLocal}>
                <span className="min-w-0 flex-1 truncate">{nombreLocal}</span>
                <ChevronDown size={14} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
              </summary>
              {selectorAbierto && <ul className="absolute z-10 mt-1 max-h-60 w-full min-w-44 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                {directorio.locales.map(l => <li key={l.slug}><button type="button" aria-current={l.slug === local ? 'true' : undefined}
                  className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent aria-[current=true]:font-semibold aria-[current=true]:text-acento"
                  onClick={e => {
                    setLocal(l.slug);
                    const selector = e.currentTarget.closest('details');
                    if (selector) {
                      selector.open = false;
                      selector.querySelector('summary')?.focus();
                    }
                  }}>{l.nombre}</button></li>)}
              </ul>}
            </details>
            <button type="button" className={accion} onClick={() => nueva(local)}>
              <Plus size={16} aria-hidden="true" /> Nueva campaña
            </button>
          </div>
          {local && <CalendarioLocal key={local} local={local} simulado={directorio.simulado} />}
        </> : <p>Para preparar la primera campaña, da de alta tu local en «Todas las herramientas».</p>)}
      </div>
    </dialog>
  );
}

export function CalendarioLocal({ local, simulado, campanaInicial }: { local: string; simulado: boolean; campanaInicial?: Campana }) {
  const [agenda, setAgenda] = useState<AgendaLocal | undefined>(() => campanaInicial ? { campanas: [campanaInicial], renovacion: null } : undefined);
  const [intento, setIntento] = useState(0);
  const [leyendo, setLeyendo] = useState(true);
  const [errorLectura, setErrorLectura] = useState('');
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [seleccion, setSeleccion] = useState(campanaInicial?.id ?? '');
  const vigente = useRef(true);
  const bloqueado = useRef(false);
  useEffect(() => {
    vigente.current = true;
    return () => { vigente.current = false; };
  }, []);
  useEffect(() => {
    let activa = true;
    setLeyendo(true);
    setErrorLectura('');
    agencia.leer(local).then((datos) => {
      if (activa) setAgenda(datos);
    }, (e: unknown) => {
      if (activa) setErrorLectura(mensajeError(e));
    }).finally(() => { if (activa) setLeyendo(false); });
    return () => { activa = false; };
  }, [local, intento]);

  const produciendo = agenda?.campanas.some(c => c.piezas.some(p =>
    p.estadoProduccion === 'Preparando el plan' || p.estadoProduccion === 'Produciendo imágenes'));
  useEffect(() => {
    if (!produciendo) return;
    let activa = true;
    let temporizador: ReturnType<typeof setTimeout>;
    const actualizar = async () => {
      if (!bloqueado.current) {
        try {
          const datos = await agencia.leer(local);
          if (activa && !bloqueado.current) setAgenda(datos);
        } catch {
          // Una lectura fallida conserva el calendario visible hasta el siguiente intento.
        }
      }
      if (activa) temporizador = setTimeout(actualizar, 8000);
    };
    temporizador = setTimeout(actualizar, 8000);
    return () => { activa = false; clearTimeout(temporizador); };
  }, [local, produciendo]);

  const trabajar = async (accion: () => Promise<void>) => {
    if (bloqueado.current) return;
    bloqueado.current = true;
    setOcupado(true);
    setEstado('');
    setError('');
    try {
      await accion();
    } catch (e) {
      if (vigente.current) setError(mensajeError(e));
    } finally {
      bloqueado.current = false;
      if (vigente.current) setOcupado(false);
    }
  };
  const detener = () => trabajar(async () => {
    await agencia.detener(local, simulado);
    if (!vigente.current) return;
    setAgenda((a) => a && { ...a, renovacion: null });
    setEstado('La renovación automática se ha detenido.');
  });
  const abrir = (c: Campana, indice: number) => trabajar(async () => {
    const respuesta = await agencia.abrir(local, simulado, c.id, indice);
    if (vigente.current) location.assign('/c/' + encodeURIComponent(respuesta.conversacion));
  });
  const encargarCalendario = (c: Campana) => trabajar(async () => {
    try {
      for (const [i, pieza] of c.piezas.entries()) {
        if (!pieza.conversacion) await agencia.abrir(local, simulado, c.id, i);
      }
      if (vigente.current) setEstado('El director ha recibido los encargos del calendario.');
    } finally {
      if (vigente.current) setIntento(n => n + 1);
    }
  });
  const guardar = (c: Campana, indice: number, valor: number, nota: string, semanal: boolean) => trabajar(async () => {
    const { campana } = await agencia.resultado(local, simulado, c.id, indice, valor, nota.trim(), semanal);
    if (!vigente.current) return;
    setAgenda((a) => a && { ...a, campanas: a.campanas.map((x) => x.id === c.id ? campana : x) });
    setEstado('Resultado guardado.');
    setIntento(n => n + 1);
  });
  const actual = agenda?.campanas.find((c) => c.id === seleccion) ?? agenda?.campanas[0];
  const espera = ocupado || leyendo;

  const pendientes = (campanaInicial || simulado ? [] : (agenda?.campanas ?? []).filter(c => c.id !== actual?.id)).flatMap(c => c.piezas.flatMap((p, i) =>
    p.avisoProduccion || (!p.conversacion && !p.resultado && p.fecha === hoy()) || ['Elegir referencia', 'Plan listo para aprobar', 'Falta confirmar la foto del plato', 'Revisar en el estudio', 'Reabrir en el estudio'].includes(p.estadoProduccion ?? '')
      ? [{ c, p, i }] : [])).sort((a, b) => a.p.fecha.localeCompare(b.p.fecha));

  return <>
    {pendientes.length > 0 && <details className="rounded-xl border border-border px-3 py-2.5">
      <summary className={desplegable}>Pendientes en otras campañas <span className="rounded-full bg-acento/10 px-2 text-xs text-acento">{pendientes.length}</span><ChevronDown size={14} className="ml-auto group-open:rotate-180" aria-hidden="true" /></summary>
      <ul className="mt-2 divide-y divide-border">
        {pendientes.map(({ c, p, i }) => <li key={c.id + '-' + i} className="flex items-center justify-between gap-2 py-2 text-sm">
          <div className="min-w-0"><p className="truncate font-medium">{c.nombre}</p><p className="text-xs text-muted-foreground">{fechaCorta.format(fechaLocal(p.fecha))} · {formato(p)} · {estadoPieza(p, simulado).texto}</p></div>
          <button type="button" className={boton + ' shrink-0'} disabled={espera} onClick={() => void abrir(c, i)}>Revisar</button>
        </li>)}
      </ul>
    </details>}
    {leyendo && <p role="status" className="text-sm">Cargando calendario…</p>}
    {ocupado && <p role="status" className="text-sm">Trabajando en tu campaña…</p>}
    {errorLectura && <div role="alert" className="space-y-2"><p>{errorLectura}</p><button className={boton} onClick={() => setIntento((n) => n + 1)}>Volver a cargar el calendario</button></div>}
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {estado && <p role="status" className="text-sm">{estado}</p>}
    {agenda && <section aria-label="Calendario de campañas" className="space-y-4">
      {actual ? <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {campanaInicial && <p className="mb-1 text-xs font-semibold text-exito" role="status">Calendario preparado</p>}
            <h2 className="break-words font-serif text-2xl font-semibold leading-tight sm:text-3xl">{actual.nombre}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{actual.solicitud.objetivo}</p>
          </div>
          {!campanaInicial && agenda.campanas.length > 1 && <details className="rounded-lg border border-border px-3 py-2">
            <summary className={desplegable}>Cambiar campaña <ChevronDown size={14} className="group-open:rotate-180" aria-hidden="true" /></summary>
            <select aria-label="Cambiar campaña" className={campo + ' max-w-60'} value={actual.id} disabled={espera} onChange={e => {
              setSeleccion(e.target.value);
              setError('');
              setEstado('');
              const selector = e.currentTarget.closest('details');
              if (selector) {
                selector.open = false;
                selector.querySelector('summary')?.focus();
              }
            }}>
              {agenda.campanas.map(c => <option key={c.id} value={c.id}>{fechaCorta.format(fechaLocal(c.solicitud.inicio))} · {c.nombre}</option>)}
            </select>
          </details>}
        </div>
        <details key={actual.id} className="rounded-lg border border-border px-3 py-2.5">
          <summary className={desplegable}>Ver estrategia <ChevronDown size={14} className="ml-auto group-open:rotate-180" aria-hidden="true" /></summary>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {actual.fundamento && <p>{actual.fundamento}</p>}
            <p>{actual.estrategia}</p>
            {actual.referenciaSemanal && <p>Referencia de los primeros siete días. Mediana de {actual.referenciaSemanal.mediana} para «{actual.referenciaSemanal.metrica}» en {actual.referenciaSemanal.muestras} publicaciones de tipo {actual.referenciaSemanal.formato} con la misma invitación.</p>}
          </div>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Publicaciones <span className="ml-1 font-normal text-muted-foreground">{actual.piezas.length}</span></h3>
          {!simulado && actual.piezas.filter(p => !p.conversacion).length > 1 && <button className={boton} disabled={espera} onClick={() => void encargarCalendario(actual)}>Enviar pendientes al director</button>}
        </div>
        <ol className="space-y-2">
          {actual.piezas.map((p, i) => <li key={actual.id + '-' + i}><DetallePieza rutaEntrega={'/api/agencia/' + encodeURIComponent(local) + '/' + encodeURIComponent(actual.id) + '/piezas/' + i + '/entrega/'} pieza={p} ocupado={espera} simulado={simulado}
            abrir={() => void abrir(actual, i)} guardar={(valor, nota, semanal) => void guardar(actual, i, valor, nota, semanal)} /></li>)}
        </ol>
      </> : <p className="text-sm text-muted-foreground">Aún no hay campañas para este local.</p>}
    </section>}
    {agenda?.renovacion && <details className="rounded-lg border border-border px-3 py-2.5">
      <summary className={desplegable}>
        <Repeat2 size={16} className="shrink-0 text-acento" aria-hidden="true" />
        <span>Próximo calendario · {fechaCorta.format(fechaLocal(agenda.renovacion.proxima))}</span>
        <ChevronDown size={14} className="ml-auto shrink-0 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">{agenda.renovacion.objetivo}</p>
        <button className={boton} disabled={espera} onClick={() => void detener()}>Detener automatización</button>
      </div>
      {agenda.renovacion.error && <p className="mt-2 text-sm text-destructive">{agenda.renovacion.error}</p>}
    </details>}
  </>;
}

function DetallePieza({ rutaEntrega, pieza, ocupado, simulado, abrir, guardar }: {
  rutaEntrega: string; pieza: PiezaCampana; ocupado: boolean; simulado: boolean; abrir: () => void; guardar: (valor: number, nota: string, semanal: boolean) => void;
}) {
  const [valor, setValor] = useState(String(pieza.resultado?.valor ?? ''));
  const [semanal, setSemanal] = useState(Boolean(pieza.resultado?.primerosSieteDias));
  const [nota, setNota] = useState(pieza.resultado?.nota ?? '');
  const carrusel = pieza.formato === 'carrusel';
  const estado = estadoPieza(pieza, simulado);
  const fecha = fechaLocal(pieza.fecha);
  return <div className="hoja relative rounded-xl border border-border">
    <details>
      <summary className={desplegable + ' min-w-0 gap-3 p-3' + (!simulado ? ' pr-16 sm:pr-28' : '')}>
        <time dateTime={pieza.fecha} aria-label={mostrarFecha(pieza.fecha)} className="grid size-11 shrink-0 content-center rounded-lg bg-secondary text-center leading-none">
          <span className="text-base font-semibold tabular-nums">{fecha.getDate()}</span>
          <span className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">{mesCorto.format(fecha).replace('.', '')}</span>
        </time>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{formato(pieza)}</span>
            {carrusel && <span className="text-xs text-muted-foreground">{pieza.laminas} láminas</span>}
            <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + estado.estilo}>{estado.texto}</span>
          </span>
          <span className="mt-1 line-clamp-1 font-normal text-muted-foreground">{pieza.proposito}</span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-3">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries({ 'Para qué sirve': pieza.proposito, 'Enfoque': pieza.enfoque, ...(pieza.motivoFormato ? { 'Por qué este formato': pieza.motivoFormato } : {}), 'A quién se dirige': pieza.audiencia, 'Dato del local': pieza.evidencia, 'Qué pedimos al lector': pieza.llamada }).map(([nombre, texto]) =>
            <div key={nombre}><dt className="font-medium text-muted-foreground">{nombre}</dt><dd>{texto}</dd></div>)}
        </dl>
        <div><h4 className="text-sm font-semibold">Propuesta de texto</h4><p className="mt-1 whitespace-pre-line text-sm">{pieza.texto}</p></div>
        {pieza.guion.length > 0 && <div><h4 className="text-sm font-semibold">{carrusel ? 'Guion del carrusel' : 'Brief editorial'}</h4>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{pieza.guion.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
        {pieza.conversacion && Boolean(pieza.imagenesDirector?.length) && <div className="flex flex-wrap gap-2">{pieza.imagenesDirector!.map((archivo, i) =>
          <a key={archivo} href={api.archivo(pieza.conversacion!, archivo)}><img className="w-28 rounded-lg" src={api.archivo(pieza.conversacion!, archivo)} alt={'Diseño del director, lámina ' + (i + 1)} /></a>)}</div>}
        {pieza.entrega && <div className="flex flex-wrap gap-2"><a className={boton} href={rutaEntrega + 'publicacion.json'}>Descargar datos de publicación</a>
          {pieza.guion.map((_, i) => <a className={boton} key={i} href={rutaEntrega + String(i + 1).padStart(2, '0') + '.png'}>Descargar imagen {i + 1}</a>)}</div>}
        {pieza.avisoProduccion && <p className="text-sm text-muted-foreground">{pieza.avisoProduccion} Puedes reintentar en el estudio.</p>}
        <details className="border-t border-border pt-3">
          <summary className={desplegable}>Resultado de la publicación <ChevronDown size={14} className="group-open:rotate-180" aria-hidden="true" /></summary>
          <form className="mt-3" onSubmit={(e) => { e.preventDefault(); guardar(Number(valor), nota, semanal); }}>
            <fieldset disabled={ocupado} className="space-y-2">
              <legend className="sr-only">Resultado de la publicación</legend>
              <label className={etiqueta}>{pieza.metrica}
                <input required type="number" min="0" step="1" max={Number.MAX_SAFE_INTEGER} className={campo} value={valor} onChange={(e) => setValor(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={semanal} onChange={e => setSemanal(e.target.checked)} /> La cifra cubre los primeros siete días desde la publicación.</label>
              <label className={etiqueta}>Nota <span className="font-normal text-muted-foreground">(opcional)</span>
                <input className={campo} maxLength={400} value={nota} onChange={(e) => setNota(e.target.value)} />
              </label>
              <button type="submit" className={boton}>{pieza.resultado ? 'Actualizar resultado' : 'Guardar resultado'}</button>
            </fieldset>
          </form>
        </details>
      </div>
    </details>
    {!simulado && <button type="button" disabled={ocupado} onClick={abrir}
      aria-label={(pieza.conversacion ? 'Abrir en el estudio' : 'Enviar al director') + ' · ' + formato(pieza) + ' del ' + mostrarFecha(pieza.fecha)}
      title={pieza.conversacion ? 'Abrir en el estudio' : 'Enviar al director'}
      className={boton + ' absolute right-3 top-3 inline-flex items-center gap-1.5'}>
      <span className="hidden sm:inline">{pieza.conversacion ? 'Abrir' : 'Enviar'}</span><ArrowUpRight size={16} aria-hidden="true" />
    </button>}
  </div>;
}
