import type { Project, ProjectStatus } from "../types";

// ── Placeholder thumbnails ────────────────────────────────────────────────────
export const IMG_1 = "https://images.unsplash.com/photo-1563393471486-370b35d7de64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";
export const IMG_2 = "https://images.unsplash.com/photo-1767557125491-b3483567d843?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";
export const IMG_3 = "https://images.unsplash.com/photo-1770116119330-2c80bc762d0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";
export const IMG_4 = "https://images.unsplash.com/photo-1683220367836-f421ee46c013?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=70";

// ── Seed data — replace with API call when backend is ready ──────────────────
export const INITIAL_PROJECTS: Project[] = [
  { id: 1, name: "Magic Girl Animation",  frames: 120, coloredFrames: 74, status: "in-progress", lastEdited: "2 hours ago",  thumbnail: IMG_1 },
  { id: 2, name: "Forest Spirit Walk",    frames: 48,  coloredFrames: 48, status: "complete",    lastEdited: "Yesterday",    thumbnail: IMG_2 },
  { id: 3, name: "City Background Pan",   frames: 200, coloredFrames: 12, status: "in-progress", lastEdited: "3 days ago",   thumbnail: IMG_3 },
  { id: 4, name: "Robot Dance Loop",      frames: 64,  coloredFrames: 0,  status: "draft",       lastEdited: "1 week ago",   thumbnail: IMG_4 },
];

// ── Status display config ─────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  "in-progress": { label: "In Progress", bg: "#EFF6FF", color: "#3B82F6" },
  complete:      { label: "Complete",    bg: "#F0FDF4", color: "#16A34A" },
  draft:         { label: "Draft",       bg: "#F8FAFF", color: "#94A3B8" },
};