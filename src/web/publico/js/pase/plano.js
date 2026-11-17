import { h, reemplazar } from '../ui.js';

export const ESTACIONES = [
  { id: 'original', nombre: 'Original', capa: '#fffaee' },
  { id: 'referencia', nombre: 'Referencia', capa: '#f4d8e7' },
  { id: 'elementos', nombre: 'Inventario', capa: '#efe5ff' },
  { id: 'candidata', nombre: 'Candidata', capa: '#fffcf6' },
  { id: 'composicion', nombre: 'Composición', capa: '#e7efbf' },
  { id: 'entrega', nombre: 'Entrega', capa: '#e3ceef' },
];

const AMPLIO = [
  [-2.55, -.56, 4.12, 3.2, -7], [1.03, -1.64, 1.7, 1.83, 7], [3.54, -1.48, 2.24, 2.25, -6],
  [1.37, 1.34, 3.02, 2.12, -6], [-3.45, 1.98, 2.35, 1.08, 5], [4.4, 1.58, 1.48, 1.8, 8],
];

const COMPACTO = [
  [-1.33, -2.02, 2.46, 1.84, -6], [1.36, -2.02, 1.65, 1.72, 5], [1.37, .17, 1.74, 1.62, -3],
  [-1.34, .30, 2.36, 1.60, 4], [-1.33, 2.26, 2.07, 1.04, -5], [1.35, 2.29, 1.40, 1.30, 6],
];

export function distribuir(ancho, alto) {
  const proporcion = ancho / alto;
  const compacto = proporcion < 1.35;
  const base = compacto ? COMPACTO : AMPLIO;
  const altura = Math.max(6.65, (compacto ? 5.65 : 11.9) / proporcion);
  const anchura = altura * proporcion;
  const papeles = ESTACIONES.map((estacion, i) => {
    const [x, z, w, d, giro] = base[i];
    return { ...estacion, x, z, w, d, giro, anclaZ: z + d * .5 + (compacto ? .19 : .22) };
  });
  return { anchura, altura, compacto, papeles };
}

export function proyectar2d({ anchura, altura }, x, z) {
  return [50 + (x / anchura) * 100, 50 + (z / altura) * 100];
}

export function pintarPlano(contenedor, plano, materiales) {
  reemplazar(contenedor, plano.papeles.map((p) => {
    const material = materiales[p.id] ?? {};
    const [x, z] = proyectar2d(plano, p.x, p.z);
    const imagen = material.url ? h('img', { src: material.url, alt: '' }) : null;
    const dibujado = imagen || material.lineas?.length;
    const papel = h('div', {
      class: 'plano-material', 'data-tipo': p.id, 'data-vacio': !dibujado, style: { left: `${x}%`, top: `${z}%` },
    }, imagen ?? (material.lineas?.length ? h('ol', { class: 'plano-lineas' }, material.lineas.slice(0, 5).map((texto) => h('li', {}, texto))) : null));
    papel.style.setProperty('--giro', `${p.giro}deg`);
    papel.style.setProperty('--material-ancho', `${p.w / plano.anchura * 100}%`);
    papel.style.setProperty('--material-alto', `${p.d / plano.altura * 100}%`);
    papel.style.setProperty('--material-papel', p.capa);
    imagen?.addEventListener('error', () => { imagen.remove(); papel.dataset.vacio = ''; });
    return papel;
  }));
}

export function puntoInventario(papel, indice) {
  const giro = papel.giro * Math.PI / 180;
  const x = -papel.w * .36;
  const z = papel.d * (-.27 + indice * .137);
  return [papel.x + Math.cos(giro) * x - Math.sin(giro) * z, papel.z + Math.sin(giro) * x + Math.cos(giro) * z];
}
