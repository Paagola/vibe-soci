/**
 * Los datos reales de los locales (datos/locales/<slug>/marca.json) tienen que pasar el esquema de la app.
 * datos/ no está en git: en un clon nuevo no hay locales y la prueba no comprueba nada (lo dice en el nombre).
 * Motivo (09/11/2026): dos marca.json escritos a mano tenían nombres de color de más de 30 caracteres y
 * AlmacenLocalesFicheros.listar() fallaba entero, con lo que la web no cargaba ningún local.
 * Solo lee: no escribe ni gasta.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { AlmacenLocalesFicheros } from '../src/adaptadores/ficheros/AlmacenLocalesFicheros.js';
import { RAIZ } from '../src/config.js';
import { Marca } from '../src/dominio/modelos.js';

const CARPETA = join(RAIZ, 'datos', 'locales');

async function slugsConMarca(): Promise<string[]> {
  if (!existsSync(CARPETA)) return [];
  const entradas = await readdir(CARPETA, { withFileTypes: true });
  return entradas.filter((e) => e.isDirectory() && existsSync(join(CARPETA, e.name, 'marca.json'))).map((e) => e.name).sort();
}

describe('datos reales de los locales', () => {
  it('cada datos/locales/*/marca.json pasa el esquema Marca de la app (si hay datos)', async () => {
    const problemas: string[] = [];
    for (const slug of await slugsConMarca()) {
      const resultado = Marca.safeParse(JSON.parse(await readFile(join(CARPETA, slug, 'marca.json'), 'utf8')));
      if (!resultado.success) {
        for (const p of resultado.error.issues) problemas.push(`${slug}: ${p.path.join('.')}: ${p.message}`);
      } else {
        assert.equal(resultado.data.slug, slug, `${slug}: el slug del archivo no coincide con su carpeta`);
      }
    }
    assert.deepEqual(problemas, [], `marca.json inválidos:\n${problemas.join('\n')}`);
  });

  it('el almacén de locales lista todos los locales reales sin fallar (lo que pide la portada de la web)', async () => {
    const slugs = await slugsConMarca();
    const marcas = await new AlmacenLocalesFicheros(CARPETA).listar();
    assert.deepEqual(
      marcas.map((m) => m.slug),
      slugs,
    );
  });
});
