import { supabase } from "@/lib/supabase";

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
export async function createProject(
  name: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}