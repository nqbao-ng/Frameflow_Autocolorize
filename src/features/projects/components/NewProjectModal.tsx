import { Sparkles } from "lucide-react";

interface NewProjectModalProps {
  newProjectName: string;
  isCreating: boolean;
  onChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NewProjectModal({
  newProjectName,
  isCreating,
  onChange,
  onConfirm,
  onCancel,
}: NewProjectModalProps) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 100, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 32px 80px rgba(0,0,0,0.2)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "28px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={17} color="#3B82F6" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", margin: 0 }}>New Project</h2>
          </div>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>
            Give your animation project a name to get started.
          </p>

          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
            Project name
          </label>
          <input
            type="text"
            autoFocus
            value={newProjectName}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConfirm()}
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

        {/* Footer */}
        <div style={{ padding: "20px 28px 28px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={isCreating}
            style={{
              padding: "10px 18px", borderRadius: 10,
              border: "1.5px solid #E2E8F0", background: "white",
              cursor: "pointer", fontSize: 13, fontWeight: 500,
              color: "#475569", fontFamily: "'Inter', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!newProjectName.trim() || isCreating}
            style={{
              padding: "10px 22px", borderRadius: 10, border: "none",
              background: newProjectName.trim() && !isCreating ? "#3B82F6" : "#E2E8F0",
              cursor: newProjectName.trim() && !isCreating ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 700,
              color: newProjectName.trim() && !isCreating ? "white" : "#94A3B8",
              fontFamily: "'Inter', sans-serif",
              boxShadow: newProjectName.trim() ? "0 2px 10px rgba(59,130,246,0.3)" : "none",
              transition: "all 0.15s",
              minWidth: 110,
            }}
          >
            {isCreating ? "Creating…" : "Create & Open"}
          </button>
        </div>
      </div>
    </div>
  );
}