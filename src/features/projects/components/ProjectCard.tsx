import { useNavigate } from "react-router";
import { Film, Clock, ChevronRight, MoreHorizontal, Edit3, Trash2 } from "lucide-react";
import type { Project } from "../types";
import { STATUS_CONFIG } from "../constants/projectsData";

interface ProjectCardProps {
  project: Project;
  isMenuOpen: boolean;
  isDeleting: boolean;
  onMenuToggle: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpenRenameModal?: (id: string, name: string) => void;
}

export function ProjectCard({
  project,
  isMenuOpen,
  isDeleting,
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
        background: "white", borderRadius: 20, overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9",
        transition: "all 0.18s", position: "relative", cursor: "pointer",
        opacity: isDeleting ? 0.5 : 1,
      }}
      className="hover:shadow-lg hover:-translate-y-0.5"
      onClick={() => navigate(`/dashboard/${project.id}`)}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", height: 148, overflow: "hidden", background: "#0F172A" }}>
        <img
          src={project.thumbnail}
          alt={project.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.9 }}
        />

        {/* Status badge */}
        <div style={{ position: "absolute", top: 12, left: 12, background: status.bg, borderRadius: 100, padding: "4px 10px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: status.color }}>{status.label}</span>
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
      <div style={{ padding: "16px 18px 18px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", margin: "0 0 10px" }}>
          {project.name}
        </h3>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div className="flex justify-between items-center mb-1.5">
            <span style={{ fontSize: 11, color: "#64748B" }}>
              {project.coloredFrames} / {project.frames} frames colored
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6" }}>{progress}%</span>
          </div>
          <div style={{ height: 5, background: "#F1F5F9", borderRadius: 100, overflow: "hidden" }}>
            <div
              style={{
                height: "100%", width: `${progress}%`,
                background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
                borderRadius: 100, transition: "width 0.4s",
              }}
            />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Film size={12} color="#94A3B8" />
              <span style={{ fontSize: 11, color: "#94A3B8" }}>{project.frames} frames</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={12} color="#94A3B8" />
              <span style={{ fontSize: 11, color: "#94A3B8" }}>{project.lastEdited}</span>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ color: "#3B82F6", fontSize: 12, fontWeight: 600 }}>
            Open <ChevronRight size={13} />
          </div>
        </div>
      </div>
    </div>
  );
}