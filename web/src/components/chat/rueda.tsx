/**
 * La rueda (WorksWheel) a pantalla completa: para ver las diapositivas de una pieza o los resultados de una
 * herramienta, y para elegir una referencia de la biblioteca o un estilo. Se gira con la rueda, arrastrando o con las
 * flechas; con `alElegir`, la tarjeta de delante se elige pulsándola.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { WorksWheel, type WorksWheelItem } from '@/components/ui/works-wheel';

export function Rueda(p: { titulo: string; items: WorksWheelItem[]; vertical?: boolean; alCerrar: () => void; alElegir?: (item: WorksWheelItem, i: number) => void; ayuda?: string }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && p.alCerrar();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [p]);
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-label={p.titulo}>
      <WorksWheel
        items={p.items}
        label={p.titulo}
        action={p.alElegir ? 'Elegir' : 'Abrir'}
        cardRatio={p.vertical === false ? 1.45 : 0.75}
        cardHeight={p.vertical === false ? 0.38 : 0.62}
        {...(p.alElegir ? { onPick: p.alElegir } : {})}
        className="bg-transparent"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs text-muted-foreground">
        {p.ayuda ?? 'Gira con la rueda, arrastra o usa las flechas'}
      </div>
      <button type="button" aria-label="Cerrar" onClick={p.alCerrar} className="absolute left-4 top-4 rounded-full border border-border bg-card/80 p-2 text-foreground/80 backdrop-blur hover:text-foreground">
        <X className="size-5" />
      </button>
    </div>
  );
}
