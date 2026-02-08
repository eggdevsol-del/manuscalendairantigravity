
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkColumns() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not set');
        return;
    }

    const conn = await mysql.createConnection(process.env.DATABASE_URL);

    try {
        console.log('--- Checking consultations table ---');
        const [cols_cons] = await conn.query('SHOW COLUMNS FROM consultations');
        console.log(cols_cons);

        console.log('--- Checking conversations table ---');
        const [cols_conv] = await conn.query('SHOW COLUMNS FROM conversations');
        console.log(cols_conv);
    } catch (e) {
        console.error('Error checking columns:', e);
    } finally {
        await conn.end();
    }
}

checkColumns();
