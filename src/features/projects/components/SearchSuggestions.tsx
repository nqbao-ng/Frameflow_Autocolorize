import { X } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface SearchSuggestionsProps {
  isOpen: boolean;
  search: string;
  suggestions: Project[];
  onSelectSuggestion: (project: Project) => void;
  onClear: () => void;
}

export function SearchSuggestions({
  isOpen,
  search,
  suggestions,
  onSelectSuggestion,
  onClear,
}: SearchSuggestionsProps) {
  if (!isOpen || !search.trim()) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        marginTop: 6,
        background: "white",
        borderRadius: 12,
        border: "1.5px solid #E2E8F0",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.1)",
        zIndex: 50,
        maxHeight: 400,
        overflowY: "auto",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {suggestions.length === 0 ? (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            color: "#94A3B8",
            fontSize: 13,
          }}
        >
          <p style={{ margin: 0 }}>No projects found</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#CBD5E1" }}>
            Try a different search term
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #F1F5F9",
              fontSize: 11,
              fontWeight: 600,
              color: "#94A3B8",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {suggestions.length} result{suggestions.length !== 1 ? "s" : ""}
          </div>
          {suggestions.map((project, index) => (
            <div key={project.id}>
              <button
                onClick={() => onSelectSuggestion(project)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "none",
                  background: index % 2 === 0 ? "white" : "#F8FAFF",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#EFF6FF";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    index % 2 === 0 ? "white" : "#F8FAFF";
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                    {project.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                    ID: {project.id.slice(0, 8)}...
                  </div>
                </div>
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}