import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { cambiarBrief, type BriefDelEncargo } from '../../dominio/brief.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import type { AlmacenBrief } from '../../puertos/AlmacenBrief.js';
import { cartelDePortada, fichaDeCartel, esquemaDelPlanEditorial, type ProductorEditorial } from './editorial.js';

export interface DireccionEditorial {
  productor: ProductorEditorial;
  foto: (e: Readonly<EncargoPost>) => Promise<{ ruta: string; activo: { sha256: string } }>;
  oficio: () => Promise<string>;
  ficha: (e: Readonly<EncargoPost>) => Promise<string | undefined>;
}

/** El productor propone. La aplicación fija las dependencias y acepta el resultado sólo si aún están vigentes. */
export async function prepararPlanEditorial(
  direccion: DireccionEditorial, almacen: AlmacenBrief, e: Readonly<EncargoPost>,
  brief: BriefDelEncargo, reservar: () => Promise<void>, ahora: () => string,
): Promise<BriefDelEncargo> {
  const { ruta, activo } = await direccion.foto(e);
  const huella = brief.hechos.inventario.huella;
  if (brief.editorial?.fotoSha256 === activo.sha256 && brief.editorial.inventarioSha256 === huella && brief.editorial.referencia === e.referencia) {
    esquemaDelPlanEditorial(brief).parse(brief.editorial.plan);
    return brief;
  }
  if (brief.hechos.inventario.estado === 'CONFIRMADO') throw new ErrorDeUsuario('Han cambiado los materiales de una comanda confirmada. Revisa su procedencia.');
  const original = await readFile(ruta);
  if (createHash('sha256').update(original).digest('hex') !== activo.sha256) throw new ErrorDeUsuario('La foto registrada ha cambiado en disco.');
  const [bytes, oficio, fichaReferencia] = await Promise.all([
    sharp(original).rotate().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(),
    direccion.oficio(), direccion.ficha(e),
  ]);
  await reservar();
  const propuesto = esquemaDelPlanEditorial(brief).parse(await direccion.productor.proponer({
    brief, foto: { bytes, mimeType: 'image/jpeg' }, oficio, ...(fichaReferencia ? { fichaReferencia } : {}),
  }));
  const ficha = fichaDeCartel(fichaReferencia);
  const plan = { ...propuesto, diapositivas: propuesto.diapositivas.map(d => cartelDePortada(d, ficha, brief, true) ?? d) };
  const vigente = await almacen.leer(e.proyecto);
  if (vigente?.version !== brief.version) throw new ErrorDeUsuario('El brief ha cambiado durante la lectura editorial. Revisa la nueva versión.');
  const editorial = {
    modelo: direccion.productor.modelo, briefVersion: brief.version, fotoSha256: activo.sha256,
    inventarioSha256: huella, oficioSha256: createHash('sha256').update(oficio).digest('hex'),
    ...(e.referencia ? { referencia: e.referencia } : {}),
    ...(fichaReferencia ? { fichaReferencia, fichaSha256: createHash('sha256').update(fichaReferencia).digest('hex') } : {}),
    plan,
  };
  const paginas = brief.plan.map((base, i) => {
    const d = plan.diapositivas[i]!;
    const propia = e.fotosExtra.some(t => t.elemento === base.elemento);
    const original = d.tratamiento === 'FOTO_TEXTO_AL_BORDE' && d.arco;
    const foto = d.tratamiento === 'RECORTE_DETALLE' ? 'RECORTE' : original || (propia && d.papel === 'detalle') ? 'FOTO_DEL_DUENO' : 'FOTO_ELEGIDA';
    const para = {
      CARTEL: 'cartel tipográfico con el nombre confirmado y la fotografía elegida',
      FOTO_LIMPIA: 'fotografía a sangre, sin texto',
      FOTO_TEXTO_AL_BORDE: original ? 'texto editable en arco sobre el borde observado del original' : 'dato del brief compuesto al borde de la fotografía',
      RECORTE_DETALLE: 'detalle por recorte de la foto original sobre el punto observado',
      CIERRE_TEXTO: 'cierre con los datos seleccionados del brief',
    }[d.tratamiento];
    return { ...base, foto, para } as typeof base;
  });
  const nuevo = cambiarBrief(brief, { ...brief, modo: 'PRODUCTOR', editorial, plan: paginas }, ahora());
  await almacen.guardar(nuevo);
  return nuevo;
}
