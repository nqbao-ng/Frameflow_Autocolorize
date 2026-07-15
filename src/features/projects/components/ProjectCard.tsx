import { useNavigate } from "react-router";
import { Film, Clock, ChevronRight, MoreHorizontal, Edit3, Trash2 } from "lucide-react";
import type { Project } from "../types";
import { STATUS_CONFIG } from "../constants/projectsData";

function getRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateString;
  }
}

interface ProjectCardProps {
  project: Project;
  isMenuOpen: boolean;
  isDeleting: boolean;
  isRecentlyActive?: boolean;
  onMenuToggle: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpenRenameModal?: (id: string, name: string) => void;
}

export function ProjectCard({
  project,
  isMenuOpen,
  isDeleting,
  isRecentlyActive,
  onMenuToggle,
  onRename,
  onDelete,
  onOpenRenameModal,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const progress =
    project.frames > 0
      ? Math.round((project.coloredFrames / project.frames) * 100)
      : 0;
  const status = STATUS_CONFIG[project.status];

  return (
    <div
      style={{
        background: "#181827", borderRadius: 20, overflow: "hidden",
        boxShadow: isRecentlyActive 
          ? "0 12px 32px rgba(168,85,247,0.25), 0 0 20px rgba(168,85,247,0.15)"
          : "0 4px 20px rgba(0,0,0,0.08)", 
        border: isRecentlyActive ? "2px solid #A855F7" : "1px solid #2A2A40",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", 
        position: "relative", 
        cursor: "pointer",
        opacity: isDeleting ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.15)";
        e.currentTarget.style.transform = "scale(1.02) translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = isRecentlyActive 
          ? "0 12px 32px rgba(168,85,247,0.25), 0 0 20px rgba(168,85,247,0.15)"
          : "0 4px 20px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "scale(1)";
      }}
      onClick={() => navigate(`/dashboard/${project.id}`)}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", height: 180, overflow: "hidden", background: "#0F172A" }}>
        {project.thumbnail ? (
          <>
            <img
              src={project.thumbnail}
              alt={project.name}
              style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
                transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLImageElement).style.transform = "scale(1.08)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLImageElement).style.transform = "scale(1)";
              }}
            />
            {/* Overlay gradient */}
            <div style={{ 
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 100%)"
            }} />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, background: "linear-gradient(135deg, #1e1a2e 0%, #2d1a4e 100%)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(168,85,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 24 }}>🎬</div>
            </div>
            <span style={{ fontSize: 13, color: "#AAB2D5", fontWeight: 600 }}>No frames imported yet</span>
          </div>
        )}

        {/* Overlay info bar */}
        <div style={{ 
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "12px 14px", 
          background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end"
        }}>
          <div style={{ background: status.bg, borderRadius: 6, padding: "4px 10px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: status.color }}>{status.label}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{progress}%</span>
        </div>

        {/* 3-dot menu button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuToggle(isMenuOpen ? null : project.id);
          }}
          style={{
            position: "absolute", top: 10, right: 10,
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
          }}
        >
          <MoreHorizontal size={14} />
        </button>

        {/* Dropdown menu */}
        {isMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 42, right: 10,
              background: "white", borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.14)", border: "1px solid #E2E8F0",
              overflow: "hidden", zIndex: 10, minWidth: 140,
            }}
          >
            {[
              {
                icon: <Edit3 size={13} />,
                label: "Rename",
                danger: false,
                action: () => {
                  if (onOpenRenameModal) {
                    onOpenRenameModal(project.id, project.name);
                  }
                },
              },
              {
                icon: <Trash2 size={13} />,
                label: isDeleting ? "Deleting…" : "Delete",
                danger: true,
                action: () => onDelete(project.id),
              },
            ].map(({ icon, label, action, danger }) => (
              <button
                key={label}
                onClick={action}
                disabled={isDeleting}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "9px 14px", border: "none", background: "white",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                  fontSize: 13, color: danger ? "#EF4444" : "#374151",
                  textAlign: "left", fontFamily: "'Inter', sans-serif",
                }}
                className="hover:bg-slate-50"
              >
                {icon}{label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "18px 20px 20px" }}>
        {/* Status badge inline */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F5F3FF", margin: 0 }}>
            {project.name}
          </h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: status.color, background: status.bg, padding: "3px 8px", borderRadius: 6 }}>
            {status.label}
          </span>
        </div>

        {/* Frame count */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <Film size={13} color="#AAB2D5" />
          <span style={{ fontSize: 13, color: "#AAB2D5" }}>{project.frames} Frames</span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 14 }}>
          <div className="flex justify-between items-center mb-2" style={{ gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ height: 6, background: "#2A2A40", borderRadius: 100, overflow: "hidden", flex: 1 }}>
                <div
                  style={{
                    height: "100%", width: `${progress}%`,
                    background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
                    borderRadius: 100, transition: "width 0.4s",
                  }}
                />
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", minWidth: 30 }}>{progress}%</span>
          </div>
        </div>

        {/* Last edited */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <Clock size={13} color="#7E86A4" />
          <span style={{ fontSize: 12, color: "#AAB2D5" }}>{getRelativeTime(project.lastEdited)}</span>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-1" style={{ color: "#3B82F6", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Open <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
}