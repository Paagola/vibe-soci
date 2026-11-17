export const ESTACIONES = [
  { id: 'original', nombre: 'Original', accion: 'Captación', texto: 'La fotografía que da origen al encargo.' },
  { id: 'referencia', nombre: 'Referencia', accion: 'Referencia', texto: 'La imagen que orienta el lenguaje visual de la pieza.' },
  { id: 'elementos', nombre: 'Inventario', accion: 'Inventario', texto: 'Revisa los elementos, el encuadre y la luz de la toma.' },
  { id: 'candidata', nombre: 'Candidata', accion: 'Comparación', texto: 'Contrasta la foto candidata con la toma original.' },
  { id: 'composicion', nombre: 'Composición', accion: 'Composición', texto: 'Encuadre, texto y jerarquía de cada diapositiva.' },
  { id: 'entrega', nombre: 'Entrega', accion: 'Entrega', texto: 'Las piezas finales y sus formatos de exportación.' },
];

// Carriage position, carriage angle, iris angle and comparison slide extension.
export const AJUSTES = {
  original:    [1.56, -.20, -.03, 0],
  referencia:  [1.16, -.06,  .13, 0],
  elementos:   [ .72,  .08, -.24, 0],
  candidata:   [2.86, -.16,  .24, 1],
  composicion: [1.36,  .12, -.12, 0],
  entrega:     [2.68, -.12,  .32, 0],
};
export const ANCHO = 1040;
export const ALTO = 600;
export function soporteDe(fase, materiales) {
  const principal = fase === 'elementos' ? 'original' : fase === 'composicion' && !materiales.composicion?.url ? 'candidata' : fase;
  const foto = (id) => ({ ...materiales[id], nombre: ESTACIONES.find(s => s.id === id).nombre });
  return [foto(principal), fase === 'candidata' ? foto('original') : {}];
}

export function dibujarFotos(contenedor, esquinas, fase, fotos) {
  const ancho = contenedor.clientWidth;
  const alto = contenedor.clientHeight;
  const escala = Math.min(ancho / ANCHO, alto / ALTO);
  const margenX = (ancho - escala * ANCHO) / 2;
  const margenY = (alto - escala * ALTO) / 2;
  Array.from(contenedor.children).forEach((carril, i) => {
    const foto = fotos[i];
    const puntos = esquinas?.[i];
    carril.hidden = !puntos || (!foto.url && (i || !['elementos','composicion'].includes(fase)));
    if (carril.hidden) return;
    const imagen = carril.querySelector('img');
    if (imagen.getAttribute('src') !== foto.url) {
      imagen.hidden = !foto.url;
      if (foto.url) imagen.setAttribute('src', foto.url);
      else imagen.removeAttribute('src');
    }
    const enlace = carril.querySelector('a');
    if (foto.url) {
      enlace.href = foto.original || foto.url;
      enlace.setAttribute('aria-label', 'Abrir ' + foto.nombre.toLowerCase() + ' a tamaño completo');
    } else {
      enlace.removeAttribute('href');
      enlace.removeAttribute('aria-label');
    }
    const nombre = carril.querySelector('small');
    nombre.textContent = fase === 'candidata' && foto.url ? foto.nombre : '';
    carril.dataset.guia = fase === 'elementos' ? 'inventario' : fase === 'composicion' ? 'encuadre' : '';
    const [a,b,c] = puntos;
    carril.style.transform = 'matrix(' + [
      (b[0]-a[0])*escala/192, (b[1]-a[1])*escala/192,
      (c[0]-a[0])*escala/270, (c[1]-a[1])*escala/270,
      margenX+a[0]*escala, margenY+a[1]*escala,
    ].join(',') + ')';
  });
}
