import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { TechnicalDrawing } from "../../types";
import { fitDrawingToViewport } from "../../utils/drawingViewport";

type Props = { drawing: TechnicalDrawing };
type VisualElement = Record<string, any>;

const finite = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const safeColor = (value: unknown, fallback: string) => {
  const color = String(value || "");
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
};

export default function DrawingThreePreview({ drawing }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [usingSvgFallback, setUsingSvgFallback] = useState(true);
  const visualElements = (drawing as any).visualElements as VisualElement[] | undefined;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const probe = document.createElement("canvas");
    let probeContext: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      probeContext = probe.getContext("webgl2") || probe.getContext("webgl");
    } catch (error) {
      console.warn("WebGL probe failed; using the vector 3D preview:", error);
    }
    if (!probeContext) {
      setFailed(true);
      setUsingSvgFallback(true);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#090d16");
      const widthMm = Math.max(1, finite(drawing.overallDimensions?.width, 1000) * (drawing.unit === "cm" ? 10 : 1));
      const heightMm = Math.max(1, finite(drawing.overallDimensions?.height, 1000) * (drawing.unit === "cm" ? 10 : 1));
      const depthMm = Math.max(12, finite(drawing.overallDimensions?.depth, 60) * (drawing.unit === "cm" ? 10 : 1));
      const width = widthMm / 1000, height = heightMm / 1000, depth = Math.min(0.35, Math.max(0.012, depthMm / 1000));
      const center = new THREE.Vector3(width / 2, height / 2, 0);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
      camera.lookAt(center);
      renderer = new THREE.WebGLRenderer({ canvas: probe, context: probeContext, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setSize(host.clientWidth, host.clientHeight);
      host.replaceChildren(renderer.domElement);
      const ambient = new THREE.HemisphereLight(0xffffff, 0x475569, 2.0);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(width * 2, height * 2, depth * 5 + 2);
      scene.add(key);
      const grid = new THREE.GridHelper(Math.max(width, height) * 2.5, 20, 0x334155, 0x1e293b);
      grid.position.set(center.x, 0, 0);
      scene.add(grid);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(center);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = Math.max(0.4, Math.max(width, height) * 0.65);
      controls.maxDistance = Math.max(8, Math.max(width, height) * 8);
      const materials = new Map<string, THREE.MeshStandardMaterial>();
      const materialFor = (color: string, glass = false) => {
        const key = color + (glass ? ":glass" : "");
        let material = materials.get(key);
        if (!material) {
          material = new THREE.MeshStandardMaterial({
            color, metalness: glass ? 0.08 : 0.72, roughness: glass ? 0.12 : 0.34,
            transparent: glass, opacity: glass ? 0.28 : 1, side: THREE.DoubleSide,
          });
          materials.set(key, material);
        }
        return material;
      };
      const sx = width / 1000, sy = height / 1000;
      for (const element of visualElements.slice(0, 300)) {
        const type = String(element?.type || "").toLowerCase();
        if (type === "text") continue;
        const fill = safeColor(element.fill, type === "rect" ? "#94a3b8" : "#cbd5e1");
        const stroke = safeColor(element.stroke, "#e2e8f0");
        const glass = /vidro|glass/i.test(String(element.label || element.material || ""));
        if (type === "rect") {
          const w = Math.max(0.001, finite(element.width) * sx);
          const h = Math.max(0.001, finite(element.height) * sy);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), materialFor(glass ? "#93c5fd" : fill, glass));
          mesh.position.set(finite(element.x) * sx + w / 2, height - finite(element.y) * sy - h / 2, 0);
          scene.add(mesh);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: stroke }));
          edges.position.copy(mesh.position);
          scene.add(edges);
        } else if (type === "line") {
          const x1 = finite(element.x1) * sx, x2 = finite(element.x2) * sx;
          const y1 = height - finite(element.y1) * sy, y2 = height - finite(element.y2) * sy;
          const dx = x2 - x1, dy = y2 - y1, length = Math.max(0.001, Math.hypot(dx, dy));
          const thickness = Math.max(0.003, finite(element.strokeWidth, 3) * Math.min(sx, sy) * 2.2);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, Math.max(depth * 0.22, 0.004)), materialFor(stroke));
          mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, depth * 0.08);
          mesh.rotation.z = Math.atan2(dy, dx);
          scene.add(mesh);
        } else if (type === "circle") {
          const radius = Math.max(0.002, finite(element.r, 8) * Math.min(sx, sy));
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(0.004, depth * 0.2), 24), materialFor(fill));
          mesh.rotation.x = Math.PI / 2;
          mesh.position.set(finite(element.cx) * sx, height - finite(element.cy) * sy, 0);
          scene.add(mesh);
        } else if (type === "polygon" && Array.isArray(element.points) && element.points.length >= 3) {
          const shape = new THREE.Shape();
          element.points.slice(0, 100).forEach((point: any, index: number) => {
            const px = finite(point.x) * sx, py = height - finite(point.y) * sy;
            if (index === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
          });
          shape.closePath();
          const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
          const mesh = new THREE.Mesh(geometry, materialFor(fill, glass));
          mesh.position.z = -depth / 2;
          scene.add(mesh);
        }
      }
      const resize = () => {
        if (!host || !renderer) return;
        const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
        camera.aspect = w / h;
        const fit = fitDrawingToViewport(widthMm, heightMm, w, h, 48);
        const viewHeight = h / fit.scale / 1000;
        const viewWidth = w / fit.scale / 1000;
        const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
        const distance = Math.max(
          viewHeight / (2 * Math.tan(halfFov)),
          viewWidth / (2 * Math.tan(halfFov) * camera.aspect),
        ) * 1.2;
        camera.position.set(center.x + distance * 0.18, center.y + distance * 0.14, distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
      setFailed(false);
      setUsingSvgFallback(false);
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        scene.traverse(object => {
          if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
            object.geometry.dispose();
            const mat = object.material;
            if (Array.isArray(mat)) mat.forEach(m => m.dispose()); else mat.dispose();
          }
        });
        materials.forEach(material => material.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch (error) {
      console.error("3D preview could not initialize:", error);
      setFailed(true);
      setUsingSvgFallback(true);
    }
  }, [drawing.id, drawing.unit, drawing.overallDimensions?.width, drawing.overallDimensions?.height, drawing.overallDimensions?.depth, visualElements]);

  const widthMm = Math.max(1, finite(drawing.overallDimensions?.width, 1000) * (drawing.unit === "cm" ? 10 : 1));
  const heightMm = Math.max(1, finite(drawing.overallDimensions?.height, 1000) * (drawing.unit === "cm" ? 10 : 1));
  const depthMm = Math.max(12, finite(drawing.overallDimensions?.depth, 60) * (drawing.unit === "cm" ? 10 : 1));
  const fit = fitDrawingToViewport(widthMm, heightMm, 400, 240, 0);
  const frontX = 200 + (400 - fit.width) / 2;
  const frontY = 100 + (240 - fit.height) / 2;
  const frameWidth = fit.width;
  const frameHeight = fit.height;
  const depthX = 58;
  const depthY = -36;
  const inset = Math.min(14, Math.max(7, Math.min(frameWidth, frameHeight) * 0.06));
  const leaves = Math.max(1, Math.min(8, Math.floor(finite(drawing.parametricSpec?.folhas, 2))));
  const glassColor = drawing.parametricSpec?.cor_vidro === "bronze" ? "#b45309"
    : drawing.parametricSpec?.cor_vidro === "verde" ? "#16a34a"
      : drawing.parametricSpec?.cor_vidro === "fumê" || drawing.parametricSpec?.cor_vidro === "fume" ? "#475569" : "#38bdf8";
  const frameColor = safeColor(drawing.parametricSpec?.cor_perfil || visualElements?.find((item) => item?.type === "rect" && !/vidro|glass/i.test(String(item.label || "")))?.fill, "#64748b");
  const labelWidth = `${drawing.overallDimensions?.width || widthMm} ${drawing.unit || "mm"}`;
  const labelHeight = `${drawing.overallDimensions?.height || heightMm} ${drawing.unit || "mm"}`;

  return <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#090d16]">
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
      <div><h3 className="text-xs font-black uppercase tracking-wider text-slate-100">Visualização 3D paramétrica</h3><p className="mt-1 text-[10px] text-slate-400">Gire e aproxime para inspecionar a geometria vetorial do projeto</p></div>
      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-300">{usingSvgFallback ? "SVG vetorial" : "Three.js"}</span>
    </div>
    <div ref={hostRef} className={`h-[340px] w-full ${usingSvgFallback ? "hidden" : ""}`} />
    {usingSvgFallback && <div className="h-[340px] w-full px-2">
      <svg viewBox="0 0 800 440" role="img" aria-label="Vista 3D isométrica vetorial do desenho" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="cad-3d-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" fill="#fbbf24" /></marker>
          <linearGradient id="cad-3d-glass" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={glassColor} stopOpacity=".34" /><stop offset="1" stopColor={glassColor} stopOpacity=".12" /></linearGradient>
        </defs>
        <text x="400" y="27" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="800">VISTA ISOMÉTRICA · {drawing.title || "ESQUADRIA"}</text>
        <polygon points={`${frontX},${frontY} ${frontX + depthX},${frontY + depthY} ${frontX + frameWidth + depthX},${frontY + depthY} ${frontX + frameWidth},${frontY}`} fill={safeColor(frameColor, "#64748b")} stroke="#cbd5e1" strokeWidth="2" />
        <polygon points={`${frontX + frameWidth},${frontY} ${frontX + frameWidth + depthX},${frontY + depthY} ${frontX + frameWidth + depthX},${frontY + frameHeight + depthY} ${frontX + frameWidth},${frontY + frameHeight}`} fill={safeColor(frameColor, "#64748b")} opacity=".76" stroke="#cbd5e1" strokeWidth="2" />
        <rect x={frontX} y={frontY} width={frameWidth} height={frameHeight} fill={frameColor} stroke="#e2e8f0" strokeWidth="2.5" />
        <rect x={frontX + inset} y={frontY + inset} width={Math.max(1, frameWidth - inset * 2)} height={Math.max(1, frameHeight - inset * 2)} fill="url(#cad-3d-glass)" stroke="#bae6fd" strokeWidth="2" />
        {Array.from({ length: leaves - 1 }, (_, index) => {
          const x = frontX + inset + ((frameWidth - inset * 2) * (index + 1)) / leaves;
          return <g key={index}>
            <line x1={x} y1={frontY + inset} x2={x} y2={frontY + frameHeight - inset} stroke={frameColor} strokeWidth={Math.max(5, inset * 0.7)} />
            <line x1={x + 2} y1={frontY + inset} x2={x + 2} y2={frontY + frameHeight - inset} stroke="#e2e8f0" strokeOpacity=".7" strokeWidth="1" />
          </g>;
        })}
        <line x1={frontX + inset} y1={frontY + frameHeight - inset} x2={frontX + frameWidth - inset} y2={frontY + frameHeight - inset} stroke={frameColor} strokeWidth={Math.max(6, inset * 0.75)} />
        <line x1={frontX + inset} y1={frontY + inset} x2={frontX + frameWidth - inset} y2={frontY + inset} stroke={frameColor} strokeWidth={Math.max(6, inset * 0.75)} />
        <line x1={frontX} y1={frontY - 47} x2={frontX + frameWidth} y2={frontY - 47} stroke="#fbbf24" strokeWidth="1.5" markerStart="url(#cad-3d-arrow)" markerEnd="url(#cad-3d-arrow)" />
        <text x={frontX + frameWidth / 2} y={frontY - 55} textAnchor="middle" fill="#fde68a" fontSize="12" fontWeight="700">{labelWidth}</text>
        <line x1={frontX - 30} y1={frontY} x2={frontX - 30} y2={frontY + frameHeight} stroke="#fbbf24" strokeWidth="1.5" markerStart="url(#cad-3d-arrow)" markerEnd="url(#cad-3d-arrow)" />
        <text x={frontX - 38} y={frontY + frameHeight / 2} textAnchor="end" fill="#fde68a" fontSize="12" fontWeight="700">{labelHeight}</text>
        <text x={frontX + frameWidth + depthX + 6} y={frontY + depthY + 8} fill="#cbd5e1" fontSize="10">{Math.round(depthMm)} mm prof.</text>
        <text x="400" y="420" textAnchor="middle" fill="#cbd5e1" fontSize="11">{drawing.parametricSpec?.linha_aluminio || drawing.category || "Perfis"} · {drawing.parametricSpec?.tipo_vidro || "vidro"} {drawing.parametricSpec?.cor_vidro || ""} · {drawing.parametricSpec?.espessura_mm || 0} mm</text>
      </svg>
    </div>}
    {failed && <p className="px-4 pb-3 text-xs text-amber-300">WebGL indisponível; exibindo a vista 3D vetorial em SVG.</p>}
  </section>;
}
