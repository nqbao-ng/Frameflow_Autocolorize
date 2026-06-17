export type ProjectStatus = "in-progress" | "complete" | "draft";

export interface Project {
  id: string;
  name: string;
  frames: number;
  coloredFrames: number;
  status: ProjectStatus;
  lastEdited: string;
  thumbnail: string;
}

// ── API shapes (dùng khi connect backend) ────────────────────────────────────

export interface CreateProjectPayload {
  name: string;
}

export interface UpdateProjectPayload {
  name?: string;
  status?: ProjectStatus;
}

export interface ProjectsApiResponse {
  data: Project[];
  total: number;
}