import "dotenv/config";
import mysql from "mysql2/promise";

async function check() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  // Who is user_ce549c0b?
  const [users] = await connection.execute(
    `SELECT id, email, name, role, loginMethod FROM users WHERE id = ?`,
    ["user_ce549c0b4b6f90aaafad0546a0928050"]
  );
  console.log("Mystery artist:", JSON.stringify(users));

  // Check artist_settings for both IDs
  const [settings] = await connection.execute(
    `SELECT userId, displayName, publicSlug FROM artist_settings 
     WHERE userId IN ('user_ce549c0b4b6f90aaafad0546a0928050', 'user_15b712d6ac083d3fee68a0984a1e5a3e')`
  );
  console.log("\nArtist settings:", JSON.stringify(settings));

  // How did the client get to conversation 3? Check which artist the client UI navigated to
  const [convo3] = await connection.execute(
    `SELECT * FROM conversations WHERE id = 3`
  );
  console.log("\nConversation 3:", JSON.stringify(convo3));

  await connection.end();
}

check().catch(console.error);
