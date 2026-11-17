import * as T from 'three';
import { AJUSTES, ANCHO, ALTO } from './plano.js';
import { entorno, montarOptica } from './optica.js';
import { montarSelectorDeOficio } from './agentes3d.js';

export function crearInstrumento(contenedor, alDibujar, alPerder) {
  const renderer = new T.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'low-power' });
  renderer.setClearColor(0,0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.55));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = T.VSMShadowMap;
  const lienzo = renderer.domElement;
  contenedor.append(lienzo);
  const escena = new T.Scene();
  const ambiente = entorno(renderer, escena);
  const mecanismo = montarOptica(escena);
  const selector = montarSelectorDeOficio(escena);
  const camara = new T.OrthographicCamera();
  const destino = new T.Vector3(.32,1.97,0);
  camara.position.copy(destino).add(new T.Vector3(4.1,2.25,10));
  camara.lookAt(destino);
  camara.near=.1;camara.far=45;
  const cajaLuz = new T.DirectionalLight('#fff5e5',2.5);
  cajaLuz.position.set(-3.5,7.2,4.9);
  cajaLuz.castShadow=true;
  cajaLuz.shadow.mapSize.set(512,512);
  cajaLuz.shadow.radius=5;
  cajaLuz.shadow.blurSamples=8;
  Object.assign(cajaLuz.shadow.camera,{left:-6,right:6,top:5,bottom:-5,near:.5,far:19});
  cajaLuz.shadow.normalBias=.014;
  cajaLuz.shadow.bias=-.0003;
  const reflejo=new T.DirectionalLight('#f0f6ff',1.5);
  reflejo.position.set(4,3,-4);
  escena.add(cajaLuz,reflejo,new T.HemisphereLight('#fff0da','#928373',.78));
  const suelo=new T.Mesh(new T.PlaneGeometry(40,28),new T.ShadowMaterial({color:'#4a3828',opacity:.19,depthWrite:false}));
  suelo.rotation.x=-Math.PI/2;suelo.receiveShadow=true;escena.add(suelo);
  const sombra=document.createElement('canvas');sombra.width=128;sombra.height=128;
  const lapiz=sombra.getContext('2d');
  const centro=lapiz.createRadialGradient(64,64,1,64,64,64);
  centro.addColorStop(0,'rgba(49,36,24,.70)');centro.addColorStop(.42,'rgba(55,42,33,.53)');centro.addColorStop(.78,'rgba(65,52,41,.16)');centro.addColorStop(1,'rgba(52,38,23,0)');
  lapiz.fillStyle=centro;lapiz.fillRect(0,0,128,128);
  for(const [x,z,w,h] of [[.10,-.26,8.96,2.95],[-.80,-.40,3.6,1.87],[2.1,-.22,2.92,1.4]]) {
    const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:new T.CanvasTexture(sombra),transparent:true,depthWrite:false,toneMapped:false}));
    m.rotation.x=-Math.PI/2;m.position.set(x,.013,z);escena.add(m);
  }
  const reduccion=matchMedia('(prefers-reduced-motion: reduce)');
  let estado=[...AJUSTES.original], origen=estado, objetivo=estado, inicio=0;
  let raf=0, ancho=0, alto=0, disponible=true, fase='original', visible=true;
  let oficio, oficioDesde = 0, ultimoDibujo = 0, reproyectar = true;
  function colocar() {
    const [x,giro,iris,extension]=estado;
    const m=mecanismo;
    m.principal.portador.position.set(x,0,.44);
    m.principal.portador.rotation.y=giro;
    m.testigo.portador.visible=extension>.002;
    m.testigo.portador.position.set(.99,.015,.48);
    m.testigo.portador.rotation.y=.10;
    m.testigo.portador.scale.set(1,Math.max(.002,extension),1);
    m.hojas.forEach(h => {h.rotation.z=iris;});
    for(const {placa} of [m.principal,m.testigo]) placa.visible=false;
  }
  function coordenadas(cartucho) {
    if (!cartucho.portador.visible) return null;
    const escala=Math.min(ancho/ANCHO,alto/ALTO);
    return [[-.685,.965],[.685,.965],[-.685,-.965]].map(([x,y])=>{
      const p=cartucho.placa.localToWorld(new T.Vector3(x,y,0)).project(camara);
      return [((p.x+1)*ancho/2-(ancho-ANCHO*escala)/2)/escala,((1-p.y)*alto/2-(alto-ALTO*escala)/2)/escala];
    });
  }
  function dibujar(ahora) {
    raf=0;
    if (!disponible || !ancho || !alto || !visible) return;
    const fraccion=inicio && !reduccion.matches ? Math.min(1,(ahora-inicio)/620) : 1;
    const animarOficio = oficio && !reduccion.matches;
    if (!inicio && !reproyectar && animarOficio && ahora - ultimoDibujo < 33) {
      programar();
      return;
    }
    ultimoDibujo = ahora;
    const t=1-(1-fraccion)**3;
    estado=objetivo.map((v,i)=>origen[i]+(v-origen[i])*t);
    colocar();
    selector.respirar(animarOficio ? ahora - oficioDesde : null);
    if (inicio || reproyectar) renderer.shadowMap.needsUpdate = true;
    renderer.render(escena,camara);
    if (inicio || reproyectar) {
      alDibujar([coordenadas(mecanismo.principal),coordenadas(mecanismo.testigo)]);
      reproyectar = false;
    }
    if(fraccion===1) inicio=0;
    if(inicio || animarOficio) programar();
  }
  function programar(){ if(!raf && disponible && visible && !document.hidden) raf=requestAnimationFrame(dibujar); }
  function activar(nombre) {
    if (oficio === nombre) return;
    oficio = nombre;
    oficioDesde = performance.now();
    selector.activar(nombre);
    programar();
  }
  function seleccionar(id,animar=true){
    const nuevo=AJUSTES[id] ? id : 'original';
    if(nuevo===fase && ancho) return;
    fase=nuevo;origen=[...estado];objetivo=AJUSTES[fase];inicio=animar?performance.now():0;
    reproyectar = true;
    programar();
  }
  function medir(w,h) {
    if(!w || !h || (w===ancho && h===alto)) return;
    ancho=w;alto=h;renderer.setSize(w,h,false);
    const altura=Math.max(4.92,4.92*ANCHO/ALTO/(w/h));
    camara.top=altura/2;camara.bottom=-camara.top;camara.right=altura*w/h/2;camara.left=-camara.right;
    camara.updateProjectionMatrix();
    reproyectar = true;
    programar();
  }
  function mostrar(activo){
    visible=activo;
    if(activo) programar();
    else {cancelAnimationFrame(raf);raf=0;}
  }
  function alRecuperarVista() {
    if (!document.hidden) programar();
  }
  document.addEventListener('visibilitychange', alRecuperarVista);
  reduccion.addEventListener('change', programar);
  lienzo.addEventListener('webglcontextlost',e=>{
    e.preventDefault();disponible=false;cancelAnimationFrame(raf);ambiente.dispose();
    document.removeEventListener('visibilitychange', alRecuperarVista);
    reduccion.removeEventListener('change', programar);
    alPerder();
  },{once:true});
  return { medir, seleccionar, mostrar, activar };
}
