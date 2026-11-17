import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const vuelta = Math.PI * 2;
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const grupo = (padre, x = 0, y = 0, z = 0) => {
  const g = new T.Group();
  g.position.set(x, y, z);
  padre.add(g);
  return g;
};
const metal = (color, metalness, roughness, extra) => new T.MeshStandardMaterial({ color, metalness, roughness, ...extra });
function malla(padre, geometria, material, x, y, z) {
  const m = new T.Mesh(geometria, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  padre.add(m);
  return m;
}
function caja(p, w, h, d, mat, x, y, z, radio = .035) {
  return malla(p, new RoundedBoxGeometry(w, h, d, 2, Math.min(radio, w / 2, h / 2, d / 2)), mat, x, y, z);
}
function cilindro(p, r, largo, mat, x, y, z, eje = 'z', segmentos = 64) {
  const m = malla(p, new T.CylinderGeometry(r, r, largo, segmentos), mat, x, y, z);
  if (eje === 'z') m.rotation.x = Math.PI / 2;
  if (eje === 'x') m.rotation.z = Math.PI / 2;
  return m;
}
// Profiles are specified from the back towards the object-facing rim.
function aro(p, perfil, mat, z = 0) {
  const m = malla(p, new T.LatheGeometry(perfil.map(([r, profundidad]) => new T.Vector2(r, profundidad)), 128), mat, 0, 0, z);
  m.rotation.x = Math.PI / 2;
  return m;
}
function anillo(p, interior, exterior, z, fondo, mat, bisel = .015) {
  const b = Math.min(bisel, (exterior - interior) / 3, fondo / 3);
  return aro(p, [[interior,-fondo],[exterior-b,-fondo],[exterior,-fondo+b],[exterior,-b],[exterior-b,0],[interior+b,0],[interior,-b],[interior,-fondo]], mat, z);
}
function cable(p, puntos, radio, mat) {
  const curva = new T.CatmullRomCurve3(puntos.map(v => new T.Vector3(...v)));
  return malla(p, new T.TubeGeometry(curva, 40, radio, 8, false), mat, 0, 0, 0);
}
function mapa(w, h, pintar) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  pintar(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function entorno(renderer, escena) {
  const plató = new T.Scene();
  plató.background = new T.Color('#554e48');
  const luz = (ancho, alto, posicion, intensidad, color) => {
    const panel = new T.Mesh(new T.PlaneGeometry(ancho, alto), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(intensidad), side: T.DoubleSide }));
    panel.position.set(...posicion);
    panel.lookAt(0, 0, 0);
    plató.add(panel);
  };
  luz(4, 9, [-4, 5, 3], 6, '#ffeedb');
  luz(2, 11, [5, 1, -2], 4, '#ffffff');
  luz(1, 8, [1, 2, 5], 2.4, '#dae5eb');
  luz(8, 4, [0, 7, -2], 2, '#ffffff');
  const pmrem = new T.PMREMGenerator(renderer);
  const entorno = pmrem.fromScene(plató, .035, .1, 24);
  escena.environment = entorno.texture;
  escena.environmentIntensity = .82;
  pmrem.dispose();
  plató.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return entorno;
}

function satin() {
  const mapaGrano=mapa(256,256,(c,w,h)=>{
    const imagen=c.createImageData(w,h);
    let semilla=1907;
    const aleatorio=()=>{semilla=(Math.imul(1664525,semilla)+1013904223)>>>0;return semilla/4294967296;};
    for(let y=0;y<h;y++){
      const raya=244+aleatorio()*10;
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4;
        imagen.data.fill(raya+3*Math.sin(x*.05+y*.03)+aleatorio()*2,i,i+3);
        imagen.data[i+3]=255;
      }
    }
    c.putImageData(imagen,0,0);
  });
  mapaGrano.wrapS=mapaGrano.wrapT=T.RepeatWrapping;
  mapaGrano.repeat.set(1.4,2);
  return mapaGrano;
}

function cristalOptico() {
  const t = mapa(640, 640, (ctx,w,h) => {
    ctx.translate(w/2,h/2);
    const fondo=ctx.createRadialGradient(-30,42,0,0,0,w*.54);
    for(const [v,c] of [[0,'#171511'],[.20,'#231817'],[.37,'#52301e'],[.47,'#aa6330'],[.54,'#dab278'],[.58,'#735b3c'],[.64,'#344344'],[.79,'#151d1c'],[1,'#141717']]) fondo.addColorStop(v,c);
    ctx.fillStyle=fondo;ctx.fillRect(-w/2,-h/2,w,h);
    for(let i=0;i<18;i++){
      ctx.beginPath();ctx.ellipse(1,-1, w*(.19+i*.011), h*(.19+i*.011), -.72, 1.72, 3.71);
      ctx.strokeStyle='rgba(255,215,144,'+(.32-i*.012)+')';ctx.lineWidth=1+i*.15;ctx.stroke();
    }
    ctx.rotate(-.46);
    const reflejo=ctx.createLinearGradient(0,-100,0,-20);
    reflejo.addColorStop(0,'rgba(255,244,210,.64)');reflejo.addColorStop(1,'rgba(234,211,167,0)');
    ctx.fillStyle=reflejo;ctx.beginPath();ctx.ellipse(24,-79,66,10,0,0,vuelta);ctx.fill();
    ctx.fillStyle='rgba(255,243,213,.76)';ctx.beginPath();ctx.ellipse(-19,-68,17,2,0,0,vuelta);ctx.fill();
  });
  return new T.MeshPhysicalMaterial({map:t,metalness:.12,roughness:.31,clearcoat:.3,clearcoatRoughness:.2,envMapIntensity:.30});
}

function grabado(p, radio, z) {
  const t = mapa(1024,1024,(c,w) => {
    c.translate(w*.5,w*.5);
    const r=w*.465;
    for(let i=0;i<136;i++) {
      const a=i*vuelta/136, mayor=i%4===0;
      c.save();c.rotate(a);c.strokeStyle=mayor?'#181a19':'#59584e';
      c.lineWidth=mayor?2.1:1;c.beginPath();c.moveTo(0,-r);c.lineTo(0,-r+(mayor?12:5));c.stroke();c.restore();
    }
    function letraCurva(txt, angulo, paso, distancia, font) {
      c.font=font; c.textAlign='center'; c.textBaseline='middle';c.fillStyle='#252725';
      [...txt].forEach((s,i)=>{c.save();c.rotate(angulo+(i-(txt.length-1)/2)*paso);c.fillText(s,0,-distancia);c.restore();});
    }
    letraCurva('S O C I E T Y',-.46,.037,r-34,'bold 19px Arial');
    letraCurva('Ó P T I C A',.69,.028,r-31,'16px Arial');
    for(let i=0;i<8;i++) letraCurva(String(i*45),1.35+i*.53,.024,r-29,'15px monospace');
  });
  const g = malla(p, new T.PlaneGeometry(radio*2,radio*2),new T.MeshBasicMaterial({ map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1 }),0,0,z);
  g.castShadow=false;
}

function moleteado(p, n, r, z, profundidad, mat) {
  const geo=new T.BoxGeometry(.018,.028,profundidad);
  const piezas=new T.InstancedMesh(geo,mat,n);
  const ob=new T.Object3D();
  for(let i=0;i<n;i++) {
    const a=i*vuelta/n;
    ob.position.set(...polar(r,a),z); ob.rotation.z=a-Math.PI/2;ob.updateMatrix();piezas.setMatrixAt(i,ob.matrix);
  }
  p.add(piezas);
}

function cartucho(p, mat, sensor) {
  const portador=grupo(p);
  caja(portador,1.46,.12,.76,mat.cuerpo,0,.25,-.19);
  caja(portador,1.06,.13,.65,mat.niquel,0,.32,-.19);
  const bastidor=grupo(portador,0,1.46,0);
  for(const lado of [-1,1]) {
    caja(bastidor,.082,2.28,.13,mat.niquel,lado*.773,0,0,.025);
    caja(bastidor,1.61,.102,.13,mat.niquel,0,lado*1.09,0,.025);
    caja(bastidor,.037,2.04,.038,mat.cuerpo,lado*.708,0,.075,.007);
    for(const y of [-1.07,1.07]) cilindro(bastidor,.024,.013,mat.cuerpo,lado*.765,y,.071,'z',12);
  }
  caja(bastidor,.41,.11,.16,mat.cuerpo,0,1.16,-.015,.026);
  caja(bastidor,.17,.037,.014,mat.ambar,0,1.16,.07,.004);
  // The sliding jaws lock the negative into its upper and lower registration pins.
  for(const signo of [-1,1]) {
    caja(bastidor,.15,.29,.17,mat.cuerpo,signo*.77,-.84,.015,.024);
    cilindro(bastidor,.039,.028,mat.brillo,signo*.77,-.82,.111,'z',18);
  }
  const cristal=caja(bastidor,1.42,2.05,.035,mat.filtro,0,0,0,.012);
  cristal.castShadow=false;
  const marcas = mapa(256,360,(ctx,w,h) => {
    const luz=ctx.createLinearGradient(0,h,w,0);
    for(const [p,c] of [[0,0],[.26,0],[.29,.16],[.34,.13],[.37,0],[.65,0],[.69,.11],[.77,0],[1,0]]) luz.addColorStop(p,'rgba(255,250,231,'+c+')');
    ctx.fillStyle=luz;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#fff3cc91';ctx.lineWidth=1;
    for(const xx of [19,w-19]) for(const yy of [22,h-22]) {
      ctx.beginPath();ctx.moveTo(xx+(xx<w/2?14:-14),yy);ctx.lineTo(xx,yy);ctx.lineTo(xx,yy+(yy<h/2?14:-14));ctx.stroke();
    }
    ctx.beginPath();ctx.moveTo(w/2-5,h/2);ctx.lineTo(w/2+5,h/2);ctx.moveTo(w/2,h/2-5);ctx.lineTo(w/2,h/2+5);ctx.stroke();
  });
  const marcasCristal=malla(bastidor,new T.PlaneGeometry(1.39,1.99),new T.MeshBasicMaterial({map:marcas,transparent:true,depthWrite:false}),0,0,.023);
  marcasCristal.castShadow=false;
  const placa=malla(bastidor,new T.PlaneGeometry(1.37,1.93),sensor,0,0,.037);
  placa.castShadow=false; placa.receiveShadow=false;
  return { portador, placa, cristal };
}

export function montarOptica(escena) {
  const cepillado=satin();
  const mate=metal('#242623',.47,.38);
  const mat={
    cuerpo:mate, goma:metal('#20211e',.03,.69), niquel:metal('#bfc1bb',.88,.27,{map:cepillado}), brillo:metal('#d9dcda',.97,.19), laton:metal('#c8ad81',.88,.32,{map:cepillado}),
    canto:metal('#5e5141',.81,.28), ambar:metal('#e86523',.54,.32),
    filtro:new T.MeshPhysicalMaterial({ color:'#be8149', transparent:true, opacity:.37, roughness:.24,metalness:.46,side:T.DoubleSide,depthWrite:false }),
  };
  const mundo=grupo(escena);
  // Two ground rails share the same bearings as the optical housing and the moving slide.
  for(const z of [-.64,.27]) {
    caja(mundo,7.16,.12,.22,mat.cuerpo,.36,.12,z,.042);
    caja(mundo,7.08,.045,.115,mat.niquel,.36,.197,z,.012);
    for(const x of [-3.01,-1.95,1.66,3.72]) caja(mundo,.42,.095,.36,mat.goma,x,.05,z);
  }
  caja(mundo,6.99,.045,.47,mat.canto,.36,.08,-.18,.012);
  for (const x of [-3.15,3.87]) {
    caja(mundo,.12,.25,1.22,mat.cuerpo,x,.15,-.18);
    for(const z of [-.63,.27]) cilindro(mundo,.041,.015,mat.niquel,x,.283,z,'y',18);
  }
  const escala = mapa(1536,56,(c,w,h)=>{
    c.fillStyle='#a8a79d';c.fillRect(0,0,w,h);c.fillStyle='#242621';
    for(let i=0;i<186;i++) {
      const x=10+i*8.2;c.fillRect(x,0,i%10===0?2:1,i%10===0?29:i%5===0?20:12);
      if(i%10===0){c.font='15px monospace';c.fillText(String(i),x+3,47);}
    }
  });
  const regla=malla(mundo,new T.PlaneGeometry(6.9,.094),new T.MeshStandardMaterial({map:escala,metalness:.64,roughness:.46}),.35,.15,.385);
  regla.castShadow=false;
  const base=grupo(mundo,-.72);
  caja(base,2.73,.23,1.66,mat.goma,0,.32,-.38,.085);
  caja(base,2.71,.10,1.64,mat.niquel,0,.48,-.38,.05);
  caja(base,2.59,.23,1.54,mat.cuerpo,0,.59,-.38,.08);
  for(const x of [-1.07,1.07]) {
    caja(base,.30,.98,.83,mat.cuerpo,x,.98,-.48,.13);
    cilindro(base,.23,.14,mat.niquel,x*1.14,1.37,-.48,'x');
  }
  const placaID=mapa(640,68,(c,w,h)=>{
    c.fillStyle='#383a35';c.fillRect(0,0,w,h);
    c.fillStyle='#e7e6d9';c.font='bold 24px Arial';c.fillText('S O C I E T Y',26,43);
    c.fillStyle='#c4c3b4';c.font='20px monospace';c.fillText('ÓPTICA DE ESTUDIO',266,43);
    c.fillStyle='#dc985a';c.fillRect(224,15,3,37);
  });
  const placaNombre=malla(base,new T.PlaneGeometry(1.96,.15),new T.MeshStandardMaterial({map:placaID,roughness:.5,metalness:.24}),-.1,.603,.397);
  placaNombre.castShadow=false;
  for(const x of [-1.18,1.15]) cilindro(base,.03,.02,mat.niquel,x,.607,.400,'z',12);
  const optica=grupo(base,0,2.37,-.34);
  anillo(optica,.56,1.33,-.61,.49,mat.cuerpo,.08);
  anillo(optica,.56,1.43,-.52,.16,mat.niquel,.035);
  anillo(optica,.56,1.47,-.15,.40,mat.goma,.04);
  moleteado(optica,154,1.472,-.354,.30,mat.cuerpo);
  anillo(optica,.56,1.49,-.095,.057,mat.brillo);
  anillo(optica,.56,1.51,.13,.24,mat.cuerpo,.04);
  for(const z of [-.056,.006,.068]) anillo(optica,1.47,1.517,z,.023,mat.canto,.006);
  anillo(optica,1.17,1.535,.23,.12,mat.niquel,.035);
  anillo(optica,1.17,1.55,.275,.048,mat.brillo);
  anillo(optica,1.272,1.52,.382,.12,mat.laton,.038);
  grabado(optica,1.54,.384);
  anillo(optica,1.208,1.278,.39,.07,mat.cuerpo,.018);
  anillo(optica,1.19,1.223,.364,.055,mat.brillo,.01);
  for(let i=0;i<3;i++) anillo(optica,1.14-i*.036,1.20-i*.036,.324-i*.029,.055,mat.cuerpo,.009);
  const lente=malla(optica,new T.CircleGeometry(.83,96),cristalOptico(),0,0,.179);
  lente.castShadow=false;
  anillo(optica,.59,1.16,.201,.03,mat.goma,.006);
  const palas=grupo(optica,0,0,.215);
  const hojas=[];
  for(let i=0;i<10;i++){
    const a=i*vuelta/10;
    const pivote=.90;
    const soporte=grupo(palas,...polar(pivote,a),i*.0011);
    soporte.rotation.z=a;
    const paso=vuelta/10;
    const s=new T.Shape();
    const curva=(r,angulo)=>{const [x,y]=polar(r,angulo);return [x-pivote,y];};
    s.moveTo(...curva(1.14,-.27));
    s.bezierCurveTo(...curva(.98,-.19),...curva(.62,.21),...curva(.51,.65));
    s.lineTo(...curva(.51,.65+paso+.025));
    s.bezierCurveTo(...curva(.62,.21+paso+.025),...curva(.98,-.19+paso+.025),...curva(1.14,-.27+paso+.025));
    s.absarc(-pivote,0,1.14,-.27+paso+.025,-.27,true);
    const tono=['#7b8989','#6e7a79','#606c6b','#515f5e','#50605d','#5a6662','#687774','#73817f','#7e8880','#83908a'][i];
    const material=metal(tono,.53,.4,{map:cepillado});
    const geometria=new T.ExtrudeGeometry(s,{depth:.013,bevelEnabled:true,bevelThickness:.004,bevelSize:.006,bevelSegments:2,curveSegments:18});
    const vertices=geometria.attributes.position;
    for(let j=0;j<vertices.count;j++){
      const x=vertices.getX(j),y=vertices.getY(j);
      vertices.setZ(j,vertices.getZ(j)+.052*y*y+.020*x*y);
    }
    geometria.computeVertexNormals();
    const hoja=malla(soporte,geometria,material,0,0,0);
    hoja.castShadow=false;hojas.push(hoja);
    const [x,y]=polar(1.115,a+.032);
    cilindro(optica,.029,.015,mat.brillo,x,y,.301,'z',14);
  }
  // Hand wheel, its locking collar and the power lead terminate at the same foot.
  const rueda=grupo(base,1.33,1.25,-.44);rueda.rotation.y=Math.PI/2;
  cilindro(rueda,.22,.27,mat.canto,0,0,.035);
  cilindro(rueda,.32,.26,mat.cuerpo,0,0,.24);
  moleteado(rueda,54,.321,.238,.205,mat.goma);
  cilindro(rueda,.293,.038,mat.niquel,0,0,.386);
  cilindro(rueda,.22,.044,mat.cuerpo,0,0,.411);
  cable(base,[[-1.21,.65,-.83],[-1.58,.34,-1.19],[-2.25,.11,-1.12],[-2.38,.10,-.46],[-2.21,.20,-.38]],.038,mat.goma);
  const texturas=()=>new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true});
  const principal=cartucho(mundo,mat,texturas());
  const testigo=cartucho(mundo,mat,texturas());
  return { mundo, optica, hojas, principal, testigo };
}
