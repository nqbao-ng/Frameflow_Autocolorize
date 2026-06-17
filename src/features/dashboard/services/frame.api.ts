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
    throw error;
  }

  return row;
}

export async function loadFrames(projectId: string) {
  const { data, error } = await supabase
    .from("frames")
    .select("*")
    .eq("project_id", projectId)
    .order("frame_index", { ascending: true });

  if (error) {
    throw error;
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
    throw error;
  }
}

export async function deleteFrame(frameId: string) {
  const { error } = await supabase
    .from("frames")
    .delete()
    .eq("id", frameId);

  if (error) {
    throw error;
  }
}
