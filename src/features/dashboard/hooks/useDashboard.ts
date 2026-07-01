import { useState, useEffect, useRef, useCallback } from "react";
import JSZip from "jszip";
import type { Tool, BlendMode, FrameState, ImportedFile, ContextMenu } from "../types";
import type { PaintCanvasHandle } from "../components/PaintCanvas";
import { uploadFrameImage } from "../services/storage.api";
import { createFrame, deleteFrame as deleteFrameApi } from "../services/frame.api";
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
  continueColorizationJob,
  startColorizationJob,
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

  const refreshFrames = useCallback(async (): Promise<ImportedFile[]> => {
    if (!projectId) return [];
    const frames = await loadFrames(projectId);
    const mapped = frames.map(normalizeImportedFrame);
    setUncoloredFiles(mapped);
    setFrameStates(mapped.map((frame) => (frame.paintUrl ? "ai" : "plain") as FrameState));
    setReferenceImage((prev) => {
      if (!prev) return null;
      const fresh = mapped.find((frame) => frame.id === prev.id);
      return fresh?.paintUrl ? fresh : null;
    });
    return mapped;
  }, [projectId]);

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
    setActiveFrame(idx);
    setIsPlaying(false);
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

  // ── AI handlers ────────────────────────────────────────────────────────────
  const handleAutoColor = async () => {
    if (!projectId) {
      addToast("❌ Không tìm thấy project hiện tại", "error");
      return;
    }

    if (uncoloredFiles.length === 0) {
      addToast("❌ Vui lòng upload sketch frames trước", "error");
      return;
    }

    if (!referenceImage?.id || !referenceImage.paintUrl) {
      addToast("❌ Vui lòng chọn colored keyframe/reference đã có màu trước", "error");
      return;
    }

    const selectedIndices = Array.from(paintableFrames).sort((a, b) => a - b);
    const targetFrameIds = (selectedIndices.length > 0
      ? selectedIndices
      : uncoloredFiles.map((_, index) => index))
      .map((index) => uncoloredFiles[index])
      .filter((frame): frame is ImportedFile => Boolean(frame && frame.id !== referenceImage.id))
      .map((frame) => frame.id);

    const uniqueTargetFrameIds = Array.from(new Set(targetFrameIds));

    if (uniqueTargetFrameIds.length === 0) {
      addToast("❌ Không còn frame hợp lệ để Auto Color. Hãy chọn frame khác reference.", "error", 6000);
      return;
    }

    try {
      setIsColoring(true);
      addToast("⏳ Đang tạo Auto Color Sequence job...", "info", 5000);

      const started = await startColorizationJob({
        projectId,
        referenceFrameId: referenceImage.id,
        targetFrameIds: uniqueTargetFrameIds,
        direction: "both",
      });

      let jobId = started.job.id;
      let lastStatus = started.job.status;
      let lastReviewFrameId: string | null = null;
      let totalProcessed = 0;
      const maxIterations = Math.max(uniqueTargetFrameIds.length + 3, 6);

      for (let step = 0; step < maxIterations; step += 1) {
        const continued = await continueColorizationJob({
          projectId,
          jobId,
          maxSteps: 1,
        });

        jobId = continued.job.id;
        lastStatus = continued.status;
        totalProcessed += Number(continued.processed_count || 0);

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
          lastReviewFrameId = continued.frame_id || continued.job.current_review_frame_id || null;
          if (lastReviewFrameId) {
            const reviewIndex = latestFrames.findIndex((frame) => frame.id === lastReviewFrameId);
            if (reviewIndex >= 0) handleFrameChange(reviewIndex);
          }
          break;
        }

        if (continued.status === "completed") {
          break;
        }
      }

      await refreshFrames();

      if (lastStatus === "needs_review_not_reference" || lastStatus === "waiting_review") {
        addToast("⚠️ Auto Color tạm dừng vì có frame cần Review/Correction.", "info", 8000);
      } else if (lastStatus === "completed") {
        addToast(`✅ Auto Color Sequence hoàn thành (${totalProcessed} frame)`, "success", 7000);
      } else {
        addToast(`✅ Auto Color đã xử lý ${totalProcessed} frame.`, "success", 6000);
      }
    } catch (error) {
      console.error("AUTO COLOR CORE ERROR:", error);
      addToast(`❌ Lỗi Auto Color Sequence: ${(error as Error).message}`, "error", 8000);
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
  const files = Array.from(e.target.files || []);

  if (!files.length || !projectId) {
    return;
  }

  try {
    const uploadedFrames: ImportedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Upload image to Supabase Storage
      const imageUrl = await uploadFrameImage(
        file,
        projectId,
      );

      // Insert frame row into DB
      const frame = await createFrame({
          projectId,
          frameIndex:
            uncoloredFiles.length + i,
          sourceImageUrl: imageUrl,
        });

      // Local UI update
      uploadedFrames.push({
        id: frame.id,
        name: file.name,
        url: imageUrl,
      });
    }

    setUncoloredFiles((prev) => [
      ...prev,
      ...uploadedFrames,
    ]);

    setFrameStates((prev) => [
      ...prev,
      ...files.map(
        () => "plain" as FrameState,
      ),
    ]);

    e.target.value = "";
  } catch (error) {
    console.error(error);
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
    setFrameStates((prev) => {
      const next = [...prev];
      next[activeFrame] = "manual";
      return next;
    });

    setReferenceImage(savedReference);
    setFrameRefMap((prev) => ({ ...prev, [activeFrame]: savedReference }));
    setShowReferenceModal(false);
    addToast("✅ Colored keyframe đã được lưu và chọn làm reference", "success");
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

  const handleSetFrameAsGlobalRef = (fi: number) => {
    const f = uncoloredFiles[fi];
    if (f?.paintUrl) {
      setReferenceImage(f);
      setFrameRefMap((p) => ({ ...p, [fi]: f }));
    } else {
      addToast("❌ Frame này chưa có ảnh màu nên chưa thể đặt làm global reference", "error", 6000);
    }
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
    const all = new Set<number>();
    for (let i = 0; i < uncoloredFiles.length; i++) {
      all.add(i);
    }
    setPaintableFrames(all);
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
