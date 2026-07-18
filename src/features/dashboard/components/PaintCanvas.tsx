import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";
import type { Tool, BlendMode } from "../types";
import { hexToRgb, rgbToHex } from "../utils/colorUtils";

export interface PaintCanvasHandle {
  /** Returns a merged canvas (colorRef + bgRef + canvasRef) as a Blob */
  getFlattenedBlob: () => Promise<Blob | null>;
  /** Returns the merged result as a dataURL string (for undo snapshots) */
  getFlattenedDataUrl: () => string | null;
  /** Returns only the editable paint/color layer. Used when switching frames. */
  getPaintLayerDataUrl: () => string | null;
  /** Recolors one encoded segment directly on the editable layer. */
  recolorSegment: (segmentId: number, colorHex: string, opacityOverride?: number) => boolean;
}

interface PaintCanvasProps {
  imageUrl: string | null;
  paintUrl?: string | null;
  tool: Tool;
  color: string;
  brushSize: number;
  opacity: number;
  hardness: number;
  blendMode: BlendMode;
  fillTolerance: number;
  gapClose: boolean;
  onColorPicked: (c: string) => void;
  onStroke: () => void;
  onBeforeStroke: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  smudgeStrength?: number;
  dodgeExposure?: number;
  burnExposure?: number;
  segmentMapUrl?: string | null;
  selectedSegmentId?: number | null;
  segmentPickMode?: boolean;
  onSegmentPicked?: (segmentId: number) => void;
  lowConfidenceOverlayUrl?: string | null;
  showLowConfidenceOverlay?: boolean;
}

export const PaintCanvas = forwardRef<PaintCanvasHandle, PaintCanvasProps>(function PaintCanvas({
  imageUrl,
  paintUrl,
  tool,
  color,
  brushSize,
  opacity,
  hardness,
  blendMode,
  fillTolerance,
  gapClose,
  onColorPicked,
  onStroke,
  onBeforeStroke,
  canvasRef,
  smudgeStrength = 50,
  dodgeExposure = 50,
  burnExposure = 50,
  segmentMapUrl = null,
  selectedSegmentId = null,
  segmentPickMode = false,
  onSegmentPicked,
  lowConfidenceOverlayUrl = null,
  showLowConfidenceOverlay = false,
}: PaintCanvasProps, ref: React.Ref<PaintCanvasHandle>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<HTMLCanvasElement>(null);
  const segmentHighlightRef = useRef<HTMLCanvasElement>(null);
  const segmentMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const painting = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const pointBuffer = useRef<{ x: number; y: number }[]>([]);
  const paintLoadVersionRef = useRef(0);
  const segmentMapLoadVersionRef = useRef(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [sourceSize, setSourceSize] = useState({ width: 16, height: 9 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const sourceAspect = sourceSize.width / Math.max(1, sourceSize.height);
  const containerAspect = containerSize.width / Math.max(1, containerSize.height);
  const fittedStage = containerSize.width > 0 && containerSize.height > 0
    ? containerAspect > sourceAspect
      ? { width: containerSize.height * sourceAspect, height: containerSize.height }
      : { width: containerSize.width, height: containerSize.width / sourceAspect }
    : null;

  const paintTarget = (): HTMLCanvasElement =>
    canvasRef.current!;

  const decodeSegmentId = (data: Uint8ClampedArray, index: number) =>
    data[index] + (data[index + 1] << 8) + (data[index + 2] << 16);

  const getSegmentIdAt = (x: number, y: number): number | null => {
    const mapCanvas = segmentMapCanvasRef.current;
    if (!mapCanvas) return null;
    const mapCtx = mapCanvas.getContext("2d", { willReadFrequently: true });
    if (!mapCtx) return null;
    const px = Math.floor(Math.max(0, Math.min(mapCanvas.width - 1, x)));
    const py = Math.floor(Math.max(0, Math.min(mapCanvas.height - 1, y)));
    const data = mapCtx.getImageData(px, py, 1, 1).data;
    const id = decodeSegmentId(data, 0);
    return id > 0 ? id : null;
  };

  const drawSelectedSegmentHighlight = () => {
    const overlay = segmentHighlightRef.current;
    const mapCanvas = segmentMapCanvasRef.current;
    if (!overlay || !mapCanvas) return;

    overlay.width = mapCanvas.width;
    overlay.height = mapCanvas.height;
    const outCtx = overlay.getContext("2d")!;
    outCtx.clearRect(0, 0, overlay.width, overlay.height);

    if (!selectedSegmentId) return;

    const mapCtx = mapCanvas.getContext("2d", { willReadFrequently: true });
    if (!mapCtx) return;
    const src = mapCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height);
    const dst = outCtx.createImageData(mapCanvas.width, mapCanvas.height);
    const sd = src.data;
    const dd = dst.data;
    for (let i = 0; i < sd.length; i += 4) {
      const id = decodeSegmentId(sd, i);
      if (id === selectedSegmentId) {
        dd[i] = 59;
        dd[i + 1] = 130;
        dd[i + 2] = 246;
        dd[i + 3] = 95;
      }
    }
    outCtx.putImageData(dst, 0, 0);
  };

  const recolorSegmentOnCanvas = (segmentId: number, colorHex: string, opacityOverride?: number): boolean => {
    const mapCanvas = segmentMapCanvasRef.current;
    const cv = canvasRef.current;
    if (!mapCanvas || !cv || !segmentId) return false;

    const mapCtx = mapCanvas.getContext("2d", { willReadFrequently: true });
    const paintCtx = cv.getContext("2d", { willReadFrequently: true });
    if (!mapCtx || !paintCtx) return false;

    const mapData = mapCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height).data;
    const paintId = paintCtx.getImageData(0, 0, cv.width, cv.height);
    const pd = paintId.data;
    const { r, g, b } = hexToRgb(colorHex);
    const alpha = Math.round((Math.min(100, Math.max(0, opacityOverride ?? opacity)) / 100) * 255);
    let changed = false;

    for (let i = 0; i < mapData.length; i += 4) {
      const id = decodeSegmentId(mapData, i);
      if (id !== segmentId) continue;
      pd[i] = r;
      pd[i + 1] = g;
      pd[i + 2] = b;
      pd[i + 3] = alpha;
      changed = true;
    }

    if (changed) paintCtx.putImageData(paintId, 0, 0);
    return changed;
  };

  // ── Expose flattened canvas to parent ─────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getFlattenedBlob: () =>
      new Promise<Blob | null>((resolve) => {
        const bg = bgRef.current;
        if (!bg) return resolve(null);
        const tmp = document.createElement("canvas");
        tmp.width = bg.width;
        tmp.height = bg.height;
        const ctx = tmp.getContext("2d")!;
        if (colorRef.current) ctx.drawImage(colorRef.current, 0, 0);
        if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
        ctx.drawImage(bg, 0, 0);
        tmp.toBlob(resolve, "image/png");
      }),
    getFlattenedDataUrl: () => {
      const bg = bgRef.current;
      if (!bg) return null;
      const tmp = document.createElement("canvas");
      tmp.width = bg.width;
      tmp.height = bg.height;
      const ctx = tmp.getContext("2d")!;
      if (colorRef.current) ctx.drawImage(colorRef.current, 0, 0);
      if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
      ctx.drawImage(bg, 0, 0);
      return tmp.toDataURL();
    },
    getPaintLayerDataUrl: () => {
      const cv = canvasRef.current;
      if (!cv || !cv.width || !cv.height) return null;
      const ctx = cv.getContext("2d");
      if (!ctx) return null;
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let hasVisiblePixel = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          hasVisiblePixel = true;
          break;
        }
      }
      if (!hasVisiblePixel) return null;
      return cv.toDataURL("image/png");
    },
    recolorSegment: recolorSegmentOnCanvas,
    }), [opacity]);

  const fillBaseLayer = (width: number, height: number) => {
    const base = colorRef.current;
    if (!base) return;
    base.width = width;
    base.height = height;
    const baseCtx = base.getContext("2d")!;
    baseCtx.clearRect(0, 0, width, height);
    baseCtx.fillStyle = "#FFFFFF";
    baseCtx.fillRect(0, 0, width, height);
  };

  const drawTransparentLineart = (img: HTMLImageElement, lineCanvas: HTMLCanvasElement) => {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    lineCanvas.width = width;
    lineCanvas.height = height;

    const tmp = document.createElement("canvas");
    tmp.width = width;
    tmp.height = height;
    const tmpCtx = tmp.getContext("2d")!;
    tmpCtx.drawImage(img, 0, 0, width, height);

    const imageData = tmpCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Keep dark and anti-aliased line pixels, make white paper transparent.
      if (lum < 245) {
        const alpha = Math.min(255, Math.max(40, Math.round((245 - lum) * 3.2)));
        data[i] = Math.min(r, 48);
        data[i + 1] = Math.min(g, 48);
        data[i + 2] = Math.min(b, 48);
        data[i + 3] = alpha;
      } else {
        data[i + 3] = 0;
      }
    }

    const ctx = lineCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(imageData, 0, 0);
  };

  const loadPaintLayer = (url: string | null | undefined, loadVersion: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!url) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (loadVersion !== paintLoadVersionRef.current) return;
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;
      const currentCtx = currentCanvas.getContext("2d")!;
      currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
      currentCtx.drawImage(img, 0, 0, currentCanvas.width, currentCanvas.height);
    };
    img.src = url;
  };

  // ── Load source sketch as transparent lineart layer ───────────────────────
  useEffect(() => {
    const loadVersion = ++paintLoadVersionRef.current;
    const lineCanvas = bgRef.current;
    if (!lineCanvas) return;
    const lineCtx = lineCanvas.getContext("2d")!;
    if (!imageUrl) {
      const width = lineCanvas.width || 800;
      const height = lineCanvas.height || 600;
      setSourceSize({ width, height });
      lineCanvas.width = width;
      lineCanvas.height = height;
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        canvasRef.current.getContext("2d")?.clearRect(0, 0, width, height);
      }
      fillBaseLayer(width, height);
      lineCtx.clearRect(0, 0, width, height);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (loadVersion !== paintLoadVersionRef.current) return;
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      setSourceSize({ width: W, height: H });
      lineCanvas.width = W;
      lineCanvas.height = H;
      if (canvasRef.current) {
        canvasRef.current.width = W;
        canvasRef.current.height = H;
      }
      if (segmentHighlightRef.current) {
        segmentHighlightRef.current.width = W;
        segmentHighlightRef.current.height = H;
        segmentHighlightRef.current.getContext("2d")?.clearRect(0, 0, W, H);
      }
      fillBaseLayer(W, H);
      drawTransparentLineart(img, lineCanvas);
      loadPaintLayer(paintUrl, loadVersion);
    };
    img.src = imageUrl;
  }, [imageUrl, paintUrl]);

  useEffect(() => {
    const loadVersion = ++segmentMapLoadVersionRef.current;
    if (!segmentMapUrl) {
      segmentMapCanvasRef.current = null;
      segmentHighlightRef.current?.getContext("2d")?.clearRect(
        0,
        0,
        segmentHighlightRef.current.width,
        segmentHighlightRef.current.height,
      );
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (loadVersion !== segmentMapLoadVersionRef.current) return;
      const cv = canvasRef.current;
      if (!cv) return;
      const mapCanvas = document.createElement("canvas");
      mapCanvas.width = cv.width;
      mapCanvas.height = cv.height;
      const mapCtx = mapCanvas.getContext("2d", { willReadFrequently: true })!;
      mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
      mapCtx.drawImage(img, 0, 0, mapCanvas.width, mapCanvas.height);
      segmentMapCanvasRef.current = mapCanvas;
      drawSelectedSegmentHighlight();
    };
    img.src = segmentMapUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentMapUrl, imageUrl]);

  useEffect(() => {
    drawSelectedSegmentHighlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegmentId, segmentMapUrl]);

  // ── Coordinate mapping ─────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent) => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(cv.width - 1, (e.clientX - rect.left) * (cv.width / Math.max(1, rect.width)))),
      y: Math.max(0, Math.min(cv.height - 1, (e.clientY - rect.top) * (cv.height / Math.max(1, rect.height)))),
    };
  };

  // ── Tool: Pencil ───────────────────────────────────────────────────────────
  const drawPencil = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const { r, g, b } = hexToRgb(color);
    ctx.save();
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : (blendMode as GlobalCompositeOperation);
    ctx.globalAlpha = Math.min(1, opacity / 100);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = Math.max(1, brushSize * 0.5);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  // ── Tool: Brush (Catmull-Rom smooth) ──────────────────────────────────────
  const drawBrushSmooth = (
    ctx: CanvasRenderingContext2D,
    pts: { x: number; y: number }[]
  ) => {
    if (pts.length < 2) return;
    const { r, g, b } = hexToRgb(color);
    ctx.save();
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : (blendMode as GlobalCompositeOperation);
    ctx.globalAlpha = opacity / 100;
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool !== "eraser" && hardness < 85) {
      ctx.shadowBlur = brushSize * (1 - hardness / 100) * 1.2;
      ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
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

  // ── Tool: Flood Fill ───────────────────────────────────────────────────────
  // Uses the transparent lineart layer as a hard boundary and adds a small
  // underpaint bleed beneath anti-aliased line pixels. This removes the white
  // halo that normally appears when a fill stops one or two pixels before a line.
  const doFloodFill = (
    paintCtx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) => {
    const { r: fr, g: fg, b: fb } = hexToRgb(color);
    const bg = bgRef.current!;
    const w = bg.width;
    const h = bg.height;
    if (!w || !h) return;

    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tmpCtx = tmp.getContext("2d", { willReadFrequently: true })!;
    if (colorRef.current) tmpCtx.drawImage(colorRef.current, 0, 0);
    if (canvasRef.current) tmpCtx.drawImage(canvasRef.current, 0, 0);
    tmpCtx.drawImage(bg, 0, 0);
    const composite = tmpCtx.getImageData(0, 0, w, h).data;

    const lineCtx = bg.getContext("2d", { willReadFrequently: true });
    if (!lineCtx) return;
    const lineData = lineCtx.getImageData(0, 0, w, h).data;

    // Soft anti-aliased pixels remain paintable underneath; darker pixels form
    // the actual flood boundary. Gap Closing expands that boundary by one pixel.
    let barrier = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p += 1) {
      if (lineData[p * 4 + 3] >= 72) barrier[p] = 1;
    }

    if (gapClose) {
      const closed = barrier.slice();
      for (let py = 0; py < h; py += 1) {
        for (let px = 0; px < w; px += 1) {
          const p = py * w + px;
          if (!barrier[p]) continue;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = px + dx;
              const ny = py + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) closed[ny * w + nx] = 1;
            }
          }
        }
      }
      barrier = closed;
    }

    const sx = Math.floor(Math.max(0, Math.min(w - 1, x)));
    const sy = Math.floor(Math.max(0, Math.min(h - 1, y)));
    const seed = sx + sy * w;
    if (barrier[seed]) return;

    const seedIndex = seed * 4;
    const tr = composite[seedIndex];
    const tg = composite[seedIndex + 1];
    const tb = composite[seedIndex + 2];
    if (Math.abs(tr - fr) <= 1 && Math.abs(tg - fg) <= 1 && Math.abs(tb - fb) <= 1) return;

    const tolerance = Math.max(0, fillTolerance);
    const toleranceSquared = tolerance * tolerance * 3;
    const colorMatch = (pixel: number) => {
      const i = pixel * 4;
      const dr = composite[i] - tr;
      const dg = composite[i + 1] - tg;
      const db = composite[i + 2] - tb;
      return dr * dr + dg * dg + db * db <= toleranceSquared;
    };

    const queue = new Int32Array(w * h);
    const queued = new Uint8Array(w * h);
    const fillMask = new Uint8Array(w * h);
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    queued[seed] = 1;

    const enqueue = (pixel: number) => {
      if (pixel < 0 || pixel >= w * h || queued[pixel]) return;
      queued[pixel] = 1;
      queue[tail++] = pixel;
    };

    while (head < tail) {
      const p = queue[head++];
      if (barrier[p] || !colorMatch(p)) continue;
      fillMask[p] = 1;
      const px = p % w;
      if (px > 0) enqueue(p - 1);
      if (px < w - 1) enqueue(p + 1);
      if (p >= w) enqueue(p - w);
      if (p < w * (h - 1)) enqueue(p + w);
    }

    // Expand two pixels under soft line edges, but never cross the opaque line
    // core. The visible lineart canvas sits above this paint layer.
    let expanded = fillMask;
    const edgeBleedRadius = 2;
    for (let iteration = 0; iteration < edgeBleedRadius; iteration += 1) {
      const next = expanded.slice();
      for (let py = 0; py < h; py += 1) {
        for (let px = 0; px < w; px += 1) {
          const p = py * w + px;
          if (expanded[p] || lineData[p * 4 + 3] >= 225) continue;
          let touchesFill = false;
          for (let dy = -1; dy <= 1 && !touchesFill; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const nx = px + dx;
              const ny = py + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h && expanded[ny * w + nx]) {
                touchesFill = true;
                break;
              }
            }
          }
          if (touchesFill) next[p] = 1;
        }
      }
      expanded = next;
    }

    const paintImage = paintCtx.getImageData(0, 0, w, h);
    const pd = paintImage.data;
    const alpha = Math.round((Math.min(100, Math.max(0, opacity)) / 100) * 255);
    for (let p = 0; p < expanded.length; p += 1) {
      if (!expanded[p]) continue;
      const i = p * 4;
      pd[i] = fr;
      pd[i + 1] = fg;
      pd[i + 2] = fb;
      pd[i + 3] = alpha;
    }
    paintCtx.putImageData(paintImage, 0, 0);
  };

  // ── Tool: Color Picker ─────────────────────────────────────────────────────
  const doPickColor = (x: number, y: number) => {
    const bg = bgRef.current!;
    const tmp = document.createElement("canvas");
    tmp.width = bg.width;
    tmp.height = bg.height;
    const ctx = tmp.getContext("2d")!;
    if (colorRef.current) ctx.drawImage(colorRef.current, 0, 0);
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
    ctx.drawImage(bg, 0, 0);
    const px = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    onColorPicked(rgbToHex(px[0], px[1], px[2]));
  };

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  // ── Tool: Smudge (Blend pixels from base layer) ────────────────────────────
  const drawSmudge = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    strength: number = 50
  ) => {
    const bg = bgRef.current!;
    const w = bg.width,
      h = bg.height;

    // Build reference canvas (base layer for sampling)
    const refCanvas = document.createElement("canvas");
    refCanvas.width = w;
    refCanvas.height = h;
    const refCtx = refCanvas.getContext("2d")!;
    if (colorRef.current) refCtx.drawImage(colorRef.current, 0, 0);
    if (canvasRef.current) refCtx.drawImage(canvasRef.current, 0, 0);
    refCtx.drawImage(bg, 0, 0);

    const refData = refCtx.getImageData(0, 0, w, h).data;
    const brushRadius = Math.ceil(brushSize / 2);
    const normalizedStrength = Math.min(1, strength / 100);

    // Interpolate along line
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist) + 1;

    for (let step = 0; step < steps; step++) {
      const t = steps > 1 ? step / steps : 0;
      const x = Math.round(from.x + dx * t);
      const y = Math.round(from.y + dy * t);

      // Sample neighborhood and compute average
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dy2 = -brushRadius; dy2 <= brushRadius; dy2++) {
        for (let dx2 = -brushRadius; dx2 <= brushRadius; dx2++) {
          const nx = x + dx2, ny = y + dy2;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const i = (ny * w + nx) * 4;
            sumR += refData[i];
            sumG += refData[i + 1];
            sumB += refData[i + 2];
            count++;
          }
        }
      }

      if (count === 0) continue;
      const avgR = Math.round(sumR / count);
      const avgG = Math.round(sumG / count);
      const avgB = Math.round(sumB / count);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = (opacity / 100) * normalizedStrength;
      ctx.fillStyle = `rgb(${avgR},${avgG},${avgB})`;
      ctx.beginPath();
      ctx.arc(x, y, brushRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // ── Tool: Dodge (Lighten) ──────────────────────────────────────────────────
  const drawDodge = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    exposure: number = 50
  ) => {
    const bg = bgRef.current!;
    const w = bg.width,
      h = bg.height;

    // Build reference canvas
    const refCanvas = document.createElement("canvas");
    refCanvas.width = w;
    refCanvas.height = h;
    const refCtx = refCanvas.getContext("2d")!;
    if (colorRef.current) refCtx.drawImage(colorRef.current, 0, 0);
    if (canvasRef.current) refCtx.drawImage(canvasRef.current, 0, 0);
    refCtx.drawImage(bg, 0, 0);

    const refData = refCtx.getImageData(0, 0, w, h).data;
    const paintId = ctx.getImageData(0, 0, w, h);
    const pd = paintId.data;

    const brushRadius = Math.ceil(brushSize / 2);
    const normalizedExposure = Math.min(1, exposure / 100);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist) + 1;

    for (let step = 0; step < steps; step++) {
      const t = steps > 1 ? step / steps : 0;
      const cx = Math.round(from.x + dx * t);
      const cy = Math.round(from.y + dy * t);

      for (let dy2 = -brushRadius; dy2 <= brushRadius; dy2++) {
        for (let dx2 = -brushRadius; dx2 <= brushRadius; dx2++) {
          const x = cx + dx2, y = cy + dy2;
          if (x >= 0 && x < w && y >= 0 && y < h) {
            const idx = (y * w + x) * 4;

            // Sample base layer brightness
            const baseR = refData[idx];
            const baseG = refData[idx + 1];
            const baseB = refData[idx + 2];
            const baseBrightness = (baseR + baseG + baseB) / 3;

            // Lighten: boost brightness (Overlay blend logic)
            const factor = 1 + normalizedExposure * 0.5;
            const newR = Math.min(255, Math.round(baseR * factor));
            const newG = Math.min(255, Math.round(baseG * factor));
            const newB = Math.min(255, Math.round(baseB * factor));

            // Blend onto paint layer with soft opacity
            const blendAlpha = (opacity / 100) * normalizedExposure * 0.6;
            pd[idx] = Math.round(pd[idx] * (1 - blendAlpha) + newR * blendAlpha);
            pd[idx + 1] = Math.round(pd[idx + 1] * (1 - blendAlpha) + newG * blendAlpha);
            pd[idx + 2] = Math.round(pd[idx + 2] * (1 - blendAlpha) + newB * blendAlpha);
            pd[idx + 3] = Math.max(pd[idx + 3], Math.round(blendAlpha * 255));
          }
        }
      }
    }

    ctx.putImageData(paintId, 0, 0);
  };

  // ── Tool: Burn (Darken) ────────────────────────────────────────────────────
  const drawBurn = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    exposure: number = 50
  ) => {
    const bg = bgRef.current!;
    const w = bg.width,
      h = bg.height;

    // Build reference canvas
    const refCanvas = document.createElement("canvas");
    refCanvas.width = w;
    refCanvas.height = h;
    const refCtx = refCanvas.getContext("2d")!;
    if (colorRef.current) refCtx.drawImage(colorRef.current, 0, 0);
    if (canvasRef.current) refCtx.drawImage(canvasRef.current, 0, 0);
    refCtx.drawImage(bg, 0, 0);

    const refData = refCtx.getImageData(0, 0, w, h).data;
    const paintId = ctx.getImageData(0, 0, w, h);
    const pd = paintId.data;

    const brushRadius = Math.ceil(brushSize / 2);
    const normalizedExposure = Math.min(1, exposure / 100);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist) + 1;

    for (let step = 0; step < steps; step++) {
      const t = steps > 1 ? step / steps : 0;
      const cx = Math.round(from.x + dx * t);
      const cy = Math.round(from.y + dy * t);

      for (let dy2 = -brushRadius; dy2 <= brushRadius; dy2++) {
        for (let dx2 = -brushRadius; dx2 <= brushRadius; dx2++) {
          const x = cx + dx2, y = cy + dy2;
          if (x >= 0 && x < w && y >= 0 && y < h) {
            const idx = (y * w + x) * 4;

            // Sample base layer
            const baseR = refData[idx];
            const baseG = refData[idx + 1];
            const baseB = refData[idx + 2];

            // Darken: reduce brightness (Overlay blend logic)
            const factor = 1 - normalizedExposure * 0.5;
            const newR = Math.round(baseR * factor);
            const newG = Math.round(baseG * factor);
            const newB = Math.round(baseB * factor);

            // Blend onto paint layer
            const blendAlpha = (opacity / 100) * normalizedExposure * 0.6;
            pd[idx] = Math.round(pd[idx] * (1 - blendAlpha) + newR * blendAlpha);
            pd[idx + 1] = Math.round(pd[idx + 1] * (1 - blendAlpha) + newG * blendAlpha);
            pd[idx + 2] = Math.round(pd[idx + 2] * (1 - blendAlpha) + newB * blendAlpha);
            pd[idx + 3] = Math.max(pd[idx + 3], Math.round(blendAlpha * 255));
          }
        }
      }
    }

    ctx.putImageData(paintId, 0, 0);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getPos(e);
    const cv = paintTarget();
    const ctx = cv.getContext("2d")!;

    if (segmentPickMode) {
      const id = getSegmentIdAt(pos.x, pos.y);
      if (id && onSegmentPicked) onSegmentPicked(id);
      return;
    }

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
    painting.current = true;
    lastPos.current = pos;
    pointBuffer.current = [pos];
    onBeforeStroke();
    if (tool === "pencil" || tool === "eraser") {
      drawPencil(ctx, pos, pos);
    } else if (tool === "smudge" || tool === "dodge" || tool === "burn") {
      // These tools are handled in onMouseMove
    } else {
      drawBrushSmooth(ctx, [pos, pos]);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!painting.current || !lastPos.current) return;
    const pos = getPos(e);
    const cv = paintTarget();
    const ctx = cv.getContext("2d")!;

    if (tool === "pencil") {
      drawPencil(ctx, lastPos.current, pos);
      lastPos.current = pos;
    } else if (tool === "smudge") {
      drawSmudge(ctx, lastPos.current, pos, smudgeStrength);
      lastPos.current = pos;
    } else if (tool === "dodge") {
      drawDodge(ctx, lastPos.current, pos, dodgeExposure);
      lastPos.current = pos;
    } else if (tool === "burn") {
      drawBurn(ctx, lastPos.current, pos, burnExposure);
      lastPos.current = pos;
    } else {
      pointBuffer.current.push(pos);
      if (pointBuffer.current.length > 8) pointBuffer.current.shift();
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
    if (segmentPickMode) return "crosshair";
    if (tool === "picker") return "crosshair";
    if (tool === "fill") return "cell";
    const sz = Math.max(8, Math.min(64, brushSize));
    const isPencil = tool === "pencil";
    const strokeColor =
      tool === "eraser"
        ? encodeURIComponent("rgba(255,255,255,0.85)")
        : isPencil
        ? encodeURIComponent("rgba(30,30,30,0.9)")
        : encodeURIComponent("rgba(0,0,0,0.65)");
    const shape = `<circle cx='${sz / 2}' cy='${sz / 2}' r='${sz / 2 - 1.5}' fill='none' stroke='${strokeColor}' stroke-width='1.5'/><circle cx='${sz / 2}' cy='${sz / 2}' r='1' fill='${strokeColor}'/>`;
    return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}'>${shape}</svg>") ${sz / 2} ${sz / 2}, crosshair`;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: 14,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: fittedStage ? `${fittedStage.width}px` : "100%",
          height: fittedStage ? `${fittedStage.height}px` : "100%",
          overflow: "hidden",
        }}
      >
        {/* Layer 1 — base color layer */}
        <canvas
          ref={colorRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
        {/* Layer 2 — editable AI/manual color layer + event receiver */}
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            cursor: getCursor(),
            zIndex: 2,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
        {/* Layer 3 — sketch/line art stays on top so color never hides outlines */}
        <canvas
          ref={bgRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 3,
            pointerEvents: "none",
          }}
        />
        {showLowConfidenceOverlay && lowConfidenceOverlayUrl && (
          <img
            src={lowConfidenceOverlayUrl}
            alt="Low confidence overlay"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "fill",
              zIndex: 4,
              pointerEvents: "none",
              opacity: 1,
              filter: "drop-shadow(0 0 2px rgba(255,190,35,0.35))",
            }}
          />
        )}
        <canvas
          ref={segmentHighlightRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 5,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
});
