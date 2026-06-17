import { useState, useRef, useEffect } from "react";
import { Plus, Search, FolderOpen } from "lucide-react";
import { ProjectsHeader } from "./components/ProjectsHeader";
import { ProjectCard } from "./components/ProjectCard";
import { NewProjectCard } from "./components/NewProjectCard";
import { NewProjectModal } from "./components/NewProjectModal";
import { RenameModal } from "./components/RenameModal";
import { SearchSuggestions } from "./components/SearchSuggestions";
import { useProjects } from "./hooks/useProjects";

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
  } = ctx;

  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F4F8FF 0%, #FFFFFF 40%)", fontFamily: "'Inter', sans-serif" }}>
      <ProjectsHeader />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 40px" }}>

        {/* Title row */}
        <div className="flex items-start justify-between mb-10" style={{ flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", margin: 0 }}>
              Your Projects
            </h1>
            <p style={{ fontSize: 15, color: "#64748B", marginTop: 6 }}>
              {isLoading
                ? "Loading…"
                : `${projects.length} project${projects.length !== 1 ? "s" : ""} — click any to open in the editor`}
            </p>
          </div>
          <button
            onClick={openNewModal}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "11px 22px",
              borderRadius: 12, border: "none", background: "#3B82F6", color: "white",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(59,130,246,0.3)", fontFamily: "'Inter', sans-serif",
            }}
          >
            <Plus size={16} />New Project
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ marginBottom: 24, padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13, fontWeight: 500 }}>
            ⚠ {error}
          </div>
        )}

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 340, marginBottom: 32 }}>
          <Search size={15} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 40 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => {
              e.target.style.borderColor = "#3B82F6";
              setShowSearchDropdown(true);
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#E2E8F0";
            }}
            style={{
              width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
              border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
              fontFamily: "'Inter', sans-serif", outline: "none", background: "white",
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

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ borderRadius: 20, background: "#F1F5F9", height: 280, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#94A3B8" }}>
            <FolderOpen size={48} color="#CBD5E1" style={{ margin: "0 auto 16px" }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#475569", marginBottom: 6 }}>No projects found</p>
            <p style={{ fontSize: 13 }}>Try a different search term or create a new project.</p>
          </div>
        )}

        {/* Project grid */}
        {!isLoading && filtered.length > 0 && (
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}
            onClick={() => setOpenMenuId(null)}
          >
            <NewProjectCard onClick={openNewModal} />

            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isMenuOpen={openMenuId === project.id}
                isDeleting={deletingId === project.id}
                onMenuToggle={setOpenMenuId}
                onRename={handleRename}
                onDelete={handleDelete}
                onOpenRenameModal={openRenameModal}
              />
            ))}
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
