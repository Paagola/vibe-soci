/**
 * La composición de una lámina, capa a capa, sobre la mesa de luz: el único momento de la interfaz que se mueve solo
 * (diseno/UI-ESTUDIO.md). Las capas son PNG a lienzo completo (1080 × 1440) que guarda el compositor; cada tipo entra
 * a su manera (el fondo se funde, la foto se enfoca, el plato se posa con su sombra, el titular se revela, los filetes
 * se trazan, los textos pequeños suben) y al final aparece la pieza definitiva (con su acabado, si lo lleva) y un
 * barrido de luz. Con «reducir movimiento», aparece directamente.
 */
import { cn } from '@/lib/utils';

/** El efecto de cada capa, por el nombre de su archivo («03-plato.png», «05-titular.png»…). */
function efectoDe(archivo: string): string {
  const n = archivo.toLowerCase().split('/').pop() ?? '';
  if (/foto|escena/.test(n)) return 'capa-foto';
  if (/plato|recorte|producto|sujeto/.test(n)) return 'capa-plato';
  if (/sombra/.test(n)) return 'capa-sombra';
  if (/titular|acento|repeticion|patron/.test(n)) return 'capa-titular';
  if (/filete|linea|trazo|marco/.test(n)) return 'capa-filete';
  if (/firma|apoyo|nota|anotacion|sello|dato/.test(n)) return 'capa-texto';
  if (/papel|textura|grano/.test(n)) return 'capa-textura';
  return 'capa-fondo';
}

/** Lo que tarda en montarse una lámina con estas capas (para encadenar lo que venga después). */
export function duracionDeComposicion(capas: number): number {
  return Math.max(1, capas) * PASO + 1200;
}

const PASO = 380;

export function Composicion(p: { capas: string[]; final: string; alt: string; className?: string; animar?: boolean }) {
  const animar = p.animar !== false;
  // Sin capas (una foto sola): la foto se enfoca y pasa la luz.
  const capas = p.capas.length ? p.capas : [];
  const finalEn = capas.length * PASO + 250;
  return (
    <div className={cn('relative aspect-[3/4] overflow-hidden rounded-md bg-mesa', p.className)}>
      {animar &&
        capas.map((c, i) => (
          <img key={c} src={c} alt="" aria-hidden="true" className={cn('capa absolute inset-0 h-full w-full object-cover', efectoDe(c))} style={{ '--d': `${i * PASO}ms` } as React.CSSProperties} />
        ))}
      <img
        src={p.final}
        alt={p.alt}
        className={cn('absolute inset-0 h-full w-full object-cover', animar && (capas.length ? 'capa capa-final' : 'foto-llega'))}
        style={animar && capas.length ? ({ '--d': `${finalEn}ms` } as React.CSSProperties) : undefined}
      />
      {animar && <div aria-hidden="true" className="barrido pointer-events-none absolute inset-0" style={{ '--d': `${capas.length ? finalEn + 200 : 600}ms` } as React.CSSProperties} />}
    </div>
  );
}
