
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
// We are in server/scripts. Root is ../..
const rootDir = path.resolve(__dirname, '../../');
const clientVersionPath = path.join(rootDir, 'client/src/lib/version.ts');
const packageJsonPath = path.join(rootDir, 'package.json');

// Read current version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version; // e.g., "1.0.0"

console.log(`Current version: ${currentVersion}`);

// Increment patch version
const parts = currentVersion.split('.').map(Number);
parts[2] += 1;
const newVersion = parts.join('.');

console.log(`Bumping to: ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// NOTE: We do not update client/src/lib/version.ts directly because it uses
// __APP_VERSION__ injected by Vite from package.json
// Writing to it would destroy the helper functions.

console.log('Version updated successfully.');

console.log('Version updated successfully.');
