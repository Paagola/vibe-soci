// Cristal líquido: la lente del filo del panel lateral.
//
// El cristal base es CSS (backdrop-filter: blur + saturate, en estilos.css) y funciona en todos los navegadores.
// Este módulo le añade lo que un desenfoque plano no tiene: la REFRACCIÓN del filo. Lo que hay detrás se curva hacia
// dentro en un bisel convexo a lo largo del borde redondeado, como en una lente, y el centro queda esmerilado y quieto
// para que el texto se lea.
//
// Técnica: mapa de desplazamiento calculado para el tamaño exacto del panel (kube.io, «Liquid Glass in the Browser:
// Refraction with CSS and SVG») aplicado con <feImage> + <feDisplacementMap>. Diferencia con el artículo: no va dentro de
// backdrop-filter. En Chromium, feImage se ignora dentro de backdrop-filter (comprobado: feTurbulence sí funciona ahí,
// el mismo mapa con feImage no), y Safari y Firefox no pintan filtros SVG en backdrop-filter. Como detrás del panel lateral
// solo está la pared fija (el contenido va a su derecha), el filo se pinta con un `filter` normal sobre una copia exacta
// de la pared, recortada al panel. Es estática: se calcula una vez por tamaño de ventana, no en cada fotograma.
// Si un navegador no carga el mapa, la máscara del bisel tampoco se carga y el filo simplemente no aparece.

const SVG = 'http://www.w3.org/2000/svg';
const BISEL = 26; // px de filo que refractan
const DESPLAZAMIENTO = 16; // px de desplazamiento máximo en el filo

/**
 * Recorre los píxeles de un rectángulo redondeado y da, para cada uno, cuánto está dentro del borde y su normal hacia
 * fuera. Devuelve dos mapas como data URL: el de desplazamiento (R, G = vector hacia dentro; 128 = nada) y la máscara
 * del bisel (opaca en el filo, transparente hacia el centro).
 */
function mapas(ancho, alto, radio) {
  const r = Math.min(radio, ancho / 2, alto / 2);
  const mitadX = ancho / 2;
  const mitadY = alto / 2;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  const desplazamiento = contexto.createImageData(ancho, alto);
  const mascara = contexto.createImageData(ancho, alto);

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      // Distancia con signo al borde (función de distancia del rectángulo redondeado), positiva dentro.
      const px = x + 0.5 - mitadX;
      const py = y + 0.5 - mitadY;
      const qx = Math.abs(px) - (mitadX - r);
      const qy = Math.abs(py) - (mitadY - r);
      const fueraX = Math.max(qx, 0);
      const fueraY = Math.max(qy, 0);
      const largo = Math.hypot(fueraX, fueraY);
      const dentro = -(largo + Math.min(Math.max(qx, qy), 0) - r);
      const t = Math.min(Math.max(dentro / BISEL, 0), 1);

      let vx = 0;
      let vy = 0;
      if (t < 1) {
        // Normal hacia fuera: en las esquinas, radial; en los lados, perpendicular al lado más cercano.
        let nx = 0;
        let ny = 0;
        if (largo > 0) {
          nx = (fueraX / largo) * Math.sign(px);
          ny = (fueraY / largo) * Math.sign(py);
        } else if (qx > qy) nx = Math.sign(px);
        else ny = Math.sign(py);
        // Perfil convexo: la pendiente de la lente es máxima en el filo y se apaga suave hacia el centro.
        const fuerza = Math.pow(1 - t, 2);
        vx = -nx * fuerza;
        vy = -ny * fuerza;
      }
      const i = (y * ancho + x) * 4;
      desplazamiento.data[i] = Math.round(128 + vx * 127);
      desplazamiento.data[i + 1] = Math.round(128 + vy * 127);
      desplazamiento.data[i + 2] = 128;
      desplazamiento.data[i + 3] = 255;
      mascara.data[i] = 255;
      mascara.data[i + 1] = 255;
      mascara.data[i + 2] = 255;
      mascara.data[i + 3] = Math.round(255 * Math.pow(1 - t, 1.4));
    }
  }
  const aUrl = (datos) => {
    contexto.putImageData(datos, 0, 0);
    return lienzo.toDataURL('image/png');
  };
  return { desplazamiento: aUrl(desplazamiento), mascara: aUrl(mascara) };
}

/** Crea un nodo SVG con sus atributos. */
function svg(nombre, atributos = {}) {
  const nodo = document.createElementNS(SVG, nombre);
  for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, String(valor));
  return nodo;
}

/*
 * Cadena del filtro, aplicada a la copia de la pared (del tamaño de la ventana):
 *   pared ─ desenfoque leve ─ desplazamiento (mapa, en la posición del panel) ─ aclarado ─ × máscara del bisel → filo
 * Fuera del filo el resultado es transparente: ahí se ve el cristal esmerilado del CSS.
 */
function crearFiltro(id) {
  const filtro = svg('filter', { id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
  const mapa = svg('feImage', { preserveAspectRatio: 'none', result: 'mapa' });
  const mascara = svg('feImage', { preserveAspectRatio: 'none', result: 'mascara' });
  filtro.append(
    mapa,
    mascara,
    svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 2, edgeMode: 'duplicate', result: 'pared' }),
    // feDisplacementMap desplaza escala × (canal − 0,5): con canal = 128 ± 127·v, la escala es el doble del máximo.
    svg('feDisplacementMap', { in: 'pared', in2: 'mapa', scale: DESPLAZAMIENTO * 2, xChannelSelector: 'R', yChannelSelector: 'G', result: 'curvada' }),
    // El mismo velo blanco que el relleno del cristal (≈ 40 %) y algo más de saturación, como hace el desenfoque del CSS.
    svg('feColorMatrix', { in: 'curvada', type: 'saturate', values: 1.5, result: 'saturada' }),
    svg('feColorMatrix', { in: 'saturada', type: 'matrix', values: '0.6 0 0 0 0.4  0 0.6 0 0 0.4  0 0 0.6 0 0.4  0 0 0 1 0', result: 'velada' }),
    svg('feComposite', { in: 'velada', in2: 'mascara', operator: 'in' }),
  );
  return { filtro, mapa, mascara };
}

/** Añade la lente del filo al panel. No hace nada si se pide menos transparencia o menos movimiento visual. */
export function iniciarCristal(panel) {
  if (!panel || matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
  const id = 'cristal-lente';
  const lienzoSvg = svg('svg', { 'aria-hidden': 'true', width: 0, height: 0 });
  lienzoSvg.style.position = 'absolute';
  const { filtro, mapa, mascara } = crearFiltro(id);
  lienzoSvg.append(filtro);
  document.body.append(lienzoSvg);

  // La copia de la pared: del tamaño de la ventana, colocada para coincidir con la de verdad y recortada por el panel.
  const lente = document.createElement('div');
  lente.className = 'cristal-lente';
  lente.setAttribute('aria-hidden', 'true');
  const pared = document.createElement('div');
  pared.className = 'cristal-lente-pared';
  pared.style.filter = `url(#${id})`;
  lente.append(pared);
  panel.prepend(lente);

  let firma = '';
  const actualizar = () => {
    const caja = panel.getBoundingClientRect();
    const ancho = Math.round(caja.width);
    const alto = Math.round(caja.height);
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const radio = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0;
    // En móvil el panel deja de ser cristal (display de la lente a none por CSS): no hay nada que calcular.
    if (getComputedStyle(lente).display === 'none' || !ancho || !alto) return;
    const nueva = [caja.left, caja.top, ancho, alto, vw, vh, radio].map(Math.round).join(',');
    if (nueva === firma) return;
    firma = nueva;
    // La lente cubre el panel con su borde (inset −1,25 px); la pared se desplaza para quedar en su sitio de la ventana.
    const origenX = caja.left;
    const origenY = caja.top;
    Object.assign(pared.style, { width: `${vw}px`, height: `${vh}px`, left: `${-origenX}px`, top: `${-origenY}px` });
    filtro.setAttribute('x', '0');
    filtro.setAttribute('y', '0');
    filtro.setAttribute('width', String(vw));
    filtro.setAttribute('height', String(vh));
    const { desplazamiento, mascara: alfa } = mapas(ancho, alto, radio);
    for (const imagen of [mapa, mascara]) {
      imagen.setAttribute('x', String(origenX));
      imagen.setAttribute('y', String(origenY));
      imagen.setAttribute('width', String(ancho));
      imagen.setAttribute('height', String(alto));
    }
    mapa.setAttribute('href', desplazamiento);
    mascara.setAttribute('href', alfa);
  };
  // El mapa tarda unos 10–17 ms (medido a 252 × 868): mientras se arrastra el borde de la ventana se espera a que pare.
  let pendiente = 0;
  const programar = () => {
    clearTimeout(pendiente);
    pendiente = setTimeout(actualizar, firma ? 150 : 0);
  };
  new ResizeObserver(programar).observe(panel);
  window.addEventListener('resize', programar);
}
