import "dotenv/config";
import mysql from "mysql2/promise";
/** Explicit, additive deployment migration. Never alters production user or booking data. */
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required for the artist practice migration."
  );
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [columns] = await db.query(
    "SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='id'"
  );
  const userId = columns[0];
  if (
    !userId ||
    !/^varchar\(64\)$/i.test(userId.COLUMN_TYPE) ||
    !/^\w+$/.test(userId.CHARACTER_SET_NAME) ||
    !/^\w+$/.test(userId.COLLATION_NAME)
  )
    throw new Error(
      "Unexpected users.id definition. Review the migration before deployment."
    );
  await db.query(`CREATE TABLE IF NOT EXISTS artist_practice_sessions (
 artist_id varchar(64) CHARACTER SET ${userId.CHARACTER_SET_NAME} COLLATE ${userId.COLLATION_NAME} NOT NULL,
 revision int NOT NULL DEFAULT 0, state longtext NOT NULL,
 updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (artist_id), CONSTRAINT artist_practice_sessions_artist_fk FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
 )`);
  const [schema] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='artist_practice_sessions'"
  );
  if (
    !["artist_id", "revision", "state", "updated_at"].every(name =>
      schema.some(c => c.COLUMN_NAME === name)
    )
  )
    throw new Error("Artist practice table is incomplete.");
  console.log(
    "Artist practice migration verified. Production user and booking records were not modified."
  );
} finally {
  await db.end();
}
