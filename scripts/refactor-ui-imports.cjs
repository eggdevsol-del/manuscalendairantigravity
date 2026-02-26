const fs = require("fs");
const path = require("path");

const DIR = path.resolve(__dirname, "../client/src");

function walk(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath, fileList);
      } else {
        if (/\.(tsx|ts)$/.test(file)) {
          fileList.push(filePath);
        }
      }
    });
  } catch (e) {
    console.error(`Error walking directory ${dir}:`, e);
  }
  return fileList;
}

try {
  const files = walk(DIR);
  let changedCount = 0;

  files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    const uiImports = [];
    const linesToRemove = new Set();
    let firstImportIndex = -1;

    // Regex to match: import { ... } from "@/components/ui/..."
    // Handles extra spaces and "type" keyword optionally
    const importRegex =
      /^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']@\/components\/ui\/([^"']+)["'];?$/;

    lines.forEach((line, index) => {
      const match = line.trim().match(importRegex);
      if (match) {
        if (firstImportIndex === -1) firstImportIndex = index;

        const imports = match[1]
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
        uiImports.push(...imports);
        linesToRemove.add(index);
      }
    });

    if (uiImports.length > 0) {
      // Unique imports
      const uniqueImports = [...new Set(uiImports)].sort();

      // Construct new import
      // Check if any original import used 'type' - simpler to just omit 'type' for now or assume values.
      // Most UI components are values.
      const newImportLine = `import { ${uniqueImports.join(", ")} } from "@/components/ui";`;

      // Reconstruct file
      const newLines = [];
      let added = false;

      lines.forEach((line, index) => {
        if (linesToRemove.has(index)) {
          if (!added && index === firstImportIndex) {
            newLines.push(newImportLine);
            added = true;
          }
        } else {
          newLines.push(line);
        }
      });

      const newContent = newLines.join("\n");

      if (newContent !== content) {
        fs.writeFileSync(file, newContent, "utf8");
        console.log(`Updated: ${file}`);
        changedCount++;
      }
    }
  });

  console.log(`Refactored ${changedCount} files.`);
} catch (error) {
  console.error("Script failed:", error);
  process.exit(1);
}
