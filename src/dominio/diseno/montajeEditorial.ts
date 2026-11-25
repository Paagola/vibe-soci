import { z } from 'zod';
import { CapaImagen, CapaTexto } from './intencion.js';

const Clave = z.string().regex(/^[a-z][a-z0-9-]*$/);
const Token = z.string().regex(/^@[a-z][a-zA-Z0-9-]*$/);
const Fraccion = z.number().min(0).max(1);
const Punto = z.object({ x: Fraccion, y: Fraccion });
const Caja = z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), w: z.number().positive().max(2), h: z.number().positive().max(2) });
const trazo = { id: Clave, color: Token, grosor: z.number().min(0.5).max(16).optional(), opacidad: Fraccion.optional() };

/** El orden de estas piezas es el orden de impresión. La única entrada raster es la fotografía elegida. */
export const MontajeEditorial = z.object({
  capas: z.array(z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('foto'), caja: Caja, enfoque: Punto.optional(), zoom: z.number().min(1).max(4).optional(), ventana: CapaImagen.shape.ventana }),
    z.object({
      tipo: z.literal('texto'), id: Clave, texto: Clave, voz: Clave, caja: Caja, color: Token,
      ajuste: z.enum(['caja', 'ancho', 'alto', 'ancho-por-linea']).optional(), alinear: CapaTexto.shape.alinear.optional(), vertical: CapaTexto.shape.vertical.optional(),
      linea: CapaTexto.shape.linea, giro: CapaTexto.shape.giro.optional(), opacidad: Fraccion.optional(), sangrado: z.boolean().optional(),
      decorativo: z.boolean().optional(), desenfoque: CapaTexto.shape.desenfoque,
    }),
    z.object({ tipo: z.literal('linea'), ...trazo, desde: Punto, hasta: Punto }),
    z.object({ tipo: z.literal('marco'), ...trazo, caja: Caja, radio: z.number().min(0).max(600).optional() }),
    z.object({ tipo: z.literal('textura'), id: Clave, recurso: z.enum(['grano', 'papel']), intensidad: Fraccion.optional() }),
  ])).min(2).max(36),
});
export type MontajeEditorial = z.infer<typeof MontajeEditorial>;

/** La marca, las voces y los textos se comprueban contra el mismo encargo que usa el resto del estudio. */
export function compilarPlanos(montaje: MontajeEditorial, validar: {
  texto(clave: string, donde: string): string; voz(nombre: string, donde: string): string; color(token: string, donde: string): string;
}) {
  const capas: Record<string, unknown>[] = [];
  const relaciones: Record<string, unknown>[] = [];
  for (const capa of montaje.capas) {
    switch (capa.tipo) {
      case 'foto': {
        const { tipo: _, ...foto } = capa;
        capas.push({ id: 'foto', tipo: 'imagen', activo: 'foto', ...foto });
        break;
      }
      case 'texto': {
        const { voz, texto, color, ...tipografia } = capa;
        capas.push({ ajuste: 'caja', ...tipografia, estilo: validar.voz(voz, capa.id), texto: validar.texto(texto, capa.id), color: validar.color(color, capa.id) });
        if (!capa.decorativo) relaciones.push({ tipo: 'contrasteMinimo', texto: capa.id, ratio: 3 });
        break;
      }
      case 'linea':
      case 'marco': {
        const { tipo, color, ...forma } = capa;
        capas.push({ tipo: 'forma', figura: tipo === 'linea' ? 'linea' : 'rect', grosor: 1, ...forma, color: validar.color(color, capa.id) });
        break;
      }
      case 'textura':
        capas.push({ ...capa, intensidad: capa.intensidad ?? .08, fusion: capa.recurso === 'papel' ? 'soft-light' : 'overlay' });
        break;
    }
  }
  return { capas, relaciones };
}
