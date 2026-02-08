
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function verify() {
    const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

    const [users] = await conn.query('SELECT COUNT(*) as count FROM users WHERE role = "client"');
    const [convs] = await conn.query('SELECT COUNT(*) as count FROM conversations');
    const [leads] = await conn.query('SELECT COUNT(*) as count FROM leads');
    const [consults] = await conn.query('SELECT COUNT(*) as count FROM consultations');

    console.log('=== Database Verification ===');
    console.log('Clients:', (users as any)[0].count);
    console.log('Conversations:', (convs as any)[0].count);
    console.log('Leads:', (leads as any)[0].count);
    console.log('Consultations:', (consults as any)[0].count);

    await conn.end();
}

verify().catch(console.error);
