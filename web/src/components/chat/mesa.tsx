/**
 * La mesa en vivo: el estudio trabajando a la vista, como un lienzo multijugador.
 * Cada agente (director, fotógrafos, maquetadores y revisores) tiene su cursor con su nombre y su color. El cursor va a
 * la lámina en la que trabaja, se mueve por la zona que toca (en una edición, la caja real de la capa) y dice en un
 * bocadillo lo que está haciendo. Arriba, quién está en la mesa; abajo, la bitácora con lo último que han hecho.
 * Los datos llegan del servidor (pieza.agentes y pieza.bitacora); si una pieza antigua no los trae, se deducen de su
 * progreso. Con «reducir movimiento», los cursores saltan sin desplazarse ni deambular.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, type AgenteEnLaMesa, type Conversacion, type Pieza, type RolDeAgente, type Zona } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Composicion } from './composicion';
import { Titular } from './society';

// ------------------------------------------------------------------ Quién es quién

export const AGENTES: Record<RolDeAgente, { nombre: string; color: string; tinta: string; oficio: string }> = {
  director: { nombre: 'Director', color: '#2440e0', tinta: '#ffffff', oficio: 'Dirige y aprueba' },
  fotografo: { nombre: 'Fotógrafo', color: '#f5c518', tinta: '#141414', oficio: 'Hace las tomas' },
  maquetador: { nombre: 'Maquetador', color: '#ff5a36', tinta: '#ffffff', oficio: 'Compone las capas' },
  revisor: { nombre: 'Revisor', color: '#12a36b', tinta: '#ffffff', oficio: 'Mide y lee' },
};

/** «Fotógrafo 2» cuando trabajan varios a la vez; el primero va sin número. */
export function nombreDe(a: Pick<AgenteEnLaMesa, 'id' | 'rol'>): string {
  const puesto = Number(/(\d+)$/.exec(a.id)?.[1] ?? 1);
  return `${AGENTES[a.rol].nombre}${puesto > 1 ? ` ${puesto}` : ''}`;
}

/** Dónde se pone cada oficio en una lámina cuando no dice la zona exacta. */
const ZONA_DEL_OFICIO: Record<RolDeAgente, Zona> = {
  director: { x: 0.45, y: 0.55, w: 0.45, h: 0.35 },
  fotografo: { x: 0.25, y: 0.3, w: 0.5, h: 0.4 },
  maquetador: { x: 0.1, y: 0.08, w: 0.8, h: 0.3 },
  revisor: { x: 0.15, y: 0.4, w: 0.7, h: 0.4 },
};

/** Los agentes de la pieza: los que manda el servidor o, en piezas antiguas, los que se deducen de su progreso. */
export function agentesDe(p: Pieza): AgenteEnLaMesa[] {
  if (p.agentes?.length) return p.agentes;
  if (p.estado !== 'PRODUCIENDO') return [];
  const deducidos: AgenteEnLaMesa[] = [];
  let fotos = 0;
  let disenos = 0;
  for (const paso of p.progreso) {
    if (paso.estado !== 'en-curso') continue;
    const foto = /^Foto nueva de la diapositiva (\d+)/.exec(paso.texto);
    const diseno = /^Diseño de la diapositiva (\d+)/.exec(paso.texto);
    if (foto) deducidos.push({ id: `fotografo-${++fotos}`, rol: 'fotografo', n: Number(foto[1]), accion: `Dispara la toma de la ${foto[1]}`, desde: '' });
    if (diseno) deducidos.push({ id: `maquetador-${++disenos}`, rol: 'maquetador', n: Number(diseno[1]), accion: `Compone la ${diseno[1]}`, desde: '' });
  }
  if (deducidos.length) deducidos.push({ id: 'director', rol: 'director', accion: 'Sigue la producción', desde: '' });
  return deducidos;
}

const reducido = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ El cursor

type Caja = { x: number; y: number; w: number; h: number };
const ANCHO_ETIQUETA = 220;

/** Un cursor: busca su lámina en la mesa, va a su zona y deambula por ella mientras trabaja. */
function Cursor({ a, mesa, capa }: { a: AgenteEnLaMesa; mesa: React.RefObject<HTMLDivElement | null>; capa: number }) {
  const estilo = AGENTES[a.rol];
  const [punto, setPunto] = useState<{ x: number; y: number }>();
  const [seleccion, setSeleccion] = useState<Caja>();
  const [marco, setMarco] = useState<Caja>();
  const [llegado, setLlegado] = useState(false);
  /** Cuánto se corre la etiqueta a la izquierda para no salirse de la mesa (cerca del borde o en el móvil). */
  const [corrimiento, setCorrimiento] = useState(0);
  /** Al cambiar de tarea, el bocadillo se lee entero unos segundos; luego se encoge a una línea para no tapar a nadie. */
  const [hablando, setHablando] = useState(true);
  useEffect(() => {
    setHablando(true);
    const t = window.setTimeout(() => setHablando(false), 6500);
    return () => window.clearTimeout(t);
  }, [a.accion]);
  const zona = a.zona ? `${a.zona.x},${a.zona.y},${a.zona.w},${a.zona.h}` : '';

  useEffect(() => {
    let reloj = 0;
    const medir = (primera: boolean) => {
      const raiz = mesa.current;
      if (!raiz) return;
      const r0 = raiz.getBoundingClientRect();
      const lamina = a.n ? raiz.querySelector<HTMLElement>(`[data-lamina="${a.n}"]`) : null;
      const destino = lamina ?? raiz.querySelector<HTMLElement>('[data-mesa-cabecera]') ?? raiz;
      const r = destino.getBoundingClientRect();
      const base = { x: r.left - r0.left, y: r.top - r0.top, w: r.width, h: r.height };
      const z = lamina ? (a.zona ?? ZONA_DEL_OFICIO[a.rol]) : { x: 0.55, y: 0.2, w: 0.4, h: 0.6 };
      const caja = { x: base.x + z.x * base.w, y: base.y + z.y * base.h, w: Math.max(8, z.w * base.w), h: Math.max(8, z.h * base.h) };
      setMarco(lamina ? base : undefined);
      setSeleccion(lamina && a.zona ? caja : undefined);
      // Al llegar, al centro de la zona; luego, pequeños desplazamientos dentro de ella, como quien trabaja.
      const quieto = reducido() || primera;
      const fx = quieto ? 0.5 : 0.15 + Math.random() * 0.7;
      const fy = quieto ? 0.5 : 0.15 + Math.random() * 0.7;
      const x = caja.x + fx * caja.w;
      setPunto({ x, y: caja.y + fy * caja.h });
      const etiqueta = Math.min(ANCHO_ETIQUETA, raiz.clientWidth - 16);
      setCorrimiento(Math.max(8 - (x + 16), Math.min(0, raiz.clientWidth - 8 - (x + 16 + etiqueta))));
      if (!reducido()) reloj = window.setTimeout(() => medir(false), 1300 + Math.random() * 1400);
    };
    // Primera vez: entra desde la esquina de la mesa; después, viaja.
    const raiz = mesa.current;
    if (!punto && raiz) setPunto({ x: raiz.clientWidth - 24, y: raiz.clientHeight + 10 });
    const inicio = window.setTimeout(() => medir(true), punto ? 0 : 60);
    const fin = window.setTimeout(() => setLlegado(true), 1000);
    const alCambiar = () => medir(true);
    window.addEventListener('resize', alCambiar);
    return () => {
      window.clearTimeout(inicio);
      window.clearTimeout(reloj);
      window.clearTimeout(fin);
      window.removeEventListener('resize', alCambiar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.n, a.rol, zona, a.accion]);

  const disparando = a.rol === 'fotografo' && /^(Dispara|Repite)/.test(a.accion);
  const transicion = reducido() ? 'none' : 'transform 1100ms cubic-bezier(0.45, 0.05, 0.2, 1), width 500ms ease, height 500ms ease';
  return (
    <>
      {seleccion && (
        <div aria-hidden="true" className="seleccion pointer-events-none absolute left-0 top-0 z-20" style={{ transform: `translate(${seleccion.x}px, ${seleccion.y}px)`, width: seleccion.w, height: seleccion.h, transition: transicion, '--c': estilo.color } as React.CSSProperties}>
          <span className="tirador -left-1 -top-1" />
          <span className="tirador -right-1 -top-1" />
          <span className="tirador -bottom-1 -left-1" />
          <span className="tirador -bottom-1 -right-1" />
        </div>
      )}
      {disparando && marco && <div aria-hidden="true" className="disparo pointer-events-none absolute left-0 top-0 z-20 rounded-md" style={{ transform: `translate(${marco.x}px, ${marco.y}px)`, width: marco.w, height: marco.h }} />}
      {punto && (
        <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${punto.x}px, ${punto.y}px)`, transition: transicion, zIndex: 30 + capa }}>
          {llegado && !reducido() && <span key={a.accion} className="clic" style={{ '--c': estilo.color } as React.CSSProperties} />}
          <svg width="20" height="22" viewBox="0 0 20 22" className="drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)]">
            <path d="M1.5 1.5 L18 10.2 L10.4 12.1 L6.6 19.8 Z" fill={estilo.color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <div className="absolute left-4 top-5 flex w-max flex-col items-start gap-1" style={{ maxWidth: ANCHO_ETIQUETA, transform: `translateX(${corrimiento}px)`, transition: reducido() ? 'none' : 'transform 500ms ease' }}>
            <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-md" style={{ background: estilo.color, color: estilo.tinta }}>
              {nombreDe(a)}
            </span>
            <span key={a.accion} className={cn('relevo rounded-lg rounded-tl-sm bg-tinta/90 px-2 py-1 text-[11px] leading-snug text-papel shadow-lg backdrop-blur transition-[max-width,opacity] duration-500', hablando ? 'max-w-[220px]' : 'max-w-[150px] truncate opacity-80')}>
              {a.accion}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/** Todos los cursores de la mesa. Va dentro de un contenedor con `position: relative`. */
function Cursores({ agentes, mesa }: { agentes: AgenteEnLaMesa[]; mesa: React.RefObject<HTMLDivElement | null> }) {
  return (
    <>
      {agentes.map((a) => (
        // Lo más reciente, encima.
        <Cursor key={a.id} a={a} mesa={mesa} capa={agentes.filter((b) => b.desde < a.desde).length} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ Presencia y bitácora

/** Las caras de quien está en la mesa, como en un documento compartido. */
function Presencia({ agentes }: { agentes: AgenteEnLaMesa[] }) {
  const unicos = useMemo(() => [...new Map(agentes.map((a) => [a.id, a])).values()].sort((x, y) => x.id.localeCompare(y.id)), [agentes]);
  if (!unicos.length) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {unicos.map((a) => (
          <span key={a.id} title={`${nombreDe(a)}: ${a.accion}`} className="presencia flex size-7 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-mesa" style={{ background: AGENTES[a.rol].color, color: AGENTES[a.rol].tinta }}>
            {nombreDe(a).replace(/[^A-ZÁÉÍÓÚ0-9]/g, '').slice(0, 2)}
          </span>
        ))}
      </div>
      <span className="text-xs text-mesa-tenue">{unicos.length === 1 ? 'en la mesa' : `${unicos.length} en la mesa`}</span>
    </div>
  );
}

function Bitacora({ pieza }: { pieza: Pieza }) {
  const apuntes = (pieza.bitacora ?? []).slice(-5).reverse();
  if (!apuntes.length) return null;
  return (
    <ol aria-label="Lo último que han hecho" className="mt-4 grid gap-1.5 border-t border-mesa-foreground/10 pt-3">
      {apuntes.map((x, k) => (
        <li key={`${x.fecha}-${x.id}`} className={cn('flex items-baseline gap-2 text-xs', k === 0 ? 'relevo text-mesa-foreground' : 'text-mesa-tenue')}>
          <span aria-hidden="true" className="size-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: AGENTES[x.rol].color }} />
          <span className="font-semibold">{nombreDe(x)}</span>
          <span className="min-w-0 truncate">{x.texto}</span>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ La mesa de producción

const PAPEL: Record<string, string> = { portada: 'Portada', detalle: 'Detalle', ambiente: 'Ambiente', proceso: 'Proceso', dato: 'Dato', cierre: 'Cierre', post: 'Post' };

/** Mientras se produce la pieza: un marco por lámina y los agentes trabajando encima. */
export function MesaEnVivo({ conversacion, pieza }: { conversacion: Conversacion; pieza: Pieza }) {
  const mesa = useRef<HTMLDivElement>(null);
  const plan = pieza.plan!;
  const agentes = agentesDe(pieza);
  const url = (r: string) => api.archivo(conversacion.id, r);
  const estadoDe = (t: string) => pieza.progreso.find((x) => x.texto === t)?.estado;
  const total = plan.diapositivas.length;
  const listas = pieza.diapositivas.filter((d) => d.png).length;
  const resumen = listas === total ? 'Terminando' : listas ? `${listas} de ${total} listas` : agentes.some((a) => a.rol === 'fotografo') ? 'Sesión de fotos' : 'Componiendo';
  return (
    <section aria-label="La pieza, componiéndose" className="mesa-de-luz relative -mx-1 overflow-clip rounded-2xl p-4 sm:-mx-10 sm:p-5">
      <div ref={mesa} className="relative">
        <div data-mesa-cabecera className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Titular grande="Manos" cursiva="a la obra" />
          <div className="flex items-center gap-3">
            <Presencia agentes={agentes} />
            <span className="text-sm text-mesa-tenue" aria-live="polite">
              {resumen}
            </span>
          </div>
        </div>
        <div className={cn('grid gap-3', total === 1 ? 'mx-auto max-w-[280px]' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
          {plan.diapositivas.map((d, i) => {
            const n = i + 1;
            const lista = pieza.diapositivas.find((x) => x.n === n && x.png);
            const foto = pieza.fotos?.find((f) => f.n === n)?.archivo;
            const encima = agentes.filter((a) => a.n === n);
            const disenando = estadoDe(`Diseño de la diapositiva ${n}`) === 'en-curso';
            const tomando = estadoDe(`Foto nueva de la diapositiva ${n}`) === 'en-curso';
            const estado = lista ? 'Lista' : disenando ? 'Componiendo' : tomando && foto ? 'Revisando' : tomando ? 'Fotografiando' : foto ? 'Foto lista' : 'En cola';
            const anillo = encima[0] ? AGENTES[encima[0].rol].color : undefined;
            return (
              <figure key={n} className="grid gap-1.5">
                <div data-lamina={n} className="relative rounded-md transition-shadow duration-500" style={anillo ? { boxShadow: `0 0 0 2px ${anillo}, 0 10px 30px -12px ${anillo}` } : undefined}>
                  {lista ? (
                    <Composicion capas={(lista.capas ?? []).map(url)} final={url(lista.movil ?? lista.png!)} alt={d.resumen} />
                  ) : foto ? (
                    <div className={cn('relative aspect-[3/4] overflow-hidden rounded-md', disenando && 'componiendo')}>
                      <img src={url(foto)} alt="" className="foto-llega h-full w-full object-cover" />
                    </div>
                  ) : tomando ? (
                    <div className="fotografiando aspect-[3/4] rounded-md" />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-dashed border-mesa-tenue/40 font-display text-2xl text-mesa-tenue/60">{n}</div>
                  )}
                </div>
                <figcaption className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate">{PAPEL[d.papel] ?? d.papel}</span>
                  <span className={cn(lista ? 'text-mesa-foreground' : 'text-mesa-tenue')}>{estado}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
        <Cursores agentes={agentes} mesa={mesa} />
      </div>
      <Bitacora pieza={pieza} />
      {pieza.error && <p className="mt-3 text-sm text-red-700">{pieza.error}</p>}
    </section>
  );
}

// ------------------------------------------------------------------ La mesa de edición

/** Mientras se retocan las capas de una pieza terminada: la lámina grande y los agentes sobre la capa que tocan. */
export function MesaDeEdicion({ conversacion, pieza }: { conversacion: Conversacion; pieza: Pieza }) {
  const mesa = useRef<HTMLDivElement>(null);
  const edicion = pieza.edicion!;
  const agentes = agentesDe(pieza);
  const url = (r?: string) => (r ? api.archivo(conversacion.id, r) : '');
  const laminas = edicion.laminas.map((n) => pieza.diapositivas.find((d) => d.n === n)).filter((d): d is Pieza['diapositivas'][number] => Boolean(d?.png));
  const enCurso = agentes.find((a) => a.n)?.n ?? laminas[0]?.n;
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => setAncho(mesa.current?.clientWidth ?? 0), []);
  const varias = laminas.length > 1;
  return (
    <section aria-label="Retocando la pieza" className="mesa-de-luz relative -mx-1 overflow-clip rounded-2xl p-4 sm:-mx-10 sm:p-5">
      <div ref={mesa} className="relative">
        <div data-mesa-cabecera className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Titular grande="Retocando" cursiva={varias ? `${laminas.length} láminas` : pieza.formato === 'post' ? 'el post' : `la ${laminas[0]?.n ?? ''}`} />
            <p className="mt-2 max-w-[52ch] text-sm text-mesa-tenue">«{edicion.pedido}»</p>
          </div>
          <Presencia agentes={agentes} />
        </div>
        <div className={cn('flex gap-4', varias ? 'overflow-x-auto pb-1' : 'justify-center')}>
          {laminas.map((l) => {
            const activa = l.n === enCurso;
            return (
              <figure key={l.n} className={cn('grid shrink-0 gap-1.5 transition-opacity duration-500', varias && !activa && 'opacity-55')} style={{ width: varias ? Math.min(240, Math.max(160, ancho / 3)) : 'min(320px, 100%)' }}>
                <div data-lamina={l.n} className={cn('relative overflow-hidden rounded-md', activa && 'retocando')}>
                  <img src={url(l.movil ?? l.png)} alt={`Lámina ${l.n}`} className="aspect-[3/4] w-full object-cover" />
                </div>
                <figcaption className="flex justify-between text-xs text-mesa-tenue">
                  <span>{`Lámina ${l.n}`}</span>
                  <span>{activa ? 'En la mesa' : 'Esperando'}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
        <Cursores agentes={agentes} mesa={mesa} />
      </div>
      <Bitacora pieza={pieza} />
    </section>
  );
}
