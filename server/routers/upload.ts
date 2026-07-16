import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { MediaService } from "../services/media.service";
import { generateObjectKey, getPresignedUploadUrl } from "../lib/r2";

export const uploadRouter = router({
  /**
   * Get a presigned URL for direct client-to-R2 upload.
   * Client uploads the file directly to R2 via HTTP PUT,
   * bypassing the server for the actual file bytes.
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        folder: z.string().default("uploads"),
      })
    )
    .mutation(async ({ input }) => {
      // Validate file type
      if (!MediaService.isValidType(input.contentType)) {
        throw new Error(
          "Invalid file type. Only images and videos are allowed."
        );
      }

      // Generate a unique key and get presigned URL
      const key = generateObjectKey(input.folder, input.filename);
      const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
        key,
        input.contentType
      );

      return { uploadUrl, publicUrl, key };
    }),

  /**
   * Legacy: Upload image via base64 through the server.
   * Kept for backward compatibility — new code should use getUploadUrl.
   */
  uploadImage: protectedProcedure
    .input(
      z.object({
        fileData: z.string().optional(), // Base64 string (legacy)
        fileName: z.string().optional(),
        contentType: z.string().optional(),
        // New format
        base64: z.string().optional(), // Full base64 data URL
        filename: z.string().optional(),
        folder: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Support both old and new format
      let fileData = input.fileData || input.base64 || "";
      let fileName = input.fileName || input.filename || "upload.png";
      let contentType = input.contentType;

      // Extract content type from base64 data URL if present
      if (fileData.startsWith("data:")) {
        const match = fileData.match(/^data:([^;]+);base64,/);
        if (match) {
          contentType = match[1];
          fileData = fileData.replace(/^data:[^;]+;base64,/, "");
        }
      }

      // Default content type
      if (!contentType) {
        contentType = "image/png";
      }

      // Validate type
      if (!MediaService.isValidType(contentType)) {
        throw new Error(
          "Invalid file type. Only images and videos are allowed."
        );
      }

      // Add folder prefix to filename if specified
      if (input.folder) {
        fileName = `${input.folder}/${Date.now()}-${fileName}`;
      }

      // Save file (now uploads to R2)
      const url = await MediaService.saveBase64(
        fileData,
        fileName,
        contentType
      );

      return {
        url,
        success: true,
      };
    }),
});
