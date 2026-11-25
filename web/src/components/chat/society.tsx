/**
 * Las piezas de la identidad de Society en el chat (repos/society-idea/society-identidad-editorial):
 * - el titular: condensada enorme en mayúsculas y una palabra en serif cursiva, con su destello cobalto;
 * - la píldora de cristal líquido que enseña qué está haciendo el agente, paso a paso.
 */
import type { Conversacion } from '@/lib/api';
import { cn } from '@/lib/utils';

export function Destello({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('destello inline-block size-[0.42em] align-top', className)}>
      <path fill="currentColor" d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z" />
    </svg>
  );
}

/** «ELIGE *el concepto*»: lo grande en Anton, el acento en Playfair cursiva. */
export function Titular(p: { grande: string; cursiva?: string; tamano?: 'md' | 'lg' | 'xl'; className?: string; destello?: boolean }) {
  const tam = p.tamano === 'xl' ? 'text-[64px] sm:text-[84px]' : p.tamano === 'lg' ? 'text-[44px]' : 'text-[34px]';
  return (
    <h3 className={cn('font-display', tam, p.className)}>
      {p.grande}
      {p.cursiva && <span className="serif-cursiva ml-[0.18em] text-[0.92em]">{p.cursiva}</span>}
      {p.destello !== false && <Destello className="ml-1" />}
    </h3>
  );
}

/** Lo que está haciendo el agente ahora mismo, sacado de la conversación (o nada si está parado). */
export function actividadDe(c?: Conversacion): { texto: string; detalle?: string } | undefined {
  if (!c) return undefined;
  const bloques = c.mensajes.flatMap((m) => m.bloques);
  const produciendo = c.piezas.find((p) => p.estado === 'PRODUCIENDO');
  if (produciendo) {
    const paso = [...produciendo.progreso].reverse().find((x) => x.estado === 'en-curso');
    const total = produciendo.plan?.diapositivas.length ?? 0;
    const listas = produciendo.diapositivas.filter((d) => d.png).length;
    const texto = paso ? paso.texto.replace(/^Foto nueva de la diapositiva/, 'Fotografiando la lámina').replace(/^Diseño de la diapositiva/, 'Componiendo la lámina') : 'Montando la pieza';
    return { texto, ...(total ? { detalle: `${listas} de ${total} listas` } : {}) };
  }
  const editando = c.piezas.find((p) => p.edicion);
  if (editando) {
    const a = editando.agentes?.at(-1);
    return { texto: a ? a.accion : 'Retocando las capas', detalle: `${editando.edicion!.laminas.length === 1 ? 'lámina' : 'láminas'} ${editando.edicion!.laminas.join(', ')}` };
  }
  const planificando = c.piezas.find((p) => p.estado === 'PROPUESTA' && !p.plan);
  if (planificando) return { texto: [...planificando.progreso].reverse().find((x) => x.estado === 'en-curso')?.texto ?? 'Planificando cada lámina' };
  const refs = bloques.find((b) => b.tipo === 'referencias' && b.estado === 'BUSCANDO');
  if (refs && refs.tipo === 'referencias') return { texto: refs.progreso.at(-1) ?? 'Buscando referencias en Pinterest' };
  if (bloques.some((b) => b.tipo === 'conceptos' && b.estado === 'BUSCANDO')) return { texto: 'Pensando tres maneras de contarlo' };
  const herramienta = bloques.find((b) => b.tipo === 'herramienta' && b.estado === 'EN_CURSO');
  if (herramienta && herramienta.tipo === 'herramienta') return { texto: herramienta.progreso.at(-1) ?? 'Trabajando con la herramienta' };
  if (c.pensando) return { texto: 'El director está pensando' };
  return undefined;
}

/** La píldora de cristal líquido: el cobalto se mueve dentro y el texto se releva cuando cambia de tarea. */
export function AgenteTrabajando({ c }: { c?: Conversacion }) {
  const a = actividadDe(c);
  return (
    <div aria-live="polite" className={cn('pointer-events-none mx-auto flex w-full max-w-[720px] justify-center transition-all duration-500', a ? 'opacity-100' : 'h-0 opacity-0')}>
      {a && (
        <div className="cristal relative flex h-11 items-center gap-3 overflow-hidden rounded-full pl-3 pr-5">
          <div aria-hidden="true" className="liquido absolute inset-0 opacity-70" />
          <span aria-hidden="true" className="relative flex size-6 items-center justify-center rounded-full bg-cobalto shadow-[0_0_18px_rgb(36_64_224/0.9)]">
            <span className="size-2 animate-ping rounded-full bg-papel" />
          </span>
          <span key={a.texto} className="relevo relative max-w-[30rem] truncate text-sm font-semibold text-papel">
            {a.texto}
          </span>
          {a.detalle && <span className="relative text-xs text-papel/70">{a.detalle}</span>}
        </div>
      )}
    </div>
  );
}
