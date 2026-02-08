
import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';

async function verify() {
    const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

    // Get all artists
    const [artists] = await conn.query('SELECT id, name, email FROM users WHERE role="artist"');

    let output = '--- Artist Audit ---\n';

    for (const artist of (artists as any[])) {
        const [convs] = await conn.query('SELECT COUNT(*) as count FROM conversations WHERE artistId = ?', [artist.id]);
        const count = (convs as any)[0].count;
        if (count > 0) {
            output += `Artist: ${artist.name} (${artist.email}) [ID: ${artist.id}] - Conversations: ${count}\n`;
        }
    }

    const [allConvs] = await conn.query('SELECT COUNT(*) as count FROM conversations');
    output += `\nTotal conversations in DB: ${(allConvs as any)[0].count}\n`;

    fs.writeFileSync('server/scripts/verify_output.txt', output);
    console.log('Verification complete. Check server/scripts/verify_output.txt');

    await conn.end();
}

verify().catch(console.error);
