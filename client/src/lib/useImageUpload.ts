/**
 * useImageUpload — Direct-to-R2 image upload hook
 * ────────────────────────────────────────────────
 * 1. Gets a presigned URL from the server
 * 2. Uploads the file directly to R2 via HTTP PUT
 * 3. Returns the public CDN URL
 *
 * Usage:
 *   const { upload, isUploading } = useImageUpload();
 *   const url = await upload(file, "avatars");
 */
import { useState, useCallback, useRef } from "react";
import { trpc } from "./trpc";

interface UseImageUploadOptions {
  /** Max file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Accepted MIME types (default: image/*) */
  accept?: string[];
  /** Client-side resize before upload */
  resize?: { maxWidth: number; maxHeight: number; quality?: number };
}

interface UseImageUploadResult {
  /** Upload a File object to R2, returns the public URL */
  upload: (file: File, folder?: string) => Promise<string>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Progress 0-100 (approximate) */
  progress: number;
  /** Last error message */
  error: string | null;
  /** Open a file picker dialog and upload the selected file */
  pickAndUpload: (folder?: string) => Promise<string | null>;
}

/**
 * Resize an image on the client before uploading.
 * Returns a Blob of the resized image as JPEG.
 */
function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.width;
      let h = img.height;

      // Scale down if exceeds max dimensions
      if (w > maxWidth || h > maxHeight) {
        const ratio = Math.min(maxWidth / w, maxHeight / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to resize image"));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

export function useImageUpload(
  options: UseImageUploadOptions = {}
): UseImageUploadResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    accept = ["image/jpeg", "image/png", "image/webp", "image/gif"],
    resize,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getUploadUrl = trpc.upload.getUploadUrl.useMutation();

  const upload = useCallback(
    async (file: File, folder = "uploads"): Promise<string> => {
      setError(null);
      setIsUploading(true);
      setProgress(0);

      try {
        // Validate type
        if (accept.length > 0 && !accept.includes(file.type)) {
          throw new Error(
            `Invalid file type: ${file.type}. Accepted: ${accept.join(", ")}`
          );
        }

        // Validate size
        if (file.size > maxSize) {
          throw new Error(
            `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${(maxSize / 1024 / 1024).toFixed(0)}MB`
          );
        }

        // Optionally resize
        let uploadData: Blob = file;
        let contentType = file.type;
        let filename = file.name;

        if (resize && file.type.startsWith("image/")) {
          setProgress(10);
          uploadData = await resizeImage(
            file,
            resize.maxWidth,
            resize.maxHeight,
            resize.quality
          );
          contentType = "image/jpeg";
          filename = filename.replace(/\.\w+$/, ".jpg");
        }

        setProgress(20);

        // 1. Get presigned URL from server
        const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
          filename,
          contentType,
          folder,
        });

        setProgress(40);

        // 2. Upload directly to R2 via HTTP PUT
        const response = await fetch(uploadUrl, {
          method: "PUT",
          body: uploadData,
          headers: {
            "Content-Type": contentType,
          },
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        setProgress(100);
        return publicUrl;
      } catch (err: any) {
        const message = err.message || "Upload failed";
        setError(message);
        throw new Error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [accept, maxSize, resize, getUploadUrl]
  );

  const pickAndUpload = useCallback(
    async (folder = "uploads"): Promise<string | null> => {
      return new Promise((resolve) => {
        // Create a temporary file input
        if (!fileInputRef.current) {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = accept.join(",");
          input.style.display = "none";
          document.body.appendChild(input);
          fileInputRef.current = input;
        }

        const input = fileInputRef.current;
        input.value = ""; // Reset

        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }

          try {
            const url = await upload(file, folder);
            resolve(url);
          } catch {
            resolve(null);
          }
        };

        input.click();
      });
    },
    [accept, upload]
  );

  return { upload, isUploading, progress, error, pickAndUpload };
}
