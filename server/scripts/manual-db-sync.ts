import mysql from "mysql2/promise";
import { ENV } from "../_core/env";

async function runMigration() {
    const uri = process.env.DATABASE_URL;
    if (!uri) {
        console.error("DATABASE_URL is not set.");
        process.exit(1);
    }

    console.log("Connecting to database...");
    const connection = await mysql.createConnection({ uri });

    console.log("Adding columns to studios table...");
    try {
        await connection.query("ALTER TABLE `studios` ADD `publicSlug` varchar(100);");
        await connection.query("ALTER TABLE `studios` ADD `funnelEnabled` tinyint DEFAULT 0;");
        await connection.query("ALTER TABLE `studios` ADD `logoUrl` varchar(500);");
        await connection.query("ALTER TABLE `studios` ADD `description` text;");
        console.log("Columns added.");
    } catch (e: any) {
        console.log("Columns may already exist:", e.message);
    }

    try {
        console.log("Generating unique slugs for existing rows...");
        await connection.query("UPDATE `studios` SET `publicSlug` = CONCAT('studio-', id) WHERE `publicSlug` IS NULL;");
        console.log("Setting unique constraint on publicSlug...");
        await connection.query("ALTER TABLE `studios` ADD CONSTRAINT `studios_publicSlug_unique` UNIQUE (`publicSlug`);");
        console.log("Constraint added.");
    } catch (e: any) {
        console.log("Constraint update failed/exists:", e.message);
    }

    try {
        console.log("Updating messageType enum...");
        await connection.query("ALTER TABLE `messages` MODIFY COLUMN `messageType` enum('text','system','appointment_request','appointment_confirmed','image','video','studio_invite') NOT NULL;");
        console.log("messageType enum updated.");
    } catch (e: any) {
        console.error("Enum update failed:", e.message);
    }

    await connection.end();
    console.log("Done!");
    process.exit(0);
}

runMigration().catch(console.error);
