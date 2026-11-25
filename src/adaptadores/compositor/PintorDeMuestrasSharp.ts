/**
 * Pintor de la hoja de muestras del creador de estilos, con el compositor de verdad (CompositorSharp): lo que se mide
 * es lo que saldría en una pieza. Cada panel es un lienzo de feed con el fondo y la palabra; se recorta la franja del
 * texto. La receta va en línea (no hace falta que esté en la biblioteca).
 *
 * Para el determinismo se pinta dos veces con dos compositores nuevos: el compositor guarda en caché cada capa
 * pintada, y repetir con el mismo daría el mismo PNG sin volver a pintarlo.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { Intencion } from '../../dominio/diseno/intencion.js';
import type { Receta } from '../../dominio/tipografia/receta.js';
import type { Imagen, PanelDeMuestra } from '../../dominio/tipografia/verificacion.js';
import type { EstiloDePanel, PanelPintado, PintorDeMuestras } from '../../puertos/PintorDeMuestras.js';
import { CompositorSharp } from './CompositorSharp.js';
import { MotorTexto } from './MotorTexto.js';
import { CatalogoTipografico } from './tipografias.js';

const W = 1080;
const H = 1440;
/** La caja del texto y la franja que se recorta (con sitio debajo para gotas y sombras). */
const CAJA = { x: 0.07, y: 0.42, w: 0.86, h: 0.13 };
const RECORTE = { left: 0, top: Math.round(H * 0.36), width: W, height: Math.round(H * 0.3) };
/** Lado de cada panel en la hoja. */
const ANCHO_HOJA = 540;

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class PintorDeMuestrasSharp implements PintorDeMuestras {
  private readonly motor: MotorTexto;

  constructor(private readonly catalogo: CatalogoTipografico) {
    this.motor = new MotorTexto(catalogo);
  }

  familia(fuente: string): string {
    return this.catalogo.familia(fuente);
  }

  clasificacion(fuente: string): string[] {
    return this.catalogo.clasificacion(fuente);
  }

  private intencion(receta: Receta | undefined, panel: PanelDeMuestra, estilo: EstiloDePanel): Intencion {
    return Intencion.parse({
      esquema: 'diseno/intencion@1',
      id: `muestra-${panel.indice}`,
      titulo: `muestra ${panel.indice}`,
      marca: 'muestras',
      activos: {},
      tokens: { colores: { fondo: panel.colorFondo, tinta: panel.colorTexto }, estilos: { palabra: { ...estilo, color: '@tinta' } } },
      capas: [
        { id: 'fondo', tipo: 'relleno', color: '@fondo' },
        { id: 'palabra', tipo: 'texto', texto: panel.palabra, estilo: 'palabra', caja: CAJA, ajuste: 'caja', alinear: 'centro', vertical: 'centro', ...(receta ? { tratamiento: { receta } } : {}) },
      ],
    });
  }

  /** Pinta con un compositor nuevo (sin caché) y devuelve el recorte, sus píxeles y lo que ha tardado. */
  private async pintar(receta: Receta | undefined, panel: PanelDeMuestra, estilo: EstiloDePanel) {
    const compositor = new CompositorSharp(this.motor, this.catalogo);
    const inicio = performance.now();
    const resuelto = await compositor.resolver(this.intencion(receta, panel, estilo), {});
    const { png } = await compositor.renderizar(resuelto, {});
    const ms = performance.now() - inicio;
    const recorte = sharp(png).extract(RECORTE).removeAlpha();
    const { data, info } = await recorte.clone().raw().toBuffer({ resolveWithObject: true });
    const imagen: Imagen = { datos: new Uint8Array(data.buffer, data.byteOffset, data.length), ancho: info.width, alto: info.height, canales: info.channels };
    const capa = resuelto.capas.find((c) => c.tipo === 'texto');
    const aplicado = capa?.tipo === 'texto' && Boolean(capa.tratamiento);
    const cap = capa?.tipo === 'texto' ? Math.max(...capa.lineas.map((l) => this.motor.alturaMayusculas(capa.estilo, l.tamano))) : 0;
    const avisos = resuelto.problemas.filter((p) => p.tipo === 'TRATAMIENTO' && p.gravedad === 'AVISO').map((p) => p.mensaje);
    return { png: await recorte.png().toBuffer(), imagen, ms, aplicado, cap, avisos, hash: createHash('sha256').update(data).digest('hex') };
  }

  async pintarPanel(receta: Receta, panel: PanelDeMuestra, estilo: EstiloDePanel): Promise<PanelPintado> {
    const tratada = await this.pintar(receta, panel, estilo);
    const repetida = await this.pintar(receta, panel, estilo);
    const limpia = await this.pintar(undefined, panel, estilo);
    return {
      png: tratada.png,
      tratada: tratada.imagen,
      limpia: limpia.imagen,
      cap: tratada.cap,
      aplicado: tratada.aplicado,
      avisos: tratada.avisos,
      msRender: tratada.ms,
      hash: tratada.hash,
      hashRepetido: repetida.hash,
    };
  }

  async componerHoja(paneles: Array<{ panel: PanelDeMuestra; png: Buffer; nota: string }>, titulo: string): Promise<Buffer> {
    const alto = Math.round((RECORTE.height * ANCHO_HOJA) / RECORTE.width);
    const rotulo = 46;
    const cabecera = 56;
    const filas = new Map<string, Array<{ panel: PanelDeMuestra; png: Buffer; nota: string }>>();
    for (const p of paneles) {
      const clave = `${p.panel.fuente.id}|${p.panel.palabra}`;
      filas.set(clave, [...(filas.get(clave) ?? []), p]);
    }
    const fondos = ['oscuro', 'claro'] as const;
    const ancho = ANCHO_HOJA * fondos.length;
    const altoTotal = cabecera + filas.size * (alto + rotulo);
    const piezas: Array<{ input: Buffer; left: number; top: number }> = [];
    const textos: string[] = [`<text x="16" y="36" font-family="Menlo, monospace" font-size="22" fill="#EDEDED">${escapar(titulo)}</text>`];
    [...filas.values()].forEach((fila, j) => {
      const top = cabecera + j * (alto + rotulo);
      for (const p of fila) {
        const i = fondos.indexOf(p.panel.fondo);
        piezas.push({ input: p.png, left: i * ANCHO_HOJA, top });
        // Dos líneas: la fuente y la lectura; las medidas. Verde si el panel pasa, rojo si no.
        const color = p.nota.startsWith('✓') ? '#9BE39B' : '#FF9A8A';
        const [lectura = '', medidas = ''] = p.nota.split('\n');
        const linea = (y: number, texto: string) => `<text x="${i * ANCHO_HOJA + 10}" y="${y}" font-family="Menlo, monospace" font-size="14" fill="${color}">${escapar(texto.slice(0, 60))}</text>`;
        textos.push(linea(top + alto + 18, `${p.panel.fuente.familia} · ${lectura}`), linea(top + alto + 37, medidas));
      }
    });
    const redimensionados = await Promise.all(piezas.map(async (p) => ({ ...p, input: await sharp(p.input).resize(ANCHO_HOJA).png().toBuffer() })));
    const rotulos = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${altoTotal}">${textos.join('')}</svg>`);
    return sharp({ create: { width: ancho, height: altoTotal, channels: 3, background: '#202020' } })
      .composite([...redimensionados, { input: rotulos, left: 0, top: 0 }])
      .png()
      .toBuffer();
  }
}
