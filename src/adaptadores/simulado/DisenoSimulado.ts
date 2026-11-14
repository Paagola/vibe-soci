/**
 * Director de diseño SIMULADO (F3), para `npm run post -- … --simular` y las pruebas. No llama a nada.
 * Escribe una propuesta sencilla pero correcta con lo que mide el código: la foto a sangre, el titular (las primeras
 * palabras de la nota del dueño) en la zona libre más grande del mapa, con la tinta que más contrasta, y la firma.
 * No es un diseño: sirve para recorrer la orden de punta a punta sin gastar.
 */
import { contraste } from '../../dominio/diseno/color.js';
import type { PropuestaDeDiseno } from '../../dominio/diseno/propuesta.js';
import type { DirectorDeDiseno, EncargoDeDiseno } from '../../puertos/DirectorDeDiseno.js';

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

  constructor(private readonly cola: PropuestaDeDiseno[] = []) {}

  async proponer(e: EncargoDeDiseno): Promise<PropuestaDeDiseno> {
    this.encargos.push(e);
    const enCola = this.cola.shift();
    if (enCola) return enCola;

    const titular = titularDeLaNota(e.hechos.plato);
    // La zona libre más grande del mapa (sin plato) con sitio para un titular; si no hay, una banda arriba.
    const zona = e.mapa.libres.find((z) => z.col[1] - z.col[0] >= 3 && z.fila[1] - z.fila[0] >= 1 && z.fila[0] >= 2 && z.fila[1] <= 15);
    const caja = zona ? { col: zona.col, fila: [zona.fila[0], Math.min(zona.fila[1], zona.fila[0] + 3)] as [number, number] } : { col: [1, 12] as [number, number], fila: [2, 4] as [number, number] };
    const cajaTitular = { col: caja.col, fila: [caja.fila[0], caja.fila[1] - 1] as [number, number] };
    const cajaFirma = { col: caja.col, fila: [caja.fila[1], caja.fila[1]] as [number, number] };
    // El texto va sobre un bloque de color: se lee sea cual sea la foto (el simulado no mira el contraste de la foto).
    const porLuz = [...e.colores].sort((a, b) => contraste(b.hex, '#FFFFFF') - contraste(a.hex, '#FFFFFF'));
    const oscuro = porLuz[0];
    const claro = [...porLuz].sort((a, b) => contraste(b.hex, oscuro?.hex ?? '#000000') - contraste(a.hex, oscuro?.hex ?? '#000000'))[0];
    const vozTitular = e.voces.find((v) => /titular|palabra|frase/.test(v.id)) ?? e.voces[0];
    const vozFirma = e.voces.find((v) => /firma|rotulo|versalita|texto/.test(v.id) && v.id !== vozTitular?.id) ?? e.voces[e.voces.length - 1];
    if (!oscuro || !claro || !vozTitular || !vozFirma) throw new Error('El director simulado necesita al menos un color y una voz.');

    return {
      idea: `Simulado: la foto a sangre y «${titular}» sobre un bloque, en la zona más tranquila de la foto.`,
      foco: 'PLATO',
      seToma: e.referencia ? [`De ${e.referencia.id}: un solo foco y un titular grande frente a una firma pequeña.`] : [],
      noSeCopia: e.referencia ? ['Sus textos, su marca y su plato.'] : [],
      textos: [
        { clave: 'titular', texto: titular, fuente: 'PLATO', cita: titular },
        { clave: 'firma', texto: e.hechos.local.nombre, fuente: 'MARCA', cita: e.hechos.local.nombre },
      ],
      capas: [
        { tipo: 'fondo', color: `@${oscuro.token}` },
        { tipo: 'foto', encuadre: 'sangre' },
        { tipo: 'forma', figura: 'bloque', caja, color: `@${oscuro.token}`, plano: 'frente', ...(zona ? {} : { sangra: true }) },
        { tipo: 'texto', id: 'titular', texto: 'titular', voz: vozTitular.id, caja: cajaTitular, ajuste: 'caja', color: `@${claro.token}`, relacion: 'aparte' },
        { tipo: 'texto', id: 'firma', texto: 'firma', voz: vozFirma.id, caja: cajaFirma, ajuste: 'fijo', tamano: 34, color: `@${claro.token}`, relacion: 'aparte' },
      ],
    };
  }
}
