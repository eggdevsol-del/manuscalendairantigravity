import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME, getPublicUrl } from "../lib/r2";

export class MediaService {
  /**
   * Save a base64 string by uploading to Cloudflare R2.
   * Returns the public CDN URL.
   *
   * @param base64Data content of the file (can be raw base64 or Data URL)
   * @param filename original filename
   * @param mimeType optional mime type if not using Data URL
   * @returns public URL on R2 CDN
   */
  static async saveBase64(
    base64Data: string,
    filename: string,
    mimeType?: string
  ): Promise<string> {
    let data = base64Data;
    let actualMimeType = mimeType;

    // Extract pattern: data:image/png;base64,....
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);

    if (matches && matches.length === 3) {
      actualMimeType = matches[1];
      data = matches[2];
    } else if (base64Data.includes(";base64,")) {
      // Handle cases where more complex metadata might be present
      const parts = base64Data.split(";base64,");
      data = parts[1];
      if (!actualMimeType) {
        const mimeMatch = parts[0].match(/data:(.+)/);
        if (mimeMatch) actualMimeType = mimeMatch[1];
      }
    }

    if (!actualMimeType) {
      actualMimeType = "image/png";
    }

    const buffer = Buffer.from(data, "base64");
    const ext =
      filename.split(".").pop()?.toLowerCase() ||
      actualMimeType.split("/")[1] ||
      "png";
    const key = `uploads/${randomUUID()}.${ext}`;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: actualMimeType,
    });

    await r2Client.send(command);

    return getPublicUrl(key);
  }

  /**
   * Validate file type (image or video)
   */
  static isValidType(mimeType: string): boolean {
    return mimeType.startsWith("image/") || mimeType.startsWith("video/");
  }
}
