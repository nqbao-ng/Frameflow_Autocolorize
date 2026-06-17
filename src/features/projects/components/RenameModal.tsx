interface RenameModalProps {
  isOpen: boolean;
  projectName: string;
  isRenaming: boolean;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RenameModal({
  isOpen,
  projectName,
  isRenaming,
  onNameChange,
  onConfirm,
  onCancel,
}: RenameModalProps) {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onConfirm();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          padding: "28px 32px",
          width: "90%",
          maxWidth: 420,
          fontFamily: "'Inter', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", margin: "0 0 16px" }}>
          Rename Project
        </h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
          Enter a new name for your project.
        </p>

        <input
          type="text"
          value={projectName}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1.5px solid #E2E8F0",
            fontSize: 14,
            color: "#1E293B",
            fontFamily: "'Inter', sans-serif",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 20,
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#3B82F6")}
          onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={isRenaming}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "1.5px solid #E2E8F0",
              background: "white",
              color: "#1E293B",
              fontSize: 14,
              fontWeight: 600,
              cursor: isRenaming ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
              opacity: isRenaming ? 0.5 : 1,
              transition: "all 0.2s",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isRenaming || !projectName.trim()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#3B82F6",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: isRenaming || !projectName.trim() ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
              opacity: isRenaming || !projectName.trim() ? 0.6 : 1,
              transition: "all 0.2s",
            }}
          >
            {isRenaming ? "Renaming…" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}