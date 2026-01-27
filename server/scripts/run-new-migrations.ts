/**
 * Run new migrations on existing database
 * This script runs migrations that haven't been applied yet
 */
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

async function runNewMigrations() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('[Migration] DATABASE_URL not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(DATABASE_URL);
  console.log('[Migration] Connected to database');

  try {
    // Check if promotion_templates table exists
    const [tables] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'promotion_templates'"
    );
    
    const tableExists = (tables as any)[0].count > 0;
    
    if (tableExists) {
      console.log('[Migration] promotion_templates table already exists');
      
      // Check if it has the new columns
      const [columns] = await connection.query(
        "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'promotion_templates' AND column_name = 'backgroundScale'"
      );
      
      if ((columns as any[]).length > 0) {
        console.log('[Migration] Table already has all columns');
        return;
      }
      
      console.log('[Migration] Adding missing columns...');
      
      // Add missing columns
      await connection.query(`
        ALTER TABLE promotion_templates 
        ADD COLUMN IF NOT EXISTS backgroundScale decimal(3,2) DEFAULT 1.00,
        ADD COLUMN IF NOT EXISTS backgroundPositionX int DEFAULT 50,
        ADD COLUMN IF NOT EXISTS backgroundPositionY int DEFAULT 50
      `);
      
      console.log('[Migration] ✓ Added missing columns');
    } else {
      console.log('[Migration] Running promotion system migration...');
      
      // Run the full migration
      const migrationPath = path.join(__dirname, '../../drizzle/0012_promotions_system.sql');
      if (!fs.existsSync(migrationPath)) {
        console.error('[Migration] Migration file not found:', migrationPath);
        process.exit(1);
      }
      
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      
      // Split by semicolons and execute each statement
      const statements = sql.split(';').filter(s => s.trim().length > 0);
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await connection.query(statement);
          } catch (error: any) {
            // Ignore "table already exists" errors
            if (!error.message.includes('already exists')) {
              console.error('[Migration] Error:', error.message);
            }
          }
        }
      }
      
      console.log('[Migration] ✓ Migration completed');
    }
  } finally {
    await connection.end();
  }
}

runNewMigrations().catch(console.error);
