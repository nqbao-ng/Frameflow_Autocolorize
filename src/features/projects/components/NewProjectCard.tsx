import { Plus } from "lucide-react";

interface NewProjectCardProps {
  onClick: () => void;
}

export function NewProjectCard({ onClick }: NewProjectCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#181827",
        borderRadius: 20,
        border: "2px dashed #2A2A40",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "48px 24px",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        minHeight: 280,
        width: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#A855F7";
        e.currentTarget.style.background = "rgba(168,85,247,0.08)";
        e.currentTarget.style.boxShadow = "0 12px 40px rgba(168,85,247,0.25), inset 0 0 1px rgba(255,46,154,0.3)";
        e.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#2A2A40";
        e.currentTarget.style.background = "#181827";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 25%, #FF2E9A 75%, #FF8A34 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(168,85,247,0.4)",
          transition: "all 0.25s",
        }}
      >
        <Plus size={28} color="white" strokeWidth={2} />
      </div>
      <div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#F5F3FF",
            margin: 0,
          }}
        >
          Create New Project
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#AAB2D5",
            marginTop: 4,
          }}
        >
          Import frames and start coloring
        </p>
      </div>
    </button>
  );
}