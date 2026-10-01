/** Bound the uploaded image dimensions, not the size of the user's original file. */
export function promotionImageSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error("This image has invalid dimensions.");
  const scale = Math.min(1, 2048 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function preparePromotionImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be opened on your device. Try exporting it as JPG or PNG."));
      image.src = url;
    });
    const size = promotionImageSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image conversion is unavailable on this device.");
      context.drawImage(image, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Couldn’t convert this image. Try a smaller copy.")), "image/webp", 0.85));
      if (blob.type !== "image/webp") throw new Error("Your browser does not support WebP conversion. Please update it and try again.");
      return blob;
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally { image.src = ""; URL.revokeObjectURL(url); }
}
