// import { Link } from "react-router";
// import {
//   ChevronRight, RotateCcw, RotateCw, Sparkles, Forward, Download, RefreshCw,
// } from "lucide-react";
// import type { useDashboard } from "../hooks/useDashboard";

// type DashboardCtx = ReturnType<typeof useDashboard>;

// interface ToolbarProps {
//   ctx: DashboardCtx;
// }

// export function Toolbar({ ctx }: ToolbarProps) {
//   const {
//     activeFrame, undoStack, redoStack,
//     lockLineArt, setLockLineArt,
//     isColoring, handleAutoColor, handleUndo, handleRedo,
//   } = ctx;

//   return (
//     <div
//       style={{
//         background: "white",
//         borderBottom: "1px solid #E2E8F0",
//         padding: "0 18px",
//         height: 52,
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "space-between",
//         flexShrink: 0,
//       }}
//     >
//       {/* Breadcrumb */}
//       <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
//         <Link to="/projects" style={{ fontSize: 12, color: "#94A3B8", textDecoration: "none" }}>
//           Projects
//         </Link>
//         <ChevronRight size={12} color="#CBD5E1" />
//         <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>Magic Girl Animation</span>
//       </div>

//       {/* Actions */}
//       <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
//         <button
//           onClick={handleUndo}
//           title="Undo (Ctrl+Z)"
//           style={{
//             display: "flex", alignItems: "center", gap: 4,
//             padding: "5px 9px", borderRadius: 6,
//             border: "1px solid #E2E8F0", background: "white",
//             cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#475569",
//             fontFamily: "'Inter',sans-serif",
//             opacity: (undoStack[activeFrame]?.length || 0) > 0 ? 1 : 0.4,
//           }}
//         >
//           <RotateCcw size={11} />Undo
//         </button>

//         <button
//           onClick={handleRedo}
//           title="Redo (Ctrl+Y)"
//           style={{
//             display: "flex", alignItems: "center", gap: 4,
//             padding: "5px 9px", borderRadius: 6,
//             border: "1px solid #E2E8F0", background: "white",
//             cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#475569",
//             fontFamily: "'Inter',sans-serif",
//             opacity: (redoStack[activeFrame]?.length || 0) > 0 ? 1 : 0.4,
//           }}
//         >
//           <RotateCw size={11} />Redo
//         </button>

//         <div style={{ width: 1, height: 18, background: "#E2E8F0", flexShrink: 0, margin: "0 2px" }} />

//         {/* Lock Line Art */}
//         <button
//           onClick={() => setLockLineArt((v) => !v)}
//           title={lockLineArt ? "Line Art Locked — click để mở khóa." : "Lock Line Art — ngăn vẽ đè lên outline"}
//           style={{
//             display: "flex", alignItems: "center", gap: 5,
//             padding: "4px 10px", borderRadius: 6,
//             border: lockLineArt ? "1.5px solid #6366F1" : "1px solid #E2E8F0",
//             background: lockLineArt ? "#EEF2FF" : "white",
//             cursor: "pointer", fontSize: 11,
//             fontWeight: lockLineArt ? 700 : 500,
//             color: lockLineArt ? "#4F46E5" : "#64748B",
//             fontFamily: "'Inter',sans-serif",
//             boxShadow: lockLineArt ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
//             transition: "all 0.15s",
//           }}
//         >
//           {lockLineArt ? (
//             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
//             </svg>
//           ) : (
//             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//               <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
//             </svg>
//           )}
//           {lockLineArt ? "Locked" : "Lock Line Art"}
//         </button>

//         <div style={{ width: 1, height: 18, background: "#E2E8F0", flexShrink: 0, margin: "0 2px" }} />

//         <button
//           onClick={handleAutoColor}
//           style={{
//             display: "flex", alignItems: "center", gap: 4,
//             padding: "5px 11px", borderRadius: 6, border: "none",
//             background: isColoring ? "#E0E7FF" : "#3B82F6",
//             cursor: "pointer", fontSize: 11, fontWeight: 600,
//             color: isColoring ? "#3B82F6" : "white",
//             fontFamily: "'Inter',sans-serif",
//             boxShadow: "0 2px 6px rgba(59,130,246,0.25)",
//             transition: "all 0.2s", marginLeft: 2,
//           }}
//         >
//           {isColoring ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
//           {isColoring ? "Coloring…" : "AI Auto Color"}
//         </button>

//         <button
//           style={{
//             display: "flex", alignItems: "center", gap: 4,
//             padding: "5px 9px", borderRadius: 6,
//             border: "1px solid #E2E8F0", background: "white",
//             cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#475569",
//             fontFamily: "'Inter',sans-serif",
//           }}
//         >
//           <Forward size={11} />Propagate
//         </button>

//         <button
//           style={{
//             display: "flex", alignItems: "center", gap: 4,
//             padding: "5px 11px", borderRadius: 6, border: "none",
//             background: "#1E293B", cursor: "pointer",
//             fontSize: 11, fontWeight: 600, color: "white",
//             fontFamily: "'Inter',sans-serif", marginLeft: 2,
//           }}
//         >
//           <Download size={11} />Export
//         </button>
//       </div>
//     </div>
//   );
// }
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