// Texturas de las imágenes REALES del encargo (miniaturas de /archivos/encargos/…?lado=320). Carga diferida: la
// primera vez que se pide una URL se descarga y, mientras tanto (o si falla, p. ej. un 404), no hay textura y el soporte
// se queda en blanco. Nunca se pone una imagen inventada. Todo se libera al desmontar.
import * as THREE from 'three';

export function crearCargador({ alCargar = () => {} } = {}) {
  const cache = new Map();
  const cargador = new THREE.TextureLoader();
  return {
    /** La textura de `url` si ya está cargada; si no, empieza a cargarla y devuelve null. */
    textura(url) {
      if (!url) return null;
      let e = cache.get(url);
      if (!e) {
        e = { tex: null, estado: 'cargando' };
        cache.set(url, e);
        cargador.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            e.tex = tex;
            e.estado = 'ok';
            alCargar(url);
          },
          undefined,
          () => {
            e.estado = 'error';
          },
        );
      }
      return e.tex;
    },
    estado(url) {
      return cache.get(url)?.estado ?? null;
    },
    liberar() {
      for (const e of cache.values()) e.tex?.dispose();
      cache.clear();
    },
  };
}

/** Pone una imagen en una lámina (MeshBasicMaterial): la real si la hay; si no, el papel en blanco (o el color dado). */
export function ponerImagen(lamina, tex, vacio = 0xf7f2e8) {
  const mat = lamina.material;
  if (mat.map === tex && (tex || mat.color.getHex() === vacio)) return;
  mat.map = tex ?? null;
  mat.color.set(tex ? 0xffffff : vacio);
  mat.needsUpdate = true;
}
