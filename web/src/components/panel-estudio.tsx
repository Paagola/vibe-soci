import { useEffect, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowUpRight, CalendarClock, CircleDollarSign, Layers3, Workflow } from 'lucide-react';
import { pedir } from '@/lib/api';

interface Mes {
  mes: string; entrada: number; salida: number; razonamiento: number; llamadas: number; imagenes: number;
  imagenUsd: number; imagenEstimadaUsd: number; textoEstimadoUsd: number; higgsfieldEstimadoUsd: number; creditos: number; sinTarifa: number;
}
interface Local {
  slug: string; nombre: string; campanas: number; piezas: number; entregas: number; incidencias: number;
  preparacion: boolean; renovacion: { proxima: string; objetivo: string; error?: string } | null;
}
const formato = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
const moneda = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const nombreMes = (mes: string) => new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(mes + '-15T12:00:00'));
const tokens = (m: Mes) => m.entrada + m.salida + m.razonamiento;
const gasto = (m: Mes) => m.imagenUsd + m.imagenEstimadaUsd + m.textoEstimadoUsd + m.higgsfieldEstimadoUsd;
const tab = 'rounded-lg px-3 py-2 text-sm text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:font-semibold';
const caja = 'rounded-2xl border border-border bg-lateral p-4 sm:p-6';

function useRegistro<T>(ruta: string, revision: number) {
  const [datos, guardar] = useState<T>();
  const [error, fallo] = useState('');
  useEffect(() => {
    let vigente = true;
    let leyendo = false;
    const actualizar = async () => {
      if (leyendo) return;
      leyendo = true;
      try { const valor = await pedir<T>(ruta); if (vigente) { guardar(valor); fallo(''); } }
      catch (e) { if (vigente) fallo(e instanceof Error ? e.message : 'Error de lectura'); }
      finally { leyendo = false; }
    };
    void actualizar();
    const reloj = window.setInterval(() => { if (!document.hidden) void actualizar(); }, 60000);
    window.addEventListener('focus', actualizar);
    return () => { vigente = false; clearInterval(reloj); window.removeEventListener('focus', actualizar); };
  }, [ruta, revision]);
  return { datos, error };
}

export default function PanelEstudio({ gestionar, revision }: { gestionar: (local?: string) => void; revision: number }) {
  const actividad = useRegistro<{ simulado: boolean; locales: Local[] }>('/api/agencia/panel/actividad', revision);
  const consumo = useRegistro<{ actual: string; meses: Mes[] }>('/api/panel/consumo', revision);
  const [serie, setSerie] = useState('gasto');
  const [seleccion, elegir] = useState('');
  const meses = consumo.datos?.meses ?? [];
  const recientes = meses.slice(0, 6).reverse();
  const medir = serie === 'gasto' ? gasto : tokens;
  const maximo = Math.max(0, ...recientes.map(medir));
  const mes = meses.find(m => m.mes === (seleccion || consumo.datos?.actual));
  const locales = actividad.datos?.locales ?? [];
  const activos = locales.filter(l => l.renovacion || l.preparacion || l.incidencias);
  const flujos = locales.reduce((n, l) => n + Number(Boolean(l.renovacion)) + Number(l.preparacion), 0);
  return <main className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
    <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Actividad del estudio</h1>
    <section className={caja}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Workflow className="size-5 text-acento" /> Flujos automáticos</h2>
        <button onClick={() => gestionar()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Gestionar campañas <ArrowUpRight className="size-4" /></button></div>
      {actividad.error && <p role="alert">{actividad.error}</p>}
      {actividad.datos ? <>
        <p className="my-3 text-sm text-muted-foreground">{flujos} activos · {locales.length} locales · Modo {actividad.datos.simulado ? 'simulado' : 'real'}</p>
        {activos.map(l => <button key={l.slug} onClick={() => gestionar(l.slug)} className="flex w-full items-center justify-between gap-3 border-t border-border py-3 text-left hover:text-acento">
          <span><strong className="block text-sm">{l.nombre}</strong>
            {l.renovacion && <span className="block text-sm">Renovación del calendario · {new Date(l.renovacion.proxima + 'T12:00:00').toLocaleDateString('es-ES')}</span>}
            {l.preparacion && <span className="block text-sm">Preparación visual y entrega automática</span>}
            {Boolean(l.incidencias || l.renovacion?.error) && <span className="text-sm text-destructive">Requiere revisión</span>}</span><ArrowUpRight className="size-4" /></button>)}
        {!activos.length && <p className="border-t border-border pt-3 text-sm">Puedes activar la renovación de calendarios desde Campañas.</p>}
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">{(['campanas', 'piezas', 'entregas'] as const).map((k,i) =>
          <div key={k}><dt className="text-xs text-muted-foreground">{['Campañas','Piezas previstas','Entregas listas'][i]}</dt><dd className="text-xl font-semibold tabular-nums">{formato.format(locales.reduce((s,l) => s + l[k], 0))}</dd></div>)}</dl>
      </> : !actividad.error && <p role="status">Cargando actividad…</p>}
    </section>
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-2xl font-semibold">Consumo mensual</h2>
      {mes && <select aria-label="Mes del consumo" value={mes.mes} onChange={e => elegir(e.target.value)} className="rounded-lg border border-border bg-lateral px-3 py-2 text-sm">
        {meses.map(m => <option key={m.mes} value={m.mes}>{nombreMes(m.mes)}</option>)}</select>}</div>
      {consumo.error && <p role="alert">{consumo.error}</p>}
      {mes ? <>
        <div className="grid gap-3 sm:grid-cols-3">{[
          { titulo: 'Tokens registrados', valor: formato.format(tokens(mes)), Icono: Layers3 },
          { titulo: 'Gasto con tarifa conocida', valor: moneda.format(gasto(mes)), Icono: CircleDollarSign },
          { titulo: 'Llamadas de texto y visión', valor: formato.format(mes.llamadas), Icono: CalendarClock },
        ].map(({ titulo, valor, Icono }) => <div key={titulo} className="hoja rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-2 text-sm">{titulo}<Icono className="size-4" /></div><p className="mt-3 text-2xl font-semibold tabular-nums">{valor}</p></div>)}</div>
        <Tabs.Root defaultValue="coste" className={caja}><Tabs.List aria-label="Detalle del consumo" className="flex flex-wrap gap-1 border-b border-border pb-3">
          <Tabs.Trigger className={tab} value="coste">Gasto</Tabs.Trigger><Tabs.Trigger className={tab} value="tokens">Tokens</Tabs.Trigger><Tabs.Trigger className={tab} value="historial">Histórico mensual</Tabs.Trigger></Tabs.List>
          <Tabs.Content value="coste"><Desglose filas={[
            ['Imágenes Gemini · coste registrado', moneda.format(mes.imagenUsd)], ['Imágenes Gemini · estimación', moneda.format(mes.imagenEstimadaUsd)],
            ['Texto Hydrogen · estimación', moneda.format(mes.textoEstimadoUsd)], ['API Higgsfield · estimación', moneda.format(mes.higgsfieldEstimadoUsd)],
            ['Higgsfield MCP', formato.format(mes.creditos) + ' créditos'],
          ]} /><p className="mt-3 text-xs text-muted-foreground">Consumo real del estudio en ambos modos. El importe incluye estimaciones. {mes.sinTarifa} llamadas de texto sin precio registrado.</p></Tabs.Content>
          <Tabs.Content value="tokens"><Desglose filas={[[ 'Entrada', formato.format(mes.entrada)], ['Salida', formato.format(mes.salida)], ['Razonamiento', formato.format(mes.razonamiento)], ['Imágenes Gemini completadas', formato.format(mes.imagenes)]]} /></Tabs.Content>
          <Tabs.Content value="historial">
            <div className="mb-4 mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Últimos seis meses</h3>
              <select aria-label="Medida del gráfico" value={serie} onChange={e => setSerie(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-sm"><option value="gasto">Gasto en USD</option><option value="tokens">Tokens</option></select></div>
            <div aria-hidden="true" className="grid grid-cols-6 gap-2 border-b border-border pb-3">
              {recientes.map(m => <div key={m.mes} className="min-w-0 text-center" title={nombreMes(m.mes) + ' · ' + (serie === 'gasto' ? moneda.format(gasto(m)) : formato.format(tokens(m)))}>
                <div className="mx-auto flex h-20 max-w-12 items-end"><div className="w-full rounded-t bg-acento" style={{height: (maximo ? medir(m) / maximo * 100 : 0) + '%'}} /></div>
                <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(m.mes + '-15T12:00:00'))}</span></div>)}
            </div>
            <table className="mt-3 w-full text-left text-sm tabular-nums"><thead><tr><th scope="col">Mes</th><th scope="col" className="text-right">Tokens</th><th scope="col" className="text-right">Gasto</th></tr></thead>
            <tbody>{meses.map(m => <tr className="border-t border-border" key={m.mes}><th scope="row" className="py-3 font-normal">{nombreMes(m.mes)}</th><td className="text-right">{formato.format(tokens(m))}</td><td className="text-right">{moneda.format(gasto(m))}</td></tr>)}</tbody></table></Tabs.Content>
        </Tabs.Root>
      </> : !consumo.error && <p role="status">Cargando consumo…</p>}
    </section>
  </div></main>;
}

function Desglose({ filas }: { filas: [string, string][] }) {
  return <dl>{filas.map(([etiqueta, valor]) => <div key={etiqueta} className="flex justify-between gap-4 border-b border-border py-3 text-sm last:border-0">
    <dt>{etiqueta}</dt><dd className="shrink-0 font-medium tabular-nums">{valor}</dd></div>)}</dl>;
}
