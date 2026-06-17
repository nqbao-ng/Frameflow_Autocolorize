import { supabase } from "@/lib/supabase";

export async function uploadFrameImage(
  file: File,
  projectId: string,
) {
  const fileExt = file.name.split(".").pop();

  const fileName =
    `${projectId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("frames")
    .upload(fileName, file);

  if (error) {
    throw error;
  }

  const { data: publicUrlData } =
    supabase.storage
      .from("frames")
      .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

// export async function uploadColoredFrame(
//   blob: Blob,
//   projectId: string,
//   frameId: string,
// ) {
//   const filePath = `${projectId}/${frameId}-${Date.now()}.png`;

//   const { error } = await supabase.storage
//     .from("colored-frames")
//     .upload(filePath, blob, {
//       upsert: true,
//       contentType: "image/png",
//     });

//   if (error) {
//     throw error;
//   }

//   const {
//     data,
//   } = supabase.storage
//     .from("colored-frames")
//     .getPublicUrl(filePath);

//   return data.publicUrl;
// }

export async function uploadColoredFrame(
  blob: Blob,
  projectId: string,
  frameId: string,
) {
  console.log("Uploading colored frame:", {
    bucket: "colored-frames",
    projectId,
    frameId,
    size: blob.size,
    type: blob.type,
  });

  const filePath = `${projectId}/${frameId}-${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("colored-frames")
    .upload(filePath, blob, {
      upsert: true,
      contentType: "image/png",
    });

  if (error) {
    console.error("UPLOAD COLORED FRAME ERROR:", error);
    throw error;
  }

  const { data } = supabase.storage
    .from("colored-frames")
    .getPublicUrl(filePath);

  return data.publicUrl;
}