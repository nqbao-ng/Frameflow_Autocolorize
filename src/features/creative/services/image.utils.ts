export type ImageDimensions = { width: number; height: number };

const MAX_SIDE = 1280;
const MAX_PIXELS = 1_300_000;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read this image. Upload the file directly if the frame URL blocks browser access."));
    image.src = source;
  });
}

export async function optimizeImageSource(source: string): Promise<{
  dataUrl: string;
  dimensions: ImageDimensions;
}> {
  const image = await loadImage(source);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  if (!originalWidth || !originalHeight) throw new Error("Invalid image dimensions");

  const sideScale = Math.min(1, MAX_SIDE / Math.max(originalWidth, originalHeight));
  const pixelScale = Math.min(1, Math.sqrt(MAX_PIXELS / (originalWidth * originalHeight)));
  const scale = Math.min(sideScale, pixelScale);
  const width = Math.max(64, Math.round(originalWidth * scale));
  const height = Math.max(64, Math.round(originalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser");
  context.drawImage(image, 0, 0, width, height);

  let dataUrl = canvas.toDataURL("image/png");
  if (dataUrl.length > 3_200_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.86);
  }
  if (dataUrl.length > 3_800_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  }

  return { dataUrl, dimensions: { width, height } };
}

export function fileToObjectUrl(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  return URL.createObjectURL(file);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function calculateExpansion(
  dimensions: ImageDimensions,
  ratio: "16:9" | "4:5" | "9:16" | "1:1",
) {
  const { width, height } = dimensions;
  let targetWidth = width;
  let targetHeight = height;

  if (ratio === "16:9") {
    targetWidth = Math.max(width, Math.round(height * (16 / 9)));
    targetHeight = Math.max(height, Math.round(width * (9 / 16)));
  } else if (ratio === "4:5") {
    targetWidth = Math.max(width, Math.round(height * (4 / 5)));
    targetHeight = Math.max(height, Math.round(width * (5 / 4)));
  } else if (ratio === "9:16") {
    targetWidth = Math.max(width, Math.round(height * (9 / 16)));
    targetHeight = Math.max(height, Math.round(width * (16 / 9)));
  } else {
    targetWidth = Math.max(width, height);
    targetHeight = targetWidth;
  }

  const horizontal = Math.max(0, Math.min(4000, targetWidth - width));
  const vertical = Math.max(0, Math.min(4000, targetHeight - height));
  return {
    left: Math.min(2000, Math.floor(horizontal / 2)),
    right: Math.min(2000, Math.ceil(horizontal / 2)),
    up: Math.min(2000, Math.floor(vertical / 2)),
    down: Math.min(2000, Math.ceil(vertical / 2)),
  };
}
