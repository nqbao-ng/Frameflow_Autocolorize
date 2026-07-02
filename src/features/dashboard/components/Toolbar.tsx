
import { Link } from "react-router";
import {
  ChevronRight,
  RotateCcw,
  RotateCw,
  Sparkles,
  Forward,
  Download,
  RefreshCw,
  Save,
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
  border: "1px solid #E2E8F0",
  background: "white",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 500,
  color: "#475569",
  fontFamily: "'Inter', sans-serif",
};

const divider: React.CSSProperties = {
  width: 1,
  height: 18,
  background: "#E2E8F0",
  flexShrink: 0,
  margin: "0 2px",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Toolbar({ ctx, projectName }: ToolbarProps) {
  const {
    activeFrame,
    undoStack,
    redoStack,
    isColoring,
    handleAutoColor,
    handleUndo,
    handleRedo,
    handleSaveCurrentFrame,
  } = ctx;

  const canUndo = (undoStack[activeFrame]?.length ?? 0) > 0;
  const canRedo = (redoStack[activeFrame]?.length ?? 0) > 0;

  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        height: 52,
        flexShrink: 0,
        background: "white",
        borderBottom: "1px solid #E2E8F0",
      }}
    >
      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Link
          to="/projects"
          style={{ fontSize: 12, color: "#94A3B8", textDecoration: "none" }}
        >
          Projects
        </Link>
        <ChevronRight size={12} color="#CBD5E1" />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>
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
            background: isColoring ? "#E0E7FF" : "#3B82F6",
            color: isColoring ? "#3B82F6" : "white",
            fontWeight: 600,
            boxShadow: "0 2px 6px rgba(59,130,246,0.25)",
          }}
        >
          {isColoring
            ? <RefreshCw size={11} className="animate-spin" />
            : <Sparkles size={11} />}
          {isColoring ? "Coloring…" : "AI Auto Color"}
        </button>

        {/* Propagate */}
        <button style={baseBtn}>
          <Forward size={11} />
          Propagate
        </button>

        {/* Export */}
        <button
          onClick={() => setShowExportModal(true)}
          style={{
            ...baseBtn,
            border: "none",
            padding: "5px 11px",
            background: "#1E293B",
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