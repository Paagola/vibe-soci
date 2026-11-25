import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { exigirTomaNueva } from '../../adaptadores/imagen/copiaDeReferencia.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost, IntentoFoto } from '../../dominio/post.js';
import type { ActivoDisponible } from '../../puertos/Compositor.js';
import type { PeticionFoto } from '../../puertos/Foto.js';

const Reserva = z.strictObject({
  peticion: z.string().regex(/^[a-f0-9]{64}$/),
  autorizadaEn: z.string().nullable(),
  reservadaEn: z.string(),
});

const huella = (valor: string | Buffer) => createHash('sha256').update(valor).digest('hex');
const codigo = (error: unknown) => (error as NodeJS.ErrnoException | undefined)?.code;

const rutaReserva = (proyectos: string, proyecto: string, activo: string) => join(proyectos, proyecto, 'foto', 'reservas', `${activo}.json`);

export async function generacionPendienteDeImportacion(
  proyectos: string,
  e: Pick<EncargoPost, 'proyecto' | 'paso' | 'intentos'>,
): Promise<boolean> {
  if (e.paso !== 'GENERAR') return false;
  const id = `${e.proyecto}-foto-${e.intentos.length + 1}`;
  return stat(rutaReserva(proyectos, e.proyecto, id)).then(() => true, (error: unknown) => {
    if (codigo(error) === 'ENOENT') return false;
    throw error;
  });
}

/** El archivo de la reserva se publica de una sola vez y nunca reemplaza otra reserva. */
async function reservar(ruta: string, reserva: z.infer<typeof Reserva>): Promise<void> {
  const temporal = `${ruta}.${randomUUID()}.tmp`;
  await mkdir(dirname(ruta), { recursive: true });
  try {
    await writeFile(temporal, JSON.stringify(reserva) + '\n', { flag: 'wx' });
    await link(temporal, ruta);
  } finally {
    await rm(temporal, { force: true });
  }
}

export async function prepararRecuperacion(
  proyectos: string,
  e: Pick<EncargoPost, 'proyecto' | 'autorizacion'>,
  peticion: PeticionFoto,
  real: ActivoDisponible,
  n: number,
  ahora: () => string,
) {
  const ruta = rutaReserva(proyectos, e.proyecto, peticion.id);
  const extras = await Promise.all(peticion.referencias.slice(1).map(async ({ ruta, etiqueta }) => [etiqueta, huella(await readFile(ruta))]));
  const firma = huella(JSON.stringify([peticion.id, peticion.prompt, peticion.aspectRatio, peticion.tamano, real.activo.id, real.activo.sha256, extras]));
  return {
    async reservada() {
      return readFile(ruta, 'utf8').then((texto) => Reserva.parse(JSON.parse(texto)), (error: unknown) => {
        if (codigo(error) === 'ENOENT') return undefined;
        throw error;
      });
    },
    async reservar() {
      const archivo = await readFile(real.ruta);
      if (huella(archivo) !== real.activo.sha256) throw new Error('La foto fuente ha cambiado después de registrar su procedencia.');
      await reservar(ruta, { peticion: firma, autorizadaEn: e.autorizacion?.fecha ?? null, reservadaEn: ahora() });
    },
    async recuperar({ activo, ruta: imagen }: ActivoDisponible): Promise<IntentoFoto | undefined> {
      const generacion = activo.procedencia.generacion;
      const fuente = generacion?.referencias[0];
      const manual = generacion?.modelo === 'importada a mano (fuera de la orden)';
      if (
        activo.tipo !== 'GENERADO' || activo.id !== peticion.id || !generacion ||
        generacion.prompt !== peticion.prompt || generacion.parametros.orden !== 'post' ||
        generacion.parametros.intento !== n || generacion.parametros.aspectRatio !== peticion.aspectRatio ||
        generacion.parametros.imageSize !== peticion.tamano ||
        fuente?.activo !== real.activo.id || fuente.sha256 !== real.activo.sha256
      ) return undefined;
      const reserva = await this.reservada();
      if (!manual && (reserva ? reserva.peticion !== firma : extras.length > 0)) return undefined;
      const bytes = await readFile(imagen).catch((error: unknown) => {
        if (codigo(error) === 'ENOENT') return undefined;
        throw error;
      });
      if (!bytes || huella(bytes) !== activo.sha256) return undefined;
      try {
        await exigirTomaNueva(bytes, peticion.referencias.map(r => r.ruta));
      } catch (error) {
        if (error instanceof ErrorDeUsuario) return undefined;
        throw error;
      }
      return { n, activo: activo.id, final: 'PENDIENTE', motivos: [], costeUsd: generacion.costeEstimadoUsd ?? 0 };
    },
  };
}
