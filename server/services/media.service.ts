import path from 'path';
import { randomUUID } from 'crypto';
import { storagePut } from '../storage';

export class MediaService {
    /**
     * Save a base64 string as a file using DB storage
     * @param base64Data content of the file
     * @param filename original filename
     * @returns public URL path
     */
    static async saveBase64(base64Data: string, filename: string): Promise<string> {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 string');
        }

        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const extension = path.extname(filename);
        const uniqueName = `${randomUUID()}${extension}`;

        // Use uploads/ prefix for organization
        const key = `uploads/${uniqueName}`;

        const result = await storagePut(key, buffer, mimeType);
        return result.url;
    }

    /**
     * Validate file type (image or video)
     */
    static isValidType(mimeType: string): boolean {
        return mimeType.startsWith('image/') || mimeType.startsWith('video/');
    }
}
