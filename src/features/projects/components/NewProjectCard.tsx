import { Plus } from "lucide-react";

interface NewProjectCardProps {
  onClick: () => void;
}

export function NewProjectCard({ onClick }: NewProjectCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "white", borderRadius: 20,
        border: "2px dashed #CBD5E1",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 12, padding: "48px 24px",
        cursor: "pointer", transition: "all 0.15s",
        minHeight: 220, width: "100%",
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
  );
}