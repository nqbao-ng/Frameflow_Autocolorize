import { useState, useEffect, useRef, useCallback } from "react";
import JSZip from "jszip";
import type { Tool, BlendMode, FrameState, ImportedFile, ContextMenu } from "../types";
import type { PaintCanvasHandle } from "../components/PaintCanvas";
import { removeFrameImage, uploadFrameImage } from "../services/storage.api";
import { createFrame, deleteFrame as deleteFrameApi, getNextFrameIndex } from "../services/frame.api";
import { useParams } from "react-router";
import { loadFrames } from "../services/frame.api";
import {
  uploadColoredFrame,
} from "../services/storage.api";

import {
  updateFrameColor,
} from "../services/frame.api";
import type { ToastMessage } from "../components/Toast";
import {
  cancelColorizationJob,
  continueColorizationJob,
  getColorizationState,
  getFrameReviewState,
  startColorizationJob,
  type ReviewState,
} from "../services/colorization.api";

function normalizeImportedFrame(frame: any): ImportedFile {
  return {
    id: frame.id,
    name: frame.name || `Frame ${Number(frame.frame_index ?? 0) + 1}`,
    url: frame.source_image_url,
    paintUrl: frame.colored_image_url || null,
  };
}

export function useDashboard() {
  const { projectId } = useParams();
  const [activeFrame, setActiveFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState("1x");
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [frameStates, setFrameStates] = useState<FrameState[]>([]);
  const [uncoloredFiles, setUncoloredFiles] = useState<ImportedFile[]>([]);
  const [referenceImage, setReferenceImage] = useState<ImportedFile | null>(null);
  const [detachedReferenceFrameId, setDetachedReferenceFrameId] = useState<string | null>(null);
  const [showReferencePreview, setShowReferencePreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const referenceStorageKey = projectId ? `frameflow:reference-frame:${projectId}` : null;
  const detachedReferenceStorageKey = projectId ? `frameflow:detached-reference:${projectId}` : null;

  const persistReferenceFrameId = useCallback((frameId: string | null) => {
    if (!referenceStorageKey || typeof window === "undefined") return;
    if (frameId) window.localStorage.setItem(referenceStorageKey, frameId);
    else window.localStorage.removeItem(referenceStorageKey);
  }, [referenceStorageKey]);

  const persistDetachedReferenceFrameId = useCallback((frameId: string | null) => {
    setDetachedReferenceFrameId(frameId);
    if (!detachedReferenceStorageKey || typeof window === "undefined") return;
    if (frameId) window.localStorage.setItem(detachedReferenceStorageKey, frameId);
    else window.localStorage.removeItem(detachedReferenceStorageKey);
  }, [detachedReferenceStorageKey]);

  const refreshFrames = useCallback(async (): Promise<ImportedFile[]> => {
    if (!projectId) return [];
    const frames = await loadFrames(projectId);
    const mapped = frames.map(normalizeImportedFrame);
    const storedDetachedId = typeof window !== "undefined" && detachedReferenceStorageKey
      ? window.localStorage.getItem(detachedReferenceStorageKey)
      : null;

    setUncoloredFiles(mapped);
    setFrameStates(mapped.map((frame) => (
      frame.paintUrl && frame.id !== storedDetachedId ? "ai" : "plain"
    ) as FrameState));
    setReferenceImage((prev) => {
      const storedId = typeof window !== "undefined" && referenceStorageKey
        ? window.localStorage.getItem(referenceStorageKey)
        : null;
      const desiredId = prev?.id || storedId;
      if (!desiredId) return null;
      const fresh = mapped.find((frame) => frame.id === desiredId);
      return fresh?.paintUrl ? fresh : null;
    });

    if (typeof window !== "undefined" && detachedReferenceStorageKey) {
      setDetachedReferenceFrameId(
        storedDetachedId && mapped.some((frame) => frame.id === storedDetachedId)
          ? storedDetachedId
          : null,
      );
    }

    return mapped;
  }, [projectId, referenceStorageKey, detachedReferenceStorageKey]);

  useEffect(() => {
  if (!projectId) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  const init = async () => {
    try {
      await refreshFrames();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('loadFrames timeout - API took too long');
      } else {
        console.error('Error loading frames:', error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };

  init();
  
  return () => {
    controller.abort();
    clearTimeout(timeoutId);
  };
}, [projectId, refreshFrames]);
  const [frameRefMap, setFrameRefMap] = useState<Record<number, ImportedFile>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [framePaints, setFramePaints] = useState<Record<number, string>>({});
  const [undoStack, setUndoStack] = useState<Record<number, string[]>>({});
  const [redoStack, setRedoStack] = useState<Record<number, string[]>>({});
  const [paintableFrames, setPaintableFrames] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast helper
  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info", duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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
  const [fillTolerance, setFillTolerance] = useState(35);
  const [gapClose, setGapClose] = useState(true);

  // Panels
  const [panelOpen, setPanelOpen] = useState({
    tools: true,
    color: true,
    brush: true,
    adjust: false,
  });

  // AI
  const [isColoring, setIsColoring] = useState(false);
  const [colorizationProgress, setColorizationProgress] = useState<{ processed: number; total: number; status: string } | null>(null);
  const [frameReview, setFrameReview] = useState<ReviewState | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [segmentPickMode, setSegmentPickMode] = useState(false);
  const [showLowConfidenceOverlay, setShowLowConfidenceOverlay] = useState(false);
  const [improveEdge, setImproveEdge] = useState(true);
  const [preserveLines, setPreserveLines] = useState(true);
  const [skinTone, setSkinTone] = useState(true);
  const [brightness, setBrightness] = useState(50);
  const [contrastVal, setContrastVal] = useState(50);
  const [saturation, setSaturation] = useState(60);
  const [blur, setBlur] = useState(20);
  const [spill, setSpill] = useState(30);
  const [tones, setTones] = useState(45);

  // Advanced tool parameters
  const [smudgeStrength, setSmudgeStrength] = useState(40);
  const [dodgeExposure, setDodgeExposure] = useState(40);
  const [burnExposure, setBurnExposure] = useState(40);

  // Modal
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [refModalTab, setRefModalTab] = useState<"list" | "upload">("list");
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);

  // Refs
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uncoloredInputRef = useRef<HTMLInputElement>(null);
  const customColoredInputRef = useRef<HTMLInputElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Ref to PaintCanvas imperative handle — gives access to merged (flattened) canvas
  const paintCanvasRef = useRef<PaintCanvasHandle>(null);

  // ── Playback ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying && uncoloredFiles.length > 0) {
      const ms =
        speed === "0.25x" ? 800 : speed === "0.5x" ? 400 : speed === "2x" ? 100 : 200;
      playRef.current = setInterval(
        () => setActiveFrame((f) => (f + 1) % uncoloredFiles.length),
        ms
      );
    } else if (playRef.current) clearInterval(playRef.current);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [isPlaying, speed, uncoloredFiles.length]);

  // ── Timeline auto-scroll ───────────────────────────────────────────────────
  useEffect(() => {
    const c = timelineScrollRef.current;
    if (!c) return;
    c.scrollTo({
      left: Math.max(0, activeFrame * 58 - c.clientWidth / 2 + 29),
      behavior: "smooth",
    });
  }, [activeFrame]);

  // ── Frame save/restore ─────────────────────────────────────────────────────
  const saveCurrentFrame = useCallback(() => {
    // Keep only the editable paint/color layer in local state.
    // The source sketch stays separate and is rendered above the color layer.
    const dataUrl = paintCanvasRef.current?.getPaintLayerDataUrl();
    if (!dataUrl) return;
    setFramePaints((prev) => ({ ...prev, [activeFrame]: dataUrl }));
  }, [activeFrame]);

  const handleFrameChange = (idx: number) => {
    saveCurrentFrame();
    setShowReferencePreview(false);
    setActiveFrame(idx);
    setIsPlaying(false);
  };

  const openReferencePreview = () => {
    if (!referenceImage?.paintUrl) {
      addToast("❌ Reference hiện tại chưa có ảnh màu", "error");
      return;
    }
    setIsPlaying(false);
    setShowReferencePreview(true);
  };

  const clearReferenceSelection = () => {
    setReferenceImage(null);
    setShowReferencePreview(false);
    persistReferenceFrameId(null);
  };

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const pushUndoSnapshot = useCallback(() => {
    const snap = paintCanvasRef.current?.getPaintLayerDataUrl();
    if (!snap) return;
    setUndoStack((prev) => ({
      ...prev,
      [activeFrame]: [...(prev[activeFrame] || []), snap].slice(-30),
    }));
    setRedoStack((prev) => ({ ...prev, [activeFrame]: [] }));
  }, [activeFrame]);

  const handleStroke = useCallback(() => {
    setFrameStates((prev) => {
      const next = [...prev];
      next[activeFrame] = "manual";
      return next;
    });
    saveCurrentFrame();
  }, [activeFrame, saveCurrentFrame]);

  const handleSaveCurrentFrame = useCallback(async (): Promise<string | null> => {
    try {
      if (!projectId) return null;

      const frame = uncoloredFiles[activeFrame];
      if (!frame) return null;

      // Merge all layers (colorRef + bgRef + canvasRef) before uploading.
      // Review/Correction uses this as the actual corrected keyframe image.
      const blob = await paintCanvasRef.current?.getFlattenedBlob() ?? null;
      if (!blob) return null;

      const coloredUrl = await uploadColoredFrame(blob, projectId, frame.id);

      await updateFrameColor(frame.id, coloredUrl);

      setUncoloredFiles((prev) =>
        prev.map((item, index) =>
          index === activeFrame ? { ...item, paintUrl: coloredUrl } : item,
        ),
      );

      return coloredUrl;
    } catch (error) {
      console.error("SAVE FRAME ERROR:", error);
      addToast("❌ Lỗi khi lưu correction keyframe", "error");
      return null;
    }
  }, [activeFrame, addToast, projectId, uncoloredFiles]);

  const loadFrameReview = useCallback(async (): Promise<ReviewState | null> => {
    const frameId = uncoloredFiles[activeFrame]?.id;

    if (!projectId || !frameId) {
      setFrameReview(null);
      setSelectedSegmentId(null);
      return null;
    }

    try {
      setReviewLoading(true);
      const data = await getFrameReviewState({ projectId, frameId });
      setFrameReview(data);

      setSelectedSegmentId((prev) => {
        const ids = (data.segments || [])
          .map((segment) => Number(segment.segment_id))
          .filter((id) => Number.isFinite(id) && id > 0);

        if (prev && ids.includes(prev)) return prev;
        return ids[0] ?? null;
      });

      return data;
    } catch (error) {
      console.warn("FRAME REVIEW STATE ERROR:", error);
      setFrameReview(null);
      setSelectedSegmentId(null);
      return null;
    } finally {
      setReviewLoading(false);
    }
  }, [activeFrame, projectId, uncoloredFiles]);

  useEffect(() => {
    void loadFrameReview();
  }, [loadFrameReview]);

  const handleSegmentPicked = useCallback((segmentId: number) => {
    setSelectedSegmentId(segmentId);
    setSegmentPickMode(false);
    addToast(`✅ Đã chọn segment ${segmentId}`, "success", 2500);
  }, [addToast]);

  const handleRecolorSelectedSegment = useCallback((
    segmentId?: number | null,
    colorHex?: string | null,
    roleId?: string | null,
  ) => {
    const pickedSegmentId = Number(segmentId ?? selectedSegmentId);

    if (!Number.isFinite(pickedSegmentId) || pickedSegmentId <= 0) {
      addToast("❌ Chưa chọn segment để recolor", "error", 4500);
      return false;
    }

    if (!colorHex) {
      addToast("❌ Chưa chọn màu để recolor", "error", 4500);
      return false;
    }

    pushUndoSnapshot();
    const changed = paintCanvasRef.current?.recolorSegment(pickedSegmentId, colorHex, opacity) ?? false;

    if (!changed) {
      addToast("❌ Frame này chưa có segment map. Hãy chạy Auto Color trước rồi chọn vùng lại.", "error", 7000);
      return false;
    }

    setFrameStates((prev) => {
      const next = [...prev];
      next[activeFrame] = "manual";
      return next;
    });
    saveCurrentFrame();
    addToast(
      `🎨 Đã recolor segment ${pickedSegmentId}${roleId ? ` (${roleId})` : ""}`,
      "success",
      3000,
    );
    return true;
  }, [activeFrame, addToast, opacity, pushUndoSnapshot, saveCurrentFrame, selectedSegmentId]);

  const handleUndo = useCallback(() => {
    const stack = undoStack[activeFrame] || [];
    if (stack.length === 0) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const currentSnap = cv.toDataURL();
    setRedoStack((prev) => ({
      ...prev,
      [activeFrame]: [...(prev[activeFrame] || []), currentSnap].slice(-30),
    }));
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (stack.length === 1) {
      setUndoStack((s) => ({ ...s, [activeFrame]: [] }));
      setFrameStates((prev) => {
        const n = [...prev];
        n[activeFrame] = "plain";
        return n;
      });
    } else {
      const target = stack[stack.length - 2];
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = target;
      setUndoStack((s) => ({ ...s, [activeFrame]: stack.slice(0, -1) }));
    }
  }, [activeFrame, undoStack]);

  const handleRedo = useCallback(() => {
    const stack = redoStack[activeFrame] || [];
    if (stack.length === 0) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const currentSnap = cv.toDataURL();
    setUndoStack((prev) => ({
      ...prev,
      [activeFrame]: [...(prev[activeFrame] || []), currentSnap].slice(-30),
    }));
    const target = stack[stack.length - 1];
    ctx.clearRect(0, 0, cv.width, cv.height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      setFrameStates((prev) => {
        const n = [...prev];
        n[activeFrame] = "manual";
        return n;
      });
    };
    img.src = target;
    setRedoStack((s) => ({ ...s, [activeFrame]: stack.slice(0, -1) }));
  }, [activeFrame, redoStack]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
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
        case "G": setActiveTool("fill"); break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleUndo, handleRedo]);

  // ── Color helpers ──────────────────────────────────────────────────────────
  const handleColorPicked = (c: string) => {
    setActiveColor(c);
    setRecentColors((prev) => [c, ...prev.filter((x) => x !== c)].slice(0, 10));
  };

  const buildForwardTargetIndices = (
    referenceIndex: number,
    selectedFrames: Set<number>,
    totalFrames: number,
  ): number[] => {
    const selectedAfterReference = Array.from(selectedFrames)
      .filter((index) => index > referenceIndex && index < totalFrames)
      .sort((a, b) => a - b);

    // Nếu user tick frame rời rạc, tự mở rộng thành chain liên tục.
    // Ví dụ ref=3, user tick frame 7 => chạy 4,5,6,7.
    if (selectedAfterReference.length > 0) {
      const maxSelectedIndex = Math.max(...selectedAfterReference);

      return Array.from({ length: totalFrames }, (_, index) => index).filter(
        (index) => index > referenceIndex && index <= maxSelectedIndex,
      );
    }

    // Nếu user không tick gì, mặc định chạy toàn bộ phía sau reference.
    return Array.from({ length: totalFrames }, (_, index) => index).filter(
      (index) => index > referenceIndex,
    );
  };

  // ── AI handlers ────────────────────────────────────────────────────────────
  const buildColorizationSettings = useCallback(() => ({
    reference_strategy: "anchored_plus_nearest_safe",
    trusted_reference_min_confidence: 0.6,
    use_role_memory: true,
    role_memory_override_max_confidence: skinTone ? 0.86 : 0.82,
    max_low_confidence: improveEdge ? 14 : 22,
    preserve_line_art: preserveLines,
    improve_edge_detection: improveEdge,
    adaptive_threshold: improveEdge,
    line_mode: preserveLines ? "original" : "black",
    smart_skin_tone: skinTone,
    image_adjustments: {
      brightness,
      contrast: contrastVal,
      saturation,
      blur,
      color_spill_reduction: spill,
      tone_rebalance: tones,
    },
  }), [brightness, contrastVal, improveEdge, preserveLines, saturation, skinTone, blur, spill, tones]);

  const runColorizationJob = useCallback(async (jobId: string, maxIterations: number, totalExpected: number) => {
    let currentJobId = jobId;
    let lastStatus = "running";
    let totalProcessed = 0;
    let noProgressCount = 0;
    setColorizationProgress({ processed: 0, total: Math.max(1, totalExpected), status: "running" });

    for (let step = 0; step < maxIterations; step += 1) {
      const continued = await continueColorizationJob({
        projectId: projectId!,
        jobId: currentJobId,
        maxSteps: 1,
      });

      currentJobId = continued.job.id;
      lastStatus = continued.status;
      const processedNow = Number(continued.processed_count || 0);
      totalProcessed += processedNow;
      setColorizationProgress({
        processed: totalProcessed,
        total: Math.max(totalProcessed, totalExpected),
        status: lastStatus,
      });

      const latestFrames = await refreshFrames();
      if (continued.frame_id) {
        const changedIndex = latestFrames.findIndex((frame) => frame.id === continued.frame_id);
        if (changedIndex >= 0) {
          setFrameStates((prev) => {
            const next = [...prev];
            next[changedIndex] = "ai";
            return next;
          });
        }
      }

      if (continued.status === "needs_review_not_reference" || continued.status === "waiting_review") {
        const reviewFrameId = continued.frame_id || continued.job.current_review_frame_id || null;
        if (reviewFrameId) {
          const reviewIndex = latestFrames.findIndex((frame) => frame.id === reviewFrameId);
          if (reviewIndex >= 0) handleFrameChange(reviewIndex);
        }
        break;
      }

      if (continued.status === "completed") break;
      noProgressCount = processedNow === 0 ? noProgressCount + 1 : 0;
      if (noProgressCount >= 2) {
        throw new Error("Colorization không có tiến triển. Hãy kiểm tra trạng thái CV backend.");
      }
    }

    return { jobId: currentJobId, lastStatus, totalProcessed };
  }, [handleFrameChange, projectId, refreshFrames]);

  const handleCorrectionKeyframeAndRecolorNextFrames = useCallback(async () => {
    if (!projectId) {
      addToast("❌ Không tìm thấy project hiện tại", "error");
      return;
    }

    const currentFrame = uncoloredFiles[activeFrame];
    if (!currentFrame) {
      addToast("❌ Không tìm thấy frame hiện tại", "error");
      return;
    }

    try {
      setIsColoring(true);
      addToast("⏳ Đang lưu frame hiện tại thành correction keyframe...", "info", 6000);

      const savedUrl = await handleSaveCurrentFrame();
      if (!savedUrl) {
        addToast("❌ Không lưu được correction keyframe. Hãy thử bấm Save trước.", "error", 7000);
        return;
      }

      const correctionReference: ImportedFile = {
        ...currentFrame,
        paintUrl: savedUrl,
      };

      setReferenceImage(correctionReference);
      persistReferenceFrameId(correctionReference.id);
      if (detachedReferenceFrameId === correctionReference.id) {
        persistDetachedReferenceFrameId(null);
      }
      setShowReferencePreview(false);
      setFrameRefMap((prev) => ({ ...prev, [activeFrame]: correctionReference }));
      setUncoloredFiles((prev) =>
        prev.map((item, index) =>
          index === activeFrame ? { ...item, paintUrl: savedUrl } : item,
        ),
      );
      setFrameStates((prev) => {
        const next = [...prev];
        next[activeFrame] = "manual";
        return next;
      });

      const targetIndices = buildForwardTargetIndices(
        activeFrame,
        paintableFrames,
        uncoloredFiles.length,
      );

      const targetFrameIds = Array.from(
        new Set(
          targetIndices
            .map((index) => uncoloredFiles[index]?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      if (targetFrameIds.length === 0) {
        addToast("✅ Correction keyframe đã lưu. Không có frame phía sau để recolor.", "success", 6000);
        await refreshFrames();
        await loadFrameReview();
        return;
      }

      addToast(
        `⏳ Recolor ${targetFrameIds.length} frame phía sau bằng correction keyframe...`,
        "info",
        8000,
      );

      const previousJob = frameReview?.job;
      if (previousJob?.id && ["created", "running", "waiting_review"].includes(previousJob.status)) {
        await cancelColorizationJob({ projectId, jobId: previousJob.id });
      }

      const started = await startColorizationJob({
        projectId,
        referenceFrameId: currentFrame.id,
        targetFrameIds,
        direction: "forward",
        overwriteExisting: true,
        settings: buildColorizationSettings(),
      });

      const { lastStatus, totalProcessed } = await runColorizationJob(
        started.job.id,
        targetFrameIds.length + 3,
        targetFrameIds.length,
      );

      await refreshFrames();
      await loadFrameReview();

      if (lastStatus === "needs_review_not_reference" || lastStatus === "waiting_review") {
        addToast("⚠️ Recolor dừng ở frame cần Review/Correction", "info", 8000);
      } else {
        addToast(`✅ Đã recolor ${totalProcessed} frame phía sau correction keyframe`, "success", 7000);
      }
    } catch (error) {
      console.error("CORRECTION KEYFRAME RECOLOR ERROR:", error);
      addToast(`❌ Lỗi Correction Keyframe: ${(error as Error).message}`, "error", 10000);
    } finally {
      setIsColoring(false);
    }
  }, [
    activeFrame,
    addToast,
    buildColorizationSettings,
    handleSaveCurrentFrame,
    loadFrameReview,
    frameReview,
    paintableFrames,
    projectId,
    refreshFrames,
    runColorizationJob,
    uncoloredFiles,
    detachedReferenceFrameId,
    persistDetachedReferenceFrameId,
    persistReferenceFrameId,
  ]);

  const handleAutoColor = async () => {
    if (!projectId) {
      addToast("❌ Không tìm thấy project hiện tại", "error");
      return;
    }

    if (uncoloredFiles.length === 0) {
      addToast("❌ Vui lòng upload sketch frames trước", "error");
      return;
    }

    try {
      const existing = await getColorizationState({ projectId });
      const existingStatus = existing.job?.status || "";
      if (existing.job && existingStatus === "waiting_review") {
        const reviewFrameId = existing.job.current_review_frame_id;
        const reviewIndex = uncoloredFiles.findIndex((frame) => frame.id === reviewFrameId);
        if (reviewIndex >= 0) handleFrameChange(reviewIndex);
        await loadFrameReview();
        addToast("⚠️ Sequence đang chờ Review/Correction trước khi tiếp tục", "info", 7000);
        return;
      }
      if (existing.job && ["created", "running"].includes(existingStatus)) {
        setIsColoring(true);
        const pending = existing.frames.filter((frame) => frame.pipeline_status === "pending").length;
        addToast(`⏳ Tiếp tục sequence đang xử lý (${pending} frame còn lại)...`, "info", 7000);
        const result = await runColorizationJob(existing.job.id, pending + 3, pending);
        await refreshFrames();
        await loadFrameReview();
        if (["needs_review_not_reference", "waiting_review"].includes(result.lastStatus)) {
          addToast("⚠️ Sequence dừng ở frame cần Review/Correction", "info", 8000);
        } else {
          addToast(`✅ Sequence đã tiếp tục và xử lý ${result.totalProcessed} frame`, "success", 7000);
        }
        return;
      }
    } catch (stateError) {
      console.warn("COLORIZATION RECOVERY CHECK ERROR:", stateError);
    } finally {
      setIsColoring(false);
    }

    if (!referenceImage?.id || !referenceImage.paintUrl) {
      addToast("❌ Vui lòng chọn colored/corrected keyframe làm Reference trước", "error");
      return;
    }

    const referenceIndex = uncoloredFiles.findIndex(
      (frame) => frame.id === referenceImage.id,
    );

    if (referenceIndex < 0) {
      addToast("❌ Reference frame không còn trong sequence", "error");
      return;
    }

    let effectiveReference = referenceImage;

    // Nếu user đang mở đúng reference và vừa sửa tay trên canvas,
    // save lại thành correction keyframe trước khi tạo job mới.
    if (activeFrame === referenceIndex && frameStates[referenceIndex] === "manual") {
      addToast("⏳ Đang lưu correction reference hiện tại...", "info", 5000);
      const savedUrl = await handleSaveCurrentFrame();

      if (savedUrl) {
        effectiveReference = {
          ...referenceImage,
          paintUrl: savedUrl,
        };

        setReferenceImage(effectiveReference);
        persistReferenceFrameId(effectiveReference.id);

        setUncoloredFiles((prev) =>
          prev.map((item, index) =>
            index === referenceIndex ? { ...item, paintUrl: savedUrl } : item,
          ),
        );
      }
    }

    const targetIndices = buildForwardTargetIndices(
      referenceIndex,
      paintableFrames,
      uncoloredFiles.length,
    );

    const targetFrameIds = Array.from(
      new Set(
        targetIndices
          .map((index) => uncoloredFiles[index]?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (targetFrameIds.length === 0) {
      addToast("❌ Không có frame phía sau reference để tô lại", "error", 7000);
      return;
    }

    try {
      setIsColoring(true);
      addToast(
        `⏳ Auto Color ${targetFrameIds.length} frame phía sau Frame ${referenceIndex + 1}...`,
        "info",
        7000,
      );

      const started = await startColorizationJob({
        projectId,
        referenceFrameId: effectiveReference.id,
        targetFrameIds,
        direction: "forward",
        overwriteExisting: true,
        settings: buildColorizationSettings(),
      });

      const { lastStatus, totalProcessed } = await runColorizationJob(
        started.job.id,
        targetFrameIds.length + 3,
        targetFrameIds.length,
      );

      await refreshFrames();
      await loadFrameReview();

      if (lastStatus === "needs_review_not_reference" || lastStatus === "waiting_review") {
        addToast("⚠️ Auto Color dừng ở frame cần Review/Correction", "info", 8000);
      } else {
        addToast(`✅ Đã tô lại ${totalProcessed} frame phía sau reference`, "success", 7000);
      }
    } catch (error) {
      console.error("AUTO COLOR CORE ERROR:", error);
      addToast(`❌ Lỗi Auto Color Sequence: ${(error as Error).message}`, "error", 10000);
    } finally {
      setIsColoring(false);
    }
  };

  const handleColorCurrentFrame = () =>
    setFrameStates((prev) => {
      const n = [...prev];
      n[activeFrame] = "ai";
      return n;
    });

  // ── File import ────────────────────────────────────────────────────────────
const handleImportUncolored = async (
  e: React.ChangeEvent<HTMLInputElement>,
) => {
  const input = e.currentTarget;
  const files = Array.from(input.files || []);

  // Reset immediately so the browser will fire onChange even when the user
  // selects exactly the same files again after a failed import.
  input.value = "";

  if (!files.length) return;

  if (!projectId) {
    addToast("❌ Không tìm thấy project hiện tại", "error");
    return;
  }

  if (isImporting) {
    addToast("⏳ Một lần import khác đang chạy. Hãy chờ hoàn tất.", "info", 5000);
    return;
  }

  setIsImporting(true);
  addToast(`⏳ Đang import ${files.length} ảnh...`, "info", 5000);

  const succeeded: ImportedFile[] = [];
  const failed: string[] = [];

  try {
    // Do not use uncoloredFiles.length here. After deleting a middle frame,
    // length can point to an index that already exists in the database.
    let nextFrameIndex = await getNextFrameIndex(projectId);

    for (const file of files) {
      let uploadedPath: string | null = null;

      try {
        const uploaded = await uploadFrameImage(file, projectId);
        uploadedPath = uploaded.path;

        const frame = await createFrame({
          projectId,
          frameIndex: nextFrameIndex,
          sourceImageUrl: uploaded.publicUrl,
        });

        const imported: ImportedFile = {
          id: frame.id,
          name: file.name,
          url: uploaded.publicUrl,
          paintUrl: null,
        };

        succeeded.push(imported);
        nextFrameIndex += 1;

        // Update after every successful file. A later failure therefore never
        // leaves successfully inserted frames invisible until refresh.
        setUncoloredFiles((prev) => [...prev, imported]);
        setFrameStates((prev) => [...prev, "plain" as FrameState]);
      } catch (error) {
        if (uploadedPath) await removeFrameImage(uploadedPath);
        const message = error instanceof Error ? error.message : "Unknown import error";
        console.error(`IMPORT FAILED: ${file.name}`, error);
        failed.push(`${file.name}: ${message}`);
      }
    }

    if (succeeded.length > 0 && failed.length === 0) {
      addToast(`✅ Imported ${succeeded.length} uncolored frame(s)`, "success", 6000);
    } else if (succeeded.length > 0) {
      addToast(
        `⚠️ Imported ${succeeded.length}/${files.length}. Failed: ${failed.map((item) => item.split(":")[0]).join(", ")}`,
        "info",
        10000,
      );
    } else {
      throw new Error(failed[0] || "Không upload được file nào.");
    }
  } catch (error) {
    console.error("IMPORT UNCOLORED ERROR:", error);
    addToast(
      `❌ Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "error",
      10000,
    );
  } finally {
    setIsImporting(false);
  }
};
const handleCustomColoredUpload = async (
  e: React.ChangeEvent<HTMLInputElement>,
) => {
  const file = e.target.files?.[0];

  if (!file) return;

  if (!projectId) {
    addToast("❌ Không tìm thấy project hiện tại", "error");
    e.target.value = "";
    return;
  }

  const currentFrame = uncoloredFiles[activeFrame];
  if (!currentFrame) {
    addToast("❌ Hãy upload sketch frame trước khi upload colored keyframe", "error");
    e.target.value = "";
    return;
  }

  try {
    addToast("⏳ Đang lưu colored keyframe...", "info", 5000);

    const coloredUrl = await uploadColoredFrame(
      file,
      projectId,
      currentFrame.id,
    );

    await updateFrameColor(currentFrame.id, coloredUrl);

    const savedReference = {
      ...currentFrame,
      name: file.name,
      paintUrl: coloredUrl,
    };

    setUncoloredFiles((prev) =>
      prev.map((item, index) =>
        index === activeFrame ? { ...item, paintUrl: coloredUrl } : item,
      ),
    );
    // The uploaded reference remains linked to this sketch in the database so
    // the CV backend can use the pair, but the UI displays it as a separate
    // reference card instead of replacing the sketch thumbnail/canvas.
    setReferenceImage(savedReference);
    persistReferenceFrameId(savedReference.id);
    persistDetachedReferenceFrameId(savedReference.id);
    setShowReferencePreview(false);
    setFrameRefMap((prev) => ({ ...prev, [activeFrame]: savedReference }));
    setShowReferenceModal(false);
    addToast("✅ Reference đã được lưu riêng và liên kết với sketch hiện tại", "success", 6000);
  } catch (error) {
    console.error("CUSTOM COLORED UPLOAD ERROR:", error);
    addToast(`❌ Lỗi lưu colored keyframe: ${(error as Error).message}`, "error", 7000);
  } finally {
    e.target.value = "";
  }
};

  // ── Reference handlers ─────────────────────────────────────────────────────
  const handleConfirmReference = () => {
    const found = uncoloredFiles.find((f) => f.id === selectedRefId);
    if (!found) {
      addToast("❌ Không tìm thấy reference frame", "error");
      return;
    }
    if (!found.paintUrl) {
      addToast("❌ Frame này chưa có ảnh màu. Chỉ colored keyframe mới dùng làm reference được.", "error", 6000);
      return;
    }
    setReferenceImage(found);
    persistReferenceFrameId(found.id);
    setShowReferencePreview(false);
    setShowReferenceModal(false);
  };

  const openReferenceModal = () => {
    setSelectedRefId(referenceImage?.id ?? null);
    setRefModalTab("list");
    setShowReferenceModal(true);
  };

  const handleSetFrameRef = (fi: number) => {
    if (referenceImage) setFrameRefMap((p) => ({ ...p, [fi]: referenceImage }));
    setContextMenu(null);
  };

  const handleSetFrameAsGlobalRef = async (fi: number) => {
    const frame = uncoloredFiles[fi];

    if (!frame) {
      addToast("❌ Không tìm thấy frame", "error");
      setContextMenu(null);
      return;
    }

    let savedPaintUrl = frame.paintUrl;

    // Chỉ ghi đè colored image khi người dùng thực sự đã sửa canvas.
    // Reference upload tách rời đang hiển thị sketch nên không được flatten lại.
    if (fi === activeFrame && frameStates[fi] === "manual") {
      addToast("⏳ Đang lưu correction keyframe...", "info", 5000);

      const nextUrl = await handleSaveCurrentFrame();

      if (!nextUrl) {
        addToast("❌ Không lưu được correction keyframe. Hãy bấm Save rồi thử lại.", "error", 8000);
        setContextMenu(null);
        return;
      }

      savedPaintUrl = nextUrl;
    }

    if (!savedPaintUrl) {
      addToast("❌ Frame này chưa có ảnh màu nên chưa thể làm reference", "error", 7000);
      setContextMenu(null);
      return;
    }

    const nextReference: ImportedFile = {
      ...frame,
      paintUrl: savedPaintUrl,
    };

    setReferenceImage(nextReference);
    persistReferenceFrameId(nextReference.id);
    setShowReferencePreview(false);

    setUncoloredFiles((prev) =>
      prev.map((item, index) =>
        index === fi ? { ...item, paintUrl: savedPaintUrl } : item,
      ),
    );

    setFrameRefMap((prev) => ({
      ...prev,
      [fi]: nextReference,
    }));

    addToast(`✅ Frame ${fi + 1} đã được đặt làm correction reference`, "success");
    setContextMenu(null);
  };

  const handleClearFrameRef = (fi: number) => {
    setFrameRefMap((p) => {
      const n = { ...p };
      delete n[fi];
      return n;
    });
    setContextMenu(null);
  };

  const toggleFramePaintable = (frameIndex: number) => {
    setPaintableFrames((prev) => {
      const next = new Set(prev);
      if (next.has(frameIndex)) {
        next.delete(frameIndex);
      } else {
        next.add(frameIndex);
      }
      return next;
    });
  };

  const selectAllFrames = () => {
    const next = new Set<number>();

    const referenceIndex = referenceImage?.id
      ? uncoloredFiles.findIndex((frame) => frame.id === referenceImage.id)
      : -1;

    for (let i = 0; i < uncoloredFiles.length; i += 1) {
      // Khi đã có reference, Select All chỉ chọn frame phía sau reference.
      if (referenceIndex >= 0) {
        if (i > referenceIndex) next.add(i);
      } else {
        next.add(i);
      }
    }

    setPaintableFrames(next);
  };

  const deselectAllFrames = () => {
    setPaintableFrames(new Set());
  };

  const togglePanel = (k: keyof typeof panelOpen) =>
    setPanelOpen((p) => ({ ...p, [k]: !p[k] }));

  // ── Delete Frame ───────────────────────────────────────────────────────────
  const deleteFrame = async (frameIndex: number) => {
    try {
      const frameId = uncoloredFiles[frameIndex]?.id;
      
      // Delete from database
      if (frameId) {
        await deleteFrameApi(frameId);

        if (referenceImage?.id === frameId) {
          clearReferenceSelection();
        }
        if (detachedReferenceFrameId === frameId) {
          persistDetachedReferenceFrameId(null);
        }
      }

      // Update local state
      setUncoloredFiles((prev) => prev.filter((_, i) => i !== frameIndex));
      setFrameStates((prev) => prev.filter((_, i) => i !== frameIndex));
      setFramePaints((prev) => {
        const next = { ...prev };
        delete next[frameIndex];
        const reindexed: Record<number, string> = {};
        Object.entries(next).forEach(([key, val]) => {
          const idx = parseInt(key);
          if (idx > frameIndex) reindexed[idx - 1] = val;
          else if (idx < frameIndex) reindexed[idx] = val;
        });
        return reindexed;
      });
      setUndoStack((prev) => {
        const next = { ...prev };
        delete next[frameIndex];
        const reindexed: Record<number, string[]> = {};
        Object.entries(next).forEach(([key, val]) => {
          const idx = parseInt(key);
          if (idx > frameIndex) reindexed[idx - 1] = val;
          else if (idx < frameIndex) reindexed[idx] = val;
        });
        return reindexed;
      });
      setRedoStack((prev) => {
        const next = { ...prev };
        delete next[frameIndex];
        const reindexed: Record<number, string[]> = {};
        Object.entries(next).forEach(([key, val]) => {
          const idx = parseInt(key);
          if (idx > frameIndex) reindexed[idx - 1] = val;
          else if (idx < frameIndex) reindexed[idx] = val;
        });
        return reindexed;
      });
      setFrameRefMap((prev) => {
        const next = { ...prev };
        delete next[frameIndex];
        const reindexed: Record<number, ImportedFile> = {};
        Object.entries(next).forEach(([key, val]) => {
          const idx = parseInt(key);
          if (idx > frameIndex) reindexed[idx - 1] = val;
          else if (idx < frameIndex) reindexed[idx] = val;
        });
        return reindexed;
      });
      setPaintableFrames((prev) => {
        const next = new Set(prev);
        next.delete(frameIndex);
        const reindexed = new Set<number>();
        next.forEach((idx) => {
          if (idx > frameIndex) reindexed.add(idx - 1);
          else if (idx < frameIndex) reindexed.add(idx);
          else reindexed.add(idx);
        });
        return reindexed;
      });
      if (activeFrame >= frameIndex && activeFrame > 0) {
        setActiveFrame(activeFrame - 1);
      } else if (activeFrame === frameIndex && uncoloredFiles.length > 1) {
        setActiveFrame(0);
      }
      addToast("✅ Frame đã xoá thành công", "success");
    } catch (error) {
      console.error("Delete frame error:", error);
      addToast("❌ Lỗi khi xoá frame", "error");
    }
  };

  // ── Export Frame ───────────────────────────────────────────────────────────
  const exportSingleFrame = async (frameIndex: number) => {
    try {
      console.log("🔍 exportSingleFrame called with frameIndex:", frameIndex);
      console.log("📦 uncoloredFiles:", uncoloredFiles);
      console.log("📸 Frame data:", uncoloredFiles[frameIndex]);
      
      addToast("⏳ Đang xuất frame...", "info", 5000);
      
      // Lấy ảnh màu đang hiển thị nếu có, sau đó mới fallback về ảnh màu đã lưu hoặc sketch gốc
      const paintedUrl = framePaints[frameIndex] || uncoloredFiles[frameIndex]?.paintUrl || uncoloredFiles[frameIndex]?.url;
      
      console.log("🖼️ paintedUrl:", paintedUrl);
      
      if (!paintedUrl) {
        console.error("❌ No URL found for frame", frameIndex);
        addToast("❌ Lỗi: Không tìm thấy ảnh frame", "error");
        return;
      }
      
      try {
        console.log("🌐 Fetching from:", paintedUrl);
        const response = await fetch(paintedUrl);
        
        console.log("📡 Fetch response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log("✅ Blob received, size:", blob.size);
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `frame-${frameIndex + 1}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log("✅ Frame downloaded successfully");
        addToast("✅ Frame đã tải xuống thành công", "success");
      } catch (err) {
        console.error(`❌ Failed to fetch frame ${frameIndex}:`, err);
        addToast("❌ Lỗi khi xuất frame: " + (err as Error).message, "error");
      }
    } catch (error) {
      console.error("❌ Export single frame error:", error);
      addToast("❌ Lỗi khi xuất frame", "error");
    }
  };

  const exportAllFrames = async () => {
    // Delegate to exportMultipleFrames with all frame indices
    const allIndices = Array.from({ length: uncoloredFiles.length }, (_, i) => i);
    await exportMultipleFrames(allIndices);
  };

  const exportMultipleFrames = async (selectedFrameIndices: number[]) => {
    try {
      if (!selectedFrameIndices || selectedFrameIndices.length === 0) {
        addToast("❌ Vui lòng chọn ít nhất một frame", "error");
        return;
      }

      console.log("📋 Selected indices:", selectedFrameIndices);
      console.log("📦 framePaints keys:", Object.keys(framePaints));
      console.log("📁 uncoloredFiles length:", uncoloredFiles.length);

      addToast("⏳ Đang chuẩn bị file ZIP...", "info", 10000);
      const zip = new JSZip();
      
      // Fetch all frames in parallel with timeout
      console.log(`⏱️ Fetching ${selectedFrameIndices.length} frames in parallel...`);
      const frameBlobsToAdd: Array<{ name: string; blob: Blob }> = [];
      
      // Create promises for all frames
      const fetchPromises = selectedFrameIndices.map(async (frameIdx) => {
        try {
          console.log(`\n🔍 Processing frame ${frameIdx}:`);
          const frame = uncoloredFiles[frameIdx];
          console.log(`  Frame object:`, frame);
          console.log(`  framePaints[${frameIdx}]:`, framePaints[frameIdx]);
          
          // Get painted frame if available, otherwise original
          let paintedUrl = framePaints[frameIdx];
          if (!paintedUrl && frame) {
            paintedUrl = frame.paintUrl || frame.url;
          }
          
          console.log(`  Final URL:`, paintedUrl?.substring(0, 100) + "...");
          
          if (paintedUrl) {
            let blob: Blob;
            
            // Handle data URLs differently
            if (paintedUrl.startsWith('data:')) {
              console.log(`  📊 Converting data URL to blob...`);
              const response = await fetch(paintedUrl);
              blob = await response.blob();
            } else {
              console.log(`  🌐 Fetching from HTTP URL...`);
              const response = await fetch(paintedUrl);
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              blob = await response.blob();
            }
            
            console.log(`  ✅ Got blob, size: ${blob.size}`);
            return {
              name: `frame-${frameIdx + 1}.png`,
              blob
            };
          } else {
            console.log(`  ⚠️ No URL found for frame ${frameIdx}`);
            return null;
          }
        } catch (err) {
          console.error(`  ❌ Failed to fetch frame ${frameIdx + 1}:`, err);
          addToast(`❌ Lỗi tải frame ${frameIdx + 1}: ${(err as Error).message}`, "error");
          return null;
        }
      });
      
      // Wait for all fetches to complete
      console.log("⏳ Waiting for all frames to fetch...");
      const results = await Promise.all(fetchPromises);
      const validFrames = results.filter((r) => r !== null) as Array<{ name: string; blob: Blob }>;
      
      console.log(`\n📦 Total frames to add to ZIP: ${validFrames.length}/${selectedFrameIndices.length}`);
      
      // Add all blobs to ZIP
      for (const { name, blob } of validFrames) {
        console.log(`  Adding to ZIP: ${name}`);
        zip.file(name, blob);
      }
      
      console.log("📦 Generating ZIP file...");
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      console.log("📤 Generated ZIP blob, size:", zipBlob.size);
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-frames-selected.zip`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(`✅ Đã tải ${validFrames.length}/${selectedFrameIndices.length} frame xuống`, "success");
    } catch (error) {
      console.error('Export multiple frames error:', error);
      addToast("❌ Lỗi khi xuất file ZIP", "error");
    }
  };

  return {
    // Project state
    projectId,

    // Frame state
    activeFrame, setActiveFrame,
    isPlaying, setIsPlaying,
    speed, setSpeed,
    showSpeedMenu, setShowSpeedMenu,
    frameStates, setFrameStates,
    uncoloredFiles,
    referenceImage, setReferenceImage,
    detachedReferenceFrameId,
    showReferencePreview, setShowReferencePreview,
    isImporting,
    frameRefMap,
    contextMenu, setContextMenu,
    undoStack, redoStack,
    framePaints,

    // Tool state
    activeTool, setActiveTool,
    activeColor, setActiveColor,
    secondaryColor, setSecondaryColor,
    recentColors, setRecentColors,
    brushSize, setBrushSize,
    opacity, setOpacity,
    hardness, setHardness,
    blendMode, setBlendMode,
    flow, setFlow,
    spacing, setSpacing,
    fillTolerance, setFillTolerance,
    gapClose, setGapClose,
    // Panel state
    panelOpen, togglePanel,

    // AI state
    isColoring,
    colorizationProgress,
    frameReview,
    reviewLoading,
    loadFrameReview,
    selectedSegmentId, setSelectedSegmentId,
    segmentPickMode, setSegmentPickMode,
    handleSegmentPicked,
    handleRecolorSelectedSegment,
    showLowConfidenceOverlay, setShowLowConfidenceOverlay,
    handleCorrectionKeyframeAndRecolorNextFrames,
    improveEdge, setImproveEdge,
    preserveLines, setPreserveLines,
    skinTone, setSkinTone,
    brightness, setBrightness,
    contrastVal, setContrastVal,
    saturation, setSaturation,
    blur, setBlur,
    spill, setSpill,
    tones, setTones,

    // Modal state
    showReferenceModal, setShowReferenceModal,
    refModalTab, setRefModalTab,
    selectedRefId, setSelectedRefId,

    // Advanced tool parameters
    smudgeStrength, setSmudgeStrength,
    dodgeExposure, setDodgeExposure,
    burnExposure, setBurnExposure,

    // Refs
    canvasRef,
    paintCanvasRef,
    uncoloredInputRef,
    customColoredInputRef,
    timelineScrollRef,
    handleSaveCurrentFrame,

    // Handlers
    handleFrameChange,
    openReferencePreview,
    clearReferenceSelection,
    pushUndoSnapshot,
    handleStroke,
    handleUndo,
    handleRedo,
    handleColorPicked,
    handleAutoColor,
    handleColorCurrentFrame,
    handleImportUncolored,
    handleCustomColoredUpload,
    handleConfirmReference,
    openReferenceModal,
    handleSetFrameRef,
    handleSetFrameAsGlobalRef,
    handleClearFrameRef,
    toggleFramePaintable,
    selectAllFrames,
    deselectAllFrames,
    paintableFrames,
    setPaintableFrames,
    deleteFrame,
    exportSingleFrame,
    exportAllFrames,
    exportMultipleFrames,

    // Toast
    toasts,
    removeToast,
    addToast,
    refreshFrames,
  };
}
