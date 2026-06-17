import { useState, useMemo } from "react";
import { Download, X } from "lucide-react";
import type { useDashboard } from "../hooks/useDashboard";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface ExportModalProps {
  ctx: DashboardCtx;
  isOpen: boolean;
  onClose: () => void;
  frameIndex?: number; // For context menu export of specific frame
}

export function ExportModal({ ctx, isOpen, onClose, frameIndex }: ExportModalProps) {
  const {
    uncoloredFiles,
    exportSingleFrame,
    exportAllFrames,
    addToast,
  } = ctx;

  const [mode, setMode] = useState<"options" | "select">("options");
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  if (!isOpen) return null;

  const handleSelectFrame = (idx: number) => {
    const newSelected = new Set(selectedFrames);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedFrames(newSelected);
    setSelectAll(newSelected.size === uncoloredFiles.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedFrames(new Set());
      setSelectAll(false);
    } else {
      setSelectedFrames(new Set(uncoloredFiles.map((_, i) => i)));
      setSelectAll(true);
    }
  };

  const handleExportThisFrame = async () => {
    if (frameIndex !== undefined) {
      // From context menu - export single frame
      await exportSingleFrame(frameIndex);
      onClose();
    } else {
      // From toolbar - switch to frame selection mode
      setMode("select");
    }
  };

  const handleExportSelected = async () => {
    if (selectedFrames.size === 0) {
      addToast("❌ Vui lòng chọn ít nhất một frame", "error");
      return;
    }

    if (selectedFrames.size === uncoloredFiles.length) {
      // Export all as ZIP
      await exportAllFrames();
    } else {
      // Export selected frames as ZIP
      const selectedIndices = Array.from(selectedFrames).sort((a, b) => a - b);
      await ctx.exportMultipleFrames(selectedIndices);
    }
    onClose();
  };

  const handleClose = () => {
    setMode("options");
    setSelectedFrames(new Set());
    setSelectAll(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 399,
          background: "rgba(0,0,0,0.4)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 400,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: "1px solid #E2E8F0",
          padding: 28,
          minWidth: 420,
          maxWidth: 500,
          fontFamily: "'Inter', sans-serif",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} color="#94A3B8" />
        </button>

        {mode === "options" ? (
          <>
            {/* Title */}
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 20 }}>
              Export Options
            </div>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Export This Frame */}
              {frameIndex !== undefined && (
                <button
                  onClick={handleExportThisFrame}
                  style={{
                    padding: "16px 18px",
                    border: "1.5px solid #3B82F6",
                    background: "#EFF6FF",
                    borderRadius: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#DBEAFE";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#EFF6FF";
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: "#3B82F6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Download size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                      Export This Frame
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      Download frame {frameIndex + 1} as PNG
                    </div>
                  </div>
                </button>
              )}

              {/* Export Selected Frames */}
              {frameIndex === undefined && (
              <button
                onClick={() => {
                  setMode("select");
                }}
                style={{
                  padding: "16px 18px",
                  border: "1.5px solid #8B5CF6",
                  background: "#F3F0FF",
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#EBE0FF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F3F0FF";
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "#8B5CF6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Download size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                    Export Selected Frames
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Choose which frames to download
                  </div>
                </div>
              </button>
              )}

              {/* Export All Frames */}
              <button
                onClick={async () => {
                  await exportAllFrames();
                  handleClose();
                }}
                style={{
                  padding: "16px 18px",
                  border: "1.5px solid #10B981",
                  background: "#F0FDF4",
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#DCFCE7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F0FDF4";
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "#10B981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Download size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                    Export All Frames as ZIP
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Download all {uncoloredFiles.length} frames as compressed file
                  </div>
                </div>
              </button>

              {/* Cancel */}
              <button
                onClick={handleClose}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #E2E8F0",
                  background: "white",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "center",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#64748B",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Frame Selection */}
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 16 }}>
              Select Frames
            </div>

            {/* Select All */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px",
                borderRadius: 8,
                background: "#F8FAFC",
                cursor: "pointer",
                marginBottom: 12,
                border: "1px solid #E2E8F0",
              }}
            >
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#3B82F6" }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", flex: 1 }}>
                Select All ({uncoloredFiles.length})
              </span>
            </label>

            {/* Frame List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 300,
                overflowY: "auto",
                marginBottom: 16,
                paddingRight: 8,
              }}
            >
              {uncoloredFiles.map((file, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: selectedFrames.has(idx) ? "#EFF6FF" : "white",
                    cursor: "pointer",
                    border: selectedFrames.has(idx) ? "1.5px solid #3B82F6" : "1px solid #E2E8F0",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFrames.has(idx)}
                    onChange={() => handleSelectFrame(idx)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#3B82F6" }}
                  />
                  {file.url && (
                    <img
                      src={file.url}
                      alt={file.name}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        objectFit: "cover",
                        flexShrink: 0,
                        border: "1px solid #E2E8F0",
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      {selectedFrames.has(idx) ? "✓ Selected" : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setMode("options")}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  border: "1px solid #E2E8F0",
                  background: "white",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#64748B",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                }}
              >
                Back
              </button>
              <button
                onClick={handleExportSelected}
                disabled={selectedFrames.size === 0}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  border: "none",
                  background: selectedFrames.size === 0 ? "#E2E8F0" : "#3B82F6",
                  borderRadius: 8,
                  cursor: selectedFrames.size === 0 ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: selectedFrames.size === 0 ? "#94A3B8" : "white",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (selectedFrames.size > 0) {
                    e.currentTarget.style.background = "#2563EB";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFrames.size > 0) {
                    e.currentTarget.style.background = "#3B82F6";
                  }
                }}
              >
                Export ({selectedFrames.size})
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}