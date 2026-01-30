import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { MediaService } from "../services/media.service";

export const uploadRouter = router({
    uploadImage: publicProcedure
        .input(z.object({
            fileData: z.string().optional(), // Base64 string (legacy)
            fileName: z.string().optional(),
            contentType: z.string().optional(),
            // New format
            base64: z.string().optional(), // Full base64 data URL
            filename: z.string().optional(),
            folder: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            // Support both old and new format
            let fileData = input.fileData || input.base64 || '';
            let fileName = input.fileName || input.filename || 'upload.png';
            let contentType = input.contentType;
            
            // Extract content type from base64 data URL if present
            if (fileData.startsWith('data:')) {
                const match = fileData.match(/^data:([^;]+);base64,/);
                if (match) {
                    contentType = match[1];
                    fileData = fileData.replace(/^data:[^;]+;base64,/, '');
                }
            }
            
            // Default content type
            if (!contentType) {
                contentType = 'image/png';
            }

            // Validate type
            if (!MediaService.isValidType(contentType)) {
                throw new Error("Invalid file type. Only images and videos are allowed.");
            }

            // Add folder prefix to filename if specified
            if (input.folder) {
                fileName = `${input.folder}/${Date.now()}-${fileName}`;
            }

            // Save file
            const url = await MediaService.saveBase64(fileData, fileName);

            return {
                url,
                success: true
            };
        }),
});
