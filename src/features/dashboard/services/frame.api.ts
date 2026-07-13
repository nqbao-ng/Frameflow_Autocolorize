import { supabase } from "@/lib/supabase";

export async function createFrame(data: {
  projectId: string;
  frameIndex: number;
  sourceImageUrl: string;
}) {
  const { data: row, error } = await supabase
    .from("frames")
    .insert({
      project_id: data.projectId,
      frame_index: data.frameIndex,
      source_image_url: data.sourceImageUrl,
      status: "uploaded",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Database insert frame failed: ${error.message}`);
  }

  return row;
}

/**
 * Uses MAX(frame_index) instead of the current UI length.
 * This avoids duplicate indexes after a frame was deleted and files are
 * imported again.
 */
export async function getNextFrameIndex(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("frames")
    .select("frame_index")
    .eq("project_id", projectId)
    .order("frame_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Cannot determine the next frame index: ${error.message}`);
  }

  const highestIndex = Number(data?.frame_index);
  return Number.isFinite(highestIndex) ? highestIndex + 1 : 0;
}

export async function loadFrames(projectId: string) {
  const { data, error } = await supabase
    .from("frames")
    .select("*")
    .eq("project_id", projectId)
    .order("frame_index", { ascending: true });

  if (error) {
    throw new Error(`Load frames failed: ${error.message}`);
  }

  return data ?? [];
}

export async function updateFrameColor(
  frameId: string,
  coloredImageUrl: string,
) {
  const { error } = await supabase
    .from("frames")
    .update({
      colored_image_url: coloredImageUrl,
      status: "colored",
    })
    .eq("id", frameId);

  if (error) {
    throw new Error(`Update colored frame failed: ${error.message}`);
  }
}

export async function deleteFrame(frameId: string) {
  const { error } = await supabase
    .from("frames")
    .delete()
    .eq("id", frameId);

  if (error) {
    throw new Error(`Delete frame failed: ${error.message}`);
  }
}
