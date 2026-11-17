import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Placa de señal del banco. Cada útil proyecta un motivo distinto sobre su visor. */
export function montarSelectorDeOficio(escena) {
  const conjunto = new T.Group();
  conjunto.position.set(-2.50, .24, .37);
  conjunto.rotation.y = .08;
  conjunto.visible = false;
  escena.add(conjunto);

  const acero = new T.MeshStandardMaterial({ color: '#383a33', roughness: .36, metalness: .65 });
  const laton = new T.MeshStandardMaterial({ color: '#b59565', roughness: .29, metalness: .84 });
  const fondo = new T.MeshStandardMaterial({ color: '#25251c', roughness: .47, metalness: .42 });
  const señal = new T.MeshStandardMaterial({
    color: '#dfb471', metalness: .51, roughness: .32,
    emissive: '#d88c32', emissiveIntensity: .5,
  });
  const vidrio = new T.MeshPhysicalMaterial({
    color: '#eed7ae', transparent: true, opacity: .15,
    metalness: .23, roughness: .23, clearcoat: 1, depthWrite: false,
  });

  function pieza(padre, geometria, material, x = 0, y = 0, z = 0) {
    const malla = new T.Mesh(geometria, material);
    malla.position.set(x, y, z);
    padre.add(malla);
    return malla;
  }
  const caja = (padre, w, h, d, r, material, x, y, z) =>
    pieza(padre, new RoundedBoxGeometry(w, h, d, 2, r), material, x, y, z);
  const aro = (padre, radio, grosor, material, x, y, z) =>
    pieza(padre, new T.TorusGeometry(radio, grosor, 8, 48), material, x, y, z);

  caja(conjunto, .76, .12, .46, .036, acero, 0, .04, -.08);
  caja(conjunto, .52, .48, .27, .065, acero, 0, .34, -.11).rotation.x = -.12;
  caja(conjunto, .72, .69, .22, .12, acero, 0, .67, -.04);
  caja(conjunto, .62, .59, .12, .096, laton, 0, .67, .066);
  caja(conjunto, .54, .51, .05, .078, fondo, 0, .67, .127);
  aro(conjunto, .203, .011, laton, 0, .67, .157);
  const visor = caja(conjunto, .48, .47, .022, .078, vidrio, 0, .67, .216);
  visor.renderOrder = 2;
  for (const x of [-.28, .28]) {
    for (const y of [.39, .95]) pieza(conjunto, new T.SphereGeometry(.018, 10, 8), laton, x, y, .153);
  }
  caja(conjunto, .24, .023, .02, .008, señal, 0, .342, .087);

  const matriz = new T.Group();
  matriz.position.set(0, .67, .181);
  conjunto.add(matriz);

  const oficiales = new Map();
  function figura(nombre) {
    const motivo = new T.Group();
    motivo.visible = false;
    matriz.add(motivo);
    oficiales.set(nombre, motivo);
    return motivo;
  }
  function grano(padre, x, y, radio = .038) {
    pieza(padre, new T.SphereGeometry(radio, 16, 10), señal, x, y, .003);
  }
  function liston(padre, longitud, ancho, x, y, angulo = 0) {
    caja(padre, longitud, ancho, .026, .009, señal, x, y, 0).rotation.z = angulo;
  }
  function marco(padre, radio, lados, angulo = 0) {
    pieza(padre, new T.TorusGeometry(radio, .016, 8, lados), señal).rotation.z = angulo;
  }

  const mesa = figura('mesa');
  marco(mesa, .115, 32);
  grano(mesa, 0, 0, .034);

  const productor = figura('productor');
  for (const angulo of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) {
    const x = Math.cos(angulo);
    const y = Math.sin(angulo);
    liston(productor, .11, .022, .062 * x, .062 * y, angulo);
    grano(productor, .136 * x, .136 * y, .036);
  }
  grano(productor, 0, 0, .052);

  const analista = figura('analista');
  marco(analista, .106, 32);
  liston(analista, .095, .030, .104, -.104, -Math.PI / 4);
  grano(analista, -.025, .03, .037);

  const fotografia = figura('fotografia');
  marco(fotografia, .14, 32);
  for (let i = 0; i < 6; i++) {
    const angulo = i * Math.PI / 3;
    liston(fotografia, .088, .026, .088 * Math.cos(angulo), .088 * Math.sin(angulo), angulo + .73);
  }

  const imagen = figura('imagen');
  marco(imagen, .163, 4, Math.PI / 4);
  liston(imagen, .155, .025, 0, .042);
  liston(imagen, .103, .025, -.026, -.028);

  const revision = figura('revision');
  marco(revision, .144, 32);
  liston(revision, .078, .034, -.05, -.023, -Math.PI / 4);
  liston(revision, .13, .034, .025, .004, Math.PI / 4);

  const diseno = figura('diseno');
  liston(diseno, .171, .04, -.040, .091);
  liston(diseno, .241, .04, 0, 0);
  liston(diseno, .16, .04, .043, -.091);

  const critico = figura('critico');
  for (const lado of [-1, 1]) {
    liston(critico, .206, .027, lado * .121, 0, Math.PI / 2);
    liston(critico, .063, .029, lado * .098, .099);
    liston(critico, .063, .029, lado * .098, -.099);
  }
  marco(critico, .067, 4);

  function activar(nombre) {
    conjunto.visible = Boolean(nombre);
    for (const [id, motivo] of oficiales) motivo.visible = id === nombre;
  }

  function respirar(tiempo) {
    matriz.rotation.y = tiempo === null ? 0 : Math.sin(tiempo / 570) * .21;
    señal.emissiveIntensity = tiempo === null ? .48 : .5 + Math.sin(tiempo / 570) * .21;
  }

  return { activar, respirar };
}
