import { X, List, Upload, FileImage, Check } from "lucide-react";
import type { useDashboard } from "../hooks/useDashboard";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface ReferenceModalProps {
  ctx: DashboardCtx;
}

export function ReferenceModal({ ctx }: ReferenceModalProps) {
  const {
    showReferenceModal, setShowReferenceModal,
    refModalTab, setRefModalTab,
    selectedRefId, setSelectedRefId,
    uncoloredFiles,
    customColoredInputRef,
    handleConfirmReference,
  } = ctx;

  if (!showReferenceModal) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setShowReferenceModal(false); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 600, boxShadow: "0 32px 80px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "88vh" }}>

        {/* Header */}
        <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", margin: 0 }}>Set Reference Image</h2>
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>Choose a frame or upload a colored reference for AI guidance.</p>
          </div>
          <button
            onClick={() => setShowReferenceModal(false)}
            style={{ background: "#F1F5F9", border: "none", borderRadius: 7, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0, marginLeft: 10 }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "12px 22px 0", display: "flex", gap: 2, borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          {([
            { id: "list" as const, label: "From Uncolored List", icon: <List size={11} /> },
            { id: "upload" as const, label: "Upload Colored Image", icon: <Upload size={11} /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRefModalTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "7px 12px",
                borderRadius: "6px 6px 0 0", border: "none", background: "transparent",
                cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif",
                fontWeight: refModalTab === tab.id ? 600 : 400,
                color: refModalTab === tab.id ? "#3B82F6" : "#64748B",
                borderBottom: refModalTab === tab.id ? "2px solid #3B82F6" : "2px solid transparent",
                marginBottom: -1, transition: "all 0.15s",
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
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
                <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>
                  {uncoloredFiles.length} file{uncoloredFiles.length !== 1 ? "s" : ""} — click to select
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {uncoloredFiles.map((frame) => {
                    const isSel = selectedRefId === frame.id;
                    return (
                      <button
                        key={frame.id}
                        onClick={() => setSelectedRefId(isSel ? null : frame.id)}
                        style={{
                          border: isSel ? "2.5px solid #3B82F6" : "2px solid #E2E8F0",
                          borderRadius: 10, overflow: "hidden", cursor: "pointer",
                          padding: 0, background: "white", position: "relative",
                          boxShadow: isSel ? "0 0 0 3px rgba(59,130,246,0.16)" : "none",
                          transition: "all 0.15s",
                        }}
                      >
                        <img src={frame.url} alt={frame.name} style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }} />
                        {isSel && (
                          <div style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={10} color="white" strokeWidth={3} />
                          </div>
                        )}
                        <div style={{ padding: "5px 8px", background: isSel ? "#EFF6FF" : "#FAFAFA", borderTop: "1px solid #F1F5F9" }}>
                          <p style={{ fontSize: 9, fontWeight: 600, color: isSel ? "#3B82F6" : "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {frame.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            <div
              onClick={() => customColoredInputRef.current?.click()}
              style={{ border: "2px dashed #CBD5E1", borderRadius: 12, padding: "36px 22px", textAlign: "center", cursor: "pointer", background: "#FAFAFA" }}
            >
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Upload size={20} color="#3B82F6" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 3 }}>Click to upload a colored image</p>
              <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 14 }}>PNG, JPG or PSD — used as the AI color reference</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 8, background: "#3B82F6", color: "white", fontSize: 12, fontWeight: 600 }}>
                <Upload size={11} />Browse Files
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            {selectedRefId && refModalTab === "list" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src={uncoloredFiles.find((f) => f.id === selectedRefId)?.url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                <span style={{ fontSize: 11, color: "#475569" }}>
                  <strong style={{ color: "#1E293B" }}>{uncoloredFiles.find((f) => f.id === selectedRefId)?.name}</strong> selected
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 11, color: "#94A3B8" }}>
                {refModalTab === "list" ? "No frame selected" : "Select a file above"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button
              onClick={() => setShowReferenceModal(false)}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#475569", fontFamily: "'Inter',sans-serif" }}
            >
              Cancel
            </button>
            {refModalTab === "list" && (
              <button
                onClick={handleConfirmReference}
                disabled={!selectedRefId}
                style={{
                  padding: "7px 16px", borderRadius: 8, border: "none",
                  background: selectedRefId ? "#3B82F6" : "#E2E8F0",
                  cursor: selectedRefId ? "pointer" : "not-allowed",
                  fontSize: 12, fontWeight: 600,
                  color: selectedRefId ? "white" : "#94A3B8",
                  fontFamily: "'Inter',sans-serif",
                  boxShadow: selectedRefId ? "0 2px 8px rgba(59,130,246,0.25)" : "none",
                  transition: "all 0.15s",
                }}
              >
                Use as Reference
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}