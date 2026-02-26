import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

/**
 * Database initialization script
 * This runs all SQL migrations to set up the database schema
 */
export async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("[DB Init] DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("[DB Init] Connecting to database...");

  let connection;
  try {
    connection = await mysql.createConnection(databaseUrl);
    console.log("[DB Init] Connected successfully");

    // Check if tables already exist
    const [tables] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
    );

    const tablesExist = (tables as any)[0].count > 0;

    if (tablesExist) {
      console.log(
        "[DB Init] Database tables already exist, skipping initialization"
      );
      await connection.end();
      return;
    }

    console.log("[DB Init] Database is empty, running migrations...");

    // Read and execute migration files in order
    const migrationFiles = [
      "../drizzle/0000_worried_post.sql",
      "../drizzle/0001_material_gargoyle.sql",
      "../drizzle/0002_adorable_sister_grimm.sql",
    ];

    for (const migrationFile of migrationFiles) {
      const filePath = path.join(__dirname, migrationFile);

      if (!fs.existsSync(filePath)) {
        console.warn(`[DB Init] Migration file not found: ${filePath}`);
        continue;
      }

      console.log(
        `[DB Init] Running migration: ${path.basename(migrationFile)}`
      );
      const sql = fs.readFileSync(filePath, "utf-8");

      // Split by statement breakpoint and execute each statement
      const statements = sql
        .split("--> statement-breakpoint")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        if (statement.length > 0) {
          try {
            await connection.query(statement);
          } catch (error: any) {
            // Ignore duplicate column/table errors as they may already exist
            if (
              !error.message.includes("Duplicate") &&
              !error.message.includes("already exists")
            ) {
              console.error(
                `[DB Init] Error executing statement:`,
                error.message
              );
              throw error;
            }
          }
        }
      }

      console.log(
        `[DB Init] ✓ Completed migration: ${path.basename(migrationFile)}`
      );
    }

    console.log("[DB Init] ✓ All migrations completed successfully");

    // Verify tables were created
    const [finalTables] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );

    console.log(
      `[DB Init] Created ${(finalTables as any[]).length} tables:`,
      (finalTables as any[])
        .map((t: any) => t.table_name || t.TABLE_NAME)
        .join(", ")
    );
  } catch (error) {
    console.error("[DB Init] Failed to initialize database:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// When run directly (not imported), execute initialization
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => {
      console.log("[DB Init] Database initialization complete");
      process.exit(0);
    })
    .catch(error => {
      console.error("[DB Init] Database initialization failed:", error);
      process.exit(1);
    });
}
