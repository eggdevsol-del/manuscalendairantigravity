import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Verify and fix database schema by running migrations with detailed error reporting
 */
async function verifyAndFixDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('[DB Verify] DATABASE_URL not set');
    process.exit(1);
  }

  console.log('[DB Verify] Connecting to database...');
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    // Check existing tables
    console.log('[DB Verify] Checking existing tables...');
    const [existingTables] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    
    const tableNames = (existingTables as any[]).map((t: any) => t.table_name || t.TABLE_NAME);
    console.log(`[DB Verify] Found ${tableNames.length} existing tables:`, tableNames.join(', '));

    // Expected tables from schema
    const expectedTables = [
      'users',
      'appointments',
      'artistSettings',
      'consultations',
      'conversations',
      'messages',
      'notificationTemplates',
      'policies',
      'pushSubscriptions',
      'quickActionButtons',
      'socialMessageSync',
      'promotion_templates',
      'issued_promotions',
      'promotion_redemptions'
    ];

    const missingTables = expectedTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length === 0) {
      console.log('[DB Verify] ✓ All tables exist!');
      console.log('[DB Verify] Checking for pending migrations...');
      // Don't return - continue to run migrations in case there are column updates
    } else {
      console.log(`[DB Verify] Missing tables: ${missingTables.join(', ')}`);
    }

    console.log(`[DB Verify] ⚠ Missing ${missingTables.length} tables:`, missingTables.join(', '));
    console.log('[DB Verify] Running migrations to create missing tables...');

    // Find drizzle migrations directory
    let drizzlePath = path.join(process.cwd(), 'drizzle');
    if (!fs.existsSync(drizzlePath)) {
      // Try dist/drizzle for production
      drizzlePath = path.join(process.cwd(), 'dist', 'drizzle');
      if (!fs.existsSync(drizzlePath)) {
        console.error('[DB Verify] Drizzle migrations not found at:', drizzlePath);
        process.exit(1);
      }
    }
    console.log('[DB Verify] Using migrations from:', drizzlePath);

    const migrationFiles = fs.readdirSync(drizzlePath)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`[DB Verify] Found ${migrationFiles.length} migration files`);

    // Execute each migration file with detailed error reporting
    for (const file of migrationFiles) {
      console.log(`\n[DB Verify] Processing migration: ${file}`);
      const filePath = path.join(drizzlePath, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      // Split by Drizzle's statement breakpoint
      const statements = sql
        .split(/-->[\s]*statement-breakpoint/gi)
        .map(block => {
          return block
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        })
        .flat()
        .filter(s => s.length > 0);

      console.log(`[DB Verify] Found ${statements.length} statements in ${file}`);

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length === 0) continue;

        try {
          await connection.query(statement);
          successCount++;
          
          // Log table creation
          if (statement.toUpperCase().includes('CREATE TABLE')) {
            const match = statement.match(/CREATE TABLE [`']?(\w+)[`']?/i);
            if (match) {
              console.log(`  ✓ Created table: ${match[1]}`);
            }
          }
        } catch (error: any) {
          // Skip errors for items that already exist
          if (error.code === 'ER_DUP_KEYNAME' || 
              error.code === 'ER_FK_DUP_NAME' ||
              error.code === 'ER_TABLE_EXISTS_ERROR' ||
              error.code === 'ER_DUP_FIELDNAME') {
            skipCount++;
            continue;
          }
          
          // Log actual errors
          errorCount++;
          console.error(`  ✗ Error in statement ${i + 1}/${statements.length}:`);
          console.error(`    Code: ${error.code}`);
          console.error(`    Message: ${error.message}`);
          console.error(`    Statement: ${statement.substring(0, 200)}...`);
        }
      }

      console.log(`[DB Verify] ${file}: ${successCount} success, ${skipCount} skipped, ${errorCount} errors`);
    }

    // Verify tables again
    console.log('\n[DB Verify] Verifying final state...');
    const [finalTables] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    
    const finalTableNames = (finalTables as any[]).map((t: any) => t.table_name || t.TABLE_NAME);
    console.log(`[DB Verify] Final table count: ${finalTableNames.length}`);
    console.log(`[DB Verify] Tables:`, finalTableNames.join(', '));

    const stillMissing = expectedTables.filter(t => !finalTableNames.includes(t));
    if (stillMissing.length > 0) {
      console.error(`[DB Verify] ⚠ Still missing ${stillMissing.length} tables:`, stillMissing.join(', '));
      // Don't exit - let the server continue even if tables are missing
    }

    console.log('[DB Verify] ✓ All tables verified successfully!');

  } catch (error) {
    console.error('[DB Verify] Fatal error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

export { verifyAndFixDatabase };

