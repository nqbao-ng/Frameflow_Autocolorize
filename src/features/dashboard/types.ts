// export type Tool = "brush" | "pencil" | "fill" | "eraser" | "picker" | "smudge" | "dodge" | "burn";
// export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "soft-light" | "hard-light" | "color-dodge" | "color-burn";
// export type FrameState = "plain" | "ai" | "manual";
// export type ImportedFile = { id: string; name: string; url: string };
// export type ContextMenu = { frameIndex: number; x: number; y: number } | null;

export type Tool =
  | "brush"
  | "pencil"
  | "fill"
  | "eraser"
  | "picker"
  | "smudge"
  | "dodge"
  | "burn";

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "color-dodge"
  | "color-burn";

export type FrameState =
  | "plain"
  | "ai"
  | "manual";

export type ImportedFile = {
  id: string;
  name: string;

  // line art gốc
  url: string;

  // colored layer đã save cloud
  paintUrl?: string | null;
};

export type ContextMenu = {
  frameIndex: number;
  x: number;
  y: number;
} | null;