/**
 * Los encargos de la orden única desde la web, de punta a punta en modo simulado: lo mismo que `npm run post`,
 * con sus dos paradas, contra un servidor en un puerto aleatorio y carpetas temporales. Sin red ni gasto.
 */
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { RAIZ } from '../src/config.js';
import type { EncargoCriticaEditorial } from '../src/aplicacion/productor/criticaEditorial.js';
import { crearEstudio } from '../src/web/estudio.js';
import { crearApp } from '../src/web/servidor.js';

function imagenDeLectura(textos: Array<{ texto: string }>, fondo: string, alto = 450) {
  const lineas = textos.map((b, i) => '<text x="20" y="' + (55 + i * 45) + '" font-size="24" fill="white">' + b.texto + '</text>').join('');
  return sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="' + alto + '"><rect width="360" height="' + alto + '" fill="' + fondo + '"/>' + lineas + '</svg>')).png().toBuffer();
}

const FOTO = join(RAIZ, 'plantillas', 'fotos', 'gamba-roja-de-palamos.png');

describe('API web · encargos de la orden única (simulado)', () => {
  let carpeta: string;
  let servidor: Server;
  let base: string;
  const lecturas: Array<Array<[string, number]>> = [];

  const pedir = async (metodo: string, ruta: string, cuerpo?: unknown) => {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: respuesta.status, datos: (await respuesta.json().catch(() => ({}))) as Record<string, any> };
  };
  const subir = async (nombre: string, bytes: Buffer) => {
    const respuesta = await fetch(`${base}/api/subidas`, { method: 'POST', headers: { 'X-Nombre-Archivo': encodeURIComponent(nombre) }, body: new Uint8Array(bytes) });
    return ((await respuesta.json()) as { subida: { id: string } }).subida;
  };
  const esperar = async (trabajo: { id: string }) => {
    for (;;) {
      const { datos } = await pedir('GET', `/api/trabajos/${trabajo.id}`);
      if (datos.trabajo.estado !== 'EN_CURSO') return datos.trabajo;
      await new Promise((r) => setTimeout(r, 30));
    }
  };
  const avanzar = async (proyecto: string, cuerpo: Record<string, unknown> = {}) => {
    const r = await pedir('POST', `/api/encargos/${proyecto}/avanzar`, cuerpo);
    assert.equal(r.status, 202, JSON.stringify(r.datos));
    const final = await esperar(r.datos.trabajo);
    assert.equal(final.estado, 'TERMINADO', JSON.stringify(final.error));
    return final;
  };
  const detalle = async (proyecto: string) => (await pedir('GET', `/api/encargos/${proyecto}`)).datos;
  const archivo = async (ruta: string) => {
    const r = await fetch(`${base}${ruta}`);
    return { status: r.status, tipo: r.headers.get('content-type') ?? '', bytes: Buffer.from(await r.arrayBuffer()) };
  };

  before(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'estudio-web-encargos-'));
    // La biblioteca, con lo mínimo: los principios y la imagen del post que se toma como referencia.
    const biblioteca = join(carpeta, 'biblioteca');
    await mkdir(join(biblioteca, 'referencias'), { recursive: true });
    await writeFile(join(biblioteca, 'principios.md'), '# Principios de prueba');
    await copyFile(join(RAIZ, 'biblioteca', 'referencias', 'post-30.jpg'), join(biblioteca, 'referencias', 'post-30.jpg'));

    const estudio = crearEstudio(
      {
        geminiModelo: 'x',
        geminiFacturacion: false,
        geminiTopeUsd: 1,
        geminiModeloImagen: 'gemini-3-pro-image',
        hfModelo: 'marketing-studio/image',
        hfResolucion: '2k',
        limiteImagenesDia: 40,
        carpetaDatos: join(carpeta, 'datos'),
        carpetaDatosSimulado: join(carpeta, 'datos-simulado'),
        carpetaBiblioteca: biblioteca,
        zonaHoraria: 'Europe/Madrid',
      },
      { simuladoAlArrancar: true, carpetaPlantillas: join(RAIZ, 'plantillas') },
    );
    // Doble de visión para ejercitar devoluciones por página sin depender de la salida determinista de SIMULADO.
    const post = estudio.post.bind(estudio);
    estudio.post = async proyecto => {
      const deps = await post(proyecto);
      if (proyecto !== 'critica-del-entrecot') return deps;
      deps.criticoEditorial = {
        modelo: 'crítico de prueba',
        async revisar({ paginas }: EncargoCriticaEditorial) {
          lecturas.push(paginas.map(p => [p.id, p.version]));
          assert.ok(paginas.every(p => p.bytes[0] === 255 && p.bytes[1] === 216));
          if (lecturas.length === 1) return { incidencias: [{ id: 'detalle-1', version: 1, motivo: 'Concentrar el recorte sobre la textura.', correccion: { tipo: 'AJUSTAR_RECORTE', enfoque: { x: 0.55, y: 0.47 }, zoom: 1.6 } }] };
          if (lecturas.length === 2) return { incidencias: [{ id: 'cierre', version: 1, motivo: 'Revisar la alineación de la firma.', correccion: { tipo: 'REVISION_HUMANA' } }] };
          return { incidencias: [] };
        },
      };
      return deps;
    };
    servidor = crearApp(estudio).listen(0, '127.0.0.1');
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise((r) => servidor.close(r));
    await rm(carpeta, { recursive: true, force: true });
  });

  it('de la foto subida al post exportado, con la referencia, las dos paradas y la intención', async () => {
    // El local de la plantilla (solo en simulado) y sus tokens de marca, que están en marcas/.
    assert.equal((await pedir('POST', '/api/locales/ejemplo')).status, 201);
    const { locales } = (await pedir('GET', '/api/locales')).datos;
    assert.deepEqual(locales.map((l: { slug: string; tokens: boolean }) => [l.slug, l.tokens]), [['asador-etxebarri', true]]);

    // Abrir: corre sola hasta la primera parada; sin piezas y sin referencia, la pide.
    const subida = await subir('gamba.png', await readFile(FOTO));
    const abierto = await pedir('POST', '/api/encargos', { subidaId: subida.id, local: 'asador-etxebarri', plato: 'Gamba roja de Palamós a la brasa' });
    assert.equal(abierto.status, 201, JSON.stringify(abierto.datos));
    const proyecto = abierto.datos.encargo.proyecto as string;
    await esperar(abierto.datos.trabajo);
    let d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'REFERENCIA');
    assert.equal(d.fase, 'REFERENCIA');
    assert.ok(d.referencia.biblioteca.length > 0, 'enseña las familias de la biblioteca');
    assert.ok(d.referencia.estado.propuestas.length > 0, 'propone familias para el local');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/subida?lado=320`)).tipo, 'image/jpeg');
    assert.equal((await archivo('/archivos/biblioteca/post-30')).status, 200);

    // Confirmar fuera de paso no confirma nada.
    assert.equal((await pedir('POST', `/api/encargos/${proyecto}/avanzar`, { confirmo: 'CONFIRMAR_FOTO' })).status, 409);

    // Referencia de la biblioteca: se registra con su ficha y se elige.
    const elegida = await pedir('PUT', `/api/encargos/${proyecto}/referencia`, { biblioteca: 'post-30' });
    assert.equal(elegida.status, 200, JSON.stringify(elegida.datos));
    assert.equal(elegida.datos.encargo.referencia, 'ref-post-30');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/referencia?lado=320`)).status, 200);

    // ■ Parada 1: elementos, prompt y gasto.
    await avanzar(proyecto);
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'CONFIRMAR_ELEMENTOS');
    assert.equal(d.propuesta.valida, true);
    assert.ok(d.propuesta.prompt.length > 50);
    assert.equal(d.propuesta.toma.otra, true);
    const { presupuesto } = (await pedir('GET', `/api/encargos/${proyecto}/presupuesto`)).datos;
    assert.equal(presupuesto.disponible, true);
    assert.equal(presupuesto.tope, null, 'en simulado no hay tope que vigilar');

    // Corregir la propuesta a mano (la lista de elementos) y confirmar.
    const corregida = structuredClone(d.propuesta.contenido);
    corregida.descripcion.elementos[0].nombre = 'gamba roja';
    assert.equal((await pedir('PUT', `/api/encargos/${proyecto}/propuesta`, { propuesta: corregida })).status, 200);
    assert.equal((await detalle(proyecto)).propuesta.contenido.descripcion.elementos[0].nombre, 'gamba roja');
    await avanzar(proyecto, { confirmo: 'CONFIRMAR_ELEMENTOS' });

    // ■ Parada 2: la foto nueva, con la comprobación automática; se rechaza una y se confirma la siguiente.
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'CONFIRMAR_FOTO');
    assert.equal(d.intentos.length, 1);
    assert.equal(d.intentos[0].revision.final, 'PASA');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/activos/${d.intentos[0].activo}?lado=640`)).tipo, 'image/jpeg');
    assert.equal((await archivo(`/archivos/encargos/${proyecto}/activos/otro-activo`)).status, 404, 'solo los activos del encargo');
    await avanzar(proyecto, { rechazo: 'La gamba sale demasiado pequeña' });
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'CONFIRMAR_FOTO');
    assert.deepEqual(d.intentos.map((i: { final: string }) => i.final), ['RECHAZADA', 'PASA']);
    await avanzar(proyecto, { confirmo: 'CONFIRMAR_FOTO' });

    // Diseño (F3): el director de diseño (simulado) escribe la intención y la orden compone sin pararse.
    d = await detalle(proyecto);
    assert.equal(d.espera.tipo, 'HECHO');
    assert.equal(d.diseno.intencion.esBorrador, false);
    const intencion = d.diseno.intencion.contenido;
    // La persona puede seguir afinando: vista previa sin guardar.
    const vista = await pedir('POST', `/api/encargos/${proyecto}/vista-previa`, { intencion: { ...intencion, version: 2 } });
    assert.equal(vista.status, 200, JSON.stringify(vista.datos));
    assert.deepEqual(vista.datos.vista.errores, []);
    assert.equal((await archivo(`${vista.datos.vista.base}${vista.datos.vista.diseno}`)).status, 200);

    // Resultado: el post compuesto y exportado a 3:4 y 4:5, que sale como portada en la lista.
    assert.equal(d.diseno.vigente, 1);
    const [version] = d.diseno.versiones;
    assert.deepEqual(version.exportadas.map((x: { proporcion: string }) => x.proporcion), ['3:4', '4:5']);
    for (const x of version.exportadas) assert.equal((await archivo(`/archivos/encargos/${proyecto}/disenos/${x.archivo}`)).status, 200);
    const lista = (await pedir('GET', '/api/encargos')).datos.encargos;
    assert.equal(lista[0].proyecto, proyecto);
    assert.equal(lista[0].fase, 'RESULTADO');
    assert.match(lista[0].miniatura, /\/disenos\/.*4x5\.jpg$/);

    // Una versión nueva de un encargo terminado se recompone sin tocar la anterior; la misma versión no se sobrescribe.
    assert.equal((await pedir('PUT', `/api/encargos/${proyecto}/intencion`, { intencion })).status, 202);
    const repetida = await esperar((await pedir('GET', `/api/encargos/${proyecto}`)).datos.trabajo);
    assert.equal(repetida.estado, 'ERROR');
    assert.match(repetida.error.message, /no se sobrescribe/);
    const v2 = await pedir('PUT', `/api/encargos/${proyecto}/intencion`, { intencion: { ...intencion, version: 2 } });
    assert.equal((await esperar(v2.datos.trabajo)).estado, 'TERMINADO');
    assert.deepEqual((await detalle(proyecto)).diseno.versiones.map((v: { version: number }) => v.version), [1, 2]);
  });

  it('El pase de entrecot conserva una foto y tres páginas al corregir únicamente el cierre', async () => {
    // Se lee una foto ya versionada. La comanda y cada activo de la prueba viven en carpetas temporales.
    const bytes = await readFile(join(RAIZ, 'proyectos', '2026-11-14-entrecot-de-vaca-curado-directo', 'foto', 'subida.webp'));
    const subida = await subir('entrecot.webp', bytes);
    const proyecto = 'pase-de-entrecot';
    const ruta = `/api/encargos/${proyecto}`;
    const nuevo = await pedir('POST', '/api/encargos', {
      proyecto, local: 'asador-etxebarri', plato: 'Entrecot de vaca a la brasa', formato: 'carrusel',
      referencia: 'ref-post-30', productorEditorial: true, subidaId: subida.id,
    });
    assert.equal(nuevo.status, 201);
    const propuesta = await esperar(nuevo.datos.trabajo);
    const especialistas: string[] = propuesta.intervenciones.map((turno: { especialista: string }) => turno.especialista);
    assert.ok(especialistas.includes('director-foto'));
    assert.ok(especialistas.lastIndexOf('productor') > especialistas.indexOf('director-foto'));
    assert.equal(propuesta.intervencion, undefined);
    let d = await detalle(proyecto);
    assert.equal(d.encargo.paso, 'CONFIRMAR_ELEMENTOS');
    assert.deepEqual(d.editorial.plan.diapositivas.map((p: {tratamiento: string}) => p.tratamiento), ['FOTO_LIMPIA', 'RECORTE_DETALLE', 'CIERRE_TEXTO']);
    assert.match(d.brief.plan[0].para, /sin texto/);
    assert.equal(d.intentos.length, 0);
    const revisionAnterior = d.revision;
    d.propuesta.contenido.descripcion.elementos[0].nombre = 'entrecot';
    const guardar = await pedir('PUT', ruta + '/propuesta', { propuesta: d.propuesta.contenido, revision: d.revision });
    assert.equal(guardar.status, 200, JSON.stringify(guardar.datos));
    assert.equal((await pedir('POST', ruta + '/avanzar', { confirmo: 'CONFIRMAR_ELEMENTOS', revision: revisionAnterior })).status, 409);
    d = await detalle(proyecto);
    assert.equal(d.brief.hechos.inventario.estado, 'PROPUESTO');
    assert.equal(d.editorial.inventarioSha256, d.brief.hechos.inventario.huella);
    await avanzar(proyecto, { confirmo: 'CONFIRMAR_ELEMENTOS', revision: d.revision });
    d = await detalle(proyecto);
    assert.equal(d.encargo.paso, 'CONFIRMAR_FOTO');
    assert.equal(d.brief.hechos.inventario.estado, 'CONFIRMADO');
    assert.equal(d.intentos.length, 1);
    const composicion = await avanzar(proyecto, { confirmo: 'CONFIRMAR_FOTO', revision: d.revision });
    assert.ok(composicion.intervenciones.some((turno: { especialista: string }) => turno.especialista === 'critico'));
    d = await detalle(proyecto);
    assert.equal(d.encargo.paso, 'HECHO');
    assert.equal(d.revisionEditorial.estado, 'APROBADA');
    const [portada, recorte, cierre] = d.diseno.diapositivas;
    assert.deepEqual(portada.intencion.contenido.textos, {});
    assert.equal(recorte.intencion.contenido.activos.foto, d.encargo.activoReal);
    assert.equal(recorte.intencion.contenido.capas[0].zoom, 2);
    assert.ok(Object.values(cierre.intencion.contenido.textos).includes(d.brief.marca.nombre));
    const original = await archivo(d.base + 'disenos/' + portada.versiones[0].exportadas[0].archivo);
    const intencion = cierre.intencion.contenido;
    intencion.capas.find((c: {tipo: string}) => c.tipo === 'texto').alinear = 'derecha';
    const correccion = await pedir('PUT', ruta + '/intencion', { intencion, revision: d.revision });
    assert.equal(correccion.status, 202);
    const trabajo = await esperar(correccion.datos.trabajo);
    assert.equal(trabajo.estado, 'TERMINADO', JSON.stringify(trabajo.error));
    const final = await detalle(proyecto);
    assert.deepEqual(final.diseno.diapositivas.map((p: {versiones: unknown[]}) => p.versiones.length), [1, 1, 2]);
    assert.equal(final.encargo.fotoElegida, d.encargo.fotoElegida);
    assert.equal(final.intentos.length, 1);
    assert.equal(original.status, 200);
    assert.deepEqual((await archivo(d.base + 'disenos/' + portada.versiones[0].exportadas[0].archivo)).bytes, original.bytes);
    assert.equal((await pedir('PUT', ruta + '/intencion', { intencion, revision: d.revision })).status, 409);
    const bitacora = (await readFile(join(carpeta, 'datos-simulado', 'proyectos', proyecto, 'bitacora.jsonl'), 'utf8'))
      .trim().split('\n').map(linea => JSON.parse(linea));
    assert.equal(bitacora.filter(m => m.quien === 'usuario' && m.tipo === 'CONFIRMACION').length, 2);
    assert.ok(bitacora.filter(m => m.tipo === 'LLAMADA').length <= final.brief.presupuesto.llamadasTexto);
    assert.ok(bitacora.some(m => m.tipo === 'LLAMADA' && m.datos.briefVersion === null));
  });

  it('revisa el render, corrige solo el detalle y conserva la candidata durante la revisión humana del cierre', async () => {
    const proyecto = 'critica-del-entrecot';
    const subida = await subir('entrecot.webp', await readFile(join(RAIZ, 'proyectos', '2026-11-14-entrecot-de-vaca-curado-directo', 'foto', 'subida.webp')));
    const ruta = `/api/encargos/${proyecto}`;
    const nuevo = await pedir('POST', '/api/encargos', { proyecto, local: 'asador-etxebarri', referencia: 'ref-post-30',
      plato: 'Entrecot de vaca', formato: 'carrusel', productorEditorial: true, subidaId: subida.id });
    await esperar(nuevo.datos.trabajo);
    await avanzar(proyecto, { confirmo: 'CONFIRMAR_ELEMENTOS', revision: (await detalle(proyecto)).revision });
    await avanzar(proyecto, { confirmo: 'CONFIRMAR_FOTO', revision: (await detalle(proyecto)).revision });
    let d = await detalle(proyecto);
    assert.equal(d.encargo.paso, 'COMPONER');
    assert.deepEqual(lecturas, [[['post', 1], ['detalle-1', 1], ['cierre', 1]], [['post', 1], ['detalle-1', 2], ['cierre', 1]]]);
    assert.equal(d.revisionEditorial.estado, 'REVISION_HUMANA');
    assert.deepEqual(d.revisionEditorial.correcciones, [{ id: 'detalle-1', desde: 1, hasta: 2 }]);
    const fotoAprobada = d.encargo.fotoElegida;
    await avanzar(proyecto);
    assert.equal(lecturas.length, 2, 'No repite el dictamen sobre los mismos píxeles y versiones.');
    d = await detalle(proyecto);
    const cierre = d.diseno.diapositivas[2].intencion.contenido;
    cierre.capas.find((c: {tipo:string}) => c.tipo === 'texto').alinear = 'centro';
    const respuesta = await pedir('PUT', ruta + '/intencion', { intencion: cierre, revision: d.revision });
    assert.equal((await esperar(respuesta.datos.trabajo)).estado, 'TERMINADO');
    const final = await detalle(proyecto);
    assert.equal(final.encargo.paso, 'HECHO');
    assert.equal(final.revisionEditorial.estado, 'APROBADA');
    assert.equal(final.encargo.fotoElegida, fotoAprobada);
    assert.equal(final.intentos.length, 1);
    assert.deepEqual(lecturas[2], [['post', 1], ['detalle-1', 2], ['cierre', 2]]);
  });

  it('un cartel manual conserva el permiso, exige cotejo de la versión y exporta el PNG revisado', async () => {
    const proyecto = 'cartel-del-taller';
    const ruta = '/api/encargos/' + proyecto;
    const foto = await subir('gamba.png', await readFile(FOTO));
    const alta = await pedir('POST', '/api/encargos', { proyecto, local: 'asador-etxebarri', plato: 'Gamba roja de Palamós', arte: 'INTEGRADO', subidaId: foto.id });
    assert.equal(alta.status, 201);
    await esperar(alta.datos.trabajo);
    const propia = await subir('referencia.jpg', await readFile(join(RAIZ, 'biblioteca/referencias/post-11.jpg')));
    assert.equal((await pedir('PUT', ruta + '/referencia', { subidaId: propia.id })).status, 200);
    await avanzar(proyecto);
    const decidir = async (accion: string, datos = {}) => pedir('POST', ruta + '/taller', { revision: (await detalle(proyecto)).revision, accion, ...datos });
    const ficha = await decidir('FICHAR_REFERENCIA', { familia: 'F4', mecanismo: 'TITULAR_EN_EL_AIRE', reticula: 'Sobran dos tercios sobre el sujeto.', foto: 'Luz lateral', voz: 'Didona', lectura: ['Titular', 'Producto', 'Firma'] });
    assert.equal(ficha.status, 200, JSON.stringify(ficha.datos));
    const d = await detalle(proyecto);
    const comanda = d.encargo.taller.comanda;
    assert.equal(comanda.direccion.gesto, 'LUZ_Y_SOMBRA');
    assert.equal(comanda.fotografia.dominantes.length > 0, true);
    assert.notEqual((await archivo(ruta + '/taller/paquete')).status, 200);
    assert.equal((await decidir('CONFIRMAR_DIRECCION')).status, 200);
    assert.equal((await pedir('POST', ruta + '/taller', { accion: 'REABRIR_DIRECCION', revision: d.revision })).status, 409);
    assert.equal((await archivo(ruta + '/taller/paquete')).bytes.readUInt32LE(0), 0x04034b50);
    assert.notEqual((await decidir('GENERAR', { autorizarUnEnvio: true })).status, 202);
    const subirCartel = async (alto: number, color: string) => (await subir('cartel.png', await imagenDeLectura(comanda.textos, color, alto))).id;
    const importar = async (alto: number, color: string) => decidir('IMPORTAR', { subidaId: await subirCartel(alto, color), usoCandidata: 'PUBLICABLE' });
    assert.notEqual((await importar(360, '#654123')).status, 200);
    assert.equal((await importar(450, '#012345')).status, 200);
    const candidata = (await detalle(proyecto)).encargo.taller.candidatas[0];
    assert.equal(candidata.comanda, comanda.huella);
    assert.equal((await decidir('DEVOLVER', { version: 1, motivo: 'Revisar el borde del titular.' })).status, 200);
    assert.match((await detalle(proyecto)).encargo.taller.comanda.prompt, /Revisar el borde/);
    assert.equal((await decidir('CONFIRMAR_DIRECCION')).status, 200);
    assert.notEqual((await importar(450, '#012345')).status, 200);
    assert.equal((await importar(450, '#672145')).status, 200);
    assert.notEqual((await archivo(ruta + '/taller/exportacion')).status, 200);
    const revision = { version: 2, producto: true, gesto: true, legibilidad: true, transcripcion: comanda.textos.map((b: { texto: string }) => b.texto) };
    assert.notEqual((await decidir('APROBAR', { ...revision, transcripcion: ['GRATIS'] })).status, 200);
    assert.notEqual((await decidir('APROBAR', { ...revision, version: 1 })).status, 200);
    assert.equal((await decidir('APROBAR', revision)).status, 200);
    const final = await archivo(ruta + '/taller/exportacion');
    assert.equal(final.status, 200);
    const meta = await sharp(final.bytes).metadata();
    assert.deepEqual([meta.width, meta.height, meta.format], [1080, 1350, 'png']);
    assert.deepEqual(final.bytes, (await archivo(ruta + '/taller/candidatas/2')).bytes);
  });

  it('el permiso de prueba de la fuente prevalece tras importar, aprobar y volver a abrir el encargo', async () => {
    const proyecto = 'cartel-solo-prueba', ruta = '/api/encargos/' + proyecto;
    const subida = await subir('cafe.webp', await readFile(join(RAIZ, 'plantillas/fotos/cafe-albor-cafe.webp')));
    const alta = await pedir('POST', '/api/encargos', { proyecto, local: 'asador-etxebarri', plato: 'Café solo', referencia: 'ref-post-30', arte: 'INTEGRADO', usoFotoReal: 'SOLO_PRUEBA_COMPOSICION', subidaId: subida.id });
    await esperar(alta.datos.trabajo);
    const decidir = async (accion: string, datos = {}) => pedir('POST', ruta + '/taller', { revision: (await detalle(proyecto)).revision, accion, ...datos });
    assert.equal((await decidir('PROPONER_GESTO', { gesto: 'MACRO' })).status, 200);
    const c = (await detalle(proyecto)).encargo.taller.comanda;
    assert.match(c.direccion.escena, /macro/i);
    assert.equal((await decidir('CONFIRMAR_DIRECCION')).status, 200);
    const vacia = await subir('vacia.png', await sharp({ create: { width: 360, height: 450, channels: 3, background: 'white' } }).png().toBuffer());
    assert.equal((await decidir('IMPORTAR', { subidaId: vacia.id, usoCandidata: 'PUBLICABLE' })).status, 200);
    const comprobaciones = { producto: true, legibilidad: true, gesto: true, transcripcion: c.textos.map((b: { texto: string }) => b.texto) };
    assert.notEqual((await decidir('APROBAR', { version: 1, ...comprobaciones })).status, 200);
    assert.equal((await decidir('DEVOLVER', { version: 1, motivo: 'Falta toda la imagen' })).status, 200);
    assert.equal((await decidir('CONFIRMAR_DIRECCION')).status, 200);
    const bytes = await imagenDeLectura(c.textos, '#223344');
    const candidata = await subir('cafe.png', bytes);
    assert.equal((await decidir('IMPORTAR', { subidaId: candidata.id, usoCandidata: 'PUBLICABLE' })).status, 200);
    const aprobada = await decidir('APROBAR', { version: 2, ...comprobaciones });
    assert.equal(aprobada.status, 200, JSON.stringify(aprobada.datos));
    assert.equal((await detalle(proyecto)).encargo.taller.candidatas[1].uso, 'SOLO_PRUEBA_COMPOSICION');
    assert.notEqual((await archivo(ruta + '/taller/exportacion')).status, 200);
    assert.equal((await archivo(ruta + '/taller/candidatas/1')).status, 200);
  });

  it('el local de ejemplo solo existe en simulado y las rutas no salen de su carpeta', async () => {
    await pedir('PUT', '/api/estudio', { simulado: false });
    try {
      assert.equal((await pedir('POST', '/api/locales/ejemplo')).status, 409);
    } finally {
      await pedir('PUT', '/api/estudio', { simulado: true });
    }
    assert.equal((await archivo('/archivos/biblioteca/..%2Fprincipios.md')).status, 400);
    assert.equal((await archivo('/archivos/encargos/NO-VALIDO/subida')).status, 400);
    assert.equal((await pedir('GET', '/api/encargos/no-existe')).status, 404);
  });
});
