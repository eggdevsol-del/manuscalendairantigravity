// Run explicitly against the intended database. No credentials are stored in source.
import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
if (!process.stdin.isTTY) throw new Error("Run in an interactive terminal.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const prompt = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const email = (await prompt.question("Developer recovery email: ")).trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error("Valid email required");
const confirm = await prompt.question(
  "Create the private developer account in the configured database? Type CREATE: "
);
prompt.close();
if (confirm !== "CREATE") process.exit(0);
const hidden = createInterface({
  input: process.stdin,
  output: new Writable({
    write(_chunk, _encoding, next) {
      next();
    },
  }),
  terminal: true,
});
process.stdout.write("New password (hidden, at least 12 characters): ");
const password = await hidden.question("");
process.stdout.write("\nConfirm password (hidden): ");
const again = await hidden.question("");
hidden.close();
process.stdout.write("\n");
if (password.length < 12 || password !== again)
  throw new Error("Passwords must match and contain at least 12 characters.");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [existing] = await db.execute(
    "SELECT id FROM users WHERE email = ? OR role = ?",
    [email, "master_dev"]
  );
  if (existing.length)
    throw new Error(
      "An account with this email or a developer role already exists. No account changed."
    );
  const id = `dev_${randomBytes(16).toString("hex")}`;
  await db.execute(
    "INSERT INTO users (id,name,email,password,role,loginMethod,hasCompletedOnboarding) VALUES (?,?,?,?,?,?,?)",
    [
      id,
      "Master developer",
      email,
      await bcrypt.hash(password, 12),
      "master_dev",
      "private",
      1,
    ]
  );
  console.log(
    `Set MASTER_DEV_USER_ID=${id} on the server and restart.\nSet MASTER_DEV_USERNAME=MasterDevP (or your chosen username).\nOpen /dev/login. Sessions expire after 30 minutes.`
  );
} finally {
  await db.end();
}
