import { z } from 'zod';
import { Distancia, HuecosFotoNueva } from './fotoNueva.js';
import { Familia, Mecanismo } from './referencia.js';

export const Gesto = z.enum(['EMERGER', 'LUZ_Y_SOMBRA', 'RITMO', 'MACRO']);
export type Gesto = z.infer<typeof Gesto>;

export const DireccionDeArte = z.object({
  gesto: Gesto,
  sujeto: z.string().trim().min(3).max(480),
  escena: z.string().trim().min(5).max(600),
  tipografia: z.string().trim().min(5).max(480),
  materia: z.string().trim().min(5).max(480),
});
export type DireccionDeArte = z.infer<typeof DireccionDeArte>;

export const VistaDeProducto = z.enum(['RASANTE', 'OBLICUA', 'CENITAL']);
export type VistaDeProducto = z.infer<typeof VistaDeProducto>;
export const SeleccionDeToma = z.object({
  opcion: z.enum(['AUTO', ...VistaDeProducto.options]),
  plano: Distancia.optional(),
  luz: z.string().trim().min(5).max(320).optional(),
  accionProducto: z.string().trim().min(5).max(320).optional(),
  origen: z.object({ anguloGrados: z.number().min(-45).max(90), distancia: Distancia }).optional(),
  rasgoFuente: z.string().trim().min(3).max(220).optional(),
});
export type SeleccionDeToma = z.infer<typeof SeleccionDeToma>;
const posicion = HuecosFotoNueva.shape.camara.extend({
  vista: VistaDeProducto, distancia: Distancia, giroGrados: z.number().min(0).max(180), evidencia: z.string().min(5),
});
export const TomaDelCartel = z.object({
  seleccion: SeleccionDeToma, camara: posicion, alternativa: posicion.optional(), cambios: z.array(z.string()),
  encuadre: z.string(), accion: z.string(), luz: z.string(), foco: z.string(), conservar: z.string(),
});
export type TomaDelCartel = z.infer<typeof TomaDelCartel>;

const bloque = z.object({ texto: z.string().min(1), fuente: z.enum(['PLATO', 'MARCA']), papel: z.enum(['TITULAR', 'FIRMA', 'ENLACE', 'ACENTO']) });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const ComandaDeArte = z.object({
  nombrePlato: z.string().optional(), toma: TomaDelCartel.optional(), direccion: DireccionDeArte, textos: z.array(bloque).min(1).max(5),
  referencia: z.object({ id: z.string(), familia: z.string(), mecanismos: z.array(z.string()), voces: z.array(z.string()), reticula: z.string(), encuadre: z.string(),
    recursos: z.array(z.string()), lectura: z.array(z.string()) }).optional(),
  fotografia: z.object({ temperatura: z.string(), dominantes: z.array(z.string()), acento: z.string().optional(), luz: z.number(), aire: z.string() }),
  fotoSha256: hash, uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']), prompt: z.string(), huella: hash,
});
export type ComandaDeArte = z.infer<typeof ComandaDeArte>;
const revision = z.object({ vistaObservada: VistaDeProducto.optional(), cambioDeToma: z.literal(true).optional(), transcripcion: z.array(z.string()), producto: z.literal(true), legibilidad: z.literal(true), gesto: z.literal(true), fecha: z.string() });
export const TallerDeArte = z.object({
  comanda: ComandaDeArte.optional(),
  confirmada: z.object({ huella: hash, fecha: z.string() }).optional(),
  candidatas: z.array(z.object({
    version: z.int().positive(), sha256: hash, comanda: hash, fecha: z.string(),
    origen: z.enum(['IMPORTACION', 'IMAGES_API']), uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']),
    lectura: z.object({ motor: z.string(), lineas: z.array(z.string()), coincide: z.boolean().nullable(), superficieUniforme: z.boolean().optional() }),
    devolucion: z.string().optional(), revision: revision.optional(),
  })).default([]),
  envios: z.array(z.object({ huella: hash, fecha: z.string(), numero: z.int().positive() })).default([]),
});
export type TallerDeArte = z.infer<typeof TallerDeArte>;

export const AccionTaller = z.discriminatedUnion('accion', [
  z.strictObject({ accion: z.literal('SIN_REFERENCIA'), revision: z.string().min(1) }),
  z.strictObject({ accion: z.literal('FICHAR_REFERENCIA'), revision: z.string().min(1), familia: Familia, mecanismo: Mecanismo,
    reticula: z.string().trim().min(10).max(220), foto: z.string().trim().min(5).max(200), voz: z.string().trim().min(3).max(120),
    lectura: z.tuple([z.string().min(2).max(80), z.string().min(2).max(80), z.string().min(2).max(80)]) }),
  z.strictObject({ accion: z.literal('AJUSTAR_TOMA'), revision: z.string().min(1), ...SeleccionDeToma.shape }),
  z.strictObject({ accion: z.literal('PROPONER_GESTO'), revision: z.string().min(1), gesto: Gesto }),
  z.strictObject({ accion: z.literal('REABRIR_DIRECCION'), revision: z.string().min(1) }),
  z.strictObject({ accion: z.literal('EDITAR'), revision: z.string().min(1), direccion: DireccionDeArte, nombrePlato: z.string().trim().min(2).max(300).optional() }),
  z.strictObject({ accion: z.literal('CONFIRMAR_DIRECCION'), revision: z.string().min(1) }),
  z.strictObject({ accion: z.literal('GENERAR'), revision: z.string().min(1), autorizarUnEnvio: z.literal(true) }),
  z.strictObject({ accion: z.literal('IMPORTAR'), revision: z.string().min(1), subidaId: z.string().min(1), usoCandidata: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']).optional() }),
  z.strictObject({ accion: z.literal('DEVOLVER'), revision: z.string().min(1), version: z.int().positive(), motivo: z.string().trim().min(3).max(480), ajusteToma: SeleccionDeToma.optional() }),
  z.strictObject({ accion: z.literal('APROBAR'), revision: z.string().min(1), version: z.int().positive(), vistaObservada: VistaDeProducto.optional(), cambioDeToma: z.literal(true).optional(),
    transcripcion: z.array(z.string().trim().min(1).max(300)).min(1).max(12), producto: z.literal(true), legibilidad: z.literal(true), gesto: z.literal(true) }),
]);
export type AccionTaller = z.infer<typeof AccionTaller>;
