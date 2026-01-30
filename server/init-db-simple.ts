import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database initialization script using Drizzle migration files
 * Runs all migration SQL files to set up tables
 */
export async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.warn('[DB Init] DATABASE_URL not set, skipping database initialization');
    return;
  }

  console.log('[DB Init] Starting database initialization...');
  
  let connection;
  try {
    connection = await mysql.createConnection(databaseUrl);
    console.log('[DB Init] Connected to database');

    // Check if tables already exist
    const [tables] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
    );
    
    const tablesExist = (tables as any)[0].count > 0;
    
    if (tablesExist) {
      console.log('[DB Init] Tables already exist, checking for new migrations...');
      
      // Check for promotion_templates table (new in 0012)
      const [promoTable] = await connection.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'promotion_templates'"
      );
      
      if ((promoTable as any)[0].count === 0) {
        console.log('[DB Init] Running promotions system migration...');
        
        // Find drizzle path
        let drizzlePath = path.join(__dirname, '..', 'drizzle');
        if (__dirname.includes('/dist')) {
          drizzlePath = path.join(__dirname, 'drizzle');
        }
        
        const promoMigration = path.join(drizzlePath, '0012_promotions_system.sql');
        if (fs.existsSync(promoMigration)) {
          const sql = fs.readFileSync(promoMigration, 'utf-8');
          const statements = sql.split(';').filter(s => s.trim().length > 0);
          
          for (const statement of statements) {
            if (statement.trim()) {
              try {
                await connection.query(statement);
              } catch (error: any) {
                if (!error.message.includes('already exists')) {
                  console.error('[DB Init] Migration error:', error.message);
                }
              }
            }
          }
          console.log('[DB Init] ✓ Promotions system migration completed');
        }
      }
      
      await connection.end();
      return;
    }

    console.log('[DB Init] Database is empty, creating tables...');

    // Find the drizzle migration directory
    // In production (dist), drizzle folder is copied to dist/drizzle
    // In development, it's at ../drizzle relative to server
    let drizzlePath = path.join(__dirname, '..', 'drizzle');
    
    // If running from dist folder, drizzle is in dist/drizzle
    if (__dirname.includes('/dist')) {
      drizzlePath = path.join(__dirname, 'drizzle');
    }
    
    console.log(`[DB Init] Looking for migrations in: ${drizzlePath}`);
    
    if (!fs.existsSync(drizzlePath)) {
      console.error(`[DB Init] Drizzle migrations directory not found: ${drizzlePath}`);
      return;
    }

    // Get all .sql migration files and sort them
    const migrationFiles = fs.readdirSync(drizzlePath)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`[DB Init] Found ${migrationFiles.length} migration files`);

    // Execute each migration file
    for (const file of migrationFiles) {
      console.log(`[DB Init] Running migration: ${file}`);
      const filePath = path.join(drizzlePath, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      // Split by Drizzle's statement breakpoint marker or semicolons
      // Drizzle uses "--> statement-breakpoint" to separate statements
      const statements = sql
        .split(/-->[\s]*statement-breakpoint/gi)
        .map(block => {
          // Each block might have multiple statements separated by semicolons
          return block
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        })
        .flat()
        .filter(s => s.length > 0);

      console.log(`[DB Init] Executing ${statements.length} statements from ${file}...`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length > 0) {
          try {
            await connection.query(statement);
          } catch (error: any) {
            // Ignore errors for constraints or tables that might already exist
            if (error.code === 'ER_DUP_KEYNAME' || 
                error.code === 'ER_FK_DUP_NAME' ||
                error.code === 'ER_TABLE_EXISTS_ERROR' ||
                error.code === 'ER_DUP_FIELDNAME') {
              console.log(`[DB Init] Skipping duplicate/existing item in ${file} (${i + 1}/${statements.length})`);
              continue;
            }
            
            // Log the error but continue with other statements
            console.error(`[DB Init] Error in ${file} statement ${i + 1}:`, error.message);
            console.error('Statement:', statement.substring(0, 150) + '...');
            // Don't throw - continue with other statements
          }
        }
      }
    }

    // Verify tables were created
    const [finalTables] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    
    const tableNames = (finalTables as any[]).map((t: any) => t.table_name || t.TABLE_NAME);
    console.log(`[DB Init] ✓ Successfully created ${tableNames.length} tables:`, tableNames.join(', '));

  } catch (error: any) {
    console.error('[DB Init] Failed to initialize database:', error.message);
    // Don't throw - let the app continue
  } finally {
    if (connection) {
      await connection.end();
    }
    console.log('[DB Init] Database initialization complete');
  }
}

// Standalone execution removed - this file is only imported by the server
// The initializeDatabase() function is called from server/_core/index.ts

