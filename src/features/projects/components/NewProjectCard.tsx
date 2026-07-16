import { LockKeyhole, Plus } from "lucide-react";

interface NewProjectCardProps {
  onClick: () => void;
  disabled?: boolean;
  limitMessage?: string;
}

export function NewProjectCard({ onClick, disabled = false, limitMessage }: NewProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? limitMessage : "Create a new project"}
      style={{
        background: disabled ? "rgba(24,24,39,.58)" : "#181827",
        borderRadius: 20,
        border: `2px dashed ${disabled ? "#3F3F52" : "#2A2A40"}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, padding: "48px 24px", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all .25s cubic-bezier(.4,0,.2,1)", minHeight: 280, width: "100%",
        opacity: disabled ? .72 : 1,
      }}
      onMouseEnter={(event) => {
        if (disabled) return;
        event.currentTarget.style.borderColor = "#A855F7";
        event.currentTarget.style.background = "rgba(168,85,247,.08)";
        event.currentTarget.style.boxShadow = "0 12px 40px rgba(168,85,247,.25)";
        event.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseLeave={(event) => {
        if (disabled) return;
        event.currentTarget.style.borderColor = "#2A2A40";
        event.currentTarget.style.background = "#181827";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.transform = "scale(1)";
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: disabled ? "#343449" : "linear-gradient(135deg,#7C3AED 0%,#A855F7 25%,#FF2E9A 75%,#FF8A34 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: disabled ? "none" : "0 8px 24px rgba(168,85,247,.4)",
      }}>
        {disabled ? <LockKeyhole size={23} color="#AAB2D5" /> : <Plus size={28} color="white" strokeWidth={2} />}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#F5F3FF", margin: 0 }}>
          {disabled ? "Project limit reached" : "Create New Project"}
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "#AAB2D5", marginTop: 4, maxWidth: 230 }}>
          {disabled ? (limitMessage || "Upgrade your plan or remove a project to continue.") : "Import frames and start coloring"}
        </p>
      </div>
    </button>
  );
}
