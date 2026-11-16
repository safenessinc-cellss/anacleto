import React, { useEffect, useRef, useState } from "react";
import "./public-assembly-intro.css";

type Props = { onComplete: () => void; onSkip: () => void };
export default function PublicAssemblyIntro({onComplete,onSkip}:Props) {
 const host=useRef<HTMLDivElement>(null);const [progress,setProgress]=useState(0);const [phase,setPhase]=useState("PERFIS DE ALUMÍNIO");
 useEffect(()=>{let disposed=false,raf=0,cleanup:(()=>void)|undefined;const node=host.current;if(!node)return;
 const start=async()=>{try{const THREE=await import("three");if(disposed)return;
 const scene=new THREE.Scene();scene.background=new THREE.Color("#0e1013");
 const camera=new THREE.PerspectiveCamera(35,node.clientWidth/Math.max(1,node.clientHeight),.1,100);camera.position.set(4.8,3.2,8.5);camera.lookAt(0,1.25,0);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(node.clientWidth,node.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;node.replaceChildren(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xdceaff,0x26313a,1.35));const key=new THREE.DirectionalLight(0xffffff,4.4);key.position.set(3,7,5);scene.add(key);const rim=new THREE.DirectionalLight(0x8fbde0,3);rim.position.set(-5,3,-4);scene.add(rim);const fill=new THREE.PointLight(0xd5e9ff,35,10);fill.position.set(0,3,3);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:"#15191e",roughness:.42,metalness:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.12;scene.add(floor);
 const assembly=new THREE.Group();scene.add(assembly);
 const alloy=new THREE.MeshStandardMaterial({color:"#aeb8c1",metalness:.92,roughness:.23});const darkAlloy=new THREE.MeshStandardMaterial({color:"#30373e",metalness:.88,roughness:.28});const sealMat=new THREE.MeshStandardMaterial({color:"#101317",roughness:.85});const glassMat=new THREE.MeshPhysicalMaterial({color:"#b8d9e8",metalness:.12,roughness:.08,transparent:true,opacity:.32,transmission:.65,thickness:.12,ior:1.48,side:THREE.DoubleSide});
 const make=(w:number,h:number,d:number,mat:any,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);assembly.add(mesh);return mesh;};
 const W=3.25,H=2.35,D=.16,T=.095;
 const profiles=[
  make(W,T,D,alloy,0,H/2,0),make(W,T,D,alloy,0,-H/2,0),
  make(T,H,D,alloy,-W/2,0,0),make(T,H,D,alloy,W/2,0,0)
 ];
 const leafW=(W-T*2)/2;
 const leaves=[new THREE.Group(),new THREE.Group()];leaves.forEach((leaf,i)=>{assembly.add(leaf);leaf.position.set((i===0?-1:1)*leafW/2,0,.035);const bar=(x:number,y:number,w:number,h:number,d:number,mat:any)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,0);leaf.add(m);return m;};bar(0,0,T,H-.18,.12,alloy);bar(0,H/2-.04,leafW-.05,T,.12,alloy);bar(0,-H/2+.04,leafW-.05,T,.12,alloy);});
 const panes=[make(leafW-.17,H-.18,.028,glassMat,-leafW/2,0,.005),make(leafW-.17,H-.18,.028,glassMat,leafW/2,0,.005)];
 const seals=[make(W-.1,.018,.11,sealMat,0,H/2-.13,.03),make(W-.1,.018,.11,sealMat,0,-H/2+.13,.03)];
 const paneTrim=[make(.018,H-.2,.1,darkAlloy,-.03,0,.12),make(.018,H-.2,.1,darkAlloy,.03,0,.12)];
 const handle=make(.045,.28,.065,alloy,leafW/2-.13,.02,.13);const lock=make(.08,.07,.08,darkAlloy,leafW/2-.13,-.17,.13);
 const pieces=[...profiles,...seals,...paneTrim,...leaves,...panes,handle,lock];const targets=pieces.map(p=>p.position.clone());
 profiles.forEach((p,i)=>{p.position.add(new THREE.Vector3(i%2===0?0:(i===2?-3:3),i<2?(i===0?3:-3):0,2));});
 seals.forEach((p,i)=>p.position.add(new THREE.Vector3(i===0?0:0,i===0?2:-2,-1)));
 paneTrim.forEach((p,i)=>p.position.add(new THREE.Vector3(i===0?-2:2,0,1)));
 leaves.forEach((p,i)=>{p.position.x+=(i===0?-2.6:2.6);p.position.z+=1.5;});\n panes.forEach((p,i)=>p.position.add(new THREE.Vector3(i===0?-1.3:1.3,0,1.5)));
 handle.position.add(new THREE.Vector3(1.4,1.5,1));lock.position.add(new THREE.Vector3(1.4,-1,1));
 const startTime=performance.now();let completed=false;
 const resize=()=>{camera.aspect=node.clientWidth/Math.max(1,node.clientHeight);camera.updateProjectionMatrix();renderer.setSize(node.clientWidth,node.clientHeight);};const ro=new ResizeObserver(resize);ro.observe(node);
 const smooth=(v:number)=>{const x=Math.max(0,Math.min(1,v));return x*x*(3-2*x);};
 const animate=(now:number)=>{if(disposed)return;raf=requestAnimationFrame(animate);const elapsed=now-startTime;const p=Math.min(1,elapsed/3500);setProgress(Math.round(p*100));setPhase(p<.3?"PERFIS DE ALUMÍNIO":p<.6?"FOLHAS E VEDAÇÃO":p<.85?"VIDRO TEMPERADO E FERRAGENS":"ACABAMENTO / SHOWROOM");
  pieces.forEach((piece,i)=>{let gate=0;if(i<4)gate=smooth(p/.3);else if(i<6)gate=smooth((p-.3)/.3);else if(i<8)gate=smooth((p-.3)/.3);else if(i<10)gate=smooth((p-.3)/.3);else if(i<12)gate=smooth((p-.6)/.25);else gate=smooth((p-.72)/.13);piece.position.lerpVectors(piece.userData.start||piece.position,targets[i],gate);});
  if(p>=.3){leaves[0].position.x=THREE.MathUtils.lerp(-leafW/2-2.6,-leafW/2,.75*smooth((p-.3)/.3));leaves[1].position.x=THREE.MathUtils.lerp(leafW/2+2.6,leafW/2,.75*smooth((p-.3)/.3));}
  const dolly=smooth((p-.85)/.15);camera.position.set(4.8-1.15*dolly,3.2-.25*dolly,8.5-2.4*dolly);camera.lookAt(0,1.25,0);assembly.rotation.y=.08*Math.sin(p*Math.PI*2)*(1-dolly);assembly.scale.setScalar(1+.025*dolly);
  fill.intensity=35+45*smooth((p-.85)/.15);renderer.render(scene,camera);
  if(p>=1&&!completed){completed=true;window.setTimeout(()=>{if(!disposed)onComplete();},90);}
 };
 pieces.forEach((p)=>{p.userData.start=p.position.clone();});
 raf=requestAnimationFrame(animate);
 cleanup=()=>{cancelAnimationFrame(raf);ro.disconnect();scene.traverse((o:any)=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose());else o.material?.dispose?.();});renderer.dispose();};
 }catch{setProgress(100);setPhase("PRONTO PARA EXPLORAR");window.setTimeout(()=>{if(!disposed)onComplete();},3500);}};
 start();return()=>{disposed=true;cleanup?.();};
 },[onComplete]);
 return <section className="assembly-intro" aria-label="Montagem 3D de uma esquadria de alumínio"><div className="assembly-top"><span>ANACLETO / ENGENHARIA EM MOVIMENTO</span><span>ESTÚDIO 3D · {String(progress).padStart(2,"0")}%</span></div><div className="assembly-copy"><span>UMA PEÇA. MILÍMETRO POR MILÍMETRO.</span><h1>PRECISÃO QUE<br/><em>GANHA FORMA.</em></h1><p>Perfis. Vedação. Vidro. Ferragens.</p></div><div className="assembly-stage" ref={host}><div className="assembly-fallback" aria-hidden="true"><svg viewBox="0 0 640 440"><defs><linearGradient id="introMetal"><stop stopColor="#515b65"/><stop offset=".45" stopColor="#d2dce3"/><stop offset="1" stopColor="#606a74"/></linearGradient><linearGradient id="introGlass"><stop stopColor="#9bc8df" stopOpacity=".65"/><stop offset="1" stopColor="#dcecf5" stopOpacity=".2"/></linearGradient></defs><path d="M115 70h410v300H115z" fill="none" stroke="url(#introMetal)" strokeWidth="15"/><path d="M130 85h190v270H130zM320 85h190v270H320z" fill="url(#introGlass)" stroke="#b8c7d1" strokeWidth="8"/><path d="M320 85v270" stroke="#7b8994" strokeWidth="9"/></svg></div></div><div className="assembly-bottom"><div className="assembly-status"><div><span>ETAPA {progress<30?"01":progress<60?"02":progress<85?"03":"04"}/04</span><strong>{phase}</strong></div><div className="assembly-progress"><i style={{width:`${progress}%`}}/></div></div><button className="assembly-skip" onClick={onSkip}>Pular introdução <span>→</span></button></div></section>;
}
