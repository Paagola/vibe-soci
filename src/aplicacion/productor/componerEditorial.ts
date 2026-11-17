import { mkdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { escribirJsonAtomico } from '../../adaptadores/ficheros/escribirJsonAtomico.js';
import type { BriefDelEncargo } from '../../dominio/brief.js';
import { contraste } from '../../dominio/diseno/color.js';
import { Intencion, Tokens } from '../../dominio/diseno/intencion.js';
import type { DiapositivaEditorial } from '../../dominio/editorial.js';
import { ErrorDeUsuario } from '../../dominio/errores.js';
import type { EncargoPost } from '../../dominio/post.js';
import { esquemaDelPlanEditorial, textoConfirmado } from './editorial.js';

const lienzo = { x: 0, y: 0, w: 1, h: 1 };

function intencionDePagina(
  e: EncargoPost, brief: BriefDelEncargo, pagina: DiapositivaEditorial, marca: Tokens,
): Intencion {
  const id = pagina.papel === 'portada' ? 'post' : pagina.papel === 'cierre' ? 'cierre' : `detalle-${pagina.n - 1}`;
  const propia = e.tomas.find(t => t.real && t.elemento === brief.plan[pagina.n - 1]?.elemento)?.elegida;
  // Los puntos del recorte se midieron en la foto original. Otras tomas pueden tener un encuadre distinto.
  const arco = pagina.tratamiento === 'FOTO_TEXTO_AL_BORDE' ? pagina.arco : undefined;
  const activo = pagina.tratamiento === 'RECORTE_DETALLE' || arco ? e.activoReal : propia ?? e.fotoElegida;
  if (!activo) throw new ErrorDeUsuario('Falta la fotografía aprobada para componer.');
  const colores = Object.values(marca.colores);
  const fondo = colores.sort((a, b) => contraste(b, '#ffffff') - contraste(a, '#ffffff'))[0] ?? '#20201C';
  const clara = [...colores, '#ffffff'].sort((a, b) => contraste(b, fondo) - contraste(a, fondo))[0]!;
  const coloresMarca = colores.filter(c => contraste(c, fondo) >= 4.5);
  const tinta = coloresMarca[0] ?? clara;
  const voces = Object.values(marca.estilos);
  const voz = voces[0] ?? { fuente: 'mazius-display' };
  const apoyo = voces.at(-1) ?? { fuente: 'ronzino' };
  const foto = { tipo: 'imagen', id: 'foto', activo: 'foto', caja: lienzo };
  const capas: unknown[] = [foto];
  const textos: Record<string, string> = {};
  if (pagina.tratamiento === 'RECORTE_DETALLE') Object.assign(foto, { enfoque: pagina.enfoque, zoom: pagina.zoom });
  if (pagina.tratamiento === 'FOTO_TEXTO_AL_BORDE' && arco) {
    const dato = textoConfirmado(brief, pagina.texto);
    if (!dato) throw new ErrorDeUsuario('El texto del arco requiere un dato confirmado.');
    textos.dato = dato;
    capas.push({ tipo: 'circulo-texto', id: 'arco', texto: '@dato', estilo: 'arco', centro: arco.centro,
      radio: arco.radio, giro: arco.inicio, arco: arco.grados, tamano: Math.min(58, Math.max(28, 120 * arco.radio)) });
  } else if (pagina.tratamiento === 'FOTO_TEXTO_AL_BORDE' || pagina.tratamiento === 'CIERRE_TEXTO') {
    const cierre = pagina.tratamiento === 'CIERRE_TEXTO';
    const superior = !cierre && pagina.borde === 'SUPERIOR';
    const banda = cierre ? 0.42 : pagina.gesto === 'ANUNCIO' ? 0.23 : 0.14;
    // Ritmo de la serie: una banda del color de marca y márgenes comunes al pie o al canto superior.
    const y = superior ? 0 : 1 - banda;
    capas.push({ tipo: 'forma', id: 'campo', figura: 'rect', caja: { x: 0, y, w: 1, h: banda }, color: fondo });
    const refs = cierre ? pagina.textos : [pagina.texto];
    refs.forEach((r, i) => {
      const valor = textoConfirmado(brief, r);
      if (!valor) throw new ErrorDeUsuario('El texto seleccionado no tiene un dato confirmado.');
      const clave = `dato-${i + 1}`;
      textos[clave] = valor;
      const alto = cierre ? (i === 0 ? 0.115 : 0.042) : banda * 0.48;
      const posicion = cierre ? y + (i === 0 ? 0.045 : 0.165 + (i - 1) * 0.055) : y + (banda - alto) / 2;
      capas.push({
        tipo: 'texto', id: clave, texto: `@${clave}`, estilo: i === 0 ? 'voz' : 'apoyo', ajuste: 'caja',
        vertical: 'centro', caja: { x: 0.072, y: posicion, w: 0.856, h: alto },
      });
    });
  }
  return Intencion.parse({
    esquema: 'diseno/intencion@1', id, version: 1, marca: e.local, titulo: `${brief.marca.nombre} · ${pagina.papel}`,
    notas: `Brief v${brief.version} · ${pagina.tratamiento} · ${brief.editorial!.plan.hiloVisual}.`,
    activos: { foto: activo }, textos, capas, tokens: { estilos: { voz: { ...voz, color: tinta }, apoyo: { ...apoyo, color: tinta }, ...(arco ? { arco: { ...apoyo, color: arco.tinta === 'CLARA' ? tinta : fondo } } : {}) } },
  });
}

/** Publica primero cada intención y al final el índice completo. Una reanudación conserva las correcciones guardadas. */
export async function materializarEditorial(carpeta: string, tokens: string, e: EncargoPost, brief: BriefDelEncargo): Promise<void> {
  if (!brief.editorial || brief.hechos.inventario.estado !== 'CONFIRMADO' || brief.editorial.inventarioSha256 !== brief.hechos.inventario.huella) {
    throw new ErrorDeUsuario('La composición requiere un plan y su inventario confirmado.');
  }
  const plan = esquemaDelPlanEditorial(brief).parse(brief.editorial.plan);
  const marca = Tokens.parse(JSON.parse(await readFile(tokens, 'utf8')));
  await mkdir(join(carpeta, 'intenciones'), { recursive: true });
  const diapositivas = [];
  for (const pagina of plan.diapositivas) {
    const intencion = intencionDePagina(e, brief, pagina, marca);
    const archivo = `intenciones/${intencion.id}.json`;
    try {
      Intencion.parse(JSON.parse(await readFile(join(carpeta, archivo), 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await escribirJsonAtomico(join(carpeta, archivo), intencion);
    }
    diapositivas.push({ intencion: archivo, papel: pagina.papel });
  }
  await escribirJsonAtomico(join(carpeta, 'plan.json'), {
    local: e.local, marca: relative(carpeta, tokens), briefVersion: brief.version, diapositivas,
  });
}

/** Las correcciones de maquetación pueden reutilizar hechos confirmados y materiales de este encargo. */
export function comprobarEdicionEditorial(intencion: Intencion, e: EncargoPost, brief: BriefDelEncargo): void {
  const permitidos = new Set([e.fotoElegida, e.activoReal, ...e.tomas.map(t => t.elegida)].filter(Boolean));
  if (Object.values(intencion.activos).some(id => !permitidos.has(id))) {
    throw new ErrorDeUsuario('La composición debe usar una de las fotografías aprobadas de la comanda.');
  }
  const normal = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  const hechos = new Set([
    brief.hechos.nota, brief.marca.nombre, brief.marca.ciudad, brief.marca.instagram ?? '',
    brief.marca.web ?? '', textoConfirmado(brief, { fuente: 'INSTAGRAM' }) ?? '',
    ...brief.hechos.inventario.elementos.flatMap(el => [el.nombre, el.estado]),
  ].filter(Boolean).map(normal));
  const verificar = (texto: string) => {
    if (!hechos.has(normal(texto))) throw new ErrorDeUsuario(`El texto «${texto}» no figura entre los datos confirmados de la comanda.`);
  };
  Object.values(intencion.textos).forEach(verificar);
  const comprobarReferencia = (valor: string | undefined) => {
    if (valor && !(valor.startsWith('@') && Object.hasOwn(intencion.textos, valor.slice(1)))) verificar(valor);
  };
  for (const capa of intencion.capas) {
    if ('texto' in capa) comprobarReferencia(capa.texto);
    if (capa.tipo === 'sello') {
      comprobarReferencia(capa.anillo?.texto);
      capa.lineas.forEach(linea => comprobarReferencia(linea.texto));
    }
  }
}
