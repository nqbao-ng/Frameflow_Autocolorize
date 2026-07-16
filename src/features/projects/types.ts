export type ProjectStatus =
  | "draft"
  | "ready"
  | "processing"
  | "needs-review"
  | "complete"
  | "failed";

export interface Project {
  id: string;
  name: string;
  frames: number;
  coloredFrames: number;
  status: ProjectStatus;
  lastEdited: string;
  thumbnail: string;
  currentReviewFrameId?: string | null;
  errorMessage?: string | null;
}

export interface CreateProjectPayload {
  name: string;
}

export interface UpdateProjectPayload {
  name?: string;
  archived?: boolean;
}

export interface ProjectsApiResponse {
  data: Project[];
  total: number;
}
