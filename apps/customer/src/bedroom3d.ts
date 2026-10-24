import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";

export interface BedroomScene {
 setLight(on:boolean):void;
 setView(view:number):void;
 setAtmosphere(brightness:number,mood:"rest"|"read"):void;
 dispose():void;
}

/** Local, invented room. No model download, device service or commerce API. */
export function mountBedroom(host:HTMLElement,onLost:()=>void,onPackage:()=>void):BedroomScene {
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});
 const canvas=renderer.domElement;
 const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[],textures:THREE.Texture[]=[],cleanups:Array<()=>void>=[];
 let disposed=false,frame=0;
 function dispose(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);cleanups.reverse().forEach(cleanup=>cleanup());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();}
 function fail(){if(disposed)return;dispose();onLost();}
 try{
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.25;
 canvas.setAttribute("aria-hidden","true");
 host.append(canvas);
 const scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-5,5,4,-4,.1,60);
 const target=new THREE.Vector3(0,.8,0);
 const hemi=new THREE.HemisphereLight(0xdce8ec,0x8b806e,1.15);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff1d8,2.4);sun.position.set(3.5,8,4);sun.castShadow=true;
 sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.03;scene.add(sun);
 const mat=(color:number,roughness=.8)=>{const m=new THREE.MeshStandardMaterial({color,roughness});materials.push(m);return m;};
 const cream=mat(0xe6decf),linen=mat(0xf2eee2),wood=mat(0x8d6245),oak=mat(0xbc956c),sage=mat(0x6e8778),dark=mat(0x354b40),brass=mat(0xa18a56,.4);
 const lampShade=mat(0xf1dec1),strip=mat(0xffe5af);
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number){geometries.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
 function box(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,round=0){return mesh(round?new RoundedBoxGeometry(w,h,d,2,round):new THREE.BoxGeometry(w,h,d),m,x,y,z);}
 function cylinder(top:number,bottom:number,h:number,m:THREE.Material,x:number,y:number,z:number){return mesh(new THREE.CylinderGeometry(top,bottom,h,20),m,x,y,z);}
 // Open-front diorama, with geometry deliberately kept small and self-authored.
 box(6.1,.24,5.5,wood,0,-.16,0,.06);
 for(let i=0;i<18;i++)box(.32,.045,5.3,i%3===0?oak:mat(i%2?0xb99a78:0xc0a181),-2.85+i*.335,-.015,0);
 box(6.1,2.95,.13,cream,0,1.45,-2.7);
 box(.13,2.95,5.5,cream,-3,1.45,0);
 box(6,.12,.1,oak,0,.09,-2.6);box(.1,.12,5.3,oak,-2.9,.09,0);
 // Window with a painted sky, mullions and fabric-like pleated curtains.
 box(.06,1.7,1.7,oak,-2.9,1.85,-.65);
 const glass=mat(0x91b7c0);glass.emissive.setHex(0x456f7e);glass.emissiveIntensity=.35;
 box(.07,1.52,1.5,glass,-2.85,1.85,-.65);
 box(.1,.055,1.6,linen,-2.79,1.85,-.65);box(.1,1.6,.055,linen,-2.79,1.85,-.65);
 cylinder(.025,.025,2.5,brass,-2.73,2.86,-.65).rotation.x=Math.PI/2;
 for(const end of [-1.83,.52])for(let i=0;i<5;i++)cylinder(.07,.085,2.28,linen,-2.7,1.65,end+i*.055);
 // Rug, low bed, headboard, pillows and a folded throw.
 box(3.5,.04,4.2,mat(0xd8cfbb),.2,.025,.2,.03);
 box(2.65,.3,3.55,oak,.1,.3,-.25,.06);
 box(2.5,.36,3.35,linen,.1,.62,-.25,.1);
 box(2.75,1.25,.15,wood,.1,.94,-2.04,.06);
 for(let i=0;i<15;i++)box(.12,1.1,.045,oak,-1.18+i*.18,.98,-1.94,.015);
 box(2.38,.15,2.35,sage,.1,.85,.3,.06);
 box(2.4,.06,.55,mat(0xa5b4a0),.1,.96,1.15,.025);
 for(const x of [-.55,.75]){const p=box(1.05,.22,.64,linen,x,.93,-1.3,.1);p.rotation.y=x<0?-.07:.06;}
 // Two side tables; the left lamp is the package hotspot.
 for(const x of [-1.95,2.0]){box(.75,.56,.72,wood,x,.31,-1.36,.045);box(.79,.06,.77,oak,x,.62,-1.36,.02);box(.62,.018,.015,brass,x,.36,-.988);}
 cylinder(.19,.22,.05,brass,-1.95,.69,-1.36);
 cylinder(.025,.025,.5,brass,-1.95,.95,-1.36);
 const lamp=mesh(new THREE.CylinderGeometry(.23,.39,.45,28),lampShade,-1.95,1.27,-1.36);lamp.userData.package=true;
 box(2.63,.045,.07,strip,.1,1.59,-1.94,.01);
 const lampLight=new THREE.PointLight(0xffbf6c,0,5,2);lampLight.position.set(-1.95,1.04,-1.3);scene.add(lampLight);
 const stripLight=new THREE.PointLight(0xffcf82,0,4,2);stripLight.position.set(.1,1.8,-1.6);scene.add(stripLight);
 // Warm pools use a local radial texture, avoiding a heavy postprocessing pass.
 const texCanvas=document.createElement("canvas");texCanvas.width=texCanvas.height=64;
 const ctx=texCanvas.getContext("2d")!;const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,"rgba(255,196,99,.8)");gradient.addColorStop(1,"rgba(255,196,99,0)");ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(texCanvas);textures.push(texture);
 const glowMat=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false});materials.push(glowMat);
 const glow=mesh(new THREE.PlaneGeometry(2.5,2.5),glowMat,-1.8,.06,-.7);glow.rotation.x=-Math.PI/2;glow.castShadow=false;
 // Framed abstract art, stacked books and a potted plant.
 box(.9,.85,.07,wood,1.9,2.03,-2.58,.02);box(.78,.73,.08,linen,1.9,2.03,-2.53);
 mesh(new THREE.CircleGeometry(.22,24),mat(0xb48058),1.92,2.1,-2.48);
 for(let i=0;i<3;i++)box(.44,.05,.3,[sage,linen,oak][i],2,.7+i*.055,-1.36);
 cylinder(.25,.2,.4,mat(0xc5a888),2.3,.25,1.65);
 cylinder(.025,.025,1.1,dark,2.3,.96,1.65);
 for(let i=0;i<7;i++){const a=i*2.4;const leaf=mesh(new THREE.SphereGeometry(1,10,8),sage,2.3+Math.sin(a)*.25,.8+i*.11,1.65+Math.cos(a)*.22);leaf.scale.set(.13,.34,.055);leaf.rotation.set(.3,a,-.65);}

 let level=0,toLevel=0,fromLevel=0,angle=.72,toAngle=.72,fromAngle=.72;
 let warmth=0,toWarmth=0,fromWarmth=0,brightness=.7,enabled=false;
 let lightStart=0,viewStart=0,lightMoving=false,viewMoving=false;
 const warmColor=new THREE.Color(0xffbf6c),readingColor=new THREE.Color(0xffe5bf),lightColor=new THREE.Color();
 const reduced=matchMedia("(prefers-reduced-motion: reduce)");
 const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;const half=4.45;camera.left=-half*width/height;camera.right=half*width/height;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);request();};
 function draw(time:number){frame=0;if(disposed||document.hidden)return;
  const eased=(start:number,duration:number)=>{const t=reduced.matches?1:Math.min(1,(time-start)/duration);return {t,e:1-Math.pow(1-t,3)}};
  if(lightMoving){const {t,e}=eased(lightStart,520);level=fromLevel+(toLevel-fromLevel)*e;warmth=fromWarmth+(toWarmth-fromWarmth)*e;lightMoving=t<1;}
  if(viewMoving){const {t,e}=eased(viewStart,650);angle=fromAngle+(toAngle-fromAngle)*e;viewMoving=t<1;}
  lightColor.copy(warmColor).lerp(readingColor,warmth);lampLight.color.copy(lightColor);stripLight.color.copy(lightColor);
  lampLight.intensity=level*16;stripLight.intensity=level*9;
  lampShade.emissive.copy(lightColor);lampShade.emissiveIntensity=level*.85;strip.emissive.copy(lightColor);strip.emissiveIntensity=level*2;glowMat.color.copy(lightColor);glowMat.opacity=level*.8;
  // The room remains legible while a lower ambient level makes the virtual light visible.
  sun.intensity=2.4-level*.8;hemi.intensity=1.15-level*.2;
  camera.position.set(Math.sin(angle)*10,7.4,Math.cos(angle)*10);camera.lookAt(target);try{renderer.render(scene,camera)}catch{fail();return}if(lightMoving||viewMoving)request();
 }
 function request(){if(!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
 function animateLight(){fromLevel=level;fromWarmth=warmth;lightStart=performance.now();lightMoving=true;request();}
 function visible(){if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else request();}
 function motionChanged(){if(reduced.matches){level=toLevel;warmth=toWarmth;angle=toAngle;lightMoving=viewMoving=false;}request();}
 const observer=new ResizeObserver(resize);cleanups.push(()=>observer.disconnect());observer.observe(host);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 function pick(event:PointerEvent){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);if(raycaster.intersectObjects(scene.children)[0]?.object===lamp)onPackage();}
 const lost=(e:Event)=>{e.preventDefault();fail();};
 cleanups.push(()=>{canvas.removeEventListener("pointerup",pick);canvas.removeEventListener("webglcontextlost",lost);document.removeEventListener("visibilitychange",visible);reduced.removeEventListener("change",motionChanged)});
 canvas.addEventListener("pointerup",pick);canvas.addEventListener("webglcontextlost",lost);
 document.addEventListener("visibilitychange",visible);reduced.addEventListener("change",motionChanged);resize();
 return {
  setLight(on){enabled=on;toLevel=on?brightness:0;animateLight();},
  setAtmosphere(value,mood){brightness=Math.min(1,Math.max(.1,value));toWarmth=mood==="read"?1:0;toLevel=enabled?brightness:0;animateLight();},
  setView(view){fromAngle=angle;toAngle=[.72,.28,1.12][view]??.72;viewStart=performance.now();viewMoving=true;request();},dispose
 };
 }catch(error){dispose();throw error;}
}
