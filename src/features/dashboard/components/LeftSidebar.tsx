import { Link } from "react-router";
import {
  ChevronRight, LayoutGrid, FileImage, Star,
  List, ImageIcon, Crown, FolderOpen, X, Eye,
} from "lucide-react";
import type { useDashboard } from "../hooks/useDashboard";
import { BrandLogo } from "@/shared/components/BrandLogo";

type DashboardCtx = ReturnType<typeof useDashboard>;

interface LeftSidebarProps {
  ctx: DashboardCtx;
  projectName?: string;
}

export function LeftSidebar({ ctx, projectName }: LeftSidebarProps) {
  const {
    uncoloredFiles, activeFrame, frameStates, frameRefMap, framePaints,
    referenceImage, detachedReferenceFrameId,
    showReferencePreview, openReferencePreview, clearReferenceSelection,
    isImporting,
    uncoloredInputRef,
    handleFrameChange, setContextMenu,
    openReferenceModal,
  } = ctx;

  return (
    <aside
      style={{
        width: 228, minWidth: 228,
        background: "linear-gradient(180deg,#EFF6FF,#F0F4FF)",
        borderRight: "1px solid #E2E8F0",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "14px 14px 2px", flexShrink: 0 }}>
        <BrandLogo height={31} />
      </div>

      {/* Project breadcrumb */}
      <div style={{ padding: "8px 14px 0", flexShrink: 0 }}>
        <Link to="/projects" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748B", textDecoration: "none", padding: "5px 7px", borderRadius: 7, background: "rgba(255,255,255,0.6)" }}>
           <FolderOpen size={11} />
           <span>{projectName || "Untitled Project"}</span>
           <ChevronRight size={10} style={{ marginLeft: "auto" }} />
         </Link>
      </div>

      {/* Frames header */}
      <div style={{ padding: "12px 14px 6px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <LayoutGrid size={11} color="#64748B" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }}>Frames</span>
          </div>
          <span style={{ fontSize: 9, color: "#94A3B8", background: "#E2E8F0", padding: "1px 5px", borderRadius: 100 }}>
            {uncoloredFiles.length}
          </span>
        </div>
      </div>

      {/* Frame grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 10px", scrollbarWidth: "thin" }}>
        {uncoloredFiles.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 12px", textAlign: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <FileImage size={18} color="#CBD5E1" />
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", margin: "0 0 3px" }}>No frames yet</p>
            <p style={{ fontSize: 10, color: "#CBD5E1", margin: 0 }}>Import uncolored files below</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, paddingBottom: 8, paddingTop: 4 }}>
            {referenceImage?.paintUrl && (
              <button
                onClick={openReferencePreview}
                style={{
                  gridColumn: "1 / -1",
                  border: showReferencePreview ? "2px solid #3B82F6" : "1.5px solid #93C5FD",
                  borderRadius: 9,
                  overflow: "hidden",
                  cursor: "pointer",
                  padding: 0,
                  background: "#EFF6FF",
                  boxShadow: showReferencePreview ? "0 0 0 2px rgba(59,130,246,0.16)" : "0 1px 4px rgba(0,0,0,0.06)",
                  position: "relative",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  <img src={referenceImage.paintUrl} alt="Reference" style={{ width: 72, height: 56, objectFit: "cover", display: "block", flexShrink: 0 }} />
                  <div style={{ padding: "7px 8px", minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#2563EB", marginBottom: 3 }}>
                      <Star size={9} fill="#2563EB" />
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6 }}>REFERENCE IMAGE</span>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referenceImage.name}</div>
                    <div style={{ fontSize: 8, color: "#64748B", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                      <Eye size={8} /> Click to preview · linked to Frame {Math.max(1, uncoloredFiles.findIndex((frame) => frame.id === referenceImage.id) + 1)}
                    </div>
                  </div>
                </div>
              </button>
            )}
            {uncoloredFiles.map((file, i) => {
              const isActive = activeFrame === i;
              const state = frameStates[i] ?? "plain";
              return (
                <button
                  key={file.id}
                  onClick={() => handleFrameChange(i)}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ frameIndex: i, x: e.clientX, y: e.clientY }); }}
                  style={{
                    border: isActive ? "2px solid #3B82F6" : frameRefMap[i] ? "1.5px solid #F59E0B" : "1.5px solid transparent",
                    borderRadius: 8, overflow: "hidden", cursor: "pointer", padding: 0,
                    background: isActive ? "#EFF6FF" : "white",
                    position: "relative",
                    boxShadow: isActive ? "0 0 0 2px rgba(59,130,246,0.18)" : "0 1px 4px rgba(0,0,0,0.06)",
                    transition: "all 0.1s",
                  }}
                >
                  <img
                    src={(frameStates[i] === "manual" ? framePaints[i] : null) || (file.id === detachedReferenceFrameId ? file.url : file.paintUrl || file.url)}
                    alt={file.name}
                    style={{ width: "100%", height: 48, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,0.55)", borderRadius: 3, padding: "1px 4px" }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>{i + 1}</span>
                  </div>
                  {state !== "plain" && (
                    <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: state === "ai" ? "#8B5CF6" : "#F59E0B", border: "1px solid white" }} />
                  )}
                  {frameRefMap[i] && (
                    <div style={{ position: "absolute", bottom: 3, left: 3, display: "flex", alignItems: "center", gap: 2, background: "rgba(245,158,11,0.92)", borderRadius: 3, padding: "1px 3px", border: "1px solid rgba(255,255,255,0.8)" }}>
                      <Star size={6} color="white" fill="white" />
                      <img src={frameRefMap[i].paintUrl || frameRefMap[i].url} alt="ref" style={{ width: 10, height: 10, borderRadius: 2, objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ background: isActive ? "#EFF6FF" : "#F8FAFF", padding: "2px 4px", borderTop: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: 8, color: isActive ? "#3B82F6" : "#94A3B8", fontWeight: isActive ? 700 : 400 }}>{i + 1}s</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom import buttons */}
      <div style={{ padding: "8px 10px", flexShrink: 0, borderTop: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: 5 }}>
        <button
          onClick={() => !isImporting && uncoloredInputRef.current?.click()}
          disabled={isImporting}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 9, border: "1.5px solid #E2E8F0", background: "white", cursor: isImporting ? "wait" : "pointer", opacity: isImporting ? 0.65 : 1, fontFamily: "'Inter',sans-serif", width: "100%", textAlign: "left" }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <List size={11} color="#64748B" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#1E293B" }}>{isImporting ? "Importing..." : "Import Uncolored Files"}</div>
            <div style={{ fontSize: 8, color: "#94A3B8" }}>{isImporting ? "Please wait" : `${uncoloredFiles.length} loaded`}</div>
          </div>
        </button>

        <button
          onClick={openReferenceModal}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 9,
            border: referenceImage ? "1.5px solid #3B82F6" : "1.5px solid #E2E8F0",
            background: referenceImage ? "#EFF6FF" : "white",
            cursor: "pointer", fontFamily: "'Inter',sans-serif", width: "100%", textAlign: "left",
          }}
        >
          {referenceImage ? (
            <img src={referenceImage.paintUrl || referenceImage.url} alt="ref" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: "1px solid #BFDBFE" }} />
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ImageIcon size={11} color="#64748B" />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: referenceImage ? "#3B82F6" : "#1E293B" }}>
              {referenceImage ? "Reference Set" : "Import Reference"}
            </div>
            <div style={{ fontSize: 8, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {referenceImage ? referenceImage.name : "For AI guidance"}
            </div>
          </div>
          {referenceImage && (
            <button
              onClick={(e) => { e.stopPropagation(); clearReferenceSelection(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 1, display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <X size={10} />
            </button>
          )}
        </button>
      </div>

      {/* Upgrade card */}
      <div style={{ padding: "0 10px 12px", flexShrink: 0 }}>
        <a href="/#pricing" style={{ display: "block", background: "linear-gradient(135deg,#1E293B,#0F172A)", borderRadius: 12, padding: "12px", textDecoration: "none" }}>
          <Crown size={15} color="#F59E0B" style={{ marginBottom: 4 }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: "white", marginBottom: 2 }}>Upgrade to Pro</p>
          <p style={{ fontSize: 9, color: "#64748B", lineHeight: 1.5, marginBottom: 8 }}>1080p, MP4, no watermark.</p>
          <div style={{ width: "100%", padding: "6px", borderRadius: 6, background: "#F59E0B", textAlign: "center", color: "#1E293B", fontWeight: 700, fontSize: 10 }}>
            See Pro Plans →
          </div>
        </a>
      </div>
    </aside>
  );
}