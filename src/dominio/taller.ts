import { SecuenciaDeSerie, SerieDelTaller } from './serieTaller.js';
import { DireccionPortada, SecuenciaTaller, TomaDeSerie } from './secuenciaTaller.js';
import { ModoDeLuz } from './luzFotografica.js';
import { z } from 'zod';
import { Distancia, HuecosFotoNueva } from './fotoNueva.js';
import { Familia, Mecanismo } from './referencia.js';

export const Gesto = z.enum(['EMERGER', 'LUZ_Y_SOMBRA', 'RITMO', 'MACRO']);
export type Gesto = z.infer<typeof Gesto>;

export const DireccionDeArte = z.object({
  criterioVisual: z.object({
    foco: z.string().trim().min(3).max(320),
    conservar: z.string().trim().min(3).max(480),
    comprobar: z.string().trim().min(3).max(480),
  }).optional(),
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
export const EscenaDeFuente = z.discriminatedUnion('modo', [
  z.strictObject({ modo: z.literal('DOCUMENTAL') }),
  z.strictObject({ modo: z.literal('EDITORIAL'), puesta: z.string().trim().min(5).max(320), evidencia: z.string().trim().min(5).max(220) }),
]);
export type EscenaDeFuente = z.infer<typeof EscenaDeFuente>;
export const SeleccionDeToma = z.object({
  escenaFuente: EscenaDeFuente.optional(),
  modoDeLuz: ModoDeLuz.optional(),
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
  propuestaPortada: DireccionPortada.optional(),
  modoDeLuz: ModoDeLuz.optional(),
  puesta: z.object({ sugerencia: z.string().max(320).optional(), ambito: z.enum(['ESPACIO', 'SERVICIO', 'PRODUCTO']).optional(), vajilla: Vajilla, soporte: z.string(), apetito: z.string() }).optional(),
  tipografiaLocal: MaquetaDeTitulo.optional(),
  muestras: z.object({ ...camposMuestras, sha256: hash }).optional(),
  nombrePlato: z.string().optional(), toma: TomaDelCartel.optional(), direccion: DireccionDeArte, textos: z.array(bloque).max(5),
  referencia: z.object({ id: z.string(), familia: z.string(), mecanismos: z.array(z.string()), voces: z.array(z.string()), reticula: z.string(), encuadre: z.string(),
    recursos: z.array(z.string()), lectura: z.array(z.string()) }).optional(),
  fotografia: z.object({ temperatura: z.string(), dominantes: z.array(z.string()), acento: z.string().optional(), luz: z.number(), aire: z.string() }),
  fotoSha256: hash, uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']), prompt: z.string(), huella: hash,
}).refine(c => esFotoEditorial(c.editorial?.ruta) ? c.textos.length === 0 : c.textos.length > 0, 'Comprueba los bloques de texto de esta dirección.');
export type ComandaDeArte = z.infer<typeof ComandaDeArte>;
export const PlanoTitulo = z.enum(['AIRE', 'DETRAS']);
export type PlanoTitulo = z.infer<typeof PlanoTitulo>;
const profundidad = z.object({
  esquema: z.literal('taller/capas@1'), plano: PlanoTitulo, titulo: z.string(), mascaraSha256: hash,
  origenMascara: z.enum(['LOCAL', 'IMPORTADA']), oclusion: z.number().min(0).max(1),
  peorFranja: z.number().min(0).max(1), cuerpo: z.number().positive(),
});
export type Profundidad = z.infer<typeof profundidad>;
const revision = z.object({ escenaCotejada: z.literal(true).optional(), apetito: z.literal(true).optional(), composicionTipografica: z.literal(true).optional(), sinTextoAnadido: z.literal(true).optional(), recuentoObservado: z.int().positive().optional(), vistaObservada: VistaDeProducto.optional(), cambioDeToma: z.literal(true).optional(), transcripcion: z.array(z.string()), producto: z.literal(true), legibilidad: z.literal(true), gesto: z.literal(true), fecha: z.string() });
export const TallerDeArte = z.object({
  serie: SerieDelTaller.optional(),
  serieFotografica: SerieDelTaller.optional(),
  secuencia: SecuenciaTaller.optional(),
  seleccionEditorial: z.literal(true).optional(),
  elegirReferenciaAlAbrir: z.literal(true).optional(),
  comanda: ComandaDeArte.optional(),
  confirmada: z.object({ huella: hash, fecha: z.string() }).optional(),
  candidatas: z.array(z.object({
    version: z.int().positive(), sha256: hash, comanda: hash, fecha: z.string(),
    composicion: z.object({ profundidad: profundidad.optional(), baseSha256: hash, versionBase: z.int().positive().optional(), estilo: EstiloTitulo, posicionSolicitada: PosicionTitulo, posicion: z.enum([...PosicionTitulo.options, 'CENTRADA_EN_SILUETA']), tinta: z.string(), contraste: z.number(), familia: z.string(), lineas: z.array(z.string()), caja: z.object({x: z.number(), y: z.number(), ancho: z.number(), alto: z.number()}) }).optional(),
    encuadreOriginal: z.number().min(0).max(1).optional(),
    origen: z.enum(['IMPORTACION', 'IMAGES_API', 'ORIGINAL']), uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']),
    lectura: z.object({ motor: z.string(), lineas: z.array(z.string()), coincide: z.boolean().nullable(), superficieUniforme: z.boolean().optional() }),
    avisoVisual: z.string().trim().min(3).max(480).optional(), devolucion: z.string().optional(), revision: revision.optional(),
  })).default([]),
  envios: z.array(z.object({ huella: hash, fecha: z.string(), numero: z.int().positive() })).default([]),
});
export type TallerDeArte = z.infer<typeof TallerDeArte>;

export const AccionTaller = z.discriminatedUnion('accion', [
  z.strictObject({ accion: z.literal('MAQUETAR_SERIE'), revision: z.string().min(1), version: z.int().positive(), confirmoTextos: z.literal(true), paginas: SecuenciaDeSerie, usarTomas: z.literal(true).optional() }),
  z.strictObject({ accion: z.literal('MAQUETAR_SOLO_FOTOS'), revision: z.string().min(1), version: z.int().positive() }),
  z.strictObject({ accion: z.literal('VALORAR_FOTOS_SERIE'), revision: z.string().min(1), version: z.int().positive() }),
  z.strictObject({ accion: z.literal('IMPORTAR_MASCARA_SERIE'), revision: z.string().min(1), version: z.int().positive(),
    pagina: z.enum(['1', '2', '3', '4', '5']), subidaId: z.string().min(1) }),
  z.strictObject({ accion: z.literal('DIRIGIR_SECUENCIA'), revision: z.string().min(1), version: z.int().positive() }),
  z.strictObject({ accion: z.literal('DIRIGIR_CARRUSEL'), revision: z.string().min(1), version: z.int().positive(),
    referenciaVisualId: z.string().min(1).optional(), preferencia: z.string().trim().max(480).optional() }),
  z.strictObject({ accion: z.literal('IMPORTAR_TOMA_SERIE'), revision: z.string().min(1), toma: TomaDeSerie, subidaId: z.string().min(1), usoCandidata: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']).optional() }),
  z.strictObject({ accion: z.literal('GENERAR_TOMA_SERIE'), revision: z.string().min(1), toma: TomaDeSerie, estimadoMaximoUsd: z.number().positive(), autorizarUnEnvio: z.literal(true) }),
  z.strictObject({ accion: z.literal('REVISAR_TOMA_SERIE'), revision: z.string().min(1), toma: TomaDeSerie, decision: z.enum(['APROBAR', 'DEVOLVER']), sha256: hash }),
  z.strictObject({ accion: z.literal('SIN_REFERENCIA'), revision: z.string().min(1) }),
  z.strictObject({ accion: z.literal('FICHAR_REFERENCIA'), revision: z.string().min(1), familia: Familia, mecanismo: Mecanismo,
    reticula: z.string().trim().min(10).max(220), foto: z.string().trim().min(5).max(200), voz: z.string().trim().min(3).max(120),
    lectura: z.tuple([z.string().min(2).max(80), z.string().min(2).max(80), z.string().min(2).max(80)]) }),
  z.strictObject({ accion: z.literal('AJUSTAR_MUESTRAS'), revision: z.string().min(1), muestras: SeleccionDeMuestras.nullable() }),
  z.strictObject({ accion: z.literal('EXPLORAR_RUTA'), revision: z.string().min(1), ruta: RutaEditorial }),
  z.strictObject({ accion: z.literal('USAR_ORIGINAL'), revision: z.string().min(1), posicion: z.number().min(0).max(1).default(.5), completa: z.literal(true).optional() }),
  z.strictObject({ accion: z.literal('AJUSTAR_TOMA'), revision: z.string().min(1), ...SeleccionDeToma.shape }),
  z.strictObject({ accion: z.literal('PROPONER_GESTO'), revision: z.string().min(1), gesto: Gesto }),
  z.strictObject({ accion: z.literal('REABRIR_DIRECCION'), revision: z.string().min(1) }),
  z.strictObject({ accion: z.literal('EDITAR'), revision: z.string().min(1), direccion: DireccionDeArte, nombrePlato: z.string().trim().min(2).max(300).optional() }),
  z.strictObject({ accion: z.literal('CONFIRMAR_DIRECCION'), revision: z.string().min(1), confirmoMuestras: z.literal(true).optional() }),
  z.strictObject({ accion: z.literal('GENERAR'), revision: z.string().min(1), autorizarUnEnvio: z.literal(true) }),
  z.strictObject({ accion: z.literal('GENERAR_PORTADA_FOTO'), revision: z.string().min(1), estimadoMaximoUsd: z.number().positive(), autorizarUnEnvio: z.literal(true) }),
  z.strictObject({ accion: z.literal('IMPORTAR'), revision: z.string().min(1), subidaId: z.string().min(1), usoCandidata: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']).optional() }),
  z.strictObject({ accion: z.literal('RECOMPONER_TITULO'), revision: z.string().min(1), version: z.int().positive(), estiloTitulo: EstiloTitulo, posicionTitulo: PosicionTitulo, plano: PlanoTitulo.optional(), mascaraId: z.string().min(1).optional(), tituloLiteral: z.string().trim().min(2).max(300).optional() }),
  z.strictObject({ accion: z.literal('ANOTAR_REVISION'), revision: z.string().min(1), version: z.int().positive(), observacion: z.string().trim().min(3).max(480) }),
  z.strictObject({ accion: z.literal('DEVOLVER'), revision: z.string().min(1), version: z.int().positive(), motivo: z.string().trim().min(3).max(480), ajusteToma: SeleccionDeToma.optional() }),
  z.strictObject({ accion: z.literal('APROBAR'), revision: z.string().min(1), version: z.int().positive(), escenaCotejada: z.literal(true).optional(), recuentoObservado: z.int().min(0).max(10000).optional(), vistaObservada: VistaDeProducto.optional(), cambioDeToma: z.literal(true).optional(),
    apetito: z.literal(true).optional(), composicionTipografica: z.literal(true).optional(), sinTextoAnadido: z.literal(true).optional(), transcripcion: z.array(z.string().trim().min(1).max(300)).max(12), producto: z.literal(true), legibilidad: z.literal(true), gesto: z.literal(true) }),
]);
export type AccionTaller = z.infer<typeof AccionTaller>;
