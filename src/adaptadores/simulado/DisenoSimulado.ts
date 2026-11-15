/**
 * Director y crítico de diseño SIMULADOS (F3), para `npm run post -- … --simular` y las pruebas. No llaman a nada.
 * El director elige siempre el mecanismo más seguro (TITULAR_DETRAS) con el titular sacado literal de la nota del dueño
 * y la firma del local; el código coloca. El crítico da la pieza por buena (o lo que se le ponga en cola).
 * No es diseño: sirve para recorrer la orden de punta a punta sin gastar.
 */
import type { PropuestaDeDiseno } from '../../dominio/diseno/propuesta.js';
import type { CriticaDeDiseno, CriticoDeDiseno, DirectorDeDiseno, EncargoDeDiseno } from '../../puertos/DirectorDeDiseno.js';

const GRAMATICALES = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'sin', 'sobre', 'un', 'una', 'y', 'e', 'o']);

/** Las primeras palabras de la nota hasta la primera pausa (tal cual, para que la cita sea literal), sin acabar en «de», «con»… */
export function titularDeLaNota(nota: string, maximo = 3): string {
  const palabras = (nota.trim().split(/[,.;:(]/)[0] ?? '').trim().split(/\s+/).slice(0, maximo);
  while (palabras.length > 1 && GRAMATICALES.has(palabras[palabras.length - 1]!.toLowerCase())) palabras.pop();
  return palabras.join(' ').replace(/[,.;:]+$/, '');
}

export class DirectorDisenoSimulado implements DirectorDeDiseno {
  readonly nombre = 'director de diseño simulado';
  readonly encargos: EncargoDeDiseno[] = [];
  readonly problemasRecibidos: string[][] = [];

  constructor(private readonly cola: PropuestaDeDiseno[] = []) {}

  async proponer(e: EncargoDeDiseno, problemasPrevios: string[] = []): Promise<PropuestaDeDiseno> {
    this.encargos.push(e);
    this.problemasRecibidos.push(problemasPrevios);
    const enCola = this.cola.shift();
    if (enCola) return enCola;
    const titular = titularDeLaNota(e.hechos.plato);
    // Carrusel: dos detalles con los dos primeros elementos confirmados (el nombre tal cual), en dos puntos de la foto.
    const detalles = e.formato === 'carrusel' ? e.hechos.elementos.slice(0, 2).map((x, i) => ({ clave: `elemento-${i + 1}`, texto: x.nombre, punto: { x: 0.4 + 0.2 * i, y: 0.55 } })) : [];
    return {
      idea: `Simulado: «${titular}» monumental detrás del plato, y la firma del local.`,
      foco: 'PLATO',
      seToma: e.referencia ? [`De ${e.referencia.id}: un solo foco y un titular grande frente a una firma pequeña.`] : [],
      noSeCopia: e.referencia ? ['Sus textos, su marca y su plato.'] : [],
      textos: [
        { clave: 'titular', texto: titular, fuente: 'PLATO', cita: titular },
        { clave: 'firma', texto: e.hechos.local.nombre, fuente: 'MARCA', cita: e.hechos.local.nombre },
        ...detalles.map((d) => ({ clave: d.clave, texto: d.texto, fuente: 'ELEMENTO' as const, cita: d.texto })),
      ],
      composicion: { mecanismo: 'TITULAR_DETRAS', titular: 'titular', firma: 'firma' },
      ...(detalles.length ? { carrusel: { detalles: detalles.map((d) => ({ texto: d.clave, punto: d.punto })) } } : {}),
    };
  }
}

export class CriticoDisenoSimulado implements CriticoDeDiseno {
  readonly nombre = 'crítico de diseño simulado';
  readonly piezas: string[] = [];

  constructor(private readonly cola: CriticaDeDiseno[] = []) {}

  async criticar(_e: EncargoDeDiseno, _p: PropuestaDeDiseno, pieza: string): Promise<CriticaDeDiseno> {
    this.piezas.push(pieza);
    return this.cola.shift() ?? { llega: true, motivos: [] };
  }
}
