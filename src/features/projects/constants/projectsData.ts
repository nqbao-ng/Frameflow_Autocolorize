import type { ProjectStatus } from "../types";

export const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  draft:          { label: "Draft",        bg: "rgba(148,163,184,.12)", color: "#94A3B8" },
  ready:          { label: "Ready",        bg: "rgba(59,130,246,.12)",  color: "#60A5FA" },
  processing:     { label: "Processing",   bg: "rgba(168,85,247,.14)",  color: "#C084FC" },
  "needs-review": { label: "Needs review", bg: "rgba(245,158,11,.14)", color: "#FBBF24" },
  complete:       { label: "Complete",     bg: "rgba(34,197,94,.12)",   color: "#4ADE80" },
  failed:         { label: "Failed",       bg: "rgba(244,63,94,.14)",   color: "#FB7185" },
};
