import fs from "fs";
import path from "path";
import { glob } from "glob";

const BANNED_IMPORTS = [
  "@/components/ui/dialog",
  "@/components/ui/sheet",
  "components/ui/dialog",
  "components/ui/sheet",
];

const ALLOWED_FILES = [
  "client/src/components/ui/overlays/modal-shell.tsx",
  "client/src/components/ui/overlays/sheet-shell.tsx",
  "client/src/ui/wizard/WizardShell.tsx",
];

const SCAN_DIR = "client/src/{pages,features}/**/*.{ts,tsx}";

console.log("🔍 Checking for banned legacy overlay imports...");

glob(SCAN_DIR, (err, files) => {
  if (err) {
    console.error("Error scanning files:", err);
    process.exit(1);
  }

  let hasErrors = false;

  files.forEach(file => {
    // Normalize path for comparison
    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, "/");

    // Skip allowed files
    if (ALLOWED_FILES.some(allowed => relativePath.endsWith(allowed))) {
      return;
    }

    const content = fs.readFileSync(file, "utf8");

    BANNED_IMPORTS.forEach(importPath => {
      // Check for both "import ... from 'path'" and "import('path')"
      const regex = new RegExp(`from ['"]${importPath}['"]`, "g");
      if (regex.test(content)) {
        console.error(
          `❌ Banned import found in ${relativePath}: ${importPath}`
        );
        console.error(
          `   Use 'ModalShell' or 'SheetShell' from '@/components/ui/overlays' instead.`
        );
        hasErrors = true;
      }
    });
  });

  if (hasErrors) {
    console.error(
      "\n🚫 Legacy overlay verification failed. Please migrate to shared shells."
    );
    process.exit(1);
  } else {
    console.log("✅ No legacy overlay imports found.");
  }
});
