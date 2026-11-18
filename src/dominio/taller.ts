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
const Vajilla = z.enum(['ORIGINAL', 'ESTUDIO']);
const EstiloTitulo = z.enum(['CONTRASTE', 'CONDENSADA']);
const PosicionTitulo = z.enum(['SUPERIOR_DERECHA', 'SUPERIOR_IZQUIERDA', 'INFERIOR_IZQUIERDA', 'PAPEL']);
export const MaquetaDeTitulo = z.object({ estilo: EstiloTitulo, posicion: PosicionTitulo, fuente: z.enum(['instrument-serif', 'archivo']), apoyo: z.enum(['instrument-serif-italica', 'archivo']) });
export type MaquetaDeTitulo = z.infer<typeof MaquetaDeTitulo>;
export const SeleccionDeToma = z.object({
  vajilla: Vajilla.optional(), estiloTitulo: EstiloTitulo.optional(), posicionTitulo: PosicionTitulo.optional(),
  posicionLibre: z.object({ anguloGrados: z.number().min(-45).max(90), giroGrados: z.number().min(0).max(180) }).optional(),
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
const RecorteDeMuestra = z.strictObject({
  x: z.number().min(0).lt(1), y: z.number().min(0).lt(1), ancho: z.number().min(0.05).max(1), alto: z.number().min(0.05).max(1),
}).refine(r => r.x + r.ancho <= 1.000001 && r.y + r.alto <= 1.000001 && r.ancho * r.alto < 0.65, 'Cada muestra debe ser un detalle situado dentro de la foto.');
const camposMuestras = {
  recuento: z.int().min(1).max(200), unidad: z.string().trim().min(2).max(80), colocacion: z.string().trim().min(10).max(320),
  recortes: z.array(RecorteDeMuestra).min(2).max(4).refine(lista => new Set(lista.map(r => JSON.stringify(r))).size === lista.length, 'Elige zonas distintas de la foto.'),
};
export const SeleccionDeMuestras = z.strictObject(camposMuestras);
export type SeleccionDeMuestras = z.infer<typeof SeleccionDeMuestras>;

export const RutaEditorial = z.enum(['FOTO_PLATO', 'FOTO_ESPACIO', 'TIPO_SOBRIA', 'CARTEL_EXPRESIVO']);
export type RutaEditorial = z.infer<typeof RutaEditorial>;
export const esFotoEditorial = (ruta?: RutaEditorial) => ruta === 'FOTO_PLATO' || ruta === 'FOTO_ESPACIO';
const SeleccionEditorial = z.object({
  ruta: RutaEditorial, motivo: z.string(), enfoque: z.string(), comprobar: z.string(),
  evidencias: z.array(z.object({ id: z.string(), fuente: z.string(), pagina: z.url(), imagen: z.url(), lectura: z.string() })).min(2),
});
export type SeleccionEditorial = z.infer<typeof SeleccionEditorial>;

export const ComandaDeArte = z.object({
  editorial: SeleccionEditorial.optional(),
  puesta: z.object({ ambito: z.enum(['ESPACIO', 'SERVICIO', 'PRODUCTO']).optional(), vajilla: Vajilla, soporte: z.string(), apetito: z.string() }).optional(),
  tipografiaLocal: MaquetaDeTitulo.optional(),
  muestras: z.object({ ...camposMuestras, sha256: hash }).optional(),
  nombrePlato: z.string().optional(), toma: TomaDelCartel.optional(), direccion: DireccionDeArte, textos: z.array(bloque).max(5),
  referencia: z.object({ id: z.string(), familia: z.string(), mecanismos: z.array(z.string()), voces: z.array(z.string()), reticula: z.string(), encuadre: z.string(),
    recursos: z.array(z.string()), lectura: z.array(z.string()) }).optional(),
  fotografia: z.object({ temperatura: z.string(), dominantes: z.array(z.string()), acento: z.string().optional(), luz: z.number(), aire: z.string() }),
  fotoSha256: hash, uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']), prompt: z.string(), huella: hash,
}).refine(c => esFotoEditorial(c.editorial?.ruta) ? c.textos.length === 0 : c.textos.length > 0, 'Comprueba los bloques de texto de esta dirección.');
export type ComandaDeArte = z.infer<typeof ComandaDeArte>;
const revision = z.object({ apetito: z.literal(true).optional(), composicionTipografica: z.literal(true).optional(), sinTextoAnadido: z.literal(true).optional(), recuentoObservado: z.int().positive().optional(), vistaObservada: VistaDeProducto.optional(), cambioDeToma: z.literal(true).optional(), transcripcion: z.array(z.string()), producto: z.literal(true), legibilidad: z.literal(true), gesto: z.literal(true), fecha: z.string() });
export const TallerDeArte = z.object({
  seleccionEditorial: z.literal(true).optional(),
  elegirReferenciaAlAbrir: z.literal(true).optional(),
  comanda: ComandaDeArte.optional(),
  confirmada: z.object({ huella: hash, fecha: z.string() }).optional(),
  candidatas: z.array(z.object({
    version: z.int().positive(), sha256: hash, comanda: hash, fecha: z.string(),
    composicion: z.object({ baseSha256: hash, versionBase: z.int().positive().optional(), estilo: EstiloTitulo, posicionSolicitada: PosicionTitulo, posicion: PosicionTitulo, tinta: z.string(), contraste: z.number(), familia: z.string(), lineas: z.array(z.string()), caja: z.object({x: z.number(), y: z.number(), ancho: z.number(), alto: z.number()}) }).optional(),
    encuadreOriginal: z.number().min(0).max(1).optional(),
    origen: z.enum(['IMPORTACION', 'IMAGES_API', 'ORIGINAL']), uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']),
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
  z.strictObject({ accion: z.literal('AJUSTAR_MUESTRAS'), revision: z.string().min(1), muestras: SeleccionDeMuestras.nullable() }),
  z.strictObject({ accion: z.literal('EXPLORAR_RUTA'), revision: z.string().min(1), ruta: RutaEditorial }),
  z.strictObject({ accion: z.literal('USAR_ORIGINAL'), revision: z.string().min(1), posicion: z.number().min(0).max(1).default(.5) }),
  z.strictObject({ accion: z.literal('AJUSTAR_TOMA'), revision: z.string().min(1), ...SeleccionDeToma.shape }),
  z.strictObject({ accion: z.literal('PROPONER_GESTO'), revision: z.string().min(1), gesto: Gesto }),
  z.strictObject({ accion: z.literal('REABRIR_DIRECCION'), revision: z.string().min(1) }),
  z.strictObject({ accion: z.literal('EDITAR'), revision: z.string().min(1), direccion: DireccionDeArte, nombrePlato: z.string().trim().min(2).max(300).optional() }),
  z.strictObject({ accion: z.literal('CONFIRMAR_DIRECCION'), revision: z.string().min(1), confirmoMuestras: z.literal(true).optional() }),
  z.strictObject({ accion: z.literal('GENERAR'), revision: z.string().min(1), autorizarUnEnvio: z.literal(true) }),
  z.strictObject({ accion: z.literal('IMPORTAR'), revision: z.string().min(1), subidaId: z.string().min(1), usoCandidata: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']).optional() }),
  z.strictObject({ accion: z.literal('RECOMPONER_TITULO'), revision: z.string().min(1), version: z.int().positive(), estiloTitulo: EstiloTitulo, posicionTitulo: PosicionTitulo }),
  z.strictObject({ accion: z.literal('DEVOLVER'), revision: z.string().min(1), version: z.int().positive(), motivo: z.string().trim().min(3).max(480), ajusteToma: SeleccionDeToma.optional() }),
  z.strictObject({ accion: z.literal('APROBAR'), revision: z.string().min(1), version: z.int().positive(), recuentoObservado: z.int().min(0).max(10000).optional(), vistaObservada: VistaDeProducto.optional(), cambioDeToma: z.literal(true).optional(),
    apetito: z.literal(true).optional(), composicionTipografica: z.literal(true).optional(), sinTextoAnadido: z.literal(true).optional(), transcripcion: z.array(z.string().trim().min(1).max(300)).max(12), producto: z.literal(true), legibilidad: z.literal(true), gesto: z.literal(true) }),
]);
export type AccionTaller = z.infer<typeof AccionTaller>;
