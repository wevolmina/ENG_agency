import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";

export interface KitchenScene {setState(presence:boolean,door:boolean):void;setView(view:number):void;dispose():void}
/** Entirely local diorama. Sensor values are UI inputs, never device readings. */
export function mountKitchen(host:HTMLElement,onLost:()=>void):KitchenScene {
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"}),canvas=renderer.domElement;
 const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],cleanups:Array<()=>void>=[];
 let disposed=false,frame=0;
 function dispose(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);cleanups.reverse().forEach(f=>f());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove()}
 function fail(){if(disposed)return;dispose();onLost()}
 try{
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  canvas.setAttribute("aria-hidden","true");host.append(canvas);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-5,5,4,-4,.1,60),target=new THREE.Vector3(0,.9,0);
  const ambient=new THREE.HemisphereLight(0xe4f0f0,0x9a836c,1.3);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xfff4de,2.5);sun.position.set(4,8,5);sun.castShadow=true;sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.03;scene.add(sun);
  const mat=(color:number,roughness=.8)=>{const m=new THREE.MeshStandardMaterial({color,roughness});materials.push(m);return m};
  const cream=mat(0xe9e1d0),wood=mat(0xb38c62),sage=mat(0x778d76),white=mat(0xf2f0e5),metal=mat(0x87999a,.3),dark=mat(0x394b42),glass=mat(0x96bcc0);
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=scene){geometries.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o}
  function box(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,round=.015,parent:THREE.Object3D=scene){return mesh(new RoundedBoxGeometry(w,h,d,2,round),m,x,y,z,parent)}
  function cyl(r:number,h:number,m:THREE.Material,x:number,y:number,z:number){return mesh(new THREE.CylinderGeometry(r,r,h,20),m,x,y,z)}
  box(6,.2,5,wood,0,-.13,0);box(6,3,.12,cream,0,1.4,-2.45);box(.12,3,5,cream,-2.95,1.4,0);
  for(let i=0;i<12;i++)box(.47,.025,4.9,i%2?wood:mat(0xc7a37c),-2.7+i*.49,-.01,0);
  // Window and a tiled backsplash behind an L-shaped worktop.
  box(.08,1.55,1.65,wood,-2.85,1.85,-.4);box(.09,1.4,1.5,glass,-2.79,1.85,-.4);box(.1,.05,1.5,white,-2.73,1.85,-.4);box(.1,1.4,.05,white,-2.73,1.85,-.4);
  for(let i=0;i<13;i++)for(let j=0;j<3;j++)box(.39,.23,.035,white,-2.5+i*.405,1.25+j*.25,-2.34,.01);
  box(5.25,.9,.92,sage,0,.47,-1.85);box(5.4,.1,1.05,white,0,.99,-1.8);
  box(1.1,.9,2.2,sage,-2.05,.47,-.35);box(1.2,.1,2.3,white,-2.05,.99,-.35);
  for(const x of [-2,-1,0,1,2]){box(.94,.76,.04,sage,x,.48,-1.36);box(.3,.025,.04,metal,x,.76,-1.32)}
  box(1.2,.04,.65,metal,-1.45,1.06,-1.8);box(.93,.045,.45,dark,-1.45,1.09,-1.8);cyl(.025,.35,metal,-1.45,1.26,-2.03);box(.35,.03,.04,metal,-1.3,1.43,-2.03);
  box(1.1,.04,.65,dark,1.3,1.07,-1.8);for(const x of [1.02,1.58])for(const z of [-1.6,-1.98])cyl(.12,.025,metal,x,1.1,z);
  const pot=mat(0xc9b28b);cyl(.22,.24,pot,1.04,1.22,-1.64);box(.55,.035,.03,dark,1.25,1.3,-1.64);
  // Open cabinet door rotates around its own hinge, with the sensor beside it.
  box(2,.8,.48,wood,.1,2.05,-2.12);box(.88,.68,.04,sage,-.4,2.05,-1.84);
  const hinge=new THREE.Group();hinge.position.set(.2,2.05,-1.81);scene.add(hinge);box(.88,.68,.055,sage,.44,0,0,.02,hinge);box(.03,.2,.04,metal,.77,0,.05,.01,hinge);
  const contact=mat(0xc0c7af),presenceLed=mat(0xc0c7af);box(.12,.16,.08,contact,1.1,2.24,-1.8);box(.2,.2,.1,presenceLed,-1.27,2.3,-2.27);mesh(new THREE.SphereGeometry(.055,12,8),white,-1.27,2.3,-2.19);
  const strip=mat(0xffedb7);box(2,.035,.04,strip,.1,1.64,-1.85);const task=new THREE.PointLight(0xffd597,0,4,2);task.position.set(.1,1.6,-1.5);scene.add(task);
  // Island, stools, cups and herbs make the room readable on a narrow screen.
  box(2.3,.9,.95,wood,.55,.48,.75);box(2.5,.1,1.1,white,.55,1.01,.75);
  for(const x of [-.1,1.2]){cyl(.27,.1,sage,x,.63,1.65);for(const dx of [-.15,.15])box(.055,.55,.055,dark,x+dx,.3,1.65)}
  cyl(.12,.17,cream,.7,1.16,.7);cyl(.16,.22,pot,-2.1,1.16,.3);
  for(let i=0;i<5;i++){const leaf=mesh(new THREE.SphereGeometry(1,8,6),sage,-2.1+Math.sin(i*2)*.12,1.4+i*.035,.3+Math.cos(i*2)*.1);leaf.scale.set(.13,.2,.035);leaf.rotation.z=i*.5}
  const person=new THREE.Group();person.position.set(.8,0,-.45);scene.add(person);box(.42,.65,.25,mat(0xb38b69),0,.8,0,.08,person);mesh(new THREE.SphereGeometry(.2,16,12),mat(0xd2b59b),0,1.34,0,person);box(.12,.47,.13,dark,-.12,.25,0,.02,person);box(.12,.47,.13,dark,.12,.25,0,.02,person);person.visible=false;
  let presence=false,door=false,level=0,fromLevel=0,doorAngle=0,fromDoor=0,angle=.72,fromAngle=.72,toAngle=.72,start=0,viewStart=0,moving=false,viewMoving=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;const half=4.35;camera.left=-half*width/height;camera.right=half*width/height;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);request()};
  function draw(time:number){frame=0;if(disposed||document.hidden)return;
   const t=reduced.matches?1:Math.min(1,(time-start)/520),e=1-Math.pow(1-t,3);if(moving){level=fromLevel+((presence||door?1:0)-fromLevel)*e;doorAngle=fromDoor+((door?1.12:0)-fromDoor)*e;moving=t<1}
   const v=reduced.matches?1:Math.min(1,(time-viewStart)/650);if(viewMoving){angle=fromAngle+(toAngle-fromAngle)*(1-Math.pow(1-v,3));viewMoving=v<1}
   person.visible=presence;hinge.rotation.y=doorAngle;contact.emissive.setHex(door?0x6ca877:0);contact.emissiveIntensity=door?.5:0;presenceLed.emissive.setHex(presence?0x6ca877:0);presenceLed.emissiveIntensity=presence?.5:0;strip.emissive.setHex(0xffd597);strip.emissiveIntensity=level*2;task.intensity=level*12;
   camera.position.set(Math.sin(angle)*10,7.2,Math.cos(angle)*10);camera.lookAt(target);try{renderer.render(scene,camera)}catch{fail();return}if(moving||viewMoving)request()
  }
  function request(){if(!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(draw)}
  const visibility=()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0}else request()};const lost=(e:Event)=>{e.preventDefault();fail()};const motion=()=>request();
  const observer=new ResizeObserver(resize);cleanups.push(()=>observer.disconnect());observer.observe(host);canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);cleanups.push(()=>{canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion)});resize();
  return {setState(p,d){presence=p;door=d;fromLevel=level;fromDoor=doorAngle;start=performance.now();moving=true;request()},setView(v){fromAngle=angle;toAngle=[.72,.28,1.12][v]??.72;viewStart=performance.now();viewMoving=true;request()},dispose};
 }catch(e){dispose();throw e}
}
