
import { Link, useParams } from "react-router";
import {
  ChevronRight,
  RotateCcw,
  RotateCw,
  Sparkles,
  Forward,
  Download,
  RefreshCw,
  Save,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import type { useDashboard } from "../hooks/useDashboard";
import { ExportModal } from "./ExportModal";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface ToolbarProps {
  ctx: DashboardCtx;
  projectName?: string;
}

// ─── Shared button base styles ────────────────────────────────────────────────

const baseBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 9px",
  borderRadius: 6,
  border: "1px solid #2A2A40",
  background: "#181827",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 500,
  color: "#AAB2D5",
  fontFamily: "'Inter', sans-serif",
};

const divider: React.CSSProperties = {
  width: 1,
  height: 18,
  background: "#2A2A40",
  flexShrink: 0,
  margin: "0 2px",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Toolbar({ ctx, projectName }: ToolbarProps) {
  const { projectId } = useParams();
  const {
    activeFrame,
    undoStack,
    redoStack,
    isColoring,
    handleAutoColor,
    handleUndo,
    handleRedo,
    handleSaveCurrentFrame,
    handleCorrectionKeyframeAndRecolorNextFrames,
    uncoloredFiles,
    frameStates,
    framePaints,
    detachedReferenceFrameId,
  } = ctx;

  const canUndo = (undoStack[activeFrame]?.length ?? 0) > 0;
  const canRedo = (redoStack[activeFrame]?.length ?? 0) > 0;

  const [showExportModal, setShowExportModal] = useState(false);

  const activeFrameData = uncoloredFiles[activeFrame];
  const activeCreativeSource =
    (frameStates[activeFrame] === "manual" ? framePaints[activeFrame] : null) ||
    (activeFrameData?.id === detachedReferenceFrameId
      ? activeFrameData?.url
      : activeFrameData?.paintUrl || activeFrameData?.url) ||
    null;


  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        height: 52,
        flexShrink: 0,
        background: "#181827",
        borderBottom: "1px solid #2A2A40",
      }}
    >
      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Link
          to="/projects"
          style={{ fontSize: 12, color: "#7E86A4", textDecoration: "none" }}
        >
          Projects
        </Link>
        <ChevronRight size={12} color="#4A4A67" />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#F5F3FF" }}>
          {projectName || "Untitled Project"}
        </span>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

        {/* Undo */}
        <button
          onClick={handleUndo}
          title="Undo (Ctrl+Z)"
          style={{ ...baseBtn, opacity: canUndo ? 1 : 0.4 }}
        >
          <RotateCcw size={11} />
          Undo
        </button>

        {/* Redo */}
        <button
          onClick={handleRedo}
          title="Redo (Ctrl+Y)"
          style={{ ...baseBtn, opacity: canRedo ? 1 : 0.4 }}
        >
          <RotateCw size={11} />
          Redo
        </button>

        <div style={divider} />

        {/* Save */}
        <button
          onClick={handleSaveCurrentFrame}
          style={{
            ...baseBtn,
            border: "none",
            background: "#10B981",
            color: "white",
            fontWeight: 700,
            padding: "5px 12px",
            gap: 5,
            boxShadow: "0 2px 8px rgba(16,185,129,0.25)",
          }}
        >
          <Save size={11} />
          Save
        </button>

         <div style={divider} />

        {/* AI Auto Color */}
        <button
          onClick={handleAutoColor}
          style={{
            ...baseBtn,
            border: "none",
            padding: "5px 11px",
            background: isColoring ? "rgba(168,85,247,0.14)" : "linear-gradient(135deg,#7C3AED,#FF2E9A)",
            color: isColoring ? "#C084FC" : "white",
            fontWeight: 600,
            boxShadow: "0 3px 12px rgba(168,85,247,0.3)",
          }}
        >
          {isColoring
            ? <RefreshCw size={11} className="animate-spin" />
            : <Sparkles size={11} />}
          {isColoring ? "Coloring…" : "AI Auto Color"}
        </button>

        {/* Correction keyframe + propagate */}
        <button
          onClick={handleCorrectionKeyframeAndRecolorNextFrames}
          disabled={isColoring}
          title="Save this frame as a correction keyframe and recolor following frames"
          style={{
            ...baseBtn,
            border: "1px solid rgba(168,85,247,0.45)",
            background: isColoring ? "#141420" : "rgba(124,58,237,0.12)",
            color: isColoring ? "#7E86A4" : "#C084FC",
            fontWeight: 700,
            cursor: isColoring ? "not-allowed" : "pointer",
          }}
        >
          <Forward size={11} />
          Correct & Continue
        </button>

        {/* Creative tools */}
        <Link
          to="/creative-studio"
          state={{
            mode: "outpaint",
            sourceImage: activeCreativeSource,
            sourceName: activeFrameData?.name || `Frame ${activeFrame + 1}`,
            projectId,
            frameId: activeFrameData?.id || null,
            returnTo: projectId ? `/dashboard/${projectId}` : "/projects",
          }}
          title="Open the current frame in AI Creative Studio"
          style={{
            ...baseBtn,
            border: "1px solid rgba(255,46,154,0.42)",
            background: "rgba(255,46,154,0.08)",
            color: "#F9A8D4",
            fontWeight: 700,
            textDecoration: "none",
            opacity: activeCreativeSource ? 1 : 0.5,
            pointerEvents: activeCreativeSource ? "auto" : "none",
          }}
        >
          <WandSparkles size={11} />
          Creative Studio
        </Link>

        {/* Export */}
        <button
          onClick={() => setShowExportModal(true)}
          style={{
            ...baseBtn,
            border: "none",
            padding: "5px 11px",
            background: "#0F0F19",
            color: "white",
            fontWeight: 600,
            marginLeft: 2,
          }}
        >
          <Download size={11} />
          Export
        </button>

        {/* Export Modal */}
        <ExportModal
          ctx={ctx}
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
        />

      </div>
    </div>
  );
}