import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Zap,
  Plus,
  Film,
  Clock,
  ChevronRight,
  Sparkles,
  MoreHorizontal,
  Search,
  LogOut,
  User,
  Trash2,
  Edit3,
  FolderOpen,
} from "lucide-react";

const IMG_1 = "https://images.unsplash.com/photo-1563393471486-370b35d7de64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";
const IMG_2 = "https://images.unsplash.com/photo-1767557125491-b3483567d843?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";
const IMG_3 = "https://images.unsplash.com/photo-1770116119330-2c80bc762d0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";
const IMG_4 = "https://images.unsplash.com/photo-1683220367836-f421ee46c013?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";

type ProjectStatus = "in-progress" | "complete" | "draft";

interface Project {
  id: number;
  name: string;
  frames: number;
  coloredFrames: number;
  status: ProjectStatus;
  lastEdited: string;
  thumbnail: string;
}

const INITIAL_PROJECTS: Project[] = [
  { id: 1, name: "Magic Girl Animation", frames: 120, coloredFrames: 74, status: "in-progress", lastEdited: "2 hours ago", thumbnail: IMG_1 },
  { id: 2, name: "Forest Spirit Walk", frames: 48, coloredFrames: 48, status: "complete", lastEdited: "Yesterday", thumbnail: IMG_2 },
  { id: 3, name: "City Background Pan", frames: 200, coloredFrames: 12, status: "in-progress", lastEdited: "3 days ago", thumbnail: IMG_3 },
  { id: 4, name: "Robot Dance Loop", frames: 64, coloredFrames: 0, status: "draft", lastEdited: "1 week ago", thumbnail: IMG_4 },
];

const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  "in-progress": { label: "In Progress", bg: "#EFF6FF", color: "#3B82F6" },
  complete: { label: "Complete", bg: "#F0FDF4", color: "#16A34A" },
  draft: { label: "Draft", bg: "#F8FAFF", color: "#94A3B8" },
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const newProject: Project = {
      id: Date.now(),
      name: newProjectName.trim(),
      frames: 0,
      coloredFrames: 0,
      status: "draft",
      lastEdited: "Just now",
      thumbnail: IMG_1,
    };
    setProjects((prev) => [newProject, ...prev]);
    setNewProjectName("");
    setShowNewModal(false);
    navigate("/dashboard");
  };

  const handleDelete = (id: number) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setOpenMenuId(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F4F8FF 0%, #FFFFFF 40%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          height: 64,
        }}
      >
        <div
          style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={16} color="white" fill="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 20, color: "#1E293B" }}>FrameFlow</span>
          </Link>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <User size={15} color="white" />
            </div>
            <Link
              to="/signin"
              className="flex items-center gap-1.5"
              style={{ fontSize: 13, color: "#64748B", textDecoration: "none", padding: "6px 10px", borderRadius: 8, border: "1px solid #E2E8F0" }}
            >
              <LogOut size={13} />
              Sign out
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 40px" }}>
        {/* Title row */}
        <div className="flex items-start justify-between mb-10" style={{ flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", margin: 0 }}>
              Your Projects
            </h1>
            <p style={{ fontSize: 15, color: "#64748B", marginTop: 6 }}>
              {projects.length} project{projects.length !== 1 ? "s" : ""} — click any to open in the editor
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 12, border: "none",
              background: "#3B82F6", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(59,130,246,0.3)", fontFamily: "'Inter', sans-serif",
            }}
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 340, marginBottom: 32 }}>
          <Search size={15} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
              border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
              fontFamily: "'Inter', sans-serif", outline: "none", background: "white",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
          />
        </div>

        {/* Project Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#94A3B8" }}>
            <FolderOpen size={48} color="#CBD5E1" style={{ margin: "0 auto 16px" }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#475569", marginBottom: 6 }}>No projects found</p>
            <p style={{ fontSize: 13 }}>Try a different search term or create a new project.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {/* New Project card */}
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                background: "white", borderRadius: 20, border: "2px dashed #CBD5E1",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 12, padding: "48px 24px", cursor: "pointer", transition: "all 0.15s",
                minHeight: 220,
              }}
              className="hover:border-blue-400 hover:bg-blue-50/40"
            >
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={22} color="#3B82F6" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", margin: 0 }}>Create New Project</p>
                <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Import frames and start coloring</p>
              </div>
            </button>

            {filtered.map((project) => {
              const progress = project.frames > 0 ? Math.round((project.coloredFrames / project.frames) * 100) : 0;
              const status = STATUS_CONFIG[project.status];
              return (
                <div
                  key={project.id}
                  style={{
                    background: "white", borderRadius: 20, overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9",
                    transition: "all 0.18s", position: "relative", cursor: "pointer",
                  }}
                  className="hover:shadow-lg hover:-translate-y-0.5"
                  onClick={() => navigate("/dashboard")}
                >
                  {/* Thumbnail */}
                  <div style={{ position: "relative", height: 148, overflow: "hidden", background: "#0F172A" }}>
                    <img src={project.thumbnail} alt={project.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.9 }} />
                    {/* Status badge */}
                    <div style={{ position: "absolute", top: 12, left: 12, background: status.bg, borderRadius: 100, padding: "4px 10px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: status.color }}>{status.label}</span>
                    </div>
                    {/* Menu button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }}
                      style={{
                        position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 8,
                        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", border: "none",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white",
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenuId === project.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute", top: 42, right: 10, background: "white", borderRadius: 12,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.14)", border: "1px solid #E2E8F0",
                          overflow: "hidden", zIndex: 10, minWidth: 140,
                        }}
                      >
                        {[
                          { icon: <Edit3 size={13} />, label: "Rename", action: () => setOpenMenuId(null) },
                          { icon: <Trash2 size={13} />, label: "Delete", action: () => handleDelete(project.id), danger: true },
                        ].map(({ icon, label, action, danger }) => (
                          <button
                            key={label}
                            onClick={action}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, width: "100%",
                              padding: "9px 14px", border: "none", background: "white", cursor: "pointer",
                              fontSize: 13, color: danger ? "#EF4444" : "#374151", textAlign: "left",
                              fontFamily: "'Inter', sans-serif",
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
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", margin: "0 0 10px" }}>{project.name}</h3>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span style={{ fontSize: 11, color: "#64748B" }}>
                          {project.coloredFrames} / {project.frames} frames colored
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6" }}>{progress}%</span>
                      </div>
                      <div style={{ height: 5, background: "#F1F5F9", borderRadius: 100, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #3B82F6, #8B5CF6)", borderRadius: 100, transition: "width 0.4s" }} />
                      </div>
                    </div>

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
            })}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 32px 80px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "28px 28px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={17} color="#3B82F6" />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", margin: 0 }}>New Project</h2>
              </div>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Give your animation project a name to get started.</p>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Project name</label>
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="e.g. Magic Girl Animation"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
                  fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
              />
            </div>
            <div style={{ padding: "20px 28px 28px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowNewModal(false); setNewProjectName(""); }}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#475569", fontFamily: "'Inter', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                style={{
                  padding: "10px 22px", borderRadius: 10, border: "none",
                  background: newProjectName.trim() ? "#3B82F6" : "#E2E8F0",
                  cursor: newProjectName.trim() ? "pointer" : "not-allowed",
                  fontSize: 13, fontWeight: 700, color: newProjectName.trim() ? "white" : "#94A3B8",
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: newProjectName.trim() ? "0 2px 10px rgba(59,130,246,0.3)" : "none",
                }}
              >
                Create & Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
