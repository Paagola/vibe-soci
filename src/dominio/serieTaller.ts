import { z } from 'zod';
import { CajaDeCarrusel } from './secuenciaTaller.js';

export const PaginaDeSerie = z.strictObject({
  funcion: z.enum(['PORTADA', 'DETALLE', 'CIERRE']),
  titulo: z.string().trim().max(80).default(''),
  apoyo: z.string().trim().max(110).default(''),
  nota: z.string().trim().max(55).optional(),
  enfoque: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: .5, y: .5 }),
  zoom: z.number().min(1).max(3).optional(),
  zonaTexto: CajaDeCarrusel.optional(),
});
export type PaginaDeSerie = z.infer<typeof PaginaDeSerie>;
export const SecuenciaDeSerie = z.array(PaginaDeSerie).min(2).max(6).refine(
  paginas => paginas[0]?.funcion === 'PORTADA' && paginas.at(-1)?.funcion === 'CIERRE' && paginas.slice(1, -1).every(p => p.funcion === 'DETALLE'),
  'Abre con una portada y termina con un cierre. Las páginas intermedias son de detalle.',
);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const SerieDelTaller = z.object({
  esquema: z.literal('taller/serie@1'), huella: hash, versionBase: z.int().positive(),
  referencia: z.object({ id: z.string(), mecanismos: z.array(z.string()), voces: z.array(z.string()) }).optional(),
  origen: z.enum(['ORIGINAL', 'IMPORTACION', 'IMAGES_API']), fotoSha256: hash, baseSha256: hash, comanda: hash, uso: z.enum(['PUBLICABLE', 'SOLO_PRUEBA_COMPOSICION']),
  mascaraSha256: hash.optional(),
  guionSha256: hash.optional(),
  soloFotos: z.literal(true).optional(),
  paginas: z.array(z.object({
    edicion: PaginaDeSerie, fotoSha256: hash.optional(), fotosSha256: z.array(hash).max(2).optional(),
    tratamiento: z.enum(['FOTO', 'TITULO_EN_AIRE', 'ECO_EN_CONTORNO', 'PORTADA_DETRAS', 'APERTURA_EN_PAPEL', 'ACENTO_INCLINADO', 'PIE_DE_FOTO', 'CIERRE_A_DOS_VOCES', 'MARCO_ARQUEADO', 'DIPTICO', 'TIPOGRAFIA']),
    referente: z.url().optional(), motivo: z.string(), sha256: hash, intencionSha256: hash, svgSha256: hash.optional(), mascaraSha256: hash.optional(),
    medidas: z.array(z.object({ capa: z.string(), cuerpoMovil: z.number(), contraste: z.number(), lineas: z.array(z.string()) })),
  })),
});
export type SerieDelTaller = z.infer<typeof SerieDelTaller>;
