import React, { useEffect, useRef, useState } from "react";
import type { Config } from "./public-showroom-types";
type Props = { config: Config; opened: boolean };
export default function PublicShowroom3D({ config, opened }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let renderer: any; let frame = 0; let disposed = false; let cleanup: (()=>void) | undefined;
    const node = host.current;
    if (!node) return;
    const start = async () => {
      try {
        const THREE = await import("three");
        if (disposed || !node) return;
        const scene = new THREE.Scene(); scene.background = new THREE.Color("#e9eef2");
        const camera = new THREE.PerspectiveCamera(34, node.clientWidth / Math.max(node.clientHeight,1), .1, 100);
        camera.position.set(4.4,3.0,6.4); camera.lookAt(0,1.15,0);
        renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"low-power"});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5)); renderer.setSize(node.clientWidth,node.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
        node.replaceChildren(renderer.domElement);
        scene.add(new THREE.HemisphereLight(0xffffff,0x647587,2.0));
        const key = new THREE.DirectionalLight(0xffffff,3.1); key.position.set(3,6,5); scene.add(key);
        const fill = new THREE.DirectionalLight(0x9dc9e8,1.3); fill.position.set(-4,2,-3); scene.add(fill);
        const group = new THREE.Group(); scene.add(group);
        const metalColor = config.color==="Branco"?"#e6ebef":config.color==="Bronze"?"#8b6545":config.color==="Anodizado"?"#aeb8c1":"#26313d";
        const glassColor = config.glass==="Fumê"?"#536879":config.glass==="Verde"?"#73978c":config.glass==="Reflecta"?"#8fa9b9":"#a9d6e8";
        const metal = new THREE.MeshStandardMaterial({color:metalColor,metalness:.82,roughness:.28});
        const pane = new THREE.MeshPhysicalMaterial({color:glassColor,metalness:.18,roughness:.12,transparent:true,opacity:.58,transmission:.28,thickness:.08,side:THREE.DoubleSide});
        const width = Math.max(1.5, Math.min(4.8, 3 * config.width / 1600)), height = Math.max(1.3, Math.min(4, 2.25 * config.height / 1200)), depth = .13;
        const bar = (x:number,y:number,z:number,w:number,h:number,d:number,mat:any) => { const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z); group.add(mesh); return mesh; };
        const roof = config.model==="Cobertura de Vidro";
        if (roof) {
          bar(0,2.0,0,width,.09,depth,metal); bar(0,2.0,-2.1,width,.09,depth,metal);
          for(let i=0;i<4;i++){bar(-1.45+i*.96,1.97,-1.05,.055,.06,2.1,metal); const p=bar(-.98+i*.96,1.94,-1.05,.88,.025,2.04,pane); p.rotation.x=-.08;}
          for(let i=0;i<3;i++) bar(-1.35+i*1.35,1,-2.08,.08,2,.08,metal);
        } else {
          bar(0,height/2,0,width,.11,depth,metal); bar(0,.055,0,width,.11,depth,metal);
          bar(-width/2,.0,0,.11,height,depth,metal); bar(width/2,.0,0,.11,height,depth,metal);
          bar(0,0,-.025,.055,height-.15,.1,metal);
          const pane1=bar(-.74,1.12,0,1.38,2.08,.035,pane);
          const pane2=bar(.74,1.12,0,1.38,2.08,.035,pane);
          bar(0,.08,.075,width-.2,.045,.07,metal);
          if(config.model==="Maxim-Ar"){pane1.rotation.z=opened ? -.18 : 0;pane2.rotation.z=opened ? .18 : 0;}
          if(config.model==="Porta Camarão"){pane1.rotation.y=opened ? -.65 : 0;pane2.rotation.y=opened ? .65 : 0;}
          if(config.model==="Porta Balcão"||config.model==="Janela de Correr"){pane1.position.x=opened?-width*.38:-width*.25;pane2.position.x=opened?width*.38:width*.25;}
          if(config.line==="Gold") bar(0,height-.23,.055,width-.2,.025,.045,metal);
        }
        const floorMat=new THREE.MeshStandardMaterial({color:"#d8e0e6",roughness:.9});
        const floor=new THREE.Mesh(new THREE.BoxGeometry(5,.06,3.5),floorMat);floor.position.set(0,-.09,-.4);group.add(floor);
        let dragging=false,lastX=0,lastY=0,rotY=-.12,rotX=0;
        const down=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);};
        const move=(e:PointerEvent)=>{if(!dragging)return;rotY+=(e.clientX-lastX)*.008;rotX=Math.max(-.5,Math.min(.5,rotX+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY;};
        const up=()=>{dragging=false;};
        renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",up);
        const resize=()=>{if(!node||!renderer)return;camera.aspect=node.clientWidth/Math.max(node.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(node.clientWidth,node.clientHeight);};
        const observer=new ResizeObserver(resize);observer.observe(node);
        const animate=()=>{if(disposed)return;frame=requestAnimationFrame(animate);if(!dragging)rotY+=.0012;group.rotation.y=rotY;group.rotation.x=rotX;renderer.render(scene,camera);};animate();
        cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);scene.traverse((o:any)=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose());else o.material?.dispose?.();});renderer.dispose();renderer.domElement.remove();};
      } catch { setFailed(true); }
    };
    start(); return ()=>{disposed=true;cleanup?.();};
  },[config.model,config.line,config.color,config.glass,config.width,config.height,opened]);
  return <div className="three-stage" ref={host} aria-label="Modelo paramétrico 3D de esquadria. Arraste para girar.">{failed&&<div className="webgl-message">Visualização 3D indisponível neste dispositivo. A prévia ilustrativa permanece disponível acima.</div>}</div>;
}
