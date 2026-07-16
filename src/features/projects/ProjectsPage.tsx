import { useState, useRef, useEffect } from "react";
import { Plus, Search, FolderOpen } from "lucide-react";
import { ProjectsHeader } from "./components/ProjectsHeader";
import { ProjectCard } from "./components/ProjectCard";
import { NewProjectCard } from "./components/NewProjectCard";
import { NewProjectModal } from "./components/NewProjectModal";
import { RenameModal } from "./components/RenameModal";
import { SearchSuggestions } from "./components/SearchSuggestions";
import { useProjects } from "./hooks/useProjects";
import { UsageCard } from "@/features/account/components/UsageCard";

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

export function ProjectsPage() {
  const ctx = useProjects();
  const {
    projects, filtered, isLoading, error,
    search, setSearch,
    openMenuId, setOpenMenuId,
    showNewModal, newProjectName, setNewProjectName, isCreating,
    deletingId,
    openNewModal, closeNewModal,
    handleCreateProject, handleRename, handleDelete,
    renameModalId, renameInputValue, setRenameInputValue, isRenaming,
    openRenameModal, closeRenameModal, submitRename,
    entitlements, entitlementsLoading, canCreateProject, projectLimit,
  } = ctx;

  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "ready" | "processing" | "needs-review" | "complete" | "failed">("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredWithStatus = filtered.filter(p => 
    statusFilter === "all" || p.status === statusFilter
  );

  const sortedProjects = [...filteredWithStatus].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "oldest") return new Date(a.lastEdited).getTime() - new Date(b.lastEdited).getTime();
    return new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime();
  });

  const mostRecentProject = projects.length > 0 
    ? projects.reduce((latest, p) => new Date(p.lastEdited) > new Date(latest.lastEdited) ? p : latest)
    : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
    }

    if (showSearchDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSearchDropdown]);

  const handleSelectSuggestion = (project: any) => {
    setSearch(project.name);
    setShowSearchDropdown(false);
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(180deg, #0B0B14 0%, #10101A 40%)", 
      fontFamily: "'Inter', sans-serif",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Radial glow effects */}
      <div style={{
        position: "absolute",
        top: "-10%",
        left: "20%",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
        filter: "blur(60px)"
      }} />
      <div style={{
        position: "absolute",
        top: "40%",
        right: "10%",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
        filter: "blur(50px)"
      }} />
      
      <ProjectsHeader />

      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "48px 40px", position: "relative", zIndex: 1 }}>

        {/* Title row */}
        <div className="flex items-start justify-between mb-10" style={{ flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#F5F3FF", letterSpacing: "-1px", margin: 0 }}>
              Your Projects
            </h1>
            <p style={{ fontSize: 15, color: "#AAB2D5", marginTop: 6 }}>
              {isLoading
                ? "Loading…"
                : `${projects.length} project${projects.length !== 1 ? "s" : ""} — click any to open in the editor`}
            </p>
          </div>
        </div>

        {!entitlementsLoading && entitlements && (
          <div style={{ marginBottom: 30 }}>
            <UsageCard entitlements={entitlements} />
          </div>
        )}

        {/* Project Statistics - Compact Inline */}
        {!isLoading && projects.length > 0 && (
          <div style={{ display: "flex", gap: 20, marginBottom: 32, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📊</span>
              <span style={{ fontSize: 13, color: "#AAB2D5" }}>{projects.length} Projects</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>🎬</span>
              <span style={{ fontSize: 13, color: "#AAB2D5" }}>{projects.reduce((sum, p) => sum + (p.frames || 0), 0)} Frames</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>🎨</span>
              <span style={{ fontSize: 13, color: "#AAB2D5" }}>{projects.reduce((sum, p) => sum + (p.coloredFrames || 0), 0)} Colored Frames</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 13, color: "#AAB2D5" }}>{(() => {
                const total = projects.reduce((sum, p) => sum + (p.frames || 0), 0);
                const colored = projects.reduce((sum, p) => sum + (p.coloredFrames || 0), 0);
                return total > 0 ? Math.round((colored / total) * 100) : 0;
              })()}% Overall Completion</span>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 10, background: "rgba(255,61,113,0.1)", border: "1px solid #FF3D71", color: "#FF3D71", fontSize: 13, fontWeight: 500 }}>
            ⚠ {error}
          </div>
        )}

        {/* Search & Filter Controls */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search Box */}
          <div style={{ position: "relative", flex: "1 1 250px", minWidth: 250 }}>
            <Search size={15} color="#7E86A4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 40 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => {
                e.target.style.borderColor = "#FF2E9A";
                e.target.style.boxShadow = "0 0 16px rgba(255,46,154,0.3)";
                setShowSearchDropdown(true);
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#2A2A40";
                e.target.style.boxShadow = "none";
              }}
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
                border: "1.5px solid #2A2A40", fontSize: 14, color: "#FFFFFF",
                fontFamily: "'Inter', sans-serif", outline: "none", background: "#11111B",
                boxSizing: "border-box",
                position: "relative",
                zIndex: 40,
              }}
            />
            <SearchSuggestions
              isOpen={showSearchDropdown}
              search={search}
              suggestions={filtered}
              onSelectSuggestion={handleSelectSuggestion}
              onClear={() => setShowSearchDropdown(false)}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "10px 12px", borderRadius: 10, border: "1.5px solid #2A2A40",
              background: "#11111B", color: "#FFFFFF", fontSize: 14, fontFamily: "'Inter', sans-serif",
              cursor: "pointer", outline: "none",
              boxSizing: "border-box",
            }}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="needs-review">Needs review</option>
            <option value="complete">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: "10px 12px", borderRadius: 10, border: "1.5px solid #2A2A40",
              background: "#11111B", color: "#FFFFFF", fontSize: 14, fontFamily: "'Inter', sans-serif",
              cursor: "pointer", outline: "none",
              boxSizing: "border-box",
            }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ borderRadius: 20, background: "#181827", height: 340, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "100px 40px", color: "#AAB2D5" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📂</div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#F5F3FF", marginBottom: 8, margin: 0 }}>No projects yet</p>
            <p style={{ fontSize: 14, color: "#AAB2D5", marginTop: 8, marginBottom: 24 }}>Import your first manga page to start coloring</p>
            <button
              onClick={openNewModal}
              disabled={!canCreateProject}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px",
                borderRadius: 12, border: "none", background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 25%, #FF2E9A 75%, #FF8A34 100%)", color: "white",
                fontWeight: 700, fontSize: 14, cursor: canCreateProject ? "pointer" : "not-allowed", opacity: canCreateProject ? 1 : .65,
                boxShadow: "0 8px 30px rgba(168,85,247,0.35)", fontFamily: "'Inter', sans-serif",
              }}
            >
              <Plus size={16} />{canCreateProject ? "Create First Project" : "Project limit reached"}
            </button>
          </div>
        )}

        {/* Project grid */}
        {!isLoading && filtered.length > 0 && (
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}
            onClick={() => setOpenMenuId(null)}
          >
            <NewProjectCard onClick={openNewModal} disabled={!canCreateProject} limitMessage={`You are using ${projects.length} of ${projectLimit ?? "unlimited"} active projects. Upgrade or delete a project to continue.`} />

            {sortedProjects.map((project) => {
              const realFrameCount = project.frames || 0;
              const projectWithRealFrames = {
                ...project,
                frames: realFrameCount,
              };
              return (
                <ProjectCard
                  key={project.id}
                  project={projectWithRealFrames}
                  isMenuOpen={openMenuId === project.id}
                  isDeleting={deletingId === project.id}
                  isRecentlyActive={mostRecentProject?.id === project.id}
                  onMenuToggle={setOpenMenuId}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onOpenRenameModal={openRenameModal}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* New project modal */}
      {showNewModal && (
        <NewProjectModal
          newProjectName={newProjectName}
          isCreating={isCreating}
          onChange={setNewProjectName}
          onConfirm={handleCreateProject}
          onCancel={closeNewModal}
        />
      )}

      {/* Rename modal */}
      <RenameModal
        isOpen={renameModalId !== null}
        projectName={renameInputValue}
        isRenaming={isRenaming}
        onNameChange={setRenameInputValue}
        onConfirm={submitRename}
        onCancel={closeRenameModal}
      />
    </div>
  );
}
