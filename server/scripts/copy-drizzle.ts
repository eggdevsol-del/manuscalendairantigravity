import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "drizzle");
const dest = path.join(process.cwd(), "dist", "drizzle");

if (!fs.existsSync(src)) {
  console.error('Source directory "drizzle" does not exist.');
  process.exit(1);
}

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

fs.cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} to ${dest}`);
