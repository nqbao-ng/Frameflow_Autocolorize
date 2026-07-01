import { Sparkles, Star, X, Download, Trash2 } from "lucide-react";
import type { useDashboard } from "../hooks/useDashboard";
import { useState } from "react";
import { ExportModal } from "./ExportModal";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface ContextMenuProps {
  ctx: DashboardCtx;
}

export function ContextMenu({ ctx }: ContextMenuProps) {
  const {
    contextMenu, setContextMenu,
    uncoloredFiles, frameStates, frameRefMap, framePaints,
    referenceImage,
    handleSetFrameRef, handleSetFrameAsGlobalRef, handleClearFrameRef,
    deleteFrame,
    addToast,
  } = ctx;

  const [showExportModal, setShowExportModal] = useState(false);

  if (!contextMenu) return null;

  const handleAIColor = () => {
    // Validation: check if reference is selected
    if (!referenceImage) {
      addToast("❌ Vui lòng chọn ảnh tham chiếu trước!", "error");
      return;
    }
    addToast("ℹ️ AI Color This Frame đang tạm khóa. Hoàn thành Auto Color Sequence trước, rồi mở rộng tính năng này sau.", "info", 6000);
    setContextMenu(null);
  };

  return (
    <>
      <div onMouseDown={() => setContextMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
      <div
        style={{
          position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 200,
          background: "white", borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #E2E8F0",
          minWidth: 220, overflow: "hidden", fontFamily: "'Inter',sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ padding: "9px 13px 7px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {uncoloredFiles[contextMenu.frameIndex] && (
              <img src={framePaints[contextMenu.frameIndex] || uncoloredFiles[contextMenu.frameIndex].paintUrl || uncoloredFiles[contextMenu.frameIndex].url} alt="" style={{ width: 20, height: 20, borderRadius: 3, objectFit: "cover", border: "1px solid #E2E8F0" }} />
            )}
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>Frame {contextMenu.frameIndex + 1}</span>
            {frameStates[contextMenu.frameIndex] === "ai" && (
              <span style={{ fontSize: 8, fontWeight: 600, color: "#8B5CF6", background: "#F3F0FF", padding: "1px 5px", borderRadius: 100 }}>AI</span>
            )}
            {frameStates[contextMenu.frameIndex] === "manual" && (
              <span style={{ fontSize: 8, fontWeight: 600, color: "#F59E0B", background: "#FFFBEB", padding: "1px 5px", borderRadius: 100 }}>Manual</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "5px 0" }}>
          {referenceImage && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); handleSetFrameRef(contextMenu.frameIndex); }}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}
            >
              <div style={{ width: 26, height: 26, borderRadius: 5, overflow: "hidden", flexShrink: 0, border: "1.5px solid #E2E8F0" }}>
                <img src={referenceImage.paintUrl || referenceImage.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>Assign Current Ref</div>
                <div style={{ fontSize: 9, color: "#94A3B8", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referenceImage.name}</div>
              </div>
            </button>
          )}

          {(frameStates[contextMenu.frameIndex] === "ai" || frameStates[contextMenu.frameIndex] === "manual") && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); handleSetFrameAsGlobalRef(contextMenu.frameIndex); }}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}
            >
              <div style={{ width: 26, height: 26, borderRadius: 5, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid #FDE68A" }}>
                <Star size={13} color="#F59E0B" fill="#F59E0B" />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>Set as Global Reference</div>
                <div style={{ fontSize: 9, color: "#94A3B8" }}>Guide AI with this frame</div>
              </div>
            </button>
          )}

          <button
            onMouseDown={(e) => {
              e.stopPropagation();
              handleAIColor();
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 5, background: "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={13} color="#8B5CF6" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>AI Color This Frame</div>
              <div style={{ fontSize: 9, color: "#94A3B8" }}>Using current reference</div>
            </div>
          </button>

          {frameRefMap[contextMenu.frameIndex] && (
            <>
              <div style={{ height: 1, background: "#F1F5F9", margin: "3px 0" }} />
              <button
                onMouseDown={(e) => { e.stopPropagation(); handleClearFrameRef(contextMenu.frameIndex); }}
                style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}
              >
                <div style={{ width: 26, height: 26, borderRadius: 5, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <X size={13} color="#EF4444" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#EF4444" }}>Remove Ref Assignment</div>
                  <div style={{ fontSize: 9, color: "#94A3B8" }}>Use global reference</div>
                </div>
              </button>
            </>
          )}

          {/* Separator */}
          <div style={{ height: 1, background: "#F1F5F9", margin: "3px 0" }} />

           {/* Export Button */}
           <button
             onMouseDown={(e) => { e.stopPropagation(); setShowExportModal(true); }}
             style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}
           >
             <div style={{ width: 26, height: 26, borderRadius: 5, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
               <Download size={13} color="#0EA5E9" />
             </div>
             <div>
               <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>Export</div>
               <div style={{ fontSize: 9, color: "#94A3B8" }}>Download frame(s)</div>
             </div>
           </button>

           {/* Export Modal - Pass frameIndex for context menu */}
           <ExportModal
             ctx={ctx}
             isOpen={showExportModal}
             onClose={() => { setShowExportModal(false); setContextMenu(null); }}
             frameIndex={contextMenu?.frameIndex}
           />

          {/* Delete Button */}
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  deleteFrame(contextMenu.frameIndex);
                  setContextMenu(null);
                }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 13px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Inter',sans-serif" }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 5, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Trash2 size={13} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#DC2626" }}>Delete Frame</div>
              <div style={{ fontSize: 9, color: "#94A3B8" }}>Remove from project</div>
            </div>
           </button>
         </div>
       </div>
    </>
  );
}
