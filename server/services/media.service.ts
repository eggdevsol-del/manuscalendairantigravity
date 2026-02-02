import path from 'path';
import { randomUUID } from 'crypto';
import { storagePut } from '../storage';

export class MediaService {
    /**
     * Save a base64 string as a file using DB storage
     * @param base64Data content of the file (can be raw base64 or Data URL)
     * @param filename original filename
     * @param mimeType optional mime type if not using Data URL
     * @returns public URL path
     */
    static async saveBase64(base64Data: string, filename: string, mimeType?: string): Promise<string> {
        let data = base64Data;
        let actualMimeType = mimeType;

        // Extract pattern: data:image/png;base64,....
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);

        if (matches && matches.length === 3) {
            actualMimeType = matches[1];
            data = matches[2];
        } else if (base64Data.includes(';base64,')) {
            // Handle cases where more complex metadata might be present
            const parts = base64Data.split(';base64,');
            data = parts[1];
            if (!actualMimeType) {
                const mimeMatch = parts[0].match(/data:(.+)/);
                if (mimeMatch) actualMimeType = mimeMatch[1];
            }
        }

        if (!actualMimeType) {
            // Default to image/png if we can't determine it
            actualMimeType = 'image/png';
        }

        const buffer = Buffer.from(data, 'base64');
        const extension = path.extname(filename) || (actualMimeType.split('/')[1] ? `.${actualMimeType.split('/')[1]}` : '.png');
        const uniqueName = `${randomUUID()}${extension}`;

        // Ensure key is URL safe and structured
        const key = `uploads/${uniqueName}`;

        const result = await storagePut(key, buffer, actualMimeType);
        return result.url;
    }

    /**
     * Validate file type (image or video)
     */
    static isValidType(mimeType: string): boolean {
        return mimeType.startsWith('image/') || mimeType.startsWith('video/');
    }
}
