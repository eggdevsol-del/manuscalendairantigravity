
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function testConnection() {
    const logFile = 'db_test.log';
    fs.writeFileSync(logFile, `Starting DB test at ${new Date().toISOString()}\n`);

    if (!process.env.DATABASE_URL) {
        fs.appendFileSync(logFile, 'DATABASE_URL not set\n');
        return;
    }

    fs.appendFileSync(logFile, `Using DATABASE_URL: ${process.env.DATABASE_URL}\n`);

    try {
        const conn = await mysql.createConnection(process.env.DATABASE_URL);
        fs.appendFileSync(logFile, 'Connection successful!\n');
        const [rows] = await conn.query('SELECT 1 as result');
        fs.appendFileSync(logFile, `Query successful: ${JSON.stringify(rows)}\n`);
        await conn.end();
    } catch (e) {
        fs.appendFileSync(logFile, `Connection failed: ${e.message}\n`);
        if (e.stack) fs.appendFileSync(logFile, `${e.stack}\n`);
    }
}

testConnection();
