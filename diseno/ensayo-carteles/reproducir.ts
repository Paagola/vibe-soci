import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { CompositorSharp } from '../../src/adaptadores/compositor/CompositorSharp.js';
import { MotorTexto } from '../../src/adaptadores/compositor/MotorTexto.js';
import { CatalogoTipografico } from '../../src/adaptadores/compositor/tipografias.js';
import { Activo } from '../../src/dominio/activos.js';
import { Intencion } from '../../src/dominio/diseno/intencion.js';

const carpeta = import.meta.dirname;
const catalogo = new CatalogoTipografico(resolve(carpeta, '../../recursos/tipografias'));
const capasEn = process.argv[2];
if (process.argv.length > 3) throw new Error('Uso: tsx reproducir.ts [carpeta-para-las-capas]');

for (const id of ['spritz', 'happy']) {
  const intencion = Intencion.parse(JSON.parse(await readFile(join(carpeta, id + '.json'), 'utf8')));
  const archivo = intencion.activos.foto + '.webp';
  const ruta = join(carpeta, 'fotos', archivo);
  const bytes = await readFile(ruta);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const { width, height } = await sharp(bytes).metadata();
  const activo = Activo.parse({
    id: intencion.activos.foto, localSlug: intencion.marca, tipo: 'GENERADO', uso: 'SOLO_PRUEBA_COMPOSICION',
    descripcion: intencion.titulo, archivo, ancho: width, alto: height, sha256,
    procedencia: { ruta: 'fotos/' + archivo, sha256, copiadoEn: '2026-11-24' },
  });
  const activos = { foto: { activo, ruta } };
  const compositor = new CompositorSharp(new MotorTexto(catalogo), catalogo);
  const resuelto = await compositor.resolver(intencion, activos);
  const render = await compositor.renderizar(resuelto, activos);
  await sharp(render.png).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(join(carpeta, id + '.jpg'));
  if (capasEn) {
    const destino = resolve(capasEn, id);
    await mkdir(destino, { recursive: true });
    await writeFile(join(destino, 'editable.svg'), render.svgEditable);
    for (const [i, capa] of render.capas.entries()) {
      await writeFile(join(destino, String(i + 1).padStart(2, '0') + '-' + capa.id + '.png'), capa.png);
    }
  }
  console.log(id + ' · ' + render.capas.length + ' capas · ' + resuelto.lienzo.ancho + ' × ' + resuelto.lienzo.alto);
  for (const problema of resuelto.problemas) console.log(problema.gravedad + ' · ' + problema.mensaje);
}
