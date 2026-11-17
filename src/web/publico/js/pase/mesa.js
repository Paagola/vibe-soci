import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COTA = .155;
const carta = '600 23px Georgia, serif';
const blanco = '#f8f3fb';
const contraste = '#65516f';
const sombreado = (color, roughness = .78) => new T.MeshStandardMaterial({ color, roughness });

export function crearMesa(contenedor, alProyectar, alPerderContexto) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor('#d7c8e0');
  contenedor.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', (evento) => {
    evento.preventDefault();
    alPerderContexto();
  });

  const escena = new T.Scene();
  const camara = new T.OrthographicCamera();
  camara.near = .1;
  camara.far = 90;
  const luz = new T.DirectionalLight('#f9edff', 2.15);
  luz.position.set(-5, 11, -6);
  luz.castShadow = true;
  luz.shadow.mapSize.set(1536, 1536);
  Object.assign(luz.shadow.camera, { left: -8, right: 8, top: 7, bottom: -7, near: 1, far: 26 });
  luz.shadow.normalBias = .03;
  luz.shadow.blurSamples = 20;
  escena.add(new T.HemisphereLight('#fbf3ff', '#746180', 2.2), luz);

  const fondo = new T.Mesh(new T.PlaneGeometry(70, 70), sombreado('#9578a5'));
  fondo.rotation.x = -Math.PI / 2;
  fondo.position.y = -.17;
  fondo.receiveShadow = true;
  escena.add(fondo);

  const puesto = new T.Group();
  escena.add(puesto);
  const cargador = new T.TextureLoader();
  const ray = new T.Raycaster();
  const cursor = new T.Vector2();
  const punto = new T.Vector3();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const foco = { x: 0, z: 0, y: 0 };
  let papeles = new Map();
  let plano;
  let clavePlano;
  let activa;
  let raf = 0;
  let generacion = 0;
  let destino = { ...foco };

  function limpiar(objeto) {
    objeto.traverse((malla) => {
      if (!malla.isMesh) return;
      malla.geometry.dispose();
      malla.material.map?.dispose();
      malla.material.dispose();
    });
    objeto.removeFromParent();
  }

  function bloque(grupo, w, h, d, x, y, z, material, radio = .04) {
    const pieza = new T.Mesh(new RoundedBoxGeometry(w, h, d, 1, radio), material);
    pieza.position.set(x, y, z);
    pieza.receiveShadow = true;
    pieza.castShadow = true;
    grupo.add(pieza);
    return pieza;
  }

  function piel(papel, w, d, textura) {
    const pieza = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: textura, transparent: true }));
    pieza.rotation.x = -Math.PI / 2;
    pieza.position.y = COTA;
    papel.add(pieza);
    return pieza;
  }

  function lienzo(w, d) {
    const soporte = document.createElement('canvas');
    soporte.width = 640;
    soporte.height = Math.round(640 * d / w);
    return soporte;
  }

  function textura(soporte) {
    const mapa = new T.CanvasTexture(soporte);
    mapa.colorSpace = T.SRGBColorSpace;
    mapa.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return mapa;
  }

  function texturaPapel(papel, material = {}) {
    const canvas = lienzo(papel.w, papel.d);
    const ctx = canvas.getContext('2d');
    const { width: w, height: d } = canvas;
    ctx.fillStyle = papel.capa;
    ctx.fillRect(0, 0, w, d);
    ctx.strokeStyle = '#947ba653';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(19, 19, w - 38, d - 38);
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = contraste;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (papel.id === 'original' || papel.id === 'candidata') {
      ctx.fillStyle = '#e8dae6';
      ctx.fillRect(21, 21, w - 42, d - 83);
      const radio = Math.min(w, d) * .28;
      const cx = w / 2;
      const cz = (d - 60) / 2;
      for (const factor of [1, .87, .65]) {
        ctx.beginPath();
        ctx.ellipse(cx, cz, radio * factor, radio * factor, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 12, cz);
      ctx.lineTo(cx + 12, cz);
      ctx.moveTo(cx, cz - 12);
      ctx.lineTo(cx, cz + 12);
      ctx.stroke();
      ctx.fillStyle = contraste;
      ctx.fillText(papel.nombre.toUpperCase(), w / 2, d - 32);
    } else if (papel.id === 'referencia') {
      const muestras = ['#f4c9d9', '#ac8fba', '#674b7b', '#e2eead'];
      ctx.fillStyle = '#fff7ef';
      ctx.fillRect(w * .11, d * .12, w * .78, d * .58);
      ctx.strokeRect(w * .13, d * .14, w * .74, d * .54);
      ctx.beginPath();
      ctx.ellipse(w * .49, d * .45, w * .19, w * .14, -.25, 0, Math.PI * 2);
      ctx.stroke();
      muestras.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(w * (.13 + i * .19), d * .76, w * .16, d * .08);
      });
    } else {
      ctx.textAlign = 'left';
      ctx.font = carta;
      const encabezado = papel.id === 'elementos' ? 'Inventario de la toma' : papel.nombre;
      ctx.fillText(encabezado, w * .25, d * .13);
      ctx.font = '600 18px system-ui, sans-serif';
      for (let i = 0; i < 5; i++) {
        const z = d * (.23 + i * .137);
        ctx.beginPath();
        ctx.arc(w * .14, z, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(String(material.lineas?.[i] ?? '').slice(0, 36), w * .24, z, w * .64);
        ctx.beginPath();
        ctx.moveTo(w * .23, z + d * .036);
        ctx.lineTo(w * .90, z + d * .036);
        ctx.stroke();
      }
    }
    return canvas;
  }

  function intercambiarMapa(cara, mapa) {
    cara.material.map?.dispose();
    cara.material.map = mapa;
    cara.material.needsUpdate = true;
  }

  function actualizarMaterial({ papel, cara, clave }, material) {
    const nueva = JSON.stringify(material ?? {});
    if (nueva === clave) return;
    const nodo = papeles.get(papel.id);
    nodo.clave = nueva;
    const plantilla = texturaPapel(papel, material);
    intercambiarMapa(cara, textura(plantilla));
    if (!material?.url) return;
    const turno = generacion;
    cargador.load(material.url, (mapa) => {
      if (turno !== generacion || nodo.clave !== nueva) {
        mapa.dispose();
        return;
      }
      const ctx = plantilla.getContext('2d');
      const { width, height } = plantilla;
      const polaroid = papel.id === 'original' || papel.id === 'candidata';
      const zona = { w: width - 42, h: height - (polaroid ? 83 : 42) };
      const escala = Math.min(zona.w / mapa.image.width, zona.h / mapa.image.height);
      const w = Math.round(mapa.image.width * escala);
      const h = Math.round(mapa.image.height * escala);
      ctx.fillStyle = polaroid ? '#eee9ec' : papel.capa;
      ctx.fillRect(21, 21, zona.w, zona.h);
      ctx.drawImage(mapa.image, 21 + (zona.w - w) / 2, 21 + (zona.h - h) / 2, w, h);
      intercambiarMapa(cara, textura(plantilla));
      mapa.dispose();
      animar();
    }, undefined, () => {});
  }

  function tablero() {
    const w = plano.anchura - Math.min(1.35, plano.anchura * .12);
    const d = plano.altura - .35;
    bloque(puesto, w, .24, d, .01, -.066, .03, sombreado('#aa90b6'), .11);
    bloque(puesto, w - .18, .09, d - .16, 0, .028, 0, sombreado('#c5aed3'), .043);
    const canvas = lienzo(w - .23, d - .24);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d3c0df';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const n = ((x * 619 + y * 443 + x * y * 7) % 139) / 139;
        ctx.fillStyle = n > .57 ? `rgba(255,255,255,${n * .048})` : `rgba(85,54,106,${n * .075})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.strokeStyle = '#a989b8a0';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
    const superficie = new T.Mesh(new T.PlaneGeometry(w - .24, d - .23), new T.MeshStandardMaterial({ map: textura(canvas), roughness: .92 }));
    superficie.position.y = .074;
    superficie.rotation.x = -Math.PI / 2;
    superficie.receiveShadow = true;
    puesto.add(superficie);
  }

  function utillaje() {
    if (plano.compacto) return;
    const auxiliar = new T.Group();
    auxiliar.position.set(.04, .075, -2.26);
    auxiliar.rotation.y = -.55;
    puesto.add(auxiliar);
    bloque(auxiliar, .1, .13, 1.22, 0, .075, -.03, sombreado('#533a6e'));
    bloque(auxiliar, .115, .14, .23, 0, .075, .54, sombreado('#ddef9a'));
    const punta = new T.Mesh(new T.ConeGeometry(.066, .18, 14), sombreado('#3f3149'));
    punta.position.set(0, .075, -.71);
    punta.rotation.x = -Math.PI / 2;
    punta.castShadow = true;
    auxiliar.add(punta);
  }

  function reconstruir() {
    for (const hijo of [...puesto.children]) limpiar(hijo);
    generacion++;
    papeles = new Map();
    tablero();
    utillaje();
    for (const p of plano.papeles) {
      const grupo = new T.Group();
      grupo.position.set(p.x, .077, p.z);
      grupo.rotation.y = -p.giro * Math.PI / 180;
      puesto.add(grupo);
      const color = p.id === 'original' || p.id === 'candidata' ? '#aa88b7' : '#b695c1';
      bloque(grupo, p.w * 1.05, .052, p.d * 1.045, .035, .035, .05, sombreado(color));
      const cuerpo = bloque(grupo, p.w + .022, .085, p.d + .022, 0, .11, 0, sombreado(blanco), .024);
      cuerpo.userData.estacion = p.id;
      const cara = piel(grupo, p.w, p.d, textura(texturaPapel(p)));
      cara.userData.estacion = p.id;
      papeles.set(p.id, { papel: p, grupo, cuerpo, cara, clave: null });
    }
  }

  function animar() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    raf = 0;
    if (!plano) return;
    const suave = reduce.matches ? 1 : .16;
    let sigue = false;
    for (const eje of ['x', 'z', 'y']) {
      foco[eje] += (destino[eje] - foco[eje]) * suave;
      sigue ||= Math.abs(destino[eje] - foco[eje]) > .0008;
    }
    const { anchura, altura, compacto } = plano;
    Object.assign(camara, { left: -anchura / 2, right: anchura / 2, top: altura / 2, bottom: -altura / 2, zoom: 1 + foco.y });
    camara.position.set((compacto ? 0 : -.23) + foco.x, 16, 2 + foco.z);
    camara.lookAt(foco.x, 0, foco.z);
    camara.updateProjectionMatrix();
    for (const [id, nodo] of papeles) {
      const objetivo = id === activa ? .145 : .077;
      nodo.grupo.position.y += (objetivo - nodo.grupo.position.y) * suave;
      sigue ||= Math.abs(objetivo - nodo.grupo.position.y) > .0008;
    }
    renderer.render(escena, camara);
    alProyectar();
    if (sigue) animar();
  }

  return {
    actualizar(nuevoPlano, materiales, ancho, alto) {
      plano = nuevoPlano;
      const clave = `${ancho}×${alto}`;
      if (clave !== clavePlano) {
        clavePlano = clave;
        renderer.setSize(ancho, alto, false);
        reconstruir();
      }
      for (const [id, p] of papeles) actualizarMaterial(p, materiales[id]);
      animar();
    },
    seleccionar(id, mover) {
      activa = id;
      const papel = papeles.get(id)?.papel;
      destino = mover && papel && !plano.compacto ? { x: papel.x * .037, y: .017, z: papel.z * .03 } : { x: 0, y: 0, z: 0 };
      animar();
    },
    proyectar(x, z, id) {
      const y = (papeles.get(id)?.grupo.position.y ?? .077) + COTA;
      punto.set(x, y, z).project(camara);
      return [(punto.x + 1) * 50, (1 - punto.y) * 50];
    },
    tocar(x, y) {
      cursor.set(x * 2 - 1, 1 - y * 2);
      ray.setFromCamera(cursor, camara);
      return ray.intersectObjects([...papeles.values()].flatMap((p) => [p.cara, p.cuerpo]))[0]?.object.userData.estacion;
    },
  };
}
