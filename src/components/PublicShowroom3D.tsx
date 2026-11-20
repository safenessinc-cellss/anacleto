import React, { useEffect, useRef, useState } from "react";
import type { Config } from "./public-showroom-types";
type Props = { config: Config; opened: boolean };
const photoByModel:Record<string,string>={
 "Porta Balcão":"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=90",
 "Porta Camarão":"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1600&q=90",
 "Porta de Giro":"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1600&q=90",
 "Porta Pivotante":"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=90",
 "Maxim-Ar":"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=90",
 "Janela Basculante":"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=90",
 "Janela Oscilobatente":"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=90"
};
const colors:Record<string,string>={"Preto Fosco":"#25282c","Branco":"#edf0f2","Bronze":"#94704e","Anodizado":"#aeb8c1","Champagne":"#c6a77b","Natural Fosco":"#aeb6b9","Amadeirado":"#76543d","Grafite":"#454b52","Prata":"#c4c9ce","Verde Oliva":"#596653","Corten":"#8b4d36"};
const glassColors:Record<string,string>={"Incolor":"#b8deeb","Fumê":"#526577","Reflecta":"#c5a878"};
export default function PublicShowroom3D({config,opened}:Props){
 const host=useRef<HTMLDivElement>(null);
 const [failed,setFailed]=useState(false);
 const [exploded,setExploded]=useState(false);
 const [zoom,setZoom]=useState(1);
 const [showParts,setShowParts]=useState(true);
 useEffect(()=>{
  let renderer:any,raf=0,disposed=false,cleanup:(()=>void)|undefined;
  const node=host.current;if(!node)return;
  const start=async()=>{
   try{
    const THREE=await import("three");if(disposed)return;
    const scene=new THREE.Scene();scene.background=null;
    const camera=new THREE.PerspectiveCamera(32,node.clientWidth/Math.max(node.clientHeight,1),.1,100);
    camera.position.set(4.3/zoom,2.9/zoom,7.2/zoom);camera.lookAt(0,1.12,0);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(node.clientWidth,node.clientHeight);renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
    renderer.domElement.style.position="absolute";renderer.domElement.style.inset="0";renderer.domElement.style.zIndex="1";renderer.domElement.style.touchAction="pan-y";node.insertBefore(renderer.domElement,node.firstChild);
    scene.add(new THREE.HemisphereLight(0xffffff,0x65717b,2.5));
    const key=new THREE.DirectionalLight(0xffffff,4.2);key.position.set(3,7,5);scene.add(key);
    const rim=new THREE.DirectionalLight(0xb9d8e9,2.5);rim.position.set(-4,3,-4);scene.add(rim);
    const group=new THREE.Group();scene.add(group);
    const metal=new THREE.MeshStandardMaterial({color:colors[config.color]||"#25282c",metalness:.9,roughness:.2});
    const innerMetal=new THREE.MeshStandardMaterial({color:colors[config.color]||"#25282c",metalness:.78,roughness:.28});
    const pane=new THREE.MeshPhysicalMaterial({color:glassColors[config.glass]||"#b8deeb",metalness:.12,roughness:.075,transparent:true,opacity:.58,transmission:.42,thickness:.12,ior:1.48,side:THREE.DoubleSide});
    const dark=new THREE.MeshStandardMaterial({color:"#303b45",metalness:.55,roughness:.38});
    const rubber=new THREE.MeshStandardMaterial({color:"#202a32",roughness:.9});
    const chrome=new THREE.MeshStandardMaterial({color:"#d7e0e7",metalness:.96,roughness:.16});
    const width=Math.max(1.65,Math.min(4.6,3*config.width/1600)),height=Math.max(1.45,Math.min(3.8,2.25*config.height/1200));
    const makeBox=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,mat:any)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
    const frame=new THREE.Group();group.add(frame);
    const framePieces:any[]=[];
    const addFrame=(x:number,y:number,z:number,w:number,h:number,d:number,mat=metal)=>{const m=makeBox(frame,x,y,z,w,h,d,mat);framePieces.push(m);return m;};
    const t=.105,depth=.16;
    addFrame(0,height/2,0,width,t,depth);addFrame(0,-height/2,0,width,t,depth);
    addFrame(-width/2,0,0,t,height,depth);addFrame(width/2,0,0,t,height,depth);
    // Realistic double-track sill and head channels.
    addFrame(0,-height/2-.065,.07,width,.045,.27,innerMetal);
    addFrame(0,-height/2-.015,-.075,width,.035,.07,dark);
    addFrame(0,height/2+.04,.035,width,.045,.22,innerMetal);
    const count=Math.max(1,Math.min(6,config.panels||((config.model==="Porta Camarão")?3:2)));
    const leafWidth=(width-.22)/count;
    const leaves:any[]=[],leafRoots:any[]=[];
    const accessories:any[]=[];
    const isSliding=config.model==="Janela de Correr Suprema"||config.model==="Porta Balcão";
    const isFolding=config.model==="Porta Camarão";
    const isTilt=config.model==="Maxim-Ar"||config.model==="Janela Basculante";
    const isOscillo=config.model==="Janela Oscilobatente";
    const isHinged=config.model==="Porta de Giro"||config.model==="Porta Pivotante";
    for(let i=0;i<count;i++){
      const root=new THREE.Group();frame.add(root);root.position.set(-width/2+.055+i*leafWidth,0,.045);leafRoots.push(root);
      const leaf=new THREE.Group();root.add(leaf);leaves.push(leaf);
      const x=leafWidth/2;
      makeBox(leaf,x,height/2,0,.075,height-.15,.105,metal);
      makeBox(leaf,x,.045,0,leafWidth-.04,.085,.105,metal);
      makeBox(leaf,x,height-.045,0,leafWidth-.04,.085,.105,metal);
      makeBox(leaf,.045,height/2,0,.075,height-.15,.105,innerMetal);
      makeBox(leaf,leafWidth-.045,height/2,0,.075,height-.15,.105,innerMetal);
      makeBox(leaf,x,height/2,-.045,leafWidth-.19,height-.29,.025,pane);
      // Glazing beads and perimeter gaskets.
      for(const edge of [-1,1])makeBox(leaf,x+edge*(leafWidth/2-.11),height/2,.02,.012,height-.31,.018,rubber);
      makeBox(leaf,x,height/2,.035,leafWidth-.21,.012,.02,chrome);
      // Hardware: handle, lock body and roller wheels.
      if(i===0){
       const handleX=isHinged?leafWidth-.16:leafWidth-.17;
       makeBox(leaf,handleX,height*.52,.105,.035,.27,.045,chrome);
       makeBox(leaf,handleX,height*.52-.17,.11,.11,.075,.07,dark);
       for(const y of [.12,height-.12]){
        const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.035,24),chrome);wheel.rotation.z=Math.PI/2;wheel.position.set(x,y,.12);leaf.add(wheel);accessories.push(wheel);
       }
      }
      if(isHinged){
       for(const y of [.22,height/2,height-.22]){const hinge=makeBox(leaf,.04,y,.12,.07,.12,.08,chrome);accessories.push(hinge);}
       root.userData.hingePivot= i===0;
      }
      root.userData.index=i;root.userData.baseX=root.position.x;
      if(isSliding)root.userData.slide=(i%2===0?-1:1)*leafWidth*.42;
      if(isFolding)root.userData.fold=(i-(count-1)/2)*.72;
      if(isTilt)root.userData.tilt=-.48;
      if(isOscillo)root.userData.tilt=-.28;
      if(isHinged)root.userData.swing=(i===0?1:-1)*.9;
    }
    // Separate insect screen / accessory track, weather seals and fasteners.
    const explodedParts:any[]=[];
    const railTop=makeBox(group,0,height/2+.22,-.17,width,.035,.07,dark);
    const railBottom=makeBox(group,0,-height/2-.19,.18,width,.04,.12,innerMetal);
    explodedParts.push(railTop,railBottom);
    const sealTop=makeBox(group,0,height/2+.11,.12,width-.15,.018,.025,rubber);
    const sealBottom=makeBox(group,0,-height/2-.12,.12,width-.15,.018,.025,rubber);
    explodedParts.push(sealTop,sealBottom);
    // Visible screws along frame and fixing points.
    const screwMat=new THREE.MeshStandardMaterial({color:"#cbd5df",metalness:.95,roughness:.2});
    for(let i=0;i<8;i++){const screw=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.012,16),screwMat);screw.rotation.x=Math.PI/2;screw.position.set(-width/2+.18+i*(width-.36)/7,height/2-.01,.095);group.add(screw);explodedParts.push(screw);}
    // A small realistic floor shadow catcher.
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(3.4,48),new THREE.MeshBasicMaterial({color:"#101820",transparent:true,opacity:.12,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-height/2-.23;group.add(shadow);
    const baseFramePositions=framePieces.map(p=>p.position.clone());
    const basePartPositions=explodedParts.map(p=>p.position.clone());
    const baseRootPositions=leafRoots.map(p=>p.position.clone());
    let dragging=false,lastX=0,lastY=0,rotY=-.2,rotX=0,velocity=0,zoomLevel=zoom;
    const canvas=renderer.domElement;
    const wheel=(e:WheelEvent)=>{e.preventDefault();zoomLevel=Math.max(.68,Math.min(1.85,zoomLevel+(e.deltaY>0?-.07:.07)));camera.position.setLength(8/zoomLevel);};
    const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);};
    const move=(e:PointerEvent)=>{if(!dragging)return;const dx=e.clientX-lastX;rotY+=dx*.008;velocity=dx*.0008;rotX=Math.max(-.42,Math.min(.42,rotX+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY;};
    const up=()=>{dragging=false;};canvas.addEventListener("wheel",wheel,{passive:false});canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
    const ro=new ResizeObserver(()=>{camera.aspect=node.clientWidth/Math.max(node.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(node.clientWidth,node.clientHeight);});ro.observe(node);
    let openProgress=0,explodeProgress=0;
    const animate=()=>{if(disposed)return;raf=requestAnimationFrame(animate);if(!dragging){rotY+=velocity;velocity*=.94;if(Math.abs(velocity)<.0001)rotY+=.00055;}
      group.rotation.y=rotY;group.rotation.x=rotX;
      openProgress+=( (opened?1:0)-openProgress)*.07;explodeProgress+=((exploded?1:0)-explodeProgress)*.065;
      frame.position.z=-.13*explodeProgress;
      framePieces.forEach((p,i)=>{const side=i<4?((i%2===0)?1:-1):((i%2===0)?-1:1);p.position.z=(baseFramePositions[i]?.z||0)+side*.42*explodeProgress;});
      leafRoots.forEach((root,i)=>{const base=baseRootPositions[i];root.position.set(base.x,base.y,base.z+(i%2===0?1:-1)*.42*explodeProgress);const slide=root.userData.slide||0;const foldAngle=root.userData.fold||0;const swing=root.userData.swing||0;if(isSliding)root.position.x=base.x+slide*openProgress;else if(isFolding)root.rotation.y=foldAngle*openProgress;else if(isTilt)root.rotation.x=root.userData.tilt*openProgress;else if(isOscillo)root.rotation.x=root.userData.tilt*openProgress;else if(isHinged)root.rotation.y=swing*openProgress;});
      explodedParts.forEach((p,i)=>{const base=basePartPositions[i];p.position.set(base.x+(i%2?1:-1)*.26*explodeProgress,base.y+(i%3-1)*.18*explodeProgress,base.z+(i%2?1:-1)*.38*explodeProgress);});
      renderer.render(scene,camera);
    };animate();
    cleanup=()=>{cancelAnimationFrame(raf);ro.disconnect();canvas.removeEventListener("wheel",wheel);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);scene.traverse((o:any)=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose());else o.material?.dispose?.();});renderer.dispose();canvas.remove();};
   }catch(error){setFailed(true);}
  };
  start();return()=>{disposed=true;cleanup?.();};
 },[config.model,config.line,config.color,config.glass,config.width,config.height,config.panels,opened,exploded,zoom]);
 const image=photoByModel[config.model]||"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=90";
 const partLabels=["Marco estrutural","Folhas móveis","Vidro e baguetes","Roldanas e ferragens","Trilhos e guias","Borrachas de vedação"];
 return <div className="three-stage" ref={host} style={{position:"relative",touchAction:"pan-y",overflow:"hidden",backgroundImage:`linear-gradient(135deg,rgba(8,20,33,.18),rgba(8,20,33,.02)),url(${image})`,backgroundSize:"cover",backgroundPosition:"center"}} aria-label="Modelo 3D interativo de porta ou janela. Arraste para girar 360 graus.">
  <div className="three-controls" style={{position:"absolute",right:14,top:14,zIndex:5,display:"flex",gap:7,flexWrap:"wrap",justifyContent:"flex-end"}}>
   <button type="button" onClick={()=>setExploded(v=>!v)}>{exploded?"Recompor esquadria":"Explodir componentes"}</button>
   <button type="button" onClick={()=>setShowParts(v=>!v)}>{showParts?"Ocultar peças":"Ver componentes"}</button>
   <button type="button" onClick={()=>setZoom(v=>Math.min(1.85,v+.15))} aria-label="Aumentar zoom">＋</button>
   <button type="button" onClick={()=>setZoom(v=>Math.max(.68,v-.15))} aria-label="Diminuir zoom">－</button>
   <button type="button" onClick={()=>{setZoom(1);setExploded(false);}}>Reset</button>
  </div>
  {exploded&&showParts&&<div className="three-part-labels">{partLabels.map(label=><span key={label}>{label}</span>)}</div>}
  <div className="three-hint">Arraste para girar 360° · Role para zoom · Teste a abertura · Exploda para ver cada componente</div>
  {failed&&<div className="viewer-fallback"><span>Não foi possível carregar o 3D neste dispositivo. A fotografia de referência permanece disponível.</span></div>}
 </div>;
}