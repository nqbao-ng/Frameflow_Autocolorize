import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Brain,
  CheckCircle2,
  Eye,
  Layers,
  MousePointer2,
  Palette,
  Pipette,
  RefreshCw,
  ShieldCheck,
  Wand2,
  XCircle,
} from "lucide-react";
import type { useDashboard } from "../hooks/useDashboard";
import { ROLE_PRESETS } from "../constants/rolePresets";
import {
  applyFrameCorrection,
  cancelColorizationJob,
  continueColorizationJob,
  getVisionSuggestion,
  type ReviewSegment,
} from "../services/colorization.api";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface ReviewCorrectionPanelProps {
  ctx: DashboardCtx;
}

const S = {
  section: {
    borderBottom: "1px solid #2A2A40",
    background: "linear-gradient(180deg,#16172E,#11111B)",
  } as CSSProperties,
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: "none",
    border: "none",
    fontFamily: "'Inter',sans-serif",
  } as CSSProperties,
  label: {
    fontSize: 9,
    fontWeight: 800,
    color: "#7E86A4",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 5,
  } as CSSProperties,
  select: {
    width: "100%",
    border: "1.5px solid #2A2A40",
    borderRadius: 8,
    padding: "7px 8px",
    fontSize: 11,
    color: "#F5F3FF",
    background: "#181827",
    outline: "none",
  } as CSSProperties,
  button: {
    border: "none",
    borderRadius: 8,
    padding: "7px 8px",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    fontFamily: "'Inter',sans-serif",
  } as CSSProperties,
};

function confidenceColor(confidence?: number | null) {
  if (confidence == null) return "#94A3B8";
  if (confidence >= 0.8) return "#10B981";
  if (confidence >= 0.65) return "#F59E0B";
  return "#EF4444";
}

export function ReviewCorrectionPanel({ ctx }: ReviewCorrectionPanelProps) {
  const {
    projectId,
    activeFrame,
    uncoloredFiles,
    activeColor,
    setActiveColor,
    setActiveTool,
    handleSaveCurrentFrame,
    handleFrameChange,
    addToast,
    refreshFrames,
    frameReview: review,
    reviewLoading,
    loadFrameReview,
    selectedSegmentId,
    setSelectedSegmentId,
    segmentPickMode,
    setSegmentPickMode,
    handleRecolorSelectedSegment,
    showLowConfidenceOverlay,
    setShowLowConfidenceOverlay,
    handleCorrectionKeyframeAndRecolorNextFrames,
  } = ctx;

  const currentFrame = uncoloredFiles[activeFrame];
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedRole, setSelectedRole] = useState("unknown");
  const [selectedColor, setSelectedColor] = useState(activeColor || "#3B82F6");
  const [paletteLocked, setPaletteLocked] = useState(true);
  const [applyScope, setApplyScope] = useState<"segment_only" | "same_role_next">("same_role_next");

  const selectedSegment = useMemo<ReviewSegment | null>(() => {
    if (!selectedSegmentId) return null;
    return review?.segments?.find((seg) => Number(seg.segment_id) === Number(selectedSegmentId)) || null;
  }, [review, selectedSegmentId]);

  useEffect(() => {
    if (!selectedSegment) return;
    setSelectedRole(selectedSegment.role_id || selectedSegment.role_guess || "unknown");
    setSelectedColor(selectedSegment.color_hex || selectedSegment.suggested_color || activeColor || "#3B82F6");
  }, [activeColor, selectedSegment]);

  if (!projectId || !currentFrame) return null;

  const reviewFrameId = review?.job?.current_review_frame_id || null;
  const currentNeedsReview = review?.has_review || review?.status === "needs_review_not_reference";
  const visibleReason = review?.reason?.trim() === "Lineart-preserving CV propagation completed." ? "" : review?.reason;
  const hasSegments = Boolean(review?.segments?.length);
  useEffect(() => {
    if (!currentNeedsReview) setApplyScope("segment_only");
  }, [currentNeedsReview]);


  if (!currentNeedsReview && reviewFrameId && reviewFrameId !== currentFrame.id) {
    const reviewIndex = uncoloredFiles.findIndex((frame) => frame.id === reviewFrameId);
    return (
      <div style={S.section}>
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Wand2 size={12} color="#F59E0B" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#F5F3FF" }}>Review Pending</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => reviewIndex >= 0 && handleFrameChange(reviewIndex)}
              style={{ ...S.button, background: "rgba(245,158,11,0.12)", color: "#FBBF24", border: "1px solid rgba(245,158,11,0.35)" }}
            >
              Go to Frame {reviewIndex >= 0 ? reviewIndex + 1 : ""}
            </button>
            <button
              type="button"
              onClick={handleCancelSequence}
              disabled={loading}
              title="Cancel sequence and return unused Processing Frames"
              style={{ ...S.button, background: "rgba(244,63,94,0.12)", color: "#FB7185", border: "1px solid rgba(251,113,133,0.35)" }}
            >
              <XCircle size={11} /> Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleCancelSequence() {
    if (!review?.job?.id || !projectId) return;
    if (!window.confirm("Cancel this colorization sequence? Unused Processing Frames will be returned.")) return;
    try {
      setLoading(true);
      const result = await cancelColorizationJob({ projectId, jobId: review.job.id });
      setSelectedSegmentId(null);
      setSegmentPickMode(false);
      await refreshFrames();
      await loadFrameReview();
      addToast(`✅ ${result.message}`, "success", 6000);
    } catch (error) {
      addToast(`❌ ${(error as Error).message}`, "error", 7000);
    } finally {
      setLoading(false);
    }
  }

  async function handleSuggest() {
    if (!projectId || !currentFrame?.id || !selectedSegmentId || !review?.job?.id) {
      addToast("❌ Chưa có segment/job để Vision AI suggest", "error", 5000);
      return;
    }

    try {
      setLoading(true);
      const data = await getVisionSuggestion({
        projectId,
        jobId: review.job.id,
        frameId: currentFrame.id,
        segmentId: selectedSegmentId,
      });

      setSelectedRole(data.suggestion.role_id || "unknown");
      setSelectedColor(data.suggestion.color_hex || selectedColor);
      setActiveColor(data.suggestion.color_hex || selectedColor);
      addToast("✅ Vision AI đã gợi ý role/màu cho segment", "success");
    } catch (error) {
      console.error("VISION SUGGEST ERROR:", error);
      addToast(`❌ Lỗi Vision AI Suggest: ${(error as Error).message}`, "error", 6000);
    } finally {
      setLoading(false);
    }
  }

  function handleUseColor() {
    setActiveColor(selectedColor);
    addToast("🎨 Màu đã được đưa sang Brush/Fill", "info", 3500);
  }

  function handleMaskRepairMode() {
    setActiveColor(selectedColor);
    setActiveTool("brush");
    addToast("🧩 Mask repair: dùng Brush/Eraser trên canvas, rồi bấm Apply.", "info", 6000);
  }

  async function handleApplyAndContinue() {
    if (!projectId || !currentFrame?.id) return;

    try {
      setApplying(true);

      if (selectedSegmentId) {
        const recolored = handleRecolorSelectedSegment(selectedSegmentId, selectedColor, selectedRole);
        if (!recolored) return;
      }

      const savedUrl = await handleSaveCurrentFrame();
      if (!savedUrl) {
        addToast("❌ Chưa lưu được correction image. Hãy thử lại sau khi canvas load xong.", "error", 7000);
        return;
      }

      if (!review?.job?.id || !selectedSegmentId) {
        await handleCorrectionKeyframeAndRecolorNextFrames();
        return;
      }

      const applied = await applyFrameCorrection({
        projectId,
        jobId: review.job.id,
        frameId: currentFrame.id,
        resultUrl: savedUrl,
        previewUrl: review.preview_url || savedUrl,
        propagateAfter: applyScope !== "segment_only",
        corrections: [
          {
            segment_id: selectedSegmentId,
            role_id: selectedRole,
            color_hex: selectedColor,
            palette_locked: paletteLocked,
            source: "user_manual",
            metadata: {
              ui: "RightPanel ReviewCorrectionPanel",
              apply_scope: applyScope,
              previous_role_guess: selectedSegment?.role_guess || null,
              previous_confidence: selectedSegment?.confidence || null,
            },
          },
        ],
      });

      if (applyScope === "segment_only") {
        await refreshFrames();
        await loadFrameReview();
        addToast("✅ Segment đã được recolor trên frame hiện tại", "success", 6000);
        return;
      }

      let next = await continueColorizationJob({
        projectId,
        jobId: applied.job.id,
        maxSteps: 1,
      });

      for (let step = 0; step < uncoloredFiles.length + 2; step += 1) {
        if (
          next.status === "needs_review_not_reference" ||
          next.status === "waiting_review" ||
          next.status === "completed"
        ) {
          break;
        }
        next = await continueColorizationJob({
          projectId,
          jobId: applied.job.id,
          maxSteps: 1,
        });
      }

      const latestFrames = await refreshFrames();
      if (next.frame_id) {
        const nextIndex = latestFrames.findIndex((frame) => frame.id === next.frame_id);
        if (nextIndex >= 0) handleFrameChange(nextIndex);
      }

      await loadFrameReview();

      if (next.status === "needs_review_not_reference" || next.status === "waiting_review") {
        addToast("✅ Correction đã lưu. Frame tiếp theo cần review.", "success", 7000);
      } else if (next.status === "completed") {
        addToast("✅ Correction đã lưu và sequence hoàn thành", "success", 7000);
      } else {
        addToast("✅ Correction đã lưu, hệ thống tiếp tục propagate", "success", 7000);
      }
    } catch (error) {
      console.error("APPLY CORRECTION ERROR:", error);
      addToast(`❌ Lỗi Apply Correction: ${(error as Error).message}`, "error", 7000);
    } finally {
      setApplying(false);
    }
  }

  if (!hasSegments) {
    return (
      <div style={S.section}>
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={12} color="#8B5CF6" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#F5F3FF" }}>Manual Correction</span>
          </div>
          <button
            type="button"
            onClick={loadFrameReview}
            disabled={reviewLoading}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
            title="Refresh review state"
          >
            <RefreshCw size={12} color={reviewLoading ? "#CBD5E1" : "#64748B"} />
          </button>
        </div>
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ fontSize: 10, color: "#AAB2D5", background: "#181827", border: "1px solid #2A2A40", borderRadius: 8, padding: 8, lineHeight: 1.45, marginBottom: 8 }}>
            {review?.segment_analysis_message || "Segment analysis is unavailable for this frame. Edit with Brush/Fill, then save it as a correction keyframe to continue the sequence."}
          </div>
          <button
            type="button"
            onClick={handleCorrectionKeyframeAndRecolorNextFrames}
            style={{ ...S.button, width: "100%", background: "linear-gradient(135deg,#8B5CF6,#3B82F6)", color: "white" }}
          >
            <CheckCircle2 size={12} /> Correction Keyframe & Continue
          </button>
          {currentNeedsReview && review?.job?.id && (
            <button
              type="button"
              onClick={handleCancelSequence}
              disabled={loading}
              style={{ ...S.button, width: "100%", marginTop: 6, background: "rgba(244,63,94,0.12)", color: "#FB7185", border: "1px solid rgba(251,113,133,0.35)" }}
            >
              <XCircle size={11} /> Cancel sequence & return unused frames
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.section}>
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={12} color="#8B5CF6" />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#F5F3FF" }}>
            {currentNeedsReview ? "Review / Correction" : "Segment Recolor"}
          </span>
          <span style={{ fontSize: 9, color: currentNeedsReview ? "#7C3AED" : "#2563EB", background: currentNeedsReview ? "rgba(168,85,247,0.17)" : "rgba(59,130,246,0.13)", padding: "1px 6px", borderRadius: 4 }}>
            {currentNeedsReview ? "needs review" : "edit mode"}
          </span>
        </div>
        <button
          type="button"
          onClick={loadFrameReview}
          disabled={reviewLoading}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
          title="Refresh review state"
        >
          <RefreshCw size={12} color={reviewLoading ? "#CBD5E1" : "#64748B"} />
        </button>
      </div>

      <div style={{ padding: "0 12px 12px" }}>
        {visibleReason && (
          <div style={{ fontSize: 10, color: "#FBBF24", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 8, padding: 8, marginBottom: 10, lineHeight: 1.45 }}>
            {visibleReason}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ background: "#181827", border: "1px solid #2A2A40", borderRadius: 8, padding: 7 }}>
            <div style={{ fontSize: 8, color: "#7E86A4", fontWeight: 800, textTransform: "uppercase" }}>Frame</div>
            <div style={{ fontSize: 11, color: "#F5F3FF", fontWeight: 800 }}>#{activeFrame + 1}</div>
          </div>
          <div style={{ background: "#181827", border: "1px solid #2A2A40", borderRadius: 8, padding: 7 }}>
            <div style={{ fontSize: 8, color: "#7E86A4", fontWeight: 800, textTransform: "uppercase" }}>Confidence</div>
            <div style={{ fontSize: 11, color: confidenceColor(review?.confidence_score), fontWeight: 800 }}>
              {review?.confidence_score != null ? `${Math.round(review.confidence_score * 100)}%` : "unknown"}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setSegmentPickMode(!segmentPickMode)}
            style={{ ...S.button, background: segmentPickMode ? "rgba(255,46,154,0.18)" : "rgba(124,58,237,0.14)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.42)" }}
          >
            <MousePointer2 size={11} /> {segmentPickMode ? "Click canvas..." : "Pick segment"}
          </button>
          <button
            type="button"
            onClick={() => setShowLowConfidenceOverlay(!showLowConfidenceOverlay)}
            style={{ ...S.button, background: showLowConfidenceOverlay ? "rgba(245,158,11,0.16)" : "#181827", color: showLowConfidenceOverlay ? "#FBBF24" : "#AAB2D5", border: "1px solid #2A2A40" }}
          >
            <Layers size={11} /> Low-conf overlay
          </button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={S.label}>Selected segment</div>
          <select
            value={selectedSegmentId ?? ""}
            onChange={(e) => setSelectedSegmentId(Number(e.target.value))}
            style={S.select}
          >
            {review?.segments?.map((seg) => (
              <option key={seg.segment_id} value={seg.segment_id}>
                Segment {seg.segment_id} · {seg.role_id || seg.role_guess || "unknown"} · {seg.confidence != null ? `${Math.round(seg.confidence * 100)}%` : "?"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={S.label}>Role preset</div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={S.select}
          >
            {ROLE_PRESETS.map((role) => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 4 }}>
            <Palette size={10} /> Reference palette
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 3 }}>
            {(review?.palette || []).map((paletteColor) => (
              <button
                key={paletteColor}
                type="button"
                title={paletteColor}
                onClick={() => {
                  setSelectedColor(paletteColor);
                  setActiveColor(paletteColor);
                }}
                style={{
                  height: 22,
                  borderRadius: 5,
                  background: paletteColor,
                  border: selectedColor.toLowerCase() === paletteColor.toLowerCase() ? "2px solid #FF2E9A" : "1px solid #2A2A40",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={S.label}>Color picker</div>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => {
                setSelectedColor(e.target.value);
                setActiveColor(e.target.value);
              }}
              style={{ width: "100%", height: 32, border: "1.5px solid #2A2A40", borderRadius: 8, background: "#181827", padding: 2 }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 17, fontSize: 10, color: "#AAB2D5", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={paletteLocked}
              onChange={(e) => setPaletteLocked(e.target.checked)}
            />
            lock
          </label>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={S.label}>Apply scope</div>
          <select value={applyScope} onChange={(e) => setApplyScope(e.target.value as typeof applyScope)} style={S.select}>
            <option value="segment_only">This segment only</option>
            <option value="same_role_next">Same role in next frames</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <button
            type="button"
            onClick={handleUseColor}
            style={{ ...S.button, background: "rgba(124,58,237,0.14)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.42)" }}
          >
            <Pipette size={11} /> Use color
          </button>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={loading || !selectedSegmentId}
            style={{ ...S.button, background: "rgba(124,58,237,0.15)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.42)" }}
          >
            <Brain size={11} /> Vision AI
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleRecolorSelectedSegment(selectedSegmentId, selectedColor, selectedRole)}
          disabled={!selectedSegmentId}
          style={{ ...S.button, width: "100%", background: "rgba(16,185,129,0.13)", color: "#34D399", border: "1px solid rgba(52,211,153,0.38)", marginBottom: 6 }}
        >
          <Palette size={11} /> Recolor selected segment now
        </button>

        <button
          type="button"
          onClick={handleMaskRepairMode}
          style={{ ...S.button, width: "100%", background: "rgba(249,115,22,0.12)", color: "#FB923C", border: "1px solid rgba(251,146,60,0.38)", marginBottom: 6 }}
        >
          <Eye size={11} /> Manual brush/eraser repair
        </button>

        <button
          type="button"
          onClick={handleApplyAndContinue}
          disabled={applying || !selectedSegmentId}
          style={{
            ...S.button,
            width: "100%",
            background: applying ? "#3A3A52" : "linear-gradient(135deg,#8B5CF6,#3B82F6)",
            color: "white",
            boxShadow: applying ? "none" : "0 2px 8px rgba(139,92,246,0.28)",
          }}
        >
          <CheckCircle2 size={12} />
          {applying ? "Applying..." : "Apply Correction & Continue"}
        </button>

        {currentNeedsReview && review?.job?.id && (
          <button
            type="button"
            onClick={handleCancelSequence}
            disabled={loading || applying}
            style={{ ...S.button, width: "100%", marginTop: 6, background: "transparent", color: "#FB7185", border: "1px solid rgba(251,113,133,0.35)" }}
          >
            <XCircle size={11} /> Cancel sequence & return unused frames
          </button>
        )}

        <div style={{ fontSize: 9, color: "#AAB2D5", lineHeight: 1.45, marginTop: 8 }}>
          Flow: pick segment → chọn role/màu → recolor vùng hoặc sửa tay → Apply để frame này thành correction keyframe.
        </div>
      </div>
    </div>
  );
}
