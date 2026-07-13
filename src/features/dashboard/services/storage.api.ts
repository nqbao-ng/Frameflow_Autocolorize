import { supabase } from "@/lib/supabase";

export type UploadedStorageObject = {
  publicUrl: string;
  path: string;
};

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getSafeExtension(file: File): string {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();

  if (extensionFromName && /^[a-z0-9]{2,5}$/.test(extensionFromName)) {
    return extensionFromName === "jpeg" ? "jpg" : extensionFromName;
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "png";
}

export function validateImageFile(file: File): void {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtension = extension && ["png", "jpg", "jpeg", "webp", "gif"].includes(extension);

  // Some browsers/OS combinations leave File.type empty. In that case, use
  // the extension instead of rejecting a valid image.
  if ((file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) || (!file.type && !allowedExtension)) {
    throw new Error(`${file.name}: chỉ hỗ trợ PNG, JPG, WEBP hoặc GIF.`);
  }

  if (file.size <= 0) {
    throw new Error(`${file.name}: file rỗng hoặc không đọc được.`);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name}: dung lượng vượt quá 25 MB.`);
  }
}

async function uploadObject(params: {
  bucket: string;
  path: string;
  body: Blob;
  contentType: string;
}): Promise<UploadedStorageObject> {
  const { bucket, path, body, contentType } = params;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, body, {
      // The path already contains a UUID. upsert also makes a retry safe if the
      // first request reached Storage but the browser lost the response.
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(`Storage upload failed (${bucket}): ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  if (!publicUrlData.publicUrl) {
    throw new Error(`Storage did not return a public URL for ${data.path}.`);
  }

  return {
    publicUrl: publicUrlData.publicUrl,
    path: data.path,
  };
}

export async function uploadFrameImage(
  file: File,
  projectId: string,
): Promise<UploadedStorageObject> {
  validateImageFile(file);

  const extension = getSafeExtension(file);
  const filePath = `${projectId}/source/${makeId()}.${extension}`;

  return uploadObject({
    bucket: "frames",
    path: filePath,
    body: file,
    contentType: file.type || "image/png",
  });
}

export async function removeFrameImage(path: string): Promise<void> {
  if (!path) return;

  const { error } = await supabase.storage
    .from("frames")
    .remove([path]);

  if (error) {
    // Cleanup failure must not hide the original database error.
    console.warn("FRAME STORAGE CLEANUP ERROR:", error);
  }
}

export async function uploadColoredFrame(
  blob: Blob,
  projectId: string,
  frameId: string,
): Promise<string> {
  if (!blob || blob.size <= 0) {
    throw new Error("Colored image is empty or could not be read.");
  }

  if (blob instanceof File) validateImageFile(blob);

  const contentType = blob.type || "image/png";
  const extension = contentType === "image/jpeg"
    ? "jpg"
    : contentType === "image/webp"
      ? "webp"
      : contentType === "image/gif"
        ? "gif"
        : "png";
  const filePath = `${projectId}/reference/${frameId}-${makeId()}.${extension}`;

  const uploaded = await uploadObject({
    bucket: "colored-frames",
    path: filePath,
    body: blob,
    contentType,
  });

  return uploaded.publicUrl;
}
