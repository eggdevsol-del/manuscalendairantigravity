import "dotenv/config";
import mysql from "mysql2/promise";

async function forceTruncate() {
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);

    await connection.execute("SET FOREIGN_KEY_CHECKS=0;");

    try {
        console.log("Truncating studios...");
        await connection.execute("TRUNCATE TABLE studios;");

        console.log("Truncating studio_members...");
        await connection.execute("TRUNCATE TABLE studio_members;");
    } catch (e) {
        console.error(e);
    } finally {
        await connection.execute("SET FOREIGN_KEY_CHECKS=1;");
        connection.end();
    }
}

forceTruncate().then(() => console.log("Done."));
