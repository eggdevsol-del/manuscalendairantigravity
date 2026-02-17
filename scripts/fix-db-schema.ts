import "dotenv/config";
import mysql from 'mysql2/promise';

async function run() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("DATABASE_URL not found");
        return;
    }

    const connection = await mysql.createConnection(connectionString);
    console.log("Connected to database");

    try {
        console.log("Updating appointments.status enum...");
        await connection.execute(`
            ALTER TABLE appointments MODIFY COLUMN status enum('pending','confirmed','cancelled','completed','no-show') NOT NULL DEFAULT 'pending';
        `);

        console.log("Updating appointment_logs.action enum...");
        await connection.execute(`
            ALTER TABLE appointment_logs MODIFY COLUMN action enum('created','rescheduled','cancelled','completed','proposal_revoked','no-show') NOT NULL;
        `);

        console.log("Schema updated successfully!");
    } catch (error) {
        console.error("Failed to update schema:", error);
    } finally {
        await connection.end();
    }
}

run();
