/**
 * Punto 2 · Al dar de alta un local: sus tokens y sus fuentes (Google Fonts, OFL, con la Ñ y las tildes comprobadas).
 * Sin red: el proveedor de fuentes es falso y devuelve una fuente OFL del propio catálogo con otro nombre.
 */
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { archivoPrincipal, carpetaDeGoogle } from '../src/adaptadores/fuentes/GoogleFontsGithub.js';
import { familiaDe, parecidaDelCatalogo, prepararMarca, tokenDeColor } from '../src/aplicacion/prepararMarca.js';
import { RAIZ } from '../src/config.js';
import { Tokens } from '../src/dominio/diseno/intencion.js';
import { Marca } from '../src/dominio/modelos.js';
import type { ProveedorDeFuentes } from '../src/puertos/ProveedorDeFuentes.js';

let raiz: string;
before(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'estudio-marca-'));
  await mkdir(join(raiz, 'recursos', 'tipografias'), { recursive: true });
  await copyFile(join(RAIZ, 'recursos', 'tipografias', 'catalogo.json'), join(raiz, 'recursos', 'tipografias', 'catalogo.json'));
});
after(() => rm(raiz, { recursive: true, force: true }));

const marca = (slug: string, tipografias: Array<{ rol: 'TITULOS' | 'TEXTOS' | 'ROTULO'; descripcion: string }>) =>
  Marca.parse({ slug, nombre: 'Prueba', ciudad: 'Málaga', descripcion: 'x', tonos: ['Elegante'], colores: [{ nombre: 'Oro', hex: '#CFA670' }, { nombre: 'Negro', hex: '#222222' }, { nombre: 'Gris profesional', hex: '#D4D4D4' }], tipografias });

describe('Punto 2 · tokens y fuentes al dar de alta un local', () => {
  it('nombres: la familia sin palabras de clasificación, la carpeta de Google y un token por color', () => {
    assert.equal(familiaDe('Bebas Neue Sans-Serif'), 'Bebas Neue');
    assert.equal(familiaDe('Lora Serif'), 'Lora');
    assert.equal(carpetaDeGoogle('Abril Fatface'), 'abrilfatface');
    assert.equal(tokenDeColor('Gris profesional'), 'gris-profesional');
    assert.equal(parecidaDelCatalogo('script de pincel', 'TITULOS'), 'kaushan-script');
    const meta = 'name: "X"\nlicense: "OFL"\ncategory: "SANS_SERIF"\nfonts {\n  style: "normal"\n  weight: 400\n  filename: "X-Regular.ttf"\n}\nfonts {\n  style: "normal"\n  weight: 400\n  filename: "X[wght].ttf"\n}';
    assert.deepEqual(archivoPrincipal(meta), { archivo: 'X[wght].ttf', categoria: 'SANS_SERIF', licencia: 'OFL' });
  });

  it('una fuente que no está: se descarga, se comprueba la Ñ y entra en el catálogo; las que están, se usan; la que no existe, se sustituye y queda pendiente', async () => {
    const bytes = await readFile(join(RAIZ, 'recursos', 'tipografias', 'caveat', 'Caveat[wght].ttf'));
    const proveedor: ProveedorDeFuentes = {
      nombre: 'falso',
      buscar: async (familia) => (familia === 'Fuente Nueva' ? { familia, archivo: { nombre: 'FuenteNueva[wght].ttf', bytes }, licencia: Buffer.from('OFL'), url: 'https://ejemplo/ofl/fuentenueva', categoria: 'HANDWRITING' } : undefined),
    };
    const r = await prepararMarca({ raiz, proveedor, hoy: () => '2026-11-15' }, marca('prueba', [
      { rol: 'TITULOS', descripcion: 'Fuente Nueva Display' },
      { rol: 'TEXTOS', descripcion: 'Lato' },
      { rol: 'ROTULO', descripcion: 'Una Que No Existe Sans-Serif' },
    ]));
    assert.deepEqual(r.fuentes.map((f) => [f.rol, f.estado, f.id]), [
      ['TITULOS', 'DESCARGADA', 'fuente-nueva'],
      ['TEXTOS', 'EN_CATALOGO', 'lato'],
      ['ROTULO', 'SUSTITUIDA', 'archivo'],
    ]);
    assert.match(r.fuentes[2]!.nota, /PENDIENTE de confirmar/);
    await stat(join(raiz, 'recursos', 'tipografias', 'fuente-nueva', 'OFL.txt'));
    const catalogo = JSON.parse(await readFile(join(raiz, 'recursos', 'tipografias', 'catalogo.json'), 'utf8'));
    assert.ok(catalogo.fuentes.some((f: { id: string; licencia: string }) => f.id === 'fuente-nueva' && f.licencia === 'OFL-1.1'));
    const tokens = Tokens.parse(JSON.parse(await readFile(r.tokens, 'utf8')));
    assert.deepEqual(Object.keys(tokens.colores), ['oro', 'negro', 'gris-profesional']);
    assert.equal(tokens.estilos.titular?.fuente, 'fuente-nueva');
    // Una segunda vez no sobrescribe.
    assert.equal((await prepararMarca({ raiz, proveedor, hoy: () => '2026-11-15' }, marca('prueba', []))).creados, false);
  });
});
