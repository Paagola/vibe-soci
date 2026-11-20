import sharp from 'sharp';
import type { EncargoPost } from '../../dominio/post.js';
import { TomaDeSerie, tomaPlaneada, type PostReciente } from '../../dominio/secuenciaTaller.js';
import { bytesDeCandidata, descargarSerie } from '../taller/taller.js';
import { listarEncargos, portadaDe, rutaDeRecurso, type DepsConsultasPost } from './consultasPost.js';

type DepsHistorial = Pick<DepsConsultasPost, 'raiz' | 'proyectos' | 'activos' | 'galeria' | 'referencias'>;

async function miniaturaHistorica(deps: DepsHistorial, e: EncargoPost): Promise<Buffer | undefined> {
  const serie = serieParaHistorial(e);
  const candidata = e.taller?.candidatas.at(-1);
  const salidaSerie = serie && await descargarSerie(deps, e, serie.huella, 1).catch(() => undefined);
  const portada = salidaSerie || candidata?.revision ? undefined : await portadaDe(deps, e);
  const archivo = salidaSerie?.bytes ?? (candidata?.revision ? (await bytesDeCandidata(deps, e, candidata.version)).bytes :
    portada && portada.tipo !== 'TALLER' ? await rutaDeRecurso(deps, e.proyecto, portada) : undefined);
  return archivo ? sharp(archivo, { limitInputPixels: 36_000_000 }).rotate().resize(384, 480, {
    fit: 'inside', withoutEnlargement: true,
  }).flatten({ background: '#fff' }).jpeg({ quality: 82 }).toBuffer() : undefined;
}

function serieParaHistorial(e: EncargoPost) {
  return e.taller?.secuencia?.lecturaFotografica?.recomendacion === 'FOTOGRAFIA'
    ? e.taller.serieFotografica ?? e.taller.serie : e.taller?.serie ?? e.taller?.serieFotografica;
}

export async function postsRecientes(deps: DepsHistorial, actual: EncargoPost): Promise<PostReciente[]> {
  const anteriores = (await listarEncargos(deps)).filter(e => e.local === actual.local && e.simulado === actual.simulado &&
    e.proyecto !== actual.proyecto && e.paso === 'HECHO').slice(0, 6);
  return Promise.all(anteriores.map(async e => {
    const comanda = e.taller?.comanda;
    const toma = comanda?.toma;
    const serie = e.taller?.secuencia;
    const candidata = e.taller?.candidatas.at(-1);
    return {
      pieza: e.proyecto,
      plato: (comanda?.nombrePlato ?? e.plato.split(/\n|[.!?](?:\s|$)/u)[0] ?? '').slice(0, 140),
      ...(toma ? { portada: {
        vista: candidata?.revision?.vistaObservada ?? toma.camara.vista, plano: toma.camara.distancia,
        escena: (comanda?.direccion.escena ?? toma.encuadre).slice(0, 320), gesto: (toma.accion || comanda?.direccion.gesto || '').slice(0, 240),
      } } : {}),
      ...(serie ? { otrasTomas: TomaDeSerie.options.flatMap(nombre => {
        const toma = tomaPlaneada(serie.direccion, nombre);
        return toma && serie.tomas[nombre]?.candidata?.aprobada ? [{ vista: toma.vista, plano: toma.plano, gesto: toma.gesto }] : [];
      }) } : {}),
      estructura: serieParaHistorial(e)?.paginas.map(p => p.tratamiento),
      miniatura: await miniaturaHistorica(deps, e).catch(() => undefined),
    };
  }));
}
