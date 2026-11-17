import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { ComponedorProyectos } from '../src/adaptadores/compositor/ComponedorProyectos.js';
import { RAIZ } from '../src/config.js';
import { Intencion } from '../src/dominio/diseno/intencion.js';

it('conserva errores, recupera solo versiones completas y versiona únicamente la página corregida', async (t) => {
  const carpeta = await mkdtemp(join(tmpdir(), 'estudio-componedor-recuperacion-'));
  t.after(() => rm(carpeta, { recursive: true, force: true }));
  const proyecto = join(carpeta, 'proyecto');
  await mkdir(proyecto);
  const escribir = (archivo: string, datos: unknown) => writeFile(join(proyecto, archivo), JSON.stringify(datos));
  const base = {
    esquema: 'diseno/intencion@1', marca: 'local', titulo: 'Título', activos: {},
    capas: [{ tipo: 'relleno', id: 'fondo', color: '#ffffff' }],
  };
  const portada = Intencion.parse({ ...base, id: 'post' });
  const detalle = Intencion.parse({
    ...base, id: 'detalle-1', tokens: { estilos: { texto: { fuente: 'plex-mono', color: '#ffffff' } } },
    capas: [...base.capas, { tipo: 'texto', id: 'texto', texto: 'Detalle', estilo: 'texto', ajuste: 'fijo', tamano: 64, caja: { x: 0.2, y: 0.3, w: 0.6, h: 0.2 } }],
    relaciones: [{ tipo: 'contrasteMinimo', texto: 'texto', ratio: 4.5 }],
  });
  await Promise.all([
    escribir('plan.json', { local: 'local', marca: 'marca.json', diapositivas: [{ intencion: 'post.json' }, { intencion: 'detalle.json' }] }),
    escribir('marca.json', {}),
    escribir('post.json', portada),
    escribir('detalle.json', detalle),
  ]);
  const componedor = new ComponedorProyectos(RAIZ, join(carpeta, 'datos'));
  const componer = () => componedor.componer(proyecto, { etiqueta: 'prueba' });
  const [inicioPortada, inicioDetalle] = (await componer()).diapositivas;
  assert.ok(inicioPortada && inicioDetalle);
  assert.ok(inicioDetalle.problemas.some((p) => p.gravedad === 'ERROR' && p.tipo === 'CONTRASTE'));
  const [reusada, fallo] = (await componer()).diapositivas;
  assert.equal(reusada?.reutilizada, true);
  assert.equal(fallo?.reutilizada, false);
  assert.deepEqual(fallo?.problemas, inicioDetalle.problemas);

  await escribir('detalle.json', {
    ...detalle, tokens: { estilos: { texto: { fuente: 'plex-mono', color: '#000000' } } },
  });
  const [portadaIntacta, detalleCorregido] = (await componer()).diapositivas;
  assert.equal(portadaIntacta?.version, 1);
  assert.equal(portadaIntacta?.reutilizada, true);
  assert.equal(detalleCorregido?.version, 2);
  assert.equal(detalleCorregido?.reutilizada, false);
  assert.ok(!detalleCorregido?.problemas.some((p) => p.gravedad === 'ERROR'));
  assert.ok(await readFile(join(inicioDetalle.carpeta, 'resuelto.json'), 'utf8'));

  await rm(join(portadaIntacta.carpeta, 'exportadas', '4x5.jpg'));
  const [portadaCompleta, detalleIntacto] = (await componer()).diapositivas;
  assert.equal(portadaCompleta?.version, 2);
  assert.equal(portadaCompleta?.reutilizada, false);
  assert.equal(detalleIntacto?.version, 2);
  assert.equal(detalleIntacto?.reutilizada, true);
});
