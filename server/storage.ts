// Database-backed storage for images and files
// Stores files as base64 in MySQL database

import { getDb } from './db';
import { sql } from 'drizzle-orm';

// Initialize storage table
async function ensureStorageTable() {
  const db = await getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS file_storage (
      file_key VARCHAR(255) PRIMARY KEY,
      file_data LONGTEXT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  console.log('[Storage] Starting upload:', { relKey, dataLength: data.length, contentType });
  await ensureStorageTable();
  console.log('[Storage] Storage table ensured');

  const key = relKey.replace(/^\/+/, '');
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const base64Data = buffer.toString('base64');
  const mimeType = contentType || getMimeType(key);

  // Insert or update the file
  console.log('[Storage] Preparing to insert:', { key, base64Length: base64Data.length, mimeType });
  const db = await getDb();
  await db.execute(sql`
    INSERT INTO file_storage (file_key, file_data, mime_type)
    VALUES (${key}, ${base64Data}, ${mimeType})
    ON DUPLICATE KEY UPDATE 
      file_data = ${base64Data},
      mime_type = ${mimeType},
      created_at = CURRENT_TIMESTAMP
  `);

  const url = `/api/files/${key}`;
  console.log('[Storage] Upload successful:', { key, url });
  return { key, url };
}

export async function storageGet(
  relKey: string,
  _expiresIn = 300
): Promise<{ key: string; url: string; }> {
  const key = relKey.replace(/^\/+/, '');
  const url = `/api/files/${key}`;
  return { key, url };
}

// Helper function to retrieve file data from database
export async function storageGetData(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
  const db = await getDb();
  const result: any = await db.execute(sql`
    SELECT file_data, mime_type FROM file_storage WHERE file_key = ${key}
  `);

  if (!result || !result[0]) {
    return null;
  }

  // Handle different driver result structures
  // mysql2 returns [rows, fields] so result[0] is the rows array
  const rows = Array.isArray(result[0]) ? result[0] : result;

  if (!rows[0] || !rows[0].file_data) {
    return null;
  }

  return {
    data: Buffer.from(rows[0].file_data as string, 'base64'),
    mimeType: rows[0].mime_type as string
  };
}

