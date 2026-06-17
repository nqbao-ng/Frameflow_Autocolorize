import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import {
  Zap, ChevronRight, Plus, RotateCcw, Sparkles, Forward, Download,
  Play, Pause, ChevronDown, Brush, Eraser, Pipette, Square, Crown,
  Sliders, Check, Sun, Contrast, Droplets, Wind, X, RefreshCw,
  Upload, ImageIcon, FileImage, List, LayoutGrid, FolderOpen,
  Star, Wand2, PenLine, Layers, Palette, ChevronUp, Blend, Scissors, RotateCw,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const HERO_IMG = "https://images.unsplash.com/photo-1563393471486-370b35d7de64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltZSUyMGFuaW1hdGlvbiUyMGZyYW1lJTIwY29sb3JmdWx8ZW58MXx8fHwxNzcyNzI3ODQzfDA&ixlib=rb-4.1.0&q=80&w=1080";
const SPEEDS = ["0.25x", "0.5x", "1x", "2x"];

// Professional palette — 7 rows × 10 cols
const PALETTE_ROWS: string[][] = [
  ["#FDDBB4", "#F5C49A", "#EAA87A", "#D4875B", "#B5663C", "#8B4513", "#5C2E0A", "#3B1A06", "#FFF0E0", "#FFE4C4"],
  ["#FF6B9D", "#FF4081", "#E91E63", "#C2185B", "#F48FB1", "#FF80AB", "#FF1744", "#D32F2F", "#FFCDD2", "#B71C1C"],
  ["#FFB74D", "#FF9800", "#F57C00", "#E65100", "#FFEB3B", "#FDD835", "#F9A825", "#FF6F00", "#FFF9C4", "#FFF3E0"],
  ["#A5D6A7", "#66BB6A", "#43A047", "#2E7D32", "#B9F6CA", "#69F0AE", "#00E676", "#00C853", "#1B5E20", "#E8F5E9"],
  ["#90CAF9", "#42A5F5", "#1E88E5", "#1565C0", "#80DEEA", "#26C6DA", "#00ACC1", "#00838F", "#E3F2FD", "#0D47A1"],
  ["#CE93D8", "#AB47BC", "#8E24AA", "#6A1B9A", "#B39DDB", "#7E57C2", "#5E35B1", "#4527A0", "#EDE7F6", "#311B92"],
  ["#FFFFFF", "#F5F5F5", "#EEEEEE", "#E0E0E0", "#BDBDBD", "#9E9E9E", "#757575", "#616161", "#424242", "#000000"],
];

type Tool = "brush" | "pencil" | "fill" | "eraser" | "picker" | "smudge" | "dodge" | "burn";
type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light" | "color-dodge" | "color-burn";
type FrameState = "plain" | "ai" | "manual";
type ImportedFile = { id: string; name: string; url: string };
type ContextMenu = { frameIndex: number; x: number; y: number } | null;

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
function hexToHsv(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    if (max === r / 255) h = ((g / 255 - b / 255) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g / 255) h = ((b / 255 - r / 255) / d + 2) / 6;
    else h = ((r / 255 - g / 255) / d + 4) / 6;
  }
  return [h * 360, s * 100, v * 100];
}
function hsvToHex(h: number, s: number, v: number): string {
  h /= 360; s /= 100; v /= 100;
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) { case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break; case 4: r = t; g = p; b = v; break; case 5: r = v; g = p; b = q; break; }
  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

// ─── Slider ──────────────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min = 0, max = 100, unit = "%" }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 10, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#3B82F6", height: 3, cursor: "pointer" }} />
    </div>
  );
}

function RulerTick({ index, position }: { index: number; position: "top" | "bottom" }) {
  const isFive = (index + 1) % 5 === 0, isFirst = index === 0;
  return (
    <div style={{ width: 52, minWidth: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: position === "top" ? "flex-end" : "flex-start", height: isFive ? 18 : 12, flexShrink: 0, position: "relative" }}>
      <div style={{ width: isFive ? 2 : 1, height: isFive ? "100%" : "60%", background: isFive ? "#3B82F6" : "#CBD5E1", borderRadius: 2 }} />
      {(isFive || isFirst) && (
        <div style={{ position: "absolute", [position === "top" ? "bottom" : "top"]: "100%", fontSize: 9, fontWeight: isFive ? 700 : 500, color: isFive ? "#3B82F6" : "#94A3B8", whiteSpace: "nowrap", lineHeight: 1, marginTop: position === "bottom" ? 2 : 0, marginBottom: position === "top" ? 2 : 0 }}>
          {isFirst && !isFive ? "1s" : `${index + 1}s`}
        </div>
      )}
    </div>
  );
}

// ─── HSV Color Picker ─────────────────────────────────────────────────────────
function ColorPickerWheel({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const svRef = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(color));
  const [draggingSV, setDraggingSV] = useState(false);
  const [draggingH, setDraggingH] = useState(false);
  const SV = 160;

  useEffect(() => { setHsv(hexToHsv(color)); }, [color]);

  useEffect(() => {
    const cv = svRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const [h] = hsv;
    const gH = ctx.createLinearGradient(0, 0, SV, 0);
    gH.addColorStop(0, "#fff"); gH.addColorStop(1, `hsl(${h},100%,50%)`);
    ctx.fillStyle = gH; ctx.fillRect(0, 0, SV, SV);
    const gV = ctx.createLinearGradient(0, 0, 0, SV);
    gV.addColorStop(0, "rgba(0,0,0,0)"); gV.addColorStop(1, "#000");
    ctx.fillStyle = gV; ctx.fillRect(0, 0, SV, SV);
    const cx = (hsv[1] / 100) * SV, cy = (1 - hsv[2] / 100) * SV;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1; ctx.stroke();
  }, [hsv]);

  const updateSV = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = svRef.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / SV)) * 100;
    const v = (1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / SV))) * 100;
    const next: [number, number, number] = [hsv[0], s, v]; setHsv(next); onChange(hsvToHex(...next));
  };
  const updateHue = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const h = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360;
    const next: [number, number, number] = [h, hsv[1], hsv[2]]; setHsv(next); onChange(hsvToHex(...next));
  };
  const hueGrad = Array.from({ length: 360 }, (_, i) => `hsl(${i},100%,50%)`).join(",");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, userSelect: "none" }}>
      <canvas ref={svRef} width={SV} height={SV}
        style={{ width: SV, height: SV, borderRadius: 8, cursor: "crosshair", border: "1px solid #E2E8F0", display: "block" }}
        onMouseDown={e => { setDraggingSV(true); updateSV(e); }}
        onMouseMove={e => { if (draggingSV) updateSV(e); }}
        onMouseUp={() => setDraggingSV(false)} onMouseLeave={() => setDraggingSV(false)}
      />
      <div style={{ position: "relative", height: 14, borderRadius: 6, border: "1px solid #E2E8F0", background: `linear-gradient(to right,${hueGrad})`, cursor: "crosshair" }}
        onMouseDown={e => { setDraggingH(true); updateHue(e); }}
        onMouseMove={e => { if (draggingH) updateHue(e); }}
        onMouseUp={() => setDraggingH(false)} onMouseLeave={() => setDraggingH(false)}>
        <div style={{ position: "absolute", top: "50%", left: `${hsv[0] / 360 * 100}%`, transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", border: "2px solid white", background: `hsl(${hsv[0]},100%,50%)`, boxShadow: "0 1px 4px rgba(0,0,0,0.3)", pointerEvents: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "#F8FAFF", borderRadius: 7, padding: "5px 8px", border: "1px solid #E2E8F0" }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: color, border: "1px solid #E2E8F0", flexShrink: 0 }} />
          <input value={color.toUpperCase()}
            onChange={e => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) { onChange(e.target.value); setHsv(hexToHsv(e.target.value)); } }}
            style={{ border: "none", background: "transparent", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#1E293B", outline: "none", width: "100%", letterSpacing: 1 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Paint Canvas ─────────────────────────────────────────────────────────────
// Tool modules — each tool is a self-contained render function.
// To add a new tool: add a case in onMouseDown/onMouseMove, write a draw fn.

function PaintCanvas({ imageUrl, tool, color, brushSize, opacity, hardness, blendMode,
  fillTolerance, gapClose, lockLineArt,
  onColorPicked, onStroke, onBeforeStroke, canvasRef }: {
    imageUrl: string | null; tool: Tool; color: string; brushSize: number; opacity: number;
    hardness: number; blendMode: BlendMode; fillTolerance: number; gapClose: boolean;
    lockLineArt: boolean;
    onColorPicked: (c: string) => void; onStroke: () => void; onBeforeStroke: () => void;
    canvasRef: React.RefObject<HTMLCanvasElement>;
  }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);  // line art layer
  const colorRef = useRef<HTMLCanvasElement>(null);  // color-under layer (Lock mode)
  const painting = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  // Smooth brush: accumulate last N points for Catmull-Rom interpolation
  const pointBuffer = useRef<{ x: number; y: number }[]>([]);

  // Trả về canvas đích để vẽ:
  // Lock ON  → colorRef (màu nằm dưới line art)
  // Lock OFF → canvasRef (behaviour cũ)
  const paintTarget = (): HTMLCanvasElement =>
    lockLineArt ? colorRef.current! : canvasRef.current!;

  // ── Load background image ──────────────────────────────────────────────────
  useEffect(() => {
    const cv = bgRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    if (!imageUrl) { ctx.fillStyle = "#1E293B"; ctx.fillRect(0, 0, cv.width || 800, cv.height || 600); return; }
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      cv.width = W; cv.height = H;
      if (canvasRef.current) { canvasRef.current.width = W; canvasRef.current.height = H; }
      if (colorRef.current) { colorRef.current.width = W; colorRef.current.height = H; }
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ── Coordinate mapping — handles objectFit:contain letterbox/pillarbox ─────
  const getPos = (e: React.MouseEvent) => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const elAspect = rect.width / rect.height, cvAspect = cv.width / cv.height;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (elAspect > cvAspect) {
      renderH = rect.height; renderW = rect.height * cvAspect;
      offsetX = (rect.width - renderW) / 2; offsetY = 0;
    } else {
      renderW = rect.width; renderH = rect.width / cvAspect;
      offsetX = 0; offsetY = (rect.height - renderH) / 2;
    }
    return {
      x: (e.clientX - rect.left - offsetX) * (cv.width / renderW),
      y: (e.clientY - rect.top - offsetY) * (cv.height / renderH),
    };
  };

  // ── Tool: Pencil — hard pixel-perfect stroke, no smoothing ────────────────
  const drawPencil = (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const { r, g, b } = hexToRgb(color);
    ctx.save();
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : blendMode as GlobalCompositeOperation;
    ctx.globalAlpha = Math.min(1, opacity / 100);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = Math.max(1, brushSize * 0.5);
    ctx.lineCap = "round";  // round cap
    ctx.lineJoin = "round";
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.restore();
  };

  // ── Tool: Brush — soft stroke with Catmull-Rom spline smoothing ────────────
  // Called with full pointBuffer to draw a smooth curve through all points.
  const drawBrushSmooth = (ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return;
    const { r, g, b } = hexToRgb(color);
    ctx.save();
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : blendMode as GlobalCompositeOperation;
    ctx.globalAlpha = opacity / 100;
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Soft edge via shadow glow (only for brush, not eraser)
    if (tool !== "eraser" && hardness < 85) {
      ctx.shadowBlur = brushSize * (1 - hardness / 100) * 1.2;
      ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      // Catmull-Rom → Bezier conversion for smooth interpolation
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        // Control points derived from Catmull-Rom formula (tension=0.5)
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  // ── Tool: Eraser — same as brush but destination-out composite ───────────
  // (handled by passing tool="eraser" into drawBrushSmooth)

  // ── Tool: Fill — flood fill with tolerance + optional gap closing ──────────
  // Gap closing: before BFS, build a "sealed" version of the composite by
  // morphologically dilating dark pixels by gapSize pixels. This fills hairline
  // gaps in line art so the flood can't escape through them.
  const doFloodFill = (paintCtx: CanvasRenderingContext2D, x: number, y: number) => {
    const { r: fr, g: fg, b: fb } = hexToRgb(color);
    const bg = bgRef.current!;
    const w = bg.width, h = bg.height;

    // 1. Build composite: colorLayer + lineArt(bg) + paintLayer
    //    = ảnh mà user đang nhìn thấy → sample màu đúng
    const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
    const tmpCtx = tmp.getContext("2d")!;
    if (colorRef.current) tmpCtx.drawImage(colorRef.current, 0, 0);
    tmpCtx.drawImage(bg, 0, 0);
    if (canvasRef.current) tmpCtx.drawImage(canvasRef.current, 0, 0);
    let cd = tmpCtx.getImageData(0, 0, w, h).data;

    // 2. If gap closing enabled, create a sealed map: dilate "dark/line" pixels
    //    A pixel is considered a "line" if its luminance < 80 (dark outline)
    let sealedMask: Uint8Array | null = null;
    if (gapClose) {
      const gapSize = 2; // pixels to expand lines by — covers 1-2px gaps
      const isLine = (i: number) => {
        const lum = (cd[i] * 0.299 + cd[i + 1] * 0.587 + cd[i + 2] * 0.114);
        return lum < 80 && cd[i + 3] > 30;
      };
      sealedMask = new Uint8Array(w * h); // 1 = blocked (line or dilated line)
      // Pass 1: mark original line pixels
      for (let p = 0; p < w * h; p++) { if (isLine(p * 4)) sealedMask[p] = 1; }
      // Pass 2: dilate by gapSize using box dilation
      const dilated = new Uint8Array(w * h);
      for (let py = 0; py < h; py++) for (let px2 = 0; px2 < w; px2++) {
        const p = py * w + px2;
        if (!sealedMask[p]) continue;
        for (let dy = -gapSize; dy <= gapSize; dy++) for (let dx = -gapSize; dx <= gapSize; dx++) {
          const nx = px2 + dx, ny = py + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) dilated[ny * w + nx] = 1;
        }
      }
      sealedMask = dilated;
    }

    // 3. Sample target color at click point
    const sx = Math.floor(Math.max(0, Math.min(w - 1, x)));
    const sy = Math.floor(Math.max(0, Math.min(h - 1, y)));
    const spx = (sx + sy * w) * 4;
    const [tr, tg, tb] = [cd[spx], cd[spx + 1], cd[spx + 2]];
    if (tr === fr && tg === fg && tb === fb) return; // already fill color

    // 4. BFS flood fill
    const tol = fillTolerance;
    const colorMatch = (i: number) =>
      Math.abs(cd[i] - tr) < tol && Math.abs(cd[i + 1] - tg) < tol && Math.abs(cd[i + 2] - tb) < tol;

    const paintId = paintCtx.getImageData(0, 0, w, h); const pd = paintId.data;
    const visited = new Uint8Array(w * h);
    const alpha = Math.round(opacity / 100 * 255);
    // Use a typed array stack for performance on large canvases
    const stack = new Int32Array(w * h);
    let stackTop = 0;
    stack[stackTop++] = sx + sy * w;

    while (stackTop > 0) {
      const p = stack[--stackTop];
      if (visited[p]) continue;
      visited[p] = 1;
      if (sealedMask && sealedMask[p]) continue; // blocked by gap-close mask
      const i = p * 4;
      if (!colorMatch(i)) continue;
      // Paint onto paint layer
      pd[i] = fr; pd[i + 1] = fg; pd[i + 2] = fb; pd[i + 3] = alpha;
      // Update composite to stop re-visiting
      cd[i] = fr; cd[i + 1] = fg; cd[i + 2] = fb; cd[i + 3] = 255;
      const px2 = p % w;
      if (px2 > 0) stack[stackTop++] = p - 1;
      if (px2 < w - 1) stack[stackTop++] = p + 1;
      if (p >= w) stack[stackTop++] = p - w;
      if (p < w * (h - 1)) stack[stackTop++] = p + w;
    }
    paintCtx.putImageData(paintId, 0, 0);
  };

  // ── Tool: Color Picker ─────────────────────────────────────────────────────
  const doPickColor = (x: number, y: number) => {
    const bg = bgRef.current!;
    const tmp = document.createElement("canvas"); tmp.width = bg.width; tmp.height = bg.height;
    const ctx = tmp.getContext("2d")!;
    // Sample từ composite đầy đủ để thấy đúng màu hiển thị
    if (colorRef.current) ctx.drawImage(colorRef.current, 0, 0);
    ctx.drawImage(bg, 0, 0);
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
    const px = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    onColorPicked(rgbToHex(px[0], px[1], px[2]));
  };

  // ── Mouse event handlers ───────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getPos(e);
    const cv = paintTarget(); const ctx = cv.getContext("2d")!;

    if (tool === "fill") {
      onBeforeStroke();
      doFloodFill(ctx, pos.x, pos.y);
      onStroke();
      return;
    }
    if (tool === "picker") {
      doPickColor(pos.x, pos.y);
      return;
    }
    // Stroke tools
    painting.current = true;
    lastPos.current = pos;
    pointBuffer.current = [pos]; // reset smooth buffer
    onBeforeStroke();
    // Draw initial dot
    if (tool === "pencil" || tool === "eraser") {
      drawPencil(ctx, pos, pos);
    } else {
      drawBrushSmooth(ctx, [pos, pos]);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!painting.current || !lastPos.current) return;
    const pos = getPos(e);
    const cv = paintTarget(); const ctx = cv.getContext("2d")!;

    if (tool === "pencil") {
      // Pencil: direct lineTo, no smoothing
      drawPencil(ctx, lastPos.current, pos);
      lastPos.current = pos;
    } else {
      // Brush / Eraser: accumulate points then redraw smooth curve
      pointBuffer.current.push(pos);
      // Keep buffer bounded — only need last 8 points for smooth feel
      if (pointBuffer.current.length > 8) pointBuffer.current.shift();
      // Redraw only the tail segment (last 4 points) to avoid full-canvas redraw
      const buf = pointBuffer.current;
      const tail = buf.slice(Math.max(0, buf.length - 4));
      drawBrushSmooth(ctx, tail);
      lastPos.current = pos;
    }
  };

  const onMouseUp = () => {
    if (painting.current) {
      painting.current = false;
      lastPos.current = null;
      pointBuffer.current = [];
      onStroke();
    }
  };

  // ── Custom cursor ──────────────────────────────────────────────────────────
  const getCursor = () => {
    if (tool === "picker") return "crosshair";
    if (tool === "fill") return "cell";
    const sz = Math.max(8, Math.min(64, brushSize));
    const isPencil = tool === "pencil";
    const strokeColor = tool === "eraser"
      ? encodeURIComponent("rgba(255,255,255,0.85)")
      : isPencil
        ? encodeURIComponent("rgba(30,30,30,0.9)")
        : encodeURIComponent("rgba(0,0,0,0.65)");
    // All stroke tools use circle cursor
    const shape = `<circle cx='${sz / 2}' cy='${sz / 2}' r='${sz / 2 - 1.5}' fill='none' stroke='${strokeColor}' stroke-width='1.5'/><circle cx='${sz / 2}' cy='${sz / 2}' r='1' fill='${strokeColor}'/>`;
    return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}'>${shape}</svg>") ${sz / 2} ${sz / 2}, crosshair`;
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 14 }}>
      {/* Layer 1 — Color layer: chỉ hiển thị khi Lock ON, nằm dưới line art */}
      <canvas ref={colorRef} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
        display: lockLineArt ? "block" : "none",
      }} />
      {/* Layer 2 — Line art / background */}
      <canvas ref={bgRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
      {/* Layer 3 — Paint layer (Lock OFF) + event receiver */}
      <canvas ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", cursor: getCursor() }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function Dashboard() {
  const [activeFrame, setActiveFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState("1x");
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [frameStates, setFrameStates] = useState<FrameState[]>([]);
  const [uncoloredFiles, setUncoloredFiles] = useState<ImportedFile[]>([]);
  const [referenceImage, setReferenceImage] = useState<ImportedFile | null>(null);
  const [frameRefMap, setFrameRefMap] = useState<Record<number, ImportedFile>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [framePaints, setFramePaints] = useState<Record<number, string>>({});
  const [undoStack, setUndoStack] = useState<Record<number, string[]>>({});
  const [redoStack, setRedoStack] = useState<Record<number, string[]>>({});

  // Tools
  const [activeTool, setActiveTool] = useState<Tool>("brush");
  const [activeColor, setActiveColor] = useState("#FF6B9D");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [brushSize, setBrushSize] = useState(20);
  const [opacity, setOpacity] = useState(85);
  const [hardness, setHardness] = useState(70);
  const [blendMode, setBlendMode] = useState<BlendMode>("source-over");
  const [flow, setFlow] = useState(100);
  const [spacing, setSpacing] = useState(10);
  // Fill tool settings
  const [fillTolerance, setFillTolerance] = useState(35);
  const [gapClose, setGapClose] = useState(true);
  const [lockLineArt, setLockLineArt] = useState(false);

  // Panels
  const [panelOpen, setPanelOpen] = useState({ tools: true, color: true, brush: true, adjust: false });

  // AI
  const [isColoring, setIsColoring] = useState(false);
  const [improveEdge, setImproveEdge] = useState(true);
  const [preserveLines, setPreserveLines] = useState(true);
  const [skinTone, setSkinTone] = useState(true);
  const [brightness, setBrightness] = useState(50);
  const [contrastVal, setContrastVal] = useState(50);
  const [saturation, setSaturation] = useState(60);
  const [blur, setBlur] = useState(20);
  const [spill, setSpill] = useState(30);
  const [tones, setTones] = useState(45);

  // Modal
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [refModalTab, setRefModalTab] = useState<"list" | "upload">("list");
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);

  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uncoloredInputRef = useRef<HTMLInputElement>(null);
  const customColoredInputRef = useRef<HTMLInputElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isPlaying && uncoloredFiles.length > 0) {
      const ms = speed === "0.25x" ? 800 : speed === "0.5x" ? 400 : speed === "2x" ? 100 : 200;
      playRef.current = setInterval(() => setActiveFrame(f => (f + 1) % uncoloredFiles.length), ms);
    } else if (playRef.current) clearInterval(playRef.current);
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [isPlaying, speed, uncoloredFiles.length]);

  useEffect(() => {
    const c = timelineScrollRef.current; if (!c) return;
    c.scrollTo({ left: Math.max(0, activeFrame * 58 - c.clientWidth / 2 + 29), behavior: "smooth" });
  }, [activeFrame]);

  const saveCurrentFrame = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    setFramePaints(prev => ({ ...prev, [activeFrame]: cv.toDataURL() }));
  }, [activeFrame]);

  const handleFrameChange = (idx: number) => {
    saveCurrentFrame();
    setActiveFrame(idx); setIsPlaying(false);
    setTimeout(() => {
      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext("2d")!;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const saved = framePaints[idx];
      if (saved) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = saved; }
    }, 50);
  };

  // ── Undo/Redo system ─────────────────────────────────────────────────────────
  // Snapshots are pushed BEFORE each stroke so stack[0] = blank canvas state.
  const pushUndoSnapshot = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const snap = cv.toDataURL();
    // Push to undo, clear redo (new action invalidates redo history)
    setUndoStack(prev => ({ ...prev, [activeFrame]: [...(prev[activeFrame] || []), snap].slice(-30) }));
    setRedoStack(prev => ({ ...prev, [activeFrame]: [] }));
  }, [activeFrame]);

  // Called at end of stroke to mark frame as "manual"
  const handleStroke = useCallback(() => {
    setFrameStates(prev => { const n = [...prev]; n[activeFrame] = "manual"; return n; });
  }, [activeFrame]);

  const handleUndo = useCallback(() => {
    const stack = undoStack[activeFrame] || [];
    if (stack.length === 0) return;
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    // Save current state to redo before undoing
    const currentSnap = cv.toDataURL();
    setRedoStack(prev => ({ ...prev, [activeFrame]: [...(prev[activeFrame] || []), currentSnap].slice(-30) }));
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (stack.length === 1) {
      // Back to blank canvas
      setUndoStack(s => ({ ...s, [activeFrame]: [] }));
      setFrameStates(prev => { const n = [...prev]; n[activeFrame] = "plain"; return n; });
    } else {
      const target = stack[stack.length - 2];
      const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = target;
      setUndoStack(s => ({ ...s, [activeFrame]: stack.slice(0, -1) }));
    }
  }, [activeFrame, undoStack]);

  const handleRedo = useCallback(() => {
    const stack = redoStack[activeFrame] || [];
    if (stack.length === 0) return;
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    // Save current to undo before redoing
    const currentSnap = cv.toDataURL();
    setUndoStack(prev => ({ ...prev, [activeFrame]: [...(prev[activeFrame] || []), currentSnap].slice(-30) }));
    const target = stack[stack.length - 1];
    ctx.clearRect(0, 0, cv.width, cv.height);
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); setFrameStates(prev => { const n = [...prev]; n[activeFrame] = "manual"; return n; }); };
    img.src = target;
    setRedoStack(s => ({ ...s, [activeFrame]: stack.slice(0, -1) }));
  }, [activeFrame, redoStack]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); handleUndo(); return; }
        if (e.key === "y" || e.key === "Z") { e.preventDefault(); handleRedo(); return; }
        return;
      }
      switch (e.key.toUpperCase()) {
        case "B": setActiveTool("brush"); break;
        case "P": setActiveTool("pencil"); break;
        case "E": setActiveTool("eraser"); break;
        case "I": setActiveTool("picker"); break;
        case "F": setActiveTool("fill"); break;
        case "G": setActiveTool("fill"); break; // alternate for Fill (like Photoshop)
        default: break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleUndo, handleRedo]);

  const handleColorPicked = (c: string) => {
    setActiveColor(c);
    setRecentColors(prev => [c, ...prev.filter(x => x !== c)].slice(0, 10));
  };

  const handleAutoColor = () => {
    setIsColoring(true);
    setTimeout(() => { setFrameStates(Array(uncoloredFiles.length).fill("ai" as FrameState)); setIsColoring(false); }, 1800);
  };
  const handleColorCurrentFrame = () => setFrameStates(prev => { const n = [...prev]; n[activeFrame] = "ai"; return n; });

  const handleImportUncolored = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    const nf = files.map((f, i) => ({ id: `imported-${Date.now()}-${i}`, name: f.name, url: URL.createObjectURL(f) }));
    setUncoloredFiles(prev => [...prev, ...nf]);
    setFrameStates(prev => [...prev, ...files.map(() => "plain" as FrameState)]);
    e.target.value = "";
  };
  const handleCustomColoredUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setReferenceImage({ id: `custom-${Date.now()}`, name: file.name, url: URL.createObjectURL(file) });
    setShowReferenceModal(false); e.target.value = "";
  };
  const handleConfirmReference = () => {
    const found = uncoloredFiles.find(f => f.id === selectedRefId);
    if (found) setReferenceImage(found); setShowReferenceModal(false);
  };
  const openReferenceModal = () => { setSelectedRefId(referenceImage?.id ?? null); setRefModalTab("list"); setShowReferenceModal(true); };
  const handleSetFrameRef = (fi: number) => { if (referenceImage) setFrameRefMap(p => ({ ...p, [fi]: referenceImage })); setContextMenu(null); };
  const handleSetFrameAsGlobalRef = (fi: number) => { const f = uncoloredFiles[fi]; if (f) { setReferenceImage(f); setFrameRefMap(p => ({ ...p, [fi]: f })); } setContextMenu(null); };
  const handleClearFrameRef = (fi: number) => { setFrameRefMap(p => { const n = { ...p }; delete n[fi]; return n; }); setContextMenu(null); };
  const togglePanel = (k: keyof typeof panelOpen) => setPanelOpen(p => ({ ...p, [k]: !p[k] }));

  const TOOLS: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: "brush", icon: <Brush size={14} />, label: "Brush", shortcut: "B" },
    { id: "pencil", icon: <PenLine size={14} />, label: "Pencil", shortcut: "P" },
    { id: "fill", icon: <Layers size={14} />, label: "Fill", shortcut: "F" },
    { id: "eraser", icon: <Eraser size={14} />, label: "Eraser", shortcut: "E" },
    { id: "picker", icon: <Pipette size={14} />, label: "Picker", shortcut: "I" },
    { id: "smudge", icon: <Blend size={14} />, label: "Smudge", shortcut: "U" },
    { id: "dodge", icon: <Sun size={14} />, label: "Dodge", shortcut: "D" },
    { id: "burn", icon: <Scissors size={14} />, label: "Burn", shortcut: "O" },
  ];

  const BLEND_MODES: { value: BlendMode; label: string }[] = [
    { value: "source-over", label: "Normal" },
    { value: "multiply", label: "Multiply" },
    { value: "screen", label: "Screen" },
    { value: "overlay", label: "Overlay" },
    { value: "soft-light", label: "Soft Light" },
    { value: "hard-light", label: "Hard Light" },
    { value: "color-dodge", label: "Color Dodge" },
    { value: "color-burn", label: "Color Burn" },
  ];

  return (
    <div style={{ height: "100vh", background: "#F1F5F9", display: "flex", fontFamily: "'Inter',sans-serif", overflow: "hidden" }}
      onMouseDown={() => setContextMenu(null)}>
      <input ref={uncoloredInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImportUncolored} />
      <input ref={customColoredInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCustomColoredUpload} />

      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside style={{ width: 228, minWidth: 228, background: "linear-gradient(180deg,#EFF6FF,#F0F4FF)", borderRight: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 14px 0", flexShrink: 0 }}>
          <Link to="/" className="flex items-center gap-2 no-underline mb-0" style={{ width: "fit-content" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={13} color="white" fill="white" /></div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#1E293B" }}>FrameFlow</span>
          </Link>
        </div>
        <div style={{ padding: "8px 14px 0", flexShrink: 0 }}>
          <Link to="/projects" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748B", textDecoration: "none", padding: "5px 7px", borderRadius: 7, background: "rgba(255,255,255,0.6)" }}>
            <FolderOpen size={11} /><span>Magic Girl Animation</span><ChevronRight size={10} style={{ marginLeft: "auto" }} />
          </Link>
        </div>
        <div style={{ padding: "12px 14px 6px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <LayoutGrid size={11} color="#64748B" />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }}>Frames</span>
            </div>
            <span style={{ fontSize: 9, color: "#94A3B8", background: "#E2E8F0", padding: "1px 5px", borderRadius: 100 }}>{uncoloredFiles.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px", scrollbarWidth: "thin" }}>
          {uncoloredFiles.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 12px", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><FileImage size={18} color="#CBD5E1" /></div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", margin: "0 0 3px" }}>No frames yet</p>
              <p style={{ fontSize: 10, color: "#CBD5E1", margin: 0 }}>Import uncolored files below</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, paddingBottom: 8, paddingTop: 4 }}>
              {uncoloredFiles.map((file, i) => {
                const isActive = activeFrame === i, state = frameStates[i] ?? "plain";
                return (
                  <button key={file.id}
                    onClick={() => handleFrameChange(i)}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ frameIndex: i, x: e.clientX, y: e.clientY }); }}
                    style={{ border: isActive ? "2px solid #3B82F6" : frameRefMap[i] ? "1.5px solid #F59E0B" : "1.5px solid transparent", borderRadius: 8, overflow: "hidden", cursor: "pointer", padding: 0, background: isActive ? "#EFF6FF" : "white", position: "relative", boxShadow: isActive ? "0 0 0 2px rgba(59,130,246,0.18)" : "0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.1s" }}>
                    <img src={file.url} alt={file.name} style={{ width: "100%", height: 48, objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,0.55)", borderRadius: 3, padding: "1px 4px" }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>{i + 1}</span>
                    </div>
                    {state !== "plain" && <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: state === "ai" ? "#8B5CF6" : "#F59E0B", border: "1px solid white" }} />}
                    {frameRefMap[i] && (
                      <div style={{ position: "absolute", bottom: 3, left: 3, display: "flex", alignItems: "center", gap: 2, background: "rgba(245,158,11,0.92)", borderRadius: 3, padding: "1px 3px", border: "1px solid rgba(255,255,255,0.8)" }}>
                        <Star size={6} color="white" fill="white" />
                        <img src={frameRefMap[i].url} alt="ref" style={{ width: 10, height: 10, borderRadius: 2, objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ background: isActive ? "#EFF6FF" : "#F8FAFF", padding: "2px 4px", borderTop: "1px solid #F1F5F9" }}>
                      <span style={{ fontSize: 8, color: isActive ? "#3B82F6" : "#94A3B8", fontWeight: isActive ? 700 : 400 }}>{i + 1}s</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ padding: "8px 10px", flexShrink: 0, borderTop: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: 5 }}>
          <button onClick={() => uncoloredInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 9, border: "1.5px solid #E2E8F0", background: "white", cursor: "pointer", fontFamily: "'Inter',sans-serif", width: "100%", textAlign: "left" }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><List size={11} color="#64748B" /></div>
            <div><div style={{ fontSize: 10, fontWeight: 600, color: "#1E293B" }}>Import Uncolored Files</div><div style={{ fontSize: 8, color: "#94A3B8" }}>{uncoloredFiles.length} loaded</div></div>
          </button>
          <button onClick={openReferenceModal} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 9, border: referenceImage ? "1.5px solid #3B82F6" : "1.5px solid #E2E8F0", background: referenceImage ? "#EFF6FF" : "white", cursor: "pointer", fontFamily: "'Inter',sans-serif", width: "100%", textAlign: "left" }}>
            {referenceImage ? <img src={referenceImage.url} alt="ref" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: "1px solid #BFDBFE" }} />
              : <div style={{ width: 22, height: 22, borderRadius: 5, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ImageIcon size={11} color="#64748B" /></div>}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: referenceImage ? "#3B82F6" : "#1E293B" }}>{referenceImage ? "Reference Set" : "Import Reference"}</div>
              <div style={{ fontSize: 8, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referenceImage ? referenceImage.name : "For AI guidance"}</div>
            </div>
            {referenceImage && <button onClick={e => { e.stopPropagation(); setReferenceImage(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 1, display: "flex", alignItems: "center", flexShrink: 0 }}><X size={10} /></button>}
          </button>
        </div>
        <div style={{ padding: "0 10px 12px", flexShrink: 0 }}>
          <a href="/#pricing" style={{ display: "block", background: "linear-gradient(135deg,#1E293B,#0F172A)", borderRadius: 12, padding: "12px", textDecoration: "none" }}>
            <Crown size={15} color="#F59E0B" style={{ marginBottom: 4 }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: "white", marginBottom: 2 }}>Upgrade to Pro</p>
            <p style={{ fontSize: 9, color: "#64748B", lineHeight: 1.5, marginBottom: 8 }}>1080p, MP4, no watermark.</p>
            <div style={{ width: "100%", padding: "6px", borderRadius: 6, background: "#F59E0B", textAlign: "center", color: "#1E293B", fontWeight: 700, fontSize: 10 }}>See Pro Plans →</div>
          </a>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", padding: "0 18px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Link to="/projects" style={{ fontSize: 12, color: "#94A3B8", textDecoration: "none" }}>Projects</Link>
            <ChevronRight size={12} color="#CBD5E1" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>Magic Girl Animation</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={handleUndo}
              title="Undo (Ctrl+Z)"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 6, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#475569", fontFamily: "'Inter',sans-serif", opacity: (undoStack[activeFrame]?.length || 0) > 0 ? 1 : 0.4 }}>
              <RotateCcw size={11} />Undo
            </button>
            <button onClick={handleRedo}
              title="Redo (Ctrl+Y)"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 6, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#475569", fontFamily: "'Inter',sans-serif", opacity: (redoStack[activeFrame]?.length || 0) > 0 ? 1 : 0.4 }}>
              <RotateCw size={11} />Redo
            </button>

            {/* ── Lock Line Art toggle ── */}
            <div style={{ width: 1, height: 18, background: "#E2E8F0", flexShrink: 0, margin: "0 2px" }} />
            <button
              onClick={() => setLockLineArt(v => !v)}
              title={lockLineArt
                ? "Line Art Locked — màu vẽ dưới outline. Click để mở khóa."
                : "Lock Line Art — ngăn vẽ đè lên outline"}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 6,
                border: lockLineArt ? "1.5px solid #6366F1" : "1px solid #E2E8F0",
                background: lockLineArt ? "#EEF2FF" : "white",
                cursor: "pointer", fontSize: 11,
                fontWeight: lockLineArt ? 700 : 500,
                color: lockLineArt ? "#4F46E5" : "#64748B",
                fontFamily: "'Inter',sans-serif",
                boxShadow: lockLineArt ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
                transition: "all 0.15s",
              }}>
              {/* Lock icon — SVG inline để không cần import thêm */}
              {lockLineArt
                ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
              }
              {lockLineArt ? "Locked" : "Lock Line Art"}
            </button>
            <div style={{ width: 1, height: 18, background: "#E2E8F0", flexShrink: 0, margin: "0 2px" }} />

            <button onClick={handleAutoColor} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 6, border: "none", background: isColoring ? "#E0E7FF" : "#3B82F6", cursor: "pointer", fontSize: 11, fontWeight: 600, color: isColoring ? "#3B82F6" : "white", fontFamily: "'Inter',sans-serif", boxShadow: "0 2px 6px rgba(59,130,246,0.25)", transition: "all 0.2s", marginLeft: 2 }}>
              {isColoring ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}{isColoring ? "Coloring…" : "AI Auto Color"}
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 6, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#475569", fontFamily: "'Inter',sans-serif" }}><Forward size={11} />Propagate</button>
            <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 6, border: "none", background: "#1E293B", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "white", fontFamily: "'Inter',sans-serif", marginLeft: 2 }}><Download size={11} />Export</button>
          </div>
        </div>

        <div style={{ flex: 1, padding: "12px 12px 0", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          {/* Canvas */}
          <div style={{ flex: 1, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", background: "#0F172A", position: "relative", minHeight: 0, borderRadius: 14, overflow: "hidden" }}>
            <PaintCanvas
              imageUrl={uncoloredFiles[activeFrame]?.url ?? null}
              tool={activeTool} color={activeColor}
              brushSize={brushSize} opacity={opacity} hardness={hardness} blendMode={blendMode}
              fillTolerance={fillTolerance} gapClose={gapClose}
              lockLineArt={lockLineArt}
              onColorPicked={handleColorPicked} onStroke={handleStroke}
              onBeforeStroke={pushUndoSnapshot} canvasRef={canvasRef}
            />
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 100, padding: "4px 12px", pointerEvents: "none" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>Frame {activeFrame + 1} of {uncoloredFiles.length || 0}</span>
            </div>
            {referenceImage && (
              <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", borderRadius: 9, padding: "4px 9px", display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(255,255,255,0.1)", pointerEvents: "none" }}>
                <img src={referenceImage.url} alt="ref" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                <div><div style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", marginBottom: 1 }}>Reference</div><div style={{ fontSize: 9, fontWeight: 600, color: "white", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referenceImage.name}</div></div>
              </div>
            )}
            {frameStates[activeFrame] === "ai" && (
              <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(139,92,246,0.85)", borderRadius: 100, padding: "3px 9px", display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}>
                <Sparkles size={9} color="white" /><span style={{ fontSize: 9, fontWeight: 600, color: "white" }}>AI Colored</span>
              </div>
            )}
            {frameStates[activeFrame] === "manual" && (
              <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(245,158,11,0.85)", borderRadius: 100, padding: "3px 9px", display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}>
                <Brush size={9} color="white" /><span style={{ fontSize: 9, fontWeight: 600, color: "white" }}>Manual Edit</span>
              </div>
            )}
            {/* Lock Line Art badge */}
            {lockLineArt && (
              <div style={{
                position: "absolute",
                top: frameStates[activeFrame] !== "plain" ? 44 : 12,
                left: 12,
                background: "rgba(79,70,229,0.9)",
                backdropFilter: "blur(6px)",
                borderRadius: 100, padding: "3px 10px",
                display: "flex", alignItems: "center", gap: 5,
                pointerEvents: "none",
                border: "1px solid rgba(165,180,252,0.3)",
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: "white", letterSpacing: 0.4 }}>Line Art Locked</span>
              </div>
            )}
            {/* Tool indicator */}
            <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", borderRadius: 7, padding: "3px 8px", display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: activeColor, border: "1px solid rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.8)", textTransform: "capitalize" }}>{activeTool} · {brushSize}px · {opacity}%</span>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: "white", borderRadius: "10px 10px 0 0", marginTop: 8, boxShadow: "0 -2px 10px rgba(0,0,0,0.04)", flexShrink: 0 }}>
            <div style={{ padding: "8px 12px 5px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #F1F5F9" }}>
              <button onClick={() => setIsPlaying(!isPlaying)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "#3B82F6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(59,130,246,0.3)", flexShrink: 0 }}>
                {isPlaying ? <Pause size={11} color="white" fill="white" /> : <Play size={11} color="white" fill="white" />}
              </button>
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 7px", borderRadius: 6, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#475569", fontFamily: "'Inter',sans-serif" }}>{speed}<ChevronDown size={9} /></button>
                {showSpeedMenu && (
                  <div style={{ position: "absolute", bottom: "110%", left: 0, background: "white", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.12)", border: "1px solid #E2E8F0", overflow: "hidden", zIndex: 50, minWidth: 60 }}>
                    {SPEEDS.map(s => <button key={s} onClick={() => { setSpeed(s); setShowSpeedMenu(false); }} style={{ display: "block", width: "100%", padding: "6px 10px", border: "none", background: speed === s ? "#EFF6FF" : "white", cursor: "pointer", fontSize: 10, fontWeight: speed === s ? 600 : 400, color: speed === s ? "#3B82F6" : "#1E293B", textAlign: "left", fontFamily: "'Inter',sans-serif" }}>{s}</button>)}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 2 }}>{uncoloredFiles.length}s · 1fps</span>
            </div>
            <div ref={timelineScrollRef} style={{ overflowX: "auto", paddingLeft: 12, paddingRight: 12, paddingBottom: 8, scrollbarWidth: "thin" }}>
              <div style={{ display: "flex", gap: 5, paddingTop: 14, marginBottom: 3 }}>{uncoloredFiles.map((_, i) => <RulerTick key={`t${i}`} index={i} position="top" />)}</div>
              <div style={{ display: "flex", gap: 5, marginBottom: 0 }}>{uncoloredFiles.map((_, i) => <div key={`l${i}`} style={{ width: 52, minWidth: 52, height: 2, background: (i + 1) % 5 === 0 ? "#3B82F6" : "#E2E8F0", borderRadius: 1, flexShrink: 0 }} />)}</div>
              <div style={{ display: "flex", gap: 5, marginTop: 3, marginBottom: 3 }}>
                {uncoloredFiles.map((file, i) => {
                  const isActive = activeFrame === i, state = frameStates[i] ?? "plain";
                  return (
                    <button key={file.id} onClick={() => handleFrameChange(i)}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ frameIndex: i, x: e.clientX, y: e.clientY }); }}
                      style={{ width: 52, height: 48, minWidth: 52, borderRadius: 6, padding: 0, flexShrink: 0, cursor: "pointer", border: isActive ? "2px solid #3B82F6" : frameRefMap[i] ? "2px solid #F59E0B" : "1.5px solid #E2E8F0", overflow: "hidden", background: "#F8FAFF", position: "relative", boxShadow: isActive ? "0 0 0 3px rgba(59,130,246,0.18)" : frameRefMap[i] ? "0 0 0 2px rgba(245,158,11,0.2)" : "none", transition: "all 0.1s" }}>
                      <img src={file.url} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      {state !== "plain" && <div style={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: "50%", background: state === "ai" ? "#8B5CF6" : "#F59E0B", border: "1.5px solid white" }} />}
                      {frameRefMap[i] && (
                        <div style={{ position: "absolute", bottom: 2, left: 2, display: "flex", alignItems: "center", gap: 1, background: "rgba(245,158,11,0.9)", borderRadius: 2, padding: "1px 3px", border: "1px solid white" }}>
                          <Star size={6} color="white" fill="white" />
                          <img src={frameRefMap[i].url} alt="ref" style={{ width: 10, height: 10, borderRadius: 1, objectFit: "cover" }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 5, marginBottom: 0 }}>{uncoloredFiles.map((_, i) => <div key={`lb${i}`} style={{ width: 52, minWidth: 52, height: 2, background: (i + 1) % 5 === 0 ? "#3B82F6" : "#E2E8F0", borderRadius: 1, flexShrink: 0 }} />)}</div>
              <div style={{ display: "flex", gap: 5, marginTop: 3 }}>{uncoloredFiles.map((_, i) => <RulerTick key={`b${i}`} index={i} position="bottom" />)}</div>
            </div>
          </div>
        </div>
      </main>

      {/* ── RIGHT PANEL ──────────────────────────────── */}
      <aside style={{ width: 298, minWidth: 298, background: "#FAFBFC", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>

          {/* TOOLS */}
          <div style={{ borderBottom: "1px solid #F1F5F9" }}>
            <button onClick={() => togglePanel("tools")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Brush size={12} color="#8B5CF6" /><span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Tools</span><span style={{ fontSize: 9, color: "#8B5CF6", background: "#F3F0FF", padding: "1px 6px", borderRadius: 4, textTransform: "capitalize" }}>{activeTool}</span></div>
              {panelOpen.tools ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
            </button>
            {panelOpen.tools && (
              <div style={{ padding: "0 12px 12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, marginBottom: 10 }}>
                  {TOOLS.map(t => (
                    <button key={t.id} onClick={() => setActiveTool(t.id)}
                      title={`${t.label} (${t.shortcut})`}
                      style={{ padding: "8px 3px", borderRadius: 8, border: activeTool === t.id ? "none" : "1.5px solid #E2E8F0", background: activeTool === t.id ? "#EFF6FF" : "white", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: activeTool === t.id ? "#3B82F6" : "#64748B", transition: "all 0.1s", boxShadow: activeTool === t.id ? "0 0 0 2px rgba(59,130,246,0.2)" : "none", position: "relative" }}>
                      {t.icon}
                      <span style={{ fontSize: 8, fontWeight: activeTool === t.id ? 700 : 500 }}>{t.label}</span>
                      <span style={{ position: "absolute", top: 3, right: 4, fontSize: 7, color: activeTool === t.id ? "#93C5FD" : "#CBD5E1", fontFamily: "monospace", fontWeight: 700 }}>{t.shortcut}</span>
                    </button>
                  ))}
                </div>
                <button onClick={handleColorCurrentFrame} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#8B5CF6,#3B82F6)", color: "white", fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: "0 2px 8px rgba(139,92,246,0.3)", fontFamily: "'Inter',sans-serif", marginBottom: 5 }}>
                  <Wand2 size={12} />AI Color This Frame
                </button>
                <button onClick={handleAutoColor} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "white", color: "#3B82F6", fontWeight: 600, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "'Inter',sans-serif" }}>
                  <Sparkles size={12} />Auto Color Sequence
                </button>

                {/* Lock Line Art toggle card */}
                <button
                  onClick={() => setLockLineArt(v => !v)}
                  style={{
                    width: "100%", padding: "9px 10px", borderRadius: 9,
                    border: lockLineArt ? "1.5px solid #6366F1" : "1.5px solid #E2E8F0",
                    background: lockLineArt ? "#EEF2FF" : "#FAFAFA",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 9,
                    fontFamily: "'Inter',sans-serif", transition: "all 0.15s",
                    boxShadow: lockLineArt ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
                  }}>
                  {/* Icon */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: lockLineArt ? "#6366F1" : "#F1F5F9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}>
                    {lockLineArt
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
                    }
                  </div>
                  {/* Labels */}
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: lockLineArt ? "#4F46E5" : "#374151" }}>
                      {lockLineArt ? "Line Art Locked ✓" : "Lock Line Art"}
                    </div>
                    <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1 }}>
                      {lockLineArt ? "Màu vẽ nằm dưới outline" : "Bảo vệ outline khỏi bị tô đè"}
                    </div>
                  </div>
                  {/* Toggle pill */}
                  <div style={{
                    width: 32, height: 18, borderRadius: 9, flexShrink: 0,
                    background: lockLineArt ? "#6366F1" : "#CBD5E1",
                    position: "relative", transition: "background 0.2s",
                  }}>
                    <div style={{
                      position: "absolute", top: 2,
                      left: lockLineArt ? 16 : 2,
                      width: 14, height: 14, borderRadius: "50%",
                      background: "white",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                      transition: "left 0.2s",
                    }} />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* COLOR */}
          <div style={{ borderBottom: "1px solid #F1F5F9" }}>
            <button onClick={() => togglePanel("color")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Palette size={12} color="#F59E0B" /><span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Color</span>
                <div style={{ position: "relative", width: 28, height: 20 }}>
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: 3, background: secondaryColor, border: "1.5px solid white" }} />
                  <div style={{ position: "absolute", top: 0, left: 0, width: 18, height: 18, borderRadius: 4, background: activeColor, border: "1.5px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </div>
              </div>
              {panelOpen.color ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
            </button>
            {panelOpen.color && (
              <div style={{ padding: "0 12px 14px" }}>
                {/* Swatches swap */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ position: "relative", width: 42, height: 38, cursor: "pointer", flexShrink: 0 }} onClick={() => { const t = activeColor; setActiveColor(secondaryColor); setSecondaryColor(t); }}>
                    <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 6, background: secondaryColor, border: "2.5px solid white", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }} />
                    <div style={{ position: "absolute", top: 0, left: 0, width: 30, height: 30, borderRadius: 8, background: activeColor, border: "2.5px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 3 }}>Click swatches to swap</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <div style={{ flex: 1, fontSize: 9, background: "#F1F5F9", borderRadius: 4, padding: "3px 6px", color: "#475569", fontFamily: "monospace", fontWeight: 600 }}>{activeColor.toUpperCase()}</div>
                      <div style={{ flex: 1, fontSize: 9, background: "#F1F5F9", borderRadius: 4, padding: "3px 6px", color: "#475569", fontFamily: "monospace" }}>{secondaryColor.toUpperCase()}</div>
                    </div>
                  </div>
                </div>

                {/* HSV picker */}
                <ColorPickerWheel color={activeColor} onChange={c => { setActiveColor(c); setRecentColors(prev => [c, ...prev.filter(x => x !== c)].slice(0, 10)); }} />

                {/* Palette */}
                <div style={{ marginTop: 12, marginBottom: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Palette</div>
                  {PALETTE_ROWS.map((row, ri) => (
                    <div key={ri} style={{ display: "flex", gap: 2, marginBottom: 2 }}>
                      {row.map(c => (
                        <button key={c} onClick={() => { setActiveColor(c); setRecentColors(prev => [c, ...prev.filter(x => x !== c)].slice(0, 10)); }} title={c}
                          style={{ flex: 1, aspectRatio: "1", borderRadius: 3, background: c, border: activeColor === c ? "2px solid #3B82F6" : c === "#FFFFFF" ? "1px solid #E2E8F0" : "none", cursor: "pointer", position: "relative", outline: "none", transition: "transform 0.08s", minWidth: 0, padding: 0 }} />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Recent colors */}
                {recentColors.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Recent</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {recentColors.map((c, i) => (
                        <button key={i} onClick={() => setActiveColor(c)} title={c}
                          style={{ width: 18, height: 18, borderRadius: 4, background: c, border: activeColor === c ? "2px solid #3B82F6" : "1px solid #E2E8F0", cursor: "pointer", flexShrink: 0, padding: 0 }} />
                      ))}
                    </div>
                  </div>
                )}

                <button style={{ width: "100%", marginTop: 10, padding: "6px", borderRadius: 7, border: "1.5px dashed #CBD5E1", background: "white", cursor: "pointer", fontSize: 10, fontWeight: 500, color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "'Inter',sans-serif" }}>
                  <Plus size={10} />Add to Palette
                </button>
              </div>
            )}
          </div>

          {/* STROKE / FILL SETTINGS — contextual by active tool */}
          <div style={{ borderBottom: "1px solid #F1F5F9" }}>
            <button onClick={() => togglePanel("brush")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sliders size={12} color="#22D3EE" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>
                  {activeTool === "fill" ? "Fill Settings" : "Stroke Settings"}
                </span>
                <span style={{ fontSize: 9, color: "#64748B", background: "#F1F5F9", padding: "1px 5px", borderRadius: 3, fontFamily: "monospace", letterSpacing: 0.5 }}>
                  {activeTool === "brush" ? "B" : activeTool === "pencil" ? "P" : activeTool === "eraser" ? "E" : activeTool === "picker" ? "I" : activeTool === "fill" ? "F" : ""}
                </span>
              </div>
              {panelOpen.brush ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
            </button>
            {panelOpen.brush && (
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

                {/* ── Fill tool settings ── */}
                {activeTool === "fill" && (
                  <>
                    {/* Fill preview chip */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E293B", borderRadius: 8, padding: "10px 12px", border: "1px solid #2D3748" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: activeColor, flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }} />
                      <div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Fill Preview</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{activeColor.toUpperCase()} · {opacity}% opacity</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Tolerance {fillTolerance} · Gap close {gapClose ? "ON" : "OFF"}</div>
                      </div>
                    </div>
                    <Slider label="Opacity" value={opacity} onChange={setOpacity} />
                    <Slider label="Tolerance" value={fillTolerance} onChange={setFillTolerance} min={0} max={128} unit="" />
                    <div style={{ background: "#F8FAFF", borderRadius: 7, padding: "8px 10px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 9, color: "#64748B", marginBottom: 6, lineHeight: 1.5 }}>
                        <strong style={{ color: "#374151" }}>Tolerance</strong> — how similar a pixel's color must be to get filled. Lower = stricter (fills exact color only). Higher = more lenient (fills similar colors too).
                      </div>
                      <div style={{ fontSize: 9, color: "#64748B", lineHeight: 1.5 }}>
                        <strong style={{ color: "#374151" }}>Gap Close</strong> — seals hairline gaps in line art so fill can't bleed through thin outlines.
                      </div>
                    </div>
                    {/* Gap close toggle */}
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${gapClose ? "#3B82F6" : "#E2E8F0"}`, background: gapClose ? "#EFF6FF" : "white", transition: "all 0.15s" }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: gapClose ? "#1D4ED8" : "#374151" }}>Gap Closing</div>
                        <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1 }}>Prevent bleed through thin lines</div>
                      </div>
                      <div onClick={() => setGapClose(!gapClose)}
                        style={{ width: 32, height: 18, borderRadius: 9, background: gapClose ? "#3B82F6" : "#E2E8F0", position: "relative", flexShrink: 0, transition: "background 0.2s", cursor: "pointer" }}>
                        <div style={{ position: "absolute", top: 2, left: gapClose ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                      </div>
                    </label>
                  </>
                )}

                {/* ── Brush / Pencil / Eraser settings ── */}
                {activeTool !== "fill" && activeTool !== "picker" && (
                  <>
                    {/* Live preview */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E293B", borderRadius: 8, padding: "10px 12px", border: "1px solid #2D3748" }}>
                      <div style={{
                        width: Math.max(6, Math.min(44, brushSize)),
                        height: Math.max(6, Math.min(44, brushSize)),
                        borderRadius: activeTool === "pencil" ? "3px" : "50%",
                        background: activeColor, opacity: opacity / 100, flexShrink: 0,
                        transition: "all 0.15s",
                        boxShadow: activeTool === "brush" && hardness < 70 ? `0 0 ${brushSize * (1 - hardness / 100) * 0.5}px ${activeColor}88` : "none"
                      }} />
                      <div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                          {activeTool === "brush" ? "Smooth Brush" : activeTool === "pencil" ? "Hard Pencil" : "Eraser"}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{brushSize}px · {opacity}% opacity</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "capitalize" }}>
                          {blendMode.replace("source-over", "Normal")}
                          {activeTool === "brush" ? " · Smooth ON" : activeTool === "pencil" ? " · Hard edges" : ""}
                        </div>
                      </div>
                    </div>
                    <Slider label="Size" value={brushSize} onChange={setBrushSize} min={1} max={100} unit="px" />
                    <Slider label="Opacity" value={opacity} onChange={setOpacity} />
                    {/* Hardness only relevant for brush */}
                    {activeTool === "brush" && (
                      <Slider label="Hardness" value={hardness} onChange={setHardness} />
                    )}
                    <Slider label="Flow" value={flow} onChange={setFlow} />
                    <Slider label="Spacing" value={spacing} onChange={setSpacing} max={50} unit="%" />
                    {/* Blend mode */}
                    <div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, marginBottom: 4 }}>Blend Mode</div>
                      <select value={blendMode} onChange={e => setBlendMode(e.target.value as BlendMode)}
                        style={{ width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #E2E8F0", background: "white", fontSize: 11, color: "#1E293B", fontFamily: "'Inter',sans-serif", cursor: "pointer" }}>
                        {BLEND_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* ── Color Picker hint ── */}
                {activeTool === "picker" && (
                  <div style={{ background: "#F8FAFF", borderRadius: 8, padding: "12px", border: "1px solid #E2E8F0", textAlign: "center" }}>
                    <Pipette size={18} color="#3B82F6" style={{ margin: "0 auto 6px" }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 }}>Color Picker</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.5 }}>Click anywhere on the canvas to sample that color as your primary color.</div>
                  </div>
                )}

                {/* ── AI options (always visible) ── */}
                <div style={{ paddingTop: 4, borderTop: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>AI Options</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[{ label: "Improve Edge Detection", val: improveEdge, set: setImproveEdge }, { label: "Preserve Line Art", val: preserveLines, set: setPreserveLines }, { label: "Smart Skin Tone", val: skinTone, set: setSkinTone }].map(({ label, val, set }) => (
                      <label key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#374151", cursor: "pointer" }}>
                        <div onClick={() => set(!val)} style={{ width: 14, height: 14, borderRadius: 3, border: val ? "none" : "1.5px solid #CBD5E1", background: val ? "#3B82F6" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                          {val && <Check size={8} color="white" strokeWidth={3} />}
                        </div>{label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* IMAGE ADJUSTMENTS */}
          <div>
            <button onClick={() => togglePanel("adjust")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Contrast size={12} color="#F59E0B" /><span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Image Adjustments</span></div>
              {panelOpen.adjust ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
            </button>
            {panelOpen.adjust && (
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[{ label: "Brightness", icon: <Sun size={10} color="#F59E0B" />, val: brightness, set: setBrightness }, { label: "Contrast", icon: <Contrast size={10} color="#3B82F6" />, val: contrastVal, set: setContrastVal }, { label: "Saturation", icon: <Droplets size={10} color="#8B5CF6" />, val: saturation, set: setSaturation }, { label: "Blur Areas", icon: <Wind size={10} color="#22D3EE" />, val: blur, set: setBlur }, { label: "Color Spill", icon: <X size={10} color="#EF4444" />, val: spill, set: setSpill }, { label: "Rebalance", icon: <RefreshCw size={10} color="#10B981" />, val: tones, set: setTones }].map(({ label, icon, val, set }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{icon}<span style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{label}</span></div>
                      <span style={{ fontSize: 9, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{val}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={val} onChange={e => set(Number(e.target.value))} style={{ width: "100%", accentColor: "#3B82F6", height: 3, cursor: "pointer" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── CONTEXT MENU ─────────────────────────────── */}
      {contextMenu !== null && (
        <>
          <div onMouseDown={() => setContextMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
          <div style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 200, background: "white", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #E2E8F0", minWidth: 220, overflow: "hidden", fontFamily: "'Inter',sans-serif" }}>
            <div style={{ padding: "9px 13px 7px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {uncoloredFiles[contextMenu.frameIndex] && <img src={uncoloredFiles[contextMenu.frameIndex].url} alt="" style={{ width: 20, height: 20, borderRadius: 3, objectFit: "cover", border: "1px solid #E2E8F0" }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Frame {contextMenu.frameIndex + 1}</span>
                {frameStates[contextMenu.frameIndex] === "ai" && <span style={{ fontSize: 8, fontWeight: 600, color: "#8B5CF6", background: "#F3F0FF", padding: "1px 5px", borderRadius: 100 }}>AI</span>}
                {frameStates[contextMenu.frameIndex] === "manual" && <span style={{ fontSize: 8, fontWeight: 600, color: "#F59E0B", background: "#FFFBEB", padding: "1px 5px", borderRadius: 100 }}>Manual</span>}
              </div>
            </div>
            <div style={{ padding: "5px 0" }}>
              {referenceImage && (
                <button onMouseDown={e => { e.stopPropagation(); handleSetFrameRef(contextMenu.frameIndex); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 5, overflow: "hidden", flexShrink: 0, border: "1.5px solid #E2E8F0" }}><img src={referenceImage.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                  <div><div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>Assign Current Ref</div><div style={{ fontSize: 9, color: "#94A3B8", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referenceImage.name}</div></div>
                </button>
              )}
              {(frameStates[contextMenu.frameIndex] === "ai" || frameStates[contextMenu.frameIndex] === "manual") && (
                <button onMouseDown={e => { e.stopPropagation(); handleSetFrameAsGlobalRef(contextMenu.frameIndex); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 5, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid #FDE68A" }}><Star size={13} color="#F59E0B" fill="#F59E0B" /></div>
                  <div><div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>Set as Global Reference</div><div style={{ fontSize: 9, color: "#94A3B8" }}>Guide AI with this frame</div></div>
                </button>
              )}
              <button onMouseDown={e => { e.stopPropagation(); const idx = contextMenu.frameIndex; setFrameStates(prev => { const n = [...prev]; n[idx] = "ai"; return n; }); setContextMenu(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}>
                <div style={{ width: 26, height: 26, borderRadius: 5, background: "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Sparkles size={13} color="#8B5CF6" /></div>
                <div><div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>AI Color This Frame</div><div style={{ fontSize: 9, color: "#94A3B8" }}>Using current reference</div></div>
              </button>
              {frameRefMap[contextMenu.frameIndex] && (
                <>
                  <div style={{ height: 1, background: "#F1F5F9", margin: "3px 0" }} />
                  <button onMouseDown={e => { e.stopPropagation(); handleClearFrameRef(contextMenu.frameIndex); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}>
                    <div style={{ width: 26, height: 26, borderRadius: 5, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={13} color="#EF4444" /></div>
                    <div><div style={{ fontSize: 11, fontWeight: 600, color: "#EF4444" }}>Remove Ref Assignment</div><div style={{ fontSize: 9, color: "#94A3B8" }}>Use global reference</div></div>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── REFERENCE MODAL ──────────────────────────── */}
      {showReferenceModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowReferenceModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 600, boxShadow: "0 32px 80px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "88vh" }}>
            <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
              <div><h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", margin: 0 }}>Set Reference Image</h2><p style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>Choose a frame or upload a colored reference for AI guidance.</p></div>
              <button onClick={() => setShowReferenceModal(false)} style={{ background: "#F1F5F9", border: "none", borderRadius: 7, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0, marginLeft: 10 }}><X size={13} /></button>
            </div>
            <div style={{ padding: "12px 22px 0", display: "flex", gap: 2, borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
              {[{ id: "list" as const, label: "From Uncolored List", icon: <List size={11} /> }, { id: "upload" as const, label: "Upload Colored Image", icon: <Upload size={11} /> }].map(tab => (
                <button key={tab.id} onClick={() => setRefModalTab(tab.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 12px", borderRadius: "6px 6px 0 0", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: refModalTab === tab.id ? 600 : 400, color: refModalTab === tab.id ? "#3B82F6" : "#64748B", borderBottom: refModalTab === tab.id ? "2px solid #3B82F6" : "2px solid transparent", marginBottom: -1, transition: "all 0.15s" }}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", scrollbarWidth: "thin" }}>
              {refModalTab === "list" ? (
                uncoloredFiles.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
                    <FileImage size={34} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>No uncolored files yet</p>
                    <p style={{ fontSize: 12 }}>Use "Import Uncolored Files" in the sidebar first.</p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>{uncoloredFiles.length} file{uncoloredFiles.length !== 1 ? "s" : ""} — click to select</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                      {uncoloredFiles.map(frame => {
                        const isSel = selectedRefId === frame.id;
                        return (
                          <button key={frame.id} onClick={() => setSelectedRefId(isSel ? null : frame.id)} style={{ border: isSel ? "2.5px solid #3B82F6" : "2px solid #E2E8F0", borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0, background: "white", position: "relative", boxShadow: isSel ? "0 0 0 3px rgba(59,130,246,0.16)" : "none", transition: "all 0.15s" }}>
                            <img src={frame.url} alt={frame.name} style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }} />
                            {isSel && <div style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={10} color="white" strokeWidth={3} /></div>}
                            <div style={{ padding: "5px 8px", background: isSel ? "#EFF6FF" : "#FAFAFA", borderTop: "1px solid #F1F5F9" }}>
                              <p style={{ fontSize: 9, fontWeight: 600, color: isSel ? "#3B82F6" : "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{frame.name}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )
              ) : (
                <div onClick={() => customColoredInputRef.current?.click()} style={{ border: "2px dashed #CBD5E1", borderRadius: 12, padding: "36px 22px", textAlign: "center", cursor: "pointer", background: "#FAFAFA" }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Upload size={20} color="#3B82F6" /></div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 3 }}>Click to upload a colored image</p>
                  <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 14 }}>PNG, JPG or PSD — used as the AI color reference</p>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 8, background: "#3B82F6", color: "white", fontSize: 12, fontWeight: 600 }}><Upload size={11} />Browse Files</div>
                </div>
              )}
            </div>
            <div style={{ padding: "12px 22px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                {selectedRefId && refModalTab === "list" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <img src={uncoloredFiles.find(f => f.id === selectedRefId)?.url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                    <span style={{ fontSize: 11, color: "#475569" }}><strong style={{ color: "#1E293B" }}>{uncoloredFiles.find(f => f.id === selectedRefId)?.name}</strong> selected</span>
                  </div>
                ) : <span style={{ fontSize: 11, color: "#94A3B8" }}>{refModalTab === "list" ? "No frame selected" : "Select a file above"}</span>}
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={() => setShowReferenceModal(false)} style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#475569", fontFamily: "'Inter',sans-serif" }}>Cancel</button>
                {refModalTab === "list" && (
                  <button onClick={handleConfirmReference} disabled={!selectedRefId} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: selectedRefId ? "#3B82F6" : "#E2E8F0", cursor: selectedRefId ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, color: selectedRefId ? "white" : "#94A3B8", fontFamily: "'Inter',sans-serif", boxShadow: selectedRefId ? "0 2px 8px rgba(59,130,246,0.25)" : "none", transition: "all 0.15s" }}>Use as Reference</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}